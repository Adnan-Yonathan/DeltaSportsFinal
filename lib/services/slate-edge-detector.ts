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
import { fetchSbdOdds, mapSbdOddsToOddsGames, resolveBookIds } from '@/lib/api/sbd'
import { fetchTheOddsApiOdds } from '@/lib/api/the-odds-api'
import { fetchPolymarketOdds } from '@/lib/api/polymarket'
import { fetchKalshiOdds } from '@/lib/api/kalshi'
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
import { searchTeams } from '@/lib/data/team-search'
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
import { buildSharpProjections, type SharpProjections } from './sharp-projections'
import {
  buildMatchupKey,
  fetchWhaleHistoryForGames,
  type WhaleHistorySummary,
} from './whale-trade-history'

export type WhaleAlert = {
  id: string
  source: 'kalshi' | 'polymarket' | 'history'
  marketTitle: string
  outcome: string
  notional: number
  americanOdds?: number | null
  timestamp: string
  status: WhaleTradeStatus
}

type ProjectionBookKey =
  | 'fanduel'
  | 'draftkings'
  | 'betmgm'
  | 'caesars'
  | 'betrivers'
  | 'hardrockbet'
  | 'fanatics'
  | 'espnbet'
  | 'fliff'
  | 'pinnacle'
  | 'circa'
  | 'novig'
  | 'prophetx'
  | 'polymarket'
  | 'kalshi'

type ProjectionQuoteSource = 'sbd' | 'odds_api' | 'polymarket_api' | 'kalshi_api'

type SpreadBookQuote = {
  homeLine?: number
  homeOdds?: number
  homeLimit?: number
  awayLine?: number
  awayOdds?: number
  awayLimit?: number
  source: ProjectionQuoteSource
  bookTitle?: string
}

type TotalBookQuote = {
  line?: number
  overOdds?: number
  underOdds?: number
  overLimit?: number
  underLimit?: number
  source: ProjectionQuoteSource
  bookTitle?: string
}

type MoneylineBookQuote = {
  homeOdds?: number
  awayOdds?: number
  homeLimit?: number
  awayLimit?: number
  source: ProjectionQuoteSource
  bookTitle?: string
}

export interface GameEdgeAnalysis {
  matchup: string
  oddsApiId?: string
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
    fanduel?: {
      homeOdds?: number
      awayOdds?: number
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
    bookQuotes?: Partial<Record<ProjectionBookKey, MoneylineBookQuote>>
  }
  spread?: {
    marketLine: number
    targetLine: number
    edge: EdgeAssessment
    bestBook?: string
    bestOdds?: number
    bestHomeBook?: string
    bestHomeOdds?: number
    bestAwayBook?: string
    bestAwayOdds?: number
    fanduel?: {
      homeOdds?: number
      awayOdds?: number
    }
    prediction?: { line: number; book: string; odds: number }
    bookQuotes?: Partial<Record<ProjectionBookKey, SpreadBookQuote>>
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
    fanduel?: {
      overOdds?: number
      underOdds?: number
    }
    prediction?: { line: number; book: string; overOdds: number; underOdds: number }
    bookQuotes?: Partial<Record<ProjectionBookKey, TotalBookQuote>>
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
  sharpProjections?: SharpProjections
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
const DEFAULT_WHALE_MIN_NOTIONAL = 2000
const GAME_ANALYSIS_CONCURRENCY = 6

// Map odds-api sport keys to SBD league keys
const ODDS_API_TO_SBD: Record<string, 'nba' | 'nfl' | 'nhl' | 'mlb' | 'ncaamb' | 'ncaafb'> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

const buildWhaleAlertsFromHistory = (
  history: WhaleHistorySummary | undefined,
  homeTeam: string,
  awayTeam: string
): WhaleAlert[] => {
  if (!history?.signals?.length) return []
  return history.signals.map((signal) => ({
    id: `history-${history.matchupKey}-${signal.marketType}-${normalizeSelection(signal.side)}`,
    source: 'history',
    marketTitle: `${awayTeam} @ ${homeTeam} ${signal.marketType} history`,
    outcome: signal.side,
    notional: signal.totalNotional,
    americanOdds: null,
    timestamp: signal.lastTradeAt,
    status: 'respected',
  }))
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

const normalizeBookToken = (value?: string | null) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

const BOOK_TOKEN_ALIASES: Record<string, string[]> = {
  fanduel: ['fanduel', 'fd'],
  draftkings: ['draftkings', 'dk'],
  betmgm: ['betmgm', 'mgm'],
  caesars: ['caesars', 'czr', 'williamhillus'],
  betrivers: ['betrivers', 'rivers'],
  hardrockbet: ['hardrockbet', 'hardrock'],
  fanatics: ['fanatics', 'fanaticssportsbook', 'betfanatics'],
  espnbet: ['espnbet', 'thescorebet'],
  fliff: ['fliff'],
  pinnacle: ['pinnacle', 'pinnaclesports'],
  circa: ['circa', 'circasports'],
  novig: ['novig', 'novigus'],
  prophetx: ['prophetx', 'prophet', 'prophetexchange'],
  polymarket: ['polymarket', 'poly'],
  kalshi: ['kalshi'],
}

const matchesBookToken = (
  book: { key?: string; title?: string },
  token?: string
) => {
  if (!token) return true
  const normalized = normalizeBookToken(token)
  if (!normalized) return true
  const aliasTokens = BOOK_TOKEN_ALIASES[normalized] ?? [normalized]
  const keyToken = normalizeBookToken(book.key)
  const titleToken = normalizeBookToken(book.title)
  return aliasTokens.some(
    (alias) =>
      keyToken === alias ||
      titleToken === alias ||
      keyToken.includes(alias) ||
      titleToken.includes(alias) ||
      (keyToken ? alias.includes(keyToken) : false) ||
      (titleToken ? alias.includes(titleToken) : false)
  )
}

const matchesAllowedBook = (
  book: { key?: string; title?: string },
  allowedTokens: string[]
) => {
  if (!allowedTokens.length) return true
  const keyToken = normalizeBookToken(book.key)
  const titleToken = normalizeBookToken(book.title)
  if (!keyToken && !titleToken) return false
  return allowedTokens.some((allowed) => {
    if (!allowed) return false
    return (
      keyToken === allowed ||
      titleToken === allowed ||
      keyToken.includes(allowed) ||
      titleToken.includes(allowed) ||
      (keyToken ? allowed.includes(keyToken) : false) ||
      (titleToken ? allowed.includes(titleToken) : false)
    )
  })
}

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0

  const runners = Array.from({ length: Math.min(limit, items.length) }).map(async () => {
    while (true) {
      const current = nextIndex
      nextIndex += 1
      if (current >= items.length) return
      try {
        const value = await worker(items[current])
        results[current] = { status: 'fulfilled', value }
      } catch (error) {
        results[current] = { status: 'rejected', reason: error }
      }
    }
  })

  await Promise.all(runners)
  return results
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
    normalizedCandidate.endsWith(normalizedTeam) ||
    selectionMatchesTeam(team, candidate)
  )
}

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value))

const coerceLineValue = (value: number | string | null | undefined) => {
  if (value == null) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

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

const buildNbaMarketRecommendations = ({
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
  const moneylineSignals =
    sharpResult?.sharpSignals.filter((signal) => signal.market === 'moneyline') ||
    []
  const totalSignals =
    sharpResult?.sharpSignals.filter((signal) => signal.market === 'total') || []
  const spreadMovement = sharpResult?.lineMovements.find(
    (movement) => movement.market === 'spread'
  )
  const totalMovement = sharpResult?.lineMovements.find(
    (movement) => movement.market === 'total'
  )
  const moneylineMovement = sharpResult?.lineMovements.find(
    (movement) => movement.market === 'moneyline'
  )

  if (marketSpread) {
    let spreadAdjustment = 0
    const factors: string[] = []
    let homeWhaleBias = 0
    let awayWhaleBias = 0

    if (spreadMovement) {
      const moveWeight = Math.min(1.5, Math.abs(spreadMovement.movement) * 0.6)
      const movementSide =
        spreadMovement.direction === 'toward'
          ? homeTeam
          : spreadMovement.direction === 'away'
            ? awayTeam
            : null
      if (movementSide) {
        spreadAdjustment += movementSide === homeTeam ? -moveWeight : moveWeight
      }
      factors.push(
        `Spread moved ${formatSignedLine(spreadMovement.openingLine)} to ${formatSignedLine(
          spreadMovement.currentLine
        )}`
      )

      const splits = sharpResult?.splits
      if (splits?.spreadHomeBetPct != null && splits?.spreadAwayBetPct != null) {
        const homeBets = splits.spreadHomeBetPct
        const awayBets = splits.spreadAwayBetPct
        const gap = Math.abs(homeBets - awayBets)
        if (movementSide && gap >= 12) {
          const publicSide = homeBets >= awayBets ? homeTeam : awayTeam
          if (publicSide !== movementSide) {
            const rlmWeight = Math.min(1, gap / 30)
            spreadAdjustment += movementSide === homeTeam ? -rlmWeight : rlmWeight
            factors.push(`Reverse line move vs public (${Math.round(gap)}% gap)`)
          }
        }
      }
    }

    for (const signal of spreadSignals) {
      const adjustment = resolveSignalAdjustment(signal, homeTeam, awayTeam)
      if (adjustment === 0) continue
      spreadAdjustment += adjustment
      factors.push(`${signal.type} on ${signal.side} spread`)
    }

    if (moneylineMovement?.direction && moneylineMovement.side) {
      const moveWeight = Math.min(0.8, Math.abs(moneylineMovement.movement) * 0.02)
      if (moneylineMovement.side === homeTeam) {
        spreadAdjustment -= moveWeight
      } else if (moneylineMovement.side === awayTeam) {
        spreadAdjustment += moveWeight
      }
      if (moveWeight > 0) {
        factors.push(`Moneyline move leaning ${moneylineMovement.side}`)
      }
    }

    if (moneylineSignals.length) {
      let mlBias = 0
      for (const signal of moneylineSignals) {
        const adjustment = resolveSignalAdjustment(signal, homeTeam, awayTeam)
        if (adjustment === 0) continue
        mlBias += adjustment
        factors.push(`${signal.type} on ${signal.side} moneyline`)
      }
      if (mlBias !== 0) {
        spreadAdjustment += mlBias * 0.6
      }
    }

    const splits = sharpResult?.splits
    if (
      splits?.spreadHomeBetPct != null &&
      splits?.spreadHomeMoneyPct != null
    ) {
      const divergence = splits.spreadHomeMoneyPct - splits.spreadHomeBetPct
      if (Math.abs(divergence) >= 8) {
        const leaning = divergence > 0 ? homeTeam : awayTeam
        const weight = Math.abs(divergence) >= 20 ? 0.7 : 0.4
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
      marketSpread.line - 2.5,
      marketSpread.line + 2.5
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
      recommendation: `${homeTeam} ${formatSignedLine(targetLine)} sharp-driven lean`,
    })
  }

  if (marketTotal) {
    let totalAdjustment = 0
    const factors: string[] = []
    let overWhaleBias = 0
    let underWhaleBias = 0

    if (totalMovement) {
      const moveWeight = Math.min(3, Math.abs(totalMovement.movement) * 0.6)
      const movementSide = totalMovement.side.toLowerCase().includes('over')
        ? 'Over'
        : 'Under'
      totalAdjustment += movementSide === 'Over' ? moveWeight : -moveWeight
      factors.push(
        `Total moved ${formatSignedLine(totalMovement.openingLine)} to ${formatSignedLine(
          totalMovement.currentLine
        )}`
      )

      const splits = sharpResult?.splits
      if (splits?.totalOverBetPct != null && splits?.totalUnderBetPct != null) {
        const overBets = splits.totalOverBetPct
        const underBets = splits.totalUnderBetPct
        const gap = Math.abs(overBets - underBets)
        if (gap >= 12) {
          const publicSide = overBets >= underBets ? 'Over' : 'Under'
          if (publicSide !== movementSide) {
            const rlmWeight = Math.min(1.2, gap / 25)
            totalAdjustment += movementSide === 'Over' ? rlmWeight : -rlmWeight
            factors.push(`Reverse line move vs public (${Math.round(gap)}% gap)`)
          }
        }
      }
    }

    for (const signal of totalSignals) {
      const adjustment = resolveTotalSignalAdjustment(signal)
      if (adjustment === 0) continue
      totalAdjustment += adjustment
      factors.push(`${signal.type} on ${signal.side} total`)
    }

    if (moneylineSignals.length) {
      let mlBias = 0
      for (const signal of moneylineSignals) {
        const adjustment = resolveSignalAdjustment(signal, homeTeam, awayTeam)
        if (adjustment === 0) continue
        mlBias += adjustment
      }
      if (mlBias !== 0) {
        totalAdjustment += mlBias * -0.15
        factors.push('Moneyline sharp bias applied to total')
      }
    }

    const splits = sharpResult?.splits
    if (
      splits?.totalOverBetPct != null &&
      splits?.totalOverMoneyPct != null
    ) {
      const divergence = splits.totalOverMoneyPct - splits.totalOverBetPct
      if (Math.abs(divergence) >= 8) {
        const leaning = divergence > 0 ? 'Over' : 'Under'
        const weight = Math.abs(divergence) >= 20 ? 0.9 : 0.5
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
      marketTotal.line - 5,
      marketTotal.line + 5
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
      recommendation: `Total ${targetLine.toFixed(1)} sharp-driven lean`,
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
  type: 'sportsbook' | 'prediction',
  oddsPreference: 'best' | 'lowest' = 'best',
  requiredBookToken?: string
): { line: number; book: string; odds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; odds: number } | null = null

  for (const book of game.bookmakers) {
    if (!matchesBookToken(book, requiredBookToken)) continue
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

    const shouldReplace =
      !best ||
      (oddsPreference === 'lowest'
        ? outcome.price < best.odds ||
          (outcome.price === best.odds && outcome.point > best.line)
        : outcome.point > best.line ||
          (outcome.point === best.line && outcome.price > best.odds))

    if (shouldReplace) {
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
  type: 'sportsbook' | 'prediction',
  oddsPreference: 'best' | 'lowest' = 'best',
  requiredBookToken?: string
): { odds: number; book: string } | null {
  if (!game.bookmakers?.length) return null

  let best: { odds: number; book: string } | null = null

  for (const book of game.bookmakers) {
    if (!matchesBookToken(book, requiredBookToken)) continue
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

    const shouldReplace =
      !best ||
      (oddsPreference === 'lowest'
        ? outcome.price < best.odds
        : outcome.price > best.odds)

    if (shouldReplace) {
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
  type: 'sportsbook' | 'prediction',
  oddsPreference: 'best' | 'lowest' = 'best',
  requiredBookToken?: string
): { line: number; book: string; overOdds: number; underOdds: number } | null {
  if (!game.bookmakers?.length) return null

  let best: { line: number; book: string; overOdds: number; underOdds: number } | null = null

  for (const book of game.bookmakers) {
    if (!matchesBookToken(book, requiredBookToken)) continue
    const isPrediction = isPredictionMarketBook(book)
    if (type === 'sportsbook' && isPrediction) continue
    if (type === 'prediction' && !isPrediction) continue
    const totalMarket = book.markets?.find((m) => m.key === 'totals')
    if (!totalMarket) continue

    const over = totalMarket.outcomes?.find((o) => o.name === 'Over')
    const under = totalMarket.outcomes?.find((o) => o.name === 'Under')
    if (!over?.point || !under?.point) continue

    const shouldReplace =
      !best ||
      (oddsPreference === 'lowest'
        ? over.price < best.overOdds
        : over.price > best.overOdds)

    if (shouldReplace) {
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

const PROJECTION_BOOK_KEYS: ProjectionBookKey[] = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'betrivers',
  'hardrockbet',
  'fanatics',
  'espnbet',
  'fliff',
  'pinnacle',
  'circa',
  'novig',
  'prophetx',
  'polymarket',
  'kalshi',
]

const PROJECTION_SHARP_SPORTSBOOKS = ['pinnacle', 'circa', 'novig', 'prophetx'] as const

const filterOddsGamesForTeamAndBook = (
  games: OddsGame[],
  teamFilter: string[],
  allowedBooks: readonly string[]
) => {
  const allowedTokens = allowedBooks.map((book) => normalizeBookToken(book))
  const teamTokens = teamFilter.map((team) => team.toLowerCase())

  return games
    .filter((game) => {
      if (!teamTokens.length) return true
      const home = game.home_team.toLowerCase()
      const away = game.away_team.toLowerCase()
      return teamTokens.some((team) => home.includes(team) || away.includes(team))
    })
    .map((game) => ({
      ...game,
      bookmakers: (game.bookmakers ?? []).filter((book) =>
        matchesAllowedBook(book, allowedTokens)
      ),
    }))
    .filter((game) => (game.bookmakers?.length ?? 0) > 0)
}

const mergeOddsGamesByMatchup = (games: OddsGame[]) => {
  const merged = new Map<string, OddsGame>()
  for (const game of games) {
    const key = buildMatchupKey(game.home_team, game.away_team)
    const existing = merged.get(key)
    if (!existing) {
      merged.set(key, { ...game, bookmakers: [...(game.bookmakers ?? [])] })
      continue
    }

    const byBookKey = new Map(
      (existing.bookmakers ?? []).map((book) => [normalizeBookToken(book.key || book.title), book])
    )
    for (const incoming of game.bookmakers ?? []) {
      const incomingToken = normalizeBookToken(incoming.key || incoming.title)
      if (!incomingToken) continue
      if (!byBookKey.has(incomingToken)) {
        byBookKey.set(incomingToken, incoming)
      }
    }
    existing.bookmakers = Array.from(byBookKey.values())
  }
  return Array.from(merged.values())
}

const fetchProjectionSharpSportsbookOdds = async (
  sportKey: string,
  projectionMarkets: string[],
  projectionTeamFilter: string[]
) => {
  const fetchDirectOdds = async (bookmakers: readonly string[]) => {
    const directGames = await fetchTheOddsApiOdds(sportKey, {
      markets: 'h2h,spreads,totals',
      regions: 'us,us2,eu',
      bookmakers: [...bookmakers],
      includeBetLimits: true,
    })
    return filterOddsGamesForTeamAndBook(
      directGames,
      projectionTeamFilter,
      bookmakers
    )
  }

  try {
    return await fetchDirectOdds(PROJECTION_SHARP_SPORTSBOOKS)
  } catch (directError) {
    console.warn(
      '[SLATE EDGE] Direct sharp sportsbook fetch failed; using odds-api-io fallback:',
      directError
    )

    const perBookResults = await Promise.allSettled(
      PROJECTION_SHARP_SPORTSBOOKS.map((book) => fetchDirectOdds([book]))
    )
    const directPerBookGames = perBookResults
      .filter(
        (
          result
        ): result is PromiseFulfilledResult<OddsGame[]> => result.status === 'fulfilled'
      )
      .flatMap((result) => result.value)

    if (directPerBookGames.length > 0) {
      return mergeOddsGamesByMatchup(directPerBookGames)
    }

    const fallbackGames = await fetchOdds(sportKey, projectionMarkets, {
      revalidateSeconds: 1800,
      forceProvider: 'odds-api-io',
      bookmakers: [...PROJECTION_SHARP_SPORTSBOOKS],
      teamFilter: projectionTeamFilter,
      includePredictionMarkets: false,
    })
    return filterOddsGamesForTeamAndBook(
      fallbackGames,
      projectionTeamFilter,
      PROJECTION_SHARP_SPORTSBOOKS
    )
  }
}

const buildOddsGameIndex = (games: OddsGame[]) => {
  const index = new Map<string, OddsGame>()
  for (const game of games) {
    const forward = buildMatchupKey(game.home_team, game.away_team)
    const reverse = buildMatchupKey(game.away_team, game.home_team)
    if (forward && !index.has(forward)) index.set(forward, game)
    if (reverse && !index.has(reverse)) index.set(reverse, game)
  }
  return index
}

const findIndexedGame = (
  index: Map<string, OddsGame>,
  homeTeam: string,
  awayTeam: string
) => {
  const forward = buildMatchupKey(homeTeam, awayTeam)
  if (forward && index.has(forward)) return index.get(forward) ?? null
  const reverse = buildMatchupKey(awayTeam, homeTeam)
  if (reverse && index.has(reverse)) return index.get(reverse) ?? null
  return null
}

const findMatchingGame = (
  games: OddsGame[],
  homeTeam: string,
  awayTeam: string
) => {
  return (
    games.find(
      (candidate) =>
        teamNameMatches(homeTeam, candidate.home_team) &&
        teamNameMatches(awayTeam, candidate.away_team)
    ) ??
    games.find(
      (candidate) =>
        teamNameMatches(homeTeam, candidate.away_team) &&
        teamNameMatches(awayTeam, candidate.home_team)
    ) ??
    null
  )
}

const findProjectionSourceGame = (
  index: Map<string, OddsGame>,
  games: OddsGame[],
  homeTeam: string,
  awayTeam: string
) => {
  const indexed = findIndexedGame(index, homeTeam, awayTeam)
  if (indexed) return indexed
  return findMatchingGame(games, homeTeam, awayTeam)
}

const findBookInGame = (game: OddsGame | null, token: string) => {
  if (!game?.bookmakers?.length) return null
  return game.bookmakers.find((book) => matchesBookToken(book, token)) ?? null
}

const resolveSpreadQuoteForBook = (
  sourceGame: OddsGame | null,
  baseGame: OddsGame,
  bookToken: string,
  source: ProjectionQuoteSource
): SpreadBookQuote | null => {
  const book = findBookInGame(sourceGame, bookToken)
  if (!book) return null
  const market = book.markets?.find((entry) => entry.key === MARKETS.SPREADS)
  if (!market) return null
  const homeOutcome = market.outcomes?.find((entry) =>
    teamNameMatches(baseGame.home_team, entry.name)
  )
  const awayOutcome = market.outcomes?.find((entry) =>
    teamNameMatches(baseGame.away_team, entry.name)
  )
  if (!homeOutcome && !awayOutcome) return null
  return {
    homeLine: homeOutcome?.point,
    homeOdds: homeOutcome?.price,
    homeLimit: homeOutcome?.betLimit,
    awayLine: awayOutcome?.point,
    awayOdds: awayOutcome?.price,
    awayLimit: awayOutcome?.betLimit,
    source,
    bookTitle: book.title,
  }
}

const resolveTotalQuoteForBook = (
  sourceGame: OddsGame | null,
  bookToken: string,
  source: ProjectionQuoteSource
): TotalBookQuote | null => {
  const book = findBookInGame(sourceGame, bookToken)
  if (!book) return null
  const market = book.markets?.find((entry) => entry.key === MARKETS.TOTALS)
  if (!market) return null
  const over = market.outcomes?.find((entry) => entry.name.toLowerCase() === 'over')
  const under = market.outcomes?.find((entry) => entry.name.toLowerCase() === 'under')
  if (!over && !under) return null
  return {
    line: over?.point ?? under?.point,
    overOdds: over?.price,
    underOdds: under?.price,
    overLimit: over?.betLimit,
    underLimit: under?.betLimit,
    source,
    bookTitle: book.title,
  }
}

const resolveMoneylineQuoteForBook = (
  sourceGame: OddsGame | null,
  baseGame: OddsGame,
  bookToken: string,
  source: ProjectionQuoteSource
): MoneylineBookQuote | null => {
  const book = findBookInGame(sourceGame, bookToken)
  if (!book) return null
  const market = book.markets?.find((entry) => entry.key === MARKETS.H2H)
  if (!market) return null
  const home = market.outcomes?.find((entry) =>
    teamNameMatches(baseGame.home_team, entry.name)
  )
  const away = market.outcomes?.find((entry) =>
    teamNameMatches(baseGame.away_team, entry.name)
  )
  if (!home && !away) return null
  return {
    homeOdds: home?.price,
    awayOdds: away?.price,
    homeLimit: home?.betLimit,
    awayLimit: away?.betLimit,
    source,
    bookTitle: book.title,
  }
}

const hasSpreadBookQuote = (quote: SpreadBookQuote | null) =>
  Boolean(
    quote &&
      (quote.homeLine != null ||
        quote.awayLine != null ||
        quote.homeOdds != null ||
        quote.awayOdds != null)
  )

const hasTotalBookQuote = (quote: TotalBookQuote | null) =>
  Boolean(quote && (quote.line != null || quote.overOdds != null || quote.underOdds != null))

const hasMoneylineBookQuote = (quote: MoneylineBookQuote | null) =>
  Boolean(quote && (quote.homeOdds != null || quote.awayOdds != null))

const buildProjectionBookQuotes = (
  game: OddsGame,
  sourceGames: {
    oddsApi: OddsGame | null
    polymarket: OddsGame | null
    kalshi: OddsGame | null
  }
) => {
  const spreadQuotes: Partial<Record<ProjectionBookKey, SpreadBookQuote>> = {}
  const totalQuotes: Partial<Record<ProjectionBookKey, TotalBookQuote>> = {}
  const moneylineQuotes: Partial<Record<ProjectionBookKey, MoneylineBookQuote>> = {}

  const sourceByBook: Record<
    ProjectionBookKey,
    { game: OddsGame | null; source: ProjectionQuoteSource; token: string }
  > = {
    fanduel: { game, source: 'sbd', token: 'fanduel' },
    draftkings: { game, source: 'sbd', token: 'draftkings' },
    betmgm: { game, source: 'sbd', token: 'betmgm' },
    caesars: { game, source: 'sbd', token: 'caesars' },
    betrivers: { game, source: 'sbd', token: 'betrivers' },
    hardrockbet: { game, source: 'sbd', token: 'hardrockbet' },
    fanatics: { game, source: 'sbd', token: 'fanatics' },
    espnbet: { game, source: 'sbd', token: 'espnbet' },
    fliff: { game, source: 'sbd', token: 'fliff' },
    pinnacle: { game: sourceGames.oddsApi, source: 'odds_api', token: 'pinnacle' },
    circa: { game: sourceGames.oddsApi, source: 'odds_api', token: 'circa' },
    novig: { game: sourceGames.oddsApi, source: 'odds_api', token: 'novig' },
    prophetx: { game: sourceGames.oddsApi, source: 'odds_api', token: 'prophetx' },
    polymarket: { game: sourceGames.polymarket, source: 'polymarket_api', token: 'polymarket' },
    kalshi: { game: sourceGames.kalshi, source: 'kalshi_api', token: 'kalshi' },
  }

  for (const bookKey of PROJECTION_BOOK_KEYS) {
    const sourceConfig = sourceByBook[bookKey]
    const spreadQuote = resolveSpreadQuoteForBook(
      sourceConfig.game,
      game,
      sourceConfig.token,
      sourceConfig.source
    )
    if (hasSpreadBookQuote(spreadQuote)) {
      spreadQuotes[bookKey] = spreadQuote as SpreadBookQuote
    }

    const totalQuote = resolveTotalQuoteForBook(
      sourceConfig.game,
      sourceConfig.token,
      sourceConfig.source
    )
    if (hasTotalBookQuote(totalQuote)) {
      totalQuotes[bookKey] = totalQuote as TotalBookQuote
    }

    const moneylineQuote = resolveMoneylineQuoteForBook(
      sourceConfig.game,
      game,
      sourceConfig.token,
      sourceConfig.source
    )
    if (hasMoneylineBookQuote(moneylineQuote)) {
      moneylineQuotes[bookKey] = moneylineQuote as MoneylineBookQuote
    }
  }

  return {
    spreadQuotes: Object.keys(spreadQuotes).length ? spreadQuotes : undefined,
    totalQuotes: Object.keys(totalQuotes).length ? totalQuotes : undefined,
    moneylineQuotes: Object.keys(moneylineQuotes).length ? moneylineQuotes : undefined,
  }
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
    bookmakers?: string[]
    oddsPreference?: 'best' | 'lowest'
  } = {}
): Promise<SlateEdgeResult> {
  const { limit = 15, minEdge, date, bookmakers, oddsPreference = 'best' } = options
  const requestedBookmakers = (bookmakers ?? [])
    .map((entry) => String(entry).trim().toLowerCase())
    .filter(Boolean)
  const sportLabel = SPORT_LABELS[sportKey] || sportKey
  const isCfb = sportKey === 'americanfootball_ncaaf'
  const isFootball = sportKey === 'americanfootball_nfl' || isCfb
  const withTimeout = <T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
    ])
  }

  console.log(`[SLATE EDGE] Analyzing ${sportLabel} slate...`)

  // Fetch slate odds from SBD so sharp projections and edge math use one source.
  let oddsGames: OddsGame[] = []
  const sbdOddsLeague = ODDS_API_TO_SBD[sportKey]
  if (sbdOddsLeague) {
    const markets = [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS]
    const books = requestedBookmakers.length
      ? resolveBookIds(requestedBookmakers, { fallbackToDefault: false })
      : resolveBookIds()

    const fetchSbdGames = async (bookIds?: string[]) => {
      try {
        const payload = await withTimeout(
          fetchSbdOdds(sbdOddsLeague, { books: bookIds }),
          12000,
          null
        )
        if (!payload) {
          console.warn(`[SLATE EDGE] Timed out fetching SBD odds for ${sbdOddsLeague}.`)
          return []
        }
        return mapSbdOddsToOddsGames(sbdOddsLeague, payload, markets)
      } catch (error) {
        console.error(`[SLATE EDGE] Failed to fetch SBD odds for ${sbdOddsLeague}:`, error)
        return []
      }
    }

    oddsGames = await fetchSbdGames(books.length ? books : undefined)

    // Retry per-book and merge when the aggregate feed is sparse.
    if (oddsGames.length === 0 && books.length > 1) {
      const merged = new Map<string, OddsGame>()
      const bookResults = await Promise.all(books.map((book) => fetchSbdGames([book])))
      for (const bookGames of bookResults) {
        for (const game of bookGames) {
          const key = buildMatchupKey(game.home_team, game.away_team)
          const existing = merged.get(key)
          if (existing) {
            const byKey = new Map(
              (existing.bookmakers ?? []).map((entry) => [entry.key, entry])
            )
            for (const entry of game.bookmakers ?? []) {
              if (!byKey.has(entry.key)) byKey.set(entry.key, entry)
            }
            existing.bookmakers = Array.from(byKey.values())
          } else {
            merged.set(key, { ...game })
          }
        }
      }
      oddsGames = Array.from(merged.values())
    }

    if (oddsGames.length === 0 && requestedBookmakers.length === 0) {
      const fallback = await fetchSbdGames(['sr:book:18149'])
      if (fallback.length) oddsGames = fallback
    }
  } else {
    oddsGames = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], {
      revalidateSeconds: 1800,
      forceProvider: 'sportsbettingdime',
      bookmakers: requestedBookmakers.length ? requestedBookmakers : undefined,
    })
  }

  // Hard allowlist bookmaker filtering when a caller requests specific books
  // (e.g. sharp projections: Pinnacle/Circa). This prevents extra books from
  // sneaking in via provider-level fallbacks or merged payloads.
  if (requestedBookmakers.length > 0) {
    const allowedTokens = requestedBookmakers.map((entry) =>
      normalizeBookToken(entry)
    )
    oddsGames = oddsGames
      .map((game) => ({
        ...game,
        bookmakers: (game.bookmakers ?? []).filter((book) =>
          matchesAllowedBook(book, allowedTokens)
        ),
      }))
      .filter((game) => (game.bookmakers?.length ?? 0) > 0)
  }

  if (sportKey === 'basketball_ncaab') {
    const isNbaTeam = (team: string) =>
      searchTeams(team, { sport: 'basketball_nba', limit: 1, prioritizePro: true }).length > 0
    oddsGames = oddsGames.filter(
      (game) => !isNbaTeam(game.home_team) && !isNbaTeam(game.away_team)
    )
  }

  // Drop prediction-only games where we expect full sportsbook coverage.
  if (sportKey === 'basketball_nba') {
    oddsGames = oddsGames.filter((game) =>
      (game.bookmakers || []).some((book) => !isPredictionMarketBook(book))
    )
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

  // Filter to upcoming games (and recent in-progress) for projections.
  const now = new Date()
  const useDateOverride = Boolean(date)
  const upcomingWindowHours = isCfb
    ? 24 * 21
    : sportKey === 'americanfootball_nfl'
      ? 24 * 7
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

  let upcomingGames = oddsGames
    .filter((g) => {
      if (isCfb) return true
      const gameTime = new Date(g.commence_time)
      if (useDateOverride) {
        return gameTime >= todayStartEastern && gameTime <= todayEndEastern
      }
      return gameTime >= threeHoursAgo && gameTime <= windowEnd
    })
    .slice(0, limit)

  if (isCfb) {
    const playoffGames = upcomingGames.filter((game) =>
      isCfbPlayoffMatchup(game.home_team, game.away_team)
    )
    if (playoffGames.length > 0) {
      upcomingGames = playoffGames
    }
  }

  console.log(`[SLATE EDGE] Filtered ${oddsGames.length} odds games to ${upcomingGames.length} today's games`)

  if (upcomingGames.length === 0) {
    return {
      sport: sportKey,
      sportLabel,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0],
      gamesAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0, sharpConfirmed: 0 },
    }
  }

  const projectionTeamFilter = Array.from(
    new Set(
      upcomingGames.flatMap((game) => [game.home_team, game.away_team]).filter(Boolean)
    )
  )
  const projectionMarkets = [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS]
  const [oddsApiBooksResult, polymarketResult, kalshiResult] = await Promise.allSettled([
    fetchProjectionSharpSportsbookOdds(
      sportKey,
      projectionMarkets,
      projectionTeamFilter
    ),
    fetchPolymarketOdds(sportKey, projectionMarkets, {
      revalidateSeconds: 1800,
      teamFilter: projectionTeamFilter,
    }),
    fetchKalshiOdds(sportKey, projectionMarkets, {
      revalidateSeconds: 1800,
      teamFilter: projectionTeamFilter,
    }),
  ])

  const oddsApiBookGames = oddsApiBooksResult.status === 'fulfilled' ? oddsApiBooksResult.value : []
  const polymarketGames = polymarketResult.status === 'fulfilled' ? polymarketResult.value : []
  const kalshiGames = kalshiResult.status === 'fulfilled' ? kalshiResult.value : []

  if (oddsApiBooksResult.status === 'rejected') {
    console.warn('[SLATE EDGE] Odds API sportsbook feed unavailable:', oddsApiBooksResult.reason)
  }
  if (polymarketResult.status === 'rejected') {
    console.warn('[SLATE EDGE] Polymarket feed unavailable:', polymarketResult.reason)
  }
  if (kalshiResult.status === 'rejected') {
    console.warn('[SLATE EDGE] Kalshi feed unavailable:', kalshiResult.reason)
  }

  const oddsApiBookIndex = buildOddsGameIndex(oddsApiBookGames)
  const polymarketIndex = buildOddsGameIndex(polymarketGames)
  const kalshiIndex = buildOddsGameIndex(kalshiGames)

  const resolveProjectionSourceGames = (game: OddsGame) => ({
    oddsApi: findProjectionSourceGame(
      oddsApiBookIndex,
      oddsApiBookGames,
      game.home_team,
      game.away_team
    ),
    polymarket: findProjectionSourceGame(
      polymarketIndex,
      polymarketGames,
      game.home_team,
      game.away_team
    ),
    kalshi: findProjectionSourceGame(
      kalshiIndex,
      kalshiGames,
      game.home_team,
      game.away_team
    ),
  })

  if (isFootball) {
    let sharpResults: SharpEdgeResult[] = []
    const sbdLeague = ODDS_API_TO_SBD[sportKey]
    if (sbdLeague && sportKey === 'americanfootball_nfl') {
      try {
        console.log(`[SLATE EDGE] Fetching sharp signals for ${sbdLeague}...`)
        sharpResults = await withTimeout(detectSharpEdges([sbdLeague]), 8000, [])
      } catch (error) {
        console.error(`[SLATE EDGE] Failed to fetch sharp signals:`, error)
      }
    }

    let whaleHistoryByMatchup = new Map<string, WhaleHistorySummary>()
    try {
      whaleHistoryByMatchup = await withTimeout(
        fetchWhaleHistoryForGames({
          sportKey,
          games: upcomingGames.map((game) => ({
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time,
          })),
        }),
        4000,
        new Map<string, WhaleHistorySummary>()
      )
    } catch (error) {
      console.warn('[SLATE EDGE] Whale history lookup failed:', error)
    }

    const edges: GameEdgeAnalysis[] = upcomingGames.map((game) => {
      const sharpResult = sharpResults.find((r) => {
        const homeMatch =
          teamNameMatches(game.home_team, r.homeTeam) ||
          teamNameMatches(r.homeTeam, game.home_team)
        const awayMatch =
          teamNameMatches(game.away_team, r.awayTeam) ||
          teamNameMatches(r.awayTeam, game.away_team)
        return homeMatch && awayMatch
      })
      const projectionSourceGames = resolveProjectionSourceGames(game)
      const projectionBookQuotes = buildProjectionBookQuotes(
        game,
        projectionSourceGames
      )

      const sportsbookSpreadHome = getBestSpreadByType(game, 'home', 'sportsbook', oddsPreference)
      const sportsbookSpreadAway = getBestSpreadByType(game, 'away', 'sportsbook', oddsPreference)
      const fanduelSpreadHome = getBestSpreadByType(
        game,
        'home',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const fanduelSpreadAway = getBestSpreadByType(
        game,
        'away',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionSpreadHome = getBestSpreadByType(game, 'home', 'prediction', oddsPreference)
      const predictionSpreadAway = getBestSpreadByType(game, 'away', 'prediction', oddsPreference)
      let marketSpread = sportsbookSpreadHome ?? predictionSpreadHome
      if (!marketSpread && sportsbookSpreadAway) {
        marketSpread = {
          line: -sportsbookSpreadAway.line,
          book: sportsbookSpreadAway.book,
          odds: sportsbookSpreadAway.odds,
        }
      }
      if (!marketSpread && predictionSpreadAway) {
        marketSpread = {
          line: -predictionSpreadAway.line,
          book: predictionSpreadAway.book,
          odds: predictionSpreadAway.odds,
        }
      }
      const sportsbookTotal = getBestTotalByType(game, 'sportsbook', oddsPreference)
      const fanduelTotal = getBestTotalByType(
        game,
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionTotal = getBestTotalByType(game, 'prediction', oddsPreference)
      let marketTotal = sportsbookTotal ?? predictionTotal
      const sportsbookMoneylineHome = getBestMoneylineByType(game, 'home', 'sportsbook', oddsPreference)
      const sportsbookMoneylineAway = getBestMoneylineByType(game, 'away', 'sportsbook', oddsPreference)
      const fanduelMoneylineHome = getBestMoneylineByType(
        game,
        'home',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const fanduelMoneylineAway = getBestMoneylineByType(
        game,
        'away',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionMoneylineHome = getBestMoneylineByType(game, 'home', 'prediction', oddsPreference)
      const predictionMoneylineAway = getBestMoneylineByType(game, 'away', 'prediction', oddsPreference)

      if (!marketSpread && sharpResult?.lineMovements?.length) {
        const spreadMove = sharpResult.lineMovements.find(
          (move) => move.market === 'spread'
        )
        const spreadLine = coerceLineValue(
          spreadMove?.currentLine ?? spreadMove?.openingLine
        )
        if (spreadLine != null) {
          const spreadOdds = coerceLineValue(
            spreadMove?.currentOdds ?? spreadMove?.openingOdds
          )
          marketSpread = {
            line: spreadLine,
            book: 'Market',
            odds: spreadOdds ?? -110,
          }
        }
      }
      if (!marketTotal && sharpResult?.lineMovements?.length) {
        const totalMoves = sharpResult.lineMovements.filter(
          (move) => move.market === 'total'
        )
        const totalLine = coerceLineValue(
          totalMoves[0]?.currentLine ?? totalMoves[0]?.openingLine
        )
        if (totalLine != null) {
          const overMove = totalMoves.find(
            (move) => move.side.toLowerCase() === 'over'
          )
          const underMove = totalMoves.find(
            (move) => move.side.toLowerCase() === 'under'
          )
          const overOdds = coerceLineValue(
            overMove?.currentOdds ?? overMove?.openingOdds
          )
          const underOdds = coerceLineValue(
            underMove?.currentOdds ?? underMove?.openingOdds
          )
          marketTotal = {
            line: totalLine,
            book: 'Market',
            overOdds: overOdds ?? -110,
            underOdds: underOdds ?? -110,
          }
        }
      }

      const modelMoneyline = marketSpread ? buildModelMoneyline(marketSpread.line) : null
      const matchupKey = buildMatchupKey(game.home_team, game.away_team)
      const whaleHistory = whaleHistoryByMatchup.get(matchupKey)
      const whaleHistoryAlerts = buildWhaleAlertsFromHistory(
        whaleHistory,
        game.home_team,
        game.away_team
      )

      const spreadEdge = marketSpread
        ? evaluateLineEdge({
            marketType: 'spread',
            line: marketSpread.line,
            targetLine: marketSpread.line,
            supportingSignals: 0,
          })
        : undefined

      const totalEdge = marketTotal
        ? evaluateLineEdge({
            marketType: 'total',
            line: marketTotal.line,
            targetLine: marketTotal.line,
            supportingSignals: 0,
          })
        : undefined

      const analysis: GameEdgeAnalysis = {
        matchup: `${game.away_team} @ ${game.home_team}`,
        oddsApiId: game.id,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        commenceTime: game.commence_time,
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
                fanduel:
                  fanduelMoneylineHome || fanduelMoneylineAway
                    ? {
                        homeOdds: fanduelMoneylineHome?.odds,
                        awayOdds: fanduelMoneylineAway?.odds,
                      }
                    : undefined,
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
                bookQuotes: projectionBookQuotes.moneylineQuotes,
              }
            : undefined,
        confidence: 'low',
        factors: [],
        injuries: [],
        matchupFactors: [],
        sharpSignals: sharpResult?.sharpSignals || [],
        lineMovements: sharpResult?.lineMovements || [],
        splits: sharpResult?.splits,
        whaleAlerts: whaleHistoryAlerts.length ? whaleHistoryAlerts : undefined,
      }

      if (marketSpread && spreadEdge) {
        const bestHomeBook = sportsbookSpreadHome?.book ?? predictionSpreadHome?.book
        const bestHomeOdds = sportsbookSpreadHome?.odds ?? predictionSpreadHome?.odds
        const bestAwayBook = sportsbookSpreadAway?.book ?? predictionSpreadAway?.book
        const bestAwayOdds = sportsbookSpreadAway?.odds ?? predictionSpreadAway?.odds
        analysis.spread = {
          marketLine: marketSpread.line,
          targetLine: marketSpread.line,
          edge: spreadEdge,
          bestBook: bestHomeBook ?? marketSpread.book,
          bestOdds: bestHomeOdds ?? marketSpread.odds,
          bestHomeBook,
          bestHomeOdds,
          bestAwayBook,
          bestAwayOdds,
          fanduel:
            fanduelSpreadHome || fanduelSpreadAway
              ? {
                  homeOdds: fanduelSpreadHome?.odds,
                  awayOdds: fanduelSpreadAway?.odds,
                }
              : undefined,
          prediction: predictionSpreadHome || undefined,
          bookQuotes: projectionBookQuotes.spreadQuotes,
          favoredTeam: marketSpread.line < 0 ? game.home_team : game.away_team,
          sharpConfirmed: false,
        }
      }

      if (marketTotal && totalEdge) {
        analysis.total = {
          marketLine: marketTotal.line,
          targetLine: marketTotal.line,
          edge: totalEdge,
          bestBook: marketTotal.book,
          bestOdds: marketTotal.overOdds,
          bestUnderOdds: marketTotal.underOdds,
          fanduel: fanduelTotal
            ? {
                overOdds: fanduelTotal.overOdds,
                underOdds: fanduelTotal.underOdds,
              }
            : undefined,
          prediction: predictionTotal || undefined,
          bookQuotes: projectionBookQuotes.totalQuotes,
          sharpConfirmed: false,
        }
      }

      analysis.sharpProjections = buildSharpProjections({
        sportKey,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        spread: analysis.spread,
        total: analysis.total,
        moneyline: analysis.moneyline,
        sharpSignals: analysis.sharpSignals,
        lineMovements: analysis.lineMovements,
        splits: analysis.splits,
        whaleAlerts: analysis.whaleAlerts,
      })

      return analysis
    })

    return {
      sport: sportKey,
      sportLabel,
      date: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().split('T')[0],
      gamesAnalyzed: upcomingGames.length,
      edges,
      summary: {
        strongEdges: 0,
        softEdges: 0,
        noEdges: edges.length,
        sharpConfirmed: 0,
      },
    }
  }

  if (sportKey === 'basketball_nba') {
    try {
      console.log('[SLATE EDGE] Warming NBA.com team stats cache...')
      await getNBATeamStats()
    } catch (error) {
      console.warn('[SLATE EDGE] NBA.com warmup failed', error)
    }
  }

  // Fetch sharp signals for this sport (line movement, RLM, bet%/money% divergence)
  const sbdLeague = ODDS_API_TO_SBD[sportKey]
  let sharpResults: SharpEdgeResult[] = []
  if (sbdLeague && !isFootball) {
    try {
      console.log(`[SLATE EDGE] Fetching sharp signals for ${sbdLeague}...`)
      const sharpTimeoutMs = isFootball ? 8000 : 12000
      sharpResults = await withTimeout(detectSharpEdges([sbdLeague]), sharpTimeoutMs, [])
      console.log(`[SLATE EDGE] Found ${sharpResults.filter(r => r.hasEdge).length} games with sharp signals`)
    } catch (error) {
      console.error(`[SLATE EDGE] Failed to fetch sharp signals:`, error)
    }
  }

  let whaleTrades: WhaleTrade[] = []
  try {
    if (!isFootball) {
      const whaleTimeoutMs = 12000
      whaleTrades = await withTimeout(fetchWhaleTrades({
        limit: 300,
        minNotional: isCfb ? CFB_WHALE_MIN_NOTIONAL : DEFAULT_WHALE_MIN_NOTIONAL,
      }), whaleTimeoutMs, [])
    }
  } catch (error) {
    console.error('[SLATE EDGE] Failed to fetch whale trades:', error)
  }

  const whaleStatusCache = new Map<string, WhaleTradeWithStatus>()

  const resolveWhaleAlerts = async (
    homeTeam: string,
    awayTeam: string
  ): Promise<WhaleAlert[]> => {
    if (whaleTrades.length === 0) return []
    const relevant = whaleTrades.filter((trade) => {
      const text = `${trade.marketTitle} ${trade.outcome}`
      return (
        selectionMatchesTeam(text, homeTeam) &&
        selectionMatchesTeam(text, awayTeam)
      )
    })
    if (relevant.length === 0) return []

    const resolved = isFootball
      ? relevant.map((trade) => ({ ...trade, status: 'pending' as const }))
      : await Promise.all(
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

  let whaleHistoryByMatchup = new Map<string, WhaleHistorySummary>()
  if (upcomingGames.length > 0) {
    try {
      const historyTimeoutMs = isFootball ? 4000 : 8000
      whaleHistoryByMatchup = await withTimeout(
        fetchWhaleHistoryForGames({
          sportKey,
          games: upcomingGames.map((game) => ({
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            commenceTime: game.commence_time,
          })),
        }),
        historyTimeoutMs,
        new Map<string, WhaleHistorySummary>()
      )
      console.log(
        `[SLATE EDGE] Loaded whale history for ${whaleHistoryByMatchup.size} matchups`
      )
    } catch (error) {
      console.warn('[SLATE EDGE] Whale history lookup failed:', error)
    }
  }

  const edges: GameEdgeAnalysis[] = []
  let strongEdges = 0
  let softEdges = 0
  let noEdges = 0
  let sharpConfirmedCount = 0
  const evByGameId = new Map<string, EVOpportunity[]>()

  try {
    const evOpps = isFootball
      ? []
      : await withTimeout(findEVOpportunities({
          sports: [sportKey],
          minEV: 3,
          includeProps: false,
          markets: [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
          limit: 200,
        }), 15000, [])
    for (const opportunity of evOpps) {
      if (!evByGameId.has(opportunity.gameId)) {
        evByGameId.set(opportunity.gameId, [])
      }
      evByGameId.get(opportunity.gameId)!.push(opportunity)
    }
  } catch (error) {
    console.error('[SLATE EDGE] Failed to fetch EV opportunities:', error)
  }

  // Analyze games with bounded concurrency to avoid connection saturation
  console.log(
    `[SLATE EDGE] Starting analysis of ${upcomingGames.length} games (concurrency ${GAME_ANALYSIS_CONCURRENCY})...`
  )
  const startTime = Date.now()

  const gameResults = await runWithConcurrency(
    upcomingGames,
    GAME_ANALYSIS_CONCURRENCY,
    async (game) => {
      try {
        const matchupLabel = `${game.away_team} @ ${game.home_team}`
        const matchupKey = buildMatchupKey(game.home_team, game.away_team)
        const whaleHistory = whaleHistoryByMatchup.get(matchupKey)

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
      const projectionSourceGames = resolveProjectionSourceGames(game)
      const projectionBookQuotes = buildProjectionBookQuotes(
        game,
        projectionSourceGames
      )

      // Get market lines (needed for NCAAB market anchoring)
      const sportsbookSpreadHome = getBestSpreadByType(game, 'home', 'sportsbook', oddsPreference)
      const sportsbookSpreadAway = getBestSpreadByType(game, 'away', 'sportsbook', oddsPreference)
      const fanduelSpreadHome = getBestSpreadByType(
        game,
        'home',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const fanduelSpreadAway = getBestSpreadByType(
        game,
        'away',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionSpreadHome = getBestSpreadByType(game, 'home', 'prediction', oddsPreference)
      const predictionSpreadAway = getBestSpreadByType(game, 'away', 'prediction', oddsPreference)
      let marketSpread = sportsbookSpreadHome ?? predictionSpreadHome
      if (!marketSpread && sportsbookSpreadAway) {
        marketSpread = {
          line: -sportsbookSpreadAway.line,
          book: sportsbookSpreadAway.book,
          odds: sportsbookSpreadAway.odds,
        }
      }
      if (!marketSpread && predictionSpreadAway) {
        marketSpread = {
          line: -predictionSpreadAway.line,
          book: predictionSpreadAway.book,
          odds: predictionSpreadAway.odds,
        }
      }
      const sportsbookTotal = getBestTotalByType(game, 'sportsbook', oddsPreference)
      const fanduelTotal = getBestTotalByType(
        game,
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionTotal = getBestTotalByType(game, 'prediction', oddsPreference)
      let marketTotal = sportsbookTotal ?? predictionTotal
      const sportsbookMoneylineHome = getBestMoneylineByType(game, 'home', 'sportsbook', oddsPreference)
      const sportsbookMoneylineAway = getBestMoneylineByType(game, 'away', 'sportsbook', oddsPreference)
      const fanduelMoneylineHome = getBestMoneylineByType(
        game,
        'home',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const fanduelMoneylineAway = getBestMoneylineByType(
        game,
        'away',
        'sportsbook',
        oddsPreference,
        'fanduel'
      )
      const predictionMoneylineHome = getBestMoneylineByType(game, 'home', 'prediction', oddsPreference)
      const predictionMoneylineAway = getBestMoneylineByType(game, 'away', 'prediction', oddsPreference)
      if (!marketSpread && sharpResult?.lineMovements?.length) {
        const spreadMove = sharpResult.lineMovements.find(
          (move) => move.market === 'spread'
        )
        const spreadLine = coerceLineValue(
          spreadMove?.currentLine ?? spreadMove?.openingLine
        )
        if (spreadLine != null) {
          const spreadOdds = coerceLineValue(
            spreadMove?.currentOdds ?? spreadMove?.openingOdds
          )
          marketSpread = {
            line: spreadLine,
            book: 'Market',
            odds: spreadOdds ?? -110,
          }
        }
      }
      if (!marketTotal && sharpResult?.lineMovements?.length) {
        const totalMoves = sharpResult.lineMovements.filter(
          (move) => move.market === 'total'
        )
        const totalLine = coerceLineValue(
          totalMoves[0]?.currentLine ?? totalMoves[0]?.openingLine
        )
        if (totalLine != null) {
          const overMove = totalMoves.find(
            (move) => move.side.toLowerCase() === 'over'
          )
          const underMove = totalMoves.find(
            (move) => move.side.toLowerCase() === 'under'
          )
          const overOdds = coerceLineValue(
            overMove?.currentOdds ?? overMove?.openingOdds
          )
          const underOdds = coerceLineValue(
            underMove?.currentOdds ?? underMove?.openingOdds
          )
          marketTotal = {
            line: totalLine,
            book: 'Market',
            overOdds: overOdds ?? -110,
            underOdds: underOdds ?? -110,
          }
        }
      }
      const fallbackStats = getFallbackTeamStats(sportKey)
      const matchupTimeoutMs =
        sportKey === 'basketball_ncaab'
          ? 20000
          : sportKey === 'basketball_nba'
            ? 45000
            : 8000

        const matchupAnalysis = isFootball
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

        const whaleAlerts = await resolveWhaleAlerts(
          game.home_team,
          game.away_team
        )
        const whaleHistoryAlerts = buildWhaleAlertsFromHistory(
          whaleHistory,
          game.home_team,
          game.away_team
        )
        const whaleAlertsForModel = whaleHistoryAlerts.length
          ? [...whaleAlerts, ...whaleHistoryAlerts]
          : whaleAlerts
        const marketContext = {
          marketSpread: marketSpread?.line,
          marketTotal: marketTotal?.line,
          sharpSignals: sharpResult?.sharpSignals,
          sharpSplits: sharpResult?.splits,
          whaleAlerts: whaleAlertsForModel,
        }

        const recommendationTimeoutMs =
          sportKey === 'basketball_ncaab'
            ? 12000
            : sportKey === 'basketball_nba'
              ? 25000
              : 8000
        let recommendations: GameRecommendation[] = []
        if (sportKey === 'basketball_nba') {
          recommendations = buildNbaMarketRecommendations({
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            marketSpread,
            marketTotal,
            sharpResult,
            whaleAlerts: whaleAlertsForModel,
          })
        } else if (isFootball) {
          recommendations = buildCfbMarketRecommendations({
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            marketSpread,
            marketTotal,
            sharpResult,
            whaleAlerts: whaleAlertsForModel,
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
        oddsApiId: game.id,
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
                fanduel:
                  fanduelMoneylineHome || fanduelMoneylineAway
                    ? {
                        homeOdds: fanduelMoneylineHome?.odds,
                        awayOdds: fanduelMoneylineAway?.odds,
                      }
                    : undefined,
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
                bookQuotes: projectionBookQuotes.moneylineQuotes,
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
        const bestHomeBook = sportsbookSpreadHome?.book ?? predictionSpreadHome?.book
        const bestHomeOdds = sportsbookSpreadHome?.odds ?? predictionSpreadHome?.odds
        const bestAwayBook = sportsbookSpreadAway?.book ?? predictionSpreadAway?.book
        const bestAwayOdds = sportsbookSpreadAway?.odds ?? predictionSpreadAway?.odds
        gameAnalysis.spread = {
          marketLine: marketSpread.line,
          targetLine: spreadRec.targetLine,
          edge: spreadEdge,
          bestBook: bestHomeBook ?? marketSpread.book,
          bestOdds: bestHomeOdds ?? marketSpread.odds,
          bestHomeBook,
          bestHomeOdds,
          bestAwayBook,
          bestAwayOdds,
          fanduel:
            fanduelSpreadHome || fanduelSpreadAway
              ? {
                  homeOdds: fanduelSpreadHome?.odds,
                  awayOdds: fanduelSpreadAway?.odds,
                }
              : undefined,
          prediction: predictionSpreadHome || undefined,
          bookQuotes: projectionBookQuotes.spreadQuotes,
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
          fanduel: fanduelTotal
            ? {
                overOdds: fanduelTotal.overOdds,
                underOdds: fanduelTotal.underOdds,
              }
            : undefined,
          prediction: predictionTotal || undefined,
          bookQuotes: projectionBookQuotes.totalQuotes,
          sharpConfirmed: totalConfirmation.agrees,
        }
      }

      if (!gameAnalysis.spread && marketSpread) {
        const fallbackEdge = evaluateLineEdge({
          marketType: 'spread',
          line: marketSpread.line,
          targetLine: marketSpread.line,
          supportingSignals: 0,
        })
        const bestHomeBook = sportsbookSpreadHome?.book ?? predictionSpreadHome?.book
        const bestHomeOdds = sportsbookSpreadHome?.odds ?? predictionSpreadHome?.odds
        const bestAwayBook = sportsbookSpreadAway?.book ?? predictionSpreadAway?.book
        const bestAwayOdds = sportsbookSpreadAway?.odds ?? predictionSpreadAway?.odds
        gameAnalysis.spread = {
          marketLine: marketSpread.line,
          targetLine: marketSpread.line,
          edge: fallbackEdge,
          bestBook: bestHomeBook ?? marketSpread.book,
          bestOdds: bestHomeOdds ?? marketSpread.odds,
          bestHomeBook,
          bestHomeOdds,
          bestAwayBook,
          bestAwayOdds,
          fanduel:
            fanduelSpreadHome || fanduelSpreadAway
              ? {
                  homeOdds: fanduelSpreadHome?.odds,
                  awayOdds: fanduelSpreadAway?.odds,
                }
              : undefined,
          prediction: predictionSpreadHome || undefined,
          bookQuotes: projectionBookQuotes.spreadQuotes,
          favoredTeam: marketSpread.line < 0 ? game.home_team : game.away_team,
          sharpConfirmed: false,
        }
      }

      if (!gameAnalysis.total && marketTotal) {
        const fallbackEdge = evaluateLineEdge({
          marketType: 'total',
          line: marketTotal.line,
          targetLine: marketTotal.line,
          supportingSignals: 0,
        })
        gameAnalysis.total = {
          marketLine: marketTotal.line,
          targetLine: marketTotal.line,
          edge: fallbackEdge,
          bestBook: marketTotal.book,
          bestOdds: marketTotal.overOdds,
          bestUnderOdds: marketTotal.underOdds,
          fanduel: fanduelTotal
            ? {
                overOdds: fanduelTotal.overOdds,
                underOdds: fanduelTotal.underOdds,
              }
            : undefined,
          prediction: predictionTotal || undefined,
          bookQuotes: projectionBookQuotes.totalQuotes,
          sharpConfirmed: false,
        }
      }

      gameAnalysis.sharpProjections = buildSharpProjections({
        sportKey,
        homeTeam: game.home_team,
        awayTeam: game.away_team,
        spread: gameAnalysis.spread,
        total: gameAnalysis.total,
        moneyline: gameAnalysis.moneyline,
        sharpSignals: gameAnalysis.sharpSignals,
        lineMovements: gameAnalysis.lineMovements,
        splits: gameAnalysis.splits,
        whaleAlerts: whaleAlertsForModel,
      })

        return { skipped: false, edgeType, analysis: gameAnalysis, sharpConfirmed: hasSharpConfirmation }
      } catch (error) {
        console.error(`[SLATE EDGE] Error analyzing ${game.home_team} vs ${game.away_team}:`, error)
        return { skipped: true, edgeType: 'none' as const, error: true }
      }
    }
  )

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
