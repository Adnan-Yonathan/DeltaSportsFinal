"use client"

import { useState, useEffect, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatusFromMetadata, type MembershipInfo } from "@/lib/utils/membership"

interface Feature {
  name: string
  description: string
  included: boolean
}

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)

const getMonthlyEquivalent = (tier: PricingTier, billingPeriod: 'weekly' | 'monthly' | 'annual') => {
  const periodPrice =
    billingPeriod === "annual"
      ? tier.price.yearly
      : billingPeriod === "monthly"
        ? tier.price.monthly
        : tier.price.weekly

  if (billingPeriod === "annual") return periodPrice / 12
  if (billingPeriod === "monthly") return periodPrice
  return (periodPrice * 52) / 12
}

const getAnnualizedCost = (tier: PricingTier, billingPeriod: 'weekly' | 'monthly' | 'annual') => {
  const periodPrice =
    billingPeriod === "annual"
      ? tier.price.yearly
      : billingPeriod === "monthly"
        ? tier.price.monthly
        : tier.price.weekly

  if (billingPeriod === "annual") return periodPrice
  if (billingPeriod === "monthly") return periodPrice * 12
  return periodPrice * 52
}

const getSavingsVsWeekly = (tier: PricingTier, billingPeriod: 'weekly' | 'monthly' | 'annual') => {
  const weeklyAnnualized = getAnnualizedCost(tier, "weekly")
  const selectedAnnualized = getAnnualizedCost(tier, billingPeriod)

  const savedAmount = weeklyAnnualized - selectedAnnualized
  const savedPercent = weeklyAnnualized > 0 ? (savedAmount / weeklyAnnualized) * 100 : 0

  return {
    savedAmount,
    savedPercent,
  }
}

const formatSavingsPercent = (percent: number) => {
  const clamped = Math.max(0, percent)
  // Marketing-friendly: avoid over-promising, round down to nearest 5.
  return Math.floor(clamped / 5) * 5
}

const formatSavingsSuffix = (percent: number) => (percent > 0 ? ` (${percent}% off)` : "")

export interface PricingTier {
  name: string
  tierKey: 'free' | 'sharp' | 'syndicate'
  price: {
    weekly: number
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
  planKeyWeekly?: string
  planKeyMonthly?: string
  planKeyYearly?: string
}

interface PricingSectionProps {
  tiers: PricingTier[]
  className?: string
  checkoutRedirects?: {
    successPath?: string
    cancelPath?: string
  }
  showTrialHeading?: boolean
  showTrialDisclaimer?: boolean
  showTrialTimeline?: boolean
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

const tierRank: Record<PricingTier["tierKey"], number> = {
  free: 0,
  sharp: 1,
  syndicate: 2,
}

export function PricingSection({
  tiers,
  className,
  checkoutRedirects,
  showTrialHeading = true,
  showTrialDisclaimer = true,
  showTrialTimeline = true,
}: PricingSectionProps) {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<'weekly' | 'monthly' | 'annual'>('annual')
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const hasTrial = !membership?.isActive && !membership?.hasUsedTrial

  useEffect(() => {
    const fetchMembership = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        const membershipInfo = getMembershipStatusFromMetadata(user.user_metadata)
        setMembership(membershipInfo)
      }
    }
    fetchMembership()
  }, [])

  const handleManageSubscription = async () => {
    router.push('/billing')
  }

  const handleCheckout = async (_planKey: string) => {
    // Route to the new embedded checkout page
    router.push('/checkout')
  }

  const handleUpgrade = async (planKey: string) => {
    setLoadingPlan(planKey)
    try {
      const response = await fetch('/api/stripe/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/auth/login?redirect=/pricing')
          return
        }
        throw new Error(data.error || 'Failed to upgrade subscription')
      }

      router.push('/stripe/success')
    } catch (error) {
      console.error('Upgrade error:', error)
      alert(error instanceof Error ? error.message : 'Failed to upgrade subscription')
    } finally {
      setLoadingPlan(null)
    }
  }

  return (
    <section
      className={cn(
        "relative bg-transparent text-slate-50",
        "pt-2 pb-5 px-4 md:pt-5 md:pb-7 lg:pt-6 lg:pb-8",
        "overflow-hidden",
        className,
      )}
    >
      <div className="w-full max-w-4xl mx-auto">
        <div className="flex flex-col items-center gap-1.5 mb-2 text-center md:mb-4">
          {showTrialHeading && (
            <h2 className="text-xl font-bold text-white md:text-2xl">
              {hasTrial ? "All plans include a 7-day free trial." : "Choose the plan that fits your workflow."}
            </h2>
          )}
          <div className="inline-flex items-center p-0.5 rounded-full border border-emerald-300/30 bg-emerald-500/10 backdrop-blur">
            {(
              [
                { label: "Weekly", value: "weekly" as const },
                { label: "Monthly", value: "monthly" as const },
                { label: "Annually", value: "annual" as const },
              ] as const
            ).map((period) => (
              <button
                key={period.value}
                onClick={() => setBillingPeriod(period.value)}
                className={cn(
                  "relative px-5 py-1.5 text-[11px] font-medium rounded-full transition-all duration-300",
                  billingPeriod === period.value
                    ? "bg-white text-slate-900 shadow-lg"
                    : "text-slate-200/70 hover:text-white",
                )}
              >
                {period.label}
              </button>
            ))}
          </div>
          {showTrialDisclaimer && !membership?.isActive && (
            <p className="mt-2 text-xs text-white/60">
              {hasTrial
                ? "No payment due now • Cancel anytime • We’ll remind you before your trial ends"
                : "Billed today • Cancel anytime from billing"}
            </p>
          )}
        </div>

        <div className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-3 md:grid-cols-2 md:gap-5 items-stretch">
          {tiers.map((tier) => {
            // Get the appropriate plan key based on billing period
            const planKey =
              tier.planKey ||
              (billingPeriod === "annual"
                ? tier.planKeyYearly
                : billingPeriod === "monthly"
                  ? tier.planKeyMonthly
                  : tier.planKeyWeekly)
            const isLoading = loadingPlan === planKey || loadingPlan === 'manage'

            // Check if this tier is the user's current plan
            const isCurrentPlan =
              membership?.isActive && membership.tier === tier.tierKey
            const isUpgrade =
              membership?.isActive &&
              membership.tier &&
              tierRank[tier.tierKey] > tierRank[membership.tier]

            const actionButton = isCurrentPlan && tier.tierKey !== 'free' ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                  className={cn(
                  "transition-all duration-300 w-full h-10 text-xs sm:h-11 sm:text-sm md:h-12 md:text-sm",
                  "bg-white/10 text-white border border-white/20",
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
            ) : tier.tierKey === 'free' ? (
                <Button
                  disabled
                  className={cn(
                    "transition-all duration-300 w-full h-10 text-xs sm:h-11 sm:text-sm md:h-12 md:text-sm",
                    "bg-white/10 text-white/60 border border-white/20 cursor-not-allowed",
                  )}
                >
                  Free membership
                </Button>
            ) : isUpgrade ? (
                <Button
                  onClick={() => planKey && handleUpgrade(planKey)}
                  disabled={!planKey || isLoading}
                  className={cn(
                    tier.highlight ? buttonStyles.highlight : buttonStyles.default,
                  "transition-all duration-300 w-full h-10 text-xs sm:h-11 sm:text-sm md:h-12 md:text-sm",
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
                      Upgrade plan
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </span>
              </Button>
            ) : membership?.isActive ? (
                <Button
                  onClick={handleManageSubscription}
                  disabled={isLoading}
                  className={cn(
                  "transition-all duration-300 w-full h-10 text-xs sm:h-11 sm:text-sm md:h-12 md:text-sm",
                  "bg-white/10 text-white border border-white/20",
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
                    tier.highlight ? buttonStyles.highlight : buttonStyles.default,
                  "transition-all duration-300 w-full h-10 text-xs sm:h-11 sm:text-sm md:h-12 md:text-sm",
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
                      {hasTrial ? "Start your free trial" : "Start subscription"}
                      <ArrowRightIcon className="w-4 h-4" />
                    </>
                  )}
                </span>
              </Button>
            )

            return (
              <div
                key={tier.name}
                className={cn(
                  "relative w-full backdrop-blur-sm rounded-none md:rounded-3xl border flex flex-col",
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

                <div className="p-3 sm:p-3.5 md:p-4 flex-1 min-h-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="p-1.5 sm:p-2 rounded-xl md:rounded-2xl bg-emerald-500/15 text-emerald-200">
                          {tier.icon}
                        </div>
                        <h3 className="text-sm sm:text-base md:text-lg font-semibold">
                          {tier.name}
                        </h3>
                      </div>

                      <div className="mb-2.5">
                        {(() => {
                          const periodPrice =
                            billingPeriod === "annual"
                              ? tier.price.yearly
                              : billingPeriod === "monthly"
                                ? tier.price.monthly
                                : tier.price.weekly
                          const monthlyEquivalent = getMonthlyEquivalent(tier, billingPeriod)
                          const billingLabel =
                            billingPeriod === "annual"
                              ? "year"
                              : billingPeriod === "monthly"
                                ? "month"
                                : "week"
                          const isFree = periodPrice === 0
                          const savings = getSavingsVsWeekly(tier, billingPeriod)
                          const savingsPercent = formatSavingsPercent(savings.savedPercent)
                          return (
                            <>
                              <div className="flex items-baseline gap-1.5">
                                <span className="text-base sm:text-2xl md:text-3xl font-bold">
                                  {isFree ? "Free" : formatUsd(monthlyEquivalent)}
                                </span>
                                {!isFree && (
                                  <span className="text-xs text-slate-200/70">/mo</span>
                                )}
                              </div>
                              {!isFree && (
                                <div className="mt-1 text-[11px] text-slate-200/60">
                                  billed {formatUsd(periodPrice)}/{billingLabel}
                                </div>
                              )}
                              {!isFree && billingPeriod === "annual" && savings.savedAmount > 0 && (
                                <div className="mt-1 text-[11px] font-semibold text-emerald-200">
                                  Save {formatUsd(savings.savedAmount)}/yr{formatSavingsSuffix(savingsPercent)}
                                </div>
                              )}
                              <p className="mt-1.5 text-xs text-slate-200/70">
                                {tier.description}
                              </p>
                      {hasTrial && (
                        <div className="mt-2 inline-flex">
                          <Badge className={cn(badgeStyles, "bg-emerald-400")}>7-Day Free Trial</Badge>
                        </div>
                      )}
                            </>
                          )
                        })()}
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0">
                    <div className="space-y-1.5 md:max-h-[170px] md:overflow-auto md:pr-1 lg:max-h-[200px]">
                      {tier.features.map((feature) => (
                        <div key={feature.name} className="flex gap-3">
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
                            <div className="text-xs sm:text-sm font-medium">{feature.name}</div>
                            <div className="text-xs sm:text-sm text-white/60">
                              {feature.description}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="pointer-events-none hidden md:block mt-2 h-6 bg-gradient-to-t from-neutral-850/80 to-transparent" />
                  </div>
                </div>

                <div className="p-3 sm:p-3.5 md:p-4 pt-0 mt-auto">
                  {actionButton}
                  {!membership?.isActive && (
                    <div className="mt-2 text-center text-xs text-white/60">
                      {hasTrial ? "No payment due now • Cancel anytime" : "Billed today • Cancel anytime"}
                    </div>
                  )}
                  {!membership?.isActive && membership?.hasUsedTrial && (
                    <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-white/50">
                      Trial already used
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {showTrialTimeline && hasTrial && (
          <div className="mx-auto mt-4 w-full max-w-md rounded-3xl border border-emerald-300/20 bg-white/[0.03] p-4 text-left">
            <div className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-full w-1 rounded-full bg-gradient-to-b from-emerald-400/60 via-emerald-400/20 to-white/10" />
              </div>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-emerald-300/30 bg-emerald-500/10 p-1.5 text-emerald-200">
                    <CheckIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Today</div>
                    <div className="text-xs text-white/60">Start free trial</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-white/10 bg-black/20 p-1.5 text-white/70">
                    <span className="block h-4 w-4 rounded-full bg-white/10" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Day 2</div>
                    <div className="text-xs text-white/60">Payment reminder sent before billing</div>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full border border-white/10 bg-black/20 p-1.5 text-white/70">
                    <span className="block h-4 w-4 rounded-full bg-white/10" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-white">Day 3</div>
                    <div className="text-xs text-white/60">First billing (if not canceled)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
