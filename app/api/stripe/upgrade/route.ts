import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'

export const runtime = 'nodejs'

const tierRank: Record<string, number> = {
  free: 0,
  sharp: 1,
  syndicate: 2,
}

export async function POST(req: NextRequest) {
  try {
    const { planKey } = await req.json() as { planKey: PlanKey }

    if (!planKey || !PRICE_IDS[planKey]) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    const priceId = PRICE_IDS[planKey]
    if (!priceId) {
      return NextResponse.json(
        { error: `Price ID not configured for ${planKey}.` },
        { status: 500 }
      )
    }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const membership = getMembershipStatusFromMetadata(user.user_metadata)
    if (!membership.isActive || !membership.tier) {
      return NextResponse.json(
        { error: 'No active subscription to upgrade.' },
        { status: 400 }
      )
    }

    const targetTier = PLAN_CONFIG[planKey].tier
    if (tierRank[targetTier] <= tierRank[membership.tier]) {
      return NextResponse.json(
        { error: 'Requested plan is not an upgrade.' },
        { status: 400 }
      )
    }

    const customerId = user.user_metadata?.stripe_customer_id as string | undefined
    let subscriptionId = user.user_metadata?.stripe_subscription_id as string | undefined

    if (!subscriptionId && customerId) {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      })
      subscriptionId = subscriptions.data[0]?.id
    }

    if (!subscriptionId) {
      return NextResponse.json(
        { error: 'No subscription found. Please subscribe first.' },
        { status: 400 }
      )
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    const itemId = subscription.items.data[0]?.id

    if (!itemId) {
      return NextResponse.json(
        { error: 'Subscription item not found.' },
        { status: 400 }
      )
    }

    await stripe.subscriptions.update(subscriptionId, {
      items: [{ id: itemId, price: priceId }],
      proration_behavior: 'create_prorations',
      billing_cycle_anchor: 'unchanged',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[STRIPE_UPGRADE] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upgrade subscription' },
      { status: 500 }
    )
  }
}
