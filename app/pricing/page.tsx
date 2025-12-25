'use client'

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2 } from "lucide-react"
import { PricingSectionDemo } from "@/components/ui/pricing-section-demo"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus } from "@/lib/utils/membership"

export default function PricingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [hasSubscription, setHasSubscription] = useState(false)

  useEffect(() => {
    const checkSubscription = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const membership = getMembershipStatus(user.user_metadata)

        if (membership.isActive) {
          // User already has active subscription, redirect to chat
          setHasSubscription(true)
          router.push('/chat')
          return
        }
      }

      setLoading(false)
    }

    checkSubscription()
  }, [router])

  // Show loading while checking subscription
  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </main>
    )
  }

  // Don't render pricing if user has subscription (will redirect)
  if (hasSubscription) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white/60">You already have an active subscription. Redirecting...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white animate-fade-in">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 pt-8">
        <Link
          href="/chat"
          className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          Back to Home
        </Link>
      </div>
      <PricingSectionDemo />
    </main>
  )
}
