import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/betting/splits
 * Fetches public betting splits (% of bets and % of money)
 * 
 * Query parameters:
 *   - gameId: Filter by specific game
 *   - sport: Sport key (e.g., 'basketball_nba')
 *   - marketType: Filter by market type ('spread', 'moneyline', 'total')
 *   - date: Filter by date (YYYY-MM-DD)
 *   - sharp: Filter for games with sharp action ('true' to show only sharp games)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gameId = searchParams.get('gameId')
    const sport = searchParams.get('sport') || 'basketball_nba'
    const marketType = searchParams.get('marketType')
    const date = searchParams.get('date')
    const sharpOnly = searchParams.get('sharp') === 'true'
    
    const supabase = createClient()
    
    // Use the latest_betting_splits view for most recent data per game
    let query = supabase
      .from('latest_betting_splits')
      .select('*')
      .eq('sport_key', sport)
      .order('game_time', { ascending: true })
    
    // Apply filters
    if (gameId) {
      query = query.eq('game_id', gameId)
    }
    
    if (marketType) {
      query = query.eq('market_type', marketType)
    }
    
    if (date) {
      const startOfDay = new Date(date)
      const endOfDay = new Date(date)
      endOfDay.setDate(endOfDay.getDate() + 1)
      
      query = query
        .gte('game_time', startOfDay.toISOString())
        .lt('game_time', endOfDay.toISOString())
    }
    
    if (sharpOnly) {
      query = query.in('sharp_indicator', ['sharp_home', 'sharp_away'])
    }
    
    const { data: splits, error } = await query
    
    if (error) {
      console.error('[Betting Splits] Error fetching:', error)
      throw error
    }
    
    // Group by game and format response
    const gameMap = new Map<string, any>()
    
    for (const split of (splits || [])) {
      if (!gameMap.has(split.game_id)) {
        gameMap.set(split.game_id, {
          gameId: split.game_id,
          homeTeam: split.home_team,
          awayTeam: split.away_team,
          gameTime: split.game_time,
          sport: split.sport_key,
          markets: {},
        })
      }
      
      const game = gameMap.get(split.game_id)
      game.markets[split.market_type] = {
        homeBetsPct: split.home_bets_pct,
        awayBetsPct: split.away_bets_pct,
        homeMoneyPct: split.home_money_pct,
        awayMoneyPct: split.away_money_pct,
        sharpIndicator: split.sharp_indicator,
        isSharpPlay: split.sharp_indicator?.startsWith('sharp_'),
        updatedAt: split.captured_at,
      }
    }
    
    const formatted = Array.from(gameMap.values())
    
    // Add summary analysis
    const sharpGames = formatted.filter(g => 
      Object.values(g.markets).some((m: any) => m.isSharpPlay)
    )
    
    return NextResponse.json({
      success: true,
      count: formatted.length,
      sharpCount: sharpGames.length,
      games: formatted,
      filters: { gameId, sport, marketType, date, sharpOnly },
    })
  } catch (error: any) {
    console.error('[Betting Splits] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch betting splits', details: error.message },
      { status: 500 }
    )
  }
}

