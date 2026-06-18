import { createServiceClient } from '@/lib/supabase/service'
import { fetchWhaleTrades } from '@/lib/services/whale-detector'
import { getWalletAlias } from '@/lib/utils/wallet-alias'

const POLYMARKET_TRADES = 'https://data-api.polymarket.com/trades'
const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'

const DEFAULT_LIMIT = 1000
const DEFAULT_MAX_PAGES = 10
const DEFAULT_SEED_LIMIT = 200

const POLYMARKET_SPORT_PREFIXES = [
  'nba-',
  'wnba-',
  'nfl-',
  'cfb-',
  'cbb-',
  'ncaab-',
  'ncaaf-',
  'nhl-',
  'mlb-',
  'fifwc-',
  'soccer-fifwc-',
  'soccer-',
  'golf-',
  'ufc-',
]

const POLYMARKET_SPORT_SERIES = new Set([
  'nba',
  'wnba',
  'nfl',
  'ncaaf',
  'ncaab',
  'cfb',
  'cbb',
  'mlb',
  'fifwc',
  'nhl',
  'ufc',
  'mma',
  'boxing',
  'soccer',
  'soccer-fifwc',
  'tennis',
  'golf',
  'pga',
  'mls',
  'cricket',
  'esports',
  'racing',
  'olympics',
  'chess',
  'poker',
])

const POLYMARKET_SPORT_LABELS: Record<string, string> = {
  nba: 'NBA',
  wnba: 'WNBA',
  nfl: 'NFL',
  cfb: 'NCAAF',
  cbb: 'NCAAB',
  ncaab: 'NCAAB',
  ncaaf: 'NCAAF',
  nhl: 'NHL',
  mlb: 'MLB',
  fifwc: 'FIFWC',
  'soccer-fifwc': 'FIFWC',
  soccer: 'SOCCER',
  golf: 'GOLF',
  ufc: 'UFC',
}

type PolymarketTradeApi = {
  proxyWallet?: string
  side?: string
  asset?: string
  conditionId?: string
  size?: number
  price?: number
  timestamp?: number
  title?: string
  slug?: string
  eventSlug?: string
  outcome?: string
  outcomeIndex?: number
  name?: string
  pseudonym?: string
  bio?: string
  profileImage?: string
  transactionHash: string
}

type PolymarketMarketApi = {
  id?: string
  slug?: string
  resolved?: boolean | null
  closed?: boolean | null
  resolvedTime?: string | null
  resolvedAt?: string | null
  resolutionTime?: string | null
  closedTime?: string | null
  winningOutcome?: string | null
  winningOutcomeIndex?: number | null
  outcomes?: string | string[] | null
  outcomePrices?: string | Array<string | number> | null
  umaResolutionStatus?: string | null
}

type WalletRow = {
  wallet: string
  last_trade_ts: number | null
  backfill_completed: boolean | null
  display_name?: string | null
  tracking_state?: 'auto' | 'manual_include' | 'manual_exclude' | null
}

type IngestWalletResult = {
  wallet: string
  fetched: number
  inserted: number
  skipped: number
  updatedOutcomes: number
  reachedStop: boolean
  maxTimestamp: number | null
}

type IngestSummary = {
  walletsProcessed: number
  tradesFetched: number
  tradesInserted: number
  tradesSkipped: number
  marketsUpdated: number
  results: IngestWalletResult[]
}

type DiscoveredWalletMeta = {
  wallet: string
  source: string
  display_name: string
  last_seen_at: string
  last_discovered_at: string
  profile_name: string | null
  pseudonym: string | null
  bio: string | null
  profile_image_url: string | null
}

type DiscoverSummary = {
  scannedTrades: number
  discoveredSportsTrades: number
  walletsUpserted: number
  wallets: string[]
}

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed ? trimmed : null
}

const isPolymarketSportSlug = (slug?: string | null) => {
  if (!slug) return false
  return POLYMARKET_SPORT_PREFIXES.some((prefix) => slug.startsWith(prefix))
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseJsonArray = <T,>(value?: string | null): T[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseStringOrArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') return parseJsonArray<T>(value)
  return []
}

const parseOutcomePriceArray = (value: unknown) => {
  const raw = parseStringOrArray<unknown>(value)
  return raw.map((entry) => {
    const numeric = Number(entry)
    return Number.isFinite(numeric) ? numeric : null
  })
}

const resolveWinningOutcomeIndexFromPrices = (prices: Array<number | null>) => {
  const finite = prices
    .map((value, index) => ({ value, index }))
    .filter((entry) => entry.value != null) as Array<{ value: number; index: number }>
  if (!finite.length) return null

  const sorted = [...finite].sort((a, b) => b.value - a.value)
  const best = sorted[0]
  const secondBest = sorted[1]?.value ?? 0

  // Resolved markets publish binary prices; require a clear winner to avoid false positives.
  if (best.value < 0.98 || secondBest > 0.02) return null
  return best.index
}

const eventCache = new Map<
  string,
  {
    isSports: boolean
    sportLabel?: string
    source: 'slug_prefix' | 'event_category' | 'event_series' | 'event_title' | 'unknown'
    confidence: number
  }
>()

const fetchPolymarketEvent = async (slug: string) => {
  if (eventCache.has(slug)) return eventCache.get(slug) ?? null
  try {
    const url = new URL(`${POLYMARKET_GAMMA}/events`)
    url.searchParams.set('slug', slug)
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) {
      eventCache.set(slug, { isSports: false, source: 'unknown', confidence: 0 })
      return null
    }
    const eventResponse = await res.json()
    const event =
      Array.isArray(eventResponse) && eventResponse.length > 0
        ? eventResponse[0]
        : eventResponse
    const category = String(event?.category ?? '').toLowerCase()
    const seriesSlug = String(event?.seriesSlug ?? event?.series?.[0]?.slug ?? '').toLowerCase()
    const title = String(event?.title ?? '').toLowerCase()
    const titleMatch = POLYMARKET_SPORT_PREFIXES.some((prefix) =>
      title.startsWith(prefix.replace('-', ''))
    )

    const categoryMatch = category === 'sports'
    const seriesMatch = POLYMARKET_SPORT_SERIES.has(seriesSlug)
    const isSports = categoryMatch || seriesMatch || titleMatch
    const source: 'event_category' | 'event_series' | 'event_title' | 'unknown' = categoryMatch
      ? 'event_category'
      : seriesMatch
        ? 'event_series'
        : titleMatch
          ? 'event_title'
          : 'unknown'
    const confidence =
      source === 'event_category'
        ? 0.95
        : source === 'event_series'
          ? 0.9
          : source === 'event_title'
            ? 0.8
            : 0

    const sportLabel =
      (event?.series?.[0]?.title as string | undefined) ||
      (seriesSlug ? seriesSlug.toUpperCase() : undefined)

    const payload = { isSports, sportLabel, source, confidence }
    eventCache.set(slug, payload)
    return payload
  } catch {
    eventCache.set(slug, { isSports: false, source: 'unknown', confidence: 0 })
    return null
  }
}

const resolveSportLabelFromSlug = (slug?: string | null) => {
  if (!slug) return null
  const [prefix] = slug.split('-')
  return POLYMARKET_SPORT_LABELS[prefix] ?? null
}

const resolvePolymarketSportsMeta = async (slug?: string | null) => {
  if (!slug) {
    return {
      isSports: false as const,
      classificationSource: 'unknown' as const,
      classificationConfidence: 0,
    }
  }
  if (isPolymarketSportSlug(slug)) {
    return {
      isSports: true as const,
      sportLabel: resolveSportLabelFromSlug(slug) ?? undefined,
      classificationSource: 'slug_prefix' as const,
      classificationConfidence: 0.99,
    }
  }
  const event = await fetchPolymarketEvent(slug)
  if (!event) {
    return {
      isSports: false as const,
      classificationSource: 'unknown' as const,
      classificationConfidence: 0,
    }
  }
  return {
    isSports: event.isSports,
    sportLabel: event.sportLabel ?? resolveSportLabelFromSlug(slug) ?? undefined,
    classificationSource: event.source,
    classificationConfidence: event.confidence,
  }
}

const fetchWalletTradesPage = async ({
  wallet,
  limit,
  offset,
}: {
  wallet: string
  limit: number
  offset: number
}) => {
  const url = new URL(POLYMARKET_TRADES)
  url.searchParams.set('user', wallet)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as PolymarketTradeApi[]
  const data = (await res.json()) as PolymarketTradeApi[] | { value?: PolymarketTradeApi[] }
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.value)) return data.value
  return []
}

const fetchGlobalTradesPage = async ({
  limit,
  offset,
}: {
  limit: number
  offset: number
}) => {
  const url = new URL(POLYMARKET_TRADES)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return [] as PolymarketTradeApi[]
  const data = (await res.json()) as PolymarketTradeApi[] | { value?: PolymarketTradeApi[] }
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.value)) return data.value
  return []
}

export const discoverPolymarketSportsBettors = async ({
  limit = 500,
  maxPages = 5,
}: {
  limit?: number
  maxPages?: number
} = {}): Promise<DiscoverSummary> => {
  const safeLimit = Number.isFinite(limit) ? Math.max(50, Math.min(limit, 1000)) : 500
  const safePages = Number.isFinite(maxPages) ? Math.max(1, Math.min(maxPages, 20)) : 5
  const nowIso = new Date().toISOString()
  let scannedTrades = 0
  let discoveredSportsTrades = 0

  const wallets = new Map<
    string,
    {
      timestamp: number
      profile_name: string | null
      pseudonym: string | null
      bio: string | null
      profile_image_url: string | null
    }
  >()

  for (let page = 0; page < safePages; page += 1) {
    const offset = page * safeLimit
    const pageTrades = await fetchGlobalTradesPage({ limit: safeLimit, offset })
    if (!pageTrades.length) break
    scannedTrades += pageTrades.length

    for (const trade of pageTrades) {
      const wallet = normalizeWallet(trade.proxyWallet)
      if (!wallet) continue
      const slug = trade.eventSlug || trade.slug
      const sportsMeta = await resolvePolymarketSportsMeta(slug)
      if (!sportsMeta.isSports) continue
      discoveredSportsTrades += 1

      const tradeTs = parseNumber(trade.timestamp) ?? 0
      const prev = wallets.get(wallet)
      if (prev && prev.timestamp > tradeTs) continue

      wallets.set(wallet, {
        timestamp: tradeTs,
        profile_name:
          typeof trade.name === 'string' && trade.name.trim().length > 0
            ? trade.name.trim()
            : null,
        pseudonym:
          typeof trade.pseudonym === 'string' && trade.pseudonym.trim().length > 0
            ? trade.pseudonym.trim()
            : null,
        bio:
          typeof trade.bio === 'string' && trade.bio.trim().length > 0
            ? trade.bio.trim()
            : null,
        profile_image_url:
          typeof trade.profileImage === 'string' && trade.profileImage.trim().length > 0
            ? trade.profileImage.trim()
            : null,
      })
    }

    if (pageTrades.length < safeLimit) break
  }

  const walletList = Array.from(wallets.keys())
  if (!walletList.length) {
    return {
      scannedTrades,
      discoveredSportsTrades,
      walletsUpserted: 0,
      wallets: [],
    }
  }

  const supabase = createServiceClient()
  const { data: existingRows } = (await supabase
    .from('polymarket_wallets' as any)
    .select('wallet, source')
    .in('wallet', walletList.slice(0, 1000))) as unknown as {
    data: Array<{ wallet: string; source?: string | null }> | null
  }
  const existingByWallet = new Map<string, string>()
  for (const row of existingRows ?? []) {
    if (!row.wallet) continue
    existingByWallet.set(row.wallet, row.source ?? 'manual')
  }

  const payload: DiscoveredWalletMeta[] = walletList.map((wallet) => {
    const meta = wallets.get(wallet)
    return {
      wallet,
      source: existingByWallet.get(wallet) ?? 'discovery',
      display_name: getWalletAlias(wallet),
      last_seen_at: nowIso,
      last_discovered_at: nowIso,
      profile_name: meta?.profile_name ?? null,
      pseudonym: meta?.pseudonym ?? null,
      bio: meta?.bio ?? null,
      profile_image_url: meta?.profile_image_url ?? null,
    }
  })

  const { data, error } = await supabase
    .from('polymarket_wallets' as any)
    .upsert(payload as any, { onConflict: 'wallet' } as any)
    .select('wallet')

  if (error) {
    console.warn('[Polymarket Wallets] Discovery upsert failed:', error)
    return {
      scannedTrades,
      discoveredSportsTrades,
      walletsUpserted: 0,
      wallets: [],
    }
  }

  return {
    scannedTrades,
    discoveredSportsTrades,
    walletsUpserted: data?.length ?? 0,
    wallets: walletList,
  }
}

const fetchMarketOutcome = async (slug: string) => {
  const url = new URL(`${POLYMARKET_GAMMA}/markets`)
  url.searchParams.set('slug', slug)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = await res.json()
  const markets = Array.isArray(data?.value)
    ? data.value
    : Array.isArray(data)
      ? data
      : []
  const market = (markets[0] ?? null) as PolymarketMarketApi | null
  if (!market?.slug) return null
  const outcomes = parseStringOrArray<string>(market.outcomes).map((value) => String(value))
  const outcomePrices = parseOutcomePriceArray(market.outcomePrices)
  const explicitWinningOutcomeIndex =
    market.winningOutcomeIndex != null && Number.isFinite(Number(market.winningOutcomeIndex))
      ? Number(market.winningOutcomeIndex)
      : null
  const winningOutcomeFromName =
    market.winningOutcome && outcomes.length
      ? outcomes.findIndex(
          (candidate) =>
            candidate.trim().toLowerCase() === String(market.winningOutcome).trim().toLowerCase()
        )
      : -1
  const inferredWinningOutcomeIndex = resolveWinningOutcomeIndexFromPrices(outcomePrices)
  const winningOutcomeIndex =
    explicitWinningOutcomeIndex ??
    (winningOutcomeFromName >= 0 ? winningOutcomeFromName : null) ??
    inferredWinningOutcomeIndex
  const status = String(market.umaResolutionStatus ?? '').trim().toLowerCase()
  const resolvedByStatus =
    status === 'resolved' || status === 'settled' || status === 'finalized'
  const resolved =
    typeof market.resolved === 'boolean'
      ? market.resolved
      : resolvedByStatus || (market.closed === true && winningOutcomeIndex != null)
  const winningOutcome =
    winningOutcomeIndex != null && winningOutcomeIndex >= 0 && winningOutcomeIndex < outcomes.length
      ? outcomes[winningOutcomeIndex]
      : market.winningOutcome ?? null
  const resolvedAtRaw =
    market.resolvedTime ??
    market.resolvedAt ??
    market.resolutionTime ??
    market.closedTime ??
    null
  const resolvedAt = resolvedAtRaw ? new Date(resolvedAtRaw) : null
  const resolvedAtIso =
    resolvedAt && Number.isFinite(resolvedAt.getTime())
      ? resolvedAt.toISOString()
      : null
  return {
    slug: market.slug,
    marketId: market.id ?? null,
    resolved,
    winningOutcomeIndex,
    winningOutcome,
    outcomes,
    resolvedAt: resolvedAtIso,
  }
}

const buildTradeRows = async ({
  trades,
  sportsOnly,
}: {
  trades: PolymarketTradeApi[]
  sportsOnly: boolean
}) => {
  const rows: Array<Record<string, unknown>> = []
  const slugs = new Set<string>()
  const walletMeta = new Map<string, Partial<DiscoveredWalletMeta>>()

  for (const trade of trades) {
    const slug = trade.slug
    if (!slug || !trade.transactionHash) continue
    const eventSlug = trade.eventSlug || slug
    const wallet = normalizeWallet(trade.proxyWallet)
    if (!wallet) continue
    const timestamp = parseNumber(trade.timestamp)
    if (timestamp == null) continue
    const {
      isSports,
      sportLabel,
      classificationSource,
      classificationConfidence,
    } = await resolvePolymarketSportsMeta(eventSlug)
    if (sportsOnly && !isSports) continue

    const size = parseNumber(trade.size)
    const price = parseNumber(trade.price)
    const notional =
      size != null && price != null ? Number((size * price).toFixed(6)) : null

    rows.push({
      wallet,
      transaction_hash: trade.transactionHash,
      trade_time: new Date(timestamp * 1000).toISOString(),
      trade_ts: timestamp,
      side: String(trade.side ?? '').toUpperCase() === 'SELL' ? 'SELL' : 'BUY',
      size,
      price,
      notional,
      slug,
      event_slug: eventSlug,
      title: trade.title ?? null,
      outcome: trade.outcome ?? null,
      outcome_index:
        trade.outcomeIndex != null ? Number(trade.outcomeIndex) : null,
      condition_id: trade.conditionId ?? null,
      asset: trade.asset ?? null,
      proxy_wallet: trade.proxyWallet ?? null,
      is_sports: isSports,
      sport_label: sportLabel ?? null,
      sports_classification_source: classificationSource,
      sports_classification_confidence: classificationConfidence,
    })
    const meta = walletMeta.get(wallet) ?? {}
    walletMeta.set(wallet, {
      ...meta,
      profile_name:
        typeof trade.name === 'string' && trade.name.trim().length > 0
          ? trade.name.trim()
          : (meta.profile_name ?? null),
      pseudonym:
        typeof trade.pseudonym === 'string' && trade.pseudonym.trim().length > 0
          ? trade.pseudonym.trim()
          : (meta.pseudonym ?? null),
      bio:
        typeof trade.bio === 'string' && trade.bio.trim().length > 0
          ? trade.bio.trim()
          : (meta.bio ?? null),
      profile_image_url:
        typeof trade.profileImage === 'string' && trade.profileImage.trim().length > 0
          ? trade.profileImage.trim()
          : (meta.profile_image_url ?? null),
    })
    slugs.add(slug)
  }

  return { rows, slugs: Array.from(slugs), walletMeta }
}

const upsertMarketOutcomes = async (slugs: string[]) => {
  if (!slugs.length) return 0
  const supabase = createServiceClient()
  const rows: Array<Record<string, unknown>> = []

  for (const slug of slugs) {
    const outcome = await fetchMarketOutcome(slug)
    if (!outcome) continue
    rows.push({
      slug: outcome.slug,
      market_id: outcome.marketId,
      resolved: outcome.resolved,
      resolved_at: outcome.resolvedAt,
      winning_outcome_index: outcome.winningOutcomeIndex,
      winning_outcome: outcome.winningOutcome,
      outcomes: outcome.outcomes,
      last_checked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
  }

  if (!rows.length) return 0
  const { error } = await supabase
    .from('polymarket_market_outcomes' as any)
    .upsert(rows as any, { onConflict: 'slug' } as any)
  if (error) {
    console.warn('[Polymarket Wallets] Market outcome upsert failed:', error)
    return 0
  }
  return rows.length
}

const ingestWalletTrades = async ({
  walletRow,
  limit,
  maxPages,
  sportsOnly,
  fullBackfill,
}: {
  walletRow: WalletRow
  limit: number
  maxPages: number
  sportsOnly: boolean
  fullBackfill: boolean
}): Promise<IngestWalletResult> => {
  const wallet = normalizeWallet(walletRow.wallet)
  if (!wallet) {
    return {
      wallet: walletRow.wallet,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      updatedOutcomes: 0,
      reachedStop: true,
      maxTimestamp: null,
    }
  }

  const stopTs = fullBackfill ? null : walletRow.last_trade_ts
  const fetched: PolymarketTradeApi[] = []
  let reachedStop = false

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * limit
    const pageTrades = await fetchWalletTradesPage({ wallet, limit, offset })
    if (!pageTrades.length) break
    for (const trade of pageTrades) {
      const ts = parseNumber(trade.timestamp)
      if (stopTs != null && ts != null && ts <= stopTs) {
        reachedStop = true
        break
      }
      fetched.push(trade)
    }
    if (reachedStop || pageTrades.length < limit) break
  }

  if (!fetched.length) {
    return {
      wallet,
      fetched: 0,
      inserted: 0,
      skipped: 0,
      updatedOutcomes: 0,
      reachedStop,
      maxTimestamp: null,
    }
  }

  const { rows, slugs, walletMeta } = await buildTradeRows({ trades: fetched, sportsOnly })
  if (!rows.length) {
    return {
      wallet,
      fetched: fetched.length,
      inserted: 0,
      skipped: fetched.length,
      updatedOutcomes: 0,
      reachedStop,
      maxTimestamp: null,
    }
  }

  const supabase = createServiceClient()
  const chunkSize = 200
  let inserted = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('polymarket_wallet_trades' as any)
      .upsert(chunk as any, { onConflict: 'transaction_hash' } as any)
      .select('transaction_hash')
    if (error) {
      console.warn('[Polymarket Wallets] Trade upsert failed:', error)
      continue
    }
    inserted += data?.length ?? 0
  }

  const maxTimestamp = rows.reduce((max, row) => {
    const ts = typeof row.trade_ts === 'number' ? row.trade_ts : parseNumber(row.trade_ts)
    if (ts == null) return max
    return max == null || ts > max ? ts : max
  }, null as number | null)

  const marketsUpdated = await upsertMarketOutcomes(slugs)
  const profile = walletMeta.get(wallet)
  if (profile) {
    const profilePatch: Record<string, unknown> = {}
    if (profile.profile_name) profilePatch.profile_name = profile.profile_name
    if (profile.pseudonym) profilePatch.pseudonym = profile.pseudonym
    if (profile.bio) profilePatch.bio = profile.bio
    if (profile.profile_image_url) profilePatch.profile_image_url = profile.profile_image_url
    if (Object.keys(profilePatch).length > 0) {
      await (supabase.from('polymarket_wallets' as any) as any)
        .update(profilePatch)
        .eq('wallet', wallet)
    }
  }

  return {
    wallet,
    fetched: fetched.length,
    inserted,
    skipped: rows.length - inserted,
    updatedOutcomes: marketsUpdated,
    reachedStop,
    maxTimestamp,
  }
}

export const upsertTrackedPolymarketWallets = async ({
  wallets,
  source = 'manual',
}: {
  wallets: string[]
  source?: string
}) => {
  const normalized = Array.from(
    new Set(wallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[])
  )
  if (!normalized.length) return { inserted: 0, wallets: [] as string[] }

  const now = new Date().toISOString()
  const rows = normalized.map((wallet) => ({
    wallet,
    source,
    last_seen_at: now,
    display_name: getWalletAlias(wallet),
  }))
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('polymarket_wallets' as any)
    .upsert(rows as any, { onConflict: 'wallet' } as any)
    .select('wallet')

  if (error) {
    console.warn('[Polymarket Wallets] Seed failed:', error)
    return { inserted: 0, wallets: [] as string[] }
  }
  return { inserted: data?.length ?? 0, wallets: normalized }
}

export const seedTrackedPolymarketWallets = async ({
  minNotional = 2000,
  limit = DEFAULT_SEED_LIMIT,
}: {
  minNotional?: number
  limit?: number
}) => {
  const trades = await fetchWhaleTrades({ minNotional, limit })
  const wallets = Array.from(
    new Set(
      trades
        .filter((trade) => trade.source === 'polymarket')
        .map((trade) => normalizeWallet(trade.proxyWallet))
        .filter(Boolean) as string[]
    )
  )
  return upsertTrackedPolymarketWallets({ wallets, source: 'detector' })
}

export const ingestPolymarketWalletTradesForTrackedWallets = async ({
  wallet,
  wallets,
  limit = DEFAULT_LIMIT,
  maxPages = DEFAULT_MAX_PAGES,
  sportsOnly = true,
  fullBackfill = false,
}: {
  wallet?: string
  wallets?: string[]
  limit?: number
  maxPages?: number
  sportsOnly?: boolean
  fullBackfill?: boolean
}): Promise<IngestSummary> => {
  const supabase = createServiceClient()

  const query = supabase
    .from('polymarket_wallets' as any)
    .select('wallet, last_trade_ts, backfill_completed, display_name, tracking_state')
  const normalizedWallets = wallets
    ? Array.from(
        new Set(wallets.map((value) => normalizeWallet(value)).filter(Boolean) as string[])
      )
    : []
  const { data, error } = wallet
    ? await query.eq('wallet', normalizeWallet(wallet) ?? wallet)
    : normalizedWallets.length
      ? await query
          .in('wallet', normalizedWallets.slice(0, 200))
          .not('tracking_state', 'eq', 'manual_exclude')
      : await query.not('tracking_state', 'eq', 'manual_exclude')

  if (error || !data) {
    console.warn('[Polymarket Wallets] Failed to load tracked wallets:', error)
    return {
      walletsProcessed: 0,
      tradesFetched: 0,
      tradesInserted: 0,
      tradesSkipped: 0,
      marketsUpdated: 0,
      results: [],
    }
  }

  const rows = data as WalletRow[]
  const results: IngestWalletResult[] = []
  let tradesFetched = 0
  let tradesInserted = 0
  let tradesSkipped = 0
  let marketsUpdated = 0

  for (const row of rows) {
    const result = await ingestWalletTrades({
      walletRow: row,
      limit,
      maxPages,
      sportsOnly,
      fullBackfill,
    })
    results.push(result)
    tradesFetched += result.fetched
    tradesInserted += result.inserted
    tradesSkipped += result.skipped
    marketsUpdated += result.updatedOutcomes

    const updates: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    }
    if (result.maxTimestamp != null) {
      updates.last_trade_ts = result.maxTimestamp
    }
    if (fullBackfill) {
      updates.backfill_completed = true
    }
    if (!row.display_name) {
      updates.display_name = getWalletAlias(row.wallet)
    }
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await (supabase
        .from('polymarket_wallets' as any) as any)
        .update(updates)
        .eq('wallet', row.wallet)
      if (updateError) {
        console.warn('[Polymarket Wallets] Failed to update wallet:', updateError)
      }
    }
  }

  return {
    walletsProcessed: results.length,
    tradesFetched,
    tradesInserted,
    tradesSkipped,
    marketsUpdated,
    results,
  }
}
