import { normalCDF, oddsToImpliedProbability } from '@/lib/utils/statistics'
import type { BettingSplits, LineMovement, SharpSignal } from './edge-detection'

type MarketKey = 'spread' | 'total' | 'moneyline'
type MarketSide = 'home' | 'away' | 'over' | 'under'
type ProjectionTier = 'pro' | 'p4' | 'mid' | 'hbcu'

export type SharpProjectionMarket = {
  side: string
  probability: number
  confidenceInterval: { low: number; high: number }
  edgePercent: number
  breakEven: number
  factors: string[]
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
}

type TotalMarketInput = {
  marketLine: number
  targetLine: number
  bestOdds?: number
  bestUnderOdds?: number
}

type MoneylineMarketInput = {
  sportsbook?: {
    homeOdds?: number
    awayOdds?: number
  }
  model?: {
    homeProbability?: number
  }
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
    lineMoveScale: { spread: 2.5, total: 4, moneyline: 35 },
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
  ciMultiplier: number
) => {
  const dampener = Math.min(0.45, score * 0.05)
  const width = Math.min(0.18, Math.max(0.03, baseWidth * ciMultiplier * (1 - dampener)))
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

export const buildSharpProjections = (input: SharpProjectionInput): SharpProjections => {
  const config = resolveSportConfig(input.sportKey)
  const tier = resolveTier(input.sportKey, input.homeTeam, input.awayTeam)
  const tierMultiplier = TIER_MULTIPLIERS[tier] ?? TIER_MULTIPLIERS.pro
  const projections: SharpProjections = { tier }
  const hasSignals =
    (input.sharpSignals?.length ?? 0) +
      (input.lineMovements?.length ?? 0) +
      (input.splits ? 1 : 0) +
      (input.whaleAlerts?.length ?? 0) >
    0

  if (
    input.spread &&
    Number.isFinite(input.spread.marketLine) &&
    Number.isFinite(input.spread.targetLine)
  ) {
    const marketLine = input.spread.marketLine
    const modelLine = input.spread.targetLine
    const marginStdDev = resolveStdDev({
      sportKey: input.sportKey,
      tier,
      base: config.marginStdDev,
      hasSignals,
    })
    let baseHomeProb = computeCoverProbability(marketLine, modelLine, marginStdDev)
    const marketBlend = resolveMarketBlend({
      sportKey: input.sportKey,
      tier,
      hasSignals,
    })
    const hasMarketOdds =
      Number.isFinite(input.spread.bestHomeOdds) ||
      Number.isFinite(input.spread.bestAwayOdds) ||
      Number.isFinite(input.spread.bestOdds)
    if (marketBlend > 0 && hasMarketOdds) {
      const baseAwayProb = 1 - baseHomeProb
      const marketHome = resolveBreakEven(
        input.spread.bestHomeOdds ?? input.spread.bestOdds
      )
      const marketAway = resolveBreakEven(
        input.spread.bestAwayOdds ?? input.spread.bestOdds
      )
      const blendedHome = baseHomeProb * (1 - marketBlend) + marketHome * marketBlend
      const blendedAway = baseAwayProb * (1 - marketBlend) + marketAway * marketBlend
      const total = blendedHome + blendedAway
      baseHomeProb = total > 0 ? blendedHome / total : blendedHome
    }
    const homeBias = computeSignalBias({
      market: 'spread',
      pickSide: 'home',
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      sharpSignals: input.sharpSignals,
      lineMovements: input.lineMovements,
      splits: input.splits,
      whaleAlerts: input.whaleAlerts,
      config,
      tierMultiplier,
    })
    const awayBias = computeSignalBias({
      market: 'spread',
      pickSide: 'away',
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      sharpSignals: input.sharpSignals,
      lineMovements: input.lineMovements,
      splits: input.splits,
      whaleAlerts: input.whaleAlerts,
      config,
      tierMultiplier,
    })

    const rawHome = clampProbability(baseHomeProb + homeBias.bias)
    const rawAway = clampProbability(1 - baseHomeProb + awayBias.bias)
    const totalProb = rawHome + rawAway
    const homeProb = totalProb > 0 ? rawHome / totalProb : rawHome
    const awayProb = totalProb > 0 ? rawAway / totalProb : rawAway
    const pickSide: MarketSide = homeProb >= awayProb ? 'home' : 'away'
    const probability = pickSide === 'home' ? homeProb : awayProb
    const signalBias = pickSide === 'home' ? homeBias : awayBias

    const pickLabel = pickSide === 'home' ? input.homeTeam : input.awayTeam
    const breakEven = resolveBreakEven(
      pickSide === 'home'
        ? input.spread.bestHomeOdds ?? input.spread.bestOdds
        : input.spread.bestAwayOdds ?? input.spread.bestOdds
    )
    const edgePercent = Math.max(0, (probability - breakEven) * 100)
    const confidenceInterval = computeConfidenceInterval(
      probability,
      signalBias.score,
      config.baseCiWidth,
      tierMultiplier.ci
    )
    projections.spread = {
      side: pickLabel,
      probability,
      confidenceInterval,
      edgePercent,
      breakEven,
      factors: signalBias.factors,
    }
  }

  if (
    input.total &&
    Number.isFinite(input.total.marketLine) &&
    Number.isFinite(input.total.targetLine)
  ) {
    const marketLine = input.total.marketLine
    const modelLine = input.total.targetLine
    const totalStdDev = resolveStdDev({
      sportKey: input.sportKey,
      tier,
      base: config.totalStdDev,
      hasSignals,
    })
    let baseOverProb = computeOverProbability(marketLine, modelLine, totalStdDev)
    const marketBlend = resolveMarketBlend({
      sportKey: input.sportKey,
      tier,
      hasSignals,
    })
    const hasMarketOdds =
      Number.isFinite(input.total.bestOdds) ||
      Number.isFinite(input.total.bestUnderOdds)
    if (marketBlend > 0 && hasMarketOdds) {
      const baseUnderProb = 1 - baseOverProb
      const marketOver = resolveBreakEven(input.total.bestOdds)
      const marketUnder = resolveBreakEven(input.total.bestUnderOdds ?? input.total.bestOdds)
      const blendedOver = baseOverProb * (1 - marketBlend) + marketOver * marketBlend
      const blendedUnder = baseUnderProb * (1 - marketBlend) + marketUnder * marketBlend
      const total = blendedOver + blendedUnder
      baseOverProb = total > 0 ? blendedOver / total : blendedOver
    }
    const overBias = computeSignalBias({
      market: 'total',
      pickSide: 'over',
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      sharpSignals: input.sharpSignals,
      lineMovements: input.lineMovements,
      splits: input.splits,
      whaleAlerts: input.whaleAlerts,
      config,
      tierMultiplier,
    })
    const underBias = computeSignalBias({
      market: 'total',
      pickSide: 'under',
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      sharpSignals: input.sharpSignals,
      lineMovements: input.lineMovements,
      splits: input.splits,
      whaleAlerts: input.whaleAlerts,
      config,
      tierMultiplier,
    })

    const rawOver = clampProbability(baseOverProb + overBias.bias)
    const rawUnder = clampProbability(1 - baseOverProb + underBias.bias)
    const totalProb = rawOver + rawUnder
    const overProb = totalProb > 0 ? rawOver / totalProb : rawOver
    const underProb = totalProb > 0 ? rawUnder / totalProb : rawUnder

    const pickSide: MarketSide = overProb >= underProb ? 'over' : 'under'
    const probability = pickSide === 'over' ? overProb : underProb
    const signalBias = pickSide === 'over' ? overBias : underBias

    const pickLabel = pickSide === 'over' ? 'Over' : 'Under'
    const odds = pickSide === 'over' ? input.total.bestOdds : input.total.bestUnderOdds
    const breakEven = resolveBreakEven(odds)
    const edgePercent = Math.max(0, (probability - breakEven) * 100)
    const confidenceInterval = computeConfidenceInterval(
      probability,
      signalBias.score,
      config.baseCiWidth,
      tierMultiplier.ci
    )
    projections.total = {
      side: pickLabel,
      probability,
      confidenceInterval,
      edgePercent,
      breakEven,
      factors: signalBias.factors,
    }
  }

  const moneyline = input.moneyline
  if (moneyline) {
    let baseHomeProb = moneyline.model?.homeProbability
    if (!Number.isFinite(baseHomeProb) && input.spread?.targetLine != null) {
      const marginStdDev = resolveStdDev({
        sportKey: input.sportKey,
        tier,
        base: config.marginStdDev,
        hasSignals,
      })
      baseHomeProb = normalCDF(
        -(input.spread.targetLine as number) / marginStdDev
      )
    }
    if (Number.isFinite(baseHomeProb)) {
      const marketBlend = resolveMarketBlend({
        sportKey: input.sportKey,
        tier,
        hasSignals,
      })
      const hasMarketOdds =
        Number.isFinite(moneyline.sportsbook?.homeOdds) ||
        Number.isFinite(moneyline.sportsbook?.awayOdds)
      if (marketBlend > 0 && hasMarketOdds) {
        const baseAwayProb = 1 - (baseHomeProb as number)
        const marketHome = resolveBreakEven(moneyline.sportsbook?.homeOdds)
        const marketAway = resolveBreakEven(moneyline.sportsbook?.awayOdds)
        const blendedHome =
          (baseHomeProb as number) * (1 - marketBlend) + marketHome * marketBlend
        const blendedAway = baseAwayProb * (1 - marketBlend) + marketAway * marketBlend
        const total = blendedHome + blendedAway
        baseHomeProb = total > 0 ? blendedHome / total : blendedHome
      }
      const homeSignal = computeSignalBias({
        market: 'moneyline',
        pickSide: 'home',
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        sharpSignals: input.sharpSignals,
        lineMovements: input.lineMovements,
        splits: input.splits,
        whaleAlerts: input.whaleAlerts,
        config,
        tierMultiplier,
      })
      const awaySignal = computeSignalBias({
        market: 'moneyline',
        pickSide: 'away',
        homeTeam: input.homeTeam,
        awayTeam: input.awayTeam,
        sharpSignals: input.sharpSignals,
        lineMovements: input.lineMovements,
        splits: input.splits,
        whaleAlerts: input.whaleAlerts,
        config,
        tierMultiplier,
      })
      const rawHome = clampProbability((baseHomeProb as number) + homeSignal.bias)
      const rawAway = clampProbability(1 - (baseHomeProb as number) + awaySignal.bias)
      const totalProb = rawHome + rawAway
      const homeProb = totalProb > 0 ? rawHome / totalProb : rawHome
      const awayProb = totalProb > 0 ? rawAway / totalProb : rawAway

      const pickHome = homeProb >= awayProb
      const pickSide = pickHome ? 'home' : 'away'
      const pickLabel = pickHome ? input.homeTeam : input.awayTeam
      const probability = pickHome ? homeProb : awayProb
      const breakEven = resolveBreakEven(
        pickHome ? moneyline.sportsbook?.homeOdds : moneyline.sportsbook?.awayOdds
      )
      const edgePercent = Math.max(0, (probability - breakEven) * 100)
      const pickSignal = pickHome ? homeSignal : awaySignal
      const confidenceInterval = computeConfidenceInterval(
        probability,
        pickSignal.score,
        config.baseCiWidth,
        tierMultiplier.ci
      )
      projections.moneyline = {
        side: pickLabel,
        probability,
        confidenceInterval,
        edgePercent,
        breakEven,
        factors: pickSignal.factors,
      }
    }
  }

  return projections
}
