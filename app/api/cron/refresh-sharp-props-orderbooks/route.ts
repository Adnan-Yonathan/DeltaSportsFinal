import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const EASTERN_TIME_ZONE = 'America/New_York'
const QUIET_WINDOW_START_HOUR = 1
const QUIET_WINDOW_END_HOUR = 10

const getEasternHour = (date: Date) => {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: EASTERN_TIME_ZONE,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date)
    const hourPart = parts.find((part) => part.type === 'hour')?.value
    const parsedHour = Number(hourPart)
    return Number.isFinite(parsedHour) ? parsedHour : null
  } catch {
    return null
  }
}

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

    const now = new Date()
    const easternHour = getEasternHour(now)
    const isQuietHours =
      easternHour != null &&
      easternHour >= QUIET_WINDOW_START_HOUR &&
      easternHour < QUIET_WINDOW_END_HOUR

    if (isQuietHours) {
      return NextResponse.json({
        ok: true,
        refreshed: false,
        skipped: true,
        reason: 'Quiet window active (1:00 AM-9:59 AM America/New_York).',
        timestamp: now.toISOString(),
        easternHour,
      })
    }

    const url = new URL('/api/prop-orderbooks', req.nextUrl.origin)
    url.searchParams.set('sport', 'all')
    url.searchParams.set('limit', '80')
    url.searchParams.set('depth', '8')
    url.searchParams.set('minSharpNotional', '100')

    const res = await fetch(url.toString(), { cache: 'no-store' })
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
      timestamp: now.toISOString(),
      easternHour,
      sport: payload?.sport ?? 'all',
      count: typeof payload?.count === 'number' ? payload.count : null,
      updatedAt: payload?.updatedAt ?? null,
    })
  } catch (error: any) {
    console.error('[Cron: Sharp Props Orderbooks] Fatal error:', error)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }
}
