import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const MARKETS = new Set(["spread", "total", "moneyline"])
const SIDES = new Set(["home", "away", "over", "under"])

const normalizeMarket = (
  value: string | null
): "spread" | "total" | "moneyline" | null => {
  const normalized = String(value || "").trim().toLowerCase()
  if (!MARKETS.has(normalized)) return null
  return normalized as "spread" | "total" | "moneyline"
}

const resolveHours = (value: string | null) => {
  const parsed = Number(value ?? "96")
  if (!Number.isFinite(parsed)) return 96
  return Math.min(Math.max(parsed, 1), 336)
}

const resolveLimit = (value: string | null) => {
  const parsed = Number(value ?? "500")
  if (!Number.isFinite(parsed)) return 500
  return Math.min(Math.max(parsed, 10), 2000)
}

const parseNumeric = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const normalizeSide = (value: string | null): "home" | "away" | "over" | "under" => {
  const normalized = String(value || "").trim().toLowerCase()
  return SIDES.has(normalized)
    ? (normalized as "home" | "away" | "over" | "under")
    : "home"
}

const americanToImpliedProbability = (odds: number | null) => {
  if (odds == null || !Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  return Math.abs(odds) / (Math.abs(odds) + 100)
}

const resolvePinnacleLineAndOdds = (
  row: any,
  market: "spread" | "total" | "moneyline",
  side: "home" | "away" | "over" | "under"
) => {
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = (searchParams.get("sport") || "").trim()
    const market = normalizeMarket(searchParams.get("market"))
    const oddsApiId = (searchParams.get("oddsApiId") || "").trim()
    const homeTeam = (searchParams.get("homeTeam") || "").trim()
    const awayTeam = (searchParams.get("awayTeam") || "").trim()
    const commenceTime = (searchParams.get("commenceTime") || "").trim()
    const side = normalizeSide(searchParams.get("side"))
    const hours = resolveHours(searchParams.get("hours"))
    const limit = resolveLimit(searchParams.get("limit"))

    if (!market) {
      return NextResponse.json({ error: "Invalid market." }, { status: 400 })
    }
    if (!oddsApiId && (!homeTeam || !awayTeam)) {
      return NextResponse.json(
        { error: "Missing game identifier. Provide oddsApiId or homeTeam/awayTeam." },
        { status: 400 }
      )
    }

    const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const supabase = createServiceClient()

    let query = supabase
      .from("market_limit_history" as any)
      .select(
        "recorded_at,limit_pressure_score,limit_pressure_label,for_limit,against_limit,net_limit,sample_count,projection_side"
      )
      .eq("market_type", market)
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true })
      .limit(limit)

    if (sport) query = query.eq("sport", sport)
    if (oddsApiId) {
      query = query.eq("odds_api_id", oddsApiId)
    } else {
      query = query.eq("home_team", homeTeam).eq("away_team", awayTeam)
      if (commenceTime) {
        const parsed = Date.parse(commenceTime)
        if (Number.isFinite(parsed)) {
          const start = new Date(parsed - 24 * 60 * 60 * 1000).toISOString()
          const end = new Date(parsed + 24 * 60 * 60 * 1000).toISOString()
          query = query.gte("commence_time", start).lte("commence_time", end)
        }
      }
    }

    const { data, error } = (await query) as unknown as { data: any[] | null; error: any }
    if (error) {
      console.error("[limit-history] query failed", error)
      return NextResponse.json({
        ok: true,
        market,
        count: 0,
        points: [],
        unavailable: true,
      })
    }

    let linesQuery = supabase
      .from("lines" as any)
      .select(
        "recorded_at,spread_home,spread_away,spread_home_odds,spread_away_odds,total_line,total_over_odds,total_under_odds,moneyline_home,moneyline_away,game_time"
      )
      .eq("market_type", market)
      .eq("line_type", "current")
      .ilike("bookmaker", "%pinnacle%")
      .gte("recorded_at", sinceIso)
      .order("recorded_at", { ascending: true })
      .limit(Math.min(2000, limit * 8))

    if (sport && sport !== "all") linesQuery = linesQuery.eq("sport", sport)
    if (oddsApiId) {
      linesQuery = linesQuery.eq("odds_api_id", oddsApiId)
    } else {
      linesQuery = linesQuery.eq("home_team", homeTeam).eq("away_team", awayTeam)
      if (commenceTime) {
        const parsed = Date.parse(commenceTime)
        if (Number.isFinite(parsed)) {
          const start = new Date(parsed - 24 * 60 * 60 * 1000).toISOString()
          const end = new Date(parsed + 24 * 60 * 60 * 1000).toISOString()
          linesQuery = linesQuery.gte("game_time", start).lte("game_time", end)
        }
      }
    }

    const { data: lineRows, error: lineError } = (await linesQuery) as unknown as {
      data: any[] | null
      error: any
    }
    if (lineError) {
      console.warn("[limit-history] pinnacle line fallback query failed", lineError)
    }

    const pinnaclePoints = (lineRows ?? [])
      .map((row) => {
        const t = typeof row?.recorded_at === "string" ? row.recorded_at : ""
        if (!t) return null
        const { line, odds } = resolvePinnacleLineAndOdds(row, market, side)
        if (line == null && odds == null) return null
        return { t, line, odds }
      })
      .filter((row): row is { t: string; line: number | null; odds: number | null } => Boolean(row))

    const closestPinnacleByTime = (isoTime: string) => {
      if (!pinnaclePoints.length) return { line: null as number | null, odds: null as number | null }
      const targetMs = Date.parse(isoTime)
      if (!Number.isFinite(targetMs)) return { line: null as number | null, odds: null as number | null }

      let best = pinnaclePoints[0]
      let bestDiff = Math.abs(Date.parse(best.t) - targetMs)
      for (let i = 1; i < pinnaclePoints.length; i += 1) {
        const candidate = pinnaclePoints[i]
        const diff = Math.abs(Date.parse(candidate.t) - targetMs)
        if (diff < bestDiff) {
          best = candidate
          bestDiff = diff
        }
      }
      return { line: best.line, odds: best.odds }
    }

    let points = (data ?? []).map((row) => {
      const t = typeof row.recorded_at === "string" ? row.recorded_at : ""
      const nearest = t ? closestPinnacleByTime(t) : { line: null as number | null, odds: null as number | null }
      return {
        t,
        score: parseNumeric(row.limit_pressure_score),
        label: typeof row.limit_pressure_label === "string" ? row.limit_pressure_label : null,
        forLimit: parseNumeric(row.for_limit),
        againstLimit: parseNumeric(row.against_limit),
        netLimit: parseNumeric(row.net_limit),
        sampleCount: parseNumeric(row.sample_count),
        projectionSide:
          typeof row.projection_side === "string" ? row.projection_side : null,
        line: nearest.line,
        odds: nearest.odds,
      }
    })

    const hasStructuredLimits = points.some(
      (point) =>
        point.forLimit != null ||
        point.againstLimit != null ||
        point.netLimit != null
    )

    if (!points.length && pinnaclePoints.length) {
      const baseProbability = americanToImpliedProbability(pinnaclePoints[0].odds)
      points = pinnaclePoints.map((point) => {
        const implied = americanToImpliedProbability(point.odds)
        const delta = baseProbability != null && implied != null ? implied - baseProbability : 0
        const syntheticNet = Number((delta * 25000).toFixed(2))
        return {
          t: point.t,
          score: Number(delta.toFixed(6)),
          label: syntheticNet > 0 ? "Expansion" : syntheticNet < 0 ? "Contraction" : "Balanced",
          forLimit: syntheticNet > 0 ? syntheticNet : 0,
          againstLimit: syntheticNet < 0 ? Math.abs(syntheticNet) : 0,
          netLimit: syntheticNet,
          sampleCount: null,
          projectionSide: null,
          line: point.line,
          odds: point.odds,
        }
      })
    } else if (!hasStructuredLimits && points.length) {
      const baseProbability = americanToImpliedProbability(
        points.find((entry) => entry.odds != null)?.odds ?? null
      )
      points = points.map((point) => {
        if (point.netLimit != null || point.forLimit != null || point.againstLimit != null) {
          return point
        }
        const implied = americanToImpliedProbability(point.odds)
        const deltaFromOdds =
          baseProbability != null && implied != null ? implied - baseProbability : null
        const fallbackDelta = deltaFromOdds ?? point.score ?? 0
        const syntheticNet = Number((fallbackDelta * 25000).toFixed(2))
        return {
          ...point,
          score: point.score ?? (deltaFromOdds != null ? Number(deltaFromOdds.toFixed(6)) : 0),
          label:
            point.label ??
            (syntheticNet > 0
              ? "Expansion"
              : syntheticNet < 0
                ? "Contraction"
                : "Balanced"),
          forLimit: syntheticNet > 0 ? syntheticNet : 0,
          againstLimit: syntheticNet < 0 ? Math.abs(syntheticNet) : 0,
          netLimit: syntheticNet,
        }
      })
    }

    points = points
      .filter((point) => point.t)
      .sort((a, b) => Date.parse(a.t) - Date.parse(b.t))

    return NextResponse.json({
      ok: true,
      market,
      side,
      count: points.length,
      points,
      source: "pinnacle",
    })
  } catch (error) {
    console.error("[limit-history] unexpected error", error)
    return NextResponse.json({
      ok: true,
      count: 0,
      points: [],
      unavailable: true,
    })
  }
}
