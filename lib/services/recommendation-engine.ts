/**
 * Recommendation Engine
 * Calculates target betting lines based on statistical analysis
 * Applies sharp signal weighting (splits/line movement) when available
 */

import {
  calculateFairSpread,
  calculateFairSpreadNba,
  calculateFairTotal,
  calculateFairTotalNba,
  calculateFairSpreadFootball,
  calculateFairTotalFootball,
  calculateFairSpreadHockey,
  calculateFairTotalHockey,
  calculateFairPropLine,
  NCAAB_LEAGUE_CONTEXT,
  buildNbaHierarchyBreakdown,
  getNbaHierarchyWeights,
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
import {
  projectPlayerProp,
  calculatePropProbability,
  formatProjection,
  type PropProjection,
  type MatchupContext,
  type SportKey,
} from './player-prop-projector'
import { fetchSbdGamePropsList, resolveSbdLeague } from '@/lib/api/sbd'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'
import { getCbbAdvancedRatingsForTeam } from './cbb-advanced-ratings'
import { resolveSportKey } from '@/lib/identity/sport'
import {
  buildSharpSignalsFromSplits,
  calculateSharpBiasFromSignals,
} from './sharp-bias'
import { findScoreboardEventByTeams } from '@/lib/providers/espn-ncaaf'
import type { SharpSignal, BettingSplits } from './edge-detection'
import { detectEdgeForGame } from './edge-detection'

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
 * Player prop target line result with edge calculation
 */
export interface PropRecommendation {
  type: 'prop'
  playerName: string
  team?: string
  opponent?: string
  statType: string
  targetLine: number
  marketLine?: number
  bestBook?: string
  bestOdds?: number
  edge?: number // Edge % (model probability - implied probability)
  edgeDirection?: 'over' | 'under'
  modelProbability?: number
  impliedProbability?: number
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
const formatDeltaPct = (value: number) =>
  `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%`

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

  const toPct = (value: number | null) => {
    if (value == null || !Number.isFinite(value)) return null
    return value > 1 ? value / 100 : value
  }

  const numStat = (
    entry: typeof homeAdvanced,
    key: string
  ): number | null => {
    const value = entry?.stats?.[key]
    if (value == null) return null
    const num = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(num) ? num : null
  }

  const homeNet =
    homeAdvanced?.netRating ??
    homeAdvanced?.adjEM ??
    (opts.homeStats.ortg != null && opts.homeStats.drtg != null
      ? opts.homeStats.ortg - opts.homeStats.drtg
      : 0)
  const awayNet =
    awayAdvanced?.netRating ??
    awayAdvanced?.adjEM ??
    (opts.awayStats.ortg != null && opts.awayStats.drtg != null
      ? opts.awayStats.ortg - opts.awayStats.drtg
      : 0)

  const homeAdjO =
    homeAdvanced?.adjO ??
    numStat(homeAdvanced, 'offensiveRating') ??
    opts.homeStats.ortg
  const homeAdjD =
    homeAdvanced?.adjD ??
    numStat(homeAdvanced, 'defensiveRating') ??
    opts.homeStats.drtg
  const awayAdjO =
    awayAdvanced?.adjO ??
    numStat(awayAdvanced, 'offensiveRating') ??
    opts.awayStats.ortg
  const awayAdjD =
    awayAdvanced?.adjD ??
    numStat(awayAdvanced, 'defensiveRating') ??
    opts.awayStats.drtg

  const sosDiff = (homeAdvanced?.sos ?? 0) - (awayAdvanced?.sos ?? 0)
  const usesNetFallback =
    homeAdvanced?.source === 'net' || awayAdvanced?.source === 'net'
  const netWeight = usesNetFallback ? 1 : 1.6
  const netDiff = (homeNet - awayNet) * netWeight + sosDiff * 0.2
  const homePace = homeAdvanced?.tempo ?? opts.homeStats.pace ?? 70
  const awayPace = awayAdvanced?.tempo ?? opts.awayStats.pace ?? 70
  const pace = homePace + awayPace
  const paceAvg = pace / 2
  const paceFactor = paceAvg / 100
  const homeCourt = NCAAB_LEAGUE_CONTEXT.homeCourtAdvantage ?? 3.2
  const offenseDefenseGap = (homeAdjO ?? 0) - (awayAdjD ?? 0)
  const defenseOffenseGap = (awayAdjO ?? 0) - (homeAdjD ?? 0)
  const matchupEdge = (offenseDefenseGap - defenseOffenseGap) * 0.12
  const margin = netDiff * paceFactor + matchupEdge + homeCourt
  const modelSpread = -margin
  const maxModelSpread = 35
  const clampedModelSpread = clamp(modelSpread, -maxModelSpread, maxModelSpread)

  let lateGameFoulBoost = 0
  if (Math.abs(modelSpread) <= 8) {
    const homeFt = toPct(numStat(homeAdvanced, 'freeThrowPct'))
    const awayFt = toPct(numStat(awayAdvanced, 'freeThrowPct'))
    const avgFt = homeFt != null && awayFt != null ? (homeFt + awayFt) / 2 : null
    const baseBoost = 3.5
    lateGameFoulBoost =
      avgFt != null ? Number((baseBoost * (avgFt / 0.69)).toFixed(2)) : baseBoost
  }

  const netLabel =
    homeAdvanced?.netRank && awayAdvanced?.netRank
      ? `NET rank: ${opts.homeTeam} #${homeAdvanced.netRank} vs ${opts.awayTeam} #${awayAdvanced.netRank}`
      : `Net rating: ${opts.homeTeam} ${formatSigned(homeNet)} vs ${opts.awayTeam} ${formatSigned(
          awayNet
        )}`
  const factors = [
    netLabel,
    `SOS adj: ${formatSigned(sosDiff)} (weighted)`,
    `Pace: ${paceAvg.toFixed(1)} poss`,
  ]

  const homeOffRank = numStat(homeAdvanced, 'offenseRank')
  const homeDefRank = numStat(homeAdvanced, 'defenseRank')
  const awayOffRank = numStat(awayAdvanced, 'offenseRank')
  const awayDefRank = numStat(awayAdvanced, 'defenseRank')
  if (homeOffRank != null || homeDefRank != null) {
    factors.push(
      `${opts.homeTeam} scoring ranks: O#${homeOffRank ?? '-'} D#${homeDefRank ?? '-'}`
    )
  }
  if (awayOffRank != null || awayDefRank != null) {
    factors.push(
      `${opts.awayTeam} scoring ranks: O#${awayOffRank ?? '-'} D#${awayDefRank ?? '-'}`
    )
  }

  if (homeAdjO != null && awayAdjD != null) {
    factors.push(
      `${opts.homeTeam} adjO ${homeAdjO.toFixed(1)} vs ${opts.awayTeam} adjD ${awayAdjD.toFixed(1)}`
    )
  }
  if (awayAdjO != null && homeAdjD != null) {
    factors.push(
      `${opts.awayTeam} adjO ${awayAdjO.toFixed(1)} vs ${opts.homeTeam} adjD ${homeAdjD.toFixed(1)}`
    )
  }

  const matchups: string[] = []
  if (homeAdjO != null && awayAdjD != null && homeAdjO - awayAdjD >= 5) {
    matchups.push(
      `${opts.homeTeam} offense edge (+${(homeAdjO - awayAdjD).toFixed(1)} vs defense)`
    )
  }
  if (awayAdjO != null && homeAdjD != null && awayAdjO - homeAdjD >= 5) {
    matchups.push(
      `${opts.awayTeam} offense edge (+${(awayAdjO - homeAdjD).toFixed(1)} vs defense)`
    )
  }

  const rebMarginDiff =
    (numStat(homeAdvanced, 'reboundMargin') ?? 0) -
    (numStat(awayAdvanced, 'reboundMargin') ?? 0)
  if (Math.abs(rebMarginDiff) >= 2.5) {
    matchups.push(
      `Rebound margin edge: ${rebMarginDiff > 0 ? opts.homeTeam : opts.awayTeam} (${formatSigned(
        rebMarginDiff
      )})`
    )
  }

  const tovMarginDiff =
    (numStat(homeAdvanced, 'turnoverMargin') ?? 0) -
    (numStat(awayAdvanced, 'turnoverMargin') ?? 0)
  if (Math.abs(tovMarginDiff) >= 1.5) {
    matchups.push(
      `Turnover margin edge: ${tovMarginDiff > 0 ? opts.homeTeam : opts.awayTeam} (${formatSigned(
        tovMarginDiff
      )})`
    )
  }

  const home3p = numStat(homeAdvanced, 'threePointPct')
  const awayOpp3p = numStat(awayAdvanced, 'opponentThreePointPct')
  if (home3p != null && awayOpp3p != null && home3p - awayOpp3p >= 3) {
    matchups.push(
      `${opts.homeTeam} 3P% edge (${home3p.toFixed(1)} vs ${awayOpp3p.toFixed(1)} allowed)`
    )
  }

  const away3p = numStat(awayAdvanced, 'threePointPct')
  const homeOpp3p = numStat(homeAdvanced, 'opponentThreePointPct')
  if (away3p != null && homeOpp3p != null && away3p - homeOpp3p >= 3) {
    matchups.push(
      `${opts.awayTeam} 3P% edge (${away3p.toFixed(1)} vs ${homeOpp3p.toFixed(1)} allowed)`
    )
  }

  factors.push(...matchups)

  if (Math.abs(clampedModelSpread - modelSpread) > 0.01) {
    factors.push(`Model spread clamped at ${maxModelSpread}`)
  }

  if (opts.marketSpread == null) {
    return { targetSpread: clampedModelSpread, factors, lateGameFoulBoost }
  }
  const blendWeight = 0.6
  const blended =
    clampedModelSpread * blendWeight + opts.marketSpread * (1 - blendWeight)
  const maxShift = 15
  const targetSpread = clamp(
    blended,
    opts.marketSpread - maxShift,
    opts.marketSpread + maxShift
  )
  factors.push(`Market anchor: ${formatSigned(opts.marketSpread)} (blend)`)
  if (Math.abs(targetSpread - blended) > 0.01) {
    factors.push(`Market clamp: ±${maxShift.toFixed(1)} pts`)
  }

  return { targetSpread, factors, lateGameFoulBoost }
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
      if (cbbSpread.lateGameFoulBoost > 0) {
        targetTotal = Number((targetTotal + cbbSpread.lateGameFoulBoost).toFixed(1))
        extraFactors.push(
          `Late-game fouls assumed (<=8 pts): +${cbbSpread.lateGameFoulBoost.toFixed(1)}`
        )
      }
      extraFactors.push(...cbbSpread.factors)
      if (marketContext?.marketTotal != null) {
        const blendWeight = 0.55
        const blended =
          targetTotal * blendWeight +
          marketContext.marketTotal * (1 - blendWeight)
        const maxShift = 15
        targetTotal = clamp(
          blended,
          marketContext.marketTotal - maxShift,
          marketContext.marketTotal + maxShift
        )
        extraFactors.push(
          `Market total anchor: ${marketContext.marketTotal.toFixed(1)} (blend)`
        )
      }
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
    } else if (resolvedSport === 'basketball_nba') {
      // NBA uses hierarchy-weighted efficiency + opponent allowed stats
      const hierarchyWeights = getNbaHierarchyWeights()
      const homeBreakdown = buildNbaHierarchyBreakdown(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        hierarchyWeights
      )
      const awayBreakdown = buildNbaHierarchyBreakdown(
        matchup.awayTeam.stats as TeamStats,
        matchup.homeTeam.stats as TeamStats,
        hierarchyWeights
      )
      const rawMargin = calculateFairSpreadNba(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        matchup.homeTeam.rest,
        matchup.awayTeam.rest,
        matchup.homeTeam.travel,
        matchup.awayTeam.travel,
        matchup.homeTeam.recentForm,
        matchup.awayTeam.recentForm,
        styleMatchup,
        leagueContext,
        hierarchyWeights
      )
      targetSpread = -rawMargin
      targetTotal = calculateFairTotalNba(
        matchup.homeTeam.stats as TeamStats,
        matchup.awayTeam.stats as TeamStats,
        leagueContext,
        hierarchyWeights
      )
      extraFactors.push(
        `NBA hierarchy weights: core ${Math.round(
          hierarchyWeights.core * 100
        )}%, efficiency ${Math.round(
          hierarchyWeights.efficiency * 100
        )}%, play-type ${Math.round(hierarchyWeights.playType * 100)}%`
      )
      extraFactors.push(
        `${homeTeam} adj: eff ${formatDeltaPct(
          homeBreakdown.efficiencyDelta
        )}, play ${formatDeltaPct(
          homeBreakdown.playTypeDelta
        )}, mult ${homeBreakdown.multiplier.toFixed(3)}`
      )
      extraFactors.push(
        `${awayTeam} adj: eff ${formatDeltaPct(
          awayBreakdown.efficiencyDelta
        )}, play ${formatDeltaPct(
          awayBreakdown.playTypeDelta
        )}, mult ${awayBreakdown.multiplier.toFixed(3)}`
      )
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

// Normalize market names for SBD prop lookup
const PROP_TYPE_TO_SBD_NAME: Record<string, string> = {
  points: 'total points (incl. overtime)',
  rebounds: 'total rebounds (incl. overtime)',
  assists: 'total assists (incl. overtime)',
  threes: 'total 3-point field goals (incl. overtime)',
  pra: 'total points plus assists plus rebounds (incl. extra overtime)',
  passing_yards: 'total passing yards (incl. overtime)',
  rushing_yards: 'total rushing yards (incl. overtime)',
  receiving_yards: 'total receiving yards (incl. overtime)',
  receptions: 'total receptions (incl. overtime)',
  goals: 'goals',
  shots: 'shots',
}

const normalizePlayerName = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '')

interface PlayerPropOdds {
  line: number
  overOdds: number | null
  underOdds: number | null
  book: string
}

/**
 * Fetch player prop odds from SBD for a specific player and market
 */
async function fetchPlayerPropOdds(
  playerName: string,
  market: string,
  sport: SportKey
): Promise<PlayerPropOdds | null> {
  const league = resolveSbdLeague(sport)
  if (!league) return null

  const sbdPropName = PROP_TYPE_TO_SBD_NAME[market]
  if (!sbdPropName) return null

  try {
    const props = await fetchSbdGamePropsList(league, {
      props: [sbdPropName],
      limit: 500,
    })

    const entries = Array.isArray(props) ? props : props?.data ?? []
    const normalizedTarget = normalizePlayerName(playerName)

    // Find props matching the player
    for (const entry of entries) {
      const entryPlayer = entry?.player_name || entry?.player?.name || ''
      if (!entryPlayer) continue

      const normalizedEntry = normalizePlayerName(entryPlayer)
      if (
        normalizedEntry === normalizedTarget ||
        normalizedEntry.includes(normalizedTarget) ||
        normalizedTarget.includes(normalizedEntry)
      ) {
        // Found matching player - extract best odds
        const sportsbooks = entry?.sportsbooks || []
        let bestOver: { book: string; odds: number; line: number } | null = null
        let bestUnder: { book: string; odds: number; line: number } | null = null

        for (const book of sportsbooks) {
          const bookName = book?.name || ''
          if (!bookName || ['consensus', 'prizepicks', 'sleeper'].includes(bookName.toLowerCase())) {
            continue
          }

          const odds = book?.odds || {}
          const line = Number(odds?.over_points ?? odds?.under_points ?? book?.over_points ?? book?.under_points ?? 0)
          if (!line) continue

          const overOdds = Number(odds?.over_american ?? odds?.over_decimal ?? book?.over_odds)
          const underOdds = Number(odds?.under_american ?? odds?.under_decimal ?? book?.under_odds)

          if (Number.isFinite(overOdds) && (!bestOver || overOdds > bestOver.odds)) {
            bestOver = { book: bookName, odds: overOdds, line }
          }
          if (Number.isFinite(underOdds) && (!bestUnder || underOdds > bestUnder.odds)) {
            bestUnder = { book: bookName, odds: underOdds, line }
          }
        }

        if (bestOver || bestUnder) {
          const primaryLine = bestOver?.line ?? bestUnder?.line ?? 0
          return {
            line: primaryLine,
            overOdds: bestOver?.odds ?? null,
            underOdds: bestUnder?.odds ?? null,
            book: bestOver?.book ?? bestUnder?.book ?? '',
          }
        }
      }
    }

    return null
  } catch (err) {
    console.warn('[PROP RECOMMENDATIONS] Failed to fetch SBD props:', err)
    return null
  }
}

/**
 * Detect sport from player stats
 */
function detectSportFromPlayer(playerName: string, propType: string): SportKey {
  // NFL markets
  if (['passing_yards', 'rushing_yards', 'receiving_yards', 'receptions', 'passing_touchdowns'].includes(propType)) {
    return 'americanfootball_nfl'
  }
  // NHL markets
  if (['goals', 'shots', 'saves', 'blocked_shots'].includes(propType)) {
    return 'icehockey_nhl'
  }
  // Default to NBA
  return 'basketball_nba'
}

/**
 * Get player prop target line with edge calculation
 * Uses player-centric projection models and compares to market lines
 */
export async function getPropRecommendations(
  playerName: string,
  propType: string,
  gameIdentifier?: string,
  sportKey?: string
): Promise<PropRecommendation[]> {
  const recommendations: PropRecommendation[] = []

  try {
    // Determine sport
    const sport: SportKey = (resolveSportKey(sportKey) as SportKey) ?? detectSportFromPlayer(playerName, propType)

    // Parse matchup context from game identifier
    let matchupContext: MatchupContext | undefined
    if (gameIdentifier) {
      const parts = gameIdentifier.replace(/\bvs\b|\bat\b|@/gi, ' ').split(/\s+/).filter(p => p.length > 2)
      if (parts.length >= 2) {
        matchupContext = {
          opponent: parts[1],
          isHome: gameIdentifier.toLowerCase().includes('@') ? false : undefined,
        }
      }
    }

    // Project using the new player-centric model
    const projection = await projectPlayerProp(playerName, propType, sport, matchupContext)
    if (!projection) {
      console.warn(`[RECOMMENDATION ENGINE] Could not project prop for: ${playerName} ${propType}`)
      return []
    }

    // Fetch real market odds
    const marketOdds = await fetchPlayerPropOdds(playerName, propType, sport)

    // Build factors list from projection
    const factors = projection.factors.map(f => f.description)

    // Calculate edge if we have market odds
    let edge: number | undefined
    let edgeDirection: 'over' | 'under' | undefined
    let modelProbability: number | undefined
    let impliedProbability: number | undefined
    let bestBook: string | undefined
    let bestOdds: number | undefined
    let marketLine: number | undefined

    if (marketOdds && marketOdds.line > 0) {
      marketLine = marketOdds.line

      // Calculate probability of hitting the market line (not our projection)
      const overProb = calculatePropProbability(projection, marketOdds.line, 'over')
      const underProb = calculatePropProbability(projection, marketOdds.line, 'under')

      // Calculate implied probabilities from odds
      const impliedOver = marketOdds.overOdds ? oddsToImpliedProbability(marketOdds.overOdds) : null
      const impliedUnder = marketOdds.underOdds ? oddsToImpliedProbability(marketOdds.underOdds) : null

      // Calculate edge for both sides
      const overEdge = impliedOver !== null ? (overProb.probability - impliedOver) * 100 : -Infinity
      const underEdge = impliedUnder !== null ? (underProb.probability - impliedUnder) * 100 : -Infinity

      // Pick the better edge
      if (overEdge >= underEdge && Number.isFinite(overEdge)) {
        edge = Number(overEdge.toFixed(1))
        edgeDirection = 'over'
        modelProbability = overProb.probability
        impliedProbability = impliedOver ?? undefined
        bestOdds = marketOdds.overOdds ?? undefined
      } else if (Number.isFinite(underEdge)) {
        edge = Number(underEdge.toFixed(1))
        edgeDirection = 'under'
        modelProbability = underProb.probability
        impliedProbability = impliedUnder ?? undefined
        bestOdds = marketOdds.underOdds ?? undefined
      }

      bestBook = marketOdds.book

      // Add edge to factors
      if (edge !== undefined && edgeDirection) {
        const lineGap = projection.projection - marketOdds.line
        factors.push(`Market line: ${marketOdds.line} at ${bestBook}`)
        factors.push(`Line gap: ${lineGap >= 0 ? '+' : ''}${lineGap.toFixed(1)} (model vs market)`)
        factors.push(`Edge: ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}% on ${edgeDirection.toUpperCase()}`)
      }
    }

    // Build recommendation string
    let recommendation: string
    if (edge !== undefined && edgeDirection && marketLine !== undefined) {
      const edgeLabel = edge >= 5 ? 'STRONG' : edge >= 2 ? 'SOFT' : 'MARGINAL'
      recommendation = `${playerName} ${propType.replace(/_/g, ' ')} ${edgeDirection.toUpperCase()} ${marketLine} [${edgeLabel} ${edge >= 0 ? '+' : ''}${edge.toFixed(1)}%]`
    } else {
      recommendation = `Target line: ${playerName} ${propType.replace(/_/g, ' ')} ${projection.projection.toFixed(1)}`
    }

    recommendations.push({
      type: 'prop',
      playerName: projection.player,
      team: projection.team,
      opponent: projection.opponent,
      statType: propType,
      targetLine: projection.projection,
      marketLine,
      bestBook,
      bestOdds,
      edge,
      edgeDirection,
      modelProbability,
      impliedProbability,
      confidence: projection.confidence,
      factors,
      recommendation,
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
