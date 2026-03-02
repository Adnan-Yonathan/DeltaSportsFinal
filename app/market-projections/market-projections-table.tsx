"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import RadialOrbitalTimeline, { type TimelineItem } from "@/components/ui/radial-orbital-timeline"
import ShareProjectionButton from "@/components/ShareProjectionButton"
import { formatSharpSignalSummaryLine } from "@/lib/utils/sharp-signal-language"
import {
  Activity,
  CircleDollarSign,
  Landmark,
  ShieldCheck,
  TrendingUp,
  Waves,
} from "lucide-react"

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
  sport?: string
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
    fanduel?: {
      homeOdds?: number
      awayOdds?: number
    }
    favoredTeam?: string
    prediction?: { line: number; book: string; odds: number }
    bookQuotes?: Partial<Record<BookFilterKey, BookSpreadQuote>>
  }
  total?: {
    marketLine: number
    targetLine: number
    bestBook?: string
    bestOdds?: number
    bestUnderOdds?: number
    fanduel?: {
      overOdds?: number
      underOdds?: number
    }
    prediction?: { line: number; book: string; overOdds: number; underOdds: number }
    bookQuotes?: Partial<Record<BookFilterKey, BookTotalQuote>>
  }
  moneyline?: {
    sportsbook?: {
      homeOdds?: number
      homeBook?: string
      awayOdds?: number
      awayBook?: string
    }
    fanduel?: {
      homeOdds?: number
      awayOdds?: number
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
    bookQuotes?: Partial<Record<BookFilterKey, BookMoneylineQuote>>
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

type BookFilterKey =
  | "fanduel"
  | "kalshi"
  | "pinnacle"
  | "polymarket"
  | "prophetx"
  | "novig"

type BookOption = {
  key: BookFilterKey
  label: string
  logoSrc: string
  icon: TimelineItem["icon"]
}

type BookOddsCandidate = {
  book: BookFilterKey
  odds: number
}

type BookSpreadQuote = {
  homeLine?: number
  homeOdds?: number
  awayLine?: number
  awayOdds?: number
  source?: string
  bookTitle?: string
}

type BookTotalQuote = {
  line?: number
  overOdds?: number
  underOdds?: number
  source?: string
  bookTitle?: string
}

type BookMoneylineQuote = {
  homeOdds?: number
  awayOdds?: number
  source?: string
  bookTitle?: string
}

const BOOK_OPTIONS: BookOption[] = [
  { key: "fanduel", label: "FanDuel", logoSrc: "/fanduel.jpeg", icon: CircleDollarSign },
  { key: "kalshi", label: "Kalshi", logoSrc: "/kalshi.png", icon: Landmark },
  { key: "pinnacle", label: "Pinnacle", logoSrc: "/pinnacle.jpg", icon: ShieldCheck },
  { key: "polymarket", label: "Polymarket", logoSrc: "/polymarket.png", icon: TrendingUp },
  { key: "prophetx", label: "ProphetX", logoSrc: "/ProphetX.png", icon: Activity },
  { key: "novig", label: "NoVig", logoSrc: "/Novig.png", icon: Waves },
]

const BOOK_OPTIONS_BY_KEY: Record<BookFilterKey, BookOption> = BOOK_OPTIONS.reduce(
  (acc, option) => {
    acc[option.key] = option
    return acc
  },
  {} as Record<BookFilterKey, BookOption>
)

const DEFAULT_BOOK_FILTER: BookFilterKey = "fanduel"

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

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "n/a"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
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
    americanfootball_ncaaf: "CFB",
    icehockey_nhl: "NHL",
    baseball_mlb: "MLB",
  }
  return sportKey ? map[sportKey] ?? sportKey.toUpperCase() : "SPORTS"
}

const resolveGameSportKey = (game: EdgeGame, fallbackSport?: string) =>
  game.sport ?? fallbackSport

const isUpcomingGame = (commenceTime?: string) => {
  if (!commenceTime) return true
  const time = Date.parse(commenceTime)
  if (!Number.isFinite(time)) return true
  // Keep live/recent games visible so today's slate does not disappear mid-day.
  const lookbackMs = 3 * 60 * 60 * 1000
  return time >= Date.now() - lookbackMs
}

type DateWindowFilter = "all" | "today" | "24h" | "3d"
const DEFAULT_LEAGUE_FILTER_OPTIONS = ["NBA", "NCAAB", "CFB", "NFL", "NHL", "MLB"]

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

const matchesDateWindow = (commenceTime: string, window: DateWindowFilter) => {
  if (window === "all") return true
  const time = Date.parse(commenceTime)
  if (!Number.isFinite(time)) return false

  const now = Date.now()
  if (window === "24h") return time >= now && time <= now + 24 * 60 * 60 * 1000
  if (window === "3d") return time >= now && time <= now + 72 * 60 * 60 * 1000

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  return time >= today.getTime() && time < tomorrow.getTime()
}

const resolveLineCellValue = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick,
  selectedBook: BookFilterKey
) => {
  const quotedLine = resolveBookLineValue(game, filter, pick, selectedBook)
  if (quotedLine != null) {
    if (filter === "spread") return quotedLine === 0 ? "PK" : formatSigned(quotedLine)
    if (filter === "total") return quotedLine.toFixed(1)
  }

  if (filter === "spread") {
    const line = resolveMarketSpreadLine(game)
    if (line == null) return "--"
    return line === 0 ? "PK" : formatSigned(line)
  }
  if (filter === "total") {
    const line =
      coerceNumber(game.total?.marketLine) ?? resolveLineFromMovements(game, "total")
    return line == null ? "--" : line.toFixed(1)
  }
  return "--"
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

const normalizeToken = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const resolveBookKey = (value?: string | null): BookFilterKey | null => {
  const normalized = normalizeToken(value)
  if (!normalized) return null
  if (normalized.includes("fanduel")) return "fanduel"
  if (normalized.includes("kalshi")) return "kalshi"
  if (normalized.includes("pinnacle")) return "pinnacle"
  if (normalized.includes("polymarket")) return "polymarket"
  if (normalized.includes("prophetx") || normalized.includes("prophet")) return "prophetx"
  if (normalized.includes("novig")) return "novig"
  return null
}

const pushBookCandidate = (
  candidates: BookOddsCandidate[],
  bookLabel: string | undefined,
  odds: number | null
) => {
  const numericOdds = coerceNumber(odds)
  const key = resolveBookKey(bookLabel)
  if (numericOdds == null || !key) return
  candidates.push({ book: key, odds: numericOdds })
}

const pickBestBookOdds = (candidates: BookOddsCandidate[]) => {
  if (!candidates.length) return null
  return candidates.reduce((best, candidate) =>
    candidate.odds > best.odds ? candidate : best
  )
}

const labelMatchesTeam = (label: string | null | undefined, team: string) => {
  const normalizedLabel = normalizeToken(label)
  const normalizedTeam = normalizeToken(team)
  if (!normalizedLabel || !normalizedTeam) return false
  return (
    normalizedLabel.includes(normalizedTeam) ||
    normalizedTeam.includes(normalizedLabel)
  )
}

const resolveQuoteSide = (game: EdgeGame, pick: EdgePick): "home" | "away" | "unknown" => {
  const sideLabel = pick.projection?.side ?? pick.label ?? ""
  if (labelMatchesTeam(sideLabel, game.homeTeam)) return "home"
  if (labelMatchesTeam(sideLabel, game.awayTeam)) return "away"
  return "unknown"
}

const resolveSpreadQuoteForBook = (game: EdgeGame, book: BookFilterKey) =>
  game.spread?.bookQuotes?.[book]

const resolveTotalQuoteForBook = (game: EdgeGame, book: BookFilterKey) =>
  game.total?.bookQuotes?.[book]

const resolveMoneylineQuoteForBook = (game: EdgeGame, book: BookFilterKey) =>
  game.moneyline?.bookQuotes?.[book]

const resolveBookLineValue = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick,
  book: BookFilterKey
) => {
  if (filter === "spread") {
    const quote = resolveSpreadQuoteForBook(game, book)
    if (!quote) return null
    const side = resolveQuoteSide(game, pick)
    if (side === "home") return coerceNumber(quote.homeLine)
    if (side === "away") return coerceNumber(quote.awayLine)
    return coerceNumber(quote.homeLine ?? quote.awayLine ?? null)
  }
  if (filter === "total") {
    return coerceNumber(resolveTotalQuoteForBook(game, book)?.line ?? null)
  }
  return null
}

const resolveBookOddsFromQuote = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick,
  book: BookFilterKey
) => {
  if (filter === "spread") {
    const quote = resolveSpreadQuoteForBook(game, book)
    if (!quote) return null
    const side = resolveQuoteSide(game, pick)
    if (side === "home") return coerceNumber(quote.homeOdds)
    if (side === "away") return coerceNumber(quote.awayOdds)
    return coerceNumber(quote.homeOdds ?? quote.awayOdds ?? null)
  }

  if (filter === "total") {
    const quote = resolveTotalQuoteForBook(game, book)
    if (!quote) return null
    const sideLabel = normalizeToken(pick.projection?.side ?? pick.label ?? "")
    if (sideLabel.includes("over")) return coerceNumber(quote.overOdds)
    if (sideLabel.includes("under")) return coerceNumber(quote.underOdds)
    return coerceNumber(quote.overOdds ?? quote.underOdds ?? null)
  }

  const quote = resolveMoneylineQuoteForBook(game, book)
  if (!quote) return null
  const side = resolveQuoteSide(game, pick)
  if (side === "home") return coerceNumber(quote.homeOdds)
  if (side === "away") return coerceNumber(quote.awayOdds)
  return coerceNumber(quote.homeOdds ?? quote.awayOdds ?? null)
}

const resolveSharpLineCandidates = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick
) => {
  const candidates: BookOddsCandidate[] = []
  for (const bookOption of BOOK_OPTIONS) {
    const quotedOdds = resolveBookOddsFromQuote(game, filter, pick, bookOption.key)
    if (quotedOdds != null) {
      candidates.push({ book: bookOption.key, odds: quotedOdds })
    }
  }
  if (candidates.length > 0) return candidates

  const sideLabel = pick.projection?.side ?? pick.label ?? ""
  const normalizedSide = normalizeToken(sideLabel)
  const homeSelected = labelMatchesTeam(sideLabel, game.homeTeam)
  const awaySelected = labelMatchesTeam(sideLabel, game.awayTeam)

  if (filter === "spread") {
    if (homeSelected) {
      pushBookCandidate(candidates, "FanDuel", game.spread?.fanduel?.homeOdds ?? null)
      pushBookCandidate(candidates, game.spread?.bestHomeBook, game.spread?.bestHomeOdds ?? null)
    } else if (awaySelected) {
      pushBookCandidate(candidates, "FanDuel", game.spread?.fanduel?.awayOdds ?? null)
      pushBookCandidate(candidates, game.spread?.bestAwayBook, game.spread?.bestAwayOdds ?? null)
    } else {
      pushBookCandidate(candidates, "FanDuel", game.spread?.fanduel?.homeOdds ?? null)
      pushBookCandidate(candidates, "FanDuel", game.spread?.fanduel?.awayOdds ?? null)
      pushBookCandidate(candidates, game.spread?.bestHomeBook, game.spread?.bestHomeOdds ?? null)
      pushBookCandidate(candidates, game.spread?.bestAwayBook, game.spread?.bestAwayOdds ?? null)
    }
    pushBookCandidate(candidates, game.spread?.bestBook, game.spread?.bestOdds ?? null)
    pushBookCandidate(candidates, game.spread?.prediction?.book, game.spread?.prediction?.odds ?? null)
    return candidates
  }

  if (filter === "total") {
    if (normalizedSide.includes("over")) {
      pushBookCandidate(candidates, "FanDuel", game.total?.fanduel?.overOdds ?? null)
      pushBookCandidate(candidates, game.total?.bestBook, game.total?.bestOdds ?? null)
      pushBookCandidate(candidates, game.total?.prediction?.book, game.total?.prediction?.overOdds ?? null)
      return candidates
    }
    if (normalizedSide.includes("under")) {
      pushBookCandidate(candidates, "FanDuel", game.total?.fanduel?.underOdds ?? null)
      pushBookCandidate(candidates, game.total?.bestBook, game.total?.bestUnderOdds ?? null)
      pushBookCandidate(candidates, game.total?.prediction?.book, game.total?.prediction?.underOdds ?? null)
      return candidates
    }
    pushBookCandidate(candidates, "FanDuel", game.total?.fanduel?.overOdds ?? null)
    pushBookCandidate(candidates, "FanDuel", game.total?.fanduel?.underOdds ?? null)
    pushBookCandidate(candidates, game.total?.bestBook, game.total?.bestOdds ?? null)
    pushBookCandidate(candidates, game.total?.bestBook, game.total?.bestUnderOdds ?? null)
    pushBookCandidate(candidates, game.total?.prediction?.book, game.total?.prediction?.overOdds ?? null)
    pushBookCandidate(candidates, game.total?.prediction?.book, game.total?.prediction?.underOdds ?? null)
    return candidates
  }

  if (homeSelected) {
    pushBookCandidate(candidates, "FanDuel", game.moneyline?.fanduel?.homeOdds ?? null)
    pushBookCandidate(
      candidates,
      game.moneyline?.sportsbook?.homeBook,
      game.moneyline?.sportsbook?.homeOdds ?? null
    )
    pushBookCandidate(
      candidates,
      game.moneyline?.prediction?.homeBook,
      game.moneyline?.prediction?.homeOdds ?? null
    )
    return candidates
  }
  if (awaySelected) {
    pushBookCandidate(candidates, "FanDuel", game.moneyline?.fanduel?.awayOdds ?? null)
    pushBookCandidate(
      candidates,
      game.moneyline?.sportsbook?.awayBook,
      game.moneyline?.sportsbook?.awayOdds ?? null
    )
    pushBookCandidate(
      candidates,
      game.moneyline?.prediction?.awayBook,
      game.moneyline?.prediction?.awayOdds ?? null
    )
    return candidates
  }
  pushBookCandidate(candidates, "FanDuel", game.moneyline?.fanduel?.homeOdds ?? null)
  pushBookCandidate(candidates, "FanDuel", game.moneyline?.fanduel?.awayOdds ?? null)
  pushBookCandidate(
    candidates,
    game.moneyline?.sportsbook?.homeBook,
    game.moneyline?.sportsbook?.homeOdds ?? null
  )
  pushBookCandidate(
    candidates,
    game.moneyline?.sportsbook?.awayBook,
    game.moneyline?.sportsbook?.awayOdds ?? null
  )
  pushBookCandidate(
    candidates,
    game.moneyline?.prediction?.homeBook,
    game.moneyline?.prediction?.homeOdds ?? null
  )
  pushBookCandidate(
    candidates,
    game.moneyline?.prediction?.awayBook,
    game.moneyline?.prediction?.awayOdds ?? null
  )
  return candidates
}

const resolveBookLineForGame = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick,
  selectedBook: BookFilterKey
) => {
  const candidates = resolveSharpLineCandidates(game, filter, pick).filter(
    (candidate) => candidate.book === selectedBook
  )
  return pickBestBookOdds(candidates)
}

const resolveSharpLineDisplay = (
  game: EdgeGame,
  filter: EdgeFilter,
  pick: EdgePick,
  selectedBook: BookFilterKey
) => {
  const line = resolveBookLineForGame(game, filter, pick, selectedBook)
  return line == null ? "n/a" : formatOdds(line.odds)
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
  if (filter === "spread") return { projection: "Spread projection", odds: "Book line" }
  if (filter === "moneyline") return { projection: "ML projection", odds: "Book line" }
  return { projection: "Total projection", odds: "Book line" }
}

const buildProjectionSharePayload = (
  game: EdgeGame,
  filter: EdgeFilter,
  sportKey: string | undefined,
  activePick: EdgePick,
  edgePercent: number,
  selectedBook: BookFilterKey
) => {
  const filterLabels = resolveFilterLabels(filter)
  const oddsLabel = resolveSharpLineDisplay(game, filter, activePick, selectedBook)

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
  previewMode = false,
}: {
  edges: EdgeGame[]
  errorMessage: string | null
  sport?: string
  tier?: AccessTier
  previewMode?: boolean
}) {
  const accessConfig = useMemo(() => resolveAccessConfig(tier), [tier])
  const [filter, setFilter] = useState<EdgeFilter>(accessConfig.allowedFilters[0] ?? "spread")
  const [leagueFilter, setLeagueFilter] = useState<string>("all")
  const [matchFilter, setMatchFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<DateWindowFilter>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedBook, setSelectedBook] = useState<BookFilterKey>(DEFAULT_BOOK_FILTER)
  const [selectedLineBook, setSelectedLineBook] = useState<BookFilterKey>(DEFAULT_BOOK_FILTER)
  const [showBookPicker, setShowBookPicker] = useState(false)
  const [bookPickerTarget, setBookPickerTarget] = useState<"odds" | "line">("odds")
  const activeBookOption = BOOK_OPTIONS_BY_KEY[selectedBook]
  const activeLineBookOption = BOOK_OPTIONS_BY_KEY[selectedLineBook]
  const bookTimelineData = useMemo(
    () => buildBookFilterTimeline(bookPickerTarget === "odds" ? selectedBook : selectedLineBook),
    [bookPickerTarget, selectedBook, selectedLineBook]
  )

  useEffect(() => {
    if (!accessConfig.allowedFilters.includes(filter)) {
      setFilter(accessConfig.allowedFilters[0] ?? "spread")
    }
  }, [accessConfig.allowedFilters, filter])

  useEffect(() => {
    setMatchFilter("all")
    setLeagueFilter("all")
    setSearchQuery("")
  }, [sport])

  const sortedEdges = useMemo(() => {
    const scoped = edges.filter(
      (game) =>
        hasMarketData(game, filter) &&
        isUpcomingGame(game.commenceTime)
    )
    const sorted = [...scoped].sort(
      (a, b) =>
        marketEdge(b, filter, resolveGameSportKey(b, sport)).edgePercent -
        marketEdge(a, filter, resolveGameSportKey(a, sport)).edgePercent
    )
    const maxRows = accessConfig.maxRows[filter]
    return Number.isFinite(maxRows) ? sorted.slice(0, maxRows) : sorted
  }, [edges, filter, sport, accessConfig.maxRows])
  const baseEdges = sortedEdges

  const leagueOptions = useMemo(() => {
    const dynamicOptions = baseEdges.map((game) =>
      resolveSportLabel(resolveGameSportKey(game, sport))
    )
    return ["all", ...Array.from(new Set([...DEFAULT_LEAGUE_FILTER_OPTIONS, ...dynamicOptions]))]
  }, [baseEdges, sport])

  const matchOptions = useMemo(
    () => ["all", ...Array.from(new Set(baseEdges.map((game) => `${game.awayTeam} vs ${game.homeTeam}`))).slice(0, 80)],
    [baseEdges]
  )

  useEffect(() => {
    if (matchFilter !== "all" && !matchOptions.includes(matchFilter)) {
      setMatchFilter("all")
    }
  }, [matchFilter, matchOptions])

  useEffect(() => {
    if (leagueFilter !== "all" && !leagueOptions.includes(leagueFilter)) {
      setLeagueFilter("all")
    }
  }, [leagueFilter, leagueOptions])

  const filteredEdges = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return baseEdges.filter((game) => {
      const leagueLabel = resolveSportLabel(resolveGameSportKey(game, sport))
      const matchupLabel = `${game.awayTeam} vs ${game.homeTeam}`
      const activePick = resolveActivePickForFilter(
        game,
        filter,
        resolveGameSportKey(game, sport)
      )
      const hasSelectedBookLine =
        resolveBookLineForGame(game, filter, activePick, selectedBook) != null

      if (leagueFilter !== "all" && leagueLabel !== leagueFilter) return false
      if (matchFilter !== "all" && matchupLabel !== matchFilter) return false
      if (!matchesDateWindow(game.commenceTime, dateFilter)) return false
      if (!hasSelectedBookLine) return false
      if (!query) return true
      return (
        matchupLabel.toLowerCase().includes(query) ||
        summarizeSharpSignalsPlain(game.sharpSignals).toLowerCase().includes(query)
      )
    })
  }, [baseEdges, sport, leagueFilter, matchFilter, dateFilter, searchQuery, filter, selectedBook])

  const visibleEdges = previewMode ? filteredEdges.slice(0, 1) : filteredEdges

  const filterLabels = resolveFilterLabels(filter)
  const handleBookSelect = (book: BookFilterKey) => {
    if (bookPickerTarget === "odds") {
      setSelectedBook(book)
    } else {
      setSelectedLineBook(book)
    }
    setShowBookPicker(false)
  }

  return (
    <>
      {showBookPicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="relative h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-black">
            <button
              type="button"
              onClick={() => setShowBookPicker(false)}
              className="absolute right-4 top-4 z-[60] rounded-md border border-white/20 bg-black/60 px-3 py-1.5 text-xs text-white/80 hover:border-white/40"
            >
              Close
            </button>
            <div className="absolute left-4 top-4 z-[60] rounded-md border border-white/15 bg-black/70 px-3 py-2 text-xs text-white/80">
              {bookPickerTarget === "odds"
                ? "Select sportsbook for odds"
                : "Select sportsbook for line"}
            </div>
            <RadialOrbitalTimeline
              timelineData={bookTimelineData}
              onItemSelect={(id) => {
                const option = BOOK_OPTIONS[id - 1]
                if (!option) return
                handleBookSelect(option.key)
              }}
            />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={leagueFilter}
            onChange={(event) => setLeagueFilter(event.target.value)}
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
          >
            {leagueOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "League: All" : `League: ${value}`}
              </option>
            ))}
          </select>

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as EdgeFilter)}
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
          >
            {accessConfig.allowedFilters.map((value) => (
              <option key={value} value={value}>
                {value === "spread"
                  ? "Stat: Spread"
                  : value === "moneyline"
                    ? "Stat: Moneyline"
                    : "Stat: Total"}
              </option>
            ))}
          </select>

          <select
            value={matchFilter}
            onChange={(event) => setMatchFilter(event.target.value)}
            className="max-w-[220px] rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
          >
            {matchOptions.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "Match: All" : value}
              </option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value as DateWindowFilter)}
            className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
          >
            <option value="today">Date: Today</option>
            <option value="24h">Date: 24h</option>
            <option value="3d">Date: 3d</option>
            <option value="all">Date: All</option>
          </select>

          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search teams..."
            className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-300/60 focus:outline-none"
          />

          <button
            type="button"
            onClick={() => {
              setBookPickerTarget("odds")
              setShowBookPicker(true)
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-black/40 px-2 py-1.5 text-xs text-white/85 transition-colors hover:border-emerald-300/60"
          >
            <Image
              src={activeBookOption.logoSrc}
              alt={activeBookOption.label}
              width={34}
              height={34}
              className="h-[34px] w-[34px] rounded-md object-contain"
            />
            <span>Book: {activeBookOption.label}</span>
          </button>

          <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
            <span>live</span>
            <span>|</span>
            <span>{visibleEdges.length} rows</span>
          </div>
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
                const gameSport = resolveGameSportKey(game, sport)
                const edgeMetrics = marketEdge(game, filter, gameSport)
                const spreadPick = resolveSpreadEdgePick(game, gameSport)
                const totalPick = resolveTotalEdgePick(game, gameSport)
                const moneylinePick = resolveMoneylineEdgePick(game, gameSport)
                const activePick =
                  filter === "spread"
                    ? spreadPick
                    : filter === "moneyline"
                      ? moneylinePick
                      : totalPick
                const moveSummary = resolveMoveSummary(game, filter)
                const sharpLine = resolveSharpLineDisplay(game, filter, activePick, selectedBook)
                const sharePayload = buildProjectionSharePayload(
                  game,
                  filter,
                  gameSport,
                  activePick,
                  edgeMetrics.edgePercent,
                  selectedBook
                )

                return (
                  <article
                    key={`${game.matchup}-${game.commenceTime}`}
                    className="space-y-3 px-3 py-3 text-xs text-white/70 transition-colors hover:bg-white/[0.03]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                          #{index + 1} | {resolveSportLabel(gameSport)} | {formatShortDateTime(game.commenceTime)}
                        </div>
                        <div className="text-left text-sm font-semibold text-white">
                          {game.awayTeam} vs {game.homeTeam}
                        </div>
                      </div>
                      <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                        +{edgeMetrics.edgePercent.toFixed(1)}%
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Bet</div>
                        <div className="mt-1 text-white">{activePick.label ?? "n/a"}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                          <button
                            type="button"
                            onClick={() => {
                              setBookPickerTarget("line")
                              setShowBookPicker(true)
                            }}
                            className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                          >
                            <Image
                              src={activeLineBookOption.logoSrc}
                              alt={activeLineBookOption.label}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-md object-contain"
                            />
                            <span className="sr-only">Line Book</span>
                          </button>
                        </div>
                        <div className="mt-1 text-white">
                          {resolveLineCellValue(game, filter, activePick, selectedLineBook)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">% To Hit</div>
                        <div className="mt-1 text-white">
                          {activePick.projection
                            ? formatProbability(activePick.projection.probability)
                            : "n/a"}
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Market</div>
                        <div className="mt-1 text-white">
                          {filter === "spread" ? "Spread" : filter === "moneyline" ? "Moneyline" : "Total"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Line Movement</div>
                        <div className="mt-1 text-white/75">{moveSummary || "No line movement yet."}</div>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">
                          <button
                            type="button"
                            onClick={() => {
                              setBookPickerTarget("odds")
                              setShowBookPicker(true)
                            }}
                            className="inline-flex items-center gap-1 transition-opacity hover:opacity-80"
                          >
                            <Image
                              src={activeBookOption.logoSrc}
                              alt={activeBookOption.label}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded-md object-contain"
                            />
                            <span className="sr-only">{filterLabels.odds}</span>
                          </button>
                        </div>
                        <div className="mt-1 text-white/75">{sharpLine}</div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <ShareProjectionButton projection={sharePayload} />
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden sm:block">
              <div className="overflow-x-auto">
                <Table className="min-w-[1320px] text-[13px] text-white/75">
                  <TableHeader className="bg-black/70">
                    <TableRow className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                      <TableHead className="w-[85px]">Edge</TableHead>
                      <TableHead className="w-[240px]">Game</TableHead>
                      <TableHead className="w-[190px]">Bet</TableHead>
                      <TableHead className="w-[80px]">
                        <button
                          type="button"
                          onClick={() => {
                            setBookPickerTarget("line")
                            setShowBookPicker(true)
                          }}
                          className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                        >
                          <Image
                            src={activeLineBookOption.logoSrc}
                            alt={activeLineBookOption.label}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-md object-contain"
                          />
                          <span className="sr-only">Line Book</span>
                        </button>
                      </TableHead>
                      <TableHead className="w-[100px]">Market</TableHead>
                      <TableHead className="w-[90px]">% To Hit</TableHead>
                      <TableHead className="w-[230px]">Line Movement</TableHead>
                      <TableHead className="w-[170px]">
                        <button
                          type="button"
                          onClick={() => {
                            setBookPickerTarget("odds")
                            setShowBookPicker(true)
                          }}
                          className="inline-flex items-center gap-2 transition-opacity hover:opacity-80"
                        >
                          <Image
                            src={activeBookOption.logoSrc}
                            alt={activeBookOption.label}
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-md object-contain"
                          />
                          <span className="sr-only">{filterLabels.odds}</span>
                        </button>
                      </TableHead>
                      <TableHead className="w-[90px] text-right">Share</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-white/5">
                    {visibleEdges.map((game, index) => {
                      const gameSport = resolveGameSportKey(game, sport)
                      const edgeMetrics = marketEdge(game, filter, gameSport)
                      const spreadPick = resolveSpreadEdgePick(game, gameSport)
                      const totalPick = resolveTotalEdgePick(game, gameSport)
                      const moneylinePick = resolveMoneylineEdgePick(game, gameSport)
                      const activePick =
                        filter === "spread"
                          ? spreadPick
                          : filter === "moneyline"
                            ? moneylinePick
                            : totalPick
                      const moveSummary = resolveMoveSummary(game, filter)
                      const sharpLine = resolveSharpLineDisplay(game, filter, activePick, selectedBook)
                      const sharePayload = buildProjectionSharePayload(
                        game,
                        filter,
                        gameSport,
                        activePick,
                        edgeMetrics.edgePercent,
                        selectedBook
                      )

                      return (
                        <TableRow
                          key={`${game.matchup}-${game.commenceTime}`}
                          className="border-white/5 transition-colors hover:bg-white/[0.03]"
                        >
                          <TableCell className="align-top">
                            <span className="rounded-md border border-emerald-400/45 bg-emerald-500/15 px-2 py-1 text-xs font-semibold text-emerald-200">
                              +{edgeMetrics.edgePercent.toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="align-top">
                            <div className="text-left text-sm font-semibold text-white">
                              {game.awayTeam} vs {game.homeTeam}
                            </div>
                            <div className="mt-1 text-[11px] uppercase tracking-[0.15em] text-white/40">
                              #{index + 1} | {resolveSportLabel(gameSport)} | {formatShortDateTime(game.commenceTime)}
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-white/85">
                            {activePick.label ?? "n/a"}
                          </TableCell>
                          <TableCell className="align-top">
                            {resolveLineCellValue(game, filter, activePick, selectedLineBook)}
                          </TableCell>
                          <TableCell className="align-top">
                            {filter === "spread" ? "Spread" : filter === "moneyline" ? "Moneyline" : "Total"}
                          </TableCell>
                          <TableCell className="align-top">
                            {activePick.projection
                              ? formatProbability(activePick.projection.probability)
                              : "n/a"}
                          </TableCell>
                          <TableCell className="align-top text-white/70">
                            {moveSummary || "No line movement yet."}
                          </TableCell>
                          <TableCell className="align-top text-white/70">
                            {sharpLine}
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

const resolveActivePickForFilter = (game: EdgeGame, filter: EdgeFilter, sport?: string) => {
  const spreadPick = resolveSpreadEdgePick(game, sport)
  const totalPick = resolveTotalEdgePick(game, sport)
  const moneylinePick = resolveMoneylineEdgePick(game, sport)
  if (filter === "spread") return spreadPick
  if (filter === "moneyline") return moneylinePick
  return totalPick
}

const buildBookFilterTimeline = (selectedBook: BookFilterKey): TimelineItem[] =>
  BOOK_OPTIONS.map((book, index) => {
    const previous = index === 0 ? BOOK_OPTIONS[BOOK_OPTIONS.length - 1] : BOOK_OPTIONS[index - 1]
    const next = index === BOOK_OPTIONS.length - 1 ? BOOK_OPTIONS[0] : BOOK_OPTIONS[index + 1]
    return {
      id: index + 1,
      title: book.label,
      date: "Live",
      content: `Use ${book.label} as the active sportsbook source for Sharp Projections.`,
      category: "Sportsbook",
      icon: book.icon,
      logoSrc: book.logoSrc,
      relatedIds: [
        BOOK_OPTIONS.findIndex((item) => item.key === previous.key) + 1,
        BOOK_OPTIONS.findIndex((item) => item.key === next.key) + 1,
      ],
      status: book.key === selectedBook ? "in-progress" : "pending",
      energy: book.key === selectedBook ? 100 : 62,
    }
  })







