import { NextRequest, NextResponse } from 'next/server'
import { unstable_cache } from 'next/cache'

import { fetchPropOrderbooksSnapshot } from '@/lib/services/prop-liquidity-detector'

export const dynamic = 'force-dynamic'
const CACHE_REVALIDATE_SECONDS = 30 * 60

const SUPPORTED_SPORTS = new Set([
  'all',
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
  'basketball_ncaab',
  'americanfootball_ncaaf',
])

const getCachedPropOrderbooksSnapshot = unstable_cache(
  async (
    sportKey: string,
    limit: number,
    depth: number,
    minSharpNotional: number
  ) =>
    fetchPropOrderbooksSnapshot({
      sportKey,
      limit,
      depth,
      minSharpNotional,
    }),
  ['prop-orderbooks'],
  { revalidate: CACHE_REVALIDATE_SECONDS }
)

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport') || 'all'
    const forceRefresh = searchParams.get('refresh') === '1'
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

    const snapshot = forceRefresh
      ? await fetchPropOrderbooksSnapshot({
          sportKey: sport,
          limit: normalizedLimit,
          depth: normalizedDepth,
          minSharpNotional: normalizedMinSharpNotional,
        })
      : await getCachedPropOrderbooksSnapshot(
          sport,
          normalizedLimit,
          normalizedDepth,
          normalizedMinSharpNotional
        )

    return NextResponse.json({
      ok: true,
      sport,
      updatedAt: snapshot.updatedAt,
      count: snapshot.items.length,
      items: snapshot.items,
      cache: {
        forcedRefresh: forceRefresh,
        revalidateSeconds: CACHE_REVALIDATE_SECONDS,
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
