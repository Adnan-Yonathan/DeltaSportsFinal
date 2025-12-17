/**
 * NBA Stats API Type Definitions
 *
 * Types for stats.nba.com REST API responses
 * All endpoints return data in a standardized resultSets format:
 * { resultSets: [{ name, headers, rowSet }] }
 */

// =============================================================================
// NBA Stats API Response Structure
// =============================================================================

/**
 * Standard NBA Stats API response format
 * All endpoints return this structure with headers and parallel row arrays
 */
export interface NbaStatsResponse {
  resource?: string
  parameters?: Record<string, any>
  resultSets: NbaStatsResultSet[]
}

export interface NbaStatsResultSet {
  name: string
  headers: string[]
  rowSet: any[][]
}

// =============================================================================
// Team Dashboard Response
// =============================================================================

export interface NbaStatsTeamDashboard extends NbaStatsResponse {
  resultSets: [{
    name: 'OverallTeamDashboard'
    headers: string[]  // Dynamic headers like 'TEAM_ID', 'TEAM_NAME', 'GP', 'W', 'L', etc.
    rowSet: any[][]
  }]
}

// =============================================================================
// League Team Stats Response
// =============================================================================

export interface NbaStatsLeagueTeamStats extends NbaStatsResponse {
  resultSets: [{
    name: 'LeagueDashTeamStats'
    headers: string[]  // Contains stats like 'PTS_PAINT', 'PTS_FB', 'PTS_2ND_CHANCE', etc.
    rowSet: any[][]
  }]
}

// =============================================================================
// Opponent-Allowed Stats (Mapped from stats.nba.com)
// =============================================================================

export interface OpponentAllowedStats {
  teamName: string
  teamAbbr?: string
  teamId?: string
  season: string
  sportKey: string

  // Shooting allowed
  oppFgPct: number | null
  oppFg3Pct: number | null
  oppEfgPct: number | null
  oppTsPct: number | null

  // Points by play type
  oppPaintPtsPerGame: number | null
  oppFastbreakPtsPerGame: number | null
  oppSecondChancePtsPerGame: number | null
  oppPtsOffToPerGame: number | null

  // Pace/possessions
  oppPace: number | null
  oppPossessionsPerGame: number | null

  // Rebounding allowed
  oppOrbPct: number | null
  oppDrbPct: number | null

  // Per-game defensive metrics
  oppPtsPerGame: number | null
  oppAstPerGame: number | null
  oppRebPerGame: number | null
  oppTovPerGame: number | null

  // Defensive rating
  defensiveRating: number | null

  // League ranking
  defensiveRank: number | null

  capturedAt: Date
}

// =============================================================================
// Parsed Team Stats (from rowSet arrays)
// =============================================================================

export interface NbaStatsTeam {
  teamId: string
  teamName: string
  teamAbbr?: string

  // Offensive stats
  paintPts: number | null
  fastbreakPts: number | null
  secondChancePts: number | null
  ptsOffTurnovers: number | null

  // Defensive stats (opponent-allowed)
  oppPaintPts: number | null
  oppFastbreakPts: number | null
  oppSecondChancePts: number | null
  oppPtsOffTurnovers: number | null

  // Shooting
  fgPct: number | null
  fg3Pct: number | null
  efgPct: number | null
  tsPct: number | null

  // Opponent shooting
  oppFgPct: number | null
  oppFg3Pct: number | null

  // Advanced
  defensiveRating: number | null
  offensiveRating: number | null
  pace: number | null

  // Per-game stats
  ptsPerGame: number | null
  rebPerGame: number | null
  astPerGame: number | null

  // Opponent per-game
  oppPtsPerGame: number | null
  oppRebPerGame: number | null
  oppAstPerGame: number | null
}

// =============================================================================
// Helper Types for Header Mapping
// =============================================================================

/**
 * Mapping of database column names to NBA Stats API header names
 */
export const NBA_STATS_HEADER_MAP = {
  // Team identification
  TEAM_ID: 'teamId',
  TEAM_NAME: 'teamName',
  TEAM_ABBREVIATION: 'teamAbbr',

  // Offensive play-type stats
  PTS_PAINT: 'paintPts',
  PTS_FB: 'fastbreakPts',
  PTS_2ND_CHANCE: 'secondChancePts',
  PTS_OFF_TOV: 'ptsOffTurnovers',

  // Defensive play-type stats (opponent-allowed)
  OPP_PTS_PAINT: 'oppPaintPts',
  OPP_PTS_FB: 'oppFastbreakPts',
  OPP_PTS_2ND_CHANCE: 'oppSecondChancePts',
  OPP_PTS_OFF_TOV: 'oppPtsOffTurnovers',

  // Shooting
  FG_PCT: 'fgPct',
  FG3_PCT: 'fg3Pct',
  EFG_PCT: 'efgPct',
  TS_PCT: 'tsPct',

  // Opponent shooting
  OPP_FG_PCT: 'oppFgPct',
  OPP_FG3_PCT: 'oppFg3Pct',
  OPP_EFG_PCT: 'oppEfgPct',

  // Advanced
  DEF_RATING: 'defensiveRating',
  OFF_RATING: 'offensiveRating',
  PACE: 'pace',

  // Per-game
  PTS: 'ptsPerGame',
  REB: 'rebPerGame',
  AST: 'astPerGame',

  // Opponent per-game
  OPP_PTS: 'oppPtsPerGame',
  OPP_REB: 'oppRebPerGame',
  OPP_AST: 'oppAstPerGame',
  OPP_TOV: 'oppTovPerGame',
} as const

/**
 * NBA Stats API endpoints
 */
export const NBA_STATS_ENDPOINTS = {
  LEAGUE_DASH_TEAM_STATS: 'leaguedashteamstats',
  TEAM_DASHBOARD_BY_GENERAL_SPLITS: 'teamdashboardbygeneralsplits',
  LEAGUE_DASH_PT_TEAM_DEFEND: 'leaguedashptteamdefend',
} as const
