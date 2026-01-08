import { NextResponse } from "next/server"
import { writeFile, mkdir, readFile } from "fs/promises"
import { join } from "path"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"

const CACHE_DIR = join(process.cwd(), "cache")
const getCachePath = (sport: string) =>
  join(CACHE_DIR, `market-projections-${sport}.json`)
const CACHE_TTL_MS = 1000 * 60 * 15

const readCache = async (sport: string) => {
  try {
    const raw = await readFile(getCachePath(sport), "utf-8")
    const parsed = JSON.parse(raw) as {
      updatedAt?: string
      sport?: string
      edges?: unknown[]
    }
    if (!parsed?.updatedAt || !Array.isArray(parsed?.edges)) return null
    return parsed
  } catch (error) {
    return null
  }
}

const writeCache = async (sport: string, payload: unknown) => {
  await mkdir(CACHE_DIR, { recursive: true })
  await writeFile(getCachePath(sport), JSON.stringify(payload, null, 2), "utf-8")
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get("sport") || "basketball_nba"
  const forceRefresh = searchParams.get("refresh") === "1"

  try {
    const cached = await readCache(sport)
    if (forceRefresh) {
      const result = await analyzeSlateEdges(sport, { limit: 200 })
      if (
        sport === "americanfootball_nfl" &&
        (result.edges?.length ?? 0) === 0 &&
        cached?.edges?.length
      ) {
        return NextResponse.json({
          ok: true,
          updatedAt: cached.updatedAt,
          sport,
          edges: cached.edges?.length ?? 0,
          fromCache: true,
        })
      }
      const payload = {
        updatedAt: new Date().toISOString(),
        sport,
        edges: result.edges ?? [],
      }
      await writeCache(sport, payload)
      return NextResponse.json({
        ok: true,
        updatedAt: payload.updatedAt,
        sport,
        edges: payload.edges.length,
        fromCache: false,
      })
    }

    if (cached) {
      const updatedAtMs = Date.parse(cached.updatedAt ?? "")
      if (
        Number.isFinite(updatedAtMs) &&
        Date.now() - updatedAtMs < CACHE_TTL_MS
      ) {
        return NextResponse.json({
          ok: true,
          updatedAt: cached.updatedAt,
          sport,
          edges: cached.edges?.length ?? 0,
          fromCache: true,
        })
      }
    }

    if (cached) {
      void analyzeSlateEdges(sport, { limit: 200 })
        .then((result) => {
          const payload = {
            updatedAt: new Date().toISOString(),
            sport,
            edges: result.edges ?? [],
          }
          return writeCache(sport, payload)
        })
        .catch((error) =>
          console.error("[market-projections] refresh failed", error)
        )

      return NextResponse.json({
        ok: true,
        updatedAt: cached.updatedAt,
        sport,
        edges: cached.edges?.length ?? 0,
        refreshing: true,
        fromCache: true,
      })
    }

    const result = await analyzeSlateEdges(sport, { limit: 200 })
    const payload = {
      updatedAt: new Date().toISOString(),
      sport,
      edges: result.edges ?? [],
    }
    await writeCache(sport, payload)
    return NextResponse.json({
      ok: true,
      updatedAt: payload.updatedAt,
      sport,
      edges: payload.edges.length,
      fromCache: false,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh projections."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
