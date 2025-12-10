/**
 * Schedule analyzer for team travel, rest, and back-to-back analysis.
 * Used to answer questions like "How will the road trip affect them?"
 */

import { getTeamSchedule, getTeams, type SportKey } from '@/lib/services/espn-orchestrator'
import type { ScheduleAnalysis, ScheduleGame } from './types'

/**
 * Get current season based on sport
 * ESPN uses the STARTING year of the season (e.g., 2025 for 2025-26 season)
 */
function getCurrentSeason(sport: SportKey): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  switch (sport) {
    case 'nba':
      // NBA season starts in October, so Oct-Dec uses current year, Jan-Sep uses previous year
      return month >= 9 ? year : year - 1
    case 'nfl':
      // NFL season starts in September
      return month >= 8 ? year : year - 1
    case 'mlb':
      return year
    case 'nhl':
      // NHL like NBA, starts in October
      return month >= 9 ? year : year - 1
    default:
      return year
  }
}

/**
 * Find team ID by name
 */
async function findTeamId(teamName: string, sport: SportKey): Promise<string | null> {
  const teams = await getTeams(sport)
  if (!teams) return null

  const normalized = teamName.toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const team of teams) {
    const teamNormalized = (team.displayName || team.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const abbr = (team.abbreviation || '').toLowerCase()
    // Use shortDisplayName (city name) instead of location which doesn't exist
    const shortName = (team.shortDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const nickname = (team.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    if (
      teamNormalized === normalized ||
      teamNormalized.includes(normalized) ||
      normalized.includes(nickname) ||
      abbr === normalized ||
      shortName === normalized
    ) {
      return team.id
    }
  }

  return null
}

/**
 * Calculate days between two dates
 */
function daysBetween(date1: Date, date2: Date): number {
  const diffTime = Math.abs(date2.getTime() - date1.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Count consecutive road games from a starting point
 */
function countConsecutiveRoadGames(games: Array<{ isHome: boolean; date: string }>): number {
  let count = 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find games from today forward
  const futureGames = games
    .filter((g) => new Date(g.date) >= today)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  for (const game of futureGames) {
    if (!game.isHome) {
      count++
    } else {
      break
    }
  }

  return count
}

/**
 * Find back-to-back games in a window
 */
function findBackToBacks(
  games: Array<{ date: string; isHome: boolean; opponent?: string }>,
  daysAhead: number
): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + daysAhead)

  const relevantGames = games
    .filter((g) => {
      const gameDate = new Date(g.date)
      return gameDate >= today && gameDate <= endDate
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  let b2bCount = 0
  for (let i = 1; i < relevantGames.length; i++) {
    const prevDate = new Date(relevantGames[i - 1].date)
    const currDate = new Date(relevantGames[i].date)
    if (daysBetween(prevDate, currDate) === 1) {
      b2bCount++
    }
  }

  return b2bCount
}

/**
 * Calculate average rest days in recent games
 */
function calculateAvgRestDays(games: Array<{ date: string }>, lookBack: number): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const recentGames = games
    .filter((g) => new Date(g.date) < today)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, lookBack)

  if (recentGames.length < 2) return 2 // Default to 2 days rest

  let totalRest = 0
  let restPeriods = 0

  for (let i = 1; i < recentGames.length; i++) {
    const laterDate = new Date(recentGames[i - 1].date)
    const earlierDate = new Date(recentGames[i].date)
    const rest = daysBetween(earlierDate, laterDate) - 1 // -1 because we want rest days, not total days
    totalRest += rest
    restPeriods++
  }

  return restPeriods > 0 ? Number((totalRest / restPeriods).toFixed(1)) : 2
}

/**
 * Calculate travel impact based on schedule
 */
function calculateTravelImpact(
  games: Array<{ isHome: boolean; date: string }>
): 'low' | 'medium' | 'high' {
  const today = new Date()
  const nextWeek = new Date(today)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const upcomingGames = games.filter((g) => {
    const d = new Date(g.date)
    return d >= today && d <= nextWeek
  })

  const roadGames = upcomingGames.filter((g) => !g.isHome).length
  const totalGames = upcomingGames.length
  const roadStreak = countConsecutiveRoadGames(games)

  // High impact: 4+ road games in a row, or all games in next week are road
  if (roadStreak >= 4 || (totalGames >= 3 && roadGames === totalGames)) {
    return 'high'
  }

  // Medium impact: 2-3 road games in a row, or mostly road
  if (roadStreak >= 2 || (totalGames >= 2 && roadGames >= totalGames * 0.6)) {
    return 'medium'
  }

  return 'low'
}

/**
 * Generate insight text based on schedule analysis
 */
function generateScheduleInsight(
  roadStreak: number,
  backToBacks: number,
  avgRestDays: number,
  travelImpact: string
): string {
  const insights: string[] = []

  if (roadStreak >= 4) {
    insights.push(
      `Extended road trip (${roadStreak} consecutive away games) - teams typically see 2-3 point performance decline in games 4+.`
    )
  } else if (roadStreak >= 2) {
    insights.push(`Currently in a ${roadStreak}-game road stretch.`)
  }

  if (backToBacks >= 2) {
    insights.push(
      `Heavy schedule with ${backToBacks} back-to-back sets in the next week - watch for fatigue and injury risk.`
    )
  } else if (backToBacks === 1) {
    insights.push(`Has 1 back-to-back set upcoming.`)
  }

  if (avgRestDays < 1.5) {
    insights.push(`Limited rest recently (${avgRestDays} avg days between games) - fatigue factor is elevated.`)
  } else if (avgRestDays >= 3) {
    insights.push(`Well-rested lately (${avgRestDays} avg days between games) - should be fresh.`)
  }

  if (travelImpact === 'high') {
    insights.push(`High travel impact - consider fading ATS and targeting unders.`)
  }

  return insights.length > 0
    ? insights.join(' ')
    : 'Normal schedule without significant travel or rest concerns.'
}

/**
 * Main function to analyze team schedule
 */
export async function analyzeTeamSchedule(args: {
  team: string
  sport?: SportKey
  lookAhead?: number
  lookBack?: number
}): Promise<ScheduleAnalysis> {
  const sport = args.sport || 'nba'
  const lookAhead = args.lookAhead || 7
  const lookBack = args.lookBack || 7

  // Find team ID
  const teamId = await findTeamId(args.team, sport)
  if (!teamId) {
    return {
      team: args.team,
      currentRoadStreak: 0,
      upcomingBackToBacks: 0,
      avgRestDays: 2,
      travelFactor: 'low',
      insight: `Could not find team "${args.team}" in ${sport.toUpperCase()} data.`,
    }
  }

  // Get schedule
  const season = getCurrentSeason(sport)
  const schedule = await getTeamSchedule(sport, teamId, season, 2)

  if (!schedule || schedule.length === 0) {
    return {
      team: args.team,
      currentRoadStreak: 0,
      upcomingBackToBacks: 0,
      avgRestDays: 2,
      travelFactor: 'low',
      insight: `No schedule data available for ${args.team}.`,
    }
  }

  // Transform schedule to our format
  const games = schedule.map((g) => ({
    date: g.date,
    isHome: g.isHome,
    opponent: g.opponentName,
  }))

  // Calculate metrics
  const roadStreak = countConsecutiveRoadGames(games)
  const backToBacks = findBackToBacks(games, lookAhead)
  const avgRestDays = calculateAvgRestDays(games, lookBack)
  const travelFactor = calculateTravelImpact(games)

  // Get upcoming games for response
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + lookAhead)

  const upcomingGames: ScheduleGame[] = games
    .filter((g) => {
      const d = new Date(g.date)
      return d >= today && d <= endDate
    })
    .slice(0, 5)
    .map((g, idx, arr) => {
      // Check if this is a back-to-back
      let isBackToBack = false
      if (idx > 0) {
        const prevDate = new Date(arr[idx - 1].date)
        const currDate = new Date(g.date)
        isBackToBack = daysBetween(prevDate, currDate) === 1
      }

      return {
        date: g.date,
        opponent: g.opponent || 'TBD',
        isHome: g.isHome,
        isBackToBack,
      }
    })

  return {
    team: args.team,
    currentRoadStreak: roadStreak,
    upcomingBackToBacks: backToBacks,
    avgRestDays: avgRestDays,
    travelFactor,
    upcomingGames,
    insight: generateScheduleInsight(roadStreak, backToBacks, avgRestDays, travelFactor),
  }
}
