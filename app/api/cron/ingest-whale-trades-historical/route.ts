import { NextRequest, NextResponse } from "next/server"
import { ingestWhaleTradeHistory } from "@/lib/services/whale-trade-history"

export const dynamic = "force-dynamic"

/**
 * GET /api/cron/ingest-whale-trades-historical
 * Ingests historical whale trades for specific sports.
 * Query params:
 *   - sports: comma-separated sport keys (e.g., "basketball_nba,icehockey_nhl")
 *   - minNotional: minimum notional (default 1000)
 *   - limit: max trades to fetch (default 800)
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
    const limit = Number(searchParams.get("limit") || 800)

    const sports = sportsParam?.split(",").map(s => s.trim()).filter(Boolean) || []

    console.log(`[Cron: Whale Historical] Starting ingest for: ${sports.length ? sports.join(", ") : "all sports"}`)

    const results: Record<string, any> = {}

    if (sports.length > 0) {
      // Ingest each sport individually
      for (const sportKey of sports) {
        console.log(`[Cron: Whale Historical] Ingesting ${sportKey}`)
        const result = await ingestWhaleTradeHistory({
          sportKey,
          minNotional,
          limit,
        })
        results[sportKey] = result
        console.log(`[Cron: Whale Historical] ${sportKey}: ${result.inserted} inserted, ${result.skipped} skipped`)
      }
    } else {
      // Ingest all sports
      const result = await ingestWhaleTradeHistory({
        minNotional,
        limit,
      })
      results.all = result
    }

    const totalInserted = Object.values(results).reduce((sum: number, r: any) => sum + (r.inserted || 0), 0)
    const totalSkipped = Object.values(results).reduce((sum: number, r: any) => sum + (r.skipped || 0), 0)

    console.log(`[Cron: Whale Historical] Completed: ${totalInserted} inserted, ${totalSkipped} skipped`)

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        inserted: totalInserted,
        skipped: totalSkipped,
      },
    })
  } catch (error: any) {
    console.error("[Cron: Whale Historical] Fatal error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
