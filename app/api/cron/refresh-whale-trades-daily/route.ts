import { NextRequest, NextResponse } from 'next/server'
import { fetchWhaleTrades, DEFAULT_LIMIT, DEFAULT_MIN_NOTIONAL } from '@/lib/services/whale-detector'
import { storeWhaleTrades } from '@/lib/services/whale-trades-daily'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refresh-whale-trades-daily
 * Pulls recent whale trades and stores them in daily storage for a shared bet feed.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const limit = Math.max(DEFAULT_LIMIT, 300)
    const minNotional = DEFAULT_MIN_NOTIONAL
    const trades = await fetchWhaleTrades({ limit, minNotional })

    if (trades.length > 0) {
      await storeWhaleTrades(trades)
    }

    return NextResponse.json({
      ok: true,
      stored: trades.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Cron: Whale Trades Daily] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
