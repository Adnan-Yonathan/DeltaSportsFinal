import { NextRequest, NextResponse } from "next/server"

import { fetchTeamMarketOrderbooksSnapshot } from "@/lib/services/market-orderbooks"
import {
  getPropOrderbooksCache,
  setPropOrderbooksCache,
} from "@/lib/services/prop-orderbooks-cache"
import type {
  TeamMarketKey,
  TeamMarketOrderbookItem,
} from "@/lib/types/market-orderbooks"

export const dynamic = "force-dynamic"

const DEFAULT_DEPTH = 8
const DEFAULT_MIN_SHARP_NOTIONAL = 2000
const PERSISTED_CACHE_LIMIT = 240

const SUPPORTED_SPORTS = new Set([
  "all",
  "basketball_nba",
  "basketball_ncaab",
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "icehockey_nhl",
  "baseball_mlb",
])

const SUPPORTED_MARKET_TYPES = new Set(["all", "spreads", "totals", "h2h"])

type PersistedPayload = {
  sport: string
  marketType: TeamMarketKey | "all"
  depth: number
  minSharpNotional: number
  updatedAt: string
  items: TeamMarketOrderbookItem[]
}

const buildCacheKey = (
  sport: string,
  marketType: TeamMarketKey | "all",
  depth: number,
  minSharpNotional: number
) =>
  `market-orderbooks:sport:${sport}:market:${marketType}:depth:${depth}:min:${minSharpNotional}`

const parsePersistedPayload = (value: unknown): PersistedPayload | null => {
  if (!value || typeof value !== "object") return null
  const payload = value as Partial<PersistedPayload>
  if (
    typeof payload.sport !== "string" ||
    typeof payload.marketType !== "string" ||
    typeof payload.depth !== "number" ||
    typeof payload.minSharpNotional !== "number" ||
    typeof payload.updatedAt !== "string" ||
    !Array.isArray(payload.items)
  ) {
    return null
  }
  return payload as PersistedPayload
}

const buildCachedResponse = (
  sport: string,
  marketType: TeamMarketKey | "all",
  normalizedLimit: number,
  cachedPayload: PersistedPayload,
  cacheSource: "persistent" | "persistent_all_fallback",
  fetchedAt: string | null
) => {
  const bySport =
    sport === "all"
      ? cachedPayload.items
      : cachedPayload.items.filter((item) => item.sportKey === sport)
  const byMarket =
    marketType === "all"
      ? bySport
      : bySport.filter((item) => item.marketKey === marketType)
  const sliced = byMarket.slice(0, normalizedLimit)

  return NextResponse.json({
    ok: true,
    sport,
    marketType,
    updatedAt: cachedPayload.updatedAt,
    count: sliced.length,
    items: sliced,
    cache: {
      forcedRefresh: false,
      source: cacheSource,
      fetchedAt,
    },
  })
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get("sport") || "all"
    const marketType = (searchParams.get("marketType") || "all") as
      | TeamMarketKey
      | "all"
    const forceRefresh = searchParams.get("refresh") === "1"
    const requestedModeParam = searchParams.get("mode")
    const limit = Number(searchParams.get("limit") || 120)
    const depth = Number(searchParams.get("depth") || DEFAULT_DEPTH)
    const minSharpNotional = Number(
      searchParams.get("minSharpNotional") || DEFAULT_MIN_SHARP_NOTIONAL
    )

    if (!SUPPORTED_SPORTS.has(sport)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported sport" },
        { status: 400 }
      )
    }
    if (!SUPPORTED_MARKET_TYPES.has(marketType)) {
      return NextResponse.json(
        { ok: false, error: "Unsupported market type" },
        { status: 400 }
      )
    }

    const normalizedLimit = Number.isFinite(limit)
      ? Math.min(Math.max(limit, 1), 300)
      : 120
    const normalizedDepth = Number.isFinite(depth)
      ? Math.min(Math.max(depth, 1), 20)
      : DEFAULT_DEPTH
    const normalizedMinSharpNotional = Number.isFinite(minSharpNotional)
      ? Math.max(minSharpNotional, 0)
      : DEFAULT_MIN_SHARP_NOTIONAL
    const requestedMode =
      requestedModeParam === "fast" || requestedModeParam === "full"
        ? requestedModeParam
        : null
    const mode = requestedMode ?? (forceRefresh ? "full" : "fast")

    const canUsePersistentCache =
      normalizedDepth === DEFAULT_DEPTH &&
      normalizedMinSharpNotional === DEFAULT_MIN_SHARP_NOTIONAL

    if (canUsePersistentCache && !forceRefresh) {
      const exactCacheKey = buildCacheKey(
        sport,
        marketType,
        normalizedDepth,
        normalizedMinSharpNotional
      )
      const cachedExact = await getPropOrderbooksCache(exactCacheKey)
      const exactPayload = parsePersistedPayload(cachedExact?.payload)
      if (exactPayload) {
        return buildCachedResponse(
          sport,
          marketType,
          normalizedLimit,
          exactPayload,
          "persistent",
          cachedExact?.fetched_at ?? null
        )
      }

      if (sport !== "all") {
        const allCacheKey = buildCacheKey(
          "all",
          marketType,
          normalizedDepth,
          normalizedMinSharpNotional
        )
        const cachedAll = await getPropOrderbooksCache(allCacheKey)
        const allPayload = parsePersistedPayload(cachedAll?.payload)
        if (allPayload) {
          return buildCachedResponse(
            sport,
            marketType,
            normalizedLimit,
            allPayload,
            "persistent_all_fallback",
            cachedAll?.fetched_at ?? null
          )
        }
      }
    }

    const computeLimit =
      forceRefresh && canUsePersistentCache && mode === "full"
        ? Math.max(normalizedLimit, PERSISTED_CACHE_LIMIT)
        : normalizedLimit

    const snapshot = await fetchTeamMarketOrderbooksSnapshot({
      sportKey: sport,
      marketKey: marketType,
      limit: computeLimit,
      depth: normalizedDepth,
      minSharpNotional: normalizedMinSharpNotional,
      mode,
    })

    if (canUsePersistentCache) {
      const cacheKey = buildCacheKey(
        sport,
        marketType,
        normalizedDepth,
        normalizedMinSharpNotional
      )
      const payload: PersistedPayload = {
        sport,
        marketType,
        depth: normalizedDepth,
        minSharpNotional: normalizedMinSharpNotional,
        updatedAt: snapshot.updatedAt,
        items: snapshot.items,
      }
      await setPropOrderbooksCache(cacheKey, payload)
    }

    return NextResponse.json({
      ok: true,
      sport,
      marketType,
      updatedAt: snapshot.updatedAt,
      count: snapshot.items.slice(0, normalizedLimit).length,
      items: snapshot.items.slice(0, normalizedLimit),
      cache: {
        forcedRefresh: forceRefresh,
        source: forceRefresh
          ? canUsePersistentCache
            ? mode === "full"
              ? "live_computed_persisted_full"
              : "live_computed_persisted_fast_refresh"
            : mode === "full"
              ? "live_computed_full"
              : "live_computed_fast_refresh"
          : canUsePersistentCache
            ? "live_computed_persisted_fast"
            : "live_computed_fast",
      },
    })
  } catch (error: any) {
    console.error("[market-orderbooks] error:", error)
    return NextResponse.json(
      { ok: false, error: error.message || "Internal server error" },
      { status: 500 }
    )
  }
}

