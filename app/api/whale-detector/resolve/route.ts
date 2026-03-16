import { NextResponse } from 'next/server'
import { KALSHI_BASE_CANDIDATES, withKalshiBase } from '@/lib/api/kalshi-base'

const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'

type KalshiMarketResponse = {
  market?: {
    status?: string
    result?: string
    settlement_value?: number
  }
}

const normalizeOutcome = (value: string) =>
  value.trim().toLowerCase().replace(/\s+/g, ' ')

const resolveKalshiOutcome = (market?: KalshiMarketResponse['market']) => {
  if (!market) return null
  if (market.result) return normalizeOutcome(String(market.result))
  if (Number.isFinite(market.settlement_value)) {
    const settlement = Number(market.settlement_value)
    if (settlement >= 1) return 'yes'
    if (settlement <= 0) return 'no'
  }
  return null
}

const resolvePolymarketOutcome = (market: any) => {
  if (!market?.resolved) return null
  if (market.winningOutcome) {
    return normalizeOutcome(String(market.winningOutcome))
  }
  if (market.winningOutcomeIndex != null && Array.isArray(market.outcomes)) {
    const outcome = market.outcomes[Number(market.winningOutcomeIndex)]
    if (outcome) return normalizeOutcome(String(outcome))
  }
  return null
}

const fetchKalshiMarket = async (ticker: string) => {
  for (const base of KALSHI_BASE_CANDIDATES) {
    try {
      const res = await fetch(withKalshiBase(base, `/markets/${ticker}`), {
        cache: 'no-store',
      })
      if (res.ok) {
        return (await res.json()) as KalshiMarketResponse
      }
    } catch {}
  }
  return null
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')

  if (source === 'kalshi') {
    const ticker = searchParams.get('ticker')
    if (!ticker) {
      return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })
    }
    const data = await fetchKalshiMarket(ticker)
    if (!data) {
      return NextResponse.json({ error: 'Market fetch failed' }, { status: 502 })
    }
    const outcome = resolveKalshiOutcome(data.market)
    const resolved =
      data.market?.status?.toLowerCase() === 'settled' || outcome != null
    return NextResponse.json({ resolved, outcome })
  }

  if (source === 'polymarket') {
    const slug = searchParams.get('slug')
    if (!slug) {
      return NextResponse.json({ error: 'Missing slug' }, { status: 400 })
    }
    const url = new URL(`${POLYMARKET_GAMMA}/markets`)
    url.searchParams.set('slug', slug)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ error: 'Market fetch failed' }, { status: 502 })
    }
    const data = await res.json()
    const markets = Array.isArray(data?.value)
      ? data.value
      : Array.isArray(data)
        ? data
        : []
    const market = markets[0] ?? null
    const outcome = resolvePolymarketOutcome(market)
    const resolved = Boolean(market?.resolved) || outcome != null
    return NextResponse.json({ resolved, outcome })
  }

  return NextResponse.json({ error: 'Unsupported source' }, { status: 400 })
}
