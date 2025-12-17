import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stats/opponent
 * Fetches opponent-allowed (defensive) advanced stats
 * 
 * Query parameters:
 *   - team: Team name or abbreviation to filter by
 *   - sport: Sport key (e.g., 'basketball_nba')
 *   - season: Season year (e.g., '2024-2025')
 *   - stat: Specific stat to rank by (e.g., 'opp_fg_pct', 'defensive_rating')
 *   - limit: Number of results (default: 30)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const team = searchParams.get('team')
    const sport = searchParams.get('sport') || 'basketball_nba'
    const season = searchParams.get('season')
    const stat = searchParams.get('stat')
    const limit = parseInt(searchParams.get('limit') || '30')
    
    const supabase = createClient()
    
    let query = supabase
      .from('opponent_allowed_stats')
      .select('*')
      .eq('sport_key', sport)
      .order('captured_at', { ascending: false })
      .limit(limit)
    
    // Apply filters
    if (team) {
      query = query.or(`team_name.ilike.%${team}%,team_abbr.ilike.%${team}%`)
    }
    
    if (season) {
      query = query.eq('season', season)
    }
    
    const { data: stats, error } = await query
    
    if (error) {
      console.error('[Opponent Stats] Error fetching:', error)
      throw error
    }
    
    // Format response
    const formatted = (stats || []).map(s => ({
      team: s.team_name,
      teamAbbr: s.team_abbr,
      teamId: s.team_id,
      season: s.season,
      
      // Shooting allowed
      shooting: {
        oppFgPct: formatPct(s.opp_fg_pct),
        oppFg3Pct: formatPct(s.opp_fg3_pct),
        oppEfgPct: formatPct(s.opp_efg_pct),
        oppTsPct: formatPct(s.opp_ts_pct),
      },
      
      // Points by play type
      pointsAllowed: {
        paint: s.opp_paint_pts_per_game,
        fastbreak: s.opp_fastbreak_pts_per_game,
        secondChance: s.opp_second_chance_pts_per_game,
        offTurnovers: s.opp_pts_off_to_per_game,
      },
      
      // Pace
      tempo: {
        pace: s.opp_pace,
        possessionsPerGame: s.opp_possessions_per_game,
      },
      
      // Rebounding
      rebounding: {
        oppOrbPct: formatPct(s.opp_orb_pct),
        oppDrbPct: formatPct(s.opp_drb_pct),
      },
      
      // Per-game metrics
      perGame: {
        oppPts: s.opp_pts_per_game,
        oppAst: s.opp_ast_per_game,
        oppReb: s.opp_reb_per_game,
        oppTov: s.opp_tov_per_game,
      },
      
      // Overall defensive metrics
      defensiveRating: s.defensive_rating,
      defensiveRank: s.defensive_rank,
      
      // Metadata
      updatedAt: s.captured_at,
    }))
    
    // If a specific stat is requested, sort and rank by that stat
    if (stat && formatted.length > 0) {
      const sortedBystat = sortByStat(formatted, stat)
      
      return NextResponse.json({
        success: true,
        count: sortedBystat.length,
        rankedBy: stat,
        teams: sortedBystat,
        filters: { team, sport, season, stat },
      })
    }
    
    return NextResponse.json({
      success: true,
      count: formatted.length,
      teams: formatted,
      filters: { team, sport, season },
    })
  } catch (error: any) {
    console.error('[Opponent Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch opponent stats', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Format percentage value
 */
function formatPct(val: number | null): string | null {
  if (val === null || val === undefined) return null
  return `${(val * 100).toFixed(1)}%`
}

/**
 * Sort teams by a specific stat
 */
function sortByStat(teams: any[], stat: string): any[] {
  // Map of stats and whether lower is better (for defensive stats, usually lower = better)
  const lowerIsBetter: Record<string, boolean> = {
    opp_fg_pct: true,
    opp_fg3_pct: true,
    opp_efg_pct: true,
    opp_ts_pct: true,
    opp_pts_per_game: true,
    defensive_rating: true,
    opp_paint_pts_per_game: true,
    opp_fastbreak_pts_per_game: true,
  }
  
  const ascending = lowerIsBetter[stat] ?? true
  
  // Get nested value based on stat key
  const getValue = (team: any, statKey: string): number | null => {
    // Try direct access
    if (team[statKey] !== undefined) return team[statKey]
    
    // Try nested access
    const mappings: Record<string, string[]> = {
      opp_fg_pct: ['shooting', 'oppFgPct'],
      opp_fg3_pct: ['shooting', 'oppFg3Pct'],
      opp_efg_pct: ['shooting', 'oppEfgPct'],
      opp_pts_per_game: ['perGame', 'oppPts'],
      opp_paint_pts_per_game: ['pointsAllowed', 'paint'],
    }
    
    if (mappings[statKey]) {
      const [section, key] = mappings[statKey]
      const val = team[section]?.[key]
      if (typeof val === 'string') {
        return parseFloat(val.replace('%', ''))
      }
      return val
    }
    
    return null
  }
  
  const sorted = [...teams].sort((a, b) => {
    const aVal = getValue(a, stat) ?? (ascending ? Infinity : -Infinity)
    const bVal = getValue(b, stat) ?? (ascending ? Infinity : -Infinity)
    return ascending ? aVal - bVal : bVal - aVal
  })
  
  // Add rank
  return sorted.map((team, index) => ({
    ...team,
    [`${stat}_rank`]: index + 1,
  }))
}

