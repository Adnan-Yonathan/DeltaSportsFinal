import { NextResponse } from 'next/server'
import { getSharpTradersCache, setSharpTradersCache } from '@/lib/services/polymarket-sharp-traders-cache'

const DATA_API_BASE = 'https://data-api.polymarket.com'

const DEFAULT_TRADE_LIMIT = 500
const DEFAULT_TRADE_PAGES = 10
const DEFAULT_TOP_WALLETS = 50
const DEFAULT_MIN_TRADE_SAMPLES = 5000
const FULL_CACHE_KEY = 'sharp_traders_full_v1'
const CACHE_TTL_MS = 5 * 60 * 1000

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
  'soccer-',
  'golf-',
  'ufc-',
]

const POLYMARKET_SPORT_SERIES = new Set([
  'nba',
  'wnba',
  'nfl',
  'ncaaf',
  'ncaab',
  'cfb',
  'cbb',
  'mlb',
  'nhl',
  'ufc',
  'mma',
  'boxing',
  'soccer',
  'tennis',
  'golf',
  'pga',
  'mls',
  'cricket',
  'esports',
  'racing',
  'olympics',
  'chess',
  'poker',
])

type TradeRow = {
  proxyWallet?: string
  title?: string
  slug?: string
  eventSlug?: string
  timestamp?: number
}

type PositionRow = {
  proxyWallet?: string
  title?: string
  slug?: string
  eventSlug?: string
  outcome?: string
  size?: number
  avgPrice?: number
  cashPnl?: number
  realizedPnl?: number
  curPrice?: number
  endDate?: string
}

type ClosedPositionRow = {
  realizedPnl?: number
  timestamp?: number
}

type WalletRow = {
  wallet: string
  total_pnl: number
  pnl_30d: number
  open_trades: Array<{
    title: string | null
    slug: string | null
    event_slug: string | null
    outcome: string | null
    size: number | null
    avg_price: number | null
    cash_pnl: number | null
    cur_price: number | null
    end_date: string | null
  }>
}

const fetchJson = async <T,>(url: string, timeoutMs = 20000): Promise<T> => {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      cache: 'no-store',
      headers: {
        accept: 'application/json, text/plain, */*',
        'user-agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121 Safari/537.36',
        origin: 'https://polymarket.com',
        referer: 'https://polymarket.com/',
      },
    })
    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Data API error ${res.status}: ${text}`)
    }
    return (await res.json()) as T
  } finally {
    clearTimeout(timer)
  }
}

const isSportsSlug = (value?: string | null) => {
  if (!value) return false
  return POLYMARKET_SPORT_PREFIXES.some((prefix) => value.startsWith(prefix))
}

const isSportsTrade = (trade: { slug?: string | null; eventSlug?: string | null; title?: string | null }) => {
  const slug = trade.slug ?? undefined
  const eventSlug = trade.eventSlug ?? undefined
  if (isSportsSlug(slug) || isSportsSlug(eventSlug)) return true
  const eventPrefix = eventSlug?.split('-')?.[0]?.toLowerCase()
  if (eventPrefix && POLYMARKET_SPORT_SERIES.has(eventPrefix)) return true
  const title = trade.title?.toLowerCase() ?? ''
  return POLYMARKET_SPORT_PREFIXES.some((prefix) => title.startsWith(prefix.replace('-', '')))
}

const fetchTradesPage = async (limit: number, offset: number) => {
  const url = new URL(`${DATA_API_BASE}/trades`)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  return fetchJson<TradeRow[]>(url.toString())
}

const fetchPositions = async (wallet: string) => {
  const url = new URL(`${DATA_API_BASE}/positions`)
  url.searchParams.set('user', wallet)
  url.searchParams.set('limit', '500')
  url.searchParams.set('offset', '0')
  return fetchJson<PositionRow[]>(url.toString())
}

const fetchClosedPositions = async (wallet: string) => {
  const url = new URL(`${DATA_API_BASE}/v1/closed-positions`)
  url.searchParams.set('user', wallet)
  return fetchJson<ClosedPositionRow[]>(url.toString())
}

const asyncPool = async <T, R>(
  poolLimit: number,
  array: T[],
  iteratorFn: (item: T) => Promise<R>
) => {
  const ret: Promise<R>[] = []
  const executing = new Set<Promise<void>>()

  for (const item of array) {
    const p = Promise.resolve().then(() => iteratorFn(item))
    ret.push(p)

    const e = p.then(() => undefined).finally(() => {
      executing.delete(e)
    })
    executing.add(e)

    if (executing.size >= poolLimit) {
      await Promise.race(executing)
    }
  }

  return Promise.allSettled(ret)
}

let lastPayload: { timestamp: number; data: any } | null = null

const applyOpenTradeLimit = (payload: { wallets: WalletRow[] }, limit?: number | null) => {
  if (!limit || !Number.isFinite(limit)) return payload
  return {
    ...payload,
    wallets: payload.wallets.map((wallet) => ({
      ...wallet,
      open_trades: wallet.open_trades.slice(0, limit),
    })),
  }
}

const isCacheFresh = (timestamp: string | null | undefined) => {
  if (!timestamp) return false
  const parsed = new Date(timestamp)
  if (Number.isNaN(parsed.getTime())) return false
  return Date.now() - parsed.getTime() < CACHE_TTL_MS
}

const buildPayload = async ({
  limitValue,
  pagesValue,
  topValue,
  sampleTarget,
  openTradeLimitValue,
}: {
  limitValue: number
  pagesValue: number
  topValue: number
  sampleTarget: number
  openTradeLimitValue: number | null
}) => {
  const walletSet = new Set<string>()
  let fetchedTrades = 0

  for (let page = 0; page < pagesValue; page += 1) {
    const offset = page * limitValue
    const trades = await fetchTradesPage(limitValue, offset)
    for (const trade of trades) {
      if (trade.proxyWallet) walletSet.add(trade.proxyWallet.toLowerCase())
    }
    fetchedTrades += trades.length
    if (trades.length < limitValue || fetchedTrades >= sampleTarget) break
  }

  const wallets = Array.from(walletSet)
  if (wallets.length === 0) {
    return { wallets: [] as WalletRow[], fetched_wallets: 0, sampled_trades: fetchedTrades }
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffTs = Math.floor(cutoff.getTime() / 1000)

  const walletStatsResults = await asyncPool(4, wallets, async (wallet) => {
    try {
      const [positions, closedPositions] = await Promise.all([
        fetchPositions(wallet),
        fetchClosedPositions(wallet),
      ])

      let totalPnl = 0
      let pnl30d = 0
      const openTrades = positions.filter((row) => isSportsTrade(row))

      for (const position of positions) {
        const cash = Number(position.cashPnl ?? 0)
        const realized = Number(position.realizedPnl ?? 0)
        totalPnl += cash + realized
      }

      for (const row of closedPositions) {
        const realized = Number(row.realizedPnl ?? 0)
        totalPnl += realized
        if (row.timestamp && row.timestamp >= cutoffTs) {
          pnl30d += realized
        }
      }

      const mappedTrades = openTrades.map((row) => ({
        title: row.title ?? null,
        slug: row.slug ?? null,
        event_slug: row.eventSlug ?? null,
        outcome: row.outcome ?? null,
        size: row.size ?? null,
        avg_price: row.avgPrice ?? null,
        cash_pnl: row.cashPnl ?? null,
        cur_price: row.curPrice ?? null,
        end_date: row.endDate ?? null,
      }))

      const limitedTrades = openTradeLimitValue
        ? mappedTrades.slice(0, openTradeLimitValue)
        : mappedTrades

      return {
        wallet,
        total_pnl: Number(totalPnl.toFixed(2)),
        pnl_30d: Number(pnl30d.toFixed(2)),
        open_trades: limitedTrades,
      }
    } catch {
      return null
    }
  })

  const walletStats = walletStatsResults
    .map((result) => (result.status === 'fulfilled' ? result.value : null))
    .filter(Boolean) as WalletRow[]

  const topWallets = walletStats
    .sort((a, b) => b.total_pnl - a.total_pnl)
    .slice(0, topValue)

  return {
    wallets: topWallets,
    fetched_wallets: wallets.length,
    sampled_trades: fetchedTrades,
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tradeLimit = Number(searchParams.get('tradeLimit') ?? DEFAULT_TRADE_LIMIT)
  const tradePages = Number(searchParams.get('tradePages') ?? DEFAULT_TRADE_PAGES)
  const top = Number(searchParams.get('top') ?? DEFAULT_TOP_WALLETS)
  const minTradeSamples = Number(searchParams.get('minTradeSamples') ?? DEFAULT_MIN_TRADE_SAMPLES)
  const openTradeLimitParam = searchParams.get('openTradeLimit')
  const openTradeLimit = openTradeLimitParam ? Number(openTradeLimitParam) : Number.NaN

  const limitValue = Number.isFinite(tradeLimit) ? Math.max(100, Math.min(tradeLimit, 1000)) : DEFAULT_TRADE_LIMIT
  const pagesValue = Number.isFinite(tradePages) ? Math.max(1, Math.min(tradePages, 20)) : DEFAULT_TRADE_PAGES
  const topValue = Number.isFinite(top) ? Math.max(1, Math.min(top, 100)) : DEFAULT_TOP_WALLETS
  const sampleTarget = Number.isFinite(minTradeSamples)
    ? Math.max(500, Math.min(minTradeSamples, 20000))
    : DEFAULT_MIN_TRADE_SAMPLES
  const openTradeLimitValue = Number.isFinite(openTradeLimit)
    ? Math.max(1, Math.min(openTradeLimit, 20))
    : null

  const wantsFullDefaults =
    limitValue === DEFAULT_TRADE_LIMIT &&
    pagesValue === DEFAULT_TRADE_PAGES &&
    topValue === DEFAULT_TOP_WALLETS &&
    sampleTarget === DEFAULT_MIN_TRADE_SAMPLES

  if (openTradeLimitValue || wantsFullDefaults) {
    const cached = await getSharpTradersCache(FULL_CACHE_KEY)
    if (cached && isCacheFresh(cached.fetched_at)) {
      const payload = cached.payload as { wallets: WalletRow[]; fetched_wallets: number; sampled_trades: number }
      return NextResponse.json({ ...applyOpenTradeLimit(payload, openTradeLimitValue), cached: true })
    }
  }

  const payload = await buildPayload({
    limitValue,
    pagesValue,
    topValue,
    sampleTarget,
    openTradeLimitValue,
  })

  if (!payload.wallets.length && lastPayload && Date.now() - lastPayload.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ ...lastPayload.data, cached: true })
  }

  lastPayload = { timestamp: Date.now(), data: payload }

  if (wantsFullDefaults && payload.wallets.length > 0) {
    await setSharpTradersCache(FULL_CACHE_KEY, payload)
  }

  return NextResponse.json(payload)
}
