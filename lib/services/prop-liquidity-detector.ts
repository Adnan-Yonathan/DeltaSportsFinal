import { fetchOdds } from '@/lib/api/odds-api'
import { fetchSbdGamePropsList, resolveSbdLeague } from '@/lib/api/sbd'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'
import { oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import type { Bookmaker, OddsGame } from '@/lib/types/odds'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_CLOB = 'https://clob.polymarket.com'
const POLYMARKET_GAMES_TAG_ID = '100639'

const PROP_ORDER_NOTIONAL_MIN = 500
const TEAM_ORDER_NOTIONAL_MIN = 2000
const TEAM_MARKET_LIQUIDITY_MAX = 14000
const CACHE_TTL_MS = 60 * 1000
const MAX_KALSHI_PAGES = 5
const MAX_POLYMARKET_MARKETS = 120
const MAX_POLYMARKET_ORDERBOOKS = 40

type PropLiquiditySignal = {
  id: string
  source: 'kalshi' | 'polymarket'
  category: 'player_prop' | 'team_market'
  marketKey?: 'spreads' | 'totals' | 'h2h'
  sportKey: string
  sportLabel: string
  marketTitle: string
  outcome: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  propSide: 'Over' | 'Under' | null
  side: 'yes' | 'no' | null
  priceCents: number | null
  americanOdds: number | null
  liquidity: number
  timestamp: string
  eventDate?: string
  ticker?: string
  slug?: string
  outcomeIndex?: number
  edgePercent?: number | null
  sportsbookNoVigProb?: number | null
  sportsbookBestOdds?: number | null
  sportsbookBookKey?: string | null
  sportsbookBookTitle?: string | null
  sharpStrength: number
  reasons: Array<{ type: 'liquidity' | 'cross-market-ev'; description: string; value?: number }>
}

type KalshiMarket = {
  ticker: string
  title?: string
  yes_sub_title?: string
  no_sub_title?: string
  liquidity_dollars?: string
  liquidity?: number | string
}

type KalshiMarketResponse = {
  market?: {
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
  }
}

type PolymarketMarket = {
  id: string
  question?: string
  title?: string
  outcomes?: string
  outcomePrices?: string
  clobTokenIds?: string
  liquidityNum?: number
  liquidity?: string
  active?: boolean
  closed?: boolean
  events?: Array<{
    eventDate?: string
    gameStartTime?: string
    startTime?: string
    endDate?: string
    seriesSlug?: string
    series?: Array<{ slug?: string }>
  }>
}

type PolymarketOrderbook = {
  bids?: Array<{ price: string; size: string }>
  asks?: Array<{ price: string; size: string }>
}

type KalshiOrderSummary = {
  notional: number
  priceCents: number | null
}

type KalshiOrderbookSummary = {
  yes: KalshiOrderSummary[]
  no: KalshiOrderSummary[]
}

type SportsbookPropLine = {
  playerName: string
  propType: string
  line: number
  bestOverOdds: number | null
  bestUnderOdds: number | null
  bestOverBookTitle: string | null
  bestUnderBookTitle: string | null
  noVigOverProbs: number[]
  noVigUnderProbs: number[]
}

const KALSHI_PROP_SERIES = [
  { ticker: 'KXNBAPTS', propType: 'points', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAREB', propType: 'rebounds', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAAST', propType: 'assists', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBA3PT', propType: 'threes', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBABLK', propType: 'blocks', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBASTL', propType: 'steals', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNFLRSHYDS', propType: 'rushing_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLRECYDS', propType: 'receiving_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLPASSYDS', propType: 'passing_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLPASSTDS', propType: 'passing_tds', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLREC', propType: 'receptions', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
]

const KALSHI_TEAM_SERIES = [
  { ticker: 'KXNBASPREAD', marketKey: 'spreads', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBATOTAL', marketKey: 'totals', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAGAME', marketKey: 'h2h', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNFLSPREAD', marketKey: 'spreads', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLTOTAL', marketKey: 'totals', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLGAME', marketKey: 'h2h', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNCAAMBSPREAD', marketKey: 'spreads', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNCAAMBTOTAL', marketKey: 'totals', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNCAAMBGAME', marketKey: 'h2h', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNHLSPREAD', marketKey: 'spreads', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  { ticker: 'KXNHLTOTAL', marketKey: 'totals', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  { ticker: 'KXNHLGAME', marketKey: 'h2h', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
] as const

const POLYMARKET_SERIES_TO_SPORT_KEY: Record<string, { sportKey: string; sportLabel: string }> = {
  nba: { sportKey: 'basketball_nba', sportLabel: 'NBA' },
  'ncaa-cbb': { sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  nfl: { sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  'ncaa-cfb': { sportKey: 'americanfootball_ncaaf', sportLabel: 'NCAAF' },
  mlb: { sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  nhl: { sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  wnba: { sportKey: 'basketball_wnba', sportLabel: 'WNBA' },
}

const PROP_KEYWORDS: Record<string, Array<{ key: string; patterns: string[] }>> = {
  basketball_nba: [
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'rebounds', patterns: ['rebounds', 'rebs', 'reb'] },
    { key: 'assists', patterns: ['assists', 'ast'] },
    { key: 'threes', patterns: ['three', '3pt', '3-point', '3pointer'] },
    { key: 'blocks', patterns: ['blocks', 'blk'] },
    { key: 'steals', patterns: ['steals', 'stl'] },
  ],
  basketball_ncaab: [
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'rebounds', patterns: ['rebounds', 'rebs', 'reb'] },
    { key: 'assists', patterns: ['assists', 'ast'] },
  ],
  americanfootball_nfl: [
    { key: 'passing_yards', patterns: ['passing yards', 'pass yards', 'pass yds'] },
    { key: 'passing_tds', patterns: ['passing tds', 'passing touchdowns', 'pass tds', 'pass td'] },
    { key: 'rushing_yards', patterns: ['rushing yards', 'rush yards', 'rush yds'] },
    { key: 'rushing_tds', patterns: ['rushing tds', 'rushing touchdowns', 'rush tds', 'rush td'] },
    { key: 'rushing_attempts', patterns: ['rushing attempts', 'rush attempts', 'rush att', 'carries'] },
    { key: 'rushing_receiving_yards', patterns: ['rushing and receiving yards', 'rushing + receiving yards', 'rushing/receiving yards', 'rush+rec yards', 'scrimmage yards'] },
    { key: 'receiving_yards', patterns: ['receiving yards', 'rec yards', 'rec yds'] },
    { key: 'receptions', patterns: ['receptions', 'reception', 'catches', 'recs'] },
  ],
  americanfootball_ncaaf: [
    { key: 'passing_yards', patterns: ['passing yards', 'pass yards', 'pass yds'] },
    { key: 'passing_tds', patterns: ['passing tds', 'passing touchdowns', 'pass tds', 'pass td'] },
    { key: 'rushing_yards', patterns: ['rushing yards', 'rush yards', 'rush yds'] },
    { key: 'rushing_tds', patterns: ['rushing tds', 'rushing touchdowns', 'rush tds', 'rush td'] },
    { key: 'rushing_attempts', patterns: ['rushing attempts', 'rush attempts', 'rush att', 'carries'] },
    { key: 'rushing_receiving_yards', patterns: ['rushing and receiving yards', 'rushing + receiving yards', 'rushing/receiving yards', 'rush+rec yards', 'scrimmage yards'] },
    { key: 'receiving_yards', patterns: ['receiving yards', 'rec yards', 'rec yds'] },
    { key: 'receptions', patterns: ['receptions', 'reception', 'catches', 'recs'] },
  ],
  baseball_mlb: [
    { key: 'strikeouts', patterns: ['strikeouts', 'ks', 'k', 'strikeout'] },
    { key: 'hits', patterns: ['hits', 'hit'] },
    { key: 'home_runs', patterns: ['home runs', 'home run', 'hr', 'homer'] },
    { key: 'rbis', patterns: ['rbis', 'rbi', 'runs batted in'] },
    { key: 'runs', patterns: ['runs scored', 'runs'] },
    { key: 'total_bases', patterns: ['total bases', 'tb'] },
    { key: 'walks', patterns: ['walks', 'bb', 'bases on balls'] },
    { key: 'pitcher_outs', patterns: ['outs recorded', 'outs', 'innings pitched'] },
    { key: 'hits_allowed', patterns: ['hits allowed'] },
    { key: 'earned_runs', patterns: ['earned runs', 'er'] },
  ],
  icehockey_nhl: [
    { key: 'goals', patterns: ['goals', 'goal', 'to score'] },
    { key: 'assists', patterns: ['assists', 'assist'] },
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'shots', patterns: ['shots on goal', 'shots', 'sog'] },
    { key: 'saves', patterns: ['saves', 'save'] },
    { key: 'blocked_shots', patterns: ['blocked shots', 'blocks', 'blocked'] },
  ],
}

const SUPPORTED_TEAM_SPORTS = new Set([
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'icehockey_nhl',
])

const TEAM_LOOKUP = new Map<string, string>()
for (const team of TEAMS_REGISTRY) {
  if (!SUPPORTED_TEAM_SPORTS.has(team.sport)) continue
  const key = `${team.sport}:${team.abbreviation.toUpperCase()}`
  TEAM_LOOKUP.set(key, team.name)
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizePlayerName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

const resolvePropType = (text: string, sportKey: string) => {
  const patterns = PROP_KEYWORDS[sportKey] ?? []
  for (const entry of patterns) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      return entry.key
    }
  }
  return null
}

const resolvePropSide = (text: string, rawText?: string | null, tradeSide?: string | null) => {
  if (text.includes(' over ')) return 'Over'
  if (text.includes(' under ')) return 'Under'
  if (text.endsWith(' over')) return 'Over'
  if (text.endsWith(' under')) return 'Under'
  if (rawText && /\d+\+/.test(rawText) && tradeSide) {
    return tradeSide.toLowerCase() === 'yes' ? 'Over' : 'Under'
  }
  return null
}

const resolvePropLine = (text: string, propType: string | null, rawText?: string | null) => {
  if (!propType) return null
  const overUnderMatch = text.match(/(?:over|under)\s+(\d+(?:\.\d+)?)/)
  if (overUnderMatch) {
    const value = Number(overUnderMatch[1])
    return Number.isFinite(value) ? value : null
  }
  const propPattern = propType.replace('_', ' ')
  const searchText = rawText?.toLowerCase() ?? text
  const beforeMatch = searchText.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\+?\\s+${propPattern}`)
  )
  if (beforeMatch) {
    const value = Number(beforeMatch[1])
    return Number.isFinite(value) ? value : null
  }
  const afterMatch = text.match(
    new RegExp(`${propPattern}[^\\d]{0,6}(\\d+(?:\\.\\d+)?)`)
  )
  if (afterMatch) {
    const value = Number(afterMatch[1])
    return Number.isFinite(value) ? value : null
  }
  return null
}

const NAME_NOISE_PATTERN = new RegExp(
  '\\b(over|under|rushing|passing|receiving|yards?|yds?|touchdowns?|tds?|receptions?|catches|attempts?|completions?|interceptions?|points?|rebounds?|assists?|blocks?|steals?|threes?|three|three-point|3pt|3-point|line|total|team|anytime|to|score|will)\\b',
  'gi'
)

const extractPlayerNameFromText = (rawText: string) => {
  const cleaned = rawText
    .replace(NAME_NOISE_PATTERN, ' ')
    .replace(/[0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  const nameToken = "[A-Z][A-Za-z'\\.-]+"
  const titleMatch = cleaned.match(
    new RegExp(`\\b(${nameToken}(?:\\s+${nameToken}){1,2})\\b`)
  )
  if (titleMatch?.[1]) {
    return titleMatch[1].trim()
  }
  const upperMatch = cleaned.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,2})\b/)
  if (upperMatch?.[1]) {
    const normalized = upperMatch[1]
      .toLowerCase()
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    return normalized.trim()
  }
  return null
}

const parsePlayerNameFromKalshiTitle = (title?: string | null) => {
  if (!title) return null
  const colonMatch = title.match(/^([^:]+):/)
  if (colonMatch?.[1]) return colonMatch[1].trim()
  const recordMatch = title.match(
    /^([A-Za-z\s.'-]+?)(?:\s+(?:records|scores|to score)\b)/i
  )
  if (recordMatch?.[1]) return recordMatch[1].trim()
  return null
}

const parseLineFromTicker = (ticker: string) => {
  const parts = ticker.split('-')
  if (parts.length < 4) return null
  const line = parseInt(parts[parts.length - 1], 10)
  return Number.isFinite(line) ? line : null
}

const parseLineFromTitle = (title?: string | null) => {
  if (!title) return null
  const match = title.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const parseKalshiDate = (ticker: string) => {
  const match = ticker.match(/-(\d{2})([A-Z]{3})(\d{2})/)
  if (!match) return null
  const months: Record<string, string> = {
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
  const [, yy, mon, dd] = match
  const month = months[mon]
  if (!month) return null
  return `20${yy}-${month}-${dd}`
}

const parseTeamsFromTicker = (ticker: string) => {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{2,4})([A-Z]{2,4})-/)
  if (!match) return null
  return { awayCode: match[1], homeCode: match[2] }
}

const parseTeamCodeFromTicker = (ticker: string) => {
  const lastSegment = ticker.split('-').pop() ?? ''
  const match = lastSegment.match(/^([A-Z]{2,4})/)
  return match?.[1] ?? null
}

const resolveTeamNameFromCode = (sportKey: string, code: string | null) => {
  if (!code) return null
  return TEAM_LOOKUP.get(`${sportKey}:${code}`) ?? null
}

const normalizePriceCents = (value: number) => (value <= 1 ? value * 100 : value)

const formatAmericanOdds = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

const parseKalshiOrders = (levels: number[][]): KalshiOrderSummary[] => {
  const orders: KalshiOrderSummary[] = []
  for (const level of levels) {
    const priceRaw = Number(level?.[0])
    const size = Number(level?.[1])
    if (!Number.isFinite(priceRaw) || !Number.isFinite(size)) continue
    const priceCents = normalizePriceCents(priceRaw)
    const notional = (priceCents / 100) * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    orders.push({ notional, priceCents })
  }
  return orders
}

const sumOrderNotional = (orders: KalshiOrderSummary[]) =>
  orders.reduce((sum, order) => sum + order.notional, 0)

const resolveBestPriceOrder = (orders: KalshiOrderSummary[], minNotional: number) => {
  let best: KalshiOrderSummary | null = null
  for (const order of orders) {
    if (order.notional < minNotional) continue
    if (!best || (order.priceCents ?? 0) > (best.priceCents ?? 0)) {
      best = order
    }
  }
  return best
}

const resolveDominantOrder = (
  orders: KalshiOrderSummary[],
  minNotional: number,
  totalMarketLiquidity: number
) => {
  const total = totalMarketLiquidity
  if (!total) return null
  let best: KalshiOrderSummary | null = null
  for (const order of orders) {
    if (order.notional < minNotional) continue
    if (order.notional < total * 0.5) continue
    if (!best || (order.priceCents ?? 0) > (best.priceCents ?? 0)) {
      best = order
    }
  }
  return best
}

const fetchKalshiMarketDetails = async (ticker: string) => {
  const res = await fetch(`${KALSHI_BASE}/markets/${ticker}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as KalshiMarketResponse
  return data.market ?? null
}

const fetchKalshiOrderbookSummary = async (
  ticker: string
): Promise<KalshiOrderbookSummary | null> => {
  const url = new URL(`${KALSHI_BASE}/markets/${ticker}/orderbook`)
  url.searchParams.set('depth', '5')
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as { orderbook?: { yes?: number[][]; no?: number[][] } }
  const yes = Array.isArray(data.orderbook?.yes) ? data.orderbook?.yes ?? [] : []
  const no = Array.isArray(data.orderbook?.no) ? data.orderbook?.no ?? [] : []
  return {
    yes: parseKalshiOrders(yes),
    no: parseKalshiOrders(no),
  }
}

const fetchKalshiPropMarkets = async (seriesTicker: string) => {
  const markets: KalshiMarket[] = []
  let cursor: string | null = null
  for (let page = 0; page < MAX_KALSHI_PAGES; page += 1) {
    const url = new URL(`${KALSHI_BASE}/markets`)
    url.searchParams.set('series_ticker', seriesTicker)
    url.searchParams.set('limit', '500')
    if (cursor) url.searchParams.set('cursor', cursor)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) break
    const data = await res.json()
    const batch = Array.isArray(data?.markets) ? data.markets : []
    if (batch.length === 0) break
    markets.push(...batch)
    cursor = data?.cursor ?? null
    if (!cursor) break
  }
  return markets
}

const parseJsonArray = <T,>(value?: string): T[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const resolvePolymarketEventDate = (market: PolymarketMarket) => {
  const event = market.events?.[0]
  const raw =
    event?.eventDate ||
    event?.gameStartTime ||
    event?.startTime ||
    event?.endDate ||
    null
  if (!raw) return null
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

const resolvePolymarketSport = (market: PolymarketMarket) => {
  const event = market.events?.[0]
  const seriesSlug = event?.seriesSlug || event?.series?.[0]?.slug || null
  if (!seriesSlug) return null
  return POLYMARKET_SERIES_TO_SPORT_KEY[seriesSlug] ?? null
}

const fetchPolymarketOrderbook = async (tokenId: string): Promise<PolymarketOrderbook | null> => {
  const url = new URL(`${POLYMARKET_CLOB}/book`)
  url.searchParams.set('token_id', tokenId)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as PolymarketOrderbook
  return data
}

const parsePolymarketOrders = (book: PolymarketOrderbook): KalshiOrderSummary[] => {
  const bids = Array.isArray(book.bids) ? book.bids : []
  const orders: KalshiOrderSummary[] = []
  for (const level of bids) {
    const price = Number(level.price)
    const size = Number(level.size)
    if (!Number.isFinite(price) || !Number.isFinite(size)) continue
    const notional = price * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    orders.push({ notional, priceCents: Math.round(price * 100) })
  }
  return orders
}

const calculateImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

const formatLineKey = (value: number) => Number(value).toFixed(2)

const buildSelectionKey = (name: string, point?: number | null) => {
  const key = name.trim().toLowerCase()
  if (point == null) return key
  return `${key}::${formatLineKey(point)}`
}

const buildNoVigConsensusBySelection = (
  bookmakers: Bookmaker[],
  marketKey: 'spreads' | 'totals' | 'h2h'
) => {
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

const resolveSelectionKeyForTeam = (
  marketKey: 'spreads' | 'totals' | 'h2h',
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
      const [rawName, rawLine] = key.split('::')
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
      const [rawName] = key.split('::')
      const candidateTeamKey = normalizeTeamKey(rawName)
      if (candidateTeamKey && teamKey && (candidateTeamKey === teamKey || candidateTeamKey.includes(teamKey))) {
        return key
      }
    }
  }

  return null
}

const findMatchingGame = (games: OddsGame[], teams: { home: string; away: string } | null) => {
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
  marketKey: 'spreads' | 'totals' | 'h2h',
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
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = selection.line != null ? Math.abs(line - selection.line) : 0
        if (lineDiff < bestLineDiff || (lineDiff === bestLineDiff && (bestOdds == null || price > bestOdds))) {
          bestLineDiff = lineDiff
          bestOdds = price
          bestBookKey = book.key
          bestBookTitle = book.title ?? book.key
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
          bestBookKey = book.key
          bestBookTitle = book.title ?? book.key
        }
      }
    }
  }

  return { bestOdds, bestBookKey, bestBookTitle }
}

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return '$0'
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${Math.round(value)}`
}

const computeSharpStrength = (notional: number, edgePercent?: number | null) => {
  const base = 55 + Math.log10(notional / 1000 + 1) * 20
  const edgeBoost = edgePercent != null && edgePercent >= 3 ? 8 : 0
  return Math.min(100, Math.round(base + edgeBoost))
}

const sportsbookCache = new Map<
  string,
  { fetchedAt: number; data: Map<string, SportsbookPropLine[]> }
>()

const oddsCache = new Map<string, { fetchedAt: number; games: OddsGame[] }>()

const fetchOddsForMarket = async (
  sportKey: string,
  marketKey: 'spreads' | 'totals' | 'h2h',
  teams?: { home: string; away: string } | null
) => {
  const cacheKey = `${sportKey}:${marketKey}`
  const cached = oddsCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.games
  }

  const teamFilter = teams ? [teams.home, teams.away] : undefined
  const games = await fetchOdds(sportKey, [marketKey], {
    revalidateSeconds: 600,
    teamFilter,
  })

  oddsCache.set(cacheKey, { fetchedAt: now, games })
  return games
}

const resolveSportsbookNoVig = async (opts: {
  sportKey: string
  marketKey: 'spreads' | 'totals' | 'h2h'
  teams: { home: string; away: string } | null
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number }
}) => {
  const { sportKey, marketKey, teams, selection } = opts
  if (!teams) return { noVigProb: null, bestOdds: null }
  const games = await fetchOddsForMarket(sportKey, marketKey, teams)
  if (!games.length) return { noVigProb: null, bestOdds: null }
  const game = findMatchingGame(games, teams)
  if (!game) return { noVigProb: null, bestOdds: null }

  const bookmakers =
    game.bookmakers?.filter((book) => book.key !== 'kalshi' && book.key !== 'polymarket') ?? []
  const consensus = buildNoVigConsensusBySelection(bookmakers, marketKey)
  const selectionKey = resolveSelectionKeyForTeam(marketKey, selection, consensus)
  if (!selectionKey) {
    return { noVigProb: null, bestOdds: null }
  }
  const entry = consensus.get(selectionKey)
  const best = findBestOdds(game, marketKey, selection)
  return {
    noVigProb: entry?.impliedProbability ?? null,
    bestOdds: best.bestOdds,
    bestBookKey: best.bestBookKey,
    bestBookTitle: best.bestBookTitle,
  }
}

const fetchSportsbookPropIndex = async (sportKey: string) => {
  const cached = sportsbookCache.get(sportKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data
  }

  const league = resolveSbdLeague(sportKey)
  if (!league) return new Map<string, SportsbookPropLine[]>()

  const data = await fetchSbdGamePropsList(league, {
    init: { next: { revalidate: 60 } },
  })
  const result = new Map<string, SportsbookPropLine[]>()

  if (!Array.isArray(data)) {
    return result
  }

  for (const entry of data) {
    const playerName = entry?.player_name || entry?.player?.name
    if (!playerName || typeof playerName !== 'string') continue
    const normalizedPlayer = normalizePlayerName(
      playerName.includes(',')
        ? playerName.split(',').reverse().map((part: string) => part.trim()).join(' ')
        : playerName
    )

    const marketName = entry?.name
    if (typeof marketName !== 'string') continue
    const normalizedMarketName = marketName.toLowerCase()

    let propType: string | null = null
    const mappings = PROP_KEYWORDS[sportKey] ?? []
    const hit = mappings.find((mapping) =>
      mapping.patterns.some((pattern) => normalizedMarketName.includes(pattern))
    )
    if (hit) {
      propType = hit.key
    }
    if (!propType) continue

    const sportsbooks = entry?.sportsbooks
    if (!Array.isArray(sportsbooks)) continue

    for (const book of sportsbooks) {
      const odds = book?.odds
      if (!odds) continue

      const overOddsStr = odds.over_american
      const underOddsStr = odds.under_american
      const overPointsStr = odds.over_points
      const underPointsStr = odds.under_points

      const overOdds = typeof overOddsStr === 'string' ? parseFloat(overOddsStr) :
        typeof overOddsStr === 'number' ? overOddsStr : null
      const underOdds = typeof underOddsStr === 'string' ? parseFloat(underOddsStr) :
        typeof underOddsStr === 'number' ? underOddsStr : null
      const overPoints = typeof overPointsStr === 'string' ? parseFloat(overPointsStr) :
        typeof overPointsStr === 'number' ? overPointsStr : null
      const underPoints = typeof underPointsStr === 'string' ? parseFloat(underPointsStr) :
        typeof underPointsStr === 'number' ? underPointsStr : null

      const line = overPoints ?? underPoints
      if (line == null || Number.isNaN(line)) continue

      if (!result.has(normalizedPlayer)) {
        result.set(normalizedPlayer, [])
      }

      let bucket = result.get(normalizedPlayer)!.find(
        (item) => item.propType === propType && item.line === line
      )

      if (!bucket) {
        bucket = {
          playerName: normalizedPlayer,
          propType,
          line,
          bestOverOdds: null,
          bestUnderOdds: null,
          bestOverBookTitle: null,
          bestUnderBookTitle: null,
          noVigOverProbs: [],
          noVigUnderProbs: [],
        }
        result.get(normalizedPlayer)!.push(bucket)
      }

      const bookTitle =
        typeof book?.name === 'string'
          ? book.name
          : typeof book?.title === 'string'
            ? book.title
            : book?.key
              ? String(book.key)
              : null

      if (overOdds != null && !Number.isNaN(overOdds)) {
        if (bucket.bestOverOdds == null || overOdds > bucket.bestOverOdds) {
          bucket.bestOverOdds = overOdds
          bucket.bestOverBookTitle = bookTitle
        }
      }
      if (underOdds != null && !Number.isNaN(underOdds)) {
        if (bucket.bestUnderOdds == null || underOdds > bucket.bestUnderOdds) {
          bucket.bestUnderOdds = underOdds
          bucket.bestUnderBookTitle = bookTitle
        }
      }

      if (overOdds != null && underOdds != null) {
        const overProb = oddsToImpliedProbability(overOdds)
        const underProb = oddsToImpliedProbability(underOdds)
        const total = overProb + underProb
        if (Number.isFinite(total) && total > 0) {
          bucket.noVigOverProbs.push(overProb / total)
          bucket.noVigUnderProbs.push(underProb / total)
        }
      }
    }
  }

  sportsbookCache.set(sportKey, { fetchedAt: now, data: result })
  return result
}

const resolveSportsbookPropPrices = async (
  sportKey: string,
  playerName: string,
  propType: string,
  propLine: number | null,
  propSide: 'Over' | 'Under' | null
) => {
  if (!propSide) return { bestOdds: null, noVigProb: null }
  const index = await fetchSportsbookPropIndex(sportKey)
  const normalizedPlayer = normalizePlayerName(playerName)
  const props = index.get(normalizedPlayer) ?? []
  let matches = props.filter((item) => item.propType === propType)
  if (propLine != null) {
    matches = matches.filter((item) => Math.abs(item.line - propLine) < 0.01)
  }
  if (!matches.length) return { bestOdds: null, noVigProb: null }

  let best: SportsbookPropLine | null = null
  for (const candidate of matches) {
    best = candidate
    break
  }
  if (!best) return { bestOdds: null, noVigProb: null }

  const bestOdds = propSide === 'Under' ? best.bestUnderOdds : best.bestOverOdds
  const bestBookTitle =
    propSide === 'Under' ? best.bestUnderBookTitle : best.bestOverBookTitle
  const noVigPool = propSide === 'Under' ? best.noVigUnderProbs : best.noVigOverProbs
  const noVigProb = noVigPool.length
    ? noVigPool.reduce((sum, value) => sum + value, 0) / noVigPool.length
    : null
  return { bestOdds: bestOdds ?? null, noVigProb, bestBookTitle }
}

const buildLiquidityReason = (
  notional: number,
  outcomeLabel: string,
  americanOdds: number | null,
  priceCents: number | null
) => {
  const oddsLabel =
    formatAmericanOdds(americanOdds) ?? (priceCents != null ? `${priceCents}c` : 'market price')
  return {
    type: 'liquidity' as const,
    description: `${formatCurrency(notional)} order on ${outcomeLabel} at ${oddsLabel}.`,
    value: notional,
  }
}

const buildEvReason = (edgePercent: number, bestOdds: number | null) => {
  const absEdge = Math.abs(edgePercent).toFixed(1)
  const direction =
    edgePercent >= 0
      ? `Sportsbook price is ~${absEdge}% better than the order`
      : `Order price is ~${absEdge}% better than sportsbooks`
  const oddsLabel =
    bestOdds != null ? ` (${bestOdds >= 0 ? `+${bestOdds}` : bestOdds})` : ''
  return {
    type: 'cross-market-ev' as const,
    description: `${direction}${oddsLabel}.`,
    value: edgePercent,
  }
}

const buildLiquidityShareReason = (notional: number, totalMarketLiquidity: number) => {
  if (!totalMarketLiquidity) return null
  const share = Math.round((notional / totalMarketLiquidity) * 100)
  if (!Number.isFinite(share) || share < 50) return null
  return {
    type: 'liquidity' as const,
    description: `Order size is ${share}% of this side's liquidity.`,
    value: notional,
  }
}

let cachedSignals: { fetchedAt: number; signals: PropLiquiditySignal[] } | null = null

export const fetchPropLiquiditySignals = async (opts?: {
  sportKey?: string | 'all'
  minOrderNotional?: number
}) => {
  const now = Date.now()
  const minOrderNotional = opts?.minOrderNotional ?? PROP_ORDER_NOTIONAL_MIN
  const sportFilter = opts?.sportKey ?? 'all'
  if (cachedSignals && now - cachedSignals.fetchedAt < CACHE_TTL_MS) {
    if (sportFilter === 'all') return cachedSignals.signals
    return cachedSignals.signals.filter((signal) => signal.sportKey === sportFilter)
  }
  const today = new Date().toISOString().slice(0, 10)

  const kalshiSignals: PropLiquiditySignal[] = []
  for (const series of KALSHI_PROP_SERIES) {
    if (sportFilter !== 'all' && series.sportKey !== sportFilter) continue
    const markets = await fetchKalshiPropMarkets(series.ticker)
    const upcoming = markets.filter((market) => {
      const eventDate = parseKalshiDate(market.ticker)
      if (!eventDate || eventDate < today) return false
      return true
    })

    for (const market of upcoming) {
      const orderbook = await fetchKalshiOrderbookSummary(market.ticker)
      if (!orderbook) continue
      const eventDate = parseKalshiDate(market.ticker) ?? undefined
      const marketDetails = await fetchKalshiMarketDetails(market.ticker)
      const rawYesLabel = marketDetails?.yes_sub_title || market.yes_sub_title || 'Yes'
      const rawNoLabel = marketDetails?.no_sub_title || market.no_sub_title || 'No'

      const candidateSides: Array<{
        side: 'yes' | 'no'
        orders: KalshiOrderSummary[]
        label: string
        outcomeIndex: number
      }> = [
        { side: 'yes', orders: orderbook.yes, label: rawYesLabel, outcomeIndex: 0 },
        { side: 'no', orders: orderbook.no, label: rawNoLabel, outcomeIndex: 1 },
      ]

      const marketLiquidity =
        sumOrderNotional(orderbook.yes) + sumOrderNotional(orderbook.no)

      for (const candidate of candidateSides) {
        const dominantOrder = resolveDominantOrder(
          candidate.orders,
          minOrderNotional,
          marketLiquidity
        )
        const bestPriceOrder = resolveBestPriceOrder(candidate.orders, minOrderNotional)
        const selectedOrder = dominantOrder ?? bestPriceOrder
        if (!selectedOrder) continue
        if (selectedOrder.notional < marketLiquidity * 0.5) continue
        const priceCents = selectedOrder.priceCents
        if (priceCents == null) continue
        const probability = priceCents / 100
        const americanOdds =
          probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null

        const rawText = `${market.title ?? ''} ${candidate.label}`.trim()
        const normalizedText = normalizeText(rawText)
        const playerName = parsePlayerNameFromKalshiTitle(market.title) || extractPlayerNameFromText(rawText)
        const propType = series.propType
        const propLine = parseLineFromTicker(market.ticker)
        const propSide = resolvePropSide(normalizedText, rawText, candidate.side)

        if (!playerName || !propType || !propSide) continue
        if (americanOdds != null && americanOdds < -250) continue

        const { bestOdds, noVigProb, bestBookTitle } = await resolveSportsbookPropPrices(
          series.sportKey,
          playerName,
          propType,
          propLine,
          propSide
        )
        const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
        const edge =
          sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
        const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

        const displayOutcome =
          propLine != null ? `${propSide} ${propLine}` : propSide

        if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

        const reasons: PropLiquiditySignal['reasons'] = [
          buildLiquidityReason(selectedOrder.notional, displayOutcome, americanOdds, priceCents),
        ]
        const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
        if (shareReason) reasons.push(shareReason)
        reasons.push(buildEvReason(edgePercent, bestOdds))

        const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent ?? undefined)

        const orderOdds =
          americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
        const useSportsbook =
          sportsbookProb != null && sportsbookProb < probability
        const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
        const bestPriceBookTitle = useSportsbook
          ? bestBookTitle ?? null
          : 'Kalshi'
        const bestPriceBookKey = useSportsbook ? null : 'kalshi'

        kalshiSignals.push({
          id: `kalshi:${market.ticker}:${candidate.side}`,
          source: 'kalshi',
          category: 'player_prop',
          sportKey: series.sportKey,
          sportLabel: series.sportLabel,
          marketTitle: market.title ?? market.ticker,
          outcome: displayOutcome,
          playerName,
          propType,
          propLine,
          propSide,
          side: candidate.side,
          priceCents,
          americanOdds,
          liquidity: selectedOrder.notional,
          timestamp: new Date().toISOString(),
          eventDate,
          ticker: market.ticker,
          outcomeIndex: candidate.outcomeIndex,
          edgePercent,
          sportsbookNoVigProb: noVigProb,
          sportsbookBestOdds: bestPriceOdds ?? null,
          sportsbookBookTitle: bestPriceBookTitle,
          sportsbookBookKey: bestPriceBookKey,
          sharpStrength,
          reasons,
        })
      }
    }
  }

  const polymarketSignals: PropLiquiditySignal[] = []
  const polymarketUrl = new URL(`${POLYMARKET_BASE}/markets`)
  polymarketUrl.searchParams.set('tag_id', POLYMARKET_GAMES_TAG_ID)
  polymarketUrl.searchParams.set('active', 'true')
  polymarketUrl.searchParams.set('closed', 'false')
  polymarketUrl.searchParams.set('limit', String(MAX_POLYMARKET_MARKETS))

  const res = await fetch(polymarketUrl.toString(), { cache: 'no-store' })
  const polymarketData = res.ok ? ((await res.json()) as PolymarketMarket[]) : []
  const markets = Array.isArray(polymarketData) ? polymarketData : []

  let orderbookCount = 0
  for (const market of markets) {
    if (!market?.active || market.closed) continue
    const sportMeta = resolvePolymarketSport(market)
    if (!sportMeta) continue
    if (sportFilter !== 'all' && sportMeta.sportKey !== sportFilter) continue

    const question = market.question || market.title
    if (!question) continue
    const rawText = question.trim()
    const normalizedText = normalizeText(rawText)
    const propType = resolvePropType(normalizedText, sportMeta.sportKey)
    if (!propType) continue

    const outcomes = parseJsonArray<string>(market.outcomes)
    const outcomePrices = parseJsonArray<string | number>(market.outcomePrices)
    const tokenIds = parseJsonArray<string>(market.clobTokenIds)
    if (outcomes.length < 2 || tokenIds.length < 2 || outcomePrices.length < 2) continue

    if (orderbookCount >= MAX_POLYMARKET_ORDERBOOKS) break
    orderbookCount += 1

    const [book0, book1] = await Promise.all([
      fetchPolymarketOrderbook(tokenIds[0]),
      fetchPolymarketOrderbook(tokenIds[1]),
    ])
    if (!book0 || !book1) continue
    const orders0 = parsePolymarketOrders(book0)
    const orders1 = parsePolymarketOrders(book1)
    const candidates = [
      { index: 0, orders: orders0 },
      { index: 1, orders: orders1 },
    ]
    const marketLiquidity = sumOrderNotional(orders0) + sumOrderNotional(orders1)

    for (const candidate of candidates) {
      const dominantOrder = resolveDominantOrder(
        candidate.orders,
        minOrderNotional,
        marketLiquidity
      )
      const bestPriceOrder = resolveBestPriceOrder(candidate.orders, minOrderNotional)
      const selectedOrder = dominantOrder ?? bestPriceOrder
      if (!selectedOrder) continue
      if (selectedOrder.notional < marketLiquidity * 0.5) continue
      const outcome = outcomes[candidate.index] ?? ''
      const outcomeLower = outcome.toLowerCase().trim()
      const side = outcomeLower === 'yes' ? 'yes' : outcomeLower === 'no' ? 'no' : null
      const propSide = resolvePropSide(normalizedText, rawText, side)
      if (!propSide) continue

      const playerName = extractPlayerNameFromText(rawText)
      const propLine = resolvePropLine(normalizedText, propType, rawText)
      if (!playerName || propLine == null) continue

      const priceCents = selectedOrder.priceCents
      if (priceCents == null) continue
      const probability = priceCents / 100
      const americanOdds =
        probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null
      if (americanOdds != null && americanOdds < -250) continue

      const { bestOdds, noVigProb, bestBookTitle } = await resolveSportsbookPropPrices(
        sportMeta.sportKey,
        playerName,
        propType,
        propLine,
        propSide
      )
      const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
      const edge =
        sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
      const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

      const displayOutcome =
        propLine != null ? `${propSide} ${propLine}` : propSide

      if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

      const reasons: PropLiquiditySignal['reasons'] = [
        buildLiquidityReason(selectedOrder.notional, displayOutcome, americanOdds, priceCents),
      ]
      const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
      if (shareReason) reasons.push(shareReason)
      reasons.push(buildEvReason(edgePercent, bestOdds))

      const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent ?? undefined)

      const orderOdds =
        americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
      const useSportsbook =
        sportsbookProb != null && sportsbookProb < probability
      const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
      const bestPriceBookTitle = useSportsbook
        ? bestBookTitle ?? null
        : 'Polymarket'
      const bestPriceBookKey = useSportsbook ? null : 'polymarket'

      polymarketSignals.push({
        id: `polymarket:${market.id}:${candidate.index}`,
        source: 'polymarket',
        category: 'player_prop',
        sportKey: sportMeta.sportKey,
        sportLabel: sportMeta.sportLabel,
        marketTitle: rawText,
        outcome: displayOutcome,
        playerName,
        propType,
        propLine,
      propSide,
      side,
      priceCents,
      americanOdds,
      liquidity: selectedOrder.notional,
      timestamp: new Date().toISOString(),
      eventDate: resolvePolymarketEventDate(market) ?? undefined,
      slug: market.id,
      outcomeIndex: candidate.index,
      edgePercent,
      sportsbookNoVigProb: noVigProb,
      sportsbookBestOdds: bestPriceOdds ?? null,
      sportsbookBookTitle: bestPriceBookTitle,
      sportsbookBookKey: bestPriceBookKey,
      sharpStrength,
      reasons,
    })
    }
  }

  const teamSignals: PropLiquiditySignal[] = []
  for (const series of KALSHI_TEAM_SERIES) {
    if (sportFilter !== 'all' && series.sportKey !== sportFilter) continue
    const markets = await fetchKalshiPropMarkets(series.ticker)
    const upcoming = markets.filter((market) => {
      const eventDate = parseKalshiDate(market.ticker)
      if (!eventDate || eventDate < today) return false
      return true
    })

    for (const market of upcoming) {
      const orderbook = await fetchKalshiOrderbookSummary(market.ticker)
      if (!orderbook) continue
      const candidateSides: Array<{
        side: 'yes' | 'no'
        orders: KalshiOrderSummary[]
        outcomeIndex: number
      }> = [
        { side: 'yes', orders: orderbook.yes, outcomeIndex: 0 },
        { side: 'no', orders: orderbook.no, outcomeIndex: 1 },
      ]

      const teamCodes = parseTeamsFromTicker(market.ticker)
      if (!teamCodes) continue
      const awayName = resolveTeamNameFromCode(series.sportKey, teamCodes.awayCode)
      const homeName = resolveTeamNameFromCode(series.sportKey, teamCodes.homeCode)
      if (!awayName || !homeName) continue

      const lineTeamCode = parseTeamCodeFromTicker(market.ticker)
      const lineTeamName = resolveTeamNameFromCode(series.sportKey, lineTeamCode)
      const opponentName =
        lineTeamName === awayName ? homeName : lineTeamName === homeName ? awayName : null

      const lineValue = parseLineFromTitle(market.title ?? '')

      const marketLiquidity =
        sumOrderNotional(orderbook.yes) + sumOrderNotional(orderbook.no)
      if (marketLiquidity > TEAM_MARKET_LIQUIDITY_MAX) continue

      for (const candidate of candidateSides) {
        const dominantOrder = resolveDominantOrder(
          candidate.orders,
          TEAM_ORDER_NOTIONAL_MIN,
          marketLiquidity
        )
        const bestPriceOrder = resolveBestPriceOrder(candidate.orders, TEAM_ORDER_NOTIONAL_MIN)
        const selectedOrder = dominantOrder ?? bestPriceOrder
        if (!selectedOrder) continue
        if (selectedOrder.notional < marketLiquidity * 0.5) continue
        const priceCents = selectedOrder.priceCents
        if (priceCents == null) continue
        const probability = priceCents / 100
        const americanOdds =
          probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null
        if (americanOdds != null && americanOdds < -250) continue

        let selection: { team?: string; totalSide?: 'over' | 'under'; line?: number } = {}
        let outcomeLabel = ''

        if (series.marketKey === 'totals') {
          if (lineValue == null) continue
          const totalSide = candidate.side === 'yes' ? 'over' : 'under'
          selection = { totalSide, line: lineValue }
          outcomeLabel = `${totalSide === 'over' ? 'Over' : 'Under'} ${lineValue}`
        } else if (series.marketKey === 'spreads') {
          if (lineValue == null || !lineTeamName || !opponentName) continue
          const line = Math.abs(lineValue)
          if (candidate.side === 'yes') {
            selection = { team: lineTeamName, line: -line }
            outcomeLabel = `${lineTeamName} -${line}`
          } else {
            selection = { team: opponentName, line }
            outcomeLabel = `${opponentName} +${line}`
          }
        } else {
          if (!lineTeamName || !opponentName) continue
          const team = candidate.side === 'yes' ? lineTeamName : opponentName
          selection = { team }
          outcomeLabel = team
        }

        const { noVigProb, bestOdds, bestBookKey, bestBookTitle } = await resolveSportsbookNoVig({
          sportKey: series.sportKey,
          marketKey: series.marketKey,
          teams: { home: homeName, away: awayName },
          selection,
        })
        const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
        const edge =
          sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
        const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

        if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

        const reasons: PropLiquiditySignal['reasons'] = [
          buildLiquidityReason(selectedOrder.notional, outcomeLabel, americanOdds, priceCents),
        ]
        const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
        if (shareReason) reasons.push(shareReason)
        reasons.push(buildEvReason(edgePercent, bestOdds))
        const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent)

        const orderOdds =
          americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
        const useSportsbook =
          sportsbookProb != null && sportsbookProb < probability
        const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
        const bestPriceBookTitle = useSportsbook
          ? bestBookTitle ?? null
          : 'Kalshi'
        const bestPriceBookKey = useSportsbook ? bestBookKey ?? null : 'kalshi'

        teamSignals.push({
          id: `kalshi:${market.ticker}:${candidate.side}`,
          source: 'kalshi',
          category: 'team_market',
          marketKey: series.marketKey,
          sportKey: series.sportKey,
          sportLabel: series.sportLabel,
          marketTitle: market.title ?? market.ticker,
          outcome: outcomeLabel,
          playerName: null,
          propType: null,
          propLine: null,
        propSide: null,
        side: candidate.side,
        priceCents,
        americanOdds,
        liquidity: selectedOrder.notional,
        timestamp: new Date().toISOString(),
        eventDate: parseKalshiDate(market.ticker) ?? undefined,
        ticker: market.ticker,
        outcomeIndex: candidate.outcomeIndex,
        edgePercent,
        sportsbookNoVigProb: noVigProb,
        sportsbookBestOdds: bestPriceOdds ?? null,
        sportsbookBookKey: bestPriceBookKey,
        sportsbookBookTitle: bestPriceBookTitle,
        sharpStrength,
        reasons,
      })
      }
    }
  }

  const signals = [...kalshiSignals, ...polymarketSignals, ...teamSignals]
  cachedSignals = { fetchedAt: now, signals }
  return signals
}

export const mapLiquiditySignalsToPlayerPropTrades = (signals: PropLiquiditySignal[]) =>
  signals
    .filter((signal) => signal.category === 'player_prop')
    .map((signal) => ({
    id: signal.id,
    source: signal.source,
    sportKey: signal.sportKey,
    playerName: signal.playerName,
    propType: signal.propType,
    propLine: signal.propLine,
    side: signal.propSide,
    notional: signal.liquidity,
    americanOdds: signal.americanOdds,
    priceCents: signal.priceCents,
    tradeTime: signal.timestamp,
    eventTime: signal.eventDate ? `${signal.eventDate}T20:00:00Z` : signal.timestamp,
    marketTitle: signal.marketTitle,
    outcome: signal.outcome,
  }))

export const mapLiquiditySignalsToSharpTrades = (signals: PropLiquiditySignal[]) =>
  signals.map((signal) => ({
    id: `liquidity:${signal.id}`,
    source: signal.source,
    marketTitle: signal.marketTitle,
    outcome: signal.outcome,
    priceCents: signal.priceCents ?? 50,
    americanOdds: signal.americanOdds ?? null,
    sportsbookBestOdds: signal.sportsbookBestOdds ?? null,
    sportsbookBookKey: signal.sportsbookBookKey ?? null,
    sportsbookBookTitle: signal.sportsbookBookTitle ?? null,
    notional: signal.liquidity,
    contracts:
      signal.priceCents != null && signal.priceCents > 0
        ? Math.round(signal.liquidity / (signal.priceCents / 100))
        : Math.round(signal.liquidity),
    timestamp: signal.timestamp,
    sport: signal.sportLabel,
    eventDate: signal.eventDate,
    ticker: signal.ticker,
    slug: signal.slug,
    outcomeIndex: signal.outcomeIndex,
    side: signal.side ?? undefined,
    sharpStrength: signal.sharpStrength,
    isUltraSharp: true,
    ultraSharpReasons: signal.reasons,
    crossMarketEvPercent: signal.edgePercent ?? null,
  }))

