const normalizeBase = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed.length > 0 ? trimmed : null
}

export const KALSHI_BASE_CANDIDATES = Array.from(
  new Set(
    [
      normalizeBase(process.env.KALSHI_API_BASE),
      'https://api.elections.kalshi.com/trade-api/v2',
      'https://api.kalshi.com/trade-api/v2',
      'https://trading-api.kalshi.com/trade-api/v2',
    ].filter(Boolean) as string[]
  )
)

export const withKalshiBase = (base: string, pathOrUrl: string) => {
  const normalizedBase = normalizeBase(base) ?? base
  if (/^https?:\/\//i.test(pathOrUrl)) {
    const url = new URL(pathOrUrl)
    const knownPrefix = KALSHI_BASE_CANDIDATES.find((candidate) =>
      pathOrUrl.startsWith(candidate)
    )
    if (!knownPrefix) return pathOrUrl
    const suffix = pathOrUrl.slice(knownPrefix.length)
    return `${normalizedBase}${suffix}`
  }

  const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`
  return `${normalizedBase}${path}`
}

