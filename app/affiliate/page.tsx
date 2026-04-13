import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import AffiliateDashboard from '@/components/affiliate-dashboard'

export const dynamic = 'force-dynamic'

export default async function AffiliatePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="mx-auto w-full max-w-4xl px-4 py-16 sm:py-20">
          <p className="text-[11px] font-semibold uppercase tracking-[0.38em] text-emerald-200/70">
            Affiliate
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Delta Affiliate Program
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
            Refer new Delta members and earn recurring commission on paid subscriptions. Share your
            link, track performance, and monitor payouts from one dashboard.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/login?redirect=/affiliate"
              className="inline-flex items-center justify-center rounded-full border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/25 hover:bg-white/10"
            >
              Affiliate Dashboard Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-semibold text-black transition hover:bg-emerald-300"
            >
              Apply to Join
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return <AffiliateDashboard />
}
