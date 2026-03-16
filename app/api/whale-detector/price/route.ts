import { NextResponse } from 'next/server'
import { KALSHI_BASE_CANDIDATES, withKalshiBase } from '@/lib/api/kalshi-base'

const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'

type KalshiMarketResponse = {
  market?: {
    yes_bid?: number
    yes_ask?: number
    yes_bid_dollars?: string
    yes_ask_dollars?: string
    no_bid?: number
    no_ask?: number
    no_bid_dollars?: string
    no_ask_dollars?: string
    last_price?: number
    last_price_dollars?: string
  }
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const resolveKalshiSidePrice = (
  market: KalshiMarketResponse['market'],
  side: string
) => {
  if (!market) return null
  const isYes = side === 'yes'
  const bid = parseNumber(isYes ? market.yes_bid : market.no_bid)
  const ask = parseNumber(isYes ? market.yes_ask : market.no_ask)
  const bidDollars = parseNumber(isYes ? market.yes_bid_dollars : market.no_bid_dollars)
  const askDollars = parseNumber(isYes ? market.yes_ask_dollars : market.no_ask_dollars)
  if (bid != null && ask != null) {
    return Math.round((bid + ask) / 2)
  }
  if (bid != null) return Math.round(bid)
  if (ask != null) return Math.round(ask)
  if (bidDollars != null && askDollars != null) {
    return Math.round((bidDollars + askDollars) * 50)
  }
  if (bidDollars != null) return Math.round(bidDollars * 100)
  if (askDollars != null) return Math.round(askDollars * 100)
  const last = parseNumber(market.last_price_dollars ?? market.last_price)
  if (last == null) return null
  if (last <= 1) {
    const yesPrice = Math.round(last * 100)
    return isYes ? yesPrice : 100 - yesPrice
  }
  if (isYes) return Math.round(last)
  return Math.round(100 - last)
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

const resolvePolymarketOutcomePrice = async (
  slug: string,
  outcomeIndex: number
) => {
  const url = new URL(`${POLYMARKET_GAMMA}/markets`)
  url.searchParams.set('slug', slug)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const markets = Array.isArray(data?.value)
    ? data.value
    : Array.isArray(data)
      ? data
      : []
  const market = markets[0] ?? null
  if (!market?.outcomePrices) return null
  let prices: string[] = []
  try {
    prices = JSON.parse(market.outcomePrices)
  } catch {
    prices = []
  }
  const price = parseNumber(prices[outcomeIndex])
  if (price == null) return null
  return Math.round(price * 100)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const source = searchParams.get('source')
  if (source === 'kalshi') {
    const ticker = searchParams.get('ticker')
    const side = searchParams.get('side') || 'yes'
    if (!ticker) {
      return NextResponse.json({ error: 'Missing ticker' }, { status: 400 })
    }
    const data = await fetchKalshiMarket(ticker)
    if (!data) {
      return NextResponse.json({ error: 'Market fetch failed' }, { status: 502 })
    }
    const priceCents = resolveKalshiSidePrice(data.market, side)
    return NextResponse.json({ priceCents })
  }

  if (source === 'polymarket') {
    const slug = searchParams.get('slug')
    const outcomeIndex = Number(searchParams.get('outcomeIndex'))
    if (!slug || !Number.isFinite(outcomeIndex)) {
      return NextResponse.json(
        { error: 'Missing slug or outcomeIndex' },
        { status: 400 }
      )
    }
    const priceCents = await resolvePolymarketOutcomePrice(slug, outcomeIndex)
    return NextResponse.json({ priceCents })
  }

  return NextResponse.json({ error: 'Unsupported source' }, { status: 400 })
}
