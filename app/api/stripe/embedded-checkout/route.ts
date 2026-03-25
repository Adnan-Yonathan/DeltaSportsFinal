import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, type PlanKey } from '@/lib/stripe'
import {
  buildCheckoutDiscounts,
  buildCheckoutContext,
  buildCheckoutSessionMetadata,
  buildSubscriptionData,
  buildTrialFeeLineItems,
} from '@/lib/stripe-checkout'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { planKey } = await req.json() as { planKey: PlanKey }

    // Get current user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const checkoutContext = await buildCheckoutContext(supabase, user, planKey)

    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { extraLineItems, couponId } = await buildTrialFeeLineItems(checkoutContext)
    const discounts = buildCheckoutDiscounts(couponId ?? undefined)

    // Create embedded checkout session
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      customer: checkoutContext.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: checkoutContext.priceId,
          quantity: 1,
        },
        ...extraLineItems,
      ],
      subscription_data: buildSubscriptionData(checkoutContext),
      ...(discounts ? { discounts } : {}),
      return_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: buildCheckoutSessionMetadata(checkoutContext),
    })

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('[STRIPE_EMBEDDED_CHECKOUT] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create checkout session'
    const status =
      message === 'Invalid plan'
        ? 400
        : message.startsWith('Price ID not configured')
          ? 500
          : 500
    return NextResponse.json(
      { error: message },
      { status }
    )
  }
}
