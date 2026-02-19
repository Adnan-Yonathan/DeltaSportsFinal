import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'

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

    if (!planKey || !PRICE_IDS[planKey]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId = PRICE_IDS[planKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${planKey}. Set STRIPE_PRICE_${planKey.toUpperCase()} env var.` },
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

    // Get plan config for trial days
    const planConfig = PLAN_CONFIG[planKey]
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
      subscription_data: planConfig.trialDays && !hasUsedTrial
        ? { trial_period_days: planConfig.trialDays }
        : undefined,
      success_url: resolvedSuccessUrl,
      cancel_url: resolvedCancelUrl,
      metadata: {
        supabase_user_id: user.id,
        plan_key: planKey,
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
