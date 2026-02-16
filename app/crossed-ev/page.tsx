import ToolsNav from "@/components/tools-nav"
import MobileToolsNav from "@/components/mobile-tools-nav"
import SportSelector from "../market-projections/sport-selector"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import SharpPropsHub, { type HubTab } from "./sharp-props-hub"
import Link from "next/link"

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
  { key: "basketball_ncaab", label: "NCAAB", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
]

export default async function CrossedEvPage({
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
  const requestedTab = Array.isArray(searchParams?.tab)
    ? searchParams?.tab[0]
    : searchParams?.tab
  const sport =
    SPORT_OPTIONS.find((option) => option.key === requestedSport)?.key ??
    "all"
  const activeTab: HubTab =
    requestedTab === "crossed_ev" ? "crossed_ev" : "orderbooks"
  const orderbooksHref = `?sport=${encodeURIComponent(sport)}&tab=orderbooks`
  const crossedEvHref = `?sport=${encodeURIComponent(sport)}&tab=crossed_ev`

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="px-2 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden shrink-0 md:block">
              <ToolsNav />
            </div>
            <div className="ml-auto shrink-0">
              <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-1.5">
            <Link
              href={orderbooksHref}
              className={`rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-all ${
                activeTab === "orderbooks"
                  ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                  : "text-white/60 hover:bg-white/5 hover:text-white/85"
              }`}
            >
              Order Books
            </Link>
            <Link
              href={crossedEvHref}
              className={`rounded-xl px-3 py-2.5 text-center text-sm font-semibold transition-all ${
                activeTab === "crossed_ev"
                  ? "bg-emerald-500/20 text-emerald-300 shadow-sm"
                  : "text-white/60 hover:bg-white/5 hover:text-white/85"
              }`}
            >
              Crossed EV
            </Link>
          </div>
        </div>
      </div>
      <div className="px-2 pb-[96px] sm:px-4 sm:pb-0">
        <div className="mx-auto w-full max-w-none">
          <SharpPropsHub
            sport={sport}
            activeTab={activeTab}
            previewMode={previewMode}
          />
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
