/**
 * Shared types for betting splits aggregation across multiple sources
 */

export interface BettingSplit {
  // Source identification
  source: 'sportsbettingdime' | 'scoresandodds' | 'betql' | 'oddsshark' | 'custom'

  // Game identification
  gameId?: string
  awayTeam: string
  homeTeam: string
  awayTeamAbbr?: string
  homeTeamAbbr?: string
  gameTime?: Date | string
  sportKey?: string

  // Spread market betting percentages
  spreadAwayBetsPct?: number    // % of bets on away team
  spreadHomeBetsPct?: number    // % of bets on home team
  spreadAwayMoneyPct?: number   // % of money on away team
  spreadHomeMoneyPct?: number   // % of money on home team

  // Total market betting percentages
  totalOverBetsPct?: number     // % of bets on Over
  totalUnderBetsPct?: number    // % of bets on Under
  totalOverMoneyPct?: number    // % of money on Over
  totalUnderMoneyPct?: number   // % of money on Under

  // Moneyline market (if available)
  mlAwayBetsPct?: number
  mlHomeBetsPct?: number
  mlAwayMoneyPct?: number
  mlHomeMoneyPct?: number

  // Sharp detection (can be calculated or provided)
  sharpIndicator?: 'sharp_home' | 'sharp_away' | 'public_home' | 'public_away' | 'neutral'

  // Additional metadata
  coversGameId?: string
  detailsUrl?: string
  capturedAt: Date
}

export interface SourceResult {
  source: string
  games: number
  success: boolean
  error?: string
}

export interface AggregatedSplitsResult {
  totalSources: number
  sourceResults: SourceResult[]
  totalGames: number
  uniqueGames: number
  coverage: number  // Percentage if total schedule known
  splits: BettingSplit[]
  timestamp: Date
}

export interface ScrapeOptions {
  timeout?: number
  retries?: number
  userAgent?: string
}
