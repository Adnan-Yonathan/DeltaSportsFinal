import MarketProjectionsClient from "./market-projections-client"
import SportSelector from "./sport-selector"
import ToolsNav from "@/components/tools-nav"
import MobileToolsNav from "@/components/mobile-tools-nav"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { buildSharpProjections } from "@/lib/services/sharp-projections"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { cookies } from "next/headers"

export const dynamic = "force-dynamic"
export const revalidate = 0

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

const SPORT_OPTIONS: SportOption[] = [
  { key: "basketball_nba", label: "NBA", locked: false },
  { key: "basketball_ncaab", label: "NCAAB", locked: false },
  { key: "americanfootball_ncaaf", label: "CFB", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
]
const SPORT_PREFERENCE_COOKIE = "market_projections_sport"
const DEFAULT_SPORT_PRIORITY = [
  "basketball_ncaab",
  "icehockey_nhl",
  "americanfootball_nfl",
  "americanfootball_ncaaf",
  "basketball_nba",
]
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

const countCurrentSlateEdges = (edges: GameEdgeAnalysis[]) => {
  if (!Array.isArray(edges) || edges.length === 0) return 0
  const nowMs = Date.now()
  return edges.reduce((count, edge) => {
    const commenceTime =
      (edge as unknown as { commenceTime?: string; commence_time?: string })
        ?.commenceTime ??
      (edge as unknown as { commenceTime?: string; commence_time?: string })
        ?.commence_time
    return isCurrentSlateGame(commenceTime, nowMs) ? count + 1 : count
  }, 0)
}

const stripNonSharpBookOdds = (edges: GameEdgeAnalysis[]) => edges

const hydrateMissingSharpProjections = (
  edges: GameEdgeAnalysis[],
  sport: string
): GameEdgeAnalysis[] => {
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
          tier: computed.tier,
          spread: (existing?.spread as any) ?? computed.spread,
          total: (existing?.total as any) ?? computed.total,
          moneyline: (existing?.moneyline as any) ?? computed.moneyline,
        },
      }
    } catch (error) {
      console.warn("[market-projections] backfill failed", error)
      return edge
    }
  })
}


export default async function MarketProjectionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasProjectionAccess = membership.hasProjectionAccess
  const previewMode = !hasProjectionAccess
  const tier = membership.isActive ? membership.tier : membership.tier ?? null
  const cookieStore = cookies()
  const cookieSport = cookieStore.get(SPORT_PREFERENCE_COOKIE)?.value
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  const isUnlockedSport = (value: string | undefined) =>
    Boolean(
      value &&
        SPORT_OPTIONS.some((option) => option.key === value && !option.locked)
    )

  const requestedSportKey = isUnlockedSport(requestedSport)
    ? requestedSport!
    : null
  const cookieSportKey = isUnlockedSport(cookieSport) ? cookieSport! : null

  let sport = requestedSportKey ?? cookieSportKey ?? "basketball_nba"
  let edges: GameEdgeAnalysis[] = []
  let errorMessage: string | null = null
  let hasCache = true
  let lastUpdated: string | null = null
  let selected = SPORT_OPTIONS.find((option) => option.key === sport) ?? SPORT_OPTIONS[0]
  let isLocked = Boolean(selected.locked)

  if (!isLocked) {
    try {
      const serviceClient = createServiceClient()
      const loadCacheForSport = async (sportKey: string) => {
        const { data, error } = (await serviceClient
          .from("market_projections_cache" as any)
          .select("edges, updated_at")
          .eq("sport", sportKey)
          .single()) as unknown as {
          data: { edges: any[]; updated_at: string } | null
          error: any
        }

        if (error || !data) return null
        const cachedEdges = Array.isArray(data.edges)
          ? (data.edges as GameEdgeAnalysis[])
          : []
        return {
          edges: cachedEdges,
          currentSlateEdgeCount: countCurrentSlateEdges(cachedEdges),
          updatedAt: data.updated_at ?? null,
        }
      }

      let cached = await loadCacheForSport(sport)

      if (
        !requestedSportKey &&
        (!cached || cached.currentSlateEdgeCount === 0)
      ) {
        for (const candidateSport of DEFAULT_SPORT_PRIORITY) {
          if (!isUnlockedSport(candidateSport) || candidateSport === sport) continue
          const candidateCache = await loadCacheForSport(candidateSport)
          if (candidateCache && candidateCache.currentSlateEdgeCount > 0) {
            sport = candidateSport
            selected =
              SPORT_OPTIONS.find((option) => option.key === sport) ?? SPORT_OPTIONS[0]
            isLocked = Boolean(selected.locked)
            cached = candidateCache
            break
          }
        }
      }

      if (!cached || cached.currentSlateEdgeCount === 0) {
        hasCache = false
        errorMessage = "No current projections yet."
      } else {
        edges = cached.edges
        lastUpdated = cached.updatedAt

        const shouldBackfill =
          sport === "basketball_nba" ||
          sport === "basketball_ncaab" ||
          sport === "americanfootball_ncaaf" ||
          sport === "americanfootball_nfl" ||
          sport === "icehockey_nhl"
        if (shouldBackfill) {
          edges = hydrateMissingSharpProjections(edges, sport)
        }
      }
    } catch (error) {
      hasCache = false
      errorMessage = "Unable to load projections."
    }
  } else {
    hasCache = false
    errorMessage = "This sport is locked."
  }
  if (edges.length > 0) {
    edges = stripNonSharpBookOdds(edges)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-start justify-between gap-4 md:w-auto md:flex-1 md:items-center">
              <div className="hidden md:block">
                <ToolsNav />
              </div>
              <div className="ml-auto md:hidden">
                <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
              </div>
            </div>
            <div className="hidden md:block">
              <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
            </div>
          </div>
        </div>
      </div>
      <div className="pt-[120px] px-2 pb-[96px] sm:px-4 sm:pt-[140px] sm:pb-0">
        <div className="mx-auto w-full max-w-none">
          <MarketProjectionsClient
            key={sport}
            initialEdges={edges}
            initialUpdatedAt={lastUpdated}
            hasCache={hasCache}
            errorMessage={errorMessage}
            sport={sport}
            isLocked={isLocked}
            tier={tier}
            previewMode={previewMode}
          />
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}

