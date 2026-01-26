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

const RAW_AFFILIATE_COMMISSION_RATE = Number(process.env.AFFILIATE_COMMISSION_RATE ?? '0.2')
const AFFILIATE_COMMISSION_RATE = Number.isFinite(RAW_AFFILIATE_COMMISSION_RATE)
  ? RAW_AFFILIATE_COMMISSION_RATE
  : 0.2

const resolveAffiliateRef = async (
  supabase: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<string | null> => {
  try {
    const { data } = await supabase.auth.admin.getUserById(userId)
    const ref = data?.user?.user_metadata?.affiliate_ref
    return typeof ref === 'string' && ref.length > 0 ? ref : null
  } catch (error) {
    console.warn('[STRIPE_WEBHOOK] Failed to read affiliate ref:', error)
    return null
  }
}

const isSelfReferral = async (
  supabase: ReturnType<typeof createServiceClient>,
  code: string,
  userId: string
): Promise<boolean> => {
  const { data } = await supabase
    .from('affiliates' as any)
    .select('user_id')
    .eq('code', code)
    .limit(1)
  const rows = (data ?? []) as Array<{ user_id?: string | null }>
  return Boolean(rows[0]?.user_id && rows[0].user_id === userId)
}

const upsertAffiliateAttribution = async (
  supabase: ReturnType<typeof createServiceClient>,
  payload: {
    code: string
    referred_user_id: string
    subscription_id?: string | null
    trial_end_at?: string | null
    converted_at?: string | null
    amount_cents?: number
    status: 'pending' | 'earned' | 'paid' | 'blocked'
  }
) => {
  await supabase.from('affiliate_attributions' as any).upsert(
    [
      {
        code: payload.code,
        referred_user_id: payload.referred_user_id,
        subscription_id: payload.subscription_id ?? null,
        trial_end_at: payload.trial_end_at ?? null,
        converted_at: payload.converted_at ?? null,
        amount_cents: payload.amount_cents ?? 0,
        status: payload.status,
      },
    ] as any,
    { onConflict: 'referred_user_id,subscription_id' }
  )
}

async function updateUserSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  subscription: Stripe.Subscription | null,
  planKey?: string,
  customerId?: string,
  planVersionOverride?: number
) {
  const config = planKey ? PLAN_CONFIG[planKey as PlanKey] : null
  const rawPlanVersion = subscription?.metadata?.plan_version
  const parsedPlanVersion = Number.isFinite(Number(rawPlanVersion))
    ? Number(rawPlanVersion)
    : 1
  const planVersion = planVersionOverride ?? parsedPlanVersion

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
    membership_plan_version: planVersion,
  }
  if (subscription.trial_end || subscription.trial_start || subscription.status === 'trialing') {
    metadataUpdate.has_used_trial = true
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
        const planVersionRaw = session.metadata?.plan_version
        const planVersion = Number.isFinite(Number(planVersionRaw))
          ? Number(planVersionRaw)
          : 1
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
          metadata: {
            supabase_user_id: userId,
            plan_key: planKey || '',
            plan_version: String(planVersion),
          },
        })

        // Update user with subscription info (includes customer ID)
        await updateUserSubscription(
          supabase,
          userId,
          subscription,
          planKey,
          session.customer as string,
          planVersion,
        )
        console.log(`[STRIPE_WEBHOOK] Subscription created for user ${userId}`)
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const previousStatus = (event.data as any)?.previous_attributes?.status
        const userId = subscription.metadata?.supabase_user_id
        const planKey = subscription.metadata?.plan_key

        const resolvedUserId = userId || null
        if (!resolvedUserId) {
          // Try to get from customer
          const customerId = subscription.customer as string
          const foundUserId = await getUserIdFromCustomer(supabase, customerId)
          if (!foundUserId) {
            console.error('[STRIPE_WEBHOOK] Could not find user for subscription:', subscription.id)
            return NextResponse.json({ received: true, warning: 'User not found' })
          }
          await updateUserSubscription(supabase, foundUserId, subscription, planKey)

          const affiliateRef = await resolveAffiliateRef(supabase, foundUserId)
          if (affiliateRef) {
            const isTrialing = subscription.status === 'trialing'
            const isTrialConversion =
              subscription.status === 'active' && previousStatus === 'trialing'
            if (await isSelfReferral(supabase, affiliateRef, foundUserId)) {
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: foundUserId,
                subscription_id: subscription.id,
                status: 'blocked',
              })
            } else if (isTrialing) {
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: foundUserId,
                subscription_id: subscription.id,
                trial_end_at: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000).toISOString()
                  : null,
                status: 'pending',
              })
            } else if (isTrialConversion) {
              let amountCents = 0
              if (subscription.latest_invoice) {
                const invoice = await stripe.invoices.retrieve(
                  subscription.latest_invoice as string
                )
                amountCents = Math.round(
                  (invoice.amount_paid || 0) * AFFILIATE_COMMISSION_RATE
                )
              }
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: foundUserId,
                subscription_id: subscription.id,
                converted_at: new Date().toISOString(),
                amount_cents: amountCents,
                status: 'earned',
              })
            }
          }
        } else {
          await updateUserSubscription(supabase, resolvedUserId, subscription, planKey)

          const affiliateRef = await resolveAffiliateRef(supabase, resolvedUserId)
          if (affiliateRef) {
            const isTrialing = subscription.status === 'trialing'
            const isTrialConversion =
              subscription.status === 'active' && previousStatus === 'trialing'
            if (await isSelfReferral(supabase, affiliateRef, resolvedUserId)) {
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: resolvedUserId,
                subscription_id: subscription.id,
                status: 'blocked',
              })
            } else if (isTrialing) {
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: resolvedUserId,
                subscription_id: subscription.id,
                trial_end_at: subscription.trial_end
                  ? new Date(subscription.trial_end * 1000).toISOString()
                  : null,
                status: 'pending',
              })
            } else if (isTrialConversion) {
              let amountCents = 0
              if (subscription.latest_invoice) {
                const invoice = await stripe.invoices.retrieve(
                  subscription.latest_invoice as string
                )
                amountCents = Math.round(
                  (invoice.amount_paid || 0) * AFFILIATE_COMMISSION_RATE
                )
              }
              await upsertAffiliateAttribution(supabase, {
                code: affiliateRef,
                referred_user_id: resolvedUserId,
                subscription_id: subscription.id,
                converted_at: new Date().toISOString(),
                amount_cents: amountCents,
                status: 'earned',
              })
            }
          }
        }

        console.log(`[STRIPE_WEBHOOK] Subscription ${event.type} for user ${resolvedUserId ?? 'unknown'}`)
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
            const affiliateRef = await resolveAffiliateRef(supabase, userId)
            if (affiliateRef) {
              const isTrialConversion =
                subscription.status === 'active' &&
                subscription.trial_end &&
                subscription.trial_end * 1000 <= Date.now()
              if (await isSelfReferral(supabase, affiliateRef, userId)) {
                await upsertAffiliateAttribution(supabase, {
                  code: affiliateRef,
                  referred_user_id: userId,
                  subscription_id: subscription.id,
                  status: 'blocked',
                })
              } else if (isTrialConversion) {
                const amountCents = Math.round(
                  (invoice.amount_paid || 0) * AFFILIATE_COMMISSION_RATE
                )
                await upsertAffiliateAttribution(supabase, {
                  code: affiliateRef,
                  referred_user_id: userId,
                  subscription_id: subscription.id,
                  converted_at: new Date().toISOString(),
                  amount_cents: amountCents,
                  status: 'earned',
                })
              }
            }
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
