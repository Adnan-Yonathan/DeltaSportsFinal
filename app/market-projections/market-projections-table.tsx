"use client"

import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ElectricCard } from "@/components/ui/electric-card"
import { cn } from "@/lib/utils"
import ShareProjectionButton from "@/components/ShareProjectionButton"
import { AVAILABLE_BOOKS, type BookKey } from "@/lib/config/books"
import { formatSharpSignalSummaryLine } from "@/lib/utils/sharp-signal-language"

type EdgeFilter = "spread" | "moneyline" | "total"
type AccessTier = "free" | "sharp" | "syndicate" | null

type MarketEdge = {
  edgePercent: number
}

type SharpProjectionMarket = {
  side: string
  probability: number
  confidenceInterval: { low: number; high: number }
  edgePercent: number
  breakEven: number
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
    bestHomeBook?: string
    bestHomeOdds?: number
    bestAwayBook?: string
    bestAwayOdds?: number
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
    source: "kalshi" | "polymarket" | "history"
    marketTitle: string
    outcome: string
    notional: number
    americanOdds?: number | null
    timestamp: string
    status: "pending" | "respected" | "faded"
  }>
  sharpProjections?: {
    spread?: SharpProjectionMarket
    total?: SharpProjectionMarket
    moneyline?: SharpProjectionMarket
    tier?: string
  }
}

type WhaleTier = "small" | "blue" | "mega"

const AnimatedValue = ({
  text,
  pulseKey,
  className,
}: {
  text: string
  pulseKey: number
  className?: string
}) => (
  <motion.span
    key={`${pulseKey}-${text}`}
    initial={{ opacity: 0, y: -6 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: "spring", stiffness: 260, damping: 18 }}
    className={cn("inline-flex", className)}
  >
    {text}
  </motion.span>
)

const coerceNumber = (value?: number | string | null) => {
  if (value == null) return null
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

type AccessConfig = {
  allowedFilters: EdgeFilter[]
  maxRows: Partial<Record<EdgeFilter, number>>
}

const resolveAccessConfig = (tier?: AccessTier): AccessConfig => {
  if (tier === "sharp" || tier === "syndicate") {
    return { allowedFilters: ["spread", "moneyline", "total"], maxRows: {} }
  }
  return { allowedFilters: ["spread", "moneyline", "total"], maxRows: {} }
}

const formatSigned = (value?: number | string | null) => {
  const numeric = coerceNumber(value)
  if (numeric == null) return "n/a"
  return numeric > 0 ? `+${numeric.toFixed(1)}` : numeric.toFixed(1)
}

const formatOdds = (value?: number | string | null) => {
  const numeric = coerceNumber(value)
  if (numeric == null) return "n/a"
  return numeric > 0 ? `+${Math.round(numeric)}` : `${Math.round(numeric)}`
}

const formatCurrency = (value?: number | string | null) => {
  const numeric = coerceNumber(value)
  if (numeric == null) return "n/a"
  return `$${Math.round(numeric).toLocaleString("en-US")}`
}

const formatProbability = (value?: number | string | null) => {
  const numeric = coerceNumber(value)
  if (numeric == null) return "n/a"
  return `${(numeric * 100).toFixed(1)}%`
}

const resolveSportLabel = (sportKey?: string) => {
  const map: Record<string, string> = {
    basketball_nba: "NBA",
    basketball_wnba: "WNBA",
    basketball_ncaab: "NCAAB",
    americanfootball_nfl: "NFL",
    americanfootball_ncaaf: "NCAAF",
    icehockey_nhl: "NHL",
    baseball_mlb: "MLB",
  }
  return sportKey ? map[sportKey] ?? sportKey.toUpperCase() : "SPORTS"
}

const isUpcomingGame = (commenceTime?: string) => {
  if (!commenceTime) return true
  const time = Date.parse(commenceTime)
  if (!Number.isFinite(time)) return true
  return time > Date.now()
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

const resolveLineFromMovements = (
  game: EdgeGame,
  market: "spread" | "total"
) => {
  const move = game.lineMovements.find((entry) => entry.market === market)
  return coerceNumber(move?.currentLine ?? move?.openingLine)
}

const resolveMarketSpreadLine = (game: EdgeGame) =>
  coerceNumber(game.spread?.marketLine) ?? resolveLineFromMovements(game, "spread")

const formatSpreadLineLabel = (game: EdgeGame, line: number) => {
  if (line === 0) return "PK"
  if (line < 0) return `${game.homeTeam} ${formatSigned(line)}`
  return `${game.awayTeam} ${formatSigned(-line)}`
}

const formatLineMovement = (move: EdgeGame["lineMovements"][number]) => {
  const formatter = move.market === "moneyline" ? formatOdds : formatSigned
  const opening = formatter(move.openingLine)
  const current = formatter(move.currentLine)
  if (opening === "n/a" || current === "n/a") return `${move.market} move n/a`
  return `${move.market} open ${opening} -> now ${current}`
}

const resolveMoveSummary = (game: EdgeGame, filter: EdgeFilter) => {
  const scoped = game.lineMovements.filter((move) => move.market === filter)
  const moves = scoped.length ? scoped : game.lineMovements
  return moves
    .slice(0, 2)
    .map(formatLineMovement)
    .join(" | ")
}

const summarizeSharpSignalsPlain = (
  signals: EdgeGame["sharpSignals"],
  limit = 2
) =>
  signals
    .slice(0, limit)
    .map((signal) => formatSharpSignalSummaryLine(signal))
    .join(" | ")

const resolveModelSpread = (game: EdgeGame) => {
  // Prefer prediction market line if it differs from market line
  const predictionLine = coerceNumber(game.spread?.prediction?.line)
  const marketLine = coerceNumber(game.spread?.marketLine)
  const targetLine = coerceNumber(game.spread?.targetLine)

  // Use prediction line if available and different from market
  if (predictionLine != null && marketLine != null) {
    if (Math.abs(predictionLine - marketLine) > 0.5) {
      return predictionLine
    }
  }

  if (targetLine == null) {
    return (
      predictionLine ??
      marketLine ??
      resolveLineFromMovements(game, "spread")
    )
  }
  const favoredTeam = game.spread?.favoredTeam
  if (!favoredTeam) return targetLine
  const absLine = Math.abs(targetLine)
  if (favoredTeam === game.homeTeam) return -absLine
  if (favoredTeam === game.awayTeam) return absLine
  return targetLine
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

const impliedProbability = (odds?: number | string | null) => {
  const value = coerceNumber(odds)
  if (value == null) return null
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

const resolveProjection = (game: EdgeGame, filter: EdgeFilter) => {
  if (!game.sharpProjections) return null
  const raw =
    filter === "spread"
      ? game.sharpProjections.spread ?? null
      : filter === "total"
        ? game.sharpProjections.total ?? null
        : game.sharpProjections.moneyline ?? null
  return normalizeProjection(game, filter, raw)
}

const resolveSpreadOddsDisplay = (game: EdgeGame, pick: EdgePick) => {
  const spread = game.spread
  if (!spread) return { book: undefined, odds: undefined }
  const sideLabel = pick.projection?.side ?? pick.label ?? ""
  const isHome = sideLabel.includes(game.homeTeam)
  const isAway = sideLabel.includes(game.awayTeam)
  if (isHome) {
    return {
      book: spread.bestHomeBook ?? spread.bestBook,
      odds: spread.bestHomeOdds ?? spread.bestOdds,
    }
  }
  if (isAway) {
    return {
      book: spread.bestAwayBook ?? spread.bestBook,
      odds: spread.bestAwayOdds ?? spread.bestOdds,
    }
  }
  return { book: spread.bestBook, odds: spread.bestOdds }
}

const resolveOppositeSide = (side: string, filter: EdgeFilter, game: EdgeGame) => {
  if (filter === "total") {
    const normalized = side.toLowerCase()
    if (normalized.includes("over")) return "Under"
    if (normalized.includes("under")) return "Over"
    return side
  }
  if (side === game.homeTeam) return game.awayTeam
  if (side === game.awayTeam) return game.homeTeam
  return side
}

const normalizeProjection = (
  game: EdgeGame,
  filter: EdgeFilter,
  projection: SharpProjectionMarket | null
) => {
  if (!projection) return null
  const probability = coerceNumber(projection.probability)
  if (probability == null || probability >= 0.5) {
    return projection
  }
  const adjustedProbability = 1 - probability
  const side = resolveOppositeSide(projection.side, filter, game)
  const breakEven = coerceNumber(projection.breakEven)
  const edgePercent = breakEven != null
    ? Math.max(0, (adjustedProbability - breakEven) * 100)
    : projection.edgePercent
  return {
    ...projection,
    side,
    probability: adjustedProbability,
    edgePercent,
  }
}

const resolveSpreadProjectionLabel = (
  game: EdgeGame,
  projection: SharpProjectionMarket
) => {
  const marketLine = coerceNumber(game.spread?.marketLine)
  const fallbackLine =
    coerceNumber(game.spread?.prediction?.line) ??
    coerceNumber(game.spread?.targetLine) ??
    resolveModelSpread(game)
  const lineValue = marketLine ?? fallbackLine
  if (lineValue == null) return projection.side

  const homeLine = lineValue
  const isHome = projection.side === game.homeTeam
  const line = isHome ? homeLine : -homeLine
  return `${projection.side} ${formatSigned(line)}`
}

const resolveTotalProjectionLabel = (
  game: EdgeGame,
  projection: SharpProjectionMarket
) => {
  const marketLine = coerceNumber(game.total?.marketLine)
  const fallbackLine =
    coerceNumber(game.total?.prediction?.line) ??
    coerceNumber(game.total?.targetLine) ??
    resolveLineFromMovements(game, "total")
  const lineValue = marketLine ?? fallbackLine
  if (lineValue == null) return projection.side
  return `${projection.side} ${formatSigned(lineValue)}`
}

const formatProjectionPick = (
  label: string | null,
  projection: SharpProjectionMarket | null
) => {
  if (!label || !projection) return "n/a"
  return `${label} ${formatProbability(projection.probability)}`
}

type EdgePick = {
  label: string | null
  edgePercent: number | null
  projection?: SharpProjectionMarket | null
}

const resolveSpreadComparison = (game: EdgeGame) => {
  const marketLine = resolveMarketSpreadLine(game)
  const projectedLine = resolveModelSpread(game)
  if (marketLine == null || projectedLine == null) return null
  const delta = Math.abs(projectedLine - marketLine)
  return {
    marketLine,
    projectedLine,
    delta,
    marketLabel: formatSpreadLineLabel(game, marketLine),
    projectedLabel: formatSpreadLineLabel(game, projectedLine),
  }
}

const resolveTotalComparison = (game: EdgeGame) => {
  const marketLine =
    coerceNumber(game.total?.marketLine) ?? resolveLineFromMovements(game, "total")
  const predictionLine = coerceNumber(game.total?.prediction?.line)
  const targetLine = coerceNumber(game.total?.targetLine)
  let projectedLine = targetLine ?? predictionLine

  if (predictionLine != null && marketLine != null) {
    if (Math.abs(predictionLine - marketLine) > 1) {
      projectedLine = predictionLine
    }
  }

  if (marketLine == null || projectedLine == null) return null
  const delta = Math.abs(projectedLine - marketLine)
  return {
    marketLine,
    projectedLine,
    delta,
    marketLabel: marketLine.toFixed(1),
    projectedLabel: projectedLine.toFixed(1),
  }
}

const resolveMoneylineComparison = (game: EdgeGame, pick: EdgePick) => {
  const label = pick.label ?? pick.projection?.side
  if (!label) return null
  const isHome = label.includes(game.homeTeam)
  const isAway = label.includes(game.awayTeam)
  if (!isHome && !isAway) return null

  const marketOdds = isHome
    ? game.moneyline?.sportsbook?.homeOdds
    : game.moneyline?.sportsbook?.awayOdds
  const projectedOdds = isHome
    ? game.moneyline?.model?.homeOdds ?? game.moneyline?.prediction?.homeOdds
    : game.moneyline?.model?.awayOdds ?? game.moneyline?.prediction?.awayOdds
  const marketProb = impliedProbability(marketOdds)
  const projectedProb = impliedProbability(projectedOdds)

  if (marketOdds == null || projectedOdds == null || marketProb == null || projectedProb == null) {
    return null
  }

  const delta = Math.abs(projectedProb - marketProb) * 100
  return {
    marketOdds,
    projectedOdds,
    marketProb,
    projectedProb,
    delta,
    sideLabel: label,
  }
}

const toPercent = (value: number, min: number, max: number) => {
  const denom = max - min
  if (!denom) return 50
  return Math.max(0, Math.min(100, ((value - min) / denom) * 100))
}

const SpreadComparison = ({ game }: { game: EdgeGame }) => {
  const comparison = resolveSpreadComparison(game)
  if (!comparison) return null
  const { marketLine, projectedLine, delta, marketLabel, projectedLabel } = comparison
  const min = Math.min(marketLine, projectedLine)
  const max = Math.max(marketLine, projectedLine)
  const pad = Math.max(1, (max - min) * 0.6)
  const minPad = min - pad
  const maxPad = max + pad
  const marketPos = toPercent(marketLine, minPad, maxPad)
  const projectedPos = toPercent(projectedLine, minPad, maxPad)

  return (
    <div className="space-y-2 text-xs text-white/70">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>Market</span>
        <span>Projected</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
          {marketLabel}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Δ {delta.toFixed(1)}
        </span>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
          {projectedLabel}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10">
        <div className="absolute top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/15" />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]"
          style={{ left: `${marketPos}%` }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
          style={{ left: `${projectedPos}%` }}
        />
      </div>
    </div>
  )
}

const TotalComparison = ({ game }: { game: EdgeGame }) => {
  const comparison = resolveTotalComparison(game)
  if (!comparison) return null
  const { marketLine, projectedLine, delta, marketLabel, projectedLabel } = comparison
  const min = Math.min(marketLine, projectedLine)
  const max = Math.max(marketLine, projectedLine)
  const pad = Math.max(1, (max - min) * 0.6)
  const minPad = min - pad
  const maxPad = max + pad
  const marketPos = toPercent(marketLine, minPad, maxPad)
  const projectedPos = toPercent(projectedLine, minPad, maxPad)

  return (
    <div className="space-y-2 text-xs text-white/70">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>Market</span>
        <span>Projected</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
          {marketLabel}
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Î” {delta.toFixed(1)}
        </span>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
          {projectedLabel}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10">
        <div className="absolute top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/15" />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]"
          style={{ left: `${marketPos}%` }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
          style={{ left: `${projectedPos}%` }}
        />
      </div>
    </div>
  )
}

const MoneylineComparison = ({
  game,
  pick,
}: {
  game: EdgeGame
  pick: EdgePick
}) => {
  const comparison = resolveMoneylineComparison(game, pick)
  if (!comparison) return null
  const { marketOdds, projectedOdds, marketProb, projectedProb, delta, sideLabel } =
    comparison
  const min = Math.min(marketProb, projectedProb)
  const max = Math.max(marketProb, projectedProb)
  const pad = Math.max(0.02, (max - min) * 0.6)
  const minPad = Math.max(0, min - pad)
  const maxPad = Math.min(1, max + pad)
  const marketPos = toPercent(marketProb, minPad, maxPad)
  const projectedPos = toPercent(projectedProb, minPad, maxPad)

  return (
    <div className="space-y-2 text-xs text-white/70">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>Market</span>
        <span>Projected</span>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
          {sideLabel} {formatOdds(marketOdds)} ({formatProbability(marketProb)})
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
          Î” {delta.toFixed(1)}%
        </span>
        <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
          {sideLabel} {formatOdds(projectedOdds)} ({formatProbability(projectedProb)})
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-white/10">
        <div className="absolute top-1/2 h-[2px] w-full -translate-y-1/2 bg-white/15" />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(252,211,77,0.4)]"
          style={{ left: `${marketPos}%` }}
        />
        <div
          className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.4)]"
          style={{ left: `${projectedPos}%` }}
        />
      </div>
    </div>
  )
}

const formatPick = (pick: EdgePick) => {
  if (pick.projection) return formatProjectionPick(pick.label, pick.projection)
  return formatEdgePick(pick.label, pick.edgePercent)
}

const formatPickBrief = (pick: EdgePick) => {
  if (pick.projection) {
    if (!pick.label) return formatProbability(pick.projection.probability)
    return `${pick.label} ${formatProbability(pick.projection.probability)}`
  }
  return formatEdgePick(pick.label, pick.edgePercent)
}

const marketEdge = (
  game: EdgeGame,
  filter: EdgeFilter,
  sport?: string
): MarketEdge => {
  const projection = resolveProjection(game, filter)
  if (projection) return { edgePercent: projection.edgePercent }
  const scale = sport === "basketball_ncaab" ? 0.5 : 1
  if (filter === "spread") {
    const modelLine = resolveModelSpread(game)
    const marketLine = coerceNumber(game.spread?.marketLine)
    const fallbackMarketLine = resolveLineFromMovements(game, "spread")
    const resolvedMarketLine = marketLine ?? fallbackMarketLine
    if (modelLine == null || resolvedMarketLine == null) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs(modelLine - resolvedMarketLine)
    const edge = diff * 3 - resolveEdgeVig(sport)
    return { edgePercent: clampPercent(edge * scale) }
  }

  if (filter === "total") {
    const marketLine = coerceNumber(game.total?.marketLine)
    const predictionLine = coerceNumber(game.total?.prediction?.line)
    const targetLine = coerceNumber(game.total?.targetLine)
    const fallbackMarketLine = resolveLineFromMovements(game, "total")

    // Prefer prediction line if it differs from market
    let modelLine = targetLine
    const resolvedMarketLine = marketLine ?? fallbackMarketLine
    if (predictionLine != null && resolvedMarketLine != null) {
      if (Math.abs(predictionLine - resolvedMarketLine) > 1) {
        modelLine = predictionLine
      }
    }

    if (modelLine == null || resolvedMarketLine == null) {
      return { edgePercent: 0 }
    }
    const diff = Math.abs(modelLine - resolvedMarketLine)
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

const resolveElectricPreset = (edgePercent: number) => {
  if (edgePercent >= 20) {
    return {
      color: "#39ff88",
      className: "ec-intensity-strong",
      badge: "Elite Edge",
    }
  }
  if (edgePercent >= 15) {
    return {
      color: "#24e07c",
      className: "ec-intensity-medium",
      badge: "High Edge",
    }
  }
  if (edgePercent >= 10) {
    return {
      color: "#16b865",
      className: "ec-intensity-low",
      badge: "Edge",
    }
  }
  return null
}
const formatEdgePick = (
  label: string | null,
  edgePercent: number | null
) => {
  if (!label || edgePercent == null) return "0.0%"
  return `${label} ${edgeLabel(edgePercent)}`
}

const resolveSpreadEdgePick = (game: EdgeGame, sport?: string) => {
  const projection = resolveProjection(game, "spread")
  if (projection) {
    return {
      label: resolveSpreadProjectionLabel(game, projection),
      edgePercent: projection.edgePercent,
      projection,
    }
  }
  const modelLine = resolveModelSpread(game)
  const marketLine = coerceNumber(game.spread?.marketLine)
  const fallbackMarketLine = resolveLineFromMovements(game, "spread")
  const resolvedMarketLine = marketLine ?? fallbackMarketLine
  if (modelLine == null || resolvedMarketLine == null) {
    return { label: null, edgePercent: null }
  }
  const pick = modelLine < resolvedMarketLine
    ? game.homeTeam
    : game.awayTeam
  const edgePercent = marketEdge(game, "spread", sport).edgePercent
  return { label: pick, edgePercent }
}

const resolveTotalEdgePick = (game: EdgeGame, sport?: string) => {
  const projection = resolveProjection(game, "total")
  if (projection) {
    return {
      label: resolveTotalProjectionLabel(game, projection),
      edgePercent: projection.edgePercent,
      projection,
    }
  }
  const marketLine = coerceNumber(game.total?.marketLine)
  const predictionLine = coerceNumber(game.total?.prediction?.line)
  const targetLine = coerceNumber(game.total?.targetLine)
  const fallbackMarketLine = resolveLineFromMovements(game, "total")

  // Prefer prediction line if it differs from market
  let modelLine = targetLine
  const resolvedMarketLine = marketLine ?? fallbackMarketLine
  if (predictionLine != null && resolvedMarketLine != null) {
    if (Math.abs(predictionLine - resolvedMarketLine) > 1) {
      modelLine = predictionLine
    }
  }

  if (modelLine == null || resolvedMarketLine == null) {
    return { label: null, edgePercent: null }
  }
  const pick = modelLine > resolvedMarketLine ? "Over" : "Under"
  const edgePercent = marketEdge(game, "total", sport).edgePercent
  return { label: pick, edgePercent }
}

const resolveMoneylineEdgePick = (game: EdgeGame, sport?: string) => {
  const projection = resolveProjection(game, "moneyline")
  if (projection) {
    return {
      label: projection.side,
      edgePercent: projection.edgePercent,
      projection,
    }
  }
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

const resolveFilterLabels = (filter: EdgeFilter) => {
  if (filter === "spread") return { projection: "Spread projection", odds: "Spread odds" }
  if (filter === "moneyline") return { projection: "ML projection", odds: "ML odds" }
  return { projection: "Total projection", odds: "Total odds" }
}

const buildProjectionSharePayload = (
  game: EdgeGame,
  filter: EdgeFilter,
  sportKey: string | undefined,
  activePick: EdgePick,
  edgePercent: number,
  spreadOdds: { book?: string; odds?: number | null }
) => {
  const filterLabels = resolveFilterLabels(filter)
  const total = game.total
  const moneyline = game.moneyline

  let oddsLabel = "n/a"
  if (filter === "spread") {
    oddsLabel = `${spreadOdds.book ?? "n/a"} ${formatOdds(spreadOdds.odds)}`
  } else if (filter === "total") {
    oddsLabel = `${total?.bestBook ?? "n/a"} O ${formatOdds(total?.bestOdds)} / U ${formatOdds(total?.bestUnderOdds)}`
  } else {
    oddsLabel = `${moneyline?.sportsbook?.homeBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.homeOdds)} / ${moneyline?.sportsbook?.awayBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.awayOdds)}`
  }

  const sharpSummary = summarizeSharpSignalsPlain(game.sharpSignals)
  const moveSummary = resolveMoveSummary(game, filter)

  return {
    id: `${game.matchup}-${filter}`,
    sportLabel: resolveSportLabel(sportKey),
    matchup: game.matchup,
    filterLabel: filterLabels.projection,
    pickLabel: formatPick(activePick),
    edgeLabel: edgeLabel(edgePercent),
    oddsLabel,
    sharpSummary: sharpSummary || "No sharp signals yet.",
    moveSummary: moveSummary || "No line movement yet.",
  }
}

const hasMarketData = (game: EdgeGame, filter: EdgeFilter) => {
  if (filter === "spread") {
    return (
      (coerceNumber(game.spread?.marketLine) != null ||
        resolveLineFromMovements(game, "spread") != null) &&
      (coerceNumber(game.spread?.targetLine) != null ||
        resolveModelSpread(game) != null)
    )
  }
  if (filter === "total") {
    return (
      (coerceNumber(game.total?.marketLine) != null ||
        resolveLineFromMovements(game, "total") != null) &&
      (coerceNumber(game.total?.targetLine) != null ||
        coerceNumber(game.total?.prediction?.line) != null)
    )
  }
  return Boolean(
    game.moneyline?.sportsbook?.homeOdds ??
      game.moneyline?.sportsbook?.awayOdds ??
      game.moneyline?.prediction?.homeOdds ??
      game.moneyline?.prediction?.awayOdds ??
      game.moneyline?.model?.homeOdds ??
      game.moneyline?.model?.awayOdds ??
      game.sharpProjections?.moneyline
  )
}

export default function MarketProjectionsTable({
  edges,
  errorMessage,
  sport,
  tier,
  selectedBooks,
  previewMode = false,
}: {
  edges: EdgeGame[]
  errorMessage: string | null
  sport?: string
  tier?: AccessTier
  selectedBooks?: BookKey[]
  previewMode?: boolean
}) {
  // Build a set of selected book labels for filtering display
  const selectedBookLabels = useMemo(() => {
    if (!selectedBooks || selectedBooks.length === 0) return null
    const labels = new Set<string>()
    for (const key of selectedBooks) {
      const book = AVAILABLE_BOOKS.find(b => b.key === key)
      if (book) {
        labels.add(book.label.toLowerCase())
        labels.add(book.key.toLowerCase())
        if (book.apiKey) {
          labels.add(book.apiKey.toLowerCase())
        }
      }
    }
    return labels
  }, [selectedBooks])

  // Helper to check if a book should be displayed
  const isBookSelected = (bookName?: string | null) => {
    if (!selectedBookLabels || !bookName) return true
    const normalized = bookName.toLowerCase().replace(/[^a-z0-9]/g, '')
    for (const label of selectedBookLabels) {
      const normalizedLabel = label.replace(/[^a-z0-9]/g, '')
      if (normalized.includes(normalizedLabel) || normalizedLabel.includes(normalized)) {
        return true
      }
    }
    return false
  }
  const accessConfig = useMemo(() => resolveAccessConfig(tier), [tier])
  const [filter, setFilter] = useState<EdgeFilter>(accessConfig.allowedFilters[0] ?? "spread")
  const [pulseKey, setPulseKey] = useState(0)

  useEffect(() => {
    const intervalId = setInterval(() => {
      setPulseKey((prev) => prev + 1)
    }, 15000)
    return () => clearInterval(intervalId)
  }, [])

  useEffect(() => {
    if (!accessConfig.allowedFilters.includes(filter)) {
      setFilter(accessConfig.allowedFilters[0] ?? "spread")
    }
  }, [accessConfig.allowedFilters, filter])

  const sortedEdges = useMemo(() => {
    const scoped = edges.filter(
      (game) =>
        hasMarketData(game, filter) &&
        isUpcomingGame(game.commenceTime)
    )
    const sorted = [...scoped].sort(
      (a, b) =>
        marketEdge(b, filter, sport).edgePercent -
        marketEdge(a, filter, sport).edgePercent
    )
    const maxRows = accessConfig.maxRows[filter]
    return Number.isFinite(maxRows) ? sorted.slice(0, maxRows) : sorted
  }, [edges, filter, sport, accessConfig.maxRows])
  const visibleEdges = previewMode ? sortedEdges.slice(0, 1) : sortedEdges

  const filterLabels = resolveFilterLabels(filter)
  const filterButtonLabels: Record<EdgeFilter, string> = {
    spread: "Top Spread",
    moneyline: "Top Moneyline",
    total: "Top O/U",
  }
  const filterGridClass =
    accessConfig.allowedFilters.length === 1
      ? "grid-cols-1"
      : accessConfig.allowedFilters.length === 2
        ? "grid-cols-2"
        : "grid-cols-3"

  return (
    <>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 sm:mt-6">
        <div className={`grid ${filterGridClass} gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/70`}>
          {accessConfig.allowedFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-md border px-3 py-2 text-center transition-colors ${
                filter === item
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 bg-black/40 hover:border-emerald-400/40 hover:text-white"
              }`}
            >
              {filterButtonLabels[item]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        {errorMessage ? (
          <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
        ) : visibleEdges.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">
            No {filterLabels.projection.toLowerCase()} rows yet.
          </div>
        ) : (
          <>
            <div className="divide-y divide-white/5 sm:hidden">
              {visibleEdges.map((game, index) => {
                const edgeMetrics = marketEdge(game, filter, sport)
                const spread = game.spread
                const total = game.total
                const moneyline = game.moneyline
                const spreadPick = resolveSpreadEdgePick(game, sport)
                const totalPick = resolveTotalEdgePick(game, sport)
                const moneylinePick = resolveMoneylineEdgePick(game, sport)
                const activePick =
                  filter === "spread"
                    ? spreadPick
                    : filter === "moneyline"
                      ? moneylinePick
                      : totalPick
                const projectionText = formatPick(activePick)
                const electricPreset =
                  filter !== "moneyline" ? resolveElectricPreset(edgeMetrics.edgePercent) : null
                const spreadOdds = resolveSpreadOddsDisplay(game, activePick)
                const sharpSummary = summarizeSharpSignalsPlain(game.sharpSignals)
                  const moveSummary = resolveMoveSummary(game, filter)
                  const sharePayload = buildProjectionSharePayload(
                    game,
                    filter,
                    sport,
                    activePick,
                    edgeMetrics.edgePercent,
                    spreadOdds
                  )
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
                          {filterLabels.projection}:{" "}
                          <span className="whitespace-nowrap rounded bg-emerald-500/15 px-1 py-0.5 text-[10px] text-emerald-200">
                            <AnimatedValue text={formatPick(activePick)} pulseKey={pulseKey} />
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/50 group-open:border-emerald-400/40 group-open:text-emerald-200">
                        View
                      </span>
                    </summary>
                    <div className="mt-3 space-y-3">
                      <div className="space-y-2">
                        {electricPreset ? (
                          <div className="rounded-md border border-white/10 bg-black/30 p-2">
                            <div className="max-w-[320px]">
                              <ElectricCard
                                variant="hue"
                                size="compact"
                                width="100%"
                                aspectRatio="3.6 / 1.25"
                                color={electricPreset.color}
                                badge={electricPreset.badge}
                                title={projectionText}
                                description={`${edgeLabel(edgeMetrics.edgePercent)} edge`}
                                className={cn("w-full", electricPreset.className)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm">
                            {filterLabels.projection}:{" "}
                            <span className="whitespace-nowrap rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                              <AnimatedValue text={projectionText} pulseKey={pulseKey} />
                            </span>
                          </div>
                        )}
                        {filter === "spread" ? (
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                            <SpreadComparison game={game} />
                          </div>
                        ) : null}
                        {filter === "total" ? (
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                            <TotalComparison game={game} />
                          </div>
                        ) : null}
                        {filter === "moneyline" ? (
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                            <MoneylineComparison game={game} pick={activePick} />
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-2">
                        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                          {filterLabels.odds}:{" "}
                          {filter === "spread" ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                              <AnimatedValue
                                text={`${spreadOdds.book ?? "n/a"} ${formatOdds(spreadOdds.odds)}`}
                                pulseKey={pulseKey}
                              />
                            </span>
                          ) : null}
                          {filter === "total" ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                              <AnimatedValue
                                text={`${total?.bestBook ?? "n/a"} O ${formatOdds(total?.bestOdds)} / U ${formatOdds(total?.bestUnderOdds)}`}
                                pulseKey={pulseKey}
                              />
                            </span>
                          ) : null}
                          {filter === "moneyline" ? (
                            <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                              <AnimatedValue
                                text={`${moneyline?.sportsbook?.homeBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.homeOdds)} / ${moneyline?.sportsbook?.awayBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.awayOdds)}`}
                                pulseKey={pulseKey}
                              />
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="space-y-2 text-[11px] text-white/60">
                        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                          {sharpSummary || "No sharp signals yet."}
                        </div>
                        <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                          {moveSummary || "No line movement yet."}
                        </div>
                        <div className="flex justify-end">
                          <ShareProjectionButton projection={sharePayload} />
                        </div>
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
            <div className="hidden sm:block">
              <Table className="text-[13px] text-white/70">
                <TableHeader className="bg-black/70">
                  <TableRow className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                    <TableHead className="w-[200px]">Matchup</TableHead>
                    <TableHead>{filterLabels.projection}</TableHead>
                    <TableHead>{filterLabels.odds}</TableHead>
                    <TableHead>Why Pros Lean</TableHead>
                    <TableHead>Line Movement</TableHead>
                    <TableHead className="text-right">Share</TableHead>
                    
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-white/5">
                  {visibleEdges.map((game, index) => {
                    const edgeMetrics = marketEdge(game, filter, sport)
                    const spread = game.spread
                    const total = game.total
                    const moneyline = game.moneyline
                    const spreadPick = resolveSpreadEdgePick(game, sport)
                    const totalPick = resolveTotalEdgePick(game, sport)
                    const moneylinePick = resolveMoneylineEdgePick(game, sport)
                const activePick =
                  filter === "spread"
                    ? spreadPick
                    : filter === "moneyline"
                      ? moneylinePick
                      : totalPick
                const projectionText = formatPick(activePick)
                const electricPreset =
                  filter !== "moneyline" ? resolveElectricPreset(edgeMetrics.edgePercent) : null
                const spreadOdds = resolveSpreadOddsDisplay(game, activePick)
                const sharpSummary = summarizeSharpSignalsPlain(game.sharpSignals)
                    const moveSummary = resolveMoveSummary(game, filter)
                    const sharePayload = buildProjectionSharePayload(
                      game,
                      filter,
                      sport,
                      activePick,
                      edgeMetrics.edgePercent,
                      spreadOdds
                    )
                    return (
                      <TableRow
                        key={`${game.matchup}-${game.commenceTime}`}
                        className="border-white/5"
                      >
                        <TableCell className="align-top">
                          <div className="space-y-2">
                            <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                              #{index + 1} - Edge {edgeLabel(edgeMetrics.edgePercent)}
                            </div>
                            <div className="text-sm font-semibold text-white">
                              {game.awayTeam} @ {game.homeTeam}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-2 text-xs text-white/70">
                            {electricPreset ? (
                              <div className="rounded-md border border-white/10 bg-black/30 p-2">
                                <div className="max-w-[320px]">
                                  <ElectricCard
                                    variant="hue"
                                    size="compact"
                                    width="100%"
                                    aspectRatio="3.6 / 1.25"
                                    color={electricPreset.color}
                                    badge={electricPreset.badge}
                                    title={projectionText}
                                    description={`${edgeLabel(edgeMetrics.edgePercent)} edge`}
                                    className={cn("w-full", electricPreset.className)}
                                  />
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5 text-sm">
                                {filterLabels.projection}:{" "}
                                <span className="whitespace-nowrap rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                                  <AnimatedValue text={projectionText} pulseKey={pulseKey} />
                                </span>
                              </div>
                            )}
                            {filter === "spread" ? (
                              <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                                <SpreadComparison game={game} />
                              </div>
                            ) : null}
                            {filter === "total" ? (
                              <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                                <TotalComparison game={game} />
                              </div>
                            ) : null}
                            {filter === "moneyline" ? (
                              <div className="rounded-md border border-white/10 bg-black/30 px-2 py-2">
                                <MoneylineComparison game={game} pick={activePick} />
                              </div>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="space-y-2 text-xs text-white/70">
                            <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                              {filterLabels.odds}:{" "}
                              {filter === "spread" ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                                  <AnimatedValue
                                    text={`${spreadOdds.book ?? "n/a"} ${formatOdds(spreadOdds.odds)}`}
                                    pulseKey={pulseKey}
                                  />
                                </span>
                              ) : null}
                              {filter === "total" ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                                  <AnimatedValue
                                    text={`${total?.bestBook ?? "n/a"} O ${formatOdds(total?.bestOdds)} / U ${formatOdds(total?.bestUnderOdds)}`}
                                    pulseKey={pulseKey}
                                  />
                                </span>
                              ) : null}
                              {filter === "moneyline" ? (
                                <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-200">
                                  <AnimatedValue
                                    text={`${moneyline?.sportsbook?.homeBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.homeOdds)} / ${moneyline?.sportsbook?.awayBook ?? "n/a"} ${formatOdds(moneyline?.sportsbook?.awayOdds)}`}
                                    pulseKey={pulseKey}
                                  />
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-xs text-white/70">
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                            {sharpSummary || "No sharp signals yet."}
                          </div>
                        </TableCell>
                        <TableCell className="align-top text-xs text-white/70">
                          <div className="rounded-md border border-white/10 bg-black/30 px-2 py-1.5">
                            {moveSummary || "No line movement yet."}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex justify-end">
                            <ShareProjectionButton projection={sharePayload} />
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
      {previewMode && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm">
            <div className="space-y-3 px-4 py-4">
              {[1, 2, 3].map((row) => (
                <div key={row} className="grid grid-cols-4 gap-3">
                  <div className="h-4 rounded bg-white/10" />
                  <div className="h-4 rounded bg-white/10" />
                  <div className="h-4 rounded bg-white/10" />
                  <div className="h-4 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Upgrade required
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Upgrade to get full access.
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Unlock every sharp projection and edge.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}







