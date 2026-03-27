import { NextRequest, NextResponse } from 'next/server'

import {
  fetchPropOrderbooksSnapshot,
  type PropOrderbookItem,
} from '@/lib/services/prop-liquidity-detector'
import { resolveSnapshotDiagnostics } from '@/lib/services/prop-orderbooks-cache-guard'
import { getUsMarketDayKey } from '@/lib/utils/upcoming-event-filter'
import {
  DEFAULT_PROP_ORDERBOOKS_DEPTH,
  DEFAULT_PROP_ORDERBOOKS_MIN_SHARP_NOTIONAL,
  filterPropOrderbooksItemsByDateWindow,
  PERSISTED_PROP_ORDERBOOKS_LIMIT,
  type PropOrderbooksDateWindow,
  persistPropOrderbooksSnapshot,
  readPersistedPropOrderbooksSnapshot,
} from '@/lib/services/prop-orderbooks-snapshot'

export const dynamic = 'force-dynamic'
const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const

const SUPPORTED_SPORTS = new Set([
  'all',
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
  'basketball_ncaab',
  'americanfootball_ncaaf',
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport') || 'all'
    const requestedModeParam = searchParams.get('mode')
    const dateWindowParam = searchParams.get('dateWindow')
    const forceRefresh = searchParams.get('refresh') === '1'
    const limit = Number(searchParams.get('limit') || 60)
    const depth = Number(searchParams.get('depth') || 8)
    const minSharpNotional = Number(searchParams.get('minSharpNotional') || 100)

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json(
        { ok: false, error: 'Unsupported sport' },
        { status: 400, headers: NO_STORE_HEADERS }
      )
    }

    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60
    const normalizedDepth = Number.isFinite(depth)
      ? Math.min(Math.max(depth, 1), 20)
      : DEFAULT_PROP_ORDERBOOKS_DEPTH
    const normalizedMinSharpNotional = Number.isFinite(minSharpNotional)
      ? Math.max(minSharpNotional, 0)
      : DEFAULT_PROP_ORDERBOOKS_MIN_SHARP_NOTIONAL
    const mode =
      requestedModeParam === 'fast' || requestedModeParam === 'full'
        ? requestedModeParam
        : 'full'
    const dateWindow: PropOrderbooksDateWindow =
      dateWindowParam === 'today' ? 'today' : 'upcoming'
    const todayKey = getUsMarketDayKey()
    const canUsePersistentCache =
      normalizedDepth === DEFAULT_PROP_ORDERBOOKS_DEPTH &&
      normalizedMinSharpNotional === DEFAULT_PROP_ORDERBOOKS_MIN_SHARP_NOTIONAL

    if (canUsePersistentCache && !forceRefresh) {
      const persisted = await readPersistedPropOrderbooksSnapshot({
        sport,
        depth: normalizedDepth,
        minSharpNotional: normalizedMinSharpNotional,
        limit: normalizedLimit,
        dateWindow,
        todayKey,
      })
      const canServePersistedImmediately =
        Boolean(persisted) &&
        (sport === 'all' || persisted?.source === 'persistent')
      if (persisted && canServePersistedImmediately) {
        const diagnostics = resolveSnapshotDiagnostics(persisted.items)
        return NextResponse.json(
          {
            ok: true,
            sport,
            updatedAt: persisted.updatedAt,
            count: persisted.items.length,
            items: persisted.items,
            sourceCounts: diagnostics.sourceCounts,
            cache: {
              forcedRefresh: false,
              source: persisted.source,
              fetchedAt: persisted.fetchedAt,
              cacheAgeMs: persisted.cacheAgeMs,
            },
            diagnostics,
          },
          { headers: NO_STORE_HEADERS }
        )
      }
    }

    const computeLimit =
      canUsePersistentCache && sport === 'all'
        ? Math.max(normalizedLimit, PERSISTED_PROP_ORDERBOOKS_LIMIT)
        : normalizedLimit

    const snapshot = await fetchPropOrderbooksSnapshot({
      sportKey: sport,
      limit: computeLimit,
      depth: normalizedDepth,
      minSharpNotional: normalizedMinSharpNotional,
      mode,
    })

    if (canUsePersistentCache && (mode === 'full' || forceRefresh)) {
      await persistPropOrderbooksSnapshot({
        sport,
        depth: normalizedDepth,
        minSharpNotional: normalizedMinSharpNotional,
        updatedAt: snapshot.updatedAt,
        items: snapshot.items,
      })
    }

    const persistedFallback = await readPersistedPropOrderbooksSnapshot({
      sport,
      depth: normalizedDepth,
      minSharpNotional: normalizedMinSharpNotional,
      limit: normalizedLimit,
      dateWindow,
      todayKey,
    })
    const liveItems: PropOrderbookItem[] =
      persistedFallback?.items ??
      (() => {
        const filteredByDate = filterPropOrderbooksItemsByDateWindow(
          snapshot.items,
          todayKey,
          dateWindow
        )
        if (sport === 'all') {
          return filteredByDate.slice(0, normalizedLimit)
        }
        return filteredByDate
          .filter((item) => item.sportKey === sport)
          .slice(0, normalizedLimit)
      })()
    const responseItems = persistedFallback?.items ?? liveItems

    const diagnostics = resolveSnapshotDiagnostics(responseItems)

    return NextResponse.json(
      {
        ok: true,
        sport,
        updatedAt: snapshot.updatedAt,
        count: responseItems.length,
        items: responseItems,
        sourceCounts: diagnostics.sourceCounts,
        cache: {
          forcedRefresh: forceRefresh,
          source: persistedFallback
            ? persistedFallback.source
            : mode === 'fast'
              ? canUsePersistentCache
                ? 'live_computed_persisted_fast'
                : 'live_computed_fast'
              : canUsePersistentCache
                ? 'live_computed_persisted_full'
                : 'live_computed_full',
          fetchedAt: persistedFallback?.fetchedAt ?? null,
          cacheAgeMs: persistedFallback?.cacheAgeMs ?? null,
        },
        diagnostics,
      },
      { headers: NO_STORE_HEADERS }
    )
  } catch (error: any) {
    console.error('[prop-orderbooks] error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500, headers: NO_STORE_HEADERS }
    )
  }
}
