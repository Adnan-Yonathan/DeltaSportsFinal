"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"

type LeagueKey = "nba" | "nfl" | "mlb" | "nhl"

const LEAGUE_TABS: { key: LeagueKey; label: string }[] = [
  { key: "nba", label: "NBA" },
  { key: "nfl", label: "NFL" },
  { key: "mlb", label: "MLB" },
  { key: "nhl", label: "NHL" },
]

type TeamTrend = {
  type: "team"
  league: string
  name: string
  sample: number
  wins: number
  losses: number
  avgFor: number | null
  avgAgainst: number | null
}

type PlayerTrend = {
  type: "player"
  league: string
  name: string
  sample: number
  avgPts: number | null
  avgReb: number | null
  avgAst: number | null
  avgThrees: number | null
  avgPass?: number | null
  avgRush?: number | null
  avgRec?: number | null
}

type PlayerLeaderRow = {
  id?: string
  name: string
  sample: number
  avgPts?: number | null
  avgReb?: number | null
  avgAst?: number | null
  fgPct?: number | null
  tpPct?: number | null
  avgPass?: number | null
  avgRush?: number | null
  avgRec?: number | null
}

type PlayerLeaders = {
  pts: PlayerLeaderRow[]
  reb: PlayerLeaderRow[]
  ast: PlayerLeaderRow[]
  fgPct: PlayerLeaderRow[]
  tpPct: PlayerLeaderRow[]
  passYds?: PlayerLeaderRow[]
  rushYds?: PlayerLeaderRow[]
  recYds?: PlayerLeaderRow[]
}

export function TopPerformancesStrip() {
  const [league, setLeague] = useState<LeagueKey>("nba")
  const [teamTrends, setTeamTrends] = useState<TeamTrend[]>([])
  const [playerTrends, setPlayerTrends] = useState<PlayerTrend[]>([])
  const [playerLeaders, setPlayerLeaders] = useState<PlayerLeaders | null>(null)
  const [viewMode, setViewMode] = useState<"teams" | "players">("teams")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const skeletons = useMemo(() => Array.from({ length: 6 }), [])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/performances/top?league=${league}`)
        if (!res.ok) throw new Error(`status ${res.status}`)
        const data = await res.json()
        setTeamTrends(Array.isArray(data?.teamRecent) ? data.teamRecent : [])
        const normalizedPlayerRecent: any[] = Array.isArray(data?.playerRecent)
          ? data.playerRecent.map((item: any) => ({
              type: "player",
              league: league,
              sample: item.sample ?? 5,
              avgPts: item.avgPts ?? item.pts ?? null,
              avgReb: item.avgReb ?? null,
              avgAst: item.avgAst ?? null,
              avgThrees: item.avgThrees ?? item?.tpm ?? null,
              ...item,
            }))
          : []
        const leaderFallback: any[] = Array.isArray(data?.playerLeaders?.recentTop)
          ? data.playerLeaders.recentTop.map((item: any) => ({
              type: "player",
              league: league,
              sample: item.sample ?? 5,
              avgPts: item.avgPts ?? null,
              avgReb: item.avgReb ?? null,
              avgAst: item.avgAst ?? null,
              avgThrees: item.avgThrees ?? null,
              ...item,
            }))
          : []
        setPlayerTrends(normalizedPlayerRecent.length ? normalizedPlayerRecent : leaderFallback)
        setPlayerLeaders(data?.playerLeaders || null)
      } catch (err) {
        console.warn("[TopPerformancesStrip] fetch failed", err)
        setError("Top trends unavailable right now.")
        setTeamTrends([])
        setPlayerTrends([])
        setPlayerLeaders(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [league])

  const visibleTeams = expanded ? teamTrends : teamTrends.slice(0, 3)
  const visiblePlayers = expanded ? playerTrends : playerTrends.slice(0, 3)

  const leaderCats =
    league === "nfl"
      ? [
          { key: "passYds", label: "Pass YDS" },
          { key: "rushYds", label: "Rush YDS" },
          { key: "recYds", label: "Rec YDS" },
        ]
      : [
          { key: "pts", label: "Points" },
          { key: "reb", label: "Rebounds" },
          { key: "ast", label: "Assists" },
          { key: "fgPct", label: "FG%" },
          { key: "tpPct", label: "3PT%" },
        ]

  const renderCardDetail = (item: any) => {
    if (item.type === "team") {
      return (
        <div className="text-[12px] text-gray-300">
          Last {item.sample}: {item.wins}-{item.losses} | PPG {item.avgFor?.toFixed?.(1) ?? "--"} / OPP {item.avgAgainst?.toFixed?.(1) ?? "--"}
        </div>
      )
    }
    if (league === "nfl") {
      return (
        <div className="text-[12px] text-gray-300">
          Last {item.sample}: {item.avgPass?.toFixed?.(1) ?? "--"} Pass YDS | {item.avgRush?.toFixed?.(1) ?? "--"} Rush YDS | {item.avgRec?.toFixed?.(1) ?? "--"} Rec YDS
        </div>
      )
    }
    return (
      <div className="text-[12px] text-gray-300">
        Last {item.sample}: {item.avgPts?.toFixed?.(1) ?? "--"} PTS | {item.avgReb?.toFixed?.(1) ?? "--"} REB | {item.avgAst?.toFixed?.(1) ?? "--"} AST | {item.avgThrees?.toFixed?.(1) ?? "--"} 3PM
      </div>
    )
  }

  return (
    <>
      <div className="w-full max-w-3xl mx-auto bg-transparent px-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase text-emerald-200/80 tracking-[0.14em]">Top performances</div>
            <div className="text-base font-semibold text-white">Recent standout stat lines</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {LEAGUE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setLeague(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  league === tab.key
                    ? "bg-emerald-500 text-white"
                    : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className="flex rounded-md border border-emerald-500/40 text-xs font-semibold overflow-hidden">
              {[
                { value: "teams", label: "Team trends" },
                { value: "players", label: "Player trends" },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setViewMode(opt.value as "teams" | "players")}
                  className={`px-3 py-1 transition ${
                    viewMode === opt.value
                      ? "bg-emerald-500 text-white"
                      : "bg-black/70 text-emerald-100 hover:bg-emerald-900/40"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {loading
            ? skeletons.slice(0, 3).map((_, idx) => (
                <div key={idx} className="rounded-lg border border-emerald-500/10 bg-transparent p-3 animate-pulse">
                  <div className="h-3 w-1/2 rounded bg-gray-800/70 mb-2" />
                  <div className="h-4 w-3/4 rounded bg-gray-800/70 mb-1.5" />
                  <div className="h-3 w-2/3 rounded bg-gray-800/70" />
                </div>
              ))
            : (viewMode === "teams" ? visibleTeams.length : visiblePlayers.length) > 0
            ? (viewMode === "teams" ? visibleTeams : visiblePlayers).slice(0, 3).map((item: any, idx: number) => (
                <motion.div
                  key={`${item.name}-${idx}-${item.type}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="group relative rounded-lg border border-transparent bg-transparent px-3 py-2 hover:border-emerald-500/30 hover:bg-emerald-900/10"
                >
                  <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-[0.14em]">
                    <span>{item.league?.toUpperCase?.() || league.toUpperCase()}</span>
                    <span>{item.type === "team" ? "Team (last 5)" : "Player (last 5)"}</span>
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-white leading-tight">{item.name}</div>
                  {renderCardDetail(item)}
                  <div className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-70" />
                </motion.div>
              ))
            : (
              <div className="col-span-3 rounded-lg border border-emerald-500/10 bg-transparent p-3 text-sm text-gray-300">
                {error || "No trends available right now."}
              </div>
              )}
        </div>

        {((viewMode === "teams" ? teamTrends.length : playerTrends.length) > 3) && !loading ? (
          <div className="mt-2 flex justify-end">
            <button
              onClick={() => setExpanded(true)}
              className="text-xs font-semibold text-emerald-300 hover:text-white transition"
            >
              + more
            </button>
          </div>
        ) : null}
      </div>

      {expanded && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4">
          <div className="w-full max-w-4xl rounded-2xl border border-emerald-500/30 bg-black/90 p-5 shadow-2xl shadow-emerald-500/20 relative">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-[11px] uppercase text-emerald-200/80 tracking-[0.14em]">Top performances</div>
                <div className="text-base font-semibold text-white">{LEAGUE_TABS.find((l) => l.key === league)?.label}</div>
              </div>
              <div className="flex items-center gap-2">
                {LEAGUE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    onClick={() => setLeague(tab.key)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      league === tab.key
                        ? "bg-emerald-500 text-white"
                        : "border border-emerald-500/30 text-emerald-200 hover:bg-emerald-900/40"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
                <div className="flex rounded-md border border-emerald-500/40 text-xs font-semibold overflow-hidden">
                  {[
                    { value: "teams", label: "Team trends" },
                    { value: "players", label: "Player trends" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setViewMode(opt.value as "teams" | "players")}
                      className={`px-3 py-1 transition ${
                        viewMode === opt.value
                          ? "bg-emerald-500 text-white"
                          : "bg-black/70 text-emerald-100 hover:bg-emerald-900/40"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-full px-3 py-1 text-xs font-semibold bg-emerald-500/20 text-emerald-100 hover:bg-emerald-500/40 transition"
                >
                  Close
                </button>
              </div>
            </div>

            <div className="grid gap-2 md:grid-cols-3 max-h-[70vh] overflow-y-auto pr-1">
              {loading
                ? skeletons.map((_, idx) => (
                    <div key={idx} className="rounded-lg border border-emerald-500/10 bg-transparent p-3 animate-pulse">
                      <div className="h-3 w-1/2 rounded bg-gray-800/70 mb-2" />
                      <div className="h-4 w-3/4 rounded bg-gray-800/70 mb-1.5" />
                      <div className="h-3 w-2/3 rounded bg-gray-800/70" />
                    </div>
                  ))
                : (viewMode === "teams" ? teamTrends.length : playerTrends.length) > 0
                ? (viewMode === "teams" ? teamTrends : playerTrends).map((item: any, idx: number) => (
                    <div key={`${item.name}-${idx}-${item.type}`} className="group relative rounded-lg border border-transparent bg-transparent px-3 py-2 hover:border-emerald-500/30 hover:bg-emerald-900/10">
                      <div className="flex items-center justify-between text-xs text-gray-400 uppercase tracking-[0.14em]">
                        <span>{item.league?.toUpperCase?.() || league.toUpperCase()}</span>
                        <span>{item.type === "team" ? "Team (last 5)" : "Player (last 5)"}</span>
                      </div>
                      <div className="mt-0.5 text-sm font-semibold text-white leading-tight">{item.name}</div>
                      {renderCardDetail(item)}
                      <div className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent opacity-70" />
                    </div>
                  ))
                : (
                  <div className="col-span-3 rounded-lg border border-emerald-500/10 bg-transparent p-3 text-sm text-gray-300">
                    {error || "No trends available right now."}
                  </div>
                  )}
            </div>

            {viewMode === "players" && playerLeaders ? (
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {leaderCats.map((cat) => {
                  const rows = (playerLeaders as any)[cat.key] as PlayerLeaderRow[]
                  if (!rows || !rows.length) return null
                  return (
                    <div key={cat.key} className="rounded-md border border-gray-800 bg-gray-900/70 p-3">
                      <div className="text-xs text-gray-400 uppercase tracking-[0.14em]">{cat.label} leaders (last 5)</div>
                      <ul className="mt-2 space-y-1 text-sm text-white">
                        {rows.slice(0, 3).map((p, idx) => (
                          <li key={`${cat.key}-${p.name}-${idx}`} className="flex justify-between text-[13px]">
                            <span className="truncate">{idx + 1}. {p.name}</span>
                            <span className="text-emerald-200">
                              {cat.key === "pts" && (p.avgPts?.toFixed?.(1) ?? "--")}
                              {cat.key === "reb" && (p.avgReb?.toFixed?.(1) ?? "--")}
                              {cat.key === "ast" && (p.avgAst?.toFixed?.(1) ?? "--")}
                              {cat.key === "fgPct" && (p.fgPct != null ? `${(p.fgPct * 100).toFixed(1)}%` : "--")}
                              {cat.key === "tpPct" && (p.tpPct != null ? `${(p.tpPct * 100).toFixed(1)}%` : "--")}
                              {cat.key === "passYds" && (p.avgPass?.toFixed?.(1) ?? "--")}
                              {cat.key === "rushYds" && (p.avgRush?.toFixed?.(1) ?? "--")}
                              {cat.key === "recYds" && (p.avgRec?.toFixed?.(1) ?? "--")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  )
}
