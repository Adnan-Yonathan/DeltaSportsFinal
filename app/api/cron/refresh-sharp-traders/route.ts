import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refresh-sharp-traders
 * Precomputes and caches sharp traders payload for the UI.
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const vercelCronHeader = req.headers.get('x-vercel-cron')
    const secretParam = req.nextUrl.searchParams.get('secret')

    const isAuthed =
      (process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`) ||
      (process.env.CRON_SECRET && secretParam === process.env.CRON_SECRET) ||
      Boolean(vercelCronHeader)

    if (!isAuthed) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL('/api/polymarket/wallets/top-profit', req.nextUrl.origin)
    url.searchParams.set('tradeLimit', '500')
    url.searchParams.set('tradePages', '12')
    url.searchParams.set('top', '75')
    url.searchParams.set('minTradeSamples', '8000')
    const res = await fetch(url.toString(), { cache: 'no-store' })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        { ok: false, error: payload?.error || 'Failed to refresh sharp traders cache.' },
        { status: res.status }
      )
    }

    return NextResponse.json({
      ok: true,
      refreshed: true,
      timestamp: new Date().toISOString(),
      cached: Boolean(payload?.cached),
      wallets: Array.isArray(payload?.wallets) ? payload.wallets.length : 0,
      fetched_wallets: payload?.fetched_wallets ?? null,
      sampled_trades: payload?.sampled_trades ?? null,
    })
  } catch (error: any) {
    console.error('[Cron: Sharp Traders] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
