import * as espn from '@/lib/services/espn-orchestrator'
import { fetchAllLiveScores } from '@/lib/live-scores'
import { type PregameSpreadContext } from '@/lib/services/live-game-analyzer'
import { getCachedGameDetails, getCachedLiveGameAnalysis } from '@/lib/services/live-game-cache'
import { calculateLiveSpread, calculateLiveTotal, formatLiveRecommendation } from '@/lib/services/live-line-calculator'
import { getTeamStats } from '@/lib/services/matchup-analyzer'
import type { TeamStats } from '@/lib/services/pregame-value-calculator'
import { buildTeamLabel, fetchSbdOdds, resolveSbdLeague, type SbdLeague } from '@/lib/api/sbd'
import {
  buildSharpSignalsFromSplits,
  calculateSharpBiasFromSignals,
} from '@/lib/services/sharp-bias'
import { detectEdgeForGame, type SharpSignal } from '@/lib/services/edge-detection'
import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'

type Resolver = (args: any) => Promise<any>

/**
 * Fetch pre-game spread data from SBD for a specific game
 */
async function fetchPregameSpread(
  homeTeam: string,
  awayTeam: string,
  league: string
): Promise<PregameSpreadContext | undefined> {
  try {
    console.log('[LIVE_PROJECTION] Fetching pre-game spread from SBD...')
    const sportKeyByLeague: Record<string, string> = {
      nba: 'basketball_nba',
      ncaab: 'basketball_ncaab',
      nfl: 'americanfootball_nfl',
      ncaaf: 'americanfootball_ncaaf',
      cfb: 'americanfootball_ncaaf',
      nhl: 'icehockey_nhl',
      mlb: 'baseball_mlb',
    }
    const sportKey = sportKeyByLeague[league] || league
    const sbdLeague = resolveSbdLeague(sportKey) || 'nba'
    const sbdData = await fetchSbdOdds(sbdLeague, { init: { cache: 'no-store' } })
    const sbdGames = Array.isArray(sbdData?.data)
      ? sbdData.data
      : Array.isArray(sbdData)
        ? sbdData
        : []

    if (!sbdGames.length) {
      console.log('[LIVE_PROJECTION] No SBD data returned')
      return undefined
    }

    // Find matching game by team names
    const normalize = (s: string) => {
      const cleaned = (s || '')
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
      if (!cleaned) return ''
      const tokens = cleaned
        .split(' ')
        .map((token) => {
          if (token === 'state' || token === 'st' || token === 'saint') return 'st'
          if (token === 'university' || token === 'college' || token === 'the') {
            return ''
          }
          return token
        })
        .filter(Boolean)
      return tokens.join('')
    }
    const homeNorm = normalize(homeTeam)
    const awayNorm = normalize(awayTeam)

    const matchingGame = sbdGames.find((game: any) => {
      const rawHome =
        game?.home_team ||
        game?.homeTeam ||
        buildTeamLabel(game?.competitors?.home) ||
        game?.competitors?.home?.name ||
        game?.competitors?.home?.displayName ||
        ''
      const rawAway =
        game?.away_team ||
        game?.awayTeam ||
        buildTeamLabel(game?.competitors?.away) ||
        game?.competitors?.away?.name ||
        game?.competitors?.away?.displayName ||
        ''
      const gameHome = normalize(rawHome)
      const gameAway = normalize(rawAway)
      if (!gameHome || !gameAway) return false
      const homeMatch = gameHome.includes(homeNorm) || homeNorm.includes(gameHome)
      const awayMatch = gameAway.includes(awayNorm) || awayNorm.includes(gameAway)
      const reverseHomeMatch = gameHome.includes(awayNorm) || awayNorm.includes(gameHome)
      const reverseAwayMatch = gameAway.includes(homeNorm) || homeNorm.includes(gameAway)
      return (homeMatch && awayMatch) || (reverseHomeMatch && reverseAwayMatch)
    })

    if (!matchingGame) {
      console.log('[LIVE_PROJECTION] No matching game found in SBD data for:', { homeTeam, awayTeam })
      return undefined
    }

    const matchedHome =
      matchingGame?.home_team ||
      matchingGame?.homeTeam ||
      buildTeamLabel(matchingGame?.competitors?.home) ||
      matchingGame?.competitors?.home?.name ||
      matchingGame?.competitors?.home?.displayName
    const matchedAway =
      matchingGame?.away_team ||
      matchingGame?.awayTeam ||
      buildTeamLabel(matchingGame?.competitors?.away) ||
      matchingGame?.competitors?.away?.name ||
      matchingGame?.competitors?.away?.displayName
    console.log('[LIVE_PROJECTION] Found matching SBD game:', matchedHome, 'vs', matchedAway)

    // Extract opening spread from the first available book
    const markets = matchingGame?.markets || matchingGame?.marketsByPeriod || {}
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

    if (openingSpread === null) {
      console.log('[LIVE_PROJECTION] No opening spread found in SBD data')
      return undefined
    }

    const splits = matchingGame?.bettingSplits
    const sharpSignals: SharpSignal[] = []
    if (sbdLeague) {
      const sharpResult = await detectEdgeForGame(
        sbdLeague,
        `${awayTeam} @ ${homeTeam}`
      )
      if (sharpResult?.sharpSignals?.length) {
        sharpSignals.push(...sharpResult.sharpSignals)
      }
    }
    if (!sharpSignals.length) {
      sharpSignals.push(
        ...buildSharpSignalsFromSplits({
          splits: {
            spreadHomeBetPct: splits?.spread?.home?.betsPercentage,
            spreadHomeMoneyPct: splits?.spread?.home?.stakePercentage,
            totalOverBetPct: splits?.total?.over?.betsPercentage,
            totalOverMoneyPct: splits?.total?.over?.stakePercentage,
          },
          homeTeam: matchedHome || homeTeam,
          awayTeam: matchedAway || awayTeam,
        })
      )
    }

    const sharpBias = calculateSharpBiasFromSignals({
      sharpSignals,
      homeTeam: matchedHome || homeTeam,
      awayTeam: matchedAway || awayTeam,
      sport: sportKey,
    })

    const sharpNotes = [...sharpBias.spreadNotes, ...sharpBias.totalNotes]
    const result: PregameSpreadContext = {
      openingSpread,
      currentSpread: currentSpread ?? undefined,
      openingTotal: openingTotal ?? 0,
      currentTotal: currentTotal ?? undefined,
      source: 'SBD',
      sharpSpreadBias: sharpBias.spreadBias || undefined,
      sharpTotalBias: sharpBias.totalBias || undefined,
      sharpNotes: sharpNotes.length ? sharpNotes : undefined,
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
    const liveGame = await getCachedGameDetails('nba', matchingGame.id)

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
    const pregameSpreadPromise = fetchPregameSpread(
      homeTeam.name || '',
      awayTeam.name || '',
      matchingGame.league || 'nba'
    )

    // Analyze momentum
    const gameState = await getCachedLiveGameAnalysis('nba', matchingGame.id)

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

    const ensureTeamStats = (stats: unknown, label: string): TeamStats => {
      const typed = stats as TeamStats
      if (typeof typed?.ortg !== 'number' || typeof typed?.drtg !== 'number') {
        throw new Error(`Invalid ${label} stats for live projection`)
      }
      return typed
    }

    const homeTeamStats = ensureTeamStats(homeStats, 'home')
    const awayTeamStats = ensureTeamStats(awayStats, 'away')

    // Calculate live spread and total
    const spreadRec = calculateLiveSpread(gameState, { homeStats: homeTeamStats, awayStats: awayTeamStats })
    const totalRec = calculateLiveTotal(gameState, { homeStats: homeTeamStats, awayStats: awayTeamStats })

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

  get_odds_comparison: async ({
    team,
    market = 'all',
    sport,
  }: {
    team: string
    market?: 'spread' | 'moneyline' | 'total' | 'all'
    sport?: string
  }) => {
    console.log('[ODDS_COMPARISON] Starting - team:', team, 'market:', market, 'sport:', sport)

    // Normalize team query for matching
    const normalize = (s: string) =>
      (s || '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

    const teamTokens = normalize(team).split(' ').filter((t) => t.length > 2)

    // Auto-detect sport from team name if not provided
    let detectedSport = sport
    if (!detectedSport) {
      for (const registeredTeam of TEAMS_REGISTRY) {
        const teamNorm = normalize(registeredTeam.name)
        const aliasMatch = registeredTeam.aliases.some((alias) =>
          teamTokens.some((token) => normalize(alias).includes(token) || token.includes(normalize(alias)))
        )
        if (aliasMatch || teamTokens.some((t) => teamNorm.includes(t))) {
          // Map registry sport to odds-api sport key
          const sportMap: Record<string, string> = {
            nba: 'basketball_nba',
            ncaab: 'basketball_ncaab',
            nfl: 'americanfootball_nfl',
            ncaaf: 'americanfootball_ncaaf',
            mlb: 'baseball_mlb',
            nhl: 'icehockey_nhl',
          }
          detectedSport = sportMap[registeredTeam.sport] || 'basketball_nba'
          console.log('[ODDS_COMPARISON] Auto-detected sport:', detectedSport, 'from team:', registeredTeam.name)
          break
        }
      }
    }
    detectedSport = detectedSport || 'basketball_nba'

    // Map sport key to SBD league
    const sportToLeague: Record<string, SbdLeague> = {
      basketball_nba: 'nba',
      basketball_ncaab: 'ncaamb',
      americanfootball_nfl: 'nfl',
      americanfootball_ncaaf: 'ncaafb',
      baseball_mlb: 'mlb',
      icehockey_nhl: 'nhl',
    }
    const sbdLeague = sportToLeague[detectedSport] || 'nba'

    // Fetch games from SBD
    const sbdData = await fetchSbdOdds(sbdLeague, { init: { cache: 'no-store' } })
    const games = Array.isArray(sbdData?.data) ? sbdData.data : Array.isArray(sbdData) ? sbdData : []

    if (!games.length) {
      return { error: `No games found for ${sbdLeague.toUpperCase()}. There may be no games scheduled.` }
    }

    // Find matching game
    const matchingGame = games.find((game: any) => {
      const rawHome =
        game?.home_team ||
        game?.homeTeam ||
        buildTeamLabel(game?.competitors?.home) ||
        game?.competitors?.home?.name ||
        ''
      const rawAway =
        game?.away_team ||
        game?.awayTeam ||
        buildTeamLabel(game?.competitors?.away) ||
        game?.competitors?.away?.name ||
        ''
      const gameHome = normalize(rawHome)
      const gameAway = normalize(rawAway)

      return teamTokens.some((token) => gameHome.includes(token) || gameAway.includes(token))
    })

    if (!matchingGame) {
      const availableGames = games
        .slice(0, 10)
        .map((g: any) => {
          const home = g?.home_team || buildTeamLabel(g?.competitors?.home) || 'TBD'
          const away = g?.away_team || buildTeamLabel(g?.competitors?.away) || 'TBD'
          return `${away} @ ${home}`
        })
        .join(', ')
      return {
        error: `No game found matching "${team}".`,
        availableGames: availableGames || 'No games available',
      }
    }

    const homeTeam =
      matchingGame?.home_team ||
      matchingGame?.homeTeam ||
      buildTeamLabel(matchingGame?.competitors?.home) ||
      matchingGame?.competitors?.home?.name ||
      'Home'
    const awayTeam =
      matchingGame?.away_team ||
      matchingGame?.awayTeam ||
      buildTeamLabel(matchingGame?.competitors?.away) ||
      matchingGame?.competitors?.away?.name ||
      'Away'

    console.log('[ODDS_COMPARISON] Found game:', awayTeam, '@', homeTeam)

    // Extract odds from the game's markets
    const markets = matchingGame?.markets || matchingGame?.marketsByPeriod || {}
    const comparison: Record<
      string,
      {
        market: string
        lines: Array<{ book: string; homeOdds: number; awayOdds: number; line?: number }>
        bestHome: { book: string; odds: number; line?: number } | null
        bestAway: { book: string; odds: number; line?: number } | null
      }
    > = {}

    // Helper to extract best odds from books array
    const extractOdds = (books: any[], marketType: 'spread' | 'moneyline' | 'total') => {
      const lines: Array<{ book: string; homeOdds: number; awayOdds: number; line?: number }> = []
      let bestHome: { book: string; odds: number; line?: number } | null = null
      let bestAway: { book: string; odds: number; line?: number } | null = null

      for (const book of books || []) {
        const bookName = book?.bookmaker || book?.book || book?.sportsbook || 'Unknown'

        if (marketType === 'spread') {
          const homeSpread = parseFloat(book?.home?.spread)
          const homeOdds = parseFloat(book?.home?.odds || book?.home?.price)
          const awaySpread = parseFloat(book?.away?.spread)
          const awayOdds = parseFloat(book?.away?.odds || book?.away?.price)

          if (!Number.isNaN(homeOdds) && !Number.isNaN(awayOdds)) {
            lines.push({ book: bookName, homeOdds, awayOdds, line: homeSpread })
            if (!bestHome || homeOdds > bestHome.odds) {
              bestHome = { book: bookName, odds: homeOdds, line: homeSpread }
            }
            if (!bestAway || awayOdds > bestAway.odds) {
              bestAway = { book: bookName, odds: awayOdds, line: awaySpread }
            }
          }
        } else if (marketType === 'moneyline') {
          const homeOdds = parseFloat(book?.home?.odds || book?.home?.price || book?.home)
          const awayOdds = parseFloat(book?.away?.odds || book?.away?.price || book?.away)

          if (!Number.isNaN(homeOdds) && !Number.isNaN(awayOdds)) {
            lines.push({ book: bookName, homeOdds, awayOdds })
            if (!bestHome || homeOdds > bestHome.odds) {
              bestHome = { book: bookName, odds: homeOdds }
            }
            if (!bestAway || awayOdds > bestAway.odds) {
              bestAway = { book: bookName, odds: awayOdds }
            }
          }
        } else if (marketType === 'total') {
          const totalLine = parseFloat(book?.over?.total ?? book?.total)
          const overOdds = parseFloat(book?.over?.odds || book?.over?.price)
          const underOdds = parseFloat(book?.under?.odds || book?.under?.price)

          if (!Number.isNaN(overOdds) && !Number.isNaN(underOdds)) {
            lines.push({ book: bookName, homeOdds: overOdds, awayOdds: underOdds, line: totalLine })
            if (!bestHome || overOdds > bestHome.odds) {
              bestHome = { book: bookName, odds: overOdds, line: totalLine }
            }
            if (!bestAway || underOdds > bestAway.odds) {
              bestAway = { book: bookName, odds: underOdds, line: totalLine }
            }
          }
        }
      }

      return { lines, bestHome, bestAway }
    }

    // Process requested markets
    if (market === 'all' || market === 'spread') {
      const spreadBooks = markets?.spread?.books || []
      const spreadData = extractOdds(spreadBooks, 'spread')
      if (spreadData.lines.length) {
        comparison.spread = { market: 'Spread', ...spreadData }
      }
    }

    if (market === 'all' || market === 'moneyline') {
      const mlBooks = markets?.moneyline?.books || markets?.ml?.books || []
      const mlData = extractOdds(mlBooks, 'moneyline')
      if (mlData.lines.length) {
        comparison.moneyline = { market: 'Moneyline', ...mlData }
      }
    }

    if (market === 'all' || market === 'total') {
      const totalBooks = markets?.total?.books || []
      const totalData = extractOdds(totalBooks, 'total')
      if (totalData.lines.length) {
        comparison.total = { market: 'Total', ...totalData }
      }
    }

    // Format output
    const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : String(odds))

    const sections: string[] = [`**Line Shopping: ${awayTeam} @ ${homeTeam}**\n`]

    if (comparison.spread) {
      const s = comparison.spread
      sections.push(`**Spread**`)
      if (s.bestHome) {
        sections.push(`- Best ${homeTeam} ${s.bestHome.line}: ${formatOdds(s.bestHome.odds)} @ ${s.bestHome.book}`)
      }
      if (s.bestAway) {
        sections.push(`- Best ${awayTeam} ${s.bestAway.line}: ${formatOdds(s.bestAway.odds)} @ ${s.bestAway.book}`)
      }
      sections.push('')
    }

    if (comparison.moneyline) {
      const m = comparison.moneyline
      sections.push(`**Moneyline**`)
      if (m.bestHome) {
        sections.push(`- Best ${homeTeam}: ${formatOdds(m.bestHome.odds)} @ ${m.bestHome.book}`)
      }
      if (m.bestAway) {
        sections.push(`- Best ${awayTeam}: ${formatOdds(m.bestAway.odds)} @ ${m.bestAway.book}`)
      }
      sections.push('')
    }

    if (comparison.total) {
      const t = comparison.total
      sections.push(`**Total (${t.bestHome?.line || 'N/A'})**`)
      if (t.bestHome) {
        sections.push(`- Best Over: ${formatOdds(t.bestHome.odds)} @ ${t.bestHome.book}`)
      }
      if (t.bestAway) {
        sections.push(`- Best Under: ${formatOdds(t.bestAway.odds)} @ ${t.bestAway.book}`)
      }
      sections.push('')
    }

    if (Object.keys(comparison).length === 0) {
      sections.push('No odds data available for this game.')
    }

    return {
      matchup: `${awayTeam} @ ${homeTeam}`,
      sport: detectedSport,
      comparison,
      formatted: sections.join('\n'),
    }
  },
}
