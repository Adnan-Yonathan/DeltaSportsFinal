import { NextRequest, NextResponse } from 'next/server'
import { fetchEventOdds, mapBookmakersIO } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventId = searchParams.get('eventId')
  if (!eventId) {
    return NextResponse.json({ error: 'eventId query parameter is required' }, { status: 400 })
  }

  const bookmakersParam = searchParams.get('bookmakers') || undefined
  const bookmakerList = bookmakersParam ? bookmakersParam.split(',') : undefined

  try {
    const event = await fetchEventOdds(eventId, bookmakerList)
    const normalized = mapBookmakersIO(event.bookmakers || {}, event.home, event.away)

    return NextResponse.json({
      event: {
        id: event.id,
        home: event.home,
        away: event.away,
        date: event.date,
        status: event.status,
        league: event.league,
        sport: event.sport,
      },
      bookmakers: normalized,
      provider: event,
    })
  } catch (error: any) {
    console.error('[ODDS_EVENT] Failed to fetch event odds:', error)

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
      { error: error?.message || 'Failed to fetch event odds' },
      { status: error?.statusCode || 500 }
    )
  }
}
