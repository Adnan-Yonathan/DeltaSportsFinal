import ParlayPredictor from './parlay-predictor'
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"
import ToolsNav from "@/components/tools-nav"

export const dynamic = "force-dynamic"

export default async function ParlayPredictorPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const planVersion = membership.planVersion ?? 1
  const hasAccess = membership.isActive
    ? planVersion >= 2
      ? membership.tier === "sharp" || membership.tier === "syndicate"
      : true
    : false
  return (
    <div className="min-h-screen bg-black text-white">
      {/* Fixed navigation header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-sm border-b border-white/5">
        <div className="px-2 sm:px-4 py-4">
          <ToolsNav />
        </div>
      </div>
      {/* Content with top padding to account for fixed header */}
      <div className="pt-[72px] px-2 sm:px-4">
        <div className="mx-auto w-full max-w-5xl py-4 sm:py-6">
          <h1 className="text-xl sm:text-2xl font-semibold">Parlay Pro</h1>
          <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-white/60">
            Build a parlay and compare model probability to book odds.
          </p>
          {!hasAccess ? (
            <div className="relative mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="pointer-events-none blur-sm">
                <div className="border-b border-white/10 bg-black/60 px-4 py-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Parlay Builder
                </div>
                <div className="space-y-4 px-4 py-5">
                  <div className="h-12 rounded-xl border border-white/10 bg-white/5" />
                  <div className="grid grid-cols-3 gap-3">
                    <div className="h-20 rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-20 rounded-xl border border-white/10 bg-white/5" />
                    <div className="h-20 rounded-xl border border-white/10 bg-white/5" />
                  </div>
                  <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Upgrade required
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    Parlay predictor is for Sharp and Syndicate members.
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    Unlock parlay modeling and correlation tools with Sharp.
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
            <ParlayPredictor />
          )}
        </div>
      </div>
    </div>
  )
}



