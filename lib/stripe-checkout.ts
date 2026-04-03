import type Stripe from 'stripe'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import type { SupabaseClient, User } from '@supabase/supabase-js'

type CheckoutContext = {
  user: User
  customerId: string
  resolvedPlanKey: keyof typeof PRICE_IDS
  priceId: string
  planConfig: (typeof PLAN_CONFIG)[PlanKey]
  hasUsedTrial: boolean
  affiliateCode?: string | null
  affiliateAttributionId?: string | null
  attributionMetadata?: Record<string, string>
}

export const resolveCheckoutPlan = (planKey: PlanKey) => {
  if (!planKey || !(planKey in PRICE_IDS)) {
    throw new Error('Invalid plan')
  }

  const resolvedPlanKey = planKey as keyof typeof PRICE_IDS
  const priceId = PRICE_IDS[resolvedPlanKey]

  if (!priceId) {
    throw new Error(`Price ID not configured for ${resolvedPlanKey}.`)
  }

  return {
    resolvedPlanKey,
    priceId,
    planConfig: PLAN_CONFIG[resolvedPlanKey],
  }
}

export const ensureStripeCustomer = async (
  supabase: SupabaseClient,
  user: User
) => {
  let customerId = user.user_metadata?.stripe_customer_id as string | undefined

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        supabase_user_id: user.id,
      },
    })
    customerId = customer.id

    await supabase.auth.updateUser({
      data: { stripe_customer_id: customerId },
    })
  }

  try {
    await stripe.customers.update(customerId, {
      metadata: {
        supabase_user_id: user.id,
      },
    })
  } catch (error) {
    console.warn('[STRIPE_CHECKOUT] Failed to ensure customer metadata mapping:', error)
  }

  return customerId
}

export const resolveTrialEligibility = async (user: User, customerId: string) => {
  let hasUsedTrial = Boolean(user.user_metadata?.has_used_trial)

  if (!hasUsedTrial) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 100,
    })
    hasUsedTrial = subscriptions.data.some((subscription) =>
      Boolean(subscription.trial_end || subscription.trial_start || subscription.status === 'trialing')
    )
  }

  return hasUsedTrial
}

export const buildSubscriptionData = (
  context: CheckoutContext
): Stripe.Checkout.SessionCreateParams.SubscriptionData => ({
  metadata: {
    supabase_user_id: context.user.id,
    plan_key: context.resolvedPlanKey,
    plan_version: '2',
    ...(context.affiliateCode ? { affiliate_code: context.affiliateCode } : {}),
    ...(context.affiliateAttributionId
      ? { affiliate_attribution_id: context.affiliateAttributionId }
      : {}),
    ...(context.attributionMetadata || {}),
  },
  ...(context.planConfig.trialDays && !context.hasUsedTrial
    ? { trial_period_days: context.planConfig.trialDays }
    : {}),
})

/** Returns extra line items when the user is trial-eligible. */
export const buildTrialFeeLineItems = async (
  _context: CheckoutContext
): Promise<{
  extraLineItems: Stripe.Checkout.SessionCreateParams.LineItem[]
}> => {
  return { extraLineItems: [] }
}

export const buildCheckoutSessionMetadata = (context: CheckoutContext) => ({
  supabase_user_id: context.user.id,
  plan_key: context.resolvedPlanKey,
  plan_version: '2',
  ...(context.affiliateCode ? { affiliate_code: context.affiliateCode } : {}),
  ...(context.affiliateAttributionId
    ? { affiliate_attribution_id: context.affiliateAttributionId }
    : {}),
  ...(context.attributionMetadata || {}),
})

export const buildCheckoutContext = async (
  supabase: SupabaseClient,
  user: User,
  planKey: PlanKey
): Promise<CheckoutContext> => {
  const { resolvedPlanKey, priceId, planConfig } = resolveCheckoutPlan(planKey)
  const customerId = await ensureStripeCustomer(supabase, user)
  const hasUsedTrial = await resolveTrialEligibility(user, customerId)

  return {
    user,
    customerId,
    resolvedPlanKey,
    priceId,
    planConfig,
    hasUsedTrial,
  }
}
