import SportSelector from "../market-projections/sport-selector"
import PlayerProjectionsTable from "./player-projections-table"
import ToolsNav from "@/components/tools-nav"

export const dynamic = "force-dynamic"
export const revalidate = 0

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

const SPORT_OPTIONS: SportOption[] = [
  { key: "basketball_nba", label: "NBA", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "basketball_ncaab", label: "NCAAB", locked: true },
  { key: "americanfootball_ncaaf", label: "CFB", locked: true },
  { key: "baseball_mlb", label: "MLB", locked: true },
  { key: "icehockey_nhl", label: "NHL", locked: true },
]

// Only unlocked sports are available
const UNLOCKED_SPORTS = SPORT_OPTIONS.filter((opt) => !opt.locked).map((opt) => opt.key)

export default function PlayerProjectionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  // Default to NBA if requested sport is locked or invalid
  const requestedOption = SPORT_OPTIONS.find((option) => option.key === requestedSport)
  const sport = requestedOption && !requestedOption.locked
    ? requestedOption.key
    : "basketball_nba"

  const selected =
    SPORT_OPTIONS.find((option) => option.key === sport) ?? SPORT_OPTIONS[0]
  const isLocked = Boolean(selected.locked)

  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-6 sm:px-4">
      <div className="mb-6">
        <ToolsNav />
      </div>
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
