/**
 * Type definitions for research models
 * Research models scan for betting opportunities based on user-defined criteria
 */

// ============================================================================
// Core Types
// ============================================================================

export type ModelType = 'prediction' | 'research'

export type CompareOperator = 'gt' | 'gte' | 'lt' | 'lte' | 'eq'

export type CompareTarget = 'average' | 'pinnacle' | 'specific_book' | 'consensus' | 'opening'

export type FilterType =
  | 'odds_comparison'
  | 'line_comparison'
  | 'prop_value'
  | 'stat_threshold'
  | 'custom'

export type SortField = 'ev' | 'odds_diff' | 'line_diff' | 'clv_prob' | 'custom_score' | 'game_time'

export type SortDirection = 'asc' | 'desc'

export type PropSelection = 'over' | 'under'

// ============================================================================
// Search Scope Configuration
// ============================================================================

export interface ResearchSearchScope {
  sports: string[] // e.g., ['basketball_nba', 'basketball_ncaab']
  markets: string[] // e.g., ['spreads', 'totals', 'h2h']
  propTypes?: string[] // e.g., ['player_points', 'player_rebounds']
  books?: string[] // Filter specific books, or empty for all
}

// ============================================================================
// Filter Definitions
// ============================================================================

export interface BaseFilter {
  type: FilterType
  enabled?: boolean // Allow disabling filters without deleting
  label?: string // Human-readable name for the filter
}

/**
 * Odds Comparison Filter
 * Example: "Find spreads with odds at least +110 better than Pinnacle"
 */
export interface OddsComparisonFilter extends BaseFilter {
  type: 'odds_comparison'
  condition: {
    compareAgainst: CompareTarget
    book?: string // Required if compareAgainst is 'specific_book'
    operator: CompareOperator
    threshold: number // Difference in american odds (e.g., 100 means +100 better)
    metric?: 'american' | 'decimal' | 'ev_percent' // Default: 'american'
  }
}

/**
 * Line Comparison Filter
 * Example: "Find spreads 1.0 points better than average"
 */
export interface LineComparisonFilter extends BaseFilter {
  type: 'line_comparison'
  condition: {
    compareAgainst: CompareTarget
    book?: string // Required if compareAgainst is 'specific_book'
    operator: CompareOperator
    threshold: number // Difference in points (e.g., 1.0 means 1 point better)
    marketType: 'spread' | 'total'
  }
}

/**
 * Prop Value Filter
 * Example: "Find player points props over 25.5 with odds better than -110"
 */
export interface PropValueFilter extends BaseFilter {
  type: 'prop_value'
  condition: {
    propType: string // e.g., 'player_points'
    player?: string // Filter for specific player
    team?: string // Filter for players on specific team
    lineOperator: CompareOperator
    lineValue: number // e.g., 25.5
    oddsOperator?: CompareOperator
    oddsValue?: number // e.g., -110
    selection?: PropSelection // 'over' or 'under'
  }
}

/**
 * Stat Threshold Filter
 * Example: "Team pace must be >= 100"
 */
export interface StatThresholdFilter extends BaseFilter {
  type: 'stat_threshold'
  condition: {
    statKey: string // Key to lookup in stats
    scope: 'team' | 'player' | 'matchup_diff'
    operator: CompareOperator
    value: number
    normalization?: 'zscore' | 'percentile' | 'raw'
    team?: string // Required if scope is 'team'
    player?: string // Required if scope is 'player'
  }
}

/**
 * Custom GPT Filter
 * Example: "Only show games where home team is on back-to-back"
 */
export interface CustomFilter extends BaseFilter {
  type: 'custom'
  condition: {
    description: string // Natural language description of the filter
    aiEvaluate: boolean // Use GPT to evaluate each opportunity
  }
}

export type ResearchFilter =
  | OddsComparisonFilter
  | LineComparisonFilter
  | PropValueFilter
  | StatThresholdFilter
  | CustomFilter

// ============================================================================
// Research Model Configuration
// ============================================================================

export interface ResearchSortConfig {
  field: SortField
  direction: SortDirection
}

export interface ResearchAutoRunConfig {
  enabled: boolean
  frequency: 'hourly' | 'daily' | '15min' | '30min'
  notifyOnMatch: boolean
}

export interface ResearchModelConfig {
  // What to search
  searchScope: ResearchSearchScope

  // Filtering criteria
  filters: ResearchFilter[]

  // How to rank/sort results
  sortBy?: ResearchSortConfig

  // Limits
  maxResults?: number // Default 20
  minConfidence?: number // 0-1, only return if confidence >= this

  // Scheduling (future feature)
  autoRun?: ResearchAutoRunConfig
}

// ============================================================================
// Research Opportunity Results
// ============================================================================

export interface OpportunityComparison {
  avgOdds?: number // Average odds across all books
  avgLine?: number // Average line across all books
  pinnacleOdds?: number // Pinnacle odds (closing line proxy)
  pinnacleLine?: number // Pinnacle line
  openingOdds?: number // Opening odds
  openingLine?: number // Opening line
  oddsAdvantage?: number // How much better (in american odds)
  lineAdvantage?: number // How much better (in points)
  evEstimate?: number // Expected value estimate (%)
  sampleSize?: number // Number of books in comparison
}

export interface ResearchOpportunity {
  id: string // Unique identifier
  sport: string // Sport key
  event: string // Game description (e.g., "Lakers @ Celtics")
  eventId: string // SBD event ID
  market: string // 'spreads', 'totals', 'h2h', etc.
  book: string // Sportsbook name

  // For spreads/totals/moneyline
  selection?: string // Team name or side
  line?: number // Spread/total line
  odds: number // American odds

  // For props
  propType?: string // e.g., 'player_points'
  player?: string // Player name
  propLine?: number // Prop line value
  propSelection?: PropSelection // 'over' or 'under'

  // Comparison data
  comparison: OpportunityComparison

  // Match details
  matchedFilters: string[] // Which filters matched
  confidence?: number // Statistical confidence if stat-based
  score?: number // Custom ranking score

  // Metadata
  gameTime: Date | string // When the game starts
  league: string // League/competition
  isLive?: boolean // Whether game is currently in progress

  // Additional context
  notes?: string // Any additional notes or warnings
}

export interface ResearchResult {
  opportunities: ResearchOpportunity[]
  scannedAt: Date | string
  totalMatches: number
  searchCriteria: ResearchModelConfig
  executionTimeMs?: number
  errors?: string[] // Any errors encountered during scan
  liveContext?: Record<string, string>
}

// ============================================================================
// Database Row Types
// ============================================================================

export interface ResearchResultRow {
  id: string
  model_id: string
  user_id: string
  results: ResearchResult // Stored as JSONB
  match_count: number
  scanned_at: string
  created_at: string
}

// ============================================================================
// API Input/Output Types
// ============================================================================

export interface RunResearchModelOptions {
  liveOnly?: boolean // Only scan in-play games
  upcomingOnly?: boolean // Only scan future games
  timeWindow?: number // Hours ahead to scan (default: 24)
  skipCache?: boolean // Force fresh scan, ignore cached results
}

export interface SaveResearchModelInput {
  modelName: string
  sports: string[]
  markets: string[]
  filters: ResearchFilter[]
  sortBy?: ResearchSortConfig
  maxResults?: number
  notes?: string
}

// ============================================================================
// Odds Data Types (for internal use)
// ============================================================================

export interface OddsDataPoint {
  book: string
  odds: number
  line?: number
  timestamp?: string
}

export interface OddsData {
  eventId: string
  sport: string
  event: string
  gameTime: string | Date
  market: string
  team?: string
  selection?: string
  odds: number
  line?: number
  book: string
  isLive?: boolean

  // All odds for this market (for comparison)
  allOdds?: OddsDataPoint[]
}

export interface PropOddsData extends OddsData {
  propType: string
  player: string
  propLine: number
  propSelection: PropSelection
}

// ============================================================================
// Filter Execution Context
// ============================================================================

export interface FilterExecutionContext {
  allOddsForEvent?: OddsDataPoint[] // All odds for comparison
  statsCache?: Map<string, any> // Cached stats data
  gameContext?: any // Additional game context (injuries, etc.)
}

// ============================================================================
// Utility Types
// ============================================================================

export type ResearchFilterMap = {
  [K in FilterType]: Extract<ResearchFilter, { type: K }>
}

// Type guard functions
export function isOddsComparisonFilter(filter: ResearchFilter): filter is OddsComparisonFilter {
  return filter.type === 'odds_comparison'
}

export function isLineComparisonFilter(filter: ResearchFilter): filter is LineComparisonFilter {
  return filter.type === 'line_comparison'
}

export function isPropValueFilter(filter: ResearchFilter): filter is PropValueFilter {
  return filter.type === 'prop_value'
}

export function isStatThresholdFilter(filter: ResearchFilter): filter is StatThresholdFilter {
  return filter.type === 'stat_threshold'
}

export function isCustomFilter(filter: ResearchFilter): filter is CustomFilter {
  return filter.type === 'custom'
}
