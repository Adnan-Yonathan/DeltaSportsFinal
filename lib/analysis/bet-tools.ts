export type MarketType =
  | 'spread'
  | 'total'
  | 'moneyline'
  | 'player_prop'
  | 'team_prop'
  | 'quarter'
  | 'live'
  | 'unknown'

export type EdgeVerdict = 'none' | 'soft' | 'strong'
export type EdgeConfidence = 'low' | 'medium' | 'high'

export interface EdgeAssessment {
  verdict: EdgeVerdict
  confidence: EdgeConfidence
  reason: string
  flag?: string
}

export const formatPercent = (value?: number | null): string => {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  return `${Math.round(value * 100)}%`
}

const clampSignals = (value?: number): number => {
  if (!Number.isFinite(value || 0)) return 0
  return Math.max(0, Math.min(5, value || 0))
}

const edgeConfidence = (verdict: EdgeVerdict): EdgeConfidence => {
  if (verdict === 'strong') return 'high'
  if (verdict === 'soft') return 'medium'
  return 'low'
}

const lineThresholds: Record<string, { soft: number; strong: number }> = {
  spread: { soft: 1.5, strong: 3 },
  total: { soft: 3, strong: 6 },
  quarter: { soft: 1.5, strong: 3 },
}

export function evaluateLineEdge(opts: {
  marketType: MarketType
  line?: number | null
  targetLine?: number | null
  supportingSignals?: number
}): EdgeAssessment {
  const diff =
    opts.line != null && opts.targetLine != null
      ? Math.abs(opts.targetLine - opts.line)
      : null
  const thresholds = lineThresholds[opts.marketType] || lineThresholds.spread
  let verdict: EdgeVerdict = 'none'

  if (diff != null && diff >= thresholds.strong) verdict = 'strong'
  else if (diff != null && diff >= thresholds.soft) verdict = 'soft'

  const signals = clampSignals(opts.supportingSignals)
  const flag =
    verdict === 'strong' && signals >= 2
      ? 'Line looks mispriced vs model + supporting stats'
      : undefined

  const reason =
    diff == null
      ? 'Need a market line to compare against model expectations.'
      : `Model gap is ${diff.toFixed(1)} points vs the provided line.`

  return {
    verdict,
    confidence: edgeConfidence(verdict),
    reason,
    flag,
  }
}

export function evaluatePropEdge(opts: {
  line?: number | null
  direction?: 'over' | 'under' | null
  seasonHitRate?: number | null
  lastTenHitRate?: number | null
  seasonAvg?: number | null
  lineDeltaThreshold?: number
}): EdgeAssessment {
  const line = opts.line
  const direction = opts.direction ?? 'over'
  const seasonRate = opts.seasonHitRate ?? null
  const lastTenRate = opts.lastTenHitRate ?? null
  const threshold = opts.lineDeltaThreshold ?? 2
  const avg = opts.seasonAvg ?? null
  const delta =
    line != null && avg != null
      ? direction === 'under'
        ? line - avg
        : avg - line
      : null

  const strong =
    seasonRate != null &&
    lastTenRate != null &&
    seasonRate >= 0.65 &&
    lastTenRate >= 0.7 &&
    (delta != null ? delta >= threshold : false)
  const soft =
    !strong &&
    ((seasonRate != null && seasonRate >= 0.65) || (lastTenRate != null && lastTenRate >= 0.7)) &&
    (delta != null ? delta >= threshold : false)

  const verdict: EdgeVerdict = strong ? 'strong' : soft ? 'soft' : 'none'
  const confidence = edgeConfidence(verdict)

  const parts: string[] = []
  if (seasonRate != null) parts.push(`season hit rate ${formatPercent(seasonRate)}`)
  if (lastTenRate != null) parts.push(`last 10 hit rate ${formatPercent(lastTenRate)}`)
  if (avg != null && line != null) parts.push(`avg ${avg.toFixed(1)} vs line ${line.toFixed(1)}`)

  const flag =
    verdict === 'strong' &&
    ((seasonRate != null && seasonRate >= 0.75) || (lastTenRate != null && lastTenRate >= 0.75))
      ? 'Line looks out of range vs recent hit rates'
      : undefined

  return {
    verdict,
    confidence,
    reason: parts.length ? parts.join('; ') : 'Insufficient prop history to rate edge.',
    flag,
  }
}

export function buildPickGuidanceResponse(opts: {
  subject?: string
  marketHint?: string | null
  missingInfo?: string[]
  appCapabilities?: string[]
}): string {
  const subjectLine = opts.subject ? `Best-bet map for: ${opts.subject}` : 'Best-bet map'
  const capabilities =
    opts.appCapabilities && opts.appCapabilities.length
      ? opts.appCapabilities
      : [
          'Odds line shopping + best book',
          'Betting splits (spread/moneyline/total only)',
          'Injury reports + team/player stat context',
          'Prop lines + best over/under prices',
          'Model-style projections (on request)',
        ]
  const missing =
    opts.missingInfo && opts.missingInfo.length
      ? opts.missingInfo
      : ['League + game date/time', 'Market type (spread/total/props)', 'Your book(s) + risk preference']

  const hint = opts.marketHint ? `Market focus: ${opts.marketHint}` : null

  return [
    subjectLine,
    hint ? `\n${hint}` : null,
    '\nHow to find the best bet (fast checklist)',
    '1) Compare lines and juice across books; capture the best price.',
    '2) Check data vs market (injuries, rest, trends, splits).',
    '3) Choose the softest market (props/derivatives) and confirm price.',
    '\nWhere edge usually shows up (ranked)',
    '- Player props (softer markets, faster mispricings)',
    '- First-half/quarter markets (pace/rest mismatches show early)',
    '- Alt lines/alt totals (price sensitivity on a lean)',
    '- Live markets (momentum/pace swings create short windows)',
    '\nWhat Delta can provide right now',
    ...capabilities.map((item) => `- ${item}`),
    '\nWhat I need to narrow it down',
    ...missing.map((item) => `- ${item}`),
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildAnalysisResponse(opts: {
  title: string
  marketLabel?: string
  inputs?: string[]
  snapshotLines: string[]
  deltas?: string[]
  edge: EdgeAssessment
  nextActions: string[]
  missingInfo?: string[]
}): string {
  const header = opts.marketLabel
    ? `Analysis: ${opts.title} (${opts.marketLabel})`
    : `Analysis: ${opts.title}`

  const lines: string[] = [
    header,
    ...(opts.inputs && opts.inputs.length
      ? ['\nInputs', ...opts.inputs.map((line) => `- ${line}`)]
      : []),
    '\nMarket snapshot',
    ...opts.snapshotLines.map((line) => `- ${line}`),
    ...(opts.deltas && opts.deltas.length
      ? ['\nDeltas', ...opts.deltas.map((line) => `- ${line}`)]
      : []),
    '\nEdge check',
    `- Verdict: ${opts.edge.verdict}`,
    `- Why: ${opts.edge.reason}`,
    `- Confidence: ${opts.edge.confidence}`,
  ]

  if (opts.edge.flag) {
    lines.push(`- Flag: ${opts.edge.flag}`)
  }

  lines.push('\nWhat Delta can do next')
  lines.push(...opts.nextActions.map((item) => `- ${item}`))

  if (opts.missingInfo && opts.missingInfo.length) {
    lines.push('\nNeed from you (if missing)')
    lines.push(...opts.missingInfo.map((item) => `- ${item}`))
  }

  return lines.join('\n')
}

export function inferMarketType(message: string): MarketType {
  const msg = message.toLowerCase()
  if (/\b(live|in[- ]?play)\b/.test(msg)) return 'live'
  if (/\b(q1|q2|q3|q4|quarter|1st quarter|2nd quarter|3rd quarter|4th quarter)\b/.test(msg)) {
    return 'quarter'
  }
  const mentionsLineMove = /\b(line movement|line moved|line move|spread moved|total moved|moved\s+\d+(\.\d+)?\s*points?)\b/.test(msg)
  if (mentionsLineMove) {
    if (/\b(total|over\/under|o\/u|over|under)\b/.test(msg)) return 'total'
    if (/\b(moneyline|ml)\b/.test(msg)) return 'moneyline'
    return 'spread'
  }
  if (/\b(prop|points|rebounds|assists|threes|pra|yards|receptions|touchdowns)\b/.test(msg)) {
    return 'player_prop'
  }
  if (/\b(moneyline|ml)\b/.test(msg)) return 'moneyline'
  if (/\b(total|over\/under|o\/u|over|under)\b/.test(msg)) return 'total'
  if (/\bspread\b/.test(msg)) return 'spread'
  return 'unknown'
}

export function inferQuarter(message: string): number | undefined {
  const msg = message.toLowerCase()
  if (/\b(q1|1st quarter|first quarter)\b/.test(msg)) return 1
  if (/\b(q2|2nd quarter|second quarter)\b/.test(msg)) return 2
  if (/\b(q3|3rd quarter|third quarter)\b/.test(msg)) return 3
  if (/\b(q4|4th quarter|fourth quarter)\b/.test(msg)) return 4
  return undefined
}
