/**
 * Player Stats Formatter
 *
 * Formats player statistics with betting context, prop implications, and league comparisons.
 */

import type { PlayerStats } from '@/lib/sports-stats-api'
import type {
  PlayerStatResponse,
  PropSuggestion,
  PlayerSplitOptions,
  FormatOptions,
} from '@/lib/formatters/types'
import {
  formatConfidence,
  generateBettingImplications,
  formatComparison,
  formatStat,
  determineConfidenceFromSampleSize,
  formatSectionHeader,
  formatList,
} from '@/lib/formatters/response-formatter'
import { getLeagueAverage } from '@/lib/services/league-averages'

/**
 * Format player season stats with prop implications and betting context
 *
 * @param playerStats - Player stats object
 * @param options - Formatting options
 * @returns Formatted player stat response
 */
export async function formatPlayerStats(
  playerStats: PlayerStats,
  options: FormatOptions = {}
): Promise<PlayerStatResponse> {
  const {
    includeBettingAngles = true,
    includeLeagueContext = true,
    includeEmoji = true,
    sport = 'nba',
    season = 2025,
  } = options

  const { name, team, stats } = playerStats

  let formatted = `## ${name} (${team})\n\n`

  // Key stats section
  formatted += formatSectionHeader('Season Averages', includeEmoji ? '📊' : undefined)

  const keyStats: Array<{ name: string; key: string; unit?: string }> = [
    { name: 'Points', key: 'ppg', unit: ' PPG' },
    { name: 'Rebounds', key: 'rpg', unit: ' RPG' },
    { name: 'Assists', key: 'apg', unit: ' APG' },
    { name: 'FG%', key: 'fgPct', unit: '%' },
    { name: '3P%', key: 'threePct', unit: '%' },
    { name: '3PM', key: 'threePMade', unit: ' per game' },
    { name: 'Minutes', key: 'mpg', unit: ' MPG' },
  ]

  for (const stat of keyStats) {
    const value = stats[stat.key]
    if (value !== undefined && value !== null && typeof value === 'number') {
      const statLine = await formatStat(stat.name, value, {
        includeLeagueContext: false, // Don't clutter with league context for each stat
        unit: stat.unit,
      })
      formatted += `${statLine}\n`
    }
  }
  formatted += '\n'

  // Generate prop suggestions
  const propSuggestions = generatePropSuggestions(stats)
  if (propSuggestions.length > 0) {
    formatted += formatSectionHeader('Prop Betting Outlook', includeEmoji ? '🎯' : undefined)
    for (const prop of propSuggestions) {
      const emoji = prop.confidence === 'high' ? '🔥' : prop.confidence === 'medium' ? '✓' : '⚠️'
      const direction = prop.recommendation === 'over' ? 'OVER' : prop.recommendation === 'under' ? 'UNDER' : 'AVOID'
      formatted += `${emoji} **${prop.stat.toUpperCase()} ${direction}** (line typically ~${prop.typicalLine.toFixed(1)})\n`
      if (prop.factors && prop.factors.length > 0) {
        formatted += `  ${prop.factors[0]}\n`
      }
    }
    formatted += '\n'
  }

  // Generate betting implications
  const bettingAngles = includeBettingAngles
    ? {
        props: generateBettingImplications(stats, 'player', { sport }).filter((imp) =>
          imp.toLowerCase().includes('prop')
        ),
        totals: generateBettingImplications(stats, 'player', { sport }).filter(
          (imp) =>
            imp.toLowerCase().includes('over') ||
            imp.toLowerCase().includes('under') ||
            imp.toLowerCase().includes('total')
        ),
      }
    : {}

  if (includeBettingAngles && bettingAngles.props && bettingAngles.props.length > 0) {
    formatted += formatSectionHeader('Betting Angles', includeEmoji ? '💡' : undefined)
    formatted += formatList(generateBettingImplications(stats, 'player', { sport }))
    formatted += '\n'
  }

  return {
    player: name,
    team,
    rawStats: stats,
    context: {},
    bettingAngles,
    propSuggestions,
    formatted,
  }
}

/**
 * Generate prop suggestions from player stats
 */
function generatePropSuggestions(stats: Record<string, any>): PropSuggestion[] {
  const suggestions: PropSuggestion[] = []

  // Points prop
  const ppg = stats.ppg || stats.PTS
  if (typeof ppg === 'number') {
    const typicalLine = Math.round(ppg * 2) / 2 // Round to nearest 0.5
    const recommendation = ppg >= typicalLine + 1 ? 'over' : ppg <= typicalLine - 1 ? 'under' : 'avoid'
    const confidence = ppg >= 20 ? 'high' : ppg >= 15 ? 'medium' : 'low'

    suggestions.push({
      stat: 'Points',
      currentAverage: ppg,
      typicalLine,
      recommendation,
      confidence,
      factors: [
        ppg >= 25
          ? 'Elite scoring volume, overs favorable in pace-up matchups'
          : ppg >= 20
            ? 'Consistent scoring, look for usage upticks'
            : 'Lower volume, need perfect matchup for overs',
      ],
    })
  }

  // Assists prop
  const apg = stats.apg || stats.AST
  if (typeof apg === 'number' && apg >= 3) {
    const typicalLine = Math.round(apg * 2) / 2
    const recommendation = apg >= typicalLine + 0.5 ? 'over' : apg <= typicalLine - 0.5 ? 'under' : 'avoid'
    const confidence = apg >= 7 ? 'high' : apg >= 5 ? 'medium' : 'low'

    suggestions.push({
      stat: 'Assists',
      currentAverage: apg,
      typicalLine,
      recommendation,
      confidence,
      factors: [apg >= 8 ? 'Primary playmaker, overs solid vs weak perimeter D' : 'Secondary facilitator, matchup-dependent'],
    })
  }

  // Rebounds prop
  const rpg = stats.rpg || stats.TRB
  if (typeof rpg === 'number' && rpg >= 4) {
    const typicalLine = Math.round(rpg * 2) / 2
    const recommendation = rpg >= typicalLine + 0.5 ? 'over' : rpg <= typicalLine - 0.5 ? 'under' : 'avoid'
    const confidence = rpg >= 9 ? 'high' : rpg >= 6 ? 'medium' : 'low'

    suggestions.push({
      stat: 'Rebounds',
      currentAverage: rpg,
      typicalLine,
      recommendation,
      confidence,
      factors: [rpg >= 10 ? 'Dominant rebounder, overs reliable' : 'Solid boards, target vs weak rebounding teams'],
    })
  }

  // 3PM prop
  const threePM = stats.threePMade || stats.threeP
  const threePct = stats.threePct || stats.threePointPct
  if (typeof threePM === 'number' && threePM >= 1.5) {
    const typicalLine = Math.round(threePM * 2) / 2
    const recommendation = threePM >= typicalLine + 0.3 ? 'over' : threePM <= typicalLine - 0.3 ? 'under' : 'avoid'
    const confidence =
      threePM >= 3 && typeof threePct === 'number' && threePct >= 38 ? 'high' : threePM >= 2 ? 'medium' : 'low'

    suggestions.push({
      stat: '3-Pointers Made',
      currentAverage: threePM,
      typicalLine,
      recommendation,
      confidence,
      factors: [
        threePM >= 3.5
          ? 'Elite volume shooter, overs strong vs weak perimeter D'
          : 'Moderate volume, efficiency matters for overs',
      ],
    })
  }

  return suggestions
}

/**
 * Format player vs opponent stats with matchup context
 */
export async function formatPlayerVsOpponent(
  player: string,
  team: string,
  opponent: string,
  vsStats: Record<string, any>,
  seasonStats?: Record<string, any>,
  options: FormatOptions = {}
): Promise<string> {
  const { includeEmoji = true, includeBettingAngles = true } = options

  let formatted = `## ${player} vs ${opponent}\n\n`

  // Games played
  const gamesPlayed = vsStats.games || 5 // Assume 5 if not provided
  formatted += `**Sample Size:** ${gamesPlayed} games\n`

  // Confidence based on sample size
  const confidence = determineConfidenceFromSampleSize(gamesPlayed)
  if (gamesPlayed < 5) {
    formatted += `⚠️ Small sample size - use caution\n`
  }
  formatted += `\n`

  // Stats comparison
  formatted += formatSectionHeader('Performance vs Opponent', includeEmoji ? '📊' : undefined)

  const stats = ['ppg', 'rpg', 'apg', 'threePMade']
  for (const stat of stats) {
    const vsValue = vsStats[stat]
    const seasonValue = seasonStats ? seasonStats[stat] : null

    if (vsValue !== undefined && vsValue !== null && typeof vsValue === 'number') {
      const statName = stat === 'ppg' ? 'PPG' : stat === 'rpg' ? 'RPG' : stat === 'apg' ? 'APG' : '3PM'
      formatted += `**${statName}:** ${vsValue.toFixed(1)}`

      if (seasonValue && typeof seasonValue === 'number') {
        const diff = vsValue - seasonValue
        const direction = diff > 0 ? 'above' : 'below'
        formatted += ` (${Math.abs(diff).toFixed(1)} ${direction} season avg of ${seasonValue.toFixed(1)})`
      }
      formatted += `\n`
    }
  }
  formatted += `\n`

  // Betting implications
  if (includeBettingAngles) {
    formatted += formatSectionHeader('Prop Betting Implications', includeEmoji ? '🎯' : undefined)

    const ppgVs = vsStats.ppg
    const ppgSeason = seasonStats ? seasonStats.ppg : null

    if (typeof ppgVs === 'number' && typeof ppgSeason === 'number') {
      const diff = ppgVs - ppgSeason
      if (Math.abs(diff) >= 3) {
        if (diff > 0) {
          formatted += `- ${player} averages **${diff.toFixed(1)} more PPG** vs ${opponent} → Strong OVER candidate for points props\n`
        } else {
          formatted += `- ${player} averages **${Math.abs(diff).toFixed(1)} fewer PPG** vs ${opponent} → Consider UNDER for points props\n`
        }
      }
    }

    formatted += `- Monitor ${opponent}'s recent defensive performance for additional context\n`
    formatted += `\n`
  }

  return formatted
}

/**
 * Format player rest split (back-to-back vs rested)
 */
export async function formatPlayerRestSplit(
  options: PlayerSplitOptions
): Promise<string> {
  const { player, team, splits, includeEmoji = true, includeBettingAngles = true } = options

  let formatted = `## ${player} (${team}) - Rest Split\n\n`

  // Assuming splits[0] = B2B, splits[1] = rested
  const b2bSplit = splits.find((s) => s.label.toLowerCase().includes('back') || s.label.toLowerCase().includes('b2b'))
  const restedSplit = splits.find((s) => s.label.toLowerCase().includes('rest'))

  if (!b2bSplit || !restedSplit) {
    return `No rest split data available for ${player}\n`
  }

  // Use formatComparison utility
  let bettingContext = ''
  if (includeBettingAngles) {
    const ppgDiff = b2bSplit.ptsScored && restedSplit.ptsScored ? restedSplit.ptsScored - b2bSplit.ptsScored : 0
    if (ppgDiff >= 3) {
      bettingContext = `${player} averages ${ppgDiff.toFixed(1)} more PPG when rested → Fade props on B2Bs, target overs when rested`
    } else if (ppgDiff <= -2) {
      bettingContext = `${player} surprisingly performs better on B2Bs → Monitor for value`
    } else {
      bettingContext = `No significant difference → Rest status not a major factor for props`
    }
  }

  formatted += formatComparison('Back-to-Back', b2bSplit, 'Rested', restedSplit, bettingContext)

  return formatted
}

/**
 * Format player threshold games (e.g., 40+ point games)
 */
export async function formatPlayerThreshold(
  player: string,
  team: string,
  threshold: number,
  stat: string,
  games: Array<{ date: string; opponent: string; value: number; result?: string }>,
  options: FormatOptions = {}
): Promise<string> {
  const { includeEmoji = true, seasonLabel = '2025 Regular' } = options

  let formatted = `## ${player} - ${stat.toUpperCase()} >= ${threshold}\n\n`

  formatted += `**Season:** ${seasonLabel}\n`
  formatted += `**Games:** ${games.length} games with ${stat.toUpperCase()} >= ${threshold}\n\n`

  if (games.length === 0) {
    formatted += `No games found with ${stat.toUpperCase()} >= ${threshold}\n`
    return formatted
  }

  formatted += formatSectionHeader('Instances', includeEmoji ? '🎯' : undefined)

  // List each game
  for (const game of games.slice(0, 10)) {
    // Limit to 10 most recent
    formatted += `- ${game.date}: ${game.value} ${stat.toUpperCase()} vs ${game.opponent}`
    if (game.result) {
      formatted += ` (${game.result})`
    }
    formatted += `\n`
  }

  if (games.length > 10) {
    formatted += `\n... and ${games.length - 10} more\n`
  }

  formatted += `\n`

  // Betting angle
  formatted += formatSectionHeader('Betting Context', includeEmoji ? '💡' : undefined)
  const frequency = (games.length / 50) * 100 // Assume 50 games played
  if (frequency >= 30) {
    formatted += `- High frequency (${frequency.toFixed(0)}% of games) → ${stat.toUpperCase()} over props likely have value\n`
  } else if (frequency >= 15) {
    formatted += `- Moderate frequency (${frequency.toFixed(0)}% of games) → Matchup-dependent for ${stat.toUpperCase()} overs\n`
  } else {
    formatted += `- Low frequency (${frequency.toFixed(0)}% of games) → ${stat.toUpperCase()} over ${threshold} is rare, high risk\n`
  }

  return formatted
}

/**
 * Format player game log with trend analysis
 */
export async function formatPlayerGameLog(
  player: string,
  team: string,
  games: Array<Record<string, any>>,
  options: FormatOptions = {}
): Promise<string> {
  const { includeEmoji = true, includeBettingAngles = true } = options

  let formatted = `## ${player} (${team}) - Recent Game Log\n\n`

  if (games.length === 0) {
    formatted += `No game log data available\n`
    return formatted
  }

  formatted += `**Last ${games.length} games:**\n\n`

  // Table header
  formatted += `| Date | Opp | MIN | PTS | REB | AST | FG% | 3PM |\n`
  formatted += `|------|-----|-----|-----|-----|-----|-----|-----|\n`

  // Game rows (show last 10)
  for (const game of games.slice(0, 10)) {
    const date = game.date || 'N/A'
    const opp = game.opponent || 'N/A'
    const min = game.minutes !== undefined ? game.minutes.toString() : '-'
    const pts = game.points !== undefined ? game.points.toString() : '-'
    const reb = game.rebounds !== undefined ? game.rebounds.toString() : '-'
    const ast = game.assists !== undefined ? game.assists.toString() : '-'
    const fgPct = game.fgPct !== undefined ? `${(game.fgPct * 100).toFixed(0)}%` : '-'
    const threePM = game.threePMade !== undefined ? game.threePMade.toString() : '-'

    formatted += `| ${date} | ${opp} | ${min} | ${pts} | ${reb} | ${ast} | ${fgPct} | ${threePM} |\n`
  }

  formatted += `\n`

  // Trend analysis
  if (includeBettingAngles && games.length >= 5) {
    formatted += formatSectionHeader('Trend Analysis', includeEmoji ? '📈' : undefined)

    // Last 5 vs previous 5
    const last5 = games.slice(0, 5)
    const prev5 = games.slice(5, 10)

    const last5Avg = calculateAverage(last5, 'points')
    const prev5Avg = calculateAverage(prev5, 'points')

    if (last5Avg && prev5Avg) {
      const trend = last5Avg - prev5Avg
      if (trend >= 3) {
        formatted += `- 📈 Trending UP: Averaging ${last5Avg.toFixed(1)} PPG in last 5 (vs ${prev5Avg.toFixed(1)} in previous 5)\n`
      } else if (trend <= -3) {
        formatted += `- 📉 Trending DOWN: Averaging ${last5Avg.toFixed(1)} PPG in last 5 (vs ${prev5Avg.toFixed(1)} in previous 5)\n`
      } else {
        formatted += `- ➡️ STABLE: Averaging ${last5Avg.toFixed(1)} PPG in last 5 (similar to ${prev5Avg.toFixed(1)} in previous 5)\n`
      }
    }

    formatted += `\n`
  }

  return formatted
}

/**
 * Calculate average for a stat across games
 */
function calculateAverage(games: Array<Record<string, any>>, stat: string): number | null {
  const values = games.map((g) => g[stat]).filter((v) => typeof v === 'number')
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}
