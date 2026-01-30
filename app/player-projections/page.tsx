import SportSelector from "../market-projections/sport-selector"
import SharpPlayerPropsTable from "./sharp-player-props-table"
import ToolsNav from "@/components/tools-nav"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"
export const revalidate = 0

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

const SPORT_OPTIONS: SportOption[] = [
  { key: "all", label: "All Sports", locked: false },
  { key: "basketball_nba", label: "NBA", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
  { key: "basketball_ncaab", label: "NCAAB", locked: false },
  { key: "americanfootball_ncaaf", label: "CFB", locked: false },
]

// Only unlocked sports are available
const UNLOCKED_SPORTS = SPORT_OPTIONS.filter((opt) => !opt.locked).map((opt) => opt.key)

export default async function PlayerProjectionsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess = membership.hasPaidAccess
  if (!hasAccess) {
    redirect("/sharp-detector")
  }
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  // Default to "all" if requested sport is locked or invalid
  const requestedOption = SPORT_OPTIONS.find((option) => option.key === requestedSport)
  const sport = requestedOption && !requestedOption.locked
    ? requestedOption.key
    : "all"

  const selected =
    SPORT_OPTIONS.find((option) => option.key === sport) ?? SPORT_OPTIONS[0]
  const isLocked = Boolean(selected.locked)

  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-6 sm:px-4">
      <div className="mb-6">
        <ToolsNav />
      </div>
      <div className="mb-4 flex justify-end">
        <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
      </div>
      <div className="mx-auto w-full max-w-none space-y-6">
        {!hasAccess ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="pointer-events-none blur-sm">
              <div className="border-b border-white/10 bg-black/60 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                Player • Line • Projection • Edge
              </div>
              <div className="space-y-2 px-4 py-4">
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
                  Sharp player props are for Sharp and Syndicate members.
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Unlock whale-tracked player prop bets with Sharp.
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
        ) : !isLocked ? (
          <SharpPlayerPropsTable sport={sport} />
        ) : (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Coming soon
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              {selected.label} sharp props tracking is being finalized.
            </h2>
            <p className="mt-3 text-sm text-white/60">
              We&apos;ll unlock this once prediction market coverage expands.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}



