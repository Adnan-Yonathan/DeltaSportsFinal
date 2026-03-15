import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveManagedSubscription } from '@/lib/stripe-billing'
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

    const subscription = await resolveManagedSubscription(customerId, subscriptionId)
    if (!subscription) {
      return NextResponse.json({ error: 'No subscription found.' }, { status: 404 })
    }

    if (!subscription.cancel_at_period_end) {
      return NextResponse.json({ ok: true, alreadyActive: true })
    }

    await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: false,
      metadata: {
        ...(subscription.metadata || {}),
        cancel_requested_in_app_at: '',
      },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[STRIPE_RESUME] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resume subscription' },
      { status: 500 }
    )
  }
}
