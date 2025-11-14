import { NextRequest, NextResponse } from 'next/server'
import {
  fetchOdds,
  findArbitrageOpportunities,
  fetchArbitrageOpportunitiesRemote,
} from '@/lib/api/odds-api'
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
    const remoteBooksParam = searchParams.get('bookmakers') || process.env.ODDS_BOOKMAKERS || undefined
    const remoteLimitParam = searchParams.get('limit')
    const parsedLimit = remoteLimitParam ? Number(remoteLimitParam) : undefined
    const safeLimit =
      parsedLimit && !Number.isNaN(parsedLimit) ? Math.min(parsedLimit, 500) : undefined
    const includeEventDetails = searchParams.get('includeEventDetails') === 'true'

    const remoteBookmakersList = remoteBooksParam
      ? remoteBooksParam.split(',').map((entry) => entry.trim()).filter(Boolean)
      : []

    const providerPromise =
      remoteBookmakersList.length > 0
        ? fetchArbitrageOpportunitiesRemote(
            {
              bookmakers: remoteBookmakersList,
              limit: safeLimit,
              includeEventDetails,
            }
          ).catch((error) => {
            console.warn('[ARBITRAGE] Provider opportunities failed:', error)
            return []
          })
        : Promise.resolve([])

    // Fetch odds with all markets
    const [games, providerOpportunities] = await Promise.all([
      fetchOdds(sport, ['h2h', 'spreads', 'totals'], { live: true }),
      providerPromise,
    ])

    // Find arbitrage opportunities
    const opportunities = findArbitrageOpportunities(games, threshold)

    return NextResponse.json({ opportunities, providerOpportunities })
  } catch (error) {
    console.error('Arbitrage API error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to find arbitrage' },
      { status: 500 }
    )
  }
}
