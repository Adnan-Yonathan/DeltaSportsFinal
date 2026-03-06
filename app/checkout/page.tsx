'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { CheckIcon, Loader2 } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

type BillingPeriod = 'weekly' | 'monthly' | 'annual'
type TierKey = 'sharp' | 'syndicate'

interface PlanOption {
  tier: TierKey
  billing: BillingPeriod
  planKey: string
  price: number
  period: string
  daily: number
  savings?: number
}

const PLANS: PlanOption[] = [
  // Syndicate plans (default/recommended)
  { tier: 'syndicate', billing: 'weekly', planKey: 'syndicate_weekly', price: 24.99, period: 'week', daily: 3.57 },
  { tier: 'syndicate', billing: 'monthly', planKey: 'syndicate_monthly', price: 79, period: 'month', daily: 2.63, savings: 20 },
  { tier: 'syndicate', billing: 'annual', planKey: 'syndicate_annual', price: 299, period: 'year', daily: 0.82, savings: 45 },
  // Sharp plans
  { tier: 'sharp', billing: 'weekly', planKey: 'sharp_weekly', price: 19.99, period: 'week', daily: 2.86 },
  { tier: 'sharp', billing: 'monthly', planKey: 'sharp_monthly', price: 59, period: 'month', daily: 1.97, savings: 15 },
  { tier: 'sharp', billing: 'annual', planKey: 'sharp_annual', price: 249, period: 'year', daily: 0.68, savings: 40 },
]

const TIER_FEATURES = {
  sharp: [
    'Sharp Projections (spreads, totals, moneylines)',
    'Sharp Props (player prop edges)',
  ],
  syndicate: [
    'Everything in Sharp',
    'Whale Feed (big money alerts)',
    'Research Mode (backtesting, trends)',
  ],
}

export default function CheckoutPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [selectedTier, setSelectedTier] = useState<TierKey>('syndicate')
  const [selectedBilling, setSelectedBilling] = useState<BillingPeriod>('monthly')
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = PLANS.find(
    (p) => p.tier === selectedTier && p.billing === selectedBilling
  )

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/signup?redirect=/checkout')
        return
      }
      setIsAuthenticated(true)
    }
    checkAuth()
  }, [router])

  // Fetch client secret when plan changes
  const fetchClientSecret = useCallback(async () => {
    if (!selectedPlan || !isAuthenticated) return

    setIsLoading(true)
    setError(null)
    setClientSecret(null)

    try {
      const res = await fetch('/api/stripe/embedded-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: selectedPlan.planKey }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to initialize checkout')
      }

      setClientSecret(data.clientSecret)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initialize checkout')
    } finally {
      setIsLoading(false)
    }
  }, [selectedPlan, isAuthenticated])

  useEffect(() => {
    if (isAuthenticated && selectedPlan) {
      fetchClientSecret()
    }
  }, [isAuthenticated, selectedPlan?.planKey, fetchClientSecret])

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            Start your 7-day free trial
          </h1>
          <p className="mt-3 text-lg text-white/60">
            See where the sharp money is betting. Cancel anytime.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left Column: Plan Selection */}
          <div className="order-2 lg:order-1 space-y-6">
            {/* Tier Selection */}
            <div>
              <label className="text-sm font-medium text-white/70 mb-3 block">
                Choose your plan
              </label>
              <div className="grid grid-cols-2 gap-3">
                {(['syndicate', 'sharp'] as const).map((tier) => (
                  <button
                    key={tier}
                    onClick={() => setSelectedTier(tier)}
                    className={cn(
                      'relative rounded-2xl border p-4 text-left transition-all',
                      selectedTier === tier
                        ? 'border-emerald-400/60 bg-emerald-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                    )}
                  >
                    {tier === 'syndicate' && (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-bold text-black">
                        Most Popular
                      </span>
                    )}
                    <div className="font-semibold capitalize">{tier}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {tier === 'syndicate' ? 'Full access + whale feed' : 'Projections + props'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Billing Period Selection */}
            <div>
              <label className="text-sm font-medium text-white/70 mb-3 block">
                Billing period
              </label>
              <div className="flex rounded-full border border-white/10 bg-white/[0.02] p-1">
                {(['weekly', 'monthly', 'annual'] as const).map((period) => {
                  const plan = PLANS.find((p) => p.tier === selectedTier && p.billing === period)
                  return (
                    <button
                      key={period}
                      onClick={() => setSelectedBilling(period)}
                      className={cn(
                        'relative flex-1 rounded-full px-4 py-2.5 text-sm font-medium transition-all',
                        selectedBilling === period
                          ? 'bg-white text-black'
                          : 'text-white/60 hover:text-white'
                      )}
                    >
                      {period === 'annual' && (
                        <span className="absolute -top-2 right-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold text-black">
                          Best Value
                        </span>
                      )}
                      <span className="capitalize">{period}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price Summary */}
            {selectedPlan && (
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
                <div className="flex items-baseline justify-between">
                  <div>
                    <span className="text-3xl font-bold">${selectedPlan.daily.toFixed(2)}</span>
                    <span className="text-white/50">/day</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white/50">
                      ${selectedPlan.price}/{selectedPlan.period}
                    </div>
                    {selectedPlan.savings && (
                      <div className="text-sm font-medium text-emerald-400">
                        Save {selectedPlan.savings}%
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Features */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="text-sm font-medium text-white/70 mb-3">
                What&apos;s included:
              </div>
              <ul className="space-y-2.5">
                {TIER_FEATURES[selectedTier].map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Trust Signals */}
            <div className="space-y-3 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                <span>7-day free trial — no charge today</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                <span>Cancel anytime in 2 clicks</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                <span>We&apos;ll remind you before billing</span>
              </div>
            </div>
          </div>

          {/* Right Column: Stripe Checkout */}
          <div className="order-1 lg:order-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-1 overflow-hidden">
              {error && (
                <div className="p-6 text-center">
                  <div className="text-red-400 mb-4">{error}</div>
                  <button
                    onClick={fetchClientSecret}
                    className="text-sm text-emerald-400 hover:text-emerald-300"
                  >
                    Try again
                  </button>
                </div>
              )}

              {isLoading && (
                <div className="p-12 flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-white/50 mb-4" />
                  <div className="text-sm text-white/50">Loading checkout...</div>
                </div>
              )}

              {clientSecret && !isLoading && (
                <EmbeddedCheckoutProvider
                  stripe={stripePromise}
                  options={{ clientSecret }}
                >
                  <EmbeddedCheckout className="rounded-xl" />
                </EmbeddedCheckoutProvider>
              )}
            </div>

            {/* Mobile trust signals */}
            <div className="mt-4 text-center text-xs text-white/40 lg:hidden">
              Secure payment powered by Stripe
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
