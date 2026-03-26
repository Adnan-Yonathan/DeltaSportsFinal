import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds, getBestOdds } from '@/lib/api/odds-api'
import { fetchSbdOdds, mapSbdOddsToOddsGames, resolveSbdLeague } from '@/lib/api/sbd'
import { searchTeams } from '@/lib/data/team-search'
import { resolveSportKey, type CanonicalSportKey } from '@/lib/identity/sport'
import type { OddsGame } from '@/lib/types/odds'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

    const canonicalSport = resolveSportKey(sport) as CanonicalSportKey | undefined
    let games = await fetchOdds(sport, ['h2h','spreads','totals'], {
      live,
      forceProvider: 'the-odds-api',
    })
    if (!games.length) {
      const league = resolveSbdLeague(sport)
      if (league) {
        try {
          const payload = await fetchSbdOdds(league, { format: 'us' })
          games = mapSbdOddsToOddsGames(league, payload, ['h2h','spreads','totals'])
        } catch (error) {
          console.warn('[BEST_ODDS] SBD fallback failed:', error)
        }
      }
    }

    if (canonicalSport === 'basketball_ncaab') {
      const matchesSport = (team: string) =>
        searchTeams(team, { sport: canonicalSport, limit: 1, prioritizePro: false }).length > 0
      games = games.filter((game) => matchesSport(game.home_team) && matchesSport(game.away_team))
    }
    const data = (games || []).map(summarizeBest)

    return NextResponse.json({ sport, count: data.length, data })
  } catch (error: any) {
    console.error('[BEST_ODDS] API error:', error)
    return NextResponse.json({ error: error?.message || 'Internal error' }, { status: 500 })
  }
}

