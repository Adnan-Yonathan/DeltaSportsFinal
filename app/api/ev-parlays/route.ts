import { NextResponse } from 'next/server'
import { buildEvParlays } from '@/lib/services/ev-parlays'

export const dynamic = 'force-dynamic'

const CACHE_TTL_MS = 10 * 60 * 1000
type CacheEntry = { ts: number; payload: any }
const responseCache = new Map<string, CacheEntry>()

const buildCacheKey = (maxParlayOdds: number | undefined) =>
  JSON.stringify({ maxParlayOdds: maxParlayOdds ?? null })

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const maxParlayOddsParam = url.searchParams.get('maxParlayOdds')
    const maxParlayOdds = maxParlayOddsParam
      ? Number(maxParlayOddsParam)
      : undefined
    const cacheKey = buildCacheKey(
      Number.isFinite(maxParlayOdds) ? (maxParlayOdds as number) : undefined
    )
    const cached = responseCache.get(cacheKey)
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return NextResponse.json({ ...cached.payload, cached: true })
    }

    const parlays = await buildEvParlays(
      Number.isFinite(maxParlayOdds)
        ? { maxParlayOdds: maxParlayOdds as number }
        : undefined
    )

    const payload = {
      ok: true,
      updatedAt: new Date().toISOString(),
      data: parlays,
      cached: false,
    }
    responseCache.set(cacheKey, { ts: Date.now(), payload })
    return NextResponse.json(payload)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load EV parlays.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
