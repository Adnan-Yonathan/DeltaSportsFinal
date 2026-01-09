import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import ToolsNav from "@/components/tools-nav"
import { getMembershipStatusFromMetadata } from "@/lib/utils/membership"

export default async function LiveProjectionsPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const hasAccess = membership.isActive && membership.tier === "syndicate"

  return (
    <div className="relative min-h-screen bg-black text-white px-4 py-6">
      <div className="mb-6">
        <ToolsNav />
      </div>
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
