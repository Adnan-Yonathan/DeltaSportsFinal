/**
 * Pre-Game Value Calculator
 * Calculates "fair" lines for spreads, totals, and props before games start
 */

import { oddsToImpliedProbability } from '@/lib/utils/statistics'

// NBA constants
const NBA_HOME_COURT_ADVANTAGE = 3.0 // points
const NBA_LEAGUE_AVG_ORTG = 115.0 // average offensive rating
const NBA_LEAGUE_AVG_PACE = 100.0 // average possessions per 48 min
const BACK_TO_BACK_PENALTY = 2.5 // points
const TRAVEL_PENALTY_PER_1000_MILES = 0.3 // points
const TIMEZONE_PENALTY_PER_HOUR = 0.5 // points
const ALTITUDE_BONUS_PER_1000_FT = 0.4 // points for home team at altitude

export interface TeamStats {
  ortg: number // offensive rating
  drtg: number // defensive rating
  pace: number // possessions per 48 min
  eFG?: number // effective field goal %
  ts?: number // true shooting %
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
}

export interface OpponentDefense {
  allowedStatPerGame: number // how much opponent allows this stat
  defensiveRating?: number
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
  awayTravel?: TravelFactors
): number {
  // Step 1: Calculate expected scores using Four Factors approach
  // Home team expected score = their ORtg * (opponent DRtg / league avg DRtg) * pace factor
  const homePaceFactor = (homeTeamStats.pace + awayTeamStats.pace) / (2 * NBA_LEAGUE_AVG_PACE)

  const homeExpectedScore =
    homeTeamStats.ortg * (awayTeamStats.drtg / NBA_LEAGUE_AVG_ORTG) * homePaceFactor

  const awayExpectedScore =
    awayTeamStats.ortg * (homeTeamStats.drtg / NBA_LEAGUE_AVG_ORTG) * homePaceFactor

  // Step 2: Start with base differential
  let fairSpread = homeExpectedScore - awayExpectedScore

  // Step 3: Add home court advantage
  fairSpread += NBA_HOME_COURT_ADVANTAGE

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

  return fairSpread
}

/**
 * Calculate fair total for a matchup
 */
export function calculateFairTotal(
  homeTeamStats: TeamStats,
  awayTeamStats: TeamStats
): number {
  // Pace-adjusted scoring projection
  const combinedPace = (homeTeamStats.pace + awayTeamStats.pace) / 2
  const paceFactor = combinedPace / NBA_LEAGUE_AVG_PACE

  // Home team expected score
  const homeExpectedScore =
    homeTeamStats.ortg * (awayTeamStats.drtg / NBA_LEAGUE_AVG_ORTG) * paceFactor

  // Away team expected score
  const awayExpectedScore =
    awayTeamStats.ortg * (homeTeamStats.drtg / NBA_LEAGUE_AVG_ORTG) * paceFactor

  // Fair total is the sum
  const fairTotal = homeExpectedScore + awayExpectedScore

  return fairTotal
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
