import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PRICE_IDS, type PlanKey, stripe } from '@/lib/stripe'
import { resolveManagedSubscription } from '@/lib/stripe-billing'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { planKey } = (await req.json()) as { planKey?: PlanKey }

    if (!planKey || !(planKey in PRICE_IDS)) {
      return NextResponse.json({ error: 'Invalid plan.' }, { status: 400 })
    }

    const priceId = PRICE_IDS[planKey]
    if (!priceId) {
      return NextResponse.json({ error: 'Price is not configured for that plan.' }, { status: 500 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerId = user.user_metadata?.stripe_customer_id as string | undefined
    const subscriptionId = user.user_metadata?.stripe_subscription_id as string | undefined

    if (!customerId) {
      return NextResponse.json({ error: 'No active billing customer found.' }, { status: 400 })
    }

    const subscription = await resolveManagedSubscription(customerId, subscriptionId)
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found.' }, { status: 404 })
    }

    if (subscription.status === 'trialing') {
      return NextResponse.json(
        { error: 'Plan changes are disabled while a trial is active.' },
        { status: 400 }
      )
    }

    const item = subscription.items.data[0]
    if (!item) {
      return NextResponse.json({ error: 'Subscription item not found.' }, { status: 400 })
    }

    if (item.price.id === priceId) {
      return NextResponse.json({ error: 'You are already on that plan.' }, { status: 400 })
    }

    await stripe.subscriptions.update(subscription.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: 'create_prorations',
      billing_cycle_anchor: 'unchanged',
      metadata: {
        ...(subscription.metadata || {}),
        plan_key: planKey,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[STRIPE_CHANGE_PLAN] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to change plan' },
      { status: 500 }
    )
  }
}
