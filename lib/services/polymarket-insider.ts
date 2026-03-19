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
  event_slug: string | null
  avg_entry_price: number
  avg_entry_american_odds: number | null
  stake_usd: number
  potential_payout_usd: number
  first_trade_time: string | null
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
  sportLabel?: string | null,
): { score: number; sizeRatio: number } {
  const sizeRatio = avgBetSize > 0 ? stakeUsd / avgBetSize : 1

  // NCAAB has fewer bettors and lower liquidity — soften thresholds
  const isNcaab = sportLabel === 'NCAAB'

  // ── 1. Size Ratio (conviction) — 40% ─────────────────────────────────────
  // How much bigger is this bet than the wallet's average?
  // Default: 0.75× → 0, 5× → 100.  NCAAB: 0.5× → 0, 3× → 100
  const convFloor = isNcaab ? 0.5 : 0.75
  const convRange = isNcaab ? 2.5 : 4.25
  const convictionRaw = clamp((sizeRatio - convFloor) / convRange, 0, 1) * 100

  // ── 2. Wallet ROI (authority) — 30% ──────────────────────────────────────
  // Default: 3–20%. NCAAB: 2–15% (lower bar)
  const roiPct = roiLifetime * 100
  const roiFloor = isNcaab ? 2 : 3
  const roiRange = isNcaab ? 13 : 17
  const roiRaw = clamp((roiPct - roiFloor) / roiRange, 0, 1) * 100

  // ── 3. Consensus (agreement) — 30% ───────────────────────────────────────
  // Default: 1→0, 5→100.  NCAAB: 1→20 (solo bets get baseline credit), 3→100
  const consensusRaw = isNcaab
    ? clamp(20 + ((consensus - 1) / 2) * 80, 0, 100)
    : clamp((consensus - 1) / 4, 0, 1) * 100

  // ── Combined score ────────────────────────────────────────────────────────
  // Use the raw 0–99 score directly. Bets below 70 are filtered out downstream.
  const raw    = convictionRaw * 0.40 + roiRaw * 0.30 + consensusRaw * 0.30
  const score  = Math.floor(clamp(raw, 0, 99))

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
      'first_trade_time, last_trade_time, insider_score, size_ratio, wallet_roi_pct, ' +
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

  const mapped = (data as any[]).slice(offset).map((row): InsiderBet => ({
    wallet:                  row.wallet,
    pseudonym:               row.pseudonym               ?? null,
    profile_image_url:       row.profile_image_url       ?? null,
    title:                   row.title                   ?? 'Unknown market',
    outcome:                 row.outcome                 ?? 'YES',
    sport_label:             row.sport_label             ?? null,
    slug:                    row.slug,
    event_slug:              row.event_slug              ?? null,
    avg_entry_price:         row.avg_entry_price,
    avg_entry_american_odds: row.avg_entry_american_odds ?? null,
    stake_usd:               row.stake_usd,
    potential_payout_usd:    row.potential_payout_usd,
    first_trade_time:        row.first_trade_time        ?? null,
    last_trade_time:         row.last_trade_time         ?? null,
    insider_score:           row.insider_score,
    size_ratio:              row.size_ratio,
    wallet_roi_pct:          row.wallet_roi_pct,
    wallet_trade_count:      row.wallet_trade_count      ?? 0,
    current_price:           row.current_price           ?? null,
    current_american_odds:   row.current_american_odds   ?? null,
    consensus_count:         row.consensus_count         ?? 1,
  }))

  return deduplicateConflicts(mapped)
}

// ── Conflict resolution ────────────────────────────────────────────────────────
//
// When two insiders bet on opposite sides of the same market (same slug,
// different outcome), keep only the side with the highest insider_score.
// All bets on the winning side are kept; all bets on the losing side are dropped.

function deduplicateConflicts(bets: InsiderBet[]): InsiderBet[] {
  // Group bets by slug
  const bySlug = new Map<string, InsiderBet[]>()
  for (const bet of bets) {
    const group = bySlug.get(bet.slug)
    if (group) group.push(bet)
    else bySlug.set(bet.slug, [bet])
  }

  const result: InsiderBet[] = []
  for (const group of bySlug.values()) {
    // Check if there are multiple distinct outcomes for this slug
    const outcomes = new Set(group.map((b) => b.outcome))
    if (outcomes.size <= 1) {
      // No conflict — all on the same side
      result.push(...group)
      continue
    }

    // Find which outcome has the highest single insider_score
    let bestOutcome = ''
    let bestScore = -1
    for (const bet of group) {
      if (bet.insider_score > bestScore) {
        bestScore = bet.insider_score
        bestOutcome = bet.outcome
      }
    }

    // Keep only bets on the winning side
    for (const bet of group) {
      if (bet.outcome === bestOutcome) {
        result.push(bet)
      }
    }
  }

  // Re-sort by insider_score descending (grouping may have disrupted order)
  result.sort((a, b) => b.insider_score - a.insider_score)
  return result
}
