import MarketProjectionsClient from "./market-projections-client"
import SportSelector from "./sport-selector"
import ToolsNav from "@/components/tools-nav"
import MobileToolsNav from "@/components/mobile-tools-nav"
import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"
import { buildSharpProjections } from "@/lib/services/sharp-projections"
import { analyzeSlateEdges } from "@/lib/services/slate-edge-detector"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { PHASE_PRODUCTION_BUILD } from "next/constants"
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
const SHARP_PROJECTION_BOOKS = ["pinnacle", "circa"] as const
const SPORT_PREFERENCE_COOKIE = "market_projections_sport"
const normalizeBook = (value?: string | null) =>
  (value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "")
const isSharpProjectionBook = (value?: string | null) => {
  const normalized = normalizeBook(value)
  if (!normalized) return true
  return normalized.includes("pinnacle") || normalized.includes("circa")
}
const hasOnlySharpProjectionBooks = (edges: GameEdgeAnalysis[]) =>
  edges.every((edge) => {
    const books = [
      edge.spread?.bestBook,
      edge.spread?.bestHomeBook,
      edge.spread?.bestAwayBook,
      edge.total?.bestBook,
      edge.moneyline?.sportsbook?.homeBook,
      edge.moneyline?.sportsbook?.awayBook,
    ]
    return books.every((book) => isSharpProjectionBook(book))
  })

const stripNonSharpBookOdds = (edges: GameEdgeAnalysis[]) =>
  edges.map((edge) => {
    const spread = edge.spread
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
            edge.spread.prediction &&
            isSharpProjectionBook(edge.spread.prediction.book)
              ? edge.spread.prediction
              : undefined,
        }
      : undefined

    const total = edge.total
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
      edge.moneyline?.sportsbook?.homeBook
    )
    const awayBookAllowed = isSharpProjectionBook(
      edge.moneyline?.sportsbook?.awayBook
    )
    const predictionHomeAllowed = isSharpProjectionBook(
      edge.moneyline?.prediction?.homeBook
    )
    const predictionAwayAllowed = isSharpProjectionBook(
      edge.moneyline?.prediction?.awayBook
    )

    const moneyline = edge.moneyline
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

    return {
      ...edge,
      spread,
      total,
      moneyline,
    }
  })

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
  const fallbackSport =
    SPORT_OPTIONS.find(
      (option) => option.key === cookieSport && !option.locked
    )?.key ?? null
  const sport =
    SPORT_OPTIONS.find((option) => option.key === requestedSport)?.key ??
    fallbackSport ??
    "basketball_nba"
  const selected = SPORT_OPTIONS.find((option) => option.key === sport) ??
    SPORT_OPTIONS[0]
  let edges: GameEdgeAnalysis[] = []
  let errorMessage: string | null = null
  let hasCache = true
  let lastUpdated: string | null = null
  const isLocked = Boolean(selected.locked)
  const isBuild = process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
  const allowLiveRefresh = !isBuild
  const sharpOddsOptions = {
    limit: 200,
    bookmakers: [...SHARP_PROJECTION_BOOKS],
    oddsPreference: "lowest" as const,
  }

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
          if (allowLiveRefresh) {
            const refreshed = await analyzeSlateEdges(sport, sharpOddsOptions)
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
          hasCache = false
          errorMessage = "No cached projections yet."
        }
      } else {
        edges = data.edges ?? []
        lastUpdated = data.updated_at ?? null
        if (edges.length > 0 && !hasOnlySharpProjectionBooks(edges)) {
          const refreshed = await analyzeSlateEdges(sport, sharpOddsOptions)
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
        const shouldBackfill =
          sport === "basketball_nba" ||
          sport === "basketball_ncaab" ||
          sport === "americanfootball_ncaaf" ||
          sport === "americanfootball_nfl" ||
          sport === "icehockey_nhl"
        if (shouldBackfill && edges.length > 0) {
          edges = hydrateMissingSharpProjections(edges, sport)
        }

        if (sport === "americanfootball_nfl" && edges.length === 0 && allowLiveRefresh) {
          const refreshed = await analyzeSlateEdges(sport, sharpOddsOptions)
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

