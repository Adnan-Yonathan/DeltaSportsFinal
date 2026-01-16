import { NextRequest, NextResponse } from 'next/server'
import {
  ingestPolymarketWalletTradesForTrackedWallets,
  seedTrackedPolymarketWallets,
} from '@/lib/services/polymarket-wallet-ingest'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/ingest-polymarket-wallets
 * Seeds wallets from detector trades, then ingests wallet trade history.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const mode = searchParams.get('mode') ?? 'incremental'
    const wallet = searchParams.get('wallet') ?? undefined
    const limit = Number(searchParams.get('limit') ?? 1000)
    const maxPages = Number(searchParams.get('maxPages') ?? 10)
    const seed = searchParams.get('seed') !== 'false'
    const fullBackfill = mode === 'backfill'

    let seedResult = { inserted: 0, wallets: [] as string[] }
    if (seed) {
      seedResult = await seedTrackedPolymarketWallets({})
    }

    const result = await ingestPolymarketWalletTradesForTrackedWallets({
      wallet,
      limit: Number.isFinite(limit) ? limit : 1000,
      maxPages: Number.isFinite(maxPages) ? maxPages : 10,
      fullBackfill,
      sportsOnly: true,
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      mode,
      seed: seedResult,
      result,
    })
  } catch (error: any) {
    console.error('[Cron: Polymarket Wallets] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
