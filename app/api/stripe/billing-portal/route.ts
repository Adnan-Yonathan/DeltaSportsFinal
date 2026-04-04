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

type PortalFlow = 'payment_method_update' | 'portal_home'

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

    const { flow } = (await req.json().catch(() => ({ flow: 'payment_method_update' }))) as {
      flow?: PortalFlow
    }

    const origin =
      req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const serviceSupabase = createServiceClient()
    const attributionSnapshot = resolveAttributionSnapshotFromRequest(req)
    await persistAttributionTouches(serviceSupabase as any, user.id, attributionSnapshot)
    await persistAttributionEvent(serviceSupabase as any, {
      eventName: 'stripe_portal_opened',
      snapshot: attributionSnapshot,
      userId: user.id,
      stripeCustomerId: customerId,
      landingPath: '/api/stripe/billing-portal',
      metadata: {
        flow: flow || 'payment_method_update',
      },
    })

    // Requires STRIPE_SECRET_KEY plus the Stripe Billing Portal feature enabled in the dashboard.
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/billing`,
      ...(flow === 'portal_home'
        ? {}
        : {
            flow_data: {
              type: 'payment_method_update',
              after_completion: {
                type: 'redirect',
                redirect: {
                  return_url: `${origin}/billing?payment_method_updated=1`,
                },
              },
            },
          }),
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('[STRIPE_BILLING_PORTAL] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create billing portal session' },
      { status: 500 }
    )
  }
}
