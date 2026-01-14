import { NextRequest, NextResponse } from "next/server"
import { fetchPlayerPropWhaleTrades } from "@/lib/services/whale-trade-history"

export const dynamic = "force-dynamic"

const SUPPORTED_SPORTS = new Set([
  "basketball_nba",
  "americanfootball_nfl",
  "basketball_ncaab",
  "americanfootball_ncaaf",
  "baseball_mlb",
  "icehockey_nhl",
  "basketball_wnba",
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get("sport") || "basketball_nba"
    const limit = Number(searchParams.get("limit") || 30)

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json({ ok: false, error: "Unsupported sport" }, { status: 400 })
    }

    const trades = await fetchPlayerPropWhaleTrades({
      sportKey: sport,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 100) : 30,
    })

    return NextResponse.json({
      ok: true,
      sport,
      count: trades.length,
      trades,
    })
  } catch (error: any) {
    console.error("[player-prop-whales] error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
