import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const DEFAULT_MARKETS = ["spread", "total", "moneyline"] as const
const DEFAULT_BOOK = "pinnacle"

type MarketKey = (typeof DEFAULT_MARKETS)[number]
type SideKey = "home" | "away" | "over" | "under"

type LinePoint = {
  t: string
  value: number
}

type SeriesResponse = {
  book?: string
  points: LinePoint[]
  linePoints: LinePoint[]
  oddsPoints: LinePoint[]
}

type GameMeta = {
  id?: string
  homeTeam?: string
  awayTeam?: string
  commenceTime?: string
}

const normalizeBook = (value: string | null | undefined) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")

const parseNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeMarket = (value: unknown): MarketKey | null => {
  const token = String(value || "").trim().toLowerCase()
  if (token === "spread" || token === "total" || token === "moneyline") return token
  return null
}

const normalizeSide = (value: unknown): SideKey => {
  const token = String(value || "").trim().toLowerCase()
  if (token === "away" || token === "over" || token === "under") return token
  return "home"
}

const resolveLineOddsValues = (row: any, market: MarketKey, side: SideKey) => {
  if (market === "spread") {
    const line = side === "away" ? parseNumeric(row.spread_away) : parseNumeric(row.spread_home)
    const odds =
      side === "away"
        ? parseNumeric(row.spread_away_odds)
        : parseNumeric(row.spread_home_odds)
    return { line, odds }
  }

  if (market === "total") {
    const line = parseNumeric(row.total_line)
    const odds =
      side === "under"
        ? parseNumeric(row.total_under_odds)
        : parseNumeric(row.total_over_odds)
    return { line, odds }
  }

  const odds = side === "away" ? parseNumeric(row.moneyline_away) : parseNumeric(row.moneyline_home)
  return { line: odds, odds }
}

const addSeriesPoint = (
  grouped: Map<string, Map<MarketKey, { linePoints: LinePoint[]; oddsPoints: LinePoint[] }>>,
  gameId: string,
  market: MarketKey,
  row: any,
  side: SideKey
) => {
  const { line, odds } = resolveLineOddsValues(row, market, side)
  if (line == null && odds == null) return

  if (!grouped.has(gameId)) grouped.set(gameId, new Map())
  const marketMap = grouped.get(gameId)!
  if (!marketMap.has(market)) {
    marketMap.set(market, { linePoints: [], oddsPoints: [] })
  }
  const series = marketMap.get(market)!
  if (line != null) series.linePoints.push({ t: row.recorded_at, value: line })
  if (odds != null) series.oddsPoints.push({ t: row.recorded_at, value: odds })
}

const resolveGameMeta = (body: any, gameIds: string[]): GameMeta[] => {
  if (Array.isArray(body?.games) && body.games.length > 0) {
    return body.games.map((entry: any) => ({
      id: entry?.id ? String(entry.id).trim() : undefined,
      homeTeam: entry?.homeTeam ? String(entry.homeTeam).trim() : undefined,
      awayTeam: entry?.awayTeam ? String(entry.awayTeam).trim() : undefined,
      commenceTime: entry?.commenceTime ? String(entry.commenceTime).trim() : undefined,
    }))
  }
  return gameIds.map((id) => ({ id }))
}

const applyMatchupFallback = async ({
  supabase,
  grouped,
  gameMeta,
  markets,
  since,
  lineType,
  bookFilter,
  side,
  maxRows,
}: {
  supabase: ReturnType<typeof createServiceClient>
  grouped: Map<string, Map<MarketKey, { linePoints: LinePoint[]; oddsPoints: LinePoint[] }>>
  gameMeta: GameMeta
  markets: MarketKey[]
  since: string
  lineType: string
  bookFilter: string
  side: SideKey
  maxRows: number
}) => {
  const targetId = gameMeta.id || `${gameMeta.awayTeam || "away"}@${gameMeta.homeTeam || "home"}`
  if (!gameMeta.homeTeam || !gameMeta.awayTeam) return

  for (const market of markets) {
    const existing = grouped.get(targetId)?.get(market)
    if (existing && (existing.linePoints.length > 0 || existing.oddsPoints.length > 0)) {
      continue
    }

    let query = supabase
      .from("lines")
      .select(
        "odds_api_id, market_type, bookmaker, recorded_at, spread_home, spread_away, spread_home_odds, spread_away_odds, total_line, total_over_odds, total_under_odds, moneyline_home, moneyline_away, game_time"
      )
      .eq("market_type", market)
      .eq("line_type", lineType)
      .eq("home_team", gameMeta.homeTeam)
      .eq("away_team", gameMeta.awayTeam)
      .ilike("bookmaker", `%${bookFilter}%`)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true })
      .limit(Math.min(500, maxRows))

    if (gameMeta.commenceTime) {
      const parsed = Date.parse(gameMeta.commenceTime)
      if (Number.isFinite(parsed)) {
        const lower = new Date(parsed - 24 * 60 * 60 * 1000).toISOString()
        const upper = new Date(parsed + 24 * 60 * 60 * 1000).toISOString()
        query = query.gte("game_time", lower).lte("game_time", upper)
      }
    }

    const { data, error } = (await query) as unknown as { data: any[] | null; error: any }
    if (error || !Array.isArray(data) || data.length === 0) continue

    for (const row of data) {
      addSeriesPoint(grouped, targetId, market, row, side)
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const gameIds = Array.isArray(body?.gameIds)
      ? body.gameIds.map((id: any) => String(id).trim()).filter(Boolean)
      : []
    const gameMeta = resolveGameMeta(body, gameIds)
    const markets = Array.isArray(body?.markets) && body.markets.length
      ? body.markets.map((m: any) => normalizeMarket(m)).filter(Boolean) as MarketKey[]
      : [...DEFAULT_MARKETS]
    const side = normalizeSide(body?.side)
    const hours = Number.isFinite(body?.hours) ? Math.min(Math.max(body.hours, 1), 168) : 36
    const lineType = body?.lineType ? String(body.lineType) : "current"
    const bookFilter = normalizeBook(body?.bookmaker || DEFAULT_BOOK) || DEFAULT_BOOK
    const maxRows = Number.isFinite(body?.limit)
      ? Math.min(Math.max(body.limit, 100), 20000)
      : Math.min(20000, Math.max(800, gameIds.length * 120))

    if (!gameMeta.length || !markets.length) {
      return NextResponse.json({ success: true, series: {}, count: 0 })
    }

    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const supabase = createServiceClient()
    const grouped = new Map<string, Map<MarketKey, { linePoints: LinePoint[]; oddsPoints: LinePoint[] }>>()

    if (gameIds.length > 0) {
      const { data, error } = (await supabase
        .from("lines")
        .select(
          "odds_api_id, market_type, bookmaker, recorded_at, spread_home, spread_away, spread_home_odds, spread_away_odds, total_line, total_over_odds, total_under_odds, moneyline_home, moneyline_away"
        )
        .in("odds_api_id", gameIds)
        .in("market_type", markets)
        .eq("line_type", lineType)
        .ilike("bookmaker", `%${bookFilter}%`)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true })
        .limit(maxRows)) as unknown as { data: any[] | null; error: any }

      if (error) {
        console.error("[Line History Batch] Error fetching lines:", error)
        throw error
      }

      for (const row of data || []) {
        const gameId = String(row.odds_api_id || "").trim()
        const market = normalizeMarket(row.market_type)
        if (!gameId || !market) continue
        addSeriesPoint(grouped, gameId, market, row, side)
      }
    }

    for (const meta of gameMeta) {
      await applyMatchupFallback({
        supabase,
        grouped,
        gameMeta: meta,
        markets,
        since,
        lineType,
        bookFilter,
        side,
        maxRows,
      })
    }

    const series: Record<string, Record<string, SeriesResponse>> = {}

    for (const meta of gameMeta) {
      const gameId = meta.id || `${meta.awayTeam || "away"}@${meta.homeTeam || "home"}`
      const marketMap = grouped.get(gameId)
      if (!marketMap) continue
      series[gameId] = {}
      for (const market of markets) {
        const points = marketMap.get(market)
        if (!points) continue
        const linePoints = points.linePoints.filter((point) => Number.isFinite(point.value))
        const oddsPoints = points.oddsPoints.filter((point) => Number.isFinite(point.value))
        if (!linePoints.length && !oddsPoints.length) continue
        series[gameId][market] = {
          book: DEFAULT_BOOK,
          points: linePoints,
          linePoints,
          oddsPoints,
        }
      }
    }

    return NextResponse.json({
      success: true,
      count: Object.values(series).reduce((sum, marketMap) => sum + Object.keys(marketMap).length, 0),
      side,
      book: DEFAULT_BOOK,
      series,
    })
  } catch (error: any) {
    console.error("[Line History Batch] Error:", error)
    return NextResponse.json(
      { error: "Failed to fetch line history batch", details: error.message },
      { status: 500 }
    )
  }
}

