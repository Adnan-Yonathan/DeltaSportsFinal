import {
  getTeamStats,
  getInjuryReports,
  getNBAAdvancedTeamStats,
  getNFLAdvancedTeamStats,
  TeamStats,
  InjuryReport,
  AdvancedTeamStats,
} from './sports-stats-api'

export interface EnrichedGame {
  gameId: string
  sport: string
  homeTeam: string
  awayTeam: string
  homeScore?: number
  awayScore?: number
  homeStats?: TeamStats
  awayStats?: TeamStats
  homeAdvanced?: AdvancedTeamStats
  awayAdvanced?: AdvancedTeamStats
  relevantInjuries?: InjuryReport[]
  startTime?: string
  odds?: any[]
}

/**
 * Enriches game/odds data with team stats and injury reports
 */
export async function enrichGamesWithStats(
  games: any[],
  sport: string
): Promise<EnrichedGame[]> {
  try {
    // Fetch all team stats and injuries for this sport
    const [teamStats, injuries, advancedStats] = await Promise.all([
      getTeamStats(sport),
      getInjuryReports(sport),
      sport.toLowerCase().includes('basketball')
        ? getNBAAdvancedTeamStats()
        : sport.toLowerCase().includes('football')
        ? getNFLAdvancedTeamStats()
        : Promise.resolve([]),
    ])

    // Enrich each game
    const enrichedGames: EnrichedGame[] = games.map(game => {
      const homeTeam = game.home_team || game.homeTeam
      const awayTeam = game.away_team || game.awayTeam

      // Find matching team stats
      const homeStats = teamStats.find(t =>
        t.team.toLowerCase().includes(homeTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(t.team.toLowerCase())
      )

      const awayStats = teamStats.find(t =>
        t.team.toLowerCase().includes(awayTeam.toLowerCase()) ||
        awayTeam.toLowerCase().includes(t.team.toLowerCase())
      )

      // Match advanced stats (NBA/NFL)
      const homeAdvanced = (advancedStats as AdvancedTeamStats[]).find(
        a =>
          a.team?.toLowerCase() === homeTeam.toLowerCase() ||
          a.teamAbbr?.toLowerCase() === homeTeam.toLowerCase() ||
          homeTeam.toLowerCase().includes((a.team || '').toLowerCase())
      )
      const awayAdvanced = (advancedStats as AdvancedTeamStats[]).find(
        a =>
          a.team?.toLowerCase() === awayTeam.toLowerCase() ||
          a.teamAbbr?.toLowerCase() === awayTeam.toLowerCase() ||
          awayTeam.toLowerCase().includes((a.team || '').toLowerCase())
      )

      // Find relevant injuries (players from these teams)
      const relevantInjuries = injuries.filter(inj =>
        inj.team.toLowerCase().includes(homeTeam.toLowerCase()) ||
        inj.team.toLowerCase().includes(awayTeam.toLowerCase()) ||
        homeTeam.toLowerCase().includes(inj.team.toLowerCase()) ||
        awayTeam.toLowerCase().includes(inj.team.toLowerCase())
      )

      return {
        gameId: game.id || game.gameId,
        sport: game.sport_key || sport,
        homeTeam,
        awayTeam,
        homeScore: game.homeScore || game.home_score,
        awayScore: game.awayScore || game.away_score,
        homeStats,
        awayStats,
        homeAdvanced,
        awayAdvanced,
        relevantInjuries: relevantInjuries.length > 0 ? relevantInjuries : undefined,
        startTime: game.commence_time || game.startTime,
        odds: game.bookmakers || game.odds,
      }
    })

    return enrichedGames

  } catch (error) {
    console.error('Error enriching games with stats:', error)
    // Return games without enrichment if stats fetch fails
    return games.map(game => ({
      gameId: game.id || game.gameId,
      sport: game.sport_key || sport,
      homeTeam: game.home_team || game.homeTeam,
      awayTeam: game.away_team || game.awayTeam,
      homeScore: game.homeScore || game.home_score,
      awayScore: game.awayScore || game.away_score,
      startTime: game.commence_time || game.startTime,
      odds: game.bookmakers || game.odds,
    }))
  }
}

/**
 * Formats enriched game data for AI consumption
 */
export function formatEnrichedGamesForAI(games: EnrichedGame[]): string {
  return games.map(game => {
    let gameInfo = `${game.awayTeam} @ ${game.homeTeam}\n`

    // Add team records if available
    if (game.awayStats) {
      gameInfo += `  ${game.awayTeam}: ${game.awayStats.wins}-${game.awayStats.losses} (${(game.awayStats.winPct * 100).toFixed(1)}%)\n`
    }
    if (game.homeStats) {
      gameInfo += `  ${game.homeTeam}: ${game.homeStats.wins}-${game.homeStats.losses} (${(game.homeStats.winPct * 100).toFixed(1)}%)\n`
    }

    // Add advanced efficiency/pace if available (NBA/NFL)
    if (game.homeAdvanced || game.awayAdvanced) {
      gameInfo += `  Advanced (per-game):\n`
      if (game.homeAdvanced) {
        const adv = game.homeAdvanced
        if (game.sport.toLowerCase().includes('basketball')) {
          gameInfo += `    ${game.homeTeam}: NetRtg ${adv.netRating?.toFixed(1) ?? 'n/a'}, Pace ${adv.pace?.toFixed(1) ?? 'n/a'}\n`
        } else if (game.sport.toLowerCase().includes('football')) {
          gameInfo += `    ${game.homeTeam}: EPA/play ${adv.epaPerPlay?.toFixed(3) ?? 'n/a'}, Success% ${(adv.successRate ?? 0 * 100).toFixed(1) || 'n/a'}\n`
        }
      }
      if (game.awayAdvanced) {
        const adv = game.awayAdvanced
        if (game.sport.toLowerCase().includes('basketball')) {
          gameInfo += `    ${game.awayTeam}: NetRtg ${adv.netRating?.toFixed(1) ?? 'n/a'}, Pace ${adv.pace?.toFixed(1) ?? 'n/a'}\n`
        } else if (game.sport.toLowerCase().includes('football')) {
          gameInfo += `    ${game.awayTeam}: EPA/play ${adv.epaPerPlay?.toFixed(3) ?? 'n/a'}, Success% ${(adv.successRate ?? 0 * 100).toFixed(1) || 'n/a'}\n`
        }
      }
    }

    // Add key stats if available
    if (game.homeStats?.stats || game.awayStats?.stats) {
      gameInfo += `  Key Stats:\n`

      if (game.sport.toLowerCase().includes('basketball')) {
        // NBA/NCAAB specific
        if (game.homeStats?.stats?.streak) gameInfo += `    ${game.homeTeam} streak: ${game.homeStats.stats.streak}\n`
        if (game.awayStats?.stats?.streak) gameInfo += `    ${game.awayTeam} streak: ${game.awayStats.stats.streak}\n`
      } else if (game.sport.toLowerCase().includes('football')) {
        // NFL/NCAAF specific
        if (game.homeStats?.stats?.pointsFor) gameInfo += `    ${game.homeTeam} avg: ${game.homeStats.stats.pointsFor} pts/game\n`
        if (game.awayStats?.stats?.pointsFor) gameInfo += `    ${game.awayTeam} avg: ${game.awayStats.stats.pointsFor} pts/game\n`
      } else if (game.sport.toLowerCase().includes('hockey')) {
        // NHL specific
        if (game.homeStats?.stats?.goalsFor) gameInfo += `    ${game.homeTeam} GF/GA: ${game.homeStats.stats.goalsFor}/${game.homeStats.stats.goalsAgainst}\n`
        if (game.awayStats?.stats?.goalsFor) gameInfo += `    ${game.awayTeam} GF/GA: ${game.awayStats.stats.goalsFor}/${game.awayStats.stats.goalsAgainst}\n`
      } else if (game.sport.toLowerCase().includes('baseball')) {
        // MLB specific
        if (game.homeStats?.stats?.runsScored) gameInfo += `    ${game.homeTeam} R: ${game.homeStats.stats.runsScored}/${game.homeStats.stats.runsAllowed}\n`
        if (game.awayStats?.stats?.runsScored) gameInfo += `    ${game.awayTeam} R: ${game.awayStats.stats.runsScored}/${game.awayStats.stats.runsAllowed}\n`
      }
    }

    // Add injury information if available
    if (game.relevantInjuries && game.relevantInjuries.length > 0) {
      gameInfo += `  Injuries:\n`
      for (const injury of game.relevantInjuries) {
        gameInfo += `    ${injury.player} (${injury.team}): ${injury.status}${injury.injury ? ' - ' + injury.injury : ''}\n`
      }
    }

    // Add odds if available
    if (game.odds && game.odds.length > 0) {
      gameInfo += `  Odds available from ${game.odds.length} bookmakers\n`
    }

    return gameInfo
  }).join('\n')
}
