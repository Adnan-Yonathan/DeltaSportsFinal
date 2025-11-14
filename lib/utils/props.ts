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
