/**
 * Slate Edge Detector
 * Analyzes all games for a sport on a given day to find betting edges
 *
 * Combines:
 * 1. Model projections (target spread/total from matchup analysis)
 * 2. Sharp money signals (RLM, steam moves, bet%/money% divergence)
 *
 * Sharp confirmation boosts edge confidence when sharps agree with model
 */

import { fetchOdds } from '@/lib/api/odds-api'
import { fetchSbdOdds, mapSbdOddsToOddsGames } from '@/lib/api/sbd'
import { getNBATeamStats } from '@/lib/sports-stats-api'
import { getGameRecommendations, type GameRecommendation } from './recommendation-engine'
import { analyzeMatchup, type MatchupAnalysis } from './matchup-analyzer'
import {
  calculateFairSpread,
  calculateFairSpreadNba,
  calculateFairTotal,
  calculateFairTotalNba,
  calculateFairSpreadFootball,
  calculateFairTotalFootball,
  calculateFairSpreadHockey,
  calculateFairTotalHockey,
  NCAAB_LEAGUE_CONTEXT,
  type TeamStats,
  type FootballTeamStats,
  type HockeyTeamStats,
} from './pregame-value-calculator'
import { evaluateLineEdge, type EdgeAssessment } from '@/lib/analysis/bet-tools'
import type { OddsGame } from '@/lib/types/odds'
import { MARKETS } from '@/lib/types/odds'
import { normalCDF, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import {
  analyzeSlatePropEdges,
  formatSlatePropEdgesForChat,
  type PlayerPropEdge,
} from '@/lib/services/slate-prop-edge-detector'
import { findEVOpportunities } from '@/lib/services/cross-market-ev'
import type { EVOpportunity } from '@/lib/utils/ev-calculator'
import {
  detectEdges as detectSharpEdges,
  type SharpSignal,
  type LineMovement,
  type BettingSplits,
  type EdgeDetectionResult as SharpEdgeResult,
} from './edge-detection'
import {
  fetchWhaleTrades,
  type WhaleTrade,
  type WhaleTradeStatus,
  evaluateWhaleRespect,
  type WhaleTradeWithStatus,
} from '@/lib/services/whale-detector'

export type WhaleAlert = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  notional: number
  americanOdds?: number | null
  timestamp: string
  status: WhaleTradeStatus
}

export interface GameEdgeAnalysis {
  matchup: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  homeStats?: TeamStats | FootballTeamStats | HockeyTeamStats | null
  awayStats?: TeamStats | FootballTeamStats | HockeyTeamStats | null
  moneyline?: {
    sportsbook?: {
      homeOdds?: number
      homeBook?: string
      awayOdds?: number
      awayBook?: string
    }
    model?: {
      homeOdds?: number
      awayOdds?: number
      homeProbability?: number
    }
    prediction?: {
      homeOdds?: number
      homeBook?: string
      awayOdds?: number
      awayBook?: string
    }
  }
  spread?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
    prediction?: { line: number; book: string; odds: number }
    favoredTeam: string // Which team the model favors
    sharpConfirmed?: boolean // Sharp signals agree with model
  }
  total?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
    bestUnderOdds?: number
    prediction?: { line: number; book: string; overOdds: number; underOdds: number }
    sharpConfirmed?: boolean // Sharp signals agree with model
  }
  confidence: 'low' | 'medium' | 'high'
  factors: string[]
  injuries: string[] // Injury factors
  matchupFactors: string[] // ORtg, DRtg, pace factors
  // Sharp money signals
  sharpSignals: SharpSignal[]
  lineMovements: LineMovement[]
  splits?: BettingSplits
  sharpConfirmation?: {
    agrees: boolean
    signals: string[]
    boost: number // Confidence boost factor (0-2)
  }
  highEv?: {
    spread?: EVOpportunity
    total?: EVOpportunity
  }
  whaleAlerts?: WhaleAlert[]
}

export interface SlateEdgeResult {
  sport: string
  sportLabel: string
  date: string
  gamesAnalyzed: number
  edges: GameEdgeAnalysis[]
  propEdges?: PlayerPropEdge[]
  propSummary?: {
    strongEdges: number
    softEdges: number
    noEdges: number
    propsAnalyzed: number
  }
  summary: {
    strongEdges: number
    softEdges: number
    noEdges: number
    sharpConfirmed: number // Edges with sharp confirmation
  }
}

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
}

const CFB_TEAM_ALIASES: Record<string, string[]> = {
  'Ole Miss': ['Ole Miss', 'Mississippi', 'Mississippi Rebels'],
  Miami: ['Miami', 'Miami (FL)', 'Miami FL', 'Miami Hurricanes'],
  Indiana: ['Indiana', 'Indiana Hoosiers'],
  Oregon: ['Oregon', 'Oregon Ducks'],
}

const CFB_PLAYOFF_MATCHUPS = [
  ['Ole Miss', 'Miami'],
  ['Indiana', 'Oregon'],
] as const

const CFB_WHALE_MIN_NOTIONAL = 10000

// Map odds-api sport keys to SBD league keys
const ODDS_API_TO_SBD: Record<string, 'nba' | 'nfl' | 'nhl' | 'mlb' | 'ncaamb' | 'ncaafb'> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

const normalizeSelection = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const isPredictionMarketBook = (book: { key?: string; title?: string }) => {
  const key = (book.key || book.title || '').toLowerCase()
  return key.includes('polymarket') || key.includes('kalshi')
}

const buildTokens = (value: string) =>
  normalizeSelection(value)
    .split(' ')
    .filter((token) => token.length > 2)

const selectionMatchesTeam = (selection: string, team: string) => {
  const selectionTokens = buildTokens(selection)
  const teamTokens = buildTokens(team)
  if (!selectionTokens.length || !teamTokens.length) return false
  const selectionJoined = selectionTokens.join(' ')
  const teamJoined = teamTokens.join(' ')
  if (selectionJoined.includes(teamJoined) || teamJoined.includes(selectionJoined)) {
    return true
  }
  return (
    teamTokens.every((token) => selectionTokens.includes(token)) ||
    selectionTokens.every((token) => teamTokens.includes(token))
  )
}

const pickBestEv = (
  opportunities: EVOpportunity[],
  market: string,
  predicate: (opportunity: EVOpportunity) => boolean,
  line?: number
) => {
  const candidates = opportunities.filter(
    (opportunity) => opportunity.market === market && predicate(opportunity)
  )
  if (!candidates.length) return null
  return candidates
    .sort((a, b) => {
      if (b.ev !== a.ev) return b.ev - a.ev
      if (line != null && a.point != null && b.point != null) {
        return Math.abs(a.point - line) - Math.abs(b.point - line)
      }
      return 0
    })
    [0]
}

const formatOdds = (odds: number) => (odds > 0 ? `+${odds}` : `${odds}`)

const normalizeTeamName = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const teamNameMatches = (team: string, candidate: string) => {
  const normalizedTeam = normalizeTeamName(team)
  const normalizedCandidate = normalizeTeamName(candidate)
  if (!normalizedTeam || !normalizedCandidate) return false
  return (
    normalizedTeam === normalizedCandidate ||
    normalizedTeam.endsWith(normalizedCandidate) ||
    normalizedCandidate.endsWith(normalizedTeam)
  )
}

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const isCfbPlayoffMatchup = (homeTeam: string, awayTeam: string) => {
  return CFB_PLAYOFF_MATCHUPS.some(([teamA, teamB]) => {
    const aliasesA = CFB_TEAM_ALIASES[teamA] || [teamA]
    const aliasesB = CFB_TEAM_ALIASES[teamB] || [teamB]
    const homeMatchesA = aliasesA.some((alias) =>
      selectionMatchesTeam(homeTeam, alias)
    )
    const homeMatchesB = aliasesB.some((alias) =>
      selectionMatchesTeam(homeTeam, alias)
    )
    const awayMatchesA = aliasesA.some((alias) =>
      selectionMatchesTeam(awayTeam, alias)
    )
    const awayMatchesB = aliasesB.some((alias) =>
      selectionMatchesTeam(awayTeam, alias)
    )
    return (homeMatchesA && awayMatchesB) || (homeMatchesB && awayMatchesA)
  })
}

const buildWhaleAlertsForGame = (
  trades: WhaleTradeWithStatus[],
  homeTeam: string,
  awayTeam: string
): WhaleAlert[] => {
  if (!trades.length) return []
  const alerts = trades.filter((trade) => {
    const text = `${trade.marketTitle} ${trade.outcome}`
    return (
      selectionMatchesTeam(text, homeTeam) &&
      selectionMatchesTeam(text, awayTeam)
    )
  })

  return alerts.map((trade) => ({
    id: trade.id,
    source: trade.source,
    marketTitle: trade.marketTitle,
    outcome: trade.outcome,
    notional: trade.notional,
    americanOdds: trade.americanOdds,
    timestamp: trade.timestamp,
    status: trade.status,
  }))
}

const resolveSignalAdjustment = (
  signal: SharpSignal,
  homeTeam: string,
  awayTeam: string
) => {
  const strength =
    signal.strength >= 5
      ? 0.9
      : signal.strength >= 4
        ? 0.7
        : signal.strength >= 3
          ? 0.5
          : 0.3
  if (signal.side === homeTeam) return -strength
  if (signal.side === awayTeam) return strength
  return 0
}

const resolveTotalSignalAdjustment = (signal: SharpSignal) => {
  const strength =
    signal.strength >= 5
      ? 1.2
      : signal.strength >= 4
        ? 0.9
        : signal.strength >= 3
          ? 0.6
          : 0.4
  if (signal.side === 'Over') return strength
  if (signal.side === 'Under') return -strength
  return 0
}

const resolveConfidence = (signalCount: number) => {
  if (signalCount >= 3) return 'high' as const
  if (signalCount >= 1) return 'medium' as const
  return 'low' as const
}

const resolveWhaleWeight = (notional: number) => {
  if (notional >= 30000) return 1.5
  if (notional >= 20000) return 1.0
  if (notional >= 10000) return 0.5
  return 0
}

const summarizeWhaleBias = (
  homeTeam: string,
  awayTeam: string,
  netSideBias: number
) => {
  if (!netSideBias) return null
  const favoredTeam = netSideBias > 0 ? homeTeam : awayTeam
  return `Respected whale bias ${formatSignedLine(Math.abs(netSideBias))} toward ${favoredTeam}`
}

const summarizeTotalWhaleBias = (netTotalBias: number) => {
  if (!netTotalBias) return null
  const direction = netTotalBias > 0 ? 'Over' : 'Under'
  return `Respected whale bias ${formatSignedLine(Math.abs(netTotalBias))} toward ${direction}`
}

const buildCfbMarketRecommendations = ({
  homeTeam,
  awayTeam,
  marketSpread,
  marketTotal,
  sharpResult,
  whaleAlerts,
}: {
  homeTeam: string
  awayTeam: string
  marketSpread: { line: number } | null
  marketTotal: { line: number } | null
  sharpResult?: SharpEdgeResult
  whaleAlerts?: WhaleAlert[]
}): GameRecommendation[] => {
  const recommendations: GameRecommendation[] = []
  const spreadSignals =
    sharpResult?.sharpSignals.filter((signal) => signal.market === 'spread') ||
    []
  const totalSignals =
    sharpResult?.sharpSignals.filter((signal) => signal.market === 'total') || []
  const spreadMovement = sharpResult?.lineMovements.find(
    (movement) => movement.market === 'spread'
  )
  const totalMovement = sharpResult?.lineMovements.find(
    (movement) => movement.market === 'total'
  )

  if (marketSpread) {
    let spreadAdjustment = 0
    const factors: string[] = []
    let homeWhaleBias = 0
    let awayWhaleBias = 0

    if (spreadMovement) {
      spreadAdjustment += spreadMovement.movement * 0.35
      factors.push(
        `Spread moved ${formatSignedLine(spreadMovement.openingLine)} to ${formatSignedLine(
          spreadMovement.currentLine
        )}`
      )
    }

    for (const signal of spreadSignals) {
      const adjustment = resolveSignalAdjustment(signal, homeTeam, awayTeam)
      if (adjustment === 0) continue
      spreadAdjustment += adjustment
      factors.push(`${signal.type} on ${signal.side} spread`)
    }

    const splits = sharpResult?.splits
    if (
      splits?.spreadHomeBetPct != null &&
      splits?.spreadHomeMoneyPct != null
    ) {
      const divergence = splits.spreadHomeMoneyPct - splits.spreadHomeBetPct
      if (Math.abs(divergence) >= 10) {
        const leaning = divergence > 0 ? homeTeam : awayTeam
        const weight =
          Math.abs(divergence) >= 25
            ? 0.8
            : Math.abs(divergence) >= 20
              ? 0.6
              : 0.4
        spreadAdjustment += leaning === homeTeam ? -weight : weight
        factors.push(
          `Money ${Math.round(splits.spreadHomeMoneyPct)}% vs bets ${Math.round(
            splits.spreadHomeBetPct
          )}% leaning ${leaning}`
        )
      }
    }

    if (whaleAlerts && whaleAlerts.length > 0) {
      const respected = whaleAlerts.filter((alert) => alert.status === 'respected')
      for (const alert of respected) {
        const weight = resolveWhaleWeight(alert.notional)
        if (!weight) continue
        const selection = `${alert.marketTitle} ${alert.outcome}`
        const isHome = selectionMatchesTeam(selection, homeTeam)
        const isAway = selectionMatchesTeam(selection, awayTeam)
        if (isHome === isAway) continue
        if (isHome) homeWhaleBias += weight
        if (isAway) awayWhaleBias += weight
      }
    }

    const netSideBias = homeWhaleBias - awayWhaleBias
    if (netSideBias) {
      spreadAdjustment -= netSideBias
      const whaleFactor = summarizeWhaleBias(homeTeam, awayTeam, netSideBias)
      if (whaleFactor) factors.push(whaleFactor)
    }

    const targetLine = clampValue(
      marketSpread.line + spreadAdjustment,
      marketSpread.line - 3,
      marketSpread.line + 3
    )
    const signalCount =
      spreadSignals.length +
      (spreadMovement ? 1 : 0) +
      (factors.length > 0 ? 1 : 0)

    recommendations.push({
      type: 'spread',
      homeTeam,
      awayTeam,
      targetLine,
      confidence: resolveConfidence(signalCount),
      factors,
      recommendation: `${homeTeam} ${formatSignedLine(targetLine)} market-driven lean`,
    })
  }

  if (marketTotal) {
    let totalAdjustment = 0
    const factors: string[] = []
    let overWhaleBias = 0
    let underWhaleBias = 0

    if (totalMovement) {
      totalAdjustment += totalMovement.movement * 0.4
      factors.push(
        `Total moved ${formatSignedLine(totalMovement.openingLine)} to ${formatSignedLine(
          totalMovement.currentLine
        )}`
      )
    }

    for (const signal of totalSignals) {
      const adjustment = resolveTotalSignalAdjustment(signal)
      if (adjustment === 0) continue
      totalAdjustment += adjustment
      factors.push(`${signal.type} on ${signal.side} total`)
    }

    const splits = sharpResult?.splits
    if (
      splits?.totalOverBetPct != null &&
      splits?.totalOverMoneyPct != null
    ) {
      const divergence = splits.totalOverMoneyPct - splits.totalOverBetPct
      if (Math.abs(divergence) >= 10) {
        const leaning = divergence > 0 ? 'Over' : 'Under'
        const weight =
          Math.abs(divergence) >= 25
            ? 1.0
            : Math.abs(divergence) >= 20
              ? 0.8
              : 0.5
        totalAdjustment += leaning === 'Over' ? weight : -weight
        factors.push(
          `Money ${Math.round(splits.totalOverMoneyPct)}% vs bets ${Math.round(
            splits.totalOverBetPct
          )}% leaning ${leaning}`
        )
      }
    }

    if (whaleAlerts && whaleAlerts.length > 0) {
      const respected = whaleAlerts.filter((alert) => alert.status === 'respected')
      for (const alert of respected) {
        const weight = resolveWhaleWeight(alert.notional)
        if (!weight) continue
        const outcome = alert.outcome.toLowerCase()
        const isOver = outcome.includes('over')
        const isUnder = outcome.includes('under')
        if (!isOver && !isUnder) continue
        if (isOver) overWhaleBias += weight
        if (isUnder) underWhaleBias += weight
      }
    }

    const netTotalBias = overWhaleBias - underWhaleBias
    if (netTotalBias) {
      totalAdjustment += netTotalBias
      const whaleFactor = summarizeTotalWhaleBias(netTotalBias)
      if (whaleFactor) factors.push(whaleFactor)
    }

    const targetLine = clampValue(
      marketTotal.line + totalAdjustment,
      marketTotal.line - 6,
      marketTotal.line + 6
    )
    const signalCount =
      totalSignals.length +
      (totalMovement ? 1 : 0) +
      (factors.length > 0 ? 1 : 0)

    recommendations.push({
      type: 'total',
      homeTeam,
      awayTeam,
      targetLine,
      confidence: resolveConfidence(signalCount),
      factors,
      recommendation: `Total ${targetLine.toFixed(1)} market-driven lean`,
    })
  }

  return recommendations
}

const getFallbackTeamStats = (sportKey: string) => {
  if (sportKey === 'basketball_ncaab') {
    return { ortg: 105, drtg: 105, pace: 70 }
  }
  if (sportKey === 'basketball_nba') {
    return { ortg: 115, drtg: 115, pace: 100 }
  }
  return null
}

const NBA_MARGIN_STDDEV = 12

const buildModelMoneyline = (targetSpread?: number | null) => {
  if (!Number.isFinite(targetSpread)) return null
  const expectedMargin = -(targetSpread as number)
  const winProb = Math.max(0.01, Math.min(0.99, normalCDF(expectedMargin / NBA_MARGIN_STDDEV)))
  const homeOdds = probabilityToAmericanOdds(winProb)
  const awayOdds = probabilityToAmericanOdds(1 - winProb)
  return { homeOdds, awayOdds, homeProbability: winProb }
}

const buildMatchupFactorsFromStats = (
  homeTeam: string,
  awayTeam: string,
  homeStats: TeamStats | FootballTeamStats | HockeyTeamStats | null,
  awayStats: TeamStats | FootballTeamStats | HockeyTeamStats | null
) => {
  if (!homeStats || !awayStats) return []
  const factors: string[] = []

  if (
    'ortg' in homeStats &&
    'drtg' in homeStats &&
    'pace' in homeStats &&
    'ortg' in awayStats &&
    'drtg' in awayStats &&
    'pace' in awayStats
  ) {
    factors.push(
      `${homeTeam} ORtg: ${homeStats.ortg.toFixed(1)}, ${awayTeam} DRtg: ${awayStats.drtg.toFixed(1)}`
    )
    factors.push(
      `${awayTeam} ORtg: ${awayStats.ortg.toFixed(1)}, ${homeTeam} DRtg: ${homeStats.drtg.toFixed(1)}`
    )
    factors.push(`Pace: ${homeTeam} ${homeStats.pace.toFixed(1)}, ${awayTeam} ${awayStats.pace.toFixed(1)}`)
  } else if (
    'pointsForPerGame' in homeStats &&
    'pointsAgainstPerGame' in homeStats &&
    'pointsForPerGame' in awayStats &&
    'pointsAgainstPerGame' in awayStats
  ) {
    const homePpg = homeStats.pointsForPerGame
    const homePapg = homeStats.pointsAgainstPerGame
    const awayPpg = awayStats.pointsForPerGame
    const awayPapg = awayStats.pointsAgainstPerGame
    if (
      typeof homePpg === 'number' &&
      Number.isFinite(homePpg) &&
      typeof homePapg === 'number' &&
      Number.isFinite(homePapg) &&
      typeof awayPpg === 'number' &&
      Number.isFinite(awayPpg) &&
      typeof awayPapg === 'number' &&
      Number.isFinite(awayPapg)
    ) {
      factors.push(
        `${homeTeam} PPG: ${homePpg.toFixed(1)}, ${awayTeam} PAPG: ${awayPapg.toFixed(1)}`
      )
      factors.push(
        `${awayTeam} PPG: ${awayPpg.toFixed(1)}, ${homeTeam} PAPG: ${homePapg.toFixed(1)}`
      )
    }
  } else if (
    'goalsForPerGame' in homeStats &&
    'goalsAgainstPerGame' in homeStats &&
    'goalsForPerGame' in awayStats &&
    'goalsAgainstPerGame' in awayStats
  ) {
    factors.push(
      `${homeTeam} GPG: ${homeStats.goalsForPerGame.toFixed(2)}, ${awayTeam} GAA: ${awayStats.goalsAgainstPerGame.toFixed(2)}`
    )
    factors.push(
      `${awayTeam} GPG: ${awayStats.goalsForPerGame.toFixed(2)}, ${homeTeam} GAA: ${homeStats.goalsAgainstPerGame.toFixed(2)}`
    )
  }

  return factors
}

const buildFallbackRecommendations = (
  matchupAnalysis: MatchupAnalysis,
  sportKey: string
): GameRecommendation[] => {
  const homeStats = matchupAnalysis.homeTeam.stats
  const awayStats = matchupAnalysis.awayTeam.stats
  if (!homeStats || !awayStats) return []

  const resolvedSport = sportKey || 'basketball_nba'
  const factors = matchupAnalysis.context || []
  const confidence: GameRecommendation['confidence'] =
    factors.length >= 3 ? 'medium' : 'low'

  let targetSpread: number | null = null
  let targetTotal: number | null = null

  if (resolvedSport === 'basketball_ncaab') {
    const rawMargin = calculateFairSpread(
      homeStats as TeamStats,
      awayStats as TeamStats,
      matchupAnalysis.homeTeam.rest,
      matchupAnalysis.awayTeam.rest,
      matchupAnalysis.homeTeam.travel,
      matchupAnalysis.awayTeam.travel,
      matchupAnalysis.homeTeam.recentForm,
      matchupAnalysis.awayTeam.recentForm,
      undefined,
      NCAAB_LEAGUE_CONTEXT
    )
    targetSpread = -rawMargin
    targetTotal = calculateFairTotal(
      homeStats as TeamStats,
      awayStats as TeamStats,
      NCAAB_LEAGUE_CONTEXT
    )
    if (Math.abs(targetSpread) <= 8) {
      targetTotal = Number((targetTotal + 3.5).toFixed(1))
      factors.push('Late-game fouls assumed (<=8 pts): +3.5')
    }
  } else if (
    resolvedSport === 'americanfootball_nfl' ||
    resolvedSport === 'americanfootball_ncaaf'
  ) {
    const isNcaaf = resolvedSport === 'americanfootball_ncaaf'
    const leagueContext = isNcaaf
      ? {
          homeFieldAdvantage: 2.8,
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
    const rawMargin = calculateFairSpreadFootball(
      homeStats as FootballTeamStats,
      awayStats as FootballTeamStats,
      leagueContext
    )
    targetSpread = -rawMargin
    targetTotal = calculateFairTotalFootball(
      homeStats as FootballTeamStats,
      awayStats as FootballTeamStats,
      leagueContext
    )
    } else if (resolvedSport === 'icehockey_nhl') {
      const rawMargin = calculateFairSpreadHockey(
        homeStats as HockeyTeamStats,
        awayStats as HockeyTeamStats
      )
      targetSpread = -rawMargin
      targetTotal = calculateFairTotalHockey(
        homeStats as HockeyTeamStats,
        awayStats as HockeyTeamStats
      )
    } else if (resolvedSport === 'basketball_nba') {
      const rawMargin = calculateFairSpreadNba(
        homeStats as TeamStats,
        awayStats as TeamStats,
        matchupAnalysis.homeTeam.rest,
        matchupAnalysis.awayTeam.rest,
        matchupAnalysis.homeTeam.travel,
        matchupAnalysis.awayTeam.travel,
        matchupAnalysis.homeTeam.recentForm,
        matchupAnalysis.awayTeam.recentForm
      )
      targetSpread = -rawMargin
      targetTotal = calculateFairTotalNba(
        homeStats as TeamStats,
        awayStats as TeamStats
      )
    } else {
      const rawMargin = calculateFairSpread(
        homeStats as TeamStats,
        awayStats as TeamStats,
      matchupAnalysis.homeTeam.rest,
      matchupAnalysis.awayTeam.rest,
      matchupAnalysis.homeTeam.travel,
      matchupAnalysis.awayTeam.travel,
      matchupAnalysis.homeTeam.recentForm,
      matchupAnalysis.awayTeam.recentForm
    )
    targetSpread = -rawMargin
    targetTotal = calculateFairTotal(
      homeStats as TeamStats,
      awayStats as TeamStats
    )
  }

  const recommendations: GameRecommendation[] = []
  if (targetSpread != null) {
    recommendations.push({
      type: 'spread',
      homeTeam: matchupAnalysis.homeTeam.name,
      awayTeam: matchupAnalysis.awayTeam.name,
      targetLine: targetSpread,
      confidence,
      factors,
      recommendation: 'Fallback spread projection',
    })
  }
  if (targetTotal != null) {
    recommendations.push({
      type: 'total',
      homeTeam: matchupAnalysis.homeTeam.name,
      awayTeam: matchupAnalysis.awayTeam.name,
      targetLine: targetTotal,
      confidence,
      factors,
      recommendation: 'Fallback total projection',
    })
  }

  return recommendations
}

/**
 * Determine if sharp signals agree with model projection
 */
function analyzeSharpConfirmation(
  sharpResult: SharpEdgeResult | undefined,
  modelFavoredTeam: string,
  modelDirection?: 'over' | 'under'
): { agrees: boolean; signals: string[]; boost: number } {
  if (!sharpResult || sharpResult.sharpSignals.length === 0) {
    return { agrees: false, signals: [], boost: 0 }
  }

  const agreeingSignals: string[] = []
  let totalStrength = 0

  for (const signal of sharpResult.sharpSignals) {
    // Check if signal agrees with model
    const signalAgrees =
      (signal.market === 'spread' && signal.side === modelFavoredTeam) ||
      (signal.market === 'total' && modelDirection && signal.side.toLowerCase() === modelDirection)

    if (signalAgrees) {
      agreeingSignals.push(`${signal.type}: ${signal.description}`)
      totalStrength += signal.strength
    }
  }

  const agrees = agreeingSignals.length > 0
  // Boost: 0-2 based on agreeing signal strength (5 strength = 1.0 boost, 10+ = 2.0)
  const boost = agrees ? Math.min(2, totalStrength / 5) : 0

  return { agrees, signals: agreeingSignals, boost }
}

/**
 * Extract the best spread line from odds game
 */
function getBestSpread(game: OddsGame, side: 'home' | 'away'): { line: number; book: string; odds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; odds: number } | null = null

  for (const book of game.bookmakers) {
    if (isPredictionMarketBook(book)) continue
    const spreadMarket = book.markets?.find((m) => m.key === 'spreads')
    if (!spreadMarket) continue

    const teamName = side === 'home' ? game.home_team : game.away_team
    const outcome = spreadMarket.outcomes?.find((o) =>
      teamNameMatches(teamName, o.name)
    )
    if (!outcome?.point) continue

    // For spreads, better means more points for the side you're betting
    if (!best || (side === 'home' ? outcome.point > best.line : outcome.point > best.line)) {
      best = { line: outcome.point, book: book.title, odds: outcome.price }
    }
  }

  return best
}

function getBestSpreadByType(
  game: OddsGame,
  side: 'home' | 'away',
  type: 'sportsbook' | 'prediction'
): { line: number; book: string; odds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; odds: number } | null = null

  for (const book of game.bookmakers) {
    const isPrediction = isPredictionMarketBook(book)
    if (type === 'sportsbook' && isPrediction) continue
    if (type === 'prediction' && !isPrediction) continue
    const spreadMarket = book.markets?.find((m) => m.key === 'spreads')
    if (!spreadMarket) continue

    const teamName = side === 'home' ? game.home_team : game.away_team
    const outcome = spreadMarket.outcomes?.find((o) =>
      teamNameMatches(teamName, o.name)
    )
    if (!outcome?.point) continue

    if (!best || outcome.point > best.line) {
      best = { line: outcome.point, book: book.title, odds: outcome.price }
    }
  }

  return best
}

function getBestMoneyline(game: OddsGame, side: 'home' | 'away'): { odds: number; book: string } | null {
  if (!game.bookmakers?.length) return null

  let best: { odds: number; book: string } | null = null

  for (const book of game.bookmakers) {
    if (isPredictionMarketBook(book)) continue
    const moneylineMarket = book.markets?.find((m) => m.key === 'h2h')
    if (!moneylineMarket) continue

    const teamName = side === 'home' ? game.home_team : game.away_team
    const outcome = moneylineMarket.outcomes?.find((o) =>
      teamNameMatches(teamName, o.name)
    )
    if (outcome?.price == null) continue

    if (!best || outcome.price > best.odds) {
      best = { odds: outcome.price, book: book.title }
    }
  }

  return best
}

function getBestMoneylineByType(
  game: OddsGame,
  side: 'home' | 'away',
  type: 'sportsbook' | 'prediction'
): { odds: number; book: string } | null {
  if (!game.bookmakers?.length) return null

  let best: { odds: number; book: string } | null = null

  for (const book of game.bookmakers) {
    const isPrediction = isPredictionMarketBook(book)
    if (type === 'sportsbook' && isPrediction) continue
    if (type === 'prediction' && !isPrediction) continue
    const moneylineMarket = book.markets?.find((m) => m.key === 'h2h')
    if (!moneylineMarket) continue

    const teamName = side === 'home' ? game.home_team : game.away_team
    const outcome = moneylineMarket.outcomes?.find((o) =>
      teamNameMatches(teamName, o.name)
    )
    if (outcome?.price == null) continue

    if (!best || outcome.price > best.odds) {
      best = { odds: outcome.price, book: book.title }
    }
  }

  return best
}

/**
 * Extract the best total line from odds game
 */
function getBestTotal(game: OddsGame): { line: number; book: string; overOdds: number; underOdds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; overOdds: number; underOdds: number } | null = null

  for (const book of game.bookmakers) {
    if (isPredictionMarketBook(book)) continue
    const totalMarket = book.markets?.find((m) => m.key === 'totals')
    if (!totalMarket) continue

    const over = totalMarket.outcomes?.find((o) => o.name === 'Over')
    const under = totalMarket.outcomes?.find((o) => o.name === 'Under')
    if (!over?.point || !under?.point) continue

    if (!best) {
      best = { line: over.point, book: book.title, overOdds: over.price, underOdds: under.price }
    }
  }

  return best
}

function getBestTotalByType(
  game: OddsGame,
  type: 'sportsbook' | 'prediction'
): { line: number; book: string; overOdds: number; underOdds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; overOdds: number; underOdds: number } | null = null

  for (const book of game.bookmakers) {
    const isPrediction = isPredictionMarketBook(book)
    if (type === 'sportsbook' && isPrediction) continue
    if (type === 'prediction' && !isPrediction) continue
    const totalMarket = book.markets?.find((m) => m.key === 'totals')
    if (!totalMarket) continue

    const over = totalMarket.outcomes?.find((o) => o.name === 'Over')
    const under = totalMarket.outcomes?.find((o) => o.name === 'Under')
    if (!over?.point || !under?.point) continue

    if (!best || over.price > best.overOdds) {
      best = {
        line: over.point,
        book: book.title,
        overOdds: over.price,
        underOdds: under.price,
      }
    }
  }

  return best
}

/**
 * Analyze all games for a sport on a given date
 */
export async function analyzeSlateEdges(
  sportKey: string = 'basketball_nba',
  options: {
    limit?: number
    minEdge?: 'soft' | 'strong' // Only return games with at least this edge level
    includeProps?: boolean
    date?: string // YYYY-MM-DD (America/New_York)
  } = {}
): Promise<SlateEdgeResult> {
  const { limit = 15, minEdge, date } = options
  const sportLabel = SPORT_LABELS[sportKey] || sportKey
  const isCfb = sportKey === 'americanfootball_ncaaf'

  console.log(`[SLATE EDGE] Analyzing ${sportLabel} slate...`)

  // Fetch today's odds
  let oddsGames: OddsGame[] = []
  if (isCfb) {
    try {
      const sbdOdds = await fetchSbdOdds('ncaafb')
      oddsGames = mapSbdOddsToOddsGames('ncaafb', sbdOdds, [
        MARKETS.H2H,
        MARKETS.SPREADS,
        MARKETS.TOTALS,
      ])
    } catch (error) {
      console.error('[SLATE EDGE] Failed to fetch SBD odds for CFB:', error)
      oddsGames = []
    }
  } else {
    oddsGames = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })
  }

  if (!oddsGames?.length) {
    return {
      sport: sportKey,
      sportLabel,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0],
      gamesAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0, sharpConfirmed: 0 },
    }
  }

  // Fetch sharp signals for this sport (line movement, RLM, bet%/money% divergence)
  const sbdLeague = ODDS_API_TO_SBD[sportKey]
  let sharpResults: SharpEdgeResult[] = []
  if (sbdLeague) {
    try {
      console.log(`[SLATE EDGE] Fetching sharp signals for ${sbdLeague}...`)
      sharpResults = await detectSharpEdges([sbdLeague])
      console.log(`[SLATE EDGE] Found ${sharpResults.filter(r => r.hasEdge).length} games with sharp signals`)
    } catch (error) {
      console.error(`[SLATE EDGE] Failed to fetch sharp signals:`, error)
    }
  }

  let whaleTrades: WhaleTrade[] = []
  if (isCfb) {
    try {
      whaleTrades = await fetchWhaleTrades({
        limit: 100,
        minNotional: CFB_WHALE_MIN_NOTIONAL,
      })
    } catch (error) {
      console.error('[SLATE EDGE] Failed to fetch whale trades:', error)
    }
  }

  const whaleStatusCache = new Map<string, WhaleTradeWithStatus>()

  const resolveWhaleAlerts = async (
    homeTeam: string,
    awayTeam: string
  ): Promise<WhaleAlert[]> => {
    if (!isCfb || whaleTrades.length === 0) return []
    const relevant = whaleTrades.filter((trade) => {
      const text = `${trade.marketTitle} ${trade.outcome}`
      return (
        selectionMatchesTeam(text, homeTeam) &&
        selectionMatchesTeam(text, awayTeam)
      )
    })
    if (relevant.length === 0) return []
    const resolved = await Promise.all(
      relevant.map(async (trade) => {
        const cached = whaleStatusCache.get(trade.id)
        if (cached) return cached
        const evaluated = await evaluateWhaleRespect(trade)
        whaleStatusCache.set(trade.id, evaluated)
        return evaluated
      })
    )
    return buildWhaleAlertsForGame(resolved, homeTeam, awayTeam)
  }

  if (sportKey === 'basketball_nba') {
    try {
      console.log('[SLATE EDGE] Warming NBA.com team stats cache...')
      await getNBATeamStats()
    } catch (error) {
      console.warn('[SLATE EDGE] NBA.com warmup failed', error)
    }
  }

  // Filter to upcoming games (and recent in-progress) for projections.
  const now = new Date()
  const useDateOverride = Boolean(date)
  const upcomingWindowHours = isCfb
    ? 24 * 21
    : sportKey === 'basketball_ncaab' || sportKey === 'basketball_nba'
      ? 48
      : 24
  const windowEnd = new Date(now.getTime() + upcomingWindowHours * 60 * 60 * 1000)
  const threeHoursAgo = new Date(now.getTime() - 3 * 60 * 60 * 1000)

  // Calculate target date boundaries in US Eastern time for date override.
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const resolveTargetDate = () => {
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date
    const [month, day, year] = easternFormatter.format(now).split('/')
    return `${year}-${month}-${day}`
  }
  const targetDate = resolveTargetDate()
  const todayStartEastern = new Date(`${targetDate}T00:00:00-05:00`)
  const todayEndEastern = new Date(`${targetDate}T23:59:59-05:00`)

  const upcomingGames = oddsGames
    .filter((g) => {
      if (isCfb) return true
      const gameTime = new Date(g.commence_time)
      if (useDateOverride) {
        return gameTime >= todayStartEastern && gameTime <= todayEndEastern
      }
      return gameTime >= threeHoursAgo && gameTime <= windowEnd
    })
    .filter((game) => {
      if (!isCfb) return true
      return isCfbPlayoffMatchup(game.home_team, game.away_team)
    })
    .slice(0, limit)

  console.log(`[SLATE EDGE] Filtered ${oddsGames.length} odds games to ${upcomingGames.length} today's games`)

  const edges: GameEdgeAnalysis[] = []
  let strongEdges = 0
  let softEdges = 0
  let noEdges = 0
  let sharpConfirmedCount = 0
  const evByGameId = new Map<string, EVOpportunity[]>()

  try {
    const evOpps = await findEVOpportunities({
      sports: [sportKey],
      minEV: 3,
      includeProps: false,
      markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
      limit: 200,
    })
    for (const opportunity of evOpps) {
      if (!evByGameId.has(opportunity.gameId)) {
        evByGameId.set(opportunity.gameId, [])
      }
      evByGameId.get(opportunity.gameId)!.push(opportunity)
    }
  } catch (error) {
    console.error('[SLATE EDGE] Failed to fetch EV opportunities:', error)
  }

  // Helper for per-game timeout
  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
    ])
  }

  // Analyze all games in parallel for better performance
  console.log(`[SLATE EDGE] Starting parallel analysis of ${upcomingGames.length} games...`)
  const startTime = Date.now()

  const gamePromises = upcomingGames.map(async (game) => {
    try {
      const matchupLabel = `${game.away_team} @ ${game.home_team}`

      // Match sharp signals for this game by team name
      const sharpResult = sharpResults.find((r) => {
        const homeMatch =
          teamNameMatches(game.home_team, r.homeTeam) ||
          teamNameMatches(r.homeTeam, game.home_team)
        const awayMatch =
          teamNameMatches(game.away_team, r.awayTeam) ||
          teamNameMatches(r.awayTeam, game.away_team)
        return homeMatch && awayMatch
      })

      // Get market lines (needed for NCAAB market anchoring)
      const sportsbookSpread = getBestSpreadByType(game, 'home', 'sportsbook')
      const predictionSpread = getBestSpreadByType(game, 'home', 'prediction')
      const marketSpread = sportsbookSpread ?? predictionSpread
      const sportsbookTotal = getBestTotalByType(game, 'sportsbook')
      const predictionTotal = getBestTotalByType(game, 'prediction')
      const marketTotal = sportsbookTotal ?? predictionTotal
      const sportsbookMoneylineHome = getBestMoneylineByType(game, 'home', 'sportsbook')
      const sportsbookMoneylineAway = getBestMoneylineByType(game, 'away', 'sportsbook')
      const predictionMoneylineHome = getBestMoneylineByType(game, 'home', 'prediction')
      const predictionMoneylineAway = getBestMoneylineByType(game, 'away', 'prediction')
      const fallbackStats = getFallbackTeamStats(sportKey)
      const matchupTimeoutMs =
        sportKey === 'basketball_ncaab'
          ? 20000
          : sportKey === 'basketball_nba'
            ? 45000
            : 8000

      const matchupAnalysis = isCfb
        ? {
            homeTeam: { name: game.home_team, stats: null },
            awayTeam: { name: game.away_team, stats: null },
            context: [],
          }
        : await withTimeout(
            analyzeMatchup(
              game.home_team,
              game.away_team,
              undefined,
              undefined,
              sportKey
            ),
            matchupTimeoutMs,
            {
              homeTeam: { name: game.home_team, stats: fallbackStats },
              awayTeam: { name: game.away_team, stats: fallbackStats },
              context: [],
            }
          )

      const marketContext = {
        marketSpread: marketSpread?.line,
        marketTotal: marketTotal?.line,
        sharpSignals: sharpResult?.sharpSignals,
        sharpSplits: sharpResult?.splits,
      }
      const whaleAlerts = isCfb
        ? await resolveWhaleAlerts(game.home_team, game.away_team)
        : []

      const recommendationTimeoutMs =
        sportKey === 'basketball_ncaab'
          ? 12000
          : sportKey === 'basketball_nba'
            ? 25000
            : 8000
      let recommendations: GameRecommendation[] = []
      if (isCfb) {
        recommendations = buildCfbMarketRecommendations({
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          marketSpread,
          marketTotal,
          sharpResult,
          whaleAlerts,
        })
      } else {
        recommendations = await withTimeout(
          getGameRecommendations(
            game.home_team,
            game.away_team,
            'all',
            sportKey,
            marketContext,
            matchupAnalysis
          ),
          recommendationTimeoutMs,
          []
        )
        if (recommendations.length === 0 && sportKey === 'basketball_ncaab') {
          recommendations = await getGameRecommendations(
            game.home_team,
            game.away_team,
            'all',
            sportKey,
            marketContext,
            matchupAnalysis
          )
        }
        if (recommendations.length === 0) {
          recommendations = buildFallbackRecommendations(matchupAnalysis, sportKey)
        }
      }

      const spreadRec = recommendations.find((r) => r.type === 'spread')
      const totalRec = recommendations.find((r) => r.type === 'total')
      const modelMoneyline = buildModelMoneyline(spreadRec?.targetLine)

      let spreadEdge: EdgeAssessment | undefined
      let totalEdge: EdgeAssessment | undefined

      // Evaluate spread edge
      if (spreadRec && marketSpread) {
        spreadEdge = evaluateLineEdge({
          marketType: 'spread',
          line: marketSpread.line,
          targetLine: spreadRec.targetLine,
          supportingSignals: spreadRec.factors.length,
        })
      }

      // Evaluate total edge
      if (totalRec && marketTotal) {
        totalEdge = evaluateLineEdge({
          marketType: 'total',
          line: marketTotal.line,
          targetLine: totalRec.targetLine,
          supportingSignals: totalRec.factors.length,
        })
      }

      // Track edge counts
      const hasStrongEdge = spreadEdge?.verdict === 'strong' || totalEdge?.verdict === 'strong'
      const hasSoftEdge = spreadEdge?.verdict === 'soft' || totalEdge?.verdict === 'soft'
      const edgeType = hasStrongEdge ? 'strong' : hasSoftEdge ? 'soft' : 'none'

      // Filter based on minEdge option (return null to skip)
      if (minEdge === 'strong' && !hasStrongEdge) return { skipped: true, edgeType }
      if (minEdge === 'soft' && !hasStrongEdge && !hasSoftEdge) return { skipped: true, edgeType }

      // Separate injuries from other factors
      const allFactors = matchupAnalysis.context || []
      const injuries: string[] = []
      const matchupFactors: string[] = []

      for (const factor of allFactors) {
        const lowerFactor = factor.toLowerCase()
        if (lowerFactor.includes('injur') || lowerFactor.includes('out)') ||
            lowerFactor.includes('(out') || lowerFactor.includes('(doubtful') ||
            lowerFactor.includes('(questionable')) {
          injuries.push(factor)
        } else if (
          lowerFactor.includes('ortg') ||
          lowerFactor.includes('drtg') ||
          lowerFactor.includes('pace') ||
          lowerFactor.includes('ppg') ||
          lowerFactor.includes('papg') ||
          lowerFactor.includes('yards/play') ||
          lowerFactor.includes('points/drive') ||
          lowerFactor.includes('3rd down') ||
          lowerFactor.includes('red zone') ||
          lowerFactor.includes('explosive') ||
          lowerFactor.includes('sack rate') ||
          lowerFactor.includes('yards allowed') ||
          lowerFactor.includes('turnover') ||
          lowerFactor.includes('gpg') ||
          lowerFactor.includes('gaa') ||
          lowerFactor.includes('goals') ||
          lowerFactor.includes('ats')
        ) {
          matchupFactors.push(factor)
        }
      }
      if (matchupFactors.length === 0 && !isCfb) {
        const fallbackFactors = buildMatchupFactorsFromStats(
          game.home_team,
          game.away_team,
          matchupAnalysis.homeTeam.stats as TeamStats | FootballTeamStats | HockeyTeamStats | null,
          matchupAnalysis.awayTeam.stats as TeamStats | FootballTeamStats | HockeyTeamStats | null
        )
        if (fallbackFactors.length > 0) {
          matchupFactors.push(...fallbackFactors)
        }
      }

      // Determine which team the model spread favors
      // In betting convention: negative spread = favorite (that team gives points)
      const modelFavoredTeam = spreadRec && spreadRec.targetLine < 0
        ? game.home_team  // Home is favorite (negative spread)
        : game.away_team  // Away is favorite (home has positive spread)

      // Determine model direction for total (over/under)
      const modelTotalDirection: 'over' | 'under' | undefined = totalRec && marketTotal
        ? totalRec.targetLine > marketTotal.line ? 'over' : 'under'
        : undefined

      // Analyze if sharp signals confirm model projection
      const spreadConfirmation = analyzeSharpConfirmation(sharpResult, modelFavoredTeam)
      const totalConfirmation = analyzeSharpConfirmation(sharpResult, '', modelTotalDirection)

      // Combine confirmations
      const hasSharpConfirmation = spreadConfirmation.agrees || totalConfirmation.agrees

      // Boost confidence if sharp signals agree
      let adjustedConfidence = spreadRec?.confidence || totalRec?.confidence || 'low'
      const totalBoost = spreadConfirmation.boost + totalConfirmation.boost
      if (totalBoost >= 1.5 && adjustedConfidence === 'medium') {
        adjustedConfidence = 'high'
      } else if (totalBoost >= 1.0 && adjustedConfidence === 'low') {
        adjustedConfidence = 'medium'
      }

      const gameAnalysis: GameEdgeAnalysis = {
        matchup: matchupLabel,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
        homeStats: matchupAnalysis.homeTeam.stats,
        awayStats: matchupAnalysis.awayTeam.stats,
        moneyline:
          sportsbookMoneylineHome ||
          sportsbookMoneylineAway ||
          predictionMoneylineHome ||
          predictionMoneylineAway ||
          modelMoneyline
            ? {
                sportsbook: {
                  homeOdds: sportsbookMoneylineHome?.odds,
                  homeBook: sportsbookMoneylineHome?.book,
                  awayOdds: sportsbookMoneylineAway?.odds,
                  awayBook: sportsbookMoneylineAway?.book,
                },
                model: modelMoneyline
                  ? {
                      homeOdds: modelMoneyline.homeOdds,
                      awayOdds: modelMoneyline.awayOdds,
                      homeProbability: modelMoneyline.homeProbability,
                    }
                  : undefined,
                prediction: {
                  homeOdds: predictionMoneylineHome?.odds,
                  homeBook: predictionMoneylineHome?.book,
                  awayOdds: predictionMoneylineAway?.odds,
                  awayBook: predictionMoneylineAway?.book,
                },
              }
            : undefined,
        confidence: adjustedConfidence,
        factors: spreadRec?.factors || totalRec?.factors || [],
        injuries,
        matchupFactors,
        sharpSignals: sharpResult?.sharpSignals || [],
        lineMovements: sharpResult?.lineMovements || [],
        splits: sharpResult?.splits,
        whaleAlerts: whaleAlerts.length ? whaleAlerts : undefined,
        sharpConfirmation: hasSharpConfirmation ? {
          agrees: true,
          signals: [...spreadConfirmation.signals, ...totalConfirmation.signals],
          boost: totalBoost,
        } : undefined,
      }

      const evOpportunities = evByGameId.get(game.id) || []
      const highEv: GameEdgeAnalysis['highEv'] = {}

      if (spreadRec && spreadEdge && spreadEdge.verdict !== 'none') {
        const evPick = pickBestEv(
          evOpportunities,
          'Spread',
          (opportunity) => selectionMatchesTeam(opportunity.selection, modelFavoredTeam),
          marketSpread?.line
        )
        if (evPick) {
          highEv.spread = evPick
        }
      }

      if (totalRec && totalEdge && totalEdge.verdict !== 'none') {
        const direction = modelTotalDirection === 'over' ? 'over' : 'under'
        const evPick = pickBestEv(
          evOpportunities,
          'Total',
          (opportunity) =>
            opportunity.selection.toLowerCase().includes(direction),
          marketTotal?.line
        )
        if (evPick) {
          highEv.total = evPick
        }
      }

      if (highEv.spread || highEv.total) {
        gameAnalysis.highEv = highEv
      }

      if (spreadRec && marketSpread && spreadEdge) {
        gameAnalysis.spread = {
          marketLine: marketSpread.line,
          targetLine: spreadRec.targetLine,
          edge: spreadEdge,
          bestBook: marketSpread.book,
          bestOdds: marketSpread.odds,
          prediction: predictionSpread || undefined,
          favoredTeam: modelFavoredTeam,
          sharpConfirmed: spreadConfirmation.agrees,
        }
      }

      if (totalRec && marketTotal && totalEdge) {
        gameAnalysis.total = {
          marketLine: marketTotal.line,
          targetLine: totalRec.targetLine,
          edge: totalEdge,
          bestBook: marketTotal.book,
          bestOdds: marketTotal.overOdds,
          bestUnderOdds: marketTotal.underOdds,
          prediction: predictionTotal || undefined,
          sharpConfirmed: totalConfirmation.agrees,
        }
      }

      return { skipped: false, edgeType, analysis: gameAnalysis, sharpConfirmed: hasSharpConfirmation }
    } catch (error) {
      console.error(`[SLATE EDGE] Error analyzing ${game.home_team} vs ${game.away_team}:`, error)
      return { skipped: true, edgeType: 'none' as const, error: true }
    }
  })

  // Wait for all game analyses with overall timeout (45 seconds)
  const gameResults = await Promise.allSettled(gamePromises)

  // Process results
  for (const result of gameResults) {
    if (result.status === 'fulfilled' && result.value && !result.value.skipped && result.value.analysis) {
      edges.push(result.value.analysis)
      if (result.value.sharpConfirmed) sharpConfirmedCount++
    }
    // Count edge types for summary
    if (result.status === 'fulfilled' && result.value) {
      if (result.value.edgeType === 'strong') strongEdges++
      else if (result.value.edgeType === 'soft') softEdges++
      else noEdges++
    }
  }

  const elapsedMs = Date.now() - startTime
  console.log(`[SLATE EDGE] Parallel analysis complete: ${edges.length}/${upcomingGames.length} games with edges in ${elapsedMs}ms`)

  // Sort by edge strength (strong first, then soft), with sharp confirmation as tiebreaker
  edges.sort((a, b) => {
    const getEdgeScore = (g: GameEdgeAnalysis) => {
      let score = 0
      if (g.spread?.edge.verdict === 'strong') score += 10
      else if (g.spread?.edge.verdict === 'soft') score += 5
      if (g.total?.edge.verdict === 'strong') score += 10
      else if (g.total?.edge.verdict === 'soft') score += 5
      // Bonus for sharp confirmation
      if (g.sharpConfirmation?.agrees) score += 3
      if (g.spread?.sharpConfirmed) score += 2
      if (g.total?.sharpConfirmed) score += 2
      return score
    }
    return getEdgeScore(b) - getEdgeScore(a)
  })

  const shouldIncludeProps =
    options.includeProps !== false &&
    (sportKey === 'basketball_nba' ||
      sportKey === 'basketball_ncaab' ||
      sportKey === 'americanfootball_nfl' ||
      sportKey === 'americanfootball_ncaaf' ||
      sportKey === 'icehockey_nhl')
  const propResult = shouldIncludeProps
    ? await analyzeSlatePropEdges(sportKey, { limit: 25 })
    : null

  return {
    sport: sportKey,
    sportLabel,
    date: targetDate,
    gamesAnalyzed: upcomingGames.length,
    edges,
    propEdges: propResult?.edges,
    propSummary: propResult
      ? {
          strongEdges: propResult.summary.strongEdges,
          softEdges: propResult.summary.softEdges,
          noEdges: propResult.summary.noEdges,
          propsAnalyzed: propResult.propsAnalyzed,
        }
      : undefined,
    summary: { strongEdges, softEdges, noEdges, sharpConfirmed: sharpConfirmedCount },
  }
}

/**
 * Format slate edge results for chat output
 */
export function formatSlateEdgesForChat(result: SlateEdgeResult): string {
  if (result.gamesAnalyzed === 0) {
    return `No ${result.sportLabel} games found for ${result.date}.`
  }

  const lines: string[] = []

  lines.push(`## ${result.sportLabel} Edge Detection - ${result.date}`)
  lines.push('')
  lines.push(`**Games Analyzed:** ${result.gamesAnalyzed}`)
  lines.push(`**Summary:** ${result.summary.strongEdges} strong edges | ${result.summary.softEdges} soft edges | ${result.summary.noEdges} no edge | ${result.summary.sharpConfirmed} sharp-confirmed`)
  if (result.summary.sharpConfirmed > 0) {
    lines.push('Sharp confirmations are highlighted below.')
  }
  lines.push('')

  if (result.edges.length === 0 && (!result.propEdges || result.propEdges.length === 0)) {
    lines.push("No significant edges detected in today's slate.")
    return lines.join('\n')
  }

  if (result.edges.length === 0) {
    lines.push("No significant game edges detected in today's slate.")
    lines.push('')
  }

  const strongEdgeGames = result.edges.filter(
    (g) => g.spread?.edge.verdict === 'strong' || g.total?.edge.verdict === 'strong'
  )
  const softEdgeGames = result.edges.filter(
    (g) =>
      !strongEdgeGames.includes(g) &&
      (g.spread?.edge.verdict === 'soft' || g.total?.edge.verdict === 'soft')
  )

  if (strongEdgeGames.length > 0) {
    lines.push('### Strong Edges')
    lines.push('')
    for (const game of strongEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  if (softEdgeGames.length > 0) {
    lines.push('### Soft Edges')
    lines.push('')
    for (const game of softEdgeGames) {
      lines.push(formatGameEdge(game))
      lines.push('')
    }
  }

  if (strongEdgeGames.length === 0 && softEdgeGames.length === 0) {
    const signalGames = result.edges.filter(
      (game) =>
        game.sharpSignals.length > 0 ||
        game.lineMovements.some((move) => move.isSharp || move.isSignificant) ||
        game.highEv?.spread ||
        game.highEv?.total
    )
    if (signalGames.length > 0) {
      const scored = signalGames
        .map((game) => ({ game, score: scoreMarketSignals(game) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)

      lines.push('### Market Signals (no model edge yet)')
      lines.push('')
      for (const entry of scored) {
        lines.push(formatMarketSignals(entry.game))
        lines.push('')
      }
    }
  }

  if (result.propEdges && result.propEdges.length > 0) {
    lines.push('')
    lines.push(
      formatSlatePropEdgesForChat({
        sport: result.sport,
        sportLabel: result.sportLabel,
        date: result.date,
        propsAnalyzed: result.propSummary?.propsAnalyzed || result.propEdges.length,
        edges: result.propEdges,
        summary: {
          strongEdges: result.propSummary?.strongEdges || 0,
          softEdges: result.propSummary?.softEdges || 0,
          noEdges: result.propSummary?.noEdges || 0,
        },
      })
    )
  }

  return lines.join('\n')
}

function scoreMarketSignals(game: GameEdgeAnalysis): number {
  const sharpCount = game.sharpSignals.length
  const moveCount = game.lineMovements.filter(
    (move) => move.isSharp || move.isSignificant
  ).length
  const evScore =
    (game.highEv?.spread?.ev || 0) +
    (game.highEv?.total?.ev || 0)
  const confirmationBonus = game.sharpConfirmation?.agrees ? 2 : 0
  return sharpCount * 2 + moveCount + evScore / 2 + confirmationBonus
}

type BestBetCandidate = {
  label: string
  score: number
  gap: number
}

const formatSignedLine = (line: number) => (line > 0 ? `+${line}` : `${line}`)

function selectBestBet(game: GameEdgeAnalysis): string {
  const candidates: BestBetCandidate[] = []

  if (game.spread) {
    const gap = Math.abs(game.spread.marketLine - game.spread.targetLine)
    const pickHome = game.spread.targetLine < game.spread.marketLine
    const team = pickHome ? game.homeTeam : game.awayTeam
    const line = pickHome ? game.spread.marketLine : -game.spread.marketLine
    const score =
      game.spread.edge.verdict === 'strong'
        ? 2
        : game.spread.edge.verdict === 'soft'
          ? 1
          : 0
    candidates.push({
      label: `Spread ${team} ${formatSignedLine(line)}`,
      score,
      gap,
    })
  }

  if (game.total) {
    const gap = Math.abs(game.total.marketLine - game.total.targetLine)
    const direction = game.total.targetLine > game.total.marketLine ? 'Over' : 'Under'
    const score =
      game.total.edge.verdict === 'strong'
        ? 2
        : game.total.edge.verdict === 'soft'
          ? 1
          : 0
    candidates.push({
      label: `Total ${direction} ${game.total.marketLine}`,
      score,
      gap,
    })
  }

  const best = candidates.reduce<BestBetCandidate | null>((currentBest, next) => {
    if (!currentBest) return next
    if (next.score !== currentBest.score) {
      return next.score > currentBest.score ? next : currentBest
    }
    return next.gap > currentBest.gap ? next : currentBest
  }, null)

  const highEvCandidates: Array<{ label: string; ev: number }> = []
  if (game.highEv?.spread) {
    const point =
      game.highEv.spread.point != null
        ? ` ${game.highEv.spread.point > 0 ? '+' : ''}${game.highEv.spread.point}`
        : ''
    highEvCandidates.push({
      label: `Spread ${game.highEv.spread.selection}${point}`,
      ev: game.highEv.spread.ev,
    })
  }
  if (game.highEv?.total) {
    const point =
      game.highEv.total.point != null
        ? ` ${game.highEv.total.point > 0 ? '+' : ''}${game.highEv.total.point}`
        : ''
    highEvCandidates.push({
      label: `Total ${game.highEv.total.selection}${point}`,
      ev: game.highEv.total.ev,
    })
  }
  const bestHighEv = highEvCandidates.sort((a, b) => b.ev - a.ev)[0]

  if (best && best.score > 0) return best.label
  if (bestHighEv) return `High EV ${bestHighEv.label}`
  if (best) return 'No edge (pass)'
  return 'No edge (pass)'
}

function formatMarketSignals(game: GameEdgeAnalysis): string {
  const lines: string[] = []
  const time = new Date(game.commenceTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
  const sharpTag = game.sharpConfirmation?.agrees ? ' [SHARP CONFIRMED]' : ''
  lines.push(`**${game.matchup}** (${time})${sharpTag}`)

  if (game.moneyline?.sportsbook) {
    const awayLine = game.moneyline.sportsbook.awayOdds != null
      ? `${game.awayTeam} ${formatOdds(game.moneyline.sportsbook.awayOdds)}${game.moneyline.sportsbook.awayBook ? ` (${game.moneyline.sportsbook.awayBook})` : ''}`
      : ''
    const homeLine = game.moneyline.sportsbook.homeOdds != null
      ? `${game.homeTeam} ${formatOdds(game.moneyline.sportsbook.homeOdds)}${game.moneyline.sportsbook.homeBook ? ` (${game.moneyline.sportsbook.homeBook})` : ''}`
      : ''
    if (awayLine || homeLine) {
      lines.push(`- Moneyline (Sportsbook best): ${[awayLine, homeLine].filter(Boolean).join(' | ')}`)
    }
  }
  if (game.moneyline?.prediction) {
    const awayLine = game.moneyline.prediction.awayOdds != null
      ? `${game.awayTeam} ${formatOdds(game.moneyline.prediction.awayOdds)}${game.moneyline.prediction.awayBook ? ` (${game.moneyline.prediction.awayBook})` : ''}`
      : ''
    const homeLine = game.moneyline.prediction.homeOdds != null
      ? `${game.homeTeam} ${formatOdds(game.moneyline.prediction.homeOdds)}${game.moneyline.prediction.homeBook ? ` (${game.moneyline.prediction.homeBook})` : ''}`
      : ''
    if (awayLine || homeLine) {
      lines.push(`- Moneyline (Prediction best): ${[awayLine, homeLine].filter(Boolean).join(' | ')}`)
    }
  }

  if (game.spread) {
    const homeTeamShort = game.homeTeam.split(' ').pop() || game.homeTeam
    const marketLine =
      game.spread.marketLine > 0
        ? `+${game.spread.marketLine}`
        : `${game.spread.marketLine}`
    const modelLine =
      game.spread.targetLine > 0
        ? `+${game.spread.targetLine.toFixed(1)}`
        : game.spread.targetLine.toFixed(1)
    lines.push(
      `- Spread: Market ${marketLine} ${homeTeamShort}${game.spread.bestBook ? ` (${game.spread.bestBook} ${formatOdds(game.spread.bestOdds as number)})` : ''} | Model ${modelLine} ${homeTeamShort}`
    )
    if (game.spread.prediction) {
      const predictionLine = game.spread.prediction.line > 0
        ? `+${game.spread.prediction.line}`
        : `${game.spread.prediction.line}`
      lines.push(
        `- Spread (Prediction best): Market ${predictionLine} ${homeTeamShort} (${game.spread.prediction.book} ${formatOdds(game.spread.prediction.odds)})`
      )
    }
  }

  if (game.total) {
    const overOdds = formatOdds(game.total.bestOdds as number) || 'n/a'
    const underOdds = formatOdds(game.total.bestUnderOdds as number) || 'n/a'
    lines.push(
      `- Total: Market ${game.total.marketLine} (${game.total.bestBook ?? 'Market'} O ${overOdds} / U ${underOdds}) | Model ${game.total.targetLine.toFixed(1)}`
    )
    if (game.total.prediction) {
      lines.push(
        `- Total (Prediction best): Market ${game.total.prediction.line} (${game.total.prediction.book} O ${formatOdds(game.total.prediction.overOdds)} / U ${formatOdds(game.total.prediction.underOdds)})`
      )
    }
  }

  lines.push(`- Best Bet: ${selectBestBet(game)}`)

  if (game.sharpSignals.length > 0) {
    const signalSummary = game.sharpSignals
      .slice(0, 3)
      .map(
        (signal) =>
          `${signal.type} ${signal.market} ${signal.side} (${signal.strength}/5)`
      )
      .join('; ')
    lines.push(`- Market signals: ${signalSummary}`)
  }

  const significantMoves = game.lineMovements.filter(
    (move) => move.isSharp || move.isSignificant
  )
  if (significantMoves.length > 0) {
    const moveSummary = significantMoves
      .slice(0, 2)
      .map((move) => `${move.market}: ${move.openingLine} -> ${move.currentLine}`)
      .join(', ')
    lines.push(`- Line movement: ${moveSummary}`)
  }

  if (game.highEv?.spread) {
    const ev = game.highEv.spread
    const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
    lines.push(
      `- High EV: Spread ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
        ev.bestOdds
      )} (EV ${ev.ev.toFixed(1)}%)`
    )
  }

  if (game.highEv?.total) {
    const ev = game.highEv.total
    const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
    lines.push(
      `- High EV: Total ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
        ev.bestOdds
      )} (EV ${ev.ev.toFixed(1)}%)`
    )
  }

  return lines.join('\n')
}

const formatMatchupStats = (
  homeTeam: string,
  awayTeam: string,
  homeStats?: TeamStats | FootballTeamStats | HockeyTeamStats | null,
  awayStats?: TeamStats | FootballTeamStats | HockeyTeamStats | null
): string | null => {
  if (!homeStats || !awayStats) return null
  const hasRatings =
    typeof (homeStats as any).ortg === 'number' &&
    typeof (homeStats as any).drtg === 'number' &&
    typeof (homeStats as any).pace === 'number' &&
    typeof (awayStats as any).ortg === 'number' &&
    typeof (awayStats as any).drtg === 'number' &&
    typeof (awayStats as any).pace === 'number'
  if (hasRatings) {
    return `${homeTeam} ORtg ${(homeStats as any).ortg.toFixed(1)} DRtg ${(homeStats as any).drtg.toFixed(
      1
    )} Pace ${(homeStats as any).pace.toFixed(1)} | ${awayTeam} ORtg ${(awayStats as any).ortg.toFixed(
      1
    )} DRtg ${(awayStats as any).drtg.toFixed(1)} Pace ${(awayStats as any).pace.toFixed(1)}`
  }
  const hasPpg =
    typeof (homeStats as any).pointsForPerGame === 'number' &&
    typeof (homeStats as any).pointsAgainstPerGame === 'number' &&
    typeof (awayStats as any).pointsForPerGame === 'number' &&
    typeof (awayStats as any).pointsAgainstPerGame === 'number'
  if (hasPpg) {
    return `${homeTeam} PPG ${(homeStats as any).pointsForPerGame.toFixed(
      1
    )} PAPG ${(homeStats as any).pointsAgainstPerGame.toFixed(1)} | ${awayTeam} PPG ${(awayStats as any).pointsForPerGame.toFixed(
      1
    )} PAPG ${(awayStats as any).pointsAgainstPerGame.toFixed(1)}`
  }
  return null
}

function formatGameEdge(game: GameEdgeAnalysis): string {
  const lines: string[] = []
  const time = new Date(game.commenceTime).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })

  const sharpTag = game.sharpConfirmation?.agrees ? ' [SHARP CONFIRMED]' : ''
  lines.push(`**${game.matchup}** (${time})${sharpTag}`)

  if (game.moneyline?.sportsbook) {
    const awayLine = game.moneyline.sportsbook.awayOdds != null
      ? `${game.awayTeam} ${formatOdds(game.moneyline.sportsbook.awayOdds)}${game.moneyline.sportsbook.awayBook ? ` (${game.moneyline.sportsbook.awayBook})` : ''}`
      : ''
    const homeLine = game.moneyline.sportsbook.homeOdds != null
      ? `${game.homeTeam} ${formatOdds(game.moneyline.sportsbook.homeOdds)}${game.moneyline.sportsbook.homeBook ? ` (${game.moneyline.sportsbook.homeBook})` : ''}`
      : ''
    if (awayLine || homeLine) {
      lines.push(`- Moneyline (Sportsbook best): ${[awayLine, homeLine].filter(Boolean).join(' | ')}`)
    }
  }
  if (game.moneyline?.prediction) {
    const awayLine = game.moneyline.prediction.awayOdds != null
      ? `${game.awayTeam} ${formatOdds(game.moneyline.prediction.awayOdds)}${game.moneyline.prediction.awayBook ? ` (${game.moneyline.prediction.awayBook})` : ''}`
      : ''
    const homeLine = game.moneyline.prediction.homeOdds != null
      ? `${game.homeTeam} ${formatOdds(game.moneyline.prediction.homeOdds)}${game.moneyline.prediction.homeBook ? ` (${game.moneyline.prediction.homeBook})` : ''}`
      : ''
    if (awayLine || homeLine) {
      lines.push(`- Moneyline (Prediction best): ${[awayLine, homeLine].filter(Boolean).join(' | ')}`)
    }
  }

  const statsLine = formatMatchupStats(
    game.homeTeam,
    game.awayTeam,
    game.homeStats,
    game.awayStats
  )
  if (statsLine) {
    lines.push(`- Stats: ${statsLine}`)
  }

  if (game.sharpSignals.length > 0) {
    const signalSummary = game.sharpSignals
      .slice(0, 3)
      .map(
        (signal) =>
          `${signal.type} ${signal.market} ${signal.side} (${signal.strength}/5)`
      )
      .join('; ')
    const notes = game.sharpSignals
      .slice(0, 2)
      .map((signal) => signal.description)
      .join(' | ')
    lines.push(`- SHARP LEAN: ${signalSummary}`)
    if (notes) {
      lines.push(`- Sharp notes: ${notes}`)
    }
  }

  if (game.spread) {
    const edgeEmoji = game.spread.edge.verdict === 'strong' ? '🔥' : game.spread.edge.verdict === 'soft' ? '✓' : '—'
    const sharpEmoji = game.spread.sharpConfirmed ? ' ⚡' : ''
    const gap = Math.abs(game.spread.marketLine - game.spread.targetLine).toFixed(1)

    // Format spreads from HOME team's perspective for consistency
    // Positive = home is underdog, Negative = home is favorite
    const homeTeamShort = game.homeTeam.split(' ').pop() || game.homeTeam
    const marketLineFormatted = game.spread.marketLine > 0 ? `+${game.spread.marketLine}` : `${game.spread.marketLine}`
    const modelLineFormatted = game.spread.targetLine > 0 ? `+${game.spread.targetLine.toFixed(1)}` : game.spread.targetLine.toFixed(1)

    lines.push(
      `- ${edgeEmoji} **Spread:** Market ${marketLineFormatted} ${homeTeamShort}${game.spread.bestBook ? ` (${game.spread.bestBook} ${formatOdds(game.spread.bestOdds as number)})` : ''} | Model ${modelLineFormatted} ${homeTeamShort} | Gap: ${gap} pts${sharpEmoji}`
    )
    if (game.spread.prediction) {
      const predictionLine = game.spread.prediction.line > 0
        ? `+${game.spread.prediction.line}`
        : `${game.spread.prediction.line}`
      lines.push(
        `- Prediction Market Spread: ${predictionLine} ${homeTeamShort} (${game.spread.prediction.book} ${formatOdds(game.spread.prediction.odds)})`
      )
    }
    if (game.spread.edge.flag) {
      lines.push(`  - ⚠️ ${game.spread.edge.flag}`)
    }
    if (game.highEv?.spread) {
      const ev = game.highEv.spread
      const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
      lines.push(
        `- HIGH EV + EDGE: Spread ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
          ev.bestOdds
        )} (EV ${ev.ev.toFixed(1)}%)`
      )
    }
  }

  if (game.total) {
    const edgeEmoji = game.total.edge.verdict === 'strong' ? '🔥' : game.total.edge.verdict === 'soft' ? '✓' : '—'
    const sharpEmoji = game.total.sharpConfirmed ? ' ⚡' : ''
    const gap = Math.abs(game.total.marketLine - game.total.targetLine).toFixed(1)
    const direction = game.total.targetLine > game.total.marketLine ? 'OVER' : 'UNDER'
    const overOdds = formatOdds(game.total.bestOdds as number) || 'n/a'
    const underOdds = formatOdds(game.total.bestUnderOdds as number) || 'n/a'
    lines.push(
      `- ${edgeEmoji} **Total:** Market ${game.total.marketLine} (${game.total.bestBook ?? 'Market'} O ${overOdds} / U ${underOdds}) | Model ${game.total.targetLine.toFixed(1)} | Gap: ${gap} pts → ${direction}${sharpEmoji}`
    )
    if (game.total.prediction) {
      lines.push(
        `- Prediction Market Total: ${game.total.prediction.line} (${game.total.prediction.book} O ${formatOdds(game.total.prediction.overOdds)} / U ${formatOdds(game.total.prediction.underOdds)})`
      )
    }
    if (game.total.edge.flag) {
      lines.push(`  - ⚠️ ${game.total.edge.flag}`)
    }
    if (game.highEv?.total) {
      const ev = game.highEv.total
      const point = ev.point != null ? ` ${ev.point > 0 ? '+' : ''}${ev.point}` : ''
      lines.push(
        `- HIGH EV + EDGE: Total ${ev.selection}${point} at ${ev.bestBook} ${formatOdds(
          ev.bestOdds
        )} (EV ${ev.ev.toFixed(1)}%)`
      )
    }
  }

  lines.push(`- Best Bet: ${selectBestBet(game)}`)

  // Show injuries prominently if present
  if (game.injuries.length > 0) {
    lines.push(`- 🏥 **Injuries:** ${game.injuries.slice(0, 3).join('; ')}`)
  }

  // Show line movement if significant
  const significantMoves = game.lineMovements.filter((m) => m.isSharp || m.isSignificant)
  if (significantMoves.length > 0) {
    const moveSummary = significantMoves
      .slice(0, 2)
      .map((m) => `${m.market}: ${m.openingLine}→${m.currentLine}`)
      .join(', ')
    lines.push(`- 📈 **Line Movement:** ${moveSummary}`)
  }

  return lines.join('\n')
}
