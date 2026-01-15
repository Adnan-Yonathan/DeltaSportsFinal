"use client"

import { useMemo, useState } from "react"
import { RefreshCw } from "lucide-react"
import { useLiveScores } from "@/hooks/use-live-scores"
import type { LiveScoreGame } from "@/lib/live-scores"
import { useAnimatedText } from "@/components/ui/animated-text"

type LiveProjectionResponse = {
  eventId: string
  matchup: string
  generatedAt: string
  gameState: {
    homeTeam: string
    awayTeam: string
    homeScore: number
    awayScore: number
    period: number
    displayClock: string
    isLive: boolean
  }
  projection: {
    fairLine: number
    confidence: "low" | "medium" | "high"
    confidenceInterval: {
      lower: number
      upper: number
      range: number
    }
    recommendation: string
    factors: string[]
  }
}

type ProjectionState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; data: LiveProjectionResponse }
  | { status: "error"; error: string }

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

const formatProjection = (payload: LiveProjectionResponse) => {
  const { fairLine, confidenceInterval, confidence } = payload.projection
  const favoredTeam = fairLine > 0 ? payload.gameState.homeTeam : payload.gameState.awayTeam
  const spreadValue = Math.abs(fairLine).toFixed(1)
  const lowerAbs = Math.abs(confidenceInterval.lower)
  const upperAbs = Math.abs(confidenceInterval.upper)
  const rangeLow = Math.min(lowerAbs, upperAbs).toFixed(1)
  const rangeHigh = Math.max(lowerAbs, upperAbs).toFixed(1)

  return {
    line: `${favoredTeam} -${spreadValue}`,
    range: `${favoredTeam} -${rangeLow} to -${rangeHigh}`,
    confidence,
  }
}

const AnimatedScore = ({ value }: { value: string }) => {
  const animated = useAnimatedText(value, "•")
  return <span>{animated.replace(/•/g, " - ")}</span>
}

export default function LiveProjectionsClient() {
  const { data, loading, error, isRefreshing, lastUpdated, refetch } = useLiveScores({
    refreshInterval: 10000,
  })
  const [projections, setProjections] = useState<Record<string, ProjectionState>>({})

  const games = useMemo(
    () =>
      (data?.games || []).filter(
        (game) => game.league === "nba" && game.bucket !== "completed"
      ),
    [data]
  )

  const handleProject = async (game: LiveScoreGame) => {
    setProjections((prev) => ({ ...prev, [game.eventId]: { status: "loading" } }))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4800)

    try {
      const response = await fetch(`/api/live-projections/${game.eventId}`, {
        signal: controller.signal,
        cache: "no-store",
      })
      const payload = (await response.json()) as LiveProjectionResponse & { error?: string }

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to project live spread.")
      }

      setProjections((prev) => ({ ...prev, [game.eventId]: { status: "ready", data: payload } }))
    } catch (err: any) {
      const message =
        err?.name === "AbortError" ? "Projection timed out." : err?.message || "Unable to project."
      setProjections((prev) => ({ ...prev, [game.eventId]: { status: "error", error: message } }))
    } finally {
      clearTimeout(timeout)
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-white/50">
            NBA Live Spreads
          </p>
          <p className="text-sm text-white/70">
            Click Project on live games to calculate the fair spread in real time.
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
            <div className="md:col-span-4">Matchup</div>
            <div className="md:col-span-3">Live Score</div>
            <div className="md:col-span-3">Projected Spread</div>
            <div className="md:col-span-2 md:text-right">Action</div>
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
              const projection = projections[game.eventId] || { status: "idle" }
              const canProject = game.bucket === "live"
              const scoreValue = `${away?.score ?? 0}•${home?.score ?? 0}`

              return (
                <div
                  key={game.id}
                  className="grid grid-cols-1 gap-2 border-b border-white/5 px-4 py-4 text-sm text-white/80 md:grid-cols-12 md:items-center md:gap-4"
                >
                  <div className="md:col-span-4">
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
                  <div className="md:col-span-3">
                    <div className="text-base font-semibold text-white">
                      <AnimatedScore value={scoreValue} />
                    </div>
                    <div className="text-xs text-white/50">
                      {away?.shortName || away?.name} vs {home?.shortName || home?.name}
                    </div>
                  </div>
                  <div className="md:col-span-3">
                    {projection.status === "loading" ? (
                      <div className="text-xs text-white/60">Projecting...</div>
                    ) : projection.status === "error" ? (
                      <div className="text-xs text-rose-200">{projection.error}</div>
                    ) : projection.status === "ready" ? (
                      <div className="space-y-1">
                        {(() => {
                          const formatted = formatProjection(projection.data)
                          return (
                            <>
                              <div className="text-sm font-semibold text-white">{formatted.line}</div>
                              <div className="text-xs text-white/50">Range: {formatted.range}</div>
                              <div className="text-xs text-white/50">
                                Confidence: {formatted.confidence}
                              </div>
                            </>
                          )
                        })()}
                      </div>
                    ) : (
                      <div className="text-xs text-white/40">-</div>
                    )}
                  </div>
                  <div className="md:col-span-2 md:text-right">
                    <button
                      onClick={() => handleProject(game)}
                      disabled={!canProject || projection.status === "loading"}
                      className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] transition-colors ${
                        canProject
                          ? "border border-emerald-400/60 text-emerald-200 hover:border-emerald-300 hover:text-white"
                          : "border border-white/10 text-white/30 cursor-not-allowed"
                      }`}
                    >
                      {projection.status === "loading" ? "Projecting" : "Project"}
                    </button>
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
  )
}
