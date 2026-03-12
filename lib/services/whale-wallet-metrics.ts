import { createServiceClient } from '@/lib/supabase/service'

const CACHE_TTL_MS = 30_000

type WalletMetricRow = {
  wallet: string
  roi_lifetime: number | null
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

const writeCachedMetrics = (wallet: string, metrics: WhaleWalletMetrics) => {
  walletMetricsCache.set(wallet, {
    ...metrics,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export async function hydrateWhaleTradesWithWalletMetrics<
  T extends { source: string; proxyWallet?: string | null },
>(trades: T[]): Promise<Array<T & WhaleWalletMetrics>> {
  if (!trades.length) return trades.map((trade) => ({ ...trade, walletRoiLifetime: null }))

  const missingWallets = new Set<string>()
  const metricsByWallet = new Map<string, WhaleWalletMetrics>()

  for (const trade of trades) {
    if (trade.source !== 'polymarket') continue
    const wallet = normalizeWallet(trade.proxyWallet)
    if (!wallet) continue
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
      const { data } = (await supabase
        .from('polymarket_wallet_summary' as any)
        .select('wallet, roi_lifetime')
        .in('wallet', Array.from(missingWallets))) as unknown as {
        data: WalletMetricRow[] | null
      }

      const found = new Set<string>()
      for (const row of data ?? []) {
        const wallet = normalizeWallet(row.wallet)
        if (!wallet) continue
        found.add(wallet)
        const metrics = {
          walletRoiLifetime:
            row.roi_lifetime != null && Number.isFinite(Number(row.roi_lifetime))
              ? Number(row.roi_lifetime)
              : null,
        } satisfies WhaleWalletMetrics
        metricsByWallet.set(wallet, metrics)
        writeCachedMetrics(wallet, metrics)
      }

      for (const wallet of missingWallets) {
        if (found.has(wallet)) continue
        const empty = { walletRoiLifetime: null } satisfies WhaleWalletMetrics
        metricsByWallet.set(wallet, empty)
        writeCachedMetrics(wallet, empty)
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
