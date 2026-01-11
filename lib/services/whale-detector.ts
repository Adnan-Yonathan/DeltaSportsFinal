import { decimalToAmerican } from '@/lib/utils/odds'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'
import { fetchOdds } from '@/lib/api/odds-api'
import { normalizeTeamKey } from '@/lib/identity/sport'
import type { OddsGame } from '@/lib/types/odds'

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
    yes_bid_dollars?: string
    no_bid?: number
    no_bid_dollars?: string
    yes_ask?: number
    yes_ask_dollars?: string
    no_ask?: number
    no_ask_dollars?: string
    last_price?: number | string
    last_price_dollars?: string
    previous_price?: number | string
    previous_price_dollars?: string
    volume_24h?: number
    liquidity?: number
    liquidity_dollars?: string
    open_interest?: number
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
  sharpStrength?: number
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
  const bidCents = parseNumber(isYes ? market.yes_bid : market.no_bid)
  const askCents = parseNumber(isYes ? market.yes_ask : market.no_ask)
  const bidDollars = parseNumber(
    isYes ? market.yes_bid_dollars : market.no_bid_dollars
  )
  const askDollars = parseNumber(
    isYes ? market.yes_ask_dollars : market.no_ask_dollars
  )
  if (bidCents != null && askCents != null) {
    return Math.round((bidCents + askCents) / 2)
  }
  if (bidCents != null) return Math.round(bidCents)
  if (askCents != null) return Math.round(askCents)
  if (bidDollars != null && askDollars != null) {
    return Math.round((bidDollars + askDollars) * 50)
  }
  if (bidDollars != null) return Math.round(bidDollars * 100)
  if (askDollars != null) return Math.round(askDollars * 100)
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

  const sliced = combined.slice(0, limit)
  try {
    return await enrichWhaleTradesWithStrength(sliced)
  } catch (error) {
    console.warn('[WHALER] Failed to enrich sharp strength:', error)
    return sliced
  }
}

type ParsedTeams = { home: string; away: string }

type KalshiMarketSnapshot = {
  yesPriceCents: number | null
  noPriceCents: number | null
  previousPriceCents: number | null
  volume24h: number | null
  liquidityDollars: number | null
  openInterest: number | null
  yesSpreadCents: number | null
  noSpreadCents: number | null
}

type KalshiOrderbookSnapshot = {
  yesDepth: number
  noDepth: number
}

type KalshiRecentTradeStats = {
  totalCount: number
  yesCount: number
  noCount: number
  averageYesPrice: number | null
  averageNoPrice: number | null
}

const SPORT_TO_ODDS_KEY: Record<string, string> = {
  NBA: 'basketball_nba',
  WNBA: 'basketball_wnba',
  NCAAB: 'basketball_ncaab',
  NFL: 'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
}

const cleanTeamLabel = (value: string) => value.split(':')[0]?.trim() ?? ''

const parseTeamsFromTitle = (title: string): ParsedTeams | null => {
  const match = title.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i)
  if (match.length !== 2) return null
  const first = cleanTeamLabel(match[0]?.trim() ?? '')
  const second = cleanTeamLabel(match[1]?.trim() ?? '')
  if (!first || !second) return null
  return { away: first, home: second }
}

const extractSignedLine = (text?: string | null) => {
  if (!text) return null
  const match = text.match(/([+-]?\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const resolveMarketType = (trade: WhaleTrade) => {
  const combined = `${trade.outcome} ${trade.marketTitle}`.toLowerCase()
  if (combined.includes('total') || combined.includes('over') || combined.includes('under')) {
    return 'totals'
  }
  if (combined.includes('spread') || /[+-]\d/.test(combined)) {
    return 'spreads'
  }
  if (
    combined.includes('moneyline') ||
    combined.includes('to win') ||
    combined.includes('winner')
  ) {
    return 'h2h'
  }
  return 'h2h'
}

const resolveTotalSide = (trade: WhaleTrade): 'over' | 'under' | null => {
  const combined = `${trade.outcome} ${trade.marketTitle}`.toLowerCase()
  if (combined.includes('over')) return 'over'
  if (combined.includes('under')) return 'under'
  return null
}

const resolveSelectionTeam = (trade: WhaleTrade, teams: ParsedTeams | null) => {
  if (!teams) return null
  const outcomeKey = normalizeTeamKey(trade.outcome)
  const homeKey = normalizeTeamKey(teams.home)
  const awayKey = normalizeTeamKey(teams.away)
  if (outcomeKey && homeKey && (outcomeKey === homeKey || outcomeKey.includes(homeKey))) {
    return teams.home
  }
  if (outcomeKey && awayKey && (outcomeKey === awayKey || outcomeKey.includes(awayKey))) {
    return teams.away
  }
  return null
}

const scoreFromRatio = (ratio: number) => {
  if (ratio < 1.5) return 0.2
  if (ratio < 2.5) return 0.5
  if (ratio < 4) return 0.8
  return 1
}

const scoreFromMove = (move: number) => {
  const absMove = Math.abs(move)
  if (absMove < 1) return 0.2
  if (absMove < 2.5) return 0.5
  if (absMove < 5) return 0.8
  return 1
}

const resolveLiquidityScore = (
  liquidityDollars: number | null,
  openInterest: number | null,
  spreadCents: number | null
) => {
  let score = 0.3
  if ((liquidityDollars ?? 0) >= 20000 || (openInterest ?? 0) >= 10000) {
    score = 1
  } else if ((liquidityDollars ?? 0) >= 10000 || (openInterest ?? 0) >= 5000) {
    score = 0.8
  } else if ((liquidityDollars ?? 0) >= 5000 || (openInterest ?? 0) >= 2000) {
    score = 0.5
  } else if ((liquidityDollars ?? 0) > 0 || (openInterest ?? 0) > 0) {
    score = 0.2
  }
  if (spreadCents != null && spreadCents > 6) {
    score = Math.min(score, 0.4)
  }
  return score
}

const resolveBookPressureScore = (
  side: 'yes' | 'no',
  orderbook: KalshiOrderbookSnapshot | null
) => {
  if (!orderbook) return 0.3
  const yesDepth = orderbook.yesDepth || 0
  const noDepth = orderbook.noDepth || 0
  const ratio =
    side === 'yes'
      ? yesDepth / Math.max(1, noDepth)
      : noDepth / Math.max(1, yesDepth)
  if (ratio < 1.2) return 0.2
  if (ratio < 1.6) return 0.5
  if (ratio < 2.5) return 0.8
  return 1
}

const resolveRecentTradeStats = (trades: KalshiTrade[]) => {
  let totalCount = 0
  let yesCount = 0
  let noCount = 0
  let yesPriceSum = 0
  let noPriceSum = 0

  for (const trade of trades) {
    const count = Number(trade.count) || 0
    totalCount += count
    if (trade.taker_side === 'yes') {
      yesCount += count
      const price = resolveKalshiPriceCents(trade)
      if (price != null) yesPriceSum += price * count
    } else if (trade.taker_side === 'no') {
      noCount += count
      const price = resolveKalshiPriceCents(trade)
      if (price != null) noPriceSum += price * count
    }
  }

  const averageYesPrice = yesCount > 0 ? yesPriceSum / yesCount : null
  const averageNoPrice = noCount > 0 ? noPriceSum / noCount : null

  return { totalCount, yesCount, noCount, averageYesPrice, averageNoPrice }
}

const fetchKalshiMarketSnapshot = async (
  ticker: string
): Promise<KalshiMarketSnapshot | null> => {
  const res = await fetch(`${KALSHI_BASE}/markets/${ticker}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as KalshiMarketResponse
  const market = data.market
  if (!market) return null
  const yesPriceCents = resolveKalshiSidePrice(market, 'yes')
  const noPriceCents = resolveKalshiSidePrice(market, 'no')
  const previous = parseNumber(market.previous_price_dollars ?? market.previous_price)
  const previousPriceCents = previous != null ? Math.round(previous * 100) : null
  const volume24h = parseNumber(market.volume_24h)
  const liquidity = parseNumber(market.liquidity_dollars ?? market.liquidity)
  const openInterest = parseNumber(market.open_interest)
  const yesBid = parseNumber(market.yes_bid_dollars ?? market.yes_bid)
  const yesAsk = parseNumber(market.yes_ask_dollars ?? market.yes_ask)
  const noBid = parseNumber(market.no_bid_dollars ?? market.no_bid)
  const noAsk = parseNumber(market.no_ask_dollars ?? market.no_ask)
  const yesSpreadCents =
    yesBid != null && yesAsk != null
      ? Math.round(Math.abs(yesAsk - yesBid) * (yesBid < 1 ? 100 : 1))
      : null
  const noSpreadCents =
    noBid != null && noAsk != null
      ? Math.round(Math.abs(noAsk - noBid) * (noBid < 1 ? 100 : 1))
      : null
  return {
    yesPriceCents,
    noPriceCents,
    previousPriceCents,
    volume24h,
    liquidityDollars: liquidity,
    openInterest,
    yesSpreadCents,
    noSpreadCents,
  }
}

const fetchKalshiOrderbook = async (ticker: string): Promise<KalshiOrderbookSnapshot | null> => {
  const url = new URL(`${KALSHI_BASE}/markets/${ticker}/orderbook`)
  url.searchParams.set('depth', '5')
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as { orderbook?: { yes?: number[][]; no?: number[][] } }
  const yes = Array.isArray(data.orderbook?.yes) ? data.orderbook?.yes ?? [] : []
  const no = Array.isArray(data.orderbook?.no) ? data.orderbook?.no ?? [] : []
  const sumDepth = (levels: number[][]) =>
    levels.reduce((sum, level) => sum + (Number(level?.[1]) || 0), 0)
  return {
    yesDepth: sumDepth(yes),
    noDepth: sumDepth(no),
  }
}

const fetchKalshiRecentTrades = async (ticker: string, sinceTs: number) => {
  const url = new URL(`${KALSHI_BASE}/markets/trades`)
  url.searchParams.set('ticker', ticker)
  url.searchParams.set('limit', '200')
  url.searchParams.set('min_ts', String(Math.floor(sinceTs / 1000)))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as KalshiTrade[]
  const data = (await res.json()) as KalshiTradesResponse
  return Array.isArray(data.trades) ? data.trades : []
}

const findMatchingGame = (games: OddsGame[], teams: ParsedTeams | null) => {
  if (!teams) return null
  const homeKey = normalizeTeamKey(teams.home)
  const awayKey = normalizeTeamKey(teams.away)
  if (!homeKey || !awayKey) return null
  return (
    games.find((game) => {
      const gHome = normalizeTeamKey(game.home_team)
      const gAway = normalizeTeamKey(game.away_team)
      return (
        (gHome.includes(homeKey) && gAway.includes(awayKey)) ||
        (gHome.includes(awayKey) && gAway.includes(homeKey))
      )
    }) ?? null
  )
}

const findBestOdds = (
  game: OddsGame,
  marketKey: string,
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number }
) => {
  let bestOdds: number | null = null
  let bestLineDiff = Number.POSITIVE_INFINITY

  for (const book of game.bookmakers || []) {
    const market = book.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    for (const outcome of market.outcomes || []) {
      const price = Number(outcome.price)
      if (!Number.isFinite(price)) continue
      if (marketKey === 'h2h') {
        if (selection.team && normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) {
          if (bestOdds == null || price > bestOdds) bestOdds = price
        }
        continue
      }
      if (marketKey === 'totals') {
        if (!selection.totalSide) continue
        const isOver = outcome.name.toLowerCase().includes('over')
        const isUnder = outcome.name.toLowerCase().includes('under')
        if ((selection.totalSide === 'over' && !isOver) || (selection.totalSide === 'under' && !isUnder)) {
          continue
        }
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = selection.line != null ? Math.abs(line - selection.line) : 0
        if (lineDiff < bestLineDiff || (lineDiff === bestLineDiff && (bestOdds == null || price > bestOdds))) {
          bestLineDiff = lineDiff
          bestOdds = price
        }
        continue
      }
      if (marketKey === 'spreads') {
        if (!selection.team) continue
        if (!normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) continue
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = selection.line != null ? Math.abs(line - selection.line) : 0
        if (lineDiff < bestLineDiff || (lineDiff === bestLineDiff && (bestOdds == null || price > bestOdds))) {
          bestLineDiff = lineDiff
          bestOdds = price
        }
      }
    }
  }

  return bestOdds
}

const resolveSportsbookProbability = (
  trade: WhaleTrade,
  oddsCache: Map<string, OddsGame[]>
) => {
  const sportKey = SPORT_TO_ODDS_KEY[trade.sport]
  if (!sportKey) return null
  const games = oddsCache.get(sportKey)
  if (!games || games.length === 0) return null
  const teams = parseTeamsFromTitle(trade.marketTitle)
  const game = findMatchingGame(games, teams)
  if (!game) return null

  const marketKey = resolveMarketType(trade)
  const selection = {
    team: resolveSelectionTeam(trade, teams) || undefined,
    totalSide: resolveTotalSide(trade) || undefined,
    line: extractSignedLine(trade.outcome) ?? extractSignedLine(trade.marketTitle) ?? undefined,
  }

  const bestOdds = findBestOdds(game, marketKey, selection)
  if (!Number.isFinite(bestOdds)) return null
  return oddsToImpliedProbability(bestOdds as number)
}

const buildSportsbookOddsCache = async (trades: WhaleTrade[]) => {
  const sportKeys = Array.from(
    new Set(trades.map((trade) => SPORT_TO_ODDS_KEY[trade.sport]).filter(Boolean))
  ) as string[]
  const cache = new Map<string, OddsGame[]>()
  await Promise.all(
    sportKeys.map(async (sportKey) => {
      try {
        const games = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], {
          live: true,
        })
        cache.set(sportKey, games)
      } catch (error) {
        console.warn('[WHALER] Failed to fetch sportsbook odds:', error)
      }
    })
  )
  return cache
}

const computeStrengthScore = (opts: {
  trade: WhaleTrade
  side: 'yes' | 'no'
  market: KalshiMarketSnapshot | null
  orderbook: KalshiOrderbookSnapshot | null
  recentTrades: KalshiRecentTradeStats | null
  sportsbookProb: number | null
}) => {
  const { trade, side, market, orderbook, recentTrades, sportsbookProb } = opts

  const avgPer30 =
    market?.volume24h && market.volume24h > 0 ? market.volume24h / 48 : null
  const recentCount = recentTrades?.totalCount ?? 0
  const ratio = avgPer30 ? recentCount / avgPer30 : 1
  let bigBets = scoreFromRatio(ratio)
  const sideCount = side === 'yes' ? recentTrades?.yesCount ?? 0 : recentTrades?.noCount ?? 0
  if (sideCount < 3) bigBets = Math.min(bigBets, 0.6)

  const currentPrice =
    side === 'yes' ? market?.yesPriceCents ?? trade.priceCents : market?.noPriceCents ?? trade.priceCents
  const recentAvg =
    side === 'yes' ? recentTrades?.averageYesPrice : recentTrades?.averageNoPrice
  const fallbackPrev = market?.previousPriceCents
  const baseline = recentAvg ?? fallbackPrev ?? trade.priceCents
  const move = currentPrice != null && baseline != null ? currentPrice - baseline : 0
  let momentum = scoreFromMove(move)
  if (move > 0) momentum = Math.min(1, momentum + 0.1)

  const bookPressure = resolveBookPressureScore(side, orderbook)
  const liquidity = resolveLiquidityScore(
    market?.liquidityDollars ?? null,
    market?.openInterest ?? null,
    side === 'yes' ? market?.yesSpreadCents ?? null : market?.noSpreadCents ?? null
  )

  let rlm = 0.2
  if (recentTrades && recentTrades.totalCount >= 5) {
    const imbalance =
      (sideCount - (recentTrades.totalCount - sideCount)) / recentTrades.totalCount
    if (Math.abs(move) >= 2 && imbalance <= -0.15) {
      rlm = 1
    } else if (Math.abs(move) >= 1 && imbalance <= -0.1) {
      rlm = 0.6
    }
  }

  const baseScore =
    80 *
    (0.3 * bigBets +
      0.25 * momentum +
      0.2 * bookPressure +
      0.15 * liquidity +
      0.1 * rlm)

  let boost = 0
  if (currentPrice != null && sportsbookProb != null) {
    const kalshiProb = currentPrice / 100
    const diff = Math.abs(kalshiProb - sportsbookProb) * 100
    if (diff >= 10) boost = 20
    else if (diff >= 7) boost = 16
    else if (diff >= 4) boost = 12
    else if (diff >= 2) boost = 8
    else if (diff >= 1) boost = 4
  }

  return Math.max(0, Math.min(100, Math.round(baseScore + boost)))
}

const enrichWhaleTradesWithStrength = async (trades: WhaleTrade[]) => {
  const oddsCache = await buildSportsbookOddsCache(trades)
  const kalshiTrades = trades.filter(
    (trade) => trade.source === 'kalshi' && trade.ticker
  ) as (WhaleTrade & { ticker: string })[]

  const marketCache = new Map<string, KalshiMarketSnapshot | null>()
  const orderbookCache = new Map<string, KalshiOrderbookSnapshot | null>()
  const recentTradeCache = new Map<string, KalshiRecentTradeStats | null>()
  const now = Date.now()

  await Promise.all(
    Array.from(new Set(kalshiTrades.map((trade) => trade.ticker))).map(
      async (ticker) => {
        const [market, orderbook, recentTrades] = await Promise.all([
          fetchKalshiMarketSnapshot(ticker),
          fetchKalshiOrderbook(ticker),
          fetchKalshiRecentTrades(ticker, now - 30 * 60 * 1000),
        ])
        marketCache.set(ticker, market)
        orderbookCache.set(ticker, orderbook)
        recentTradeCache.set(ticker, resolveRecentTradeStats(recentTrades))
      }
    )
  )

  return trades.map((trade) => {
    const sportsbookProb = resolveSportsbookProbability(trade, oddsCache)
    if (trade.source === 'kalshi' && trade.ticker) {
      const side = (trade.side ?? 'yes') as 'yes' | 'no'
      const market = marketCache.get(trade.ticker) ?? null
      const orderbook = orderbookCache.get(trade.ticker) ?? null
      const recentTrades = recentTradeCache.get(trade.ticker) ?? null
      const strength = computeStrengthScore({
        trade,
        side,
        market,
        orderbook,
        recentTrades,
        sportsbookProb,
      })
      return { ...trade, sharpStrength: strength }
    }
    if (trade.source === 'polymarket') {
      const notional = trade.notional
      let base = 0.35
      if (notional >= 10000) base = 0.9
      else if (notional >= 5000) base = 0.7
      else if (notional >= 3000) base = 0.5
      const baseScore = 80 * (0.3 * base + 0.25 * 0.35 + 0.2 * 0.35 + 0.15 * 0.35 + 0.1 * 0.35)
      let boost = 0
      if (trade.priceCents && sportsbookProb != null) {
        const diff = Math.abs(trade.priceCents / 100 - sportsbookProb) * 100
        if (diff >= 10) boost = 20
        else if (diff >= 7) boost = 16
        else if (diff >= 4) boost = 12
        else if (diff >= 2) boost = 8
        else if (diff >= 1) boost = 4
      }
      const strength = Math.max(0, Math.min(100, Math.round(baseScore + boost)))
      return { ...trade, sharpStrength: strength }
    }
    return trade
  })
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
