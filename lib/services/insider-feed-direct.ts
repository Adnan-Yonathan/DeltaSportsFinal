import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore, MIN_INSIDER_SCORE } from './polymarket-insider'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API        = 'https://data-api.polymarket.com'
const LEADERBOARD_URL = `${DATA_API}/v1/leaderboard`
const TRADES_URL      = `${DATA_API}/trades`

const LEADERBOARD_PAGE_SIZE = 60

// Discovery strategies: [timePeriod, orderBy, offset]
// ALL/VOLUME removed — API does not support orderBy=VOLUME
const LEADERBOARD_STRATEGIES: Array<[string, string, number]> = [
  ['ALL',   'PNL',  0],    // all-time top earners (page 1)
  ['ALL',   'PNL',  60],   // all-time top earners (page 2)
  ['WEEK',  'PNL',  0],    // this week's winners
  ['MONTH', 'PNL',  0],    // this month's winners
  ['DAY',   'PNL',  0],    // today's movers
]
const LEADERBOARD_CONCURRENCY = 3

// Per-wallet trade fetching
const TOP_WALLETS_TO_FETCH = 40   // fetch trades for top N wallets by ROI
const TRADES_PER_WALLET    = 200  // trades to fetch per wallet
const WALLET_FETCH_CONCURRENCY = 5

const MIN_VOLUME         = 2_000
const MIN_ROI            = 0
const MIN_NET_SHARES     = 1
const MIN_STAKE_USD      = 10
const FETCH_TIMEOUT_MS   = 12_000

const SPORT_PREFIXES = [
  'nba-', 'wnba-', 'nfl-', 'cfb-', 'cbb-', 'ncaab-', 'ncaaf-',
  'nhl-', 'mlb-', 'soccer-', 'tennis-', 'mma-', 'boxing-', 'ufc-',
  'golf-', 'cricket-', 'esports-', 'racing-',
]

const SPORT_LABEL_MAP: Record<string, string> = {
  nba: 'NBA', wnba: 'WNBA', nfl: 'NFL',
  cfb: 'NCAAF', cbb: 'NCAAB', ncaab: 'NCAAB', ncaaf: 'NCAAF',
  nhl: 'NHL', mlb: 'MLB', soccer: 'SOCCER',
  tennis: 'TENNIS', mma: 'MMA', boxing: 'BOXING',
  ufc: 'UFC', golf: 'GOLF',
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

// ── Position computation from trade list ──────────────────────────────────────

type PositionState = {
  shares:        number
  costBasis:     number
  title:         string
  outcome:       string
  slug:          string
  lastTradeTime: string | null
  buyCount:      number
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
    pos = { shares: 0, costBasis: 0, title: trade.title ?? slug, outcome, slug, lastTradeTime: null, buyCount: 0 }
    positions.set(key, pos)
  }

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
    if (!pos.lastTradeTime || iso > pos.lastTradeTime) pos.lastTradeTime = iso
  }
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

export type InsiderFeedRefreshResult = {
  walletsScanned:   number
  walletsWithBets:  number
  positionsFound:   number
  betsCached:       number
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
      if (!Number.isFinite(roi) || roi <= MIN_ROI) continue

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
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, betsCached: 0 }
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
    wallet: string; slug: string; title: string; outcome: string;
    sportLabel: string | null; avgEntryPrice: number; shares: number;
    stakeUsd: number; potentialPayoutUsd: number; lastTradeTime: string | null;
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
        title:              pos.title,
        outcome:            pos.outcome,
        sportLabel:         sportLabel(pos.slug),
        avgEntryPrice,
        shares:             pos.shares,
        stakeUsd,
        potentialPayoutUsd: pos.shares,
        lastTradeTime:      pos.lastTradeTime,
        buyCount:           pos.buyCount,
      })
    }
  }

  console.log(`[InsiderFeed] Open sport positions found: ${allPositions.length}`)

  // ── Step 4: Score positions ────────────────────────────────────────────────
  const runTs  = new Date().toISOString()
  const scored: Record<string, unknown>[] = []

  // Build per-wallet buy stats from fetched trades
  const walletBuyStatsMap = new Map<string, { totalNotional: number; count: number }>()
  for (const r of walletResults) {
    if (r.totalBuys > 0) {
      walletBuyStatsMap.set(r.wallet, { totalNotional: r.totalBuyNotional, count: r.totalBuys })
    }
  }

  for (const pos of allPositions) {
    const meta = qualifiedWallets.get(pos.wallet)
    if (!meta) continue

    const buyStat = walletBuyStatsMap.get(pos.wallet)
    const avgBetSize = buyStat && buyStat.count > 0
      ? buyStat.totalNotional / buyStat.count
      : 0
    if (avgBetSize <= 0) continue

    const buyTradeCount = buyStat?.count ?? 0

    const { score, sizeRatio } = computeInsiderScore(
      buyTradeCount,
      meta.roi,
      1.5,   // profit_factor placeholder
      0.55,  // win_rate placeholder
      avgBetSize,
      pos.stakeUsd,
    )
    if (score < MIN_INSIDER_SCORE) continue

    const americanOdds = probabilityToAmericanOdds(pos.avgEntryPrice)

    scored.push({
      wallet:                  pos.wallet,
      pseudonym:               meta.pseudonym,
      profile_image_url:       meta.profileImageUrl,
      title:                   pos.title,
      outcome:                 pos.outcome,
      sport_label:             pos.sportLabel,
      slug:                    pos.slug,
      avg_entry_price:         Math.round(pos.avgEntryPrice * 10_000) / 10_000,
      avg_entry_american_odds: Number.isFinite(americanOdds) ? americanOdds : null,
      stake_usd:               Math.round(pos.stakeUsd * 100) / 100,
      potential_payout_usd:    Math.round(pos.potentialPayoutUsd * 100) / 100,
      last_trade_time:         pos.lastTradeTime,
      insider_score:           score,
      size_ratio:              sizeRatio,
      wallet_roi_pct:          Math.round(meta.roi * 100 * 10) / 10,
      wallet_trade_count:      buyTradeCount,
      wallet_profit_factor:    0,
      refreshed_at:            runTs,
    })
  }

  console.log(`[InsiderFeed] Scored positions passing threshold: ${scored.length}`)

  // ── Step 5: Write to cache ─────────────────────────────────────────────────
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
    walletsScanned:  qualifiedWallets.size,
    walletsWithBets: walletsWithTrades.length,
    positionsFound:  allPositions.length,
    betsCached:      scored.length,
  }
}
