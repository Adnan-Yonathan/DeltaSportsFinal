import { NextResponse } from 'next/server'
import {
  getPolymarketBettorLeaderboard,
  isInvalidPolymarketSportFilterError,
} from '@/lib/services/polymarket-bettor-feed'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = Number(searchParams.get('limit') ?? 25)
  const sportParam = searchParams.get('sport') ?? undefined

  try {
    const leaderboard = await getPolymarketBettorLeaderboard({
      limit: Number.isFinite(limitParam) ? limitParam : 25,
      sport: sportParam,
    })

    return NextResponse.json(
      {
        bettors: leaderboard,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, stale-while-revalidate=60',
        },
      }
    )
  } catch (error) {
    if (isInvalidPolymarketSportFilterError(error)) {
      return NextResponse.json({ error: 'Invalid sport filter' }, { status: 400 })
    }
    console.error('[polymarket/bettors/leaderboard] error:', error)
    return NextResponse.json({ error: 'Failed to load leaderboard' }, { status: 500 })
  }
}
