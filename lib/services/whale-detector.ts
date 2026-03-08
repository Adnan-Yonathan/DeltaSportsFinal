import { decimalToAmerican } from '@/lib/utils/odds'
import { oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { fetchOdds } from '@/lib/api/odds-api'
import { normalizeTeamKey } from '@/lib/identity/sport'
import type { Bookmaker, OddsGame, OddsOutcome } from '@/lib/types/odds'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_TRADES = 'https://data-api.polymarket.com/trades'

export const DEFAULT_LIMIT = 50
export const DEFAULT_MIN_NOTIONAL = 2000
export const RESPECT_CHECK_MS = 15 * 60 * 1000
export const RESPECT_TOLERANCE_CENTS = 2
const MAX_FEED_DIVERGENCE_PERCENT = 15
const SHARP_SCORE_WINDOW_MS = 30 * 1000
const SHARP_SCORE_SHORT_WINDOW_MS = 10 * 1000
const MIN_PROP_NOTIONAL = 500
const MIN_GAME_NOTIONAL = 2000
const POLYMARKET_MAX_LIMIT = 1000
const POLYMARKET_PAGE_LIMIT = 500
const POLYMARKET_MAX_PAGES = 8
const POLYMARKET_MIN_NOTIONAL_SCALE = 0.05
const POLYMARKET_MIN_NOTIONAL_FLOOR = 50
const SOURCE_BALANCE_RATIO = 0.2

const KALSHI_SPORT_PREFIXES = [
  'KXNBA',
  'KXNCAAMB',
  'KXNFL',
  'KXNCAAF',
  'KXNHL',
  'KXMLB',
  'KXWNBA',
  'KXSOCCER',
  'KXTENNIS',
  'KXGOLF',
  'KXUFC',
  'KXMMA',
  'KXBOXING',
  'KXCRICKET',
  'KXF1',
  'KXESPORTS',
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
  'soccer-',
  'tennis-',
  'mma-',
  'boxing-',
  'cricket-',
  'esports-',
  'racing-',
  'formula1-',
  'f1-',
  'nascar-',
  'olympics-',
  'chess-',
  'poker-',
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

const KALSHI_SPORT_LABELS: Record<string, string> = {
  KXNBA: 'NBA',
  KXNCAAMB: 'NCAAB',
  KXNFL: 'NFL',
  KXNCAAF: 'NCAAF',
  KXNHL: 'NHL',
  KXMLB: 'MLB',
  KXWNBA: 'WNBA',
  KXSOCCER: 'SOCCER',
  KXTENNIS: 'TENNIS',
  KXGOLF: 'GOLF',
  KXUFC: 'UFC',
  KXMMA: 'MMA',
  KXBOXING: 'BOXING',
  KXCRICKET: 'CRICKET',
  KXF1: 'F1',
  KXESPORTS: 'ESPORTS',
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
  soccer: 'SOCCER',
  tennis: 'TENNIS',
  mma: 'MMA',
  boxing: 'BOXING',
  cricket: 'CRICKET',
  esports: 'ESPORTS',
  racing: 'RACING',
  f1: 'F1',
  formula1: 'F1',
  nascar: 'RACING',
  olympics: 'OLYMPICS',
  chess: 'CHESS',
  poker: 'POKER',
  golf: 'GOLF',
  ufc: 'UFC',
}

const POLYMARKET_TAG_SPORT_LABELS: Record<string, string> = {
  atp: 'TENNIS',
  bundesliga: 'SOCCER',
  cs2: 'ESPORTS',
  epl: 'SOCCER',
  laliga: 'SOCCER',
  'la-liga': 'SOCCER',
  lig1: 'SOCCER',
  'ligue-1': 'SOCCER',
  mls: 'SOCCER',
  sea: 'SOCCER',
  seriea: 'SOCCER',
  'serie-a': 'SOCCER',
  spl: 'SOCCER',
  ucl: 'SOCCER',
  uel: 'SOCCER',
  wta: 'TENNIS',
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

const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

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
  proxyWallet?: string
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

type PolymarketEventTag = {
  slug?: string
  label?: string
}

type PolymarketEventRecord = {
  category?: string
  seriesSlug?: string
  title?: string
  series?: Array<{ slug?: string; title?: string }>
  tags?: PolymarketEventTag[]
  markets?: Array<{ sportsMarketType?: string }>
}

export type WhaleTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  proxyWallet?: string
  priceCents: number
  americanOdds: number | null
  sportsbookBestOdds?: number | null
  sportsbookBookKey?: string | null
  sportsbookBookTitle?: string | null
  sportsbookNoVigProb?: number | null
  evPercent?: number | null
  evTargetPriceCents?: number | null
  evTargetAmericanOdds?: number | null
  sharpScoreInstant?: number
  sharpScore30s?: number
  sharpScoreDirection?: 'BUY' | 'SELL'
  currentPriceCents?: number | null
  currentAmericanOdds?: number | null
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

// Ultra-sharp classification types
export type UltraSharpReasonType =
  | 'rlm'
  | 'timing'
  | 'divergence'
  | 'cluster'
  | 'cross-market-ev'
  | 'big-bet'
  | 'liquidity'

// Cluster detection configuration by sport
type ClusterConfig = {
  minBets: number           // Minimum bets in window to trigger
  windowMs: number          // Window size in ms (2 minutes)
  minHoursBeforeEvent: number | null  // Minimum hours before event (null = no requirement)
}

const CLUSTER_CONFIG: Record<string, ClusterConfig> = {
  NBA: { minBets: 5, windowMs: 10 * 60 * 1000, minHoursBeforeEvent: 4 },
  NFL: { minBets: 5, windowMs: 10 * 60 * 1000, minHoursBeforeEvent: 72 }, // 3 days
  NCAAB: { minBets: 3, windowMs: 10 * 60 * 1000, minHoursBeforeEvent: null },
  NHL: { minBets: 3, windowMs: 10 * 60 * 1000, minHoursBeforeEvent: null },
}

const DEFAULT_CLUSTER_CONFIG: ClusterConfig = {
  minBets: 5,
  windowMs: 10 * 60 * 1000,
  minHoursBeforeEvent: null,
}

const getClusterConfig = (sport: string): ClusterConfig => {
  return CLUSTER_CONFIG[sport] ?? DEFAULT_CLUSTER_CONFIG
}

export type UltraSharpReason = {
  type: UltraSharpReasonType
  description: string
  value?: number
}

export type SportContext = {
  sport: string
  isProSport: boolean
  isTeamSport: boolean
  minimumStrength: number
  rlmThreshold: number
  moveThreshold: number
}

export type UltraSharpTrade = WhaleTrade & {
  isUltraSharp: boolean
  ultraSharpReasons: UltraSharpReason[]
  sportContext: SportContext | null
  timingScore?: number
  rlmScore?: number
  divergencePercent?: number | null
  crossMarketEvPercent?: number | null
}

// Sport-specific context configuration
const SPORT_CONTEXTS: Record<string, SportContext> = {
  NBA: { sport: 'NBA', isProSport: true, isTeamSport: true, minimumStrength: 68, rlmThreshold: -0.10, moveThreshold: 1.5 },
  NFL: { sport: 'NFL', isProSport: true, isTeamSport: true, minimumStrength: 70, rlmThreshold: -0.10, moveThreshold: 1.5 },
  MLB: { sport: 'MLB', isProSport: true, isTeamSport: true, minimumStrength: 65, rlmThreshold: -0.10, moveThreshold: 1.5 },
  NHL: { sport: 'NHL', isProSport: true, isTeamSport: true, minimumStrength: 68, rlmThreshold: -0.10, moveThreshold: 1.5 },
  NCAAB: { sport: 'NCAAB', isProSport: false, isTeamSport: true, minimumStrength: 72, rlmThreshold: -0.15, moveThreshold: 2.0 },
  NCAAF: { sport: 'NCAAF', isProSport: false, isTeamSport: true, minimumStrength: 72, rlmThreshold: -0.15, moveThreshold: 2.0 },
  UFC: { sport: 'UFC', isProSport: true, isTeamSport: false, minimumStrength: 65, rlmThreshold: -0.10, moveThreshold: 1.5 },
  GOLF: { sport: 'GOLF', isProSport: true, isTeamSport: false, minimumStrength: 60, rlmThreshold: -0.10, moveThreshold: 1.5 },
  WNBA: { sport: 'WNBA', isProSport: true, isTeamSport: true, minimumStrength: 65, rlmThreshold: -0.10, moveThreshold: 1.5 },
  SOCCER: { sport: 'SOCCER', isProSport: true, isTeamSport: true, minimumStrength: 65, rlmThreshold: -0.10, moveThreshold: 1.5 },
}

const DEFAULT_SPORT_CONTEXT: SportContext = {
  sport: 'Sports',
  isProSport: true,
  isTeamSport: true,
  minimumStrength: 68,
  rlmThreshold: -0.10,
  moveThreshold: 1.5,
}

const getSportContext = (sport: string): SportContext => {
  return SPORT_CONTEXTS[sport] ?? DEFAULT_SPORT_CONTEXT
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const normalizePriceCents = (value: number) => {
  if (!Number.isFinite(value)) return null
  if (value <= 1) return Math.round(value * 100)
  return Math.round(value)
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

const probabilityToAmerican = (probability: number) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return null
  }
  return decimalToAmerican(1 / probability)
}

const centsToAmerican = (priceCents?: number | null) => {
  if (!Number.isFinite(priceCents)) return null
  const probability = Number(priceCents) / 100
  return probabilityToAmerican(probability)
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
  const normalized = ticker.toUpperCase()
  if (KALSHI_SPORT_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return true
  // Keep broad coverage for newly-added Kalshi sports tickers.
  return normalized.startsWith('KX')
}

const isPolymarketSportSlug = (slug?: string) => {
  if (!slug) return false
  const normalized = slug.toLowerCase()
  return POLYMARKET_SPORT_PREFIXES.some((prefix) => normalized.startsWith(prefix))
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
  const [prefix] = slug.toLowerCase().split('-')
  return POLYMARKET_SPORT_LABELS[prefix] ?? 'Sports'
}

const parsePolymarketDate = (slug?: string) => {
  if (!slug) return undefined
  const match = slug.match(/(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : undefined
}

const normalizePolymarketTagToken = (value?: string | null) =>
  String(value ?? '')
    .toLowerCase()
    .trim()

const resolvePolymarketSportFromTags = (tags: PolymarketEventTag[] = []) => {
  for (const tag of tags) {
    const slug = normalizePolymarketTagToken(tag.slug)
    if (slug && POLYMARKET_SPORT_LABELS[slug]) return POLYMARKET_SPORT_LABELS[slug]
    if (slug && POLYMARKET_TAG_SPORT_LABELS[slug]) return POLYMARKET_TAG_SPORT_LABELS[slug]

    const compact = slug.replace(/[^a-z0-9]/g, '')
    if (compact && POLYMARKET_TAG_SPORT_LABELS[compact]) {
      return POLYMARKET_TAG_SPORT_LABELS[compact]
    }

    const label = normalizePolymarketTagToken(tag.label)
    if (label === 'sports') return 'Sports'
    if (label && POLYMARKET_SPORT_LABELS[label]) return POLYMARKET_SPORT_LABELS[label]
    if (label && POLYMARKET_TAG_SPORT_LABELS[label]) return POLYMARKET_TAG_SPORT_LABELS[label]
  }
  return undefined
}

const polymarketEventCache = new Map<string, { isSports: boolean; sportLabel?: string }>()

const fetchPolymarketEvent = async (slug: string) => {
  if (polymarketEventCache.has(slug)) return polymarketEventCache.get(slug) ?? null
  try {
    const url = new URL('https://gamma-api.polymarket.com/events')
    url.searchParams.set('slug', slug)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      polymarketEventCache.set(slug, { isSports: false })
      return null
    }
    const raw = await res.json()
    const events = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.value)
        ? raw.value
        : raw
          ? [raw]
          : []
    const event = (events[0] ?? null) as PolymarketEventRecord | null
    if (!event) {
      polymarketEventCache.set(slug, { isSports: false })
      return null
    }
    const category = String(event.category ?? '').toLowerCase()
    const seriesSlugs = [
      String(event.seriesSlug ?? '').toLowerCase(),
      ...(Array.isArray(event.series)
        ? event.series
            .map((entry) => String(entry?.slug ?? '').toLowerCase())
            .filter(Boolean)
        : []),
    ].filter(Boolean)
    const title = String(event.title ?? '').toLowerCase()
    const tags = Array.isArray(event.tags) ? event.tags : []
    const hasSportsTag = tags.some((tag) => {
      const slugToken = normalizePolymarketTagToken(tag.slug)
      const labelToken = normalizePolymarketTagToken(tag.label)
      return (
        slugToken === 'sports' ||
        labelToken === 'sports' ||
        Boolean(POLYMARKET_SPORT_LABELS[slugToken]) ||
        Boolean(POLYMARKET_TAG_SPORT_LABELS[slugToken]) ||
        Boolean(POLYMARKET_SPORT_LABELS[labelToken]) ||
        Boolean(POLYMARKET_TAG_SPORT_LABELS[labelToken])
      )
    })
    const hasSportsMarketType = Array.isArray(event.markets)
      ? event.markets.some((market) => Boolean(market?.sportsMarketType))
      : false
    const isSports =
      category === 'sports' ||
      hasSportsTag ||
      hasSportsMarketType ||
      seriesSlugs.some((seriesSlug) => {
        const token = seriesSlug.split('-')[0] ?? ''
        return POLYMARKET_SPORT_SERIES.has(seriesSlug) || POLYMARKET_SPORT_SERIES.has(token)
      }) ||
      POLYMARKET_SPORT_PREFIXES.some((prefix) => title.startsWith(prefix.replace('-', '')))

    const sportLabel =
      resolvePolymarketSportFromTags(tags) ||
      (event.series?.[0]?.title as string | undefined) ||
      (seriesSlugs[0] ? seriesSlugs[0].toUpperCase() : undefined)

    const payload = { isSports, sportLabel }
    polymarketEventCache.set(slug, payload)
    return payload
  } catch {
    polymarketEventCache.set(slug, { isSports: false })
    return null
  }
}

const resolvePolymarketSportLabel = async (slug?: string, fallback?: string) => {
  if (!slug) return fallback ?? 'Sports'
  const event = await fetchPolymarketEvent(slug)
  if (event?.sportLabel) return event.sportLabel
  return fallback ?? 'Sports'
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
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_LIMIT
  const targetMatches = Math.min(Math.max(safeLimit, 50), POLYMARKET_MAX_LIMIT)
  const pageLimit = Math.max(100, Math.min(POLYMARKET_PAGE_LIMIT, targetMatches * 4))
  const rawScanTarget = Math.max(pageLimit, Math.min(4000, targetMatches * 8))
  const maxPages = Math.min(POLYMARKET_MAX_PAGES, Math.ceil(rawScanTarget / pageLimit))
  const deduped = new Map<string, WhaleTrade>()

  for (let page = 0; page < maxPages && deduped.size < targetMatches; page += 1) {
    const url = new URL(POLYMARKET_TRADES)
    url.searchParams.set('limit', String(pageLimit))
    url.searchParams.set('offset', String(page * pageLimit))

    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) break
    const data = (await res.json()) as { value?: PolymarketTrade[] } | PolymarketTrade[]
    const trades = Array.isArray(data)
      ? data
      : Array.isArray((data as { value?: PolymarketTrade[] }).value)
        ? (data as { value?: PolymarketTrade[] }).value ?? []
        : []
    if (!trades.length) break

    const results = await Promise.all(
      trades.map(async (trade) => {
        const eventSlug = trade.eventSlug || trade.slug
        if (!eventSlug) return null
        const isSportsSlug = isPolymarketSportSlug(eventSlug)
        if (!isSportsSlug) {
          const event = await fetchPolymarketEvent(eventSlug)
          if (!event?.isSports) return null
        }
        const normalized = normalizePolymarketTrade(trade)
        const notional = Number(trade.size) * Number(normalized.price)
        if (!Number.isFinite(notional) || notional < minNotional) return null
        const priceCents = Math.round(Number(normalized.price) * 100)
        const probability = Number(normalized.price)
        const americanOdds = probabilityToAmerican(probability)
        if (americanOdds !== null && americanOdds <= -300) return null
        const sportLabel = await resolvePolymarketSportLabel(
          eventSlug,
          parsePolymarketSport(eventSlug)
        )
        return {
          id: `polymarket:${trade.transactionHash}`,
          source: 'polymarket' as const,
          marketTitle: trade.title,
          outcome: normalized.outcome,
          proxyWallet: trade.proxyWallet,
          priceCents,
          americanOdds,
          notional,
          contracts: Number(trade.size),
          timestamp: new Date(trade.timestamp * 1000).toISOString(),
          sport: sportLabel,
          eventDate: parsePolymarketDate(eventSlug),
          slug: trade.slug,
          outcomeIndex: normalized.outcomeIndex ?? undefined,
          side: trade.side,
        }
      })
    )

    for (const item of results) {
      if (!item) continue
      deduped.set(item.id, item)
    }

    if (trades.length < pageLimit) break
  }

  return Array.from(deduped.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, targetMatches)
}

const resolvePolymarketMinNotional = (requestedMinNotional: number) => {
  if (!Number.isFinite(requestedMinNotional) || requestedMinNotional <= 0) {
    return POLYMARKET_MIN_NOTIONAL_FLOOR
  }
  return Math.max(
    POLYMARKET_MIN_NOTIONAL_FLOOR,
    Math.round(requestedMinNotional * POLYMARKET_MIN_NOTIONAL_SCALE)
  )
}

const mergeTradesWithSourceBalance = (
  kalshi: WhaleTrade[],
  polymarket: WhaleTrade[],
  limit: number
) => {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.floor(limit)) : DEFAULT_LIMIT
  const minPerSource = Math.max(1, Math.floor(safeLimit * SOURCE_BALANCE_RATIO))
  const byTimeDesc = (a: WhaleTrade, b: WhaleTrade) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()

  const kalshiSorted = [...kalshi].sort(byTimeDesc)
  const polymarketSorted = [...polymarket].sort(byTimeDesc)
  const selected = new Map<string, WhaleTrade>()

  const takeFrom = (rows: WhaleTrade[], count: number) => {
    if (count <= 0) return
    let taken = 0
    for (const row of rows) {
      if (selected.size >= safeLimit || taken >= count) break
      if (selected.has(row.id)) continue
      selected.set(row.id, row)
      taken += 1
    }
  }

  takeFrom(kalshiSorted, Math.min(minPerSource, kalshiSorted.length))
  takeFrom(polymarketSorted, Math.min(minPerSource, polymarketSorted.length))

  const combined = [...kalshiSorted, ...polymarketSorted].sort(byTimeDesc)
  for (const row of combined) {
    if (selected.size >= safeLimit) break
    if (selected.has(row.id)) continue
    selected.set(row.id, row)
  }

  return Array.from(selected.values()).sort(byTimeDesc)
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
  const polymarketMinNotional = resolvePolymarketMinNotional(minNotional)

  const [kalshi, polymarket] = await Promise.all([
    fetchKalshiTrades(limit, minNotional, options.since),
    fetchPolymarketTrades(limit, polymarketMinNotional),
  ])

  const sliced = mergeTradesWithSourceBalance(kalshi, polymarket, limit)
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
  yesBestBid: number | null
  noBestBid: number | null
  yesBestAsk: number | null
  noBestAsk: number | null
}

type KalshiTradePoint = {
  timestampMs: number
  side: 'yes' | 'no'
  priceCents: number
  notional: number
  count: number
}

type KalshiRecentTradeStats = {
  totalCount: number
  yesCount: number
  noCount: number
  averageYesPrice: number | null
  averageNoPrice: number | null
  trades: KalshiTradePoint[]
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

const resolveClusterDateKey = (trade: WhaleTrade) => {
  if (trade.eventDate && DATE_ONLY_PATTERN.test(trade.eventDate)) {
    return trade.eventDate
  }
  const raw = trade.eventDate ?? trade.timestamp
  const parsed = new Date(raw)
  if (!Number.isFinite(parsed.getTime())) return 'unknown'
  return parsed.toISOString().slice(0, 10)
}

const buildGameKeyForTrade = (trade: WhaleTrade) => {
  const teams = parseTeamsFromTitle(trade.marketTitle)
  if (!teams) return null
  const awayKey = normalizeTeamKey(teams.away)
  const homeKey = normalizeTeamKey(teams.home)
  if (!awayKey || !homeKey) return null
  const ordered = [awayKey, homeKey].sort()
  const dateKey = resolveClusterDateKey(trade)
  return `${trade.sport}:${dateKey}:${ordered[0]}@${ordered[1]}`
}

const normalizeOutcomeLabel = (value?: string | null) => value?.trim() ?? ''

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const replaceTeamLabel = (label: string, from: string, to: string) => {
  const pattern = new RegExp(`\\b${escapeRegExp(from)}\\b`, 'i')
  if (!pattern.test(label)) return label
  return label.replace(pattern, to)
}

const flipSignedLineInLabel = (label: string) => {
  const match = label.match(/([+-])\s?(\d+(?:\.\d+)?)/)
  if (!match) return label
  const sign = match[1]
  const value = match[2]
  const flipped = sign === '-' ? `+${value}` : `-${value}`
  return label.replace(match[0], flipped)
}

const flipOutcomeLabel = (outcome: string, teams: ParsedTeams | null) => {
  const label = normalizeOutcomeLabel(outcome)
  if (!label) return outcome
  const lower = label.toLowerCase()
  if (lower === 'yes') return 'No'
  if (lower === 'no') return 'Yes'
  if (lower.includes('over')) {
    return label.replace(/over/i, (match) => (match[0] === 'O' ? 'Under' : 'under'))
  }
  if (lower.includes('under')) {
    return label.replace(/under/i, (match) => (match[0] === 'U' ? 'Over' : 'over'))
  }
  if (teams) {
    const outcomeKey = normalizeTeamKey(label)
    const homeKey = normalizeTeamKey(teams.home)
    const awayKey = normalizeTeamKey(teams.away)
    if (outcomeKey && homeKey && (outcomeKey === homeKey || outcomeKey.includes(homeKey))) {
      return flipSignedLineInLabel(replaceTeamLabel(label, teams.home, teams.away))
    }
    if (outcomeKey && awayKey && (outcomeKey === awayKey || outcomeKey.includes(awayKey))) {
      return flipSignedLineInLabel(replaceTeamLabel(label, teams.away, teams.home))
    }
  }
  return outcome
}

const normalizePolymarketTrade = (trade: PolymarketTrade) => {
  const side = trade.side?.toUpperCase()
  const isSell = side === 'SELL'
  const teams = parseTeamsFromTitle(trade.title)
  const outcomeIndex = trade.outcomeIndex
  const canFlipIndex = outcomeIndex === 0 || outcomeIndex === 1
  const price = Number(trade.price)
  const effectivePrice =
    isSell && Number.isFinite(price) && price > 0 && price < 1 ? 1 - price : price
  return {
    isSell,
    outcome: isSell ? flipOutcomeLabel(trade.outcome, teams) : trade.outcome,
    outcomeIndex: isSell && canFlipIndex ? 1 - outcomeIndex : outcomeIndex,
    price: effectivePrice,
  }
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

const formatLineKey = (value: number) => Number(value).toFixed(2)

const normalizeSelectionName = (value: string) => value.trim().toLowerCase()

const SELECTION_KEY_SEPARATOR = '::'

const buildSelectionKey = (name: string, point?: number | null) => {
  if (point == null) return normalizeSelectionName(name)
  return `${normalizeSelectionName(name)}${SELECTION_KEY_SEPARATOR}${formatLineKey(point)}`
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

const resolveTradeSelection = (
  trade: WhaleTrade,
  marketKey: string,
  teams: ParsedTeams | null
) => {
  const selection = {
    team: resolveSelectionTeam(trade, teams) || undefined,
    totalSide: resolveTotalSide(trade) || undefined,
    line: undefined as number | undefined,
  }

  const outcomeLine = extractSignedLine(trade.outcome)
  if (outcomeLine != null) {
    selection.line = outcomeLine
    return selection
  }

  const titleLine = extractSignedLine(trade.marketTitle)
  if (titleLine != null) {
    if (marketKey === 'totals' && selection.totalSide) {
      const titleLower = trade.marketTitle.toLowerCase()
      if (titleLower.includes(selection.totalSide)) selection.line = titleLine
    } else if (marketKey === 'spreads' && selection.team) {
      const titleKey = normalizeTeamKey(trade.marketTitle)
      const teamKey = normalizeTeamKey(selection.team)
      if (teamKey && titleKey.includes(teamKey)) selection.line = titleLine
    } else if (marketKey !== 'spreads' && marketKey !== 'totals') {
      selection.line = titleLine
    }
  }

  return selection
}

const resolveIsPropMarket = (trade: WhaleTrade) => {
  const teams = parseTeamsFromTitle(trade.marketTitle)
  return !teams
}

const calculateImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

const buildNoVigConsensusBySelection = (
  bookmakers: Bookmaker[],
  marketKey: string
): Map<string, { impliedProbability: number; bookCount: number }> => {
  const selectionProbabilities = new Map<string, number[]>()

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    const implied = (market.outcomes || [])
      .map((outcome) => {
        const prob = calculateImpliedProbability(Number(outcome.price))
        if (prob == null || !Number.isFinite(prob) || prob <= 0) return null
        return { key: buildSelectionKey(outcome.name, outcome.point), prob }
      })
      .filter(Boolean) as Array<{ key: string; prob: number }>
    if (implied.length < 2) continue
    const totalProb = implied.reduce((sum, entry) => sum + entry.prob, 0)
    if (!Number.isFinite(totalProb) || totalProb <= 0) continue
    for (const entry of implied) {
      const normalized = entry.prob / totalProb
      const bucket = selectionProbabilities.get(entry.key) || []
      bucket.push(normalized)
      selectionProbabilities.set(entry.key, bucket)
    }
  }

  const consensus = new Map<string, { impliedProbability: number; bookCount: number }>()
  for (const [key, probs] of selectionProbabilities.entries()) {
    if (!probs.length) continue
    const avg = probs.reduce((sum, value) => sum + value, 0) / probs.length
    consensus.set(key, { impliedProbability: avg, bookCount: probs.length })
  }

  return consensus
}

const resolveSelectionKeyForTrade = (
  marketKey: string,
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number },
  consensus: Map<string, { impliedProbability: number; bookCount: number }>
) => {
  if (marketKey === 'totals' && selection.totalSide && selection.line != null) {
    const target = buildSelectionKey(selection.totalSide, selection.line)
    if (consensus.has(target)) return target
  }

  if (marketKey === 'spreads' && selection.team && selection.line != null) {
    const teamKey = normalizeTeamKey(selection.team)
    const lineKey = formatLineKey(selection.line)
    for (const key of consensus.keys()) {
      const [rawName, rawLine] = key.split(SELECTION_KEY_SEPARATOR)
      if (!rawLine || rawLine !== lineKey) continue
      const candidateTeamKey = normalizeTeamKey(rawName)
      if (candidateTeamKey && teamKey && (candidateTeamKey === teamKey || candidateTeamKey.includes(teamKey))) {
        return key
      }
    }
  }

  if (marketKey === 'h2h' && selection.team) {
    const teamKey = normalizeTeamKey(selection.team)
    for (const key of consensus.keys()) {
      const [rawName] = key.split(SELECTION_KEY_SEPARATOR)
      const candidateTeamKey = normalizeTeamKey(rawName)
      if (candidateTeamKey && teamKey && (candidateTeamKey === teamKey || candidateTeamKey.includes(teamKey))) {
        return key
      }
    }
  }

  return null
}

const scoreFromRatio = (ratio: number) => {
  const normalized = Math.min(1, Math.max(0, (ratio - 1) / 3.5))
  return 0.15 + normalized * 0.85
}

const scoreFromMove = (move: number) => {
  const absMove = Math.abs(move)
  const normalized = Math.min(1, Math.max(0, absMove / 6))
  return 0.15 + normalized * 0.85
}

const resolveLiquidityScore = (
  liquidityDollars: number | null,
  openInterest: number | null,
  spreadCents: number | null
) => {
  const liquidityScore = Math.min(1, Math.max(0, (liquidityDollars ?? 0) / 20000))
  const interestScore = Math.min(1, Math.max(0, (openInterest ?? 0) / 10000))
  let score = Math.max(liquidityScore, interestScore)
  if (score === 0 && ((liquidityDollars ?? 0) > 0 || (openInterest ?? 0) > 0)) {
    score = 0.2
  }
  score = Math.max(score, 0.25)
  if (spreadCents != null && spreadCents > 6) {
    score = Math.min(score, 0.5)
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
  const normalized = Math.min(1, Math.max(0, (ratio - 1) / 2.5))
  return 0.2 + normalized * 0.8
}

const resolveRecentTradeStats = (trades: KalshiTrade[]) => {
  let totalCount = 0
  let yesCount = 0
  let noCount = 0
  let yesPriceSum = 0
  let noPriceSum = 0
  const points: KalshiTradePoint[] = []

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

    const price = resolveKalshiPriceCents(trade)
    const timestampMs = new Date(trade.created_time).getTime()
    if (price != null && Number.isFinite(timestampMs) && count > 0) {
      points.push({
        timestampMs,
        side: trade.taker_side,
        priceCents: price,
        notional: count * (price / 100),
        count,
      })
    }
  }

  const averageYesPrice = yesCount > 0 ? yesPriceSum / yesCount : null
  const averageNoPrice = noCount > 0 ? noPriceSum / noCount : null

  return { totalCount, yesCount, noCount, averageYesPrice, averageNoPrice, trades: points }
}

// NEW: Timing factor - early steam is more valuable
const resolveTimingScore = (eventDate: string | undefined, tradeTime: string): number => {
  if (!eventDate) return 0.5 // Unknown = neutral
  const eventMs = new Date(eventDate).getTime()
  const tradeMs = new Date(tradeTime).getTime()
  if (!Number.isFinite(eventMs) || !Number.isFinite(tradeMs)) return 0.5

  const hoursUntilEvent = (eventMs - tradeMs) / (1000 * 60 * 60)

  // Early steam (12-48h out) = most valuable
  if (hoursUntilEvent >= 12 && hoursUntilEvent <= 48) return 1.0
  // Same day but >4h out = strong
  if (hoursUntilEvent >= 4 && hoursUntilEvent < 12) return 0.85
  // Close to game (1-4h) = moderate (could be public)
  if (hoursUntilEvent >= 1 && hoursUntilEvent < 4) return 0.6
  // Very close (<1h) = lower (often public money)
  if (hoursUntilEvent >= 0 && hoursUntilEvent < 1) return 0.4
  // Live = different analysis needed
  if (hoursUntilEvent < 0) return 0.3
  // Very early (>48h) = speculative
  return 0.5
}

// NEW: Enhanced RLM detection with sport context
const resolveEnhancedRlmScore = (opts: {
  recentTrades: KalshiRecentTradeStats | null
  side: 'yes' | 'no'
  priceMove: number
  sportContext: SportContext
}): { score: number; detected: boolean } => {
  const { recentTrades, side, priceMove, sportContext } = opts

  if (!recentTrades || recentTrades.totalCount < 5) {
    return { score: 0.2, detected: false }
  }

  const sideCount = side === 'yes' ? recentTrades.yesCount : recentTrades.noCount
  const oppCount = recentTrades.totalCount - sideCount
  const imbalance = (sideCount - oppCount) / recentTrades.totalCount

  // True RLM: Price moved in direction despite MORE action on other side
  if (Math.abs(priceMove) >= sportContext.moveThreshold && imbalance <= sportContext.rlmThreshold) {
    return { score: 1.0, detected: true } // Clear RLM
  }
  if (Math.abs(priceMove) >= 1.0 && imbalance <= sportContext.rlmThreshold * 0.5) {
    return { score: 0.7, detected: true } // Moderate RLM
  }
  if (imbalance <= 0 && Math.abs(priceMove) > 0) {
    return { score: 0.4, detected: false } // Weak RLM signal
  }
  return { score: 0.2, detected: false }
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
  const resolveBestBid = (levels: number[][]) => {
    let best: number | null = null
    for (const level of levels) {
      const price = normalizePriceCents(Number(level?.[0]))
      if (price == null) continue
      if (best == null || price > best) best = price
    }
    return best
  }
  const yesBestBid = resolveBestBid(yes)
  const noBestBid = resolveBestBid(no)
  const yesBestAsk = noBestBid != null ? 100 - noBestBid : null
  const noBestAsk = yesBestBid != null ? 100 - yesBestBid : null
  return {
    yesDepth: sumDepth(yes),
    noDepth: sumDepth(no),
    yesBestBid,
    noBestBid,
    yesBestAsk,
    noBestAsk,
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
  let bestBookKey: string | null = null
  let bestBookTitle: string | null = null
  let bestLineDiff = Number.POSITIVE_INFINITY

  for (const book of game.bookmakers || []) {
    if (book.key === 'kalshi' || book.key === 'polymarket') continue
    const market = book.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    for (const outcome of market.outcomes || []) {
      const price = Number(outcome.price)
      if (!Number.isFinite(price)) continue
      if (marketKey === 'h2h') {
        if (selection.team && normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) {
          if (bestOdds == null || price > bestOdds) {
            bestOdds = price
            bestBookKey = book.key
            bestBookTitle = book.title ?? book.key
          }
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
        if (selection.line == null) continue
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = Math.abs(line - selection.line)
        if (lineDiff > 0.01) continue
        bestLineDiff = lineDiff
        bestOdds = price
        bestBookKey = book.key
        bestBookTitle = book.title ?? book.key
        continue
      }
      if (marketKey === 'spreads') {
        if (!selection.team) continue
        if (!normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) continue
        if (selection.line == null) continue
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = Math.abs(line - selection.line)
        if (lineDiff > 0.01) continue
        bestLineDiff = lineDiff
        bestOdds = price
        bestBookKey = book.key
        bestBookTitle = book.title ?? book.key
      }
    }
  }

  return { bestOdds, bestBookKey, bestBookTitle }
}

const resolveSelectionOddsFromBook = (
  market: Bookmaker['markets'][number],
  marketKey: string,
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number },
  teams: ParsedTeams | null
) => {
  const outcomes = market.outcomes || []
  if (marketKey === 'h2h') {
    if (!selection.team) return null
    const selectionKey = normalizeTeamKey(selection.team)
    const selectionOutcome = outcomes.find((outcome) =>
      normalizeTeamKey(outcome.name).includes(selectionKey)
    )
    if (!selectionOutcome) return null
    const opposingOutcome = outcomes.find(
      (outcome) => outcome !== selectionOutcome && Number.isFinite(outcome.price)
    )
    return { selectionOutcome, opposingOutcome }
  }

  if (marketKey === 'totals') {
    if (!selection.totalSide) return null
    if (selection.line == null) return null
    const targetLine = selection.line
    const grouped = new Map<number, { over?: OddsOutcome; under?: OddsOutcome }>()
    for (const outcome of outcomes) {
      const line = Number(outcome.point)
      if (!Number.isFinite(line)) continue
      const name = outcome.name.toLowerCase()
      const isOver = name.includes('over')
      const isUnder = name.includes('under')
      if (!isOver && !isUnder) continue
      const bucket = grouped.get(line) || {}
      if (isOver) bucket.over = outcome
      if (isUnder) bucket.under = outcome
      grouped.set(line, bucket)
    }

    const targetKey = Array.from(grouped.keys()).find(
      (line) => Math.abs(line - targetLine) <= 0.01
    )
    if (targetKey == null) return null
    const bucket = grouped.get(targetKey)
    if (!bucket) return null
    const selectionOutcome = selection.totalSide === 'over' ? bucket.over : bucket.under
    const opposingOutcome = selection.totalSide === 'over' ? bucket.under : bucket.over
    if (!selectionOutcome) return null
    return { selectionOutcome, opposingOutcome }
  }

  if (marketKey === 'spreads') {
    if (!selection.team || !teams) return null
    if (selection.line == null) return null
    const targetLine = selection.line
    const selectionKey = normalizeTeamKey(selection.team)
    const opponentTeam =
      normalizeTeamKey(teams.home) === selectionKey ? teams.away : teams.home
    const opponentKey = normalizeTeamKey(opponentTeam)
    const candidates = outcomes.filter(
      (outcome) =>
        normalizeTeamKey(outcome.name).includes(selectionKey) &&
        Number.isFinite(outcome.point)
    )
    if (!candidates.length) return null
    const best = candidates.find((outcome) => {
      const line = Number(outcome.point)
      if (!Number.isFinite(line)) return false
      return Math.abs(line - targetLine) <= 0.01
    })
    if (!best) return null
    const targetOppLine = Number.isFinite(best.point) ? -Number(best.point) : null
    const opposingOutcome = outcomes.find((outcome) => {
      if (!Number.isFinite(outcome.point)) return false
      const teamKey = normalizeTeamKey(outcome.name)
      if (!teamKey || !opponentKey || !teamKey.includes(opponentKey)) return false
      if (targetOppLine == null) return true
      return Math.abs(Number(outcome.point) - targetOppLine) < 0.01
    })
    return { selectionOutcome: best, opposingOutcome }
  }

  return null
}

const resolveSportsbookWorstOdds = (
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
  const selection = resolveTradeSelection(trade, marketKey, teams)

  let worst: {
    odds: number
    rawProb: number
    fairProb: number | null
    bookKey: string
    bookTitle: string
    usedNoVig: boolean
  } | null = null

  for (const book of game.bookmakers || []) {
    if (book.key === 'kalshi' || book.key === 'polymarket') continue
    const market = book.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    const selectionResult = resolveSelectionOddsFromBook(
      market,
      marketKey,
      selection,
      teams
    )
    if (!selectionResult) continue
    const { selectionOutcome, opposingOutcome } = selectionResult
    const rawProb = calculateImpliedProbability(Number(selectionOutcome.price))
    if (rawProb == null) continue
    const oppRawProb = opposingOutcome
      ? calculateImpliedProbability(Number(opposingOutcome.price))
      : null
    const fairProb =
      oppRawProb != null && Number.isFinite(oppRawProb)
        ? rawProb / (rawProb + oppRawProb)
        : null
    const usedNoVig = fairProb != null && Number.isFinite(fairProb)
    if (!worst || rawProb > worst.rawProb) {
      worst = {
        odds: Number(selectionOutcome.price),
        rawProb,
        fairProb: usedNoVig ? fairProb : null,
        bookKey: book.key,
        bookTitle: book.title ?? book.key,
        usedNoVig,
      }
    }
  }

  return worst
}

const resolveSportsbookBestOdds = (
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
  const selection = resolveTradeSelection(trade, marketKey, teams)
  return findBestOdds(game, marketKey, selection)
}

const resolveSportsbookNoVigProbability = (
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
  const selection = resolveTradeSelection(trade, marketKey, teams)
  const sportsbookBooks = (game.bookmakers || []).filter(
    (book) => book.key !== 'kalshi' && book.key !== 'polymarket'
  )
  const consensus = buildNoVigConsensusBySelection(sportsbookBooks, marketKey)
  if (consensus.size === 0) return null
  const selectionKey = resolveSelectionKeyForTrade(marketKey, selection, consensus)
  if (!selectionKey) return null
  const entry = consensus.get(selectionKey)
  if (!entry || !Number.isFinite(entry.impliedProbability)) return null
  return entry.impliedProbability
}

const resolveSideBidAsk = (
  side: 'yes' | 'no',
  orderbook: KalshiOrderbookSnapshot | null
) => {
  if (!orderbook) return { bid: null, ask: null }
  const bid = side === 'yes' ? orderbook.yesBestBid : orderbook.noBestBid
  const ask = side === 'yes' ? orderbook.yesBestAsk : orderbook.noBestAsk
  return { bid, ask }
}

const resolveSideMidPriceCents = (
  side: 'yes' | 'no',
  orderbook: KalshiOrderbookSnapshot | null,
  market: KalshiMarketSnapshot | null,
  trade: WhaleTrade
) => {
  const { bid, ask } = resolveSideBidAsk(side, orderbook)
  if (bid != null && ask != null) return Math.round((bid + ask) / 2)
  const fallback =
    side === 'yes' ? market?.yesPriceCents ?? null : market?.noPriceCents ?? null
  return fallback ?? trade.priceCents
}

const resolveWindowPriceCents = (
  trades: KalshiTradePoint[],
  nowMs: number,
  windowMs: number,
  side: 'yes' | 'no',
  mode: 'latest' | 'earliest',
  fallback: number
) => {
  const start = nowMs - windowMs
  const candidates = trades.filter(
    (trade) => trade.side === side && trade.timestampMs >= start && trade.timestampMs <= nowMs
  )
  if (!candidates.length) return fallback
  const sorted = candidates.sort((a, b) =>
    mode === 'latest' ? b.timestampMs - a.timestampMs : a.timestampMs - b.timestampMs
  )
  return sorted[0]?.priceCents ?? fallback
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
          live: false,
          revalidateSeconds: 600,
          forceProvider: 'sportsbettingdime',
        })
        cache.set(sportKey, games)
      } catch (error) {
        console.warn('[WHALER] Failed to fetch sportsbook odds:', error)
      }
    })
  )
  return cache
}

type StrengthScoreResult = {
  score: number
  sharpScoreInstant: number
  sharpScore30s: number
  sharpScoreDirection: 'BUY' | 'SELL'
  timingScore: number
  rlmScore: number
  rlmDetected: boolean
  divergencePercent: number | null
  pricingDivergenceOnly: boolean
  sportContext: SportContext
}

const computeStrengthScore = (opts: {
  trade: WhaleTrade
  side: 'yes' | 'no'
  market: KalshiMarketSnapshot | null
  orderbook: KalshiOrderbookSnapshot | null
  recentTrades: KalshiRecentTradeStats | null
  sportsbookProb: number | null
  sportsbookProbWeight?: number
}): StrengthScoreResult => {
  const {
    trade,
    side,
    market,
    orderbook,
    recentTrades,
    sportsbookProb,
    sportsbookProbWeight,
  } = opts
  const sportContext = getSportContext(trade.sport)
  const nowMs = new Date(trade.timestamp).getTime()
  const trades = recentTrades?.trades ?? []
  const windowTrades = trades.filter(
    (item) =>
      Number.isFinite(item.timestampMs) &&
      item.timestampMs <= nowMs &&
      item.timestampMs >= nowMs - SHARP_SCORE_WINDOW_MS
  )

  const minNotional = resolveIsPropMarket(trade) ? MIN_PROP_NOTIONAL : MIN_GAME_NOTIONAL
  const buyNotional30 = windowTrades
    .filter((item) => item.side === side)
    .reduce((sum, item) => sum + item.notional, 0)
  const sellNotional30 = windowTrades
    .filter((item) => item.side !== side)
    .reduce((sum, item) => sum + item.notional, 0)
  const totalNotional30 = buyNotional30 + sellNotional30
  const flowImbalance30 =
    totalNotional30 > 0 ? (buyNotional30 - sellNotional30) / totalNotional30 : 0
  const sharpDirection: 'BUY' | 'SELL' = flowImbalance30 >= 0 ? 'BUY' : 'SELL'

  const { bid, ask } = resolveSideBidAsk(side, orderbook)
  const sweepCount30 = windowTrades.filter((item) => {
    if (item.side !== side) return false
    if (ask == null) return true
    return item.priceCents >= ask
  }).length

  const midNowCents = resolveSideMidPriceCents(side, orderbook, market, trade)
  const mid10sCents = resolveWindowPriceCents(
    windowTrades,
    nowMs,
    SHARP_SCORE_SHORT_WINDOW_MS,
    side,
    'latest',
    midNowCents
  )
  const mid30sCents = resolveWindowPriceCents(
    windowTrades,
    nowMs,
    SHARP_SCORE_WINDOW_MS,
    side,
    'earliest',
    midNowCents
  )

  const move10s = (midNowCents - mid10sCents) / 100
  const move30s = (midNowCents - mid30sCents) / 100

  const bidDepth = side === 'yes' ? orderbook?.yesDepth ?? 0 : orderbook?.noDepth ?? 0
  const askDepth = side === 'yes' ? orderbook?.noDepth ?? 0 : orderbook?.yesDepth ?? 0
  const buyNotional10s = windowTrades
    .filter((item) => item.side === side && item.timestampMs >= nowMs - SHARP_SCORE_SHORT_WINDOW_MS)
    .reduce((sum, item) => sum + item.notional, 0)
  const sellNotional10s = windowTrades
    .filter((item) => item.side !== side && item.timestampMs >= nowMs - SHARP_SCORE_SHORT_WINDOW_MS)
    .reduce((sum, item) => sum + item.notional, 0)
  const depletionRaw =
    flowImbalance30 >= 0
      ? askDepth > 0
        ? buyNotional10s / askDepth
        : 0
      : bidDepth > 0
        ? sellNotional10s / bidDepth
        : 0
  const depletion = clamp01(depletionRaw)

  const spreadPct =
    bid != null && ask != null && midNowCents > 0
      ? ((ask - bid) / midNowCents) * 100
      : null

  const initialMove = (mid10sCents - mid30sCents) / 100
  const totalMove = (midNowCents - mid30sCents) / 100
  const microRetentionRaw =
    initialMove !== 0 ? Math.abs(totalMove / initialMove) : 0
  const microRetention = clamp01(microRetentionRaw)

  const pmProb = midNowCents / 100
  const deltaProb = sportsbookProb != null ? pmProb - sportsbookProb : null
  const divergencePercent =
    deltaProb != null ? Math.round(Math.abs(deltaProb) * 1000) / 10 : null
  const divergenceWeight = sportsbookProbWeight ?? 1

  const flowScore = clamp01((Math.abs(flowImbalance30) - 0.2) / (0.8 - 0.2))
  const sweepScore = clamp01((sweepCount30 - 2) / (10 - 2))
  const moveScore = clamp01((Math.abs(move30s) - 0.005) / (0.03 - 0.005))
  const depletionScore = clamp01((depletion - 0.05) / (0.4 - 0.05))
  const spreadScore =
    spreadPct == null ? 0.2 : spreadPct <= 0.5 ? 1.0 : spreadPct <= 1.0 ? 0.6 : 0.2
  const microScore = clamp01((microRetention - 0.3) / (1.0 - 0.3))
  const divScore =
    deltaProb == null
      ? 0
      : clamp01((Math.abs(deltaProb) - 0.01) / (0.05 - 0.01)) * divergenceWeight

  const rawScore =
    0.22 * flowScore +
    0.12 * sweepScore +
    0.16 * moveScore +
    0.14 * depletionScore +
    0.06 * spreadScore +
    0.12 * microScore +
    0.18 * divScore
  const instantRaw =
    (0.22 * flowScore +
      0.12 * sweepScore +
      0.16 * moveScore +
      0.14 * depletionScore +
      0.06 * spreadScore +
      0.18 * divScore) /
    (1 - 0.12)

  let sharpScore30s = Math.round(100 * clamp01(rawScore))
  let sharpScoreInstant = Math.round(100 * clamp01(instantRaw))
  let pricingDivergenceOnly = false

  if (divScore >= 0.7 && flowScore < 0.2) {
    pricingDivergenceOnly = true
    sharpScore30s = Math.min(sharpScore30s, 55)
    sharpScoreInstant = Math.min(sharpScoreInstant, 55)
  }

  if (microScore < 0.2 && Math.abs(move30s) > 0.002) {
    sharpScore30s = Math.max(0, sharpScore30s - 15)
  }

  if (totalNotional30 < minNotional) {
    sharpScore30s = Math.min(sharpScore30s, 40)
    sharpScoreInstant = Math.min(sharpScoreInstant, 40)
  }
  if (spreadPct != null && spreadPct > 2) {
    sharpScore30s = Math.min(sharpScore30s, 50)
    sharpScoreInstant = Math.min(sharpScoreInstant, 50)
  }

  const { score: rlm, detected: rlmDetected } = resolveEnhancedRlmScore({
    recentTrades,
    side,
    priceMove: move30s * 100,
    sportContext,
  })
  const timingScore = resolveTimingScore(trade.eventDate, trade.timestamp)

  return {
    score: sharpScore30s,
    sharpScoreInstant,
    sharpScore30s,
    sharpScoreDirection: sharpDirection,
    timingScore,
    rlmScore: rlm,
    rlmDetected,
    divergencePercent,
    pricingDivergenceOnly,
    sportContext,
  }
}

// NEW: Classify a trade as ultra-sharp and generate reasons
const classifyUltraSharp = (opts: {
  trade: WhaleTrade
  strengthResult: StrengthScoreResult
  clusterResult?: ClusterResult
  crossMarketEvPercent?: number | null
}): { isUltraSharp: boolean; reasons: UltraSharpReason[] } => {
  const { trade, strengthResult, clusterResult, crossMarketEvPercent } = opts
  const { score, timingScore, rlmScore, rlmDetected, divergencePercent, sportContext } = strengthResult
  const reasons: UltraSharpReason[] = []

  // Signal requirements tracking
  let signalCount = 0

  // Cluster signal - group by game
  if (clusterResult?.isCluster) {
    signalCount++
    const windowMinutes = Math.round(clusterResult.windowMs / (1000 * 60))
    reasons.push({
      type: 'cluster',
      description: `${clusterResult.clusterSize} bets detected on this game within ${windowMinutes} minutes - coordinated sharp action`,
      value: clusterResult.clusterSize,
    })
  }

  // RLM signal
  if (rlmDetected && rlmScore >= 0.7) {
    signalCount++
    reasons.push({
      type: 'rlm',
      description: 'Reverse line movement detected - price moved toward this side despite more money on the other side',
      value: Math.round(rlmScore * 100),
    })
  }

  // Timing signal
  if (timingScore >= 0.7) {
    signalCount++
    const hoursDesc = timingScore >= 1.0 ? '12-48 hours before event (optimal window)' :
      timingScore >= 0.85 ? '4-12 hours before event (strong timing)' : 'good timing window'
    reasons.push({
      type: 'timing',
      description: `Early steam detected - bet placed ${hoursDesc}`,
      value: Math.round(timingScore * 100),
    })
  }

  // Divergence signal
  if (divergencePercent !== null && divergencePercent >= 4) {
    signalCount++
    reasons.push({
      type: 'divergence',
      description: `${divergencePercent}% price difference vs sportsbooks - indicates market inefficiency`,
      value: divergencePercent,
    })
  }

  if (crossMarketEvPercent != null && crossMarketEvPercent >= 3) {
    signalCount++
    reasons.push({
      type: 'cross-market-ev',
      description: `${crossMarketEvPercent}% vs no-vig sportsbooks - cross-market edge`,
      value: crossMarketEvPercent,
    })
  }

  if (trade.notional >= 50000) {
    signalCount++
    reasons.push({
      type: 'big-bet',
      description: `${Math.round(trade.notional / 1000)}k+ bet size - major stake`,
      value: trade.notional,
    })
  }

  // Only 1 signal required to qualify
  const isUltraSharp = signalCount >= 1

  return { isUltraSharp, reasons }
}

// Cluster detection: find trades on the same outcome within a time window
type ClusterResult = {
  isCluster: boolean
  clusterSize: number
  windowMs: number
}

const buildOutcomeKey = (trade: WhaleTrade): string => {
  // Cluster by game (ignore side/line) to surface hot matchups
  const gameKey = buildGameKeyForTrade(trade)
  if (gameKey) return `${trade.source}:${gameKey}`
  const normalizedMarket = trade.marketTitle.toLowerCase().trim()
  return `${trade.source}:${trade.sport}:unknown:${normalizedMarket}`
}

const detectClusterForTrade = (
  trade: WhaleTrade,
  allTrades: WhaleTrade[],
  config: ClusterConfig
): ClusterResult => {
  const tradeTime = new Date(trade.timestamp).getTime()
  if (!Number.isFinite(tradeTime)) {
    return { isCluster: false, clusterSize: 1, windowMs: config.windowMs }
  }

  // Check timing requirement for NBA/NFL
  if (config.minHoursBeforeEvent !== null && trade.eventDate) {
    const eventTime = new Date(trade.eventDate).getTime()
    if (Number.isFinite(eventTime)) {
      const hoursUntilEvent = (eventTime - tradeTime) / (1000 * 60 * 60)
      if (hoursUntilEvent < config.minHoursBeforeEvent) {
        // Too close to game time, don't count as cluster
        return { isCluster: false, clusterSize: 1, windowMs: config.windowMs }
      }
    }
  }

  const outcomeKey = buildOutcomeKey(trade)
  const windowStart = tradeTime - config.windowMs
  const windowEnd = tradeTime + config.windowMs

  // Count trades on the same outcome within the window
  let clusterSize = 0
  for (const otherTrade of allTrades) {
    if (buildOutcomeKey(otherTrade) !== outcomeKey) continue
    const otherTime = new Date(otherTrade.timestamp).getTime()
    if (!Number.isFinite(otherTime)) continue
    if (otherTime >= windowStart && otherTime <= windowEnd) {
      clusterSize++
    }
  }

  return {
    isCluster: clusterSize >= config.minBets,
    clusterSize,
    windowMs: config.windowMs,
  }
}

const enrichWhaleTradesWithStrength = async (trades: WhaleTrade[]): Promise<UltraSharpTrade[]> => {
  const oddsCache = await buildSportsbookOddsCache(trades)
  const preprocessed = trades.map((trade) => {
    const sportsbookBest = resolveSportsbookBestOdds(trade, oddsCache)
    const sportsbookWorst = resolveSportsbookWorstOdds(trade, oddsCache)
    const sportsbookProb =
      sportsbookWorst?.fairProb ??
      sportsbookWorst?.rawProb ??
      (sportsbookBest?.bestOdds != null
        ? oddsToImpliedProbability(sportsbookBest.bestOdds)
        : null)
    const sportsbookProbWeight =
      sportsbookWorst?.fairProb != null ? 1 : sportsbookWorst?.rawProb != null ? 0.6 : 0.4
    const noVigProb = resolveSportsbookNoVigProbability(trade, oddsCache)
    const priceProb = trade.priceCents ? trade.priceCents / 100 : null
    const trueProb =
      noVigProb ??
      sportsbookWorst?.fairProb ??
      sportsbookWorst?.rawProb ??
      (sportsbookBest?.bestOdds != null
        ? oddsToImpliedProbability(sportsbookBest.bestOdds)
        : null)
    let evPercent: number | null = null
    let evTargetPriceCents: number | null = null
    let evTargetAmericanOdds: number | null = null
    if (
      priceProb != null &&
      trueProb != null &&
      Number.isFinite(priceProb) &&
      Number.isFinite(trueProb) &&
      priceProb > 0 &&
      priceProb < 1 &&
      trueProb > 0 &&
      trueProb < 1
    ) {
      const evRaw = (trueProb / priceProb - 1) * 100
      evPercent = Math.round(evRaw * 10) / 10
      const targetProb = clamp01(trueProb / 1.03)
      evTargetPriceCents = Math.round(targetProb * 100)
      evTargetAmericanOdds = probabilityToAmericanOdds(targetProb)
    }
    let divergencePercent: number | null = null
    if (trade.priceCents && sportsbookProb != null) {
      const diff = Math.abs(trade.priceCents / 100 - sportsbookProb) * 100
      divergencePercent = Math.round(diff * 10) / 10
    }
    let crossMarketEvPercent: number | null = null
    if (trade.priceCents && noVigProb != null) {
      const edge = (noVigProb - trade.priceCents / 100) * 100
      crossMarketEvPercent = Math.round(edge * 10) / 10
    }
    return {
      trade,
      sportsbookProb,
      sportsbookProbWeight,
      divergencePercent,
      crossMarketEvPercent,
      sportsbookNoVigProb: noVigProb ?? null,
      evPercent,
      evTargetPriceCents,
      evTargetAmericanOdds,
      sportsbookBestOdds: sportsbookBest?.bestOdds ?? null,
      sportsbookBookKey: sportsbookBest?.bestBookKey ?? null,
      sportsbookBookTitle: sportsbookBest?.bestBookTitle ?? null,
    }
  })
  const filtered = preprocessed.filter(
    (entry) =>
      entry.divergencePercent == null ||
      entry.divergencePercent < MAX_FEED_DIVERGENCE_PERCENT
  )
  const filteredTrades = filtered.map((entry) => entry.trade)
  const kalshiTrades = filteredTrades.filter(
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
          fetchKalshiRecentTrades(ticker, now - SHARP_SCORE_WINDOW_MS),
        ])
        marketCache.set(ticker, market)
        orderbookCache.set(ticker, orderbook)
        recentTradeCache.set(ticker, resolveRecentTradeStats(recentTrades))
      }
    )
  )

  return filtered.map((entry) => {
    const {
      trade,
      sportsbookProb,
      sportsbookProbWeight,
      divergencePercent,
      crossMarketEvPercent,
      sportsbookNoVigProb,
      evPercent,
      evTargetPriceCents,
      evTargetAmericanOdds,
      sportsbookBestOdds,
      sportsbookBookKey,
      sportsbookBookTitle,
    } = entry
    const sportContext = getSportContext(trade.sport)

    // Detect cluster for this trade
    const clusterConfig = getClusterConfig(trade.sport)
    const clusterResult = detectClusterForTrade(trade, filteredTrades, clusterConfig)

    if (trade.source === 'kalshi' && trade.ticker) {
      const side = (trade.side ?? 'yes') as 'yes' | 'no'
      const market = marketCache.get(trade.ticker) ?? null
      const orderbook = orderbookCache.get(trade.ticker) ?? null
      const recentTrades = recentTradeCache.get(trade.ticker) ?? null
      const currentPriceCents =
        side === 'yes' ? market?.yesPriceCents ?? null : market?.noPriceCents ?? null
      const currentAmericanOdds = centsToAmerican(currentPriceCents)
      const strengthResult = computeStrengthScore({
        trade,
        side,
        market,
        orderbook,
        recentTrades,
        sportsbookProb,
        sportsbookProbWeight,
      })
      const { isUltraSharp, reasons } = classifyUltraSharp({
        trade,
        strengthResult,
        clusterResult,
        crossMarketEvPercent,
      })

      return {
        ...trade,
        sportsbookBestOdds,
        sportsbookBookKey,
        sportsbookBookTitle,
        sportsbookNoVigProb,
        evPercent,
        evTargetPriceCents,
        evTargetAmericanOdds,
        sharpStrength: strengthResult.score,
        sharpScoreInstant: strengthResult.sharpScoreInstant,
        sharpScore30s: strengthResult.sharpScore30s,
        sharpScoreDirection: strengthResult.sharpScoreDirection,
        currentPriceCents,
        currentAmericanOdds,
        isUltraSharp,
        ultraSharpReasons: reasons,
        sportContext: strengthResult.sportContext,
        timingScore: strengthResult.timingScore,
        rlmScore: strengthResult.rlmScore,
        divergencePercent: strengthResult.divergencePercent,
        crossMarketEvPercent,
      }
    }

    if (trade.source === 'polymarket') {
      const notional = trade.notional
      let base = 0.35
      if (notional >= 10000) base = 0.9
      else if (notional >= 5000) base = 0.7
      else if (notional >= 3000) base = 0.5

      // Updated weights for Polymarket (simplified since we lack market data)
      const timingScore = resolveTimingScore(trade.eventDate, trade.timestamp)
      const baseScore = 80 * (0.25 * base + 0.20 * 0.35 + 0.15 * 0.35 + 0.10 * 0.35 + 0.15 * 0.35 + 0.10 * timingScore + 0.05 * 0.5)

      let boost = 0
      if (divergencePercent != null) {
        if (divergencePercent >= 10) boost = 20
        else if (divergencePercent >= 7) boost = 16
        else if (divergencePercent >= 4) boost = 12
        else if (divergencePercent >= 2) boost = 8
        else if (divergencePercent >= 1) boost = 4
      }
      const score = Math.max(0, Math.min(100, Math.round((baseScore + boost) * 10) / 10))

      // Simplified ultra-sharp for Polymarket (timing + divergence + cluster)
      const reasons: UltraSharpReason[] = []
      let signalCount = 0

      if (clusterResult.isCluster) {
        signalCount++
        const windowMinutes = Math.round(clusterResult.windowMs / (1000 * 60))
        reasons.push({
          type: 'cluster',
          description: `${clusterResult.clusterSize} bets detected on this game within ${windowMinutes} minutes - coordinated sharp action`,
          value: clusterResult.clusterSize,
        })
      }

      if (crossMarketEvPercent != null && crossMarketEvPercent >= 3) {
        signalCount++
        reasons.push({
          type: 'cross-market-ev',
          description: `${crossMarketEvPercent}% vs no-vig sportsbooks - cross-market edge`,
          value: crossMarketEvPercent,
        })
      }

      if (timingScore >= 0.7) {
        signalCount++
        const hoursDesc = timingScore >= 1.0 ? '12-48 hours before event' :
          timingScore >= 0.85 ? '4-12 hours before event' : 'good timing window'
        reasons.push({
          type: 'timing',
          description: `Early steam - bet placed ${hoursDesc}`,
          value: Math.round(timingScore * 100),
        })
      }

      if (divergencePercent !== null && divergencePercent >= 4) {
        signalCount++
        reasons.push({
          type: 'divergence',
          description: `${divergencePercent}% vs sportsbooks - market inefficiency`,
          value: divergencePercent,
        })
      }

      // For Polymarket, larger bets can count as a signal
      if (notional >= 5000) {
        signalCount++
      }

      if (trade.notional >= 50000) {
        signalCount++
        reasons.push({
          type: 'big-bet',
          description: `${Math.round(trade.notional / 1000)}k+ bet size - major stake`,
          value: trade.notional,
        })
      }

      const isUltraSharp = signalCount >= 1

      return {
        ...trade,
        sportsbookBestOdds,
        sportsbookBookKey,
        sportsbookBookTitle,
        sportsbookNoVigProb,
        evPercent,
        evTargetPriceCents,
        evTargetAmericanOdds,
        sharpStrength: score,
        sharpScoreInstant: score,
        sharpScore30s: score,
        sharpScoreDirection: undefined,
        currentPriceCents: trade.priceCents,
        currentAmericanOdds: trade.americanOdds,
        isUltraSharp,
        ultraSharpReasons: reasons,
        sportContext,
        timingScore,
        rlmScore: undefined,
        divergencePercent,
        crossMarketEvPercent,
      }
    }

    // Fallback for unknown sources
    return {
      ...trade,
      sportsbookBestOdds,
      sportsbookBookKey,
      sportsbookBookTitle,
      sportsbookNoVigProb,
      evPercent,
      evTargetPriceCents,
      evTargetAmericanOdds,
      isUltraSharp: false,
      ultraSharpReasons: [],
      sportContext: null,
      timingScore: undefined,
      rlmScore: undefined,
      divergencePercent: undefined,
      crossMarketEvPercent,
    }
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
