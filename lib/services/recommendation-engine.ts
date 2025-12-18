/**
 * Recommendation Engine
 * Calculates target betting lines based on statistical analysis
 * Does NOT reference external betting odds - purely model-based projections
 */

import {
  calculateFairSpread,
  calculateFairTotal,
  calculateFairPropLine,
  type TeamStats,
  type PlayerStats,
  type RestFactors,
  type TravelFactors,
} from './pregame-value-calculator'
import {
  analyzeMatchup,
  getTeamStats,
  getPlayerStats,
  type MatchupAnalysis,
} from './matchup-analyzer'

/**
 * Game target line result
 */
export interface GameRecommendation {
  type: 'spread' | 'total'
  homeTeam: string
  awayTeam: string
  targetLine: number
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  recommendation: string
}

/**
 * Player prop target line result
 */
export interface PropRecommendation {
  type: 'prop'
  playerName: string
  statType: string
  targetLine: number
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  recommendation: string
}

/**
 * Determine confidence level based on supporting factors
 */
function determineConfidence(
  context: string[],
  hasSplits: boolean
): 'low' | 'medium' | 'high' {
  // High confidence: Strong statistical support + betting splits data
  if (context.length >= 4 && hasSplits && context.some((c) => c.toLowerCase().includes('sharp'))) {
    return 'high'
  }

  // Medium confidence: Good statistical support
  if (context.length >= 3) {
    return 'medium'
  }

  // Low confidence: Limited supporting factors
  return 'low'
}

/**
 * Get game target lines (spread, total)
 */
export async function getGameRecommendations(
  gameIdentifier: string,
  marketType: 'spread' | 'total' | 'all' = 'all'
): Promise<GameRecommendation[]> {
  const recommendations: GameRecommendation[] = []

  try {
    // Parse team names from identifier
    // Support formats: "Lakers", "Lakers Celtics", "Lakers vs Celtics"
    const parts = gameIdentifier
      .replace(/\bvs\b|\bat\b/gi, ' ')
      .split(/\s+/)
      .filter((p) => p.length > 2)

    if (parts.length === 0) {
      console.warn(`[RECOMMENDATION ENGINE] Could not parse teams from: ${gameIdentifier}`)
      return []
    }

    let homeTeam = parts[0]
    let awayTeam = parts.length > 1 ? parts[1] : parts[0]

    // If only one team specified, we need context - for now just analyze that team's stats
    // In a real scenario, we'd need to know the opponent from a schedule

    // Analyze matchup (get stats, ATS, splits, etc.)
    const matchup = await analyzeMatchup(homeTeam, awayTeam)

    if (!matchup.homeTeam.stats || !matchup.awayTeam.stats) {
      console.warn(`[RECOMMENDATION ENGINE] Missing stats for ${homeTeam} vs ${awayTeam}`)
      return []
    }

    // Calculate target lines
    const targetSpread = calculateFairSpread(
      matchup.homeTeam.stats,
      matchup.awayTeam.stats,
      matchup.homeTeam.rest,
      matchup.awayTeam.rest,
      matchup.homeTeam.travel,
      matchup.awayTeam.travel
    )

    const targetTotal = calculateFairTotal(
      matchup.homeTeam.stats,
      matchup.awayTeam.stats
    )

    const confidence = determineConfidence(matchup.context, !!matchup.splits)

    // Generate spread recommendation
    if (marketType === 'spread' || marketType === 'all') {
      const favoredTeam = targetSpread > 0 ? homeTeam : awayTeam
      const spreadAbs = Math.abs(targetSpread)

      recommendations.push({
        type: 'spread',
        homeTeam,
        awayTeam,
        targetLine: targetSpread,
        confidence,
        factors: matchup.context,
        recommendation: `Target spread: ${favoredTeam} -${spreadAbs.toFixed(1)}`,
      })
    }

    // Generate total recommendation
    if (marketType === 'total' || marketType === 'all') {
      recommendations.push({
        type: 'total',
        homeTeam,
        awayTeam,
        targetLine: targetTotal,
        confidence,
        factors: matchup.context,
        recommendation: `Target total: ${targetTotal.toFixed(1)} points`,
      })
    }

    return recommendations
  } catch (error) {
    console.error('[RECOMMENDATION ENGINE] Error generating game recommendations:', error)
    return []
  }
}

/**
 * Get player prop target line
 */
export async function getPropRecommendations(
  playerName: string,
  propType: string,
  gameIdentifier?: string
): Promise<PropRecommendation[]> {
  const recommendations: PropRecommendation[] = []

  try {
    // Get player stats
    const playerStats = getPlayerStats(playerName, propType)
    if (!playerStats) {
      console.warn(`[RECOMMENDATION ENGINE] Player stats not found: ${playerName}`)
      return []
    }

    // Calculate target line
    const targetLine = calculateFairPropLine(playerStats)

    const factors = [
      `Season average: ${playerStats.seasonAverage.toFixed(1)}`,
      `Usage rate: ${playerStats.usage.toFixed(1)}%`,
      `Minutes per game: ${playerStats.minutesPerGame.toFixed(1)}`,
    ]

    const confidence = factors.length >= 3 ? 'medium' : 'low'

    recommendations.push({
      type: 'prop',
      playerName,
      statType: propType,
      targetLine,
      confidence,
      factors,
      recommendation: `Target line: ${playerName} ${propType} ${targetLine.toFixed(1)}`,
    })

    return recommendations
  } catch (error) {
    console.error('[RECOMMENDATION ENGINE] Error generating prop recommendations:', error)
    return []
  }
}

/**
 * Format recommendation for LLM output
 */
export function formatRecommendationForChat(
  recommendation: GameRecommendation | PropRecommendation
): string {
  const confidenceEmoji = {
    high: '🔥',
    medium: '✓',
    low: '⚠️',
  }

  const emoji = confidenceEmoji[recommendation.confidence]

  let output = `${emoji} **${recommendation.recommendation}**\n\n`

  if ('homeTeam' in recommendation) {
    output += `- **Matchup**: ${recommendation.awayTeam} @ ${recommendation.homeTeam}\n`
  }

  output += `- **Target Line**: ${recommendation.targetLine.toFixed(1)}\n`
  output += `- **Confidence**: ${recommendation.confidence.toUpperCase()}\n`

  // Separate injury factors from other factors
  const injuryFactors = recommendation.factors.filter(f =>
    f.toLowerCase().includes('injury') ||
    f.toLowerCase().includes('injuries') ||
    f.toLowerCase().includes('out)') ||
    f.toLowerCase().includes('(out') ||
    f.toLowerCase().includes('(doubtful')
  )

  const otherFactors = recommendation.factors.filter(f => !injuryFactors.includes(f))

  // Show injury info prominently if present
  if (injuryFactors.length > 0) {
    output += `\n**🏥 Injury Adjustments Applied:**\n`
    for (const injury of injuryFactors) {
      output += `- ${injury}\n`
    }
  }

  // Show other supporting factors
  if (otherFactors.length > 0) {
    output += `\n**Supporting Factors:**\n`
    for (const factor of otherFactors) {
      output += `- ${factor}\n`
    }
  }

  return output
}
