import { NextRequest, NextResponse } from 'next/server'
import { discoverPolymarketSportsBettors } from '@/lib/services/polymarket-wallet-ingest'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/discover-polymarket-bettors
 * Discovers active sports bettors from the global Polymarket trades stream.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Number(searchParams.get('limit') ?? 500)
    const maxPages = Number(searchParams.get('maxPages') ?? 5)

    const result = await discoverPolymarketSportsBettors({
      limit: Number.isFinite(limit) ? limit : 500,
      maxPages: Number.isFinite(maxPages) ? maxPages : 5,
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error: any) {
    console.error('[Cron: Discover Polymarket Bettors] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
