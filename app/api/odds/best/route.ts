import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds, getBestOdds } from '@/lib/api/odds-api'
import type { OddsGame } from '@/lib/types/odds'

export const runtime = 'nodejs'

function summarizeBest(game: OddsGame) {
  const markets = ['h2h','spreads','totals']
  const summary: Record<string, any> = {}

  for (const m of markets) {
    const best = getBestOdds(game, m)
    if (best.size > 0) {
      summary[m] = Array.from(best.entries()).map(([selection, val]) => ({
        selection,
        book: val.book,
        odds: val.odds,
        point: val.point ?? null,
      }))
    }
  }

  return {
    gameId: game.id,
    game: `${game.away_team} @ ${game.home_team}`,
    commence_time: game.commence_time,
    best: summary,
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const live = searchParams.get('live') === 'true'

    if (!sport) {
      return NextResponse.json({ error: 'Missing required "sport" (e.g., basketball_nba)' }, { status: 400 })
    }

    const games = await fetchOdds(sport, ['h2h','spreads','totals'], { live })
    const data = (games || []).map(summarizeBest)

    return NextResponse.json({ sport, count: data.length, data })
  } catch (error: any) {
    console.error('[BEST_ODDS] API error:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}
