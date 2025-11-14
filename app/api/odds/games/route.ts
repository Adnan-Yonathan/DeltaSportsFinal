import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const marketsParam = searchParams.get('markets')

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    const markets = marketsParam ? marketsParam.split(',') : ['h2h', 'spreads', 'totals']
    const liveParam = searchParams.get('live')
    const live =
      liveParam === null ? false : liveParam === 'true' || liveParam === '1'

    const games = await fetchOdds(sport, markets, { live })

    return NextResponse.json({ games })
  } catch (error) {
    console.error('Odds provider error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch odds' },
      { status: 500 }
    )
  }
}
