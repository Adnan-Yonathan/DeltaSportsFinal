"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import clsx from "clsx"
import { ArrowLeft, Calendar, ChevronLeft, ChevronRight, RefreshCw, X } from "lucide-react"
import { useLiveScores } from "@/hooks/use-live-scores"
import { useGameDetails } from "@/hooks/use-game-details"
import { ESPN_LEAGUES, type LeagueId, type LiveScoreGame, type LiveScoreGameDetails } from "@/lib/live-scores"

const LEAGUE_TABS: Array<{ id: LeagueId; label: string }> =
  ESPN_LEAGUES.map((league) => ({ id: league.id, label: league.label }))

const CONFERENCE_FILTERS: Partial<Record<LeagueId, Array<{ value: string; label: string }>>> = {
  ncaab: [
    { value: "ACC", label: "ACC" },
    { value: "B12", label: "Big 12" },
    { value: "B10", label: "Big Ten" },
    { value: "SEC", label: "SEC" },
    { value: "PAC", label: "Pac-12" },
    { value: "BE", label: "Big East" },
    { value: "MW", label: "Mountain West" },
    { value: "WCC", label: "WCC" },
    { value: "A10", label: "A-10" },
  ],
  cfb: [
    { value: "ACC", label: "ACC" },
    { value: "SEC", label: "SEC" },
    { value: "B12", label: "Big 12" },
    { value: "B1G", label: "Big Ten" },
    { value: "PAC", label: "Pac-12" },
    { value: "AAC", label: "AAC" },
    { value: "MW", label: "MWC" },
    { value: "SBC", label: "Sun Belt" },
    { value: "MAC", label: "MAC" },
  ],
}

const BUCKET_ORDER: Array<{ key: LiveScoreGame["bucket"]; title: string }> = [
  { key: "live", title: "Live Now" },
  { key: "upcoming", title: "Upcoming Games" },
  { key: "completed", title: "Recent Finals" },
]

const todayYMD = () => new Date().toISOString().slice(0, 10)

function formatStartTime(dateString: string) {
  try {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(date)
  } catch {
    return ""
  }
}

function formatDisplayDate(dateString: string | undefined) {
  if (!dateString) return ""
  try {
    const date = new Date(`${dateString}T00:00:00Z`)
    return new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }).format(date)
  } catch {
    return dateString
  }
}

function adjustDate(date: string, delta: number) {
  const parsed = new Date(`${date}T00:00:00`)
  parsed.setDate(parsed.getDate() + delta)
  return parsed.toISOString().slice(0, 10)
}

const groupByLeague = (games: LiveScoreGame[]) => {
  const map = new Map<string, LiveScoreGame[]>()
  games.forEach((game) => {
    const key = game.leagueLabel ?? game.league
    const bucket = map.get(key) ?? []
    bucket.push(game)
    map.set(key, bucket)
  })
  return Array.from(map.entries())
}

export default function LiveScoresPage() {
  const [activeLeague, setActiveLeague] = useState<(typeof LEAGUE_TABS)[number]["id"]>(LEAGUE_TABS[0]?.id)
  const [selectedDate, setSelectedDate] = useState<string>(todayYMD())
  const [selectedGame, setSelectedGame] = useState<LiveScoreGame | null>(null)
  const [conference, setConference] = useState<string>("")
  const { data, loading, error, lastUpdated, refetch, isRefreshing } = useLiveScores({
    refreshInterval: 20000,
    date: selectedDate,
  })
  const detailsState = useGameDetails({
    league: selectedGame?.league,
    eventId: selectedGame?.eventId,
    enabled: Boolean(selectedGame),
  })

  const filteredGames = useMemo(() => {
    if (!data?.games) return []
    const leagueFiltered = data.games.filter((game) => game.league === activeLeague)

    if (!conference || !(activeLeague in CONFERENCE_FILTERS)) {
      return leagueFiltered
    }

    const target = conference.toLowerCase()
    return leagueFiltered.filter((game) =>
      game.competitors?.some((team) => {
        const conf = String(team.conferenceAbbr || team.conferenceName || "").toLowerCase()
        return conf === target || conf.includes(target)
      })
    )
  }, [data, activeLeague, conference])

  // Reset conference filter when league changes
  useEffect(() => {
    setConference("")
  }, [activeLeague])

  const bucketed = useMemo(() => {
    return filteredGames.reduce(
      (acc, game) => {
        acc[game.bucket].push(game)
        return acc
      },
      {
        upcoming: [] as LiveScoreGame[],
        live: [] as LiveScoreGame[],
        completed: [] as LiveScoreGame[],
      }
    )
  }, [filteredGames])

  const selectedDateLabel = formatDisplayDate(data?.requestedDate ?? selectedDate)
  const completedDateLabel = formatDisplayDate(data?.previousDate)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:text-white hover:border-white/40 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Home
              </Link>
              <Link
                href="/chat"
                className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:text-white hover:border-white/40 transition-colors"
              >
                Back to Chat
              </Link>
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-white/40">Live Center</p>
                <h1 className="text-3xl font-bold">Real-time Scores</h1>
              </div>
            </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 bg-white/5">
              <button
                onClick={() => setSelectedDate((prev) => adjustDate(prev, -1))}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label="Previous day"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-white/60" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(event) => setSelectedDate(event.target.value || todayYMD())}
                  className="bg-transparent outline-none text-white text-sm"
                />
              </div>
              <button
                onClick={() => setSelectedDate((prev) => adjustDate(prev, 1))}
                className="p-1 rounded-full hover:bg-white/10"
                aria-label="Next day"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/80 hover:text-white hover:border-white/40 transition-colors"
            >
              <RefreshCw className={clsx("h-4 w-4", { "animate-spin": isRefreshing })} />
              Refresh
            </button>
            <div className="text-right">
              <p className="text-xs text-white/50">Updated</p>
              <p className="text-sm font-medium text-white">{lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : "—"}</p>
            </div>
          </div>
        </header>

        <div className="flex flex-wrap gap-2">
          {LEAGUE_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveLeague(tab.id)}
              className={clsx(
                "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors border",
                activeLeague === tab.id
                  ? "bg-white text-black border-white"
                  : "border-white/10 text-white/70 hover:border-white/40 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
          {CONFERENCE_FILTERS[activeLeague] && (
            <select
              value={conference}
              onChange={(event) => setConference(event.target.value)}
              className="rounded-full border border-white/20 bg-black px-3 py-2 text-sm text-white hover:border-white/50 focus:outline-none focus:ring-2 focus:ring-white/70"
            >
              <option value="">All Conferences</option>
              {CONFERENCE_FILTERS[activeLeague]?.map((conf) => (
                <option key={`${activeLeague}-${conf.value}`} value={conf.value}>
                  {conf.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">Loading live scores...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200">{error}</div>
        ) : filteredGames.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-white/60">No games found for this selection.</div>
        ) : (
          BUCKET_ORDER.map((section) => {
            const games = bucketed[section.key]
            const description =
              section.key === "completed"
                ? `Yesterday - ${completedDateLabel || "No finals"}`
                : `For ${selectedDateLabel || "selected date"}`

            if (games.length === 0) {
              return (
                <section key={section.key} className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                      <p className="text-xs text-white/50">{description}</p>
                    </div>
                    <span className="text-xs text-white/40 uppercase tracking-[0.3em]">0 games</span>
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-white/60 text-sm">
                    No {section.key === "completed" ? "final results" : section.key} for this selection.
                  </div>
                </section>
              )
            }

            const grouped = groupByLeague(games)

            return (
              <section key={section.key} className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
                    <p className="text-xs text-white/50">{description}</p>
                  </div>
                  <span className="text-xs text-white/40 uppercase tracking-[0.3em]">{games.length} games</span>
                </div>
                {grouped.map(([leagueName, leagueGames]) => (
                  <div key={`${section.key}-${leagueName}`} className="space-y-4 pt-2">
                    <div className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">{leagueName}</div>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {leagueGames.map((game) => (
                        <article
                          key={`${section.key}-${game.id}`}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedGame(game)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setSelectedGame(game)
                            }
                          }}
                          className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-3 shadow-md shadow-black/30 transition ring-offset-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 cursor-pointer"
                        >
                          <div className="flex items-center justify-between text-[11px] text-white/60">
                            <span className="uppercase tracking-[0.3em]">{game.leagueLabel}</span>
                            <span>
                              {game.bucket === "upcoming"
                                ? formatStartTime(game.startTime)
                                : game.status?.shortDetail ??
                                  game.status?.detail ??
                                  (game.bucket === "completed" ? "Final" : "Live")}
                            </span>
                          </div>

                          <div className="mt-3 space-y-3">
                            {[...game.competitors].sort((a, b) => (a.homeAway === "home" ? 1 : -1)).map((team) => (
                              <div key={team.id} className="flex items-center gap-2.5">
                                <div className="relative h-9 w-9 overflow-hidden rounded-lg border border-white/10 bg-white/5">
                                  {team.logo ? (
                                    <Image src={team.logo} alt={team.shortName} fill sizes="36px" className="object-contain p-1" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
                                      {team.abbreviation}
                                    </div>
                                  )}
                                </div>
                                <div className="flex flex-1 items-center justify-between">
                                  <div>
                                    <p className="text-sm font-semibold leading-tight">{team.name}</p>
                                    <p className="text-[11px] text-white/50">
                                      {team.record ?? (team.homeAway === "home" ? "Home" : "Away")}
                                    </p>
                                  </div>
                                  <p className="text-xl font-bold tabular-nums">{team.score}</p>
                                </div>
                              </div>
                            ))}
                          </div>

                          {game.situation?.description && (
                            <p className="mt-3 text-[11px] text-white/60">{game.situation.description}</p>
                          )}

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            {game.status?.detail && <span>{game.status.detail}</span>}
                            {game.broadcast && <span>- {game.broadcast}</span>}
                            {game.odds && <span>- {game.odds}</span>}
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            )
          })
        )}
      </div>
      {selectedGame && (
        <GameDetailsModal game={selectedGame} onClose={() => setSelectedGame(null)} detailsState={detailsState} />
      )}
    </div>
  )
}

interface GameDetailsModalProps {
  game: LiveScoreGame
  onClose: () => void
  detailsState: {
    data: LiveScoreGameDetails | null
    loading: boolean
    error: string | null
    refetch: () => void
  }
}

function GameDetailsModal({ game, onClose, detailsState }: GameDetailsModalProps) {
  const { data, loading, error, refetch } = detailsState
  const [playerDetail, setPlayerDetail] = useState<{ team: string; playerId: string } | null>(null)
  const lineColumns = useMemo(() => {
    if (!data?.teams?.length) return [] as string[]
    return data.teams.reduce((labels: string[], team) => {
      if (team.linescore.length > labels.length) {
        return team.linescore.map((entry, index) => entry.label || `P${index + 1}`)
      }
      return labels
    }, [])
  }, [data])

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0c0c12] p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">{game.leagueLabel}</p>
            <h3 className="text-2xl font-bold text-white">{game.shortName}</h3>
            <p className="text-sm text-white/60">{data?.statusText || "Details"}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 p-2 text-white/60 hover:text-white hover:border-white/40 transition"
            aria-label="Close box score"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 space-y-6">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">Loading box score…</div>
          ) : error ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-sm text-red-200 space-y-3">
              <p>{error}</p>
              <button
                onClick={refetch}
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.3em] text-white/80 hover:border-white/50"
              >
                Retry
              </button>
            </div>
          ) : data?.teams?.length ? (
            <>
              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Line Score</h4>
                  <span className="text-xs text-white/50">{data.venue || ""}</span>
                </div>
                {lineColumns.length ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="text-white/60">
                        <tr>
                          <th className="text-left font-medium">Team</th>
                          {lineColumns.map((label) => (
                            <th key={label} className="px-2 text-center font-medium">
                              {label}
                            </th>
                          ))}
                          <th className="px-2 text-center font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.teams.map((team) => (
                          <tr key={`line-${team.id}`} className="border-t border-white/5">
                            <td className="py-2 pr-2 text-left font-semibold text-white">
                              {team.abbreviation ?? team.name}
                            </td>
                            {lineColumns.map((label, index) => (
                              <td key={`${team.id}-${label}`} className="px-2 py-2 text-center text-white/80">
                                {team.linescore[index]?.value ?? "—"}
                              </td>
                            ))}
                            <td className="px-2 py-2 text-center text-lg font-bold text-white">{team.score}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-white/60">Line score data is not available yet.</p>
                )}
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                {data.teams.map((team) => (
                  <div key={`stats-${team.id}`} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.03] p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        {team.logo ? (
                          <Image src={team.logo} alt={team.name} fill sizes="40px" className="object-contain p-2" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-xs text-white/60">{team.abbreviation}</div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{team.name}</p>
                        <p className="text-xs text-white/50 capitalize">{team.homeAway}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      {team.statistics.slice(0, 10).map((stat) => (
                        <div key={`${team.id}-${stat.label}`} className="rounded-xl border border-white/5 bg-black/20 px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{stat.label}</p>
                          <p className="text-base font-semibold text-white">{stat.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h4 className="text-sm font-semibold uppercase tracking-[0.3em] text-white/70">Lineups & Bench</h4>
                  <span className="text-xs text-white/50">Based on most recent box score</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {data.teams.map((team) => (
                    <div key={`lineups-${team.id}`} className="space-y-3">
                      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-white/60">{team.name}</p>
                      <div className="space-y-2">
                        {team.starters.length ? (
                          team.starters.map((player) => (
                            <button
                              key={`${team.id}-starter-${player.id}`}
                              onClick={() =>
                                setPlayerDetail((prev) =>
                                  prev && prev.playerId === player.id ? null : { team: team.id, playerId: player.id }
                                )
                              }
                              className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-black/30 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                            >
                              <div className="relative h-10 w-10 overflow-hidden rounded-full bg-white/10">
                                {player.headshot ? (
                                  <Image src={player.headshot} alt={player.name} fill sizes="40px" className="object-cover" />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-xs text-white/70">
                                    {player.position || player.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-white">
                                  {player.name} <span className="text-xs text-white/50">{player.position}</span>
                                </p>
                                <p className="text-xs text-white/60">{player.summaryLine ?? "Starter"}</p>
                              </div>
                            </button>
                          ))
                        ) : (
                          <p className="text-xs text-white/50">Lineup data unavailable.</p>
                        )}
                      </div>
                      <div className="pt-2">
                        <p className="text-[11px] uppercase tracking-[0.3em] text-white/50 mb-2">Bench</p>
                        <div className="space-y-2">
                          {team.bench.length ? (
                            team.bench.map((player) => (
                              <button
                                key={`${team.id}-bench-${player.id}`}
                                onClick={() =>
                                  setPlayerDetail((prev) =>
                                    prev && prev.playerId === player.id ? null : { team: team.id, playerId: player.id }
                                  )
                                }
                                className="flex w-full items-center gap-3 rounded-2xl border border-white/5 bg-black/40 px-3 py-2 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                              >
                                <div className="relative h-8 w-8 overflow-hidden rounded-full bg-white/10">
                                  {player.headshot ? (
                                    <Image src={player.headshot} alt={player.name} fill sizes="32px" className="object-cover" />
                                  ) : (
                                    <div className="flex h-full w-full items-center justify-center text-[11px] text-white/70">
                                      {player.position || player.name.charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="text-xs font-semibold text-white">
                                    {player.name} <span className="text-[11px] text-white/50">{player.position}</span>
                                  </p>
                                  <p className="text-[11px] text-white/60">{player.summaryLine ?? "Bench"}</p>
                                </div>
                              </button>
                            ))
                          ) : (
                            <p className="text-xs text-white/50">Bench stats unavailable.</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/60">No box score data available yet.</div>
          )}
          {playerDetail && data?.teams && (
            <PlayerDetailDrawer
              team={data.teams.find((team) => team.id === playerDetail.team)}
              playerId={playerDetail.playerId}
              onClose={() => setPlayerDetail(null)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

interface PlayerDetailDrawerProps {
  team?: LiveScoreGameDetails["teams"][number]
  playerId: string
  onClose: () => void
}

function PlayerDetailDrawer({ team, playerId, onClose }: PlayerDetailDrawerProps) {
  if (!team) return null
  const player = [...team.starters, ...team.bench].find((athlete) => athlete.id === playerId)
  if (!player) return null

  const statsEntries = player.statMap ? Object.entries(player.statMap) : []

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-[#10101a] p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="relative h-12 w-12 overflow-hidden rounded-full bg-white/10">
              {player.headshot ? (
                <Image src={player.headshot} alt={player.name} fill sizes="48px" className="object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm text-white/60">
                  {player.position || player.name.charAt(0)}
                </div>
              )}
            </div>
            <div>
              <p className="text-lg font-semibold text-white">{player.name}</p>
              <p className="text-xs text-white/60">
                {team.name} - {player.position || "Player"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/20 p-2 text-white/60 hover:text-white hover:border-white/50"
            aria-label="Close player stats"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {statsEntries.length ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            {statsEntries.map(([label, value]) => (
              <div key={`${playerId}-${label}`} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">{label}</p>
                <p className="text-base font-semibold text-white">{value}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-white/60">No detailed stats recorded for this player.</p>
        )}
      </div>
    </div>
  )
}
