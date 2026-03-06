import Link from "next/link"
import StatsCenterClient from "./stats-client"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function StatsCenterPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess = membership.hasProjectionAccess

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pt-4 sm:px-4 sm:pt-5">
        <div className="mx-auto w-full max-w-none space-y-6 py-6">
          <header className="space-y-3">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Stats Center
            </p>
            <h1 className="text-3xl font-semibold">
              Team and player stats
            </h1>
            <p className="max-w-2xl text-sm text-white/60">
              Pull ESPN-backed stats across NBA, NFL, MLB, NCAAB, and CFB. Search teams,
              players, and injuries from one place.
            </p>
          </header>
          {!hasAccess ? (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="pointer-events-none blur-sm">
                <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((card) => (
                    <div key={card} className="h-28 rounded-2xl border border-white/10 bg-white/5" />
                  ))}
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center p-6">
                <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Upgrade required
                  </p>
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    Stats Center is for members.
                  </h2>
                  <p className="mt-2 text-sm text-white/60">
                    Upgrade to unlock team, player, and injury stats.
                  </p>
                  <Link
                    href="/checkout"
                    className="mt-5 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                  >
                    Start your free trial
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <StatsCenterClient />
          )}
        </div>
      </div>
    </div>
  )
}
