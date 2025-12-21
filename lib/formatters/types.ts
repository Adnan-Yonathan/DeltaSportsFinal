/**
 * Type definitions for response formatting system
 *
 * This module defines standardized interfaces for consistent response formatting
 * across all NBA/basketball query types, ensuring betting context is always included.
 */

/**
 * Confidence level for recommendations and analysis
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low'

/**
 * Betting recommendation types
 */
export type BettingRecommendation = 'over' | 'under' | 'avoid' | 'spread' | 'moneyline'

/**
 * Base betting context that all responses should include
 */
export interface BettingContext {
  /** The stat being analyzed */
  stat: string
  /** The stat value */
  value: number | string
  /** League average for this stat (if available) */
  leagueAverage?: number
  /** League rank for this entity/stat (if available) */
  leagueRank?: number
  /** Betting implications (e.g., ["Favor overs", "Strong prop bet candidate"]) */
  bettingImplications: string[]
  /** Confidence level for the betting implication */
  confidence?: ConfidenceLevel
}

/**
 * Enhanced stat response with betting context
 */
export interface FormattedStatResponse {
  /** Raw stats object */
  rawStats: Record<string, any>
  /** Contextual information */
  context: {
    /** League comparison string (e.g., "3.5 above league avg") */
    leagueComparison?: string
    /** Trend analysis (e.g., "improving over last 10 games") */
    trend?: string
    /** Situational context (e.g., "on back-to-backs", "vs top 10 defenses") */
    situationalContext?: string
  }
  /** Betting angles broken down by bet type */
  bettingAngles: {
    /** Spread-related implications */
    spreads?: string[]
    /** Total-related implications */
    totals?: string[]
    /** Prop-related implications */
    props?: string[]
    /** ATS-related implications */
    ats?: string[]
  }
  /** Final formatted markdown output ready for display */
  formatted: string
}

/**
 * Prop suggestion for player stats
 */
export interface PropSuggestion {
  /** Stat type (e.g., "points", "rebounds", "assists") */
  stat: string
  /** Current average for this stat */
  currentAverage: number
  /** Typical prop line for this player/stat */
  typicalLine: number
  /** Recommended bet direction */
  recommendation: BettingRecommendation
  /** Confidence level */
  confidence: ConfidenceLevel
  /** Supporting factors for this recommendation */
  factors?: string[]
}

/**
 * Player stat response with prop implications
 */
export interface PlayerStatResponse extends FormattedStatResponse {
  /** Player name */
  player: string
  /** Team abbreviation */
  team: string
  /** Prop suggestions based on stats */
  propSuggestions?: PropSuggestion[]
}

/**
 * Game context for team stats
 */
export interface GameContext {
  /** Upcoming opponent (if applicable) */
  upcomingOpponent?: string
  /** Rest days before next game */
  restDays?: number
  /** Home or away */
  homeAway?: 'home' | 'away'
  /** Is this a back-to-back game */
  backToBack?: boolean
  /** Travel distance (miles) */
  travelDistance?: number
}

/**
 * Team stat response with game betting implications
 */
export interface TeamStatResponse extends FormattedStatResponse {
  /** Team name or abbreviation */
  team: string
  /** Game context (if applicable) */
  gameContext?: GameContext
}

/**
 * Split comparison data (home/away, B2B, etc.)
 */
export interface SplitData {
  /** Split label (e.g., "home", "away", "back-to-back", "rested") */
  label: string
  /** Number of games in this split */
  games: number
  /** Record in this split (W-L) */
  record?: string
  /** Win percentage */
  winPct?: number
  /** Average points scored */
  ptsScored?: number
  /** Average points allowed */
  ptsAllowed?: number
  /** Point differential */
  pointDiff?: number
  /** ATS record (W-L-P) */
  atsRecord?: string
  /** Additional stats specific to this split */
  stats?: Record<string, number>
}

/**
 * Options for formatting functions
 */
export interface FormatOptions {
  /** Include league context (averages, ranks) */
  includeLeagueContext?: boolean
  /** Include betting angles */
  includeBettingAngles?: boolean
  /** Include emoji and visual formatting */
  includeEmoji?: boolean
  /** Confidence level to display */
  confidence?: ConfidenceLevel
  /** Sport context (defaults to 'nba') */
  sport?: string
  /** Season year */
  season?: number
  /** Season label (e.g., "Regular 2025", "Playoffs 2024") */
  seasonLabel?: string
  /** Additional custom context */
  customContext?: string
}

/**
 * Team split formatting options
 */
export interface TeamSplitOptions extends FormatOptions {
  /** Team name or abbreviation */
  team?: string
  /** Type of split (after_loss, home_away, back_to_back, etc.) */
  splitType: 'after_loss' | 'home_away' | 'back_to_back' | 'vs_opponent' | 'custom'
  /** Split data to format */
  splits: SplitData[]
  /** Season type label (e.g., "Regular 2025", "Playoffs 2024") */
  seasonLabel?: string
}

/**
 * Player split formatting options
 */
export interface PlayerSplitOptions extends FormatOptions {
  /** Type of split */
  splitType: 'vs_opponent' | 'rest' | 'home_away' | 'last_n_games' | 'custom'
  /** Player name */
  player: string
  /** Team */
  team: string
  /** Split data */
  splits: SplitData[]
  /** Season label */
  seasonLabel?: string
}

/**
 * League average data
 */
export interface LeagueAverage {
  /** Sport */
  sport: string
  /** Stat name */
  stat: string
  /** Season */
  season: number
  /** Average value */
  average: number
  /** Standard deviation (if available) */
  stdDev?: number
  /** Sample size (number of teams/players) */
  sampleSize?: number
}

/**
 * League rank data
 */
export interface LeagueRank {
  /** Entity (team or player) */
  entity: string
  /** Stat name */
  stat: string
  /** Rank (1 = best) */
  rank: number
  /** Total entities ranked */
  totalEntities: number
  /** Percentile (0-100) */
  percentile: number
}
