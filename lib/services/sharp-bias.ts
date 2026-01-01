import type { SharpSignal } from './edge-detection'

type SharpSplitInput = {
  spreadHomeBetPct?: number | null
  spreadHomeMoneyPct?: number | null
  totalOverBetPct?: number | null
  totalOverMoneyPct?: number | null
  sharpSide?: string | null
  spreadBetsPct?: number | null
  spreadMoneyPct?: number | null
}

type SharpBiasResult = {
  spreadBias: number
  totalBias: number
  spreadNotes: string[]
  totalNotes: string[]
}

const SHARP_TYPE_WEIGHT: Record<SharpSignal['type'], number> = {
  SHARP_MONEY: 1.0,
  STEAM: 0.85,
  RLM: 0.7,
  STALLED: 0.4,
}

const SHARP_BIAS_LIMITS: Record<
  string,
  { spread: number; total: number }
> = {
  nba: { spread: 1.2, total: 3.0 },
  ncaab: { spread: 1.5, total: 3.5 },
  nfl: { spread: 1.8, total: 3.2 },
  ncaaf: { spread: 1.9, total: 3.8 },
  nhl: { spread: 0.4, total: 0.8 },
  mlb: { spread: 0.4, total: 1.0 },
}

const normalizeSportKey = (value?: string): string => {
  if (!value) return 'nba'
  const key = value.toLowerCase().replace(/[^a-z]/g, '')
  if (key.includes('basketballnba') || key === 'nba') return 'nba'
  if (key.includes('basketballncaab') || key === 'ncaab') return 'ncaab'
  if (key.includes('americanfootballnfl') || key === 'nfl') return 'nfl'
  if (key.includes('americanfootballncaaf') || key === 'ncaaf' || key === 'cfb') {
    return 'ncaaf'
  }
  if (key.includes('icehockeynhl') || key === 'nhl') return 'nhl'
  if (key.includes('baseballmlb') || key === 'mlb') return 'mlb'
  return key || 'nba'
}

const normalizeTeam = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const teamMatches = (side: string, team: string) => {
  const sideNorm = normalizeTeam(side)
  const teamNorm = normalizeTeam(team)
  if (!sideNorm || !teamNorm) return false
  if (sideNorm.includes(teamNorm) || teamNorm.includes(sideNorm)) return true
  const sideTokens = sideNorm.split(' ').filter((token) => token.length > 2)
  const teamTokens = teamNorm.split(' ').filter((token) => token.length > 2)
  return (
    teamTokens.every((token) => sideTokens.includes(token)) ||
    sideTokens.every((token) => teamTokens.includes(token))
  )
}

const scoreSignal = (signal: SharpSignal) =>
  signal.strength * (SHARP_TYPE_WEIGHT[signal.type] ?? 0.6)

const buildNotes = (signals: SharpSignal[]) =>
  signals
    .slice()
    .sort((a, b) => scoreSignal(b) - scoreSignal(a))
    .slice(0, 2)
    .map((signal) => `${signal.type}: ${signal.description}`)

const computeBias = (
  netScore: number,
  maxBias: number,
  directionMultiplier: number
) => {
  if (!netScore || !Number.isFinite(netScore)) return 0
  const scale = Math.min(1, Math.abs(netScore) / 6)
  return directionMultiplier * Math.sign(netScore) * maxBias * scale
}

export function buildSharpSignalsFromSplits(opts: {
  splits?: SharpSplitInput | null
  homeTeam: string
  awayTeam: string
}): SharpSignal[] {
  const { splits, homeTeam, awayTeam } = opts
  if (!splits) return []

  const signals: SharpSignal[] = []
  const homeBetPct = splits.spreadHomeBetPct ?? splits.spreadBetsPct
  const homeMoneyPct = splits.spreadHomeMoneyPct ?? splits.spreadMoneyPct

  if (homeBetPct != null && homeMoneyPct != null) {
    const divergence = homeMoneyPct - homeBetPct
    if (Math.abs(divergence) >= 15) {
      const side = divergence > 0 ? homeTeam : awayTeam
      const strength = Math.abs(divergence) >= 25 ? 5 : Math.abs(divergence) >= 20 ? 4 : 3
      signals.push({
        type: 'SHARP_MONEY',
        market: 'spread',
        side,
        strength,
        description: `${Math.abs(divergence).toFixed(0)}% money/bet divergence on ${side} spread`,
        confidence: Math.abs(divergence) >= 20 ? 'high' : 'medium',
      })
    }
  }

  const overBetPct = splits.totalOverBetPct
  const overMoneyPct = splits.totalOverMoneyPct
  if (overBetPct != null && overMoneyPct != null) {
    const divergence = overMoneyPct - overBetPct
    if (Math.abs(divergence) >= 15) {
      const side = divergence > 0 ? 'Over' : 'Under'
      const strength = Math.abs(divergence) >= 25 ? 5 : Math.abs(divergence) >= 20 ? 4 : 3
      signals.push({
        type: 'SHARP_MONEY',
        market: 'total',
        side,
        strength,
        description: `${Math.abs(divergence).toFixed(0)}% money/bet divergence on ${side}`,
        confidence: Math.abs(divergence) >= 20 ? 'high' : 'medium',
      })
    }
  }

  if (!signals.length && splits.sharpSide) {
    const normalized = splits.sharpSide.toLowerCase()
    let side: string | null = null
    if (normalized.includes('home')) side = homeTeam
    if (normalized.includes('away')) side = awayTeam
    if (side) {
      signals.push({
        type: 'SHARP_MONEY',
        market: 'spread',
        side,
        strength: 3,
        description: `Sharp indicator on ${side}`,
        confidence: 'medium',
      })
    }
  }

  return signals
}

export function calculateSharpBiasFromSignals(opts: {
  sharpSignals?: SharpSignal[] | null
  homeTeam: string
  awayTeam: string
  sport?: string
}): SharpBiasResult {
  const { sharpSignals, homeTeam, awayTeam, sport } = opts
  if (!sharpSignals || sharpSignals.length === 0) {
    return { spreadBias: 0, totalBias: 0, spreadNotes: [], totalNotes: [] }
  }

  const sportKey = normalizeSportKey(sport)
  const limits = SHARP_BIAS_LIMITS[sportKey] ?? SHARP_BIAS_LIMITS.nba

  let homeScore = 0
  let awayScore = 0
  const spreadSignals = sharpSignals.filter((signal) => signal.market === 'spread')

  for (const signal of spreadSignals) {
    const score = scoreSignal(signal)
    if (teamMatches(signal.side, homeTeam)) homeScore += score
    else if (teamMatches(signal.side, awayTeam)) awayScore += score
  }

  const spreadNet = homeScore - awayScore
  const spreadBias = computeBias(spreadNet, limits.spread, -1)

  let overScore = 0
  let underScore = 0
  const totalSignals = sharpSignals.filter((signal) => signal.market === 'total')
  for (const signal of totalSignals) {
    const score = scoreSignal(signal)
    const side = signal.side.toLowerCase()
    if (side === 'over') overScore += score
    if (side === 'under') underScore += score
  }

  const totalNet = overScore - underScore
  const totalBias = computeBias(totalNet, limits.total, 1)

  return {
    spreadBias: Number(spreadBias.toFixed(2)),
    totalBias: Number(totalBias.toFixed(2)),
    spreadNotes: buildNotes(spreadSignals),
    totalNotes: buildNotes(totalSignals),
  }
}
