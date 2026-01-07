import { NextResponse } from 'next/server'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'

type KalshiMarketResponse = {
  market?: {
    yes_bid?: number
    yes_ask?: number
    no_bid?: number
    no_ask?: number
    last_price?: number
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
  const bid = isYes ? market.yes_bid : market.no_bid
  const ask = isYes ? market.yes_ask : market.no_ask
  if (Number.isFinite(bid) && Number.isFinite(ask)) {
    return Math.round(((bid as number) + (ask as number)) / 2)
  }
  if (Number.isFinite(bid)) return Math.round(bid as number)
  if (Number.isFinite(ask)) return Math.round(ask as number)
  const last = parseNumber(market.last_price)
  if (last == null) return null
  if (isYes) return Math.round(last)
  return Math.round(100 - last)
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
    const res = await fetch(`${KALSHI_BASE}/markets/${ticker}`, {
      cache: 'no-store',
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Market fetch failed' }, { status: 502 })
    }
    const data = (await res.json()) as KalshiMarketResponse
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
