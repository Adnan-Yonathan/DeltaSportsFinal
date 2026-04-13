import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import { snapshotMarketLimitHistory } from "@/lib/services/market-limit-history"
import { isWithinSharpRefreshWindow } from "@/lib/utils/sharp-refresh-window"

const CACHE_TTL_MS = 1000 * 60 * 30
const CURRENT_SLATE_LOOKAHEAD_MS = 1000 * 60 * 60 * 48
const REFRESH_LOCK_TTL_MS = 1000 * 60 * 8

const SHARP_BOOK_KEYS = ["pinnacle", "circa", "novig", "prophetx"] as const

const MARKET_KEYS = ["spread", "total", "moneyline"] as const

type RefreshComputationResult = {
  updatedAt: string
  edges: any[]
  usedFallback: boolean
  currentSlateEdgeCount: number
}

const inFlightRefreshes = new Map<
  string,
  { startedAt: number; promise: Promise<RefreshComputationResult> }
>()

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

const pickSharpBookQuotes = (quotes: any) => {
  if (!quotes || typeof quotes !== "object") return undefined
  const filteredEntries = Object.entries(quotes).filter(([book]) =>
    SHARP_BOOK_KEYS.includes(book as (typeof SHARP_BOOK_KEYS)[number])
  )
  if (!filteredEntries.length) return undefined
  return Object.fromEntries(filteredEntries)
}

const edgeHasSharpQuotes = (edge: any) => {
  return MARKET_KEYS.some((market) => {
    const quotes = edge?.[market]?.bookQuotes
    if (!quotes || typeof quotes !== "object") return false
    return SHARP_BOOK_KEYS.some((book) => {
      const quote = quotes?.[book]
      return Boolean(quote && typeof quote === "object")
    })
  })
}

const quoteHasNumericLimit = (quote: any) =>
  quote &&
  typeof quote === "object" &&
  Object.entries(quote).some(([key, value]) => {
    if (!key.toLowerCase().includes("limit")) return false
    return typeof value === "number" && Number.isFinite(value)
  })

const edgeHasSharpLimits = (edge: any) => {
  return MARKET_KEYS.some((market) => {
    const quotes = edge?.[market]?.bookQuotes
    if (!quotes || typeof quotes !== "object") return false
    return SHARP_BOOK_KEYS.some((book) => quoteHasNumericLimit(quotes?.[book]))
  })
}

const hasSharpSportsbookQuotes = (edges?: any[]) => {
  if (!Array.isArray(edges) || edges.length === 0) return false
  return edges.some((edge) => edgeHasSharpQuotes(edge))
}

const hasSharpLimitData = (edges?: any[]) => {
  if (!Array.isArray(edges) || edges.length === 0) return false
  return edges.some((edge) => edgeHasSharpLimits(edge))
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

    const merged = {
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
    }

    for (const market of MARKET_KEYS) {
      const nextMarket = merged?.[market]
      const cachedMarket = cached?.[market]
      if (!cachedMarket) continue
      const nextQuotes = nextMarket?.bookQuotes
      const cachedQuotes = cachedMarket?.bookQuotes

      const nextMarketHasQuotes = Boolean(pickSharpBookQuotes(nextQuotes))
      const cachedMarketHasQuotes = Boolean(pickSharpBookQuotes(cachedQuotes))

      const mergedQuotes = nextMarketHasQuotes || !cachedMarketHasQuotes
        ? nextQuotes
        : cachedQuotes

      if (!nextMarket && cachedMarket) {
        ;(merged as any)[market] = {
          ...cachedMarket,
          bookQuotes: mergedQuotes,
        }
      } else if (nextMarket) {
        ;(merged as any)[market] = {
          ...nextMarket,
          bookQuotes: mergedQuotes,
        }
      }
    }

    return merged
  })
}

const stripNonSharpBookOdds = (edges: any[]) => {
  if (!Array.isArray(edges)) return []
  return edges.map((edge) => {
    const nextEdge: any = { ...edge }
    for (const market of MARKET_KEYS) {
      const marketPayload = edge?.[market]
      if (!marketPayload || typeof marketPayload !== "object") continue
      nextEdge[market] = {
        ...marketPayload,
        bookQuotes: pickSharpBookQuotes(marketPayload.bookQuotes),
      }
    }
    return nextEdge
  })
}

const isNotStartedGame = (commenceTime?: string | null, nowMs = Date.now()) => {
  if (!commenceTime) return false
  const gameTimeMs = Date.parse(commenceTime)
  if (!Number.isFinite(gameTimeMs)) return false
  return gameTimeMs > nowMs
}

const filterNotStartedEdges = (edges?: any[], nowMs = Date.now()) => {
  if (!Array.isArray(edges) || edges.length === 0) return []
  return edges.filter((edge) => {
    const commenceTime = edge?.commenceTime ?? edge?.commence_time
    return isNotStartedGame(commenceTime, nowMs)
  })
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

const prepareMovementEdges = (edges: any[], cachedEdges?: any[]) => {
  const withCachedContext = mergeSharpContextFromCache(
    mergeWhaleAlerts(edges, cachedEdges),
    cachedEdges
  )
  const upcomingEdges = filterNotStartedEdges(withCachedContext)
  return stripNonSharpBookOdds(upcomingEdges)
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
    return {
      edges: prepareMovementEdges(data.edges ?? []),
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
    const sanitizedEdges = prepareMovementEdges(edges)
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
    gameTimeMs > nowMs &&
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

const computeAndPersistRefresh = async ({
  sport,
  limit,
  date,
  cachedEdges,
  hasCurrentSlateCache,
}: {
  sport: string
  limit: number
  date?: string
  cachedEdges?: any[]
  hasCurrentSlateCache: boolean
}): Promise<RefreshComputationResult> => {
  const { result, usedFallback } = await analyzeWithSharpFallback({
    sport,
    limit,
    date,
  })

  const sanitizedEdges = prepareMovementEdges(result.edges ?? [], cachedEdges)
  const currentSlateEdgeCount = countCurrentSlateEdges(sanitizedEdges)

  if (!(currentSlateEdgeCount === 0 && hasCurrentSlateCache)) {
    const updatedAt = new Date().toISOString()
    await snapshotMarketLimitHistory({
      sport,
      edges: sanitizedEdges,
      recordedAt: updatedAt,
    })
    await writeCache(sport, sanitizedEdges)
    return {
      updatedAt,
      edges: sanitizedEdges,
      usedFallback,
      currentSlateEdgeCount,
    }
  }

  return {
    updatedAt: new Date().toISOString(),
    edges: sanitizedEdges,
    usedFallback,
    currentSlateEdgeCount,
  }
}

const runRefreshWithLock = (params: {
  sport: string
  limit: number
  date?: string
  cachedEdges?: any[]
  hasCurrentSlateCache: boolean
}) => {
  const key = `${params.sport}|${params.date ?? "latest"}|${params.limit}`
  const now = Date.now()
  const active = inFlightRefreshes.get(key)
  if (active && now - active.startedAt < REFRESH_LOCK_TTL_MS) {
    return active.promise
  }

  const promise = computeAndPersistRefresh(params).finally(() => {
    const current = inFlightRefreshes.get(key)
    if (current?.promise === promise) {
      inFlightRefreshes.delete(key)
    }
  })
  inFlightRefreshes.set(key, { startedAt: now, promise })
  return promise
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
      const updatedAt = new Date().toISOString()
      const sanitizedEdges = prepareMovementEdges(result.edges ?? [])
      await snapshotMarketLimitHistory({
        sport,
        edges: sanitizedEdges,
        recordedAt: updatedAt,
      })
      return NextResponse.json({
        ok: true,
        updatedAt,
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
    const hasSharpQuotesInCache = hasSharpSportsbookQuotes(cached?.edges)
    const hasSharpLimitsInCache = hasSharpLimitData(cached?.edges)
    const needsLimitBackfill =
      hasCurrentSlateCache && hasSharpQuotesInCache && !hasSharpLimitsInCache
    const allowRefreshOutsideWindow = needsLimitBackfill

    if (forceRefresh) {
      if (!refreshWindowOpen && !allowRefreshOutsideWindow) {
        return buildBlockedResponse(cached)
      }
      if (
        cached &&
        !forceBypass &&
        hasCurrentSlateCache &&
        hasSharpQuotesInCache &&
        hasSharpLimitsInCache
      ) {
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

      const refreshResult = await runRefreshWithLock({
        sport,
        limit,
        date,
        cachedEdges: cached?.edges,
        hasCurrentSlateCache,
      })

      if (refreshResult.currentSlateEdgeCount === 0 && hasCurrentSlateCache) {
        return NextResponse.json({
          ok: true,
          updatedAt: cached.updatedAt,
          sport,
          edgeCount: cached.edges?.length ?? 0,
          ...(includeEdges ? { edges: cached.edges ?? [] } : {}),
          fromCache: true,
          usedFallback: refreshResult.usedFallback,
        })
      }

      return NextResponse.json({
        ok: true,
        updatedAt: refreshResult.updatedAt,
        sport,
        edgeCount: refreshResult.edges.length,
        ...(includeEdges ? { edges: refreshResult.edges } : {}),
        fromCache: false,
        usedFallback: refreshResult.usedFallback,
      })
    }

    if (cached && hasCurrentSlateCache && hasSharpQuotesInCache && hasSharpLimitsInCache) {
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
      if (!refreshWindowOpen && !allowRefreshOutsideWindow) {
        return buildBlockedResponse(cached)
      }

      if (!hasSharpQuotesInCache || !hasSharpLimitsInCache) {
        const refreshResult = await runRefreshWithLock({
          sport,
          limit,
          date,
          cachedEdges: cached?.edges,
          hasCurrentSlateCache,
        })
        return NextResponse.json({
          ok: true,
          updatedAt: refreshResult.updatedAt,
          sport,
          edgeCount: refreshResult.edges.length,
          ...(includeEdges ? { edges: refreshResult.edges } : {}),
          fromCache: false,
          usedFallback: refreshResult.usedFallback,
        })
      }

      void runRefreshWithLock({
        sport,
        limit,
        date,
        cachedEdges: cached?.edges,
        hasCurrentSlateCache,
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

    const refreshResult = await runRefreshWithLock({
      sport,
      limit,
      date,
      cachedEdges: cached?.edges,
      hasCurrentSlateCache,
    })
    return NextResponse.json({
      ok: true,
      updatedAt: refreshResult.updatedAt,
      sport,
      edgeCount: refreshResult.edges.length,
      ...(includeEdges ? { edges: refreshResult.edges } : {}),
      fromCache: false,
      usedFallback: refreshResult.usedFallback,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh sharp movement."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
