import { NextResponse } from 'next/server'
import { buildEvParlays } from '@/lib/services/ev-parlays'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const maxParlayOddsParam = url.searchParams.get('maxParlayOdds')
    const maxParlayOdds = maxParlayOddsParam
      ? Number(maxParlayOddsParam)
      : undefined
    const parlays = await buildEvParlays(
      Number.isFinite(maxParlayOdds)
        ? { maxParlayOdds: maxParlayOdds as number }
        : undefined
    )

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      data: parlays,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load EV parlays.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
