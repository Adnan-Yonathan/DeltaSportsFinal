import { NextRequest, NextResponse } from "next/server"
import { analyzeSharpPlayerProps } from "@/lib/services/sharp-player-prop-analyzer"

export const dynamic = "force-dynamic"

const SUPPORTED_SPORTS = new Set([
  "all",
  "basketball_nba",
  "americanfootball_nfl",
  "baseball_mlb",
  "soccer_fifwc",
  "icehockey_nhl",
  "basketball_ncaab",
  "americanfootball_ncaaf",
])

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get("sport") || "all"
    const minNotional = Number(searchParams.get("minNotional") || 1000)
    const minComposite = Number(searchParams.get("minComposite") || 0)
    const limit = Number(searchParams.get("limit") || 1000)

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported sport" },
        { status: 400 }
      )
    }

    const analysis = await analyzeSharpPlayerProps({
      sportKey: sport,
      minNotional: Number.isFinite(minNotional) ? Math.max(minNotional, 1000) : 1000,
      limit: Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 1000) : 1000,
    })

    // Apply client-side filters (filter by minimum composite score)
    let filteredProps = analysis.props

    if (Number.isFinite(minComposite) && minComposite > 0) {
      filteredProps = filteredProps.filter(
        (p) => p.compositeScore >= minComposite
      )
    }

    // Props are already sorted by composite score (highest first)
    // Also filter topPicks and clusterAlerts based on filtered set
    const filteredIds = new Set(filteredProps.map((p) => p.id))
    const filteredTopPicks = analysis.topPicks.filter((p) => filteredIds.has(p.id))
    const filteredClusterAlerts = analysis.clusterAlerts.filter((p) =>
      filteredIds.has(p.id)
    )

    return NextResponse.json({
      ok: true,
      sport,
      updatedAt: analysis.updatedAt,
      totalTrades: analysis.totalTrades,
      count: filteredProps.length,
      props: filteredProps,
      topPicks: filteredTopPicks,
      clusterAlerts: filteredClusterAlerts,
    })
  } catch (error: any) {
    console.error("[sharp-player-props] error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}
