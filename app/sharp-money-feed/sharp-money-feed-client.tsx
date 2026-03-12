"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SimpleHeader } from "@/components/ui/simple-header"
import MobileToolsNav from "@/components/mobile-tools-nav"
import { cn } from "@/lib/utils"

type SportFilter = "ALL" | "NBA" | "NFL" | "NCAAB" | "NHL" | "MLB" | "SOCCER" | "ESPORTS"
type DateWindow = "today" | "tomorrow" | "future" | "all"

type FeedTrade = {
  id: string
  wallet: string
  side: "BUY" | "SELL" | null
  notional: number | null
  trade_time: string
  sport: string
  eventDate: string | null
  title: string | null
  outcome: string | null
  entry_american_odds: number | null
  current_american_odds: number | null
  price_move_cents: number | null
  total_realized_pnl: number
  roi_lifetime: number
  trade_count: number
  avg_bet_size: number
  bet_size_vs_avg_ratio: number | null
  bet_size_vs_avg_label: "above_average" | "near_average" | "below_average" | null
}

type WalletListItem = {
  wallet: string
  total_realized_pnl: number
  roi_lifetime: number
  avg_bet_size: number
  open_positions_count: number
  sport_label: string
  sport_total_realized_pnl: number
  sport_roi_lifetime: number
  sport_avg_bet_size: number
}

type WalletPosition = {
  wallet: string
  slug: string
  event_slug: string | null
  sport: string | null
  title: string | null
  outcome: string | null
  outcome_index: number | null
  net_shares: number
  avg_entry_price: number | null
  avg_entry_american_odds: number | null
  stake_usd: number
  potential_payout_usd: number
  last_trade_time: string | null
  updated_at: string
}

type WalletPositionsPayload = {
  wallet: string
  summary: {
    total_realized_pnl?: number | null
    roi_lifetime?: number | null
    avg_bet_size?: number | null
  } | null
  sport_summary: {
    total_realized_pnl?: number | null
    roi_lifetime?: number | null
    avg_bet_size?: number | null
  } | null
  positions: WalletPosition[]
}

const SPORT_OPTIONS: Array<{ value: SportFilter; label: string }> = [
  { value: "ALL", label: "League: All" },
  { value: "NBA", label: "League: NBA" },
  { value: "NFL", label: "League: NFL" },
  { value: "NCAAB", label: "League: NCAAB" },
  { value: "NHL", label: "League: NHL" },
  { value: "MLB", label: "League: MLB" },
  { value: "SOCCER", label: "League: Soccer" },
  { value: "ESPORTS", label: "League: Esports" },
]

const DATE_WINDOW_OPTIONS: Array<{ value: DateWindow; label: string }> = [
  { value: "today", label: "Date: Today" },
  { value: "tomorrow", label: "Date: Tomorrow" },
  { value: "future", label: "Date: Future" },
  { value: "all", label: "Date: All" },
]

const formatCurrency = (value?: number | null) => {
  if (!Number.isFinite(value)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number(value) >= 100 ? 0 : 2,
  }).format(Number(value))
}

const formatCompactCurrency = (value?: number | null) => {
  if (!Number.isFinite(value)) return "$0"
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number(value))
}

const formatPercent = (value?: number | null) => {
  if (!Number.isFinite(value)) return "0.0%"
  return `${(Number(value) * 100).toFixed(1)}%`
}

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "n/a"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatAmericanOdds = (value?: number | null) => {
  if (!Number.isFinite(value)) return "n/a"
  const rounded = Math.round(Number(value))
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatPrice = (value?: number | null) => {
  if (!Number.isFinite(value)) return "n/a"
  return `${Math.round(Number(value) * 100)}c`
}

const resolveGameLabel = (marketTitle?: string | null) =>
  (marketTitle ?? "Unknown market").split(/\s*(spread|moneyline|total)/i)[0].trim()

const formatRelativeBetLabel = (trade: FeedTrade) => {
  if (!Number.isFinite(trade.bet_size_vs_avg_ratio)) return "--"
  const delta = (Number(trade.bet_size_vs_avg_ratio) - 1) * 100
  if (Math.abs(delta) < 1) return "At average"
  return delta > 0
    ? `${Math.round(delta)}% above`
    : `${Math.round(Math.abs(delta))}% below`
}

const sortTrades = (trades: FeedTrade[]) => {
  const next = [...trades]
  return next.sort((left, right) => {
    const ratioDiff =
      Number(right.bet_size_vs_avg_ratio ?? Number.NEGATIVE_INFINITY) -
      Number(left.bet_size_vs_avg_ratio ?? Number.NEGATIVE_INFINITY)
    if (ratioDiff !== 0) return ratioDiff
    return new Date(right.trade_time).getTime() - new Date(left.trade_time).getTime()
  })
}

const shortenWallet = (wallet?: string | null) => {
  if (!wallet) return "Unknown wallet"
  if (wallet.length <= 12) return wallet
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

export default function SharpMoneyFeedClient() {
  const [sport, setSport] = useState<SportFilter>("ALL")
  const [dateWindow, setDateWindow] = useState<DateWindow>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [trades, setTrades] = useState<FeedTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const [walletPanelOpen, setWalletPanelOpen] = useState(false)
  const [wallets, setWallets] = useState<WalletListItem[]>([])
  const [walletsLoading, setWalletsLoading] = useState(false)
  const [walletsError, setWalletsError] = useState<string | null>(null)
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [walletPositionsByWallet, setWalletPositionsByWallet] = useState<
    Record<string, WalletPositionsPayload>
  >({})
  const [walletPositionsLoading, setWalletPositionsLoading] = useState(false)
  const [walletPositionsError, setWalletPositionsError] = useState<string | null>(null)

  const fetchTrades = async (manual = false) => {
    if (manual) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        limit: "250",
        eligibility: "profitable",
        sport,
        dateWindow,
      })
      const response = await fetch(`/api/polymarket/bettors/feed?${params.toString()}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to load sharp money feed.")
      }
      const payload = await response.json()
      setTrades(Array.isArray(payload.trades) ? payload.trades : [])
      setLastUpdatedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sharp money feed.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const fetchWallets = async () => {
    setWalletsLoading(true)
    setWalletsError(null)

    try {
      const params = new URLSearchParams({
        limit: "80",
        eligibility: "profitable",
      })
      if (sport !== "ALL") {
        params.set("sport", sport)
      }

      const response = await fetch(`/api/polymarket/bettors/leaderboard?${params.toString()}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to load profitable wallets.")
      }

      const payload = await response.json()
      const nextWallets = Array.isArray(payload.bettors) ? payload.bettors : []
      setWallets(nextWallets)
      setSelectedWallet((current) => {
        if (current && nextWallets.some((row: WalletListItem) => row.wallet === current)) {
          return current
        }
        return nextWallets[0]?.wallet ?? null
      })
    } catch (err) {
      setWalletsError(err instanceof Error ? err.message : "Failed to load profitable wallets.")
      setWallets([])
      setSelectedWallet(null)
    } finally {
      setWalletsLoading(false)
    }
  }

  const fetchWalletPositions = async (wallet: string) => {
    if (!wallet) return
    setWalletPositionsLoading(true)
    setWalletPositionsError(null)

    try {
      const params = new URLSearchParams({ limit: "100" })
      if (sport !== "ALL") {
        params.set("sport", sport)
      }

      const response = await fetch(
        `/api/polymarket/bettors/${wallet}/positions?${params.toString()}`,
        { cache: "no-store" }
      )
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error ?? "Failed to load wallet positions.")
      }

      const payload = (await response.json()) as WalletPositionsPayload
      setWalletPositionsByWallet((current) => ({
        ...current,
        [wallet]: payload,
      }))
    } catch (err) {
      setWalletPositionsError(err instanceof Error ? err.message : "Failed to load wallet positions.")
    } finally {
      setWalletPositionsLoading(false)
    }
  }

  useEffect(() => {
    void fetchTrades()
    void fetchWallets()
    setWalletPositionsByWallet({})
  }, [sport, dateWindow])

  useEffect(() => {
    if (!walletPanelOpen || !selectedWallet || walletPositionsByWallet[selectedWallet]) return
    void fetchWalletPositions(selectedWallet)
  }, [walletPanelOpen, selectedWallet, walletPositionsByWallet, sport])

  const filteredTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const searched = query
      ? trades.filter((trade) => {
          const haystack = `${trade.title ?? ""} ${trade.outcome ?? ""} ${trade.sport}`.toLowerCase()
          return haystack.includes(query)
        })
      : trades
    return sortTrades(searched)
  }, [searchQuery, trades])

  const selectedWalletPayload = selectedWallet ? walletPositionsByWallet[selectedWallet] : null
  const selectedWalletMetrics = useMemo(() => {
    if (!selectedWallet) return null
    return wallets.find((wallet) => wallet.wallet === selectedWallet) ?? null
  }, [selectedWallet, wallets])

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />

      <div className="mx-auto w-full max-w-6xl px-3 pb-[172px] pt-20 sm:px-4 sm:pb-[180px]">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/75">
              Sharp Money Feed
            </div>

            <select
              value={sport}
              onChange={(event) => setSport(event.target.value as SportFilter)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              {SPORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              value={dateWindow}
              onChange={(event) => setDateWindow(event.target.value as DateWindow)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              {DATE_WINDOW_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search teams or markets..."
              className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-300/60 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => {
                void fetchTrades(true)
                void fetchWallets()
              }}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-emerald-300/60"
            >
              Refresh
            </button>

            <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  loading || refreshing ? "bg-amber-300" : "bg-emerald-300"
                )}
              />
              <span>live</span>
              <span>|</span>
              <span>{filteredTrades.length} rows</span>
              {lastUpdatedAt && (
                <>
                  <span>|</span>
                  <span>{formatShortDateTime(lastUpdatedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {error ? (
            <div className="px-4 py-6 text-sm text-rose-200">{error}</div>
          ) : loading ? (
            <div className="px-4 py-6 text-sm text-white/60">Loading sharp money feed...</div>
          ) : filteredTrades.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">
              No profitable-bettor trades match the current filters.
            </div>
          ) : (
            <>
              <div className="max-h-[68vh] divide-y divide-white/5 overflow-y-auto sm:hidden">
                {filteredTrades.map((trade) => (
                  <article
                    key={trade.id}
                    className="space-y-3 px-3 py-3 text-xs text-white/70 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                          {trade.sport} | {formatShortDateTime(trade.trade_time)}
                        </div>
                        <div className="text-left text-sm font-semibold text-white">
                          {resolveGameLabel(trade.title)}
                        </div>
                      </div>
                      <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                        {formatRelativeBetLabel(trade)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <MobileMetric label="Bet" value={trade.outcome ?? "n/a"} />
                      <MobileMetric label="Size" value={formatCurrency(trade.notional)} />
                      <MobileMetric label="Total profit" value={formatCurrency(trade.total_realized_pnl)} />
                      <MobileMetric label="ROI" value={formatPercent(trade.roi_lifetime)} />
                      <MobileMetric label="Avg bet" value={formatCurrency(trade.avg_bet_size)} />
                      <MobileMetric label="Relative" value={formatRelativeBetLabel(trade)} />
                      <MobileMetric label="Entry" value={formatAmericanOdds(trade.entry_american_odds)} />
                      <MobileMetric label="Current" value={formatAmericanOdds(trade.current_american_odds)} />
                    </div>
                  </article>
                ))}
              </div>

              <div className="hidden sm:block">
                <div className="max-h-[72vh] overflow-auto">
                  <Table className="min-w-[1280px] text-[13px] text-white/75">
                    <TableHeader className="bg-black/70">
                      <TableRow className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        <TableHead className="w-[120px]">Size</TableHead>
                        <TableHead className="w-[260px]">Game</TableHead>
                        <TableHead className="w-[220px]">Bet</TableHead>
                        <TableHead className="w-[90px]">Sport</TableHead>
                        <TableHead className="w-[130px]">Total Profit</TableHead>
                        <TableHead className="w-[90px]">ROI</TableHead>
                        <TableHead className="w-[120px]">Avg Bet</TableHead>
                        <TableHead className="w-[120px]">Relative</TableHead>
                        <TableHead className="w-[90px]">Entry</TableHead>
                        <TableHead className="w-[90px]">Current</TableHead>
                        <TableHead className="w-[90px]">Move</TableHead>
                        <TableHead className="w-[170px]">Detected</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-white/5">
                      {filteredTrades.map((trade) => (
                        <TableRow
                          key={trade.id}
                          className="border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <TableCell className="align-top">
                            <div className="font-semibold text-emerald-200">
                              {formatCompactCurrency(trade.notional)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-sm font-semibold text-white">
                              {resolveGameLabel(trade.title)}
                            </div>
                            <div className="mt-1 text-[11px] text-white/45">{trade.title ?? "Unknown market"}</div>
                          </TableCell>
                          <TableCell className="align-top text-white/85">{trade.outcome ?? "n/a"}</TableCell>
                          <TableCell className="align-top">{trade.sport || "SPORTS"}</TableCell>
                          <TableCell className="align-top text-emerald-200">
                            {formatCurrency(trade.total_realized_pnl)}
                          </TableCell>
                          <TableCell className="align-top text-white">{formatPercent(trade.roi_lifetime)}</TableCell>
                          <TableCell className="align-top">{formatCurrency(trade.avg_bet_size)}</TableCell>
                          <TableCell className="align-top">
                            <span
                              className={cn(
                                trade.bet_size_vs_avg_label === "above_average"
                                  ? "text-emerald-200"
                                  : trade.bet_size_vs_avg_label === "below_average"
                                    ? "text-amber-200"
                                    : "text-white/70"
                              )}
                            >
                              {formatRelativeBetLabel(trade)}
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                            {formatAmericanOdds(trade.entry_american_odds)}
                          </TableCell>
                          <TableCell className="align-top">
                            {formatAmericanOdds(trade.current_american_odds)}
                          </TableCell>
                          <TableCell className="align-top">
                            {trade.price_move_cents == null
                              ? "n/a"
                              : `${trade.price_move_cents > 0 ? "+" : ""}${trade.price_move_cents}c`}
                          </TableCell>
                          <TableCell className="align-top">{formatShortDateTime(trade.trade_time)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[72px] z-40 px-3 sm:bottom-4 sm:px-4">
        <div className="mx-auto w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-black/95 shadow-[0_-16px_60px_rgba(0,0,0,0.45)] backdrop-blur">
          <button
            type="button"
            onClick={() => setWalletPanelOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
          >
            <div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Wallets</div>
              <div className="mt-1 text-sm font-semibold text-white">Sport-profitable wallets</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-[11px] text-white/55">
                {walletsLoading ? "Loading..." : `${wallets.length} wallets`}
              </div>
              <span className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/70">
                {walletPanelOpen ? "Hide" : "Show"}
              </span>
            </div>
          </button>

          {walletPanelOpen && (
            <div className="border-t border-white/10">
              <div className="grid max-h-[58vh] grid-cols-1 overflow-hidden sm:grid-cols-[320px_minmax(0,1fr)]">
                <div className="border-b border-white/10 sm:border-b-0 sm:border-r">
                  {walletsError ? (
                    <div className="px-4 py-4 text-sm text-rose-200">{walletsError}</div>
                  ) : walletsLoading ? (
                    <div className="px-4 py-4 text-sm text-white/60">Loading wallets...</div>
                  ) : wallets.length === 0 ? (
                    <div className="px-4 py-4 text-sm text-white/60">
                      No sport-profitable wallets for this filter.
                    </div>
                  ) : (
                    <div className="max-h-[240px] overflow-y-auto sm:max-h-[58vh]">
                      {wallets.map((wallet) => {
                        const profit =
                          sport === "ALL"
                            ? wallet.total_realized_pnl
                            : wallet.sport_total_realized_pnl
                        const roi =
                          sport === "ALL" ? wallet.roi_lifetime : wallet.sport_roi_lifetime
                        const avgBet =
                          sport === "ALL" ? wallet.avg_bet_size : wallet.sport_avg_bet_size

                        return (
                          <button
                            key={wallet.wallet}
                            type="button"
                            onClick={() => setSelectedWallet(wallet.wallet)}
                            className={cn(
                              "block w-full border-b border-white/5 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]",
                              selectedWallet === wallet.wallet && "bg-emerald-500/10"
                            )}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="text-sm font-semibold text-white">
                                  {shortenWallet(wallet.wallet)}
                                </div>
                                <div className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/40">
                                  {sport === "ALL" ? wallet.sport_label || "SPORTS" : sport}
                                </div>
                              </div>
                              <div className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/65">
                                {wallet.open_positions_count} open
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-white/65">
                              <div>
                                <div className="text-white/35">Profit</div>
                                <div className="mt-1 text-emerald-200">{formatCompactCurrency(profit)}</div>
                              </div>
                              <div>
                                <div className="text-white/35">ROI</div>
                                <div className="mt-1 text-white">{formatPercent(roi)}</div>
                              </div>
                              <div>
                                <div className="text-white/35">Avg bet</div>
                                <div className="mt-1 text-white">{formatCompactCurrency(avgBet)}</div>
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="min-h-[240px] overflow-y-auto">
                  {walletPositionsError ? (
                    <div className="px-4 py-4 text-sm text-rose-200">{walletPositionsError}</div>
                  ) : !selectedWallet ? (
                    <div className="px-4 py-4 text-sm text-white/60">Select a wallet to view open trades.</div>
                  ) : walletPositionsLoading && !selectedWalletPayload ? (
                    <div className="px-4 py-4 text-sm text-white/60">Loading open trades...</div>
                  ) : (
                    <div className="px-4 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.2em] text-white/45">Selected wallet</div>
                          <div className="mt-1 text-lg font-semibold text-white">
                            {shortenWallet(selectedWallet)}
                          </div>
                        </div>
                        {selectedWalletMetrics && (
                          <div className="grid grid-cols-3 gap-2 text-[11px] text-white/65">
                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                              <div className="text-white/35">Profit</div>
                              <div className="mt-1 text-emerald-200">
                                {formatCurrency(
                                  sport === "ALL"
                                    ? selectedWalletMetrics.total_realized_pnl
                                    : selectedWalletMetrics.sport_total_realized_pnl
                                )}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                              <div className="text-white/35">ROI</div>
                              <div className="mt-1 text-white">
                                {formatPercent(
                                  sport === "ALL"
                                    ? selectedWalletMetrics.roi_lifetime
                                    : selectedWalletMetrics.sport_roi_lifetime
                                )}
                              </div>
                            </div>
                            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
                              <div className="text-white/35">Avg bet</div>
                              <div className="mt-1 text-white">
                                {formatCurrency(
                                  sport === "ALL"
                                    ? selectedWalletMetrics.avg_bet_size
                                    : selectedWalletMetrics.sport_avg_bet_size
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 space-y-2">
                        {selectedWalletPayload?.positions?.length ? (
                          selectedWalletPayload.positions.map((position) => (
                            <div
                              key={`${position.slug}:${position.outcome_index ?? "na"}`}
                              className="rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3"
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <div className="text-sm font-semibold text-white">
                                    {resolveGameLabel(position.title)}
                                  </div>
                                  <div className="mt-1 text-xs text-white/55">
                                    {position.title ?? "Unknown market"}
                                  </div>
                                  <div className="mt-2 text-sm text-white/85">
                                    {position.outcome ?? "n/a"}
                                  </div>
                                </div>
                                <div className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/65">
                                  {position.sport ?? "SPORTS"}
                                </div>
                              </div>

                              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-white/65 sm:grid-cols-5">
                                <WalletMetric label="Stake" value={formatCurrency(position.stake_usd)} />
                                <WalletMetric
                                  label="Entry"
                                  value={formatAmericanOdds(position.avg_entry_american_odds)}
                                />
                                <WalletMetric label="Entry px" value={formatPrice(position.avg_entry_price)} />
                                <WalletMetric
                                  label="Net shares"
                                  value={Number(position.net_shares).toFixed(2)}
                                />
                                <WalletMetric
                                  label="Updated"
                                  value={formatShortDateTime(position.updated_at)}
                                />
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="text-sm text-white/60">No open sports trades for this wallet.</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <MobileToolsNav />
    </div>
  )
}

function MobileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  )
}

function WalletMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  )
}
