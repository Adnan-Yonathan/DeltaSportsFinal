/**
 * Quarter Analytics Service
 * Provides quarter-by-quarter analysis, threshold queries, and first-to-score data
 */

import { createClient } from '@/lib/supabase/server'
import { fetchGameDetails, type LeagueId } from '@/lib/live-scores'
import { extractScoringPlays, detectScoringPlay } from './play-by-play-parser'

// ============================================================================
// TYPES
// ============================================================================

export interface QuarterThresholdResult {
  team: string
  quarter: number
  threshold: number
  operator: '>=' | '>' | '<' | '<=' | '='
  gamesOver: number
  totalGames: number
  percentage: number
  instances: Array<{
    gameId: string
    date: string
    opponent: string
    points: number
    homeAway: 'home' | 'away'
    result?: 'W' | 'L'
  }>
}

export interface QuarterWinnerResult {
  team: string
  quarterWins: {
    Q1: { wins: number; losses: number; ties: number; total: number }
    Q2: { wins: number; losses: number; ties: number; total: number }
    Q3: { wins: number; losses: number; ties: number; total: number }
    Q4: { wins: number; losses: number; ties: number; total: number }
  }
  games: Array<{
    gameId: string
    date: string
    opponent: string
    quarterWinners: { Q1: string; Q2: string; Q3: string; Q4: string }
  }>
}

export interface FirstToScoreResult {
  team: string
  scoredFirst: number
  opponentScoredFirst: number
  totalGames: number
  scoredFirstPercentage: number
  winRateWhenScoringFirst?: number
  games: Array<{
    gameId: string
    date: string
    opponent: string
    scoredFirst: boolean
    firstScorer?: string
    firstPoints?: number
    result?: 'W' | 'L'
  }>
}

export interface FirstBasketScorerResult {
  player: string
  team: string
  timesFirstBasket: number
  totalTeamGames: number
  percentage: number
  games: Array<{
    gameId: string
    date: string
    opponent: string
    points: number
    playText: string
  }>
}

// ============================================================================
// TEAM QUARTER THRESHOLD QUERIES
// ============================================================================

/**
 * Count games where a team exceeded a scoring threshold in a specific quarter
 * Example: "How many times did the Lakers score 30+ in Q1?"
 */
export async function getTeamQuarterThreshold(params: {
  team: string
  quarter: number
  threshold: number
  operator?: '>=' | '>' | '<' | '<=' | '='
  sport?: string
  limit?: number
}): Promise<QuarterThresholdResult> {
  const { team, quarter, threshold, operator = '>=', sport = 'basketball_nba', limit = 100 } = params

  const supabase = createClient()

  // Fetch all games for this team in the specified quarter
  const { data: scores, error } = await supabase
    .from('period_scores')
    .select('*')
    .eq('sport_key', sport)
    .eq('period_number', quarter)
    .or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
    .order('game_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[QuarterThreshold] Error:', error)
    throw error
  }

  const instances: QuarterThresholdResult['instances'] = []
  let gamesOver = 0

  for (const score of (scores || [])) {
    const isHome = score.home_team?.toLowerCase().includes(team.toLowerCase())
    const teamPoints = isHome ? score.home_points : score.away_points
    const opponent = isHome ? score.away_team : score.home_team

    // Check if threshold is met
    let meetsThreshold = false
    switch (operator) {
      case '>=': meetsThreshold = teamPoints >= threshold; break
      case '>': meetsThreshold = teamPoints > threshold; break
      case '<': meetsThreshold = teamPoints < threshold; break
      case '<=': meetsThreshold = teamPoints <= threshold; break
      case '=': meetsThreshold = teamPoints === threshold; break
    }

    if (meetsThreshold) {
      gamesOver++
      instances.push({
        gameId: score.game_id,
        date: score.game_date,
        opponent,
        points: teamPoints,
        homeAway: isHome ? 'home' : 'away',
      })
    }
  }

  const totalGames = scores?.length || 0

  return {
    team,
    quarter,
    threshold,
    operator,
    gamesOver,
    totalGames,
    percentage: totalGames > 0 ? Math.round((gamesOver / totalGames) * 100) : 0,
    instances: instances.slice(0, 10), // Return top 10 instances
  }
}

// ============================================================================
// QUARTER WINNERS
// ============================================================================

/**
 * Analyze which team won each quarter across games
 * Example: "How often do the Celtics win Q1?"
 */
export async function getQuarterWinners(params: {
  team: string
  sport?: string
  limit?: number
}): Promise<QuarterWinnerResult> {
  const { team, sport = 'basketball_nba', limit = 50 } = params

  const supabase = createClient()

  // Get all period scores for this team
  const { data: scores, error } = await supabase
    .from('period_scores')
    .select('*')
    .eq('sport_key', sport)
    .lte('period_number', 4) // Only regular quarters
    .or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
    .order('game_date', { ascending: false })
    .order('period_number', { ascending: true })
    .limit(limit * 4) // 4 quarters per game

  if (error) {
    console.error('[QuarterWinners] Error:', error)
    throw error
  }

  // Group by game
  const gameMap = new Map<string, any>()

  for (const score of (scores || [])) {
    if (!gameMap.has(score.game_id)) {
      const isHome = score.home_team?.toLowerCase().includes(team.toLowerCase())
      gameMap.set(score.game_id, {
        gameId: score.game_id,
        date: score.game_date,
        opponent: isHome ? score.away_team : score.home_team,
        isHome,
        quarters: {},
      })
    }

    const game = gameMap.get(score.game_id)
    const isHome = game.isHome
    const teamPoints = isHome ? score.home_points : score.away_points
    const oppPoints = isHome ? score.away_points : score.home_points

    let winner = 'tie'
    if (teamPoints > oppPoints) winner = 'team'
    else if (oppPoints > teamPoints) winner = 'opponent'

    game.quarters[`Q${score.period_number}`] = {
      teamPoints,
      oppPoints,
      winner,
    }
  }

  // Calculate stats
  const quarterWins = {
    Q1: { wins: 0, losses: 0, ties: 0, total: 0 },
    Q2: { wins: 0, losses: 0, ties: 0, total: 0 },
    Q3: { wins: 0, losses: 0, ties: 0, total: 0 },
    Q4: { wins: 0, losses: 0, ties: 0, total: 0 },
  }

  const games: QuarterWinnerResult['games'] = []

  for (const game of gameMap.values()) {
    const quarterWinners: any = {}

    for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) {
      const qData = game.quarters[q]
      if (qData) {
        quarterWins[q as keyof typeof quarterWins].total++
        if (qData.winner === 'team') {
          quarterWins[q as keyof typeof quarterWins].wins++
          quarterWinners[q] = team
        } else if (qData.winner === 'opponent') {
          quarterWins[q as keyof typeof quarterWins].losses++
          quarterWinners[q] = game.opponent
        } else {
          quarterWins[q as keyof typeof quarterWins].ties++
          quarterWinners[q] = 'Tie'
        }
      }
    }

    games.push({
      gameId: game.gameId,
      date: game.date,
      opponent: game.opponent,
      quarterWinners,
    })
  }

  return {
    team,
    quarterWins,
    games: games.slice(0, 10),
  }
}

// ============================================================================
// FIRST TO SCORE
// ============================================================================

/**
 * Analyze how often a team scores first in games
 * Note: This requires play-by-play data which may not be available for all games
 */
export async function getTeamFirstToScore(params: {
  team: string
  sport?: string
  limit?: number
}): Promise<FirstToScoreResult> {
  const { team, sport = 'basketball_nba', limit = 20 } = params

  const supabase = createClient()

  // Get recent games for this team
  const { data: games, error } = await supabase
    .from('period_scores')
    .select('game_id, game_date, home_team, away_team')
    .eq('sport_key', sport)
    .eq('period_number', 1) // Just need one record per game
    .or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
    .order('game_date', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('[FirstToScore] Error:', error)
    throw error
  }

  const results: FirstToScoreResult['games'] = []
  let scoredFirst = 0
  let opponentScoredFirst = 0

  // For each game, try to fetch play-by-play and find first score
  for (const game of (games || [])) {
    try {
      const isHome = game.home_team?.toLowerCase().includes(team.toLowerCase())
      const opponent = isHome ? game.away_team : game.home_team

      // Fetch game details with play-by-play
      const leagueId = sport.includes('nba') ? 'nba' : sport.includes('nfl') ? 'nfl' : 'nba'
      const details = await fetchGameDetails(leagueId as LeagueId, game.game_id)

      if (details?.plays?.length) {
        // Find first scoring play
        const scoringPlays = extractScoringPlays(details.plays)
        const firstScore = scoringPlays[0]

        if (firstScore) {
          // Determine which team scored first
          const homeTeamId = details.teams?.find(t => t.homeAway === 'home')?.id
          const awayTeamId = details.teams?.find(t => t.homeAway === 'away')?.id

          const scoredFirstTeam = firstScore.team === 'home' ? 'home' : 'away'
          const teamScoredFirst = (isHome && scoredFirstTeam === 'home') || (!isHome && scoredFirstTeam === 'away')

          if (teamScoredFirst) {
            scoredFirst++
          } else {
            opponentScoredFirst++
          }

          results.push({
            gameId: game.game_id,
            date: game.game_date,
            opponent,
            scoredFirst: teamScoredFirst,
            firstScorer: firstScore.text?.match(/^([A-Z][a-z]+ [A-Z][a-z]+)/)?.[1],
            firstPoints: firstScore.points,
          })
        }
      }
    } catch (err) {
      // Play-by-play not available for this game
      console.warn('[FirstToScore] Could not fetch play-by-play for game:', game.game_id)
    }
  }

  const totalGames = results.length

  return {
    team,
    scoredFirst,
    opponentScoredFirst,
    totalGames,
    scoredFirstPercentage: totalGames > 0 ? Math.round((scoredFirst / totalGames) * 100) : 0,
    games: results.slice(0, 10),
  }
}

// ============================================================================
// FIRST BASKET SCORER (PLAYER)
// ============================================================================

/**
 * Get a player's first basket scorer frequency
 * Example: "How many times has LeBron scored the first basket this season?"
 */
export async function getFirstBasketScorer(params: {
  player: string
  team?: string
  sport?: string
  limit?: number
}): Promise<FirstBasketScorerResult> {
  const { player, team, sport = 'basketball_nba', limit = 20 } = params

  const supabase = createClient()

  // Get recent games (optionally filtered by team)
  let query = supabase
    .from('period_scores')
    .select('game_id, game_date, home_team, away_team')
    .eq('sport_key', sport)
    .eq('period_number', 1)
    .order('game_date', { ascending: false })
    .limit(limit)

  if (team) {
    query = query.or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
  }

  const { data: games, error } = await query

  if (error) {
    console.error('[FirstBasketScorer] Error:', error)
    throw error
  }

  const results: FirstBasketScorerResult['games'] = []
  let timesFirstBasket = 0
  let totalTeamGames = 0

  const playerLower = player.toLowerCase()

  for (const game of (games || [])) {
    try {
      const leagueId = sport.includes('nba') ? 'nba' : sport.includes('nfl') ? 'nfl' : 'nba'
      const details = await fetchGameDetails(leagueId as LeagueId, game.game_id)

      if (details?.plays?.length) {
        // Find first scoring play
        for (const play of details.plays) {
          const scoringInfo = detectScoringPlay(play.text)
          if (scoringInfo) {
            const playTextLower = play.text?.toLowerCase() || ''

            // Check if player name appears in play text
            const playerNames = player.split(' ')
            const playerInPlay = playerNames.some(name =>
              name.length > 2 && playTextLower.includes(name.toLowerCase())
            )

            if (playerInPlay) {
              timesFirstBasket++
              results.push({
                gameId: game.game_id,
                date: game.game_date,
                opponent: game.away_team, // Simplified
                points: scoringInfo.points,
                playText: play.text,
              })
            }

            totalTeamGames++
            break // Only check first scoring play
          }
        }
      }
    } catch (err) {
      console.warn('[FirstBasketScorer] Could not fetch play-by-play for game:', game.game_id)
    }
  }

  return {
    player,
    team: team || 'Unknown',
    timesFirstBasket,
    totalTeamGames,
    percentage: totalTeamGames > 0 ? Math.round((timesFirstBasket / totalTeamGames) * 100) : 0,
    games: results.slice(0, 10),
  }
}

// ============================================================================
// TEAM QUARTER AVERAGES
// ============================================================================

/**
 * Get a team's average points per quarter
 */
export async function getTeamQuarterAverages(params: {
  team: string
  sport?: string
}): Promise<{
  team: string
  averages: { Q1: number; Q2: number; Q3: number; Q4: number }
  gamesPlayed: number
}> {
  const { team, sport = 'basketball_nba' } = params

  const supabase = createClient()

  const { data: averages, error } = await supabase
    .from('team_quarter_averages')
    .select('*')
    .eq('sport_key', sport)
    .ilike('team', `%${team}%`)
    .order('period_number', { ascending: true })

  if (error) {
    console.error('[QuarterAverages] Error:', error)
    throw error
  }

  const result = {
    Q1: 0,
    Q2: 0,
    Q3: 0,
    Q4: 0,
  }

  let gamesPlayed = 0

  for (const avg of (averages || [])) {
    if (avg.period_number >= 1 && avg.period_number <= 4) {
      result[`Q${avg.period_number}` as keyof typeof result] = parseFloat(avg.avg_points?.toFixed(1) || '0')
      gamesPlayed = Math.max(gamesPlayed, avg.games_count || 0)
    }
  }

  return {
    team,
    averages: result,
    gamesPlayed,
  }
}
