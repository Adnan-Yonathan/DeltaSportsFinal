import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/betting/ats
 * Fetches team ATS (Against The Spread) records
 * 
 * Query parameters:
 *   - team: Team name or slug to filter by
 *   - sport: Sport key (e.g., 'basketball_nba')
 *   - season: Season year (e.g., 2025)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const team = searchParams.get('team')
    const sport = searchParams.get('sport') || 'basketball_nba'
    const season = searchParams.get('season')
    
    const supabase = createClient()
    
    let query = supabase
      .from('team_ats_records')
      .select('*')
      .eq('sport_key', sport)
      .order('captured_at', { ascending: false })
    
    // Apply filters
    if (team) {
      // Try matching by team name, provider ID, or covers slug
      query = query.or(`team_name.ilike.%${team}%,team_provider_id.ilike.%${team}%,covers_slug.ilike.%${team}%`)
    }
    
    if (season) {
      query = query.eq('season', parseInt(season))
    }
    
    const { data: records, error } = await query
    
    if (error) {
      console.error('[ATS Records] Error fetching:', error)
      throw error
    }
    
    // Format response
    const formatted = (records || []).map(record => ({
      team: record.team_name || record.team_provider_id,
      teamSlug: record.covers_slug,
      sport: record.sport_key,
      season: record.season,
      
      // Overall ATS
      atsRecord: record.record?.formatted || formatRecord(record.record),
      atsWins: record.record?.wins,
      atsLosses: record.record?.losses,
      atsPushes: record.record?.pushes,
      
      // Splits
      homeAts: record.home_ats_record,
      awayAts: record.away_ats_record,
      favoriteAts: record.favorite_ats_record,
      underdogAts: record.underdog_ats_record,
      overUnder: record.over_under_record,
      
      // Recent
      last10: record.last_10_ats,
      streak: record.ats_streak,
      
      // Metadata
      updatedAt: record.captured_at,
    }))
    
    return NextResponse.json({
      success: true,
      count: formatted.length,
      records: formatted,
      filters: { team, sport, season },
    })
  } catch (error: any) {
    console.error('[ATS Records] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ATS records', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * Format record object into string like "18-12-2"
 */
function formatRecord(record: any): string | null {
  if (!record) return null
  const { wins, losses, pushes } = record
  if (wins === undefined || losses === undefined) return null
  if (pushes && pushes > 0) {
    return `${wins}-${losses}-${pushes}`
  }
  return `${wins}-${losses}`
}

