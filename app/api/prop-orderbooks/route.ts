import { NextRequest, NextResponse } from 'next/server'

import {
  fetchPropOrderbooksSnapshot,
  type PropOrderbookItem,
} from '@/lib/services/prop-liquidity-detector'
import { resolveSnapshotDiagnostics } from '@/lib/services/prop-orderbooks-cache-guard'
import {
  filterUpcomingEventItems,
  getUsMarketDayKey,
  resolveEventDayKey,
} from '@/lib/utils/upcoming-event-filter'

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

type DateWindow = 'today' | 'upcoming'

const filterItemsByDateWindow = (
  items: PropOrderbookItem[],
  todayKey: string,
  dateWindow: DateWindow
) => {
  if (dateWindow === 'upcoming') {
    return filterUpcomingEventItems(items, todayKey)
  }

  return items.filter((item) => resolveEventDayKey(item.eventDate) === todayKey)
}

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
    const normalizedDepth = Number.isFinite(depth) ? Math.min(Math.max(depth, 1), 20) : 8
    const normalizedMinSharpNotional = Number.isFinite(minSharpNotional)
      ? Math.max(minSharpNotional, 0)
      : 100
    const mode =
      requestedModeParam === 'fast' || requestedModeParam === 'full'
        ? requestedModeParam
        : 'full'
    const dateWindow: DateWindow = dateWindowParam === 'today' ? 'today' : 'upcoming'
    const todayKey = getUsMarketDayKey()

    const snapshot = await fetchPropOrderbooksSnapshot({
      sportKey: sport,
      limit: normalizedLimit,
      depth: normalizedDepth,
      minSharpNotional: normalizedMinSharpNotional,
      mode,
    })

    const filteredItems = filterItemsByDateWindow(snapshot.items, todayKey, dateWindow)
    const responseItems =
      sport === 'all'
        ? filteredItems.slice(0, normalizedLimit)
        : filteredItems
            .filter((item) => item.sportKey === sport)
            .slice(0, normalizedLimit)

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
          source: mode === 'fast' ? 'snapshot_live_fast' : 'snapshot_live_full',
          fetchedAt: null,
          cacheAgeMs: null,
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
