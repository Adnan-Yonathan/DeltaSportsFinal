import { createServiceClient } from '@/lib/supabase/service'

// ── Types ─────────────────────────────────────────────────────────────────────

export type InsiderBet = {
  wallet: string
  pseudonym: string | null
  profile_image_url: string | null
  title: string
  outcome: string
  sport_label: string | null
  slug: string
  avg_entry_price: number
  avg_entry_american_odds: number | null
  stake_usd: number
  potential_payout_usd: number
  last_trade_time: string | null
  insider_score: number
  size_ratio: number
  wallet_roi_pct: number
  wallet_trade_count: number
  current_price: number | null
  current_american_odds: number | null
  consensus_count: number
}

// ── Hard filters — "bad bets not included" ───────────────────────────────────
//
// WALLET must pass all of:
//   buy_trade_count >= 1000   meaningful long-term sample
//   roi_lifetime > 0          actually profitable
//   profit_factor >= 1.1      makes more than it loses (10% cushion over break-even)
//   qualification_status != 'excluded'
//
// BET must pass all of:
//   stake_usd >= 10           not dust
//   avg_entry_price >= 0.04   not a lottery ticket (>25-1)
//   avg_entry_price <= 0.92   not near-certainty (tiny upside)
//   avg_bet_size > 0          needed for conviction ratio

const MIN_TRADE_COUNT = 500
const MIN_PROFIT_FACTOR = 1.1
const MIN_STAKE_USD = 10
const MIN_ENTRY_PRICE = 0.04
const MAX_ENTRY_PRICE = 0.92
export const MIN_INSIDER_SCORE = 70

// ── Scoring ───────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v))
}

export function computeInsiderScore(
  roiLifetime: number,
  avgBetSize: number,
  stakeUsd: number,
  consensus: number,
): { score: number; sizeRatio: number } {
  // ── 1. Size Ratio (conviction) — 40% ─────────────────────────────────────
  // How much bigger is this bet than the wallet's average?
  // 0.75× → 0,  1× → ~6,  2× → ~29,  3× → ~53,  5× → 100
  const sizeRatio = avgBetSize > 0 ? stakeUsd / avgBetSize : 1
  const convictionRaw = clamp((sizeRatio - 0.75) / 4.25, 0, 1) * 100

  // ── 2. Wallet ROI (authority) — 30% ──────────────────────────────────────
  // ROI within 3–20% range. Scale: 3% → 0, 20% → 100
  const roiPct = roiLifetime * 100  // e.g. 0.08 → 8
  const roiRaw = clamp((roiPct - 3) / 17, 0, 1) * 100

  // ── 3. Consensus (agreement) — 30% ───────────────────────────────────────
  // How many other qualified wallets hold the same position?
  // 1 wallet (just this one) → 0,  2 → 25,  3 → 50,  5+ → 100
  const consensusRaw = clamp((consensus - 1) / 4, 0, 1) * 100

  // ── Combined score ────────────────────────────────────────────────────────
  // Raw 0–100, then linearly mapped to display range 70–99.
  //   raw = 0  → 70 (threshold)
  //   raw = 33 → 79.6 (Notable)
  //   raw = 50 → 84.5 (Sharp)
  //   raw = 75 → 91.8 (Elite)
  //   raw = 100 → 99 (Elite)
  const raw    = convictionRaw * 0.40 + roiRaw * 0.30 + consensusRaw * 0.30
  const biased = 70 + (raw / 100) * 29
  const score  = Math.floor(clamp(biased, 0, 99))

  return { score, sizeRatio: Math.round(sizeRatio * 10) / 10 }
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the UTC ISO timestamp for midnight Eastern time on (today - daysBack).
 * Handles both EST (UTC-5) and EDT (UTC-4) via the Intl API.
 */
function getEasternWindowStart(daysBack: number): string {
  // Determine today's date in Eastern time
  const etDateStr = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/New_York',
  }) // "YYYY-MM-DD"

  const [y, m, d] = etDateStr.split('-').map(Number)

  // Detect current UTC offset for Eastern by comparing noon UTC with noon ET
  const noonUTC = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const noonETHour = +new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    hour12: false,
  }).format(noonUTC)
  const utcOffsetHours = 12 - noonETHour // 4 = EDT, 5 = EST

  // Midnight Eastern on (today - daysBack) expressed as UTC
  const windowStart = new Date(
    Date.UTC(y, m - 1, d - daysBack, utcOffsetHours, 0, 0),
  )
  return windowStart.toISOString()
}

// ── Main feed query — reads from insider_feed_cache (populated by refresh cron) ──

export async function getInsiderFeed(opts: {
  sport?: string
  limit?: number
  offset?: number
  minScore?: number
  /** How many calendar days back (Eastern) to include. 0 = today only, -1 = all time */
  daysBack?: number
} = {}): Promise<InsiderBet[]> {
  const {
    sport,
    limit    = 100,
    offset   = 0,
    minScore = MIN_INSIDER_SCORE,
    daysBack = 0,
  } = opts

  const supabase = createServiceClient()

  let query = (supabase as any)
    .from('insider_feed_cache')
    .select(
      'wallet, pseudonym, profile_image_url, title, outcome, sport_label, slug, ' +
      'avg_entry_price, avg_entry_american_odds, stake_usd, potential_payout_usd, ' +
      'last_trade_time, insider_score, size_ratio, wallet_roi_pct, ' +
      'wallet_trade_count, current_price, current_american_odds, consensus_count'
    )
    .gte('insider_score', minScore)
    .order('insider_score', { ascending: false })
    .limit(limit + offset)

  if (sport && sport !== 'ALL') {
    query = query.eq('sport_label', sport)
  }

  if (daysBack >= 0) {
    const windowStart = getEasternWindowStart(daysBack)
    query = query.gte('last_trade_time', windowStart)
  }

  const { data, error } = await query

  if (error) {
    console.error('[INSIDER] cache query failed', error)
    return []
  }

  if (!data?.length) return []

  return (data as any[]).slice(offset).map((row): InsiderBet => ({
    wallet:                  row.wallet,
    pseudonym:               row.pseudonym               ?? null,
    profile_image_url:       row.profile_image_url       ?? null,
    title:                   row.title                   ?? 'Unknown market',
    outcome:                 row.outcome                 ?? 'YES',
    sport_label:             row.sport_label             ?? null,
    slug:                    row.slug,
    avg_entry_price:         row.avg_entry_price,
    avg_entry_american_odds: row.avg_entry_american_odds ?? null,
    stake_usd:               row.stake_usd,
    potential_payout_usd:    row.potential_payout_usd,
    last_trade_time:         row.last_trade_time         ?? null,
    insider_score:           row.insider_score,
    size_ratio:              row.size_ratio,
    wallet_roi_pct:          row.wallet_roi_pct,
    wallet_trade_count:      row.wallet_trade_count      ?? 0,
    current_price:           row.current_price           ?? null,
    current_american_odds:   row.current_american_odds   ?? null,
    consensus_count:         row.consensus_count         ?? 1,
  }))
}
