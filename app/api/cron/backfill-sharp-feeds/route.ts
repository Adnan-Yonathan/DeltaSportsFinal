import { NextRequest, NextResponse } from "next/server"
import { ingestWhaleTradeHistory } from "@/lib/services/whale-trade-history"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/backfill-sharp-feeds
 * Backfills whale trade history for sharp money + sharp props feeds.
 * Query params:
 *   - sports: comma-separated sport keys (e.g. "basketball_nba,americanfootball_nfl")
 *   - minNotional: minimum notional (default 1000)
 *   - limit: max trades to fetch (default 2000)
 *   - hours: backfill window in hours (default 24)
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const sportsParam = searchParams.get("sports")
    const minNotional = Number(searchParams.get("minNotional") || 1000)
    const limit = Number(searchParams.get("limit") || 2000)
    const hours = Number(searchParams.get("hours") || 24)

    const sports = sportsParam?.split(",").map((s) => s.trim()).filter(Boolean) || []
    const windowHours = Number.isFinite(hours) ? Math.max(hours, 1) : 24

    console.log(
      `[Cron: Sharp Backfill] Starting ${windowHours}h backfill for ${sports.length ? sports.join(", ") : "all sports"}`
    )

    const results: Record<string, any> = {}

    if (sports.length > 0) {
      for (const sportKey of sports) {
        const result = await ingestWhaleTradeHistory({
          sportKey,
          minNotional: Number.isFinite(minNotional) ? Math.max(minNotional, 100) : 1000,
          limit: Number.isFinite(limit) ? Math.max(limit, 100) : 2000,
          windowHours,
        })
        results[sportKey] = result
      }
    } else {
      const result = await ingestWhaleTradeHistory({
        minNotional: Number.isFinite(minNotional) ? Math.max(minNotional, 100) : 1000,
        limit: Number.isFinite(limit) ? Math.max(limit, 100) : 2000,
        windowHours,
      })
      results.all = result
    }

    const totalInserted = Object.values(results).reduce(
      (sum: number, r: any) => sum + (r.inserted || 0),
      0
    )
    const totalSkipped = Object.values(results).reduce(
      (sum: number, r: any) => sum + (r.skipped || 0),
      0
    )

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      windowHours,
      results,
      summary: {
        inserted: totalInserted,
        skipped: totalSkipped,
      },
    })
  } catch (error: any) {
    console.error("[Cron: Sharp Backfill] Fatal error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
