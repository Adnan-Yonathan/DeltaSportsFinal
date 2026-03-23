import { NextRequest, NextResponse } from 'next/server'
import {
  isWithinSharpRefreshWindow,
  SHARP_REFRESH_WINDOW_LABEL,
} from '@/lib/utils/sharp-refresh-window'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/refresh-sharp-props-orderbooks
 * Prewarms sharp props orderbook cache.
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

    if (!isWithinSharpRefreshWindow()) {
      return NextResponse.json({
        ok: true,
        refreshed: false,
        skipped: true,
        reason: `Refresh window closed. Active window: ${SHARP_REFRESH_WINDOW_LABEL}.`,
        timestamp: new Date().toISOString(),
      })
    }

    const url = new URL('/api/prop-orderbooks', req.nextUrl.origin)
    url.searchParams.set('sport', 'all')
    url.searchParams.set('limit', '200')
    url.searchParams.set('depth', '8')
    url.searchParams.set('minSharpNotional', '100')
    url.searchParams.set('refresh', '1')

    const refreshHeaders: HeadersInit = {}
    if (process.env.CRON_SECRET) {
      refreshHeaders.authorization = `Bearer ${process.env.CRON_SECRET}`
      refreshHeaders['x-refresh-secret'] = process.env.CRON_SECRET
    }

    const res = await fetch(url.toString(), {
      cache: 'no-store',
      headers: refreshHeaders,
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          refreshed: false,
          error: payload?.error || 'Failed to refresh sharp props orderbooks cache.',
        },
        { status: res.status }
      )
    }

    return NextResponse.json({
      ok: true,
      refreshed: true,
      skipped: false,
      timestamp: new Date().toISOString(),
      sport: payload?.sport ?? 'all',
      count: typeof payload?.count === 'number' ? payload.count : null,
      updatedAt: payload?.updatedAt ?? null,
    })
  } catch (error: any) {
    console.error('[Cron: Sharp Props Orderbooks] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
