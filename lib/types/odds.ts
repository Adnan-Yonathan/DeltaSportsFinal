// Odds Types (provider-agnostic)

export interface OddsMarket {
  key: string
  outcomes: OddsOutcome[]
  last_update?: string
}

export interface OddsOutcome {
  name: string
  price: number // American odds
  point?: number // For spreads and totals
}

export interface Bookmaker {
  key: string
  title: string
  markets: OddsMarket[]
  last_update?: string
}

export interface OddsGame {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: Bookmaker[]
}

export interface OddsApiResponse {
  games: OddsGame[]
}

// Arbitrage Types
export interface ArbitrageOpportunity {
  game: string
  market: string
  profitPercent: number
  legs: ArbitrageLeg[]
  totalStake: number
  guaranteedProfit: number
}

export interface ArbitrageLeg {
  book: string
  selection: string
  odds: number
  stake: number
  americanOdds: number
}

// Sports and Markets
export const SPORTS = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
  NCAA_FB: 'americanfootball_ncaaf',
  NCAA_BB: 'basketball_ncaab',
} as const

export const MARKETS = {
  H2H: 'h2h', // Moneyline
  SPREADS: 'spreads',
  TOTALS: 'totals',
} as const

export const BOOKMAKERS = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'bet365',
  'pinnacle',
] as const
