import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { fetchAllLiveScores, type LiveScoreGame } from '@/lib/live-scores'
import { computeInsiderScore } from './polymarket-insider'
import { normalizeTeamName, extractTeamsFromTitle, ESPN_SPORT_TO_LEAGUE } from './whale-trades-daily'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API        = 'https://data-api.polymarket.com'
const LEADERBOARD_URL = `${DATA_API}/v1/leaderboard`
const TRADES_URL      = `${DATA_API}/trades`

const LEADERBOARD_PAGE_SIZE = 100

// Discovery strategies: [timePeriod, orderBy, offset]
const LEADERBOARD_STRATEGIES: Array<[string, string, number]> = [
  ['ALL',   'PNL',  0],    // all-time top earners (page 1)
  ['ALL',   'PNL',  100],  // all-time top earners (page 2)
  ['ALL',   'PNL',  200],  // all-time top earners (page 3)
  ['ALL',   'PNL',  300],  // all-time top earners (page 4)
  ['WEEK',  'PNL',  0],    // this week's winners (page 1)
  ['WEEK',  'PNL',  100],  // this week's winners (page 2)
  ['MONTH', 'PNL',  0],    // this month's winners (page 1)
  ['MONTH', 'PNL',  100],  // this month's winners (page 2)
  ['DAY',   'PNL',  0],    // today's movers (page 1)
  ['DAY',   'PNL',  100],  // today's movers (page 2)
]
const LEADERBOARD_CONCURRENCY = 5

// Per-wallet trade fetching
const TOP_WALLETS_TO_FETCH = 300  // fetch trades for top N wallets by ROI
const TRADES_PER_WALLET    = 800  // trades to fetch per wallet
const WALLET_FETCH_CONCURRENCY = 10

const MIN_ROI            = 0.02
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

// ── ESPN live/completed game filtering ──────────────────────────────────────

/**
 * Extract a YYYY-MM-DD date from a Polymarket slug if present.
 * Slugs look like "nba-nets-knicks-2026-03-20" or "nhl-ana-utah-2026-03-20".
 */
function extractDateFromSlug(slug: string): string | null {
  const m = slug.match(/(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

async function getCompletedOrLiveSlugs(
  positions: { slug: string; title: string; sportLabel: string | null }[]
): Promise<Set<string>> {
  const removeSlugs = new Set<string>()

  // Only check positions with ESPN-supported sports
  const espnPositions = positions.filter(
    (p) => p.sportLabel && p.sportLabel in ESPN_SPORT_TO_LEAGUE
  )
  if (espnPositions.length === 0) return removeSlugs

  try {
    // Fetch ESPN data for today + past 2 days to cover the 3-day NCAAB window
    const today = new Date()
    const dates = [0, -1, -2].map((offset) => {
      const d = new Date(today)
      d.setDate(d.getDate() + offset)
      return d.toISOString().slice(0, 10)
    })

    const allGamesResults = await Promise.all(
      dates.map((date) =>
        fetchAllLiveScores({ date, includeCompletedForDate: true })
          .then((r) => r.games)
          .catch(() => [] as LiveScoreGame[])
      )
    )

    // Dedupe games by id across date fetches
    const seenIds = new Set<string>()
    const liveOrDone: LiveScoreGame[] = []
    for (const games of allGamesResults) {
      for (const g of games) {
        if ((g.bucket === 'live' || g.bucket === 'completed') && !seenIds.has(g.id)) {
          seenIds.add(g.id)
          liveOrDone.push(g)
        }
      }
    }
    if (liveOrDone.length === 0) return removeSlugs

    // Index games by league for fast lookup
    const gamesByLeague = new Map<string, LiveScoreGame[]>()
    for (const g of liveOrDone) {
      let list = gamesByLeague.get(g.league)
      if (!list) {
        list = []
        gamesByLeague.set(g.league, list)
      }
      list.push(g)
    }

    for (const pos of espnPositions) {
      const leagues = ESPN_SPORT_TO_LEAGUE[pos.sportLabel!] ?? []
      const relevantGames = leagues.flatMap((l) => gamesByLeague.get(l) ?? [])
      if (relevantGames.length === 0) continue

      const marketTeams = extractTeamsFromTitle(pos.title)
      if (marketTeams.length === 0) continue

      // Extract date from slug (e.g. "nba-nets-knicks-2026-03-20" → "2026-03-20")
      // to avoid matching a completed game from yesterday against today's game
      const slugDate = extractDateFromSlug(pos.slug)

      for (const game of relevantGames) {
        // If the slug has a date and it doesn't match the game date, skip
        if (slugDate && game.gameDate !== slugDate) continue

        const gameTeams = game.competitors.flatMap((c) => [
          normalizeTeamName(c.name),
          normalizeTeamName(c.shortName),
          normalizeTeamName(c.abbreviation),
        ])

        const hasMatch = marketTeams.some((mt) =>
          gameTeams.some((gt) => gt.includes(mt) || mt.includes(gt))
        )

        if (hasMatch) {
          removeSlugs.add(pos.slug)
          break
        }
      }
    }
  } catch (error) {
    console.warn('[InsiderFeed] ESPN live/completed check failed:', error)
  }

  return removeSlugs
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
}

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
      batch.map(([timePeriod, orderBy, offset]) => {
        const url = new URL(LEADERBOARD_URL)
        url.searchParams.set('timePeriod', timePeriod)
        url.searchParams.set('orderBy', orderBy)
        url.searchParams.set('limit', String(LEADERBOARD_PAGE_SIZE))
        if (offset > 0) url.searchParams.set('offset', String(offset))
        return fetchJson(url.toString())
      })
    )

    for (let j = 0; j < results.length; j++) {
      const raw = results[j]
      const [tp, ob, off] = batch[j]
      if (!Array.isArray(raw)) {
        console.warn(`[InsiderFeed] Strategy ${tp}/${ob}/+${off} failed`)
        continue
      }
      console.log(`[InsiderFeed] Strategy ${tp}/${ob}/+${off}: ${raw.length} entries`)
      processLeaderboardPage(raw as LeaderboardEntry[])
    }
  }

  console.log(`[InsiderFeed] Total unique qualified wallets: ${qualifiedWallets.size}`)

  if (qualifiedWallets.size === 0) {
    console.error('[InsiderFeed] No qualified wallets from any leaderboard strategy')
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, removedCompleted: 0, betsCached: 0 }
  }

  // ── Step 2: Per-wallet trade fetching ───────────────────────────────────────
  // Sort wallets by ROI descending, take top N, fetch each wallet's trades directly.

  const sortedWallets = [...qualifiedWallets.entries()]
    .sort((a, b) => b[1].roi - a[1].roi)
    .slice(0, TOP_WALLETS_TO_FETCH)

  console.log(`[InsiderFeed] Fetching trades for top ${sortedWallets.length} wallets by ROI`)

  type WalletTradeResult = {
    wallet: string
    trades: TradeEntry[]
    totalBuys: number
    totalBuyNotional: number
  }

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

  const walletResults: WalletTradeResult[] = []
  for (let i = 0; i < sortedWallets.length; i += WALLET_FETCH_CONCURRENCY) {
    const batch = sortedWallets.slice(i, i + WALLET_FETCH_CONCURRENCY)
    const results = await Promise.all(
      batch.map(([wallet]) => fetchWalletTrades(wallet))
    )
    walletResults.push(...results)
  }

  const walletsWithTrades = walletResults.filter(r => r.trades.length > 0)
  console.log(`[InsiderFeed] Wallets with trades: ${walletsWithTrades.length}/${sortedWallets.length}`)

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

  // ── Step 3.5: Pre-filter stale positions by slug date ────────────────────
  // Polymarket settlements don't generate SELL trades, so wallets carry
  // phantom "open" positions for games that ended days/weeks ago.
  // Drop any position whose slug date is before yesterday.
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const cutoffDate = yesterday.toISOString().slice(0, 10) // YYYY-MM-DD

  const freshPositions = allPositions.filter((p) => {
    const slugDate = extractDateFromSlug(p.slug)
    // No date in slug → keep (can't determine age)
    if (!slugDate) return true
    // Slug date >= yesterday → keep
    return slugDate >= cutoffDate
  })
  console.log(`[InsiderFeed] After slug-date filter: ${freshPositions.length} (removed ${allPositions.length - freshPositions.length} stale)`)

  // ── Step 4: Fetch current market prices ───────────────────────────────────
  const uniqueSlugs = [...new Set(freshPositions.map(p => p.slug))]
  console.log(`[InsiderFeed] Fetching current prices for ${uniqueSlugs.length} markets`)
  const { prices: currentPrices, settledSlugs } = await fetchCurrentPrices(uniqueSlugs)
  console.log(`[InsiderFeed] Got prices for ${currentPrices.size} markets, ${settledSlugs.size} settled`)

  // ── Step 4.5: Remove completed/live games ─────────────────────────────────
  const espnRemoveSlugs = await getCompletedOrLiveSlugs(freshPositions)
  const removeSlugs = new Set([...settledSlugs, ...espnRemoveSlugs])
  const activePositions = freshPositions.filter(p => !removeSlugs.has(p.slug))
  const removedCount = freshPositions.length - activePositions.length
  console.log(`[InsiderFeed] Removed ${removedCount} positions (${settledSlugs.size} settled, ${espnRemoveSlugs.size} ESPN live/completed)`)

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
      pos.sportLabel,
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

  // Clear entire cache first to remove stale/broken entries
  await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .neq('id', 0)  // delete all rows

  if (scored.length > 0) {
    const { error } = await (supabase as any)
      .from('insider_feed_cache')
      .upsert(scored, { onConflict: 'wallet,slug,outcome' })
    if (error) console.error('[InsiderFeed] Cache upsert failed:', error)
  }

  return {
    walletsScanned:   qualifiedWallets.size,
    walletsWithBets:  walletsWithTrades.length,
    positionsFound:   allPositions.length,
    removedCompleted: removedCount,
    betsCached:       scored.length,
  }
}
