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

const pickPriceId = (...values: Array<string | undefined>) =>
  values.find((value) => typeof value === 'string' && value.length > 0)

// Price IDs - supports both current keys and legacy `pro_*` env vars as fallbacks.
export const PRICE_IDS = {
  pro_weekly: pickPriceId(process.env.STRIPE_PRICE_PRO_WEEKLY),
  pro_monthly: pickPriceId(process.env.STRIPE_PRICE_PRO_MONTHLY),
  pro_annual: pickPriceId(process.env.STRIPE_PRICE_PRO_ANNUAL),
  sharp_weekly: pickPriceId(
    process.env.STRIPE_PRICE_SHARP_WEEKLY,
    process.env.STRIPE_PRICE_PRO_WEEKLY
  ),
  sharp_monthly: pickPriceId(
    process.env.STRIPE_PRICE_SHARP_MONTHLY,
    process.env.STRIPE_PRICE_PRO_MONTHLY
  ),
  sharp_annual: pickPriceId(
    process.env.STRIPE_PRICE_SHARP_ANNUAL,
    process.env.STRIPE_PRICE_PRO_ANNUAL
  ),
  syndicate_weekly: process.env.STRIPE_PRICE_SYNDICATE_WEEKLY,
  syndicate_monthly: process.env.STRIPE_PRICE_SYNDICATE_MONTHLY,
  syndicate_annual: process.env.STRIPE_PRICE_SYNDICATE_ANNUAL,
} as const

export type PlanKey = keyof typeof PRICE_IDS

export const PLAN_CONFIG: Record<PlanKey, { tier: 'sharp' | 'syndicate'; label: string; trialDays?: number }> = {
  pro_weekly: { tier: 'sharp', label: 'Sharp Weekly' },
  pro_monthly: { tier: 'sharp', label: 'Sharp Monthly' },
  pro_annual: { tier: 'sharp', label: 'Sharp Annual', trialDays: 3 },
  sharp_weekly: { tier: 'sharp', label: 'Sharp Weekly' },
  sharp_monthly: { tier: 'sharp', label: 'Sharp Monthly' },
  sharp_annual: { tier: 'sharp', label: 'Sharp Annual', trialDays: 3 },
  syndicate_weekly: { tier: 'syndicate', label: 'Syndicate Weekly' },
  syndicate_monthly: { tier: 'syndicate', label: 'Syndicate Monthly' },
  syndicate_annual: { tier: 'syndicate', label: 'Syndicate Annual', trialDays: 3 },
}

// Helper to get subscription status
export const getSubscriptionStatus = (status: Stripe.Subscription.Status) => {
  const activeStatuses: Stripe.Subscription.Status[] = ['active', 'trialing']
  return {
    isActive: activeStatuses.includes(status),
    status,
  }
}
