import { NextRequest, NextResponse } from "next/server"
import { ingestWhaleTradeHistory } from "@/lib/services/whale-trade-history"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/ingest-whale-trades
 * Stores whale trades for matchup history (all sports, $2k+ pregame).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Cron: Whale History] Starting ingest for all sports")

    const ncaabResult = await ingestWhaleTradeHistory({
      sportKey: "basketball_ncaab",
      minNotional: 500,
      limit: 800,
    })
    const result = await ingestWhaleTradeHistory({
      minNotional: 2000,
      limit: 800,
    })

    console.log(
      `[Cron: Whale History] Completed ingest: ${result.inserted + ncaabResult.inserted} inserted, ${result.skipped + ncaabResult.skipped} skipped, ${result.attempted + ncaabResult.attempted} attempted`
    )

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      result: {
        overall: result,
        ncaab: ncaabResult,
      },
    })
  } catch (error: any) {
    console.error("[Cron: Whale History] Fatal error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
