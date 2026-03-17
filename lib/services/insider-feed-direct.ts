import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore, MIN_INSIDER_SCORE } from './polymarket-insider'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API        = 'https://data-api.polymarket.com'
const LEADERBOARD_URL = `${DATA_API}/v1/leaderboard`
const TRADES_URL      = `${DATA_API}/trades`

// Leaderboard: multiple queries with different strategies to discover diverse wallets.
// Each strategy returns up to LEADERBOARD_PAGE_SIZE wallets; results are merged/deduped.
const LEADERBOARD_PAGE_SIZE = 60

// Discovery strategies: [timePeriod, orderBy, offset]
// Vary time windows, sort orders, and pagination to avoid always seeing the same whales.
const LEADERBOARD_STRATEGIES: Array<[string, string, number]> = [
  ['ALL',   'PNL',    0],    // all-time top earners (page 1)
  ['ALL',   'PNL',    60],   // all-time top earners (page 2)
  ['ALL',   'VOLUME', 0],    // all-time highest volume
  ['WEEK',  'PNL',    0],    // this week's winners
  ['MONTH', 'PNL',    0],    // this month's winners
  ['DAY',   'PNL',    0],    // today's movers
]
const LEADERBOARD_CONCURRENCY = 3  // strategies fetched in parallel

// Global trades: fetch recent trades in small parallel batches.
// Smaller pages = faster individual responses, less likely to hang.
// More pages = broader historical coverage to catch all open positions.
// 400 trades/page × 20 pages = 8,000 trades, fetched 5 at a time (~4 rounds).
const TRADES_PAGE_SIZE      = 400
const TRADES_PAGES          = 20
const TRADES_PAGE_CONCURRENCY = 5  // pages fetched in parallel per round

const MIN_VOLUME         = 2_000  // $2k minimum lifetime volume
const MIN_ROI            = 0      // no ROI floor — we show whatever the leaderboard has
const MIN_NET_SHARES     = 1
const MIN_STAKE_USD      = 10
const FETCH_TIMEOUT_MS   = 12_000 // per-request timeout

// Same sport slug prefixes as whale-detector + wallet-ingest
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
  proxyWallet?:  string
  pseudonym?:    string
  profileImage?: string
  pnl?:          number | string
  vol?:          number | string
  numTrades?:    number | string
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
  pseudonym?:    string
  profileImage?: string
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

// Promise.race timeout — more reliable than AbortController on Vercel
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
    pos = { shares: 0, costBasis: 0, title: trade.title ?? slug, outcome, slug, lastTradeTime: null }
    positions.set(key, pos)
  }

  if (trade.side === 'BUY') {
    pos.shares    += size
    pos.costBasis += size * price
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
  // Fetch multiple leaderboard views in parallel to discover diverse wallets.
  // Different time periods + sort orders surface different profitable traders.

  type WalletMeta = {
    roi: number; vol: number; tradeCount: number | null
    pseudonym: string | null; profileImageUrl: string | null
  }
  const qualifiedWallets = new Map<string, WalletMeta>()
  let loggedSample = false

  const processLeaderboardPage = (rows: LeaderboardEntry[]) => {
    for (const row of rows) {
      const wallet = String(row.proxyWallet ?? '').trim().toLowerCase()
      if (!wallet) continue
      const pnl = parseNum(row.pnl)
      const vol = parseNum(row.vol)
      if (!pnl || !vol || pnl <= 0 || vol < MIN_VOLUME) continue
      const roi = pnl / vol
      if (!Number.isFinite(roi) || roi <= MIN_ROI) continue

      // Keep the entry with the best ROI if we see the same wallet from multiple strategies
      const existing = qualifiedWallets.get(wallet)
      if (existing && existing.roi >= roi) continue

      const tradeCount = parseNum(row.numTrades)
      qualifiedWallets.set(wallet, {
        roi,
        vol,
        tradeCount,
        pseudonym:       typeof row.pseudonym    === 'string' ? row.pseudonym    : null,
        profileImageUrl: typeof row.profileImage === 'string' ? row.profileImage : null,
      })
    }
  }

  // Fetch strategies in parallel batches
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
        console.warn(`[InsiderFeed] Leaderboard strategy ${tp}/${ob}/+${off} failed`)
        continue
      }

      // Log the first successful response to see field names
      if (!loggedSample && raw.length > 0) {
        loggedSample = true
        console.log('[InsiderFeed] Leaderboard sample keys:', Object.keys(raw[0] as object))
        console.log('[InsiderFeed] Leaderboard sample:', JSON.stringify(raw[0]).slice(0, 500))
      }

      console.log(`[InsiderFeed] Strategy ${tp}/${ob}/+${off}: ${raw.length} entries`)
      processLeaderboardPage(raw as LeaderboardEntry[])
    }
  }

  console.log(`[InsiderFeed] Total unique qualified wallets: ${qualifiedWallets.size}`)
  const roiSample = [...qualifiedWallets.values()].slice(0, 5).map(w =>
    `roi=${(w.roi * 100).toFixed(1)}% vol=$${Math.round(w.vol)} trades=${w.tradeCount ?? 'N/A'}`
  )
  console.log('[InsiderFeed] Sample wallet stats:', roiSample.join(' | '))

  if (qualifiedWallets.size === 0) {
    console.error('[InsiderFeed] No qualified wallets from any leaderboard strategy')
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, betsCached: 0 }
  }

  // ── Step 2: Fetch recent global trades ────────────────────────────────────────
  // Group all trades by wallet (for qualified wallets only)
  const walletTrades = new Map<string, TradeEntry[]>()
  // Also track profile data from trade payloads (enriches leaderboard data)
  const tradeProfiles = new Map<string, { pseudonym: string | null; profileImageUrl: string | null }>()
  // Track buy-side stats for avg bet size scoring
  const walletBuyStats = new Map<string, { totalNotional: number; count: number }>()

  // Fetch pages in parallel rounds (TRADES_PAGE_CONCURRENCY pages at a time)
  let exhausted = false
  for (let round = 0; round < TRADES_PAGES && !exhausted; round += TRADES_PAGE_CONCURRENCY) {
    const pageNums = Array.from(
      { length: Math.min(TRADES_PAGE_CONCURRENCY, TRADES_PAGES - round) },
      (_, i) => round + i,
    )

    const pages = await Promise.all(
      pageNums.map(page => {
        const url = new URL(TRADES_URL)
        url.searchParams.set('limit', String(TRADES_PAGE_SIZE))
        url.searchParams.set('offset', String(page * TRADES_PAGE_SIZE))
        return fetchJson(url.toString())
      })
    )

    for (const raw of pages) {
      if (!Array.isArray(raw) || raw.length === 0) { exhausted = true; break }

      for (const trade of raw as TradeEntry[]) {
        const wallet = String(trade.proxyWallet ?? '').trim().toLowerCase()
        if (!wallet || !qualifiedWallets.has(wallet)) continue

        // Store trade
        let list = walletTrades.get(wallet)
        if (!list) { list = []; walletTrades.set(wallet, list) }
        list.push(trade)

        // Capture profile info from trade payload
        if (!tradeProfiles.has(wallet)) {
          tradeProfiles.set(wallet, {
            pseudonym:       typeof trade.pseudonym    === 'string' ? trade.pseudonym    : null,
            profileImageUrl: typeof trade.profileImage === 'string' ? trade.profileImage : null,
          })
        }

        // Track buy-side stats for avg bet size scoring
        if (trade.side === 'BUY') {
          const size  = parseNum(trade.size)
          const price = parseNum(trade.price)
          if (size && price && size > 0 && price > 0) {
            const existing = walletBuyStats.get(wallet) ?? { totalNotional: 0, count: 0 }
            existing.totalNotional += size * price
            existing.count         += 1
            walletBuyStats.set(wallet, existing)
          }
        }
      }

      // Short page = API has no more data
      if ((raw as unknown[]).length < TRADES_PAGE_SIZE) { exhausted = true; break }
    }
  }

  console.log(`[InsiderFeed] Wallets seen in global trades: ${walletTrades.size}`)
  // Log per-wallet buy counts to see if they're realistic
  for (const [wallet, stat] of walletBuyStats) {
    const meta = qualifiedWallets.get(wallet)
    console.log(`[InsiderFeed] wallet=${wallet.slice(0, 8)}... buys=${stat.count} avgSize=$${(stat.totalNotional / stat.count).toFixed(0)} lbRoi=${meta ? (meta.roi * 100).toFixed(1) : '?'}% lbTrades=${meta?.tradeCount ?? 'N/A'}`)
  }

  // ── Step 3: Compute open sports positions per wallet ──────────────────────────
  type RawPosition = {
    wallet: string; slug: string; title: string; outcome: string;
    sportLabel: string | null; avgEntryPrice: number; shares: number;
    stakeUsd: number; potentialPayoutUsd: number; lastTradeTime: string | null;
  }
  const allPositions: RawPosition[] = []

  for (const [wallet, trades] of walletTrades) {
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
      })
    }
  }

  // ── Step 4: Score positions ────────────────────────────────────────────────
  const runTs  = new Date().toISOString()
  const scored: Record<string, unknown>[] = []

  for (const pos of allPositions) {
    const meta     = qualifiedWallets.get(pos.wallet)
    if (!meta) continue

    const buyStat  = walletBuyStats.get(pos.wallet)
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

    const profile = tradeProfiles.get(pos.wallet)
    const americanOdds = probabilityToAmericanOdds(pos.avgEntryPrice)

    scored.push({
      wallet:                  pos.wallet,
      pseudonym:               profile?.pseudonym       ?? meta.pseudonym,
      profile_image_url:       profile?.profileImageUrl ?? meta.profileImageUrl,
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

  // ── Step 5: Write to cache ─────────────────────────────────────────────────
  const supabase = createServiceClient()

  if (scored.length > 0) {
    const { error } = await (supabase as any)
      .from('insider_feed_cache')
      .upsert(scored, { onConflict: 'wallet,slug,outcome' })
    if (error) console.error('[InsiderFeed] Cache upsert failed:', error)
  }

  // Clean up stale rows (> 2 hours old)
  const staleTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .lt('refreshed_at', staleTs)

  return {
    walletsScanned:  qualifiedWallets.size,
    walletsWithBets: walletTrades.size,
    positionsFound:  allPositions.length,
    betsCached:      scored.length,
  }
}
