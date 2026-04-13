"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type EdgeFilter = "all" | "spread" | "moneyline" | "total"
type MarketKey = Exclude<EdgeFilter, "all">
type AccessTier = "free" | "sharp" | "syndicate" | null

type BookSpreadQuote = {
  homeLine?: number
  homeOdds?: number
  homeLimit?: number
  awayLine?: number
  awayOdds?: number
  awayLimit?: number
}

type BookTotalQuote = {
  line?: number
  overOdds?: number
  underOdds?: number
  overLimit?: number
  underLimit?: number
}

type BookMoneylineQuote = {
  homeOdds?: number
  awayOdds?: number
  homeLimit?: number
  awayLimit?: number
}

type LineMovement = {
  market?: string
  openingLine?: string | number
  currentLine?: string | number
  isSharp?: boolean
  isSignificant?: boolean
}

type EdgeGame = {
  oddsApiId?: string
  sport?: string
  matchup?: string
  homeTeam?: string
  awayTeam?: string
  commenceTime?: string
  commence_time?: string
  spread?: {
    bookQuotes?: Record<string, BookSpreadQuote>
  }
  total?: {
    bookQuotes?: Record<string, BookTotalQuote>
  }
  moneyline?: {
    bookQuotes?: Record<string, BookMoneylineQuote>
  }
  lineMovements?: LineMovement[]
}

type MovementRow = {
  id: string
  oddsApiId?: string
  sport: string
  homeTeam: string
  awayTeam: string
  matchup: string
  commenceTime: string | null
  market: MarketKey
  marketLabel: string
  pinnacleLine: string
  pinnacleOdds: string
  movementLabel: string
  movementDelta: number | null
  movementMagnitude: number
  isSharpMove: boolean
  isSignificantMove: boolean
  limitLabel: string
  limitExpansion: number | null
  maxLimit: number | null
  score: number
}

type LimitHistoryPoint = {
  t: string
  score: number | null
  label: string | null
  forLimit: number | null
  againstLimit: number | null
  netLimit: number | null
  line?: number | null
  odds?: number | null
}

type HistoryLinePoint = {
  t: string
  line: number
}

type HistoryOddsPoint = {
  t: string
  odds: number
}

type HourlyMovementPoint = {
  t: string
  line: number | null
  odds: number | null
}

type PriceLevelRow = {
  line: number | null
  odds: number | null
  maxForLimit: number | null
  maxAgainstLimit: number | null
  maxAbsNetLimit: number | null
  latestForLimit: number | null
  latestAgainstLimit: number | null
  latestNetLimit: number | null
  lastSeen: string
  samples: number
}

const MARKET_LABELS: Record<MarketKey, string> = {
  spread: "Spread",
  total: "Total",
  moneyline: "Moneyline",
}

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: "NBA",
  basketball_wnba: "WNBA",
  basketball_ncaab: "NCAAB",
  americanfootball_nfl: "NFL",
  americanfootball_ncaaf: "CFB",
  icehockey_nhl: "NHL",
  baseball_mlb: "MLB",
}

const SHARP_BOOK_PRIORITY = ["pinnacle", "circa", "novig", "prophetx"]
const FILTERS: EdgeFilter[] = ["all", "spread", "moneyline", "total"]

const coerceNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const direct = Number(value)
    if (Number.isFinite(direct)) return direct
    const match = value.match(/[-+]?\d+(\.\d+)?/)
    if (!match) return null
    const parsed = Number(match[0])
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const americanToImplied = (odds: number | null) => {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

const formatSignedNumber = (value: number | null, digits = 1) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits)
}

const formatOdds = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const formatLineValue = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2)
}

const formatLimit = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `$${Math.round(value).toLocaleString("en-US")}`
}

const formatSignedLimit = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  const rounded = Math.round(value)
  const formatted = `$${Math.abs(rounded).toLocaleString("en-US")}`
  return rounded > 0 ? `+${formatted}` : rounded < 0 ? `-${formatted}` : "$0"
}

const toPercentRatio = (value: number | null, max: number) => {
  if (value == null || !Number.isFinite(value) || max <= 0) return 0
  const ratio = (Math.abs(value) / max) * 100
  return Math.max(0, Math.min(100, ratio))
}

const formatShortTime = (value?: string | null) => {
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

const resolveSportLabel = (sport?: string | null) => {
  if (!sport) return "N/A"
  return SPORT_LABELS[sport] ?? sport
}

const normalizeMarket = (market?: string | null): MarketKey | null => {
  const token = String(market ?? "").toLowerCase()
  if (!token) return null
  if (token.includes("spread")) return "spread"
  if (token.includes("total") || token.includes("ou")) return "total"
  if (
    token.includes("moneyline") ||
    token.includes("h2h") ||
    token.includes("ml")
  ) {
    return "moneyline"
  }
  return null
}

const pickSharpQuote = <T,>(quotes?: Record<string, T>) => {
  if (!quotes || typeof quotes !== "object") return null
  for (const book of SHARP_BOOK_PRIORITY) {
    const quote = quotes[book]
    if (quote && typeof quote === "object") return quote
  }
  return null
}

const resolveMovement = (movements: LineMovement[] | undefined, market: MarketKey) => {
  if (!Array.isArray(movements) || !movements.length) {
    return {
      openingText: "n/a",
      currentText: "n/a",
      delta: null as number | null,
      isSharp: false,
      isSignificant: false,
      magnitude: 0,
    }
  }

  const candidates = movements.filter((move) => normalizeMarket(move.market) === market)
  if (!candidates.length) {
    return {
      openingText: "n/a",
      currentText: "n/a",
      delta: null as number | null,
      isSharp: false,
      isSignificant: false,
      magnitude: 0,
    }
  }

  const picked = candidates.find((move) => move.isSharp || move.isSignificant) ?? candidates[0]
  const openingNumeric = coerceNumber(picked.openingLine)
  const currentNumeric = coerceNumber(picked.currentLine)
  const delta =
    openingNumeric != null && currentNumeric != null
      ? currentNumeric - openingNumeric
      : null

  let magnitude = 0
  if (market === "moneyline") {
    const openProb = americanToImplied(openingNumeric)
    const currentProb = americanToImplied(currentNumeric)
    magnitude =
      openProb != null && currentProb != null ? Math.abs(currentProb - openProb) * 100 : 0
  } else {
    magnitude = delta != null ? Math.abs(delta) : 0
  }

  return {
    openingText: String(picked.openingLine ?? "n/a"),
    currentText: String(picked.currentLine ?? "n/a"),
    delta,
    isSharp: Boolean(picked.isSharp),
    isSignificant: Boolean(picked.isSignificant),
    magnitude,
  }
}

const resolveLimitMetrics = (limits: Array<number | null>) => {
  const valid = limits.filter((value): value is number =>
    value != null && Number.isFinite(value) && value > 0
  )

  if (!valid.length) {
    return {
      maxLimit: null as number | null,
      expansion: null as number | null,
      label: "No limit data",
      score: 0,
    }
  }

  const maxLimit = Math.max(...valid)
  const minLimit = Math.min(...valid)
  const expansion = maxLimit - minLimit

  let label = "Balanced"
  if (expansion >= 10000) label = "Strong expansion"
  else if (expansion >= 4000) label = "Expansion"
  else if (expansion >= 1500) label = "Light expansion"

  const score = expansion / 1000 + maxLimit / 10000

  return {
    maxLimit,
    expansion,
    label,
    score,
  }
}

const resolvePinnacleMarketDisplay = (game: EdgeGame, market: MarketKey) => {
  if (market === "spread") {
    const quote = pickSharpQuote(game.spread?.bookQuotes)
    const homeLine = coerceNumber((quote as BookSpreadQuote | null)?.homeLine)
    const awayLine = coerceNumber((quote as BookSpreadQuote | null)?.awayLine)
    const homeOdds = coerceNumber((quote as BookSpreadQuote | null)?.homeOdds)
    const awayOdds = coerceNumber((quote as BookSpreadQuote | null)?.awayOdds)
    const homeLimit = coerceNumber((quote as BookSpreadQuote | null)?.homeLimit)
    const awayLimit = coerceNumber((quote as BookSpreadQuote | null)?.awayLimit)

    return {
      line: `H ${formatSignedNumber(homeLine)} / A ${formatSignedNumber(awayLine)}`,
      odds: `H ${formatOdds(homeOdds)} / A ${formatOdds(awayOdds)}`,
      limits: [homeLimit, awayLimit],
    }
  }

  if (market === "total") {
    const quote = pickSharpQuote(game.total?.bookQuotes)
    const line = coerceNumber((quote as BookTotalQuote | null)?.line)
    const overOdds = coerceNumber((quote as BookTotalQuote | null)?.overOdds)
    const underOdds = coerceNumber((quote as BookTotalQuote | null)?.underOdds)
    const overLimit = coerceNumber((quote as BookTotalQuote | null)?.overLimit)
    const underLimit = coerceNumber((quote as BookTotalQuote | null)?.underLimit)

    return {
      line: `O/U ${line != null ? line.toFixed(1) : "n/a"}`,
      odds: `O ${formatOdds(overOdds)} / U ${formatOdds(underOdds)}`,
      limits: [overLimit, underLimit],
    }
  }

  const quote = pickSharpQuote(game.moneyline?.bookQuotes)
  const homeOdds = coerceNumber((quote as BookMoneylineQuote | null)?.homeOdds)
  const awayOdds = coerceNumber((quote as BookMoneylineQuote | null)?.awayOdds)
  const homeLimit = coerceNumber((quote as BookMoneylineQuote | null)?.homeLimit)
  const awayLimit = coerceNumber((quote as BookMoneylineQuote | null)?.awayLimit)

  return {
    line: "Moneyline",
    odds: `H ${formatOdds(homeOdds)} / A ${formatOdds(awayOdds)}`,
    limits: [homeLimit, awayLimit],
  }
}

const buildRows = (edges: EdgeGame[]): MovementRow[] => {
  const rows: MovementRow[] = []

  for (const game of edges) {
    const homeTeam = String(game.homeTeam ?? "").trim()
    const awayTeam = String(game.awayTeam ?? "").trim()
    if (!homeTeam || !awayTeam) continue

    const matchup = game.matchup || `${awayTeam} @ ${homeTeam}`
    const sport = String(game.sport ?? "")
    const commenceTime =
      typeof game.commenceTime === "string"
        ? game.commenceTime
        : typeof game.commence_time === "string"
          ? game.commence_time
          : null

    const markets: MarketKey[] = ["spread", "moneyline", "total"]

    for (const market of markets) {
      const movement = resolveMovement(game.lineMovements, market)
      const pinnacle = resolvePinnacleMarketDisplay(game, market)
      const limits = resolveLimitMetrics(pinnacle.limits)

      const movementScore = movement.magnitude * 8
      const flagScore = (movement.isSharp ? 2 : 0) + (movement.isSignificant ? 1 : 0)
      const score = movementScore + limits.score + flagScore

      rows.push({
        id: `${game.oddsApiId ?? matchup}|${market}`,
        oddsApiId: game.oddsApiId,
        sport,
        homeTeam,
        awayTeam,
        matchup,
        commenceTime,
        market,
        marketLabel: MARKET_LABELS[market],
        pinnacleLine: pinnacle.line,
        pinnacleOdds: pinnacle.odds,
        movementLabel: `${movement.openingText} -> ${movement.currentText}`,
        movementDelta: movement.delta,
        movementMagnitude: movement.magnitude,
        isSharpMove: movement.isSharp,
        isSignificantMove: movement.isSignificant,
        limitLabel: limits.label,
        limitExpansion: limits.expansion,
        maxLimit: limits.maxLimit,
        score,
      })
    }
  }

  return rows
}

const resolveDefaultSide = (market: MarketKey) =>
  market === "total" ? "over" : "home"

export default function MarketProjectionsTable({
  edges,
  errorMessage,
  sport,
  tier,
  previewMode = false,
}: {
  edges: EdgeGame[]
  errorMessage?: string | null
  sport: string
  tier?: AccessTier
  previewMode?: boolean
}) {
  const [filter, setFilter] = useState<EdgeFilter>("all")
  const [historyRow, setHistoryRow] = useState<MovementRow | null>(null)
  const [historyPoints, setHistoryPoints] = useState<LimitHistoryPoint[]>([])
  const [historyLineSeries, setHistoryLineSeries] = useState<HistoryLinePoint[]>([])
  const [historyOddsSeries, setHistoryOddsSeries] = useState<HistoryOddsPoint[]>([])
  const [historyHourlySeries, setHistoryHourlySeries] = useState<HourlyMovementPoint[]>([])
  const [historyPriceLevels, setHistoryPriceLevels] = useState<PriceLevelRow[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const rows = useMemo(() => {
    const mappedRows = buildRows(edges)
      .filter((row) => (sport === "all" ? true : row.sport === sport))
      .filter((row) => (filter === "all" ? true : row.market === filter))
      .sort((a, b) => b.score - a.score)

    if (!previewMode) return mappedRows
    return mappedRows.slice(0, 12)
  }, [edges, sport, filter, previewMode])

  const maxMovementMagnitude = useMemo(() => {
    if (!rows.length) return 1
    return Math.max(
      1,
      ...rows.map((row) =>
        Number.isFinite(row.movementMagnitude) ? Math.abs(row.movementMagnitude) : 0
      )
    )
  }, [rows])

  const maxLimitExpansion = useMemo(() => {
    if (!rows.length) return 1
    return Math.max(
      1,
      ...rows.map((row) =>
        row.limitExpansion != null && Number.isFinite(row.limitExpansion)
          ? Math.abs(row.limitExpansion)
          : 0
      )
    )
  }, [rows])

  useEffect(() => {
    if (!historyRow) return

    const controller = new AbortController()
    const load = async () => {
      setHistoryLoading(true)
      setHistoryError(null)
      try {
        const params = new URLSearchParams({
          market: historyRow.market,
          side: resolveDefaultSide(historyRow.market),
          hours: "72",
          limit: "1000",
        })

        if (historyRow.sport) params.set("sport", historyRow.sport)
        params.set("homeTeam", historyRow.homeTeam)
        params.set("awayTeam", historyRow.awayTeam)
        if (historyRow.commenceTime) {
          params.set("commenceTime", historyRow.commenceTime)
        }
        if (historyRow.oddsApiId) {
          params.set("oddsApiId", historyRow.oddsApiId)
        }

        const response = await fetch(
          `/api/market-projections/limit-history?${params.toString()}`,
          {
            signal: controller.signal,
            cache: "no-store",
          }
        )

        if (!response.ok) throw new Error("Failed to fetch limit history.")
        const payload = await response.json()
        const points = Array.isArray(payload?.points)
          ? (payload.points as LimitHistoryPoint[])
          : []
        const apiLineSeries = Array.isArray(payload?.lineSeries)
          ? (payload.lineSeries as Array<{ t?: string; line?: number | null }>)
          : []
        const apiOddsSeries = Array.isArray(payload?.oddsSeries)
          ? (payload.oddsSeries as Array<{ t?: string; odds?: number | null }>)
          : []
        const apiHourlySeries = Array.isArray(payload?.hourlySeries)
          ? (payload.hourlySeries as Array<{ t?: string; line?: number | null; odds?: number | null }>)
          : []
        const priceLevels = Array.isArray(payload?.priceLevels)
          ? (payload.priceLevels as PriceLevelRow[])
          : []
        const normalizedPoints = points
          .filter((point) => typeof point.t === "string" && point.t)
          .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
        setHistoryPoints(normalizedPoints)
        setHistoryLineSeries(
          apiLineSeries
            .filter(
              (point): point is { t: string; line: number } =>
                typeof point?.t === "string" &&
                point.t.length > 0 &&
                typeof point?.line === "number" &&
                Number.isFinite(point.line)
            )
            .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
        )
        setHistoryOddsSeries(
          apiOddsSeries
            .filter(
              (point): point is { t: string; odds: number } =>
                typeof point?.t === "string" &&
                point.t.length > 0 &&
                typeof point?.odds === "number" &&
                Number.isFinite(point.odds)
            )
            .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
        )
        setHistoryHourlySeries(
          apiHourlySeries
            .filter(
              (point): point is { t: string; line: number | null; odds: number | null } =>
                typeof point?.t === "string" &&
                point.t.length > 0 &&
                ((typeof point?.line === "number" && Number.isFinite(point.line)) ||
                  (typeof point?.odds === "number" && Number.isFinite(point.odds)))
            )
            .map((point) => ({
              t: point.t,
              line:
                typeof point.line === "number" && Number.isFinite(point.line)
                  ? point.line
                  : null,
              odds:
                typeof point.odds === "number" && Number.isFinite(point.odds)
                  ? point.odds
                  : null,
            }))
            .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))
        )
        setHistoryPriceLevels(priceLevels)
      } catch (error) {
        if (controller.signal.aborted) return
        setHistoryError(
          error instanceof Error ? error.message : "Failed to load limit history."
        )
        setHistoryPoints([])
        setHistoryLineSeries([])
        setHistoryOddsSeries([])
        setHistoryHourlySeries([])
        setHistoryPriceLevels([])
      } finally {
        if (!controller.signal.aborted) setHistoryLoading(false)
      }
    }

    load()
    return () => controller.abort()
  }, [historyRow])

  const hasHistoryLine = useMemo(
    () =>
      historyLineSeries.length > 0 ||
      historyHourlySeries.some(
        (point) => point.line != null && Number.isFinite(point.line)
      ),
    [historyLineSeries, historyHourlySeries]
  )

  const hasHistoryOdds = useMemo(
    () =>
      historyOddsSeries.length > 0 ||
      historyHourlySeries.some(
        (point) => point.odds != null && Number.isFinite(point.odds)
      ),
    [historyOddsSeries, historyHourlySeries]
  )

  const hourlyLineSeries = useMemo(
    () =>
      historyHourlySeries
        .filter(
          (point): point is { t: string; line: number; odds: number | null } =>
            point.line != null && Number.isFinite(point.line)
        )
        .map((point) => ({ t: point.t, line: point.line })),
    [historyHourlySeries]
  )

  const hourlyOddsSeries = useMemo(
    () =>
      historyHourlySeries
        .filter(
          (point): point is { t: string; line: number | null; odds: number } =>
            point.odds != null && Number.isFinite(point.odds)
        )
        .map((point) => ({ t: point.t, odds: point.odds })),
    [historyHourlySeries]
  )

  const lineSeries = useMemo(
    () =>
      hourlyLineSeries.length
        ? hourlyLineSeries
        : historyLineSeries.length
        ? historyLineSeries
        : historyPoints
            .filter((point) => point.line != null)
            .map((point) => ({ t: point.t, line: point.line as number })),
    [hourlyLineSeries, historyLineSeries, historyPoints]
  )

  const oddsSeries = useMemo(
    () =>
      hourlyOddsSeries.length
        ? hourlyOddsSeries
        : historyOddsSeries.length
        ? historyOddsSeries
        : historyPoints
            .filter((point) => point.odds != null)
            .map((point) => ({ t: point.t, odds: point.odds as number })),
    [hourlyOddsSeries, historyOddsSeries, historyPoints]
  )

  const limitSeries = useMemo(
    () =>
      historyPoints.map((point) => ({
        t: point.t,
        forLimit: point.forLimit,
        againstLimit: point.againstLimit,
        netLimit: point.netLimit,
    })),
    [historyPoints]
  )

  const lineDelta = useMemo(() => {
    if (lineSeries.length < 2) return null
    const first = lineSeries[0]?.line
    const last = lineSeries[lineSeries.length - 1]?.line
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null
    return (last as number) - (first as number)
  }, [lineSeries])

  const oddsDelta = useMemo(() => {
    if (oddsSeries.length < 2) return null
    const first = oddsSeries[0]?.odds
    const last = oddsSeries[oddsSeries.length - 1]?.odds
    if (!Number.isFinite(first) || !Number.isFinite(last)) return null
    return (last as number) - (first as number)
  }, [oddsSeries])

  const limitRange = useMemo(() => {
    if (!limitSeries.length) return null
    const valid = limitSeries
      .map((point) => point.netLimit)
      .filter((value): value is number => value != null && Number.isFinite(value))
    if (!valid.length) return null
    return Math.max(...valid) - Math.min(...valid)
  }, [limitSeries])

  const hasLimitSeries = useMemo(
    () =>
      limitSeries.some(
        (point) =>
          point.forLimit != null || point.againstLimit != null || point.netLimit != null
      ),
    [limitSeries]
  )

  const hasAnyHistory = useMemo(
    () =>
      historyPoints.length > 0 ||
      lineSeries.length > 0 ||
      oddsSeries.length > 0 ||
      historyHourlySeries.length > 0,
    [historyPoints.length, lineSeries.length, oddsSeries.length, historyHourlySeries.length]
  )

  const effectivePriceLevels = useMemo(() => {
    if (historyPriceLevels.length) return historyPriceLevels

    const byKey = new Map<string, PriceLevelRow>()
    for (const point of historyPoints) {
      const hasPrice = point.line != null || point.odds != null
      const hasLimit =
        point.forLimit != null || point.againstLimit != null || point.netLimit != null
      if (!hasPrice || !hasLimit) continue

      const lineKey = point.line == null ? "na" : String(point.line)
      const oddsKey = point.odds == null ? "na" : String(point.odds)
      const key = `${lineKey}|${oddsKey}`
      const existing = byKey.get(key)
      if (!existing) {
        byKey.set(key, {
          line: point.line ?? null,
          odds: point.odds ?? null,
          maxForLimit: point.forLimit ?? null,
          maxAgainstLimit: point.againstLimit ?? null,
          maxAbsNetLimit: point.netLimit != null ? Math.abs(point.netLimit) : null,
          latestForLimit: point.forLimit ?? null,
          latestAgainstLimit: point.againstLimit ?? null,
          latestNetLimit: point.netLimit ?? null,
          lastSeen: point.t,
          samples: 1,
        })
        continue
      }

      existing.maxForLimit =
        existing.maxForLimit == null
          ? (point.forLimit ?? null)
          : Math.max(existing.maxForLimit, point.forLimit ?? existing.maxForLimit)
      existing.maxAgainstLimit =
        existing.maxAgainstLimit == null
          ? (point.againstLimit ?? null)
          : Math.max(existing.maxAgainstLimit, point.againstLimit ?? existing.maxAgainstLimit)
      const absNet = point.netLimit != null ? Math.abs(point.netLimit) : null
      existing.maxAbsNetLimit =
        existing.maxAbsNetLimit == null
          ? absNet
          : Math.max(existing.maxAbsNetLimit, absNet ?? existing.maxAbsNetLimit)
      if (Date.parse(point.t) >= Date.parse(existing.lastSeen)) {
        existing.latestForLimit = point.forLimit ?? null
        existing.latestAgainstLimit = point.againstLimit ?? null
        existing.latestNetLimit = point.netLimit ?? null
        existing.lastSeen = point.t
      }
      existing.samples += 1
    }

    return Array.from(byKey.values()).sort((a, b) => {
      const aNet = Math.abs(a.latestNetLimit ?? 0)
      const bNet = Math.abs(b.latestNetLimit ?? 0)
      if (bNet !== aNet) return bNet - aNet
      const aDepth = Math.max(a.maxForLimit ?? 0, a.maxAgainstLimit ?? 0)
      const bDepth = Math.max(b.maxForLimit ?? 0, b.maxAgainstLimit ?? 0)
      return bDepth - aDepth
    })
  }, [historyPoints, historyPriceLevels])

  const maxLatestNet = useMemo(() => {
    if (!effectivePriceLevels.length) return 1
    return Math.max(1, ...effectivePriceLevels.map((row) => Math.abs(row.latestNetLimit ?? 0)))
  }, [effectivePriceLevels])

  const maxPriceDepth = useMemo(() => {
    if (!effectivePriceLevels.length) return 1
    return Math.max(
      1,
      ...effectivePriceLevels.map((row) => Math.max(row.maxForLimit ?? 0, row.maxAgainstLimit ?? 0))
    )
  }, [effectivePriceLevels])

  const isPaidTier = tier === "sharp" || tier === "syndicate"

  return (
    <section className="space-y-4 rounded-2xl border border-white/10 bg-black/50 p-4 sm:p-5">
      <div className="space-y-2">
        <p className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/75">Sharp Movement</p>
        <h2 className="text-xl font-semibold text-white sm:text-2xl">
          Pinnacle line movement and limit expansion board
        </h2>
        <p className="text-sm text-white/65">
          Ranked by market movement strength, limit expansion, and sharp-flagged velocity from
          sharp books.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => {
          const active = filter === item
          return (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] transition ${
                active
                  ? "border-emerald-400/60 bg-emerald-500/20 text-emerald-200"
                  : "border-white/15 bg-black/40 text-white/65 hover:border-white/25 hover:text-white"
              }`}
            >
              {item === "all" ? "All Markets" : MARKET_LABELS[item]}
            </button>
          )
        })}
        <div className="ml-auto rounded-full border border-white/15 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
          Source: Pinnacle-first
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          {errorMessage}
        </div>
      ) : null}

      {!rows.length ? (
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-10 text-center text-sm text-white/60">
          No sharp movement rows available yet.
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-white/10 md:block">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                  <TableHead>Matchup</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Market</TableHead>
                  <TableHead>Pinnacle Line</TableHead>
                  <TableHead>Pinnacle Odds</TableHead>
                  <TableHead>Line Move</TableHead>
                  <TableHead>Limit Expansion</TableHead>
                  <TableHead>Max Limit</TableHead>
                  <TableHead>Visuals</TableHead>
                  <TableHead className="text-right">History</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id} className="border-white/10 hover:bg-white/5">
                    <TableCell>
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-white">{row.matchup}</p>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                          {resolveSportLabel(row.sport)}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-white/75">
                      {formatShortTime(row.commenceTime)}
                    </TableCell>
                    <TableCell className="text-sm text-white/80">{row.marketLabel}</TableCell>
                    <TableCell className="text-sm text-white/80">{row.pinnacleLine}</TableCell>
                    <TableCell className="text-sm text-white/80">{row.pinnacleOdds}</TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-white/80">
                        <p>{row.movementLabel}</p>
                        <p className="text-[11px] uppercase tracking-[0.14em] text-emerald-200/80">
                          {row.movementDelta == null
                            ? "No numeric delta"
                            : `Delta ${formatSignedNumber(row.movementDelta, row.market === "moneyline" ? 0 : 2)}`}
                          {row.isSharpMove ? " - Sharp" : ""}
                          {!row.isSharpMove && row.isSignificantMove ? " - Significant" : ""}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1 text-sm text-white/80">
                        <p>{row.limitLabel}</p>
                        <p className="text-[11px] text-white/55">
                          {row.limitExpansion == null
                            ? "n/a"
                            : `${formatLimit(row.limitExpansion)} spread`}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-white/80">
                      {formatLimit(row.maxLimit)}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/45">
                            <span>Line/Odds Move</span>
                            <span>{toPercentRatio(row.movementMagnitude, maxMovementMagnitude).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                              style={{
                                width: `${toPercentRatio(
                                  row.movementMagnitude,
                                  maxMovementMagnitude
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/45">
                            <span>Limit Spread</span>
                            <span>{toPercentRatio(row.limitExpansion, maxLimitExpansion).toFixed(0)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div
                              className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300"
                              style={{
                                width: `${toPercentRatio(
                                  row.limitExpansion,
                                  maxLimitExpansion
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        onClick={() => setHistoryRow(row)}
                        className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70 transition hover:border-emerald-400/50 hover:text-emerald-200"
                      >
                        View
                      </button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="space-y-3 md:hidden">
            {rows.map((row) => (
              <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{row.matchup}</p>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-white/45">
                      {resolveSportLabel(row.sport)} - {row.marketLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHistoryRow(row)}
                    className="rounded-lg border border-white/20 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70"
                  >
                    History
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-white/70">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Start</p>
                    <p>{formatShortTime(row.commenceTime)}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Pinnacle Line</p>
                    <p>{row.pinnacleLine}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Pinnacle Odds</p>
                    <p>{row.pinnacleOdds}</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Max Limit</p>
                    <p>{formatLimit(row.maxLimit)}</p>
                  </div>
                </div>

                <div className="mt-3 rounded-lg border border-white/10 bg-black/35 p-2 text-xs text-white/70">
                  <p>{row.movementLabel}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200/80">
                    {row.movementDelta == null
                      ? "No numeric delta"
                      : `Delta ${formatSignedNumber(row.movementDelta, row.market === "moneyline" ? 0 : 2)}`}
                    {row.isSharpMove ? " - Sharp" : ""}
                    {!row.isSharpMove && row.isSignificantMove ? " - Significant" : ""}
                  </p>
                </div>

                <div className="mt-2 space-y-1.5 rounded-lg border border-white/10 bg-black/35 p-2">
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/45">
                    <span>Line/Odds Move</span>
                    <span>{toPercentRatio(row.movementMagnitude, maxMovementMagnitude).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-sky-400 to-cyan-300"
                      style={{
                        width: `${toPercentRatio(row.movementMagnitude, maxMovementMagnitude)}%`,
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/45">
                    <span>Limit Spread</span>
                    <span>{toPercentRatio(row.limitExpansion, maxLimitExpansion).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-emerald-400 to-lime-300"
                      style={{
                        width: `${toPercentRatio(row.limitExpansion, maxLimitExpansion)}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="mt-2 text-[11px] text-white/55">
                  {row.limitLabel}
                  {row.limitExpansion != null ? ` (${formatLimit(row.limitExpansion)} spread)` : ""}
                </p>
              </div>
            ))}
          </div>

          {previewMode && !isPaidTier ? (
            <div className="rounded-xl border border-emerald-400/35 bg-emerald-500/10 p-3 text-sm text-emerald-100">
              Preview mode is active. Upgrade to unlock full movement depth and all tracked rows.
            </div>
          ) : null}
        </>
      )}

      {historyRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[92vh] w-full max-w-6xl overflow-auto rounded-2xl border border-white/15 bg-[#060606] p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">
                  {historyRow.marketLabel} history
                </p>
                <h3 className="text-lg font-semibold text-white">{historyRow.matchup}</h3>
                <p className="text-sm text-white/60">{formatShortTime(historyRow.commenceTime)}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setHistoryRow(null)
                  setHistoryError(null)
                  setHistoryPoints([])
                  setHistoryLineSeries([])
                  setHistoryOddsSeries([])
                  setHistoryHourlySeries([])
                  setHistoryPriceLevels([])
                }}
                className="rounded-lg border border-white/20 px-2.5 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Line Change</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatSignedNumber(lineDelta, 2)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Odds Change</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatSignedNumber(oddsDelta, 0)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Net Limit Range</p>
                <p className="mt-1 text-lg font-semibold text-white">{formatLimit(limitRange)}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-black/40 p-3">
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/50">Snapshots</p>
                <p className="mt-1 text-lg font-semibold text-white">
                  {Math.max(
                    historyPoints.length,
                    lineSeries.length,
                    oddsSeries.length,
                    historyHourlySeries.length
                  ).toLocaleString("en-US")}
                </p>
              </div>
            </div>

            <div className="mt-3 rounded-xl border border-white/10 bg-black/40 p-3">
              {historyLoading ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-white/60">
                  Loading movement history...
                </div>
              ) : historyError ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-red-200">
                  {historyError}
                </div>
              ) : !hasAnyHistory ? (
                <div className="flex h-[260px] items-center justify-center text-sm text-white/60">
                  No line/limit history yet.
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 xl:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/35 p-2">
                      <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">
                        Line movement
                      </p>
                      <div className="h-[220px]">
                        {hasHistoryLine ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={lineSeries}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                              <XAxis
                                dataKey="t"
                                tickFormatter={(value) => {
                                  const parsed = new Date(value)
                                  if (Number.isNaN(parsed.getTime())) return ""
                                  return parsed.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                }}
                                stroke="rgba(255,255,255,0.45)"
                                minTickGap={32}
                              />
                              <YAxis stroke="rgba(255,255,255,0.45)" width={64} />
                              <Tooltip
                                formatter={(value: unknown) => {
                                  const numeric = Array.isArray(value)
                                    ? coerceNumber(value[0])
                                    : coerceNumber(value)
                                  return [formatLineValue(numeric), "Line"]
                                }}
                                labelFormatter={(value) => formatShortTime(String(value))}
                                contentStyle={{
                                  backgroundColor: "#0a0a0a",
                                  border: "1px solid rgba(255,255,255,0.18)",
                                  borderRadius: 8,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="line"
                                stroke="#60a5fa"
                                strokeWidth={2}
                                dot={lineSeries.length <= 1}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            No line snapshots for this market.
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-white/10 bg-black/35 p-2">
                      <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">
                        Odds movement
                      </p>
                      <div className="h-[220px]">
                        {hasHistoryOdds ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={oddsSeries}>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                              <XAxis
                                dataKey="t"
                                tickFormatter={(value) => {
                                  const parsed = new Date(value)
                                  if (Number.isNaN(parsed.getTime())) return ""
                                  return parsed.toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                }}
                                stroke="rgba(255,255,255,0.45)"
                                minTickGap={32}
                              />
                              <YAxis stroke="rgba(255,255,255,0.45)" width={64} />
                              <Tooltip
                                formatter={(value: unknown) => {
                                  const numeric = Array.isArray(value)
                                    ? coerceNumber(value[0])
                                    : coerceNumber(value)
                                  return [formatOdds(numeric), "Odds"]
                                }}
                                labelFormatter={(value) => formatShortTime(String(value))}
                                contentStyle={{
                                  backgroundColor: "#0a0a0a",
                                  border: "1px solid rgba(255,255,255,0.18)",
                                  borderRadius: 8,
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="odds"
                                stroke="#fbbf24"
                                strokeWidth={2}
                                dot={oddsSeries.length <= 1}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-white/55">
                            No odds snapshots for this market.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/35 p-2">
                    <p className="px-2 pb-1 text-[11px] uppercase tracking-[0.16em] text-white/50">
                      Limit movement
                    </p>
                    <div className="h-[250px]">
                      {hasLimitSeries ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={limitSeries}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                              dataKey="t"
                              tickFormatter={(value) => {
                                const parsed = new Date(value)
                                if (Number.isNaN(parsed.getTime())) return ""
                                return parsed.toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              }}
                              stroke="rgba(255,255,255,0.45)"
                              minTickGap={32}
                            />
                            <YAxis stroke="rgba(255,255,255,0.45)" width={78} />
                            <Tooltip
                              formatter={(value: unknown, name: string) => {
                                const numeric = Array.isArray(value)
                                  ? coerceNumber(value[0])
                                  : coerceNumber(value)
                                if (name === "forLimit") return [formatLimit(numeric), "For Limit"]
                                if (name === "againstLimit") return [formatLimit(numeric), "Against Limit"]
                                return [formatSignedLimit(numeric), "Net Limit"]
                              }}
                              labelFormatter={(value) => formatShortTime(String(value))}
                              contentStyle={{
                                backgroundColor: "#0a0a0a",
                                border: "1px solid rgba(255,255,255,0.18)",
                                borderRadius: 8,
                              }}
                            />
                            <Line
                              type="monotone"
                              dataKey="forLimit"
                              stroke="#86efac"
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="againstLimit"
                              stroke="#f87171"
                              strokeDasharray="4 4"
                              dot={false}
                            />
                            <Line
                              type="monotone"
                              dataKey="netLimit"
                              stroke="#34d399"
                              strokeWidth={2}
                              dot={limitSeries.length <= 1}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-white/55">
                          No limit snapshots for this game.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                        Hourly line and price ladder
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        {historyHourlySeries.length.toLocaleString("en-US")} hours
                      </p>
                    </div>
                    {historyHourlySeries.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-4 text-sm text-white/55">
                        No hourly line snapshots available.
                      </div>
                    ) : (
                      <div className="max-h-[320px] overflow-auto rounded-lg border border-white/10">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                              <TableHead>Hour (ET)</TableHead>
                              <TableHead>Line</TableHead>
                              <TableHead>Odds</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {historyHourlySeries.map((row, index) => (
                              <TableRow
                                key={`${row.t}-${index}`}
                                className="border-white/10 hover:bg-white/5"
                              >
                                <TableCell className="text-sm text-white/70">
                                  {formatShortTime(row.t)}
                                </TableCell>
                                <TableCell className="text-sm text-white/80">
                                  {formatLineValue(row.line)}
                                </TableCell>
                                <TableCell className="text-sm text-white/80">
                                  {formatOdds(row.odds)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/10 bg-black/35 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/50">
                        Limit at each line and price
                      </p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-white/40">
                        {effectivePriceLevels.length.toLocaleString("en-US")} levels
                      </p>
                    </div>
                    {effectivePriceLevels.length === 0 ? (
                      <div className="rounded-lg border border-white/10 bg-black/40 px-3 py-4 text-sm text-white/55">
                        No line/price level snapshots yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto rounded-lg border border-white/10">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-white/10 bg-white/5 hover:bg-white/5">
                              <TableHead>Line</TableHead>
                              <TableHead>Odds</TableHead>
                              <TableHead>Latest Net</TableHead>
                              <TableHead>For / Against</TableHead>
                              <TableHead>Max Depth</TableHead>
                              <TableHead>Samples</TableHead>
                              <TableHead>Last Seen</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {effectivePriceLevels.map((level, index) => {
                              const latestNetRatio = toPercentRatio(level.latestNetLimit, maxLatestNet)
                              const depth = Math.max(
                                level.maxForLimit ?? 0,
                                level.maxAgainstLimit ?? 0
                              )
                              const depthRatio = toPercentRatio(depth, maxPriceDepth)

                              return (
                                <TableRow key={`${level.line ?? "na"}|${level.odds ?? "na"}|${index}`} className="border-white/10 hover:bg-white/5">
                                  <TableCell className="text-sm text-white/80">
                                    {formatLineValue(level.line)}
                                  </TableCell>
                                  <TableCell className="text-sm text-white/80">
                                    {formatOdds(level.odds)}
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-sm text-white/80">
                                        {formatSignedLimit(level.latestNetLimit)}
                                      </p>
                                      <div className="h-1.5 rounded-full bg-white/10">
                                        <div
                                          className={`h-1.5 rounded-full ${
                                            (level.latestNetLimit ?? 0) >= 0
                                              ? "bg-emerald-400"
                                              : "bg-rose-400"
                                          }`}
                                          style={{ width: `${latestNetRatio}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-xs text-white/70">
                                    <p>For: {formatLimit(level.latestForLimit)}</p>
                                    <p>Against: {formatLimit(level.latestAgainstLimit)}</p>
                                  </TableCell>
                                  <TableCell>
                                    <div className="space-y-1">
                                      <p className="text-sm text-white/80">{formatLimit(depth)}</p>
                                      <div className="h-1.5 rounded-full bg-white/10">
                                        <div
                                          className="h-1.5 rounded-full bg-gradient-to-r from-cyan-400 to-blue-400"
                                          style={{ width: `${depthRatio}%` }}
                                        />
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-sm text-white/70">
                                    {level.samples.toLocaleString("en-US")}
                                  </TableCell>
                                  <TableCell className="text-sm text-white/60">
                                    {formatShortTime(level.lastSeen)}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
