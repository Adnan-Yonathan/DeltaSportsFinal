import { NextRequest, NextResponse } from 'next/server'
import { fetchOddsMovements } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  const bookmaker = searchParams.get('bookmaker')
  const market = searchParams.get('market')
  const marketLine = searchParams.get('marketLine') || undefined

  if (!eventId || !bookmaker || !market) {
    return NextResponse.json(
      { error: '"eventId", "bookmaker", and "market" parameters are required' },
      { status: 400 }
    )
  }

  try {
    const movement = await fetchOddsMovements({ eventId, bookmaker, market, marketLine })
    return NextResponse.json({ movement })
  } catch (error: any) {
    console.error('[ODDS_MOVEMENTS] Failed to fetch odds movements:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch odds movements' },
      { status: error?.statusCode || 500 }
    )
  }
}
