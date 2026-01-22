"use client"

import { useEffect, useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useLiveScores } from "@/hooks/use-live-scores"
import type { LiveScoreGame } from "@/lib/live-scores"
import { useAnimatedText } from "@/components/ui/animated-text"
import TutorialPopup from "@/components/TutorialPopup"
import { calculateSpreadFromWinProb } from "@/lib/utils/win-probability-spread"

type WinProbabilityEntry = {
  home: number
  away: number
  updatedAt?: string
}

const WIN_PROB_REFRESH_MS = 15000
const NBA_TOTAL_MINUTES = 48
const NBA_PERIOD_MINUTES = 12

const formatStartTime = (iso?: string) => {
  if (!iso) return "TBD"
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
    return [clock, period ? `Q${period}` : null].filter(Boolean).join(" ") || "Live"
  }
  return formatStartTime(game.startTime)
}

const parseClockMinutes = (clock?: string) => {
  if (!clock) return null
  const parts = clock.split(":")
  if (parts.length < 1) return null
  const minutes = Number(parts[0])
  const seconds = parts.length > 1 ? Number(parts[1]) : 0
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return Math.max(0, minutes) + Math.max(0, seconds) / 60
}

const getMinutesRemaining = (game: LiveScoreGame) => {
  if (game.bucket !== "live") return null
  const period = game.status?.period
  const clockMinutes = parseClockMinutes(game.status?.displayClock)
  if (!period || clockMinutes == null) return null
  const periodsLeft = Math.max(0, 4 - period)
  return clockMinutes + periodsLeft * NBA_PERIOD_MINUTES
}

const formatSpreadLine = (margin: number, homeLabel: string, awayLabel: string) => {
  if (!Number.isFinite(margin)) return "n/a"
  if (Math.abs(margin) < 0.05) return "Pick'em"
  const favoredTeam = margin > 0 ? homeLabel : awayLabel
  return `${favoredTeam} -${Math.abs(margin).toFixed(1)}`
}

const formatSpreadRange = (
  lower: number,
  upper: number,
  homeLabel: string,
  awayLabel: string
) => {
  if (!Number.isFinite(lower) || !Number.isFinite(upper)) return "n/a"
  if (lower <= 0 && upper >= 0) return "Range crosses pick'em"
  const favoredTeam = upper < 0 ? awayLabel : homeLabel
  const low = Math.min(Math.abs(lower), Math.abs(upper)).toFixed(1)
  const high = Math.max(Math.abs(lower), Math.abs(upper)).toFixed(1)
  return `${favoredTeam} -${low} to -${high}`
}

const AnimatedScore = ({ value }: { value: string }) => {
  const animated = useAnimatedText(value, "*")
  return <span>{animated.replace(/\*/g, " - ")}</span>
}

const WinProbabilityMeter = ({
  homeLabel,
  awayLabel,
  winProbHome,
}: {
  homeLabel: string
  awayLabel: string
  winProbHome: number
}) => {
  const clamped = Math.max(0, Math.min(1, winProbHome))
  const homePct = Math.round(clamped * 100)
  const awayPct = 100 - homePct

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs text-white/60">
        <span>
          {awayLabel} {awayPct}%
        </span>
        <span>
          {homeLabel} {homePct}%
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className="absolute inset-y-0 left-0 bg-rose-400/70"
          style={{ width: `${awayPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 bg-emerald-400/70"
          style={{ width: `${homePct}%` }}
        />
      </div>
      <div className="text-[9px] uppercase tracking-[0.2em] text-white/40">
        ESPN win probability
      </div>
    </div>
  )
}

export default function LiveProjectionsClient() {
  const { data, loading, error, isRefreshing, lastUpdated, refetch } = useLiveScores({
    refreshInterval: 10000,
  })
  const [winProbabilities, setWinProbabilities] = useState<
    Record<string, WinProbabilityEntry>
  >({})
  const [winProbError, setWinProbError] = useState<string | null>(null)

  const games = useMemo(
    () =>
      (data?.games || []).filter(
        (game) => game.league === "nba" && game.bucket !== "completed"
      ),
    [data]
  )

  const liveEventIds = useMemo(
    () => games.filter((game) => game.bucket === "live").map((game) => game.eventId),
    [games]
  )
  const liveEventKey = useMemo(() => liveEventIds.join(","), [liveEventIds])

  useEffect(() => {
    let active = true
    const fetchWinProbabilities = async () => {
      if (!liveEventKey) {
        if (active) {
          setWinProbabilities({})
          setWinProbError(null)
        }
        return
      }

      try {
        const url = new URL("/api/live-projections/win-probabilities", window.location.origin)
        url.searchParams.set("league", "nba")
        url.searchParams.set("eventIds", liveEventKey)
        const response = await fetch(url.toString(), { cache: "no-store" })
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}))
          throw new Error(payload?.error || "Unable to load win probability.")
        }
        const payload = (await response.json()) as {
          data?: Record<string, WinProbabilityEntry>
        }
        if (active) {
          setWinProbabilities(payload?.data || {})
          setWinProbError(null)
        }
      } catch (err) {
        if (active) {
          setWinProbError(
            err instanceof Error ? err.message : "Unable to load win probability."
          )
        }
      }
    }

    fetchWinProbabilities()
    const interval = window.setInterval(fetchWinProbabilities, WIN_PROB_REFRESH_MS)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [liveEventKey, lastUpdated])

  return (
    <>
      <TutorialPopup tutorialId="live-projections" />
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">
              NBA Live Projections
            </p>
            <p className="text-sm text-white/70">
              ESPN win probability drives a live spread range with confidence bands.
            </p>
          </div>
          <button
            onClick={refetch}
            className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.2em] text-white/70 hover:border-white/30 hover:text-white transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-white/70">
            Loading NBA slate...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/40 bg-rose-500/10 p-6 text-sm text-rose-100">
            {error}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10">
            <div className="grid grid-cols-1 gap-2 border-b border-white/10 bg-white/5 px-4 py-3 text-[11px] uppercase tracking-[0.25em] text-white/50 md:grid-cols-12 md:gap-4">
              <div className="md:col-span-3">Matchup</div>
              <div className="md:col-span-2">Live Score</div>
              <div className="md:col-span-4">Win Probability</div>
              <div className="md:col-span-3">Spread Interval</div>
            </div>
            {games.length === 0 ? (
              <div className="px-4 py-6 text-sm text-white/60">No NBA games found for today.</div>
            ) : (
              games.map((game) => {
                const home = game.competitors.find((team) => team.homeAway === "home")
                const away = game.competitors.find((team) => team.homeAway === "away")
                const status = formatStatus(game)
                const badge =
                  game.bucket === "live"
                    ? "Live"
                    : game.bucket === "upcoming"
                      ? "Upcoming"
                      : "Final"
                const scoreValue = `${away?.score ?? 0}*${home?.score ?? 0}`
                const winProb = winProbabilities[game.eventId]
                const minutesRemaining = getMinutesRemaining(game)
                const spreadModel =
                  winProb && minutesRemaining != null
                    ? calculateSpreadFromWinProb({
                        winProbHome: winProb.home,
                        minutesRemaining,
                        totalMinutes: NBA_TOTAL_MINUTES,
                      })
                    : null

                return (
                  <div
                    key={game.id}
                    className="grid grid-cols-1 gap-3 border-b border-white/5 px-4 py-4 text-sm text-white/80 md:grid-cols-12 md:items-center md:gap-4"
                  >
                    <div className="md:col-span-3">
                      <div className="text-sm font-semibold text-white">
                        {away?.shortName || away?.name} @ {home?.shortName || home?.name}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/50">
                        <span className="rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/60">
                          {badge}
                        </span>
                        <span>{status}</span>
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <div className="text-base font-semibold text-white">
                        <AnimatedScore value={scoreValue} />
                      </div>
                      <div className="text-xs text-white/50">
                        {away?.shortName || away?.name} vs {home?.shortName || home?.name}
                      </div>
                    </div>
                    <div className="md:col-span-4">
                      {winProb ? (
                        <WinProbabilityMeter
                          homeLabel={home?.shortName || home?.name || "Home"}
                          awayLabel={away?.shortName || away?.name || "Away"}
                          winProbHome={winProb.home}
                        />
                      ) : (
                        <div className="text-xs text-white/40">
                          {winProbError ? winProbError : "Win probability unavailable."}
                        </div>
                      )}
                    </div>
                    <div className="md:col-span-3">
                      {spreadModel ? (
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-white">
                            {formatSpreadLine(
                              spreadModel.fairLine,
                              home?.shortName || home?.name || "Home",
                              away?.shortName || away?.name || "Away"
                            )}
                          </div>
                          <div className="text-xs text-white/50">
                            {formatSpreadRange(
                              spreadModel.intervalLower,
                              spreadModel.intervalUpper,
                              home?.shortName || home?.name || "Home",
                              away?.shortName || away?.name || "Away"
                            )}
                          </div>
                          <div className="text-xs text-white/50">
                            Confidence: {spreadModel.confidence}
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-white/40">-</div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {lastUpdated && (
          <p className="text-xs text-white/40">
            Last updated {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        )}
      </div>
    </>
  )
}
