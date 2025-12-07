"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { Calendar, Clock, ExternalLink, RefreshCw, Radio, X } from "lucide-react"
import { useLiveScores } from "@/hooks/use-live-scores"
import { ESPN_LEAGUES, type LeagueId, type LiveScoreGame } from "@/lib/live-scores"
import { useGameDetails } from "@/hooks/use-game-details"

type Bucket = "live" | "upcoming" | "completed"

const BUCKET_ORDER: Array<{ key: Bucket; title: string }> = [
  { key: "live", title: "Live Now" },
  { key: "upcoming", title: "Upcoming" },
  { key: "completed", title: "Recent Finals" },
]

const bucketGame = (game: LiveScoreGame): Bucket => game.bucket

const formatTime = (iso?: string) => {
  if (!iso) return ""
  try {
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

const formatStatus = (game: LiveScoreGame) => {
  if (game.bucket === "completed") return "Final"
  if (game.bucket === "live") {
    const clock = game.status?.displayClock
    const period = game.status?.period
    const parts = [clock, period ? `P${period}` : null].filter(Boolean) as string[]
    return parts.join(" - ") || "Live"
  }
  return formatTime(game.startTime)
}

const sanitizeText = (text?: string | null) =>
  text ? text.replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, "").trim() : ""

const getPreviewStatus = (game: LiveScoreGame, isChat: boolean) => {
  if (isChat) {
    if (game.bucket === "live") return "Live"
    if (game.bucket === "completed") return "Final"
    return formatTime(game.startTime)
  }
  return sanitizeText(formatStatus(game))
}

const LeagueFilter = ({
  value,
  onChange,
  inactiveClass,
}: {
  value: LeagueId[]
  onChange: (next: LeagueId[]) => void
  inactiveClass: string
}) => {
  const toggle = (id: LeagueId) => {
    const set = new Set(value)
    if (set.has(id)) {
      set.delete(id)
    } else {
      set.add(id)
    }
    onChange(Array.from(set))
  }

  return (
    <div className="flex flex-wrap gap-2">
      {ESPN_LEAGUES.map((league) => {
        const active = value.includes(league.id)
        return (
      <button
        key={league.id}
        onClick={() => toggle(league.id)}
        className={`px-3 py-1 rounded-full text-xs border transition-colors ${
          active
            ? "bg-[#34d399]/20 border-[#34d399] text-white"
            : inactiveClass
        }`}
      >
            {league.label}
          </button>
        )
      })}
    </div>
  )
}

const ArticleList = ({
  games,
  surfaceClass,
  borderClass,
}: { games: LiveScoreGame[]; surfaceClass: string; borderClass: string }) => {
  const articles = useMemo(() => {
    const collected: Array<{ title?: string; url?: string; published?: string; league?: string }> = []
    games.forEach((game) => {
      (game.articles || []).forEach((article) => {
        if (!article?.url || !article?.title) return
        collected.push({
          title: article.title,
          url: article.url,
          published: article.published,
          league: game.leagueLabel || game.league,
        })
      })
    })
    return collected
      .sort((a, b) => (b.published ? Date.parse(b.published) : 0) - (a.published ? Date.parse(a.published) : 0))
      .slice(0, 6)
  }, [games])

  if (!articles.length) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-white">
        <Radio className="w-4 h-4 text-emerald-400" />
        Latest Headlines
      </div>
      <div className="space-y-2">
        {articles.map((article, idx) => (
          <Link
            key={`${article.url}-${idx}`}
            href={article.url!}
            target="_blank"
            rel="noreferrer"
            className={`block group rounded-lg border ${borderClass} ${surfaceClass} hover:bg-white/5 transition-colors px-3 py-2`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-white group-hover:text-white/90">{article.title}</p>
              <ExternalLink className="w-4 h-4 text-white/40 group-hover:text-white/60 shrink-0" />
            </div>
            <div className="text-xs text-white/40 mt-1">
              {article.league ? `${article.league} ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ ` : ""}
              {article.published ? new Date(article.published).toLocaleString() : ""}
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

const GameCard = ({
  game,
  onSelect,
  surfaceClass,
  borderClass,
  isChat,
}: {
  game: LiveScoreGame
  onSelect: (g: LiveScoreGame) => void
  surfaceClass: string
  borderClass: string
  isChat: boolean
}) => {
  const home = game.competitors.find((c) => c.homeAway === "home")
  const away = game.competitors.find((c) => c.homeAway === "away")
  const statusLabel = getPreviewStatus(game, isChat)

  return (
    <button
      onClick={() => onSelect(game)}
      className={`w-full text-left rounded-xl border ${borderClass} ${surfaceClass} p-3 space-y-2 hover:border-[#34d399] hover:bg-white/5 transition-colors`}
    >
      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="uppercase tracking-wide">{game.leagueLabel}</span>
        <span className="flex items-center gap-1 text-white/60">
          <Clock className="w-3 h-3" />
          {statusLabel}
        </span>
      </div>
      <div className="space-y-2">
        {[away, home].map((team, idx) => {
          if (!team) return null
          return (
            <div key={team.id || idx} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-white">{team.shortName || team.name}</div>
                <div className="text-[11px] text-white/50">{team.record}</div>
              </div>
              <div className="text-base font-bold text-white">{Number.isFinite(team.score) ? team.score : "-"}</div>
            </div>
          )
        })}
      </div>
      {game.status?.detail && <div className="text-xs text-white/60">{sanitizeText(game.status.detail)}</div>}
    </button>
  )
}

export function LiveScoresPreview({ variant = "default" }: { variant?: "default" | "chat" }) {
  const [selectedLeagues, setSelectedLeagues] = useState<LeagueId[]>(["nba", "nfl"])
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10))
  const [selectedGame, setSelectedGame] = useState<LiveScoreGame | null>(null)
  const { data, loading, error, isRefreshing, refetch } = useLiveScores({ refreshInterval: 30000, date })
  const detailsState = useGameDetails({
    league: selectedGame?.league,
    eventId: selectedGame?.eventId,
    enabled: Boolean(selectedGame),
    refreshIntervalMs: 20000,
  })

  const filteredGames = useMemo(() => {
    if (!data?.games) return []
    return data.games.filter((g) => selectedLeagues.includes(g.league))
  }, [data, selectedLeagues])

  const bucketed = useMemo(() => {
    const buckets: Record<Bucket, LiveScoreGame[]> = { live: [], upcoming: [], completed: [] }
    filteredGames.forEach((g) => buckets[bucketGame(g)].push(g))
    return buckets
  }, [filteredGames])

  const closeDetails = () => setSelectedGame(null)

  const isChat = variant === "chat"
  const surface = isChat ? "bg-[#0f0f0f]" : "bg-[#4a4a4a]"
  const border = isChat ? "border-[#1f1f1f]" : "border-[#6b6b6b]"
  const cardClasses = `rounded-2xl border ${border} ${surface}`
  const inactiveChip = isChat
    ? "bg-[#0f0f0f] border-[#1f1f1f] text-white/80 hover:text-white"
    : "bg-[#4a4a4a] border-[#6b6b6b] text-white/70 hover:text-white"
  const dateInput = isChat ? "bg-[#0f0f0f] border-[#1f1f1f]" : "bg-[#3f3f3f] border-[#6b6b6b]"
  const modalSurface = isChat ? "border-[#1f1f1f] bg-[#0f0f0f]" : "border-[#6b6b6b] bg-[#3f3f3f]"
  const modalOverlay = isChat ? "bg-black/80" : "bg-[#2f2f2f]/80"

  return (
    <div className="h-full flex flex-col gap-3">
      <div className={`${cardClasses} p-4`}>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div>
            <div className="text-sm font-semibold text-white flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-400" />
              Live Scores Preview
            </div>
            <div className="text-xs text-white/50">Pick leagues to monitor at a glance</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              className={`p-2 rounded-lg border ${border} text-white/80 hover:text-white hover:bg-white/10 transition-colors`}
              aria-label="Refresh live scores"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </button>
            <Link
              href="/live-scores"
              className="px-3 py-2 rounded-lg bg-[#34d399] text-[#0f1f15] border border-[#34d399] text-xs font-semibold hover:bg-[#16a34a] transition-colors"
            >
              Full page
            </Link>
          </div>
        </div>

        <div className="space-y-3">
          <LeagueFilter value={selectedLeagues} onChange={setSelectedLeagues} inactiveClass={inactiveChip} />
          <div className="flex items-center gap-2 text-xs text-white/60">
            <Calendar className="w-4 h-4" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={`${dateInput} rounded-md px-2 py-1 text-white text-xs`}
            />
            {error && <span className="text-red-400 text-xs">{error}</span>}
            {loading && <span className="text-white/60 text-xs">LoadingÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</span>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto space-y-4">
        {filteredGames.length === 0 && !loading ? (
          <div className="text-white/70 text-sm border border-dashed border-[#1f1f1f] rounded-xl p-4 text-center">
            {selectedLeagues.length
              ? "No games for these leagues right now."
              : "Select at least one league to see live scores."}
          </div>
        ) : (
          BUCKET_ORDER.map(({ key, title }) => {
            const games = bucketed[key]
            if (!games?.length) return null
            return (
              <div key={key} className="space-y-2">
                <div className="text-xs font-semibold text-white/70 uppercase tracking-wide">{title}</div>
              <div className="grid grid-cols-1 gap-3">
                  {games.slice(0, 6).map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onSelect={setSelectedGame}
                      surfaceClass={surface}
                      borderClass={border}
                      isChat={isChat}
                    />
                  ))}
                </div>
              </div>
            )
          })
        )}

        <ArticleList games={filteredGames} surfaceClass={surface} borderClass={border} />
      </div>

      {selectedGame && (
        <div className={`fixed inset-0 z-50 flex items-end md:items-center justify-center ${modalOverlay} backdrop-blur-sm p-3`}>
          <div className={`w-full max-w-2xl rounded-2xl border ${modalSurface} shadow-2xl overflow-hidden`}>
            <div className={`flex items-center justify-between px-4 py-3 border-b ${isChat ? 'border-[#1f1f1f]' : 'border-[#6b6b6b]'}`}>
              <div>
                <div className="text-xs uppercase tracking-wide text-white/50">{selectedGame.leagueLabel}</div>
                <div className="text-sm text-white/80">{getPreviewStatus(selectedGame, isChat)}</div>
              </div>
              <button
                onClick={closeDetails}
                className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                aria-label="Close game details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-2">
                {[selectedGame.competitors.find((c) => c.homeAway === "away"), selectedGame.competitors.find((c) => c.homeAway === "home")].map((team, idx) => {
                  if (!team) return null
                  return (
                    <div key={team.id || idx} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-white">{team.shortName || team.name}</div>
                        <div className="text-[11px] text-white/50">{team.record}</div>
                      </div>
                      <div className="text-lg font-bold text-white">{Number.isFinite(team.score) ? team.score : "-"}</div>
                    </div>
                  )
                })}
              </div>

              {detailsState.loading && <div className="text-xs text-white/70">Loading statsÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦</div>}
              {detailsState.error && <div className="text-xs text-red-400">{detailsState.error}</div>}

              {detailsState.data && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {detailsState.data.teams.map((team) => (
                    <div key={team.id} className={`rounded-lg border ${border} ${surface} p-3 space-y-2`}>
                      <div className="flex items-center justify-between text-sm text-white/85">
                        <span className="font-semibold">{team.name}</span>
                        {Number.isFinite(team.score) && <span className="text-white">{team.score}</span>}
                      </div>
                      {team.linescore?.length ? (
                        <div className="flex flex-wrap gap-2 text-xs text-white/70">
                          {team.linescore.map((entry, idx) => (
                            <div key={`${entry.label}-${idx}`} className={`rounded px-2 py-1 border ${border} ${surface}`}>
                              {entry.label}: <span className="text-white/90">{entry.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {team.statistics?.length ? (
                        <div className="grid grid-cols-2 gap-2 text-xs text-white/70">
                          {team.statistics.slice(0, 6).map((stat, idx) => (
                            <div key={`${stat.label}-${idx}`} className="flex justify-between">
                              <span>{stat.label}</span>
                              <span className="text-white/90">{stat.value}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}






