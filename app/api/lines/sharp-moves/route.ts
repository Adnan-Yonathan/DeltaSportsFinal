import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { detectSharpMoves } from '@/lib/services/line-recorder'

/**
 * GET /api/lines/sharp-moves
 * Fetches recent sharp line movements
 * Query parameters:
 *   - sport: Filter by sport
 *   - limit: Number of results to return (default: 50)
 *   - detect: If true, runs sharp move detection first (default: false)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const limit = parseInt(searchParams.get('limit') || '50')
    const runDetection = searchParams.get('detect') === 'true'

    const supabase = createClient()

    // Run detection if requested
    if (runDetection) {
      console.log('[Sharp Moves] Running sharp move detection...')
      await detectSharpMoves()
    }

    // Build query
    let query = supabase
      .from('lines')
      .select('*')
      .eq('is_sharp_move', true)
      .order('recorded_at', { ascending: false })
      .limit(limit)

    if (sport) {
      query = query.eq('sport', sport)
    }

    const { data: sharpMoves, error } = await query

    if (error) {
      console.error('[Sharp Moves] Error fetching sharp moves:', error)
      throw error
    }

    // Group by game for better presentation
    const gameGroups = new Map<string, any[]>()

    if (sharpMoves) {
      for (const move of sharpMoves) {
        const key = `${move.odds_api_id}_${move.market_type}`
        if (!gameGroups.has(key)) {
          gameGroups.set(key, [])
        }
        gameGroups.get(key)!.push(move)
      }
    }

    // Format grouped data
    const groupedMoves = Array.from(gameGroups.entries()).map(([key, moves]) => {
      const [gameId, marketType] = key.split('_')
      const first = moves[0]

      return {
        gameId,
        game: `${first.away_team} @ ${first.home_team}`,
        gameTime: first.game_time,
        sport: first.sport,
        marketType,
        bookmakers: moves.map(m => ({
          bookmaker: m.bookmaker,
          line: marketType === 'spread' ? m.spread_home :
                marketType === 'total' ? m.total_line :
                m.moneyline_home,
          recordedAt: m.recorded_at
        }))
      }
    })

    return NextResponse.json({
      success: true,
      count: sharpMoves?.length || 0,
      sharpMoves: sharpMoves || [],
      grouped: groupedMoves,
      detectionRun: runDetection
    })
  } catch (error: any) {
    console.error('[Sharp Moves] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sharp moves', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * POST /api/lines/sharp-moves
 * Manually trigger sharp move detection
 */
export async function POST(req: NextRequest) {
  try {
    // Verify auth for manual triggers
    const authHeader = req.headers.get('authorization')
    if (process.env.NODE_ENV === 'production' && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('[Sharp Moves] Running sharp move detection...')
    await detectSharpMoves()

    const supabase = createClient()
    const { data: sharpMoves, count } = await supabase
      .from('lines')
      .select('*', { count: 'exact' })
      .eq('is_sharp_move', true)
      .order('recorded_at', { ascending: false })
      .limit(50)

    return NextResponse.json({
      success: true,
      message: 'Sharp move detection completed',
      totalSharpMoves: count,
      recentMoves: sharpMoves || [],
      timestamp: new Date().toISOString()
    })
  } catch (error: any) {
    console.error('[Sharp Moves] Error:', error)
    return NextResponse.json(
      { error: 'Failed to detect sharp moves', details: error.message },
      { status: 500 }
    )
  }
}
