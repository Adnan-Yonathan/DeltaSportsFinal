/**
 * SportsBettingDime Types (Covers replacement)
 */

// =============================================================================
// ATS Records
// =============================================================================

export interface CoversATSRecord {
  teamName: string
  teamSlug: string
  sportKey: string
  season: number
  
  // Overall ATS record
  atsWins: number
  atsLosses: number
  atsPushes: number
  atsRecord: string // "18-12-2"
  
  // Breakdown records
  homeAtsRecord?: string
  awayAtsRecord?: string
  favoriteAtsRecord?: string
  underdogAtsRecord?: string
  overUnderRecord?: string
  
  // Recent performance
  last10Ats?: string
  atsStreak?: string // "W3", "L2", "P1"

  // Extra situational splits (e.g., home favorite, away underdog)
  extraSplits?: Record<string, string>

  // Metadata
  capturedAt: Date
}

export interface CoversTeamMapping {
  teamName: string
  teamAbbr: string
  coversSlug: string
  sportKey: string
}

// =============================================================================
// Public Betting Splits
// =============================================================================

export interface CoversBettingSplits {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime?: Date
  sportKey: string
  
  // Spread splits
  spreadHomeBetsPct?: number
  spreadAwayBetsPct?: number
  spreadHomeMoneyPct?: number
  spreadAwayMoneyPct?: number
  
  // Moneyline splits
  mlHomeBetsPct?: number
  mlAwayBetsPct?: number
  mlHomeMoneyPct?: number
  mlAwayMoneyPct?: number
  
  // Total splits
  totalOverBetsPct?: number
  totalUnderBetsPct?: number
  totalOverMoneyPct?: number
  totalUnderMoneyPct?: number
  
  // Source
  coversGameId?: string
  capturedAt: Date
}

export interface CoversMatchup {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime?: string
  matchupUrl: string
}

// =============================================================================
// Sharp Detection
// =============================================================================

export type SharpIndicator = 
  | 'sharp_home' 
  | 'sharp_away' 
  | 'public_home' 
  | 'public_away' 
  | 'neutral'

export interface SharpAnalysis {
  indicator: SharpIndicator
  betsPct: number
  moneyPct: number
  delta: number
  confidence: 'high' | 'medium' | 'low'
}

// =============================================================================
// Scraper Responses
// =============================================================================

export interface CoversScraperResult<T> {
  success: boolean
  data?: T
  error?: string
  url: string
  scrapedAt: Date
}

export interface CoversATSScraperResult extends CoversScraperResult<CoversATSRecord> {}
export interface CoversSplitsScraperResult extends CoversScraperResult<CoversBettingSplits[]> {}

