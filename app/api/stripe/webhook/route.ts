import { NextRequest, NextResponse } from 'next/server'
import { stripe, PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'
import { updateUserSubscriptionState } from '@/lib/stripe-user-subscription'
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

const resolveStripeCustomerId = (
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined
): string | null => {
  if (!customer) return null
  if (typeof customer === 'string') return customer
  if ('id' in customer && typeof customer.id === 'string') return customer.id
  return null
}

const findUserIdByCustomerIdInAuthUsers = async (
  supabase: ReturnType<typeof createServiceClient>,
  customerId: string
): Promise<string | null> => {
  const perPage = 200
  for (let page = 1; page <= 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) {
      console.warn('[STRIPE_WEBHOOK] listUsers fallback lookup failed:', error)
      return null
    }
    const users = data?.users ?? []
    if (users.length === 0) return null

    const matched = users.find(
      (user) => user.user_metadata?.stripe_customer_id === customerId
    )
    if (matched?.id) return matched.id

    if (users.length < perPage) return null
  }
  return null
}

const ensureStripeCustomerMetadata = async (
  customerId: string,
  userId: string
) => {
  try {
    await stripe.customers.update(customerId, {
      metadata: { supabase_user_id: userId },
    })
  } catch (error) {
    console.warn('[STRIPE_WEBHOOK] Failed to update customer metadata mapping:', error)
  }
}

const ensureStripeSubscriptionMetadata = async (
  subscriptionId: string,
  metadataPatch: Record<string, string>
) => {
  try {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    await stripe.subscriptions.update(subscriptionId, {
      metadata: {
        ...(subscription.metadata || {}),
        ...metadataPatch,
      },
    })
  } catch (error) {
    console.warn('[STRIPE_WEBHOOK] Failed to update subscription metadata mapping:', error)
  }
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

  // Fallback: scan auth users for stripe_customer_id in metadata.
  return findUserIdByCustomerIdInAuthUsers(supabase, customerId)
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

        const customerId = resolveStripeCustomerId(session.customer)
        let userId = session.metadata?.supabase_user_id || null
        const planKey = session.metadata?.plan_key
        const planVersionRaw = session.metadata?.plan_version
        const planVersion = Number.isFinite(Number(planVersionRaw))
          ? Number(planVersionRaw)
          : 1
        const subscriptionId = session.subscription as string

        if (!userId && customerId) {
          userId = await getUserIdFromCustomer(supabase, customerId)
        }

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

        // Update subscription metadata with mapping info for future reference
        await ensureStripeSubscriptionMetadata(subscriptionId, {
          supabase_user_id: userId,
          ...(planKey ? { plan_key: planKey } : {}),
          plan_version: String(planVersion),
        })

        if (customerId) {
          await ensureStripeCustomerMetadata(customerId, userId)
        }

        // Update user with subscription info (includes customer ID)
        await updateUserSubscriptionState(
          supabase,
          userId,
          subscription,
          planKey,
          customerId ?? undefined,
          planVersion,
        )
        console.log(`[STRIPE_WEBHOOK] Subscription created for user ${userId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveStripeCustomerId(subscription.customer)
        const userId = subscription.metadata?.supabase_user_id
        const planKey = subscription.metadata?.plan_key

        let resolvedUserId = userId || null
        if (!resolvedUserId && customerId) {
          resolvedUserId = await getUserIdFromCustomer(supabase, customerId)
        }
        if (!resolvedUserId) {
          console.error('[STRIPE_WEBHOOK] Could not find user for subscription:', subscription.id)
          return NextResponse.json({ received: true, warning: 'User not found' })
        }

        if (!subscription.metadata?.supabase_user_id) {
          await ensureStripeSubscriptionMetadata(subscription.id, {
            supabase_user_id: resolvedUserId,
            ...(planKey ? { plan_key: planKey } : {}),
          })
        }
        if (customerId) {
          await ensureStripeCustomerMetadata(customerId, resolvedUserId)
        }

        await updateUserSubscriptionState(
          supabase,
          resolvedUserId,
          subscription,
          planKey,
          customerId ?? undefined
        )

        console.log(`[STRIPE_WEBHOOK] Subscription ${event.type} for user ${resolvedUserId ?? 'unknown'}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        const customerId = resolveStripeCustomerId(subscription.customer)
        let userId = subscription.metadata?.supabase_user_id || null
        if (!userId && customerId) {
          userId = await getUserIdFromCustomer(supabase, customerId)
        }

        if (userId) {
          if (customerId) {
            await ensureStripeCustomerMetadata(customerId, userId)
          }

          await updateUserSubscriptionState(supabase, userId, subscription)
          if (subscription.latest_invoice) {
            try {
              const invoice = await stripe.invoices.retrieve(
                subscription.latest_invoice as string
              )
              if ((invoice.amount_paid || 0) > 0) {
                const { data: existingUser } = await supabase.auth.admin.getUserById(userId)
                const existingMetadata = existingUser?.user?.user_metadata || {}
                await supabase.auth.admin.updateUserById(userId, {
                  user_metadata: {
                    ...existingMetadata,
                    has_paid: true,
                  },
                })
              }
            } catch (error) {
              console.warn('[STRIPE_WEBHOOK] Failed to verify latest invoice for canceled subscription:', error)
            }
          }
          console.log(`[STRIPE_WEBHOOK] Subscription canceled for user ${userId}`)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any
        const subscriptionId = invoice.subscription as string | null

        if (subscriptionId) {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId)
          const customerId = resolveStripeCustomerId(subscription.customer)
          let userId = subscription.metadata?.supabase_user_id || null
          if (!userId && customerId) {
            userId = await getUserIdFromCustomer(supabase, customerId)
          }

          if (userId) {
            if (!subscription.metadata?.supabase_user_id) {
              await ensureStripeSubscriptionMetadata(subscription.id, {
                supabase_user_id: userId,
              })
            }
            if (customerId) {
              await ensureStripeCustomerMetadata(customerId, userId)
            }
            const { data: existingUser } = await supabase.auth.admin.getUserById(userId)
            const existingMetadata = existingUser?.user?.user_metadata || {}
            // Mark payment as failed but don't cancel yet
            await supabase.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...existingMetadata,
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
          const customerId = resolveStripeCustomerId(subscription.customer)
          let userId = subscription.metadata?.supabase_user_id || null
          if (!userId && customerId) {
            userId = await getUserIdFromCustomer(supabase, customerId)
          }

          if (userId) {
            if (!subscription.metadata?.supabase_user_id) {
              await ensureStripeSubscriptionMetadata(subscription.id, {
                supabase_user_id: userId,
              })
            }
            if (customerId) {
              await ensureStripeCustomerMetadata(customerId, userId)
            }

            await updateUserSubscriptionState(
              supabase,
              userId,
              subscription,
              subscription.metadata?.plan_key,
              customerId ?? undefined
            )
            const { data: existingUser } = await supabase.auth.admin.getUserById(userId)
            const existingMetadata = existingUser?.user?.user_metadata || {}
            await supabase.auth.admin.updateUserById(userId, {
              user_metadata: {
                ...existingMetadata,
                has_paid: true,
                has_successful_payment: true,
              },
            })
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
