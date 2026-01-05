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
  probability?: number // Optional implied probability (0-1)
}

export interface Bookmaker {
  key: string
  title: string
  url?: string
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
  SPREADS_1H: 'spreads_1h',
  SPREADS_2H: 'spreads_2h',
  SPREADS_P1: 'spreads_p1',
  SPREADS_P2: 'spreads_p2',
  SPREADS_P3: 'spreads_p3',
  TOTALS: 'totals',
  TOTALS_1H: 'totals_1h',
  TOTALS_2H: 'totals_2h',
  TOTALS_Q1: 'totals_q1',
  TOTALS_Q2: 'totals_q2',
  TOTALS_Q3: 'totals_q3',
  TOTALS_Q4: 'totals_q4',
  TOTALS_P1: 'totals_p1',
  TOTALS_P2: 'totals_p2',
  TOTALS_P3: 'totals_p3',
  TEAM_TOTALS: 'team_totals',
  TEAM_TOTALS_1H: 'team_totals_1h',
  TEAM_TOTALS_2H: 'team_totals_2h',
  TEAM_TOTALS_P1: 'team_totals_p1',
  TEAM_TOTALS_P2: 'team_totals_p2',
  TEAM_TOTALS_P3: 'team_totals_p3',
} as const

export const BOOKMAKERS = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'bet365',
  'pinnacle',
] as const
