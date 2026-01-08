import Link from "next/link"
import MarketProjectionsTable from "./market-projections-table"
import MarketProjectionsRefresh from "./market-projections-refresh"
import SportSelector from "./sport-selector"
import { readFile } from "fs/promises"
import { join } from "path"
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
]

const getCachePath = (sport: string) =>
  join(process.cwd(), "cache", `market-projections-${sport}.json`)

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
      const raw = await readFile(getCachePath(sport), "utf-8")
      const parsed = JSON.parse(raw) as {
        edges?: typeof edges
        updatedAt?: string
      }
      edges = parsed.edges ?? []
      lastUpdated = parsed.updatedAt ?? null
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load projections."
      if (message.includes("ENOENT")) {
        hasCache = false
        errorMessage = "No cached projections yet."
      } else {
        errorMessage = message
      }
    }
  } else {
    hasCache = false
    errorMessage = "This sport is locked."
  }

  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-10 sm:px-4">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
      <div className="mx-auto w-full max-w-none space-y-5">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            Market Projections
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold">
              Projected markets vs Vegas
            </h1>
            <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
          </div>
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

        <MarketProjectionsRefresh
          hasCache={hasCache}
          errorMessage={errorMessage}
          sport={sport}
          isLocked={isLocked}
          lastUpdated={lastUpdated}
        />
        <MarketProjectionsTable
          edges={edges}
          errorMessage={hasCache ? errorMessage : null}
        />
      </div>
    </div>
  )
}
