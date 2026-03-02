import MarketProjectionsClient from "./market-projections-client"
import MobileToolsNav from "@/components/mobile-tools-nav"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { buildSharpProjections } from "@/lib/services/sharp-projections"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

export const dynamic = "force-dynamic"
export const revalidate = 0

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

const SPORT_OPTIONS: SportOption[] = [
  { key: "all", label: "All Leagues", locked: false },
  { key: "basketball_nba", label: "NBA", locked: false },
  { key: "basketball_ncaab", label: "NCAAB", locked: false },
  { key: "americanfootball_ncaaf", label: "CFB", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
]

const ACTIVE_SPORT_KEYS = SPORT_OPTIONS.filter((option) => option.key !== "all").map(
  (option) => option.key
)
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

const loadCacheForSport = async (
  serviceClient: ReturnType<typeof createServiceClient>,
  sportKey: string
) => {
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
    sport: sportKey,
    edges: cachedEdges,
    currentSlateEdgeCount: countCurrentSlateEdges(cachedEdges),
    updatedAt: data.updated_at ?? null,
  }
}

const attachSportToEdges = (edges: GameEdgeAnalysis[], sportKey: string) =>
  edges.map((edge) => ({
    ...edge,
    sport: sportKey,
  }))

const resolveMostRecentTimestamp = (values: Array<string | null>) => {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value)) as number[]
  if (!timestamps.length) return null
  return new Date(Math.max(...timestamps)).toISOString()
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

  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  const isValidSport = (value: string | undefined) =>
    Boolean(
      value &&
        SPORT_OPTIONS.some((option) => option.key === value)
    )

  const sport = isValidSport(requestedSport) ? requestedSport! : "all"
  let edges: GameEdgeAnalysis[] = []
  let errorMessage: string | null = null
  let hasCache = true
  let lastUpdated: string | null = null
  const isLocked = false

  try {
    const serviceClient = createServiceClient()

    if (sport === "all") {
      const cachedBySport = await Promise.all(
        ACTIVE_SPORT_KEYS.map((sportKey) => loadCacheForSport(serviceClient, sportKey))
      )
      const availableCaches = cachedBySport.filter(Boolean) as Array<{
        sport: string
        edges: GameEdgeAnalysis[]
        currentSlateEdgeCount: number
        updatedAt: string | null
      }>

      if (!availableCaches.length) {
        hasCache = false
        errorMessage = "No projections cached yet."
      } else {
        const combinedEdges: GameEdgeAnalysis[] = []
        let slateEdgeCount = 0

        availableCaches.forEach((cachedSport) => {
          const hydratedEdges = hydrateMissingSharpProjections(
            cachedSport.edges,
            cachedSport.sport
          )
          combinedEdges.push(...attachSportToEdges(hydratedEdges, cachedSport.sport))
          slateEdgeCount += cachedSport.currentSlateEdgeCount
        })

        if (slateEdgeCount === 0) {
          hasCache = false
          errorMessage = "No current projections yet."
        } else {
          edges = combinedEdges
          lastUpdated = resolveMostRecentTimestamp(
            availableCaches.map((cachedSport) => cachedSport.updatedAt)
          )
        }
      }
    } else {
      const cached = await loadCacheForSport(serviceClient, sport)
      if (!cached || cached.currentSlateEdgeCount === 0) {
        hasCache = false
        errorMessage = "No current projections yet."
      } else {
        const hydratedEdges = hydrateMissingSharpProjections(cached.edges, sport)
        edges = attachSportToEdges(hydratedEdges, sport)
        lastUpdated = cached.updatedAt
      }
    }
  } catch (error) {
    hasCache = false
    errorMessage = "Unable to load projections."
  }

  if (edges.length > 0) {
    edges = stripNonSharpBookOdds(edges)
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pb-[96px] pt-4 sm:px-4 sm:pb-0 sm:pt-5">
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

