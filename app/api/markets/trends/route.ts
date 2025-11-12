import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')
  const gameId = searchParams.get('game_id')
  const limit = Number(searchParams.get('limit') || 10)

  if (!sport) {
    return NextResponse.json({ error: 'sport parameter is required' }, { status: 400 })
  }

  const supabase = createClient()

  try {
    let query = supabase
      .from('market_snapshots')
      .select('*')
      .eq('sport_key', sport)
      .order('captured_at', { ascending: false })
      .limit(limit)

    if (gameId) {
      query = query.eq('game_id', gameId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[MARKETS] Failed to fetch snapshots:', error.message)
      return NextResponse.json({ error: 'Failed to fetch market trends' }, { status: 500 })
    }

    return NextResponse.json({
      sport,
      game_id: gameId,
      count: data?.length || 0,
      data,
    })
  } catch (error: any) {
    console.error('[MARKETS] Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
