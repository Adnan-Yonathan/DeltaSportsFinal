/**
 * Shared types for the StatMuse-like unified query system
 */

export type Sport = 'nba' | 'nfl' | 'nhl' | 'mlb' | 'soccer' | 'tennis'

export type IntentCategory =
  | 'direct_stat' // "What's Curry's PPG?"
  | 'opponent_split' // "How do opponents shoot vs Thunder?"
  | 'player_vs_team' // "How does Giannis do against Celtics?"
  | 'situational' // "Thunder ATS as favorites"
  | 'threshold_count' // "How many 40-point games?"
  | 'leaderboard' // "Who leads the league in steals?"
  | 'trend_analysis' // "Are Lakers playing better recently?"
  | 'contextual' // "How will road trip affect them?"
  | 'betting_value' // "Is there value on Celtics spread?"
  | 'comparison' // "Who's better, Jokic or Embiid?"
  | 'schedule_impact' // "Back-to-back analysis"
  | 'injury_impact' // "How will X's injury affect Y?"
  | 'live_score' // "What's the score of the Lakers game?"
  | 'general' // General conversation

export interface ExtractedEntities {
  players: string[]
  teams: string[]
  stats: string[]
  opponents: string[]
  timeframe: 'season' | 'last_n_games' | 'career' | 'date_range' | null
  lastNGames?: number
  situation: 'home' | 'away' | 'favorite' | 'underdog' | 'b2b' | null
  threshold?: { stat: string; operator: '>=' | '>' | '<' | '='; value: number }
  sport: Sport | null
}

export interface ClassifiedIntent {
  category: IntentCategory
  entities: ExtractedEntities
  dataStrategy: DataStrategy[]
  confidence: number
}

export type DataStrategy =
  | { source: 'static_team'; teamId: string; stats: string[] }
  | { source: 'static_player'; playerName: string }
  | { source: 'espn_team_stats'; teamId: string; sport: Sport }
  | { source: 'espn_player_stats'; playerId: string; sport: Sport }
  | { source: 'espn_player_logs'; playerId: string; sport: Sport }
  | { source: 'espn_schedule'; teamId: string; sport: Sport }
  | { source: 'aggregation'; function: string; params: Record<string, any> }
  | { source: 'web_search'; query: string }

// Tool call types for function calling
export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface ToolResult {
  id: string
  result: any
  error?: string
}

// Response types
export interface UnifiedQueryResponse {
  reply: string
  data?: Record<string, any>
  toolsUsed?: string[]
  fallback?: boolean
}

// Static data result types
export interface TeamStatsResult {
  team: string
  stats: Record<string, number | string | null>
  record?: string
  error?: string
  formatted?: string // Formatted output with betting context
}

export interface PlayerStatsResult {
  player: string
  team?: string
  stats: Record<string, number | string | null>
  error?: string
  formatted?: string // Formatted output with prop implications
}

// Schedule analysis types
export interface ScheduleAnalysis {
  team: string
  currentRoadStreak: number
  upcomingBackToBacks: number
  avgRestDays: number
  travelFactor: 'low' | 'medium' | 'high'
  upcomingGames?: ScheduleGame[]
  insight: string
}

export interface ScheduleGame {
  date: string
  opponent: string
  isHome: boolean
  isBackToBack: boolean
}

// ATS/Betting analysis types
export interface AtsAnalysis {
  team: string
  overall: AtsRecord
  home?: AtsRecord
  away?: AtsRecord
  favorite?: AtsRecord
  underdog?: AtsRecord
}

export interface AtsRecord {
  wins: number
  losses: number
  pushes: number
  winPct: number
}

// Threshold query types
export interface ThresholdQueryResult {
  player: string
  stat: string
  threshold: number
  operator: string
  count: number
  games?: ThresholdGame[]
}

export interface ThresholdGame {
  date: string
  opponent: string
  value: number
}

// Player vs opponent types
export interface PlayerVsOpponentResult {
  player: string
  opponent: string
  gamesPlayed: number
  averages: Record<string, number>
}
