import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInsiderFeed, MIN_INSIDER_SCORE } from '@/lib/services/polymarket-insider'
import { normalizePolymarketSportFilter } from '@/lib/services/polymarket-sports'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sport    = normalizePolymarketSportFilter(searchParams.get('sport') ?? undefined)
  const limit    = Math.min(Number(searchParams.get('limit')  ?? 50), 200)
  const offset   = Math.max(Number(searchParams.get('offset') ?? 0),  0)
  const minScore = Number(searchParams.get('minScore') ?? MIN_INSIDER_SCORE)
  // daysBack: 0 = today only, 3 = last 3 days, -1 = all time
  const daysBack = searchParams.has('daysBack') ? Number(searchParams.get('daysBack')) : 3

  try {
    const bets = await getInsiderFeed({ sport, limit, offset, minScore, daysBack })
    return NextResponse.json({ bets, total: bets.length })
  } catch (err) {
    console.error('[INSIDER] feed error', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
