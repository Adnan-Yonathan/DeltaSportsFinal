"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import BoxLoader from "@/components/ui/box-loader"
import { ServerManagementTable } from "@/components/ui/server-management-table"

type CrossedRow = {
  id: string
  player: string
  market: string
  game: string
  commenceTime: string
  teams?: string[]
  bookKey: string
  bookLabel: string
  bookPoint: number
  consensusPoint: number
  consensusOverOdds: number | null
  consensusUnderOdds: number | null
  delta: number
  discrepancy: number
  recommendedSide: "over" | "under"
  overOdds?: number
  underOdds?: number
  pinnaclePoint: number | null
  pinnacleOverOdds: number | null
  pinnacleUnderOdds: number | null
  evPercent: number | null
}

type BookInfo = {
  key: string
  label: string
  isConsensus?: boolean
}

const REFRESH_MS = 10 * 60 * 1000
const QUIET_START_HOUR = 1
const QUIET_END_HOUR = 11

const formatMarketLabel = (market: string) =>
  market
    .replace("player_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

const formatOdds = (value?: number) => {
  if (!Number.isFinite(value)) return "--"
  const rounded = Math.round(value as number)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatEv = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  const rounded = value.toFixed(1)
  return `${value >= 0 ? "+" : ""}${rounded}%`
}

const formatPoint = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(1)
}

const formatCommenceTime = (value: string) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "n/a"
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export default function CrossedEvClient({
  sport,
  previewMode = false,
}: {
  sport: string
  previewMode?: boolean
}) {
  const [rows, setRows] = useState<CrossedRow[]>([])
  const [books, setBooks] = useState<BookInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [marketFilter, setMarketFilter] = useState("all")
  const [bookFilter, setBookFilter] = useState("all")
  const [visibleCount, setVisibleCount] = useState(200)

  const inQuietHours = useCallback(() => {
    const current = new Date()
    const estHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hour12: false,
      }).format(current)
    )
    return estHour >= QUIET_START_HOUR && estHour < QUIET_END_HOUR
  }, [])

  const fetchRows = useCallback(async () => {
    if (inQuietHours()) return
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/crossed-ev?sport=${sport}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to load crossed EV props.")
      }
      const payload = await res.json()
      setRows(Array.isArray(payload?.rows) ? payload.rows : [])
      setBooks(Array.isArray(payload?.books) ? payload.books : [])
      setVisibleCount(200)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load crossed EV props."
      )
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [sport, inQuietHours])

  useEffect(() => {
    if (!inQuietHours()) fetchRows()
  }, [fetchRows, inQuietHours])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!inQuietHours()) fetchRows()
    }, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchRows, inQuietHours])

  const marketOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => set.add(row.market))
    return ["all", ...Array.from(set)]
  }, [rows])

  const bookOptions = useMemo(() => {
    const set = new Set<string>()
    rows.forEach((row) => set.add(row.bookKey))
    return ["all", ...Array.from(set)]
  }, [rows])

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = rows.filter((row) => {
      if (marketFilter !== "all" && row.market !== marketFilter) return false
      if (bookFilter !== "all" && row.bookKey !== bookFilter) return false
      if (!query) return true
      return (
        row.player.toLowerCase().includes(query) ||
        row.game.toLowerCase().includes(query) ||
        row.bookLabel.toLowerCase().includes(query)
      )
    })
    const sorted = [...filtered].sort((a, b) => {
      const aEv = a.evPercent ?? -Infinity
      const bEv = b.evPercent ?? -Infinity
      if (bEv !== aEv) return bEv - aEv
      return b.discrepancy - a.discrepancy
    })
    return previewMode ? sorted.slice(0, 25) : sorted
  }, [rows, search, marketFilter, bookFilter, previewMode])

  const visibleRows = useMemo(
    () => filteredRows.slice(0, visibleCount),
    [filteredRows, visibleCount]
  )

  const bookLabelByKey = useMemo(() => {
    const map = new Map<string, string>()
    books.forEach((book) => map.set(book.key, book.label))
    return map
  }, [books])

  return (
    <ServerManagementTable title="Crossed EV" showList={false} className="max-w-none">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <Search className="h-4 w-4 text-white/40" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search player, matchup, or book..."
            className="w-64 bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none sm:text-sm"
          />
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/40 sm:text-xs">
            Book
          </span>
          <select
            value={bookFilter}
            onChange={(event) => setBookFilter(event.target.value)}
            className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[11px] uppercase tracking-[0.15em] text-white/70 focus:border-emerald-400/60 focus:outline-none sm:text-xs"
          >
            {bookOptions.map((bookKey) => (
              <option key={bookKey} value={bookKey}>
                {bookKey === "all"
                  ? "All Books"
                  : bookLabelByKey.get(bookKey) ?? bookKey}
              </option>
            ))}
          </select>
          <div className="h-4 w-px bg-white/10" />
          <span className="text-[11px] uppercase tracking-[0.2em] text-white/40 sm:text-xs">
            Market
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {marketOptions.map((market) => (
              <button
                key={market}
                type="button"
                onClick={() => setMarketFilter(market)}
                className={`rounded-full border px-3 py-1 text-[11px] uppercase tracking-[0.15em] transition sm:text-xs ${
                  marketFilter === market
                    ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                    : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
                }`}
              >
                {market === "all" ? "All" : formatMarketLabel(market)}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-[13px] text-white/60 sm:text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-semibold text-white/70">
              Sorted by EV% (then discrepancy)
            </span>
          </div>
          {errorMessage && (
            <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
          )}
        </div>

        {loading && (
          <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
            <div className="flex flex-col items-center gap-4">
              <BoxLoader />
              <span className="text-xs uppercase tracking-[0.3em] text-white/50">
                Loading...
              </span>
            </div>
          </div>
        )}

        {!loading && filteredRows.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
            No crossed props available for this slate.
          </div>
        )}

        {filteredRows.length > 0 && (
          <>
            <div className="space-y-3 sm:hidden">
              {visibleRows.map((row, index) => {
                const rowKey = `${row.id}:${row.bookKey}:${index}`
                const angleOdds =
                  row.recommendedSide === "over" ? row.overOdds : row.underOdds
                const consensusOdds =
                  row.recommendedSide === "over"
                    ? row.consensusOverOdds
                    : row.consensusUnderOdds
                const pinnacleOdds =
                  row.recommendedSide === "over"
                    ? row.pinnacleOverOdds
                    : row.pinnacleUnderOdds
                const evClass =
                  row.evPercent != null && row.evPercent >= 0
                    ? "text-emerald-300"
                    : "text-white/75"

                return (
                  <article
                    key={rowKey}
                    className="rounded-2xl border border-white/10 bg-black/50 p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 truncate text-sm font-semibold text-white">
                        {row.player}
                      </p>
                      <span className="shrink-0 rounded-full border border-white/10 bg-black/60 px-2 py-0.5 text-[10px] text-white/50">
                        #{index + 1}
                      </span>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                          Over/Under
                        </p>
                        <p className="mt-1 text-xs font-semibold uppercase text-white">
                          {row.recommendedSide}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                          Book line
                        </p>
                        <p className="mt-1 text-xs font-semibold text-white">
                          {formatPoint(row.bookPoint)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">EV</p>
                        <p className={`mt-1 text-xs font-semibold ${evClass}`}>
                          {formatEv(row.evPercent)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2">
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                          Odds comparison
                        </p>
                        <p className="mt-1 text-xs font-semibold text-white">
                          {formatOdds(angleOdds)} vs {formatOdds(consensusOdds ?? undefined)} (Pin {formatOdds(pinnacleOdds ?? undefined)})
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-white/10 pt-3">
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <section className="min-w-[180px] rounded-xl border border-white/10 bg-black/60 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                            Matchup
                          </p>
                          <p className="mt-1 text-xs text-white">{row.game}</p>
                          <p className="mt-2 text-[11px] text-white/60">
                            {formatCommenceTime(row.commenceTime)}
                          </p>
                        </section>
                        <section className="min-w-[180px] rounded-xl border border-white/10 bg-black/60 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                            Market + Book
                          </p>
                          <p className="mt-1 text-xs text-white">{formatMarketLabel(row.market)}</p>
                          <p className="mt-2 text-[11px] text-white/70">{row.bookLabel}</p>
                        </section>
                        <section className="min-w-[180px] rounded-xl border border-white/10 bg-black/60 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                            Line edge
                          </p>
                          <p className="mt-1 text-xs text-white">
                            Consensus line: {formatPoint(row.consensusPoint)}
                          </p>
                          <p className="mt-2 text-[11px] text-white/70">
                            Delta: {row.delta > 0 ? `+${row.delta.toFixed(1)}` : row.delta.toFixed(1)}
                          </p>
                          <p className="mt-1 text-[11px] text-white/60">
                            Discrepancy: {row.discrepancy.toFixed(1)}
                          </p>
                        </section>
                        <section className="min-w-[180px] rounded-xl border border-white/10 bg-black/60 p-3">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">
                            Full odds
                          </p>
                          <p className="mt-1 text-xs text-white">
                            Over: {formatOdds(row.overOdds)}
                          </p>
                          <p className="mt-2 text-xs text-white">
                            Under: {formatOdds(row.underOdds)}
                          </p>
                          <p className="mt-2 text-[11px] text-white/70">
                            Pinnacle line: {formatPoint(row.pinnaclePoint)}
                          </p>
                          <p className="mt-1 text-[11px] text-white/70">
                            Pinnacle O/U: {formatOdds(row.pinnacleOverOdds ?? undefined)} / {formatOdds(row.pinnacleUnderOdds ?? undefined)}
                          </p>
                          <p className="mt-2 text-[11px] text-white/70">
                            Consensus O/U: {formatOdds(row.consensusOverOdds ?? undefined)} / {formatOdds(row.consensusUnderOdds ?? undefined)}
                          </p>
                        </section>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>

            <div className="hidden overflow-x-auto rounded-2xl border border-white/10 bg-black/40 sm:block">
              <table className="min-w-0 w-full table-fixed text-left text-[12.5px] text-white/70 sm:text-sm">
                <thead className="bg-black/60 text-[11px] text-white/60 sm:text-xs">
                  <tr>
                    <th className="px-3 py-3 w-[7%]">Rank</th>
                    <th className="px-3 py-3 w-[20%]">Player</th>
                    <th className="px-3 py-3 w-[14%]">Market</th>
                    <th className="px-3 py-3 w-[16%]">Book</th>
                    <th className="px-3 py-3 w-[10%]">Book line</th>
                    <th className="px-3 py-3 w-[10%]">Consensus</th>
                    <th className="px-3 py-3 w-[10%]">Delta</th>
                    <th className="px-3 py-3 w-[8%]">EV</th>
                    <th className="px-3 py-3 w-[15%]">Angle</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, index) => {
                    const angleOdds =
                      row.recommendedSide === "over" ? row.overOdds : row.underOdds
                    const consensusOdds =
                      row.recommendedSide === "over"
                        ? row.consensusOverOdds
                        : row.consensusUnderOdds
                    const pinnacleOdds =
                      row.recommendedSide === "over"
                        ? row.pinnacleOverOdds
                        : row.pinnacleUnderOdds
                    const deltaLabel =
                      row.delta > 0 ? `+${row.delta.toFixed(1)}` : row.delta.toFixed(1)
                    const chip =
                      row.recommendedSide === "over"
                        ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                        : "border-amber-400/60 bg-amber-500/10 text-amber-200"
                    const evClass =
                      row.evPercent != null && row.evPercent >= 0
                        ? "text-emerald-300"
                        : "text-white/55"

                    return (
                      <tr
                        key={`${row.id}:${row.bookKey}:${index}`}
                        className="border-t border-white/5"
                      >
                        <td className="px-3 py-3 text-white/80">{index + 1}</td>
                        <td className="px-3 py-3 text-white/90 truncate">
                          <div className="font-semibold text-white">{row.player}</div>
                          <div className="text-[11px] text-white/45 truncate sm:text-xs">
                            {row.game}
                          </div>
                        </td>
                        <td className="px-3 py-3 truncate">{formatMarketLabel(row.market)}</td>
                        <td className="px-3 py-3 truncate">{row.bookLabel}</td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-white">{row.bookPoint}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="text-white/70">{Math.round(row.consensusPoint)}</span>
                        </td>
                        <td className="px-3 py-3">
                          <span className="font-semibold text-white">{deltaLabel}</span>
                          <span className="ml-2 text-[11px] text-white/45 sm:text-xs">
                            ({row.discrepancy.toFixed(1)})
                          </span>
                        </td>
                        <td className={`px-3 py-3 font-semibold ${evClass}`}>
                          {formatEv(row.evPercent)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em] ${chip} sm:text-xs`}
                            >
                              {row.recommendedSide}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                              <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[12px] font-semibold text-white sm:text-sm">
                                {formatOdds(angleOdds)}
                              </span>
                              <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/35">
                                vs
                              </span>
                              <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[12px] font-semibold text-white/70 sm:text-sm">
                                {formatOdds(consensusOdds ?? undefined)}
                              </span>
                              <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[12px] font-semibold text-cyan-200 sm:text-sm">
                                Pin {formatOdds(pinnacleOdds ?? undefined)}
                              </span>
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {filteredRows.length > visibleRows.length && (
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((prev) => prev + 200)}
              className="rounded-full border border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:border-emerald-400/60 hover:text-emerald-200 transition-colors"
            >
              Show more
            </button>
          </div>
        )}
      </div>
    </ServerManagementTable>
  )
}

