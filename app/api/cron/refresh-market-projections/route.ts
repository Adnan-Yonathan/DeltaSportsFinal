import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import { recordMarketProjectionPicks } from "@/lib/services/market-projection-clv"
import {
  isWithinSharpRefreshWindow,
  SHARP_REFRESH_WINDOW_LABEL,
} from "@/lib/utils/sharp-refresh-window"

export const dynamic = "force-dynamic"
const CURRENT_SLATE_LOOKBACK_MS = 1000 * 60 * 60 * 3
const CURRENT_SLATE_LOOKAHEAD_MS = 1000 * 60 * 60 * 48

const isCurrentSlateGame = (commenceTime?: string | null, nowMs = Date.now()) => {
  if (!commenceTime) return false
  const gameTimeMs = Date.parse(commenceTime)
  if (!Number.isFinite(gameTimeMs)) return false
  return (
    gameTimeMs >= nowMs - CURRENT_SLATE_LOOKBACK_MS &&
    gameTimeMs <= nowMs + CURRENT_SLATE_LOOKAHEAD_MS
  )
}

const countCurrentSlateEdges = (edges?: any[]) => {
  if (!Array.isArray(edges) || edges.length === 0) return 0
  const nowMs = Date.now()
  return edges.reduce((count, edge) => {
    const commenceTime = edge?.commenceTime ?? edge?.commence_time
    return isCurrentSlateGame(commenceTime, nowMs) ? count + 1 : count
  }, 0)
}

const analyzeWithSharpFallback = async (sport: string) => {
  const result = await analyzeSlateEdges(sport, {
    limit: 200,
    oddsPreference: "best",
  })

  return { result, usedFallback: false as const }
}

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

    if (!isWithinSharpRefreshWindow()) {
      return NextResponse.json({
        ok: true,
        refreshed: false,
        skipped: true,
        reason: `Refresh window closed. Active window: ${SHARP_REFRESH_WINDOW_LABEL}.`,
        timestamp: new Date().toISOString(),
      })
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
      usedFallback?: boolean
      error?: string
    }> = []

    const supabase = createServiceClient()

    for (const sport of sports) {
      try {
        const { result, usedFallback } = await analyzeWithSharpFallback(sport)
        const edges = result.edges ?? []
        await recordMarketProjectionPicks({
          sport,
          edges: edges as any,
          pickedAt: new Date().toISOString(),
        })

        const { data: existing } = (await supabase
          .from("market_projections_cache" as any)
          .select("edges, updated_at")
          .eq("sport", sport)
          .single()) as unknown as {
          data: { edges: any[]; updated_at: string } | null
        }

        const hasCurrentSlateExistingEdges =
          countCurrentSlateEdges(existing?.edges) > 0

        if (edges.length === 0 && hasCurrentSlateExistingEdges) {
          console.warn(
            `[Cron: Market Projections] Skipping empty refresh for ${sport}; keeping cached edges.`
          )
          results.push({
            sport,
            success: true,
            edgeCount: existing?.edges?.length ?? 0,
            usedFallback,
          })
          continue
        }

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
            usedFallback,
          })
        } else {
          console.log(
            `[Cron: Market Projections] Cached ${edges.length} edges for ${sport}`
          )
          results.push({
            sport,
            success: true,
            edgeCount: edges.length,
            usedFallback,
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
