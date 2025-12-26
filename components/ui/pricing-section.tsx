"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"

interface Feature {
  name: string
  description: string
  included: boolean
}

export interface PricingTier {
  name: string
  price: {
    monthly: number
    yearly: number
  }
  description: string
  features: Feature[]
  highlight?: boolean
  badge?: string
  icon: ReactNode
  // Single plan key (for trial or plans with same key for both periods)
  planKey?: string
  // Separate plan keys for monthly/yearly
  planKeyMonthly?: string
  planKeyYearly?: string
}

interface PricingSectionProps {
  tiers: PricingTier[]
  className?: string
}

const buttonStyles = {
  default: cn(
    "h-12 bg-gradient-to-r from-emerald-500 to-emerald-400 text-white",
    "hover:from-emerald-400 hover:to-emerald-300",
    "border border-emerald-300/40",
    "shadow-[0_8px_24px_rgba(16,185,129,0.24)]",
    "text-sm font-semibold"
  ),
  highlight: cn(
    "h-12 bg-white text-slate-900",
    "shadow-[0_10px_30px_rgba(16,185,129,0.28)]",
    "hover:bg-emerald-50",
    "font-semibold text-base"
  ),
}

const badgeStyles = cn(
  "px-4 py-1.5 text-xs font-semibold uppercase tracking-wide",
  "bg-emerald-400 text-slate-900",
  "rounded-full shadow-lg"
)

export function PricingSection({ tiers, className }: PricingSectionProps) {
  const router = useRouter()
  const [isYearly, setIsYearly] = useState(true)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [isLoadingMembership, setIsLoadingMembership] = useState(true)

  useEffect(() => {
    const fetchMembership = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const membershipInfo = getMembershipStatus(user.user_metadata)
        setMembership(membershipInfo)
      }
      setIsLoadingMembership(false)
    }
    fetchMembership()
  }, [])

  const handleManageSubscription = async () => {
    setLoadingPlan('manage')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch (err) {
      console.error('Failed to open billing portal:', err)
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleCheckout = async (planKey: string) => {
    setLoadingPlan(planKey)
    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        // If unauthorized, redirect to login
        if (response.status === 401) {
          router.push('/auth/login?redirect=/pricing')
          return
        }
        throw new Error(data.error || 'Failed to create checkout session')
      }

      // Redirect to Stripe checkout
      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout error:', error)
      alert(error instanceof Error ? error.message : 'Failed to start checkout')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <section
      className={cn(
        "relative bg-gradient-to-b from-neutral-850 to-neutral-900 text-slate-50",
        "py-16 px-4 md:py-24 lg:py-32",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-5xl mx-auto">
        <div className="flex flex-col items-center gap-4 mb-12 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-200/80">Pricing</p>
          <h2 className="text-3xl font-bold text-white md:text-4xl">Simple, transparent pricing</h2>
          <div className="inline-flex items-center p-1.5 rounded-full border border-emerald-300/30 bg-emerald-500/10 backdrop-blur">
            {(["Monthly", "Annual"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setIsYearly(period === "Annual")}
                className={cn(
                  "px-8 py-2.5 text-sm font-medium rounded-full transition-all duration-300",
                  (period === "Annual") === isYearly
                    ? "bg-white text-slate-900 shadow-lg"
                    : "text-slate-200/70 hover:text-white",
                )}
              >
                {period}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => {
            // Get the appropriate plan key based on billing period
            const planKey = tier.planKey || (isYearly ? tier.planKeyYearly : tier.planKeyMonthly)
            const isLoading = loadingPlan === planKey || loadingPlan === 'manage'

            // Check if this tier is the user's current plan
            const tierNameLower = tier.name.toLowerCase()
            const isCurrentPlan = membership?.isActive && (
              (tierNameLower.includes('unlimited') && membership.tier === 'unlimited') ||
              (tierNameLower === 'pro' && membership.tier === 'pro' && !membership.isTrial) ||
              (tierNameLower.includes('trial') && membership.tier === 'pro' && membership.isTrial)
            )

            return (
              <div
                key={tier.name}
                className={cn(
                  "relative backdrop-blur-sm rounded-3xl border flex flex-col",
                  tier.highlight
                    ? "bg-neutral-800/90 border-emerald-300/40 shadow-2xl"
                    : "bg-neutral-850/90 border-emerald-300/15 shadow-lg",
                  isCurrentPlan && "ring-2 ring-emerald-400",
                  "transition-transform duration-300 hover:-translate-y-1",
                )}
              >
                {isCurrentPlan ? (
                  <div className="absolute -top-4 left-6">
                    <Badge className={cn(badgeStyles, "bg-emerald-500")}>Current Plan</Badge>
                  </div>
                ) : tier.badge && tier.highlight && (
                  <div className="absolute -top-4 left-6">
                    <Badge className={badgeStyles}>{tier.badge}</Badge>
                  </div>
                )}

                <div className="p-8 flex-1">
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 rounded-2xl bg-emerald-500/15 text-emerald-200">
                      {tier.icon}
                    </div>
                    <h3 className="text-xl font-semibold">{tier.name}</h3>
                  </div>

                  <div className="mb-6">
                    {(() => {
                      const monthlyPrice = isYearly ? tier.price.yearly : tier.price.monthly
                      const dailyPrice = monthlyPrice > 0 ? (monthlyPrice / 30).toFixed(2) : 0
                      const isFree = monthlyPrice === 0
                      return (
                        <>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-bold">
                              {isFree ? "Free" : `$${dailyPrice}`}
                            </span>
                            {!isFree && (
                              <span className="text-sm text-slate-200/70">
                                /day{isYearly ? " (billed annually)" : ""}
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-slate-200/70">{tier.description}</p>
                        </>
                      )
                    })()}
                  </div>

                  <div className="space-y-4">
                    {tier.features.map((feature) => (
                      <div key={feature.name} className="flex gap-4">
                        <div
                          className={cn(
                            "mt-1 rounded-full border p-1",
                            feature.included
                              ? "text-emerald-300 border-emerald-300/50 bg-emerald-500/10"
                              : "text-slate-300/40 border-emerald-400/10",
                          )}
                        >
                          <CheckIcon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="text-sm font-medium">{feature.name}</div>
                          <div className="text-sm text-white/60">
                            {feature.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-8 pt-0 mt-auto">
                  {isCurrentPlan ? (
                    <Button
                      onClick={handleManageSubscription}
                      disabled={isLoading}
                      className={cn(
                        "w-full transition-all duration-300",
                        "h-12 bg-white/10 text-white border border-white/20",
                        "hover:bg-white/20",
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          "Manage Subscription"
                        )}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => planKey && handleCheckout(planKey)}
                      disabled={!planKey || isLoading}
                      className={cn(
                        "w-full transition-all duration-300",
                        tier.highlight ? buttonStyles.highlight : buttonStyles.default,
                      )}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            {tier.highlight ? "Buy now" : "Get started"}
                            <ArrowRightIcon className="w-4 h-4" />
                          </>
                        )}
                      </span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
