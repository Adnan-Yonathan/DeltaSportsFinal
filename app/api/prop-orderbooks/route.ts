import { NextRequest, NextResponse } from 'next/server'

import {
  fetchPropOrderbooksSnapshot,
  type PropOrderbookItem,
} from '@/lib/services/prop-liquidity-detector'
import {
  getPropOrderbooksCache,
  setPropOrderbooksCache,
} from '@/lib/services/prop-orderbooks-cache'
import {
  parseCacheAgeMs,
  resolveSnapshotDiagnostics,
  shouldPersistPropOrderbooksSnapshot,
} from '@/lib/services/prop-orderbooks-cache-guard'

export const dynamic = 'force-dynamic'
const DEFAULT_DEPTH = 8
const DEFAULT_MIN_SHARP_NOTIONAL = 100
const PERSISTED_CACHE_LIMIT = 200
const PERSISTED_CACHE_MAX_AGE_MS = 3 * 60 * 1000

const SUPPORTED_SPORTS = new Set([
  'all',
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
  'basketball_ncaab',
  'americanfootball_ncaaf',
])

type PersistedPayload = {
  sport: string
  depth: number
  minSharpNotional: number
  updatedAt: string
  items: PropOrderbookItem[]
}

const buildCacheKey = (sport: string, depth: number, minSharpNotional: number) =>
  `sport:${sport}:depth:${depth}:min:${minSharpNotional}`

const parsePersistedPayload = (value: unknown): PersistedPayload | null => {
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<PersistedPayload>
  if (
    typeof payload.sport !== 'string' ||
    typeof payload.depth !== 'number' ||
    typeof payload.minSharpNotional !== 'number' ||
    typeof payload.updatedAt !== 'string' ||
    !Array.isArray(payload.items)
  ) {
    return null
  }
  return payload as PersistedPayload
}

const buildCachedResponse = (
  sport: string,
  normalizedLimit: number,
  cachedPayload: PersistedPayload,
  cacheSource: 'persistent' | 'persistent_all_fallback',
  fetchedAt: string | null,
  cacheAgeMs: number | null
) => {
  const items =
    sport === 'all'
      ? cachedPayload.items
      : cachedPayload.items.filter((item) => item.sportKey === sport)
  const sliced = items.slice(0, normalizedLimit)
  const diagnostics = resolveSnapshotDiagnostics(sliced)

  return NextResponse.json({
    ok: true,
    sport,
    updatedAt: cachedPayload.updatedAt,
    count: sliced.length,
    items: sliced,
    cache: {
      forcedRefresh: false,
      source: cacheSource,
      fetchedAt,
      cacheAgeMs,
    },
    diagnostics,
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport') || 'all'
    const forceRefresh = searchParams.get('refresh') === '1'
    const requestedModeParam = searchParams.get('mode')
    const limit = Number(searchParams.get('limit') || 60)
    const depth = Number(searchParams.get('depth') || 8)
    const minSharpNotional = Number(searchParams.get('minSharpNotional') || 100)

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json(
        { ok: false, error: 'Unsupported sport' },
        { status: 400 }
      )
    }

    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60
    const normalizedDepth = Number.isFinite(depth) ? Math.min(Math.max(depth, 1), 20) : 8
    const normalizedMinSharpNotional = Number.isFinite(minSharpNotional)
      ? Math.max(minSharpNotional, 0)
      : 100
    const requestedMode =
      requestedModeParam === 'fast' || requestedModeParam === 'full'
        ? requestedModeParam
        : null
    const mode = requestedMode ?? (forceRefresh ? 'full' : 'fast')

    const canUsePersistentCache =
      normalizedDepth === DEFAULT_DEPTH &&
      normalizedMinSharpNotional === DEFAULT_MIN_SHARP_NOTIONAL

    if (canUsePersistentCache && !forceRefresh) {
      const exactCacheKey = buildCacheKey(sport, normalizedDepth, normalizedMinSharpNotional)
      const cachedExact = await getPropOrderbooksCache(exactCacheKey)
      const exactPayload = parsePersistedPayload(cachedExact?.payload)
      const exactAgeMs = parseCacheAgeMs(cachedExact?.fetched_at ?? null)
      const exactCacheFresh = exactAgeMs != null && exactAgeMs <= PERSISTED_CACHE_MAX_AGE_MS
      if (exactPayload && exactCacheFresh) {
        return buildCachedResponse(
          sport,
          normalizedLimit,
          exactPayload,
          'persistent',
          cachedExact?.fetched_at ?? null,
          exactAgeMs
        )
      }

      if (sport !== 'all') {
        const allCacheKey = buildCacheKey('all', normalizedDepth, normalizedMinSharpNotional)
        const cachedAll = await getPropOrderbooksCache(allCacheKey)
        const allPayload = parsePersistedPayload(cachedAll?.payload)
        const allAgeMs = parseCacheAgeMs(cachedAll?.fetched_at ?? null)
        const allCacheFresh = allAgeMs != null && allAgeMs <= PERSISTED_CACHE_MAX_AGE_MS
        if (allPayload && allCacheFresh) {
          return buildCachedResponse(
            sport,
            normalizedLimit,
            allPayload,
            'persistent_all_fallback',
            cachedAll?.fetched_at ?? null,
            allAgeMs
          )
        }
      }
    }

    const computeLimit =
      forceRefresh && canUsePersistentCache && mode === 'full'
        ? Math.max(normalizedLimit, PERSISTED_CACHE_LIMIT)
        : normalizedLimit

    const snapshot = await fetchPropOrderbooksSnapshot({
      sportKey: sport,
      limit: computeLimit,
      depth: normalizedDepth,
      minSharpNotional: normalizedMinSharpNotional,
      mode,
    })

    let persisted = false
    let cacheWriteSkippedDegraded = false
    if (canUsePersistentCache) {
      const cacheKey = buildCacheKey(sport, normalizedDepth, normalizedMinSharpNotional)
      const existingCache = await getPropOrderbooksCache(cacheKey)
      const existingPayload = parsePersistedPayload(existingCache?.payload)
      const shouldPersist =
        !existingPayload ||
        shouldPersistPropOrderbooksSnapshot(existingPayload.items, snapshot.items)

      const payload: PersistedPayload = {
        sport,
        depth: normalizedDepth,
        minSharpNotional: normalizedMinSharpNotional,
        updatedAt: snapshot.updatedAt,
        items: snapshot.items,
      }
      if (shouldPersist) {
        persisted = await setPropOrderbooksCache(cacheKey, payload)
      } else {
        cacheWriteSkippedDegraded = true
      }
    }

    const responseItems = snapshot.items.slice(0, normalizedLimit)
    const diagnostics = resolveSnapshotDiagnostics(responseItems)

    return NextResponse.json({
      ok: true,
      sport,
      updatedAt: snapshot.updatedAt,
      count: responseItems.length,
      items: responseItems,
      cache: {
        forcedRefresh: forceRefresh,
        source: forceRefresh
          ? canUsePersistentCache
            ? mode === 'full'
              ? 'live_computed_persisted_full'
              : 'live_computed_persisted_fast_refresh'
            : mode === 'full'
              ? 'live_computed_full'
              : 'live_computed_fast_refresh'
          : canUsePersistentCache
            ? 'live_computed_persisted_fast'
            : 'live_computed_fast',
        persisted,
        cacheWriteSkippedDegraded,
      },
      diagnostics,
    })
  } catch (error: any) {
    console.error('[prop-orderbooks] error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
