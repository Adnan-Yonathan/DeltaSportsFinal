import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore, MIN_STAKE_USD } from './polymarket-insider'
import { buildInsiderOddsSnapshots } from './insider-odds-snapshot'
import {
  isNflDraftPolymarketMarket,
  resolveNflDraftSportKeyFromPolymarketEvent,
} from './polymarket-draft'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API        = 'https://data-api.polymarket.com'
const LEADERBOARD_URL = `${DATA_API}/v1/leaderboard`
const TRADES_URL      = `${DATA_API}/trades`

const LEADERBOARD_PAGE_SIZE = 50

// Discovery strategies: [timePeriod, orderBy, offset, category]
// API returns max 50/page — use offsets in increments of 50
type LeaderboardStrategy = [string, string, number, string]

function buildStrategies(): LeaderboardStrategy[] {
  const strats: LeaderboardStrategy[] = []
  const add = (cat: string, ob: string, tp: string, pages: number) => {
    for (let p = 0; p < pages; p++) strats.push([tp, ob, p * 50, cat])
  }

  // SPORTS category — deep crawl to ~10,000 entries
  add('SPORTS', 'PNL', 'ALL',  200)  // 0–9950
  add('SPORTS', 'VOL', 'ALL',   40)  // 0–1950, high-volume sports bettors
  add('SPORTS', 'PNL', 'WEEK',   4)  // 0–150
  add('SPORTS', 'PNL', 'MONTH',  4)  // 0–150
  add('SPORTS', 'VOL', 'WEEK',   4)  // 0–150

  // OVERALL category — catches cross-market profitable wallets
  add('OVERALL', 'PNL', 'ALL',    8)  // 0–350
  add('OVERALL', 'VOL', 'ALL',    4)  // 0–150
  add('OVERALL', 'PNL', 'WEEK',   4)  // 0–150
  add('OVERALL', 'PNL', 'MONTH',  4)  // 0–150
  add('OVERALL', 'PNL', 'DAY',    4)  // 0–150

  return strats
}

const LEADERBOARD_STRATEGIES = buildStrategies()
const LEADERBOARD_CONCURRENCY = 10

const TRADES_PER_WALLET    = 800
const WALLET_FETCH_CONCURRENCY = 10

const MIN_ROI            = 0.03
const MAX_ROI            = 0.25
const MIN_VOLUME         = 15_000
const MIN_NET_SHARES     = 1
const FETCH_TIMEOUT_MS   = 15_000

const GAMMA_API       = 'https://gamma-api.polymarket.com'
const MARKET_FETCH_CONCURRENCY = 10
const EVENT_SPORT_FETCH_CONCURRENCY = 10
const MAX_EVENT_SPORT_LOOKUPS = 1000

const POSITION_BATCH_SIZE = 200
const UPCOMING_PRIORITY_WINDOW_HOURS = 6
const UPCOMING_PRIORITY_MULTIPLIER = 2

const SPORT_PREFIXES = [
  // North American leagues
  'nba-', 'wnba-', 'nfl-', 'cfb-', 'cbb-', 'ncaab-', 'ncaaf-',
  'nhl-', 'mlb-', 'baseball-', 'mls-',
  // Soccer / football — league-specific prefixes
  'ucl-', 'uel-', 'uecl-', 'epl-', 'laliga-', 'bundesliga-', 'seriea-',
  'ligue1-', 'soccer-', 'fifa-', 'coppa-', 'facup-',
  // Tennis
  'atp-', 'wta-', 'tennis-',
  // Esports — game-specific prefixes
  'cs2-', 'csgo-', 'lol-', 'dota2-', 'val-', 'rl-', 'cod-', 'esports-',
  // Hockey (international)
  'shl-', 'khl-', 'liiga-',
  // Basketball (international)
  'euroleague-', 'eurocup-', 'bkcl-',
  // Combat sports
  'mma-', 'ufc-', 'boxing-', 'pfl-', 'bellator-',
  // Other
  'golf-', 'pga-', 'cricket-', 'ipl-', 'f1-', 'nascar-', 'racing-',
  'rugby-', 'afl-', 'olympics-',
  // Additional active prefixes
  'cwbb-', 'mex-', 'per1-',
]

const SPORT_LABEL_MAP: Record<string, string> = {
  // North American
  nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL', mlb: 'MLB', baseball: 'MLB', mls: 'MLS',
  cfb: 'NCAAF', cbb: 'NCAAB', ncaab: 'NCAAB', ncaaf: 'NCAAF',
  // Soccer
  ucl: 'UCL', uel: 'UEL', uecl: 'UECL', epl: 'EPL', laliga: 'LA LIGA',
  bundesliga: 'BUNDESLIGA', seriea: 'SERIE A', ligue1: 'LIGUE 1',
  soccer: 'SOCCER', fifa: 'FIFA', coppa: 'COPPA', facup: 'FA CUP',
  // Tennis
  atp: 'ATP', wta: 'WTA', tennis: 'TENNIS',
  // Esports
  cs2: 'CS2', csgo: 'CS2', lol: 'LOL', dota2: 'DOTA 2', val: 'VALORANT',
  rl: 'ROCKET LEAGUE', cod: 'COD', esports: 'ESPORTS',
  // Hockey (international)
  shl: 'SHL', khl: 'KHL', liiga: 'LIIGA',
  // Basketball (international)
  euroleague: 'EUROLEAGUE', eurocup: 'EUROCUP', bkcl: 'BKCL',
  // Combat sports
  mma: 'MMA', ufc: 'UFC', boxing: 'BOXING', pfl: 'PFL', bellator: 'BELLATOR',
  // Other
  golf: 'GOLF', pga: 'PGA', cricket: 'CRICKET', ipl: 'IPL',
  f1: 'F1', nascar: 'NASCAR', racing: 'RACING',
  rugby: 'RUGBY', afl: 'AFL', olympics: 'OLYMPICS',
  // Additional active prefixes
  cwbb: 'CWBB', mex: 'LIGA MX', per1: 'PERU PRIMERA',
}

// ── API types ─────────────────────────────────────────────────────────────────

type LeaderboardEntry = {
  proxyWallet?:    string
  userName?:       string
  profileImage?:   string
  pnl?:            number | string
  vol?:            number | string
}

type TradeEntry = {
  proxyWallet?:  string
  side?:         string
  size?:         number | string
  price?:        number | string
  timestamp?:    number | string
  title?:        string
  slug?:         string
  eventSlug?:    string
  outcome?:      string
}

type GammaEventEntry = {
  category?: string | null
  title?: string | null
  seriesSlug?: string | null
  series?: Array<{ slug?: string | null; title?: string | null }>
  tags?: Array<{ slug?: string | null; label?: string | null }>
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const parseNum = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeSlug = (value?: string | null): string =>
  String(value ?? '').trim().toLowerCase()

const MLB_TITLE_HINT = /\b(mlb|major league baseball|baseball)\b/i
const eventSportKeyCache = new Map<string, string | null>()

const sportKeyFromSlug = (slug: string): string | null => {
  const prefix = SPORT_PREFIXES.find((p) => slug.startsWith(p))
  if (!prefix) return null
  return prefix.slice(0, -1)
}

const resolveTradeEventKey = (trade: Pick<TradeEntry, 'slug' | 'eventSlug'>): string =>
  normalizeSlug(trade.eventSlug) || normalizeSlug(trade.slug)

export const isNflDraftPolymarketText = (value?: string | null): boolean => {
  return isNflDraftPolymarketMarket(value)
}

const resolveDraftSportKeyFromText = (...values: Array<string | null | undefined>): string | null => {
  return values.some(isNflDraftPolymarketText) ? 'nfl' : null
}

export const resolveSportKeyFromEvent = (event: GammaEventEntry): string | null => {
  const directSeriesSlug = normalizeSlug(
    String(event.seriesSlug ?? event.series?.[0]?.slug ?? '')
  )
  if (directSeriesSlug) {
    const directKey = sportKeyFromSlug(`${directSeriesSlug}-`)
    if (directKey) return directKey
    if (directSeriesSlug === 'mlb' || directSeriesSlug.includes('baseball')) return 'mlb'
  }

  const eventSeriesTitle = String(event.series?.map((entry) => entry?.title ?? '').join(' ') ?? '')
  const eventTitle = String(event.title ?? '')
  const draftKey = resolveNflDraftSportKeyFromPolymarketEvent(event)
  if (draftKey) return draftKey
  if (MLB_TITLE_HINT.test(`${eventSeriesTitle} ${eventTitle}`)) return 'mlb'
  return null
}

async function fetchEventSportKey(eventSlug: string): Promise<string | null> {
  if (!eventSlug) return null
  const cached = eventSportKeyCache.get(eventSlug)
  if (cached !== undefined) return cached

  const url = `${GAMMA_API}/events?slug=${encodeURIComponent(eventSlug)}`
  const raw = await fetchJson(url)
  const event = Array.isArray(raw) ? (raw[0] as GammaEventEntry | undefined) : null
  const sportKey = event ? resolveSportKeyFromEvent(event) : null
  eventSportKeyCache.set(eventSlug, sportKey)
  return sportKey
}

async function buildTradeSportLabelOverrides(
  trades: TradeEntry[]
): Promise<Map<string, string>> {
  const unresolvedEventKeys = new Set<string>()
  for (const trade of trades) {
    if (resolveTradeSportKey(trade)) continue
    const eventKey = resolveTradeEventKey(trade)
    if (!eventKey) continue
    unresolvedEventKeys.add(eventKey)
  }

  if (unresolvedEventKeys.size === 0) return new Map<string, string>()

  const keys = [...unresolvedEventKeys].slice(0, MAX_EVENT_SPORT_LOOKUPS)
  const overrides = new Map<string, string>()

  for (let i = 0; i < keys.length; i += EVENT_SPORT_FETCH_CONCURRENCY) {
    const batch = keys.slice(i, i + EVENT_SPORT_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (eventKey) => ({
        eventKey,
        sportKey: await fetchEventSportKey(eventKey),
      }))
    )
    for (const result of results) {
      if (!result.sportKey) continue
      const label = SPORT_LABEL_MAP[result.sportKey]
      if (label) overrides.set(result.eventKey, label)
    }
  }

  return overrides
}

const resolveTradeSportKey = (trade: Pick<TradeEntry, 'slug' | 'eventSlug' | 'title'>): string | null => {
  const slugKey = sportKeyFromSlug(normalizeSlug(trade.slug))
  if (slugKey) return slugKey

  const eventSlugKey = sportKeyFromSlug(normalizeSlug(trade.eventSlug))
  if (eventSlugKey) return eventSlugKey

  const draftKey = resolveDraftSportKeyFromText(trade.slug, trade.eventSlug, trade.title)
  if (draftKey) return draftKey

  // MLB markets can arrive with team-name slugs that do not include an `mlb-` prefix.
  if (MLB_TITLE_HINT.test(String(trade.title ?? ''))) return 'mlb'
  return null
}

const sportLabelForTrade = (
  trade: Pick<TradeEntry, 'slug' | 'eventSlug' | 'title'>,
  overrides?: Map<string, string>
): string | null => {
  const sportKey = resolveTradeSportKey(trade)
  if (sportKey) return SPORT_LABEL_MAP[sportKey] ?? null

  const eventKey = resolveTradeEventKey(trade)
  if (!eventKey || !overrides) return null
  return overrides.get(eventKey) ?? null
}

const sportLabel = (slug: string): string | null => {
  const key = resolveDraftSportKeyFromText(slug) ?? sportKeyFromSlug(normalizeSlug(slug))
  if (!key) return null
  return SPORT_LABEL_MAP[key] ?? null
}

async function fetchJson(url: string): Promise<unknown> {
  const timeout = new Promise<null>(resolve =>
    setTimeout(() => resolve(null), FETCH_TIMEOUT_MS)
  )
  try {
    const result = await Promise.race([
      fetch(url, { cache: 'no-store' }).then(r => r.ok ? r.json() : null),
      timeout,
    ])
    return result
  } catch {
    return null
  }
}

// ── Fetch current market prices from Gamma API ──────────────────────────────

type MarketPriceMap = Map<string, Map<string, number>> // slug → outcome → price

type MarketStartTimeMap = Map<string, string | null>

type FetchPricesResult = {
  prices: MarketPriceMap
  settledSlugs: Set<string>
  marketStartTimes: MarketStartTimeMap
}

function normalizeGammaTimestamp(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const candidates = [trimmed]
  if (trimmed.includes(' ') && !trimmed.includes('T')) {
    candidates.push(trimmed.replace(' ', 'T'))
  }

  for (const value of candidates) {
    const ms = Date.parse(value)
    if (Number.isFinite(ms)) {
      return new Date(ms).toISOString()
    }
  }
  return null
}

function resolveMarketStartTime(market: Record<string, unknown>): string | null {
  const directCandidates = [
    market.gameStartTime,
    market.endDate,
    market.endDateIso,
    market.eventDate,
    market.startTime,
  ]
  for (const candidate of directCandidates) {
    const normalized = normalizeGammaTimestamp(candidate)
    if (normalized) return normalized
  }

  const events = Array.isArray(market.events) ? market.events : []
  for (const eventEntry of events) {
    if (!eventEntry || typeof eventEntry !== 'object') continue
    const eventRecord = eventEntry as Record<string, unknown>
    const nestedCandidates = [eventRecord.startTime, eventRecord.eventDate, eventRecord.endDate]
    for (const candidate of nestedCandidates) {
      const normalized = normalizeGammaTimestamp(candidate)
      if (normalized) return normalized
    }
  }

  return null
}

async function fetchCurrentPrices(slugs: string[]): Promise<FetchPricesResult> {
  const priceMap: MarketPriceMap = new Map()
  const settledSlugs = new Set<string>()
  const marketStartTimes: MarketStartTimeMap = new Map()
  const uniqueSlugs = [...new Set(slugs)]

  for (let i = 0; i < uniqueSlugs.length; i += MARKET_FETCH_CONCURRENCY) {
    const batch = uniqueSlugs.slice(i, i + MARKET_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (slug) => {
        const url = `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}&limit=1`
        const raw = await fetchJson(url) as any[] | null
        if (!Array.isArray(raw) || raw.length === 0) return { slug, map: null, settled: true }
        const market = raw[0] as Record<string, unknown>
        const marketStartTime = resolveMarketStartTime(market)

        const isSettled = market.closed === true || market.active === false || market.acceptingOrders === false
        if (isSettled) return { slug, map: null, settled: true, marketStartTime }

        const outcomes = parseOutcomes(market.outcomes)
        const prices = parseOutcomePrices(market.outcomePrices)
        if (outcomes.length === 0 || outcomes.length !== prices.length) return null
        const map = new Map<string, number>()
        for (let j = 0; j < outcomes.length; j++) {
          map.set(outcomes[j], prices[j])
        }
        return { slug, map, settled: false, marketStartTime }
      })
    )
    for (const r of results) {
      if (!r) continue
      marketStartTimes.set(r.slug, r.marketStartTime ?? null)
      if (r.settled) {
        settledSlugs.add(r.slug)
      } else if (r.map) {
        priceMap.set(r.slug, r.map)
      }
    }
  }

  return { prices: priceMap, settledSlugs, marketStartTimes }
}

function parseOutcomes(raw: unknown): string[] {
  if (typeof raw === 'string') {
    try { return JSON.parse(raw) } catch { return [] }
  }
  if (Array.isArray(raw)) return raw.map(String)
  return []
}

function parseOutcomePrices(raw: unknown): number[] {
  if (typeof raw === 'string') {
    try {
      return (JSON.parse(raw) as unknown[]).map(Number).filter(Number.isFinite)
    } catch { return [] }
  }
  if (Array.isArray(raw)) return raw.map(Number).filter(Number.isFinite)
  return []
}

// ── Position computation from trade list ──────────────────────────────────────

type PositionState = {
  shares:         number
  costBasis:      number
  title:          string
  outcome:        string
  slug:           string
  eventSlug:      string | null
  sportLabel:     string | null
  firstTradeTime: string | null
  lastTradeTime:  string | null
  buyCount:       number
}

function applyTrade(
  positions: Map<string, PositionState>,
  trade: TradeEntry,
  sportLabelOverrides?: Map<string, string>
) {
  const slug = normalizeSlug(trade.slug)
  const tradeSportLabel = sportLabelForTrade(trade, sportLabelOverrides)
  if (!slug || !tradeSportLabel) return

  const size  = parseNum(trade.size)
  const price = parseNum(trade.price)
  if (!size || !price || size <= 0 || price <= 0) return

  const outcome = trade.outcome ?? 'YES'
  const key     = `${slug}::${outcome}`

  let pos = positions.get(key)
  if (!pos) {
    pos = {
      shares: 0,
      costBasis: 0,
      title: trade.title ?? slug,
      outcome,
      slug,
      eventSlug: normalizeSlug(trade.eventSlug) || null,
      sportLabel: tradeSportLabel,
      firstTradeTime: null,
      lastTradeTime: null,
      buyCount: 0,
    }
    positions.set(key, pos)
  }

  if (!pos.eventSlug && trade.eventSlug) pos.eventSlug = normalizeSlug(trade.eventSlug) || null
  if (!pos.sportLabel && tradeSportLabel) pos.sportLabel = tradeSportLabel

  if (trade.side === 'BUY') {
    pos.shares    += size
    pos.costBasis += size * price
    pos.buyCount  += 1
  } else if (trade.side === 'SELL') {
    const sellFrac = Math.min(size / Math.max(pos.shares, 0.0001), 1)
    pos.shares     = Math.max(0, pos.shares - size)
    pos.costBasis *= (1 - sellFrac)
  }

  const ts = parseNum(trade.timestamp)
  if (ts) {
    const iso = new Date(ts * 1000).toISOString()
    if (!pos.firstTradeTime || iso < pos.firstTradeTime) pos.firstTradeTime = iso
    if (!pos.lastTradeTime || iso > pos.lastTradeTime) pos.lastTradeTime = iso
  }
}

// ── Shared types ────────────────────────────────────────────────────────────

type WalletMeta = {
  roi: number; vol: number
  pseudonym: string | null; profileImageUrl: string | null
  buyTradeCount: number; avgBetSize: number
  discoverySource: string
}

type WalletTradeResult = {
  wallet: string
  trades: TradeEntry[]
  totalBuys: number
  totalBuyNotional: number
}

type RawPosition = {
  wallet: string; slug: string; eventSlug: string | null; title: string; outcome: string;
  sportLabel: string | null; avgEntryPrice: number; shares: number;
  stakeUsd: number; potentialPayoutUsd: number;
  firstTradeTime: string | null; lastTradeTime: string | null;
  buyCount: number;
}

export type InsiderFeedRefreshResult = {
  walletsScanned:    number
  walletsWithBets:   number
  positionsFound:    number
  removedCompleted:  number
  betsCached:        number
  reverseDiscovered: number
  holderDiscovered:  number
}

// Target sports for holder-based wallet discovery
const HOLDER_DISCOVERY_PREFIXES = ['nba-', 'cbb-', 'nhl-', 'mlb-', 'baseball-', 'nfl-']
const HOLDER_DISCOVERY_MARKETS_PER_SPORT = 20
const HOLDER_DISCOVERY_CONCURRENCY = 10
const HOLDER_DISCOVERY_MAX_NEW_WALLETS = 150

const isHolderDiscoveryTargetSlug = (slug: string) =>
  HOLDER_DISCOVERY_PREFIXES.some(p => slug.startsWith(p)) || isNflDraftPolymarketText(slug)

// ── Helper: compute wallet stats from trades ─────────────────────────────────

function computeWalletStats(trades: TradeEntry[]): { totalBuys: number; totalBuyNotional: number; totalSellNotional: number } {
  let totalBuys = 0
  let totalBuyNotional = 0
  let totalSellNotional = 0
  for (const t of trades) {
    const size = parseNum(t.size)
    const price = parseNum(t.price)
    if (!size || !price || size <= 0 || price <= 0) continue
    if (t.side === 'BUY') {
      totalBuys++
      totalBuyNotional += size * price
    } else if (t.side === 'SELL') {
      totalSellNotional += size * price
    }
  }
  return { totalBuys, totalBuyNotional, totalSellNotional }
}

// ── Helper: fetch trades for a wallet ────────────────────────────────────────

async function fetchWalletTrades(wallet: string): Promise<WalletTradeResult> {
  const url = new URL(TRADES_URL)
  url.searchParams.set('user', wallet)
  url.searchParams.set('limit', String(TRADES_PER_WALLET))

  const raw = await fetchJson(url.toString())
  const trades = Array.isArray(raw) ? (raw as TradeEntry[]) : []

  const { totalBuys, totalBuyNotional } = computeWalletStats(trades)
  return { wallet, trades, totalBuys, totalBuyNotional }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2a. discoverInsiderWallets() — Wallet Discovery (additive to DB)
// ══════════════════════════════════════════════════════════════════════════════

type DiscoveryResult = {
  walletsScanned: number
  reverseDiscovered: number
  holderDiscovered: number
}

export async function discoverInsiderWallets(): Promise<DiscoveryResult> {
  const supabase = createServiceClient()

  // In-memory map used during discovery to deduplicate and compute best ROI
  const qualifiedWallets = new Map<string, WalletMeta>()

  // ── Step 1: Multi-strategy leaderboard discovery ────────────────────────────

  const processLeaderboardPage = (rows: LeaderboardEntry[]) => {
    for (const row of rows) {
      const wallet = String(row.proxyWallet ?? '').trim().toLowerCase()
      if (!wallet) continue
      const pnl = parseNum(row.pnl)
      const vol = parseNum(row.vol)
      if (!pnl || !vol || pnl <= 0 || vol < MIN_VOLUME) continue
      const roi = pnl / vol
      if (!Number.isFinite(roi) || roi < MIN_ROI || roi > MAX_ROI) continue

      const existing = qualifiedWallets.get(wallet)
      if (existing && existing.roi >= roi) continue

      qualifiedWallets.set(wallet, {
        roi,
        vol,
        pseudonym:       typeof row.userName     === 'string' ? row.userName     : null,
        profileImageUrl: typeof row.profileImage === 'string' ? row.profileImage : null,
        buyTradeCount: 0,
        avgBetSize: 0,
        discoverySource: 'leaderboard',
      })
    }
  }

  for (let i = 0; i < LEADERBOARD_STRATEGIES.length; i += LEADERBOARD_CONCURRENCY) {
    const batch = LEADERBOARD_STRATEGIES.slice(i, i + LEADERBOARD_CONCURRENCY)

    const results = await Promise.all(
      batch.map(([timePeriod, orderBy, offset, category]) => {
        const url = new URL(LEADERBOARD_URL)
        url.searchParams.set('category', category)
        url.searchParams.set('timePeriod', timePeriod)
        url.searchParams.set('orderBy', orderBy)
        url.searchParams.set('limit', String(LEADERBOARD_PAGE_SIZE))
        if (offset > 0) url.searchParams.set('offset', String(offset))
        return fetchJson(url.toString())
      })
    )

    for (let j = 0; j < results.length; j++) {
      const raw = results[j]
      const [tp, ob, off, cat] = batch[j]
      if (!Array.isArray(raw)) {
        console.warn(`[InsiderFeed] Strategy ${cat}/${tp}/${ob}/+${off} failed`)
        continue
      }
      console.log(`[InsiderFeed] Strategy ${cat}/${tp}/${ob}/+${off}: ${raw.length} entries`)
      processLeaderboardPage(raw as LeaderboardEntry[])
    }
  }

  console.log(`[InsiderFeed] Total unique qualified wallets: ${qualifiedWallets.size}`)

  if (qualifiedWallets.size === 0) {
    console.error('[InsiderFeed] No qualified wallets from any leaderboard strategy')
    return { walletsScanned: 0, reverseDiscovered: 0, holderDiscovered: 0 }
  }

  // ── Step 1.5: Reverse discovery via recent sport trades ──────────────────

  const REVERSE_DISCOVERY_PAGES = 3
  const REVERSE_DISCOVERY_LIMIT = 500
  const REVERSE_DISCOVERY_MAX_WALLETS = 100
  const REVERSE_WALLET_CONCURRENCY = 10

  let reverseDiscoveredCount = 0

  try {
    const globalTradePages = await Promise.all(
      Array.from({ length: REVERSE_DISCOVERY_PAGES }, (_, page) => {
        const url = new URL(TRADES_URL)
        url.searchParams.set('limit', String(REVERSE_DISCOVERY_LIMIT))
        if (page > 0) url.searchParams.set('offset', String(page * REVERSE_DISCOVERY_LIMIT))
        return fetchJson(url.toString())
      })
    )

    const reverseTrades = globalTradePages.flatMap((page) =>
      Array.isArray(page) ? (page as TradeEntry[]) : []
    )
    const reverseSportLabelOverrides = await buildTradeSportLabelOverrides(reverseTrades)
    if (reverseSportLabelOverrides.size > 0) {
      console.log(
        `[InsiderFeed] Reverse discovery: recovered sport labels for ${reverseSportLabelOverrides.size} unknown events via Gamma`
      )
    }

    const newWalletAddresses = new Set<string>()
    for (const trade of reverseTrades) {
      if (!sportLabelForTrade(trade, reverseSportLabelOverrides)) continue
      const wallet = String(trade.proxyWallet ?? '').trim().toLowerCase()
      if (!wallet || qualifiedWallets.has(wallet)) continue
      newWalletAddresses.add(wallet)
    }

    console.log(`[InsiderFeed] Reverse discovery: ${newWalletAddresses.size} new sport wallets found`)

    const walletsToCheck = [...newWalletAddresses].slice(0, REVERSE_DISCOVERY_MAX_WALLETS)

    for (let i = 0; i < walletsToCheck.length; i += REVERSE_WALLET_CONCURRENCY) {
      const batch = walletsToCheck.slice(i, i + REVERSE_WALLET_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (wallet) => {
          const result = await fetchWalletTrades(wallet)
          const { totalSellNotional } = computeWalletStats(result.trades)
          const vol = result.totalBuyNotional
          const pnl = totalSellNotional - result.totalBuyNotional
          const roi = vol > 0 ? pnl / vol : 0
          return { ...result, vol, roi }
        })
      )

      for (const r of results) {
        if (
          !Number.isFinite(r.roi) ||
          r.roi < MIN_ROI ||
          r.roi > MAX_ROI ||
          r.vol < MIN_VOLUME
        ) continue

        qualifiedWallets.set(r.wallet, {
          roi: r.roi,
          vol: r.vol,
          pseudonym: null,
          profileImageUrl: null,
          buyTradeCount: r.totalBuys,
          avgBetSize: r.totalBuys > 0 ? r.totalBuyNotional / r.totalBuys : 0,
          discoverySource: 'reverse',
        })
        reverseDiscoveredCount++
      }
    }

    console.log(`[InsiderFeed] Reverse discovery: ${reverseDiscoveredCount} wallets qualified`)
  } catch (error) {
    console.warn('[InsiderFeed] Reverse discovery failed:', error)
  }

  // ── Step 1.6: Holder-based discovery for NBA, NCAAB, NHL ─────────────────

  let holderDiscoveredCount = 0

  try {
    const gammaMarketUrls = [
      `${GAMMA_API}/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false`,
      `${GAMMA_API}/markets?closed=false&active=true&limit=80&search=${encodeURIComponent('nfl draft')}`,
      `${GAMMA_API}/markets?closed=false&active=true&limit=80&search=${encodeURIComponent('pro football draft')}`,
    ]
    const gammaRawPages = await Promise.all(gammaMarketUrls.map((url) => fetchJson(url)))
    const gammaMarkets = gammaRawPages.flatMap((raw) =>
      Array.isArray((raw as any)?.value)
        ? (raw as any).value
        : Array.isArray(raw)
          ? raw
          : []
    )

    const targetMarkets: { slug: string; conditionId: string }[] = []
    const targetConditionIds = new Set<string>()
    for (const m of gammaMarkets) {
      const slug = normalizeSlug(String(m.slug ?? ''))
      const conditionId = String(m.conditionId ?? '')
      if (!conditionId || !isHolderDiscoveryTargetSlug(slug)) continue
      if (targetConditionIds.has(conditionId)) continue
      targetConditionIds.add(conditionId)
      targetMarkets.push({ slug, conditionId })
    }

    const perSport = new Map<string, number>()
    const cappedMarkets = targetMarkets.filter(m => {
      const prefix = HOLDER_DISCOVERY_PREFIXES.find(p => m.slug.startsWith(p)) ?? (isNflDraftPolymarketText(m.slug) ? 'nfl-draft-' : '')
      const count = perSport.get(prefix) ?? 0
      if (count >= HOLDER_DISCOVERY_MARKETS_PER_SPORT) return false
      perSport.set(prefix, count + 1)
      return true
    })

    console.log(`[InsiderFeed] Holder discovery: ${cappedMarkets.length} target markets (${[...perSport.entries()].map(([p, c]) => `${p.slice(0,-1)}:${c}`).join(', ')})`)

    const holderWallets = new Set<string>()
    for (let i = 0; i < cappedMarkets.length; i += HOLDER_DISCOVERY_CONCURRENCY) {
      const batch = cappedMarkets.slice(i, i + HOLDER_DISCOVERY_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async ({ conditionId }) => {
          const url = `${DATA_API}/holders?market=${encodeURIComponent(conditionId)}&limit=100`
          const raw = await fetchJson(url) as any[] | null
          if (!Array.isArray(raw)) return []
          const wallets: string[] = []
          for (const group of raw) {
            if (!Array.isArray(group.holders)) continue
            for (const h of group.holders) {
              const w = String(h.proxyWallet ?? '').trim().toLowerCase()
              if (w) wallets.push(w)
            }
          }
          return wallets
        })
      )
      for (const wallets of results) {
        for (const w of wallets) {
          if (!qualifiedWallets.has(w)) holderWallets.add(w)
        }
      }
    }

    console.log(`[InsiderFeed] Holder discovery: ${holderWallets.size} new wallets from holders`)

    const holdersToCheck = [...holderWallets].slice(0, HOLDER_DISCOVERY_MAX_NEW_WALLETS)
    const REVERSE_WALLET_CONCURRENCY = 10

    for (let i = 0; i < holdersToCheck.length; i += REVERSE_WALLET_CONCURRENCY) {
      const batch = holdersToCheck.slice(i, i + REVERSE_WALLET_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (wallet) => {
          const result = await fetchWalletTrades(wallet)
          const { totalSellNotional } = computeWalletStats(result.trades)
          const vol = result.totalBuyNotional
          const pnl = totalSellNotional - result.totalBuyNotional
          const roi = vol > 0 ? pnl / vol : 0
          return { ...result, vol, roi }
        })
      )

      for (const r of results) {
        if (
          !Number.isFinite(r.roi) ||
          r.roi < MIN_ROI ||
          r.roi > MAX_ROI ||
          r.vol < MIN_VOLUME
        ) continue

        qualifiedWallets.set(r.wallet, {
          roi: r.roi,
          vol: r.vol,
          pseudonym: null,
          profileImageUrl: null,
          buyTradeCount: r.totalBuys,
          avgBetSize: r.totalBuys > 0 ? r.totalBuyNotional / r.totalBuys : 0,
          discoverySource: 'holder',
        })
        holderDiscoveredCount++
      }
    }

    console.log(`[InsiderFeed] Holder discovery: ${holderDiscoveredCount} wallets qualified`)
  } catch (error) {
    console.warn('[InsiderFeed] Holder discovery failed:', error)
  }

  // ── UPSERT all discovered wallets to insider_wallets table ─────────────────

  const walletRows = [...qualifiedWallets.entries()].map(([wallet, meta]) => ({
    wallet,
    pseudonym:         meta.pseudonym,
    profile_image_url: meta.profileImageUrl,
    roi_pct:           meta.roi,
    volume_usd:        meta.vol,
    buy_trade_count:   meta.buyTradeCount,
    avg_bet_size:      meta.avgBetSize,
    discovery_source:  meta.discoverySource,
  }))

  // Batch upsert in chunks (Supabase has payload limits)
  const UPSERT_CHUNK = 500
  for (let i = 0; i < walletRows.length; i += UPSERT_CHUNK) {
    const chunk = walletRows.slice(i, i + UPSERT_CHUNK)
    const { error } = await (supabase as any)
      .from('insider_wallets')
      .upsert(chunk, {
        onConflict: 'wallet',
        ignoreDuplicates: false,
      })
    if (error) console.error(`[InsiderFeed] Wallet upsert chunk ${i} failed:`, error)
  }

  console.log(`[InsiderFeed] Upserted ${walletRows.length} wallets to insider_wallets`)

  return {
    walletsScanned: qualifiedWallets.size,
    reverseDiscovered: reverseDiscoveredCount,
    holderDiscovered: holderDiscoveredCount,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2b. refreshInsiderPositions() — Position Refresh (batched, round-robin)
// ══════════════════════════════════════════════════════════════════════════════

type PositionRefreshResult = {
  walletsWithBets: number
  positionsFound:  number
  removedCompleted: number
  betsCached:      number
}

type WalletBatchRow = {
  wallet: string
  pseudonym: string | null
  profile_image_url: string | null
  roi_pct: number
  volume_usd: number
  buy_trade_count: number | null
  avg_bet_size: number | null
}

const WALLET_BATCH_SELECT =
  'wallet, pseudonym, profile_image_url, roi_pct, volume_usd, buy_trade_count, avg_bet_size'

async function loadWalletBatch(
  supabase: ReturnType<typeof createServiceClient>,
  batchSize: number,
  todayET: string
): Promise<{ rows: WalletBatchRow[]; error: unknown | null }> {
  const selected = new Map<string, WalletBatchRow>()
  const nowIso = new Date().toISOString()
  const soonIso = new Date(Date.now() + UPCOMING_PRIORITY_WINDOW_HOURS * 60 * 60 * 1000).toISOString()

  try {
    const { data: priorityRows, error: priorityErr } = await (supabase as any)
      .from('insider_feed_cache')
      .select('wallet, game_start_time')
      .eq('cached_date', todayET)
      .gt('game_start_time', nowIso)
      .lte('game_start_time', soonIso)
      .order('game_start_time', { ascending: true })
      .limit(batchSize * UPCOMING_PRIORITY_MULTIPLIER)

    if (priorityErr) {
      console.warn('[InsiderFeed] Failed to load priority wallets from cache:', priorityErr)
    } else if (Array.isArray(priorityRows) && priorityRows.length > 0) {
      const prioritizedWallets = [...new Set(
        priorityRows
          .map((row) => String((row as { wallet?: string }).wallet ?? '').trim().toLowerCase())
          .filter(Boolean)
      )]

      if (prioritizedWallets.length > 0) {
        const walletSubset = prioritizedWallets.slice(0, batchSize)
        const { data: priorityWalletRows, error: priorityWalletErr } = await (supabase as any)
          .from('insider_wallets')
          .select(WALLET_BATCH_SELECT)
          .eq('is_active', true)
          .in('wallet', walletSubset)

        if (priorityWalletErr) {
          console.warn('[InsiderFeed] Failed to hydrate priority wallet rows:', priorityWalletErr)
        } else if (Array.isArray(priorityWalletRows) && priorityWalletRows.length > 0) {
          const rank = new Map(walletSubset.map((wallet, index) => [wallet, index]))
          const sortedRows = (priorityWalletRows as WalletBatchRow[]).sort(
            (left, right) => (rank.get(left.wallet) ?? Number.MAX_SAFE_INTEGER) - (rank.get(right.wallet) ?? Number.MAX_SAFE_INTEGER)
          )
          for (const row of sortedRows) {
            if (selected.size >= batchSize) break
            selected.set(row.wallet, row)
          }
          console.log(`[InsiderFeed] Priority wallets selected: ${selected.size}`)
        }
      }
    }
  } catch (error) {
    console.warn('[InsiderFeed] Priority wallet selection failed, using round-robin:', error)
  }

  const remaining = Math.max(batchSize - selected.size, 0)
  if (remaining > 0) {
    const oversampleLimit = Math.max(remaining * 3, remaining)
    const { data: roundRobinRows, error: roundRobinErr } = await (supabase as any)
      .from('insider_wallets')
      .select(WALLET_BATCH_SELECT)
      .eq('is_active', true)
      .order('last_refreshed_at', { ascending: true, nullsFirst: true })
      .limit(oversampleLimit)

    if (roundRobinErr) {
      if (selected.size > 0) {
        return { rows: [...selected.values()], error: null }
      }
      return { rows: [], error: roundRobinErr }
    }

    if (Array.isArray(roundRobinRows)) {
      for (const row of roundRobinRows as WalletBatchRow[]) {
        if (selected.size >= batchSize) break
        if (selected.has(row.wallet)) continue
        selected.set(row.wallet, row)
      }
    }
  }

  return { rows: [...selected.values()], error: null }
}

export async function refreshInsiderPositions(batchSize: number = POSITION_BATCH_SIZE): Promise<PositionRefreshResult> {
  const supabase = createServiceClient()
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' })

  // ── Step 1: Read wallet batch from DB (priority upcoming + round-robin fill) ──
  const { rows: walletRows, error: walletErr } = await loadWalletBatch(supabase, batchSize, todayET)

  if (walletErr) {
    console.error('[InsiderFeed] Failed to read wallet batch:', walletErr)
    return { walletsWithBets: 0, positionsFound: 0, removedCompleted: 0, betsCached: 0 }
  }

  if (!walletRows || walletRows.length === 0) {
    console.log('[InsiderFeed] No active wallets in insider_wallets table')
    return { walletsWithBets: 0, positionsFound: 0, removedCompleted: 0, betsCached: 0 }
  }

  console.log(`[InsiderFeed] Processing batch of ${walletRows.length} wallets`)

  // Build lookup map
  const walletMetaMap = new Map<string, {
    pseudonym: string | null; profileImageUrl: string | null
    roi: number; vol: number; buyTradeCount: number; avgBetSize: number
  }>()
  for (const row of walletRows as any[]) {
    walletMetaMap.set(row.wallet, {
      pseudonym:       row.pseudonym ?? null,
      profileImageUrl: row.profile_image_url ?? null,
      roi:             row.roi_pct,
      vol:             row.volume_usd,
      buyTradeCount:   row.buy_trade_count ?? 0,
      avgBetSize:      row.avg_bet_size ?? 0,
    })
  }

  // ── Step 2: Fetch trades for each wallet ────────────────────────────────────

  const walletAddresses = [...walletMetaMap.keys()]
  const walletResults: WalletTradeResult[] = []

  for (let i = 0; i < walletAddresses.length; i += WALLET_FETCH_CONCURRENCY) {
    const batch = walletAddresses.slice(i, i + WALLET_FETCH_CONCURRENCY)
    const results = await Promise.all(batch.map(fetchWalletTrades))
    walletResults.push(...results)
  }

  const tradeSportLabelOverrides = await buildTradeSportLabelOverrides(
    walletResults.flatMap((result) => result.trades)
  )
  if (tradeSportLabelOverrides.size > 0) {
    console.log(
      `[InsiderFeed] Position refresh: recovered sport labels for ${tradeSportLabelOverrides.size} unknown events via Gamma`
    )
  }

  // Update buy_trade_count, avg_bet_size, last_refreshed_at on each wallet
  const now = new Date().toISOString()
  const walletUpdates = walletResults
    .map(r => {
      const meta = walletMetaMap.get(r.wallet)
      if (!meta) return null
      return {
        wallet:            r.wallet,
        // Include required columns so upsert can safely insert if conflict is missed.
        roi_pct:           meta.roi,
        volume_usd:        meta.vol,
        buy_trade_count:   r.totalBuys,
        avg_bet_size:      r.totalBuys > 0 ? Math.round((r.totalBuyNotional / r.totalBuys) * 100) / 100 : 0,
        last_refreshed_at: now,
      }
    })
    .filter((row): row is {
      wallet: string
      roi_pct: number
      volume_usd: number
      buy_trade_count: number
      avg_bet_size: number
      last_refreshed_at: string
    } => Boolean(row))

  // Batch update wallet stats
  for (let i = 0; i < walletUpdates.length; i += 500) {
    const chunk = walletUpdates.slice(i, i + 500)
    const { error } = await (supabase as any)
      .from('insider_wallets')
      .upsert(chunk, { onConflict: 'wallet', ignoreDuplicates: false })
    if (error) console.error(`[InsiderFeed] Wallet stats update chunk ${i} failed:`, error)
  }

  // Also update the in-memory map with fresh trade stats
  for (const r of walletResults) {
    const meta = walletMetaMap.get(r.wallet)
    if (meta) {
      meta.buyTradeCount = r.totalBuys
      meta.avgBetSize = r.totalBuys > 0 ? r.totalBuyNotional / r.totalBuys : 0
    }
  }

  // ── Step 3: Compute open sports positions ─────────────────────────────────

  const allPositions: RawPosition[] = []
  let walletsWithBets = 0

  for (const { wallet, trades } of walletResults) {
    const positions = new Map<string, PositionState>()
    for (const t of trades) applyTrade(positions, t, tradeSportLabelOverrides)

    let hasPosition = false
    for (const pos of positions.values()) {
      // KEPT: MIN_NET_SHARES — confirms actual open position
      if (pos.shares < MIN_NET_SHARES) continue
      const avgEntryPrice = pos.costBasis / pos.shares
      if (!Number.isFinite(avgEntryPrice) || avgEntryPrice <= 0) continue
      // Hard floor for insider feed visibility.
      if (pos.costBasis < MIN_STAKE_USD) continue

      hasPosition = true
      allPositions.push({
        wallet,
        slug:               pos.slug,
        eventSlug:          pos.eventSlug,
        title:              pos.title,
        outcome:            pos.outcome,
        sportLabel:         pos.sportLabel ?? sportLabel(pos.eventSlug ?? pos.slug),
        avgEntryPrice,
        shares:             pos.shares,
        stakeUsd:           pos.costBasis,
        potentialPayoutUsd: pos.shares,
        firstTradeTime:     pos.firstTradeTime,
        lastTradeTime:      pos.lastTradeTime,
        buyCount:           pos.buyCount,
      })
    }
    if (hasPosition) walletsWithBets++
  }

  console.log(`[InsiderFeed] Open sport positions found: ${allPositions.length}`)

  // REMOVED: slug-date 7-day pre-filter — let Gamma settled check handle it

  // ── Step 4: Fetch current market prices (Gamma settled filter — KEPT) ─────

  const uniqueSlugs = [...new Set(allPositions.map(p => p.slug))]
  console.log(`[InsiderFeed] Fetching current prices for ${uniqueSlugs.length} markets`)
  const { prices: currentPrices, settledSlugs, marketStartTimes } = await fetchCurrentPrices(uniqueSlugs)
  console.log(`[InsiderFeed] Got prices for ${currentPrices.size} markets, ${settledSlugs.size} settled`)

  // KEPT: Remove settled markets (Gamma API detected closed/inactive)
  const activePositions = allPositions.filter(p => !settledSlugs.has(p.slug))
  const removedCount = allPositions.length - activePositions.length
  console.log(`[InsiderFeed] Removed ${removedCount} settled positions`)

  const nowMs = Date.now()
  const nowIsoForFilters = new Date(nowMs).toISOString()
  const pregamePositions = activePositions.filter((position) => {
    const marketStartTime = marketStartTimes.get(position.slug)
    if (!marketStartTime) return false
    const startMs = Date.parse(marketStartTime)
    return Number.isFinite(startMs) && startMs > nowMs
  })
  const droppedLiveCount = activePositions.length - pregamePositions.length
  if (droppedLiveCount > 0) {
    console.log(`[InsiderFeed] Dropped ${droppedLiveCount} live/in-progress positions`)
  }

  // ── Step 5: Build consensus (batch + existing cache entries) ──────────────

  // Consensus from this batch
  const batchConsensusMap = new Map<string, Set<string>>()
  for (const pos of pregamePositions) {
    const key = `${pos.slug}::${pos.outcome}`
    let wallets = batchConsensusMap.get(key)
    if (!wallets) {
      wallets = new Set()
      batchConsensusMap.set(key, wallets)
    }
    wallets.add(pos.wallet)
  }

  // Merge with existing cache entries for accurate cross-batch consensus
  const slugOutcomePairs = [...batchConsensusMap.keys()]

  if (slugOutcomePairs.length > 0) {
    // Query existing cache for today's entries on the same slug+outcome combos
    const slugsInBatch = [...new Set(pregamePositions.map(p => p.slug))]
    const { data: existingEntries } = await (supabase as any)
      .from('insider_feed_cache')
      .select('wallet, slug, outcome')
      .eq('cached_date', todayET)
      .gte('stake_usd', MIN_STAKE_USD)
      .gt('game_start_time', nowIsoForFilters)
      .in('slug', slugsInBatch)

    if (existingEntries && Array.isArray(existingEntries)) {
      for (const entry of existingEntries as { wallet: string; slug: string; outcome: string }[]) {
        const key = `${entry.slug}::${entry.outcome}`
        let wallets = batchConsensusMap.get(key)
        if (!wallets) {
          wallets = new Set()
          batchConsensusMap.set(key, wallets)
        }
        wallets.add(entry.wallet)
      }
    }
  }

  // ── Step 6: Score ALL positions — NO score threshold on write ─────────────

  const runTs  = new Date().toISOString()
  const scored: Record<string, unknown>[] = []
  const oddsSnapshotMap = await buildInsiderOddsSnapshots(
    pregamePositions.map((position) => {
      const slugPrices = currentPrices.get(position.slug)
      const currentPrice = slugPrices?.get(position.outcome) ?? null
      const currentAmericanOdds =
        currentPrice != null ? probabilityToAmericanOdds(currentPrice) : null
      return {
        slug: position.slug,
        title: position.title,
        outcome: position.outcome,
        sportLabel: position.sportLabel,
        currentAmericanOdds:
          currentAmericanOdds != null && Number.isFinite(currentAmericanOdds)
            ? currentAmericanOdds
            : null,
      }
    })
  )

  for (const pos of pregamePositions) {
    const meta = walletMetaMap.get(pos.wallet)
    if (!meta) continue

    const avgBetSize = meta.avgBetSize
    if (avgBetSize <= 0) continue

    const buyTradeCount = meta.buyTradeCount
    const consensusKey = `${pos.slug}::${pos.outcome}`
    const consensus = batchConsensusMap.get(consensusKey)?.size ?? 1

    const { score, sizeRatio } = computeInsiderScore(
      meta.roi,
      avgBetSize,
      pos.stakeUsd,
      consensus,
      buyTradeCount,
    )
    // REMOVED: score < minThreshold filter — write ALL scored positions

    const americanOdds = probabilityToAmericanOdds(pos.avgEntryPrice)

    const slugPrices = currentPrices.get(pos.slug)
    const curPrice = slugPrices?.get(pos.outcome) ?? null
    const curAmericanOdds = curPrice !== null ? probabilityToAmericanOdds(curPrice) : null
    const oddsSnapshot = oddsSnapshotMap.get(`${pos.slug}::${pos.outcome}`)
    const gameStartTime = marketStartTimes.get(pos.slug) ?? null

    scored.push({
      wallet:                  pos.wallet,
      pseudonym:               meta.pseudonym,
      profile_image_url:       meta.profileImageUrl,
      title:                   pos.title,
      outcome:                 pos.outcome,
      sport_label:             pos.sportLabel,
      slug:                    pos.slug,
      event_slug:              pos.eventSlug,
      avg_entry_price:         Math.round(pos.avgEntryPrice * 10_000) / 10_000,
      avg_entry_american_odds: Number.isFinite(americanOdds) ? americanOdds : null,
      current_price:           curPrice !== null ? Math.round(curPrice * 10_000) / 10_000 : null,
      current_american_odds:   curAmericanOdds !== null && Number.isFinite(curAmericanOdds) ? curAmericanOdds : null,
      stake_usd:               Math.round(pos.stakeUsd * 100) / 100,
      potential_payout_usd:    Math.round(pos.potentialPayoutUsd * 100) / 100,
      first_trade_time:        pos.firstTradeTime,
      last_trade_time:         pos.lastTradeTime,
      insider_score:           score,
      size_ratio:              sizeRatio,
      wallet_roi_pct:          Math.round(meta.roi * 100 * 10) / 10,
      wallet_trade_count:      buyTradeCount,
      consensus_count:         consensus,
      odds_snapshot:           oddsSnapshot?.quotes ?? [],
      odds_snapshot_at:        oddsSnapshot?.snapshotAt ?? null,
      best_odds_american:      oddsSnapshot?.bestOddsAmerican ?? null,
      best_odds_book:          oddsSnapshot?.bestOddsBook ?? null,
      odds_source_count:       oddsSnapshot?.sourceCount ?? 0,
      odds_is_stale:           false,
      game_start_time:         gameStartTime,
      refreshed_at:            runTs,
    })
  }

  console.log(`[InsiderFeed] Scored positions: ${scored.length}`)

  // ── Step 7: Write to cache (additive upsert, no full-replace) ─────────────

  // Purge previous days
  const { error: purgeErr } = await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .lt('cached_date', todayET)
  if (purgeErr) console.warn('[InsiderFeed] Purge failed:', purgeErr)

  const { error: lowStakePurgeErr } = await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .eq('cached_date', todayET)
    .lt('stake_usd', MIN_STAKE_USD)
  if (lowStakePurgeErr) {
    console.warn('[InsiderFeed] Failed to purge low-stake rows:', lowStakePurgeErr)
  }

  const { error: missingStartPurgeErr } = await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .eq('cached_date', todayET)
    .is('game_start_time', null)
  if (missingStartPurgeErr) {
    console.warn('[InsiderFeed] Failed to purge rows missing game_start_time:', missingStartPurgeErr)
  }

  const nowIsoForPurge = new Date().toISOString()
  const { error: livePurgeErr } = await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .eq('cached_date', todayET)
    .lte('game_start_time', nowIsoForPurge)
  if (livePurgeErr) {
    console.warn('[InsiderFeed] Failed to purge live rows:', livePurgeErr)
  }

  // Remove settled markets discovered in this run so the read path does not
  // keep surfacing same-day stale entries.
  if (settledSlugs.size > 0) {
    const settledSlugList = [...settledSlugs]
    for (let i = 0; i < settledSlugList.length; i += 500) {
      const chunk = settledSlugList.slice(i, i + 500)
      const { error: settledPurgeErr } = await (supabase as any)
        .from('insider_feed_cache')
        .delete()
        .eq('cached_date', todayET)
        .in('slug', chunk)
      if (settledPurgeErr) {
        console.warn('[InsiderFeed] Failed to purge settled rows chunk:', settledPurgeErr)
      }
    }
  }

  // Stamp each row with today's date
  for (const row of scored) {
    (row as any).cached_date = todayET
  }

  if (scored.length > 0) {
    // Upsert all rows so cached odds snapshots refresh every cycle.
    for (let i = 0; i < scored.length; i += 500) {
      const chunk = scored.slice(i, i + 500)
      const { error } = await (supabase as any)
        .from('insider_feed_cache')
        .upsert(chunk, { onConflict: 'wallet,slug,outcome', ignoreDuplicates: false })
      if (error) console.error(`[InsiderFeed] Cache upsert chunk ${i} failed:`, error)
    }
    console.log(`[InsiderFeed] Upserted ${scored.length} bets with odds snapshots`)
  }

  // Count how many are now in cache for today
  const { count: totalCached } = await (supabase as any)
    .from('insider_feed_cache')
    .select('*', { count: 'exact', head: true })
    .eq('cached_date', todayET)
    .gte('stake_usd', MIN_STAKE_USD)
    .gt('game_start_time', nowIsoForPurge)
  console.log(
    `[InsiderFeed] Total bets in cache for ${todayET} (>= $${MIN_STAKE_USD}): ${totalCached ?? '?'}`
  )

  return {
    walletsWithBets,
    positionsFound: allPositions.length,
    removedCompleted: removedCount,
    betsCached: scored.length,
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// 2c. refreshInsiderFeedCache() — Orchestrator (preserved signature)
// ══════════════════════════════════════════════════════════════════════════════

export async function refreshInsiderFeedCache(): Promise<InsiderFeedRefreshResult> {
  const discovery = await discoverInsiderWallets()
  const positions = await refreshInsiderPositions(POSITION_BATCH_SIZE)

  return {
    walletsScanned:    discovery.walletsScanned,
    walletsWithBets:   positions.walletsWithBets,
    positionsFound:    positions.positionsFound,
    removedCompleted:  positions.removedCompleted,
    betsCached:        positions.betsCached,
    reverseDiscovered: discovery.reverseDiscovered,
    holderDiscovered:  discovery.holderDiscovered,
  }
}
