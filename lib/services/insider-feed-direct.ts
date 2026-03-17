import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore, MIN_INSIDER_SCORE } from './polymarket-insider'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API        = 'https://data-api.polymarket.com'
const LEADERBOARD_URL = `${DATA_API}/v1/leaderboard`
const TRADES_URL      = `${DATA_API}/trades`

// Leaderboard: fetch top N wallets by all-time PNL
const LEADERBOARD_LIMIT  = 100

// Global trades: fetch this many pages of recent trades to find open positions.
// 1000 trades/page × 6 pages = 6,000 most-recent trades across all markets.
// Sports markets are short-lived (days), so recent global trades capture open positions.
const TRADES_PAGE_SIZE   = 1000
const TRADES_PAGES       = 6

const MIN_VOLUME         = 2_000  // $2k minimum lifetime volume
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
  // ── Step 1: Leaderboard — who are the top profitable traders? ────────────────
  const lbUrl = new URL(LEADERBOARD_URL)
  lbUrl.searchParams.set('timePeriod', 'ALL')
  lbUrl.searchParams.set('orderBy', 'PNL')
  lbUrl.searchParams.set('limit', String(LEADERBOARD_LIMIT))

  const lbRaw = await fetchJson(lbUrl.toString())
  if (!Array.isArray(lbRaw) || lbRaw.length === 0) {
    console.error('[InsiderFeed] Leaderboard fetch failed or empty')
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, betsCached: 0 }
  }

  // Build a qualified wallet set with their stats
  type WalletMeta = {
    roi: number; vol: number
    pseudonym: string | null; profileImageUrl: string | null
  }
  const qualifiedWallets = new Map<string, WalletMeta>()

  for (const row of lbRaw as LeaderboardEntry[]) {
    const wallet = String(row.proxyWallet ?? '').trim().toLowerCase()
    if (!wallet) continue
    const pnl = parseNum(row.pnl)
    const vol = parseNum(row.vol)
    if (!pnl || !vol || pnl <= 0 || vol < MIN_VOLUME) continue
    const roi = pnl / vol
    if (!Number.isFinite(roi) || roi <= 0) continue

    qualifiedWallets.set(wallet, {
      roi,
      vol,
      pseudonym:       typeof row.pseudonym    === 'string' ? row.pseudonym    : null,
      profileImageUrl: typeof row.profileImage === 'string' ? row.profileImage : null,
    })
  }

  if (qualifiedWallets.size === 0) {
    console.error('[InsiderFeed] No qualified wallets from leaderboard')
    return { walletsScanned: 0, walletsWithBets: 0, positionsFound: 0, betsCached: 0 }
  }

  // ── Step 2: Fetch recent global trades ────────────────────────────────────────
  // Group all trades by wallet (for qualified wallets only)
  const walletTrades = new Map<string, TradeEntry[]>()
  // Also track profile data from trade payloads (enriches leaderboard data)
  const tradeProfiles = new Map<string, { pseudonym: string | null; profileImageUrl: string | null }>()
  // Track buy-side stats for avg bet size scoring
  const walletBuyStats = new Map<string, { totalNotional: number; count: number }>()

  for (let page = 0; page < TRADES_PAGES; page++) {
    const url = new URL(TRADES_URL)
    url.searchParams.set('limit', String(TRADES_PAGE_SIZE))
    url.searchParams.set('offset', String(page * TRADES_PAGE_SIZE))

    const raw = await fetchJson(url.toString())
    if (!Array.isArray(raw) || raw.length === 0) break

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

      // Track buy-side stats for avg bet size
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

    // If we got fewer than a full page, no more data
    if ((raw as unknown[]).length < TRADES_PAGE_SIZE) break
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
