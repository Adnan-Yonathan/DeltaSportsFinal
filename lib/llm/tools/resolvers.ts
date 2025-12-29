import * as espn from '@/lib/services/espn-orchestrator'
import { fetchAllLiveScores, fetchGameDetails } from '@/lib/live-scores'
import { analyzeLiveGame, type PregameSpreadContext } from '@/lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal, formatLiveRecommendation } from '@/lib/services/live-line-calculator'
import { getTeamStats } from '@/lib/services/matchup-analyzer'
import { fetchSbdOdds } from '@/lib/api/sbd'

type Resolver = (args: any) => Promise<any>

/**
 * Fetch pre-game spread data from SBD for a specific game
 */
async function fetchPregameSpread(
  homeTeam: string,
  awayTeam: string
): Promise<PregameSpreadContext | undefined> {
  try {
    console.log('[LIVE_PROJECTION] Fetching pre-game spread from SBD...')
    const sbdData = await fetchSbdOdds('nba', { init: { cache: 'no-store' } })

    if (!sbdData || !Array.isArray(sbdData)) {
      console.log('[LIVE_PROJECTION] No SBD data returned')
      return undefined
    }

    // Find matching game by team names
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
    const homeNorm = normalize(homeTeam)
    const awayNorm = normalize(awayTeam)

    const matchingGame = sbdData.find((game: any) => {
      const gameHome = normalize(game?.home_team || game?.homeTeam || '')
      const gameAway = normalize(game?.away_team || game?.awayTeam || '')
      return (
        (gameHome.includes(homeNorm) || homeNorm.includes(gameHome.split(' ').pop() || '')) &&
        (gameAway.includes(awayNorm) || awayNorm.includes(gameAway.split(' ').pop() || ''))
      )
    })

    if (!matchingGame) {
      console.log('[LIVE_PROJECTION] No matching game found in SBD data for:', { homeTeam, awayTeam })
      return undefined
    }

    console.log('[LIVE_PROJECTION] Found matching SBD game:', matchingGame?.home_team, 'vs', matchingGame?.away_team)

    // Extract opening spread from the first available book
    const markets = matchingGame?.markets || {}
    const spreadBooks = markets?.spread?.books || []
    const totalBooks = markets?.total?.books || []

    let openingSpread: number | null = null
    let currentSpread: number | null = null
    let openingTotal: number | null = null
    let currentTotal: number | null = null

    // Get spread data (home team perspective)
    for (const book of spreadBooks) {
      const homeOpenSpread = parseFloat(book?.home?.opening_spread)
      const homeSpread = parseFloat(book?.home?.spread)

      if (!Number.isNaN(homeOpenSpread)) {
        openingSpread = homeOpenSpread
        currentSpread = !Number.isNaN(homeSpread) ? homeSpread : null
        break
      }
    }

    // Get total data
    for (const book of totalBooks) {
      const openTotal = parseFloat(book?.over?.opening_total ?? book?.opening_total)
      const total = parseFloat(book?.over?.total ?? book?.total)

      if (!Number.isNaN(openTotal)) {
        openingTotal = openTotal
        currentTotal = !Number.isNaN(total) ? total : null
        break
      }
    }

    if (openingSpread === null && openingTotal === null) {
      console.log('[LIVE_PROJECTION] No opening lines found in SBD data')
      return undefined
    }

    const result: PregameSpreadContext = {
      openingSpread: openingSpread ?? 0,
      currentSpread: currentSpread ?? undefined,
      openingTotal: openingTotal ?? 220, // Default NBA total
      currentTotal: currentTotal ?? undefined,
      source: 'SBD',
    }

    console.log('[LIVE_PROJECTION] Pre-game spread context:', result)
    return result
  } catch (error) {
    console.error('[LIVE_PROJECTION] Failed to fetch pre-game spread:', error)
    return undefined
  }
}

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

    // Get team info first
    const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
    const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

    if (!homeTeam || !awayTeam) {
      throw new Error('Could not find home/away teams in game data')
    }

    // Fetch pre-game spread from SBD (parallel with other data)
    const pregameSpreadPromise = fetchPregameSpread(homeTeam.name || '', awayTeam.name || '')

    // Analyze momentum
    const gameState = await analyzeLiveGame(liveGame)

    // Attach pre-game spread to game state
    const pregameSpread = await pregameSpreadPromise
    if (pregameSpread) {
      gameState.pregameSpread = pregameSpread
      console.log('[LIVE_PROJECTION] Attached pre-game spread to game state:', pregameSpread)
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
