"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Search, RefreshCw } from "lucide-react"
import { ServerManagementTable } from "@/components/ui/server-management-table"

type PropBookOdds = {
  over?: number
  under?: number
}

type PropRow = {
  id: string
  player: string
  market: string
  point: number | null
  game: string
  commenceTime: string
  homeTeam?: string
  awayTeam?: string
  teams?: string[]
  odds: Record<string, PropBookOdds>
  discrepancy?: number
}

type BookInfo = {
  key: string
  label: string
}

const REFRESH_MS = 60 * 60 * 1000
const QUIET_START_HOUR = 1
const QUIET_END_HOUR = 11

const formatOdds = (value?: number) => {
  if (!Number.isFinite(value)) return "--"
  const rounded = Math.round(value as number)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatMarketLabel = (market: string) =>
  market
    .replace("player_", "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())

const isBetterPrice = (a: number, b: number) => a > b
const toImpliedProb = (odds: number) =>
  odds > 0 ? 100 / (odds + 100) : Math.abs(odds) / (Math.abs(odds) + 100)
const toDecimalOdds = (odds: number) =>
  odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds)
const formatEv = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`

export default function PropOddsClient({
  sport,
  previewMode = false,
}: {
  sport: string
  previewMode?: boolean
}) {
  const [props, setProps] = useState<PropRow[]>([])
  const [books, setBooks] = useState<BookInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [marketFilter, setMarketFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const [visibleCount, setVisibleCount] = useState(200)
  const [now, setNow] = useState(Date.now())

  const inQuietHours = useCallback(() => {
    const now = new Date()
    const estHour = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/New_York",
        hour: "2-digit",
        hour12: false,
      }).format(now)
    )
    return estHour >= QUIET_START_HOUR && estHour < QUIET_END_HOUR
  }, [])

  const fetchProps = useCallback(async () => {
    if (inQuietHours()) {
      return
    }
    setLoading(true)
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/player-prop-odds?sport=${sport}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to load player prop odds.")
      }
      const payload = await res.json()
      setProps(Array.isArray(payload?.props) ? payload.props : [])
      setBooks(Array.isArray(payload?.books) ? payload.books : [])
      setLastUpdated(payload?.updatedAt ?? new Date().toISOString())
      setVisibleCount(200)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load player prop odds."
      )
      setProps([])
    } finally {
      setLoading(false)
    }
  }, [sport, inQuietHours])

  useEffect(() => {
    if (!inQuietHours()) {
      fetchProps()
    }
  }, [fetchProps, inQuietHours])

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!inQuietHours()) {
        fetchProps()
      }
    }, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchProps, inQuietHours])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!lastUpdated) return Math.ceil(REFRESH_MS / 1000)
    const updatedMs = Date.parse(lastUpdated)
    if (!Number.isFinite(updatedMs)) return Math.ceil(REFRESH_MS / 1000)
    return Math.max(0, Math.ceil((updatedMs + REFRESH_MS - now) / 1000))
  }, [lastUpdated, now])

  const marketOptions = useMemo(() => {
    const set = new Set<string>()
    props.forEach((row) => set.add(row.market))
    return ["all", ...Array.from(set)]
  }, [props])

  const teamOptions = useMemo(() => {
    const set = new Set<string>()
    props.forEach((row) => {
      row.teams?.forEach((team) => set.add(team))
    })
    return ["all", ...Array.from(set).sort()]
  }, [props])

  const filteredProps = useMemo(() => {
    const query = search.trim().toLowerCase()
    const getDiscrepancy = (row: PropRow) =>
      Number.isFinite(row.discrepancy) ? (row.discrepancy as number) : 0

    const filtered = props.filter((row) => {
      if (marketFilter !== "all" && row.market !== marketFilter) return false
      if (
        teamFilter !== "all" &&
        !row.teams?.some((team) => team === teamFilter)
      ) {
        return false
      }
      if (!query) return true
      return (
        row.player.toLowerCase().includes(query) ||
        row.game.toLowerCase().includes(query)
      )
    })
    const sorted = [...filtered].sort((a, b) => {
      const aDiff = getDiscrepancy(a)
      const bDiff = getDiscrepancy(b)
      return bDiff - aDiff
    })
    return previewMode ? sorted.slice(0, 20) : sorted
  }, [props, search, marketFilter, teamFilter, previewMode])

  const getConsensusProb = (row: PropRow, side: "over" | "under") => {
    const probs: number[] = []
    for (const odds of Object.values(row.odds)) {
      const price = odds?.[side]
      if (!Number.isFinite(price)) continue
      probs.push(toImpliedProb(price as number))
    }
    if (probs.length === 0) return null
    return probs.reduce((sum, value) => sum + value, 0) / probs.length
  }

  const getBestBySide = (row: PropRow, side: "over" | "under") => {
    let best: number | null = null
    for (const odds of Object.values(row.odds)) {
      const price = odds?.[side]
      if (!Number.isFinite(price)) continue
      if (best == null || isBetterPrice(price as number, best)) {
        best = price as number
      }
    }
    return best
  }
  const visibleProps = useMemo(
    () => filteredProps.slice(0, visibleCount),
    [filteredProps, visibleCount]
  )

  return (
    <ServerManagementTable title="Prop Odds" showList={false} className="max-w-none">
      <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
            <RefreshCw className="h-4 w-4" />
            Refresh in {remainingSeconds}s
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <Search className="h-4 w-4 text-white/40" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search player or matchup..."
          className="w-56 bg-transparent text-sm text-white placeholder:text-white/30 focus:outline-none"
        />
        <div className="h-4 w-px bg-white/10" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Team
        </span>
        <select
          value={teamFilter}
          onChange={(event) => setTeamFilter(event.target.value)}
          className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] uppercase tracking-[0.15em] text-white/70 focus:border-emerald-400/60 focus:outline-none"
        >
          {teamOptions.map((team) => (
            <option key={team} value={team}>
              {team === "all" ? "All Teams" : team}
            </option>
          ))}
        </select>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Market
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {marketOptions.map((market) => (
            <button
              key={market}
              type="button"
              onClick={() => setMarketFilter(market)}
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition ${
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

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {filteredProps.length} props | {books.length} books tracked
          </span>
          <span>Updates every 15 minutes</span>
        </div>
        {errorMessage && (
          <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
          Loading player prop odds...
        </div>
      )}

      {!loading && filteredProps.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
          No props available for this slate.
        </div>
      )}

      {filteredProps.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-black/40">
          <table className="min-w-0 w-full table-fixed text-left text-[11px] text-white/70">
            <thead className="bg-black/60 text-[10px] text-white/60">
              <tr>
                <th className="px-3 py-3 w-[18%]">Player</th>
                <th className="px-3 py-3 w-[12%]">Market</th>
                <th className="px-3 py-3 w-[6%]">Line</th>
                {books.map((book) => (
                  <th key={book.key} className="px-1.5 py-3 text-center">
                    <span className="text-[10px] font-medium text-white/70 leading-tight">
                      {book.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleProps.map((row) => {
                const bestOver = getBestBySide(row, "over")
                const bestUnder = getBestBySide(row, "under")
                const consensusOver = getConsensusProb(row, "over")
                const consensusUnder = getConsensusProb(row, "under")

                return (
                  <tr key={row.id} className="border-t border-white/5">
                    <td className="px-3 py-3 text-white/90 truncate">{row.player}</td>
                    <td className="px-3 py-3 truncate">{formatMarketLabel(row.market)}</td>
                    <td className="px-3 py-3">
                      {row.point != null ? row.point : "--"}
                    </td>
                    {books.map((book) => {
                      const entry = row.odds[book.key] || {}
                      const over = entry.over
                      const under = entry.under
                      const overDiff =
                        Number.isFinite(bestOver) && Number.isFinite(over)
                          ? (bestOver as number) - (over as number)
                          : null
                      const underDiff =
                        Number.isFinite(bestUnder) && Number.isFinite(under)
                          ? (bestUnder as number) - (under as number)
                          : null
                      const overBest =
                        Number.isFinite(bestOver) &&
                        Number.isFinite(over) &&
                        over === bestOver
                      const underBest =
                        Number.isFinite(bestUnder) &&
                        Number.isFinite(under) &&
                        under === bestUnder
                      const overMispriced =
                        Number.isFinite(overDiff) && (overDiff as number) >= 10
                      const underMispriced =
                        Number.isFinite(underDiff) && (underDiff as number) >= 10
                      const overEv =
                        consensusOver != null && Number.isFinite(over)
                          ? (consensusOver as number) * toDecimalOdds(over as number) - 1
                          : null
                      const underEv =
                        consensusUnder != null && Number.isFinite(under)
                          ? (consensusUnder as number) * toDecimalOdds(under as number) - 1
                          : null
                      const overEvPct =
                        overEv != null ? overEv * 100 : null
                      const underEvPct =
                        underEv != null ? underEv * 100 : null

                      const baseClass =
                        "rounded-md border px-1.5 py-1 text-center text-[10px]"

                      return (
                        <td key={book.key} className="px-1.5 py-2">
                          <div className="flex flex-col gap-1">
                            <div
                              className={`${baseClass} ${
                                overBest
                                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                                  : overMispriced
                                    ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                                    : "border-white/10 bg-white/5 text-white/70"
                              }`}
                            >
                              O {formatOdds(over)}
                            </div>
                            {overEvPct != null && overEvPct >= 3 && (
                              <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                                EV {formatEv(overEvPct)}
                              </div>
                            )}
                            <div
                              className={`${baseClass} ${
                                underBest
                                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                                  : underMispriced
                                    ? "border-amber-400/60 bg-amber-500/10 text-amber-200"
                                    : "border-white/10 bg-white/5 text-white/70"
                              }`}
                            >
                              U {formatOdds(under)}
                            </div>
                            {underEvPct != null && underEvPct >= 3 && (
                              <div className="text-[10px] uppercase tracking-[0.15em] text-emerald-300">
                                EV {formatEv(underEvPct)}
                              </div>
                            )}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {filteredProps.length > visibleProps.length && (
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
