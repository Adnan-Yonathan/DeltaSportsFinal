import MarketProjectionsClient from "./market-projections-client"
import SportSelector from "./sport-selector"
import ToolsNav from "@/components/tools-nav"
import { createServiceClient } from "@/lib/supabase/service"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"

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
]


export default async function MarketProjectionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
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

  if (!isLocked) {
    try {
      const supabase = createServiceClient()
      const { data, error } = (await supabase
        .from("market_projections_cache" as any)
        .select("edges, updated_at")
        .eq("sport", sport)
        .single()) as unknown as { data: { edges: any[]; updated_at: string } | null; error: any }

      if (error || !data) {
        hasCache = false
        errorMessage = "No cached projections yet."
      } else {
        edges = data.edges ?? []
        lastUpdated = data.updated_at ?? null
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
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToolsNav />
            <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
          </div>
        </div>
      </div>
      {/* Content with top padding to account for fixed header */}
      <div className="pt-[72px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-none space-y-5 py-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Sharp Projections
          </p>
          <h1 className="text-3xl font-semibold">
            Projected markets vs Vegas
          </h1>
          <p className="max-w-2xl text-sm text-white/60">
            Slate edge detection refreshes every 15 minutes and ranks games by
            edge strength. Compare projected spread, moneyline, and total to the
            market line, then analyze each matchup.
          </p>
          {lastUpdated && (
            <p className="text-xs uppercase tracking-[0.2em] text-white/40">
              Last updated {new Date(lastUpdated).toLocaleString()}
            </p>
          )}
        </header>

        <MarketProjectionsClient
          initialEdges={edges}
          initialUpdatedAt={lastUpdated}
          hasCache={hasCache}
          errorMessage={errorMessage}
          sport={sport}
          isLocked={isLocked}
        />
        </div>
      </div>
    </div>
  )
}
