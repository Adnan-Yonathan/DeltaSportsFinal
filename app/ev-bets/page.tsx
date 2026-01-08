import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import { findEVOpportunities } from "@/lib/services/cross-market-ev"
import { SPORTS } from "@/lib/types/odds"
import { type EVOpportunity } from "@/lib/utils/ev-calculator"
import EvBetsTable from "./ev-bets-table"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function EvBetsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess =
    membership.isActive &&
    (membership.tier === "sharp" || membership.tier === "syndicate")

  if (!hasAccess) {
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
              Cross Market EV
            </p>
            <h1 className="text-3xl font-semibold">Best EV plays across books</h1>
            <p className="max-w-2xl text-sm text-white/60">
              Upgrade to Sharp or Syndicate to unlock EV plays.
            </p>
          </header>
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Upgrade required
            </p>
            <h2 className="mt-3 text-2xl font-semibold text-white">
              EV bets are for Sharp and Syndicate members.
            </h2>
            <p className="mt-3 text-sm text-white/60">
              Unlock cross-market EV tools by upgrading your plan.
            </p>
            <Link
              href="/pricing"
              className="mt-6 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
            >
              View plans
            </Link>
          </div>
        </div>
      </div>
    )
  }

  let opportunities: EVOpportunity[] = []
  let errorMessage: string | null = null

  try {
    opportunities = await findEVOpportunities({
      includeProps: true,
      minPropEV: 0,
      limit: 200,
      slateMode: "next",
      sports: Object.values(SPORTS),
    })
  } catch (error) {
    errorMessage =
      error instanceof Error ? error.message : "Unable to load EV bets."
  }

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
            Cross Market EV
          </p>
          <h1 className="text-3xl font-semibold">Best EV plays across books</h1>
          <p className="max-w-2xl text-sm text-white/60">
            These are cross-market EV opportunities based on consensus pricing
            across books. Sorted by highest expected value.
          </p>
        </header>

        <EvBetsTable opportunities={opportunities} errorMessage={errorMessage} />
      </div>
    </div>
  )
}
