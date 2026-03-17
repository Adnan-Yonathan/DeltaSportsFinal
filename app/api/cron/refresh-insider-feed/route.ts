import { NextRequest, NextResponse } from 'next/server'
import { refreshInsiderFeedCache } from '@/lib/services/insider-feed-direct'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refresh-insider-feed
 *
 * New direct-API pipeline — no dependency on polymarket_wallet_summary or
 * open_positions ETL tables.
 *
 * Steps:
 *  1. Fetch wallets from Polymarket leaderboard (multi-strategy discovery)
 *  2. Filter to wallets with 3–20% ROI and minimum 500 trades, take top 40
 *  3. Fetch last 200 trades per wallet (5 concurrent)
 *  4. Compute open sports positions from trades (net BUY shares remaining)
 *  5. Score each position with computeInsiderScore
 *  6. Upsert qualifying bets to insider_feed_cache table
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    const result = await refreshInsiderFeedCache()

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      ...result,
    })
  } catch (err: any) {
    console.error('[Cron: Insider Feed] Fatal error:', err)
    return NextResponse.json(
      { ok: false, error: err.message, durationMs: Date.now() - start },
      { status: 500 }
    )
  }
}
