/**
 * Shared Response Formatting Utilities
 *
 * Core formatting functions used across all response formatters.
 * Provides consistent emoji, confidence levels, and betting context generation.
 */

import {
  compareToLeague,
  compareToLeagueWithEmoji,
  getLeagueAverage,
  getLeagueRank,
} from '@/lib/services/league-averages'
import type {
  ConfidenceLevel,
  BettingContext,
  FormatOptions,
  SplitData,
} from '@/lib/formatters/types'

/**
 * Confidence emoji mapping (standardized across the app)
 */
export const CONFIDENCE_EMOJI: Record<ConfidenceLevel, string> = {
  high: '🔥',
  medium: '✓',
  low: '⚠️',
}

/**
 * Format confidence level with emoji
 *
 * @param confidence - Confidence level
 * @returns Formatted string with emoji
 *
 * @example
 * formatConfidence('high') // Returns: "🔥 HIGH"
 */
export function formatConfidence(confidence: ConfidenceLevel): string {
  const emoji = CONFIDENCE_EMOJI[confidence]
  return `${emoji} ${confidence.toUpperCase()}`
}

/**
 * Add league context to a stat value
 *
 * @param stat - Stat name
 * @param value - Stat value
 * @param options - Formatting options
 * @returns Formatted string with league context
 *
 * @example
 * await addLeagueContext('ppg', 115.3, { sport: 'nba', includeRank: true, teamOrPlayer: 'Lakers' })
 * // Returns: "115.3 PPG (3.5 above league avg of 111.8, 4th in NBA)"
 */
export async function addLeagueContext(
  stat: string,
  value: number,
  options: FormatOptions & {
    includeRank?: boolean
    teamOrPlayer?: string
    higherIsBetter?: boolean
  } = {}
): Promise<string> {
  const {
    sport = 'nba',
    season = 2025,
    includeRank = false,
    teamOrPlayer,
    higherIsBetter = true,
  } = options

  // Get league average
  const leagueAvg = await getLeagueAverage(sport, stat, season)
  if (leagueAvg === null) {
    // No league data available, just return the value
    return value.toFixed(1)
  }

  // Base comparison
  let result = compareToLeague(value, leagueAvg, stat, { includeValue: true })

  // Add rank if requested and team/player provided
  if (includeRank && teamOrPlayer) {
    const rankData = await getLeagueRank(sport, teamOrPlayer, stat, value)
    if (rankData) {
      const suffix =
        rankData.rank === 1
          ? 'st'
          : rankData.rank === 2
            ? 'nd'
            : rankData.rank === 3
              ? 'rd'
              : 'th'
      result += `, ${rankData.rank}${suffix} in ${sport.toUpperCase()}`
    }
  }

  return result
}

/**
 * Generate betting implications from stats
 *
 * @param stats - Stats object
 * @param context - Context type ('player' or 'team')
 * @param options - Additional options
 * @returns Array of betting implication strings
 */
export function generateBettingImplications(
  stats: Record<string, any>,
  context: 'player' | 'team',
  options: {
    sport?: string
    opponent?: string
    situation?: string
  } = {}
): string[] {
  const implications: string[] = []
  const { sport = 'nba', opponent, situation } = options

  if (context === 'team') {
    // Team betting implications

    // Points scored
    if (stats.ppg !== undefined || stats.PTS !== undefined) {
      const ppg = stats.ppg || stats.PTS
      if (typeof ppg === 'number') {
        if (ppg >= 120) {
          implications.push('Elite offense → target overs, especially at home')
        } else if (ppg >= 115) {
          implications.push('Above-average scoring → lean overs in favorable matchups')
        } else if (ppg <= 105) {
          implications.push('Struggles to score → consider unders')
        }
      }
    }

    // Points allowed/defensive rating
    if (stats.oppPpg !== undefined || stats.defensiveRating !== undefined) {
      const oppPpg = stats.oppPpg
      if (typeof oppPpg === 'number') {
        if (oppPpg <= 108) {
          implications.push('Elite defense → favor unders and opponent under props')
        } else if (oppPpg >= 118) {
          implications.push('Poor defense → target opponent overs and totals over')
        }
      }
    }

    // Pace
    if (stats.pace !== undefined) {
      const pace = stats.pace
      if (typeof pace === 'number') {
        if (pace >= 102) {
          implications.push('Fast pace → overs likely, high-scoring games')
        } else if (pace <= 96) {
          implications.push('Slow pace → unders likely, grind-it-out games')
        }
      }
    }

    // Three-point shooting
    if (stats.threePointPct !== undefined || stats.threePMade !== undefined) {
      const threePct = stats.threePointPct
      const threePM = stats.threePMade
      if (typeof threePct === 'number' && threePct >= 38) {
        implications.push('Elite 3PT shooting → spreads can swing quickly, target player 3PT props')
      }
      if (typeof threePM === 'number' && threePM >= 15) {
        implications.push('High 3PM volume → variance in final scores, overs more likely')
      }
    }

    // Win percentage / record
    if (stats.winPct !== undefined) {
      const winPct = stats.winPct
      if (typeof winPct === 'number') {
        if (winPct >= 0.7) {
          implications.push('Dominant team → be cautious of inflated spreads')
        } else if (winPct <= 0.3) {
          implications.push('Struggling team → fading on spreads can provide value')
        }
      }
    }
  } else if (context === 'player') {
    // Player betting implications

    // Points per game
    if (stats.ppg !== undefined || stats.PTS !== undefined) {
      const ppg = stats.ppg || stats.PTS
      if (typeof ppg === 'number') {
        if (ppg >= 28) {
          implications.push('Elite scorer → points prop overs have value, especially in favorable matchups')
        } else if (ppg >= 20) {
          implications.push('Consistent scorer → points props reliable, look for line value')
        }
      }
    }

    // Assists
    if (stats.apg !== undefined || stats.AST !== undefined) {
      const apg = stats.apg || stats.AST
      if (typeof apg === 'number' && apg >= 8) {
        implications.push('Playmaker → assists props have value, especially vs weak perimeter D')
      }
    }

    // Rebounds
    if (stats.rpg !== undefined || stats.TRB !== undefined) {
      const rpg = stats.rpg || stats.TRB
      if (typeof rpg === 'number' && rpg >= 10) {
        implications.push('Strong rebounder → rebounds props and double-double props favorable')
      }
    }

    // Three-pointers
    if (stats.threePointPct !== undefined || stats.threePMade !== undefined) {
      const threePct = stats.threePointPct
      const threePM = stats.threePMade || stats.threeP
      if (typeof threePct === 'number' && threePct >= 38 && typeof threePM === 'number' && threePM >= 2.5) {
        implications.push('Efficient shooter → 3PM props have value, monitor opponent perimeter D')
      }
    }

    // Usage/minutes
    if (stats.mpg !== undefined || stats.MP !== undefined) {
      const mpg = stats.mpg || stats.MP
      if (typeof mpg === 'number') {
        if (mpg >= 36) {
          implications.push('High minutes → more opportunities for props, but fatigue risk on B2Bs')
        } else if (mpg <= 25) {
          implications.push('Limited minutes → props risky, need high efficiency to hit')
        }
      }
    }
  }

  // Add situation-specific implications
  if (situation) {
    if (situation.includes('back-to-back') || situation.includes('B2B')) {
      implications.push('⚠️ B2B game → potential for lower performance, fade overs cautiously')
    }
    if (situation.includes('home')) {
      implications.push('Home game → slight boost expected, especially for role players')
    }
    if (situation.includes('rest')) {
      implications.push('Extra rest → players likely fresh, overs have better chance')
    }
  }

  // Add opponent-specific implications
  if (opponent) {
    implications.push(`Monitor ${opponent} defensive stats and recent form for context`)
  }

  return implications
}

/**
 * Format a stat comparison (e.g., home vs away, B2B vs rested)
 *
 * @param label1 - First split label
 * @param stats1 - First split stats
 * @param label2 - Second split label
 * @param stats2 - Second split stats
 * @param bettingContext - Optional betting context to add
 * @returns Formatted comparison string
 */
export function formatComparison(
  label1: string,
  stats1: SplitData,
  label2: string,
  stats2: SplitData,
  bettingContext?: string
): string {
  let output = `**${label1} vs ${label2} Comparison:**\n\n`

  // Row 1: Games
  output += `**${label1}:** ${stats1.games} games`
  if (stats1.record) output += ` (${stats1.record})`
  output += `\n`

  output += `**${label2}:** ${stats2.games} games`
  if (stats2.record) output += ` (${stats2.record})`
  output += `\n\n`

  // Row 2: Scoring
  if (stats1.ptsScored !== undefined && stats2.ptsScored !== undefined) {
    output += `**Points Scored:**\n`
    output += `- ${label1}: ${stats1.ptsScored.toFixed(1)} PPG\n`
    output += `- ${label2}: ${stats2.ptsScored.toFixed(1)} PPG\n`
    const diff = stats1.ptsScored - stats2.ptsScored
    output += `- Difference: ${Math.abs(diff).toFixed(1)} ${diff > 0 ? `more in ${label1}` : `more in ${label2}`}\n\n`
  }

  // Row 3: Points allowed (if available)
  if (stats1.ptsAllowed !== undefined && stats2.ptsAllowed !== undefined) {
    output += `**Points Allowed:**\n`
    output += `- ${label1}: ${stats1.ptsAllowed.toFixed(1)} PPG\n`
    output += `- ${label2}: ${stats2.ptsAllowed.toFixed(1)} PPG\n\n`
  }

  // Row 4: ATS record (if available)
  if (stats1.atsRecord && stats2.atsRecord) {
    output += `**ATS Record:**\n`
    output += `- ${label1}: ${stats1.atsRecord}\n`
    output += `- ${label2}: ${stats2.atsRecord}\n\n`
  }

  // Add betting context
  if (bettingContext) {
    output += `🎯 **Betting Angle:** ${bettingContext}\n`
  }

  return output
}

/**
 * Format a single stat with optional league context
 *
 * @param statName - Display name of stat
 * @param value - Stat value
 * @param options - Formatting options
 * @returns Formatted stat string
 */
export async function formatStat(
  statName: string,
  value: number,
  options: FormatOptions & {
    includeLeagueContext?: boolean
    unit?: string
    teamOrPlayer?: string
  } = {}
): Promise<string> {
  const { includeLeagueContext = false, unit = '', teamOrPlayer } = options

  if (!includeLeagueContext) {
    return `**${statName}:** ${value.toFixed(1)}${unit}`
  }

  // Add league context
  const contextStr = await addLeagueContext(statName.toLowerCase().replace(/\s/g, ''), value, {
    ...options,
    teamOrPlayer,
  })

  return `**${statName}:** ${contextStr}${unit}`
}

/**
 * Determine confidence level based on sample size
 *
 * @param sampleSize - Number of games/data points
 * @returns Confidence level
 */
export function determineConfidenceFromSampleSize(sampleSize: number): ConfidenceLevel {
  if (sampleSize >= 15) return 'high'
  if (sampleSize >= 7) return 'medium'
  return 'low'
}

/**
 * Format record string (W-L or W-L-T)
 *
 * @param wins - Number of wins
 * @param losses - Number of losses
 * @param ties - Number of ties (optional)
 * @returns Formatted record string
 */
export function formatRecord(wins: number, losses: number, ties?: number): string {
  if (ties !== undefined && ties > 0) {
    return `${wins}-${losses}-${ties}`
  }
  return `${wins}-${losses}`
}

/**
 * Format win percentage
 *
 * @param wins - Number of wins
 * @param totalGames - Total games played
 * @returns Win percentage string
 */
export function formatWinPct(wins: number, totalGames: number): string {
  if (totalGames === 0) return '0.0%'
  const pct = (wins / totalGames) * 100
  return `${pct.toFixed(1)}%`
}

/**
 * Generate section header with emoji
 *
 * @param title - Section title
 * @param emoji - Optional emoji
 * @returns Formatted header
 */
export function formatSectionHeader(title: string, emoji?: string): string {
  return emoji ? `${emoji} **${title}**\n` : `**${title}**\n`
}

/**
 * Truncate text to max length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length
 * @returns Truncated text
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength - 3) + '...'
}

/**
 * Format a list of factors/implications
 *
 * @param items - List of items
 * @param options - Formatting options
 * @returns Formatted list
 */
export function formatList(
  items: string[],
  options: {
    bullet?: string
    maxItems?: number
  } = {}
): string {
  const { bullet = '-', maxItems } = options

  const itemsToShow = maxItems ? items.slice(0, maxItems) : items
  return itemsToShow.map((item) => `${bullet} ${item}`).join('\n')
}
