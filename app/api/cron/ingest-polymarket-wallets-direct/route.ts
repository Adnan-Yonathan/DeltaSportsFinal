import { NextRequest, NextResponse } from 'next/server'
import {
  ingestPolymarketWalletTradesForTrackedWallets,
  upsertTrackedPolymarketWallets,
} from '@/lib/services/polymarket-wallet-ingest'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/ingest-polymarket-wallets-direct
 * Ingests trades for an explicit wallet list without relying on whale-detector seeding.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const walletParam = searchParams.get('wallet')
    const walletsParam = searchParams.get('wallets')
    const mode = searchParams.get('mode') ?? 'incremental'
    const limit = Number(searchParams.get('limit') ?? 1000)
    const maxPages = Number(searchParams.get('maxPages') ?? 10)
    const source = searchParams.get('source') ?? 'manual'
    const sportsOnly = searchParams.get('sportsOnly') !== 'false'
    const fullBackfill = mode === 'backfill'

    const requestedWallets = walletParam
      ? [walletParam]
      : walletsParam
        ? walletsParam
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean)
        : []
    const envWallets = process.env.POLYMARKET_WALLET_LIST
      ? process.env.POLYMARKET_WALLET_LIST.split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : []
    const walletList = requestedWallets.length ? requestedWallets : envWallets

    if (!walletList.length) {
      return NextResponse.json({ error: 'Missing wallets' }, { status: 400 })
    }

    const limitedWallets = walletList.slice(0, 200)
    const seedResult = await upsertTrackedPolymarketWallets({
      wallets: limitedWallets,
      source,
    })

    const result = await ingestPolymarketWalletTradesForTrackedWallets({
      wallets: seedResult.wallets,
      limit: Number.isFinite(limit) ? limit : 1000,
      maxPages: Number.isFinite(maxPages) ? maxPages : 10,
      fullBackfill,
      sportsOnly,
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      mode,
      source,
      requested: walletList.length,
      truncated: walletList.length > limitedWallets.length,
      fromEnv: requestedWallets.length === 0,
      seed: seedResult,
      result,
    })
  } catch (error: any) {
    console.error('[Cron: Polymarket Wallets Direct] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
