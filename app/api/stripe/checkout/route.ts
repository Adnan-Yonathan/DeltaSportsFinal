import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, PRICE_IDS, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const { planKey } = await req.json() as { planKey: PlanKey }

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
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
      subscription_data: planConfig.trialDays
        ? { trial_period_days: planConfig.trialDays }
        : undefined,
      success_url: `${origin}/stripe/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/pricing`,
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
