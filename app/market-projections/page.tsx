import type { Metadata } from "next"
import MarketProjectionsClient from "./market-projections-client"
import MobileToolsNav from "@/components/mobile-tools-nav"
import { createServiceClient } from "@/lib/supabase/service"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"

export const metadata: Metadata = {
  title: "Sharp Movement | Pinnacle Line Movement Tracker | Delta Sports",
  description:
    "Track Pinnacle line movement, limit expansion, and quote pressure across spreads, totals, and moneylines. Rank markets by movement strength and react before the board settles.",
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "https://deltasports.app/market-projections",
  },
}

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

const resolveMostRecentTimestamp = (values: Array<string | null>) => {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value)) as number[]
  if (!timestamps.length) return null
  return new Date(Math.max(...timestamps)).toISOString()
}

const attachSportToEdges = (edges: GameEdgeAnalysis[], sportKey: string) =>
  edges.map((edge) => ({
    ...edge,
    sport: sportKey,
  }))

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
    updatedAt: data.updated_at ?? null,
  }
}

export default async function MarketProjectionsPage() {
  const resolvedSport = "all"

  const serviceClient = createServiceClient()
  let initialEdges: GameEdgeAnalysis[] = []
  let initialUpdatedAt: string | null = null
  let errorMessage: string | null = null
  let hasCache = false

  try {
    if (resolvedSport === "all") {
      const cacheRows = await Promise.all(
        ACTIVE_SPORT_KEYS.map((sportKey) => loadCacheForSport(serviceClient, sportKey))
      )
      const validRows = cacheRows.filter(Boolean) as Array<{
        sport: string
        edges: GameEdgeAnalysis[]
        updatedAt: string | null
      }>
      initialEdges = validRows.flatMap((row) => attachSportToEdges(row.edges, row.sport))
      initialUpdatedAt = resolveMostRecentTimestamp(validRows.map((row) => row.updatedAt))
      hasCache = initialEdges.length > 0
    } else {
      const cacheRow = await loadCacheForSport(serviceClient, resolvedSport)
      if (cacheRow) {
        initialEdges = attachSportToEdges(cacheRow.edges, resolvedSport)
        initialUpdatedAt = cacheRow.updatedAt
        hasCache = initialEdges.length > 0
      }
    }
  } catch (error) {
    console.error("[market-projections] failed to load cache", error)
    errorMessage = "Failed to load cached sharp movement."
  }

  return (
    <>
      <div className="min-h-screen bg-black text-white">
        <div className="px-2 pt-4 sm:px-4 sm:pt-5">
          <div className="mx-auto w-full max-w-none space-y-5 py-6">
            <MarketProjectionsClient
              initialEdges={initialEdges}
              initialUpdatedAt={initialUpdatedAt}
              hasCache={hasCache}
              errorMessage={errorMessage}
              sport={resolvedSport}
              isLocked={false}
              tier={null}
              previewMode={false}
            />
          </div>
        </div>
      </div>
      <MobileToolsNav />
    </>
  )
}
