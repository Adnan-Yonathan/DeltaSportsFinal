"use client"

import { useMemo, useState } from "react"
import { TeamStatsCard } from "@/components/ui/team-stats-card"
import { PlayerStatsCard } from "@/components/ui/player-stats-card"

type Mode = "team" | "player" | "injuries"

type TeamStats = {
  team: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string | null>
  season?: string
  sport?: string
}

type PlayerStats = {
  name: string
  team: string
  position?: string
  season?: string
  headshot?: string
  sport?: string
  stats: Record<string, number | string>
  recent?: Array<{
    date: string
    opponent?: string
    result?: string
    stats: Record<string, number | string>
  }>
}

type InjuryReport = {
  player: string
  team: string
  status: string
  injury?: string
  date?: string
}

type TeamRecentEntry = {
  game_date: string
  opponent: string
  is_home: boolean
  result?: string | null
  points_for?: number | null
  points_against?: number | null
  pace?: number | null
  offensive_rating?: number | null
  defensive_rating?: number | null
  net_rating?: number | null
}

const SPORT_OPTIONS = [
  { value: "nba", label: "NBA" },
  { value: "nfl", label: "NFL" },
  { value: "mlb", label: "MLB" },
  { value: "ncaab", label: "NCAAB" },
  { value: "ncaaf", label: "CFB" },
]

const MODES: Array<{ value: Mode; label: string; help: string }> = [
  { value: "team", label: "Teams", help: "Team stats, standings, and efficiency" },
  { value: "player", label: "Players", help: "Season stats and recent form" },
  { value: "injuries", label: "Injuries", help: "Latest injury status by team" },
]

const SPORT_KEY_MAP: Record<string, string> = {
  nba: "basketball_nba",
  nfl: "americanfootball_nfl",
  mlb: "baseball_mlb",
  ncaab: "basketball_ncaab",
  ncaaf: "americanfootball_ncaaf",
}

const SEASON_OVERRIDES: Record<
  string,
  { season: number; seasonType?: number; seasonLabel?: string }
> = {
  nba: { season: 2026, seasonLabel: "2025-26" },
  ncaab: { season: 2026, seasonLabel: "2025-26" },
  nfl: { season: 2025, seasonType: 3 },
  ncaaf: { season: 2025, seasonType: 2 },
  mlb: { season: 2025 },
}

const requestJson = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

const buildParams = (params: Record<string, string | undefined>) => {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value) search.set(key, value)
  })
  return search.toString()
}

export default function StatsCenterClient() {
  const [sport, setSport] = useState("nba")
  const [mode, setMode] = useState<Mode>("team")
  const [teamQuery, setTeamQuery] = useState("")
  const [playerQuery, setPlayerQuery] = useState("")
  const [teamResults, setTeamResults] = useState<TeamStats[]>([])
  const [playerResult, setPlayerResult] = useState<PlayerStats | null>(null)
  const [playerFallback, setPlayerFallback] = useState<Record<string, unknown> | null>(null)
  const [injuries, setInjuries] = useState<InjuryReport[]>([])
  const [teamRecent, setTeamRecent] = useState<Record<string, TeamRecentEntry[]>>({})
  const [teamRecentOpen, setTeamRecentOpen] = useState<Record<string, boolean>>({})
  const [teamRecentLoading, setTeamRecentLoading] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const modeHelp = useMemo(
    () => MODES.find((entry) => entry.value === mode)?.help ?? "",
    [mode]
  )

  const onLoadTeams = async () => {
    setLoading(true)
    setError(null)
    setTeamResults([])
    setPlayerResult(null)
    setPlayerFallback(null)
    setTeamRecent({})
    setTeamRecentOpen({})
    setTeamRecentLoading({})
    try {
      const seasonOverride = SEASON_OVERRIDES[sport]
      const sportKey = SPORT_KEY_MAP[sport] || sport
      const params = buildParams({
        type: "team",
        sport: sportKey,
        team: teamQuery.trim() || undefined,
        season: seasonOverride?.season?.toString(),
        seasonType: seasonOverride?.seasonType?.toString(),
        seasonLabel: seasonOverride?.seasonLabel,
      })
      const data = await requestJson<TeamStats[]>(`/api/stats?${params}`)
      setTeamResults(Array.isArray(data) ? data : [])
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("No teams returned for that query.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load team stats.")
    } finally {
      setLoading(false)
    }
  }

  const onLoadPlayer = async () => {
    setLoading(true)
    setError(null)
    setPlayerResult(null)
    setPlayerFallback(null)
    try {
      const seasonOverride = SEASON_OVERRIDES[sport]
      const sportKey = SPORT_KEY_MAP[sport] || sport
      const params = buildParams({
        type: "player-season",
        sport: sportKey,
        player: playerQuery.trim(),
        season: seasonOverride?.season?.toString(),
        seasonType: seasonOverride?.seasonType?.toString(),
        seasonLabel: seasonOverride?.seasonLabel,
      })
      const data = await requestJson<PlayerStats>(`/api/stats?${params}`)
      setPlayerResult(data)
    } catch (err) {
      try {
        const seasonOverride = SEASON_OVERRIDES[sport]
        const sportKey = SPORT_KEY_MAP[sport] || sport
        const params = buildParams({
          type: "player",
          sport: sportKey,
          player: playerQuery.trim(),
          season: seasonOverride?.season?.toString(),
          seasonType: seasonOverride?.seasonType?.toString(),
          seasonLabel: seasonOverride?.seasonLabel,
        })
        const data = await requestJson<Record<string, unknown>>(`/api/stats?${params}`)
        setPlayerFallback(data)
        setError("Season stats not found. Showing roster match instead.")
      } catch (fallbackErr) {
        setError(
          fallbackErr instanceof Error
            ? fallbackErr.message
            : "Failed to load player stats."
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const onLoadInjuries = async () => {
    setLoading(true)
    setError(null)
    setInjuries([])
    try {
      const sportKey = SPORT_KEY_MAP[sport] || sport
      const params = buildParams({
        type: "injuries",
        sport: sportKey,
      })
      const data = await requestJson<InjuryReport[]>(`/api/stats?${params}`)
      setInjuries(Array.isArray(data) ? data : [])
      if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("No injuries returned for that sport.")
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load injuries.")
    } finally {
      setLoading(false)
    }
  }

  const toggleTeamRecent = async (teamName: string) => {
    const key = teamName.toLowerCase()
    const isOpen = teamRecentOpen[key]
    if (isOpen) {
      setTeamRecentOpen((prev) => ({ ...prev, [key]: false }))
      return
    }
    if (teamRecent[key]) {
      setTeamRecentOpen((prev) => ({ ...prev, [key]: true }))
      return
    }
    setTeamRecentLoading((prev) => ({ ...prev, [key]: true }))
    setTeamRecentOpen((prev) => ({ ...prev, [key]: true }))
    try {
      const sportKey = SPORT_KEY_MAP[sport] || sport
      const params = buildParams({
        type: "recent_form",
        sport: sportKey,
        team: teamName,
      })
      const data = await requestJson<TeamRecentEntry[]>(`/api/stats?${params}`)
      setTeamRecent((prev) => ({ ...prev, [key]: Array.isArray(data) ? data : [] }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load recent games.")
    } finally {
      setTeamRecentLoading((prev) => ({ ...prev, [key]: false }))
    }
  }

  const displayedTeams = teamResults.length > 24 ? teamResults.slice(0, 24) : teamResults

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">
              Controls
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Pick a sport, then search
            </h2>
            <p className="mt-1 text-sm text-white/60">{modeHelp}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {SPORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setSport(option.value)}
                className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                  sport === option.value
                    ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                    : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {MODES.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setMode(entry.value)}
              className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.2em] transition-colors ${
                mode === entry.value
                  ? "border-white/30 bg-white/10 text-white"
                  : "border-white/10 text-white/50 hover:border-white/30 hover:text-white"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {mode === "team" && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                Team search (optional)
              </label>
              <input
                value={teamQuery}
                onChange={(event) => setTeamQuery(event.target.value)}
                placeholder="e.g. Lakers or OKC"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
              />
              <p className="mt-2 text-[11px] text-white/40">
                Leave blank to return the league table (may be large for college).
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadTeams}
              className="rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
            >
              Load teams
            </button>
          </div>
        )}

        {mode === "player" && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="text-xs uppercase tracking-[0.2em] text-white/40">
                Player name
              </label>
              <input
                value={playerQuery}
                onChange={(event) => setPlayerQuery(event.target.value)}
                placeholder="e.g. Nikola Jokic"
                className="mt-2 w-full rounded-xl border border-white/10 bg-black/50 px-4 py-2 text-sm text-white outline-none focus:border-emerald-400/50"
              />
              <p className="mt-2 text-[11px] text-white/40">
                Pulls season stats and recent games when available.
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadPlayer}
              disabled={!playerQuery.trim()}
              className="rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Load player
            </button>
          </div>
        )}

        {mode === "injuries" && (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                Latest injury feed
              </p>
              <p className="mt-2 text-[11px] text-white/40">
                Pulls the most recent injury status cache per sport.
              </p>
            </div>
            <button
              type="button"
              onClick={onLoadInjuries}
              className="rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
            >
              Load injuries
            </button>
          </div>
        )}
      </section>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/70">
          Loading stats...
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-white/70">
          {error}
        </div>
      )}

      {mode === "team" && displayedTeams.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Team results
              </p>
              <p className="text-sm text-white/60">
                Showing {displayedTeams.length} of {teamResults.length} results.
              </p>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {displayedTeams.map((team) => {
              const key = team.team.toLowerCase()
              const isOpen = Boolean(teamRecentOpen[key])
              const recentEntries = teamRecent[key] || []
              const isLoading = Boolean(teamRecentLoading[key])
              return (
                <div key={`${team.team}-${team.season ?? ""}`} className="space-y-3">
                  <TeamStatsCard
                    team={team.team}
                    sport={team.sport ?? sport}
                    wins={team.wins ?? 0}
                    losses={team.losses ?? 0}
                    winPct={team.winPct ?? 0}
                    stats={team.stats ?? {}}
                  />
                  <button
                    type="button"
                    onClick={() => toggleTeamRecent(team.team)}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-white/80 transition-colors hover:border-emerald-500/30"
                  >
                    <span>Recent games</span>
                    <span className="text-emerald-300 font-semibold text-[11px]">
                      {isLoading ? "Loading..." : isOpen ? "Hide" : "Show"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="space-y-2">
                      {isLoading ? (
                        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-white/70">
                          Loading recent games...
                        </div>
                      ) : recentEntries.length === 0 ? (
                        <div className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-white/70">
                          Recent game logs not available for this team.
                        </div>
                      ) : (
                        recentEntries.map((entry, idx) => (
                          <div
                            key={`${entry.game_date}-${idx}`}
                            className="rounded-lg bg-white/5 border border-white/10 p-3 text-xs text-white/80"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-semibold">{entry.game_date}</span>
                              <span className="text-white/60">
                                {entry.is_home ? "vs" : "@"} {entry.opponent}
                              </span>
                            </div>
                            {entry.result && (
                              <div className="text-white/60 mb-1">{entry.result}</div>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {entry.points_for != null && entry.points_against != null && (
                                <div className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[11px]">
                                  <span className="font-semibold">PTS</span>{" "}
                                  <span className="text-white/70">
                                    {entry.points_for}-{entry.points_against}
                                  </span>
                                </div>
                              )}
                              {entry.pace != null && (
                                <div className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[11px]">
                                  <span className="font-semibold">Pace</span>{" "}
                                  <span className="text-white/70">
                                    {entry.pace.toFixed(1)}
                                  </span>
                                </div>
                              )}
                              {entry.offensive_rating != null && (
                                <div className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[11px]">
                                  <span className="font-semibold">ORtg</span>{" "}
                                  <span className="text-white/70">
                                    {entry.offensive_rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                              {entry.defensive_rating != null && (
                                <div className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[11px]">
                                  <span className="font-semibold">DRtg</span>{" "}
                                  <span className="text-white/70">
                                    {entry.defensive_rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                              {entry.net_rating != null && (
                                <div className="px-2 py-1 rounded bg-white/10 border border-white/10 text-[11px]">
                                  <span className="font-semibold">Net</span>{" "}
                                  <span className="text-white/70">
                                    {entry.net_rating.toFixed(1)}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {mode === "player" && playerResult && (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Player results
          </p>
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            <PlayerStatsCard
              name={playerResult.name}
              team={playerResult.team}
              position={playerResult.position}
              sport={playerResult.sport ?? sport}
              season={playerResult.season}
              headshot={playerResult.headshot}
              stats={playerResult.stats ?? {}}
              recent={playerResult.recent}
            />
          </div>
        </section>
      )}

      {mode === "player" && !playerResult && playerFallback && (
        <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Player match
          </p>
          <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-white/70">
            {JSON.stringify(playerFallback, null, 2)}
          </pre>
        </section>
      )}

      {mode === "injuries" && injuries.length > 0 && (
        <section className="space-y-4">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Injury report
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {injuries.map((entry, index) => (
              <div
                key={`${entry.player}-${entry.team}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {entry.player}
                </p>
                <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                  {entry.team}
                </p>
                <div className="mt-2 text-xs text-white/60 space-y-1">
                  <p>Status: {entry.status}</p>
                  {entry.injury ? <p>Injury: {entry.injury}</p> : null}
                  {entry.date ? <p>Date: {entry.date}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
