/**
 * Covers.com Data Mappers
 * 
 * Maps scraped Covers data to internal database types.
 */

import type {
  CoversATSRecord,
  CoversBettingSplits,
  SharpIndicator,
  SharpAnalysis,
} from './types'

// =============================================================================
// Sharp Detection
// =============================================================================

const SHARP_THRESHOLD = 15 // 15% divergence between bets and money

/**
 * Detect sharp action based on divergence between bets% and money%
 * 
 * Sharp money = small number of bets with large amounts
 * If money% > bets% by threshold, sharps are on that side
 */
export function detectSharpAction(
  betsPct: number | undefined,
  moneyPct: number | undefined,
  side: 'home' | 'away'
): SharpAnalysis | null {
  if (betsPct === undefined || moneyPct === undefined) {
    return null
  }
  
  const delta = moneyPct - betsPct
  
  let indicator: SharpIndicator = 'neutral'
  let confidence: 'high' | 'medium' | 'low' = 'low'
  
  if (delta > SHARP_THRESHOLD) {
    indicator = side === 'home' ? 'sharp_home' : 'sharp_away'
    confidence = delta > 25 ? 'high' : delta > 20 ? 'medium' : 'low'
  } else if (delta < -SHARP_THRESHOLD) {
    indicator = side === 'home' ? 'public_home' : 'public_away'
    confidence = Math.abs(delta) > 25 ? 'high' : Math.abs(delta) > 20 ? 'medium' : 'low'
  }
  
  return {
    indicator,
    betsPct,
    moneyPct,
    delta,
    confidence,
  }
}

// =============================================================================
// ATS Record Mapping
// =============================================================================

export interface TeamATSRecordRow {
  team_provider_id: string
  sport_key: string
  season: number
  season_type: number
  record: Record<string, any>
  team_name: string
  covers_slug: string
  home_ats_record: string | null
  away_ats_record: string | null
  favorite_ats_record: string | null
  underdog_ats_record: string | null
  over_under_record: string | null
  last_10_ats: string | null
  ats_streak: string | null
  captured_at: Date
}

/**
 * Map CoversATSRecord to database row
 */
export function mapATSRecordToRow(
  record: CoversATSRecord,
  teamProviderId?: string
): TeamATSRecordRow {
  return {
    team_provider_id: teamProviderId || record.teamSlug,
    sport_key: record.sportKey,
    season: record.season,
    season_type: 2, // Regular season
    record: {
      wins: record.atsWins,
      losses: record.atsLosses,
      pushes: record.atsPushes,
      formatted: record.atsRecord,
    },
    team_name: record.teamName,
    covers_slug: record.teamSlug,
    home_ats_record: record.homeAtsRecord || null,
    away_ats_record: record.awayAtsRecord || null,
    favorite_ats_record: record.favoriteAtsRecord || null,
    underdog_ats_record: record.underdogAtsRecord || null,
    over_under_record: record.overUnderRecord || null,
    last_10_ats: record.last10Ats || null,
    ats_streak: record.atsStreak || null,
    captured_at: record.capturedAt,
  }
}

// =============================================================================
// Betting Splits Mapping
// =============================================================================

export type MarketType = 'spread' | 'moneyline' | 'total'

export interface PublicBettingSplitsRow {
  sport_key: string
  game_id: string
  home_team: string
  away_team: string
  game_time: Date | null
  market_type: MarketType
  home_bets_pct: number | null
  away_bets_pct: number | null
  home_money_pct: number | null
  away_money_pct: number | null
  sharp_indicator: SharpIndicator | null
  source: string
  covers_game_id: string | null
  captured_at: Date
}

/**
 * Map CoversBettingSplits to database rows (one per market type)
 */
export function mapSplitsToRows(
  splits: CoversBettingSplits,
  internalGameId?: string
): PublicBettingSplitsRow[] {
  const rows: PublicBettingSplitsRow[] = []
  const capturedAt = splits.capturedAt
  
  const baseRow = {
    sport_key: splits.sportKey,
    game_id: internalGameId || splits.gameId,
    home_team: splits.homeTeam,
    away_team: splits.awayTeam,
    game_time: splits.gameTime || null,
    source: 'covers',
    covers_game_id: splits.coversGameId || null,
    captured_at: capturedAt,
  }
  
  // Spread splits
  if (splits.spreadHomeBetsPct !== undefined || splits.spreadAwayBetsPct !== undefined) {
    const sharpAnalysis = detectSharpAction(
      splits.spreadHomeBetsPct,
      splits.spreadHomeMoneyPct,
      'home'
    )
    rows.push({
      ...baseRow,
      market_type: 'spread',
      home_bets_pct: splits.spreadHomeBetsPct ?? null,
      away_bets_pct: splits.spreadAwayBetsPct ?? null,
      home_money_pct: splits.spreadHomeMoneyPct ?? null,
      away_money_pct: splits.spreadAwayMoneyPct ?? null,
      sharp_indicator: sharpAnalysis?.indicator || null,
    })
  }
  
  // Moneyline splits
  if (splits.mlHomeBetsPct !== undefined || splits.mlAwayBetsPct !== undefined) {
    const sharpAnalysis = detectSharpAction(
      splits.mlHomeBetsPct,
      splits.mlHomeMoneyPct,
      'home'
    )
    rows.push({
      ...baseRow,
      market_type: 'moneyline',
      home_bets_pct: splits.mlHomeBetsPct ?? null,
      away_bets_pct: splits.mlAwayBetsPct ?? null,
      home_money_pct: splits.mlHomeMoneyPct ?? null,
      away_money_pct: splits.mlAwayMoneyPct ?? null,
      sharp_indicator: sharpAnalysis?.indicator || null,
    })
  }
  
  // Total splits
  if (splits.totalOverBetsPct !== undefined || splits.totalUnderBetsPct !== undefined) {
    const sharpAnalysis = detectSharpAction(
      splits.totalOverBetsPct,
      splits.totalOverMoneyPct,
      'home' // 'home' position represents 'over' for totals
    )
    rows.push({
      ...baseRow,
      market_type: 'total',
      home_bets_pct: splits.totalOverBetsPct ?? null,
      away_bets_pct: splits.totalUnderBetsPct ?? null,
      home_money_pct: splits.totalOverMoneyPct ?? null,
      away_money_pct: splits.totalUnderMoneyPct ?? null,
      sharp_indicator: sharpAnalysis?.indicator || null,
    })
  }
  
  return rows
}

// =============================================================================
// Parsing Helpers
// =============================================================================

/**
 * Parse ATS record string like "18-12-2" into components
 */
export function parseATSRecord(record: string): { wins: number; losses: number; pushes: number } | null {
  const match = record.match(/^(\d+)-(\d+)(?:-(\d+))?$/)
  if (!match) return null
  
  return {
    wins: parseInt(match[1], 10),
    losses: parseInt(match[2], 10),
    pushes: match[3] ? parseInt(match[3], 10) : 0,
  }
}

/**
 * Format wins/losses/pushes into ATS record string
 */
export function formatATSRecord(wins: number, losses: number, pushes: number = 0): string {
  if (pushes > 0) {
    return `${wins}-${losses}-${pushes}`
  }
  return `${wins}-${losses}`
}

/**
 * Parse percentage string like "65%" into number
 */
export function parsePercentage(pctStr: string): number | null {
  const match = pctStr.match(/(\d+(?:\.\d+)?)%?/)
  if (!match) return null
  return parseFloat(match[1])
}

/**
 * Get current NBA season year
 * NBA season spans two calendar years; season year is the ending year
 */
export function getCurrentNBASeason(): number {
  const now = new Date()
  const month = now.getMonth() // 0-11
  const year = now.getFullYear()
  
  // NBA season typically runs October to June
  // If we're in Oct-Dec, season ends next year
  // If we're in Jan-June, season ends this year
  // If we're in July-Sept, we're in offseason (use previous season or upcoming)
  if (month >= 9) {
    return year + 1
  }
  return year
}

