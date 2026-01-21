"use client"

import React, { useEffect, useState, useCallback, useRef } from "react"
import { formatAmericanOdds } from "@/lib/utils/odds"
import TutorialPopup from "@/components/TutorialPopup"
import SharePropButton from "@/components/SharePropButton"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type AggregatedPlayerPropBet = {
  id: string
  playerName: string
  propType: string
  propLine: number | null
  side: "Over" | "Under" | null
  sportKey: string
  totalNotional: number
  betCount: number
  avgPriceCents: number
  avgSharpStrength: number
  predMarketProbability: number
  predMarketOdds: number | null
  sportsbookAvgProbability: number | null
  sportsbookAvgOdds: number | null
  edgePercent: number
  isClustered: boolean
  clusterWindowHours: number
  earliestTradeTime: string
  latestTradeTime: string
  compositeScore: number
  sources: Array<"kalshi" | "polymarket">
}

type ApiResponse = {
  ok: boolean
  sport: string
  updatedAt: string
  totalTrades: number
  count: number
  props: AggregatedPlayerPropBet[]
  topPicks: AggregatedPlayerPropBet[]
  clusterAlerts: AggregatedPlayerPropBet[]
}

type FilterState = {
  minEdge: number
  minComposite: number
  propType: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

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
  anytime_td: "ANYTIME TD",
  threes: "3PT",
  blocks: "BLK",
  steals: "STL",
  // MLB
  strikeouts: "K",
  hits: "H",
  home_runs: "HR",
  rbis: "RBI",
  runs: "R",
  total_bases: "TB",
  walks: "BB",
  pitcher_outs: "OUTS",
  hits_allowed: "HA",
  earned_runs: "ER",
  // NHL
  goals: "G",
  shots: "SOG",
  saves: "SV",
  blocked_shots: "BLK",
}

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: "NBA",
  americanfootball_nfl: "NFL",
  basketball_ncaab: "NCAAB",
  americanfootball_ncaaf: "CFB",
  baseball_mlb: "MLB",
  icehockey_nhl: "NHL",
  basketball_wnba: "WNBA",
}

const PROP_TYPES = [
  "All",
  // Football
  "passing_yards",
  "passing_tds",
  "rushing_yards",
  "rushing_tds",
  "receiving_yards",
  "receptions",
  "anytime_td",
  // Basketball
  "points",
  "rebounds",
  "assists",
  // Baseball
  "strikeouts",
  "hits",
  "home_runs",
  // Hockey
  "goals",
  "shots",
]

const REFRESH_INTERVAL_MS = 30 * 1000 // 30 seconds

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

const formatCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return `$${Math.round(value).toLocaleString("en-US")}`
}

const formatNumber = (value?: number | null, decimals = 1) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return Number(value).toFixed(decimals)
}

const formatEdge = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  const sign = value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

const formatPropLabel = (propType?: string | null) => {
  if (!propType) return "PROP"
  return MARKET_LABELS[propType] ?? propType.replace(/_/g, " ").toUpperCase()
}

const formatPropLine = (
  propType?: string | null,
  propLine?: number | null,
  side?: string | null
) => {
  const label = formatPropLabel(propType)
  const sideChar = side === "Over" ? "O" : side === "Under" ? "U" : ""
  const line = propLine != null ? formatNumber(propLine, 1) : ""
  return `${label} ${sideChar} ${line}`.trim()
}

const formatTime = (value?: string | null) => {
  if (!value) return "n/a"
  const date = new Date(value)
  if (!Number.isFinite(date.valueOf())) return "n/a"
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const formatComposite = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return Math.round(value).toString()
}

const formatProbability = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return `${(value * 100).toFixed(0)}%`
}

const formatOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "-"
  return formatAmericanOdds(Math.round(value))
}

const buildSharePropPayload = (prop: AggregatedPlayerPropBet) => {
  const sportLabel = SPORT_LABELS[prop.sportKey] ?? prop.sportKey.toUpperCase()
  const edgeLabel = prop.sportsbookAvgOdds != null ? formatEdge(prop.edgePercent) : "-"
  const scoreLabel = formatComposite(prop.compositeScore)
  const predOddsLabel = formatOdds(prop.predMarketOdds)
  const bookOddsLabel = formatOdds(prop.sportsbookAvgOdds)
  const volumeLabel = `${formatCurrency(prop.totalNotional)} (${prop.betCount})`
  const sourcesLabel = prop.sources.join(", ").toUpperCase()
  return {
    id: prop.id,
    sportLabel,
    playerName: prop.playerName,
    propLabel: formatPropLine(prop.propType, prop.propLine, prop.side),
    edgeLabel,
    scoreLabel,
    predOddsLabel,
    bookOddsLabel,
    volumeLabel,
    sourcesLabel,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────────────────────

const ScoreBadge = ({ score }: { score: number }) => {
  let color = "bg-white/10 text-white/60"
  if (score >= 70) {
    color = "bg-emerald-500/20 text-emerald-300"
  } else if (score >= 50) {
    color = "bg-amber-500/20 text-amber-300"
  } else if (score >= 30) {
    color = "bg-blue-500/20 text-blue-300"
  }

  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${color}`}>
      {formatComposite(score)}
    </span>
  )
}

const ClusterBadge = ({ betCount, windowHours }: { betCount: number; windowHours: number }) => (
  <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-200">
    <svg
      className="h-3 w-3"
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M12.395 2.553a1 1 0 00-1.45-.385c-.345.23-.614.558-.822.88-.214.33-.403.713-.57 1.116-.334.804-.614 1.768-.84 2.734a31.365 31.365 0 00-.613 3.58 2.64 2.64 0 01-.945-1.067c-.328-.68-.398-1.534-.398-2.654A1 1 0 005.05 6.05 6.981 6.981 0 003 11a7 7 0 1011.95-4.95c-.592-.591-.98-.985-1.348-1.467-.363-.476-.724-1.063-1.207-2.03zM12.12 15.12A3 3 0 017 13s.879.5 2.5.5c0-1 .5-4 1.25-4.5.5 1 .786 1.293 1.371 1.879A2.99 2.99 0 0113 13a2.99 2.99 0 01-.879 2.121z"
        clipRule="evenodd"
      />
    </svg>
    {betCount} bets
  </span>
)

const SourceBadge = ({ source }: { source: "kalshi" | "polymarket" }) => (
  <span
    className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
      source === "kalshi"
        ? "bg-purple-500/20 text-purple-300"
        : "bg-blue-500/20 text-blue-300"
    }`}
  >
    {source}
  </span>
)

const SportBadge = ({ sportKey }: { sportKey: string }) => {
  const label = SPORT_LABELS[sportKey] ?? sportKey
  const colors: Record<string, string> = {
    basketball_nba: "bg-orange-500/20 text-orange-300",
    americanfootball_nfl: "bg-green-500/20 text-green-300",
    basketball_ncaab: "bg-blue-500/20 text-blue-300",
    americanfootball_ncaaf: "bg-red-500/20 text-red-300",
    baseball_mlb: "bg-yellow-500/20 text-yellow-300",
    icehockey_nhl: "bg-cyan-500/20 text-cyan-300",
  }
  return (
    <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${colors[sportKey] ?? "bg-white/10 text-white/60"}`}>
      {label}
    </span>
  )
}

const TopPickCard = ({ prop, showSport }: { prop: AggregatedPlayerPropBet; showSport?: boolean }) => {
  const sharePayload = buildSharePropPayload(prop)
  return (
    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
      <div className="flex items-start justify-between gap-2">
      <div>
        <div className="text-base font-semibold text-white">
          {prop.playerName}
        </div>
        <div className="mt-0.5 text-sm text-emerald-200">
          {formatPropLine(prop.propType, prop.propLine, prop.side)}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <ScoreBadge score={prop.compositeScore} />
        <SharePropButton prop={sharePayload} />
      </div>
    </div>

    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded bg-black/30 px-2 py-1.5">
        <div className="text-[9px] uppercase tracking-wider text-white/40">Volume</div>
        <div className="font-semibold text-white">
          {formatCurrency(prop.totalNotional)}
          <span className="ml-1 text-white/50">({prop.betCount})</span>
        </div>
      </div>
      <div className="rounded bg-black/30 px-2 py-1.5">
        <div className="text-[9px] uppercase tracking-wider text-white/40">Edge</div>
        <div
          className={`font-semibold ${
            prop.edgePercent > 0
              ? "text-green-400"
              : prop.edgePercent < 0
                ? "text-red-400"
                : "text-white"
          }`}
        >
          {prop.sportsbookAvgOdds != null ? formatEdge(prop.edgePercent) : "-"}
        </div>
      </div>
    </div>

    <div className="mt-2 flex items-center gap-2 text-[11px] text-white/70">
      <span className="text-white/40">Odds</span>
      <span className="font-medium text-white">
        Pred {formatOdds(prop.predMarketOdds)}
      </span>
      <span className="text-white/30">|</span>
      <span className="font-medium text-white">
        Books {formatOdds(prop.sportsbookAvgOdds)}
      </span>
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {showSport && <SportBadge sportKey={prop.sportKey} />}
      {prop.isClustered && (
        <ClusterBadge betCount={prop.betCount} windowHours={prop.clusterWindowHours} />
      )}
      {prop.sources.map((source) => (
        <SourceBadge key={source} source={source} />
      ))}
    </div>
    </div>
  )
}

const PropRow = ({ prop, showSport }: { prop: AggregatedPlayerPropBet; showSport?: boolean }) => {
  const sharePayload = buildSharePropPayload(prop)
  return (
    <div className="border-b border-white/5 px-3 py-3 hover:bg-white/5 transition-colors">
    {/* Mobile layout */}
    <div className="sm:hidden space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-white">{prop.playerName}</div>
          <div className="mt-0.5 text-xs text-white/60">
            {formatPropLine(prop.propType, prop.propLine, prop.side)}
          </div>
        </div>
        <ScoreBadge score={prop.compositeScore} />
      </div>

      <div className="grid grid-cols-3 gap-2 text-[11px]">
        <div className="rounded bg-black/40 px-2 py-1.5">
          <div className="text-[9px] uppercase text-white/40">Volume</div>
          <div className="font-medium text-white">{formatCurrency(prop.totalNotional)}</div>
        </div>
        <div className="rounded bg-black/40 px-2 py-1.5">
          <div className="text-[9px] uppercase text-white/40">Bets</div>
          <div className="font-medium text-white">{prop.betCount}</div>
        </div>
        <div className="rounded bg-black/40 px-2 py-1.5">
          <div className="text-[9px] uppercase text-white/40">Edge</div>
        <div
          className={`font-medium ${
            prop.edgePercent > 0
              ? "text-green-400"
              : prop.edgePercent < 0
                ? "text-red-400"
                : "text-white"
          }`}
        >
          {prop.sportsbookAvgOdds != null ? formatEdge(prop.edgePercent) : "-"}
        </div>
      </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-white/70">
        <span className="text-white/40">Odds</span>
        <span className="font-medium text-white">
          Pred {formatOdds(prop.predMarketOdds)}
        </span>
        <span className="text-white/30">|</span>
        <span className="font-medium text-white">
          Books {formatOdds(prop.sportsbookAvgOdds)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {showSport && <SportBadge sportKey={prop.sportKey} />}
        {prop.isClustered && (
          <ClusterBadge betCount={prop.betCount} windowHours={prop.clusterWindowHours} />
        )}
        {prop.sources.map((source) => (
          <SourceBadge key={source} source={source} />
        ))}
        <span className="text-[10px] text-white/40">
          {formatTime(prop.latestTradeTime)}
        </span>
        <SharePropButton prop={sharePayload} />
      </div>
    </div>

    {/* Desktop layout */}
    <div className="hidden sm:grid sm:grid-cols-[1fr_140px_100px_80px_80px_80px_120px_90px] items-center gap-3 text-sm">
      {/* Player & Prop */}
      <div>
        <div className="font-semibold text-white truncate">{prop.playerName}</div>
        <div className="text-xs text-white/60">
          {formatPropLine(prop.propType, prop.propLine, prop.side)}
        </div>
      </div>

      {/* Volume */}
      <div>
        <div className="font-medium text-white">{formatCurrency(prop.totalNotional)}</div>
        <div className="text-xs text-white/50">{prop.betCount} bet{prop.betCount !== 1 ? "s" : ""}</div>
      </div>

      {/* Pred Market Prob */}
      <div className="text-center">
        <div className="font-medium text-blue-300">
          {formatProbability(prop.predMarketProbability)}
        </div>
        <div className="text-[10px] text-white/40">{formatOdds(prop.predMarketOdds)}</div>
      </div>

      {/* Book Prob */}
      <div className="text-center">
        {prop.sportsbookAvgProbability != null ? (
          <>
            <div className="font-medium text-white/80">
              {formatProbability(prop.sportsbookAvgProbability)}
            </div>
            <div className="text-[10px] text-white/40">
              {formatOdds(prop.sportsbookAvgOdds)}
            </div>
          </>
        ) : (
          <div className="text-white/30">-</div>
        )}
      </div>

      {/* Edge */}
      <div className="text-center">
        <div
          className={`font-semibold ${
            prop.edgePercent > 0
              ? "text-green-400"
              : prop.edgePercent < 0
                ? "text-red-400"
                : "text-white/60"
          }`}
        >
          {prop.sportsbookAvgOdds != null ? formatEdge(prop.edgePercent) : "-"}
        </div>
      </div>

      {/* Score */}
      <div className="text-center">
        <ScoreBadge score={prop.compositeScore} />
      </div>

      {/* Indicators */}
      <div className="flex flex-wrap items-center justify-end gap-1">
        {showSport && <SportBadge sportKey={prop.sportKey} />}
        {prop.isClustered && (
          <ClusterBadge betCount={prop.betCount} windowHours={prop.clusterWindowHours} />
        )}
        {prop.sources.map((source) => (
          <SourceBadge key={source} source={source} />
        ))}
      </div>

      <div className="flex justify-end">
        <SharePropButton prop={sharePayload} />
      </div>
    </div>
  </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export default function SharpPlayerPropsTable({ sport }: { sport: string }) {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [filters, setFilters] = useState<FilterState>({
    minEdge: 0,
    minComposite: 0,
    propType: "All",
  })
  const lastLoadedRef = useRef<number>(0)

  const loadData = useCallback(
    async (isManual = false) => {
      if (!isManual) setLoading(true)
      setErrorMessage(null)

      try {
        const params = new URLSearchParams({
          sport,
          limit: "50",
        })

        const res = await fetch(`/api/sharp-player-props?${params.toString()}`, {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error("Failed to load sharp player props.")
        }

        const json = (await res.json()) as ApiResponse
        setData(json)
        lastLoadedRef.current = Date.now()
      } catch (err: any) {
        setErrorMessage(err.message ?? "Failed to load data.")
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [sport]
  )

  // Keep ref to latest loadData
  const loadDataRef = useRef(loadData)
  useEffect(() => {
    loadDataRef.current = loadData
  }, [loadData])

  // Initial load
  useEffect(() => {
    loadData()
  }, [sport])

  // Auto-refresh
  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        setIsRefreshing(true)
        loadDataRef.current(true)
      }
    }, REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [])

  // Visibility change
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

  // Reset filters on sport change
  useEffect(() => {
    setFilters({ minEdge: 0, minComposite: 0, propType: "All" })
  }, [sport])

  const handleManualRefresh = useCallback(() => {
    if (isRefreshing || loading) return
    setIsRefreshing(true)
    loadData(true)
  }, [isRefreshing, loading, loadData])

  // Apply client-side filters
  const filteredProps = React.useMemo(() => {
    if (!data?.props) return []

    return data.props.filter((prop) => {
      if (filters.minEdge > 0 && Math.abs(prop.edgePercent) < filters.minEdge) {
        return false
      }
      if (filters.minComposite > 0 && prop.compositeScore < filters.minComposite) {
        return false
      }
      if (filters.propType !== "All" && prop.propType !== filters.propType) {
        return false
      }
      return true
    })
  }, [data?.props, filters])

  const topPicks = React.useMemo(() => {
    if (!data?.topPicks) return []
    const filteredIds = new Set(filteredProps.map((p) => p.id))
    return data.topPicks.filter((p) => filteredIds.has(p.id))
  }, [data?.topPicks, filteredProps])

  return (
    <>
      <TutorialPopup tutorialId="sharp-props" />
      <div className="space-y-4">
        {/* Top Picks Section */}
      {!loading && topPicks.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-black/40">
          <div className="flex items-center justify-between border-b border-emerald-500/10 px-4 py-2.5">
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-400">
              Top Sharp Picks
            </span>
            <span className="text-xs text-white/40">{topPicks.length} picks</span>
          </div>
          <div className="p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {topPicks.slice(0, 6).map((prop) => (
                <TopPickCard key={prop.id} prop={prop} showSport={sport === "all"} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Table Section */}
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {/* Toolbar */}
        <div className="border-b border-white/5 bg-black/50 px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {/* Prop Type Filter */}
              <select
                value={filters.propType}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, propType: e.target.value }))
                }
                className="rounded border border-white/10 bg-black/50 px-2 py-1.5 text-xs text-white/80 focus:border-emerald-400/40 focus:outline-none"
              >
                {PROP_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type === "All" ? "All Props" : formatPropLabel(type)}
                  </option>
                ))}
              </select>

              {/* Min Composite Filter */}
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] uppercase tracking-wider text-white/40">
                  Min Score
                </label>
                <input
                  type="range"
                  min={0}
                  max={80}
                  step={10}
                  value={filters.minComposite}
                  onChange={(e) =>
                    setFilters((f) => ({
                      ...f,
                      minComposite: Number(e.target.value),
                    }))
                  }
                  className="h-1 w-20 cursor-pointer appearance-none rounded bg-white/20 accent-emerald-400"
                />
                <span className="min-w-[24px] text-xs text-white/60">
                  {filters.minComposite > 0 ? filters.minComposite : "0"}
                </span>
              </div>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing || loading}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.15em] text-white/60 transition-colors hover:border-emerald-400/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
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

            <div className="flex items-center gap-2 text-[10px] text-white/40">
              {data?.totalTrades != null && (
                <span>{data.totalTrades} whale trades tracked</span>
              )}
              <span className="text-white/20">|</span>
              <span>{filteredProps.length} props</span>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="px-4 py-8 text-sm text-white/60">Loading sharp props...</div>
        ) : errorMessage ? (
          <div className="px-4 py-8 text-sm text-red-200">{errorMessage}</div>
        ) : filteredProps.length === 0 ? (
          <div className="px-4 py-8 text-sm text-white/60">
            No sharp player prop bets found. Try adjusting your filters.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {/* Desktop Header */}
            <div className="hidden border-b border-white/5 bg-black/30 px-3 py-2 sm:grid sm:grid-cols-[1fr_140px_100px_80px_80px_80px_120px_90px] items-center gap-3 text-[10px] uppercase tracking-[0.15em] text-white/50">
              <div>Player / Prop</div>
              <div>Volume</div>
              <div className="text-center">Pred Mkt</div>
              <div className="text-center">Books</div>
              <div className="text-center">Edge</div>
              <div className="text-center">Score</div>
              <div className="text-right">Signals</div>
              <div className="text-right">Share</div>
            </div>

            {/* Rows */}
            {filteredProps.map((prop) => (
              <PropRow key={prop.id} prop={prop} showSport={sport === "all"} />
            ))}
          </div>
        )}
        </div>
      </div>
    </>
  )
}
