import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds, findArbitrageOpportunities } from '@/lib/api/odds-api'
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
    const thresholdParam = searchParams.get('threshold')

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    const threshold = thresholdParam ? parseFloat(thresholdParam) : 1.0

    // Fetch odds with all markets
    const games = await fetchOdds(sport, ['h2h', 'spreads', 'totals'])

    // Find arbitrage opportunities
    const opportunities = findArbitrageOpportunities(games, threshold)

    return NextResponse.json({ opportunities })
  } catch (error) {
    console.error('Arbitrage API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find arbitrage' },
      { status: 500 }
    )
  }
}
