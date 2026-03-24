"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRightIcon, CheckIcon } from "@radix-ui/react-icons"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatusFromMetadata, type MembershipInfo } from "@/lib/utils/membership"
import { cn } from "@/lib/utils"
import { PricingSection } from "@/components/ui/pricing-section"
import { PRICING_TIERS } from "@/components/pricing/pricing-tiers"
import type { PricingTier } from "@/components/ui/pricing-section"
import { SimpleHeader } from "@/components/ui/simple-header"
import { OddsMatrixSurface } from "@/components/ui/odds-matrix-surface"

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

const getDaysInPeriod = (billing: BillingPeriod) =>
  billing === "annual" ? 365 : billing === "monthly" ? 30 : 7

const getAnnualizedCost = (tier: PricingTier, billing: BillingPeriod) => {
  const periodPrice = getPeriodPrice(tier, billing)

  if (billing === "annual") return periodPrice
  if (billing === "monthly") return periodPrice * 12
  return periodPrice * 52
}

const getSavingsVsWeekly = (tier: PricingTier, billing: BillingPeriod) => {
  const weeklyAnnualized = getAnnualizedCost(tier, "weekly")
  const selectedAnnualized = getAnnualizedCost(tier, billing)

  const savedAmount = weeklyAnnualized - selectedAnnualized
  const savedPercent = weeklyAnnualized > 0 ? (savedAmount / weeklyAnnualized) * 100 : 0

  return {
    savedAmount,
    savedPercent,
  }
}

const formatSavingsPercent = (percent: number) => {
  const clamped = Math.max(0, percent)
  return Math.floor(clamped / 5) * 5
}

const getPlanKey = (tier: PricingTier, billing: BillingPeriod) =>
  tier.planKey ||
  (billing === "annual"
    ? tier.planKeyYearly
    : billing === "monthly"
      ? tier.planKeyMonthly
      : tier.planKeyWeekly)

const isSafeInternalPath = (value: string | null): value is string => {
  if (!value) return false
  if (!value.startsWith("/")) return false
  if (value.startsWith("//")) return false
  if (value.includes("://")) return false
  if (value.includes("\\")) return false
  return true
}

export function PricingPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("annual")
  const [selectedTierKey, setSelectedTierKey] = useState<TierKey>("syndicate")
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [isLoadingMembership, setIsLoadingMembership] = useState(true)

  useEffect(() => {
    const fetchMembership = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setMembership(getMembershipStatusFromMetadata(user.user_metadata))
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
    router.push("/billing")
  }

  const buildCheckoutRedirects = () => {
    const next = searchParams.get("next")
    const source = searchParams.get("source")

    if (isSafeInternalPath(next)) {
      const successParams = new URLSearchParams({ next })
      const cancelParams = new URLSearchParams({ next })
      if (source) {
        cancelParams.set("source", source)
      }
      const successPath = `/stripe/success?${successParams.toString()}`
      const cancelPath = `/pricing?${cancelParams.toString()}`
      return { successPath, cancelPath }
    }

    return {}
  }

  const handleCheckout = async (planKey: string) => {
    setLoadingPlan(planKey)
    try {
      const redirects = buildCheckoutRedirects()
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, ...redirects }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push("/auth/signup?redirect=/pricing")
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
        label: isLoading ? "Loading..." : "Manage subscription",
        disabled: isLoading,
        onClick: handleManageSubscription,
      }
    }

    if (isUpgrade) {
      return {
        label: isLoading ? "Processing..." : `Upgrade to ${selectedTier.name}`,
        disabled: isLoading,
        onClick: () => handleUpgrade(selectedPlanKey),
      }
    }

    if (membership?.isActive) {
      return {
        label: isLoading ? "Loading..." : "Manage subscription",
        disabled: isLoading,
        onClick: handleManageSubscription,
      }
    }

    return {
      label:
        isLoading
          ? "Processing..."
          : !membership?.hasUsedTrial
            ? "Start your free trial"
            : "Start subscription",
      disabled: isLoading,
      onClick: () => handleCheckout(selectedPlanKey),
    }
  }

  const mobileAction = buildMobileAction()
  const isEligibleForTrial = !membership?.isActive && !membership?.hasUsedTrial
  const hasTrial = isEligibleForTrial

  return (
    <main className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.22} className="opacity-90" />
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
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
        <SimpleHeader widthClass="max-w-6xl" />

        <div className="sm:hidden">
          <div className="mx-auto w-full max-w-md px-5 pb-40 pt-20">
            <div className="space-y-2 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-white">
                {hasTrial ? "All plans include a 7-day free trial." : "Choose the plan that fits your workflow."}
              </h1>
              <p className="text-sm text-white/65">
                {hasTrial
                  ? "Try any plan free for 7 days. Cancel anytime before your trial ends."
                  : "Cancel anytime from billing."}
              </p>
            </div>

            <div className="mt-6 rounded-full border border-emerald-300/30 bg-emerald-500/10 p-1.5 backdrop-blur">
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
                      "relative w-1/3 rounded-full px-3 py-2 text-xs font-semibold transition-colors",
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

            <div className="mt-5 grid grid-cols-2 gap-3">
              {PRICING_TIERS.map((tier) => {
                const isSelected = tier.tierKey === selectedTierKey
                const periodPrice = getPeriodPrice(tier, billingPeriod)
                const dailyPrice = periodPrice > 0 ? periodPrice / getDaysInPeriod(billingPeriod) : 0
                const weeklyEquivalent = billingPeriod === "annual" && periodPrice > 0 ? periodPrice / 52 : null
                const savings = getSavingsVsWeekly(tier, billingPeriod)
                const savingsPercent = formatSavingsPercent(savings.savedPercent)

                return (
                  <button
                    key={tier.tierKey}
                    type="button"
                    onClick={() => setSelectedTierKey(tier.tierKey as TierKey)}
                    className={cn(
                      "relative rounded-3xl border p-4 text-left transition-colors",
                      "bg-white/[0.02] hover:bg-white/[0.05]",
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10"
                    )}
                  >
                    {hasTrial ? (
                      <span className="absolute -top-3 right-4 rounded-full bg-emerald-400 px-3 py-1 text-[10px] font-bold text-slate-900 shadow">
                        7-Day Free Trial
                      </span>
                    ) : null}

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{tier.name}</div>
                        <div className="mt-1 text-[11px] text-white/60">{tier.description}</div>
                      </div>
                      <div
                        className={cn(
                          "mt-1 h-4 w-4 rounded-full border",
                          isSelected
                            ? "border-emerald-300 bg-emerald-400"
                            : "border-white/20 bg-transparent"
                        )}
                        aria-hidden
                      />
                    </div>

                    <div className="mt-4">
                      <div className="text-xl font-semibold text-white">
                        {formatUsd(periodPrice)}
                        <span className="ml-1 text-xs font-semibold text-white/60">
                          /{billingPeriod === "annual" ? "yr" : billingPeriod === "monthly" ? "mo" : "wk"}
                        </span>
                      </div>

                      <div className="mt-1 text-[11px] text-white/60">
                        ~ {formatUsd(dailyPrice)}/day
                        {weeklyEquivalent != null ? (
                          <span> | {formatUsd(weeklyEquivalent)}/week</span>
                        ) : null}
                      </div>

                      {billingPeriod === "annual" && savings.savedAmount > 0 ? (
                        <div className="mt-1 text-[11px] font-semibold text-emerald-200">
                          Save {formatUsd(savings.savedAmount)}/yr ({savingsPercent}% off)
                        </div>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>

            {membership?.hasUsedTrial && !membership?.isActive ? (
              <div className="mt-4 text-center text-[11px] uppercase tracking-[0.28em] text-white/45">
                Trial already used
              </div>
            ) : null}

            {hasTrial ? (
              <div className="mt-6 rounded-3xl border border-emerald-300/20 bg-white/[0.03] p-5">
                <div className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-full w-1 rounded-full bg-gradient-to-b from-emerald-400/70 via-emerald-400/20 to-white/10" />
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
                      <div className="mt-0.5 rounded-full border border-white/10 bg-black/20 p-1.5">
                        <span className="block h-4 w-4 rounded-full bg-white/10" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white">Day 2</div>
                        <div className="text-xs text-white/60">Payment reminder sent before billing</div>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full border border-white/10 bg-black/20 p-1.5">
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
            ) : null}
          </div>

          <div className="fixed inset-x-0 bottom-0 z-50">
            <div className="pointer-events-none absolute inset-x-0 -top-12 h-12 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            <div className="border-t border-white/10 bg-black/70 backdrop-blur-xl">
              <div className="mx-auto w-full max-w-md px-5 pb-6 pt-5">
                <button
                  type="button"
                  disabled={
                    mobileAction.disabled ||
                    isLoadingMembership ||
                    loadingPlan != null
                  }
                  onClick={mobileAction.onClick}
                  className={cn(
                    "w-full rounded-full px-6 py-4 text-sm font-semibold",
                    "bg-gradient-to-r from-emerald-400 to-emerald-500 text-black",
                    "shadow-[0_10px_30px_rgba(16,185,129,0.28)]",
                    "disabled:cursor-not-allowed disabled:opacity-50"
                  )}
                >
                  <span className="flex items-center justify-center gap-2">
                    {loadingPlan ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        {mobileAction.label}
                        <ArrowRightIcon className="h-4 w-4" />
                      </>
                    )}
                  </span>
                </button>

                {!membership?.isActive ? (
                  <div className="mt-3 text-center text-xs text-white/60">
                    {hasTrial
                      ? "No payment due now • Cancel anytime • We’ll remind you before your trial ends"
                      : "Cancel anytime from billing"}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* ── Desktop pricing ── */}
        <div className="hidden sm:block px-6 pb-28 pt-20 sm:pt-24">
          <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="space-y-2 text-center">
              <h1 className="text-4xl font-semibold tracking-tight text-white">
                {isEligibleForTrial ? "All plans include a 7-day free trial." : "Choose the plan that fits your workflow."}
              </h1>
              <p className="text-sm text-white/55">
                {isEligibleForTrial
                  ? "Try any plan free for 7 days. Cancel anytime before your trial ends."
                  : "Cancel anytime from billing."}
              </p>
            </div>

            {/* Billing toggle */}
            <div className="mt-8 flex justify-center">
              <div className="inline-flex rounded-full border border-emerald-300/25 bg-emerald-500/[0.07] p-1.5 backdrop-blur">
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
                        "relative rounded-full px-6 py-2.5 text-sm font-semibold transition-colors",
                        isSelected ? "bg-white text-black shadow" : "text-white/65 hover:text-white"
                      )}
                    >
                      {period.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Tier cards */}
            <div className="mt-8 grid grid-cols-2 gap-4">
              {PRICING_TIERS.map((tier) => {
                const periodPrice = getPeriodPrice(tier, billingPeriod)
                const dailyPrice = periodPrice > 0 ? periodPrice / getDaysInPeriod(billingPeriod) : 0
                const savings = getSavingsVsWeekly(tier, billingPeriod)
                const savingsPercent = formatSavingsPercent(savings.savedPercent)
                const planKey = getPlanKey(tier, billingPeriod)
                const isHighlight = !!tier.highlight
                const isLoading = loadingPlan === planKey || loadingPlan === "manage"

                const isCurrentPlan = membership?.isActive && membership.tier === tier.tierKey
                const isUpgrade =
                  membership?.isActive &&
                  membership.tier &&
                  tierRank[tier.tierKey as TierKey] > tierRank[membership.tier as "free" | TierKey]

                let btnLabel = isEligibleForTrial
                  ? "Start 7-day free trial"
                  : "Start subscription"
                let btnAction = () => planKey && handleCheckout(planKey)

                if (isCurrentPlan) {
                  btnLabel = "Manage subscription"
                  btnAction = handleManageSubscription
                } else if (isUpgrade) {
                  btnLabel = `Upgrade to ${tier.name}`
                  btnAction = () => planKey && handleUpgrade(planKey)
                } else if (membership?.isActive) {
                  btnLabel = "Manage subscription"
                  btnAction = handleManageSubscription
                }

                return (
                  <div
                    key={tier.tierKey}
                    className={cn(
                      "relative flex flex-col rounded-3xl border p-8 transition-colors",
                      isHighlight
                        ? "border-emerald-400/40 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.1),rgba(0,0,0,0.6)_60%)]"
                        : "border-white/10 bg-white/[0.025]"
                    )}
                  >
                    {/* Badge */}
                    {tier.badge ? (
                      <span className="absolute -top-3 left-8 rounded-full bg-emerald-400 px-4 py-1 text-[11px] font-bold text-slate-900 shadow">
                        {tier.badge}
                      </span>
                    ) : null}
                    {hasTrial ? (
                      <span className="absolute -top-3 right-8 rounded-full bg-white/10 border border-white/20 px-4 py-1 text-[11px] font-semibold text-white/80">
                        7-Day Free Trial
                      </span>
                    ) : null}

                    {/* Name + description */}
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-2xl",
                        isHighlight ? "bg-emerald-500/20 border border-emerald-400/30" : "bg-white/5 border border-white/10"
                      )}>
                        {tier.icon}
                      </div>
                      <div>
                        <div className="text-lg font-semibold text-white">{tier.name}</div>
                        <div className="text-xs text-white/50">{tier.description}</div>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-8">
                      <div className="flex items-end gap-1">
                        <span className="text-5xl font-bold tracking-tight text-white">
                          {formatUsd(dailyPrice)}
                        </span>
                        <span className="mb-1.5 text-sm text-white/50">/day</span>
                      </div>
                      <div className="mt-1 text-sm text-white/45">
                        billed {formatUsd(periodPrice)}/{billingPeriod === "annual" ? "yr" : billingPeriod === "monthly" ? "mo" : "wk"}
                      </div>
                      {billingPeriod === "annual" && savingsPercent > 0 ? (
                        <div className="mt-1.5 inline-flex rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300">
                          Save {savingsPercent}% vs weekly
                        </div>
                      ) : null}
                    </div>

                    {/* CTA */}
                    <button
                      type="button"
                      disabled={isLoading || isLoadingMembership || !planKey}
                      onClick={btnAction}
                      className={cn(
                        "mt-6 w-full rounded-full py-3.5 text-sm font-semibold transition",
                        "disabled:cursor-not-allowed disabled:opacity-50",
                        isHighlight
                          ? "bg-gradient-to-r from-emerald-400 to-emerald-500 text-black shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:from-emerald-300 hover:to-emerald-400"
                          : "border border-white/15 bg-white/5 text-white hover:bg-white/10"
                      )}
                    >
                      {isLoading ? (
                        <span className="inline-flex items-center justify-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Processing...
                        </span>
                      ) : (
                        btnLabel
                      )}
                    </button>

                    {/* Features */}
                    <ul className="mt-6 space-y-3">
                      {tier.features.map((f) => (
                        <li key={f.name} className="flex items-start gap-3">
                          <span
                            className={cn(
                              "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                              f.included
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-white/5 text-white/20"
                            )}
                          >
                            <CheckIcon className="h-3 w-3" />
                          </span>
                          <div>
                            <div className={cn("text-sm font-medium", f.included ? "text-white" : "text-white/30 line-through")}>
                              {f.name}
                            </div>
                            {f.description ? (
                              <div className="text-xs text-white/40">{f.description}</div>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>

            {/* Trial timeline */}
            {hasTrial ? (
              <div className="mt-8 rounded-3xl border border-emerald-300/15 bg-white/[0.02] p-6">
                <div className="text-xs font-semibold uppercase tracking-widest text-white/35 mb-4">Trial timeline</div>
                <div className="flex items-start gap-8">
                  {[
                    { day: "Today", label: "Start free trial", active: true },
                    { day: "Day 2", label: "Reminder before billing", active: false },
                    { day: "Day 3", label: "First billing (if not canceled)", active: false },
                  ].map((step, i) => (
                    <div key={i} className="flex flex-1 items-start gap-3">
                      <div className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                        step.active ? "border-emerald-400/50 bg-emerald-500/20 text-emerald-300" : "border-white/10 bg-white/5 text-white/30"
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <div className={cn("text-sm font-semibold", step.active ? "text-white" : "text-white/50")}>{step.day}</div>
                        <div className="text-xs text-white/40">{step.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {!membership?.isActive ? (
              <div className="mt-5 text-center text-xs text-white/35">
                No payment due on free trial • Cancel anytime before Day 3 • Secure checkout via Stripe
              </div>
            ) : null}
          </div>
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
