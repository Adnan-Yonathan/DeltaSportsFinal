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
  wallet_buy_trade_count: number
  wallet_win_rate: number
  wallet_profit_factor: number
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

const MIN_TRADE_COUNT = 1000
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
  buyTradeCount: number,
  roiLifetime: number,
  profitFactor: number,
  winRate: number,
  avgBetSize: number,
  stakeUsd: number,
): { score: number; sizeRatio: number } {
  // ── Authority: how trustworthy is this wallet long-term? ──────────────────
  // Scales smoothly — 1 000 trades ≈ 0.33, 3 000+ = max
  const tradeDepth   = clamp(buyTradeCount / 3000, 0, 1)
  // 200 % ROI lifetime = full credit
  const roiComp      = clamp(roiLifetime, 0, 2.0) / 2.0
  // profit factor 5+ = max
  const pfComp       = clamp(profitFactor, 0, 5.0) / 5.0
  // win rate meaningful between 40 % and 75 %
  const winComp      = clamp((clamp(winRate, 0.40, 0.75) - 0.40) / 0.35, 0, 1)

  const authority = (
    tradeDepth * 0.35 +
    roiComp    * 0.35 +
    pfComp     * 0.20 +
    winComp    * 0.10
  ) * 100

  // ── Conviction: how big is THIS bet relative to their norm? ───────────────
  // 0.75× their avg → 0,  1× → ~6,  2× → ~29,  3× → ~53,  5× → 100
  const sizeRatio = avgBetSize > 0 ? stakeUsd / avgBetSize : 1
  const conviction = clamp((sizeRatio - 0.75) / 4.25, 0, 1) * 100

  // ── Combined + bias curve ─────────────────────────────────────────────────
  const raw    = authority * 0.60 + conviction * 0.40
  // sqrt bias squishes qualifying bets toward 80–99
  const biased = 60 + Math.sqrt(raw / 100) * 39
  const score  = Math.floor(clamp(biased, 0, 99))

  return { score, sizeRatio: Math.round(sizeRatio * 10) / 10 }
}

// ── Main feed query ───────────────────────────────────────────────────────────

export async function getInsiderFeed(opts: {
  sport?: string
  limit?: number
  offset?: number
  minScore?: number
} = {}): Promise<InsiderBet[]> {
  const {
    sport,
    limit  = 100,
    offset = 0,
    minScore = MIN_INSIDER_SCORE,
  } = opts

  const supabase = createServiceClient()

  // Step 1 — qualifying wallets (DB-side filters)
  const summaryQuery = (supabase as any)
    .from('polymarket_wallet_summary')
    .select('wallet, roi_lifetime, win_rate, profit_factor, buy_trade_count, avg_bet_size')
    .gte('buy_trade_count', MIN_TRADE_COUNT)
    .gt('roi_lifetime', 0)
    .gte('profit_factor', MIN_PROFIT_FACTOR)
    .neq('qualification_status', 'excluded')
    // Surface the highest-ROI wallets first so our 500-cap picks the best pool
    .order('roi_lifetime', { ascending: false })
    .limit(500)

  const { data: summaries, error: summaryErr } = await summaryQuery

  if (summaryErr || !summaries?.length) {
    if (summaryErr) console.error('[INSIDER] summary query failed', summaryErr)
    return []
  }

  const walletAddresses: string[] = summaries.map((s: any) => s.wallet)
  const summaryMap = new Map<string, any>(summaries.map((s: any) => [s.wallet, s]))

  // Step 2 — open positions for qualifying wallets (DB-side bet filters)
  let posQuery = (supabase as any)
    .from('polymarket_wallet_open_positions')
    .select('wallet, title, outcome, sport_label, slug, avg_entry_price, avg_entry_american_odds, stake_usd, potential_payout_usd, last_trade_time')
    .in('wallet', walletAddresses)
    .gte('stake_usd', MIN_STAKE_USD)
    .gte('avg_entry_price', MIN_ENTRY_PRICE)
    .lte('avg_entry_price', MAX_ENTRY_PRICE)
    .not('avg_entry_price', 'is', null)
    .limit(2000)

  if (sport && sport !== 'ALL') {
    posQuery = posQuery.eq('sport_label', sport)
  }

  const { data: positions, error: posErr } = await posQuery

  if (posErr || !positions?.length) {
    if (posErr) console.error('[INSIDER] positions query failed', posErr)
    return []
  }

  // Step 3 — profiles for qualifying wallets
  const { data: profiles } = await (supabase as any)
    .from('polymarket_wallets')
    .select('wallet, pseudonym, profile_image_url')
    .in('wallet', walletAddresses)

  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.wallet, p]))

  // Step 4 — score each position in JS, filter by minScore
  const scored: InsiderBet[] = []

  for (const pos of positions as any[]) {
    const summary = summaryMap.get(pos.wallet)
    if (!summary) continue

    const avgBetSize: number = summary.avg_bet_size ?? 0
    if (avgBetSize <= 0) continue

    const { score, sizeRatio } = computeInsiderScore(
      summary.buy_trade_count ?? 0,
      summary.roi_lifetime    ?? 0,
      summary.profit_factor   ?? 0,
      summary.win_rate        ?? 0,
      avgBetSize,
      pos.stake_usd,
    )

    if (score < minScore) continue

    const profile = profileMap.get(pos.wallet)

    scored.push({
      wallet:                  pos.wallet,
      pseudonym:               profile?.pseudonym        ?? null,
      profile_image_url:       profile?.profile_image_url ?? null,
      title:                   pos.title   ?? 'Unknown market',
      outcome:                 pos.outcome ?? 'YES',
      sport_label:             pos.sport_label ?? null,
      slug:                    pos.slug,
      avg_entry_price:         pos.avg_entry_price,
      avg_entry_american_odds: pos.avg_entry_american_odds ?? null,
      stake_usd:               pos.stake_usd,
      potential_payout_usd:    pos.potential_payout_usd,
      last_trade_time:         pos.last_trade_time ?? null,
      insider_score:           score,
      size_ratio:              sizeRatio,
      wallet_roi_pct:          Math.round((summary.roi_lifetime ?? 0) * 100 * 10) / 10,
      wallet_buy_trade_count:  summary.buy_trade_count ?? 0,
      wallet_win_rate:         summary.win_rate        ?? 0,
      wallet_profit_factor:    summary.profit_factor   ?? 0,
    })
  }

  scored.sort((a, b) => b.insider_score - a.insider_score)
  return scored.slice(offset, offset + limit)
}
