import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

const isSafeInternalPath = (value: unknown): value is string => {
  if (typeof value !== 'string') return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('://')) return false
  if (value.includes('\\')) return false
  return true
}

const withCheckoutSessionPlaceholder = (origin: string, path: string) => {
  const url = new URL(path, origin)
  if (!url.searchParams.has('session_id')) {
    url.searchParams.set('session_id', '{CHECKOUT_SESSION_ID}')
  }
  return url.toString()
}

export async function POST(req: NextRequest) {
  try {
    const { planKey, successPath, cancelPath } = await req.json() as {
      planKey: PlanKey
      successPath?: string
      cancelPath?: string
    }

    if (!planKey || !(planKey in PRICE_IDS)) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const resolvedPlanKey = planKey as keyof typeof PRICE_IDS
    const priceId = PRICE_IDS[resolvedPlanKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${resolvedPlanKey}.` },
        { status: 500 }
      )
    }

    // Get current user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.user_metadata?.stripe_customer_id as string | undefined

    // Create Stripe customer if doesn't exist
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id,
        },
      })
      customerId = customer.id

      // Store customer ID in user metadata
      await supabase.auth.updateUser({
        data: { stripe_customer_id: customerId },
      })
    }

    // Ensure existing customers always map back to the Supabase user.
    // This prevents webhook mapping gaps when subscription metadata is missing.
    if (customerId) {
      try {
        await stripe.customers.update(customerId, {
          metadata: {
            supabase_user_id: user.id,
          },
        })
      } catch (error) {
        console.warn('[STRIPE_CHECKOUT] Failed to ensure customer metadata mapping:', error)
      }
    }

    // Get plan config for trial days
    const planConfig = PLAN_CONFIG[resolvedPlanKey]
    let hasUsedTrial = Boolean(user.user_metadata?.has_used_trial)

    if (!hasUsedTrial && customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'all',
        limit: 100,
      })
      hasUsedTrial = subscriptions.data.some((subscription) =>
        Boolean(subscription.trial_end || subscription.trial_start || subscription.status === 'trialing')
      )
    }
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const safeSuccessPath = isSafeInternalPath(successPath) ? successPath : undefined
    const safeCancelPath = isSafeInternalPath(cancelPath) ? cancelPath : undefined
    const resolvedSuccessUrl = safeSuccessPath
      ? withCheckoutSessionPlaceholder(origin, safeSuccessPath)
      : `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`
    const resolvedCancelUrl = safeCancelPath
      ? `${origin}${safeCancelPath}`
      : `${origin}/pricing`

    const isTrialEligible = Boolean(planConfig.trialDays) && !hasUsedTrial

    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        supabase_user_id: user.id,
        plan_key: resolvedPlanKey,
        plan_version: '2',
      },
      ...(isTrialEligible
        ? { trial_period_days: planConfig.trialDays }
        : {}),
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: subscriptionData,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        supabase_user_id: user.id,
        plan_key: resolvedPlanKey,
        plan_version: '2',
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[STRIPE_CHECKOUT] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
