import { NextRequest, NextResponse } from 'next/server'
import { refreshInsiderPositions } from '@/lib/services/insider-feed-direct'

export const dynamic = 'force-dynamic'

function resolveBatchSize(): number {
  const fromEnv = Number(process.env.INSIDER_POSITION_BATCH_SIZE ?? '')
  if (Number.isFinite(fromEnv) && fromEnv > 0) {
    return Math.floor(fromEnv)
  }
  return 200
}

/**
 * GET /api/cron/refresh-insider-positions
 *
 * Fast path: refreshes open positions from already-discovered wallets.
 * Runs more frequently than full discovery to surface pregame bets sooner.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const batchSize = resolveBatchSize()

  try {
    const result = await refreshInsiderPositions(batchSize)
    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      batchSize,
      ...result,
    })
  } catch (error: any) {
    console.error('[Cron: Insider Positions] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error?.message ?? 'unknown', durationMs: Date.now() - startedAt, batchSize },
      { status: 500 }
    )
  }
}
