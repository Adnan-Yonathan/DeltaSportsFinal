import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"

/**
 * POST /api/cron/refresh-market-projections
 * Refreshes market projections cache for all supported sports
 * Triggered by Vercel cron job
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for production security
    const authHeader = req.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sports = [
      "basketball_nba",
      "basketball_ncaab",
      "americanfootball_nfl",
      "icehockey_nhl",
      "baseball_mlb",
    ]

    console.log(
      `[Cron: Market Projections] Starting refresh for: ${sports.join(", ")}`
    )

    const results: Array<{
      sport: string
      success: boolean
      edgeCount?: number
      error?: string
    }> = []

    const supabase = createServiceClient()

    for (const sport of sports) {
      try {
        const result = await analyzeSlateEdges(sport, { limit: 200 })
        const edges = result.edges ?? []

        // Write to cache
        const { error: cacheError } = (await supabase
          .from("market_projections_cache" as any)
          .upsert(
            {
              sport,
              edges,
              updated_at: new Date().toISOString(),
            } as any,
            { onConflict: "sport" }
          )) as unknown as { error: any }

        if (cacheError) {
          console.error(
            `[Cron: Market Projections] Cache write failed for ${sport}:`,
            cacheError
          )
          results.push({
            sport,
            success: false,
            error: cacheError.message,
          })
        } else {
          console.log(
            `[Cron: Market Projections] Cached ${edges.length} edges for ${sport}`
          )
          results.push({
            sport,
            success: true,
            edgeCount: edges.length,
          })
        }
      } catch (error: any) {
        console.error(
          `[Cron: Market Projections] Error processing ${sport}:`,
          error
        )
        results.push({
          sport,
          success: false,
          error: error.message,
        })
      }
    }

    const successCount = results.filter((r) => r.success).length
    const totalEdges = results.reduce((sum, r) => sum + (r.edgeCount ?? 0), 0)

    console.log(
      `[Cron: Market Projections] Completed: ${successCount}/${sports.length} sports, ${totalEdges} total edges`
    )

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      results,
      summary: {
        successCount,
        totalSports: sports.length,
        totalEdges,
      },
    })
  } catch (error: any) {
    console.error("[Cron: Market Projections] Fatal error:", error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
