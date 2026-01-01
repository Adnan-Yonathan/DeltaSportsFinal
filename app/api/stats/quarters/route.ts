import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/stats/quarters
 * Fetches period/quarter scoring data and averages
 * 
 * Query parameters:
 *   - team: Team name to filter by
 *   - sport: Sport key (e.g., 'basketball_nba')
 *   - quarter: Specific quarter/period number (1-4 for quarters, 5+ for OT)
 *   - gameId: Filter by specific game
 *   - aggregate: If 'true', returns team averages instead of game-by-game
 *   - limit: Number of results (default: 50)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const team = searchParams.get('team')
    const sport = searchParams.get('sport') || 'basketball_nba'
    const quarter = searchParams.get('quarter')
    const gameId = searchParams.get('gameId')
    const aggregate = searchParams.get('aggregate') === 'true'
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const supabase = createClient()
    
    if (aggregate && team) {
      // Return team quarter averages using the view
      const { data: averages, error } = await supabase
        .from('team_quarter_averages')
        .select('*')
        .eq('sport_key', sport)
        .ilike('team', `%${team}%`)
        .order('period_number', { ascending: true })
      
      if (error) {
        console.error('[Quarter Stats] Error fetching averages:', error)
        throw error
      }
      
      // Format as easy-to-use structure
      const formatted = (averages || []).map(avg => ({
        team: avg.team,
        quarter: avg.period_number,
        periodType: avg.period_type,
        avgPoints: parseFloat(avg.avg_points?.toFixed(1) || '0'),
        gamesPlayed: avg.games_count,
      }))
      
      return NextResponse.json({
        success: true,
        type: 'averages',
        team,
        data: formatted,
      })
    }
    
    // Return game-by-game period scores
    let query = supabase
      .from('period_scores')
      .select('*')
      .eq('sport_key', sport)
      .order('game_date', { ascending: false })
      .limit(limit)
    
    // Apply filters
    if (team) {
      query = query.or(`home_team.ilike.%${team}%,away_team.ilike.%${team}%`)
    }
    
    if (quarter) {
      query = query.eq('period_number', parseInt(quarter))
    }
    
    if (gameId) {
      query = query.eq('game_id', gameId)
    }
    
    const { data: scores, error } = await query
    
    if (error) {
      console.error('[Quarter Stats] Error fetching scores:', error)
      throw error
    }
    
    // Group by game
    const gameMap = new Map<string, any>()
    
    for (const score of (scores || [])) {
      if (!gameMap.has(score.game_id)) {
        gameMap.set(score.game_id, {
          gameId: score.game_id,
          homeTeam: score.home_team,
          awayTeam: score.away_team,
          homeTeamAbbr: score.home_team_abbr,
          awayTeamAbbr: score.away_team_abbr,
          gameDate: score.game_date,
          periods: [],
          homeTotalByQuarter: {},
          awayTotalByQuarter: {},
        })
      }
      
      const game = gameMap.get(score.game_id)
      game.periods.push({
        quarter: score.period_number,
        type: score.period_type,
        homePoints: score.home_points,
        awayPoints: score.away_points,
      })
      
      game.homeTotalByQuarter[`Q${score.period_number}`] = score.home_points
      game.awayTotalByQuarter[`Q${score.period_number}`] = score.away_points
    }
    
    // Sort periods within each game
    const formatted = Array.from(gameMap.values()).map(game => {
      game.periods.sort((a: any, b: any) => a.quarter - b.quarter)
      return game
    })
    
    return NextResponse.json({
      success: true,
      type: 'games',
      count: formatted.length,
      games: formatted,
      filters: { team, sport, quarter, gameId },
    })
  } catch (error: any) {
    console.error('[Quarter Stats] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quarter stats', details: error.message },
      { status: 500 }
    )
  }
}

