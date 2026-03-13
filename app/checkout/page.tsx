'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, type StripeCheckoutConfirmResult } from '@stripe/stripe-js'
import {
  EmbeddedCheckout,
  EmbeddedCheckoutProvider,
} from '@stripe/react-stripe-js'
import {
  CheckoutProvider,
  ExpressCheckoutElement,
  PaymentElement,
  useCheckout,
} from '@stripe/react-stripe-js/checkout'
import { createClient } from '@/lib/supabase/client'
import { trackTrialFlowEvent } from '@/lib/trial-flow'
import { cn } from '@/lib/utils'
import { AlertCircle, CheckIcon, Loader2, Wallet } from 'lucide-react'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)
const CHECKOUT_VARIANT =
  process.env.NEXT_PUBLIC_STRIPE_CHECKOUT_VARIANT === 'custom' ? 'custom' : 'embedded'

type BillingPeriod = 'weekly' | 'monthly' | 'annual'
type TierKey = 'sharp' | 'syndicate'
type CheckoutVariant = 'custom' | 'embedded'

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
  { tier: 'syndicate', billing: 'weekly', planKey: 'syndicate_weekly', price: 24.99, period: 'week', daily: 3.57 },
  { tier: 'syndicate', billing: 'monthly', planKey: 'syndicate_monthly', price: 79, period: 'month', daily: 2.63, savings: 20 },
  { tier: 'syndicate', billing: 'annual', planKey: 'syndicate_annual', price: 299, period: 'year', daily: 0.82, savings: 45 },
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
    'Research Mode (backtesting, trends)',
  ],
}

export default function CheckoutPage() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [selectedTier, setSelectedTier] = useState<TierKey>('syndicate')
  const [selectedBilling, setSelectedBilling] = useState<BillingPeriod>('monthly')
  const [activeVariant, setActiveVariant] = useState<CheckoutVariant>(CHECKOUT_VARIANT)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = useMemo(
    () => PLANS.find((p) => p.tier === selectedTier && p.billing === selectedBilling),
    [selectedBilling, selectedTier]
  )

  useEffect(() => {
    trackTrialFlowEvent('checkout_variant_loaded', {
      configured_variant: CHECKOUT_VARIANT,
    })
  }, [])

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

  const fallbackToEmbedded = useCallback((reason: string) => {
    setActiveVariant((current) => {
      if (current === 'embedded') return current
      trackTrialFlowEvent('checkout_variant_fallback', {
        from_variant: current,
        to_variant: 'embedded',
        reason,
      })
      return 'embedded'
    })
    setError(null)
    setClientSecret(null)
  }, [])

  const fetchClientSecret = useCallback(async () => {
    if (!selectedPlan || !isAuthenticated) return

    setIsLoading(true)
    setError(null)
    setClientSecret(null)

    const route =
      activeVariant === 'custom'
        ? '/api/stripe/custom-checkout'
        : '/api/stripe/embedded-checkout'

    try {
      const res = await fetch(route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planKey: selectedPlan.planKey }),
      })

      const data = (await res.json().catch(() => null)) as { clientSecret?: string; error?: string } | null

      if (!res.ok || !data?.clientSecret) {
        throw new Error(data?.error || 'Failed to initialize checkout')
      }

      setClientSecret(data.clientSecret)
      trackTrialFlowEvent('checkout_variant_loaded', {
        configured_variant: CHECKOUT_VARIANT,
        active_variant: activeVariant,
        plan_key: selectedPlan.planKey,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize checkout'

      if (activeVariant === 'custom') {
        fallbackToEmbedded('bootstrap_failed')
        return
      }

      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [activeVariant, fallbackToEmbedded, isAuthenticated, selectedPlan])

  useEffect(() => {
    if (CHECKOUT_VARIANT !== 'custom' && activeVariant !== CHECKOUT_VARIANT) {
      setActiveVariant(CHECKOUT_VARIANT)
      setClientSecret(null)
      setError(null)
    }
  }, [activeVariant])

  useEffect(() => {
    if (isAuthenticated && selectedPlan) {
      fetchClientSecret()
    }
  }, [fetchClientSecret, isAuthenticated, selectedPlan])

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white/50" />
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Start your 7-day free trial</h1>
          <p className="mt-3 text-lg text-white/60">
            See where the sharp money is betting. Cancel anytime.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
          <div className="order-2 space-y-6 lg:order-1">
            <div>
              <label className="mb-3 block text-sm font-medium text-white/70">
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
                    {tier === 'syndicate' ? (
                      <span className="absolute -top-2.5 right-3 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-bold text-black">
                        Most Popular
                      </span>
                    ) : null}
                    <div className="font-semibold capitalize">{tier}</div>
                    <div className="mt-1 text-xs text-white/50">
                      {tier === 'syndicate' ? 'Full access + whale feed' : 'Projections + props'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-3 block text-sm font-medium text-white/70">
                Billing period
              </label>
              <div className="flex rounded-full border border-white/10 bg-white/[0.02] p-1">
                {(['weekly', 'monthly', 'annual'] as const).map((period) => (
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
                    {period === 'annual' ? (
                      <span className="absolute -top-2 right-2 rounded-full bg-emerald-400 px-2 py-0.5 text-[9px] font-bold text-black">
                        Best Value
                      </span>
                    ) : null}
                    <span className="capitalize">{period}</span>
                  </button>
                ))}
              </div>
            </div>

            {selectedPlan ? (
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
                    {selectedPlan.savings ? (
                      <div className="text-sm font-medium text-emerald-400">
                        Save {selectedPlan.savings}%
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-3 text-sm font-medium text-white/70">What&apos;s included:</div>
              <ul className="space-y-2.5">
                {TIER_FEATURES[selectedTier].map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-400" />
                    <span className="text-sm text-white/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-3 text-sm text-white/50">
              <div className="flex items-center gap-2">
                <CheckIcon className="h-4 w-4 text-emerald-400" />
                <span>7-day free trial, no charge today</span>
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

          <div className="order-1 lg:order-2">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-1">
              {error ? (
                <CheckoutErrorState error={error} onRetry={fetchClientSecret} />
              ) : null}

              {isLoading ? (
                <CheckoutLoadingState />
              ) : null}

              {clientSecret && !isLoading && !error ? (
                activeVariant === 'custom' ? (
                  <CustomCheckoutShell
                    key={`${activeVariant}-${selectedPlan?.planKey}`}
                    clientSecret={clientSecret}
                    onFallback={() => fallbackToEmbedded('custom_checkout_runtime_error')}
                  />
                ) : (
                  <EmbeddedCheckoutProvider
                    key={`${activeVariant}-${selectedPlan?.planKey}`}
                    stripe={stripePromise}
                    options={{ clientSecret }}
                  >
                    <EmbeddedCheckout className="rounded-xl" />
                  </EmbeddedCheckoutProvider>
                )
              ) : null}
            </div>

            <div className="mt-4 text-center text-xs text-white/40 lg:hidden">
              Secure payment powered by Stripe
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

function CustomCheckoutShell({
  clientSecret,
  onFallback,
}: {
  clientSecret: string
  onFallback: () => void
}) {
  return (
    <CheckoutProvider
      stripe={stripePromise}
      options={{
        clientSecret,
        elementsOptions: {
          appearance: {
            theme: 'night',
            variables: {
              colorPrimary: '#34d399',
              colorBackground: '#020202',
              colorText: '#ffffff',
              colorDanger: '#f87171',
              borderRadius: '18px',
            },
          },
        },
      }}
    >
      <CustomCheckoutForm onFallback={onFallback} />
    </CheckoutProvider>
  )
}

function CustomCheckoutForm({ onFallback }: { onFallback: () => void }) {
  const checkoutState = useCheckout()
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasExpressMethods, setHasExpressMethods] = useState(false)
  const [isMobileQuickPayOnly, setIsMobileQuickPayOnly] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const mediaQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)')
    const update = () => setIsMobileQuickPayOnly(mediaQuery.matches)

    update()

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', update)
      return () => mediaQuery.removeEventListener('change', update)
    }

    mediaQuery.addListener(update)
    return () => mediaQuery.removeListener(update)
  }, [])

  useEffect(() => {
    if (checkoutState.type === 'error') {
      onFallback()
    }
  }, [checkoutState, onFallback])

  const handleResult = useCallback(async (result: StripeCheckoutConfirmResult) => {
    if (result.type === 'error') {
      setSubmitError(result.error.message)
      return
    }

    window.location.assign(`/stripe/success?session_id=${encodeURIComponent(result.session.id)}`)
  }, [])

  const submitCardPayment = useCallback(async () => {
    if (checkoutState.type !== 'success') return

    setIsSubmitting(true)
    setSubmitError(null)
    trackTrialFlowEvent('payment_element_submitted', {
      checkout_surface: 'payment_element',
    })

    try {
      const result = await checkoutState.checkout.confirm()
      await handleResult(result)
    } finally {
      setIsSubmitting(false)
    }
  }, [checkoutState, handleResult])

  if (checkoutState.type === 'loading') {
    return <CheckoutLoadingState />
  }

  if (checkoutState.type === 'error') {
    return <CheckoutLoadingState />
  }

  const { checkout } = checkoutState
  const expressCheckoutOptions = isMobileQuickPayOnly
    ? {
        buttonHeight: 48,
        buttonTheme: {
          applePay: 'white-outline' as const,
          googlePay: 'black' as const,
        },
        buttonType: {
          applePay: 'subscribe' as const,
          googlePay: 'subscribe' as const,
        },
        layout: {
          maxColumns: 2,
          maxRows: 1,
          overflow: 'auto' as const,
        },
        paymentMethodOrder: ['apple_pay', 'google_pay'],
        paymentMethods: {
          applePay: 'auto' as const,
          googlePay: 'auto' as const,
          link: 'never' as const,
          paypal: 'never' as const,
          amazonPay: 'never' as const,
          klarna: 'never' as const,
        },
      }
    : {
        buttonHeight: 48,
        buttonTheme: {
          applePay: 'white-outline' as const,
          googlePay: 'black' as const,
          paypal: 'black' as const,
        },
        buttonType: {
          applePay: 'subscribe' as const,
          googlePay: 'subscribe' as const,
          paypal: 'checkout' as const,
        },
        layout: {
          maxColumns: 2,
          maxRows: 2,
          overflow: 'auto' as const,
        },
        paymentMethodOrder: ['apple_pay', 'google_pay', 'link', 'paypal'],
        paymentMethods: {
          applePay: 'auto' as const,
          googlePay: 'auto' as const,
          link: 'auto' as const,
          paypal: 'auto' as const,
          amazonPay: 'never' as const,
          klarna: 'never' as const,
        },
      }

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-full bg-emerald-400/15 p-2 text-emerald-300">
            <Wallet className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Faster checkout</div>
            <div className="mt-1 text-sm text-white/60">
              Use Apple Pay, Google Pay, Link, or another saved wallet if available.
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="text-sm font-medium text-white/70">1-click checkout</div>
        <ExpressCheckoutElement
          options={expressCheckoutOptions}
          onReady={(event) => {
            const available = event.availablePaymentMethods
            const hasAvailableMethod = available
              ? Object.values(available).some(Boolean)
              : false
            setHasExpressMethods(hasAvailableMethod)
            if (hasAvailableMethod) {
              trackTrialFlowEvent('express_checkout_ready', {
                checkout_surface: 'express_checkout',
              })
            }
          }}
          onConfirm={async (event) => {
            setIsSubmitting(true)
            setSubmitError(null)
            trackTrialFlowEvent('express_checkout_confirmed', {
              checkout_surface: 'express_checkout',
            })

            try {
              const result = await checkout.confirm({
                expressCheckoutConfirmEvent: event,
              })
              await handleResult(result)
            } finally {
              setIsSubmitting(false)
            }
          }}
        />
        {!hasExpressMethods ? (
          <div className="text-xs text-white/45">
            Saved wallets are not available on this device or browser. Use the secure card form below.
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs uppercase tracking-[0.3em] text-white/35">Or pay with card</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <div className="space-y-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <PaymentElement
          options={{
            layout: 'tabs',
          }}
          onChange={(event) => {
            if (event.complete) {
              setSubmitError(null)
            }
          }}
        />

        {submitError ? (
          <div className="flex items-start gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{submitError}</span>
          </div>
        ) : null}

        <button
          type="button"
          onClick={submitCardPayment}
          disabled={isSubmitting || !checkout.canConfirm}
          className="inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-4 py-3 text-base font-semibold text-black transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Start trial with card'}
        </button>
      </div>
    </div>
  )
}

function CheckoutLoadingState() {
  return (
    <div className="flex flex-col items-center justify-center p-12">
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-white/50" />
      <div className="text-sm text-white/50">Loading checkout...</div>
    </div>
  )
}

function CheckoutErrorState({
  error,
  onRetry,
}: {
  error: string
  onRetry: () => void
}) {
  return (
    <div className="p-6 text-center">
      <div className="mb-4 text-red-400">{error}</div>
      <button
        onClick={onRetry}
        className="text-sm text-emerald-400 hover:text-emerald-300"
      >
        Try again
      </button>
    </div>
  )
}
