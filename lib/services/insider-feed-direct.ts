import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore } from './polymarket-insider'

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
const LEADERBOARD_CONCURRENCY = 10  // bump concurrency for faster crawl

// Per-wallet trade fetching — no cap, fetch ALL qualified wallets
const MIN_BUY_TRADES = 500  // wallet must have 500+ buy trades to be included
const TRADES_PER_WALLET    = 800  // trades to fetch per wallet
const WALLET_FETCH_CONCURRENCY = 10

const MIN_ROI            = 0.03
const MAX_ROI            = 0.25
const MIN_VOLUME         = 15_000  // lower bar to catch more NCAAB bettors
const MIN_NET_SHARES     = 1
const MIN_STAKE_USD      = 10
const FETCH_TIMEOUT_MS   = 15_000

const GAMMA_API       = 'https://gamma-api.polymarket.com'
const MARKET_FETCH_CONCURRENCY = 10

const SPORT_PREFIXES = [
  // North American leagues
  'nba-', 'wnba-', 'nfl-', 'cfb-', 'cbb-', 'ncaab-', 'ncaaf-',
  'nhl-', 'mlb-', 'mls-',
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
  nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL', mlb: 'MLB', mls: 'MLS',
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

// ── Helpers ────────────────────────────────────────────────────────────────────

const parseNum = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const isSportSlug = (slug: string) => SPORT_PREFIXES.some(p => slug.startsWith(p))

const sportLabel = (slug: string): string | null => {
  const prefix = SPORT_PREFIXES.find(p => slug.startsWith(p))
  if (!prefix) return null
  const key = prefix.slice(0, -1)
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

type FetchPricesResult = { prices: MarketPriceMap; settledSlugs: Set<string> }

async function fetchCurrentPrices(slugs: string[]): Promise<FetchPricesResult> {
  const priceMap: MarketPriceMap = new Map()
  const settledSlugs = new Set<string>()
  const uniqueSlugs = [...new Set(slugs)]

  for (let i = 0; i < uniqueSlugs.length; i += MARKET_FETCH_CONCURRENCY) {
    const batch = uniqueSlugs.slice(i, i + MARKET_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(async (slug) => {
        const url = `${GAMMA_API}/markets?slug=${encodeURIComponent(slug)}&limit=1`
        const raw = await fetchJson(url) as any[] | null
        // If Gamma returns nothing, treat as settled — a real upcoming
        // market always has data. This prevents stale positions leaking
        // through on transient API failures.
        if (!Array.isArray(raw) || raw.length === 0) return { slug, map: null, settled: true }
        const market = raw[0]

        // Detect settled/closed markets (acceptingOrders=false catches
        // markets where the game ended but Polymarket hasn't settled yet)
        const isSettled = market.closed === true || market.active === false || market.acceptingOrders === false
        if (isSettled) return { slug, map: null, settled: true }

        const outcomes = parseOutcomes(market.outcomes)
        const prices = parseOutcomePrices(market.outcomePrices)
        if (outcomes.length === 0 || outcomes.length !== prices.length) return null
        const map = new Map<string, number>()
        for (let j = 0; j < outcomes.length; j++) {
          map.set(outcomes[j], prices[j])
        }
        return { slug, map, settled: false }
      })
    )
    for (const r of results) {
      if (!r) continue
      if (r.settled) {
        settledSlugs.add(r.slug)
      } else if (r.map) {
        priceMap.set(r.slug, r.map)
      }
    }
  }

  return { prices: priceMap, settledSlugs }
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

// ── Slug helpers ─────────────────────────────────────────────────────────────

/**
 * Extract a YYYY-MM-DD date from a Polymarket slug if present.
 * Slugs look like "nba-nets-knicks-2026-03-20" or "nhl-ana-utah-2026-03-20".
 */
function extractDateFromSlug(slug: string): string | null {
  const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

// ── Position computation from trade list ──────────────────────────────────────

type PositionState = {
  shares:         number
  costBasis:      number
  title:          string
  outcome:        string
  slug:           string
  eventSlug:      string | null
  firstTradeTime: string | null
  lastTradeTime:  string | null
  buyCount:       number
}

function applyTrade(positions: Map<string, PositionState>, trade: TradeEntry) {
  const slug = trade.slug ?? ''
  if (!slug || !isSportSlug(slug)) return

  const size  = parseNum(trade.size)
  const price = parseNum(trade.price)
  if (!size || !price || size <= 0 || price <= 0) return

  const outcome = trade.outcome ?? 'YES'
  const key     = `${slug}::${outcome}`

  let pos = positions.get(key)
  if (!pos) {
    pos = { shares: 0, costBasis: 0, title: trade.title ?? slug, outcome, slug, eventSlug: trade.eventSlug ?? null, firstTradeTime: null, lastTradeTime: null, buyCount: 0 }
    positions.set(key, pos)
  }

  // Capture eventSlug from any trade that provides it
  if (!pos.eventSlug && trade.eventSlug) pos.eventSlug = trade.eventSlug

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

// ── Main pipeline ──────────────────────────────────────────────────────────────

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
const HOLDER_DISCOVERY_PREFIXES = ['nba-', 'cbb-', 'nhl-']
const HOLDER_DISCOVERY_MARKETS_PER_SPORT = 20
const HOLDER_DISCOVERY_CONCURRENCY = 10
const HOLDER_DISCOVERY_MAX_NEW_WALLETS = 150

export async function refreshInsiderFeedCache(): Promise<InsiderFeedRefreshResult> {
  // ── Step 1: Multi-strategy leaderboard discovery ────────────────────────────

  type WalletMeta = {
    roi: number; vol: number
    pseudonym: string | null; profileImageUrl: string | null
  }
  const qualifiedWallets = new Map<string, WalletMeta>()

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
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, removedCompleted: 0, betsCached: 0, reverseDiscovered: 0, holderDiscovered: 0 }
  }

  // ── Step 1.5: Reverse discovery via recent sport trades ──────────────────
  // Catches sport-specialist wallets the PNL leaderboard misses

  type ReverseWalletResult = {
    wallet: string
    trades: TradeEntry[]
    totalBuys: number
    totalBuyNotional: number
  }

  const REVERSE_DISCOVERY_PAGES = 3
  const REVERSE_DISCOVERY_LIMIT = 500
  const REVERSE_DISCOVERY_MAX_WALLETS = 100
  const REVERSE_WALLET_CONCURRENCY = 10

  let reverseDiscoveredCount = 0
  const reverseTradeResults: ReverseWalletResult[] = []

  try {
    // Fetch recent global trades (3 pages of 500)
    const globalTradePages = await Promise.all(
      Array.from({ length: REVERSE_DISCOVERY_PAGES }, (_, page) => {
        const url = new URL(TRADES_URL)
        url.searchParams.set('limit', String(REVERSE_DISCOVERY_LIMIT))
        if (page > 0) url.searchParams.set('offset', String(page * REVERSE_DISCOVERY_LIMIT))
        return fetchJson(url.toString())
      })
    )

    // Filter to sport slugs, extract unique wallet addresses not already known
    const newWalletAddresses = new Set<string>()
    for (const page of globalTradePages) {
      if (!Array.isArray(page)) continue
      for (const trade of page as TradeEntry[]) {
        const slug = trade.slug ?? ''
        if (!isSportSlug(slug)) continue
        const wallet = String(trade.proxyWallet ?? '').trim().toLowerCase()
        if (!wallet || qualifiedWallets.has(wallet)) continue
        newWalletAddresses.add(wallet)
      }
    }

    console.log(`[InsiderFeed] Reverse discovery: ${newWalletAddresses.size} new sport wallets found`)

    // For each new wallet (cap 100), fetch trades and compute approximate ROI
    const walletsToCheck = [...newWalletAddresses].slice(0, REVERSE_DISCOVERY_MAX_WALLETS)

    for (let i = 0; i < walletsToCheck.length; i += REVERSE_WALLET_CONCURRENCY) {
      const batch = walletsToCheck.slice(i, i + REVERSE_WALLET_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (wallet) => {
          const url = new URL(TRADES_URL)
          url.searchParams.set('user', wallet)
          url.searchParams.set('limit', String(TRADES_PER_WALLET))
          const raw = await fetchJson(url.toString())
          const trades = Array.isArray(raw) ? (raw as TradeEntry[]) : []

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

          // Approximate ROI from buy/sell data
          const vol = totalBuyNotional
          const pnl = totalSellNotional - totalBuyNotional
          const roi = vol > 0 ? pnl / vol : 0

          return { wallet, trades, totalBuys, totalBuyNotional, vol, roi }
        })
      )

      for (const r of results) {
        if (
          !Number.isFinite(r.roi) ||
          r.roi < MIN_ROI ||
          r.roi > MAX_ROI ||
          r.vol < MIN_VOLUME
        ) continue

        // Wallet qualifies — add to qualified pool
        qualifiedWallets.set(r.wallet, {
          roi: r.roi,
          vol: r.vol,
          pseudonym: null,
          profileImageUrl: null,
        })
        reverseTradeResults.push({
          wallet: r.wallet,
          trades: r.trades,
          totalBuys: r.totalBuys,
          totalBuyNotional: r.totalBuyNotional,
        })
        reverseDiscoveredCount++
      }
    }

    console.log(`[InsiderFeed] Reverse discovery: ${reverseDiscoveredCount} wallets qualified`)
  } catch (error) {
    console.warn('[InsiderFeed] Reverse discovery failed:', error)
  }

  // ── Step 1.6: Holder-based discovery for NBA, NCAAB, NHL ─────────────────
  // Find wallets holding positions in active target-sport markets via Gamma + /holders

  let holderDiscoveredCount = 0
  const holderTradeResults: ReverseWalletResult[] = []

  try {
    // Fetch active markets from Gamma (bulk, filter client-side by prefix)
    const gammaMarketsUrl = `${GAMMA_API}/markets?closed=false&active=true&limit=200&order=volume24hr&ascending=false`
    const gammaRaw = await fetchJson(gammaMarketsUrl) as any[] | null
    const gammaMarkets = Array.isArray(gammaRaw) ? gammaRaw : []

    // Filter to target sport prefixes and collect conditionIds
    const targetMarkets: { slug: string; conditionId: string }[] = []
    for (const m of gammaMarkets) {
      const slug = String(m.slug ?? '')
      const conditionId = String(m.conditionId ?? '')
      if (!conditionId || !HOLDER_DISCOVERY_PREFIXES.some(p => slug.startsWith(p))) continue
      targetMarkets.push({ slug, conditionId })
    }

    // Cap per sport to avoid over-fetching one sport
    const perSport = new Map<string, number>()
    const cappedMarkets = targetMarkets.filter(m => {
      const prefix = HOLDER_DISCOVERY_PREFIXES.find(p => m.slug.startsWith(p)) ?? ''
      const count = perSport.get(prefix) ?? 0
      if (count >= HOLDER_DISCOVERY_MARKETS_PER_SPORT) return false
      perSport.set(prefix, count + 1)
      return true
    })

    console.log(`[InsiderFeed] Holder discovery: ${cappedMarkets.length} target markets (${[...perSport.entries()].map(([p, c]) => `${p.slice(0,-1)}:${c}`).join(', ')})`)

    // Fetch holders for each market
    const holderWallets = new Set<string>()
    for (let i = 0; i < cappedMarkets.length; i += HOLDER_DISCOVERY_CONCURRENCY) {
      const batch = cappedMarkets.slice(i, i + HOLDER_DISCOVERY_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async ({ conditionId }) => {
          const url = `${DATA_API}/holders?market=${encodeURIComponent(conditionId)}&limit=100`
          const raw = await fetchJson(url) as any[] | null
          if (!Array.isArray(raw)) return []
          // Response is array of { token, holders: [...] }
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

    // For each new wallet (capped), fetch trades and compute ROI
    const holdersToCheck = [...holderWallets].slice(0, HOLDER_DISCOVERY_MAX_NEW_WALLETS)

    for (let i = 0; i < holdersToCheck.length; i += REVERSE_WALLET_CONCURRENCY) {
      const batch = holdersToCheck.slice(i, i + REVERSE_WALLET_CONCURRENCY)
      const results = await Promise.all(
        batch.map(async (wallet) => {
          const url = new URL(TRADES_URL)
          url.searchParams.set('user', wallet)
          url.searchParams.set('limit', String(TRADES_PER_WALLET))
          const raw = await fetchJson(url.toString())
          const trades = Array.isArray(raw) ? (raw as TradeEntry[]) : []

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

          const vol = totalBuyNotional
          const pnl = totalSellNotional - totalBuyNotional
          const roi = vol > 0 ? pnl / vol : 0

          return { wallet, trades, totalBuys, totalBuyNotional, vol, roi }
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
        })
        holderTradeResults.push({
          wallet: r.wallet,
          trades: r.trades,
          totalBuys: r.totalBuys,
          totalBuyNotional: r.totalBuyNotional,
        })
        holderDiscoveredCount++
      }
    }

    console.log(`[InsiderFeed] Holder discovery: ${holderDiscoveredCount} wallets qualified`)
  } catch (error) {
    console.warn('[InsiderFeed] Holder discovery failed:', error)
  }

  // ── Step 2: Per-wallet trade fetching ───────────────────────────────────────
  // Fetch trades for ALL qualified wallets (no cap). Filter by trade count after.

  const sortedWallets = [...qualifiedWallets.entries()]
    .sort((a, b) => b[1].roi - a[1].roi)

  console.log(`[InsiderFeed] Fetching trades for ${sortedWallets.length} qualified wallets`)

  type WalletTradeResult = {
    wallet: string
    trades: TradeEntry[]
    totalBuys: number
    totalBuyNotional: number
  }

  // Skip wallets already fetched during reverse/holder discovery
  const alreadyFetched = [...reverseTradeResults, ...holderTradeResults]
  const reverseWalletSet = new Set(alreadyFetched.map(r => r.wallet))

  async function fetchWalletTrades(wallet: string): Promise<WalletTradeResult> {
    const url = new URL(TRADES_URL)
    url.searchParams.set('user', wallet)
    url.searchParams.set('limit', String(TRADES_PER_WALLET))

    const raw = await fetchJson(url.toString())
    const trades = Array.isArray(raw) ? (raw as TradeEntry[]) : []

    let totalBuys = 0
    let totalBuyNotional = 0
    for (const t of trades) {
      if (t.side === 'BUY') {
        const size = parseNum(t.size)
        const price = parseNum(t.price)
        if (size && price && size > 0 && price > 0) {
          totalBuys++
          totalBuyNotional += size * price
        }
      }
    }

    return { wallet, trades, totalBuys, totalBuyNotional }
  }

  // Start with reverse + holder discovered wallet results (already fetched)
  const walletResults: WalletTradeResult[] = [...alreadyFetched]

  // Only fetch wallets not already fetched via reverse discovery
  const walletsToFetch = sortedWallets.filter(([w]) => !reverseWalletSet.has(w))
  for (let i = 0; i < walletsToFetch.length; i += WALLET_FETCH_CONCURRENCY) {
    const batch = walletsToFetch.slice(i, i + WALLET_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(([wallet]) => fetchWalletTrades(wallet))
    )
    walletResults.push(...results)
  }

  // Filter to wallets with enough buy trades to trust the ROI
  const walletsWithTrades = walletResults.filter(r => r.totalBuys >= MIN_BUY_TRADES)
  console.log(`[InsiderFeed] Wallets with ${MIN_BUY_TRADES}+ buy trades: ${walletsWithTrades.length}/${walletResults.length}`)

  // ── Step 3: Compute open sports positions per wallet ──────────────────────────
  type RawPosition = {
    wallet: string; slug: string; eventSlug: string | null; title: string; outcome: string;
    sportLabel: string | null; avgEntryPrice: number; shares: number;
    stakeUsd: number; potentialPayoutUsd: number;
    firstTradeTime: string | null; lastTradeTime: string | null;
    buyCount: number;
  }
  const allPositions: RawPosition[] = []

  for (const { wallet, trades } of walletsWithTrades) {
    const positions = new Map<string, PositionState>()
    for (const t of trades) applyTrade(positions, t)

    for (const pos of positions.values()) {
      if (pos.shares < MIN_NET_SHARES) continue
      const avgEntryPrice = pos.costBasis / pos.shares
      if (!Number.isFinite(avgEntryPrice) || avgEntryPrice <= 0) continue
      const stakeUsd = pos.costBasis
      if (stakeUsd < MIN_STAKE_USD) continue

      allPositions.push({
        wallet,
        slug:               pos.slug,
        eventSlug:          pos.eventSlug,
        title:              pos.title,
        outcome:            pos.outcome,
        sportLabel:         sportLabel(pos.slug),
        avgEntryPrice,
        shares:             pos.shares,
        stakeUsd,
        potentialPayoutUsd: pos.shares,
        firstTradeTime:     pos.firstTradeTime,
        lastTradeTime:      pos.lastTradeTime,
        buyCount:           pos.buyCount,
      })
    }
  }

  console.log(`[InsiderFeed] Open sport positions found: ${allPositions.length}`)

  // ── Step 3.5: Pre-filter obviously stale positions by slug date ──────────
  // Polymarket settlements don't generate SELL trades, so wallets carry
  // phantom "open" positions for games that ended weeks/months ago.
  // Use a 7-day window to cheaply remove ancient positions before the
  // more expensive Gamma API checks in Steps 4/4.5.
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 7)
  const cutoffStr = cutoffDate.toISOString().slice(0, 10) // YYYY-MM-DD

  const freshPositions = allPositions.filter((p) => {
    const slugDate = extractDateFromSlug(p.slug)
    // No date in slug → keep (can't determine age)
    if (!slugDate) return true
    // Slug date within last 7 days or future → keep
    return slugDate >= cutoffStr
  })
  console.log(`[InsiderFeed] After slug-date filter: ${freshPositions.length} (removed ${allPositions.length - freshPositions.length} stale)`)

  // ── Step 4: Fetch current market prices ───────────────────────────────────
  const uniqueSlugs = [...new Set(freshPositions.map(p => p.slug))]
  console.log(`[InsiderFeed] Fetching current prices for ${uniqueSlugs.length} markets`)
  const { prices: currentPrices, settledSlugs } = await fetchCurrentPrices(uniqueSlugs)
  console.log(`[InsiderFeed] Got prices for ${currentPrices.size} markets, ${settledSlugs.size} settled`)

  // Remove settled markets (Gamma API detected closed/inactive)
  const activePositions = freshPositions.filter(p => !settledSlugs.has(p.slug))
  const removedCount = freshPositions.length - activePositions.length
  console.log(`[InsiderFeed] Removed ${removedCount} settled positions`)

  // ── Step 5: Score positions ────────────────────────────────────────────────
  const runTs  = new Date().toISOString()
  const scored: Record<string, unknown>[] = []

  // Build per-wallet buy stats from fetched trades
  const walletBuyStatsMap = new Map<string, { totalNotional: number; count: number }>()
  for (const r of walletResults) {
    if (r.totalBuys > 0) {
      walletBuyStatsMap.set(r.wallet, { totalNotional: r.totalBuyNotional, count: r.totalBuys })
    }
  }

  // Build consensus map: how many unique wallets hold each slug+outcome?
  const consensusMap = new Map<string, Set<string>>()
  for (const pos of activePositions) {
    const key = `${pos.slug}::${pos.outcome}`
    let wallets = consensusMap.get(key)
    if (!wallets) {
      wallets = new Set()
      consensusMap.set(key, wallets)
    }
    wallets.add(pos.wallet)
  }

  for (const pos of activePositions) {
    const meta = qualifiedWallets.get(pos.wallet)
    if (!meta) continue

    const buyStat = walletBuyStatsMap.get(pos.wallet)
    const avgBetSize = buyStat && buyStat.count > 0
      ? buyStat.totalNotional / buyStat.count
      : 0
    if (avgBetSize <= 0) continue

    const buyTradeCount = buyStat?.count ?? 0
    const consensusKey = `${pos.slug}::${pos.outcome}`
    const consensus = consensusMap.get(consensusKey)?.size ?? 1

    const { score, sizeRatio, minThreshold } = computeInsiderScore(
      meta.roi,
      avgBetSize,
      pos.stakeUsd,
      consensus,
      buyTradeCount,
    )
    if (score < minThreshold) continue

    const americanOdds = probabilityToAmericanOdds(pos.avgEntryPrice)

    // Current market price for this outcome
    const slugPrices = currentPrices.get(pos.slug)
    const curPrice = slugPrices?.get(pos.outcome) ?? null
    const curAmericanOdds = curPrice !== null ? probabilityToAmericanOdds(curPrice) : null

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
      refreshed_at:            runTs,
    })
  }

  console.log(`[InsiderFeed] Scored positions passing threshold: ${scored.length}`)

  // ── Step 6: Write to cache ─────────────────────────────────────────────────
  const supabase = createServiceClient()

  // Determine today's date in Eastern time
  const todayET = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }) // YYYY-MM-DD

  // Clean up bets from previous days (midnight rollover)
  const { error: purgeErr } = await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .lt('cached_date', todayET)
  if (purgeErr) console.warn('[InsiderFeed] Purge failed:', purgeErr)

  // Check how many bets exist for today already
  const { count: existingCount } = await (supabase as any)
    .from('insider_feed_cache')
    .select('*', { count: 'exact', head: true })
    .eq('cached_date', todayET)
  const existing = existingCount ?? 0

  // If the cache has fewer bets than this refresh produced, do a full
  // replace — this handles first-run-of-day and recovery from bad state.
  // Otherwise, additive insert only (preserving scores).
  const shouldReplace = scored.length > existing
  if (shouldReplace && existing > 0) {
    console.log(`[InsiderFeed] Full replace: ${scored.length} new > ${existing} existing`)
    await (supabase as any)
      .from('insider_feed_cache')
      .delete()
      .eq('cached_date', todayET)
  }

  // Stamp each new bet with today's date
  for (const row of scored) {
    (row as any).cached_date = todayET
  }

  if (scored.length > 0) {
    if (shouldReplace) {
      // Full insert
      const { error } = await (supabase as any)
        .from('insider_feed_cache')
        .insert(scored)
      if (error) console.error('[InsiderFeed] Cache insert failed:', error)
    } else {
      // Additive — ignoreDuplicates preserves existing rows (scores stay locked)
      const { error } = await (supabase as any)
        .from('insider_feed_cache')
        .upsert(scored, { onConflict: 'wallet,slug,outcome', ignoreDuplicates: true })
      if (error) console.error('[InsiderFeed] Cache upsert failed:', error)
    }
    console.log(`[InsiderFeed] Wrote ${scored.length} bets (${shouldReplace ? 'full replace' : 'additive'})`)
  }

  // Count how many are now in cache for today
  const { count: totalCached } = await (supabase as any)
    .from('insider_feed_cache')
    .select('*', { count: 'exact', head: true })
    .eq('cached_date', todayET)
  console.log(`[InsiderFeed] Total bets in cache for ${todayET}: ${totalCached ?? '?'}`)

  return {
    walletsScanned:   qualifiedWallets.size,
    walletsWithBets:  walletsWithTrades.length,
    positionsFound:   allPositions.length,
    removedCompleted: removedCount,
    betsCached:       scored.length,
    reverseDiscovered: reverseDiscoveredCount,
    holderDiscovered: holderDiscoveredCount,
  }
}
