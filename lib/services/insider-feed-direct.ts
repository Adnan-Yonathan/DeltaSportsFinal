import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { computeInsiderScore, MIN_INSIDER_SCORE } from './polymarket-insider'

// ── Constants ─────────────────────────────────────────────────────────────────

const DATA_API            = 'https://data-api.polymarket.com'
const LEADERBOARD_URL     = `${DATA_API}/v1/leaderboard`
const TRADES_URL          = `${DATA_API}/trades`

const LEADERBOARD_LIMIT   = 150   // wallets to fetch from leaderboard
const WALLET_LIMIT        = 75    // max wallets to fetch trades for (top by ROI)
const TRADES_PER_WALLET   = 500   // trades to scan per wallet
const CONCURRENCY         = 10    // parallel wallet trade fetches
const MIN_VOLUME          = 2_000 // $2k minimum lifetime volume
const MIN_NET_SHARES      = 1     // at least 1 share to be an "open position"
const MIN_STAKE_USD       = 10    // minimum stake to include
const FETCH_TIMEOUT_MS    = 8_000

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
  proxyWallet?: string
  pseudonym?:   string
  profileImage?: string
  pnl?:         number | string
  vol?:         number | string
  numTrades?:   number | string
}

type TradeEntry = {
  proxyWallet?: string
  side?:        string
  size?:        number | string
  price?:       number | string
  timestamp?:   number | string
  title?:       string
  slug?:        string
  outcome?:     string
  pseudonym?:   string
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
  const key = prefix.slice(0, -1) // strip trailing '-'
  return SPORT_LABEL_MAP[key] ?? null
}

async function fetchWithTimeout(url: string): Promise<unknown> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, { cache: 'no-store', signal: controller.signal })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function runBatched<T>(
  items: T[],
  fn: (item: T) => Promise<void>,
  concurrency: number,
): Promise<void> {
  for (let i = 0; i < items.length; i += concurrency) {
    await Promise.all(items.slice(i, i + concurrency).map(fn))
  }
}

// ── Position computation from raw trades ──────────────────────────────────────

type PositionState = {
  shares:        number
  costBasis:     number
  title:         string
  outcome:       string
  slug:          string
  lastTradeTime: string | null
}

function computeOpenSportsPositions(
  wallet: string,
  trades: TradeEntry[],
): Array<{
  wallet: string; slug: string; title: string; outcome: string;
  sportLabel: string | null; avgEntryPrice: number; shares: number;
  stakeUsd: number; potentialPayoutUsd: number; lastTradeTime: string | null;
}> {
  const positions = new Map<string, PositionState>()

  for (const t of trades) {
    const slug = t.slug ?? ''
    if (!slug || !isSportSlug(slug)) continue

    const size  = parseNum(t.size)
    const price = parseNum(t.price)
    if (!size || !price || size <= 0 || price <= 0) continue

    const outcome = t.outcome ?? 'YES'
    const key     = `${slug}::${outcome}`

    let pos = positions.get(key)
    if (!pos) {
      pos = {
        shares: 0, costBasis: 0,
        title: t.title ?? slug, outcome, slug,
        lastTradeTime: null,
      }
      positions.set(key, pos)
    }

    if (t.side === 'BUY') {
      pos.shares    += size
      pos.costBasis += size * price
    } else if (t.side === 'SELL') {
      // Reduce cost basis proportionally
      const sellFrac  = Math.min(size / Math.max(pos.shares, 0.0001), 1)
      pos.shares      = Math.max(0, pos.shares - size)
      pos.costBasis  *= (1 - sellFrac)
    }

    const ts = parseNum(t.timestamp)
    if (ts) {
      const iso = new Date(ts * 1000).toISOString()
      if (!pos.lastTradeTime || iso > pos.lastTradeTime) pos.lastTradeTime = iso
    }
  }

  const result = []
  for (const pos of positions.values()) {
    if (pos.shares < MIN_NET_SHARES) continue

    const avgEntryPrice = pos.costBasis / pos.shares
    if (!Number.isFinite(avgEntryPrice) || avgEntryPrice <= 0) continue

    const stakeUsd        = pos.costBasis
    const potentialPayout = pos.shares // each share = $1 if wins

    if (stakeUsd < MIN_STAKE_USD) continue

    result.push({
      wallet,
      slug:              pos.slug,
      title:             pos.title,
      outcome:           pos.outcome,
      sportLabel:        sportLabel(pos.slug),
      avgEntryPrice,
      shares:            pos.shares,
      stakeUsd,
      potentialPayoutUsd: potentialPayout,
      lastTradeTime:     pos.lastTradeTime,
    })
  }
  return result
}

// ── Main pipeline ──────────────────────────────────────────────────────────────

export type InsiderFeedRefreshResult = {
  walletsScanned:   number
  walletsProcessed: number
  positionsFound:   number
  betsCached:       number
}

export async function refreshInsiderFeedCache(): Promise<InsiderFeedRefreshResult> {
  // ── Step 1: Leaderboard ──────────────────────────────────────────────────────
  const lbUrl = new URL(LEADERBOARD_URL)
  lbUrl.searchParams.set('timePeriod', 'ALL')
  lbUrl.searchParams.set('orderBy', 'PNL')
  lbUrl.searchParams.set('limit', String(LEADERBOARD_LIMIT))

  const lbRaw = await fetchWithTimeout(lbUrl.toString())
  if (!Array.isArray(lbRaw)) {
    console.error('[InsiderFeed] Leaderboard fetch failed or empty')
    return { walletsScanned: 0, walletsProcessed: 0, positionsFound: 0, betsCached: 0 }
  }

  // ── Step 2: Filter and rank qualifying wallets ─────────────────────────────
  type Candidate = {
    wallet: string; roi: number; vol: number;
    pseudonym: string | null; profileImageUrl: string | null;
  }

  const candidates: Candidate[] = []
  for (const row of lbRaw as LeaderboardEntry[]) {
    const wallet = String(row.proxyWallet ?? '').trim().toLowerCase()
    if (!wallet) continue

    const pnl = parseNum(row.pnl)
    const vol = parseNum(row.vol)
    if (!pnl || !vol || pnl <= 0 || vol < MIN_VOLUME) continue

    const roi = pnl / vol
    if (!Number.isFinite(roi) || roi <= 0) continue

    candidates.push({
      wallet,
      roi,
      vol,
      pseudonym:       typeof row.pseudonym    === 'string' ? row.pseudonym    : null,
      profileImageUrl: typeof row.profileImage === 'string' ? row.profileImage : null,
    })
  }

  // Sort by ROI descending, take top WALLET_LIMIT
  candidates.sort((a, b) => b.roi - a.roi)
  const toProcess = candidates.slice(0, WALLET_LIMIT)

  // ── Step 3: Fetch trades for each wallet ───────────────────────────────────
  type WalletStats = {
    wallet: string; roi: number; vol: number;
    buyTradeCount: number; avgBetSize: number;
    pseudonym: string | null; profileImageUrl: string | null;
  }

  const walletStats: WalletStats[] = []

  type RawPosition = ReturnType<typeof computeOpenSportsPositions>[number]
  const allPositions: RawPosition[] = []

  await runBatched(toProcess, async (candidate) => {
    const tradeUrl = new URL(TRADES_URL)
    tradeUrl.searchParams.set('user', candidate.wallet)
    tradeUrl.searchParams.set('limit', String(TRADES_PER_WALLET))

    const raw = await fetchWithTimeout(tradeUrl.toString())
    const trades: TradeEntry[] = Array.isArray(raw) ? raw : []

    // Compute avg bet size from BUY trades
    let totalBuyNotional = 0
    let buyTradeCount    = 0
    let pseudonym        = candidate.pseudonym
    let profileImageUrl  = candidate.profileImageUrl

    for (const t of trades) {
      if (t.side !== 'BUY') continue
      const size  = parseNum(t.size)
      const price = parseNum(t.price)
      if (!size || !price) continue
      totalBuyNotional += size * price
      buyTradeCount    += 1
      if (!pseudonym        && typeof t.pseudonym    === 'string') pseudonym        = t.pseudonym
      if (!profileImageUrl  && typeof t.profileImage === 'string') profileImageUrl  = t.profileImage
    }

    const avgBetSize = buyTradeCount > 0 ? totalBuyNotional / buyTradeCount : 0

    walletStats.push({
      wallet:         candidate.wallet,
      roi:            candidate.roi,
      vol:            candidate.vol,
      buyTradeCount,
      avgBetSize,
      pseudonym,
      profileImageUrl,
    })

    const positions = computeOpenSportsPositions(candidate.wallet, trades)
    allPositions.push(...positions)
  }, CONCURRENCY)

  // ── Step 4: Score positions ────────────────────────────────────────────────
  const statMap = new Map(walletStats.map(s => [s.wallet, s]))
  const runTs   = new Date().toISOString()
  const scored: Record<string, unknown>[] = []

  for (const pos of allPositions) {
    const stat = statMap.get(pos.wallet)
    if (!stat) continue
    if (stat.avgBetSize <= 0) continue

    const { score, sizeRatio } = computeInsiderScore(
      stat.buyTradeCount,
      stat.roi,
      1.5,   // profit_factor placeholder (not available from leaderboard)
      0.55,  // win_rate placeholder
      stat.avgBetSize,
      pos.stakeUsd,
    )
    if (score < MIN_INSIDER_SCORE) continue

    const americanOdds = probabilityToAmericanOdds(pos.avgEntryPrice)

    scored.push({
      wallet:                  pos.wallet,
      pseudonym:               stat.pseudonym,
      profile_image_url:       stat.profileImageUrl,
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
      wallet_roi_pct:          Math.round(stat.roi * 100 * 10) / 10,
      wallet_trade_count:      stat.buyTradeCount,
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

  // Remove stale entries from previous runs (older than 2 hours)
  const staleTs = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
  await (supabase as any)
    .from('insider_feed_cache')
    .delete()
    .lt('refreshed_at', staleTs)

  return {
    walletsScanned:   toProcess.length,
    walletsProcessed: walletStats.length,
    positionsFound:   allPositions.length,
    betsCached:       scored.length,
  }
}
