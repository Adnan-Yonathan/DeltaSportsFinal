/**
 * NBA Stats API Client
 *
 * Direct TypeScript client for stats.nba.com REST API
 * No Python required - these are standard JSON HTTP endpoints
 */

import type {
  NbaStatsResponse,
  NbaStatsLeagueTeamStats,
  NbaStatsTeamDashboard,
  NbaStatsTeam,
  OpponentAllowedStats,
  NBA_STATS_HEADER_MAP,
} from './types'

const NBA_STATS_BASE = 'https://stats.nba.com/stats'

// In-memory cache (same pattern as ESPN providers)
const cache = new Map<string, { ts: number; data: any }>()
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours
const NBA_STATS_DEFAULT_PARAMS: Record<string, string> = {
  LeagueID: '00',
  SeasonType: 'Regular Season',
  PerMode: 'PerGame',
  MeasureType: 'Base',
  PlusMinus: 'N',
  PaceAdjust: 'N',
  Rank: 'N',
  Outcome: '',
  Location: '',
  Month: '0',
  SeasonSegment: '',
  DateFrom: '',
  DateTo: '',
  OpponentTeamID: '0',
  VsConference: '',
  VsDivision: '',
  GameSegment: '',
  Period: '0',
  LastNGames: '0',
  GameScope: '',
  PlayerExperience: '',
  PlayerPosition: '',
  StarterBench: '',
  TwoWay: '0',
}

/**
 * Generic fetch wrapper with caching and required headers
 * stats.nba.com requires browser headers to avoid 403
 */
async function fetchNbaStats<T extends NbaStatsResponse>(
  endpoint: string,
  params: Record<string, string | number> = {}
): Promise<T | null> {
  const url = new URL(`${NBA_STATS_BASE}/${endpoint}`)
  const mergedParams = { ...NBA_STATS_DEFAULT_PARAMS, ...params }
  Object.entries(mergedParams).forEach(([k, v]) =>
    url.searchParams.set(k, String(v))
  )

  const cacheKey = url.toString()
  const cached = cache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data as T
  }

  try {
    // Headers required to avoid 403 (pretend to be nba.com browser)
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://stats.nba.com/',
        'Origin': 'https://stats.nba.com',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'x-nba-stats-origin': 'stats',
        'x-nba-stats-token': 'true',
      },
      cache: 'no-store',
    })

    if (!res.ok) {
      console.error(`NBA Stats API error: ${res.status} ${res.statusText} for ${endpoint}`)
      return null
    }

    const data = (await res.json()) as T
    cache.set(cacheKey, { ts: Date.now(), data })
    return data
  } catch (error) {
    console.error(`Failed to fetch from NBA Stats API (${endpoint}):`, error)
    return null
  }
}

/**
 * Get current NBA season in "YYYY-YY" format
 * Example: 2024-25, 2025-26
 */
export function getCurrentNbaSeason(): string {
  const now = new Date()
  const month = now.getMonth() // 0-11
  const year = now.getFullYear()

  // NBA season typically runs October to June
  if (month >= 9) {
    // Oct-Dec: current year is starting year
    return `${year}-${String(year + 1).slice(2)}`
  }
  // Jan-Sept: previous year is starting year
  return `${year - 1}-${String(year).slice(2)}`
}

/**
 * Fetch league-wide team stats (all 30 teams in one call)
 * This endpoint includes paint points, fastbreak points, 2nd chance points
 */
export async function fetchLeagueTeamStats(
  season: string = getCurrentNbaSeason(),
  measureType: 'Base' | 'Advanced' | 'Misc' | 'Scoring' = 'Base',
  perMode: 'PerGame' | 'Totals' | 'Per48' = 'PerGame'
): Promise<NbaStatsLeagueTeamStats | null> {
  return fetchNbaStats<NbaStatsLeagueTeamStats>('leaguedashteamstats', {
    Season: season,
    MeasureType: measureType,
    PerMode: perMode,
  })
}

/**
 * Fetch team dashboard stats (includes paint, fastbreak, 2nd chance)
 */
export async function fetchTeamDashboard(
  teamId: string,
  season: string = getCurrentNbaSeason()
): Promise<NbaStatsTeamDashboard | null> {
  return fetchNbaStats<NbaStatsTeamDashboard>('teamdashboardbygeneralsplits', {
    TeamID: teamId,
    Season: season,
    MeasureType: 'Base',
  })
}

/**
 * Parse rowSet array using headers to create an object
 * NBA Stats API returns parallel arrays: headers[] and rowSet[][]
 */
export function parseRowToObject(headers: string[], row: any[]): Record<string, any> {
  const obj: Record<string, any> = {}
  headers.forEach((header, index) => {
    obj[header] = row[index]
  })
  return obj
}

/**
 * Helper to safely extract numeric values
 */
function num(val: any): number | null {
  if (val === undefined || val === null || val === '') return null
  const n = typeof val === 'number' ? val : parseFloat(val)
  return isNaN(n) ? null : n
}

/**
 * Map NBA Stats team data to OpponentAllowedStats schema
 * Extracts defensive/opponent-allowed metrics from the API response
 */
export function mapNbaStatsToOpponentStats(
  teamRow: Record<string, any>,
  season: string = getCurrentNbaSeason()
): OpponentAllowedStats {
  return {
    teamName: String(teamRow.TEAM_NAME || teamRow.TEAM || ''),
    teamAbbr: String(teamRow.TEAM_ABBREVIATION || teamRow.TEAM_ABBR || ''),
    teamId: String(teamRow.TEAM_ID || ''),
    season,
    sportKey: 'basketball_nba',

    // Shooting allowed
    oppFgPct: num(teamRow.OPP_FG_PCT),
    oppFg3Pct: num(teamRow.OPP_FG3_PCT),
    oppEfgPct: num(teamRow.OPP_EFG_PCT),
    oppTsPct: num(teamRow.OPP_TS_PCT),

    // Points by play type (opponent-allowed)
    oppPaintPtsPerGame: num(teamRow.OPP_PTS_PAINT),
    oppFastbreakPtsPerGame: num(teamRow.OPP_PTS_FB),
    oppSecondChancePtsPerGame: num(teamRow.OPP_PTS_2ND_CHANCE),
    oppPtsOffToPerGame: num(teamRow.OPP_PTS_OFF_TOV),

    // Pace/possessions
    oppPace: num(teamRow.PACE),
    oppPossessionsPerGame: num(teamRow.POSS),

    // Rebounding allowed
    oppOrbPct: num(teamRow.OPP_ORB_PCT),
    oppDrbPct: num(teamRow.OPP_DRB_PCT),

    // Per-game defensive metrics
    oppPtsPerGame: num(teamRow.OPP_PTS),
    oppAstPerGame: num(teamRow.OPP_AST),
    oppRebPerGame: num(teamRow.OPP_REB),
    oppTovPerGame: num(teamRow.OPP_TOV),

    // Defensive rating
    defensiveRating: num(teamRow.DEF_RATING),

    // Rankings (would need separate endpoint)
    defensiveRank: null,

    capturedAt: new Date(),
  }
}

/**
 * Fetch all team opponent-allowed stats for the current season
 * Returns array of OpponentAllowedStats ready for database insertion
 */
export async function getAllTeamOpponentStats(
  season: string = getCurrentNbaSeason()
): Promise<OpponentAllowedStats[]> {
  const results: OpponentAllowedStats[] = []

  // Fetch base stats (includes PTS_PAINT, PTS_FB, PTS_2ND_CHANCE)
  const baseStats = await fetchLeagueTeamStats(season, 'Base')

  if (!baseStats || !baseStats.resultSets || baseStats.resultSets.length < 1) {
    console.error('Failed to fetch base team stats from NBA Stats API')
    return []
  }

  const baseResultSet = baseStats.resultSets[0]
  const baseHeaders = baseResultSet.headers
  const baseRows = baseResultSet.rowSet

  // Fetch advanced stats (includes DEF_RATING, PACE)
  const advancedStats = await fetchLeagueTeamStats(season, 'Advanced')

  // Create map of team ID to advanced stats
  const advancedMap = new Map<string, Record<string, any>>()
  if (advancedStats && advancedStats.resultSets[0]) {
    const advHeaders = advancedStats.resultSets[0].headers
    const advRows = advancedStats.resultSets[0].rowSet

    for (const row of advRows) {
      const parsed = parseRowToObject(advHeaders, row)
      const teamId = String(parsed.TEAM_ID)
      advancedMap.set(teamId, parsed)
    }
  }

  // Parse each team's base stats and merge with advanced
  for (const row of baseRows) {
    const teamRow = parseRowToObject(baseHeaders, row)
    const teamId = String(teamRow.TEAM_ID)

    // Merge advanced stats
    const advanced = advancedMap.get(teamId)
    if (advanced) {
      Object.assign(teamRow, advanced)
    }

    // Map to OpponentAllowedStats schema
    const oppStats = mapNbaStatsToOpponentStats(teamRow, season)
    results.push(oppStats)
  }

  return results
}

/**
 * Calculate defensive rankings based on defensive rating
 */
export function calculateDefensiveRankings(
  teamStats: OpponentAllowedStats[]
): OpponentAllowedStats[] {
  // Sort by defensive rating (lower is better)
  const sorted = [...teamStats].sort((a, b) => {
    const aRating = a.defensiveRating ?? Infinity
    const bRating = b.defensiveRating ?? Infinity
    return aRating - bRating
  })

  // Assign ranks
  return sorted.map((team, index) => ({
    ...team,
    defensiveRank: team.defensiveRating !== null ? index + 1 : null,
  }))
}





