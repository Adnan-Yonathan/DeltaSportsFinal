import { NextRequest, NextResponse } from 'next/server'
import { fetchMultiEventOdds, mapBookmakersIO } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const eventIdsParam = searchParams.get('eventIds')
  if (!eventIdsParam) {
    return NextResponse.json({ error: 'eventIds query parameter is required' }, { status: 400 })
  }

  const eventIds = eventIdsParam.split(',').map((id) => id.trim()).filter(Boolean)
  if (!eventIds.length) {
    return NextResponse.json({ error: 'At least one eventId must be provided' }, { status: 400 })
  }

  const bookmakersParam = searchParams.get('bookmakers') || undefined
  const bookmakerList = bookmakersParam ? bookmakersParam.split(',') : undefined

  try {
    const events = await fetchMultiEventOdds(eventIds, bookmakerList)
    const normalized = events.map((event) => ({
      id: event.id,
      home: event.home,
      away: event.away,
      date: event.date,
      status: event.status,
      league: event.league,
      sport: event.sport,
      bookmakers: mapBookmakersIO(event.bookmakers || {}, event.home, event.away),
    }))

    return NextResponse.json({
      count: normalized.length,
      events: normalized,
    })
  } catch (error: any) {
    console.error('[ODDS_MULTI] Failed to fetch odds:', error)

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
      { error: error?.message || 'Failed to fetch odds' },
      { status: error?.statusCode || 500 }
    )
  }
}
