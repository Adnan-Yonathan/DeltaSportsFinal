import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"

const CACHE_TTL_MS = 1000 * 60 * 15

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildMatchupKey = (homeTeam?: string, awayTeam?: string) => {
  if (!homeTeam || !awayTeam) return ""
  return `${normalizeKey(awayTeam)}@${normalizeKey(homeTeam)}`
}

const mergeWhaleAlerts = (
  nextEdges: any[],
  cachedEdges?: any[]
) => {
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

const readCache = async (sport: string) => {
  try {
    const supabase = createClient()
    const { data, error } = await supabase
      .from("market_projections_cache")
      .select("edges, updated_at")
      .eq("sport", sport)
      .single()

    if (error || !data) return null
    return {
      edges: data.edges,
      updatedAt: data.updated_at,
      sport,
    }
  } catch {
    return null
  }
}

const writeCache = async (sport: string, edges: any[]) => {
  try {
    const supabase = createClient()
    const { error } = await supabase.from("market_projections_cache").upsert(
      {
        sport,
        edges,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "sport" }
    )
    if (error) {
      console.error("[market-projections] cache write failed", error)
      return false
    }
    return true
  } catch (error) {
    console.error("[market-projections] cache write failed", error)
    return false
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get("sport") || "basketball_nba"
  const forceRefresh = searchParams.get("refresh") === "1"
  const includeEdges = searchParams.get("include") === "1"

  try {
    const cached = (await readCache(sport)) as any
    if (forceRefresh) {
      const result = await analyzeSlateEdges(sport, { limit: 200 })
      const emptyResult = (result.edges?.length ?? 0) === 0
      if (emptyResult && cached?.edges?.length) {
        return NextResponse.json({
          ok: true,
          updatedAt: cached.updatedAt,
          sport,
          edgeCount: cached.edges?.length ?? 0,
          ...(includeEdges ? { edges: cached.edges ?? [] } : {}),
          fromCache: true,
        })
      }
      const mergedEdges = mergeWhaleAlerts(result.edges ?? [], cached?.edges)
      const payload = {
        updatedAt: new Date().toISOString(),
        sport,
        edges: mergedEdges,
      }
      await writeCache(sport, mergedEdges)
      return NextResponse.json({
        ok: true,
        updatedAt: payload.updatedAt,
        sport,
        edgeCount: payload.edges.length,
        ...(includeEdges ? { edges: payload.edges } : {}),
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
          edgeCount: cached.edges?.length ?? 0,
          ...(includeEdges ? { edges: cached.edges ?? [] } : {}),
          fromCache: true,
        })
      }
    }

    if (cached) {
      void analyzeSlateEdges(sport, { limit: 200 })
        .then((result) => {
          if ((result.edges?.length ?? 0) === 0 && cached?.edges?.length) {
            return null
          }
          const mergedEdges = mergeWhaleAlerts(result.edges ?? [], cached?.edges)
          const payload = {
            updatedAt: new Date().toISOString(),
            sport,
            edges: mergedEdges,
          }
          return writeCache(sport, mergedEdges)
        })
        .catch((error) =>
          console.error("[market-projections] refresh failed", error)
        )

      return NextResponse.json({
        ok: true,
        updatedAt: cached.updatedAt,
        sport,
        edgeCount: cached.edges?.length ?? 0,
        ...(includeEdges ? { edges: cached.edges ?? [] } : {}),
        refreshing: true,
        fromCache: true,
      })
    }

    const result = await analyzeSlateEdges(sport, { limit: 200 })
    const mergedEdges = mergeWhaleAlerts((result as any)?.edges ?? [], cached?.edges)
    const payload = {
      updatedAt: new Date().toISOString(),
      sport,
      edges: mergedEdges,
    }
    await writeCache(sport, mergedEdges)
    return NextResponse.json({
      ok: true,
      updatedAt: payload.updatedAt,
      sport,
      edgeCount: payload.edges.length,
      ...(includeEdges ? { edges: payload.edges } : {}),
      fromCache: false,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh projections."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
