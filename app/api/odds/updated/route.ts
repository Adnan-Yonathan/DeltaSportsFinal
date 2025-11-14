import { NextRequest, NextResponse } from 'next/server'
import { fetchUpdatedOdds, mapBookmakersIO } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sinceParam = searchParams.get('since')
  const bookmaker = searchParams.get('bookmaker')
  const sport = searchParams.get('sport')

  if (!sinceParam || !bookmaker || !sport) {
    return NextResponse.json(
      { error: '"since", "bookmaker", and "sport" parameters are required' },
      { status: 400 }
    )
  }

  const since = Number(sinceParam)
  if (Number.isNaN(since)) {
    return NextResponse.json({ error: '"since" must be a unix timestamp' }, { status: 400 })
  }

  try {
    const events = await fetchUpdatedOdds({ since, bookmaker, sport })
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
      bookmaker,
      sport,
      since,
      count: normalized.length,
      events: normalized,
    })
  } catch (error: any) {
    console.error('[ODDS_UPDATED] Failed to fetch updated odds:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch updated odds' },
      { status: error?.statusCode || 500 }
    )
  }
}
