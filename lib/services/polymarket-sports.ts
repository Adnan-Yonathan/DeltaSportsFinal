export const ALLOWED_POLYMARKET_SPORT_LABELS = [
  'NBA',
  'WNBA',
  'NFL',
  'NCAAF',
  'NCAAB',
  'NHL',
  'MLB',
  'SOCCER',
  'UFC',
  'MMA',
  'BOXING',
  'TENNIS',
  'GOLF',
  'MLS',
  'CRICKET',
  'RACING',
  'OLYMPICS',
  'ESPORTS',
] as const

export type AllowedPolymarketSportLabel =
  (typeof ALLOWED_POLYMARKET_SPORT_LABELS)[number]

export const ALL_SPORTS_FILTER = 'ALL'

export const isAllowedPolymarketSportLabel = (
  value?: string | null
): value is AllowedPolymarketSportLabel => {
  if (!value) return false
  return (ALLOWED_POLYMARKET_SPORT_LABELS as readonly string[]).includes(
    value.toUpperCase()
  )
}

export const normalizePolymarketSportFilter = (
  sport?: string | null
): AllowedPolymarketSportLabel | typeof ALL_SPORTS_FILTER => {
  if (!sport) return ALL_SPORTS_FILTER
  const normalized = sport.trim().toUpperCase()
  if (!normalized || normalized === ALL_SPORTS_FILTER) return ALL_SPORTS_FILTER
  if (!isAllowedPolymarketSportLabel(normalized)) {
    throw new Error(`INVALID_SPORT_FILTER:${normalized}`)
  }
  return normalized
}
