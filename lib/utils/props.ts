const MARKET_PREFIX = 'player_'

const sanitize = (value?: string | null): string => {
  if (!value) return ''
  return value.trim().toLowerCase()
}

export function normalizePropMarketKey(input?: string | null): string | null {
  const raw = sanitize(input)
  if (!raw) return null
  const normalized = raw
    .replace(/^player_/, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  if (!normalized) return null
  return `${MARKET_PREFIX}${normalized}`
}

export function normalizePropSelection(input?: string | null): 'over' | 'under' | null {
  const raw = sanitize(input)
  if (!raw) return null
  if (raw.includes('under') || raw.includes('less')) return 'under'
  if (raw.includes('over') || raw.includes('more')) return 'over'
  return null
}

export function extractPropLine(value?: string | number | null): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value)
  const match = raw.match(/-?\d+(\.\d+)?/)
  if (!match) return null
  const parsed = parseFloat(match[0])
  return Number.isFinite(parsed) ? parsed : null
}

export type OverUnderSide = 'Over' | 'Under'

const wrap = (value: string) => ` ${value} `

export function resolveOverUnderSide(
  normalizedText: string,
  rawText?: string | null,
  tradeSide?: string | null
): OverUnderSide | null {
  const text = wrap(normalizedText)
  const raw = rawText ?? ''

  const explicitOver = text.includes(' over ') || text.endsWith(' over ')
  const explicitUnder = text.includes(' under ') || text.endsWith(' under ')

  const ouStyle =
    text.includes(' o u ') ||
    text.includes(' o/u ') ||
    text.includes(' ou ') ||
    raw.toLowerCase().includes('o/u')

  const hasOver =
    text.includes(' over ') ||
    text.endsWith(' over ') ||
    text.includes(' more than ') ||
    text.includes(' or more ') ||
    text.includes(' at least ') ||
    /\d+\s*\+/.test(raw)

  const hasUnder =
    text.includes(' under ') ||
    text.endsWith(' under ') ||
    text.includes(' fewer than ') ||
    text.includes(' less than ') ||
    text.includes(' or fewer ') ||
    text.includes(' at most ') ||
    text.includes(' no more than ') ||
    text.includes(' below ')

  const side = tradeSide?.toLowerCase() ?? null

  // "O/U" markets (Polymarket-style) typically resolve "Yes" to over and "No" to under.
  if (ouStyle && (side === 'yes' || side === 'no')) {
    return side === 'yes' ? 'Over' : 'Under'
  }

  // If the prompt explicitly says over/under AND we know whether this outcome is "Yes" or "No",
  // map "No" to the opposite side.
  if ((explicitOver || explicitUnder) && (side === 'yes' || side === 'no')) {
    if (explicitOver && !explicitUnder) return side === 'yes' ? 'Over' : 'Under'
    if (explicitUnder && !explicitOver) return side === 'yes' ? 'Under' : 'Over'
  }

  // If the prompt explicitly says over/under, trust it.
  if (explicitOver && !explicitUnder) return 'Over'
  if (explicitUnder && !explicitOver) return 'Under'

  if (!side) {
    if (hasOver && !hasUnder) return 'Over'
    if (hasUnder && !hasOver) return 'Under'
    return null
  }

  if (side === 'yes') {
    if (hasUnder && !hasOver) return 'Under'
    if (hasOver && !hasUnder) return 'Over'
    return null
  }

  if (side === 'no') {
    if (hasUnder && !hasOver) return 'Over'
    if (hasOver && !hasUnder) return 'Under'
    return null
  }

  return null
}
