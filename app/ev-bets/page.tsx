import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ToolsNav from "@/components/tools-nav"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import LiveOddsClient from "./ev-bets-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function EvBetsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const planVersion = membership.planVersion ?? 1
  const upgradeLabel = planVersion >= 2 ? "Syndicate" : "Sharp or Syndicate"
  const hasAccess = membership.isActive
    ? planVersion >= 2
      ? membership.tier === "syndicate"
      : membership.tier === "sharp" || membership.tier === "syndicate"
    : false

  return (
    <div className="relative min-h-screen bg-black text-white px-2 py-6 sm:px-4">
      <div className="mb-6">
        <ToolsNav />
      </div>
      <div className="mx-auto w-full max-w-none space-y-6">
        {!hasAccess ? (
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="pointer-events-none blur-sm">
              <div className="border-b border-white/10 bg-black/60 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                Matchup - Moneyline - Spread - Total
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
                  Line shopping is for {upgradeLabel} members.
                </h2>
                <p className="mt-2 text-sm text-white/60">
                  Unlock the pregame line shopping board by upgrading your plan.
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
          <LiveOddsClient />
        )}
      </div>
    </div>
  )
}


