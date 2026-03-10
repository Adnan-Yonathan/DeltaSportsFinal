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
const FEED_SCAN_MULTIPLIER = 5
const FEED_SCAN_FLOOR = 500
const FEED_SCAN_CEILING = 2000
const POSITION_SCAN_PAGE_SIZE = 250
const FALLBACK_MIN_SETTLED_MARKETS = 5
const DEFAULT_BETTOR_ELIGIBILITY = 'profitable'
const PROFITABLE_MIN_BUY_TRADES = 20
const PROFITABLE_MAX_INACTIVE_DAYS = 30
const MAX_SUMMARY_SCAN = 1000
const ACTIVITY_COUNT_QUERY_PAGE = 1000
const CURRENT_PRICE_CACHE_TTL_MS = 15_000
const EVENT_METADATA_CACHE_TTL_MS = 60_000
const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

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
  trade_count?: number | null
  buy_trade_count?: number | null
  sell_trade_count?: number | null
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
type BettorEligibility = 'profitable' | 'qualified'
type BettorFeedSource = 'trades' | 'positions'
type BettorDateWindow = 'all' | 'today' | 'tomorrow' | 'future'
type WalletActivityCounts = {
  trade_count: number
  buy_trade_count: number
  sell_trade_count: number
}
type WalletSummaryWithActivity = WalletSummaryRow & WalletActivityCounts
type WalletSportSummaryWithActivity = WalletSportSummaryRow & WalletActivityCounts
type WalletSummaryMetrics = Partial<
  Pick<
    WalletSummaryRow,
    | 'risk_adjusted_score'
    | 'total_realized_pnl'
    | 'roi_lifetime'
    | 'trade_count'
    | 'buy_trade_count'
    | 'sell_trade_count'
  >
>
type PolymarketEventMetadata = {
  eventDate: string | null
}

type FeedTradeCandidate = {
  row: WalletTradeRow
  eventDate: string | null
}

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed || null
}

const safeLimit = (value: number | undefined, fallback: number) => {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Number(value), MAX_LIMIT))
}

const parseCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parseTimestamp = (value?: string | null) => {
  if (!value) return Number.NEGATIVE_INFINITY
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

const getEasternDayKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const parsePolymarketDateFromSlug = (slug?: string | null) => {
  if (!slug) return null
  const match = String(slug).match(/(\d{4}-\d{2}-\d{2})/)
  return match?.[1] ?? null
}

const addEasternDays = (dayKey: string, days: number) => {
  const [yearRaw, monthRaw, dayRaw] = dayKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null
  const utc = new Date(Date.UTC(year, month - 1, day + days, 12, 0, 0))
  if (!Number.isFinite(utc.getTime())) return null
  return getEasternDayKey(utc)
}

const matchesDateWindow = (
  eventDate: string | null | undefined,
  window: BettorDateWindow,
  now = new Date()
) => {
  if (window === 'all') return true
  const eventDay =
    eventDate && DATE_ONLY_PATTERN.test(eventDate)
      ? eventDate
      : eventDate
        ? getEasternDayKey(eventDate)
        : null
  const todayKey = getEasternDayKey(now)
  const tomorrowKey = todayKey ? addEasternDays(todayKey, 1) : null
  if (!eventDay || !todayKey || !tomorrowKey) return false
  if (window === 'today') return eventDay === todayKey
  if (window === 'tomorrow') return eventDay === tomorrowKey
  return eventDay > tomorrowKey
}

export const isUpcomingPolymarketEventDate = (
  eventDate?: string | null,
  now = new Date()
) => {
  if (!eventDate) return false
  const match = eventDate.match(DATE_ONLY_PATTERN)
  if (match) {
    const todayKey = getEasternDayKey(now)
    return todayKey != null && eventDate >= todayKey
  }
  const eventTime = new Date(eventDate).getTime()
  if (!Number.isFinite(eventTime)) return false
  return eventTime > now.getTime()
}

const parseEventStartTime = (eventDate?: string | null) => {
  if (!eventDate) return Number.POSITIVE_INFINITY
  const match = eventDate.match(DATE_ONLY_PATTERN)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const fallback = new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
    return Number.isFinite(fallback) ? fallback : Number.POSITIVE_INFINITY
  }
  const parsed = new Date(eventDate).getTime()
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY
}

const resolveTradeNotional = <
  T extends Pick<WalletTradeRow, 'notional' | 'size' | 'price'>,
>(
  row: T
) => {
  if (Number.isFinite(row.notional)) return Number(row.notional)
  if (Number.isFinite(row.size) && Number.isFinite(row.price)) {
    return Number(row.size) * Number(row.price)
  }
  return 0
}

export const compareFeedTradeCandidates = <T extends FeedTradeCandidate>(
  left: T,
  right: T
) => {
  const startDiff = parseEventStartTime(left.eventDate) - parseEventStartTime(right.eventDate)
  if (startDiff !== 0) return startDiff

  const notionalDiff = resolveTradeNotional(right.row) - resolveTradeNotional(left.row)
  if (notionalDiff !== 0) return notionalDiff

  return Number(right.row.trade_ts ?? 0) - Number(left.row.trade_ts ?? 0)
}

const toAmericanOdds = (probability: number | null | undefined) => {
  if (!Number.isFinite(probability)) return null
  const p = Number(probability)
  if (p <= 0 || p >= 1) return null
  return probabilityToAmericanOdds(p)
}

const toCurrentPriceOdds = (priceCents: number | null | undefined) => {
  if (!Number.isFinite(priceCents)) return null
  return toAmericanOdds(Number(priceCents) / 100)
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

export const normalizePolymarketBettorEligibility = (
  eligibility?: string | null
): BettorEligibility => {
  if (!eligibility) return DEFAULT_BETTOR_ELIGIBILITY
  const normalized = eligibility.trim().toLowerCase()
  if (!normalized) return DEFAULT_BETTOR_ELIGIBILITY
  if (normalized === 'profitable' || normalized === 'qualified') {
    return normalized
  }
  throw new Error(`INVALID_BETTOR_ELIGIBILITY:${normalized}`)
}

export const isInvalidPolymarketBettorEligibilityError = (error: unknown) =>
  error instanceof Error &&
  error.message.startsWith('INVALID_BETTOR_ELIGIBILITY:')

const normalizePolymarketBettorFeedSource = (
  source?: string | null
): BettorFeedSource => {
  if (!source) return 'trades'
  const normalized = source.trim().toLowerCase()
  if (!normalized || normalized === 'trades') return 'trades'
  if (normalized === 'positions') return 'positions'
  throw new Error(`INVALID_BETTOR_FEED_SOURCE:${normalized}`)
}

export const isInvalidPolymarketBettorFeedSourceError = (error: unknown) =>
  error instanceof Error &&
  error.message.startsWith('INVALID_BETTOR_FEED_SOURCE:')

const normalizePolymarketBettorDateWindow = (
  dateWindow?: string | null
): BettorDateWindow => {
  if (!dateWindow) return 'today'
  const normalized = dateWindow.trim().toLowerCase()
  if (!normalized || normalized === 'today') return 'today'
  if (normalized === 'all') return 'all'
  if (normalized === 'tomorrow') return 'tomorrow'
  if (normalized === 'future') return 'future'
  throw new Error(`INVALID_BETTOR_DATE_WINDOW:${normalized}`)
}

export const isInvalidPolymarketBettorDateWindowError = (error: unknown) =>
  error instanceof Error &&
  error.message.startsWith('INVALID_BETTOR_DATE_WINDOW:')

const profitableCutoffIso = () => {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - PROFITABLE_MAX_INACTIVE_DAYS)
  return cutoff.toISOString()
}

export const isProfitableSummaryEligible = <
  T extends Pick<
    WalletSummaryRow,
    'total_realized_pnl' | 'roi_lifetime' | 'last_trade_time'
  > &
    Partial<WalletActivityCounts>,
>(
  row: T
) =>
  Number(row.total_realized_pnl ?? 0) > 0 &&
  Number(row.roi_lifetime ?? 0) > 0 &&
  parseCount(row.buy_trade_count) >= PROFITABLE_MIN_BUY_TRADES &&
  parseTimestamp(row.last_trade_time) >= parseTimestamp(profitableCutoffIso())

export const compareProfitableSummaryRows = <
  T extends Pick<
    WalletSummaryRow,
    'total_realized_pnl' | 'roi_lifetime' | 'risk_adjusted_score' | 'last_trade_time'
  >,
>(
  left: T,
  right: T
) => {
  const roiDiff = Number(right.roi_lifetime ?? 0) - Number(left.roi_lifetime ?? 0)
  if (roiDiff !== 0) return roiDiff
  const pnlDiff =
    Number(right.total_realized_pnl ?? 0) - Number(left.total_realized_pnl ?? 0)
  if (pnlDiff !== 0) return pnlDiff
  const scoreDiff =
    Number(right.risk_adjusted_score ?? 0) - Number(left.risk_adjusted_score ?? 0)
  if (scoreDiff !== 0) return scoreDiff
  return parseTimestamp(right.last_trade_time) - parseTimestamp(left.last_trade_time)
}

export const filterAndRankProfitableSummaries = <
  T extends WalletSummaryWithActivity | WalletSportSummaryWithActivity,
>(
  rows: T[]
) => rows.filter(isProfitableSummaryEligible).sort(compareProfitableSummaryRows)

const parseOutcomePrices = (value: unknown) => {
  if (Array.isArray(value)) {
    return value
      .map((entry) => Number(entry))
      .map((entry) => (Number.isFinite(entry) ? Math.round(entry * 100) : null))
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => Number(entry))
          .map((entry) => (Number.isFinite(entry) ? Math.round(entry * 100) : null))
      }
    } catch {}
  }

  return [] as Array<number | null>
}

const currentPriceCache = new Map<
  string,
  { fetchedAt: number; prices: Array<number | null> }
>()
const eventMetadataCache = new Map<
  string,
  { fetchedAt: number; metadata: PolymarketEventMetadata }
>()

const fetchOutcomePricesForSlug = async (slug: string) => {
  const cached = currentPriceCache.get(slug)
  const now = Date.now()
  if (cached && now - cached.fetchedAt <= CURRENT_PRICE_CACHE_TTL_MS) {
    return cached.prices
  }

  try {
    const url = new URL(`${POLYMARKET_GAMMA}/markets`)
    url.searchParams.set('slug', slug)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) return [] as Array<number | null>
    const data = await res.json()
    const markets = Array.isArray(data?.value)
      ? data.value
      : Array.isArray(data)
        ? data
        : []
    const prices = parseOutcomePrices(markets[0]?.outcomePrices)
    currentPriceCache.set(slug, { fetchedAt: now, prices })
    return prices
  } catch {
    return [] as Array<number | null>
  }
}

const loadCurrentPricesForTrades = async (rows: WalletTradeRow[]) => {
  const uniqueSlugs = Array.from(new Set(rows.map((row) => row.slug).filter(Boolean)))
  const slugPriceEntries = await Promise.all(
    uniqueSlugs.map(async (slug) => [slug, await fetchOutcomePricesForSlug(slug)] as const)
  )
  const slugPriceMap = new Map(slugPriceEntries)
  const priceMap = new Map<string, number | null>()

  for (const row of rows) {
    const prices = slugPriceMap.get(row.slug) ?? []
    const outcomeIndex =
      row.outcome_index != null && Number.isFinite(Number(row.outcome_index))
        ? Number(row.outcome_index)
        : -1
    const currentPrice =
      outcomeIndex >= 0 && outcomeIndex < prices.length ? prices[outcomeIndex] : null
    priceMap.set(
      `${row.slug}:${row.outcome_index ?? 'unknown'}`,
      currentPrice == null ? null : Number(currentPrice)
    )
  }

  return priceMap
}

const normalizeEventDate = (value: unknown) => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isFinite(parsed.getTime())) return parsed.toISOString()
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null
}

const resolveEventDateFromPosition = (row: Pick<OpenPositionRow, 'event_slug' | 'slug'>) =>
  parsePolymarketDateFromSlug(row.event_slug ?? row.slug)

const fetchEventMetadataForSlug = async (slug: string) => {
  const cached = eventMetadataCache.get(slug)
  const now = Date.now()
  if (cached && now - cached.fetchedAt <= EVENT_METADATA_CACHE_TTL_MS) {
    return cached.metadata
  }

  let metadata: PolymarketEventMetadata = { eventDate: parsePolymarketDateFromSlug(slug) }
  try {
    const url = new URL(`${POLYMARKET_GAMMA}/events`)
    url.searchParams.set('slug', slug)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (res.ok) {
      const raw = await res.json()
      const events = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.value)
          ? raw.value
          : raw
            ? [raw]
            : []
      const event = events[0] ?? null
      metadata = {
        eventDate:
          normalizeEventDate(
            event?.startTime ??
              event?.startDate ??
              event?.eventDate ??
              event?.endDate ??
              event?.endTime
          ) ?? parsePolymarketDateFromSlug(slug),
      }
    }
  } catch {}

  eventMetadataCache.set(slug, { fetchedAt: now, metadata })
  return metadata
}

const loadEventMetadataForSlugs = async (slugs: string[]) => {
  const uniqueEventSlugs = Array.from(new Set(slugs.filter(Boolean)))
  const entries = await Promise.all(
    uniqueEventSlugs.map(async (slug) => [slug, await fetchEventMetadataForSlug(slug)] as const)
  )
  return new Map(entries)
}

const loadEventMetadataForTrades = async (rows: WalletTradeRow[]) =>
  loadEventMetadataForSlugs(
    rows.map((row) => row.event_slug ?? row.slug).filter(Boolean) as string[]
  )

const loadEventMetadataForPositions = async (rows: OpenPositionRow[]) =>
  loadEventMetadataForSlugs(
    rows.map((row) => row.event_slug ?? row.slug).filter(Boolean) as string[]
  )

export const buildBettorFeedTradePayload = ({
  row,
  profile,
  sportSummary,
  globalSummary,
  currentPriceCents,
  eventDate,
}: {
  row: WalletTradeRow
  profile?: WalletProfileRow | null
  sportSummary?: WalletSummaryMetrics | null
  globalSummary?: WalletSummaryMetrics | null
  currentPriceCents?: number | null
  eventDate?: string | null
}) => {
  const normalizedSport = String(row.sport_label ?? '').toUpperCase()
  const impliedProbability = Number.isFinite(row.price) ? Number(row.price) : null
  const stakeUsd = Number.isFinite(row.notional)
    ? Number(row.notional)
    : Number.isFinite(row.size) && Number.isFinite(row.price)
      ? Number(row.size) * Number(row.price)
      : null
  const entryPriceCents =
    impliedProbability != null ? Math.round(impliedProbability * 100) : null
  const priceMoveCents =
    currentPriceCents != null && entryPriceCents != null
      ? currentPriceCents - entryPriceCents
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
    eventDate: eventDate ?? null,
    slug: row.slug,
    event_slug: row.event_slug,
    title: row.title,
    outcome: row.outcome,
    outcome_index: row.outcome_index,
    current_price_cents: currentPriceCents ?? null,
    current_american_odds: toCurrentPriceOdds(currentPriceCents),
    price_move_cents: priceMoveCents,
    risk_adjusted_score: Number(sportSummary?.risk_adjusted_score ?? 0),
    total_realized_pnl: Number(sportSummary?.total_realized_pnl ?? 0),
    roi_lifetime: Number(sportSummary?.roi_lifetime ?? 0),
    trade_count: parseCount(sportSummary?.trade_count),
    buy_trade_count: parseCount(sportSummary?.buy_trade_count),
    sport_risk_adjusted_score: Number(sportSummary?.risk_adjusted_score ?? 0),
    sport_total_realized_pnl: Number(sportSummary?.total_realized_pnl ?? 0),
    sport_roi_lifetime: Number(sportSummary?.roi_lifetime ?? 0),
    sport_trade_count: parseCount(sportSummary?.trade_count),
    sport_buy_trade_count: parseCount(sportSummary?.buy_trade_count),
    global_total_realized_pnl: Number(
      globalSummary?.total_realized_pnl ?? sportSummary?.total_realized_pnl ?? 0
    ),
    global_roi_lifetime: Number(
      globalSummary?.roi_lifetime ?? sportSummary?.roi_lifetime ?? 0
    ),
    global_trade_count: parseCount(globalSummary?.trade_count),
    global_buy_trade_count: parseCount(globalSummary?.buy_trade_count),
  }
}

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

const loadActivityCountsForWallets = async ({
  wallets,
  sport,
}: {
  wallets: string[]
  sport?: string
}) => {
  const normalizedWallets = Array.from(
    new Set(wallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[])
  )
  const counts = new Map<string, WalletActivityCounts>()
  if (!normalizedWallets.length) return counts

  const supabase = createServiceClient()
  const walletChunks = 200

  for (let i = 0; i < normalizedWallets.length; i += walletChunks) {
    const chunk = normalizedWallets.slice(i, i + walletChunks)
    for (let from = 0; ; from += ACTIVITY_COUNT_QUERY_PAGE) {
      const to = from + ACTIVITY_COUNT_QUERY_PAGE - 1
      let query = supabase
        .from('polymarket_wallet_trades' as any)
        .select('wallet, side')
        .in('wallet', chunk)
        .eq('is_sports', true)
        .order('trade_ts', { ascending: true })
        .range(from, to)

      if (sport) {
        query = query.eq('sport_label', sport)
      }

      const { data, error } = (await query) as unknown as {
        data: Array<{ wallet: string; side: string | null }> | null
        error: { message?: string } | null
      }

      if (error) {
        console.warn('[Polymarket Bettor Feed] Failed to load activity counts:', error)
        break
      }

      const rows = data ?? []
      for (const row of rows) {
        if (!row.wallet) continue
        const current = counts.get(row.wallet) ?? {
          trade_count: 0,
          buy_trade_count: 0,
          sell_trade_count: 0,
        }
        current.trade_count += 1
        if (String(row.side ?? '').toUpperCase() === 'BUY') current.buy_trade_count += 1
        else if (String(row.side ?? '').toUpperCase() === 'SELL') current.sell_trade_count += 1
        counts.set(row.wallet, current)
      }

      if (rows.length < ACTIVITY_COUNT_QUERY_PAGE) break
    }
  }

  return counts
}

const enrichSummariesWithActivityCounts = async <
  T extends WalletSummaryRow | WalletSportSummaryRow,
>({
  rows,
  sport,
}: {
  rows: T[]
  sport?: string
}) => {
  if (!rows.length) return [] as Array<T & WalletActivityCounts>
  const activityCounts = await loadActivityCountsForWallets({
    wallets: rows.map((row) => row.wallet),
    sport,
  })

  return rows.map((row) => {
    const counts = activityCounts.get(row.wallet)
    return {
      ...row,
      trade_count: counts?.trade_count ?? parseCount(row.trade_count),
      buy_trade_count: counts?.buy_trade_count ?? parseCount(row.buy_trade_count),
      sell_trade_count: counts?.sell_trade_count ?? parseCount(row.sell_trade_count),
    }
  })
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

const loadGlobalProfitableSummaries = async ({
  limit,
  wallet,
}: {
  limit?: number
  wallet?: string
}) => {
  const supabase = createServiceClient()
  let query = supabase
    .from('polymarket_wallet_summary' as any)
    .select('*')
    .gt('total_realized_pnl', 0)
    .gt('roi_lifetime', 0)
    .not('last_trade_time', 'is', null)
    .gte('last_trade_time', profitableCutoffIso())
    .limit(MAX_SUMMARY_SCAN)

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = (await query) as unknown as {
    data: WalletSummaryRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load profitable global summaries:', error)
    return [] as WalletSummaryWithActivity[]
  }

  return filterAndRankProfitableSummaries(
    await enrichSummariesWithActivityCounts({ rows: (data ?? []) as WalletSummaryRow[] })
  ).slice(0, safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT))
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

const loadSportProfitableSummaries = async ({
  limit,
  wallet,
  sport,
}: {
  limit?: number
  wallet?: string
  sport: string
}) => {
  const supabase = createServiceClient()
  let query = supabase
    .from('polymarket_wallet_sport_summary' as any)
    .select('*')
    .eq('sport_label', sport)
    .gt('total_realized_pnl', 0)
    .gt('roi_lifetime', 0)
    .not('last_trade_time', 'is', null)
    .gte('last_trade_time', profitableCutoffIso())
    .limit(MAX_SUMMARY_SCAN)

  if (wallet) {
    query = query.eq('wallet', wallet)
  }

  const { data, error } = (await query) as unknown as {
    data: WalletSportSummaryRow[] | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Polymarket Bettor Feed] Failed to load profitable sport summaries:', error)
    return [] as WalletSportSummaryWithActivity[]
  }

  return filterAndRankProfitableSummaries(
    await enrichSummariesWithActivityCounts({
      rows: (data ?? []) as WalletSportSummaryRow[],
      sport,
    })
  ).slice(0, safeLimit(limit, DEFAULT_LEADERBOARD_LIMIT))
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
  if (!wallets.length) return new Map<string, WalletSportSummaryWithActivity>()
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
    return new Map<string, WalletSportSummaryWithActivity>()
  }

  const rows = await enrichSummariesWithActivityCounts({
    rows: (data ?? []) as WalletSportSummaryRow[],
    sport,
  })

  return new Map(
    rows.map((row) => [toSportSummaryKey(row.wallet, row.sport_label), row])
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
  if (!wallets.length) return new Map<string, WalletSummaryWithActivity>()
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
    return new Map<string, WalletSummaryWithActivity>()
  }

  const rows = await enrichSummariesWithActivityCounts({
    rows: (data ?? []) as WalletSummaryRow[],
  })

  return new Map(rows.map((row) => [row.wallet, row]))
}

const loadLeaderboardScope = async ({
  limit,
  wallet,
  sport,
  eligibility,
}: {
  limit?: number
  wallet?: string
  sport?: string
  eligibility?: string
}) => {
  const sportFilter = normalizePolymarketSportFilter(sport)
  const normalizedEligibility = normalizePolymarketBettorEligibility(eligibility)

  if (normalizedEligibility === 'profitable') {
    if (sportFilter === ALL_SPORTS_FILTER) {
      const globalRows = await loadGlobalProfitableSummaries({ limit, wallet })
      return {
        sportFilter,
        eligibility: normalizedEligibility,
        activeRows: globalRows.map((row) => ({
          ...row,
          sport_label: ALL_SPORTS_FILTER,
        })) as WalletSportSummaryWithActivity[],
        globalMap: new Map(globalRows.map((row) => [row.wallet, row])),
      }
    }

    const sportRows = await loadSportProfitableSummaries({
      limit,
      wallet,
      sport: sportFilter,
    })
    const globalMap = await loadGlobalSummariesForWallets(sportRows.map((row) => row.wallet))

    return {
      sportFilter,
      eligibility: normalizedEligibility,
      activeRows: sportRows,
      globalMap,
    }
  }

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
      eligibility: normalizedEligibility,
      activeRows: filteredGlobalRows.map((row) => ({
        ...row,
        sport_label: ALL_SPORTS_FILTER,
      })) as WalletSportSummaryWithActivity[],
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
      eligibility: normalizedEligibility,
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
    eligibility: normalizedEligibility,
    activeRows: fallbackSportRows,
    globalMap,
  }
}

export const isInvalidPolymarketSportFilterError = (error: unknown) =>
  error instanceof Error && error.message.startsWith('INVALID_SPORT_FILTER:')

export const getPolymarketBettorLeaderboard = async ({
  limit,
  sport,
  eligibility,
}: {
  limit?: number
  sport?: string
  eligibility?: string
} = {}) => {
  const scope = await loadLeaderboardScope({ limit, sport, eligibility })
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
      trade_count: parseCount(summary.trade_count),
      buy_trade_count: parseCount(summary.buy_trade_count),
      sell_trade_count: parseCount(summary.sell_trade_count),
      sport_label: summary.sport_label ?? scope.sportFilter,
      sport_risk_adjusted_score: Number(summary.risk_adjusted_score ?? 0),
      sport_total_realized_pnl: Number(summary.total_realized_pnl ?? 0),
      sport_roi_lifetime: Number(summary.roi_lifetime ?? 0),
      sport_settled_markets: Number(summary.settled_markets ?? 0),
      sport_trade_count: parseCount(summary.trade_count),
      sport_buy_trade_count: parseCount(summary.buy_trade_count),
      global_risk_adjusted_score: Number(global?.risk_adjusted_score ?? summary.risk_adjusted_score ?? 0),
      global_total_realized_pnl: Number(global?.total_realized_pnl ?? summary.total_realized_pnl ?? 0),
      global_roi_lifetime: Number(global?.roi_lifetime ?? summary.roi_lifetime ?? 0),
      global_trade_count: parseCount(global?.trade_count),
      global_buy_trade_count: parseCount(global?.buy_trade_count),
    }
  })
}

export const getPolymarketBettorFeed = async ({
  limit,
  cursor,
  sport,
  wallet,
  eligibility,
  source,
  dateWindow,
}: {
  limit?: number
  cursor?: number
  sport?: string
  wallet?: string
  eligibility?: string
  source?: string
  dateWindow?: string
} = {}) => {
  const normalizedWallet = normalizeWallet(wallet)
  const normalizedSource = normalizePolymarketBettorFeedSource(source)
  const normalizedDateWindow = normalizePolymarketBettorDateWindow(dateWindow)
  const scope = await loadLeaderboardScope({
    limit: normalizedWallet ? 1 : MAX_LIMIT,
    wallet: normalizedWallet ?? undefined,
    sport,
    eligibility,
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
  const walletList = Array.from(walletSet).slice(0, 500)
  const profiles = await loadProfiles(Array.from(walletSet))
  const activeSummaryMap = new Map(scope.activeRows.map((row) => [row.wallet, row]))
  const sportSummaryMap = await loadSportSummariesForWallets({
    wallets: Array.from(walletSet),
    sport: scope.sportFilter === ALL_SPORTS_FILTER ? undefined : scope.sportFilter,
  })

  if (normalizedSource === 'positions') {
    const positionScanLimit = Math.min(
      FEED_SCAN_CEILING,
      Math.max(FEED_SCAN_FLOOR, take * FEED_SCAN_MULTIPLIER)
    )
    const now = new Date()
    const collected: FeedTradeCandidate[] = []
    let scannedRows = 0
    let offset = 0
    let exhausted = false

    while (scannedRows < positionScanLimit && !exhausted) {
      const pageSize = Math.min(
        POSITION_SCAN_PAGE_SIZE,
        positionScanLimit - scannedRows
      )
      const to = offset + pageSize - 1

      let query = supabase
        .from('polymarket_wallet_open_positions' as any)
        .select(
          'wallet, slug, event_slug, sport_label, title, outcome, outcome_index, net_shares, avg_entry_price, avg_entry_american_odds, stake_usd, potential_payout_usd, last_trade_time, updated_at'
        )
        .in('wallet', walletList)
        .in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])

      if (scope.sportFilter !== ALL_SPORTS_FILTER) {
        query = query.eq('sport_label', scope.sportFilter)
      }

      const { data: positionRows, error: positionError } = (await query
        .order('stake_usd', { ascending: false })
        .order('updated_at', { ascending: false })
        .range(offset, to)) as unknown as {
        data: OpenPositionRow[] | null
        error: { message?: string } | null
      }

      if (positionError) {
        console.warn('[Polymarket Bettor Feed] Failed to load open positions:', positionError)
        return {
          trades: [],
          next_cursor: null,
          has_more: false,
          wallets_considered: walletSet.size,
        }
      }

      const rows = positionRows ?? []
      if (!rows.length) {
        exhausted = true
        break
      }

      scannedRows += rows.length
      offset += rows.length
      if (rows.length < pageSize) exhausted = true

      const eventMetadataMap = await loadEventMetadataForPositions(rows)
      const positionCandidates = rows.flatMap((row) => {
        const eventSlug = row.event_slug ?? row.slug
        const eventDate =
          eventMetadataMap.get(eventSlug)?.eventDate ??
          resolveEventDateFromPosition(row)
        if (!matchesDateWindow(eventDate, normalizedDateWindow, now)) return []
        const tradeTime = row.last_trade_time ?? row.updated_at
        const tradeTsMs = new Date(tradeTime).getTime()
        const syntheticRow: WalletTradeRow = {
          wallet: row.wallet,
          transaction_hash: `position:${row.wallet}:${row.slug}:${row.outcome_index}`,
          trade_time: tradeTime,
          trade_ts: Number.isFinite(tradeTsMs) ? Math.floor(tradeTsMs / 1000) : 0,
          side: 'BUY',
          size: Number(row.net_shares ?? 0),
          price: row.avg_entry_price == null ? null : Number(row.avg_entry_price),
          notional: Number(row.stake_usd ?? 0),
          slug: row.slug,
          event_slug: row.event_slug,
          title: row.title,
          outcome: row.outcome,
          outcome_index: row.outcome_index,
          sport_label: row.sport_label,
        }
        return [{ row: syntheticRow, eventDate }]
      })

      collected.push(...positionCandidates)

      if (collected.length >= take * FEED_SCAN_MULTIPLIER) {
        break
      }
    }

    const rankedCandidates = [...collected].sort((left, right) => {
      const notionalDiff = resolveTradeNotional(right.row) - resolveTradeNotional(left.row)
      if (notionalDiff !== 0) return notionalDiff
      return Number(right.row.trade_ts ?? 0) - Number(left.row.trade_ts ?? 0)
    })
    const hasMore = rankedCandidates.length > take
    const slicedCandidates = rankedCandidates.slice(0, take)
    const slicedRows = slicedCandidates.map((candidate) => candidate.row)
    const currentPriceMap = await loadCurrentPricesForTrades(slicedRows)

    return {
      trades: slicedCandidates.map(({ row, eventDate }) => {
        const profile = profiles.get(row.wallet)
        const normalizedSport = String(row.sport_label ?? '').toUpperCase()
        const activeSummary = activeSummaryMap.get(row.wallet)
        const sportSummary =
          sportSummaryMap.get(toSportSummaryKey(row.wallet, normalizedSport)) ?? activeSummary
        const globalSummary = scope.globalMap.get(row.wallet) ?? activeSummary
        const currentPriceCents =
          currentPriceMap.get(`${row.slug}:${row.outcome_index ?? 'unknown'}`) ?? null

        return buildBettorFeedTradePayload({
          row,
          profile,
          sportSummary,
          globalSummary,
          currentPriceCents,
          eventDate,
        })
      }),
      next_cursor: null,
      has_more: hasMore,
      wallets_considered: walletSet.size,
    }
  }

  const collected: FeedTradeCandidate[] = []
  let pageCursor = Number.isFinite(cursor) ? Number(cursor) : null
  let exhausted = false
  const pageSize = Math.min(MAX_LIMIT, Math.max(take * 3, 75))
  const scanTarget = Math.min(
    FEED_SCAN_CEILING,
    Math.max(FEED_SCAN_FLOOR, take * FEED_SCAN_MULTIPLIER)
  )
  let scannedRows = 0

  while (scannedRows < scanTarget && !exhausted) {
    let query = supabase
      .from('polymarket_wallet_trades' as any)
      .select(
        'wallet, transaction_hash, trade_time, trade_ts, side, size, price, notional, slug, event_slug, title, outcome, outcome_index, sport_label'
      )
      .eq('is_sports', true)
      .eq('side', 'BUY')
      .in('wallet', walletList)
      .in('sport_label', [...ALLOWED_POLYMARKET_SPORT_LABELS])

    if (scope.sportFilter !== ALL_SPORTS_FILTER) {
      query = query.eq('sport_label', scope.sportFilter)
    }

    if (pageCursor != null) {
      query = query.lt('trade_ts', pageCursor)
    }

    const { data, error } = (await query
      .order('trade_ts', { ascending: false })
      .limit(pageSize)) as unknown as {
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

    const pageRows = data ?? []
    scannedRows += pageRows.length
    if (!pageRows.length) {
      exhausted = true
      break
    }

    const eventMetadataMap = await loadEventMetadataForTrades(pageRows)
    const upcomingRows = pageRows.flatMap((row) => {
      const eventSlug = row.event_slug ?? row.slug
      const eventDate =
        eventMetadataMap.get(eventSlug)?.eventDate ?? parsePolymarketDateFromSlug(eventSlug)
      if (!isUpcomingPolymarketEventDate(eventDate)) return []
      if (!matchesDateWindow(eventDate, normalizedDateWindow)) return []
      return [{ row, eventDate }]
    })

    collected.push(...upcomingRows)

    if (pageRows.length < pageSize) {
      exhausted = true
      break
    }

    pageCursor = pageRows[pageRows.length - 1]?.trade_ts ?? null
  }

  const rankedCandidates = [...collected].sort(compareFeedTradeCandidates)
  const hasMore = !exhausted || rankedCandidates.length > take
  const slicedCandidates = rankedCandidates.slice(0, take)
  const slicedRows = slicedCandidates.map((candidate) => candidate.row)
  const nextCursor = !exhausted ? pageCursor : null
  const currentPriceMap = await loadCurrentPricesForTrades(slicedRows)

  return {
    trades: slicedCandidates.map(({ row, eventDate }) => {
      const profile = profiles.get(row.wallet)
      const normalizedSport = String(row.sport_label ?? '').toUpperCase()
      const activeSummary = activeSummaryMap.get(row.wallet)
      const sportSummary =
        sportSummaryMap.get(toSportSummaryKey(row.wallet, normalizedSport)) ?? activeSummary
      const globalSummary = scope.globalMap.get(row.wallet) ?? activeSummary
      const currentPriceCents =
        currentPriceMap.get(`${row.slug}:${row.outcome_index ?? 'unknown'}`) ?? null

      return buildBettorFeedTradePayload({
        row,
        profile,
        sportSummary,
        globalSummary,
        currentPriceCents,
        eventDate,
      })
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
