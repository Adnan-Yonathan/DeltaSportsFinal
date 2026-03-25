import {
  normalCDF,
  oddsToImpliedProbability,
  probabilityToAmericanOdds,
} from '@/lib/utils/statistics'
import type { BettingSplits, LineMovement, SharpSignal } from './edge-detection'

type MarketKey = 'spread' | 'total' | 'moneyline'
type MarketSide = 'home' | 'away' | 'over' | 'under'
type ProjectionTier = 'pro' | 'p4' | 'mid' | 'hbcu'

export type SharpProjectionMarket = {
  side: string
  probability: number
  confidenceInterval?: { low: number; high: number }
  edgePercent: number
  breakEven: number
  factors: string[]
  sharpFairOdds?: number
  limitPressureScore?: number
  limitPressureLabel?: string
}

export type SharpProjections = {
  spread?: SharpProjectionMarket
  total?: SharpProjectionMarket
  moneyline?: SharpProjectionMarket
  tier: ProjectionTier
}

type SpreadMarketInput = {
  marketLine: number
  targetLine: number
  bestOdds?: number
  bestHomeOdds?: number
  bestAwayOdds?: number
  bookQuotes?: Record<string, unknown>
}

type TotalMarketInput = {
  marketLine: number
  targetLine: number
  bestOdds?: number
  bestUnderOdds?: number
  bookQuotes?: Record<string, unknown>
}

type MoneylineMarketInput = {
  sportsbook?: {
    homeOdds?: number
    awayOdds?: number
  }
  model?: {
    homeProbability?: number
  }
  bookQuotes?: Record<string, unknown>
}

type WhaleAlertInput = {
  marketTitle?: string
  outcome?: string
  notional?: number
}

export type SharpProjectionInput = {
  sportKey: string
  homeTeam: string
  awayTeam: string
  spread?: SpreadMarketInput
  total?: TotalMarketInput
  moneyline?: MoneylineMarketInput
  sharpSignals?: SharpSignal[]
  lineMovements?: LineMovement[]
  splits?: BettingSplits
  whaleAlerts?: WhaleAlertInput[]
}

type SportProjectionConfig = {
  marginStdDev: number
  totalStdDev: number
  baseCiWidth: number
  lineMoveScale: {
    spread: number
    total: number
    moneyline: number
  }
}

const SPORT_CONFIGS: Record<string, SportProjectionConfig> = {
  basketball_nba: {
    marginStdDev: 12,
    totalStdDev: 15,
    baseCiWidth: 0.08,
    lineMoveScale: { spread: 1.5, total: 2.5, moneyline: 25 },
  },
  basketball_ncaab: {
    marginStdDev: 11.5,
    totalStdDev: 14,
    baseCiWidth: 0.1,
    lineMoveScale: { spread: 1.5, total: 2.5, moneyline: 25 },
  },
  americanfootball_nfl: {
    marginStdDev: 13.5,
    totalStdDev: 12.5,
    baseCiWidth: 0.08,
    lineMoveScale: { spread: 1.0, total: 2.0, moneyline: 20 },
  },
  americanfootball_ncaaf: {
    marginStdDev: 17,
    totalStdDev: 16,
    baseCiWidth: 0.1,
    lineMoveScale: { spread: 2.5, total: 4.0, moneyline: 35 },
  },
  baseball_mlb: {
    marginStdDev: 4.2,
    totalStdDev: 3.4,
    baseCiWidth: 0.09,
    lineMoveScale: { spread: 0.5, total: 1.0, moneyline: 15 },
  },
  icehockey_nhl: {
    marginStdDev: 2.8,
    totalStdDev: 2.4,
    baseCiWidth: 0.09,
    lineMoveScale: { spread: 0.5, total: 1.0, moneyline: 15 },
  },
}

const DEFAULT_CONFIG: SportProjectionConfig = {
  marginStdDev: 12,
  totalStdDev: 12,
  baseCiWidth: 0.09,
  lineMoveScale: { spread: 1.5, total: 2.5, moneyline: 25 },
}

const TIER_MULTIPLIERS: Record<ProjectionTier, { signal: number; ci: number }> = {
  pro: { signal: 1, ci: 1 },
  p4: { signal: 0.9, ci: 0.95 },
  mid: { signal: 1.1, ci: 1.1 },
  hbcu: { signal: 1.35, ci: 1.25 },
}

const SIGNAL_TYPE_IMPACT: Record<SharpSignal['type'], number> = {
  STEAM: 0.004,
  RLM: 0.0035,
  SHARP_MONEY: 0.003,
  STALLED: 0.002,
}

const LINE_MOVE_IMPACT = 0.004
const SPLIT_IMPACT = 0.0025
const WHALE_IMPACT = 0.003
const MAX_SIGNAL_BIAS = 0.12

export const normalizeCollegeTeam = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeText = normalizeCollegeTeam

const GENERIC_TEAM_TOKENS = new Set([
  'state',
  'university',
  'college',
  'tech',
  'st',
  'saint',
  'of',
  'the',
])

const scoreTeamMatch = (side: string, team: string) => {
  const normalizedSide = normalizeText(side)
  const normalizedTeam = normalizeText(team)
  if (!normalizedSide || !normalizedTeam) return 0
  let score = 0
  if (normalizedSide === normalizedTeam) score += 5
  if (normalizedSide.includes(normalizedTeam) || normalizedTeam.includes(normalizedSide)) score += 2
  const tokens = normalizedTeam
    .split(' ')
    .filter((token) => token.length >= 2 && !GENERIC_TEAM_TOKENS.has(token))
  if (!tokens.length) return score
  const sideTokens = new Set(normalizedSide.split(' '))
  let matches = 0
  for (const token of tokens) {
    if (sideTokens.has(token)) matches += 1
  }
  return score + matches
}

const resolveSideAlignment = (
  side: string,
  homeTeam: string,
  awayTeam: string
): MarketSide | null => {
  const normalized = normalizeText(side)
  if (!normalized) return null
  if (normalized.includes('over')) return 'over'
  if (normalized.includes('under')) return 'under'
  const homeScore = scoreTeamMatch(side, homeTeam)
  const awayScore = scoreTeamMatch(side, awayTeam)
  if (homeScore === 0 && awayScore === 0) return null
  if (homeScore === awayScore) return null
  return homeScore > awayScore ? 'home' : 'away'
}

const resolveOppositeSide = (side: MarketSide): MarketSide => {
  if (side === 'home') return 'away'
  if (side === 'away') return 'home'
  if (side === 'over') return 'under'
  return 'over'
}

const clampProbability = (value: number) =>
  Math.max(0.01, Math.min(0.99, value))

const resolveSportConfig = (sportKey: string) =>
  SPORT_CONFIGS[sportKey] ?? DEFAULT_CONFIG

const resolveBreakEven = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return oddsToImpliedProbability(-110)
  return oddsToImpliedProbability(odds)
}

const computeConfidenceInterval = (
  probability: number,
  score: number,
  baseWidth: number,
  ciMultiplier: number,
  penalty = 0
) => {
  const dampener = Math.min(0.45, Math.max(0, score) * 0.05)
  const clampedPenalty = Math.max(0, Math.min(0.5, penalty))
  const width = Math.min(
    0.18,
    Math.max(0.03, baseWidth * ciMultiplier * (1 - dampener) * (1 + clampedPenalty))
  )
  return {
    low: clampProbability(probability - width),
    high: clampProbability(probability + width),
  }
}

const computeCoverProbability = (marketLine: number, modelLine: number, stdDev: number) => {
  const expectedMargin = -modelLine
  const threshold = -marketLine
  const zScore = (threshold - expectedMargin) / stdDev
  return clampProbability(1 - normalCDF(zScore))
}

const computeOverProbability = (marketLine: number, modelLine: number, stdDev: number) => {
  const zScore = (marketLine - modelLine) / stdDev
  return clampProbability(1 - normalCDF(zScore))
}

const resolveStdDev = ({
  sportKey,
  tier,
  base,
  hasSignals,
}: {
  sportKey: string
  tier: ProjectionTier
  base: number
  hasSignals: boolean
}) => {
  if (sportKey !== 'basketball_ncaab') return base
  const tierMultiplier = tier === 'p4' ? 1 : tier === 'mid' ? 1.2 : 1.35
  const signalMultiplier = hasSignals ? 1 : 1.15
  return base * tierMultiplier * signalMultiplier
}

const resolveMarketBlend = ({
  sportKey,
  tier,
  hasSignals,
}: {
  sportKey: string
  tier: ProjectionTier
  hasSignals: boolean
}) => {
  if (sportKey !== 'basketball_ncaab') return 0
  const tierBlend = tier === 'p4' ? 0.1 : tier === 'mid' ? 0.2 : 0.3
  const signalBlend = hasSignals ? 0 : 0.15
  return Math.min(0.45, tierBlend + signalBlend)
}

const applyConfidencePenalty = (value: number, penalty: number) =>
  0.5 + (value - 0.5) * (1 - Math.max(0, Math.min(0.5, penalty)))

const resolveLineMovePenalty = (
  lineMovements: LineMovement[] | undefined,
  market: MarketKey
) => {
  const move = lineMovements?.find((entry) => entry.market === market)
  if (!move) return 0
  const opening = Number(move.openingLine)
  const current = Number(move.currentLine)
  if (!Number.isFinite(opening) || !Number.isFinite(current)) return 0
  const delta = Math.abs(current - opening)
  const threshold =
    market === 'spread' ? 1.5 : market === 'total' ? 3 : 25
  if (delta <= threshold) return 0
  return Math.min(0.35, (delta - threshold) / (threshold * 4))
}

const P4_COLLEGE_TEAMS = [
  'Arizona', 'Arizona State', 'Baylor', 'BYU', 'Cincinnati', 'Colorado', 'Houston',
  'Iowa State', 'Kansas', 'Kansas State', 'Oklahoma State', 'TCU', 'Texas Tech',
  'UCF', 'Utah', 'West Virginia',
  'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU',
  'Mississippi State', 'Missouri', 'Ole Miss', 'South Carolina', 'Tennessee',
  'Texas', 'Texas A&M', 'Vanderbilt', 'Oklahoma',
  'Boston College', 'Clemson', 'Duke', 'Florida State', 'Georgia Tech', 'Louisville',
  'Miami', 'NC State', 'North Carolina', 'Pittsburgh', 'Syracuse', 'Virginia',
  'Virginia Tech', 'Wake Forest', 'Notre Dame', 'SMU', 'Stanford', 'Cal',
  'Illinois', 'Indiana', 'Iowa', 'Maryland', 'Michigan', 'Michigan State', 'Minnesota',
  'Nebraska', 'Northwestern', 'Ohio State', 'Penn State', 'Purdue', 'Rutgers',
  'Wisconsin', 'USC', 'UCLA', 'Oregon', 'Washington',
  'Butler', 'Creighton', 'DePaul', 'Georgetown', 'Marquette', 'Providence',
  'Seton Hall', "St. John's", 'Villanova', 'Xavier', 'Connecticut',
]

const HBCU_TEAMS = [
  'Alabama A&M', 'Alabama State', 'Alcorn State', 'Arkansas-Pine Bluff',
  'Bethune-Cookman', 'Florida A&M', 'Grambling State', 'Jackson State',
  'Mississippi Valley State', 'Prairie View A&M', 'Southern', 'Texas Southern',
  'Delaware State', 'Howard', 'Morgan State', 'Norfolk State',
  'North Carolina A&T', 'North Carolina Central', 'South Carolina State',
  'Maryland Eastern Shore', 'Coppin State', 'Hampton',
  'Tennessee State', 'Savannah State',
]

export const P4_TEAM_SET = new Set(P4_COLLEGE_TEAMS.map((team) => normalizeText(team)))
export const HBCU_TEAM_SET = new Set(HBCU_TEAMS.map((team) => normalizeText(team)))

const resolveCollegeTier = (homeTeam: string, awayTeam: string): ProjectionTier => {
  const normalizedHome = normalizeText(homeTeam)
  const normalizedAway = normalizeText(awayTeam)
  if (HBCU_TEAM_SET.has(normalizedHome) || HBCU_TEAM_SET.has(normalizedAway)) return 'hbcu'
  if (P4_TEAM_SET.has(normalizedHome) && P4_TEAM_SET.has(normalizedAway)) return 'p4'
  return 'mid'
}

const resolveTier = (sportKey: string, homeTeam: string, awayTeam: string): ProjectionTier => {
  if (sportKey === 'basketball_ncaab' || sportKey === 'americanfootball_ncaaf') {
    return resolveCollegeTier(homeTeam, awayTeam)
  }
  return 'pro'
}

type SignalBias = {
  bias: number
  score: number
  factors: string[]
}

const resolveSplitDiff = (
  splits: BettingSplits | undefined,
  market: MarketKey,
  side: MarketSide
) => {
  if (!splits) return null
  if (market === 'spread') {
    if (side === 'home') {
      if (splits.spreadHomeMoneyPct == null || splits.spreadHomeBetPct == null) return null
      return splits.spreadHomeMoneyPct - splits.spreadHomeBetPct
    }
    if (splits.spreadAwayMoneyPct == null || splits.spreadAwayBetPct == null) return null
    return splits.spreadAwayMoneyPct - splits.spreadAwayBetPct
  }
  if (market === 'total') {
    if (side === 'over') {
      if (splits.totalOverMoneyPct == null || splits.totalOverBetPct == null) return null
      return splits.totalOverMoneyPct - splits.totalOverBetPct
    }
    if (splits.totalUnderMoneyPct == null || splits.totalUnderBetPct == null) return null
    return splits.totalUnderMoneyPct - splits.totalUnderBetPct
  }
  if (side === 'home') {
    if (splits.mlHomeMoneyPct == null || splits.mlHomeBetPct == null) return null
    return splits.mlHomeMoneyPct - splits.mlHomeBetPct
  }
  if (splits.mlAwayMoneyPct == null || splits.mlAwayBetPct == null) return null
  return splits.mlAwayMoneyPct - splits.mlAwayBetPct
}

const resolveWhaleSideMatch = (
  alert: WhaleAlertInput,
  pickSide: MarketSide,
  homeTeam: string,
  awayTeam: string
) => {
  const payload = `${alert.outcome ?? ''} ${alert.marketTitle ?? ''}`
  const alignment = resolveSideAlignment(payload, homeTeam, awayTeam)
  if (!alignment) return false
  return alignment === pickSide
}

const computeSignalBias = ({
  market,
  pickSide,
  homeTeam,
  awayTeam,
  sharpSignals,
  lineMovements,
  splits,
  whaleAlerts,
  config,
  tierMultiplier,
}: {
  market: MarketKey
  pickSide: MarketSide
  homeTeam: string
  awayTeam: string
  sharpSignals?: SharpSignal[]
  lineMovements?: LineMovement[]
  splits?: BettingSplits
  whaleAlerts?: WhaleAlertInput[]
  config: SportProjectionConfig
  tierMultiplier: { signal: number }
}): SignalBias => {
  let bias = 0
  let score = 0
  const factors: string[] = []

  const pickName =
    pickSide === 'home'
      ? homeTeam
      : pickSide === 'away'
        ? awayTeam
        : pickSide === 'over'
          ? 'Over'
          : 'Under'

  for (const signal of sharpSignals ?? []) {
    if (signal.market !== market) continue
    const alignment = resolveSideAlignment(signal.side, homeTeam, awayTeam)
    if (!alignment) continue
    const opposite = resolveOppositeSide(pickSide)
    if (alignment !== pickSide && alignment !== opposite) continue
    const direction = alignment === pickSide ? 1 : -1
    const impact = SIGNAL_TYPE_IMPACT[signal.type] * signal.strength * tierMultiplier.signal
    bias += direction * impact
    score += Math.abs(impact) / 0.003
    factors.push(`${signal.type} ${signal.side} (${signal.strength}/5)`)
  }

  for (const move of lineMovements ?? []) {
    if (move.market !== market) continue
    if (!move.isSharp && !move.isSignificant) continue
    const alignment = resolveSideAlignment(move.side, homeTeam, awayTeam)
    if (!alignment) continue
    const opposite = resolveOppositeSide(pickSide)
    if (alignment !== pickSide && alignment !== opposite) continue
    if (move.direction === 'neutral') continue
    const direction = alignment === pickSide
      ? move.direction === 'toward'
        ? 1
        : -1
      : move.direction === 'toward'
        ? -1
        : 1
    const movement = Math.abs(move.movement)
    const scale = config.lineMoveScale[market]
    const magnitude = Math.min(2, movement / scale)
    const weight = LINE_MOVE_IMPACT * magnitude * (move.isSharp ? 1.2 : 1)
    bias += direction * weight * tierMultiplier.signal
    score += magnitude
    factors.push(`${move.market} move ${move.openingLine} -> ${move.currentLine}`)
  }

  const splitDiff = resolveSplitDiff(splits, market, pickSide)
  if (splitDiff != null && Math.abs(splitDiff) >= 8) {
    const direction = splitDiff >= 0 ? 1 : -1
    const magnitude = Math.min(2, Math.abs(splitDiff) / 10)
    bias += direction * magnitude * SPLIT_IMPACT * tierMultiplier.signal
    score += magnitude
    factors.push(`Money ${splitDiff.toFixed(1)}% vs bets`)
  }

  for (const alert of whaleAlerts ?? []) {
    if (!resolveWhaleSideMatch(alert, pickSide, homeTeam, awayTeam)) continue
    const notional = alert.notional ?? 0
    if (!Number.isFinite(notional) || notional <= 0) continue
    const magnitude = Math.min(2, Math.log10(notional / 2000 + 1))
    bias += magnitude * WHALE_IMPACT * tierMultiplier.signal
    score += magnitude * 0.6
    factors.push(`Whale ${Math.round(notional).toLocaleString('en-US')}`)
  }

  bias = Math.max(-MAX_SIGNAL_BIAS, Math.min(MAX_SIGNAL_BIAS, bias))

  if (factors.length === 0) {
    factors.push(`Model lean ${pickName}`)
  }

  return { bias, score, factors }
}

const SHARP_BOOK_KEYS = ['pinnacle', 'circa', 'novig', 'prophetx'] as const

const SHARP_BOOK_WEIGHTS: Record<string, number> = {
  pinnacle: 1.25,
  circa: 1.2,
  novig: 1.0,
  prophetx: 0.9,
}

const SPORT_LIMIT_IMPACT: Record<string, number> = {
  basketball_nba: 0.08,
  basketball_ncaab: 0.07,
  americanfootball_nfl: 0.09,
  americanfootball_ncaaf: 0.08,
  baseball_mlb: 0.06,
  icehockey_nhl: 0.06,
}

const parseOptionalFinite = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const parseOptionalPositive = (value: unknown): number | null => {
  const parsed = parseOptionalFinite(value)
  if (parsed == null || parsed <= 0) return null
  return parsed
}

const resolveTwoWayNoVigProbability = (
  forOdds: number | null,
  againstOdds: number | null
) => {
  if (forOdds == null || againstOdds == null) return null
  const forProb = oddsToImpliedProbability(forOdds)
  const againstProb = oddsToImpliedProbability(againstOdds)
  const total = forProb + againstProb
  if (!Number.isFinite(total) || total <= 0) return null
  return clampProbability(forProb / total)
}

const resolveBookWeight = (bookKey: string, forLimit: number | null, againstLimit: number | null) => {
  const base = SHARP_BOOK_WEIGHTS[bookKey] ?? 1
  const maxLimit = Math.max(forLimit ?? 0, againstLimit ?? 0)
  if (!maxLimit) return base
  const liquidityBoost = Math.min(0.5, Math.log10(maxLimit + 1) * 0.12)
  return base + liquidityBoost
}

const resolvePressureLabel = (score: number) => {
  if (score >= 0.05) return 'Strong contraction'
  if (score >= 0.015) return 'Moderate contraction'
  if (score <= -0.05) return 'Strong expansion'
  if (score <= -0.015) return 'Moderate expansion'
  return 'Balanced limits'
}

const resolveLineMovementPressure = ({
  lineMovements,
  market,
  forSide,
  homeTeam,
  awayTeam,
}: {
  lineMovements?: LineMovement[]
  market: MarketKey
  forSide: MarketSide
  homeTeam: string
  awayTeam: string
}) => {
  let pressure = 0
  const factors: string[] = []
  for (const move of lineMovements ?? []) {
    if (move.market !== market || move.direction === 'neutral') continue
    const aligned = resolveSideAlignment(move.side, homeTeam, awayTeam)
    if (!aligned) continue
    const toward = move.direction === 'toward' ? 1 : -1
    const sideDirection = aligned === forSide ? 1 : -1
    const magnitude = Math.min(2.5, Math.abs(move.movement))
    const signalWeight = move.isSharp ? 0.008 : move.isSignificant ? 0.005 : 0.003
    pressure += toward * sideDirection * magnitude * signalWeight
    if (Math.abs(magnitude) >= 0.5) {
      factors.push(`${move.market} move ${move.openingLine} -> ${move.currentLine}`)
    }
  }
  return { pressure, factors }
}

type PairedQuote = {
  bookKey: string
  forOdds: number | null
  againstOdds: number | null
  forLimit: number | null
  againstLimit: number | null
}

const resolveMarketFromPairs = ({
  pairs,
  fallbackForOdds,
  fallbackAgainstOdds,
  sportKey,
  market,
  forSide,
  sideLabel,
  homeTeam,
  awayTeam,
  lineMovements,
}: {
  pairs: PairedQuote[]
  fallbackForOdds?: number
  fallbackAgainstOdds?: number
  sportKey: string
  market: MarketKey
  forSide: MarketSide
  sideLabel: string
  homeTeam: string
  awayTeam: string
  lineMovements?: LineMovement[]
}) => {
  let weightedProb = 0
  let totalWeight = 0
  let limitPressure = 0
  const factors: string[] = []
  const limitImpact = SPORT_LIMIT_IMPACT[sportKey] ?? 0.07

  for (const pair of pairs) {
    const noVig = resolveTwoWayNoVigProbability(pair.forOdds, pair.againstOdds)
    if (noVig == null) continue
    const weight = resolveBookWeight(pair.bookKey, pair.forLimit, pair.againstLimit)
    weightedProb += noVig * weight
    totalWeight += weight

    const forLimit = pair.forLimit
    const againstLimit = pair.againstLimit
    if (forLimit != null && againstLimit != null && forLimit + againstLimit > 0) {
      const imbalance = (forLimit - againstLimit) / (forLimit + againstLimit)
      const pressure = -imbalance * limitImpact * weight
      limitPressure += pressure
      if (Math.abs(imbalance) >= 0.08) {
        factors.push(
          `${pair.bookKey}: ${forLimit < againstLimit ? 'contracting' : 'expanding'} vs opposite side`
        )
      }
    }
  }

  const fallbackProb = resolveTwoWayNoVigProbability(
    parseOptionalFinite(fallbackForOdds ?? null),
    parseOptionalFinite(fallbackAgainstOdds ?? null)
  )
  const baseProbability =
    totalWeight > 0 ? clampProbability(weightedProb / totalWeight) : fallbackProb ?? 0.5

  const lineMovementSignal = resolveLineMovementPressure({
    lineMovements,
    market,
    forSide,
    homeTeam,
    awayTeam,
  })
  const finalPressure = limitPressure + lineMovementSignal.pressure
  const probability = clampProbability(baseProbability + finalPressure)
  const breakEven = resolveBreakEven(fallbackForOdds ?? null)
  const edgePercent = Math.max(0, (probability - breakEven) * 100)
  const pressureLabel = resolvePressureLabel(finalPressure)

  const mergedFactors = [...factors, ...lineMovementSignal.factors]
  if (!mergedFactors.length) {
    mergedFactors.push(`${pressureLabel} on ${sideLabel}`)
  }

  return {
    probability,
    breakEven,
    edgePercent,
    sharpFairOdds: probabilityToAmericanOdds(probability),
    limitPressureScore: finalPressure,
    limitPressureLabel: pressureLabel,
    factors: mergedFactors,
  }
}

const resolveSpreadPairs = (spread?: SpreadMarketInput): PairedQuote[] => {
  const bookQuotes = (spread as { bookQuotes?: Record<string, unknown> } | undefined)?.bookQuotes
  if (!bookQuotes) return []
  const pairs: PairedQuote[] = []
  for (const key of SHARP_BOOK_KEYS) {
    const quote = (bookQuotes[key] ?? null) as Record<string, unknown> | null
    if (!quote) continue
    pairs.push({
      bookKey: key,
      forOdds: parseOptionalFinite(quote.homeOdds),
      againstOdds: parseOptionalFinite(quote.awayOdds),
      forLimit: parseOptionalPositive(quote.homeLimit),
      againstLimit: parseOptionalPositive(quote.awayLimit),
    })
  }
  return pairs
}

const resolveTotalPairs = (total?: TotalMarketInput): PairedQuote[] => {
  const bookQuotes = (total as { bookQuotes?: Record<string, unknown> } | undefined)?.bookQuotes
  if (!bookQuotes) return []
  const pairs: PairedQuote[] = []
  for (const key of SHARP_BOOK_KEYS) {
    const quote = (bookQuotes[key] ?? null) as Record<string, unknown> | null
    if (!quote) continue
    pairs.push({
      bookKey: key,
      forOdds: parseOptionalFinite(quote.overOdds),
      againstOdds: parseOptionalFinite(quote.underOdds),
      forLimit: parseOptionalPositive(quote.overLimit),
      againstLimit: parseOptionalPositive(quote.underLimit),
    })
  }
  return pairs
}

const resolveMoneylinePairs = (moneyline?: MoneylineMarketInput): PairedQuote[] => {
  const bookQuotes = (moneyline as { bookQuotes?: Record<string, unknown> } | undefined)?.bookQuotes
  if (!bookQuotes) return []
  const pairs: PairedQuote[] = []
  for (const key of SHARP_BOOK_KEYS) {
    const quote = (bookQuotes[key] ?? null) as Record<string, unknown> | null
    if (!quote) continue
    pairs.push({
      bookKey: key,
      forOdds: parseOptionalFinite(quote.homeOdds),
      againstOdds: parseOptionalFinite(quote.awayOdds),
      forLimit: parseOptionalPositive(quote.homeLimit),
      againstLimit: parseOptionalPositive(quote.awayLimit),
    })
  }
  return pairs
}

export const buildSharpProjections = (input: SharpProjectionInput): SharpProjections => {
  const tier = resolveTier(input.sportKey, input.homeTeam, input.awayTeam)
  const projections: SharpProjections = { tier }

  if (input.spread) {
    const homeResult = resolveMarketFromPairs({
      pairs: resolveSpreadPairs(input.spread),
      fallbackForOdds: input.spread.bestHomeOdds ?? input.spread.bestOdds,
      fallbackAgainstOdds: input.spread.bestAwayOdds ?? input.spread.bestOdds,
      sportKey: input.sportKey,
      market: 'spread',
      forSide: 'home',
      sideLabel: input.homeTeam,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      lineMovements: input.lineMovements,
    })
    const homeProb = clampProbability(homeResult.probability)
    const awayProb = clampProbability(1 - homeProb)
    const pickHome = homeProb >= awayProb
    const probability = pickHome ? homeProb : awayProb
    const breakEven = pickHome
      ? resolveBreakEven(input.spread.bestHomeOdds ?? input.spread.bestOdds)
      : resolveBreakEven(input.spread.bestAwayOdds ?? input.spread.bestOdds)
    projections.spread = {
      side: pickHome ? input.homeTeam : input.awayTeam,
      probability,
      confidenceInterval: {
        low: clampProbability(probability - 0.015),
        high: clampProbability(probability + 0.015),
      },
      edgePercent: Math.max(0, (probability - breakEven) * 100),
      breakEven,
      factors: homeResult.factors,
      sharpFairOdds: probabilityToAmericanOdds(probability),
      limitPressureScore: pickHome
        ? homeResult.limitPressureScore
        : -(homeResult.limitPressureScore ?? 0),
      limitPressureLabel: homeResult.limitPressureLabel,
    }
  }

  if (input.total) {
    const overResult = resolveMarketFromPairs({
      pairs: resolveTotalPairs(input.total),
      fallbackForOdds: input.total.bestOdds,
      fallbackAgainstOdds: input.total.bestUnderOdds ?? input.total.bestOdds,
      sportKey: input.sportKey,
      market: 'total',
      forSide: 'over',
      sideLabel: 'Over',
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      lineMovements: input.lineMovements,
    })
    const overProb = clampProbability(overResult.probability)
    const underProb = clampProbability(1 - overProb)
    const pickOver = overProb >= underProb
    const probability = pickOver ? overProb : underProb
    const breakEven = pickOver
      ? resolveBreakEven(input.total.bestOdds)
      : resolveBreakEven(input.total.bestUnderOdds ?? input.total.bestOdds)
    projections.total = {
      side: pickOver ? 'Over' : 'Under',
      probability,
      confidenceInterval: {
        low: clampProbability(probability - 0.015),
        high: clampProbability(probability + 0.015),
      },
      edgePercent: Math.max(0, (probability - breakEven) * 100),
      breakEven,
      factors: overResult.factors,
      sharpFairOdds: probabilityToAmericanOdds(probability),
      limitPressureScore: pickOver
        ? overResult.limitPressureScore
        : -(overResult.limitPressureScore ?? 0),
      limitPressureLabel: overResult.limitPressureLabel,
    }
  }

  if (input.moneyline) {
    const homeResult = resolveMarketFromPairs({
      pairs: resolveMoneylinePairs(input.moneyline),
      fallbackForOdds: input.moneyline.sportsbook?.homeOdds,
      fallbackAgainstOdds: input.moneyline.sportsbook?.awayOdds,
      sportKey: input.sportKey,
      market: 'moneyline',
      forSide: 'home',
      sideLabel: input.homeTeam,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      lineMovements: input.lineMovements,
    })
    const homeProb = clampProbability(homeResult.probability)
    const awayProb = clampProbability(1 - homeProb)
    const pickHome = homeProb >= awayProb
    const probability = pickHome ? homeProb : awayProb
    const breakEven = pickHome
      ? resolveBreakEven(input.moneyline.sportsbook?.homeOdds)
      : resolveBreakEven(input.moneyline.sportsbook?.awayOdds)
    projections.moneyline = {
      side: pickHome ? input.homeTeam : input.awayTeam,
      probability,
      confidenceInterval: {
        low: clampProbability(probability - 0.015),
        high: clampProbability(probability + 0.015),
      },
      edgePercent: Math.max(0, (probability - breakEven) * 100),
      breakEven,
      factors: homeResult.factors,
      sharpFairOdds: probabilityToAmericanOdds(probability),
      limitPressureScore: pickHome
        ? homeResult.limitPressureScore
        : -(homeResult.limitPressureScore ?? 0),
      limitPressureLabel: homeResult.limitPressureLabel,
    }
  }

  return projections
}
