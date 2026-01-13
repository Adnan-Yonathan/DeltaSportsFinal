"use client"

import { useMemo, useState } from "react"

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
    prediction?: { line: number; book: string; odds: number }
  }
  total?: {
    marketLine: number
    targetLine: number
    bestBook?: string
    bestOdds?: number
    bestUnderOdds?: number
    prediction?: { line: number; book: string; overOdds: number; underOdds: number }
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
  whaleAlerts?: Array<{
    id: string
    source: "kalshi" | "polymarket"
    marketTitle: string
    outcome: string
    notional: number
    americanOdds?: number | null
    timestamp: string
    status: "pending" | "respected" | "faded"
  }>
}

type WhaleTier = "small" | "blue" | "mega"

const formatSigned = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)
}

const formatOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const formatCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `$${Math.round(value).toLocaleString("en-US")}`
}

const resolveWhaleTier = (notional: number): WhaleTier => {
  if (notional >= 10000) return "mega"
  if (notional >= 5000) return "blue"
  return "small"
}

type WhaleAlert = NonNullable<EdgeGame["whaleAlerts"]>[number]

const isTotalWhale = (alert: WhaleAlert) => {
  const text = `${alert.marketTitle} ${alert.outcome}`.toLowerCase()
  return text.includes("over") || text.includes("under") || text.includes("total")
}

const summarizeWhales = (game: EdgeGame, filter: EdgeFilter) => {
  const alerts = game.whaleAlerts ?? []
  if (!alerts.length) {
    return { small: 0, blue: 0, mega: 0 }
  }
  const scoped = alerts.filter((alert) =>
    filter === "total" ? isTotalWhale(alert) : !isTotalWhale(alert)
  )
  const counts = { small: 0, blue: 0, mega: 0 }
  for (const alert of scoped) {
    const tier = resolveWhaleTier(alert.notional)
    counts[tier] += 1
  }
  return counts
}

const resolveModelSpread = (game: EdgeGame) => {
  // Prefer prediction market line if it differs from market line
  const predictionLine = game.spread?.prediction?.line
  const marketLine = game.spread?.marketLine
  const targetLine = game.spread?.targetLine

  // Use prediction line if available and different from market
  if (Number.isFinite(predictionLine) && Number.isFinite(marketLine)) {
    if (Math.abs((predictionLine as number) - (marketLine as number)) > 0.5) {
      return predictionLine as number
    }
  }

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

const resolveEdgeVig = (
  _sport: string | undefined,
  oddsA?: number | null,
  oddsB?: number | null,
  fallbackVig = DEFAULT_VIG_PERCENT
) => {
  if (oddsA == null && oddsB == null) return fallbackVig
  return resolveVigPercent(oddsA ?? null, oddsB ?? null)
}

const marketEdge = (
  game: EdgeGame,
  filter: EdgeFilter,
  sport?: string
): MarketEdge => {
  const scale = sport === "basketball_ncaab" ? 0.5 : 1
  if (filter === "spread") {
    const modelLine = resolveModelSpread(game)
    if (!Number.isFinite(modelLine) || !Number.isFinite(game.spread?.marketLine)) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs(
      (modelLine ?? 0) - (game.spread?.marketLine ?? 0)
    )
    const edge = diff * 3 - resolveEdgeVig(sport)
    return { edgePercent: clampPercent(edge * scale) }
  }

  if (filter === "total") {
    const marketLine = game.total?.marketLine
    const predictionLine = game.total?.prediction?.line
    const targetLine = game.total?.targetLine

    // Prefer prediction line if it differs from market
    let modelLine = targetLine
    if (Number.isFinite(predictionLine) && Number.isFinite(marketLine)) {
      if (Math.abs((predictionLine as number) - (marketLine as number)) > 1) {
        modelLine = predictionLine
      }
    }

    if (!Number.isFinite(modelLine) || !Number.isFinite(marketLine)) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs((modelLine ?? 0) - (marketLine ?? 0))
    const vig = resolveEdgeVig(
      sport,
      game.total?.bestOdds ?? null,
      game.total?.bestUnderOdds ?? null
    )
    const edge = diff * 1.8 - vig
    return { edgePercent: clampPercent(edge * scale) }
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
  const vig = resolveEdgeVig(
    sport,
    game.moneyline?.sportsbook?.homeOdds ?? null,
    game.moneyline?.sportsbook?.awayOdds ?? null
  )
  const edge = Math.max(homeEdge, awayEdge) - vig
  return { edgePercent: clampPercent(edge * scale) }
}

const edgeLabel = (edgePercent: number) => `${edgePercent.toFixed(1)}%`
const formatEdgePick = (
  label: string | null,
  edgePercent: number | null
) => {
  if (!label || edgePercent == null) return "0.0%"
  return `${label} ${edgeLabel(edgePercent)}`
}

const resolveSpreadEdgePick = (game: EdgeGame, sport?: string) => {
  const modelLine = resolveModelSpread(game)
  const marketLine = game.spread?.marketLine
  if (!Number.isFinite(modelLine) || !Number.isFinite(marketLine)) {
    return { label: null, edgePercent: null }
  }
  const pick = (modelLine as number) < (marketLine as number)
    ? game.homeTeam
    : game.awayTeam
  const edgePercent = marketEdge(game, "spread", sport).edgePercent
  return { label: pick, edgePercent }
}

const resolveTotalEdgePick = (game: EdgeGame, sport?: string) => {
  const marketLine = game.total?.marketLine
  const predictionLine = game.total?.prediction?.line
  const targetLine = game.total?.targetLine

  // Prefer prediction line if it differs from market
  let modelLine = targetLine
  if (Number.isFinite(predictionLine) && Number.isFinite(marketLine)) {
    if (Math.abs((predictionLine as number) - (marketLine as number)) > 1) {
      modelLine = predictionLine
    }
  }

  if (!Number.isFinite(modelLine) || !Number.isFinite(marketLine)) {
    return { label: null, edgePercent: null }
  }
  const pick = (modelLine ?? 0) > (marketLine ?? 0) ? "Over" : "Under"
  const edgePercent = marketEdge(game, "total", sport).edgePercent
  return { label: pick, edgePercent }
}

const resolveMoneylineEdgePick = (game: EdgeGame, sport?: string) => {
  const modelHomeProb = impliedProbability(
    game.moneyline?.model?.homeOdds ?? game.moneyline?.prediction?.homeOdds     
  )
  const marketHomeProb = impliedProbability(
    game.moneyline?.sportsbook?.homeOdds
  )
  const modelAwayProb = impliedProbability(
    game.moneyline?.model?.awayOdds ?? game.moneyline?.prediction?.awayOdds
  )
  const marketAwayProb = impliedProbability(
    game.moneyline?.sportsbook?.awayOdds
  )
  if (
    modelHomeProb == null ||
    marketHomeProb == null ||
    modelAwayProb == null ||
    marketAwayProb == null
  ) {
    return { label: null, edgePercent: null }
  }
  const homeDiff = modelHomeProb - marketHomeProb
  const awayDiff = modelAwayProb - marketAwayProb
  const pick = homeDiff >= awayDiff ? game.homeTeam : game.awayTeam
  const edgePercent = marketEdge(game, "moneyline", sport).edgePercent
  return { label: pick, edgePercent }
}

export default function MarketProjectionsTable({
  edges,
  errorMessage,
  sport,
}: {
  edges: EdgeGame[]
  errorMessage: string | null
  sport?: string
}) {
  const [filter, setFilter] = useState<EdgeFilter>("spread")

  const sortedEdges = useMemo(() => {
    return [...edges].sort(
      (a, b) =>
        marketEdge(b, filter, sport).edgePercent -
        marketEdge(a, filter, sport).edgePercent
    )
  }, [edges, filter, sport])

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
        <div className="hidden sm:grid grid-cols-[200px_repeat(5,minmax(0,1fr))] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span>Matchup</span>
          <span>Edge</span>
          <span>Odds</span>
          <span>Sharp Action</span>
          <span>Line Movement</span>
          <span>Whales</span>
        </div>
        {errorMessage ? (
          <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
        ) : sortedEdges.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">
            No market projection rows yet.
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5 sm:hidden">
              {sortedEdges.map((game, index) => {
                const edgeMetrics = marketEdge(game, filter, sport)
                const spread = game.spread
                const total = game.total
                const moneyline = game.moneyline
                const spreadPick = resolveSpreadEdgePick(game, sport)
                const totalPick = resolveTotalEdgePick(game, sport)
                const moneylinePick = resolveMoneylineEdgePick(game, sport)
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
                const whales = summarizeWhales(game, filter)
                return (
                  <details
                    key={`${game.matchup}-${game.commenceTime}`}
                    className="group px-3 py-3 text-[12px] text-white/70"
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                          #{index + 1} - Edge {edgeLabel(edgeMetrics.edgePercent)}
                        </div>
                        <div className="text-sm font-semibold text-white">
                          {game.awayTeam} @ {game.homeTeam}
                        </div>
                        <div className="mt-1 text-[11px] text-white/50">
                          Spread edge{" "}
                          {formatEdgePick(spreadPick.label, spreadPick.edgePercent)} -
                          Total edge{" "}
                          {formatEdgePick(totalPick.label, totalPick.edgePercent)}
                        </div>
                        <div className="mt-1 text-[11px] text-white/50">
                          {game.homeTeam} {formatSigned(spread?.marketLine)} {game.awayTeam} {formatSigned(spread?.marketLine != null ? -(spread.marketLine) : null)}
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50 group-open:border-emerald-400/40 group-open:text-emerald-200">
                        View
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        <div>
                          Spread edge:{" "}
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                            {formatEdgePick(
                              spreadPick.label,
                              spreadPick.edgePercent
                            )}
                          </span>
                        </div>
                        <div>
                          Total edge:{" "}
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                            {formatEdgePick(
                              totalPick.label,
                              totalPick.edgePercent
                            )}
                          </span>
                        </div>
                        <div>
                          ML edge:{" "}
                          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                            {formatEdgePick(
                              moneylinePick.label,
                              moneylinePick.edgePercent
                            )}
                          </span>
                        </div>
                        <div>
                          Market lines:{" "}
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
                            {game.homeTeam} {formatSigned(spread?.marketLine)} {game.awayTeam} {formatSigned(spread?.marketLine != null ? -(spread.marketLine) : null)}
                          </span>
                        </div>
                        <div>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
                            Total {formatSigned(total?.marketLine)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          Spread odds:{" "}
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                            {spread?.bestBook ?? "n/a"} {formatOdds(spread?.bestOdds)}
                          </span>
                        </div>
                        <div>
                          Total odds:{" "}
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                            {total?.bestBook ?? "n/a"} O {formatOdds(total?.bestOdds)} /
                            U {formatOdds(total?.bestUnderOdds)}
                          </span>
                        </div>
                        <div>
                          ML odds:{" "}
                          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                            {moneyline?.sportsbook?.homeBook ?? "n/a"}{" "}
                            {formatOdds(moneyline?.sportsbook?.homeOdds)} /{" "}
                            {moneyline?.sportsbook?.awayBook ?? "n/a"}{" "}
                            {formatOdds(moneyline?.sportsbook?.awayOdds)}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1 text-[11px] text-white/60">
                        <div>{sharpSummary || "No sharp signals yet."}</div>
                        <div>{moveSummary || "No line movement yet."}</div>
                        {(whales.small || whales.blue || whales.mega) > 0 ? (
                          <div className="text-amber-200">
                            Whales: Swordfish {whales.small} • Megalodon {whales.blue} • Blue whale {whales.mega}
                          </div>
                        ) : (
                          <div>No whale activity yet.</div>
                        )}
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
            <div className="hidden divide-y divide-white/5 sm:block">
              {sortedEdges.map((game, index) => {
                const edgeMetrics = marketEdge(game, filter, sport)
                const spread = game.spread
                const total = game.total
                const moneyline = game.moneyline
                const spreadPick = resolveSpreadEdgePick(game, sport)
                const totalPick = resolveTotalEdgePick(game, sport)
                const moneylinePick = resolveMoneylineEdgePick(game, sport)
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
                const whales = summarizeWhales(game, filter)
                return (
                  <div
                    key={`${game.matchup}-${game.commenceTime}`}
                    className="grid grid-cols-[200px_repeat(5,minmax(0,1fr))] gap-2 px-3 py-3 text-[13px] text-white/70"
                  >
                    <div className="space-y-2">
                      <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                        #{index + 1} - Edge {edgeLabel(edgeMetrics.edgePercent)}
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                    </div>
                    <div className="space-y-2 text-xs text-white/70">
  <div>
    Spread edge:{" "}
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
      {formatEdgePick(
        spreadPick.label,
        spreadPick.edgePercent
      )}
    </span>
  </div>
  <div>
    Total edge:{" "}
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
      {formatEdgePick(
        totalPick.label,
        totalPick.edgePercent
      )}
    </span>
  </div>
  <div>
    ML edge:{" "}
    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
      {formatEdgePick(
        moneylinePick.label,
        moneylinePick.edgePercent
      )}
    </span>
  </div>
  <div>
    Market lines:{" "}
    <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
      {game.homeTeam} {formatSigned(spread?.marketLine)} {game.awayTeam} {formatSigned(spread?.marketLine != null ? -(spread.marketLine) : null)}
    </span>
  </div>
  <div>
    <span className="rounded bg-white/10 px-1.5 py-0.5 text-white/70">
      Total {formatSigned(total?.marketLine)}
    </span>
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
      {total?.bestBook ?? "n/a"} O {formatOdds(total?.bestOdds)} /{" "}
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
                    <div className="text-xs text-white/70">
                      {whales.small || whales.blue || whales.mega ? (
                        <div>
                          Small {whales.small} • Blue {whales.blue} • Megaladon {whales.mega}
                        </div>
                      ) : (
                        "No whale activity yet."
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </>
  )
}







