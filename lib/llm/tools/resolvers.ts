import * as espn from '@/lib/services/espn-orchestrator'
import { fetchAllLiveScores, fetchGameDetails } from '@/lib/live-scores'
import { analyzeLiveGame } from '@/lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal, formatLiveRecommendation } from '@/lib/services/live-line-calculator'
import { getTeamStats } from '@/lib/services/matchup-analyzer'

type Resolver = (args: any) => Promise<any>

export const toolResolvers: Record<string, Resolver> = {
  espnTeamAtsRecord: ({ sport, teamId, season, seasonType = 2 }) =>
    espn.getTeamAtsRecord(sport, teamId, season, seasonType),
  espnTeamOddsRecord: ({ sport, teamId, season }) =>
    espn.getTeamOddsRecord(sport, teamId, season),
  espnTeamPastPerformances: ({ sport, teamId, providerId = '1003', limit }) =>
    espn.getTeamPastPerformances(sport, teamId, providerId, limit),
  espnTeamFutures: ({ sport, season, market, books }) => espn.getFutures(sport, season, market, books),
  espnPredictor: ({ sport, eventId }) => espn.getPredictor(sport, eventId),
  espnTeamSeasonStats: ({ sport, teamId, season, seasonType = 2 }) =>
    espn.getTeamSeasonStats(sport, teamId, season, seasonType),
  espnPlayerSeasonStats: ({ sport, playerId, season, seasonType = 2 }) =>
    espn.getPlayerSeasonStats(sport, playerId, season, seasonType),
  espnPlayerGameLogs: ({ sport, playerId, season, seasonType = 2 }) =>
    espn.getPlayerGameLogs(sport, playerId, season, seasonType),
  espnEventsByDateRange: ({ sport, from, to }) => espn.getEventsByDateRange(sport, from, to),
  espnEventSnapshot: ({ sport, eventId }) => espn.getEventSnapshot(sport, eventId),
  espnInjuries: ({ sport }) => espn.getInjuries(sport),
  get_live_betting_projection: async ({ gameIdentifier }: { gameIdentifier: string }) => {
    console.log('[LIVE_PROJECTION] TOOL CALLED - Starting execution')
    console.log('[LIVE_PROJECTION] gameIdentifier:', gameIdentifier)

    // Parse team names from gameIdentifier
    const teamTokens = gameIdentifier
      .toLowerCase()
      .replace(/\bvs\b|\bat\b/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2)

    console.log('[LIVE_PROJECTION] teamTokens:', teamTokens)

    // Fetch all live NBA games
    const today = new Date().toISOString().slice(0, 10)
    console.log('[LIVE_PROJECTION] Fetching live scores for date:', today)
    const allGames = await fetchAllLiveScores({ date: today })
    const nbaGames = allGames.games.filter((g) => g.league === 'nba')

    console.log('[LIVE_PROJECTION] Total games found:', allGames.games.length)
    console.log('[LIVE_PROJECTION] NBA games found:', nbaGames.length)
    console.log('[LIVE_PROJECTION] NBA games:', JSON.stringify(nbaGames.map(g => ({
      id: g.id,
      status: g.status,
      competitors: g.competitors?.map(c => ({ name: c.name, abbrev: c.abbreviation, short: c.shortName }))
    })), null, 2))

    // Find matching live game
    const matchingGame = nbaGames.find((g) => {
      const competitors = g.competitors || []
      return teamTokens.some((token) =>
        competitors.some(
          (c) =>
            c.name?.toLowerCase().includes(token) ||
            c.abbreviation?.toLowerCase().includes(token) ||
            c.shortName?.toLowerCase().includes(token)
        )
      )
    })

    console.log('[LIVE_PROJECTION] Matching game found:', matchingGame ? matchingGame.id : 'NONE')

    if (!matchingGame) {
      const availableGames = nbaGames
        .map((g) => {
          const home = g.competitors?.find((c) => c.homeAway === 'home')
          const away = g.competitors?.find((c) => c.homeAway === 'away')
          return `${away?.name} @ ${home?.name}`
        })
        .join(', ')
      throw new Error(`No live NBA game found matching "${gameIdentifier}". ${
        availableGames ? `Available live games: ${availableGames}` : 'No live games currently.'
      }`)
    }

    // Get full game details
    const liveGame = await fetchGameDetails('nba', matchingGame.id)

    if (!liveGame) {
      throw new Error(`Could not fetch detailed data for game ${matchingGame.id}`)
    }

    // Analyze momentum
    const gameState = await analyzeLiveGame(liveGame)

    // Get team stats
    const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
    const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

    if (!homeTeam || !awayTeam) {
      throw new Error('Could not find home/away teams in game data')
    }

    console.log('[LIVE_PROJECTION] Teams found:', { home: homeTeam.name, away: awayTeam.name })

    const homeStats =
      (await getTeamStats(homeTeam.name)) ||
      (homeTeam.abbreviation ? await getTeamStats(homeTeam.abbreviation) : null)
    const awayStats =
      (await getTeamStats(awayTeam.name)) ||
      (awayTeam.abbreviation ? await getTeamStats(awayTeam.abbreviation) : null)

    console.log('[LIVE_PROJECTION] Stats fetched:', {
      homeStats: homeStats ? 'OK' : 'null',
      awayStats: awayStats ? 'OK' : 'null'
    })

    if (!homeStats || !awayStats) {
      throw new Error(`Could not fetch team stats. Home: ${homeStats ? 'OK' : 'MISSING'}, Away: ${awayStats ? 'OK' : 'MISSING'}`)
    }

    console.log('[LIVE_PROJECTION] Calculating projections...')

    // Calculate live spread and total
    const spreadRec = calculateLiveSpread(gameState, { homeStats, awayStats })
    const totalRec = calculateLiveTotal(gameState, { homeStats, awayStats })

    console.log('[LIVE_PROJECTION] Projections calculated:', { spreadRec, totalRec })

    // Format recommendations
    const spreadFormatted = formatLiveRecommendation(spreadRec, gameState)
    const totalFormatted = formatLiveRecommendation(totalRec, gameState)

    console.log('[LIVE_PROJECTION] Formatting complete')

    const formatted = [
      `**Live Projection: ${gameState.awayTeam} @ ${gameState.homeTeam}**`,
      `- Score: ${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
      `- Period: Q${gameState.period} ${gameState.displayClock}`,
      '',
      '**Spread Projection**',
      spreadFormatted,
      '',
      '**Total Projection**',
      totalFormatted,
    ].join('\n')

    // Return structured data for LLM
    return {
      matchup: `${gameState.awayTeam} @ ${gameState.homeTeam}`,
      gameState: {
        score: `${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
        period: `Q${gameState.period} ${gameState.displayClock}`,
        timeRemaining: gameState.timeRemaining,
      },
      projections: {
        spread: spreadFormatted,
        spreadType: 'projection',
        total: totalFormatted,
      },
      formatted,
    }
  },
}
