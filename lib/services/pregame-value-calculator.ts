/**
 * Pre-Game Value Calculator
 * Calculates "fair" lines for spreads, totals, and props before games start
 */

import { oddsToImpliedProbability } from '@/lib/utils/statistics'

// NBA constants
const NBA_HOME_COURT_ADVANTAGE = 3.0 // points
const NBA_LEAGUE_AVG_ORTG = 115.0 // average offensive rating
const NBA_LEAGUE_AVG_PACE = 100.0 // average possessions per 48 min
const NCAAB_HOME_COURT_ADVANTAGE = 3.2 // points
const NCAAB_LEAGUE_AVG_ORTG = 105.0 // average offensive rating
const NCAAB_LEAGUE_AVG_PACE = 70.0 // average possessions per 40 min
const NFL_HOME_FIELD_ADVANTAGE = 1.7 // points
const NFL_LEAGUE_AVG_PPG = 22.0
const NFL_LEAGUE_AVG_YPP = 5.5
const NFL_LEAGUE_AVG_PPD = 2.05
const NFL_LEAGUE_AVG_PLAYS = 63
const NFL_LEAGUE_AVG_THIRD_DOWN = 0.38
const NFL_LEAGUE_AVG_REDZONE_TD = 0.55
const NFL_LEAGUE_AVG_EXPLOSIVE = 0.1
const NFL_LEAGUE_AVG_SACK_RATE = 0.07
const NCAAF_HOME_FIELD_ADVANTAGE = 2.8 // points
const NCAAF_LEAGUE_AVG_PPG = 28.0
const NCAAF_LEAGUE_AVG_YPP = 6.0
const NCAAF_LEAGUE_AVG_PPD = 2.4
const NCAAF_LEAGUE_AVG_PLAYS = 70
const NCAAF_LEAGUE_AVG_THIRD_DOWN = 0.41
const NCAAF_LEAGUE_AVG_REDZONE_TD = 0.62
const NCAAF_LEAGUE_AVG_EXPLOSIVE = 0.11
const NCAAF_LEAGUE_AVG_SACK_RATE = 0.06
const NHL_HOME_ICE_ADVANTAGE = 0.25 // goals
const NHL_LEAGUE_AVG_GPG = 3.1
const BACK_TO_BACK_PENALTY = 2.5 // points
const TRAVEL_PENALTY_PER_1000_MILES = 0.3 // points
const TIMEZONE_PENALTY_PER_HOUR = 0.5 // points
const ALTITUDE_BONUS_PER_1000_FT = 0.4 // points for home team at altitude

// Pace-based margin scaling
// Fast games (high pace) have larger margins due to more possessions
// Slow games compress margins
const PACE_MARGIN_SCALE_FACTOR = 0.008 // ~0.8% margin adjustment per pace point from average

// Recent form adjustment
// Teams on hot streaks get a boost, cold teams get penalized
const MAX_FORM_ADJUSTMENT = 2.0 // Maximum +/- points adjustment for form

export interface TeamStats {
  ortg: number // offensive rating
  drtg: number // defensive rating
  pace: number // possessions per game
  eFG?: number // effective field goal %
  ts?: number // true shooting %
}

export interface FootballTeamStats {
  pointsForPerGame: number
  pointsAgainstPerGame: number
  yardsPerPlay?: number | null
  yardsAllowedPerPlay?: number | null
  playsPerGame?: number | null
  drivesPerGame?: number | null
  pointsPerDrive?: number | null
  thirdDownConvPct?: number | null
  redZoneTouchdownPct?: number | null
  redZoneScoringPct?: number | null
  explosivePlayRate?: number | null
  sackRate?: number | null
  defensiveSackRate?: number | null
  turnoverDifferential?: number | null
  qbValue?: number | null
  passerRating?: number | null
  passingYardsPerAttempt?: number | null
  completionPct?: number | null
  interceptionPct?: number | null
}

export interface HockeyTeamStats {
  goalsForPerGame: number
  goalsAgainstPerGame: number
  shotsForPerGame?: number | null
  shotsAgainstPerGame?: number | null
}

export interface RestFactors {
  daysRest: number
  isBackToBack: boolean
  gamesInLast5Days: number
}

export interface TravelFactors {
  milesFromPrevious: number
  timezoneDelta: number // hours
  altitudeDelta: number // feet
}

export interface RecentForm {
  wins: number
  losses: number
  avgMargin: number
  streak: number
  performanceRating: number
}

export interface StyleMatchupAdjustment {
  adjustment: number
  reason: string
}

export interface PlayerStats {
  seasonAverage: number // for the specific stat
  usage: number // usage rate %
  minutesPerGame: number
  pace?: number // player's pace factor
  bpm?: number // Box Plus/Minus
  obpm?: number // Offensive BPM
  dbpm?: number // Defensive BPM
  vorp?: number // Value Over Replacement Player
  per?: number // Player Efficiency Rating
  ws48?: number // Win Shares per 48 minutes
  nbaRating?: number
  trueShootingPct?: number
  effectiveFgPct?: number
  scoringEfficiency?: number
  shootingEfficiency?: number
  pointsPerEstimatedPossessions?: number
  assistsPerGame?: number
  stealsPerGame?: number
  blocksPerGame?: number
  defensiveReboundsPerGame?: number
  defensiveReboundRate?: number
}

export interface OpponentDefense {
  allowedStatPerGame: number // how much opponent allows this stat
  defensiveRating?: number
}

export interface LeagueContext {
  homeCourtAdvantage?: number
  leagueAvgOrtg?: number
  leagueAvgPace?: number
  paceBase?: number
}

/**
 * Calculate fair spread for a matchup
 */
export function calculateFairSpread(
  homeTeamStats: TeamStats,
  awayTeamStats: TeamStats,
  homeRest?: RestFactors,
  awayRest?: RestFactors,
  homeTravel?: TravelFactors,
  awayTravel?: TravelFactors,
  homeForm?: RecentForm,
  awayForm?: RecentForm,
  styleMatchup?: StyleMatchupAdjustment,
  leagueContext?: LeagueContext
): number {
  const leagueAvgOrtg = leagueContext?.leagueAvgOrtg ?? NBA_LEAGUE_AVG_ORTG
  const leagueAvgPace = leagueContext?.leagueAvgPace ?? NBA_LEAGUE_AVG_PACE
  const paceBase = leagueContext?.paceBase ?? 100
  const homeCourtAdvantage =
    leagueContext?.homeCourtAdvantage ?? NBA_HOME_COURT_ADVANTAGE

  // Step 1: Calculate expected scores using Four Factors approach
  // Home team expected score = their ORtg * (opponent DRtg / league avg DRtg) * pace factor
  const homePaceFactor = (homeTeamStats.pace + awayTeamStats.pace) / (2 * paceBase)

  const homeExpectedScore =
    homeTeamStats.ortg * (awayTeamStats.drtg / leagueAvgOrtg) * homePaceFactor

  const awayExpectedScore =
    awayTeamStats.ortg * (homeTeamStats.drtg / leagueAvgOrtg) * homePaceFactor

  // Step 2: Start with base differential
  let fairSpread = homeExpectedScore - awayExpectedScore

  // Step 3: Add home court advantage
  fairSpread += homeCourtAdvantage

  // Step 4: Adjust for rest
  if (homeRest?.isBackToBack) {
    fairSpread -= BACK_TO_BACK_PENALTY
  }
  if (awayRest?.isBackToBack) {
    fairSpread += BACK_TO_BACK_PENALTY
  }

  // Step 5: Adjust for travel
  if (homeTravel) {
    const travelPenalty =
      (homeTravel.milesFromPrevious / 1000) * TRAVEL_PENALTY_PER_1000_MILES +
      homeTravel.timezoneDelta * TIMEZONE_PENALTY_PER_HOUR
    fairSpread -= travelPenalty
  }

  if (awayTravel) {
    const travelPenalty =
      (awayTravel.milesFromPrevious / 1000) * TRAVEL_PENALTY_PER_1000_MILES +
      Math.abs(awayTravel.timezoneDelta) * TIMEZONE_PENALTY_PER_HOUR
    fairSpread += travelPenalty
  }

  // Step 6: Adjust for altitude (home team advantage)
  if (homeTravel && homeTravel.altitudeDelta > 0) {
    fairSpread += (homeTravel.altitudeDelta / 1000) * ALTITUDE_BONUS_PER_1000_FT
  }

  // Step 7: Apply pace-based margin scaling
  // Fast games amplify margins, slow games compress them
  const combinedPace = (homeTeamStats.pace + awayTeamStats.pace) / 2
  const paceDeviation = combinedPace - leagueAvgPace
  const paceScaleFactor = 1 + (paceDeviation * PACE_MARGIN_SCALE_FACTOR)
  fairSpread = fairSpread * paceScaleFactor

  // Step 8: Apply recent form adjustment (momentum)
  // Teams playing well recently get a boost, struggling teams get penalized
  // Uses performanceRating (0-100 scale) and streak
  if (homeForm || awayForm) {
    let homeFormAdjust = 0
    let awayFormAdjust = 0

    if (homeForm) {
      // Performance rating: 50 is neutral, above = positive, below = negative
      const perfDeviation = (homeForm.performanceRating - 50) / 50 // -1 to +1 scale
      // Streak bonus: each game in streak adds ~0.2 points, max 1 point from streak
      const streakBonus = Math.min(1, Math.abs(homeForm.streak) * 0.2) * Math.sign(homeForm.streak)
      // Blend 60% L10 performance, 40% streak momentum
      homeFormAdjust = (perfDeviation * MAX_FORM_ADJUSTMENT * 0.6) + (streakBonus * 0.4)
    }

    if (awayForm) {
      const perfDeviation = (awayForm.performanceRating - 50) / 50
      const streakBonus = Math.min(1, Math.abs(awayForm.streak) * 0.2) * Math.sign(awayForm.streak)
      awayFormAdjust = (perfDeviation * MAX_FORM_ADJUSTMENT * 0.6) + (streakBonus * 0.4)
    }

    // Apply form adjustments (positive for home, negative for away)
    fairSpread += homeFormAdjust - awayFormAdjust
  }

  // Step 9: Apply style matchup adjustment
  // Accounts for how team styles interact (e.g., grinders vs run-and-gun)
  if (styleMatchup && styleMatchup.adjustment !== 0) {
    fairSpread += styleMatchup.adjustment
  }

  return fairSpread
}

/**
 * Calculate fair total for a matchup
 */
export function calculateFairTotal(
  homeTeamStats: TeamStats,
  awayTeamStats: TeamStats,
  leagueContext?: LeagueContext
): number {
  const leagueAvgOrtg = leagueContext?.leagueAvgOrtg ?? NBA_LEAGUE_AVG_ORTG
  const paceBase = leagueContext?.paceBase ?? 100
  // Pace-adjusted scoring projection
  const combinedPace = (homeTeamStats.pace + awayTeamStats.pace) / 2
  const paceFactor = combinedPace / paceBase

  // Home team expected score
  const homeExpectedScore =
    homeTeamStats.ortg * (awayTeamStats.drtg / leagueAvgOrtg) * paceFactor

  // Away team expected score
  const awayExpectedScore =
    awayTeamStats.ortg * (homeTeamStats.drtg / leagueAvgOrtg) * paceFactor

  // Fair total is the sum
  const fairTotal = homeExpectedScore + awayExpectedScore

  return fairTotal
}

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const adjustByYpp = (
  base: number,
  offenseYpp?: number | null,
  defenseYpp?: number | null,
  leagueAvg = NFL_LEAGUE_AVG_YPP
) => {
  const offenseFactor =
    offenseYpp != null && leagueAvg > 0 ? offenseYpp / leagueAvg : 1
  const defenseFactor =
    defenseYpp != null && leagueAvg > 0 ? defenseYpp / leagueAvg : 1
  const combined = clamp(offenseFactor / defenseFactor, 0.9, 1.1)
  return base * combined
}

const adjustByTurnovers = (
  value: number,
  turnoverDiff?: number | null,
  weight = 0.35
) => {
  if (turnoverDiff == null || !Number.isFinite(turnoverDiff)) return value
  return value + turnoverDiff * weight
}

const normalizeRateFactor = (
  value: number | null | undefined,
  leagueAvg: number,
  clampMin = 0.9,
  clampMax = 1.1,
  invert = false
) => {
  if (value == null || !Number.isFinite(value) || leagueAvg <= 0) return 1
  const ratio = invert ? leagueAvg / value : value / leagueAvg
  return clamp(ratio, clampMin, clampMax)
}

const buildFootballEfficiencyFactor = (stats: FootballTeamStats, league: {
  ypp: number
  ppd: number
  thirdDown: number
  redZoneTd: number
  explosive: number
  sackRate: number
}) => {
  const yppFactor = normalizeRateFactor(stats.yardsPerPlay, league.ypp, 0.9, 1.1)
  const ppdFactor = normalizeRateFactor(stats.pointsPerDrive, league.ppd, 0.9, 1.1)
  const thirdDownFactor = normalizeRateFactor(
    stats.thirdDownConvPct != null ? stats.thirdDownConvPct / 100 : null,
    league.thirdDown,
    0.88,
    1.12
  )
  const redZoneFactor = normalizeRateFactor(
    stats.redZoneTouchdownPct != null ? stats.redZoneTouchdownPct / 100 : null,
    league.redZoneTd,
    0.88,
    1.12
  )
  const explosiveFactor = normalizeRateFactor(
    stats.explosivePlayRate,
    league.explosive,
    0.9,
    1.1
  )
  const sackFactor = normalizeRateFactor(
    stats.sackRate,
    league.sackRate,
    0.9,
    1.08,
    true
  )

  const combined =
    1 +
    (yppFactor - 1) * 0.35 +
    (ppdFactor - 1) * 0.35 +
    (thirdDownFactor - 1) * 0.2 +
    (redZoneFactor - 1) * 0.2 +
    (explosiveFactor - 1) * 0.2 +
    (sackFactor - 1) * 0.15

  return clamp(combined, 0.85, 1.15)
}

const buildFootballDefenseFactor = (stats: FootballTeamStats, league: {
  ppg: number
  ypp: number
}) => {
  const pointsAllowedFactor = normalizeRateFactor(
    stats.pointsAgainstPerGame,
    league.ppg,
    0.9,
    1.1,
    true
  )
  const yppAllowedFactor = normalizeRateFactor(
    stats.yardsAllowedPerPlay,
    league.ypp,
    0.9,
    1.08,
    true
  )
  const combined =
    1 +
    (pointsAllowedFactor - 1) * 0.6 +
    (yppAllowedFactor - 1) * 0.4
  return clamp(combined, 0.9, 1.1)
}

export function calculateFairSpreadFootball(
  homeTeamStats: FootballTeamStats,
  awayTeamStats: FootballTeamStats,
  opts?: {
    homeFieldAdvantage?: number
    leagueAvgPpg?: number
    leagueAvgYpp?: number
    leagueAvgPpd?: number
    leagueAvgPlays?: number
    leagueAvgThirdDown?: number
    leagueAvgRedZoneTd?: number
    leagueAvgExplosive?: number
    leagueAvgSackRate?: number
    matchupWeight?: number
    maxSpread?: number
    qbValueWeight?: number
  }
): number {
  const homeField = opts?.homeFieldAdvantage ?? NFL_HOME_FIELD_ADVANTAGE
  const leagueAvg = opts?.leagueAvgPpg ?? NFL_LEAGUE_AVG_PPG
  const leagueAvgYpp = opts?.leagueAvgYpp ?? NFL_LEAGUE_AVG_YPP
  const leagueAvgPpd = opts?.leagueAvgPpd ?? NFL_LEAGUE_AVG_PPD
  const leagueAvgPlays = opts?.leagueAvgPlays ?? NFL_LEAGUE_AVG_PLAYS
  const leagueAvgThirdDown = opts?.leagueAvgThirdDown ?? NFL_LEAGUE_AVG_THIRD_DOWN
  const leagueAvgRedZoneTd = opts?.leagueAvgRedZoneTd ?? NFL_LEAGUE_AVG_REDZONE_TD
  const leagueAvgExplosive = opts?.leagueAvgExplosive ?? NFL_LEAGUE_AVG_EXPLOSIVE
  const leagueAvgSackRate = opts?.leagueAvgSackRate ?? NFL_LEAGUE_AVG_SACK_RATE
  const matchupWeight = opts?.matchupWeight ?? 1
  const maxSpread = opts?.maxSpread ?? 17
  const qbValueWeight = opts?.qbValueWeight ?? 1

  const homeBase = (homeTeamStats.pointsForPerGame + awayTeamStats.pointsAgainstPerGame) / 2
  const awayBase = (awayTeamStats.pointsForPerGame + homeTeamStats.pointsAgainstPerGame) / 2

  const homeAdjusted = adjustByYpp(
    homeBase,
    homeTeamStats.yardsPerPlay,
    awayTeamStats.yardsAllowedPerPlay ?? awayTeamStats.yardsPerPlay,
    leagueAvgYpp
  )
  const awayAdjusted = adjustByYpp(
    awayBase,
    awayTeamStats.yardsPerPlay,
    homeTeamStats.yardsAllowedPerPlay ?? homeTeamStats.yardsPerPlay,
    leagueAvgYpp
  )

  const efficiencyLeague = {
    ypp: leagueAvgYpp,
    ppd: leagueAvgPpd,
    thirdDown: leagueAvgThirdDown,
    redZoneTd: leagueAvgRedZoneTd,
    explosive: leagueAvgExplosive,
    sackRate: leagueAvgSackRate,
  }
  const homeEfficiency = buildFootballEfficiencyFactor(homeTeamStats, efficiencyLeague)
  const awayEfficiency = buildFootballEfficiencyFactor(awayTeamStats, efficiencyLeague)
  const homeDefense = buildFootballDefenseFactor(awayTeamStats, {
    ppg: leagueAvg,
    ypp: leagueAvgYpp,
  })
  const awayDefense = buildFootballDefenseFactor(homeTeamStats, {
    ppg: leagueAvg,
    ypp: leagueAvgYpp,
  })

  const paceAvg =
    homeTeamStats.playsPerGame != null && awayTeamStats.playsPerGame != null
      ? (homeTeamStats.playsPerGame + awayTeamStats.playsPerGame) / 2
      : homeTeamStats.playsPerGame ?? awayTeamStats.playsPerGame ?? leagueAvgPlays
  const paceFactor = normalizeRateFactor(paceAvg, leagueAvgPlays, 0.9, 1.1)

  const homeEfficiencyAdj =
    1 + (homeEfficiency * homeDefense * paceFactor - 1) * matchupWeight
  const awayEfficiencyAdj =
    1 + (awayEfficiency * awayDefense * paceFactor - 1) * matchupWeight

  const homeTurnoverAdj = adjustByTurnovers(
    homeAdjusted * homeEfficiencyAdj,
    homeTeamStats.turnoverDifferential
  )
  const awayTurnoverAdj = adjustByTurnovers(
    awayAdjusted * awayEfficiencyAdj,
    awayTeamStats.turnoverDifferential
  )

  const homeExpected = clamp(homeTurnoverAdj, leagueAvg * 0.5, leagueAvg * 1.6)
  const awayExpected = clamp(awayTurnoverAdj, leagueAvg * 0.5, leagueAvg * 1.6)

  const qbAdj =
    ((homeTeamStats.qbValue ?? 0) - (awayTeamStats.qbValue ?? 0)) * qbValueWeight

  const margin = homeExpected - awayExpected + homeField + qbAdj
  return clamp(margin, -maxSpread, maxSpread)
}

export function calculateFairTotalFootball(
  homeTeamStats: FootballTeamStats,
  awayTeamStats: FootballTeamStats,
  opts?: {
    leagueAvgPpg?: number
    leagueAvgYpp?: number
    leagueAvgPpd?: number
    leagueAvgPlays?: number
    leagueAvgThirdDown?: number
    leagueAvgRedZoneTd?: number
    leagueAvgExplosive?: number
    leagueAvgSackRate?: number
    totalMatchupWeight?: number
  }
): number {
  const leagueAvg = opts?.leagueAvgPpg ?? NFL_LEAGUE_AVG_PPG
  const leagueAvgYpp = opts?.leagueAvgYpp ?? NFL_LEAGUE_AVG_YPP
  const leagueAvgPpd = opts?.leagueAvgPpd ?? NFL_LEAGUE_AVG_PPD
  const leagueAvgPlays = opts?.leagueAvgPlays ?? NFL_LEAGUE_AVG_PLAYS
  const leagueAvgThirdDown = opts?.leagueAvgThirdDown ?? NFL_LEAGUE_AVG_THIRD_DOWN
  const leagueAvgRedZoneTd = opts?.leagueAvgRedZoneTd ?? NFL_LEAGUE_AVG_REDZONE_TD
  const leagueAvgExplosive = opts?.leagueAvgExplosive ?? NFL_LEAGUE_AVG_EXPLOSIVE
  const leagueAvgSackRate = opts?.leagueAvgSackRate ?? NFL_LEAGUE_AVG_SACK_RATE
  const totalMatchupWeight = opts?.totalMatchupWeight ?? 1

  const homeBase = (homeTeamStats.pointsForPerGame + awayTeamStats.pointsAgainstPerGame) / 2
  const awayBase = (awayTeamStats.pointsForPerGame + homeTeamStats.pointsAgainstPerGame) / 2

  const homeAdjusted = adjustByYpp(
    homeBase,
    homeTeamStats.yardsPerPlay,
    awayTeamStats.yardsAllowedPerPlay ?? awayTeamStats.yardsPerPlay,
    leagueAvgYpp
  )
  const awayAdjusted = adjustByYpp(
    awayBase,
    awayTeamStats.yardsPerPlay,
    homeTeamStats.yardsAllowedPerPlay ?? homeTeamStats.yardsPerPlay,
    leagueAvgYpp
  )

  const efficiencyLeague = {
    ypp: leagueAvgYpp,
    ppd: leagueAvgPpd,
    thirdDown: leagueAvgThirdDown,
    redZoneTd: leagueAvgRedZoneTd,
    explosive: leagueAvgExplosive,
    sackRate: leagueAvgSackRate,
  }
  const homeEfficiency = buildFootballEfficiencyFactor(homeTeamStats, efficiencyLeague)
  const awayEfficiency = buildFootballEfficiencyFactor(awayTeamStats, efficiencyLeague)
  const homeDefense = buildFootballDefenseFactor(awayTeamStats, {
    ppg: leagueAvg,
    ypp: leagueAvgYpp,
  })
  const awayDefense = buildFootballDefenseFactor(homeTeamStats, {
    ppg: leagueAvg,
    ypp: leagueAvgYpp,
  })

  const paceAvg =
    homeTeamStats.playsPerGame != null && awayTeamStats.playsPerGame != null
      ? (homeTeamStats.playsPerGame + awayTeamStats.playsPerGame) / 2
      : homeTeamStats.playsPerGame ?? awayTeamStats.playsPerGame ?? leagueAvgPlays
  const paceFactor = normalizeRateFactor(paceAvg, leagueAvgPlays, 0.9, 1.1)

  const homeEfficiencyAdj =
    1 + (homeEfficiency * homeDefense - 1) * totalMatchupWeight
  const awayEfficiencyAdj =
    1 + (awayEfficiency * awayDefense - 1) * totalMatchupWeight

  const total =
    (homeAdjusted * homeEfficiencyAdj + awayAdjusted * awayEfficiencyAdj) *
    paceFactor

  return clamp(total, leagueAvg * 1.3, leagueAvg * 2.6)
}

export function calculateFairSpreadHockey(
  homeTeamStats: HockeyTeamStats,
  awayTeamStats: HockeyTeamStats,
  opts?: { homeIceAdvantage?: number; leagueAvgGpg?: number }
): number {
  const homeIce = opts?.homeIceAdvantage ?? NHL_HOME_ICE_ADVANTAGE
  const leagueAvg = opts?.leagueAvgGpg ?? NHL_LEAGUE_AVG_GPG

  const homeBase = (homeTeamStats.goalsForPerGame + awayTeamStats.goalsAgainstPerGame) / 2
  const awayBase = (awayTeamStats.goalsForPerGame + homeTeamStats.goalsAgainstPerGame) / 2

  const homeExpected = clamp(homeBase, leagueAvg * 0.6, leagueAvg * 1.5) + homeIce
  const awayExpected = clamp(awayBase, leagueAvg * 0.6, leagueAvg * 1.5)

  return homeExpected - awayExpected
}

export function calculateFairTotalHockey(
  homeTeamStats: HockeyTeamStats,
  awayTeamStats: HockeyTeamStats,
  opts?: { leagueAvgGpg?: number }
): number {
  const leagueAvg = opts?.leagueAvgGpg ?? NHL_LEAGUE_AVG_GPG
  const homeBase = (homeTeamStats.goalsForPerGame + awayTeamStats.goalsAgainstPerGame) / 2
  const awayBase = (awayTeamStats.goalsForPerGame + homeTeamStats.goalsAgainstPerGame) / 2
  return clamp(homeBase + awayBase, leagueAvg * 1.4, leagueAvg * 2.6)
}

export const NCAAB_LEAGUE_CONTEXT: LeagueContext = {
  homeCourtAdvantage: NCAAB_HOME_COURT_ADVANTAGE,
  leagueAvgOrtg: NCAAB_LEAGUE_AVG_ORTG,
  leagueAvgPace: NCAAB_LEAGUE_AVG_PACE,
  paceBase: 100,
}

/**
 * Calculate fair player prop line
 */
export function calculateFairPropLine(
  playerStats: PlayerStats,
  opponentDefense?: OpponentDefense,
  restFactor?: RestFactors
): number {
  // Start with season average
  let fairLine = playerStats.seasonAverage

  // Adjust for opponent defense
  if (opponentDefense) {
    // If opponent allows more than league average, boost the line
    const leagueAvg = playerStats.seasonAverage // assume player is at league avg for their production
    const defenseAdjustment = (opponentDefense.allowedStatPerGame - leagueAvg) * 0.7 // 70% weight to matchup
    fairLine += defenseAdjustment
  }

  // Adjust for rest (fatigue)
  if (restFactor?.isBackToBack) {
    fairLine *= 0.92 // 8% reduction on back-to-back
  }

  // Adjust for usage if significantly high or low
  if (playerStats.usage) {
    if (playerStats.usage > 30) {
      fairLine *= 1.05 // 5% boost for high usage players
    } else if (playerStats.usage < 20) {
      fairLine *= 0.95 // 5% penalty for low usage
    }
  }

  return fairLine
}

/**
 * Calculate edge between fair line and market line
 */
export interface EdgeResult {
  edge: number // difference in points/units (positive = value for bettor)
  edgePercentage: number // edge as % of line
  hasValue: boolean // true if edge >= threshold
  recommendation: string
}

export function identifyEdge(
  fairLine: number,
  marketLine: number,
  betType: 'spread' | 'total' | 'prop',
  direction?: 'over' | 'under' | 'home' | 'away',
  edgeThreshold: number = 0.5 // minimum edge in points to recommend
): EdgeResult {
  let edge = 0
  let recommendation = ''

  if (betType === 'spread') {
    // For spreads: negative = favorite, positive = underdog
    // Fair line: -5.0, Market: -7.0 → edge = 2.0 (value on favorite)
    // Fair line: -7.0, Market: -5.0 → edge = -2.0 (no value on favorite, but value on dog)
    edge = marketLine - fairLine

    if (Math.abs(edge) >= edgeThreshold) {
      if (edge > 0) {
        // Favorite is undervalued
        recommendation = `Bet favorite at ${marketLine} or better (fair: ${fairLine.toFixed(1)})`
      } else {
        // Dog is undervalued
        recommendation = `Bet underdog at +${Math.abs(marketLine)} or better (fair: +${Math.abs(fairLine).toFixed(1)})`
      }
    } else {
      recommendation = 'No significant edge - pass or wait for better number'
    }
  } else if (betType === 'total') {
    // For totals: compare fair to market
    // Fair: 220, Market: 215 → over is value (edge = 5)
    // Fair: 215, Market: 220 → under is value (edge = 5)
    edge = Math.abs(fairLine - marketLine)

    if (edge >= edgeThreshold) {
      if (fairLine > marketLine) {
        recommendation = `Bet OVER ${marketLine} (fair: ${fairLine.toFixed(1)})`
      } else {
        recommendation = `Bet UNDER ${marketLine} (fair: ${fairLine.toFixed(1)})`
      }
    } else {
      recommendation = 'No significant edge on total - pass'
    }
  } else if (betType === 'prop') {
    // For props: similar to totals
    edge = Math.abs(fairLine - marketLine)

    if (edge >= edgeThreshold) {
      if (fairLine > marketLine) {
        recommendation = `Bet OVER ${marketLine} (fair: ${fairLine.toFixed(1)})`
      } else {
        recommendation = `Bet UNDER ${marketLine} (fair: ${fairLine.toFixed(1)})`
      }
    } else {
      recommendation = 'No significant edge on this prop - pass'
    }
  }

  const edgePercentage = marketLine !== 0 ? (edge / Math.abs(marketLine)) * 100 : 0

  return {
    edge,
    edgePercentage,
    hasValue: Math.abs(edge) >= edgeThreshold,
    recommendation,
  }
}

/**
 * Convert American odds to fair value probability
 * Then compare to our calculated probability for EV
 */
export function calculateExpectedValueFromOdds(
  ourProbability: number,
  marketOdds: number
): number {
  const marketProbability = oddsToImpliedProbability(marketOdds)
  const edge = ourProbability - marketProbability

  // Expected value as percentage
  // Positive EV = we have edge, negative EV = book has edge
  return edge * 100
}
