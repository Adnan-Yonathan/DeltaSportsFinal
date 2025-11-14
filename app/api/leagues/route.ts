import { NextRequest, NextResponse } from 'next/server'
import { listLeagues } from '@/lib/api/odds-api'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')

  if (!sport) {
    return NextResponse.json({ error: 'sport query parameter is required' }, { status: 400 })
  }

  try {
    const leagues = await listLeagues(sport)
    return NextResponse.json({
      sport,
      count: leagues.length,
      leagues,
    })
  } catch (error: any) {
    console.error('[LEAGUES] Failed to fetch leagues:', error)
    return NextResponse.json(
      { error: error?.message || 'Failed to fetch leagues' },
      { status: error?.statusCode || 500 }
    )
  }
}
