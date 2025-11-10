import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/lines/history
 * Fetches historical line data for a game or sport
 * Query parameters:
 *   - gameId: The odds API game ID
 *   - sport: Filter by sport
 *   - marketType: Filter by market type (spread, total, moneyline)
 *   - bookmaker: Filter by bookmaker
 *   - lineType: Filter by line type (opening, current, closing)
 *   - limit: Number of results to return (default: 100)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const gameId = searchParams.get('gameId')
    const sport = searchParams.get('sport')
    const marketType = searchParams.get('marketType')
    const bookmaker = searchParams.get('bookmaker')
    const lineType = searchParams.get('lineType')
    const limit = parseInt(searchParams.get('limit') || '100')

    const supabase = createClient()

    let query = supabase
      .from('lines')
      .select('*')
      .order('recorded_at', { ascending: true })
      .limit(limit)

    // Apply filters
    if (gameId) query = query.eq('odds_api_id', gameId)
    if (sport) query = query.eq('sport', sport)
    if (marketType) query = query.eq('market_type', marketType)
    if (bookmaker) query = query.eq('bookmaker', bookmaker)
    if (lineType) query = query.eq('line_type', lineType)

    const { data: lines, error } = await query

    if (error) {
      console.error('[Line History] Error fetching lines:', error)
      throw error
    }

    // Calculate line movements if we have multiple data points
    let movements: any[] = []
    if (lines && lines.length > 1 && gameId && marketType) {
      const grouped = new Map<string, any[]>()

      // Group by bookmaker
      for (const line of lines) {
        const key = line.bookmaker
        if (!grouped.has(key)) {
          grouped.set(key, [])
        }
        grouped.get(key)!.push(line)
      }

      // Calculate movement for each bookmaker
      for (const [book, bookLines] of grouped.entries()) {
        if (bookLines.length < 2) continue

        bookLines.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
        const first = bookLines[0]
        const last = bookLines[bookLines.length - 1]

        let movement = 0
        let direction = 'stable'

        if (marketType === 'spread' && first.spread_home !== null && last.spread_home !== null) {
          movement = last.spread_home - first.spread_home
          direction = movement > 0 ? 'up' : movement < 0 ? 'down' : 'stable'
        } else if (marketType === 'total' && first.total_line !== null && last.total_line !== null) {
          movement = last.total_line - first.total_line
          direction = movement > 0 ? 'up' : movement < 0 ? 'down' : 'stable'
        }

        movements.push({
          bookmaker: book,
          movement,
          direction,
          firstRecorded: first.recorded_at,
          lastRecorded: last.recorded_at,
          dataPoints: bookLines.length
        })
      }
    }

    return NextResponse.json({
      success: true,
      count: lines?.length || 0,
      lines: lines || [],
      movements: movements.length > 0 ? movements : undefined,
      filters: {
        gameId,
        sport,
        marketType,
        bookmaker,
        lineType
      }
    })
  } catch (error: any) {
    console.error('[Line History] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch line history', details: error.message },
      { status: 500 }
    )
  }
}
