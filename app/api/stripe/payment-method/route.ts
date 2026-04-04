import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { stripe } from '@/lib/stripe'
import {
  persistAttributionEvent,
  persistAttributionTouches,
  resolveAttributionSnapshotFromRequest,
} from '@/lib/services/attribution'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
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
    if (!customerId) {
      return NextResponse.json({ error: 'No billing customer found.' }, { status: 400 })
    }

    const origin =
      req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const returnUrl = `${origin}/billing?payment_method_updated=1`
    const serviceSupabase = createServiceClient()
    const attributionSnapshot = resolveAttributionSnapshotFromRequest(req)
    await persistAttributionTouches(serviceSupabase as any, user.id, attributionSnapshot)
    await persistAttributionEvent(serviceSupabase as any, {
      eventName: 'stripe_portal_opened',
      snapshot: attributionSnapshot,
      userId: user.id,
      stripeCustomerId: customerId,
      landingPath: '/api/stripe/payment-method',
      metadata: {
        flow: 'payment_method_update',
      },
    })

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
      flow_data: {
        type: 'payment_method_update',
        after_completion: {
          type: 'redirect',
          redirect: {
            return_url: returnUrl,
          },
        },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[STRIPE_PAYMENT_METHOD] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to start payment method update' },
      { status: 500 }
    )
  }
}
