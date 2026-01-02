/**
 * Query Suggestion Patterns
 *
 * Defines all suggestion categories, trigger patterns, and phrase mappings
 * that guide users toward tool-triggering queries.
 */

// ============================================================
// TYPES
// ============================================================

export type SuggestionCategory =
  | 'edge'
  | 'betting'
  | 'props'
  | 'stats'
  | 'live'
  | 'schedule'
  | 'education'

export interface QuerySuggestion {
  phrase: string // Human-readable completion
  fullQuery?: string // Optional: override the final query
  toolId?: string // Tool this triggers (for reference)
  category: SuggestionCategory
  priority: number // Higher = shown first (1-100)
}

export interface SuggestionContext {
  hasMatchup: boolean // "vs", "against", "@" detected
  teams: string[] // Detected team names
  players: string[] // Detected player names
  triggerWord: string // Last word typed
  fullText: string // Full input text
  starterPhrase?: string // Detected query starter ("what is", "show me", etc.)
}

// ============================================================
// CATEGORY DISPLAY CONFIG
// ============================================================

export const CATEGORY_CONFIG: Record<
  SuggestionCategory,
  { label: string; icon: string; color: string }
> = {
  edge: { label: 'Edge', icon: 'target', color: 'amber' },
  betting: { label: 'Betting', icon: 'trending-up', color: 'blue' },
  props: { label: 'Props', icon: 'user', color: 'orange' },
  stats: { label: 'Stats', icon: 'bar-chart-2', color: 'green' },
  live: { label: 'Live', icon: 'activity', color: 'red' },
  schedule: { label: 'Schedule', icon: 'calendar', color: 'purple' },
  education: { label: 'Learn', icon: 'book-open', color: 'slate' },
}

// ============================================================
// MATCHUP SUGGESTIONS (when "vs", "against", "@" detected)
// ============================================================

export const MATCHUP_SUGGESTIONS: QuerySuggestion[] = [
  {
    phrase: 'best bet for this game',
    toolId: 'get_game_recommendations',
    category: 'edge',
    priority: 100,
  },
  {
    phrase: 'spread and total analysis',
    toolId: 'get_game_recommendations',
    category: 'betting',
    priority: 95,
  },
  {
    phrase: 'injury report for both teams',
    toolId: 'getInjuries',
    category: 'live',
    priority: 90,
  },
  {
    phrase: 'public betting splits',
    toolId: 'get_betting_splits',
    category: 'betting',
    priority: 85,
  },
  {
    phrase: 'sharp money indicators',
    toolId: 'analyze_game_splits',
    category: 'betting',
    priority: 80,
  },
  {
    phrase: 'head-to-head comparison',
    toolId: 'getStaticTeamStats',
    category: 'stats',
    priority: 75,
  },
  {
    phrase: 'live line projection',
    toolId: 'get_live_betting_projection',
    category: 'live',
    priority: 70,
  },
  {
    phrase: 'best player props',
    toolId: 'get_prop_recommendations',
    category: 'props',
    priority: 65,
  },
]

// ============================================================
// TEAM SUGGESTIONS (when team name detected)
// ============================================================

export const TEAM_SUGGESTIONS: QuerySuggestion[] = [
  {
    phrase: 'ATS record this season',
    toolId: 'getTeamAtsAnalysis',
    category: 'betting',
    priority: 95,
  },
  {
    phrase: 'injury report',
    toolId: 'getInjuries',
    category: 'live',
    priority: 90,
  },
  {
    phrase: 'best player props tonight',
    toolId: 'get_prop_recommendations',
    category: 'props',
    priority: 85,
  },
  {
    phrase: 'schedule and rest analysis',
    toolId: 'getTeamScheduleContext',
    category: 'schedule',
    priority: 80,
  },
  {
    phrase: 'defensive rating and stats',
    toolId: 'getStaticTeamStats',
    category: 'stats',
    priority: 75,
  },
  {
    phrase: 'back-to-back performance',
    toolId: 'getTeamBackToBackSplit',
    category: 'stats',
    priority: 70,
  },
  {
    phrase: 'quarter-by-quarter scoring',
    toolId: 'getTeamQuarterAverages',
    category: 'stats',
    priority: 65,
  },
  {
    phrase: 'bounce-back after losses',
    toolId: 'getTeamAfterLoss',
    category: 'stats',
    priority: 60,
  },
  {
    phrase: 'home vs away splits',
    toolId: 'getTeamAtsAnalysis',
    category: 'betting',
    priority: 55,
  },
]

// ============================================================
// PLAYER SUGGESTIONS (when player name detected)
// ============================================================

export const PLAYER_SUGGESTIONS: QuerySuggestion[] = [
  {
    phrase: 'prop line analysis',
    toolId: 'get_prop_recommendations',
    category: 'props',
    priority: 95,
  },
  {
    phrase: 'season stats and averages',
    toolId: 'getStaticPlayerStats',
    category: 'stats',
    priority: 90,
  },
  {
    phrase: 'last 10 games performance',
    toolId: 'getEspnPlayerGameLogs',
    category: 'stats',
    priority: 85,
  },
  {
    phrase: 'rest day splits',
    toolId: 'getPlayerRestSplit',
    category: 'stats',
    priority: 80,
  },
  {
    phrase: 'games over 25 points',
    toolId: 'getPlayerThresholdGames',
    category: 'stats',
    priority: 75,
  },
  {
    phrase: 'games over 10 rebounds',
    toolId: 'getPlayerThresholdGames',
    category: 'stats',
    priority: 70,
  },
  {
    phrase: 'games over 8 assists',
    toolId: 'getPlayerThresholdGames',
    category: 'stats',
    priority: 65,
  },
  {
    phrase: 'matchup history',
    toolId: 'getPlayerVsOpponent',
    category: 'stats',
    priority: 60,
  },
]

// ============================================================
// QUERY STARTER SUGGESTIONS
// ============================================================

export const STARTER_SUGGESTIONS: Record<string, QuerySuggestion[]> = {
  'what is': [
    {
      phrase: 'the best bet today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'the sharpest play on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 95,
    },
    {
      phrase: 'the highest-value prop',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 90,
    },
    {
      phrase: 'expected value betting',
      category: 'education',
      priority: 85,
    },
    {
      phrase: 'closing line value',
      category: 'education',
      priority: 80,
    },
    {
      phrase: 'the public betting on',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 75,
    },
  ],
  'what are': [
    {
      phrase: 'the best props tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 100,
    },
    {
      phrase: "today's biggest edges",
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 95,
    },
    {
      phrase: 'the sharpest plays today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
    {
      phrase: "today's injury concerns",
      toolId: 'getInjuries',
      category: 'live',
      priority: 85,
    },
    {
      phrase: 'the best ATS teams',
      toolId: 'getAtsLeaderboard',
      category: 'betting',
      priority: 80,
    },
    {
      phrase: 'the live scores right now',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 75,
    },
  ],
  'show me': [
    {
      phrase: 'edges on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'the best props tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'the best ATS teams',
      toolId: 'getAtsLeaderboard',
      category: 'betting',
      priority: 90,
    },
    {
      phrase: 'sharp money plays',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 85,
    },
    {
      phrase: 'injury reports',
      toolId: 'getInjuries',
      category: 'live',
      priority: 80,
    },
    {
      phrase: 'league leaders in scoring',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 75,
    },
  ],
  find: [
    {
      phrase: 'value bets today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'player props with edge',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'sharp money indicators',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 90,
    },
    {
      phrase: 'the best spread bet',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 85,
    },
  ],
  'give me': [
    {
      phrase: 'the best bet today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'prop recommendations',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'edge analysis for the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
    {
      phrase: 'injury updates',
      toolId: 'getInjuries',
      category: 'live',
      priority: 85,
    },
  ],
  'who is': [
    {
      phrase: 'most likely to hit 25+ points',
      toolId: 'get_ranked_players_by_prop_threshold',
      category: 'props',
      priority: 100,
    },
    {
      phrase: 'most likely to hit 10+ rebounds',
      toolId: 'get_ranked_players_by_prop_threshold',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'most likely to hit 3+ threes',
      toolId: 'get_ranked_players_by_prop_threshold',
      category: 'props',
      priority: 90,
    },
    {
      phrase: 'leading the league in scoring',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 85,
    },
    {
      phrase: 'injured on the Lakers',
      toolId: 'getInjuries',
      category: 'live',
      priority: 80,
    },
  ],
  'who has': [
    {
      phrase: 'the best chance to hit 25+ points',
      toolId: 'get_ranked_players_by_prop_threshold',
      category: 'props',
      priority: 100,
    },
    {
      phrase: 'the most 30-point games',
      toolId: 'getPlayerThresholdGames',
      category: 'stats',
      priority: 95,
    },
    {
      phrase: 'the best ATS record',
      toolId: 'getAtsLeaderboard',
      category: 'betting',
      priority: 90,
    },
  ],
  'how many': [
    {
      phrase: '30-point games has Luka had',
      toolId: 'getPlayerThresholdGames',
      category: 'stats',
      priority: 100,
    },
    {
      phrase: 'times has the Lakers covered',
      toolId: 'getTeamAtsAnalysis',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'games over the total today',
      toolId: 'get_slate_edge_detection',
      category: 'betting',
      priority: 90,
    },
  ],
}

// ============================================================
// ACTION WORD SUGGESTIONS
// ============================================================

export const ACTION_SUGGESTIONS: Record<string, QuerySuggestion[]> = {
  edge: [
    {
      phrase: 'detection on today\'s slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'detection on player props',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'analysis for spreads',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
  ],
  edges: [
    {
      phrase: 'on today\'s NBA slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'on player props',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'on totals',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
  ],
  prop: [
    {
      phrase: 'edges tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 100,
    },
    {
      phrase: 'analysis for tonight\'s games',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'recommendations',
      toolId: 'get_prop_recommendations',
      category: 'props',
      priority: 90,
    },
  ],
  props: [
    {
      phrase: 'with the best edge tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 100,
    },
    {
      phrase: 'for points tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'most likely to hit',
      toolId: 'get_ranked_players_by_prop_threshold',
      category: 'props',
      priority: 90,
    },
  ],
  ats: [
    {
      phrase: 'record for the Lakers',
      toolId: 'getTeamAtsAnalysis',
      category: 'betting',
      priority: 100,
    },
    {
      phrase: 'leaderboard',
      toolId: 'getAtsLeaderboard',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'record as favorites',
      toolId: 'getTeamAtsAnalysis',
      category: 'betting',
      priority: 90,
    },
    {
      phrase: 'record on the road',
      toolId: 'getTeamAtsAnalysis',
      category: 'betting',
      priority: 85,
    },
  ],
  spread: [
    {
      phrase: 'analysis for tonight',
      toolId: 'get_game_recommendations',
      category: 'betting',
      priority: 100,
    },
    {
      phrase: 'edges on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 95,
    },
    {
      phrase: 'betting recommendations',
      toolId: 'get_game_recommendations',
      category: 'betting',
      priority: 90,
    },
  ],
  parlay: [
    {
      phrase: 'probability calculator',
      toolId: 'combo_analysis',
      category: 'betting',
      priority: 100,
    },
    {
      phrase: 'analysis',
      toolId: 'combo_analysis',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'odds calculator',
      toolId: 'combo_analysis',
      category: 'betting',
      priority: 90,
    },
  ],
  live: [
    {
      phrase: 'scores right now',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 100,
    },
    {
      phrase: 'line projection',
      toolId: 'get_live_betting_projection',
      category: 'live',
      priority: 95,
    },
    {
      phrase: 'betting analysis',
      toolId: 'get_live_betting_projection',
      category: 'live',
      priority: 90,
    },
  ],
  sharp: [
    {
      phrase: 'money indicators',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 100,
    },
    {
      phrase: 'action today',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'plays on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
  ],
  public: [
    {
      phrase: 'betting percentages',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 100,
    },
    {
      phrase: 'money on tonight\'s games',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'vs sharp money',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 90,
    },
  ],
  injury: [
    {
      phrase: 'report for today',
      toolId: 'getInjuries',
      category: 'live',
      priority: 100,
    },
    {
      phrase: 'updates',
      toolId: 'getInjuries',
      category: 'live',
      priority: 95,
    },
    {
      phrase: 'news',
      toolId: 'getInjuries',
      category: 'live',
      priority: 90,
    },
  ],
  injuries: [
    {
      phrase: 'for NBA today',
      toolId: 'getInjuries',
      category: 'live',
      priority: 100,
    },
    {
      phrase: 'affecting tonight\'s games',
      toolId: 'getInjuries',
      category: 'live',
      priority: 95,
    },
  ],
  score: [
    {
      phrase: 'updates right now',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 100,
    },
    {
      phrase: 'of the Lakers game',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 95,
    },
  ],
  scores: [
    {
      phrase: 'for NBA games today',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 100,
    },
    {
      phrase: 'right now',
      toolId: 'getLiveScores',
      category: 'live',
      priority: 95,
    },
  ],
  best: [
    {
      phrase: 'bet today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'props tonight',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'value on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
    {
      phrase: 'ATS teams',
      toolId: 'getAtsLeaderboard',
      category: 'betting',
      priority: 85,
    },
  ],
  value: [
    {
      phrase: 'bets today',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'on player props',
      toolId: 'get_slate_prop_edge_detection',
      category: 'props',
      priority: 95,
    },
    {
      phrase: 'plays on the slate',
      toolId: 'get_slate_edge_detection',
      category: 'edge',
      priority: 90,
    },
  ],
  analyze: [
    {
      phrase: 'this matchup',
      toolId: 'get_game_recommendations',
      category: 'edge',
      priority: 100,
    },
    {
      phrase: 'the spread',
      toolId: 'get_game_recommendations',
      category: 'betting',
      priority: 95,
    },
    {
      phrase: 'betting splits',
      toolId: 'get_betting_splits',
      category: 'betting',
      priority: 90,
    },
  ],
  stats: [
    {
      phrase: 'comparison',
      toolId: 'getStaticTeamStats',
      category: 'stats',
      priority: 100,
    },
    {
      phrase: 'for the Lakers',
      toolId: 'getStaticTeamStats',
      category: 'stats',
      priority: 95,
    },
    {
      phrase: 'leaders',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 90,
    },
  ],
  leaders: [
    {
      phrase: 'in scoring',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 100,
    },
    {
      phrase: 'in rebounds',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 95,
    },
    {
      phrase: 'in assists',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 90,
    },
    {
      phrase: 'in threes',
      toolId: 'getLeaderboard',
      category: 'stats',
      priority: 85,
    },
  ],
}

// ============================================================
// EDUCATION SUGGESTIONS
// ============================================================

export const EDUCATION_SUGGESTIONS: Record<string, QuerySuggestion[]> = {
  'how to': [
    {
      phrase: 'bet on spreads',
      category: 'education',
      priority: 100,
    },
    {
      phrase: 'read betting odds',
      category: 'education',
      priority: 95,
    },
    {
      phrase: 'find value bets',
      toolId: 'get_slate_edge_detection',
      category: 'education',
      priority: 90,
    },
    {
      phrase: 'use closing line value',
      category: 'education',
      priority: 85,
    },
    {
      phrase: 'build a parlay',
      toolId: 'combo_analysis',
      category: 'education',
      priority: 80,
    },
  ],
  explain: [
    {
      phrase: 'expected value',
      category: 'education',
      priority: 100,
    },
    {
      phrase: 'closing line value',
      category: 'education',
      priority: 95,
    },
    {
      phrase: 'sharp vs public money',
      category: 'education',
      priority: 90,
    },
    {
      phrase: 'ATS betting',
      category: 'education',
      priority: 85,
    },
    {
      phrase: 'prop betting',
      category: 'education',
      priority: 80,
    },
  ],
  'what does': [
    {
      phrase: 'ATS mean',
      category: 'education',
      priority: 100,
    },
    {
      phrase: 'sharp money mean',
      category: 'education',
      priority: 95,
    },
    {
      phrase: 'the spread mean',
      category: 'education',
      priority: 90,
    },
    {
      phrase: 'plus/minus mean',
      category: 'education',
      priority: 85,
    },
    {
      phrase: 'over/under mean',
      category: 'education',
      priority: 80,
    },
  ],
}

// ============================================================
// QUERY STARTER PATTERNS
// ============================================================

export const QUERY_STARTERS = [
  'what is',
  'what are',
  'what\'s',
  'show me',
  'find',
  'give me',
  'who is',
  'who has',
  'how many',
  'how to',
  'explain',
  'what does',
] as const

// ============================================================
// TRIGGER WORD PATTERNS
// ============================================================

export const TRIGGER_WORDS = Object.keys(ACTION_SUGGESTIONS)

// ============================================================
// MATCHUP DETECTION PATTERN
// ============================================================

export const MATCHUP_PATTERN = /\b(vs\.?|versus|against|@)\b/i
