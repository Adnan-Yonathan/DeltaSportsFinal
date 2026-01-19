import { decimalToAmerican } from '@/lib/utils/odds'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'
import { fetchOdds } from '@/lib/api/odds-api'
import { normalizeTeamKey } from '@/lib/identity/sport'
import type { Bookmaker, OddsGame } from '@/lib/types/odds'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_TRADES = 'https://data-api.polymarket.com/trades'

export const DEFAULT_LIMIT = 50
export const DEFAULT_MIN_NOTIONAL = 2000
export const RESPECT_CHECK_MS = 15 * 60 * 1000
export const RESPECT_TOLERANCE_CENTS = 2
const MAX_FEED_DIVERGENCE_PERCENT = 15

const KALSHI_SPORT_PREFIXES = [
  'KXNBA',
  'KXNCAAMB',
  'KXNFL',
  'KXNCAAF',
  'KXNHL',
  'KXMLB',
  'KXWNBA',
  'KXSOCCER',
  'KXGOLF',
  'KXUFC',
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
  KXGOLF: 'GOLF',
  KXUFC: 'UFC',
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
  golf: 'GOLF',
  ufc: 'UFC',
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

export type WhaleTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  proxyWallet?: string
  priceCents: number
  americanOdds: number | null
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
    const event = await res.json()
    const category = String(event?.category ?? '').toLowerCase()
    const seriesSlug = String(event?.seriesSlug ?? event?.series?.[0]?.slug ?? '').toLowerCase()
    const title = String(event?.title ?? '').toLowerCase()
    const isSports =
      category === 'sports' ||
      POLYMARKET_SPORT_SERIES.has(seriesSlug) ||
      POLYMARKET_SPORT_PREFIXES.some((prefix) => title.startsWith(prefix.replace('-', '')))

    const sportLabel =
      (event?.series?.[0]?.title as string | undefined) ||
      (seriesSlug ? seriesSlug.toUpperCase() : undefined)

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
  const url = new URL(POLYMARKET_TRADES)
  url.searchParams.set('limit', String(Math.min(Math.max(limit, 50), 300)))

  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as WhaleTrade[]
  const data = (await res.json()) as { value?: PolymarketTrade[] } | PolymarketTrade[]
  const trades = Array.isArray(data)
    ? data
    : Array.isArray((data as { value?: PolymarketTrade[] }).value)
      ? (data as { value?: PolymarketTrade[] }).value ?? []
      : []

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

  return results.filter(Boolean) as WhaleTrade[]
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
  const selection = resolveTradeSelection(trade, marketKey, teams)

  const bestOdds = findBestOdds(game, marketKey, selection)
  if (!Number.isFinite(bestOdds)) return null
  return oddsToImpliedProbability(bestOdds as number)
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
  const consensus = buildNoVigConsensusBySelection(game.bookmakers || [], marketKey)
  if (consensus.size === 0) return null
  const selectionKey = resolveSelectionKeyForTrade(marketKey, selection, consensus)
  if (!selectionKey) return null
  const entry = consensus.get(selectionKey)
  if (!entry || !Number.isFinite(entry.impliedProbability)) return null
  return entry.impliedProbability
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

type StrengthScoreResult = {
  score: number
  timingScore: number
  rlmScore: number
  rlmDetected: boolean
  divergencePercent: number | null
  sportContext: SportContext
}

const computeStrengthScore = (opts: {
  trade: WhaleTrade
  side: 'yes' | 'no'
  market: KalshiMarketSnapshot | null
  orderbook: KalshiOrderbookSnapshot | null
  recentTrades: KalshiRecentTradeStats | null
  sportsbookProb: number | null
}): StrengthScoreResult => {
  const { trade, side, market, orderbook, recentTrades, sportsbookProb } = opts
  const sportContext = getSportContext(trade.sport)

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

  // NEW: Enhanced RLM detection with sport context
  const { score: rlm, detected: rlmDetected } = resolveEnhancedRlmScore({
    recentTrades,
    side,
    priceMove: move,
    sportContext,
  })

  // NEW: Timing factor
  const timingScore = resolveTimingScore(trade.eventDate, trade.timestamp)

  // Updated weights with timing factor (80 points max base)
  // bigBets: 0.25, momentum: 0.20, bookPressure: 0.15, liquidity: 0.10, rlm: 0.15, timing: 0.10, clustering: 0.05 (reserved for future)
  const baseScore =
    80 *
    (0.25 * bigBets +
      0.20 * momentum +
      0.15 * bookPressure +
      0.10 * liquidity +
      0.15 * rlm +
      0.10 * timingScore +
      0.05 * 0.5) // clustering placeholder

  let boost = 0
  let divergencePercent: number | null = null
  if (currentPrice != null && sportsbookProb != null) {
    const kalshiProb = currentPrice / 100
    const diff = Math.abs(kalshiProb - sportsbookProb) * 100
    divergencePercent = Math.round(diff * 10) / 10
    if (diff >= 10) boost = 20
    else if (diff >= 7) boost = 16
    else if (diff >= 4) boost = 12
    else if (diff >= 2) boost = 8
    else if (diff >= 1) boost = 4
  }

  // Additional cluster bonus reserved for future (up to +5)
  const clusterBonus = 0

  const finalScore = Math.max(0, Math.min(100, Math.round((baseScore + boost + clusterBonus) * 10) / 10))

  return {
    score: finalScore,
    timingScore,
    rlmScore: rlm,
    rlmDetected,
    divergencePercent,
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
    const sportsbookProb = resolveSportsbookProbability(trade, oddsCache)
    const noVigProb = resolveSportsbookNoVigProbability(trade, oddsCache)
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
    return { trade, sportsbookProb, divergencePercent, crossMarketEvPercent }
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
          fetchKalshiRecentTrades(ticker, now - 30 * 60 * 1000),
        ])
        marketCache.set(ticker, market)
        orderbookCache.set(ticker, orderbook)
        recentTradeCache.set(ticker, resolveRecentTradeStats(recentTrades))
      }
    )
  )

  return filtered.map(({ trade, sportsbookProb, divergencePercent, crossMarketEvPercent }) => {
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
      })
      const { isUltraSharp, reasons } = classifyUltraSharp({
        trade,
        strengthResult,
        clusterResult,
        crossMarketEvPercent,
      })

      return {
        ...trade,
        sharpStrength: strengthResult.score,
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
        sharpStrength: score,
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
