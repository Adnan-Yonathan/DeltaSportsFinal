import { NextResponse } from 'next/server'
import {
  fetchDailyWhaleTrades,
  getDailyTradeStats,
} from '@/lib/services/whale-trades-daily'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const date = searchParams.get('date') ?? undefined
  const sport = searchParams.get('sport') ?? undefined
  const minNotionalRaw = searchParams.get('minNotional')
  const limitRaw = searchParams.get('limit')
  const includeStats = searchParams.get('includeStats') === 'true'

  const minNotional = minNotionalRaw ? Number(minNotionalRaw) : undefined
  const limit = limitRaw ? Number(limitRaw) : 500

  try {
    const [trades, stats] = await Promise.all([
      fetchDailyWhaleTrades({
        date,
        sport,
        minNotional: Number.isFinite(minNotional) ? minNotional : undefined,
        limit: Number.isFinite(limit) ? limit : 500,
      }),
      includeStats ? getDailyTradeStats() : null,
    ])

    return NextResponse.json(
      {
        trades,
        stats: stats ?? undefined,
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=10, stale-while-revalidate=20',
        },
      }
    )
  } catch (error) {
    console.error('[whale-trades-daily] API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch trades' },
      { status: 500 }
    )
  }
}
