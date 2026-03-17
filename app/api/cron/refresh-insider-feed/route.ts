import { NextRequest, NextResponse } from 'next/server'
import { ingestPolymarketWalletTradesForTrackedWallets } from '@/lib/services/polymarket-wallet-ingest'
import { computePolymarketWalletRollups } from '@/lib/services/polymarket-wallet-rollups'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refresh-insider-feed
 * Runs on a schedule: incrementally ingests fresh trades for all tracked wallets,
 * then recomputes wallet summary stats (trade_count, roi, open positions, etc.)
 * so the Insider Feed always reflects today's activity.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    // Step 1: pull fresh trades from Polymarket API (incremental — only new since last_trade_ts)
    const ingestResult = await ingestPolymarketWalletTradesForTrackedWallets({
      limit: 500,
      maxPages: 5,
      fullBackfill: false,
      sportsOnly: true,
    })

    // Step 2: recompute wallet summary stats and open positions from updated trade data
    const rollupResult = await computePolymarketWalletRollups({})

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - start,
      ingest: {
        walletsProcessed: ingestResult.walletsProcessed,
        tradesFetched: ingestResult.tradesFetched,
        tradesInserted: ingestResult.tradesInserted,
      },
      rollups: {
        walletsProcessed: rollupResult.walletsProcessed,
      },
    })
  } catch (err: any) {
    console.error('[Cron: Insider Feed] Fatal error:', err)
    return NextResponse.json(
      { ok: false, error: err.message, durationMs: Date.now() - start },
      { status: 500 }
    )
  }
}
