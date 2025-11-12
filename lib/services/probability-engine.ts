import { normalCDF, calculateZScore, oddsToImpliedProbability } from '@/lib/utils/statistics'

/**
 * Sport-specific scoring rates (points per minute)
 * Based on historical averages
 */
const SPORT_SCORING_RATES: { [key: string]: number } = {
  'basketball_nba': 2.0,        // ~240 total points in 48 minutes
  'basketball_ncaab': 1.75,     // ~140 total points in 40 minutes
  'americanfootball_nfl': 0.75, // ~45 total points in 60 minutes
  'americanfootball_ncaaf': 0.9, // ~54 total points in 60 minutes
  'icehockey_nhl': 0.1,         // ~6 total points in 60 minutes
  'baseball_mlb': 0.33,         // ~9 total points in 27 outs (approximated to 27 "minutes")
}

/**
 * Sport-specific game lengths (in minutes)
 */
const SPORT_GAME_LENGTHS: { [key: string]: number } = {
  'basketball_nba': 48,
  'basketball_ncaab': 40,
  'americanfootball_nfl': 60,
  'americanfootball_ncaaf': 60,
  'icehockey_nhl': 60,
  'baseball_mlb': 27, // Using innings/outs as approximation
}

/**
 * Get sport-specific scoring rate
 */
function getSportScoringRate(sport: string): number {
  return SPORT_SCORING_RATES[sport] || 1.0
}

/**
 * Get sport-specific game length
 */
function getSportGameLength(sport: string): number {
  return SPORT_GAME_LENGTHS[sport] || 60
}

/**
 * Calculate win probability for a spread bet
 *
 * @param currentMargin - Current score differential (positive = favorite winning)
 * @param spread - The bet spread (negative for favorite)
 * @param timeRemaining - Time remaining in seconds
 * @param sport - Sport identifier
 * @param currentScore - Current total score for variance calculation
 * @returns Win probability (0-1)
 */
export function calculateSpreadProbability(
  teamMargin: number,
  spread: number,
  timeRemaining: number,
  sport: string,
  currentScore: number = 100,
  odds?: number
): number {
  const gameLengthMinutes = getSportGameLength(sport)
  const minutesRemaining = Math.max(timeRemaining / 60, 0)
  const timeRatio = Math.min(1, minutesRemaining / gameLengthMinutes)
  const differential = teamMargin + spread

  const baseVolatility = SPORT_SPREAD_VOLATILITY[sport] || 6
  const volatility = Math.max(0.75, baseVolatility * Math.sqrt(timeRatio + 0.05))

  const liveProbability = normalCDF(differential / volatility)
  const impliedProbability = odds !== undefined ? oddsToImpliedProbability(odds) : 0.5

  // Heavier weight to live data as time winds down
  const liveWeight = Math.min(0.9, 1 - timeRatio * 0.8)
  const blended = liveProbability * liveWeight + impliedProbability * (1 - liveWeight)

  return clampProbability(blended)
}

/**
 * Calculate win probability for a total (over/under) bet
 *
 * @param currentTotal - Current combined score
 * @param line - The total line
 * @param direction - 'over' or 'under'
 * @param timeRemaining - Time remaining in seconds
 * @param sport - Sport identifier
 * @param gameTimeElapsed - Time elapsed in seconds
 * @returns Win probability (0-1)
 */
export function calculateTotalProbability(
  currentTotal: number,
  line: number,
  direction: 'over' | 'under',
  timeRemaining: number,
  sport: string,
  gameTimeElapsed: number,
  odds?: number
): number {
  const pointsPerMinute = getSportScoringRate(sport)
  const gameLength = getSportGameLength(sport)

  // Calculate current pace
  const minutesElapsed = gameTimeElapsed / 60
  const currentPace = minutesElapsed > 0 ? currentTotal / minutesElapsed : pointsPerMinute

  // Project final total based on current pace
  const minutesRemaining = timeRemaining / 60
  const projectedRemainingPoints = minutesRemaining * currentPace
  const projectedFinalTotal = currentTotal + projectedRemainingPoints

  // Calculate standard deviation based on time remaining
  // More time = more variance
  const varianceFactor = Math.sqrt(minutesRemaining * pointsPerMinute)
  const standardDeviation = Math.max(1, varianceFactor * 2.5) // Tuning factor

  // Avoid division by zero
  if (standardDeviation === 0) {
    const isOver = projectedFinalTotal > line
    return direction === 'over' ? (isOver ? 1.0 : 0.0) : (isOver ? 0.0 : 1.0)
  }

  // Calculate z-score
  const differential = projectedFinalTotal - line
  const zScore = differential / standardDeviation

  // Convert to probability
  const overProbability = normalCDF(zScore)
  const impliedProbability = odds !== undefined ? oddsToImpliedProbability(odds) : 0.5
  const liveWeight = Math.min(0.9, 1 - Math.min(1, minutesRemaining / gameLength))
  const prob = direction === 'over' ? overProbability : 1 - overProbability
  return clampProbability(prob * liveWeight + impliedProbability * (1 - liveWeight))
}

/**
 * Calculate win probability for a moneyline bet
 *
 * @param currentMargin - Current score differential (positive = team winning)
 * @param timeRemaining - Time remaining in seconds
 * @param sport - Sport identifier
 * @param odds - American odds for context (optional)
 * @returns Win probability (0-1)
 */
export function calculateMoneylineProbability(
  teamMargin: number,
  timeRemaining: number,
  sport: string,
  odds?: number
): number {
  const gameLength = getSportGameLength(sport)
  const minutesRemaining = Math.max(timeRemaining / 60, 0)
  const timeRatio = Math.min(1, minutesRemaining / gameLength)
  const baseVolatility = SPORT_SPREAD_VOLATILITY[sport] || 6
  const volatility = Math.max(0.5, baseVolatility * Math.sqrt(timeRatio + 0.02))
  const liveProbability = normalCDF(teamMargin / volatility)
  const impliedProbability = odds !== undefined ? oddsToImpliedProbability(odds) : 0.5
  const liveWeight = Math.min(0.95, 1 - timeRatio * 0.7)
  return clampProbability(liveProbability * liveWeight + impliedProbability * (1 - liveWeight))
}

/**
 * Calculate win probability for a player prop bet
 *
 * @param currentStat - Player's current stat value
 * @param line - The prop line
 * @param direction - 'over' or 'under'
 * @param playerMinutesPlayed - Minutes player has been on court/field
 * @param playerProjectedMinutes - Expected total minutes
 * @param seasonAverage - Player's season average for this stat
 * @returns Win probability (0-1)
 */
export function calculatePlayerPropProbability(
  currentStat: number,
  line: number,
  direction: 'over' | 'under',
  playerMinutesPlayed: number,
  playerProjectedMinutes: number,
  seasonAverage: number
): number {
  // Calculate player's pace this game
  const paceThisGame = playerMinutesPlayed > 0 ? currentStat / playerMinutesPlayed : 0

  // Project remaining production
  const minutesRemaining = Math.max(0, playerProjectedMinutes - playerMinutesPlayed)
  const projectedRemaining = paceThisGame * minutesRemaining
  const projectedFinal = currentStat + projectedRemaining

  // Calculate variance based on season average and current pace
  // Players with higher stats tend to have higher variance
  const baseVariance = seasonAverage * 0.3
  const paceVariance = Math.abs(paceThisGame - (seasonAverage / 32)) * minutesRemaining

  const totalVariance = baseVariance + paceVariance
  const standardDeviation = Math.sqrt(totalVariance)

  // Avoid division by zero
  if (standardDeviation === 0) {
    const isOver = projectedFinal > line
    return direction === 'over' ? (isOver ? 1.0 : 0.0) : (isOver ? 0.0 : 1.0)
  }

  // Calculate z-score
  const differential = projectedFinal - line
  const zScore = differential / standardDeviation

  // Convert to probability
  const overProbability = normalCDF(zScore)

  return direction === 'over' ? overProbability : 1 - overProbability
}

/**
 * Calculate comprehensive bet probability with metadata
 * This is the main function that routes to specific calculators
 */
export interface BetProbabilityInput {
  betType: 'spread' | 'total' | 'moneyline' | 'prop'
  sport: string

  // Game state
  currentScore?: { away: number; home: number }
  timeRemaining?: number // in seconds
  timeElapsed?: number // in seconds
  teamSide?: 'home' | 'away'

  // Bet details
  spread?: number
  totalLine?: number
  direction?: 'over' | 'under'
  odds?: number

  // Player prop specific
  playerCurrentStat?: number
  playerMinutesPlayed?: number
  playerProjectedMinutes?: number
  playerSeasonAverage?: number
}

export interface BetProbabilityOutput {
  probability: number
  confidence: 'low' | 'medium' | 'high'
  factors: {
    currentState: string
    projection: string
    variance: string
  }
  recommendation?: string
}

export function calculateBetProbability(input: BetProbabilityInput): BetProbabilityOutput {
  let probability = 0.5
  let confidence: 'low' | 'medium' | 'high' = 'medium'
  const factors = {
    currentState: '',
    projection: '',
    variance: ''
  }

  const getTeamMargin = (): number => {
    if (!input.currentScore) return 0
    const margin = input.currentScore.home - input.currentScore.away
    if (input.teamSide === 'away') {
      return -margin
    }
    return margin
  }

  try {
    switch (input.betType) {
      case 'spread':
        if (input.currentScore && input.spread !== undefined && input.timeRemaining !== undefined) {
          const currentMargin = getTeamMargin()
          const totalScore = input.currentScore.home + input.currentScore.away
          probability = calculateSpreadProbability(
            currentMargin,
            input.spread,
            input.timeRemaining,
            input.sport,
            totalScore,
            input.odds
          )
          const coveringMargin = Number((currentMargin + input.spread).toFixed(1))
          factors.currentState = coveringMargin >= 0
            ? `Currently covering by ${Math.abs(coveringMargin)}`
            : `Outside the cover by ${Math.abs(coveringMargin)}`
          if (input.spread < 0) {
            factors.projection = `Need to win by more than ${Math.abs(input.spread)} point(s)`
          } else {
            factors.projection = `Can lose by up to ${input.spread} point(s)`
          }
          confidence = input.timeRemaining < 600 ? 'high' : input.timeRemaining < 1800 ? 'medium' : 'low'
        }
        break

      case 'total':
        if (input.currentScore && input.totalLine !== undefined && input.timeRemaining !== undefined && input.timeElapsed !== undefined && input.direction) {
          const currentTotal = input.currentScore.home + input.currentScore.away
          const minutesElapsed = input.timeElapsed / 60
          const pacePerMinute = minutesElapsed > 0 ? currentTotal / Math.max(minutesElapsed, 0.5) : getSportScoringRate(input.sport)
          const projectedFinal = currentTotal + pacePerMinute * (input.timeRemaining / 60)
          probability = calculateTotalProbability(
            currentTotal,
            input.totalLine,
            input.direction,
            input.timeRemaining,
            input.sport,
            input.timeElapsed,
            input.odds
          )
          factors.currentState = `Current total: ${currentTotal}`
          factors.projection = `Projected final: ${projectedFinal.toFixed(1)} (pace ${pacePerMinute.toFixed(1)} pts/min)`
          confidence = input.timeRemaining < 600 ? 'high' : input.timeRemaining < 1800 ? 'medium' : 'low'
        }
        break

      case 'moneyline':
        if (input.currentScore && input.timeRemaining !== undefined) {
          const currentMargin = getTeamMargin()
          probability = calculateMoneylineProbability(
            currentMargin,
            input.timeRemaining,
            input.sport,
            input.odds
          )
          factors.currentState = `${currentMargin > 0 ? 'Winning' : 'Losing'} by ${Math.abs(currentMargin)}`
          factors.projection = `Based on current pace and time remaining`
          confidence = input.timeRemaining < 300 ? 'high' : input.timeRemaining < 1200 ? 'medium' : 'low'
        }
        break

      case 'prop':
        if (
          input.playerCurrentStat !== undefined &&
          input.totalLine !== undefined &&
          input.playerMinutesPlayed !== undefined &&
          input.playerProjectedMinutes !== undefined &&
          input.playerSeasonAverage !== undefined &&
          input.direction
        ) {
          probability = calculatePlayerPropProbability(
            input.playerCurrentStat,
            input.totalLine,
            input.direction,
            input.playerMinutesPlayed,
            input.playerProjectedMinutes,
            input.playerSeasonAverage
          )
          const pace = input.playerMinutesPlayed > 0 ? input.playerCurrentStat / input.playerMinutesPlayed : 0
          const projected = input.playerCurrentStat + (pace * (input.playerProjectedMinutes - input.playerMinutesPlayed))
          factors.currentState = `Current: ${input.playerCurrentStat} in ${input.playerMinutesPlayed.toFixed(0)} min`
          factors.projection = `Projected: ${projected.toFixed(1)} (pace: ${(pace * 32).toFixed(1)}/game)`
          confidence = input.playerMinutesPlayed > 20 ? 'high' : input.playerMinutesPlayed > 10 ? 'medium' : 'low'
        }
        break
    }

    // Variance factor based on probability
    if (probability > 0.8 || probability < 0.2) {
      factors.variance = 'Low variance - outcome likely determined'
    } else if (probability > 0.6 || probability < 0.4) {
      factors.variance = 'Medium variance - outcome leaning one way'
    } else {
      factors.variance = 'High variance - outcome still uncertain'
    }

    // Generate recommendation
    let recommendation: string | undefined
    if (confidence === 'high') {
      if (probability > 0.75) {
        recommendation = 'Strong position - likely to hit'
      } else if (probability < 0.25) {
        recommendation = 'Weak position - unlikely to hit'
      } else {
        recommendation = 'Toss-up - could go either way'
      }
    }

    return {
      probability,
      confidence,
      factors,
      recommendation
    }
  } catch (error) {
    console.error('Error calculating bet probability:', error)
    return {
      probability: 0.5,
      confidence: 'low',
      factors: {
        currentState: 'Unable to calculate',
        projection: 'Insufficient data',
        variance: 'Unknown'
      }
    }
  }
}
const SPORT_SPREAD_VOLATILITY: { [key: string]: number } = {
  'basketball_nba': 7,
  'basketball_ncaab': 6,
  'americanfootball_nfl': 10,
  'americanfootball_ncaaf': 12,
  'icehockey_nhl': 2,
  'baseball_mlb': 3,
}

function clampProbability(value: number) {
  if (Number.isNaN(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}
