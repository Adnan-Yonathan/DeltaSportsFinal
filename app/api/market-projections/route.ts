import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import { recordMarketProjectionPicks } from "@/lib/services/market-projection-clv"
import { buildSharpProjections } from "@/lib/services/sharp-projections"

const CACHE_TTL_MS = 1000 * 60 * 30
const SHARP_PROJECTION_BOOKS = ["pinnacle", "circa"] as const

const normalizeKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "")

const buildMatchupKey = (homeTeam?: string, awayTeam?: string) => {
  if (!homeTeam || !awayTeam) return ""
  return `${normalizeKey(awayTeam)}@${normalizeKey(homeTeam)}`
}

const normalizeBook = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")

const isSharpProjectionBook = (value?: string | null) => {
  const normalized = normalizeBook(value)
  if (!normalized) return true
  return normalized.includes("pinnacle") || normalized.includes("circa")
}

const stripNonSharpBookOdds = (edges: any[]) =>
  edges.map((edge) => {
    const spread = edge?.spread
      ? {
          ...edge.spread,
          bestBook: isSharpProjectionBook(edge.spread.bestBook)
            ? edge.spread.bestBook
            : undefined,
          bestOdds: isSharpProjectionBook(edge.spread.bestBook)
            ? edge.spread.bestOdds
            : undefined,
          bestHomeBook: isSharpProjectionBook(edge.spread.bestHomeBook)
            ? edge.spread.bestHomeBook
            : undefined,
          bestHomeOdds: isSharpProjectionBook(edge.spread.bestHomeBook)
            ? edge.spread.bestHomeOdds
            : undefined,
          bestAwayBook: isSharpProjectionBook(edge.spread.bestAwayBook)
            ? edge.spread.bestAwayBook
            : undefined,
          bestAwayOdds: isSharpProjectionBook(edge.spread.bestAwayBook)
            ? edge.spread.bestAwayOdds
            : undefined,
          prediction:
            edge.spread.prediction && isSharpProjectionBook(edge.spread.prediction.book)
              ? edge.spread.prediction
              : undefined,
        }
      : undefined

    const total = edge?.total
      ? {
          ...edge.total,
          bestBook: isSharpProjectionBook(edge.total.bestBook)
            ? edge.total.bestBook
            : undefined,
          bestOdds: isSharpProjectionBook(edge.total.bestBook)
            ? edge.total.bestOdds
            : undefined,
          bestUnderOdds: isSharpProjectionBook(edge.total.bestBook)
            ? edge.total.bestUnderOdds
            : undefined,
          prediction:
            edge.total.prediction && isSharpProjectionBook(edge.total.prediction.book)
              ? edge.total.prediction
              : undefined,
        }
      : undefined

    const homeBookAllowed = isSharpProjectionBook(
      edge?.moneyline?.sportsbook?.homeBook
    )
    const awayBookAllowed = isSharpProjectionBook(
      edge?.moneyline?.sportsbook?.awayBook
    )
    const predictionHomeAllowed = isSharpProjectionBook(
      edge?.moneyline?.prediction?.homeBook
    )
    const predictionAwayAllowed = isSharpProjectionBook(
      edge?.moneyline?.prediction?.awayBook
    )

    const moneyline = edge?.moneyline
      ? {
          ...edge.moneyline,
          sportsbook:
            edge.moneyline.sportsbook &&
            (homeBookAllowed || awayBookAllowed)
              ? {
                  ...edge.moneyline.sportsbook,
                  homeBook: homeBookAllowed
                    ? edge.moneyline.sportsbook.homeBook
                    : undefined,
                  homeOdds: homeBookAllowed
                    ? edge.moneyline.sportsbook.homeOdds
                    : undefined,
                  awayBook: awayBookAllowed
                    ? edge.moneyline.sportsbook.awayBook
                    : undefined,
                  awayOdds: awayBookAllowed
                    ? edge.moneyline.sportsbook.awayOdds
                    : undefined,
                }
              : undefined,
          prediction:
            edge.moneyline.prediction &&
            (predictionHomeAllowed || predictionAwayAllowed)
              ? {
                  ...edge.moneyline.prediction,
                  homeBook: predictionHomeAllowed
                    ? edge.moneyline.prediction.homeBook
                    : undefined,
                  homeOdds: predictionHomeAllowed
                    ? edge.moneyline.prediction.homeOdds
                    : undefined,
                  awayBook: predictionAwayAllowed
                    ? edge.moneyline.prediction.awayBook
                    : undefined,
                  awayOdds: predictionAwayAllowed
                    ? edge.moneyline.prediction.awayOdds
                    : undefined,
                }
              : undefined,
        }
      : undefined

    return { ...edge, spread, total, moneyline }
  })

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
  const sharpOddsOptions = {
    limit,
    date,
    bookmakers: [...SHARP_PROJECTION_BOOKS],
    oddsPreference: "lowest" as const,
  }

  try {
    if (noCache) {
      const result = await analyzeSlateEdges(sport, sharpOddsOptions)
      const hydratedEdges = hydrateMissingSharpProjections(result.edges ?? [], sport)
      const sanitizedEdges = stripNonSharpBookOdds(hydratedEdges)
      return NextResponse.json({
        ok: true,
        updatedAt: new Date().toISOString(),
        sport,
        edgeCount: sanitizedEdges.length,
        ...(includeEdges ? { edges: sanitizedEdges } : {}),
        fromCache: false,
      })
    }

    const cached = (await readCache(sport)) as any
    if (forceRefresh) {
      if (cached && !forceBypass) {
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
      const result = await analyzeSlateEdges(sport, sharpOddsOptions)
      const mergedEdges = mergeWhaleAlerts(result.edges ?? [], cached?.edges)
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
      void analyzeSlateEdges(sport, sharpOddsOptions)
        .then(async (result) => {
          if ((result.edges?.length ?? 0) === 0 && cached?.edges?.length) {
            return null
          }
          const mergedEdges = mergeWhaleAlerts(result.edges ?? [], cached?.edges)
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

    const result = await analyzeSlateEdges(sport, sharpOddsOptions)
    const mergedEdges = mergeWhaleAlerts((result as any)?.edges ?? [], cached?.edges)
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
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to refresh projections."
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
