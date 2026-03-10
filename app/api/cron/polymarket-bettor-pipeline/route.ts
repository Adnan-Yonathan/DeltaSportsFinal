import { NextRequest, NextResponse } from 'next/server'
import { discoverPolymarketSportsBettors, ingestPolymarketWalletTradesForTrackedWallets } from '@/lib/services/polymarket-wallet-ingest'
import { computePolymarketWalletRollups } from '@/lib/services/polymarket-wallet-rollups'

export const dynamic = 'force-dynamic'

const parseNumber = (value: string | null, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * GET /api/cron/polymarket-bettor-pipeline
 * Runs the bettor feed pipeline in-order:
 *   1) Discover sports bettors
 *   2) Ingest tracked wallet trades
 *   3) Compute wallet rollups
 */
export async function GET(req: NextRequest) {
  const startedAt = Date.now()
  let stage: 'discover' | 'ingest' | 'rollups' = 'discover'

  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const discoverLimit = parseNumber(searchParams.get('discoverLimit'), 500)
    const discoverMaxPages = parseNumber(searchParams.get('discoverMaxPages'), 5)
    const ingestLimit = parseNumber(searchParams.get('ingestLimit'), 1000)
    const ingestMaxPages = parseNumber(searchParams.get('ingestMaxPages'), 10)
    const mode = searchParams.get('mode') ?? 'incremental'
    const wallet = searchParams.get('wallet') ?? undefined

    stage = 'discover'
    const discover = await discoverPolymarketSportsBettors({
      limit: discoverLimit,
      maxPages: discoverMaxPages,
    })

    stage = 'ingest'
    const ingest = await ingestPolymarketWalletTradesForTrackedWallets({
      wallet,
      limit: ingestLimit,
      maxPages: ingestMaxPages,
      fullBackfill: mode === 'backfill',
      sportsOnly: true,
    })

    stage = 'rollups'
    const rollups = await computePolymarketWalletRollups({ wallet })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      mode,
      discover,
      ingest,
      rollups,
    })
  } catch (error: any) {
    console.error('[Cron: Polymarket Bettor Pipeline] Fatal error:', error)
    return NextResponse.json(
      {
        ok: false,
        stage,
        error: error?.message ?? 'Unknown error',
      },
      { status: 500 }
    )
  }
}
