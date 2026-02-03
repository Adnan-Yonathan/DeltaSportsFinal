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
  pro_weekly: process.env.STRIPE_PRICE_PRO_WEEKLY,
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_annual: process.env.STRIPE_PRICE_PRO_ANNUAL,
  sharp_weekly: process.env.STRIPE_PRICE_SHARP_WEEKLY,
  sharp_monthly: process.env.STRIPE_PRICE_SHARP_MONTHLY,
  sharp_annual: process.env.STRIPE_PRICE_SHARP_ANNUAL,
  syndicate_weekly: process.env.STRIPE_PRICE_SYNDICATE_WEEKLY,
  syndicate_monthly: process.env.STRIPE_PRICE_SYNDICATE_MONTHLY,
  syndicate_annual: process.env.STRIPE_PRICE_SYNDICATE_ANNUAL,
} as const

export type PlanKey = keyof typeof PRICE_IDS

export const PLAN_CONFIG: Record<PlanKey, { tier: 'sharp' | 'syndicate'; label: string; trialDays?: number }> = {
  pro_weekly: { tier: 'sharp', label: 'Sharp Weekly', trialDays: 7 },
  pro_monthly: { tier: 'sharp', label: 'Sharp Monthly', trialDays: 7 },
  pro_annual: { tier: 'sharp', label: 'Sharp Annual', trialDays: 7 },
  sharp_weekly: { tier: 'sharp', label: 'Sharp Weekly', trialDays: 7 },
  sharp_monthly: { tier: 'sharp', label: 'Sharp Monthly', trialDays: 7 },
  sharp_annual: { tier: 'sharp', label: 'Sharp Annual', trialDays: 7 },
  syndicate_weekly: { tier: 'syndicate', label: 'Syndicate Weekly', trialDays: 7 },
  syndicate_monthly: { tier: 'syndicate', label: 'Syndicate Monthly', trialDays: 7 },
  syndicate_annual: { tier: 'syndicate', label: 'Syndicate Annual', trialDays: 7 },
}

// Helper to get subscription status
export const getSubscriptionStatus = (status: Stripe.Subscription.Status) => {
  const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing']
  return {
    isActive: activeStatuses.includes(status),
    status,
  }
}
