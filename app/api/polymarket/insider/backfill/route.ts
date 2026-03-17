import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ingestPolymarketWalletTradesForTrackedWallets } from '@/lib/services/polymarket-wallet-ingest'
import { computePolymarketWalletRollups } from '@/lib/services/polymarket-wallet-rollups'

export const dynamic = 'force-dynamic'
// Allow up to 5 minutes on Vercel Pro — both steps are slow
export const maxDuration = 300

/**
 * POST /api/polymarket/insider/backfill
 * Manually triggers the insider feed data pipeline for authenticated users.
 *
 * step=ingest   — fetch fresh trades from Polymarket API for all tracked wallets
 * step=rollups  — recompute wallet summary stats (trade_count, roi, open positions, etc.)
 * step=both     — ingest then rollups (default)
 */
export async function POST(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const step = searchParams.get('step') ?? 'both'

  const results: Record<string, unknown> = {}

  try {
    if (step === 'ingest' || step === 'both') {
      const ingestResult = await ingestPolymarketWalletTradesForTrackedWallets({
        limit: 500,
        maxPages: 5,
        fullBackfill: false,
        sportsOnly: true,
      })
      results.ingest = ingestResult
    }

    if (step === 'rollups' || step === 'both') {
      const rollupResult = await computePolymarketWalletRollups({})
      results.rollups = {
        walletsProcessed: rollupResult.walletsProcessed,
      }
    }

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      step,
      ...results,
    })
  } catch (err: any) {
    console.error('[Insider Backfill] Error:', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
