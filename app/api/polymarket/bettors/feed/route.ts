import { NextResponse } from 'next/server'
import {
  getPolymarketBettorFeed,
  isInvalidPolymarketSportFilterError,
} from '@/lib/services/polymarket-bettor-feed'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limitParam = Number(searchParams.get('limit') ?? 50)
  const cursorParam = Number(searchParams.get('cursor') ?? NaN)
  const sportParam = searchParams.get('sport') ?? undefined
  const walletParam = searchParams.get('wallet') ?? undefined

  try {
    const payload = await getPolymarketBettorFeed({
      limit: Number.isFinite(limitParam) ? limitParam : 50,
      cursor: Number.isFinite(cursorParam) ? cursorParam : undefined,
      sport: sportParam,
      wallet: walletParam,
    })

    return NextResponse.json(payload, {
      headers: {
        'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
      },
    })
  } catch (error) {
    if (isInvalidPolymarketSportFilterError(error)) {
      return NextResponse.json({ error: 'Invalid sport filter' }, { status: 400 })
    }
    console.error('[polymarket/bettors/feed] error:', error)
    return NextResponse.json({ error: 'Failed to load bettor feed' }, { status: 500 })
  }
}
