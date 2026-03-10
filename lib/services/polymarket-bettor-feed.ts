import { createServiceClient } from '@/lib/supabase/service'
import { probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { getWalletAlias } from '@/lib/utils/wallet-alias'
import {
  ALL_SPORTS_FILTER,
  ALLOWED_POLYMARKET_SPORT_LABELS,
  normalizePolymarketSportFilter,
} from '@/lib/services/polymarket-sports'

const MAX_LIMIT = 200
const DEFAULT_FEED_LIMIT = 50
const DEFAULT_LEADERBOARD_LIMIT = 25
const FALLBACK_MIN_SETTLED_MARKETS = 5

type WalletProfileRow = {
  wallet: string
  display_name?: string | null
  profile_name?: string | null
  pseudonym?: string | null
  bio?: string | null
  profile_image_url?: string | null
}

type WalletSummaryRow = {
  wallet: string
  total_realized_pnl: number
  total_wins: number
  total_losses: number
  total_pushes: number
  settled_markets: number
  settled_trades: number
  gross_profit: number
  gross_loss: number
  roi_lifetime: number
  win_rate: number
  profit_factor: number
  max_drawdown: number
  consistency_90d: number
  sample_quality: number
  risk_adjusted_score: number
  qualification_status: 'qualified' | 'watchlist' | 'excluded'
  qualification_reason: string | null
  open_positions_count: number
  open_notional: number
  last_trade_time: string | null
  last_computed_at: string
}

type WalletSportSummaryRow = WalletSummaryRow & {
  sport_label: string
}

type WalletTradeRow = {
  wallet: string
  transaction_hash: string
  trade_time: string
  trade_ts: number
  side: 'BUY' | 'SELL'
  size: number | null
  price: number | null
  notional: number | null
  slug: string
  event_slug: string | null
  title: string | null
  outcome: string | null
  outcome_index: number | null
  sport_label: string | null
}

type OpenPositionRow = {
  wallet: string
  slug: string
  event_slug: string | null
  sport_label: string | null
  title: string | null
  outcome: string | null
  outcome_index: number
  net_shares: number
  avg_entry_price: number | null
  avg_entry_american_odds: number | null
  stake_usd: number
  potential_payout_usd: number
  last_trade_time: string | null
  updated_at: string
}

type LeaderboardScope = typeof ALL_SPORTS_FILTER | string

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

const safeLimit = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Number(value), MAX_LIMIT))
}

const toAmericanOdds = (probability: number | null | undefined) => {
  if (!Number.isFinite(probability)) return null
  const p = Number(probability)
  if (p <= 0 || p >= 1) return null
  return probabilityToAmericanOdds(p)
}

const toDisplayName = (profile?: WalletProfileRow | null) => {
  if (!profile) return null
  return (
    profile.display_name ??
    profile.pseudonym ??
    profile.profile_name ??
    getWalletAlias(profile.wallet)
  )
}

const toSportSummaryKey = (wallet: string, sportLabel: string) =>
  `${wallet}:${sportLabel.toUpperCase()}`

const loadProfiles = async (wallets: string[]) => {
  if (!wallets.length) return new Map<string, WalletProfileRow>()
  const supabase = createServiceClient()
  const { data, error } = (await supabase
    .from('polymarket_wallets' as any)
    .select('wallet, display_name, profile_name, pseudonym, bio, profile_image_url')
    .in('wallet', wallets)) as unknown as {
    data: WalletProfileRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load profiles:', error)
    return new Map<string, WalletProfileRow>()
  }

  return new Map((data ?? []).map((row) => [row.wallet, row]))
}

const loadGlobalQualifiedSummaries = async ({
  limit,
  wallet,
}: {
  limit?: number
  wallet?: string
}) => {
  const supabase = createServiceClient()
  const take = safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT)
  let query = supabase
    .from('polymarket_wallet_summary' as any)
    .select('*')
    .eq('qualification_status', 'qualified')

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = await query
    .order('risk_adjusted_score', { ascending: false })
    .order('total_realized_pnl', { ascending: false })
    .limit(take)

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load qualified global summaries:', error)
    return [] as WalletSummaryRow[]
  }

  return (data ?? []) as WalletSummaryRow[]
}

const loadGlobalFallbackSummaries = async ({
  limit,
  wallet,
}: {
  limit?: number
  wallet?: string
}) => {
  const supabase = createServiceClient()
  const take = safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT)
  let query = supabase
    .from('polymarket_wallet_summary' as any)
    .select('*')
    .eq('qualification_status', 'watchlist')
    .gte('settled_markets', FALLBACK_MIN_SETTLED_MARKETS)
    .not('last_trade_time', 'is', null)

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = await query
    .order('risk_adjusted_score', { ascending: false })
    .order('settled_markets', { ascending: false })
    .order('total_realized_pnl', { ascending: false })
    .limit(take)

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load fallback global summaries:', error)
    return [] as WalletSummaryRow[]
  }

  return (data ?? []) as WalletSummaryRow[]
}

const loadSportQualifiedSummaries = async ({
  limit,
  wallet,
  sport,
}: {
  limit?: number
  wallet?: string
  sport: string
}) => {
  const supabase = createServiceClient()
  const take = safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT)
  let query = supabase
    .from('polymarket_wallet_sport_summary' as any)
    .select('*')
    .eq('qualification_status', 'qualified')
    .eq('sport_label', sport)

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = await query
    .order('risk_adjusted_score', { ascending: false })
    .order('total_realized_pnl', { ascending: false })
    .limit(take)

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load qualified sport summaries:', error)
    return [] as WalletSportSummaryRow[]
  }

  return (data ?? []) as WalletSportSummaryRow[]
}

const loadSportFallbackSummaries = async ({
  limit,
  wallet,
  sport,
}: {
  limit?: number
  wallet?: string
  sport: string
}) => {
  const supabase = createServiceClient()
  const take = safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT)
  let query = supabase
    .from('polymarket_wallet_sport_summary' as any)
    .select('*')
    .eq('qualification_status', 'watchlist')
    .eq('sport_label', sport)
    .gte('settled_markets', FALLBACK_MIN_SETTLED_MARKETS)
    .not('last_trade_time', 'is', null)

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = await query
    .order('risk_adjusted_score', { ascending: false })
    .order('settled_markets', { ascending: false })
    .order('total_realized_pnl', { ascending: false })
    .limit(take)

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load fallback sport summaries:', error)
    return [] as WalletSportSummaryRow[]
  }

  return (data ?? []) as WalletSportSummaryRow[]
}

const loadSportSummariesForWallets = async ({
  wallets,
  sport,
}: {
  wallets: string[]
  sport?: string
}) => {
  if (!wallets.length) return new Map<string, WalletSportSummaryRow>()
  const supabase = createServiceClient()
  let query = supabase
    .from('polymarket_wallet_sport_summary' as any)
    .select('*')
    .in('wallet', wallets.slice(0, 500))

  if (sport) {
    query = query.eq('sport_label', sport)
  } else {
    query = query.in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])
  }

  const { data, error } = (await query) as unknown as {
    data: WalletSportSummaryRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load sport summaries:', error)
    return new Map<string, WalletSportSummaryRow>()
  }

  return new Map(
    (data ?? []).map((row) => [toSportSummaryKey(row.wallet, row.sport_label), row])
  )
}

const loadQualifiedSportWalletSet = async (wallets: string[]) => {
  if (!wallets.length) return new Set<string>()
  const supabase = createServiceClient()
  const { data, error } = (await supabase
    .from('polymarket_wallet_sport_summary' as any)
    .select('wallet')
    .eq('qualification_status', 'qualified')
    .in('wallet', wallets.slice(0, 500))
    .in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])) as unknown as {
    data: Array<{ wallet: string }> | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load qualified sport wallet set:', error)
    return new Set<string>()
  }

  return new Set((data ?? []).map((row) => row.wallet))
}

const loadGlobalSummariesForWallets = async (wallets: string[]) => {
  if (!wallets.length) return new Map<string, WalletSummaryRow>()
  const supabase = createServiceClient()
  const { data, error } = (await supabase
    .from('polymarket_wallet_summary' as any)
    .select('*')
    .in('wallet', wallets.slice(0, 500))) as unknown as {
    data: WalletSummaryRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load global summaries by wallet:', error)
    return new Map<string, WalletSummaryRow>()
  }

  return new Map((data ?? []).map((row) => [row.wallet, row]))
}

const loadLeaderboardScope = async ({
  limit,
  wallet,
  sport,
}: {
  limit?: number
  wallet?: string
  sport?: string
}) => {
  const sportFilter = normalizePolymarketSportFilter(sport)
  const globalRows = await loadGlobalQualifiedSummaries({
    limit: sportFilter === ALL_SPORTS_FILTER ? limit : MAX_LIMIT,
    wallet,
  })
  let globalMap = new Map(globalRows.map((row) => [row.wallet, row]))

  if (sportFilter === ALL_SPORTS_FILTER) {
    const allowedWalletSet = await loadQualifiedSportWalletSet(
      globalRows.map((row) => row.wallet)
    )
    let filteredGlobalRows = globalRows.filter((row) =>
      allowedWalletSet.has(row.wallet)
    )

    if (!filteredGlobalRows.length) {
      filteredGlobalRows = await loadGlobalFallbackSummaries({ limit, wallet })
      globalMap = new Map(filteredGlobalRows.map((row) => [row.wallet, row]))
      if (filteredGlobalRows.length) {
        console.warn(
          `[Polymarket Bettor Feed] No qualified wallets available; using ${filteredGlobalRows.length} watchlist wallets as fallback.`
        )
      }
    }

    return {
      sportFilter,
      activeRows: filteredGlobalRows.map((row) => ({
        ...row,
        sport_label: ALL_SPORTS_FILTER,
      })) as WalletSportSummaryRow[],
      globalMap,
    }
  }

  const sportRows = await loadSportQualifiedSummaries({
    limit,
    wallet,
    sport: sportFilter,
  })

  if (sportRows.length) {
    return {
      sportFilter,
      activeRows: sportRows,
      globalMap,
    }
  }

  const fallbackSportRows = await loadSportFallbackSummaries({
    limit,
    wallet,
    sport: sportFilter,
  })
  if (fallbackSportRows.length) {
    globalMap = await loadGlobalSummariesForWallets(
      fallbackSportRows.map((row) => row.wallet)
    )
    console.warn(
      `[Polymarket Bettor Feed] No qualified ${sportFilter} wallets available; using ${fallbackSportRows.length} watchlist wallets as fallback.`
    )
  }

  return {
    sportFilter,
    activeRows: fallbackSportRows,
    globalMap,
  }
}

export const isInvalidPolymarketSportFilterError = (error: unknown) =>
  error instanceof Error && error.message.startsWith('INVALID_SPORT_FILTER:')

export const getPolymarketBettorLeaderboard = async ({
  limit,
  sport,
}: {
  limit?: number
  sport?: string
} = {}) => {
  const scope = await loadLeaderboardScope({ limit, sport })
  const wallets = scope.activeRows.map((row) => row.wallet)
  const profiles = await loadProfiles(wallets)

  return scope.activeRows.map((summary, index) => {
    const profile = profiles.get(summary.wallet)
    const global = scope.globalMap.get(summary.wallet)
    return {
      rank: index + 1,
      wallet: summary.wallet,
      display_name: toDisplayName(profile),
      profile_name: profile?.profile_name ?? null,
      pseudonym: profile?.pseudonym ?? null,
      profile_image_url: profile?.profile_image_url ?? null,
      bio: profile?.bio ?? null,
      risk_adjusted_score: Number(summary.risk_adjusted_score ?? 0),
      total_realized_pnl: Number(summary.total_realized_pnl ?? 0),
      roi_lifetime: Number(summary.roi_lifetime ?? 0),
      settled_markets: Number(summary.settled_markets ?? 0),
      settled_trades: Number(summary.settled_trades ?? 0),
      win_rate: Number(summary.win_rate ?? 0),
      profit_factor: Number(summary.profit_factor ?? 0),
      max_drawdown: Number(summary.max_drawdown ?? 0),
      consistency_90d: Number(summary.consistency_90d ?? 0),
      sample_quality: Number(summary.sample_quality ?? 0),
      open_positions_count: Number(summary.open_positions_count ?? 0),
      open_notional: Number(summary.open_notional ?? 0),
      last_trade_time: summary.last_trade_time,
      last_computed_at: summary.last_computed_at,
      qualification_status: summary.qualification_status,
      qualification_reason: summary.qualification_reason,
      sport_label: summary.sport_label ?? scope.sportFilter,
      sport_risk_adjusted_score: Number(summary.risk_adjusted_score ?? 0),
      sport_total_realized_pnl: Number(summary.total_realized_pnl ?? 0),
      sport_roi_lifetime: Number(summary.roi_lifetime ?? 0),
      sport_settled_markets: Number(summary.settled_markets ?? 0),
      global_risk_adjusted_score: Number(global?.risk_adjusted_score ?? summary.risk_adjusted_score ?? 0),
      global_total_realized_pnl: Number(global?.total_realized_pnl ?? summary.total_realized_pnl ?? 0),
      global_roi_lifetime: Number(global?.roi_lifetime ?? summary.roi_lifetime ?? 0),
    }
  })
}

export const getPolymarketBettorFeed = async ({
  limit,
  cursor,
  sport,
  wallet,
}: {
  limit?: number
  cursor?: number
  sport?: string
  wallet?: string
} = {}) => {
  const normalizedWallet = normalizeWallet(wallet)
  const scope = await loadLeaderboardScope({
    limit: normalizedWallet ? 1 : MAX_LIMIT,
    wallet: normalizedWallet ?? undefined,
    sport,
  })

  const walletSet = new Set(scope.activeRows.map((row) => row.wallet))
  if (!walletSet.size) {
    return {
      trades: [],
      next_cursor: null,
      has_more: false,
      wallets_considered: 0,
    }
  }

  const supabase = createServiceClient()
  const take = safeLimit(limit, DEFAULT_FEED_LIMIT)
  let query = supabase
    .from('polymarket_wallet_trades' as any)
    .select(
      'wallet, transaction_hash, trade_time, trade_ts, side, size, price, notional, slug, event_slug, title, outcome, outcome_index, sport_label'
    )
    .eq('is_sports', true)
    .in('wallet', Array.from(walletSet).slice(0, 500))
    .in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])

  if (scope.sportFilter !== ALL_SPORTS_FILTER) {
    query = query.eq('sport_label', scope.sportFilter)
  }

  if (Number.isFinite(cursor)) {
    query = query.lt('trade_ts', Number(cursor))
  }

  const { data, error } = (await query
    .order('trade_ts', { ascending: false })
    .limit(take + 1)) as unknown as {
    data: WalletTradeRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load trades:', error)
    return {
      trades: [],
      next_cursor: null,
      has_more: false,
      wallets_considered: walletSet.size,
    }
  }

  const rows = data ?? []
  const hasMore = rows.length > take
  const sliced = hasMore ? rows.slice(0, take) : rows
  const nextCursor = hasMore ? sliced[sliced.length - 1]?.trade_ts ?? null : null

  const profiles = await loadProfiles(Array.from(walletSet))
  const activeSummaryMap = new Map(scope.activeRows.map((row) => [row.wallet, row]))
  const sportSummaryMap = await loadSportSummariesForWallets({
    wallets: Array.from(walletSet),
    sport: scope.sportFilter === ALL_SPORTS_FILTER ? undefined : scope.sportFilter,
  })

  return {
    trades: sliced.map((row) => {
      const profile = profiles.get(row.wallet)
      const normalizedSport = String(row.sport_label ?? '').toUpperCase()
      const activeSummary = activeSummaryMap.get(row.wallet)
      const sportSummary =
        sportSummaryMap.get(toSportSummaryKey(row.wallet, normalizedSport)) ?? activeSummary
      const impliedProbability = Number.isFinite(row.price) ? Number(row.price) : null
      const stakeUsd = Number.isFinite(row.notional)
        ? Number(row.notional)
        : Number.isFinite(row.size) && Number.isFinite(row.price)
          ? Number(row.size) * Number(row.price)
          : null

      return {
        id: row.transaction_hash,
        wallet: row.wallet,
        display_name: toDisplayName(profile),
        profile_name: profile?.profile_name ?? null,
        pseudonym: profile?.pseudonym ?? null,
        profile_image_url: profile?.profile_image_url ?? null,
        side: row.side,
        size: row.size,
        price: row.price,
        implied_probability: impliedProbability,
        entry_american_odds: toAmericanOdds(impliedProbability),
        stake_usd: stakeUsd,
        notional: stakeUsd,
        trade_time: row.trade_time,
        trade_ts: row.trade_ts,
        sport: normalizedSport || 'SPORTS',
        slug: row.slug,
        event_slug: row.event_slug,
        title: row.title,
        outcome: row.outcome,
        outcome_index: row.outcome_index,
        risk_adjusted_score: Number(sportSummary?.risk_adjusted_score ?? 0),
        total_realized_pnl: Number(sportSummary?.total_realized_pnl ?? 0),
        roi_lifetime: Number(sportSummary?.roi_lifetime ?? 0),
        sport_risk_adjusted_score: Number(sportSummary?.risk_adjusted_score ?? 0),
        sport_total_realized_pnl: Number(sportSummary?.total_realized_pnl ?? 0),
        sport_roi_lifetime: Number(sportSummary?.roi_lifetime ?? 0),
      }
    }),
    next_cursor: nextCursor,
    has_more: hasMore,
    wallets_considered: walletSet.size,
  }
}

export const getPolymarketBettorPositions = async ({
  wallet,
  sport,
  limit,
}: {
  wallet: string
  sport?: string
  limit?: number
}) => {
  const normalizedWallet = normalizeWallet(wallet)
  if (!normalizedWallet) {
    return {
      wallet,
      summary: null,
      sport_summary: null,
      positions: [],
    }
  }

  const sportFilter = normalizePolymarketSportFilter(sport)
  const supabase = createServiceClient()
  const { data: summary } = (await supabase
    .from('polymarket_wallet_summary' as any)
    .select('*')
    .eq('wallet', normalizedWallet)
    .maybeSingle()) as unknown as {
    data: WalletSummaryRow | null
  }

  const { data: sportSummary } =
    sportFilter === ALL_SPORTS_FILTER
      ? ({ data: null } as { data: WalletSportSummaryRow | null })
      : ((await supabase
          .from('polymarket_wallet_sport_summary' as any)
          .select('*')
          .eq('wallet', normalizedWallet)
          .eq('sport_label', sportFilter)
          .maybeSingle()) as unknown as { data: WalletSportSummaryRow | null })

  const take = safeLimit(limit, 100)
  let query = supabase
    .from('polymarket_wallet_open_positions' as any)
    .select('*')
    .eq('wallet', normalizedWallet)
    .in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])

  if (sportFilter !== ALL_SPORTS_FILTER) {
    query = query.eq('sport_label', sportFilter)
  }

  const { data: positions, error } = (await query
    .order('updated_at', { ascending: false })
    .limit(take)) as unknown as {
    data: OpenPositionRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load positions:', error)
    return {
      wallet: normalizedWallet,
      summary,
      sport_summary: sportSummary,
      positions: [],
    }
  }

  const profiles = await loadProfiles([normalizedWallet])
  const profile = profiles.get(normalizedWallet)

  return {
    wallet: normalizedWallet,
    display_name: toDisplayName(profile),
    profile_name: profile?.profile_name ?? null,
    pseudonym: profile?.pseudonym ?? null,
    profile_image_url: profile?.profile_image_url ?? null,
    summary,
    sport_summary: sportSummary,
    positions: (positions ?? []).map((row) => ({
      wallet: row.wallet,
      slug: row.slug,
      event_slug: row.event_slug,
      sport: row.sport_label,
      title: row.title,
      outcome: row.outcome,
      outcome_index: row.outcome_index,
      net_shares: Number(row.net_shares ?? 0),
      avg_entry_price: row.avg_entry_price == null ? null : Number(row.avg_entry_price),
      avg_entry_american_odds:
        row.avg_entry_american_odds == null ? null : Number(row.avg_entry_american_odds),
      stake_usd: Number(row.stake_usd ?? 0),
      potential_payout_usd: Number(row.potential_payout_usd ?? 0),
      last_trade_time: row.last_trade_time,
      updated_at: row.updated_at,
    })),
  }
}
