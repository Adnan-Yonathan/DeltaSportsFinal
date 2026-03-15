import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveManagedSubscription } from '@/lib/stripe-billing'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { reason } = (await req.json().catch(() => ({}))) as { reason?: string }
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

    const subscription = await resolveManagedSubscription(customerId, subscriptionId)
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found.' }, { status: 404 })
    }

    if (subscription.status === 'canceled') {
      return NextResponse.json({ error: 'Subscription is already canceled.' }, { status: 400 })
    }

    if (subscription.cancel_at_period_end) {
      return NextResponse.json({ ok: true, alreadyScheduled: true })
    }

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
      metadata: {
        ...(subscription.metadata || {}),
        cancel_requested_in_app_at: new Date().toISOString(),
        ...(reason ? { cancel_reason: reason } : {}),
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[STRIPE_CANCEL] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}
