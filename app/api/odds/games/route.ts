import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const isDev = process.env.NODE_ENV !== 'production'
    if (!user && !isDev) {
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
    const games = await fetchOdds(sport, markets, {
      revalidateSeconds: 600,
      forceProvider: 'the-odds-api',
    })

    return NextResponse.json({ games })
  } catch (error: any) {
    console.error('Odds provider error:', error)

    // Check for rate limit errors
    if (error?.isRateLimited || error?.statusCode === 429) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded. The odds API is experiencing high traffic. Please wait a few minutes and try again.',
          isRateLimited: true
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch odds' },
      { status: 500 }
    )
  }
}

