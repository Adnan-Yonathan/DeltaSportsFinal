import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"

export const dynamic = "force-dynamic"

const MARKETS = new Set(["spread", "total", "moneyline"])

const normalizeMarket = (value: string | null) => {
  const normalized = String(value || "").trim().toLowerCase()
  return MARKETS.has(normalized) ? normalized : null
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sport = (searchParams.get("sport") || "").trim()
    const market = normalizeMarket(searchParams.get("market"))
    const oddsApiId = (searchParams.get("oddsApiId") || "").trim()
    const homeTeam = (searchParams.get("homeTeam") || "").trim()
    const awayTeam = (searchParams.get("awayTeam") || "").trim()
    const commenceTime = (searchParams.get("commenceTime") || "").trim()
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

    const points = (data ?? []).map((row) => ({
      t: row.recorded_at,
      score: parseNumeric(row.limit_pressure_score),
      label: typeof row.limit_pressure_label === "string" ? row.limit_pressure_label : null,
      forLimit: parseNumeric(row.for_limit),
      againstLimit: parseNumeric(row.against_limit),
      netLimit: parseNumeric(row.net_limit),
      sampleCount: parseNumeric(row.sample_count),
      projectionSide:
        typeof row.projection_side === "string" ? row.projection_side : null,
    }))

    return NextResponse.json({
      ok: true,
      market,
      count: points.length,
      points,
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
