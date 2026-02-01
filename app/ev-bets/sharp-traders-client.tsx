"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ServerManagementTable, type SharpTraderRow } from "@/components/ui/server-management-table"

type OpenTrade = {
  title: string | null
  slug: string | null
  event_slug: string | null
  outcome: string | null
  size: number | null
  avg_price: number | null
  cash_pnl: number | null
  cur_price: number | null
  end_date: string | null
}

type WalletRow = {
  wallet: string
  total_pnl: number
  pnl_30d: number
  open_trades: OpenTrade[]
}

type SharpTradersResponse = {
  wallets: WalletRow[]
  fetched_wallets: number
  sampled_trades: number
}

const BASE_URL = "/api/polymarket/wallets/top-profit"

type SearchParams = {
  tradeLimit: number
  tradePages: number
  top: number
  minTradeSamples: number
  openTradeLimit: number
}

const truncateWallet = (wallet: string) => {
  if (wallet.length <= 10) return wallet
  return `${wallet.slice(0, 6)}…${wallet.slice(-4)}`
}

const SPORT_LABELS: Record<string, string> = {
  nba: "NBA",
  nfl: "NFL",
  ncaaf: "NCAAF",
  ncaab: "NCAAB",
  cfb: "NCAAF",
  cbb: "NCAAB",
  nhl: "NHL",
  mlb: "MLB",
  wnba: "WNBA",
  soccer: "Soccer",
  golf: "Golf",
  ufc: "UFC",
}

const resolveSportKey = (trade: OpenTrade) => {
  const slug = trade.event_slug ?? trade.slug ?? ""
  const prefix = slug.split("-")[0]?.toLowerCase()
  if (!prefix) return null
  if (prefix === "cfb") return "ncaaf"
  if (prefix === "cbb") return "ncaab"
  return prefix
}

const isTradeInWindow = (endDate?: string | null) => {
  if (!endDate) return false
  const parsed = new Date(endDate)
  if (Number.isNaN(parsed.getTime())) return false
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  return parsed >= start && parsed <= end
}

export default function SharpTradersClient({ previewMode }: { previewMode: boolean }) {
  const [data, setData] = useState<SharpTradersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sportFilter, setSportFilter] = useState<string>("all")
  const initialParams = useMemo(
    () => ({
      tradeLimit: 250,
      tradePages: 3,
      top: 20,
      minTradeSamples: 2000,
      openTradeLimit: 3,
    }),
    []
  )
  const fullParams = useMemo(
    () => ({
      tradeLimit: 500,
      tradePages: 10,
      top: 50,
      minTradeSamples: 5000,
      openTradeLimit: 0,
    }),
    []
  )
  const [searchParams, setSearchParams] = useState(initialParams)
  const [hasRequestedFull, setHasRequestedFull] = useState(false)
  const requestIdRef = useRef(0)

  const loadData = useCallback(
    async (params: SearchParams, opts?: { updateSearch?: boolean; background?: boolean; markFull?: boolean }) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      if (opts?.background) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }
      try {
        const search = new URLSearchParams({
          tradeLimit: String(params.tradeLimit),
          tradePages: String(params.tradePages),
          top: String(params.top),
          minTradeSamples: String(params.minTradeSamples),
        })
        if (params.openTradeLimit) {
          search.set("openTradeLimit", String(params.openTradeLimit))
        }
        const res = await fetch(`${BASE_URL}?${search.toString()}`, { cache: "no-store" })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error || "Failed to load sharp traders.")
        }
        const payload = (await res.json()) as SharpTradersResponse
        if (requestIdRef.current !== requestId) return
        setData(payload)
        if (opts?.updateSearch) {
          setSearchParams(params)
        }
      } catch (err) {
        if (requestIdRef.current !== requestId) return
        if (!opts?.background) {
          setError(err instanceof Error ? err.message : "Failed to load sharp traders.")
        }
      } finally {
        if (requestIdRef.current !== requestId) return
        if (opts?.background) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    []
  )

  useEffect(() => {
    void loadData(initialParams, { updateSearch: true })
  }, [initialParams, loadData])

  useEffect(() => {
    if (hasRequestedFull) return
    if (!data) return
    setHasRequestedFull(true)
    // Fire the full fetch in the background after initial render.
    void loadData(fullParams, { updateSearch: true, background: true, markFull: true })
  }, [data, fullParams, hasRequestedFull, loadData])

  const wallets = useMemo(() => {
    const rows = data?.wallets ?? []
    return rows
      .map((row) => ({
        ...row,
        open_trades:
          row.open_trades
            ?.filter((trade) => isTradeInWindow(trade.end_date))
            .filter((trade) => {
              if (sportFilter === "all") return true
              const sportKey = resolveSportKey(trade)
              return sportKey === sportFilter
            }) ?? [],
      }))
      .filter((row) => row.open_trades.length > 0)
  }, [data, sportFilter])

  const availableSports = useMemo(() => {
    const set = new Set<string>()
    data?.wallets?.forEach((row) => {
      row.open_trades?.forEach((trade) => {
        if (!isTradeInWindow(trade.end_date)) return
        const sportKey = resolveSportKey(trade)
        if (sportKey) set.add(sportKey)
      })
    })
    return Array.from(set).sort((a, b) => (SPORT_LABELS[a] ?? a).localeCompare(SPORT_LABELS[b] ?? b))
  }, [data])

  const rankedWallets = useMemo<SharpTraderRow[]>(() => {
    return [...wallets]
      .sort((a, b) => b.total_pnl - a.total_pnl)
      .map((wallet, index) => ({
        id: wallet.wallet,
        rank: index + 1,
        wallet: wallet.wallet,
        walletShort: truncateWallet(wallet.wallet),
        totalPnl: wallet.total_pnl,
        pnl30d: wallet.pnl_30d,
        openTrades: wallet.open_trades,
      }))
  }, [wallets])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-full border border-white/10 bg-black/50 px-4 py-2 text-[11px] uppercase tracking-[0.2em] text-white/60">
          Sport
        </div>
        <div className="relative">
          <select
            value={sportFilter}
            onChange={(event) => setSportFilter(event.target.value)}
            className="appearance-none rounded-full border border-white/10 bg-black/60 px-4 py-2 pr-10 text-[11px] uppercase tracking-[0.2em] text-white/80 transition-colors hover:border-emerald-400/50 focus:outline-none"
          >
            <option value="all">All Sports</option>
            {availableSports.map((sport) => (
              <option key={sport} value={sport}>
                {SPORT_LABELS[sport] ?? sport.toUpperCase()}
              </option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40">
            ▾
          </span>
        </div>
      </div>

      {previewMode && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-xs text-amber-100">
          Preview mode: some wallet details may be hidden on lower tiers.
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
          Loading sharp traders...
        </div>
      )}
      {!loading && loadingMore && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          Loading full trades in the background...
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
          {error}
        </div>
      )}

      {!loading && !error && wallets.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-sm text-white/60">
          No open sports positions found yet. Try again soon.
        </div>
      )}

      {!loading && !error && wallets.length > 0 && (
        <ServerManagementTable wallets={rankedWallets} />
      )}
    </div>
  )
}
