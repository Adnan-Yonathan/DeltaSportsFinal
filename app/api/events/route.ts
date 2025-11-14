import { NextRequest, NextResponse } from 'next/server'
import { fetchEventsList } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')
  if (!sport) {
    return NextResponse.json({ error: 'sport query parameter is required' }, { status: 400 })
  }

  const league = searchParams.get('league') || undefined
  const status = searchParams.get('status') || undefined
  const from = searchParams.get('from') || undefined
  const to = searchParams.get('to') || undefined
  const limitParam = searchParams.get('limit')
  const liveParam = searchParams.get('live')
  const limit = limitParam ? Number(limitParam) : undefined
  if (limitParam && Number.isNaN(limit)) {
    return NextResponse.json({ error: 'limit must be a number' }, { status: 400 })
  }
  const live = liveParam === 'true' || liveParam === '1'

  try {
    const events = await fetchEventsList(
      { sport, league, status, from, to, limit },
      { live }
    )
    return NextResponse.json({
      sport,
      league,
      status,
      count: events.length,
      events,
    })
  } catch (error: any) {
    console.error('[EVENTS] Failed to fetch events:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch events' },
      { status: error?.statusCode || 500 }
    )
  }
}
