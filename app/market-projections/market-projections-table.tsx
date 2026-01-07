"use client"

import { useMemo, useState } from "react"
import Link from "next/link"

type EdgeFilter = "spread" | "moneyline" | "total"

type MarketEdge = {
  edgePercent: number
}

type EdgeGame = {
  matchup: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  spread?: {
    marketLine: number
    targetLine: number
    bestBook?: string
    bestOdds?: number
    favoredTeam?: string
  }
  total?: {
    marketLine: number
    targetLine: number
    bestBook?: string
    bestOdds?: number
    bestUnderOdds?: number
  }
  moneyline?: {
    sportsbook?: {
      homeOdds?: number
      homeBook?: string
      awayOdds?: number
      awayBook?: string
    }
    model?: {
      homeOdds?: number
      awayOdds?: number
      homeProbability?: number
    }
    prediction?: {
      homeOdds?: number
      homeBook?: string
      awayOdds?: number
      awayBook?: string
    }
  }
  sharpSignals: Array<{
    type: string
    market: string
    side: string
    strength: number
  }>
  lineMovements: Array<{
    market: string
    openingLine: string | number
    currentLine: string | number
    isSharp?: boolean
    isSignificant?: boolean
  }>
}

const formatSigned = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

const formatOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const resolveModelSpread = (game: EdgeGame) => {
  const targetLine = game.spread?.targetLine
  if (!Number.isFinite(targetLine)) return null
  const favoredTeam = game.spread?.favoredTeam
  if (!favoredTeam) return targetLine as number
  const absLine = Math.abs(targetLine as number)
  if (favoredTeam === game.homeTeam) return -absLine
  if (favoredTeam === game.awayTeam) return absLine
  return targetLine as number
}

const computeEdgeRatio = (model?: number | null, market?: number | null) => {
  if (!Number.isFinite(model) || !Number.isFinite(market)) return null
  const denom = Math.abs(market ?? 0)
  if (!denom) return null
  const gap = Math.abs((model ?? 0) - (market ?? 0))
  const ratio = 1 - gap / denom
  return Math.max(0, Math.min(1, ratio))
}

const DEFAULT_VIG_PERCENT = 4.54

const impliedProbability = (odds?: number | null) => {
  if (!Number.isFinite(odds)) return null
  const value = odds as number
  if (value > 0) return 100 / (value + 100)
  return Math.abs(value) / (Math.abs(value) + 100)
}

const resolveVigPercent = (oddsA?: number | null, oddsB?: number | null) => {
  const probA = impliedProbability(oddsA)
  const probB = impliedProbability(oddsB)
  if (probA == null || probB == null) return DEFAULT_VIG_PERCENT
  return Math.max(0, (probA + probB - 1) * 100)
}

const clampPercent = (value: number) =>
  Math.max(0, Math.min(100, value))

const marketEdge = (game: EdgeGame, filter: EdgeFilter): MarketEdge => {
  if (filter === "spread") {
    const modelLine = resolveModelSpread(game)
    if (!Number.isFinite(modelLine) || !Number.isFinite(game.spread?.marketLine)) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs(
      (modelLine ?? 0) - (game.spread?.marketLine ?? 0)
    )
    const edge = diff * 3 - DEFAULT_VIG_PERCENT
    return { edgePercent: clampPercent(edge) }
  }

  if (filter === "total") {
    if (
      !Number.isFinite(game.total?.targetLine) ||
      !Number.isFinite(game.total?.marketLine)
    ) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs(
      (game.total?.targetLine ?? 0) - (game.total?.marketLine ?? 0)
    )
    const vig = resolveVigPercent(
      game.total?.bestOdds ?? null,
      game.total?.bestUnderOdds ?? null
    )
    const edge = diff * 1.8 - vig
    return { edgePercent: clampPercent(edge) }
  }

  const modelHomeProb = impliedProbability(
    game.moneyline?.model?.homeOdds ?? game.moneyline?.prediction?.homeOdds
  )
  const marketHomeProb = impliedProbability(game.moneyline?.sportsbook?.homeOdds)
  const modelAwayProb = impliedProbability(
    game.moneyline?.model?.awayOdds ?? game.moneyline?.prediction?.awayOdds
  )
  const marketAwayProb = impliedProbability(game.moneyline?.sportsbook?.awayOdds)
  const homeEdge =
    modelHomeProb != null && marketHomeProb != null
      ? Math.abs((modelHomeProb - marketHomeProb) * 100)
      : 0
  const awayEdge =
    modelAwayProb != null && marketAwayProb != null
      ? Math.abs((modelAwayProb - marketAwayProb) * 100)
      : 0
  const vig = resolveVigPercent(
    game.moneyline?.sportsbook?.homeOdds ?? null,
    game.moneyline?.sportsbook?.awayOdds ?? null
  )
  const edge = Math.max(homeEdge, awayEdge) - vig
  return { edgePercent: clampPercent(edge) }
}

const edgeLabel = (edgePercent: number) => `${edgePercent.toFixed(1)}%`

export default function MarketProjectionsTable({
  edges,
  errorMessage,
}: {
  edges: EdgeGame[]
  errorMessage: string | null
}) {
  const [filter, setFilter] = useState<EdgeFilter>("spread")

  const sortedEdges = useMemo(() => {
    return [...edges].sort(
      (a, b) => marketEdge(b, filter).edgePercent - marketEdge(a, filter).edgePercent
    )
  }, [edges, filter])

  return (
    <>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="grid grid-cols-3 gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70">
          <button
            type="button"
            onClick={() => setFilter("spread")}
            className={`rounded-md border px-3 py-2 text-center transition-colors ${
              filter === "spread"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-black/40 hover:border-emerald-400/40 hover:text-white"
            }`}
          >
            Top Spread
          </button>
          <button
            type="button"
            onClick={() => setFilter("moneyline")}
            className={`rounded-md border px-3 py-2 text-center transition-colors ${
              filter === "moneyline"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-black/40 hover:border-emerald-400/40 hover:text-white"
            }`}
          >
            Top Moneyline
          </button>
          <button
            type="button"
            onClick={() => setFilter("total")}
            className={`rounded-md border px-3 py-2 text-center transition-colors ${
              filter === "total"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 bg-black/40 hover:border-emerald-400/40 hover:text-white"
            }`}
          >
            Top O/U
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Updated every 15 minutes. Sorted by highest edge first. Default view
          is top spread.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-[200px_repeat(4,minmax(0,1fr))] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span>Matchup</span>
          <span>Projection</span>
          <span>Odds</span>
          <span>Sharp Action</span>
          <span>Line Movement</span>
        </div>
        {errorMessage ? (
          <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
        ) : sortedEdges.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">
            No market projection rows yet.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {sortedEdges.map((game, index) => {
              const edgeMetrics = marketEdge(game, filter)
              const spread = game.spread
              const total = game.total
              const moneyline = game.moneyline
              const modelHomeOdds =
                moneyline?.model?.homeOdds ?? moneyline?.prediction?.homeOdds
              const modelAwayOdds =
                moneyline?.model?.awayOdds ?? moneyline?.prediction?.awayOdds
              const modelSpreadLine = resolveModelSpread(game)
              const sharpSummary = game.sharpSignals
                .slice(0, 2)
                .map(
                  (signal) =>
                    `${signal.type} ${signal.market} ${signal.side} (${signal.strength}/5)`
                )
                .join(" | ")
              const moveSummary = game.lineMovements
                .filter((move) => move.isSharp || move.isSignificant)
                .slice(0, 2)
                .map(
                  (move) =>
                    `${move.market}: ${move.openingLine} -> ${move.currentLine}`
                )
                .join(" | ")
              return (
                <div
                  key={`${game.matchup}-${game.commenceTime}`}
                  className="grid grid-cols-[200px_repeat(4,minmax(0,1fr))] gap-2 px-3 py-3 text-[13px] text-white/70"
                >
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                      #{index + 1} • Edge {edgeLabel(edgeMetrics.edgePercent)}
                    </div>
                    <div className="text-sm font-semibold text-white">
                      {game.awayTeam} @ {game.homeTeam}
                    </div>
                    <Link
                      href={`/chat?prompt=Analyze%20${encodeURIComponent(
                        game.awayTeam
                      )}%20at%20${encodeURIComponent(
                        game.homeTeam
                      )}%20using%20market%20projections`}
                      className="inline-flex rounded-md border border-emerald-400/40 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
                    >
                      Analyze
                    </Link>
                  </div>
                    <div className="space-y-2 text-xs text-white/70">
                      <div>
                        Spread:{" "}
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                          Model {formatSigned(modelSpreadLine)}
                        </span>{" "}
                        <span className="text-white/40">vs</span>{" "}
                        Market {formatSigned(spread?.marketLine)}
                      </div>
                      <div>
                        Model Favorite:{" "}
                        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                          {spread?.favoredTeam ?? "n/a"}
                        </span>
                      </div>
                    <div>
                      Total:{" "}
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                        Model {formatSigned(total?.targetLine)}
                      </span>{" "}
                      <span className="text-white/40">vs</span>{" "}
                      Market {formatSigned(total?.marketLine)}
                    </div>
                    <div>
                      ML:{" "}
                      <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                        Model H {formatOdds(modelHomeOdds)} / A{" "}
                        {formatOdds(modelAwayOdds)}
                      </span>{" "}
                      <span className="text-white/40">vs</span>{" "}
                      Market H {formatOdds(moneyline?.sportsbook?.homeOdds)} / A{" "}
                      {formatOdds(moneyline?.sportsbook?.awayOdds)}
                    </div>
                  </div>
                  <div className="space-y-2 text-xs text-white/70">
                    <div>
                      Spread:{" "}
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                        {spread?.bestBook ?? "n/a"} {formatOdds(spread?.bestOdds)}
                      </span>
                    </div>
                    <div>
                      Total:{" "}
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                        {total?.bestBook ?? "n/a"} O {formatOdds(total?.bestOdds)} /
                        U {formatOdds(total?.bestUnderOdds)}
                      </span>
                    </div>
                    <div>
                      ML:{" "}
                      <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                        {moneyline?.sportsbook?.homeBook ?? "n/a"}{" "}
                        {formatOdds(moneyline?.sportsbook?.homeOdds)} /{" "}
                        {moneyline?.sportsbook?.awayBook ?? "n/a"}{" "}
                        {formatOdds(moneyline?.sportsbook?.awayOdds)}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-white/70">
                    {sharpSummary || "No sharp signals yet."}
                  </div>
                  <div className="text-xs text-white/70">
                    {moveSummary || "No line movement yet."}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
