import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

export default async function LiveProjectionsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess = membership.isActive && membership.tier === "syndicate"

  return (
    <div className="relative min-h-screen bg-black text-white px-4 py-16">
      <Link
        href="/chat"
        className="absolute left-4 top-4 inline-flex items-center rounded-full border border-emerald-500/40 px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-emerald-200 hover:border-emerald-400 hover:text-white transition-colors"
      >
        Back to chat
      </Link>
      <h1 className="text-2xl font-semibold">Live Projections</h1>
      <div className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-white/5 p-6">
        {!hasAccess ? (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Upgrade required
            </p>
            <p className="mt-3 text-sm text-white/70">
              Live projections are available for Syndicate members only.
              Upgrade to unlock access.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
            >
              View plans
            </Link>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">
              Coming soon
            </p>
            <p className="mt-3 text-sm text-white/70">
              Live projections are gated for now. We are polishing the feed.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
