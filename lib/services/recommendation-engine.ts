/**
 * Recommendation Engine
 * Calculates target betting lines based on statistical analysis
 * Applies sharp signal weighting (splits/line movement) when available
 */

import {
  calculateFairSpread,
  calculateFairTotal,
  calculateFairSpreadFootball,
  calculateFairTotalFootball,
  calculateFairSpreadHockey,
  calculateFairTotalHockey,
  calculateFairPropLine,
  NCAAB_LEAGUE_CONTEXT,
  type TeamStats,
  type FootballTeamStats,
  type HockeyTeamStats,
  type PlayerStats,
  type RestFactors,
  type TravelFactors,
  type RecentForm,
  type StyleMatchupAdjustment,
} from './pregame-value-calculator'
import {
  analyzeMatchup,
  getTeamStats,
  getPlayerStats,
  calculateStyleMatchupAdjustment,
  type MatchupAnalysis,
} from './matchup-analyzer'
import { getCbbAdvancedRatingsForTeam } from './cbb-advanced-ratings'
import { resolveSportKey } from '@/lib/identity/sport'
import {
  buildSharpSignalsFromSplits,
  calculateSharpBiasFromSignals,
} from './sharp-bias'
import { findScoreboardEventByTeams } from '@/lib/providers/espn-ncaaf'
import type { SharpSignal, BettingSplits } from './edge-detection'
import { detectEdgeForGame } from './edge-detection'
import { resolveSbdLeague } from '@/lib/api/sbd'

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

type MarketContext = {
  marketSpread?: number
  marketTotal?: number
  sharpSignals?: SharpSignal[]
  sharpSplits?: BettingSplits
}

const formatSigned = (value: number) =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)

const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const buildCbbSpread = async (opts: {
  homeTeam: string
  awayTeam: string
  homeStats: TeamStats
  awayStats: TeamStats
  marketSpread?: number
}) => {
  const [homeAdvanced, awayAdvanced] = await Promise.all([
    getCbbAdvancedRatingsForTeam(opts.homeTeam),
    getCbbAdvancedRatingsForTeam(opts.awayTeam),
  ])

  const homeNet =
    homeAdvanced?.adjEM ??
    (opts.homeStats.ortg != null && opts.homeStats.drtg != null
      ? opts.homeStats.ortg - opts.homeStats.drtg
      : 0)
  const awayNet =
    awayAdvanced?.adjEM ??
    (opts.awayStats.ortg != null && opts.awayStats.drtg != null
      ? opts.awayStats.ortg - opts.awayStats.drtg
      : 0)

  const sosDiff = (homeAdvanced?.sos ?? 0) - (awayAdvanced?.sos ?? 0)
  const netDiff = (homeNet - awayNet) + sosDiff * 0.35
  const pace = (opts.homeStats.pace + opts.awayStats.pace) / 2
  const paceFactor = pace / 100
  const homeCourt = NCAAB_LEAGUE_CONTEXT.homeCourtAdvantage ?? 3.2
  const margin = netDiff * paceFactor + homeCourt
  const modelSpread = -margin

  const factors = [
    `Net rating: ${opts.homeTeam} ${formatSigned(homeNet)} vs ${opts.awayTeam} ${formatSigned(
      awayNet
    )}`,
    `SOS adj: ${formatSigned(sosDiff)} (weighted)`,
    `Pace: ${pace.toFixed(1)} poss`,
  ]

  if (opts.marketSpread == null) {
    return { targetSpread: modelSpread, factors }
  }

  const blendWeight = 0.65
  const blended =
    modelSpread * blendWeight + opts.marketSpread * (1 - blendWeight)
  const maxShift = 12
  const targetSpread = clamp(
    blended,
    opts.marketSpread - maxShift,
    opts.marketSpread + maxShift
  )
  factors.push(`Market anchor: ${formatSigned(opts.marketSpread)} (blend)`)

  return { targetSpread, factors }
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
 * Accepts either a game identifier string OR separate home/away team names
 */
export async function getGameRecommendations(
  gameIdentifierOrHomeTeam: string,
  marketTypeOrAwayTeam: 'spread' | 'total' | 'all' | string = 'all',
  marketTypeIfSeparate?: 'spread' | 'total' | 'all',
  sportKey?: string,
  marketContext?: MarketContext,
  precomputedMatchup?: MatchupAnalysis
): Promise<GameRecommendation[]> {
  const recommendations: GameRecommendation[] = []

  try {
    let homeTeam: string
    let awayTeam: string
    let marketType: 'spread' | 'total' | 'all'

    // Check if called with separate team names (new API) or single identifier (legacy)
    if (marketTypeIfSeparate !== undefined) {
      // New API: getGameRecommendations(homeTeam, awayTeam, marketType)
      homeTeam = gameIdentifierOrHomeTeam
      awayTeam = marketTypeOrAwayTeam
      marketType = marketTypeIfSeparate
    } else if (['spread', 'total', 'all'].includes(marketTypeOrAwayTeam)) {
      // Legacy API: getGameRecommendations(gameIdentifier, marketType)
      // Parse team names from identifier
      // Support formats: "Lakers", "Lakers Celtics", "Lakers vs Celtics"
      const gameIdentifier = gameIdentifierOrHomeTeam
      marketType = marketTypeOrAwayTeam as 'spread' | 'total' | 'all'

      const parts = gameIdentifier
        .replace(/\bvs\b|\bat\b/gi, ' ')
        .split(/\s+/)
        .filter((p) => p.length > 2)

      if (parts.length === 0) {
        console.warn(`[RECOMMENDATION ENGINE] Could not parse teams from: ${gameIdentifier}`)
        return []
      }

      homeTeam = parts[0]
      awayTeam = parts.length > 1 ? parts[1] : parts[0]
    } else {
      // Assume it's home/away with default market type
      homeTeam = gameIdentifierOrHomeTeam
      awayTeam = marketTypeOrAwayTeam
      marketType = 'all'
    }

    const resolvedSport = resolveSportKey(sportKey) ?? 'basketball_nba'
    const leagueContext =
      resolvedSport === 'basketball_ncaab' ? NCAAB_LEAGUE_CONTEXT : undefined
    const neutralSiteInfo =
      resolvedSport === 'americanfootball_ncaaf'
        ? await findScoreboardEventByTeams(homeTeam, awayTeam)
        : null

    const normalizeKey = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, '')
    const canReuseMatchup =
      precomputedMatchup &&
      precomputedMatchup.homeTeam.stats &&
      precomputedMatchup.awayTeam.stats &&
      normalizeKey(precomputedMatchup.homeTeam.name) === normalizeKey(homeTeam) &&
      normalizeKey(precomputedMatchup.awayTeam.name) === normalizeKey(awayTeam)

    // Analyze matchup (get stats, ATS, splits, etc.)
    console.log('[RECOMMENDATION ENGINE] Calling analyzeMatchup for:', homeTeam, 'vs', awayTeam)
    const matchup = canReuseMatchup
      ? precomputedMatchup
      : await analyzeMatchup(
          homeTeam,
          awayTeam,
          undefined,
          undefined,
          resolvedSport
        )
    console.log('[RECOMMENDATION ENGINE] analyzeMatchup completed, homeStats:', !!matchup.homeTeam.stats, 'awayStats:', !!matchup.awayTeam.stats)

    if (!matchup.homeTeam.stats || !matchup.awayTeam.stats) {
      console.warn(`[RECOMMENDATION ENGINE] Missing stats for ${homeTeam} vs ${awayTeam}`)
      return []
    }

    // Calculate style matchup adjustment
    let styleMatchup: StyleMatchupAdjustment | undefined
    if (resolvedSport === 'basketball_nba' && matchup.homeTeam.stats && matchup.awayTeam.stats) {
      styleMatchup = calculateStyleMatchupAdjustment(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats
      )
      if (styleMatchup.reason) {
        console.log(`[RECOMMENDATION ENGINE] Style matchup: ${styleMatchup.reason} (${styleMatchup.adjustment > 0 ? '+' : ''}${styleMatchup.adjustment.toFixed(1)} pts)`)
      }
    }

    const extraFactors: string[] = []
    let targetSpread: number
    let targetTotal: number

    const isFootball =
      resolvedSport === 'americanfootball_nfl' ||
      resolvedSport === 'americanfootball_ncaaf'
    const isNfl = resolvedSport === 'americanfootball_nfl'
    const isNcaaf = resolvedSport === 'americanfootball_ncaaf'
    const isHockey = resolvedSport === 'icehockey_nhl'

    if (resolvedSport === 'basketball_ncaab') {
      const cbbSpread = await buildCbbSpread({
        homeTeam,
        awayTeam,
        homeStats: matchup.homeTeam.stats as TeamStats,
        awayStats: matchup.awayTeam.stats as TeamStats,
        marketSpread: marketContext?.marketSpread,
      })
      targetSpread = cbbSpread.targetSpread
      targetTotal = calculateFairTotal(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        leagueContext
      )
      extraFactors.push(...cbbSpread.factors)
    } else if (isFootball) {
      const homeStats = matchup.homeTeam.stats as FootballTeamStats
      const awayStats = matchup.awayTeam.stats as FootballTeamStats
      const isNeutralSite = isNcaaf && neutralSiteInfo?.neutralSite === true
      if (isNeutralSite) {
        extraFactors.push(
          neutralSiteInfo?.note
            ? `Neutral site: ${neutralSiteInfo.note}`
            : 'Neutral site game'
        )
      }
      const leagueContext = isNcaaf
        ? {
            homeFieldAdvantage: isNeutralSite ? 0 : 2.8,
            leagueAvgPpg: 28,
            leagueAvgYpp: 6.0,
            leagueAvgPpd: 2.4,
            leagueAvgPlays: 70,
            leagueAvgThirdDown: 0.41,
            leagueAvgRedZoneTd: 0.62,
            leagueAvgExplosive: 0.11,
            leagueAvgSackRate: 0.06,
            matchupWeight: 0.8,
            totalMatchupWeight: 1.05,
            maxSpread: 24,
            qbValueWeight: 0.4,
          }
        : {
            homeFieldAdvantage: 1.7,
            leagueAvgPpg: 22,
            leagueAvgYpp: 5.5,
            leagueAvgPpd: 2.05,
            leagueAvgPlays: 63,
            leagueAvgThirdDown: 0.38,
            leagueAvgRedZoneTd: 0.55,
            leagueAvgExplosive: 0.1,
            leagueAvgSackRate: 0.07,
            matchupWeight: 0.6,
            totalMatchupWeight: 1.15,
            maxSpread: 14,
            qbValueWeight: 1.0,
          }
      const rawMargin = calculateFairSpreadFootball(homeStats, awayStats, leagueContext)
      targetSpread = -rawMargin
      targetTotal = calculateFairTotalFootball(homeStats, awayStats, leagueContext)
    } else if (isHockey) {
      const homeStats = matchup.homeTeam.stats as HockeyTeamStats
      const awayStats = matchup.awayTeam.stats as HockeyTeamStats
      const rawMargin = calculateFairSpreadHockey(homeStats, awayStats)
      targetSpread = -rawMargin
      targetTotal = calculateFairTotalHockey(homeStats, awayStats)
    } else {
      // Calculate target lines (basketball default)
      // calculateFairSpread returns raw margin (positive = home wins by X)
      // Betting spreads use opposite convention (negative = favorite)
      const rawMargin = calculateFairSpread(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        matchup.homeTeam.rest,
        matchup.awayTeam.rest,
        matchup.homeTeam.travel,
        matchup.awayTeam.travel,
        matchup.homeTeam.recentForm,
        matchup.awayTeam.recentForm,
        styleMatchup,
        leagueContext
      )
      // Convert to betting spread convention: negate so positive margin = negative spread
      targetSpread = -rawMargin
      targetTotal = calculateFairTotal(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        leagueContext
      )
    }

    if (isFootball && marketContext?.marketSpread != null) {
      const marketWeight = isNfl ? 0.65 : 0.55
      const maxShift = isNfl ? 4 : 6
      const blended =
        targetSpread * (1 - marketWeight) + marketContext.marketSpread * marketWeight
      targetSpread = clamp(
        blended,
        marketContext.marketSpread - maxShift,
        marketContext.marketSpread + maxShift
      )
      extraFactors.push(`Market anchor: ${formatSigned(marketContext.marketSpread)} (blend)`)
    }

    if (isFootball && marketContext?.marketTotal != null) {
      const marketWeight = isNfl ? 0.6 : 0.5
      const maxShift = isNfl ? 5 : 7
      const blended =
        targetTotal * (1 - marketWeight) + marketContext.marketTotal * marketWeight
      targetTotal = clamp(
        blended,
        marketContext.marketTotal - maxShift,
        marketContext.marketTotal + maxShift
      )
      extraFactors.push(`Market total anchor: ${marketContext.marketTotal.toFixed(1)} (blend)`)
    }

    const sharpSignals: SharpSignal[] = []
    if (marketContext?.sharpSignals?.length) {
      sharpSignals.push(...marketContext.sharpSignals)
    }
    if (marketContext?.sharpSplits) {
      sharpSignals.push(
        ...buildSharpSignalsFromSplits({
          splits: marketContext.sharpSplits,
          homeTeam,
          awayTeam,
        })
      )
    }
    if (matchup.splits) {
      sharpSignals.push(
        ...buildSharpSignalsFromSplits({
          splits: matchup.splits,
          homeTeam,
          awayTeam,
        })
      )
    }

    if (!sharpSignals.length) {
      const sbdLeague = resolveSbdLeague(resolvedSport)
      if (sbdLeague) {
        const sharpResult = await detectEdgeForGame(
          sbdLeague,
          `${awayTeam} @ ${homeTeam}`
        )
        if (sharpResult?.sharpSignals?.length) {
          sharpSignals.push(...sharpResult.sharpSignals)
        } else if (sharpResult?.splits) {
          sharpSignals.push(
            ...buildSharpSignalsFromSplits({
              splits: sharpResult.splits,
              homeTeam,
              awayTeam,
            })
          )
        }
      }
    }

    const dedupedSharpSignals = sharpSignals.filter((signal, index, array) => {
      const key = `${signal.type}-${signal.market}-${signal.side}`
      return array.findIndex((entry) => `${entry.type}-${entry.market}-${entry.side}` === key) === index
    })

    if (dedupedSharpSignals.length) {
      const sharpBias = calculateSharpBiasFromSignals({
        sharpSignals: dedupedSharpSignals,
        homeTeam,
        awayTeam,
        sport: resolvedSport,
      })
      if (sharpBias.spreadBias) {
        targetSpread += sharpBias.spreadBias
        const note = sharpBias.spreadNotes.length
          ? ` (${sharpBias.spreadNotes.join('; ')})`
          : ''
        extraFactors.push(
          `Sharp money bias (spread): ${formatSigned(sharpBias.spreadBias)}${note}`
        )
      }
      if (sharpBias.totalBias) {
        targetTotal += sharpBias.totalBias
        const note = sharpBias.totalNotes.length
          ? ` (${sharpBias.totalNotes.join('; ')})`
          : ''
        extraFactors.push(
          `Sharp money bias (total): ${formatSigned(sharpBias.totalBias)}${note}`
        )
      }
    }

    const combinedFactors = extraFactors.length
      ? [...extraFactors, ...matchup.context]
      : matchup.context
    const confidence = determineConfidence(
      combinedFactors,
      !!matchup.splits || dedupedSharpSignals.length > 0
    )

    // Generate spread recommendation
    if (marketType === 'spread' || marketType === 'all') {
      // In betting convention: negative spread = favorite
      const favoredTeam = targetSpread < 0 ? homeTeam : awayTeam
      const spreadAbs = Math.abs(targetSpread)

      recommendations.push({
        type: 'spread',
        homeTeam,
        awayTeam,
        targetLine: targetSpread,
        confidence,
        factors: combinedFactors,
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
        factors: combinedFactors,
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
    const playerStats = await getPlayerStats(playerName, propType)
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
