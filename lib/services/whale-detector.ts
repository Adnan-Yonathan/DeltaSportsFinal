import { decimalToAmerican } from '@/lib/utils/odds'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_TRADES = 'https://data-api.polymarket.com/trades'

export const DEFAULT_LIMIT = 50
export const DEFAULT_MIN_NOTIONAL = 2000
export const RESPECT_CHECK_MS = 15 * 60 * 1000
export const RESPECT_TOLERANCE_CENTS = 2

const KALSHI_SPORT_PREFIXES = [
  'KXNBA',
  'KXNCAAMB',
  'KXNFL',
  'KXNCAAF',
  'KXNHL',
  'KXMLB',
  'KXWNBA',
]

const POLYMARKET_SPORT_PREFIXES = [
  'nba-',
  'wnba-',
  'nfl-',
  'cfb-',
  'cbb-',
  'ncaab-',
  'ncaaf-',
  'nhl-',
  'mlb-',
]

const KALSHI_SPORT_LABELS: Record<string, string> = {
  KXNBA: 'NBA',
  KXNCAAMB: 'NCAAB',
  KXNFL: 'NFL',
  KXNCAAF: 'NCAAF',
  KXNHL: 'NHL',
  KXMLB: 'MLB',
  KXWNBA: 'WNBA',
}

const POLYMARKET_SPORT_LABELS: Record<string, string> = {
  nba: 'NBA',
  wnba: 'WNBA',
  nfl: 'NFL',
  cfb: 'NCAAF',
  cbb: 'NCAAB',
  ncaab: 'NCAAB',
  ncaaf: 'NCAAF',
  nhl: 'NHL',
  mlb: 'MLB',
}

const MONTHS: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
}

type KalshiTrade = {
  trade_id: string
  ticker: string
  count: number
  created_time: string
  taker_side: 'yes' | 'no'
  yes_price?: number
  no_price?: number
  yes_price_dollars?: string
  no_price_dollars?: string
  price?: number
}

type KalshiTradesResponse = {
  trades: KalshiTrade[]
  cursor?: string
}

type KalshiMarketResponse = {
  market?: {
    ticker?: string
    title?: string
    yes_sub_title?: string
    no_sub_title?: string
    yes_bid?: number
    no_bid?: number
    yes_ask?: number
    no_ask?: number
    last_price?: number | string
  }
}

type PolymarketTrade = {
  transactionHash: string
  size: number
  price: number
  timestamp: number
  title: string
  slug: string
  eventSlug?: string
  outcome: string
  outcomeIndex?: number
  side?: string
}

export type WhaleTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  priceCents: number
  americanOdds: number | null
  notional: number
  contracts: number
  timestamp: string
  sport: string
  eventDate?: string
  ticker?: string
  slug?: string
  outcomeIndex?: number
  side?: string
}

export type WhaleTradeStatus = 'pending' | 'respected' | 'faded'

export type WhaleTradeWithStatus = WhaleTrade & {
  status: WhaleTradeStatus
  checkedAt?: string
  priceCents?: number | null
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const probabilityToAmerican = (probability: number) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return null
  }
  return decimalToAmerican(1 / probability)
}

const resolveKalshiPriceCents = (trade: KalshiTrade) => {
  if (trade.taker_side === 'yes') {
    if (Number.isFinite(trade.yes_price)) return trade.yes_price as number
    const parsed = parseNumber(trade.yes_price_dollars)
    if (parsed != null) return Math.round(parsed * 100)
  }
  if (trade.taker_side === 'no') {
    if (Number.isFinite(trade.no_price)) return trade.no_price as number
    const parsed = parseNumber(trade.no_price_dollars)
    if (parsed != null) return Math.round(parsed * 100)
  }
  const fallback = parseNumber(trade.price)
  if (fallback != null) return Math.round(fallback * 100)
  return null
}

const isKalshiSportTicker = (ticker?: string) => {
  if (!ticker) return false
  return KALSHI_SPORT_PREFIXES.some((prefix) => ticker.startsWith(prefix))
}

const isPolymarketSportSlug = (slug?: string) => {
  if (!slug) return false
  return POLYMARKET_SPORT_PREFIXES.some((prefix) => slug.startsWith(prefix))
}

const parseKalshiDate = (ticker: string) => {
  const match = ticker.match(/-(\d{2})([A-Z]{3})(\d{2})/)
  if (!match) return undefined
  const [, yy, mon, dd] = match
  const month = MONTHS[mon]
  if (!month) return undefined
  return `20${yy}-${month}-${dd}`
}

const resolveKalshiSport = (ticker: string) => {
  const key = Object.keys(KALSHI_SPORT_LABELS).find((prefix) =>
    ticker.startsWith(prefix)
  )
  return key ? KALSHI_SPORT_LABELS[key] : 'Sports'
}

const parsePolymarketSport = (slug?: string) => {
  if (!slug) return 'Sports'
  const [prefix] = slug.split('-')
  return POLYMARKET_SPORT_LABELS[prefix] ?? 'Sports'
}

const parsePolymarketDate = (slug?: string) => {
  if (!slug) return undefined
  const match = slug.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : undefined
}

const fetchKalshiMarketDetails = async (
  ticker: string,
  cache: Map<string, { title: string; yes: string; no: string }>
) => {
  const cached = cache.get(ticker)
  if (cached) return cached

  const res = await fetch(`${KALSHI_BASE}/markets/${ticker}`, {
    cache: 'no-store',
  })
  if (!res.ok) {
    return { title: ticker, yes: 'Yes', no: 'No' }
  }
  const data = (await res.json()) as KalshiMarketResponse
  const title =
    data.market?.title ||
    data.market?.yes_sub_title ||
    data.market?.no_sub_title ||
    ticker
  const yes = data.market?.yes_sub_title || 'Yes'
  const no = data.market?.no_sub_title || 'No'
  const details = { title, yes, no }
  cache.set(ticker, details)
  return details
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

const fetchKalshiPriceCents = async (ticker: string, side: string) => {
  const res = await fetch(`${KALSHI_BASE}/markets/${ticker}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  const data = (await res.json()) as KalshiMarketResponse
  return resolveKalshiSidePrice(data.market, side)
}

const fetchPolymarketPriceCents = async (slug: string, outcomeIndex: number) => {
  const url = new URL('https://gamma-api.polymarket.com/markets')
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

const fetchWhalePriceCents = async (trade: WhaleTrade) => {
  if (trade.source === 'kalshi' && trade.ticker) {
    return fetchKalshiPriceCents(trade.ticker, trade.side ?? 'yes')
  }
  if (
    trade.source === 'polymarket' &&
    trade.slug &&
    Number.isFinite(trade.outcomeIndex)
  ) {
    return fetchPolymarketPriceCents(
      trade.slug,
      trade.outcomeIndex as number
    )
  }
  return null
}

const fetchKalshiTrades = async (
  limit: number,
  minNotional: number,
  since?: string | null
) => {
  const url = new URL(`${KALSHI_BASE}/markets/trades`)
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 50), 500)))
  if (since) {
    url.searchParams.set('min_ts', since)
  }

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as WhaleTrade[]
  const data = (await res.json()) as KalshiTradesResponse
  const trades = Array.isArray(data.trades) ? data.trades : []
  const marketCache = new Map<string, { title: string; yes: string; no: string }>()

  const whales = await Promise.all(
    trades
      .filter((trade) => isKalshiSportTicker(trade.ticker))
      .map(async (trade) => {
        const priceCents = resolveKalshiPriceCents(trade)
        if (priceCents == null) return null
        const notional = Number(trade.count) * (priceCents / 100)
        if (!Number.isFinite(notional) || notional < minNotional) return null
        const probability = priceCents / 100
        const americanOdds = probabilityToAmerican(probability)
        if (americanOdds !== null && americanOdds <= -300) return null
        const marketDetails = await fetchKalshiMarketDetails(
          trade.ticker,
          marketCache
        )
        const outcomeLabel =
          trade.taker_side === 'yes' ? marketDetails.yes : marketDetails.no
        return {
          id: `kalshi:${trade.trade_id}`,
          source: 'kalshi' as const,
          marketTitle: marketDetails.title,
          outcome: outcomeLabel,
          priceCents,
          americanOdds,
          notional,
          contracts: Number(trade.count),
          timestamp: trade.created_time,
          sport: resolveKalshiSport(trade.ticker),
          eventDate: parseKalshiDate(trade.ticker),
          ticker: trade.ticker,
          side: trade.taker_side,
        }
      })
  )

  return whales.filter(Boolean) as WhaleTrade[]
}

const fetchPolymarketTrades = async (
  limit: number,
  minNotional: number
) => {
  const url = new URL(POLYMARKET_TRADES)
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 50), 300)))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as WhaleTrade[]
  const data = (await res.json()) as { value?: PolymarketTrade[] }
  const trades = Array.isArray(data.value) ? data.value : []

  return trades
    .filter((trade) => isPolymarketSportSlug(trade.eventSlug || trade.slug))
    .map((trade) => {
      const notional = Number(trade.size) * Number(trade.price)
      if (!Number.isFinite(notional) || notional < minNotional) return null
      const priceCents = Math.round(Number(trade.price) * 100)
      const probability = Number(trade.price)
      const americanOdds = probabilityToAmerican(probability)
      if (americanOdds !== null && americanOdds <= -300) return null
      return {
        id: `polymarket:${trade.transactionHash}`,
        source: 'polymarket' as const,
        marketTitle: trade.title,
        outcome: trade.outcome,
        priceCents,
        americanOdds,
        notional,
        contracts: Number(trade.size),
        timestamp: new Date(trade.timestamp * 1000).toISOString(),
        sport: parsePolymarketSport(trade.eventSlug || trade.slug),
        eventDate: parsePolymarketDate(trade.eventSlug || trade.slug),
        slug: trade.slug,
        outcomeIndex: trade.outcomeIndex ?? undefined,
        side: trade.side,
      }
    })
    .filter(Boolean) as WhaleTrade[]
}

export const fetchWhaleTrades = async (options: {
  limit?: number
  minNotional?: number
  since?: string | null
} = {}) => {
  const limit = Number.isFinite(options.limit) ? Number(options.limit) : DEFAULT_LIMIT
  const minNotional = Number.isFinite(options.minNotional)
    ? Number(options.minNotional)
    : DEFAULT_MIN_NOTIONAL

  const [kalshi, polymarket] = await Promise.all([
    fetchKalshiTrades(limit, minNotional, options.since),
    fetchPolymarketTrades(limit, minNotional),
  ])

  const combined = [...kalshi, ...polymarket].sort((a, b) => {
    const timeA = new Date(a.timestamp).getTime()
    const timeB = new Date(b.timestamp).getTime()
    return timeB - timeA
  })

  return combined.slice(0, limit)
}

export const evaluateWhaleRespect = async (
  trade: WhaleTrade,
  nowMs = Date.now()
): Promise<WhaleTradeWithStatus> => {
  const tradeTime = new Date(trade.timestamp).getTime()
  if (!Number.isFinite(tradeTime)) {
    return { ...trade, status: 'pending' }
  }
  if (tradeTime + RESPECT_CHECK_MS > nowMs) {
    return { ...trade, status: 'pending' }
  }
  const currentPrice = await fetchWhalePriceCents(trade)
  if (currentPrice == null || !Number.isFinite(currentPrice)) {
    return { ...trade, status: 'pending' }
  }
  const delta = currentPrice - trade.priceCents
  let status: WhaleTradeStatus = 'pending'
  if (delta >= RESPECT_TOLERANCE_CENTS) {
    status = 'respected'
  } else if (delta <= -RESPECT_TOLERANCE_CENTS) {
    status = 'faded'
  }
  return {
    ...trade,
    status,
    checkedAt: new Date(nowMs).toISOString(),
    priceCents: currentPrice,
  }
}
