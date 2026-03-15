import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRetentionCouponId, resolveManagedSubscription } from '@/lib/stripe-billing'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(_req: NextRequest) {
  try {
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
      return NextResponse.json({ error: 'No billing customer found.' }, { status: 400 })
    }

    const couponId = await getRetentionCouponId()
    if (!couponId) {
      return NextResponse.json({ error: 'Retention offer is not configured.' }, { status: 500 })
    }

    const subscription = await resolveManagedSubscription(customerId, subscriptionId)
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found.' }, { status: 404 })
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json({ error: 'Canceled subscriptions cannot receive this offer.' }, { status: 400 })
    }

    if (subscription.discounts?.length) {
      return NextResponse.json({ error: 'This subscription already has a discount applied.' }, { status: 400 })
    }

    await stripe.subscriptions.update(subscription.id, {
      discounts: [{ coupon: couponId }],
      proration_behavior: 'none',
      metadata: {
        ...(subscription.metadata || {}),
        retention_offer_coupon: couponId,
        retention_offer_applied_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[STRIPE_RETENTION_OFFER] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to apply retention offer' },
      { status: 500 }
    )
  }
}
