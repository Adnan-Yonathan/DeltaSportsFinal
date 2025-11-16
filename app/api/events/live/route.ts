import { NextRequest, NextResponse } from 'next/server'
import { fetchLiveEventsList } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport') || undefined

  try {
    const events = await fetchLiveEventsList(sport)
    return NextResponse.json({
      sport,
      count: events.length,
      events,
    })
  } catch (error: any) {
    console.error('[EVENTS_LIVE] Failed to fetch live events:', error)

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
      { error: error?.message || 'Failed to fetch live events' },
      { status: error?.statusCode || 500 }
    )
  }
}
