"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { Loader2, Lock, Sparkles } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"
import { cn } from "@/lib/utils"
import { PricingSection } from "@/components/ui/pricing-section"
import { PRICING_TIERS } from "@/components/pricing/pricing-tiers"
import type { PricingTier } from "@/components/ui/pricing-section"

type BillingPeriod = "weekly" | "monthly" | "annual"
type TierKey = "sharp" | "syndicate"

const tierRank: Record<"free" | TierKey, number> = {
  free: 0,
  sharp: 1,
  syndicate: 2,
}

const formatUsd = (amount: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount)

const getPeriodPrice = (tier: PricingTier, billing: BillingPeriod) =>
  billing === "annual"
    ? tier.price.yearly
    : billing === "monthly"
      ? tier.price.monthly
      : tier.price.weekly

const getPlanKey = (tier: PricingTier, billing: BillingPeriod) =>
  tier.planKey ||
  (billing === "annual"
    ? tier.planKeyYearly
    : billing === "monthly"
      ? tier.planKeyMonthly
      : tier.planKeyWeekly)

export function PricingPageClient() {
  const router = useRouter()
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly")
  const [selectedTierKey, setSelectedTierKey] = useState<TierKey>("syndicate")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [isLoadingMembership, setIsLoadingMembership] = useState(true)

  useEffect(() => {
    const fetchMembership = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setMembership(getMembershipStatus(user.user_metadata))
      }
      setIsLoadingMembership(false)
    }
    fetchMembership()
  }, [])

  const selectedTier = useMemo(() => {
    const tier = PRICING_TIERS.find((item) => item.tierKey === selectedTierKey)
    return tier ?? PRICING_TIERS[0]
  }, [selectedTierKey])

  const selectedPlanKey = useMemo(
    () => getPlanKey(selectedTier, billingPeriod),
    [selectedTier, billingPeriod]
  )

  const handleManageSubscription = async () => {
    setLoadingPlan("manage")
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error("Failed to open billing portal:", err)
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleCheckout = async (planKey: string) => {
    setLoadingPlan(planKey)
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/login?redirect=/pricing")
          return
        }
        throw new Error(data.error || "Failed to create checkout session")
      }

      if (data.url) window.location.href = data.url
    } catch (error) {
      console.error("Checkout error:", error)
      alert(error instanceof Error ? error.message : "Failed to start checkout")
    } finally {
      setLoadingPlan(null)
    }
  }

  const handleUpgrade = async (planKey: string) => {
    setLoadingPlan(planKey)
    try {
      const response = await fetch("/api/stripe/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/login?redirect=/pricing")
          return
        }
        throw new Error(data.error || "Failed to upgrade subscription")
      }

      router.push("/stripe/success")
    } catch (error) {
      console.error("Upgrade error:", error)
      alert(error instanceof Error ? error.message : "Failed to upgrade subscription")
    } finally {
      setLoadingPlan(null)
    }
  }

  const buildMobileAction = () => {
    if (!selectedPlanKey) {
      return {
        label: "Unavailable",
        disabled: true,
        onClick: () => {},
      }
    }

    const isLoading = loadingPlan === selectedPlanKey || loadingPlan === "manage"
    const isCurrentPlan = membership?.isActive && membership.tier === selectedTier.tierKey
    const isUpgrade =
      membership?.isActive &&
      membership.tier &&
      tierRank[selectedTier.tierKey] > tierRank[membership.tier]

    if (isCurrentPlan && selectedTier.tierKey !== "free") {
      return {
        label: isLoading ? "Loading…" : "Manage subscription",
        disabled: isLoading,
        onClick: handleManageSubscription,
      }
    }

    if (isUpgrade) {
      return {
        label: isLoading ? "Processing…" : `Upgrade to ${selectedTier.name}`,
        disabled: isLoading,
        onClick: () => handleUpgrade(selectedPlanKey),
      }
    }

    if (membership?.isActive) {
      return {
        label: isLoading ? "Loading…" : "Manage subscription",
        disabled: isLoading,
        onClick: handleManageSubscription,
      }
    }

    return {
      label: isLoading ? "Processing…" : `Unlock ${selectedTier.name}`,
      disabled: isLoading,
      onClick: () => handleCheckout(selectedPlanKey),
    }
  }

  const mobileAction = buildMobileAction()
  const mobilePrice = getPeriodPrice(selectedTier, billingPeriod)
  const billingLabel = billingPeriod === "annual" ? "annually" : billingPeriod

  return (
    <main className="relative min-h-screen bg-black text-white">
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.18),rgba(0,0,0,0.0)_42%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.06),rgba(0,0,0,0.0)_45%)]" />
        <div className="absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(180deg,rgba(255,255,255,0.06)_0px,rgba(255,255,255,0.06)_1px,transparent_2px,transparent_6px)]" />
        <div className="absolute inset-0 flex items-center justify-center">
          <Image
            src="/delta-logo.png"
            alt=""
            aria-hidden
            width={420}
            height={420}
            className="h-[260px] w-[260px] select-none opacity-[0.06] sm:h-[340px] sm:w-[340px]"
            priority
          />
        </div>
      </div>

      <div className="relative z-10">
        <div className="fixed left-4 top-10 z-50 pointer-events-auto">
          <Link
            href="/"
            className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
          >
            Back to Home
          </Link>
        </div>

        {/* Mobile */}
        <div className="sm:hidden">
          <div className="mx-auto w-full max-w-md px-5 pb-64 pt-16">
            <div className="text-center space-y-2">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                <Sparkles className="h-4 w-4 text-emerald-200/80" />
                Pricing//Secure
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                Choose your access
              </h1>
              <p className="text-sm text-white/65">
                Pick a plan, review the toolkit, then choose your billing.
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/10 via-white/[0.03] to-transparent p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                    Selected plan
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {selectedTier.name}
                  </div>
                  <div className="mt-1 text-sm text-white/65">
                    {selectedTier.description}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-semibold uppercase tracking-[0.28em] text-white/45">
                    {billingLabel}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-200">
                    {formatUsd(mobilePrice)}
                  </div>
                </div>
              </div>

              <div className="mt-5 h-[2px] overflow-hidden rounded-full bg-white/10">
                <div className="h-full w-1/2 bg-gradient-to-r from-transparent via-emerald-300/70 to-transparent animate-[scan_1.4s_linear_infinite]" />
              </div>

              <div className="mt-6 space-y-3">
                {selectedTier.features.map((feature) => (
                  <div key={feature.name} className="flex gap-3">
                    <div
                      className={cn(
                        "mt-1 rounded-full border p-1",
                        feature.included
                          ? "text-emerald-300 border-emerald-300/50 bg-emerald-500/10"
                          : "text-white/35 border-white/10 bg-black/20"
                      )}
                    >
                      {feature.included ? (
                        <CheckIcon className="h-4 w-4" />
                      ) : (
                        <Lock className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white">
                        {feature.name}
                      </div>
                      <div className="text-xs text-white/60">
                        {feature.description}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom panel */}
          <div className="fixed inset-x-0 bottom-0 z-50">
            <div className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="rounded-t-3xl border-t border-white/10 bg-black/70 backdrop-blur-xl">
              <div className="mx-auto w-full max-w-md px-5 pb-6 pt-5">
                <div className="space-y-3">
                  {PRICING_TIERS.map((tier) => {
                    const isSelected = tier.tierKey === selectedTierKey
                    return (
                      <button
                        key={tier.tierKey}
                        type="button"
                        onClick={() => setSelectedTierKey(tier.tierKey as TierKey)}
                        className={cn(
                          "w-full rounded-2xl border px-5 py-4 text-left transition-colors",
                          "bg-white/[0.02] hover:bg-white/[0.05]",
                          isSelected
                            ? "border-emerald-400/60 bg-emerald-500/10"
                            : "border-white/10"
                        )}
                      >
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {tier.name}
                            </div>
                            <div className="mt-1 text-xs text-white/60">
                              {tier.description}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xs font-semibold text-emerald-200">
                              {formatUsd(getPeriodPrice(tier, billingPeriod))}
                            </div>
                            <div className="mt-1 text-[10px] uppercase tracking-[0.25em] text-white/35">
                              {billingLabel}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  disabled={
                    mobileAction.disabled ||
                    isLoadingMembership ||
                    loadingPlan != null
                  }
                  onClick={mobileAction.onClick}
                  className={cn(
                    "mt-4 w-full rounded-full px-6 py-4 text-sm font-semibold",
                    "bg-gradient-to-r from-emerald-400 to-emerald-500 text-black",
                    "shadow-[0_10px_30px_rgba(16,185,129,0.28)]",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loadingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      <>
                        {mobileAction.label}
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </button>

                {!membership?.isActive && membership?.hasUsedTrial && (
                  <div className="mt-3 text-center text-[11px] uppercase tracking-[0.28em] text-white/45">
                    Trial already used
                  </div>
                )}

                <div className="mt-5 flex items-center justify-between rounded-full border border-white/10 bg-white/[0.03] p-1.5">
                  {(
                    [
                      { label: "Weekly", value: "weekly" as const },
                      { label: "Monthly", value: "monthly" as const },
                      { label: "Annually", value: "annual" as const },
                    ] as const
                  ).map((period) => {
                    const isSelected = billingPeriod === period.value
                    return (
                      <button
                        key={period.value}
                        type="button"
                        onClick={() => setBillingPeriod(period.value)}
                        className={cn(
                          "flex-1 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
                          isSelected
                            ? "bg-white text-black"
                            : "text-white/70 hover:text-white"
                        )}
                      >
                        {period.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden sm:block pt-6 sm:pt-8">
          <PricingSection tiers={PRICING_TIERS} className="bg-transparent" />
        </div>
      </div>

      <style jsx global>{`
        @keyframes scan {
          0% {
            transform: translateX(-60%);
          }
          100% {
            transform: translateX(160%);
          }
        }
      `}</style>
    </main>
  )
}
