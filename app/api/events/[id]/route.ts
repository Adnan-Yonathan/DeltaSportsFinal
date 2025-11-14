import { NextRequest, NextResponse } from 'next/server'
import { fetchEventById } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(_req: NextRequest, context: { params: { id: string } }) {
  const id = context.params?.id
  if (!id) {
    return NextResponse.json({ error: 'Event id is required' }, { status: 400 })
  }

  try {
    const event = await fetchEventById(id)
    return NextResponse.json({ event })
  } catch (error: any) {
    console.error('[EVENT_BY_ID] Failed to fetch event:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch event' },
      { status: error?.statusCode || 500 }
    )
  }
}
