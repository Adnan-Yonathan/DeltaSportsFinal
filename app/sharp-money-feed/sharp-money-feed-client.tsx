"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { SimpleHeader } from "@/components/ui/simple-header"
import MobileToolsNav from "@/components/mobile-tools-nav"
import SharpDetectorPanel from "@/components/SharpDetectorPanel"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"

export default function SharpMoneyFeedClient() {
  const supabase = useMemo(() => createClient(), [])
  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    let mounted = true
    const loadAuth = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (!mounted) return
        setUser(authUser ?? null)
        setMembership(authUser ? getMembershipStatus(authUser.user_metadata) : null)
      } catch {
        if (!mounted) return
        setUser(null)
        setMembership(null)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }
    void loadAuth()
    return () => {
      mounted = false
    }
  }, [supabase])

  const isSignedIn = Boolean(user)
  const isSyndicate = membership?.tier === "syndicate" && membership.isActive

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-6xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/60">
            Checking access...
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-semibold text-white">Sign in to access Sharp Money Feed</h2>
            <p className="mt-2 text-sm text-white/60">
              Track profitable Polymarket bettors by sport and esports with live fills and position context.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/auth/login"
                className="rounded-full border border-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-white/60"
              >
                Sign in
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-emerald-400/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white"
              >
                View plans
              </Link>
            </div>
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  if (!isSyndicate) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Syndicate required</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Sharp Money Feed is Syndicate only.</h2>
            <p className="mt-2 text-sm text-white/60">
              Upgrade to access profitable bettor rankings, sport-specific ROI, and live Polymarket bettor flow.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-flex rounded-full border border-emerald-400/60 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white"
            >
              Upgrade
            </Link>
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />
      <div className="mx-auto max-w-6xl px-3 pb-[108px] pt-20 sm:px-4 sm:pb-8">
        <SharpDetectorPanel
          isSyndicate
          showLocalAlerts={false}
          defaultTab="sharp-money"
          lockedTab="sharp-money"
          panelTitle="Sharp Money Feed"
        />
      </div>
      <MobileToolsNav />
    </div>
  )
}
