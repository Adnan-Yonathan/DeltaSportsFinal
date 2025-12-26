import Stripe from 'stripe'

// Lazy-initialize Stripe client to avoid build-time errors
let _stripe: Stripe | null = null

export const stripe: Stripe = new Proxy({} as Stripe, {
  get(_, prop) {
    if (!_stripe) {
      if (!process.env.STRIPE_SECRET_KEY) {
        throw new Error('STRIPE_SECRET_KEY is not set')
      }
      _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
    }
    return (_stripe as any)[prop]
  },
})

// Price IDs - set these in your environment variables after creating products in Stripe Dashboard
export const PRICE_IDS = {
  pro_trial: process.env.STRIPE_PRICE_PRO_TRIAL, // Free trial (if using trial periods on subscription)
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  unlimited_monthly: process.env.STRIPE_PRICE_UNLIMITED_MONTHLY,
  unlimited_annual: process.env.STRIPE_PRICE_UNLIMITED_ANNUAL,
} as const

export type PlanKey = keyof typeof PRICE_IDS

export const PLAN_CONFIG: Record<PlanKey, { tier: 'pro' | 'unlimited'; label: string; trialDays?: number }> = {
  pro_trial: { tier: 'pro', label: 'Pro Trial', trialDays: 7 },
  pro_monthly: { tier: 'pro', label: 'Pro Monthly' },
  pro_annual: { tier: 'pro', label: 'Pro Annual' },
  unlimited_monthly: { tier: 'unlimited', label: 'Unlimited Monthly' },
  unlimited_annual: { tier: 'unlimited', label: 'Unlimited Annual' },
}

// Helper to get subscription status
export const getSubscriptionStatus = (status: Stripe.Subscription.Status) => {
  const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing']
  return {
    isActive: activeStatuses.includes(status),
    status,
  }
}
