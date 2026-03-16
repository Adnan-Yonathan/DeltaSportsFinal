'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowRight, Check, Loader2, Shield, Sparkles } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { trackTrialFlowEvent } from '@/lib/trial-flow'
import { cn } from '@/lib/utils'
import type { PlanKey } from '@/lib/stripe'

type BillingPeriod = 'weekly' | 'monthly' | 'annual'
type TierKey = 'sharp' | 'syndicate'

type PlanOption = {
  tier: TierKey
  billing: BillingPeriod
  planKey: PlanKey
  price: number
  label: string
  badge?: string
}

const plans: PlanOption[] = [
  { tier: 'syndicate', billing: 'annual', planKey: 'syndicate_annual', price: 299, label: '$299/yr', badge: '3 days free' },
  { tier: 'syndicate', billing: 'monthly', planKey: 'syndicate_monthly', price: 79, label: '$79/mo' },
  { tier: 'syndicate', billing: 'weekly', planKey: 'syndicate_weekly', price: 24.99, label: '$24.99/wk' },
  { tier: 'sharp', billing: 'annual', planKey: 'sharp_annual', price: 249, label: '$249/yr', badge: '3 days free' },
  { tier: 'sharp', billing: 'monthly', planKey: 'sharp_monthly', price: 59, label: '$59/mo' },
  { tier: 'sharp', billing: 'weekly', planKey: 'sharp_weekly', price: 19.99, label: '$19.99/wk' },
]

const features = {
  sharp: [
    'Sharp Projections',
    'Sharp Props',
  ],
  syndicate: [
    'Sharp Projections',
    'Sharp Props',
    'Whale Feed',
    'Research Mode',
  ],
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#020706] text-white">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      }
    >
      <CheckoutPageInner />
    </Suspense>
  )
}

function CheckoutPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedTier, setSelectedTier] = useState<TierKey>('syndicate')
  const [selectedBilling, setSelectedBilling] = useState<BillingPeriod>('annual')
  const [name, setName] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.tier === selectedTier && plan.billing === selectedBilling),
    [selectedBilling, selectedTier]
  )

  useEffect(() => {
    const init = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/signup?redirect=/checkout')
        return
      }

      const metadata =
        user.user_metadata && typeof user.user_metadata === 'object' ? user.user_metadata : {}
      const onboardingProfile =
        metadata.onboarding_profile && typeof metadata.onboarding_profile === 'object'
          ? (metadata.onboarding_profile as Record<string, unknown>)
          : null

      const onboardingName =
        typeof onboardingProfile?.name === 'string'
          ? onboardingProfile.name
          : typeof metadata.display_name === 'string'
            ? metadata.display_name
            : null

      setName(onboardingName)
      setIsReady(true)
      trackTrialFlowEvent('checkout_variant_loaded', {
        source: searchParams.get('source') ?? 'direct',
        configured_variant: 'hosted',
      })
    }

    void init()
  }, [router, searchParams])

  const handleCheckout = async () => {
    if (!selectedPlan || isSubmitting) return
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planKey: selectedPlan.planKey,
          successPath: '/stripe/success',
          cancelPath: '/checkout?source=trial-onboarding-v2',
        }),
      })
      const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.error || 'Failed to open secure checkout')
      }

      window.location.assign(payload.url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open secure checkout')
      setIsSubmitting(false)
    }
  }

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020706] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#020706] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(52,211,153,0.14),transparent_28%),radial-gradient(circle_at_80%_18%,rgba(56,189,248,0.1),transparent_22%),linear-gradient(180deg,#020706_0%,#03110d_55%,#020706_100%)]" />
      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="rounded-[1.8rem] border border-white/10 bg-black/30 p-5 backdrop-blur sm:p-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Secure access
          </div>
          <h1 className="mt-4 text-4xl font-black leading-none tracking-[-0.05em] sm:text-5xl">
            {name ? `${name.split(/\s+/)[0]}, you're one step from live access.` : 'You’re one step from live access.'}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-white/70 sm:text-lg">
            Start with annual Syndicate for the 3-day free trial, or choose the plan that fits your workflow. All plans route through secure Stripe checkout.
          </p>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-5 rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.03))] p-5 backdrop-blur sm:p-7">
            <div className="grid gap-3 sm:grid-cols-2">
              {(['syndicate', 'sharp'] as const).map((tier) => (
                <button
                  key={tier}
                  type="button"
                  onClick={() => setSelectedTier(tier)}
                  className={cn(
                    'rounded-[1.4rem] border p-4 text-left transition',
                    selectedTier === tier
                      ? 'border-emerald-300/35 bg-emerald-400/10'
                      : 'border-white/10 bg-white/[0.03]'
                  )}
                >
                  <div className="text-lg font-semibold capitalize">{tier}</div>
                  <div className="mt-2 text-sm text-white/60">
                    {tier === 'syndicate'
                      ? 'All 4 tools, including Whale Feed and Research Mode.'
                      : 'Sharp Projections and Sharp Props only.'}
                  </div>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {plans
                .filter((plan) => plan.tier === selectedTier)
                .map((plan) => (
                  <button
                    key={plan.planKey}
                    type="button"
                    onClick={() => setSelectedBilling(plan.billing)}
                    className={cn(
                      'rounded-[1.4rem] border p-4 text-left transition',
                      selectedBilling === plan.billing
                        ? 'border-cyan-300/35 bg-cyan-400/10'
                        : 'border-white/10 bg-white/[0.03]'
                    )}
                  >
                    <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">{plan.billing}</div>
                    <div className="mt-2 text-2xl font-semibold">
                      ${(plan.price / (plan.billing === 'annual' ? 365 : plan.billing === 'monthly' ? 30 : 7)).toFixed(2)}
                      <span className="text-sm font-normal text-white/45">/day</span>
                    </div>
                    <div className="mt-0.5 text-xs text-white/40">billed {plan.label}</div>
                    {plan.badge ? (
                      <div className="mt-2 inline-flex rounded-full bg-emerald-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-black">
                        {plan.badge}
                      </div>
                    ) : null}
                  </button>
                ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ['Sharp Projections', 'Edge-ranked spreads, totals, and moneylines.'],
                ['Sharp Props', 'Orderbook pressure and player prop lean scoring.'],
                ['Whale Feed', 'Large-ticket alerts with exchange vs sportsbook context.'],
                ['Research Mode', 'CLV tracking, backtesting, and trend analysis.'],
              ].map(([title, body]) => {
                const enabled = selectedTier === 'syndicate' || title === 'Sharp Projections' || title === 'Sharp Props'
                return (
                  <div
                    key={title}
                    className={cn(
                      'rounded-[1.3rem] border p-4',
                      enabled
                        ? 'border-white/10 bg-white/[0.04]'
                        : 'border-white/8 bg-white/[0.02] opacity-45'
                    )}
                  >
                    <div className="text-lg font-semibold">{title}</div>
                    <div className="mt-2 text-sm leading-6 text-white/62">{body}</div>
                  </div>
                )
              })}
            </div>

            <div className="rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/10 p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-black/20 p-3 text-emerald-100">
                  <Shield className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-lg font-semibold">
                    3-day free trial on annual — cancel before day 3 and you pay nothing.
                  </div>
                  <div className="mt-2 text-sm leading-6 text-white/70">
                    Monthly and weekly plans start immediately. Annual is the only trial-bearing plan.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="space-y-5 rounded-[2rem] border border-white/10 bg-black/30 p-5 backdrop-blur sm:p-6">
            <div>
              <div className="text-[11px] uppercase tracking-[0.28em] text-emerald-200/70">Your plan</div>
              <div className="mt-2 text-3xl font-semibold">
                {selectedTier === 'syndicate' ? 'Syndicate' : 'Sharp'} {selectedBilling}
              </div>
              <div className="mt-2 text-sm text-white/62">
                {selectedPlan
                  ? selectedPlan.billing === 'annual'
                    ? `Start free, then $${(selectedPlan.price / 365).toFixed(2)}/day (billed ${selectedPlan.label}).`
                    : `$${(selectedPlan.price / (selectedPlan.billing === 'monthly' ? 30 : 7)).toFixed(2)}/day — billed ${selectedPlan.label}.`
                  : null}
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">What happens next</div>
              <div className="mt-4 space-y-3 text-sm text-white/72">
                <div>01 Secure checkout on Stripe.</div>
                <div>02 Instant access to your selected Delta stack.</div>
                <div>03 Cancel anytime from billing settings.</div>
              </div>
            </div>

            <div className="rounded-[1.4rem] border border-white/10 bg-white/[0.04] p-4">
              <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Included now</div>
              <div className="mt-4 space-y-2">
                {features[selectedTier].map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-white/76">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-300 text-black">
                      <Check className="h-3 w-3" />
                    </span>
                    {feature}
                  </div>
                ))}
              </div>
            </div>

            {error ? (
              <div className="rounded-[1.3rem] border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                {error}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleCheckout}
              disabled={!selectedPlan || isSubmitting}
              className="inline-flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[1.2rem] bg-gradient-to-r from-emerald-300 via-emerald-400 to-emerald-500 px-5 py-3 text-base font-semibold text-[#04120d] disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              <span>{isSubmitting ? 'Opening secure checkout...' : 'Continue to secure Stripe checkout'}</span>
              {isSubmitting ? null : <ArrowRight className="h-4 w-4" />}
            </button>
          </aside>
        </div>
      </div>
    </main>
  )
}
