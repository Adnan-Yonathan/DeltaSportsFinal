import { NextRequest, NextResponse } from 'next/server'

import {
  fetchPropOrderbooksSnapshot,
  type PropOrderbookItem,
} from '@/lib/services/prop-liquidity-detector'
import {
  getPropOrderbooksCache,
  setPropOrderbooksCache,
} from '@/lib/services/prop-orderbooks-cache'

export const dynamic = 'force-dynamic'
const DEFAULT_DEPTH = 8
const DEFAULT_MIN_SHARP_NOTIONAL = 100
const PERSISTED_CACHE_LIMIT = 200

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
  fetchedAt: string | null
) => {
  const items =
    sport === 'all'
      ? cachedPayload.items
      : cachedPayload.items.filter((item) => item.sportKey === sport)
  const sliced = items.slice(0, normalizedLimit)

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
    },
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
      if (exactPayload) {
        return buildCachedResponse(
          sport,
          normalizedLimit,
          exactPayload,
          'persistent',
          cachedExact?.fetched_at ?? null
        )
      }

      if (sport !== 'all') {
        const allCacheKey = buildCacheKey('all', normalizedDepth, normalizedMinSharpNotional)
        const cachedAll = await getPropOrderbooksCache(allCacheKey)
        const allPayload = parsePersistedPayload(cachedAll?.payload)
        if (allPayload) {
          return buildCachedResponse(
            sport,
            normalizedLimit,
            allPayload,
            'persistent_all_fallback',
            cachedAll?.fetched_at ?? null
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

    if (canUsePersistentCache) {
      const cacheKey = buildCacheKey(sport, normalizedDepth, normalizedMinSharpNotional)
      const payload: PersistedPayload = {
        sport,
        depth: normalizedDepth,
        minSharpNotional: normalizedMinSharpNotional,
        updatedAt: snapshot.updatedAt,
        items: snapshot.items,
      }
      await setPropOrderbooksCache(cacheKey, payload)
    }

    return NextResponse.json({
      ok: true,
      sport,
      updatedAt: snapshot.updatedAt,
      count: snapshot.items.slice(0, normalizedLimit).length,
      items: snapshot.items.slice(0, normalizedLimit),
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
      },
    })
  } catch (error: any) {
    console.error('[prop-orderbooks] error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
