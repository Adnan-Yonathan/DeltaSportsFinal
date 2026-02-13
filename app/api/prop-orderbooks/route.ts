import { NextRequest, NextResponse } from 'next/server'

import { fetchPropOrderbooksSnapshot } from '@/lib/services/prop-liquidity-detector'

export const dynamic = 'force-dynamic'

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
    const limit = Number(searchParams.get('limit') || 60)
    const depth = Number(searchParams.get('depth') || 8)
    const minSharpNotional = Number(searchParams.get('minSharpNotional') || 100)

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json(
        { ok: false, error: 'Unsupported sport' },
        { status: 400 }
      )
    }

    const snapshot = await fetchPropOrderbooksSnapshot({
      sportKey: sport,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 200) : 60,
      depth: Number.isFinite(depth) ? Math.min(Math.max(depth, 1), 20) : 8,
      minSharpNotional: Number.isFinite(minSharpNotional)
        ? Math.max(minSharpNotional, 0)
        : 100,
    })

    return NextResponse.json({
      ok: true,
      sport,
      updatedAt: snapshot.updatedAt,
      count: snapshot.items.length,
      items: snapshot.items,
    })
  } catch (error: any) {
    console.error('[prop-orderbooks] error:', error)
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
