import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import { recordMarketProjectionPicks } from "@/lib/services/market-projection-clv"
import { buildSharpProjections } from "@/lib/services/sharp-projections"
import { isWithinSharpRefreshWindow } from "@/lib/utils/sharp-refresh-window"

const CACHE_TTL_MS = 1000 * 60 * 30
const CURRENT_SLATE_LOOKBACK_MS = 1000 * 60 * 60 * 3
const CURRENT_SLATE_LOOKAHEAD_MS = 1000 * 60 * 60 * 48

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildMatchupKey = (homeTeam?: string, awayTeam?: string) => {
  if (!homeTeam || !awayTeam) return ""
  return `${normalizeKey(awayTeam)}@${normalizeKey(homeTeam)}`
}

const resolveEdgeCommenceTime = (edge: any): string | undefined => {
  if (!edge || typeof edge !== "object") return undefined
  if (typeof edge.commenceTime === "string" && edge.commenceTime) return edge.commenceTime
  if (typeof edge.commence_time === "string" && edge.commence_time) return edge.commence_time
  return undefined
}

const buildEdgeContextKey = (edge: any) => {
  const matchupKey = buildMatchupKey(edge?.homeTeam, edge?.awayTeam)
  if (!matchupKey) return ""
  const commenceTime = resolveEdgeCommenceTime(edge)
  if (!commenceTime) return matchupKey
  const commenceMs = Date.parse(commenceTime)
  if (!Number.isFinite(commenceMs)) return matchupKey
  return `${matchupKey}|${new Date(commenceMs).toISOString().slice(0, 10)}`
}

const hasNumericSplitValue = (splits: any) => {
  if (!splits || typeof splits !== "object") return false
  return Object.values(splits).some(
    (value) => typeof value === "number" && Number.isFinite(value)
  )
}

const hasSharpProjectionData = (sharpProjections: any) => {
  if (!sharpProjections || typeof sharpProjections !== "object") return false
  return Boolean(
    sharpProjections.spread ||
      sharpProjections.total ||
      sharpProjections.moneyline
  )
}

const mergeSharpContextFromCache = (
  nextEdges: any[],
  cachedEdges?: any[]
) => {
  if (!Array.isArray(nextEdges) || nextEdges.length === 0) return nextEdges
  if (!Array.isArray(cachedEdges) || cachedEdges.length === 0) return nextEdges

  const byContextKey = new Map<string, any>()
  const byMatchupKey = new Map<string, any>()
  for (const edge of cachedEdges) {
    const contextKey = buildEdgeContextKey(edge)
    if (contextKey) byContextKey.set(contextKey, edge)
    const matchupKey = buildMatchupKey(edge?.homeTeam, edge?.awayTeam)
    if (matchupKey && !byMatchupKey.has(matchupKey)) byMatchupKey.set(matchupKey, edge)
  }

  return nextEdges.map((edge) => {
    const contextKey = buildEdgeContextKey(edge)
    const matchupKey = buildMatchupKey(edge?.homeTeam, edge?.awayTeam)
    const cached =
      (contextKey ? byContextKey.get(contextKey) : undefined) ||
      (matchupKey ? byMatchupKey.get(matchupKey) : undefined)
    if (!cached) return edge

    const nextHasSignals =
      Array.isArray(edge?.sharpSignals) && edge.sharpSignals.length > 0
    const cachedHasSignals =
      Array.isArray(cached?.sharpSignals) && cached.sharpSignals.length > 0

    const nextHasLineMovements =
      Array.isArray(edge?.lineMovements) && edge.lineMovements.length > 0
    const cachedHasLineMovements =
      Array.isArray(cached?.lineMovements) && cached.lineMovements.length > 0

    const nextHasSplits = hasNumericSplitValue(edge?.splits)
    const cachedHasSplits = hasNumericSplitValue(cached?.splits)

    const nextHasSharpProjection = hasSharpProjectionData(edge?.sharpProjections)
    const cachedHasSharpProjection = hasSharpProjectionData(cached?.sharpProjections)

    if (
      (nextHasSignals || !cachedHasSignals) &&
      (nextHasLineMovements || !cachedHasLineMovements) &&
      (nextHasSplits || !cachedHasSplits) &&
      (nextHasSharpProjection || !cachedHasSharpProjection)
    ) {
      return edge
    }

    return {
      ...edge,
      sharpSignals:
        nextHasSignals || !cachedHasSignals
          ? edge.sharpSignals
          : cached.sharpSignals,
      lineMovements:
        nextHasLineMovements || !cachedHasLineMovements
          ? edge.lineMovements
          : cached.lineMovements,
      splits:
        nextHasSplits || !cachedHasSplits
          ? edge.splits
          : cached.splits,
      sharpProjections:
        nextHasSharpProjection || !cachedHasSharpProjection
          ? edge.sharpProjections
          : cached.sharpProjections,
    }
  })
}

const stripNonSharpBookOdds = (edges: any[]) => edges

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

const hydrateMissingSharpProjections = (edges: any[], sport: string): any[] => {
  if (!Array.isArray(edges) || edges.length === 0) return edges
  return edges.map((edge) => {
    if (!edge || !edge.homeTeam || !edge.awayTeam) return edge

    const hasSpreadMarket = Boolean(edge.spread)
    const hasTotalMarket = Boolean(edge.total)
    const hasMoneylineMarket = Boolean(edge.moneyline)
    const existing = edge.sharpProjections as
      | {
          spread?: unknown
          total?: unknown
          moneyline?: unknown
          tier?: unknown
        }
      | undefined

    const needsBackfill =
      !existing ||
      (hasSpreadMarket && !existing.spread) ||
      (hasTotalMarket && !existing.total) ||
      (hasMoneylineMarket && !existing.moneyline)

    if (!needsBackfill) return edge

    try {
      const computed = buildSharpProjections({
        sportKey: sport,
        homeTeam: edge.homeTeam,
        awayTeam: edge.awayTeam,
        spread: edge.spread,
        total: edge.total,
        moneyline: edge.moneyline,
        sharpSignals: edge.sharpSignals,
        lineMovements: edge.lineMovements,
        splits: edge.splits,
        whaleAlerts: edge.whaleAlerts,
      })

      return {
        ...edge,
        sharpProjections: {
          tier: existing?.tier ?? computed.tier,
          spread: existing?.spread ?? computed.spread,
          total: existing?.total ?? computed.total,
          moneyline: existing?.moneyline ?? computed.moneyline,
        },
      }
    } catch {
      return edge
    }
  })
}

const readCache = async (sport: string) => {
  try {
    const supabase = createServiceClient()
    const { data, error } = (await supabase
      .from("market_projections_cache" as any)
      .select("edges, updated_at")
      .eq("sport", sport)
      .single()) as unknown as { data: { edges: any[]; updated_at: string } | null; error: any }

    if (error || !data) return null
    const hydratedEdges = hydrateMissingSharpProjections(data.edges ?? [], sport)
    const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
    return {
      edges: sanitizedEdges,
      updatedAt: data.updated_at,
      sport,
    }
  } catch {
    return null
  }
}

const writeCache = async (sport: string, edges: any[]) => {
  try {
    const supabase = createServiceClient()
    const hydratedEdges = hydrateMissingSharpProjections(edges, sport)
    const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
    const { error } = (await supabase.from("market_projections_cache" as any).upsert(
      {
        sport,
        edges: sanitizedEdges,
        updated_at: new Date().toISOString(),
      } as any,
      { onConflict: "sport" }
    )) as unknown as { error: any }
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

const analyzeWithSharpFallback = async ({
  sport,
  limit,
  date,
}: {
  sport: string
  limit: number
  date?: string
}) => {
  const result = await analyzeSlateEdges(sport, {
    limit,
    date,
    oddsPreference: "best",
  })

  return { result, usedFallback: false as const }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sport = searchParams.get("sport") || "basketball_nba"
  const forceRefresh = searchParams.get("refresh") === "1"
  const forceBypass = searchParams.get("force") === "1"
  const noCache = searchParams.get("nocache") === "1"
  const includeEdges = searchParams.get("include") === "1"
  const date = searchParams.get("date") || undefined
  const limitParam = Number(searchParams.get("limit") ?? "")
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? limitParam : 200
  const refreshWindowOpen = isWithinSharpRefreshWindow()

  const buildBlockedResponse = (cachedPayload?: {
    updatedAt?: string | null
    edges?: any[]
  } | null) =>
    NextResponse.json({
      ok: true,
      updatedAt: cachedPayload?.updatedAt ?? null,
      sport,
      edgeCount: cachedPayload?.edges?.length ?? 0,
      ...(includeEdges ? { edges: cachedPayload?.edges ?? [] } : {}),
      fromCache: Boolean(cachedPayload),
      refreshBlocked: true,
    })

  try {
    if (noCache) {
      if (!refreshWindowOpen) {
        const cachedNoCache = await readCache(sport)
        return buildBlockedResponse(cachedNoCache)
      }
      const { result, usedFallback } = await analyzeWithSharpFallback({
        sport,
        limit,
        date,
      })
      const hydratedEdges = hydrateMissingSharpProjections(result.edges ?? [], sport)
      const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
      return NextResponse.json({
        ok: true,
        updatedAt: new Date().toISOString(),
        sport,
        edgeCount: sanitizedEdges.length,
        ...(includeEdges ? { edges: sanitizedEdges } : {}),
        fromCache: false,
        usedFallback,
      })
    }

    const cached = (await readCache(sport)) as any
    const cachedCurrentSlateEdgeCount = countCurrentSlateEdges(cached?.edges)
    const hasCurrentSlateCache = cachedCurrentSlateEdgeCount > 0

    if (forceRefresh) {
      if (!refreshWindowOpen) {
        return buildBlockedResponse(cached)
      }
      if (cached && !forceBypass && hasCurrentSlateCache) {
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

      const { result, usedFallback } = await analyzeWithSharpFallback({
        sport,
        limit,
        date,
      })
      const mergedEdges = mergeSharpContextFromCache(
        mergeWhaleAlerts(result.edges ?? [], cached?.edges),
        cached?.edges
      )
      const hydratedEdges = hydrateMissingSharpProjections(mergedEdges, sport)
      const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)

      const nextCurrentSlateEdgeCount = countCurrentSlateEdges(sanitizedEdges)
      if (nextCurrentSlateEdgeCount === 0 && hasCurrentSlateCache) {
        return NextResponse.json({
          ok: true,
          updatedAt: cached.updatedAt,
          sport,
          edgeCount: cached.edges?.length ?? 0,
          ...(includeEdges ? { edges: cached.edges ?? [] } : {}),
          fromCache: true,
          usedFallback,
        })
      }

      const payload = {
        updatedAt: new Date().toISOString(),
        sport,
        edges: sanitizedEdges,
      }
      await recordMarketProjectionPicks({
        sport,
        edges: sanitizedEdges as any,
        pickedAt: payload.updatedAt,
      })
      await writeCache(sport, sanitizedEdges)
      return NextResponse.json({
        ok: true,
        updatedAt: payload.updatedAt,
        sport,
        edgeCount: payload.edges.length,
        ...(includeEdges ? { edges: payload.edges } : {}),
        fromCache: false,
        usedFallback,
      })
    }

    if (cached && hasCurrentSlateCache) {
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

    if (cached && hasCurrentSlateCache) {
      if (!refreshWindowOpen) {
        return buildBlockedResponse(cached)
      }

      void analyzeWithSharpFallback({ sport, limit, date })
        .then(async ({ result }) => {
          const mergedEdges = mergeSharpContextFromCache(
            mergeWhaleAlerts(result.edges ?? [], cached?.edges),
            cached?.edges
          )
          const hydratedEdges = hydrateMissingSharpProjections(mergedEdges, sport)
          const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
          if (countCurrentSlateEdges(sanitizedEdges) === 0 && hasCurrentSlateCache) {
            return null
          }
          const payload = {
            updatedAt: new Date().toISOString(),
            sport,
            edges: sanitizedEdges,
          }
          await recordMarketProjectionPicks({
            sport,
            edges: sanitizedEdges as any,
            pickedAt: payload.updatedAt,
          })
          return writeCache(sport, sanitizedEdges)
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

    if (!refreshWindowOpen) {
      return buildBlockedResponse(cached)
    }

    const { result, usedFallback } = await analyzeWithSharpFallback({
      sport,
      limit,
      date,
    })
    const mergedEdges = mergeSharpContextFromCache(
      mergeWhaleAlerts((result as any)?.edges ?? [], cached?.edges),
      cached?.edges
    )
    const hydratedEdges = hydrateMissingSharpProjections(mergedEdges, sport)
    const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
    const payload = {
      updatedAt: new Date().toISOString(),
      sport,
      edges: sanitizedEdges,
    }
    await recordMarketProjectionPicks({
      sport,
      edges: sanitizedEdges as any,
      pickedAt: payload.updatedAt,
    })
    await writeCache(sport, sanitizedEdges)
    return NextResponse.json({
      ok: true,
      updatedAt: payload.updatedAt,
      sport,
      edgeCount: payload.edges.length,
      ...(includeEdges ? { edges: payload.edges } : {}),
      fromCache: false,
      usedFallback,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh projections."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
