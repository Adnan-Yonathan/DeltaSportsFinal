import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

// Disable body parsing - we need raw body for signature verification
export const dynamic = 'force-dynamic'

const relevantEvents = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.payment_succeeded',
  'invoice.payment_failed',
])

async function updateUserSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  subscription: Stripe.Subscription | null,
  planKey?: string
) {
  const config = planKey ? PLAN_CONFIG[planKey as PlanKey] : null

  if (!subscription || subscription.status === 'canceled') {
    // Subscription canceled - clear membership
    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        membership_tier: null,
        membership_status: 'canceled',
        stripe_subscription_id: null,
        subscription_cancel_at: null,
      },
    })
    return
  }

  // Determine tier from plan key or existing metadata
  let tier: 'pro' | 'unlimited' = 'pro'
  if (config) {
    tier = config.tier
  } else if (subscription.metadata?.plan_key) {
    const key = subscription.metadata.plan_key as PlanKey
    tier = PLAN_CONFIG[key]?.tier || 'pro'
  }

  // Update user metadata with subscription info
  const currentPeriodEnd = (subscription as any).current_period_end
  const cancelAt = (subscription as any).cancel_at
  await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      membership_tier: tier,
      membership_status: subscription.status,
      stripe_subscription_id: subscription.id,
      stripe_current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      subscription_cancel_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
    },
  })

  // Also update users table if it exists
  const usersUpdate = supabase.from('users') as any
  await usersUpdate
    .update({
      subscription_tier: tier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
}

async function getUserIdFromCustomer(
  supabase: ReturnType<typeof createServiceClient>,
  customerId: string
): Promise<string | null> {
  // Try to get user ID from customer metadata
  const customer = await stripe.customers.retrieve(customerId)
  if (customer.deleted) return null

  const userId = (customer as Stripe.Customer).metadata?.supabase_user_id
  if (userId) return userId

  // Fallback: search users table by stripe_customer_id in metadata
  // This requires querying auth.users which we can do via admin API
  return null
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!signature || !webhookSecret) {
    console.error('[STRIPE_WEBHOOK] Missing signature or webhook secret')
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[STRIPE_WEBHOOK] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (!relevantEvents.has(event.type)) {
    return NextResponse.json({ received: true })
  }

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode !== 'subscription') {
          return NextResponse.json({ received: true })
        }

        const userId = session.metadata?.supabase_user_id
        const planKey = session.metadata?.plan_key
        const subscriptionId = session.subscription as string

        if (!userId || !subscriptionId) {
          console.error('[STRIPE_WEBHOOK] Missing userId or subscriptionId in checkout session')
          return NextResponse.json({ received: true, warning: 'Missing metadata' })
        }

        // Get the subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Update subscription metadata with plan key for future reference
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { supabase_user_id: userId, plan_key: planKey || '' },
        })

        // Store customer ID on user if not already stored
        if (session.customer) {
          await supabase.auth.admin.updateUserById(userId, {
            user_metadata: {
              stripe_customer_id: session.customer as string,
            },
          })
        }

        await updateUserSubscription(supabase, userId, subscription, planKey)
        console.log(`[STRIPE_WEBHOOK] Subscription created for user ${userId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id
        const planKey = subscription.metadata?.plan_key

        if (!userId) {
          // Try to get from customer
          const customerId = subscription.customer as string
          const foundUserId = await getUserIdFromCustomer(supabase, customerId)
          if (!foundUserId) {
            console.error('[STRIPE_WEBHOOK] Could not find user for subscription:', subscription.id)
            return NextResponse.json({ received: true, warning: 'User not found' })
          }
          await updateUserSubscription(supabase, foundUserId, subscription, planKey)
        } else {
          await updateUserSubscription(supabase, userId, subscription, planKey)
        }

        console.log(`[STRIPE_WEBHOOK] Subscription ${event.type} for user ${userId}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const userId = subscription.metadata?.supabase_user_id

        if (userId) {
          await updateUserSubscription(supabase, userId, null)
          console.log(`[STRIPE_WEBHOOK] Subscription canceled for user ${userId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string | null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.supabase_user_id

          if (userId) {
            // Mark payment as failed but don't cancel yet
            await supabase.auth.admin.updateUserById(userId, {
              user_metadata: {
                membership_status: 'past_due',
                payment_failed_at: new Date().toISOString(),
              },
            })
            console.log(`[STRIPE_WEBHOOK] Payment failed for user ${userId}`)
          }
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string | null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const userId = subscription.metadata?.supabase_user_id

          if (userId) {
            await updateUserSubscription(supabase, userId, subscription)
            console.log(`[STRIPE_WEBHOOK] Payment succeeded for user ${userId}`)
          }
        }
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[STRIPE_WEBHOOK] Error processing event:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}
