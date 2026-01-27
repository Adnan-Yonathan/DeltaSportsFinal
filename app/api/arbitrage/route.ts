import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds, findArbitrageOpportunities } from '@/lib/api/odds-api'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const minProfit = Number(searchParams.get('minProfit') || '1')

    if (!sport) {
      return NextResponse.json({ error: 'Missing required "sport" (e.g., basketball_nba)' }, { status: 400 })
    }

    const games = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
      revalidateSeconds: 600,
    })
    if (!games?.length) {
      return NextResponse.json({ sport, opportunities: [], note: 'No games available for arbitrage scan' })
    }

    const opportunities = findArbitrageOpportunities(games, isFinite(minProfit) ? minProfit : 1)

    return NextResponse.json({ sport, count: opportunities.length, opportunities })
  } catch (error: any) {
    console.error('[ARBITRAGE] API error:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}
