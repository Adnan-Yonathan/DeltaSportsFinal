"use client"

import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { X } from "lucide-react"
import { formatCurrency } from "@/lib/utils/odds"

export type SharpTrade = {
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

export type SharpTraderRow = {
  id: string
  rank: number
  wallet: string
  walletShort: string
  totalPnl: number
  pnl30d: number
  pnlPrevDay: number
  topSports: Array<{
    sport: string
    pnl: number
    trades: number
  }>
  arbScore7d: number
  arbLabel7d: "likely_arb" | "possible_arb" | "likely_directional"
  arbReasons7d: string[]
  tradeCount7d: number
  winRate7d: number | null
  avgPnl7d: number | null
  pnlStddev7d: number | null
  openTrades: SharpTrade[]
}

interface ServerManagementTableProps {
  title?: string
  wallets?: SharpTraderRow[]
  children?: React.ReactNode
  showList?: boolean
  showHeaderRow?: boolean
  className?: string
  trackedWallets?: Set<string>
  onToggleTrack?: (wallet: string) => void
}

const formatNumber = (value?: number | null, digits = 2) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value.toFixed(digits)
}

const formatDate = (value?: string | null) => {
  if (!value) return "n/a"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

const formatSportLabel = (sport: string) => SPORT_LABELS[sport] ?? sport.toUpperCase()

const formatArbLabel = (label: SharpTraderRow["arbLabel7d"]) => {
  if (label === "likely_arb") return "Likely Arb"
  if (label === "possible_arb") return "Possible Arb"
  return "Likely Directional"
}

const formatPercent = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${(value * 100).toFixed(1)}%`
}

export function ServerManagementTable({
  title = "Sharp Traders",
  wallets: initialWallets = [],
  children,
  showList = true,
  showHeaderRow = true,
  className = "",
  trackedWallets,
  onToggleTrack,
}: ServerManagementTableProps = {}) {
  const [wallets, setWallets] = useState<SharpTraderRow[]>(initialWallets)
  const [selectedWallet, setSelectedWallet] = useState<SharpTraderRow | null>(null)
  const shouldReduceMotion = useReducedMotion()

  useEffect(() => {
    setWallets(initialWallets)
  }, [initialWallets])

  useEffect(() => {
    if (!selectedWallet) return
    const updated = wallets.find((wallet) => wallet.id === selectedWallet.id)
    if (updated) setSelectedWallet(updated)
  }, [wallets, selectedWallet])

  const headerStats = useMemo(() => {
    return {
      total: wallets.length,
      trades: wallets.reduce((sum, wallet) => sum + wallet.openTrades.length, 0),
    }
  }, [wallets])
  const showStats = showList && wallets.length > 0

  return (
    <div className={`w-full max-w-7xl mx-auto ${className}`}>
      <div className="relative border border-white/10 rounded-3xl p-6 bg-black/60 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h1 className="text-xl font-medium text-white">{title}</h1>
          </div>
          {showStats ? (
            <div className="text-xs text-white/60">
              {headerStats.total} wallets | {headerStats.trades} open trades
            </div>
          ) : null}
        </div>

        {showList ? (
          <motion.div
            className="space-y-2"
            variants={{
              visible: {
                transition: {
                  staggerChildren: 0.06,
                  delayChildren: 0.1,
                },
              },
            }}
            initial="hidden"
            animate="visible"
          >
            {showHeaderRow ? (
              <div className="hidden sm:grid grid-cols-12 gap-4 px-4 py-2 text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                <div className="col-span-1">Rank</div>
                <div className="col-span-4">Wallet</div>
                <div className="col-span-3">Total P/L (30d)</div>
                <div className="col-span-2">Prev Day</div>
                <div className="col-span-2 text-right">Open Trades</div>
              </div>
            ) : null}

            {wallets.map((wallet) => (
              <motion.button
                key={wallet.id}
                type="button"
                variants={{
                  hidden: { opacity: 0, x: -16, scale: 0.98, filter: "blur(3px)" },
                  visible: {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    filter: "blur(0px)",
                    transition: {
                      type: "spring",
                      stiffness: 420,
                      damping: 28,
                      mass: 0.6,
                    },
                  },
                }}
                className="relative w-full text-left"
                onClick={() => setSelectedWallet(wallet)}
                whileHover={!shouldReduceMotion ? { y: -1 } : undefined}
              >
                <div className="relative bg-black/70 border border-white/10 rounded-2xl p-4 overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                  <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-12 sm:gap-4 sm:items-center">
                    <div className="sm:col-span-1">
                      <span className="text-2xl font-bold text-white/40">
                        {String(wallet.rank).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="text-white font-medium">{wallet.walletShort}</div>
                      <div className="text-[11px] text-white/40">{wallet.wallet}</div>
                      {onToggleTrack && (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onToggleTrack(wallet.wallet)
                          }}
                          className={`mt-2 inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                            trackedWallets?.has(wallet.wallet.toLowerCase())
                              ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                              : "border-white/15 bg-black/40 text-white/70 hover:border-white/40"
                          }`}
                        >
                          {trackedWallets?.has(wallet.wallet.toLowerCase()) ? "Tracked" : "Track"}
                        </button>
                      )}
                      {wallet.topSports.length > 0 && (
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/35 mt-2">
                          Best:{" "}
                          {wallet.topSports
                            .slice(0, 2)
                            .map((sport) => formatSportLabel(sport.sport))
                            .join(", ")}
                        </div>
                      )}
                      <div className="mt-2 text-[11px] text-white/60">
                        Arb {wallet.arbScore7d} | {formatArbLabel(wallet.arbLabel7d)}
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <div className="text-sm font-semibold text-emerald-200">
                        {formatCurrency(wallet.totalPnl)}
                        <span className="text-white/50 font-normal">
                          {" "}
                          ({formatCurrency(wallet.pnl30d)})
                        </span>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-sm font-semibold text-white">
                        {formatCurrency(wallet.pnlPrevDay)}
                      </div>
                    </div>
                    <div className="sm:col-span-2 sm:text-right">
                      <span className="text-sm font-semibold text-white">
                        {wallet.openTrades.length}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.button>
            ))}
          </motion.div>
        ) : (
          <div className="space-y-4">{children}</div>
        )}

        <AnimatePresence>
          {selectedWallet && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col rounded-3xl z-10 overflow-hidden"
            >
              <div className="relative bg-gradient-to-r from-black/70 to-transparent p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">
                    Rank #{selectedWallet.rank}
                  </p>
                  <h3 className="text-lg font-semibold text-white mt-1">{selectedWallet.wallet}</h3>
                  <div className="text-xs text-white/60 mt-1">
                    Total {formatCurrency(selectedWallet.totalPnl)} | 30d {formatCurrency(selectedWallet.pnl30d)} | Prev day{" "}
                    {formatCurrency(selectedWallet.pnlPrevDay)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {onToggleTrack && (
                    <button
                      type="button"
                      onClick={() => onToggleTrack(selectedWallet.wallet)}
                      className={`inline-flex items-center rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition-colors ${
                        trackedWallets?.has(selectedWallet.wallet.toLowerCase())
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                          : "border-white/15 bg-black/40 text-white/70 hover:border-white/40"
                      }`}
                    >
                      {trackedWallets?.has(selectedWallet.wallet.toLowerCase()) ? "Tracked" : "Track"}
                    </button>
                  )}
                  <motion.button
                    className="w-9 h-9 bg-black/70 hover:bg-black rounded-full flex items-center justify-center border border-white/10"
                    onClick={() => setSelectedWallet(null)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X className="w-4 h-4 text-white/80" />
                  </motion.button>
                </div>
              </div>

              <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                      Wallet
                    </label>
                    <div className="text-sm font-medium mt-1 text-white">{selectedWallet.wallet}</div>
                  </div>
                  <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                      Total P/L
                    </label>
                    <div className="text-sm font-medium mt-1 text-emerald-200">
                      {formatCurrency(selectedWallet.totalPnl)}
                    </div>
                  </div>
                  <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                      30d P/L
                    </label>
                    <div className="text-sm font-medium mt-1 text-white">
                      {formatCurrency(selectedWallet.pnl30d)}
                    </div>
                  </div>
                  <div className="bg-black/50 rounded-xl p-3 border border-white/10">
                    <label className="text-[11px] font-medium text-white/50 uppercase tracking-[0.2em]">
                      Prev Day P/L
                    </label>
                    <div className="text-sm font-medium mt-1 text-white">
                      {formatCurrency(selectedWallet.pnlPrevDay)}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Best Sports
                    </p>
                    <p className="text-[11px] text-white/40">
                      Ranked by P/L
                    </p>
                  </div>
                  {selectedWallet.topSports.length > 0 ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {selectedWallet.topSports.map((sport) => (
                        <div
                          key={`${selectedWallet.id}-${sport.sport}`}
                          className="rounded-xl border border-white/10 bg-black/60 px-3 py-2"
                        >
                          <div className="text-xs font-semibold text-white">
                            {formatSportLabel(sport.sport)}
                          </div>
                          <div className="mt-1 text-[11px] text-white/60">
                            {formatCurrency(sport.pnl)} | {sport.trades} trades
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 text-xs text-white/60">No sport breakdown available yet.</div>
                  )}
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                      Arb Detection (7d)
                    </p>
                    <p className="text-[11px] text-white/40">
                      Strict score
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Score</div>
                      <div className="mt-1 text-sm font-semibold text-white">{selectedWallet.arbScore7d}</div>
                      <div className="mt-1 text-[11px] text-white/60">
                        {formatArbLabel(selectedWallet.arbLabel7d)}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">7d Stats</div>
                      <div className="mt-1 text-[11px] text-white/60">
                        Trades: {selectedWallet.tradeCount7d} | Win rate: {formatPercent(selectedWallet.winRate7d)}
                      </div>
                      <div className="mt-1 text-[11px] text-white/60">
                        Avg P/L: {selectedWallet.avgPnl7d != null ? formatCurrency(selectedWallet.avgPnl7d) : "n/a"}
                      </div>
                      <div className="mt-1 text-[11px] text-white/60">
                        P/L stddev: {selectedWallet.pnlStddev7d != null ? formatCurrency(selectedWallet.pnlStddev7d) : "n/a"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/60 px-3 py-2">
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">Reasons</div>
                      {selectedWallet.arbReasons7d.length > 0 ? (
                        <div className="mt-1 text-[11px] text-white/60">
                          {selectedWallet.arbReasons7d.join(" | ")}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-white/60">No arb flags detected.</div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {selectedWallet.openTrades.map((trade, index) => (
                    <div
                      key={`${trade.slug ?? "trade"}-${index}`}
                      className="rounded-2xl border border-white/10 bg-black/50 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">
                            {trade.outcome ?? "Outcome n/a"}
                          </p>
                          <p className="mt-1 text-[11px] text-white/50">
                            {trade.title ?? trade.slug ?? "Open market"}
                          </p>
                        </div>
                        <div className="text-right text-[11px] text-white/50">
                          <p>End: {formatDate(trade.end_date)}</p>
                          <p>Price: {formatNumber(trade.cur_price, 4)}</p>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-3 text-[11px] text-white/60 sm:grid-cols-4">
                        <div>
                          <p className="uppercase tracking-[0.2em] text-white/40">Size</p>
                          <p className="mt-1 text-white">{formatNumber(trade.size, 2)}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em] text-white/40">Avg Price</p>
                          <p className="mt-1 text-white">{formatNumber(trade.avg_price, 4)}</p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em] text-white/40">Cash P&L</p>
                          <p className="mt-1 text-white">
                            {trade.cash_pnl != null ? formatCurrency(trade.cash_pnl) : "n/a"}
                          </p>
                        </div>
                        <div>
                          <p className="uppercase tracking-[0.2em] text-white/40">Slug</p>
                          <p className="mt-1 text-white/70">{trade.slug ?? "n/a"}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {selectedWallet.openTrades.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-black/50 p-4 text-xs text-white/60">
                      No open trades in the selected filter window.
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
