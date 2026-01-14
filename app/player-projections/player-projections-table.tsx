"use client"

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatAmericanOdds } from "@/lib/utils/odds"

interface MarketLine {
  line: number
  overOdds?: number
  underOdds?: number
  bestBook?: string
}

interface PlayerData {
  id: string
  name: string
  team: string
  teamAbbr: string
  position: string
  game: string
  projections: Record<string, number | null>
  marketLines?: Record<string, MarketLine>
  delta?: Record<string, number | null>
  edge?: Record<string, number | null>
}

interface GameInfo {
  gameId: string
  matchup: string
  startTime: string
  status: "upcoming" | "live" | "completed"
}

interface ApiResponse {
  sport: string
  date: string
  updatedAt: string
  games: GameInfo[]
  players: PlayerData[]
  positions: string[]
  count: number
}

type PropWhaleTrade = {
  id: string
  source: "kalshi" | "polymarket"
  sportKey: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  side: string | null
  notional: number | null
  americanOdds: number | null
  priceCents: number | null
  tradeTime: string
  eventTime: string
  marketTitle: string | null
  outcome: string | null
}

const SPORT_MARKETS: Record<string, readonly string[]> = {
  basketball_nba: ["points", "rebounds", "assists"],
  americanfootball_nfl: ["passing_yards", "rushing_yards", "receiving_yards", "receptions"],
}

// Position-specific markets for NFL
const NFL_POSITION_MARKETS: Record<string, readonly string[]> = {
  All: ["passing_yards", "rushing_yards", "receiving_yards", "receptions"],
  QB: ["passing_yards", "passing_tds", "rushing_yards"],
  RB: ["rushing_yards", "rushing_tds", "receptions", "receiving_yards"],
  WR: ["receiving_yards", "receptions", "rushing_yards"],
  TE: ["receiving_yards", "receptions"],
  K: [], // Kickers don't have prop markets we track
}

const NFL_POSITIONS = ["All", "QB", "RB", "WR", "TE", "K"] as const

const MARKET_LABELS: Record<string, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  passing_yards: "PASS YDS",
  passing_tds: "PASS TD",
  rushing_yards: "RUSH YDS",
  rushing_tds: "RUSH TD",
  receiving_yards: "REC YDS",
  receptions: "REC",
  threes: "3PT",
  blocks: "BLK",
  steals: "STL",
}

const formatNumber = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return Number(value).toFixed(1)
}

const formatDelta = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  const sign = value > 0 ? "+" : ""
  return `${sign}${Number(value).toFixed(1)}`
}

const formatEdge = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${value.toFixed(1)}%`
}

const formatCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return `$${Math.round(value).toLocaleString("en-US")}`
}

const formatPropLabel = (propType?: string | null) => {
  if (!propType) return "PROP"
  return MARKET_LABELS[propType] ?? propType.replace(/_/g, " ").toUpperCase()
}

const formatWhaleOdds = (trade: PropWhaleTrade) => {
  if (trade.americanOdds != null) return formatAmericanOdds(trade.americanOdds)
  if (trade.priceCents != null) return `${trade.priceCents}c`
  return "n/a"
}

const formatWhaleTime = (value?: string | null) => {
  if (!value) return "n/a"
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) return "n/a"
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export default function PlayerProjectionsTable({
  sport,
}: {
  sport: string
}) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>({})
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [positionFilter, setPositionFilter] = useState<string>("All")
  const [propWhales, setPropWhales] = useState<PropWhaleTrade[]>([])
  const [propWhaleLoading, setPropWhaleLoading] = useState(true)
  const [propWhaleError, setPropWhaleError] = useState<string | null>(null)
  const lastLoadedRef = useRef<number>(0)

  const isNfl = sport === "americanfootball_nfl"
  // Use position-specific markets for NFL based on filter
  const activeMarkets = isNfl
    ? (NFL_POSITION_MARKETS[positionFilter] ?? NFL_POSITION_MARKETS.All)
    : (SPORT_MARKETS[sport] ?? SPORT_MARKETS.basketball_nba)

  // Countdown timer calculation
  const loadData = useCallback(async (isManual = false) => {
    if (!isManual) setLoading(true)
    setErrorMessage(null)
    setPropWhaleError(null)
    setPropWhaleLoading(true)

    const params = new URLSearchParams({ sport })
    if (isNfl && positionFilter !== "All") {
      params.set("position", positionFilter)
    }

    const projectionsTask = (async () => {
      const res = await fetch(`/api/daily-projections?${params.toString()}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error("Failed to load player projections.")
      }
      return (await res.json()) as ApiResponse
    })()

    const whalesTask = (async () => {
      const res = await fetch(`/api/player-prop-whales?sport=${sport}`, {
        cache: "no-store",
      })
      if (!res.ok) {
        throw new Error("Failed to load whale props.")
      }
      const payload = await res.json()
      return Array.isArray(payload?.trades) ? (payload.trades as PropWhaleTrade[]) : []
    })()

    const [projectionsResult, whalesResult] = await Promise.allSettled([
      projectionsTask,
      whalesTask,
    ])

    if (projectionsResult.status === "fulfilled") {
      setData(projectionsResult.value)
      lastLoadedRef.current = Date.now()
    } else {
      setErrorMessage(
        projectionsResult.reason instanceof Error
          ? projectionsResult.reason.message
          : "Failed to load projections."
      )
    }

    if (whalesResult.status === "fulfilled") {
      setPropWhales(whalesResult.value)
    } else {
      setPropWhaleError(
        whalesResult.reason instanceof Error
          ? whalesResult.reason.message
          : "Failed to load whale props."
      )
    }

    setLoading(false)
    setIsRefreshing(false)
    setPropWhaleLoading(false)
  }, [sport, positionFilter, isNfl])

  // Keep ref to latest loadData function to avoid stale closures
  const loadDataRef = useRef(loadData)
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  // Initial load when sport or position changes
  useEffect(() => {
    loadData()
  }, [sport, positionFilter])

  // Auto-refresh interval - created once, fires every 15 minutes
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIsRefreshing(true)
        loadDataRef.current(true)
      }
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  // Visibility change handler - refresh if page was hidden for 15+ minutes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastLoadedRef.current
        if (elapsed >= REFRESH_INTERVAL_MS) {
          setIsRefreshing(true)
          loadDataRef.current(true)
        }
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [])

  // Reset position filter when sport changes
  useEffect(() => {
    setPositionFilter("All")
  }, [sport])

  const groupedPlayers = useMemo(() => {
    if (!data?.players) return []

    const byGame = new Map<string, PlayerData[]>()
    for (const player of data.players) {
      // Filter by position for NFL
      if (isNfl && positionFilter !== "All" && player.position !== positionFilter) {
        continue
      }

      const key = player.game || "Other"
      if (!byGame.has(key)) {
        byGame.set(key, [])
      }
      byGame.get(key)!.push(player)
    }

    return Array.from(byGame.entries())
      .map(([game, players]) => ({
        game,
        players: players.sort((a, b) => {
          // Sort by position priority for NFL
          if (isNfl) {
            const posOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5 }
            const posA = posOrder[a.position] ?? 99
            const posB = posOrder[b.position] ?? 99
            if (posA !== posB) return posA - posB
          }
          return a.name.localeCompare(b.name)
        }),
      }))
      .sort((a, b) => {
        if (a.game === "Other") return 1
        if (b.game === "Other") return -1
        return a.game.localeCompare(b.game)
      })
  }, [data?.players, isNfl, positionFilter])

  const handleManualRefresh = useCallback(() => {
    if (isRefreshing || loading) return
    setIsRefreshing(true)
    loadData(true)
  }, [isRefreshing, loading, loadData])

  const totalPlayers = data?.count ?? 0
  const displayedPlayers = groupedPlayers.reduce((sum, g) => sum + g.players.length, 0)
  const columnCount = activeMarkets.length + (isNfl ? 3 : 2)

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/60">
            Whale Player Props
          </span>
          <span className="text-[10px] text-white/40">
            {propWhales.length} trades
          </span>
        </div>
        <div className="px-3 py-3">
          {propWhaleLoading ? (
            <div className="text-xs text-white/50">Loading whale props...</div>
          ) : propWhaleError ? (
            <div className="text-xs text-red-200">{propWhaleError}</div>
          ) : propWhales.length === 0 ? (
            <div className="text-xs text-white/50">
              No player prop whales tracked yet.
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {propWhales.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">
                        {trade.playerName ?? trade.marketTitle ?? "Player prop"}
                      </div>
                      <div className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
                        {formatPropLabel(trade.propType)}
                      </div>
                    </div>
                    <div className="text-[10px] text-white/40">
                      {formatWhaleTime(trade.tradeTime)}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-white/60">
                    <span className="rounded bg-black/40 px-2 py-0.5">
                      {trade.side ?? trade.outcome ?? "Side"}
                    </span>
                    {trade.propLine != null && (
                      <span className="rounded bg-black/40 px-2 py-0.5">
                        Line {formatNumber(trade.propLine)}
                      </span>
                    )}
                    <span className="rounded bg-black/40 px-2 py-0.5">
                      {formatCurrency(trade.notional)}
                    </span>
                    <span className="rounded bg-black/40 px-2 py-0.5">
                      {formatWhaleOdds(trade)}
                    </span>
                  </div>
                  {trade.marketTitle && (
                    <div className="mt-2 text-[10px] text-white/40 line-clamp-2">
                      {trade.marketTitle}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* Toolbar with position filter, refresh button, and last updated */}
      <div className="border-b border-white/5 bg-black/50 px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {/* Position filter for NFL */}
            {isNfl && (
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white/80 focus:border-emerald-400/40 focus:outline-none"
              >
                {NFL_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={isRefreshing || loading}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-emerald-400/40 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg
                className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[9px] sm:text-[10px] text-white/40">
            {totalPlayers > 0 && (
              <span className="text-white/30">
                {displayedPlayers}/{totalPlayers}
              </span>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="px-4 py-6 text-sm text-white/60">
          Loading projections...
        </div>
      ) : errorMessage ? (
        <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
      ) : groupedPlayers.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">
          {data?.games?.length === 0
            ? `No ${isNfl ? "NFL" : "NBA"} games scheduled for today.`
            : "No player projections found for today."}
        </div>
      ) : (
        <>
        <div className="divide-y divide-white/5 sm:hidden">
          {groupedPlayers.map((group) => {
            const isExpanded = Boolean(expandedGames[group.game])
            const visiblePlayers = isExpanded ? group.players : group.players.slice(0, 5)
            const remaining = Math.max(0, group.players.length - visiblePlayers.length)

            return (
              <div key={group.game}>
                {/* Game header */}
                <div className="flex items-center justify-between gap-3 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                  <span>{group.game}</span>
                  {remaining > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedGames((current) => ({
                          ...current,
                          [group.game]: !isExpanded,
                        }))
                      }
                      className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-emerald-400/40 hover:text-white transition-colors"
                    >
                      {isExpanded ? "Show less" : `+ ${remaining} more`}
                    </button>
                  )}
                </div>

                {/* Player rows */}
                {visiblePlayers.map((player) => (
                  <div key={player.id} className="px-3 py-3">
                    {/* Mobile card layout */}
                    <div className="sm:hidden space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-white">
                            {player.name}
                          </div>
                          <div className="mt-0.5 text-[10px] text-white/50">
                            {player.teamAbbr || player.team}
                            {isNfl && player.position && ` - ${player.position}`}
                            {player.game && ` - ${player.game}`}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {activeMarkets.map((market) => {
                          const projection = player.projections?.[market]
                          const line = player.marketLines?.[market]
                          const delta = player.delta?.[market]
                          const hasProjection = projection != null && Number.isFinite(projection) && projection > 0
                          const hasLine = line != null && Number.isFinite(line.line) && line.line > 0

                          return (
                            <div key={market} className="rounded-lg border border-white/10 bg-black/30 p-2">
                              <div className="text-[9px] uppercase tracking-[0.1em] text-white/40 mb-1">
                                {MARKET_LABELS[market] ?? market}
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${hasProjection ? "text-emerald-200" : "text-white/30"}`}>
                                  {hasProjection ? formatNumber(projection) : "-"}
                                </span>
                                {hasLine && hasProjection && delta != null && (
                                  <span className={`text-[10px] ${
                                    delta > 0 ? "text-green-400" : delta < 0 ? "text-red-400" : "text-white/50"
                                  }`}>
                                    {formatDelta(delta)}
                                  </span>
                                )}
                              </div>
                              {hasLine && (
                                <div className="text-[10px] text-white/50 mt-0.5">
                                  Line {formatNumber(line.line)}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Desktop grid layout */}
                    <div
                      className="hidden sm:grid gap-2 text-[13px] text-white/70"
                      style={{
                        gridTemplateColumns: isNfl
                          ? `180px 50px 120px repeat(${activeMarkets.length}, minmax(0, 1fr))`
                          : `200px 140px repeat(${activeMarkets.length}, minmax(0, 1fr))`,
                      }}
                    >
                      {/* Player name and team */}
                      <div className="space-y-0.5">
                        <div className="text-sm font-semibold text-white truncate">
                          {player.name}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {player.teamAbbr || player.team}
                        </div>
                      </div>

                      {/* Position (NFL only) */}
                      {isNfl && (
                        <div className="text-xs text-white/60 font-medium">
                          {player.position}
                        </div>
                      )}

                      {/* Matchup */}
                      <div className="text-xs text-white/60">
                        {player.game}
                      </div>

                      {/* Market columns */}
                      {activeMarkets.map((market) => {
                        const projection = player.projections?.[market]
                        const line = player.marketLines?.[market]
                        const delta = player.delta?.[market]
                        const edge = player.edge?.[market]
                        const hasProjection = projection != null && Number.isFinite(projection) && projection > 0
                        const hasLine = line != null && Number.isFinite(line.line) && line.line > 0

                        return (
                          <div key={market} className="space-y-1 text-xs">
                            {/* Projection */}
                            <div className={`rounded px-1.5 py-0.5 ${
                              hasProjection
                                ? "bg-emerald-500/15 text-emerald-200"
                                : "bg-white/5 text-white/30"
                            }`}>
                              {hasProjection ? formatNumber(projection) : "-"}
                            </div>

                            {/* Line comparison */}
                            {hasLine ? (
                              <>
                                <div className="rounded bg-white/10 px-1.5 py-0.5 text-white/60">
                                  Line {formatNumber(line.line)}
                                </div>
                                {hasProjection && delta != null && (
                                  <div className={`rounded px-1.5 py-0.5 ${
                                    delta > 0
                                      ? "bg-green-500/15 text-green-300"
                                      : delta < 0
                                        ? "bg-red-500/15 text-red-300"
                                        : "bg-white/10 text-white/60"
                                  }`}>
                                    {formatDelta(delta)}
                                  </div>
                                )}
                              </>
                            ) : hasProjection ? (
                              <div className="rounded bg-white/5 px-1.5 py-0.5 text-white/30 text-[10px]">
                                No line
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
        <div className="hidden sm:block">
          <Table className="text-[13px] text-white/70">
            <TableHeader className="bg-black/70">
              <TableRow className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                <TableHead className={isNfl ? "w-[180px]" : "w-[200px]"}>Player</TableHead>
                {isNfl && <TableHead className="w-[50px]">Pos</TableHead>}
                <TableHead className={isNfl ? "w-[120px]" : "w-[140px]"}>Matchup</TableHead>
                {activeMarkets.map((market) => (
                  <TableHead key={market}>
                    {MARKET_LABELS[market] ?? market.toUpperCase()}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-white/5">
              {groupedPlayers.map((group) => {
                const isExpanded = Boolean(expandedGames[group.game])
                const visiblePlayers = isExpanded ? group.players : group.players.slice(0, 5)
                const remaining = Math.max(0, group.players.length - visiblePlayers.length)

                return (
                  <React.Fragment key={group.game}>
                    <TableRow className="border-white/5 bg-white/5 hover:bg-white/5">
                      <TableCell colSpan={columnCount} className="py-2">
                        <div className="flex items-center justify-between gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/60">
                          <span>{group.game}</span>
                          {remaining > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedGames((current) => ({
                                  ...current,
                                  [group.game]: !isExpanded,
                                }))
                              }
                              className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-emerald-400/40 hover:text-white transition-colors"
                            >
                              {isExpanded ? "Show less" : `+ ${remaining} more`}
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                    {visiblePlayers.map((player) => (
                      <TableRow key={player.id} className="border-white/5">
                        <TableCell className="align-top">
                          <div className="space-y-0.5">
                            <div className="text-sm font-semibold text-white truncate">
                              {player.name}
                            </div>
                            <div className="text-[10px] text-white/50">
                              {player.teamAbbr || player.team}
                            </div>
                          </div>
                        </TableCell>

                        {isNfl && (
                          <TableCell className="align-top text-xs text-white/60 font-medium">
                            {player.position}
                          </TableCell>
                        )}

                        <TableCell className="align-top text-xs text-white/60">
                          {player.game}
                        </TableCell>

                        {activeMarkets.map((market) => {
                          const projection = player.projections?.[market]
                          const line = player.marketLines?.[market]
                          const delta = player.delta?.[market]
                          const hasProjection = projection != null && Number.isFinite(projection) && projection > 0
                          const hasLine = line != null && Number.isFinite(line.line) && line.line > 0

                          return (
                            <TableCell key={market} className="align-top">
                              <div className="space-y-1 text-xs">
                                <div className={`rounded px-1.5 py-0.5 ${
                                  hasProjection
                                    ? "bg-emerald-500/15 text-emerald-200"
                                    : "bg-white/5 text-white/30"
                                }`}>
                                  {hasProjection ? formatNumber(projection) : "-"}
                                </div>

                                {hasLine ? (
                                  <>
                                    <div className="rounded bg-white/10 px-1.5 py-0.5 text-white/60">
                                      Line {formatNumber(line.line)}
                                    </div>
                                    {hasProjection && delta != null && (
                                      <div className={`rounded px-1.5 py-0.5 ${
                                        delta > 0
                                          ? "bg-green-500/15 text-green-300"
                                          : delta < 0
                                            ? "bg-red-500/15 text-red-300"
                                            : "bg-white/10 text-white/60"
                                      }`}>
                                        {formatDelta(delta)}
                                      </div>
                                    )}
                                  </>
                                ) : hasProjection ? (
                                  <div className="rounded bg-white/5 px-1.5 py-0.5 text-white/30 text-[10px]">
                                    No line
                                  </div>
                                ) : null}
                              </div>
                            </TableCell>
                          )
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                )
              })}
            </TableBody>
          </Table>
        </div>
        </>
      )}
    </div>
    </div>
  )
}


