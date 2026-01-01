/**
 * Bonus Situation Tracker
 * Tracks team fouls per period and bonus/double-bonus status
 * NBA: 5 team fouls = bonus (2 FTs), resets each quarter
 * NCAAB: 7 team fouls = bonus (1-and-1), 10 = double bonus, resets each half
 */

import type { PlayByPlayEntry, LiveScoreGameDetails } from '@/lib/live-scores'

// ============================================================================
// INTERFACES
// ============================================================================

export interface TeamFoulStatus {
  foulsThisQuarter: number
  foulsToBonus: number        // threshold - current (min 0)
  foulsToDoubleBonus?: number
  bonusStatus: 'none' | 'bonus' | 'double'
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

type BonusRules = {
  periodMinutes: number
  foulsToBonus: number
  foulsToDoubleBonus?: number
  bonusFtAttempts: number
  doubleBonusFtAttempts: number
  ftPct: number
}

const BONUS_RULES: Record<string, BonusRules> = {
  nba: {
    periodMinutes: 12,
    foulsToBonus: 5,
    bonusFtAttempts: 2,
    doubleBonusFtAttempts: 2,
    ftPct: 0.77,
  },
  ncaab: {
    periodMinutes: 20,
    foulsToBonus: 7,
    foulsToDoubleBonus: 10,
    bonusFtAttempts: 1.4,
    doubleBonusFtAttempts: 2,
    ftPct: 0.70,
  },
}

const getBonusRules = (league: string): BonusRules =>
  BONUS_RULES[league] ?? BONUS_RULES.nba

/**
 * Calculate bonus status from foul count
 */
function calculateBonusStatus(
  foulsThisPeriod: number,
  rules: BonusRules
): 'none' | 'bonus' | 'double' {
  if (rules.foulsToDoubleBonus != null && foulsThisPeriod >= rules.foulsToDoubleBonus) {
    return 'double'
  }
  if (foulsThisPeriod >= rules.foulsToBonus) return 'bonus'
  return 'none'
}

/**
 * Calculate team foul status
 */
function calculateTeamFoulStatus(
  foulsThisPeriod: number,
  periodMinutesRemaining: number,
  periodMinutesElapsed: number,
  rules: BonusRules
): TeamFoulStatus {
  const bonusStatus = calculateBonusStatus(foulsThisPeriod, rules)
  const foulsToBonus = Math.max(0, rules.foulsToBonus - foulsThisPeriod)
  const foulsToDoubleBonus =
    rules.foulsToDoubleBonus != null
      ? Math.max(0, rules.foulsToDoubleBonus - foulsThisPeriod)
      : undefined

  // Calculate foul rate (fouls per minute)
  const foulRate = periodMinutesElapsed > 0
    ? foulsThisPeriod / periodMinutesElapsed
    : 0

  // Project remaining fouls and FT attempts
  const projectedRemainingFouls = foulRate * periodMinutesRemaining

  // Expected FT attempts from remaining fouls
  const foulsUntilBonus = Math.max(0, rules.foulsToBonus - foulsThisPeriod)
  const remainingAfterBonus = Math.max(0, projectedRemainingFouls - foulsUntilBonus)
  let projectedFTAttempts = 0

  if (rules.foulsToDoubleBonus != null) {
    const foulsUntilDouble = Math.max(
      0,
      rules.foulsToDoubleBonus - Math.max(foulsThisPeriod, rules.foulsToBonus)
    )
    const bonusFouls = Math.min(remainingAfterBonus, foulsUntilDouble)
    const doubleFouls = Math.max(0, remainingAfterBonus - bonusFouls)
    projectedFTAttempts =
      bonusFouls * rules.bonusFtAttempts +
      doubleFouls * rules.doubleBonusFtAttempts
  } else {
    projectedFTAttempts = remainingAfterBonus * rules.bonusFtAttempts
  }

  return {
    foulsThisQuarter: foulsThisPeriod,
    foulsToBonus,
    foulsToDoubleBonus,
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
  periodSecondsRemaining: number,
  league: string
): BonusSituationAnalysis {
  const rules = getBonusRules(league)
  const homeTeam = liveGame.teams.find(t => t.homeAway === 'home')
  const awayTeam = liveGame.teams.find(t => t.homeAway === 'away')

  const plays = liveGame.plays || []
  const homeTeamId = homeTeam?.id || ''
  const awayTeamId = awayTeam?.id || ''

  // Count fouls in current quarter
  const fouls = countTeamFoulsInQuarter(plays, currentPeriod, homeTeamId, awayTeamId)

  // Calculate period timing
  const periodMinutesRemaining = periodSecondsRemaining / 60
  const periodMinutesElapsed = Math.max(0, rules.periodMinutes - periodMinutesRemaining)

  // Calculate status for each team
  // Note: Home team's fouls put AWAY team in bonus (and vice versa)
  const homeStatus = calculateTeamFoulStatus(
    fouls.away, // Away team's fouls affect home team's FT opportunities
    periodMinutesRemaining,
    periodMinutesElapsed,
    rules
  )

  const awayStatus = calculateTeamFoulStatus(
    fouls.home, // Home team's fouls affect away team's FT opportunities
    periodMinutesRemaining,
    periodMinutesElapsed,
    rules
  )

  // Determine FT advantage
  let freeThrowAdvantage: 'home' | 'away' | 'neutral' = 'neutral'
  const ftDiff = homeStatus.projectedFTAttempts - awayStatus.projectedFTAttempts

  if (ftDiff > 1) freeThrowAdvantage = 'home'
  else if (ftDiff < -1) freeThrowAdvantage = 'away'

  // Calculate point impact
  const ftPct = rules.ftPct
  const homeExpectedPts = homeStatus.projectedFTAttempts * ftPct
  const awayExpectedPts = awayStatus.projectedFTAttempts * ftPct
  const totalImpact = homeExpectedPts - awayExpectedPts

  // Generate factors
  const factors: string[] = []

  if (homeStatus.bonusStatus === 'double') {
    factors.push(`${homeTeam?.name || 'Home'} IN DOUBLE BONUS (opponent has ${fouls.away} fouls)`)
  } else if (homeStatus.bonusStatus === 'bonus') {
    factors.push(`${homeTeam?.name || 'Home'} IN BONUS (opponent has ${fouls.away} fouls)`)
  } else if (homeStatus.foulsToBonus <= 2) {
    factors.push(`${homeTeam?.name || 'Home'} ${homeStatus.foulsToBonus} fouls from bonus`)
  }
  if (
    homeStatus.bonusStatus === 'bonus' &&
    homeStatus.foulsToDoubleBonus != null &&
    homeStatus.foulsToDoubleBonus <= 2
  ) {
    factors.push(`${homeTeam?.name || 'Home'} ${homeStatus.foulsToDoubleBonus} fouls from double bonus`)
  }

  if (awayStatus.bonusStatus === 'double') {
    factors.push(`${awayTeam?.name || 'Away'} IN DOUBLE BONUS (opponent has ${fouls.home} fouls)`)
  } else if (awayStatus.bonusStatus === 'bonus') {
    factors.push(`${awayTeam?.name || 'Away'} IN BONUS (opponent has ${fouls.home} fouls)`)
  } else if (awayStatus.foulsToBonus <= 2) {
    factors.push(`${awayTeam?.name || 'Away'} ${awayStatus.foulsToBonus} fouls from bonus`)
  }
  if (
    awayStatus.bonusStatus === 'bonus' &&
    awayStatus.foulsToDoubleBonus != null &&
    awayStatus.foulsToDoubleBonus <= 2
  ) {
    factors.push(`${awayTeam?.name || 'Away'} ${awayStatus.foulsToDoubleBonus} fouls from double bonus`)
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
