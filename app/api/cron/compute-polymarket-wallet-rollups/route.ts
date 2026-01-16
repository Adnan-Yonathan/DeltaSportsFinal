import { NextRequest, NextResponse } from 'next/server'
import { computePolymarketWalletRollups } from '@/lib/services/polymarket-wallet-rollups'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/compute-polymarket-wallet-rollups
 * Computes wallet record + realized P/L rollups for tracked wallets.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const wallet = searchParams.get('wallet') ?? undefined

    const result = await computePolymarketWalletRollups({ wallet })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result,
    })
  } catch (error: any) {
    console.error('[Cron: Polymarket Rollups] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
