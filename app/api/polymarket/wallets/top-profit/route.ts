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
  pnl_prev_day: number
  top_sports: Array<{
    sport: string
    pnl: number
    trades: number
  }>
  arb_score_7d: number
  arb_label_7d: 'likely_arb' | 'possible_arb' | 'likely_directional'
  arb_reasons_7d: string[]
  trade_count_7d: number
  win_rate_7d: number | null
  avg_pnl_7d: number | null
  pnl_stddev_7d: number | null
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

const resolveSportKey = (trade: { slug?: string | null; eventSlug?: string | null; title?: string | null }) => {
  const slug = (trade.eventSlug ?? trade.slug ?? '').toLowerCase()
  const prefix = slug.split('-')[0]
  if (prefix) {
    if (prefix === 'cfb') return 'ncaaf'
    if (prefix === 'cbb') return 'ncaab'
    return prefix
  }
  const title = (trade.title ?? '').toLowerCase()
  const titlePrefix = title.split(' ')[0]
  if (!titlePrefix) return null
  if (titlePrefix === 'cfb') return 'ncaaf'
  if (titlePrefix === 'cbb') return 'ncaab'
  return titlePrefix
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

const computeArbProfile7d = (closedPositions: ClosedPositionRow[]) => {
  const now = Date.now()
  const startTs = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000)
  const recent = closedPositions.filter((row) => row.timestamp && row.timestamp >= startTs)
  const tradeCount = recent.length
  if (tradeCount === 0) {
    return {
      tradeCount,
      winRate: null,
      avgPnl: null,
      stddev: null,
      score: 0,
      label: 'likely_directional' as const,
      reasons: [] as string[],
    }
  }

  let wins = 0
  let losses = 0
  let total = 0
  let absTotal = 0
  const pnls: number[] = []

  for (const row of recent) {
    const realized = Number(row.realizedPnl ?? 0)
    total += realized
    absTotal += Math.abs(realized)
    pnls.push(realized)
    if (realized > 0) wins += 1
    if (realized < 0) losses += 1
  }

  const count = wins + losses
  const winRate = count > 0 ? wins / count : null
  const avgPnl = total / tradeCount
  const avgAbs = absTotal / tradeCount
  const mean = avgPnl
  const variance = pnls.reduce((sum, pnl) => sum + Math.pow(pnl - mean, 2), 0) / tradeCount
  const stddev = Math.sqrt(variance)

  let score = 0
  const reasons: string[] = []

  if (tradeCount >= 12) {
    score += 20
    reasons.push('High trade count (7d)')
  }
  if (tradeCount >= 25) score += 10
  if (winRate != null && winRate >= 0.85) {
    score += 25
    reasons.push('Very high win rate')
  }
  if (winRate != null && winRate >= 0.92) score += 10
  if (avgAbs <= 25) {
    score += 20
    reasons.push('Small avg profit per trade')
  }
  if (avgAbs <= 15) score += 10
  if (stddev <= 60) {
    score += 15
    reasons.push('Low P/L volatility')
  }
  if (stddev <= 30) score += 5
  if (Math.abs(total) <= 1500) {
    score += 10
    reasons.push('Low total P/L for volume')
  }

  const normalizedScore = Math.min(100, Math.max(0, Math.round(score)))
  const label =
    normalizedScore >= 80 ? 'likely_arb' : normalizedScore >= 60 ? 'possible_arb' : 'likely_directional'

  return {
    tradeCount,
    winRate,
    avgPnl: Number(avgPnl.toFixed(2)),
    stddev: Number(stddev.toFixed(2)),
    score: normalizedScore,
    label,
    reasons: reasons.slice(0, 3),
  }
}

const computeTopSports = (positions: PositionRow[]) => {
  const totals = new Map<string, { pnl: number; trades: number }>()

  for (const position of positions) {
    if (!isSportsTrade(position)) continue
    const sportKey = resolveSportKey(position)
    if (!sportKey) continue
    const cash = Number(position.cashPnl ?? 0)
    const realized = Number(position.realizedPnl ?? 0)
    const pnl = cash + realized
    const entry = totals.get(sportKey) ?? { pnl: 0, trades: 0 }
    entry.pnl += Number.isFinite(pnl) ? pnl : 0
    entry.trades += 1
    totals.set(sportKey, entry)
  }

  return Array.from(totals.entries())
    .map(([sport, data]) => ({
      sport,
      pnl: Number(data.pnl.toFixed(2)),
      trades: data.trades,
    }))
    .sort((a, b) => b.pnl - a.pnl)
    .slice(0, 3)
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
  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)
  const startPrevDay = new Date(startOfToday)
  startPrevDay.setDate(startPrevDay.getDate() - 1)
  const startPrevDayTs = Math.floor(startPrevDay.getTime() / 1000)
  const startTodayTs = Math.floor(startOfToday.getTime() / 1000)

  const walletStatsResults = await asyncPool(4, wallets, async (wallet) => {
    try {
      const [positions, closedPositions] = await Promise.all([
        fetchPositions(wallet),
        fetchClosedPositions(wallet),
      ])

      let totalPnl = 0
      let pnl30d = 0
      let pnlPrevDay = 0
      const openTrades = positions.filter((row) => isSportsTrade(row))
      const topSports = computeTopSports(positions)
      const arbProfile = computeArbProfile7d(closedPositions)

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
        if (row.timestamp && row.timestamp >= startPrevDayTs && row.timestamp < startTodayTs) {
          pnlPrevDay += realized
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
        pnl_prev_day: Number(pnlPrevDay.toFixed(2)),
        top_sports: topSports,
        arb_score_7d: arbProfile.score,
        arb_label_7d: arbProfile.label,
        arb_reasons_7d: arbProfile.reasons,
        trade_count_7d: arbProfile.tradeCount,
        win_rate_7d: arbProfile.winRate != null ? Number(arbProfile.winRate.toFixed(3)) : null,
        avg_pnl_7d: arbProfile.avgPnl,
        pnl_stddev_7d: arbProfile.stddev,
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
