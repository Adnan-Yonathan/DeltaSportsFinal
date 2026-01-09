"use client"

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"

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
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [positionFilter, setPositionFilter] = useState<string>("All")
  const lastLoadedRef = useRef<number>(0)

  const isNfl = sport === "americanfootball_nfl"
  // Use position-specific markets for NFL based on filter
  const activeMarkets = isNfl
    ? (NFL_POSITION_MARKETS[positionFilter] ?? NFL_POSITION_MARKETS.All)
    : (SPORT_MARKETS[sport] ?? SPORT_MARKETS.basketball_nba)

  const loadData = useCallback(async (isManual = false) => {
    if (!isManual) setLoading(true)
    setErrorMessage(null)

    try {
      const params = new URLSearchParams({ sport })
      if (isNfl && positionFilter !== "All") {
        params.set("position", positionFilter)
      }

      const res = await fetch(`/api/daily-projections?${params.toString()}`, {
        cache: "no-store",
      })

      if (!res.ok) {
        throw new Error("Failed to load player projections.")
      }

      const payload: ApiResponse = await res.json()
      setData(payload)
      setLastUpdated(new Date())
      lastLoadedRef.current = Date.now()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load projections."
      )
    } finally {
      setLoading(false)
      setIsRefreshing(false)
    }
  }, [sport, positionFilter, isNfl])

  useEffect(() => {
    loadData()

    const checkAndRefresh = () => {
      const elapsed = Date.now() - lastLoadedRef.current
      if (elapsed >= REFRESH_INTERVAL_MS) {
        setIsRefreshing(true)
        loadData(true)
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAndRefresh()
      }
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIsRefreshing(true)
        loadData(true)
      }
    }, REFRESH_INTERVAL_MS)

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [loadData])

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

  const formatLastUpdated = (date: Date | null) => {
    if (!date) return ""
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 1) return "Just now"
    if (diffMins === 1) return "1 min ago"
    if (diffMins < 60) return `${diffMins} mins ago`
    return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
  }

  const totalPlayers = data?.count ?? 0
  const displayedPlayers = groupedPlayers.reduce((sum, g) => sum + g.players.length, 0)

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* Toolbar with position filter, refresh button, and last updated */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 bg-black/50 px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Position filter for NFL */}
          {isNfl && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">Position</span>
              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="rounded border border-white/10 bg-black/50 px-2 py-1 text-xs text-white/80 focus:border-emerald-400/40 focus:outline-none"
              >
                {NFL_POSITIONS.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="flex items-center gap-2 text-[10px] text-white/40">
            {lastUpdated && (
              <>
                <span>Updated {formatLastUpdated(lastUpdated)}</span>
                {isRefreshing && (
                  <span className="text-emerald-400">Refreshing...</span>
                )}
              </>
            )}
            {totalPlayers > 0 && (
              <span className="text-white/30">
                {displayedPlayers} of {totalPlayers} players
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleManualRefresh}
          disabled={isRefreshing || loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-emerald-400/40 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
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
          Refresh
        </button>
      </div>

      {/* Header row */}
      <div
        className="grid gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50"
        style={{
          gridTemplateColumns: isNfl
            ? `180px 50px 120px repeat(${activeMarkets.length}, minmax(0, 1fr))`
            : `200px 140px repeat(${activeMarkets.length}, minmax(0, 1fr))`,
        }}
      >
        <span>Player</span>
        {isNfl && <span>Pos</span>}
        <span>Matchup</span>
        {activeMarkets.map((market) => (
          <span key={market}>{MARKET_LABELS[market] ?? market.toUpperCase()}</span>
        ))}
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
        <div className="divide-y divide-white/5">
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
                  <div
                    key={player.id}
                    className="grid gap-2 px-3 py-3 text-[13px] text-white/70"
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
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
