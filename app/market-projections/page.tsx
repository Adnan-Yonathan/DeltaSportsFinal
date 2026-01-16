import MarketProjectionsClient from "./market-projections-client"
import SportSelector from "./sport-selector"
import ToolsNav from "@/components/tools-nav"
import MarketProjectionsClvRecap from "./clv-recap"
import MarketProjectionsClvTracker from "./clv-tracker"
import Link from "next/link"
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
  const hasAccess = membership.isActive
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
    hasAccess && (sport === "basketball_nba" || sport === "basketball_ncaab")
      ? await getRollingMarketProjectionClvRecap({ sport })
      : null

  if (!hasAccess) {
    hasCache = false
    errorMessage = "Membership required."
  } else if (!isLocked) {
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
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToolsNav />
            {clvRecap ? (
              <div className="flex w-full justify-center md:w-auto md:flex-1">
                <MarketProjectionsClvTracker
                  summary={clvRecap.summary}
                  updatedAt={clvRecap.updatedAt}
                />
              </div>
            ) : null}
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
            Sharp projections refresh every 15 minutes and rank games by edge
            strength. Each market shows a projected win rate plus the edge over
            the break-even line.
          </p>
        </header>

        {clvRecap ? (
          <MarketProjectionsClvRecap
            games={clvRecap.games}
            history={clvRecap.history}
            updatedAt={clvRecap.updatedAt}
          />
        ) : null}

        {!hasAccess ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="pointer-events-none blur-sm">
              <div className="border-b border-white/10 bg-black/60 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                Matchup &gt; Market &gt; Projection &gt; Edge
              </div>
              <div className="space-y-3 px-4 py-4">
                {[1, 2, 3, 4, 5].map((row) => (
                  <div key={row} className="grid grid-cols-4 gap-3">
                    <div className="h-4 rounded bg-white/10" />
                    <div className="h-4 rounded bg-white/10" />
                    <div className="h-4 rounded bg-white/10" />
                    <div className="h-4 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  Upgrade required
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Sharp projections are for members.
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Upgrade to unlock market edges and projections.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                >
                  View plans
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <MarketProjectionsClient
            key={sport}
            initialEdges={edges}
            initialUpdatedAt={lastUpdated}
            hasCache={hasCache}
            errorMessage={errorMessage}
            sport={sport}
            isLocked={isLocked}
          />
        )}
        </div>
      </div>
    </div>
  )
}
