"use client"

import React, { useEffect, useMemo, useState, useRef, useCallback } from "react"

type PropMarket = {
  line: number
  projection?: number
  delta?: number
  over?: {
    best: number
    bestBook?: string
  }
  under?: {
    best: number
    bestBook?: string
  }
}

type PlayerProp = {
  player: string
  team?: string
  teamAbbr?: string
  game?: string
  markets: Record<string, PropMarket>
}

type PlayerProjection = {
  id?: string
  player: string
  team?: string
  teamAbbr?: string
  game?: string
  projections: Record<string, number | null>
}

type Row = {
  player: string
  team?: string
  game?: string
  markets: Record<
    string,
    {
      line?: number
      projection?: number
      delta?: number
      edge?: number
      overOdds?: number
      underOdds?: number
      overBook?: string
      underBook?: string
    }
  >
  maxEdge: number
}

const SPORT_MARKETS: Record<string, readonly string[]> = {
  basketball_nba: ["points", "rebounds", "assists"],
  americanfootball_nfl: ["rushing_yards", "receiving_yards", "receptions"],
}

const MARKET_LABELS: Record<string, string> = {
  points: "PTS",
  rebounds: "REB",
  assists: "AST",
  passing_yards: "PASS YDS",
  rushing_yards: "RUSH YDS",
  receiving_yards: "REC YDS",
  receptions: "REC",
}

const formatNumber = (value?: number | null) => {
  if (!Number.isFinite(value)) return "n/a"
  return Number(value).toFixed(1)
}

const formatEdge = (value?: number) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${value.toFixed(1)}%`
}

const formatDelta = (value?: number | null) => {
  if (!Number.isFinite(value)) return "n/a"
  const sign = value && value > 0 ? "+" : ""
  return `${sign}${Number(value).toFixed(1)}`
}

const formatOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const normalizeToken = (value?: string | null) =>
  (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]/g, "")

const normalizePlayerName = (value?: string | null) => {
  const raw = (value ?? "").trim()
  if (!raw) return ""
  if (raw.includes(",")) {
    const parts = raw.split(",").map((part) => part.trim()).filter(Boolean)
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`.trim()
    }
  }
  return raw
}

const makePlayerKey = (player?: string | null, team?: string | null) => {
  const name = normalizeToken(normalizePlayerName(player))
  const club = normalizeToken(team)
  return club ? `${name}|${club}` : name
}

const computeEdgePercent = (projection?: number, line?: number) => {
  if (!Number.isFinite(projection) || !Number.isFinite(line) || line === 0) {
    return null
  }
  return (Math.abs((projection as number) - (line as number)) / Math.abs(line as number)) * 100
}

const computeDelta = (projection?: number, line?: number) => {
  if (!Number.isFinite(projection) || !Number.isFinite(line)) return null
  return (projection as number) - (line as number)
}

const REFRESH_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

export default function PlayerProjectionsTable({
  sport,
}: {
  sport: string
}) {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedGames, setExpandedGames] = useState<Record<string, boolean>>(
    {}
  )
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const lastLoadedRef = useRef<number>(0)
  const activeMarkets = SPORT_MARKETS[sport] ?? SPORT_MARKETS.basketball_nba

  useEffect(() => {
    let active = true
    const load = async (isManual = false) => {
      if (!isManual) setLoading(true)
      setErrorMessage(null)
      try {
        const projectionsRes =
          sport === "basketball_nba"
            ? await fetch("/api/player-projections", { cache: "no-store" })
            : null
        const propsRes = await fetch(
          `/api/player-props?sport=${sport}&market=all`,
          { cache: "no-store" }
        )

        if (projectionsRes && !projectionsRes.ok) {
          throw new Error("Failed to load player projections.")
        }

        const projectionsPayload = projectionsRes
          ? await projectionsRes.json()
          : { data: [] }
        const projections: PlayerProjection[] = Array.isArray(
          projectionsPayload?.data
        )
          ? projectionsPayload.data
          : []

        const lineByPlayer = new Map<string, PlayerProp>()
        if (propsRes.ok) {
          const propsPayload = await propsRes.json()
          const propsData: PlayerProp[] = Array.isArray(propsPayload?.data)
            ? propsPayload.data
            : []
          for (const entry of propsData) {
            const key = makePlayerKey(entry.player, entry.team)
            const nameKey = makePlayerKey(entry.player, null)
            if (!key) continue
            if (!lineByPlayer.has(key)) {
              lineByPlayer.set(key, entry)
            }
            if (nameKey && !lineByPlayer.has(nameKey)) {
              lineByPlayer.set(nameKey, entry)
            }
          }
        }

        const grouped: Row[] = []
        const seen = new Set<string>()
        const hasProjections = projections.length > 0

        if (!hasProjections) {
          // Use projections embedded in props data (e.g., NFL)
          for (const entry of lineByPlayer.values()) {
            const key = makePlayerKey(entry.player, entry.teamAbbr || entry.team)
            if (!key || seen.has(key)) continue
            seen.add(key)

            const markets: Row["markets"] = {}
            let maxEdge = 0
            for (const market of activeMarkets) {
              const lineMarket = entry.markets?.[market]
              if (!lineMarket) continue

              // Extract projection from props data if available
              const projection = Number.isFinite(lineMarket.projection)
                ? lineMarket.projection
                : undefined
              const line = lineMarket.line
              const edge = computeEdgePercent(projection, line) ?? undefined
              const delta = lineMarket.delta ?? computeDelta(projection, line) ?? undefined

              if (edge != null) {
                maxEdge = Math.max(maxEdge, edge)
              }

              markets[market] = {
                line,
                projection,
                edge,
                delta: delta != null ? Number(Number(delta).toFixed(1)) : undefined,
              }
              markets[market].overOdds = lineMarket.over?.best
              markets[market].underOdds = lineMarket.under?.best
              markets[market].overBook = lineMarket.over?.bestBook
              markets[market].underBook = lineMarket.under?.bestBook
            }

            grouped.push({
              player: entry.player,
              team: entry.teamAbbr || entry.team,
              game: entry.game,
              markets,
              maxEdge,
            })
          }
        } else {
          for (const entry of projections) {
            const key = makePlayerKey(entry.player, entry.teamAbbr || entry.team)
            if (seen.has(key)) continue
            seen.add(key)

            const lineEntry =
              lineByPlayer.get(key) ||
              lineByPlayer.get(makePlayerKey(entry.player, null))
            const markets: Row["markets"] = {}
            let maxEdge = 0
            for (const market of activeMarkets) {
              const projection = Number.isFinite(entry.projections?.[market])
                ? Number(entry.projections?.[market])
                : undefined
              const lineMarket = lineEntry?.markets?.[market]
              const line = lineMarket?.line
              const edge = computeEdgePercent(projection, line) ?? undefined
              const delta = computeDelta(projection, line) ?? undefined
              if (edge != null) {
                maxEdge = Math.max(maxEdge, edge)
              }
              markets[market] = { line, projection, edge }
              if (lineMarket) {
                markets[market].overOdds = lineMarket.over?.best
                markets[market].underOdds = lineMarket.under?.best
                markets[market].overBook = lineMarket.over?.bestBook
                markets[market].underBook = lineMarket.under?.bestBook
              }
              if (delta != null) {
                markets[market].delta = Number(delta.toFixed(1))
              }
            }

            grouped.push({
              player: entry.player,
              team: entry.teamAbbr || entry.team,
              game: entry.game ?? lineEntry?.game,
              markets,
              maxEdge,
            })
          }
        }

        if (active) {
          setRows(grouped)
          setLastUpdated(new Date())
          lastLoadedRef.current = Date.now()
        }
      } catch (error) {
        if (active) {
          setErrorMessage(
            error instanceof Error ? error.message : "Failed to load projections."
          )
        }
      } finally {
        if (active) {
          setLoading(false)
          setIsRefreshing(false)
        }
      }
    }

    // Check if refresh is needed (for visibility change handler)
    const checkAndRefresh = () => {
      const elapsed = Date.now() - lastLoadedRef.current
      if (elapsed >= REFRESH_INTERVAL_MS) {
        setIsRefreshing(true)
        load(true) // Manual refresh, don't show full loading state
      }
    }

    // Handle visibility change - refresh if stale when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        checkAndRefresh()
      }
    }

    // Initial load
    load()

    // Set up interval for background refresh
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIsRefreshing(true)
        load(true)
      }
    }, REFRESH_INTERVAL_MS)

    // Listen for tab visibility changes
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(interval)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [sport, activeMarkets])

  const groupedRows = useMemo(() => {
    const byGame = new Map<string, Row[]>()
    for (const row of rows) {
      const hasLine = Object.values(row.markets).some(
        (market) => Number.isFinite(market?.line)
      )
      if (!hasLine) continue
      const key = row.game ?? "Other"
      if (!byGame.has(key)) {
        byGame.set(key, [])
      }
      byGame.get(key)!.push(row)
    }
    return Array.from(byGame.entries())
      .map(([game, group]) => ({
        game,
        rows: group.sort((a, b) => b.maxEdge - a.maxEdge),
      }))
      .sort((a, b) => {
        if (a.game === "Other") return 1
        if (b.game === "Other") return -1
        return a.game.localeCompare(b.game)
      })
  }, [rows])

  const handleManualRefresh = useCallback(() => {
    if (isRefreshing || loading) return
    setIsRefreshing(true)
    // Trigger a re-fetch by temporarily changing a dependency
    // We'll do this by directly calling the load function pattern
    const fetchData = async () => {
      try {
        const projectionsRes =
          sport === "basketball_nba"
            ? await fetch("/api/player-projections", { cache: "no-store" })
            : null
        const propsRes = await fetch(
          `/api/player-props?sport=${sport}&market=all`,
          { cache: "no-store" }
        )

        if (projectionsRes && !projectionsRes.ok) {
          throw new Error("Failed to load player projections.")
        }

        const projectionsPayload = projectionsRes
          ? await projectionsRes.json()
          : { data: [] }
        const projections: PlayerProjection[] = Array.isArray(
          projectionsPayload?.data
        )
          ? projectionsPayload.data
          : []

        const lineByPlayer = new Map<string, PlayerProp>()
        if (propsRes.ok) {
          const propsPayload = await propsRes.json()
          const propsData: PlayerProp[] = Array.isArray(propsPayload?.data)
            ? propsPayload.data
            : []
          for (const entry of propsData) {
            const key = makePlayerKey(entry.player, entry.team)
            const nameKey = makePlayerKey(entry.player, null)
            if (!key) continue
            if (!lineByPlayer.has(key)) {
              lineByPlayer.set(key, entry)
            }
            if (nameKey && !lineByPlayer.has(nameKey)) {
              lineByPlayer.set(nameKey, entry)
            }
          }
        }

        const grouped: Row[] = []
        const seen = new Set<string>()
        const hasProjections = projections.length > 0

        if (!hasProjections) {
          for (const entry of lineByPlayer.values()) {
            const key = makePlayerKey(entry.player, entry.teamAbbr || entry.team)
            if (!key || seen.has(key)) continue
            seen.add(key)

            const markets: Row["markets"] = {}
            let maxEdge = 0
            for (const market of activeMarkets) {
              const lineMarket = entry.markets?.[market]
              if (!lineMarket) continue

              const projection = Number.isFinite(lineMarket.projection)
                ? lineMarket.projection
                : undefined
              const line = lineMarket.line
              const edge = computeEdgePercent(projection, line) ?? undefined
              const delta = lineMarket.delta ?? computeDelta(projection, line) ?? undefined

              if (edge != null) {
                maxEdge = Math.max(maxEdge, edge)
              }

              markets[market] = {
                line,
                projection,
                edge,
                delta: delta != null ? Number(Number(delta).toFixed(1)) : undefined,
              }
              markets[market].overOdds = lineMarket.over?.best
              markets[market].underOdds = lineMarket.under?.best
              markets[market].overBook = lineMarket.over?.bestBook
              markets[market].underBook = lineMarket.under?.bestBook
            }

            grouped.push({
              player: entry.player,
              team: entry.teamAbbr || entry.team,
              game: entry.game,
              markets,
              maxEdge,
            })
          }
        } else {
          for (const entry of projections) {
            const key = makePlayerKey(entry.player, entry.teamAbbr || entry.team)
            if (seen.has(key)) continue
            seen.add(key)

            const lineEntry =
              lineByPlayer.get(key) ||
              lineByPlayer.get(makePlayerKey(entry.player, null))
            const markets: Row["markets"] = {}
            let maxEdge = 0
            for (const market of activeMarkets) {
              const projection = Number.isFinite(entry.projections?.[market])
                ? Number(entry.projections?.[market])
                : undefined
              const lineMarket = lineEntry?.markets?.[market]
              const line = lineMarket?.line
              const edge = computeEdgePercent(projection, line) ?? undefined
              const delta = computeDelta(projection, line) ?? undefined
              if (edge != null) {
                maxEdge = Math.max(maxEdge, edge)
              }
              markets[market] = { line, projection, edge }
              if (lineMarket) {
                markets[market].overOdds = lineMarket.over?.best
                markets[market].underOdds = lineMarket.under?.best
                markets[market].overBook = lineMarket.over?.bestBook
                markets[market].underBook = lineMarket.under?.bestBook
              }
              if (delta != null) {
                markets[market].delta = Number(delta.toFixed(1))
              }
            }

            grouped.push({
              player: entry.player,
              team: entry.teamAbbr || entry.team,
              game: entry.game ?? lineEntry?.game,
              markets,
              maxEdge,
            })
          }
        }

        setRows(grouped)
        setLastUpdated(new Date())
        lastLoadedRef.current = Date.now()
      } catch (error) {
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to load projections."
        )
      } finally {
        setIsRefreshing(false)
      }
    }
    fetchData()
  }, [sport, activeMarkets, isRefreshing, loading])

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

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* Toolbar with refresh button and last updated */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 bg-black/50 px-3 py-2">
        <div className="flex items-center gap-2 text-[10px] text-white/40">
          {lastUpdated && (
            <>
              <span>Updated {formatLastUpdated(lastUpdated)}</span>
              {isRefreshing && (
                <span className="text-emerald-400">Refreshing...</span>
              )}
            </>
          )}
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
      <div className="grid grid-cols-[220px_160px_repeat(3,minmax(0,1fr))] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
        <span>Player</span>
        <span>Matchup</span>
        <span>{MARKET_LABELS[activeMarkets[0]] ?? activeMarkets[0].toUpperCase()}</span>
        <span>{MARKET_LABELS[activeMarkets[1]] ?? activeMarkets[1].toUpperCase()}</span>
        <span>{MARKET_LABELS[activeMarkets[2]] ?? activeMarkets[2].toUpperCase()}</span>
      </div>
      {loading ? (
        <div className="px-4 py-6 text-sm text-white/60">
          Loading projections...
        </div>
      ) : errorMessage ? (
        <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
      ) : groupedRows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-white/60">
          No player projections found for today.
        </div>
      ) : (
        <div className="divide-y divide-white/5">
          {groupedRows.map((group) => {
            const isExpanded = Boolean(expandedGames[group.game])
            const visibleRows = isExpanded ? group.rows : group.rows.slice(0, 3)
            const remaining = Math.max(0, group.rows.length - visibleRows.length)
            return (
              <div key={group.game}>
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
                {visibleRows.map((row) => (
                <div
                  key={`${group.game}-${row.player}-${row.team ?? "team"}`}
                  className="grid grid-cols-[220px_160px_repeat(3,minmax(0,1fr))] gap-2 px-3 py-3 text-[13px] text-white/70"
                >
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-white">
                      {row.player}
                    </div>
                    <div className="text-xs text-white/50">
                      {row.team ?? "Team n/a"}
                    </div>
                  </div>
                  <div className="text-xs text-white/70">
                    {row.game ?? "Matchup n/a"}
                  </div>
                  {activeMarkets.map((market) => {
                    const data = row.markets[market]
                    const line = formatNumber(data?.line)
                    const hasOdds =
                      Number.isFinite(data?.overOdds) ||
                      Number.isFinite(data?.underOdds)
                    const oddsLabel = hasOdds
                      ? ` (O ${formatOdds(data?.overOdds)} / U ${formatOdds(data?.underOdds)})`
                      : ""
                    return (
                      <div
                        key={market}
                        className="space-y-1 text-xs text-white/70"
                      >
                        <div className="rounded bg-white/10 px-1.5 py-0.5">
                          {MARKET_LABELS[market] ?? market.toUpperCase()} {line}
                          {oddsLabel}
                        </div>
                        <div className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                          Delta {formatDelta(data?.delta)}
                        </div>
                        <div className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                          Edge {formatEdge(data?.edge)}
                        </div>
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

