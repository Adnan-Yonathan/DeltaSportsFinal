import { createServiceClient } from '@/lib/supabase/service'

const CACHE_TTL_MS = 5 * 60_000
const MISSING_CACHE_TTL_MS = 60_000
const ROI_CACHE_STALE_MS = 6 * 60 * 60_000
const FALLBACK_MAX_WALLETS_PER_REQUEST = 120
const FALLBACK_CONCURRENCY = 10
const FALLBACK_TIMEOUT_MS = 4_000
const POLYMARKET_DATA_API = 'https://data-api.polymarket.com'
const LEADERBOARD_ENDPOINT = `${POLYMARKET_DATA_API}/v1/leaderboard`
const CLOSED_POSITIONS_ENDPOINT = `${POLYMARKET_DATA_API}/closed-positions`
const CLOSED_POSITIONS_PAGE_SIZE = 500
const CLOSED_POSITIONS_MAX_PAGES = 8
const warnedMissingTables = new Set<string>()

type WalletMetricRow = {
  wallet: string
  roi_lifetime: number | null
  trade_count?: number | null
  buy_trade_count?: number | null
  settled_markets?: number | null
  total_realized_pnl?: number | null
}

type WalletRoiCacheRow = {
  wallet: string
  roi_lifetime: number | null
  total_realized_pnl?: number | null
  total_volume?: number | null
  last_computed_at?: string | null
}

type WalletRoiPayload = {
  wallet: string
  roiLifetime: number
  totalRealizedPnl: number
  totalVolume: number
  source: 'leaderboard' | 'closed_positions'
}

export type WhaleWalletMetrics = {
  walletRoiLifetime: number | null
}

type CachedWalletMetrics = WhaleWalletMetrics & {
  expiresAt: number
}

const walletMetricsCache = new Map<string, CachedWalletMetrics>()

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

const parseNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const parseCount = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  let timer: ReturnType<typeof setTimeout> | null = null
  const timeoutPromise = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs)
  })
  try {
    return (await Promise.race([promise, timeoutPromise])) as T | null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

const isMissingTableError = (error: { code?: string; message?: string } | null | undefined) =>
  Boolean(
    error &&
      (error.code === 'PGRST205' || /could not find the table/i.test(String(error.message ?? '')))
  )

const warnMissingTableOnce = (
  tableName: string,
  error: { code?: string; message?: string } | null | undefined
) => {
  if (warnedMissingTables.has(tableName)) return
  warnedMissingTables.add(tableName)
  console.warn(
    `[Whale Wallet Metrics] Table "${tableName}" missing; live ROI fallback will run without persistent cache.`,
    error
  )
}

const readCachedMetrics = (wallet: string) => {
  const hit = walletMetricsCache.get(wallet)
  if (!hit) return null
  if (hit.expiresAt < Date.now()) {
    walletMetricsCache.delete(wallet)
    return null
  }
  return {
    walletRoiLifetime: hit.walletRoiLifetime,
  } satisfies WhaleWalletMetrics
}

const writeCachedMetrics = (
  wallet: string,
  metrics: WhaleWalletMetrics,
  ttlMs = CACHE_TTL_MS
) => {
  walletMetricsCache.set(wallet, {
    ...metrics,
    expiresAt: Date.now() + Math.max(1_000, ttlMs),
  })
}

const hasSummaryActivity = (row: WalletMetricRow) => {
  return (
    parseCount(row.trade_count) > 0 ||
    parseCount(row.buy_trade_count) > 0 ||
    parseCount(row.settled_markets) > 0 ||
    Math.abs(parseNumber(row.total_realized_pnl) ?? 0) > 0
  )
}

const shouldRefreshSummaryRoi = (row: WalletMetricRow) => {
  const roi = parseNumber(row.roi_lifetime)
  if (roi == null) return true
  // Some rows are placeholders with zero metrics but still map to active feed wallets.
  if (roi === 0 && !hasSummaryActivity(row)) return true
  return false
}

const loadRoiCacheMetrics = async (wallets: string[]) => {
  if (!wallets.length) return new Map<string, WhaleWalletMetrics>()

  try {
    const supabase = createServiceClient()
    const { data, error } = (await supabase
      .from('polymarket_wallet_roi_cache' as any)
      .select('wallet, roi_lifetime, total_realized_pnl, total_volume, last_computed_at')
      .in('wallet', wallets)) as unknown as {
      data: WalletRoiCacheRow[] | null
      error: { code?: string; message?: string } | null
    }

    if (error) {
      if (isMissingTableError(error)) {
        warnMissingTableOnce('polymarket_wallet_roi_cache', error)
        return new Map<string, WhaleWalletMetrics>()
      }
      console.warn('[Whale Wallet Metrics] Failed to load ROI cache:', error)
      return new Map<string, WhaleWalletMetrics>()
    }

    const cutoff = Date.now() - ROI_CACHE_STALE_MS
    const mapped = new Map<string, WhaleWalletMetrics>()
    for (const row of data ?? []) {
      const wallet = normalizeWallet(row.wallet)
      if (!wallet) continue
      const roi = parseNumber(row.roi_lifetime)
      if (roi == null) continue
      const lastComputedAt = row.last_computed_at ? new Date(row.last_computed_at).getTime() : 0
      if (lastComputedAt && Number.isFinite(lastComputedAt) && lastComputedAt < cutoff) continue
      const metrics = { walletRoiLifetime: roi } satisfies WhaleWalletMetrics
      mapped.set(wallet, metrics)
    }
    return mapped
  } catch (error) {
    console.warn('[Whale Wallet Metrics] Failed to read ROI cache table:', error)
    return new Map<string, WhaleWalletMetrics>()
  }
}

const persistRoiCacheMetrics = async (rows: WalletRoiPayload[]) => {
  if (!rows.length) return

  const now = new Date().toISOString()
  const payload = rows.map((row) => ({
    wallet: row.wallet,
    roi_lifetime: row.roiLifetime,
    total_realized_pnl: row.totalRealizedPnl,
    total_volume: row.totalVolume,
    source: row.source,
    last_computed_at: now,
    updated_at: now,
  }))

  try {
    const supabase = createServiceClient()
    const { error } = (await supabase
      .from('polymarket_wallet_roi_cache' as any)
      .upsert(payload as any, { onConflict: 'wallet' } as any)) as unknown as {
      error: { code?: string; message?: string } | null
    }
    if (!error) return
    if (isMissingTableError(error)) {
      warnMissingTableOnce('polymarket_wallet_roi_cache', error)
      return
    }
    console.warn('[Whale Wallet Metrics] Failed to persist ROI cache rows:', error)
  } catch (error) {
    console.warn('[Whale Wallet Metrics] Failed to persist ROI cache rows:', error)
  }
}

const fetchJsonWithTimeout = async (url: string) => {
  const response = await withTimeout(fetch(url, { cache: 'no-store' }), FALLBACK_TIMEOUT_MS)
  if (!response || !response.ok) return null
  try {
    return await response.json()
  } catch {
    return null
  }
}

const fetchRoiFromLeaderboard = async (wallet: string): Promise<WalletRoiPayload | null> => {
  const url = new URL(LEADERBOARD_ENDPOINT)
  url.searchParams.set('user', wallet)
  url.searchParams.set('timePeriod', 'ALL')
  url.searchParams.set('orderBy', 'PNL')
  url.searchParams.set('limit', '1')

  const payload = await fetchJsonWithTimeout(url.toString())
  if (!Array.isArray(payload) || payload.length === 0) return null

  const normalizedWallet = normalizeWallet(wallet)
  const row =
    payload.find(
      (entry) =>
        normalizeWallet(String((entry as Record<string, unknown>).proxyWallet ?? '')) ===
        normalizedWallet
    ) ?? payload[0]
  if (!row || typeof row !== 'object') return null

  const pnl = parseNumber((row as Record<string, unknown>).pnl)
  const volume = parseNumber((row as Record<string, unknown>).vol)
  if (pnl == null || volume == null || volume <= 0) return null

  const roiLifetime = pnl / volume
  if (!Number.isFinite(roiLifetime)) return null

  return {
    wallet,
    roiLifetime,
    totalRealizedPnl: pnl,
    totalVolume: volume,
    source: 'leaderboard',
  }
}

const fetchRoiFromClosedPositions = async (wallet: string): Promise<WalletRoiPayload | null> => {
  let totalRealizedPnl = 0
  let totalBought = 0
  let hadRows = false

  for (let page = 0; page < CLOSED_POSITIONS_MAX_PAGES; page += 1) {
    const offset = page * CLOSED_POSITIONS_PAGE_SIZE
    const url = new URL(CLOSED_POSITIONS_ENDPOINT)
    url.searchParams.set('user', wallet)
    url.searchParams.set('limit', String(CLOSED_POSITIONS_PAGE_SIZE))
    url.searchParams.set('offset', String(offset))

    const payload = await fetchJsonWithTimeout(url.toString())
    if (!Array.isArray(payload) || payload.length === 0) break
    hadRows = true

    for (const row of payload) {
      if (!row || typeof row !== 'object') continue
      const entry = row as Record<string, unknown>
      totalRealizedPnl += parseNumber(entry.realizedPnl) ?? 0
      totalBought += parseNumber(entry.totalBought) ?? 0
    }

    if (payload.length < CLOSED_POSITIONS_PAGE_SIZE) break
  }

  if (!hadRows || totalBought <= 0) return null
  const roiLifetime = totalRealizedPnl / totalBought
  if (!Number.isFinite(roiLifetime)) return null

  return {
    wallet,
    roiLifetime,
    totalRealizedPnl,
    totalVolume: totalBought,
    source: 'closed_positions',
  }
}

const fetchWalletRoiFallback = async (wallet: string) => {
  const leaderboard = await fetchRoiFromLeaderboard(wallet)
  if (leaderboard) return leaderboard
  return fetchRoiFromClosedPositions(wallet)
}

const fetchFallbackMetricsForWallets = async (wallets: string[]) => {
  const pending = [...wallets]
  const found = new Map<string, WalletRoiPayload>()

  const workers = Array.from({
    length: Math.min(FALLBACK_CONCURRENCY, pending.length),
  }).map(async () => {
    while (pending.length) {
      const wallet = pending.shift()
      if (!wallet) break
      const payload = await fetchWalletRoiFallback(wallet)
      if (!payload) continue
      found.set(wallet, payload)
    }
  })

  await Promise.all(workers)
  return found
}

export async function hydrateWhaleTradesWithWalletMetrics<
  T extends { source: string; proxyWallet?: string | null },
>(trades: T[]): Promise<Array<T & WhaleWalletMetrics>> {
  if (!trades.length) return trades.map((trade) => ({ ...trade, walletRoiLifetime: null }))

  const missingWallets = new Set<string>()
  const walletTradeCounts = new Map<string, number>()
  const metricsByWallet = new Map<string, WhaleWalletMetrics>()

  for (const trade of trades) {
    if (trade.source !== 'polymarket') continue
    const wallet = normalizeWallet(trade.proxyWallet)
    if (!wallet) continue
    walletTradeCounts.set(wallet, (walletTradeCounts.get(wallet) ?? 0) + 1)
    const cached = readCachedMetrics(wallet)
    if (cached) {
      metricsByWallet.set(wallet, cached)
      continue
    }
    missingWallets.add(wallet)
  }

  if (missingWallets.size) {
    try {
      const supabase = createServiceClient()
      const walletList = Array.from(missingWallets)
      const { data } = (await supabase
        .from('polymarket_wallet_summary' as any)
        .select(
          'wallet, roi_lifetime, trade_count, buy_trade_count, settled_markets, total_realized_pnl'
        )
        .in('wallet', walletList)) as unknown as {
        data: WalletMetricRow[] | null
      }

      const found = new Set<string>()
      const fallbackCandidates = new Set<string>()
      for (const row of data ?? []) {
        const wallet = normalizeWallet(row.wallet)
        if (!wallet) continue
        found.add(wallet)
        if (shouldRefreshSummaryRoi(row)) {
          fallbackCandidates.add(wallet)
          continue
        }
        const metrics = {
          walletRoiLifetime:
            row.roi_lifetime != null && Number.isFinite(Number(row.roi_lifetime))
              ? Number(row.roi_lifetime)
              : null,
        } satisfies WhaleWalletMetrics
        metricsByWallet.set(wallet, metrics)
        writeCachedMetrics(wallet, metrics)
      }

      for (const wallet of walletList) {
        if (!found.has(wallet)) fallbackCandidates.add(wallet)
      }

      const fallbackWallets = Array.from(fallbackCandidates)
        .sort((left, right) => (walletTradeCounts.get(right) ?? 0) - (walletTradeCounts.get(left) ?? 0))

      if (fallbackWallets.length > 0) {
        const cacheHits = await loadRoiCacheMetrics(fallbackWallets)
        for (const [wallet, metrics] of cacheHits.entries()) {
          metricsByWallet.set(wallet, metrics)
          writeCachedMetrics(wallet, metrics)
        }

        const unresolved = fallbackWallets
          .filter((wallet) => !cacheHits.has(wallet))
          .slice(0, FALLBACK_MAX_WALLETS_PER_REQUEST)
        const fetchedFallback = await fetchFallbackMetricsForWallets(unresolved)
        if (fetchedFallback.size > 0) {
          const persistRows: WalletRoiPayload[] = []
          for (const [wallet, payload] of fetchedFallback.entries()) {
            const metrics = {
              walletRoiLifetime: payload.roiLifetime,
            } satisfies WhaleWalletMetrics
            metricsByWallet.set(wallet, metrics)
            writeCachedMetrics(wallet, metrics)
            persistRows.push(payload)
          }
          await persistRoiCacheMetrics(persistRows)
        }
      }

      for (const wallet of walletList) {
        if (metricsByWallet.has(wallet)) continue
        const empty = { walletRoiLifetime: null } satisfies WhaleWalletMetrics
        metricsByWallet.set(wallet, empty)
        writeCachedMetrics(wallet, empty, MISSING_CACHE_TTL_MS)
      }
    } catch (error) {
      console.warn('[Whale Wallet Metrics] Failed to hydrate wallet metrics:', error)
    }
  }

  return trades.map((trade) => {
    if (trade.source !== 'polymarket') {
      return {
        ...trade,
        walletRoiLifetime: null,
      }
    }
    const wallet = normalizeWallet(trade.proxyWallet)
    const metrics = wallet ? metricsByWallet.get(wallet) : null
    return {
      ...trade,
      walletRoiLifetime: metrics?.walletRoiLifetime ?? null,
    }
  })
}
