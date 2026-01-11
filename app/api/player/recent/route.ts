import { NextResponse } from 'next/server'
import { getPlayerSeasonStats } from '@/lib/sports-stats-api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const name = searchParams.get('name')
    const sport = searchParams.get('sport') || undefined
    const seasonParam = searchParams.get('season')
    const seasonTypeParam = searchParams.get('seasonType')
    const seasonLabel = searchParams.get('seasonLabel') || undefined
    const seasonYear =
      seasonParam && Number.isFinite(Number(seasonParam))
        ? Number(seasonParam)
        : undefined
    const seasonType =
      seasonTypeParam && Number.isFinite(Number(seasonTypeParam))
        ? Number(seasonTypeParam)
        : undefined

    if (!name) {
      return NextResponse.json({ error: 'Missing player name' }, { status: 400 })
    }

    const data = await getPlayerSeasonStats(name, sport || undefined, {
      seasonYear,
      seasonType,
      seasonLabel,
    })
    if (!data) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    return NextResponse.json({
      recent: data.recent || [],
    })
  } catch (err: any) {
    console.error('[player/recent] error', err)
    return NextResponse.json({ error: 'Failed to fetch recent games' }, { status: 500 })
  }
}
