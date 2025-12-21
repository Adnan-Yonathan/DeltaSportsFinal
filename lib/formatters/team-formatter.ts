/**
 * Team Stats Formatter
 *
 * Formats team statistics with betting context, spread/total implications, and ATS records.
 */

import type { TeamStats } from '@/lib/sports-stats-api'
import type {
  TeamStatResponse,
  TeamSplitOptions,
  FormatOptions,
  SplitData,
} from '@/lib/formatters/types'
import {
  formatConfidence,
  generateBettingImplications,
  formatComparison,
  formatStat,
  formatSectionHeader,
  formatList,
  formatRecord,
  formatWinPct,
} from '@/lib/formatters/response-formatter'
import { getLeagueAverage, getLeagueRank } from '@/lib/services/league-averages'

/**
 * Format team season stats with spread/total implications and betting context
 */
export async function formatTeamStats(
  teamStats: TeamStats,
  options: FormatOptions = {}
): Promise<TeamStatResponse> {
  const {
    includeBettingAngles = true,
    includeLeagueContext = true,
    includeEmoji = true,
    sport = 'nba',
    season = 2025,
  } = options

  const { team, wins, losses, winPct, stats } = teamStats

  let formatted = `## ${team}\n\n`

  // Record
  formatted += `**Record:** ${formatRecord(wins, losses)} (${formatWinPct(wins, wins + losses)})\n\n`

  // Key stats section
  formatted += formatSectionHeader('Team Stats', includeEmoji ? '📊' : undefined)

  const keyStats: Array<{ name: string; key: string; higherIsBetter?: boolean }> = [
    { name: 'PPG', key: 'ppg', higherIsBetter: true },
    { name: 'Opp PPG', key: 'oppPpg', higherIsBetter: false },
    { name: 'Pace', key: 'pace', higherIsBetter: true },
    { name: 'ORtg', key: 'offensiveRating', higherIsBetter: true },
    { name: 'DRtg', key: 'defensiveRating', higherIsBetter: false },
    { name: '3PM/G', key: 'threePMade', higherIsBetter: true },
    { name: '3P%', key: 'threePct', higherIsBetter: true },
    { name: 'FG%', key: 'fgPct', higherIsBetter: true },
  ]

  for (const stat of keyStats) {
    const value = stats[stat.key]
    if (value !== undefined && value !== null && typeof value === 'number') {
      const statLine = await formatStat(stat.name, value, {
        includeLeagueContext,
        teamOrPlayer: team,
        sport,
        season,
      })
      formatted += `${statLine}\n`
    }
  }
  formatted += '\n'

  // Generate betting implications
  const bettingAngles = includeBettingAngles
    ? {
        spreads: generateBettingImplications(stats, 'team', { sport }).filter(
          (imp) =>
            imp.toLowerCase().includes('spread') ||
            imp.toLowerCase().includes('line') ||
            imp.toLowerCase().includes('fade') ||
            imp.toLowerCase().includes('buy')
        ),
        totals: generateBettingImplications(stats, 'team', { sport }).filter(
          (imp) =>
            imp.toLowerCase().includes('over') ||
            imp.toLowerCase().includes('under') ||
            imp.toLowerCase().includes('total')
        ),
        ats: [],
      }
    : {}

  if (includeBettingAngles) {
    const allImplications = generateBettingImplications(stats, 'team', { sport })
    if (allImplications.length > 0) {
      formatted += formatSectionHeader('Betting Angles', includeEmoji ? '💡' : undefined)
      formatted += formatList(allImplications)
      formatted += '\n'
    }
  }

  return {
    team,
    rawStats: stats,
    context: {
      leagueComparison: includeLeagueContext ? 'League context included in stats' : undefined,
    },
    bettingAngles,
    formatted,
  }
}

/**
 * Format team split (home/away, B2B, after loss, etc.)
 */
export async function formatTeamSplit(
  options: TeamSplitOptions
): Promise<string> {
  const { splitType, splits, team, seasonLabel, includeEmoji = true, includeBettingAngles = true } = options

  if (!team) {
    return 'Team name required for split formatting\n'
  }

  let formatted = `## ${team} - ${getSplitTypeLabel(splitType)}\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  // Handle different split types
  if (splitType === 'after_loss') {
    return formatAfterLossSplit(team, splits[0], { includeEmoji, includeBettingAngles, seasonLabel })
  } else if (splitType === 'home_away') {
    return formatHomeAwaySplit(team, splits, { includeEmoji, includeBettingAngles, seasonLabel })
  } else if (splitType === 'back_to_back') {
    return formatBackToBackSplit(team, splits, { includeEmoji, includeBettingAngles, seasonLabel })
  } else {
    // Generic split comparison
    if (splits.length === 2) {
      const bettingContext = includeBettingAngles ? generateSplitBettingContext(splits[0], splits[1]) : undefined
      formatted += formatComparison(splits[0].label, splits[0], splits[1].label, splits[1], bettingContext)
    } else {
      // Multiple splits - list each
      for (const split of splits) {
        formatted += `**${split.label}:** ${split.games} games`
        if (split.record) formatted += ` (${split.record})`
        formatted += `\n`
        if (split.ptsScored) formatted += `- Points: ${split.ptsScored.toFixed(1)} PPG\n`
        if (split.ptsAllowed) formatted += `- Points Allowed: ${split.ptsAllowed.toFixed(1)} PPG\n`
        if (split.atsRecord) formatted += `- ATS: ${split.atsRecord}\n`
        formatted += `\n`
      }
    }
  }

  return formatted
}

/**
 * Format after loss split
 */
function formatAfterLossSplit(
  team: string,
  splitData: SplitData,
  options: { includeEmoji?: boolean; includeBettingAngles?: boolean; seasonLabel?: string }
): string {
  const { includeEmoji = true, includeBettingAngles = true, seasonLabel } = options

  let formatted = `## ${team} - After a Loss\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  formatted += `**Games:** ${splitData.games}\n`
  if (splitData.record) {
    formatted += `**Record:** ${splitData.record}`
    if (splitData.winPct) {
      formatted += ` (${(splitData.winPct * 100).toFixed(1)}% win rate)`
    }
    formatted += `\n`
  }

  if (splitData.ptsScored) {
    formatted += `**Avg Points Scored:** ${splitData.ptsScored.toFixed(1)} PPG\n`
  }
  if (splitData.ptsAllowed) {
    formatted += `**Avg Points Allowed:** ${splitData.ptsAllowed.toFixed(1)} PPG\n`
  }

  formatted += `\n`

  // Betting angle
  if (includeBettingAngles && splitData.winPct) {
    formatted += formatSectionHeader('Betting Angle', includeEmoji ? '🎯' : undefined)
    if (splitData.winPct >= 0.65) {
      formatted += `Strong bounce-back team (${(splitData.winPct * 100).toFixed(0)}% win rate) → Consider ML or spread when coming off a loss\n`
    } else if (splitData.winPct >= 0.55) {
      formatted += `Above-average bounce-back team → Moderate value on ML/spread after losses\n`
    } else if (splitData.winPct <= 0.35) {
      formatted += `Struggles after losses (${(splitData.winPct * 100).toFixed(0)}% win rate) → Fade when coming off L\n`
    } else {
      formatted += `Average bounce-back record → No significant edge\n`
    }
  }

  return formatted
}

/**
 * Format home/away split
 */
function formatHomeAwaySplit(
  team: string,
  splits: SplitData[],
  options: { includeEmoji?: boolean; includeBettingAngles?: boolean; seasonLabel?: string }
): string {
  const { includeEmoji = true, includeBettingAngles = true, seasonLabel } = options

  const homeSplit = splits.find((s) => s.label.toLowerCase().includes('home'))
  const awaySplit = splits.find((s) => s.label.toLowerCase().includes('away'))

  if (!homeSplit || !awaySplit) {
    return `Incomplete home/away split data for ${team}\n`
  }

  let formatted = `## ${team} - Home vs Away\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  // Betting context
  let bettingContext: string | undefined
  if (includeBettingAngles) {
    const homePpg = homeSplit.ptsScored || 0
    const awayPpg = awaySplit.ptsScored || 0
    const ppgDiff = homePpg - awayPpg

    const homeOppPpg = homeSplit.ptsAllowed || 0
    const awayOppPpg = awaySplit.ptsAllowed || 0
    const defDiff = homeOppPpg - awayOppPpg

    if (ppgDiff >= 5) {
      bettingContext = `${team} scores ${ppgDiff.toFixed(1)} more PPG at home → Target overs and spreads at home`
    } else if (ppgDiff <= -5) {
      bettingContext = `${team} scores ${Math.abs(ppgDiff).toFixed(1)} more PPG on road → Contrarian road value`
    } else if (defDiff >= 5) {
      bettingContext = `Defense weaker at home (+${defDiff.toFixed(1)} OPP PPG) → Target opponent overs at ${team} home games`
    } else if (defDiff <= -5) {
      bettingContext = `Defense weaker on road (+${Math.abs(defDiff).toFixed(1)} OPP PPG) → Unders on road`
    } else {
      bettingContext = `No significant home/away split → Venue not a major factor`
    }
  }

  formatted += formatComparison('Home', homeSplit, 'Away', awaySplit, bettingContext)

  return formatted
}

/**
 * Format back-to-back split
 */
function formatBackToBackSplit(
  team: string,
  splits: SplitData[],
  options: { includeEmoji?: boolean; includeBettingAngles?: boolean; seasonLabel?: string }
): string {
  const { includeEmoji = true, includeBettingAngles = true, seasonLabel } = options

  const b2bSplit = splits.find((s) => s.label.toLowerCase().includes('back') || s.label.toLowerCase().includes('b2b'))
  const restedSplit = splits.find((s) => s.label.toLowerCase().includes('rest'))

  if (!b2bSplit || !restedSplit) {
    return `Incomplete B2B split data for ${team}\n`
  }

  let formatted = `## ${team} - Back-to-Back Split\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  // Betting context
  let bettingContext: string | undefined
  if (includeBettingAngles) {
    const b2bPpg = b2bSplit.ptsScored || 0
    const restedPpg = restedSplit.ptsScored || 0
    const ppgDiff = restedPpg - b2bPpg

    const b2bWinPct = b2bSplit.winPct || 0
    const restedWinPct = restedSplit.winPct || 0

    if (ppgDiff >= 5) {
      bettingContext = `${team} scores ${ppgDiff.toFixed(1)} fewer PPG on B2Bs → Fade spreads and overs on 2nd night of B2B`
    } else if (ppgDiff >= 3) {
      bettingContext = `Moderate B2B drop-off (${ppgDiff.toFixed(1)} PPG) → Unders and opponent spreads have value on B2Bs`
    } else if (ppgDiff <= -2) {
      bettingContext = `${team} performs better on B2Bs → Contrarian value`
    } else {
      bettingContext = `No significant B2B fatigue → Rest status not a major factor`
    }
  }

  formatted += formatComparison('Back-to-Back', b2bSplit, 'Rested', restedSplit, bettingContext)

  return formatted
}

/**
 * Format defensive split (home vs away defense)
 */
export async function formatDefensiveSplit(
  team: string,
  homeSplit: { games: number; oppPpg: number; ourPpg?: number },
  awaySplit: { games: number; oppPpg: number; ourPpg?: number },
  options: FormatOptions = {}
): Promise<string> {
  const { includeEmoji = true, includeBettingAngles = true, seasonLabel } = options

  let formatted = `## ${team} - Defensive Split (Home vs Away)\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  formatted += `**Home:** ${homeSplit.games} games, Opp PPG ${homeSplit.oppPpg.toFixed(1)}`
  if (homeSplit.ourPpg) {
    formatted += `, Our PPG ${homeSplit.ourPpg.toFixed(1)}`
  }
  formatted += `\n`

  formatted += `**Away:** ${awaySplit.games} games, Opp PPG ${awaySplit.oppPpg.toFixed(1)}`
  if (awaySplit.ourPpg) {
    formatted += `, Our PPG ${awaySplit.ourPpg.toFixed(1)}`
  }
  formatted += `\n\n`

  // Difference
  const defDiff = homeSplit.oppPpg - awaySplit.oppPpg
  formatted += `**Difference:** ${Math.abs(defDiff).toFixed(1)} PPG ${defDiff > 0 ? 'more allowed at home' : 'more allowed on road'}\n\n`

  // Betting implications
  if (includeBettingAngles) {
    formatted += formatSectionHeader('Betting Implications', includeEmoji ? '💡' : undefined)

    if (defDiff >= 5) {
      formatted += `- Defense significantly weaker at home (+${defDiff.toFixed(1)} OPP PPG)\n`
      formatted += `- 🎯 **Target opponent overs** when they play at ${team}'s home court\n`
      formatted += `- Consider totals OVER in ${team} home games\n`
    } else if (defDiff >= 3) {
      formatted += `- Moderate defensive decline at home (+${defDiff.toFixed(1)} OPP PPG)\n`
      formatted += `- Lean towards overs in ${team} home games vs high-powered offenses\n`
    } else if (defDiff <= -5) {
      formatted += `- Defense significantly better at home (${Math.abs(defDiff).toFixed(1)} fewer OPP PPG)\n`
      formatted += `- 🎯 **Target unders** in ${team} home games\n`
      formatted += `- Fade opponent overs when playing at ${team}'s home court\n`
    } else {
      formatted += `- No significant home/away defensive split\n`
      formatted += `- Venue not a major factor for opponent scoring\n`
    }

    formatted += `\n`
  }

  return formatted
}

/**
 * Format ATS (Against the Spread) record
 */
export async function formatTeamAts(
  team: string,
  atsData: {
    overall?: { wins: number; losses: number; pushes: number }
    home?: { wins: number; losses: number; pushes: number }
    away?: { wins: number; losses: number; pushes: number }
    favorite?: { wins: number; losses: number; pushes: number }
    underdog?: { wins: number; losses: number; pushes: number }
  },
  options: FormatOptions = {}
): Promise<string> {
  const { includeEmoji = true, seasonLabel } = options

  let formatted = `## ${team} - ATS Record\n\n`

  if (seasonLabel) {
    formatted += `**Season:** ${seasonLabel}\n\n`
  }

  // Overall ATS
  if (atsData.overall) {
    const { wins, losses, pushes } = atsData.overall
    const total = wins + losses + pushes
    const winPct = total > 0 ? (wins / (wins + losses)) * 100 : 0
    formatted += `**Overall ATS:** ${wins}-${losses}-${pushes} (${winPct.toFixed(1)}%)\n`
  }

  // Home ATS
  if (atsData.home) {
    const { wins, losses, pushes } = atsData.home
    const winPct = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
    formatted += `**Home ATS:** ${wins}-${losses}-${pushes} (${winPct.toFixed(1)}%)\n`
  }

  // Away ATS
  if (atsData.away) {
    const { wins, losses, pushes } = atsData.away
    const winPct = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
    formatted += `**Away ATS:** ${wins}-${losses}-${pushes} (${winPct.toFixed(1)}%)\n`
  }

  // As Favorite
  if (atsData.favorite) {
    const { wins, losses, pushes } = atsData.favorite
    const winPct = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
    formatted += `**As Favorite ATS:** ${wins}-${losses}-${pushes} (${winPct.toFixed(1)}%)\n`
  }

  // As Underdog
  if (atsData.underdog) {
    const { wins, losses, pushes } = atsData.underdog
    const winPct = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0
    formatted += `**As Underdog ATS:** ${wins}-${losses}-${pushes} (${winPct.toFixed(1)}%)\n`
  }

  formatted += `\n`

  // Betting insights
  formatted += formatSectionHeader('Betting Insights', includeEmoji ? '📊' : undefined)

  if (atsData.overall) {
    const winPct = (atsData.overall.wins / (atsData.overall.wins + atsData.overall.losses)) * 100
    if (winPct >= 55) {
      formatted += `- Strong ATS performer (${winPct.toFixed(0)}%) → Backing spreads has value\n`
    } else if (winPct <= 45) {
      formatted += `- Poor ATS performer (${winPct.toFixed(0)}%) → Fading spreads recommended\n`
    }
  }

  if (atsData.home && atsData.away) {
    const homeWinPct = (atsData.home.wins / (atsData.home.wins + atsData.home.losses)) * 100
    const awayWinPct = (atsData.away.wins / (atsData.away.wins + atsData.away.losses)) * 100
    const diff = homeWinPct - awayWinPct

    if (Math.abs(diff) >= 15) {
      if (diff > 0) {
        formatted += `- Much better ATS at home (+${diff.toFixed(0)}%) → Target home spreads\n`
      } else {
        formatted += `- Much better ATS on road (+${Math.abs(diff).toFixed(0)}%) → Contrarian road value\n`
      }
    }
  }

  formatted += `\n`

  return formatted
}

/**
 * Get label for split type
 */
function getSplitTypeLabel(splitType: string): string {
  const labels: Record<string, string> = {
    after_loss: 'After a Loss',
    home_away: 'Home vs Away',
    back_to_back: 'Back-to-Back Split',
    vs_opponent: 'vs Opponent',
    custom: 'Split',
  }
  return labels[splitType] || splitType
}

/**
 * Generate betting context from split comparison
 */
function generateSplitBettingContext(split1: SplitData, split2: SplitData): string | undefined {
  const ppgDiff = split1.ptsScored && split2.ptsScored ? split1.ptsScored - split2.ptsScored : null

  if (ppgDiff === null) return undefined

  if (Math.abs(ppgDiff) >= 5) {
    const better = ppgDiff > 0 ? split1.label : split2.label
    const worse = ppgDiff > 0 ? split2.label : split1.label
    return `Team scores ${Math.abs(ppgDiff).toFixed(1)} more PPG in ${better} games → Target overs/spreads in ${better} situations`
  }

  return undefined
}
