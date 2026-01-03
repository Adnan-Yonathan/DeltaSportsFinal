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
  planKey?: string,
  customerId?: string
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
  let tier: 'pro' | 'sharp' | 'syndicate' = 'pro'
  if (config) {
    tier = config.tier
  } else if (subscription.metadata?.plan_key) {
    const key = subscription.metadata.plan_key as PlanKey
    tier = PLAN_CONFIG[key]?.tier || 'pro'
  }

  // Update user metadata with subscription info
  const currentPeriodEnd = (subscription as any).current_period_end
  const cancelAt = (subscription as any).cancel_at
  const metadataUpdate: Record<string, any> = {
    membership_tier: tier,
    membership_status: subscription.status,
    stripe_subscription_id: subscription.id,
    stripe_current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
    subscription_cancel_at: cancelAt ? new Date(cancelAt * 1000).toISOString() : null,
  }

  // Include customer ID if provided
  if (customerId) {
    metadataUpdate.stripe_customer_id = customerId
  }

  console.log('[STRIPE_WEBHOOK] Updating user metadata:', { userId, metadataUpdate })

  const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: metadataUpdate,
  })

  if (updateError) {
    console.error('[STRIPE_WEBHOOK] Failed to update user metadata:', JSON.stringify(updateError, null, 2))
    throw new Error(`Failed to update user: ${updateError.message}`)
  }

  console.log('[STRIPE_WEBHOOK] Successfully updated user metadata for:', userId)
  console.log('[STRIPE_WEBHOOK] Updated user data:', JSON.stringify(updateData?.user?.user_metadata, null, 2))

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
  console.log('[STRIPE_WEBHOOK] Webhook endpoint hit')

  const body = await req.text()
  const signature = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  console.log('[STRIPE_WEBHOOK] Verification check:', {
    hasSignature: Boolean(signature),
    hasWebhookSecret: Boolean(webhookSecret),
    webhookSecretLength: webhookSecret?.length || 0,
  })

  if (!signature || !webhookSecret) {
    console.error('[STRIPE_WEBHOOK] Missing signature or webhook secret')
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    console.log('[STRIPE_WEBHOOK] Signature verified successfully, event type:', event.type)
  } catch (err) {
    console.error('[STRIPE_WEBHOOK] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (!relevantEvents.has(event.type)) {
    console.log('[STRIPE_WEBHOOK] Ignoring irrelevant event type:', event.type)
    return NextResponse.json({ received: true })
  }

  console.log('[STRIPE_WEBHOOK] Processing relevant event:', event.type)
  console.log('[STRIPE_WEBHOOK] Service role key present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)
  console.log('[STRIPE_WEBHOOK] Supabase URL present:', !!process.env.NEXT_PUBLIC_SUPABASE_URL)

  const supabase = createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log('[STRIPE_WEBHOOK] checkout.session.completed received:', {
          sessionId: session.id,
          mode: session.mode,
          metadata: session.metadata,
          subscriptionId: session.subscription,
          customerId: session.customer,
        })

        if (session.mode !== 'subscription') {
          console.log('[STRIPE_WEBHOOK] Ignoring non-subscription checkout')
          return NextResponse.json({ received: true })
        }

        const userId = session.metadata?.supabase_user_id
        const planKey = session.metadata?.plan_key
        const subscriptionId = session.subscription as string

        if (!userId || !subscriptionId) {
          console.error('[STRIPE_WEBHOOK] Missing userId or subscriptionId in checkout session:', {
            userId,
            subscriptionId,
            allMetadata: session.metadata,
          })
          return NextResponse.json({ received: true, warning: 'Missing metadata' })
        }

        // Get the subscription details
        const subscription = await stripe.subscriptions.retrieve(subscriptionId)

        // Update subscription metadata with plan key for future reference
        await stripe.subscriptions.update(subscriptionId, {
          metadata: { supabase_user_id: userId, plan_key: planKey || '' },
        })

        // Update user with subscription info (includes customer ID)
        await updateUserSubscription(supabase, userId, subscription, planKey, session.customer as string)
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
