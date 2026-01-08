import Link from "next/link"
import SportSelector from "../market-projections/sport-selector"
import PlayerProjectionsTable from "./player-projections-table"

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
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "americanfootball_ncaaf", label: "CFB", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
]

export default function PlayerProjectionsPage({
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
  const selected =
    SPORT_OPTIONS.find((option) => option.key === sport) ?? SPORT_OPTIONS[0]
  const isLocked = Boolean(selected.locked)

  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-10 sm:px-4">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
      <div className="mx-auto w-full max-w-none space-y-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {selected.label} Player Projections
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-semibold">
              Market-driven player edges
            </h1>
            <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
          </div>
          <p className="max-w-2xl text-sm text-white/60">
            Delta projections highlight where player markets look mispriced.
            Select a sport to explore available projections.
          </p>
        </header>
        {(sport === "basketball_nba" || sport === "americanfootball_nfl") &&
        !isLocked ? (
          <PlayerProjectionsTable sport={sport} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Coming soon
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {selected.label} player projections are being finalized.
            </h2>
            <p className="mt-3 text-sm text-white/60">
              We&apos;ll unlock this once the model is fully calibrated.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
