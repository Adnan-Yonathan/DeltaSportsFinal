import { NextResponse } from 'next/server'
import {
  getPolymarketBettorPositions,
  isInvalidPolymarketSportFilterError,
} from '@/lib/services/polymarket-bettor-feed'

export async function GET(
  request: Request,
  { params }: { params: { wallet: string } }
) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get('sport') ?? undefined
  const limit = Number(searchParams.get('limit') ?? 100)

  try {
    const payload = await getPolymarketBettorPositions({
      wallet: params.wallet,
      sport,
      limit: Number.isFinite(limit) ? limit : 100,
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
    console.error('[polymarket/bettors/:wallet/positions] error:', error)
    return NextResponse.json({ error: 'Failed to load wallet positions' }, { status: 500 })
  }
}
