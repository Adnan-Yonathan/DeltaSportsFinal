import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, type PlanKey } from '@/lib/stripe'
import {
  buildCheckoutContext,
  buildCheckoutSessionMetadata,
  buildSubscriptionData,
  buildTrialFeeLineItems,
} from '@/lib/stripe-checkout'
import { createServiceClient } from '@/lib/supabase/service'
import {
  prepareAffiliateAttribution,
  resolveAffiliateCodeFromRequest,
} from '@/lib/services/affiliate-program'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { planKey } = await req.json() as { planKey: PlanKey }

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const checkoutContext = await buildCheckoutContext(supabase, user, planKey)
    const affiliateCode = resolveAffiliateCodeFromRequest(req)
    let affiliateContext: {
      affiliateCode?: string | null
      affiliateAttributionId?: string | null
    } = {}

    if (affiliateCode) {
      const serviceSupabase = createServiceClient()
      const attribution = await prepareAffiliateAttribution({
        supabase: serviceSupabase as any,
        referredUserId: user.id,
        affiliateCode,
        subscriberStatus: 'pending',
      })
      if (attribution) {
        affiliateContext = {
          affiliateCode: attribution.code,
          affiliateAttributionId: attribution.id,
        }
      }
    }

    const checkoutContextWithAffiliate = {
      ...checkoutContext,
      ...affiliateContext,
    }
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const { extraLineItems } = await buildTrialFeeLineItems(checkoutContext)

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'custom',
      customer: checkoutContext.customerId,
      mode: 'subscription',
      line_items: [
        {
          price: checkoutContext.priceId,
          quantity: 1,
        },
        ...extraLineItems,
      ],
      subscription_data: buildSubscriptionData(checkoutContextWithAffiliate),
      return_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      metadata: buildCheckoutSessionMetadata(checkoutContextWithAffiliate),
    })

    if (!session.client_secret) {
      return NextResponse.json({ error: 'Stripe did not return a client secret' }, { status: 500 })
    }

    return NextResponse.json({ clientSecret: session.client_secret })
  } catch (error) {
    console.error('[STRIPE_CUSTOM_CHECKOUT] Error:', error)
    const message = error instanceof Error ? error.message : 'Failed to create checkout session'
    const status =
      message === 'Invalid plan'
        ? 400
        : message.startsWith('Price ID not configured')
          ? 500
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
