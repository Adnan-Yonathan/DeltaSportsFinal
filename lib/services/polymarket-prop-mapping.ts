const POLYMARKET_PROP_TYPE_MAP: Record<string, string> = {
  baseball_player_strikeouts: 'strikeouts',
  baseball_player_home_runs: 'home_runs',
  soccer_player_goals: 'goals',
  soccer_player_assists: 'assists',
  soccer_player_shots: 'shots',
  soccer_player_shots_on_target: 'shots_on_target',
  soccer_player_goals_plus_assists: 'goals_plus_assists',
  soccer_player_goalkeeper_saves: 'goalkeeper_saves',
}

export const POLYMARKET_PROP_MARKET_TYPES = [
  'baseball_player_strikeouts',
  'baseball_player_home_runs',
  'soccer_player_goals',
  'soccer_player_assists',
  'soccer_player_shots',
  'soccer_player_shots_on_target',
  'soccer_player_goals_plus_assists',
  'soccer_player_goalkeeper_saves',
] as const

const POLYMARKET_BASKETBALL_MARKET_TYPES = ['points', 'assists', 'rebounds'] as const

const POLYMARKET_MLB_MARKET_TYPES = [
  'baseball_player_strikeouts',
  'baseball_player_home_runs',
] as const

const POLYMARKET_FIFWC_MARKET_TYPES = [
  'soccer_player_goals',
  'soccer_player_assists',
  'soccer_player_shots',
  'soccer_player_shots_on_target',
  'soccer_player_goals_plus_assists',
  'soccer_player_goalkeeper_saves',
] as const

export const normalizePolymarketPropType = (marketType?: string | null) => {
  const key = String(marketType ?? '').trim()
  if (!key) return null
  return POLYMARKET_PROP_TYPE_MAP[key] ?? null
}

export const resolvePolymarketSportsMarketTypes = (sportKey: string | 'all') => {
  if (sportKey === 'all') {
    return [...POLYMARKET_BASKETBALL_MARKET_TYPES, ...POLYMARKET_PROP_MARKET_TYPES]
  }

  if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
    return [...POLYMARKET_BASKETBALL_MARKET_TYPES]
  }

  if (sportKey === 'baseball_mlb') {
    return [...POLYMARKET_MLB_MARKET_TYPES]
  }

  if (sportKey === 'soccer_fifwc') {
    return [...POLYMARKET_FIFWC_MARKET_TYPES]
  }

  return []
}

export type PolymarketMarketDateLike = {
  eventDate?: string | null
  gameStartTime?: string | null
  startTime?: string | null
  endDate?: string | null
  events?: Array<{
    eventDate?: string | null
    gameStartTime?: string | null
    startTime?: string | null
    endDate?: string | null
  }>
}

export const resolvePolymarketEventDate = (market: PolymarketMarketDateLike) => {
  const event = market.events?.[0]
  const raw =
    event?.eventDate ||
    event?.gameStartTime ||
    event?.startTime ||
    event?.endDate ||
    market.eventDate ||
    market.gameStartTime ||
    market.startTime ||
    market.endDate ||
    null
  if (!raw) return null
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}
