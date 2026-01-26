import MarketProjectionsClient from "./market-projections-client"
import SportSelector from "./sport-selector"
import ToolsNav from "@/components/tools-nav"
import MarketProjectionsClvTracker from "./clv-tracker"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { buildSharpProjections } from "@/lib/services/sharp-projections"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"
import { getRollingMarketProjectionClvRecap } from "@/lib/services/market-projection-clv"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

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
  const hasPaidAccess = membership.hasFullAccess
  const previewMode = !hasPaidAccess
  const tier = membership.isActive ? membership.tier : membership.tier ?? null
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport
  const sport =
    SPORT_OPTIONS.find((option) => option.key === requestedSport)?.key ??
    "basketball_nba"
  const selected = SPORT_OPTIONS.find((option) => option.key === sport) ??
    SPORT_OPTIONS[0]
  let edges: GameEdgeAnalysis[] = []
  let errorMessage: string | null = null
  let hasCache = true
  let lastUpdated: string | null = null
  const isLocked = Boolean(selected.locked)
  const clvRecap =
    hasPaidAccess &&
    (sport === "basketball_nba" ||
      sport === "basketball_ncaab" ||
      sport === "icehockey_nhl")
      ? await getRollingMarketProjectionClvRecap({ sport })
      : null

  if (!isLocked) {
    try {
      const serviceClient = createServiceClient()
      const { data, error } = (await serviceClient
        .from("market_projections_cache" as any)
        .select("edges, updated_at")
        .eq("sport", sport)
        .single()) as unknown as { data: { edges: any[]; updated_at: string } | null; error: any }

      if (error || !data) {
        if (sport === "americanfootball_nfl") {
          const refreshed = await analyzeSlateEdges(sport, { limit: 200 })
          if (refreshed.edges?.length) {
            edges = refreshed.edges
            lastUpdated = new Date().toISOString()
            await serviceClient.from("market_projections_cache" as any).upsert(
              {
                sport,
                edges,
                updated_at: lastUpdated,
              } as any,
              { onConflict: "sport" }
            )
          } else {
            hasCache = false
            errorMessage = "No cached projections yet."
          }
        } else {
          hasCache = false
          errorMessage = "No cached projections yet."
        }
      } else {
        edges = data.edges ?? []
        lastUpdated = data.updated_at ?? null
        const shouldBackfill =
          sport === "basketball_nba" ||
          sport === "basketball_ncaab" ||
          sport === "americanfootball_ncaaf" ||
          sport === "americanfootball_nfl" ||
          sport === "icehockey_nhl"
        if (shouldBackfill && edges.length > 0) {
          edges = edges.map((edge) => {
            if (!edge || edge?.sharpProjections) return edge
            if (!edge.homeTeam || !edge.awayTeam) return edge
            try {
              return {
                ...edge,
                sharpProjections: buildSharpProjections({
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
                }),
              }
            } catch (error) {
              console.warn("[market-projections] backfill failed", error)
              return edge
            }
          })
        }

        if (sport === "americanfootball_nfl" && edges.length === 0) {
          const refreshed = await analyzeSlateEdges(sport, { limit: 200 })
          if (refreshed.edges?.length) {
            edges = refreshed.edges
            lastUpdated = new Date().toISOString()
            await serviceClient.from("market_projections_cache" as any).upsert(
              {
                sport,
                edges,
                updated_at: lastUpdated,
              } as any,
              { onConflict: "sport" }
            )
          }
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

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex w-full flex-wrap items-start justify-between gap-4 md:w-auto md:flex-1 md:items-center">
              <ToolsNav />
              <div className="ml-auto md:hidden">
                <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
              </div>
            </div>
            {clvRecap ? (
              <div className="flex w-full justify-center md:w-auto md:flex-1">
                <MarketProjectionsClvTracker
                  summary={clvRecap.summary}
                  updatedAt={clvRecap.updatedAt}
                  sport={sport}
                  recapGames={clvRecap.games}
                  recapHistory={clvRecap.history}
                  recapUpdatedAt={clvRecap.updatedAt}
                />
              </div>
            ) : null}
            <div className="hidden md:block">
              <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
            </div>
          </div>
        </div>
      </div>
      <div className="pt-[120px] sm:pt-[140px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-none space-y-5 py-6">
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
    </div>
  )
}

