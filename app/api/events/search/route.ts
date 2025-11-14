import { NextRequest, NextResponse } from 'next/server'
import { searchEvents } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.get('query') || ''

  if (query.length < 3) {
    return NextResponse.json({ error: 'query must be at least 3 characters' }, { status: 400 })
  }

  try {
    const events = await searchEvents(query)
    return NextResponse.json({
      query,
      count: events.length,
      events,
    })
  } catch (error: any) {
    console.error('[EVENTS_SEARCH] Failed to search events:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to search events' },
      { status: error?.statusCode || 500 }
    )
  }
}
