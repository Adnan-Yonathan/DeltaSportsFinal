export const ALLOWED_POLYMARKET_SPORT_LABELS = [
  // North American
  'NBA', 'WNBA', 'NFL', 'NCAAF', 'NCAAB', 'NHL', 'MLB', 'MLS',
  // Soccer — league-specific
  'UCL', 'UEL', 'UECL', 'EPL', 'LA LIGA', 'BUNDESLIGA', 'SERIE A',
  'LIGUE 1', 'SOCCER', 'FIFA', 'COPPA', 'FA CUP',
  // Tennis
  'ATP', 'WTA', 'TENNIS',
  // Esports
  'CS2', 'LOL', 'DOTA 2', 'VALORANT', 'ROCKET LEAGUE', 'COD', 'ESPORTS',
  // Hockey (international)
  'SHL', 'KHL', 'LIIGA',
  // Basketball (international)
  'EUROLEAGUE', 'EUROCUP', 'BKCL',
  // Combat sports
  'UFC', 'MMA', 'BOXING', 'PFL', 'BELLATOR',
  // Other
  'GOLF', 'PGA', 'CRICKET', 'IPL', 'F1', 'NASCAR', 'RACING',
  'RUGBY', 'AFL', 'OLYMPICS',
  // Additional active prefixes
  'CWBB', 'LIGA MX', 'PERU PRIMERA',
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
