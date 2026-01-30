import ToolsNav from "@/components/tools-nav"
import SportSelector from "../market-projections/sport-selector"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import PropOddsClient from "./prop-odds-client"

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
  { key: "icehockey_nhl", label: "NHL", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
]

export default async function PlayerPropOddsPage({
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

  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport
  const sport =
    SPORT_OPTIONS.find((option) => option.key === requestedSport)?.key ??
    "basketball_nba"

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="px-2 py-4 sm:px-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <ToolsNav />
            <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
          </div>
        </div>
      </div>
      <div className="pt-[120px] sm:pt-[140px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-none space-y-5 py-6">
          <PropOddsClient sport={sport} previewMode={previewMode} />
        </div>
      </div>
    </div>
  )
}
