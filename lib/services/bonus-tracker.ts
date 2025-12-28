/**
 * Bonus Situation Tracker
 * Tracks team fouls per quarter and bonus/double-bonus status
 * NBA Rules: 5 team fouls = bonus (2 FTs), resets each quarter
 */

import type { PlayByPlayEntry, LiveScoreGameDetails } from '@/lib/live-scores'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TeamFoulStatus {
  foulsThisQuarter: number
  foulsToBonus: number        // 5 - current (min 0)
  bonusStatus: 'none' | 'bonus'
  projectedFTAttempts: number // Based on current foul rate and time remaining
  foulRate: number            // Fouls per minute this quarter
}

export interface BonusSituationAnalysis {
  home: TeamFoulStatus
  away: TeamFoulStatus
  freeThrowAdvantage: 'home' | 'away' | 'neutral'
  totalImpact: number         // +/- points from bonus differential
  factors: string[]
}

// ============================================================================
// FOUL PARSING
// ============================================================================

// Patterns to detect fouls in play-by-play text
const FOUL_PATTERNS = [
  /personal foul/i,
  /shooting foul/i,
  /offensive foul/i,
  /loose ball foul/i,
  /away from play foul/i,
  /flagrant foul/i,
  /clear path foul/i,
]

// Technical fouls don't count toward team bonus
const TECHNICAL_PATTERN = /technical foul/i

/**
 * Determine which team committed the foul from play-by-play text
 */
function getFoulingTeam(
  play: PlayByPlayEntry,
  homeTeamId: string,
  awayTeamId: string
): 'home' | 'away' | null {
  // If play has teamId, use it directly
  if (play.teamId) {
    if (play.teamId === homeTeamId) return 'home'
    if (play.teamId === awayTeamId) return 'away'
  }

  // Otherwise, we can't determine the team
  return null
}

/**
 * Check if a play is a countable team foul (not a technical)
 */
function isTeamFoul(playText: string): boolean {
  // Skip technical fouls - they don't count toward bonus
  if (TECHNICAL_PATTERN.test(playText)) {
    return false
  }

  // Check if any foul pattern matches
  return FOUL_PATTERNS.some(pattern => pattern.test(playText))
}

/**
 * Count team fouls from play-by-play for a specific quarter
 */
export function countTeamFoulsInQuarter(
  plays: PlayByPlayEntry[],
  quarter: number,
  homeTeamId: string,
  awayTeamId: string
): { home: number; away: number } {
  let homeFouls = 0
  let awayFouls = 0

  for (const play of plays) {
    // Only count fouls from the specified quarter
    if (play.period !== quarter) continue

    // Check if this is a team foul
    if (!isTeamFoul(play.text)) continue

    // Determine which team fouled
    const foulingTeam = getFoulingTeam(play, homeTeamId, awayTeamId)

    if (foulingTeam === 'home') {
      homeFouls++
    } else if (foulingTeam === 'away') {
      awayFouls++
    }
  }

  return { home: homeFouls, away: awayFouls }
}

/**
 * Calculate bonus status from foul count
 * NBA: 5 team fouls in a quarter = bonus (opponent shoots 2 FTs on all fouls)
 */
function calculateBonusStatus(foulsThisQuarter: number): 'none' | 'bonus' {
  if (foulsThisQuarter >= 5) return 'bonus'
  return 'none'
}

/**
 * Calculate team foul status
 */
function calculateTeamFoulStatus(
  foulsThisQuarter: number,
  quarterMinutesRemaining: number,
  quarterMinutesElapsed: number
): TeamFoulStatus {
  const bonusStatus = calculateBonusStatus(foulsThisQuarter)
  const foulsToBonus = Math.max(0, 5 - foulsThisQuarter)

  // Calculate foul rate (fouls per minute)
  const foulRate = quarterMinutesElapsed > 0
    ? foulsThisQuarter / quarterMinutesElapsed
    : 0

  // Project remaining fouls and FT attempts
  const projectedRemainingFouls = foulRate * quarterMinutesRemaining

  // If in bonus, each foul = 2 FT attempts
  // If not in bonus, fouls after reaching bonus will generate FTs
  let projectedFTAttempts = 0

  if (bonusStatus === 'bonus') {
    // Already in bonus: all remaining fouls generate FTs
    projectedFTAttempts = projectedRemainingFouls * 2
  } else {
    // Not in bonus yet: only fouls after reaching 5 generate FTs
    const foulsUntilBonus = 5 - foulsThisQuarter
    const foulsInBonus = Math.max(0, projectedRemainingFouls - foulsUntilBonus)
    projectedFTAttempts = foulsInBonus * 2
  }

  return {
    foulsThisQuarter,
    foulsToBonus,
    bonusStatus,
    projectedFTAttempts,
    foulRate,
  }
}

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Analyze bonus situation for both teams
 */
export function analyzeBonusSituation(
  liveGame: LiveScoreGameDetails,
  currentPeriod: number,
  quarterSecondsRemaining: number
): BonusSituationAnalysis {
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const plays = liveGame.plays || []
  const homeTeamId = homeTeam?.id || ''
  const awayTeamId = awayTeam?.id || ''

  // Count fouls in current quarter
  const fouls = countTeamFoulsInQuarter(plays, currentPeriod, homeTeamId, awayTeamId)

  // Calculate quarter timing
  const quarterMinutes = 12 // NBA quarter length
  const quarterMinutesRemaining = quarterSecondsRemaining / 60
  const quarterMinutesElapsed = quarterMinutes - quarterMinutesRemaining

  // Calculate status for each team
  // Note: Home team's fouls put AWAY team in bonus (and vice versa)
  const homeStatus = calculateTeamFoulStatus(
    fouls.away, // Away team's fouls affect home team's FT opportunities
    quarterMinutesRemaining,
    quarterMinutesElapsed
  )

  const awayStatus = calculateTeamFoulStatus(
    fouls.home, // Home team's fouls affect away team's FT opportunities
    quarterMinutesRemaining,
    quarterMinutesElapsed
  )

  // Determine FT advantage
  let freeThrowAdvantage: 'home' | 'away' | 'neutral' = 'neutral'
  const ftDiff = homeStatus.projectedFTAttempts - awayStatus.projectedFTAttempts

  if (ftDiff > 1) freeThrowAdvantage = 'home'
  else if (ftDiff < -1) freeThrowAdvantage = 'away'

  // Calculate point impact
  // NBA average FT% is ~77%, so each FT attempt = ~0.77 points
  const NBA_FT_PCT = 0.77
  const homeExpectedPts = homeStatus.projectedFTAttempts * NBA_FT_PCT
  const awayExpectedPts = awayStatus.projectedFTAttempts * NBA_FT_PCT
  const totalImpact = homeExpectedPts - awayExpectedPts

  // Generate factors
  const factors: string[] = []

  if (homeStatus.bonusStatus === 'bonus') {
    factors.push(`${homeTeam?.name || 'Home'} IN BONUS (opponent has ${fouls.away} fouls)`)
  } else if (homeStatus.foulsToBonus <= 2) {
    factors.push(`${homeTeam?.name || 'Home'} ${homeStatus.foulsToBonus} fouls from bonus`)
  }

  if (awayStatus.bonusStatus === 'bonus') {
    factors.push(`${awayTeam?.name || 'Away'} IN BONUS (opponent has ${fouls.home} fouls)`)
  } else if (awayStatus.foulsToBonus <= 2) {
    factors.push(`${awayTeam?.name || 'Away'} ${awayStatus.foulsToBonus} fouls from bonus`)
  }

  if (Math.abs(totalImpact) > 1) {
    const advantageTeam = totalImpact > 0 ? homeTeam?.name : awayTeam?.name
    factors.push(`FT advantage: ${advantageTeam} (+${Math.abs(totalImpact).toFixed(1)} projected pts)`)
  }

  return {
    home: homeStatus,
    away: awayStatus,
    freeThrowAdvantage,
    totalImpact,
    factors,
  }
}
