/**
 * Live Line Calculator
 * Generates fair spread/total lines with statistical confidence intervals for live games
 * Max interval range: ±0.5 points (1.0 total range)
 */

import type { LiveGameState } from './live-game-analyzer'
import type { TeamStats } from './pregame-value-calculator'
import { calculateSpreadProbability, calculateTotalProbability } from './probability-engine'

// ============================================================================
// INTERFACES
// ============================================================================

export interface LiveLineRecommendation {
  type: 'spread' | 'total'
  fairLine: number // Single best estimate
  confidenceInterval: {
    lower: number // max 0.5 below fair
    upper: number // max 0.5 above fair
    range: number // upper - lower (max 1.0)
  }
  winProbability: {
    home: number
    away: number
  }
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  recommendation: string
}

// Sport-specific volatility (points)
const SPORT_VOLATILITY: Record<string, number> = {
  nba: 7,
  ncaab: 6,
  nfl: 10,
  ncaaf: 12,
  nhl: 2,
  mlb: 3,
}

const NBA_HOME_COURT_ADVANTAGE = 3.0

// ============================================================================
// LIVE SPREAD CALCULATION
// ============================================================================

export function calculateLiveSpread(
  liveGame: LiveGameState,
  pregameStats: { homeStats: TeamStats; awayStats: TeamStats }
): LiveLineRecommendation {
  const { homeScore, awayScore, timeRemaining, timeElapsed, sport, momentum } = liveGame

  // Step 1: Current margin
  const currentMargin = homeScore - awayScore

  // Step 2: Project final margin based on current pace and remaining time
  const remainingMinutes = timeRemaining / 60
  const elapsedMinutes = timeElapsed / 60
  const totalMinutes = (timeRemaining + timeElapsed) / 60

  // Expected points remaining for each team
  const homePointsPerMinute = elapsedMinutes > 0 ? homeScore / elapsedMinutes : 0
  const awayPointsPerMinute = elapsedMinutes > 0 ? awayScore / elapsedMinutes : 0

  let projectedHomeRemaining = homePointsPerMinute * remainingMinutes
  let projectedAwayRemaining = awayPointsPerMinute * remainingMinutes

  // Apply pace adjustment
  if (momentum.paceChange.deviation !== 0) {
    const paceMultiplier = momentum.paceChange.currentPace / momentum.paceChange.seasonPace
    projectedHomeRemaining *= paceMultiplier
    projectedAwayRemaining *= paceMultiplier
  }

  const projectedFinalHome = homeScore + projectedHomeRemaining
  const projectedFinalAway = awayScore + projectedAwayRemaining

  let fairLine = projectedFinalHome - projectedFinalAway

  // Step 3: Add scaled home court advantage
  // Full 3.0 points at tipoff, 0.0 points at buzzer
  const timeRemainPct = timeRemaining / (timeRemaining + timeElapsed)
  const homeCourtAdj = NBA_HOME_COURT_ADVANTAGE * timeRemainPct
  fairLine += homeCourtAdj

  // Step 4: Apply momentum adjustments
  const factors: string[] = []

  // Scoring run adjustment
  if (momentum.scoringRun.currentRun) {
    const runPoints = momentum.scoringRun.currentRun.points
    const runTeam = momentum.scoringRun.currentRun.team

    if (runPoints >= 8) {
      const adjustment = runPoints >= 12 ? 0.5 : 0.3
      fairLine += runTeam === 'home' ? adjustment : -adjustment
      const teamName = runTeam === 'home' ? liveGame.homeTeam : liveGame.awayTeam
      factors.push(
        `${teamName} on ${runPoints}-0 run (${momentum.scoringRun.currentRun.duration})`
      )
    }
  }

  // Foul trouble adjustment
  const foulAdj = momentum.foulTrouble.totalImpact
  if (Math.abs(foulAdj.homeAdjustment) > 0.5 || Math.abs(foulAdj.awayAdjustment) > 0.5) {
    fairLine += foulAdj.homeAdjustment - foulAdj.awayAdjustment

    if (momentum.foulTrouble.homePlayers.length > 0) {
      for (const player of momentum.foulTrouble.homePlayers) {
        factors.push(
          `⚠️ ${player.name}: ${player.fouls} fouls (impact: ${player.impactOnSpread.toFixed(1)} pts)`
        )
      }
    }

    if (momentum.foulTrouble.awayPlayers.length > 0) {
      for (const player of momentum.foulTrouble.awayPlayers) {
        factors.push(
          `⚠️ ${player.name}: ${player.fouls} fouls (impact: ${player.impactOnSpread.toFixed(1)} pts)`
        )
      }
    }
  }

  // Pace adjustment
  if (Math.abs(momentum.paceChange.deviation) > 3) {
    const paceDirection = momentum.paceChange.deviation > 0 ? 'faster' : 'slower'
    const paceImpact = Math.abs(momentum.paceChange.deviation / momentum.paceChange.seasonPace)
    factors.push(
      `Pace ${(paceImpact * 100).toFixed(0)}% ${paceDirection} than season average (${momentum.paceChange.currentPace.toFixed(1)} vs ${momentum.paceChange.seasonPace.toFixed(1)})`
    )
  }

  // Comeback probability
  if (momentum.comebackProbability.currentDeficit > 5) {
    const trailingTeam = homeScore < awayScore ? 'home' : 'away'
    const trailingTeamName = trailingTeam === 'home' ? liveGame.homeTeam : liveGame.awayTeam
    factors.push(
      `${trailingTeamName} comeback probability from -${momentum.comebackProbability.currentDeficit}: ${(momentum.comebackProbability.historicalComebackRate * 100).toFixed(0)}%`
    )
  }

  // Fatigue adjustment
  if (momentum.fatigue) {
    fairLine += momentum.fatigue.lineAdjustment
    factors.push(...momentum.fatigue.factors)
  }

  // Timeout impact adjustment
  if (momentum.timeoutImpact) {
    fairLine += momentum.timeoutImpact.lineAdjustment
    factors.push(...momentum.timeoutImpact.factors)
  }

  // Three-point variance adjustment (for spread)
  if (momentum.threePointVariance) {
    const spreadAdjustment =
      momentum.threePointVariance.expectedRegression.homePtsAdjustment -
      momentum.threePointVariance.expectedRegression.awayPtsAdjustment
    fairLine += spreadAdjustment
    factors.push(...momentum.threePointVariance.factors)
  }

  // Garbage time check
  if (momentum.garbageTime?.isGarbageTime) {
    factors.push(`⚠️ GARBAGE TIME: ${momentum.garbageTime.reason}`)
  }

  // Step 5: Calculate confidence interval
  const volatility = SPORT_VOLATILITY[sport] || 7
  const timeRemainingFraction = timeRemaining / (timeRemaining + timeElapsed)
  const baseVariance = volatility * Math.sqrt(timeRemainingFraction)

  // Cap at ±0.5 points (user requirement)
  const halfRange = Math.min(baseVariance / 2, 0.5)

  const confidenceInterval = {
    lower: fairLine - halfRange,
    upper: fairLine + halfRange,
    range: halfRange * 2,
  }

  // Step 6: Calculate win probability
  const spreadProb = calculateSpreadProbability(
    currentMargin,
    fairLine,
    timeRemaining,
    sport,
    homeScore + awayScore
  )

  const winProbability = {
    home: spreadProb,
    away: 1 - spreadProb,
  }

  // Step 7: Determine confidence level
  let confidence: 'low' | 'medium' | 'high' = 'medium'

  // Garbage time reduces confidence
  if (momentum.garbageTime?.isGarbageTime) {
    confidence = 'low'
  } else if (remainingMinutes < 5 || Math.abs(currentMargin) > 15) {
    confidence = 'high'
  } else if (remainingMinutes > 15) {
    confidence = 'low'
  }

  // Step 8: Generate recommendation
  const favoredTeam = fairLine > 0 ? liveGame.homeTeam : liveGame.awayTeam
  const spreadValue = Math.abs(fairLine)

  let recommendation = ''

  if (momentum.garbageTime?.isGarbageTime) {
    recommendation = `Avoid betting - garbage time detected. Projections unreliable.`
  } else if (momentum.foulingStrategy?.isFouling) {
    recommendation = `Intentional fouling detected. Total bets more reliable than spread in this situation.`
  } else {
    recommendation =
      confidence === 'high'
        ? `${favoredTeam} -${spreadValue.toFixed(1)} is fair. High confidence - game mostly decided.`
        : confidence === 'medium'
          ? `${favoredTeam} -${spreadValue.toFixed(1)} is fair. If you can get ${favoredTeam} -${(spreadValue - 0.5).toFixed(1)} or better, that's value.`
          : `${favoredTeam} -${spreadValue.toFixed(1)} is fair, but lots of time left. Consider waiting.`
  }

  return {
    type: 'spread',
    fairLine,
    confidenceInterval,
    winProbability,
    confidence,
    factors,
    recommendation,
  }
}

// ============================================================================
// LIVE TOTAL CALCULATION
// ============================================================================

export function calculateLiveTotal(
  liveGame: LiveGameState,
  pregameStats: { homeStats: TeamStats; awayStats: TeamStats }
): LiveLineRecommendation {
  const { homeScore, awayScore, timeRemaining, timeElapsed, sport, momentum } = liveGame

  // Step 1: Current total
  const currentTotal = homeScore + awayScore

  // Step 2: Project final total based on current pace
  const remainingMinutes = timeRemaining / 60
  const elapsedMinutes = timeElapsed / 60

  const pointsPerMinute = elapsedMinutes > 0 ? currentTotal / elapsedMinutes : 0

  let projectedRemaining = pointsPerMinute * remainingMinutes

  // Apply pace adjustment
  if (momentum.paceChange.deviation !== 0) {
    const paceMultiplier = momentum.paceChange.currentPace / momentum.paceChange.seasonPace
    projectedRemaining *= paceMultiplier
  }

  let fairLine = currentTotal + projectedRemaining

  // Step 3: Apply momentum adjustments
  const factors: string[] = []

  // Pace impact on total
  if (Math.abs(momentum.paceChange.deviation) > 3) {
    const paceDirection = momentum.paceChange.deviation > 0 ? 'faster' : 'slower'
    const paceImpact = Math.abs(momentum.paceChange.impactOnTotal)

    fairLine += momentum.paceChange.deviation > 0 ? paceImpact : -paceImpact

    factors.push(
      `Pace ${paceDirection}: ${momentum.paceChange.currentPace.toFixed(1)} vs ${momentum.paceChange.seasonPace.toFixed(1)} (impact: ${paceImpact > 0 ? '+' : ''}${paceImpact.toFixed(1)} pts)`
    )
  }

  // Lead changes / fast pace games
  // If scoring runs are happening, game is likely fast-paced
  if (momentum.scoringRun.currentRun && momentum.scoringRun.currentRun.points >= 8) {
    factors.push(`High-scoring run indicates fast-paced game → total trending higher`)
    fairLine += 1.5 // Small boost for fast-paced games
  }

  // Three-point variance adjustment (for total)
  if (momentum.threePointVariance) {
    fairLine += momentum.threePointVariance.expectedRegression.totalAdjustment
    factors.push(...momentum.threePointVariance.factors)
  }

  // Fouling strategy adjustment
  if (momentum.foulingStrategy?.isFouling) {
    fairLine += momentum.foulingStrategy.impactOnTotal
    factors.push(...momentum.foulingStrategy.factors)
  }

  // Garbage time check
  if (momentum.garbageTime?.isGarbageTime) {
    factors.push(`⚠️ GARBAGE TIME: ${momentum.garbageTime.reason}`)
  }

  // Step 4: Calculate confidence interval
  const volatility = SPORT_VOLATILITY[sport] || 7
  const timeRemainingFraction = timeRemaining / (timeRemaining + timeElapsed)
  const baseVariance = volatility * Math.sqrt(timeRemainingFraction)

  // Cap at ±0.5 points
  const halfRange = Math.min(baseVariance / 2, 0.5)

  const confidenceInterval = {
    lower: fairLine - halfRange,
    upper: fairLine + halfRange,
    range: halfRange * 2,
  }

  // Step 5: Calculate over/under probability
  const totalProb = calculateTotalProbability(
    currentTotal,
    fairLine,
    'over',
    timeRemaining,
    sport,
    timeElapsed
  )

  const winProbability = {
    home: totalProb, // "home" = over
    away: 1 - totalProb, // "away" = under
  }

  // Step 6: Determine confidence level
  let confidence: 'low' | 'medium' | 'high' = 'medium'

  // Garbage time or fouling reduces confidence
  if (momentum.garbageTime?.isGarbageTime || momentum.foulingStrategy?.isFouling) {
    confidence = 'low'
  } else if (remainingMinutes < 5) {
    confidence = 'high'
  } else if (remainingMinutes > 15) {
    confidence = 'low'
  }

  // Step 7: Generate recommendation
  factors.push(`Current total: ${currentTotal} (projected final: ${fairLine.toFixed(1)})`)

  let recommendation = ''

  if (momentum.garbageTime?.isGarbageTime) {
    recommendation = `Avoid betting - garbage time detected. Total projections unreliable.`
  } else if (momentum.foulingStrategy?.isFouling) {
    recommendation = `Intentional fouling detected. Total likely to go OVER due to free throws.`
  } else {
    recommendation =
      confidence === 'high'
        ? `Total ${fairLine.toFixed(1)} is fair. High confidence based on current pace.`
        : confidence === 'medium'
          ? `Over ${(fairLine - 0.5).toFixed(1)} or Under ${(fairLine + 0.5).toFixed(1)} both have value.`
          : `Total ${fairLine.toFixed(1)} projected, but lots of time left. Monitor pace.`
  }

  return {
    type: 'total',
    fairLine,
    confidenceInterval,
    winProbability,
    confidence,
    factors,
    recommendation,
  }
}

// ============================================================================
// FORMAT RECOMMENDATION FOR OUTPUT
// ============================================================================

export function formatLiveRecommendation(rec: LiveLineRecommendation, liveGame: LiveGameState): string {
  const confidenceEmoji = {
    high: '🔥',
    medium: '⚡',
    low: '⚠️',
  }

  const emoji = confidenceEmoji[rec.confidence]

  let output = `🔴 LIVE BET RECOMMENDATION 🔴\n\n`

  output += `📊 ${liveGame.awayTeam} @ ${liveGame.homeTeam}\n`
  output += `   Q${liveGame.period} ${liveGame.displayClock} remaining\n`
  output += `   Score: ${liveGame.homeTeam} ${liveGame.homeScore} - ${liveGame.awayScore} ${liveGame.awayTeam}\n\n`

  if (rec.type === 'spread') {
    const favoredTeam = rec.fairLine > 0 ? liveGame.homeTeam : liveGame.awayTeam
    const spreadValue = Math.abs(rec.fairLine)

    output += `${emoji} LIVE SPREAD\n`
    output += `   Fair Line: ${favoredTeam} -${rec.confidenceInterval.lower.toFixed(1)} to -${rec.confidenceInterval.upper.toFixed(1)}\n`
    output += `   Model Projection: ${favoredTeam} -${spreadValue.toFixed(1)}\n`
    output += `   Confidence: ${rec.confidence.toUpperCase()}\n\n`

    output += `📈 Win Probability\n`
    output += `   ${liveGame.homeTeam}: ${(rec.winProbability.home * 100).toFixed(0)}%\n`
    output += `   ${liveGame.awayTeam}: ${(rec.winProbability.away * 100).toFixed(0)}%\n\n`
  } else {
    output += `${emoji} LIVE TOTAL\n`
    output += `   Fair Line: ${rec.confidenceInterval.lower.toFixed(1)} to ${rec.confidenceInterval.upper.toFixed(1)}\n`
    output += `   Model Projection: ${rec.fairLine.toFixed(1)}\n`
    output += `   Confidence: ${rec.confidence.toUpperCase()}\n\n`

    output += `📈 Over/Under Probability\n`
    output += `   Over ${rec.fairLine.toFixed(1)}: ${(rec.winProbability.home * 100).toFixed(0)}%\n`
    output += `   Under ${rec.fairLine.toFixed(1)}: ${(rec.winProbability.away * 100).toFixed(0)}%\n\n`
  }

  if (rec.factors.length > 0) {
    output += `🔥 MOMENTUM FACTORS\n`
    for (const factor of rec.factors) {
      output += `   ${factor.startsWith('⚠️') || factor.startsWith('✓') ? factor : '✓ ' + factor}\n`
    }
    output += `\n`
  }

  output += `💡 RECOMMENDATION\n`
  output += `   ${rec.recommendation}\n`

  return output
}
