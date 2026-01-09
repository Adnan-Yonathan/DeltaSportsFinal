import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"

export const runtime = "nodejs"
export const maxDuration = 300 // 5 minutes max for cron

const CRON_SECRET = process.env.CRON_SECRET

// All sports to refresh
const SPORTS = [
  "basketball_nba",
  "americanfootball_nfl",
  "basketball_ncaab",
  "americanfootball_ncaaf",
  "icehockey_nhl",
] as const

const CACHE_DIR = join(process.cwd(), "cache")

const getCachePath = (type: string, sport: string) =>
  join(CACHE_DIR, `${type}-${sport}.json`)

const readCache = async (type: string, sport: string) => {
  try {
    const raw = await readFile(getCachePath(type, sport), "utf-8")
    return JSON.parse(raw)
  } catch {
    return null
  }
}

const writeCache = async (type: string, sport: string, payload: unknown) => {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(getCachePath(type, sport), JSON.stringify(payload, null, 2), "utf-8")
}

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildMatchupKey = (homeTeam?: string, awayTeam?: string) => {
  if (!homeTeam || !awayTeam) return ""
  return `${normalizeKey(awayTeam)}@${normalizeKey(homeTeam)}`
}

const mergeWhaleAlerts = (nextEdges: any[], cachedEdges?: any[]) => {
  if (!Array.isArray(nextEdges) || nextEdges.length === 0) return nextEdges
  if (!Array.isArray(cachedEdges) || cachedEdges.length === 0) return nextEdges

  const cachedMap = new Map<string, any[]>()
  for (const edge of cachedEdges) {
    const key = buildMatchupKey(edge?.homeTeam, edge?.awayTeam)
    if (!key) continue
    if (Array.isArray(edge?.whaleAlerts) && edge.whaleAlerts.length > 0) {
      cachedMap.set(key, edge.whaleAlerts)
    }
  }

  if (!cachedMap.size) return nextEdges

  return nextEdges.map((edge) => {
    const key = buildMatchupKey(edge?.homeTeam, edge?.awayTeam)
    const cachedWhales = cachedMap.get(key) || []
    const nextWhales = Array.isArray(edge?.whaleAlerts) ? edge.whaleAlerts : []
    if (cachedWhales.length === 0) return edge
    const byId = new Map<string, any>()
    for (const whale of cachedWhales) {
      if (whale?.id) byId.set(String(whale.id), whale)
    }
    for (const whale of nextWhales) {
      if (whale?.id) byId.set(String(whale.id), whale)
    }
    return {
      ...edge,
      whaleAlerts: Array.from(byId.values()),
    }
  })
}

const refreshMarketProjections = async (sport: string) => {
  try {
    const cached = await readCache("market-projections", sport)
    const result = await analyzeSlateEdges(sport, { limit: 200 })

    // If new result is empty but cache has data, keep cache
    if ((result.edges?.length ?? 0) === 0 && cached?.edges?.length) {
      return { sport, type: "market", status: "kept-cache", count: cached.edges.length }
    }

    const payload = {
      updatedAt: new Date().toISOString(),
      sport,
      edges: mergeWhaleAlerts(result.edges ?? [], cached?.edges),
    }
    await writeCache("market-projections", sport, payload)
    return { sport, type: "market", status: "refreshed", count: payload.edges.length }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return { sport, type: "market", status: "error", error: message }
  }
}

// Player projections are calculated on-demand via daily-projections API
// They have their own caching (ESPN data cached for 10 mins, SBD lines cached)
// No need to pre-warm from cron - they refresh when users visit the page

export async function GET(request: NextRequest) {
  // Verify cron secret for security (skip in development)
  const authHeader = request.headers.get("authorization")
  const cronSecret = authHeader?.replace("Bearer ", "")

  if (process.env.NODE_ENV === "production" && CRON_SECRET && cronSecret !== CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const startTime = Date.now()
  const results: any[] = []

  // Get optional sport filter from query params
  const { searchParams } = new URL(request.url)
  const sportFilter = searchParams.get("sport")
  const typeFilter = searchParams.get("type") // "market" only (player projections refresh on-demand)

  const sportsToRefresh = sportFilter
    ? SPORTS.filter(s => s === sportFilter)
    : [...SPORTS]

  console.log(`[cron/refresh-projections] Starting refresh for ${sportsToRefresh.length} sports`)

  // Refresh market projections
  if (!typeFilter || typeFilter === "market") {
    const marketResults = await Promise.allSettled(
      sportsToRefresh.map(sport => refreshMarketProjections(sport))
    )

    for (const result of marketResults) {
      if (result.status === "fulfilled") {
        results.push(result.value)
      } else {
        results.push({ type: "market", status: "error", error: result.reason?.message })
      }
    }
  }

  // Player projections refresh on-demand when users visit the page
  // They have built-in caching (ESPN 10 min, SBD lines cached)

  const durationMs = Date.now() - startTime
  const successCount = results.filter(r => r.status === "refreshed" || r.status === "kept-cache").length
  const errorCount = results.filter(r => r.status === "error").length

  console.log(`[cron/refresh-projections] Completed in ${durationMs}ms: ${successCount} success, ${errorCount} errors`)

  return NextResponse.json({
    ok: errorCount === 0,
    refreshedAt: new Date().toISOString(),
    durationMs,
    results,
    summary: {
      total: results.length,
      success: successCount,
      errors: errorCount,
    }
  })
}

// Also support POST for Vercel cron
export async function POST(request: NextRequest) {
  return GET(request)
}
