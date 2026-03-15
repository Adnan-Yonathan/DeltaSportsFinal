import type Stripe from 'stripe'
import { PLAN_CONFIG, type PlanKey } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase/service'

const parseBoolean = (value: unknown): boolean => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    return ['true', '1', 'yes', 'y', 't'].includes(normalized)
  }
  return false
}

const normalizeTier = (value: unknown): 'sharp' | 'syndicate' | null => {
  if (value === 'syndicate') return 'syndicate'
  if (value === 'sharp' || value === 'pro') return 'sharp'
  return null
}

const toIsoFromUnix = (value: unknown): string | null => {
  if (!Number.isFinite(Number(value))) return null
  return new Date(Number(value) * 1000).toISOString()
}

export async function updateUserSubscriptionState(
  supabase: ReturnType<typeof createServiceClient>,
  userId: string,
  subscription: Stripe.Subscription | null,
  planKey?: string,
  customerId?: string,
  planVersionOverride?: number
) {
  const { data: existingUser } = await supabase.auth.admin.getUserById(userId)
  const existingMetadata = existingUser?.user?.user_metadata || {}
  const legacyHasPaid = parseBoolean(existingMetadata?.has_paid)
  const existingStatus =
    typeof existingMetadata?.membership_status === 'string'
      ? existingMetadata.membership_status
      : null
  const existingHasSuccessfulPayment =
    parseBoolean(existingMetadata?.has_successful_payment) ||
    (legacyHasPaid && existingStatus !== 'trialing')
  const config = planKey ? PLAN_CONFIG[planKey as PlanKey] : null
  const rawPlanVersion = subscription?.metadata?.plan_version
  const parsedPlanVersion = Number.isFinite(Number(rawPlanVersion))
    ? Number(rawPlanVersion)
    : 1
  const planVersion = planVersionOverride ?? parsedPlanVersion
  let tier = config?.tier as 'sharp' | 'syndicate' | undefined

  if (!tier && subscription?.metadata?.plan_key) {
    const key = subscription.metadata.plan_key as PlanKey
    const configTier = PLAN_CONFIG[key]?.tier
    tier = configTier === 'syndicate' ? 'syndicate' : 'sharp'
  }

  if (!tier) {
    tier = normalizeTier(existingMetadata?.membership_tier) ?? undefined
  }

  if (!subscription || subscription.status === 'canceled') {
    const now = Date.now()
    const currentPeriodEndIso = subscription
      ? toIsoFromUnix((subscription as any).current_period_end)
      : typeof existingMetadata?.stripe_current_period_end === 'string'
        ? existingMetadata.stripe_current_period_end
        : null
    const currentPeriodEndMs = currentPeriodEndIso ? new Date(currentPeriodEndIso).getTime() : NaN
    const legacyExpiresAtRaw = existingMetadata?.membership_expires_at
    const legacyExpiresAtMs =
      typeof legacyExpiresAtRaw === 'string' ? new Date(legacyExpiresAtRaw).getTime() : NaN
    const hasRemainingAccess =
      (Number.isFinite(currentPeriodEndMs) && currentPeriodEndMs > now) ||
      (Number.isFinite(legacyExpiresAtMs) && legacyExpiresAtMs > now)
    const effectiveTier = hasRemainingAccess ? (tier ?? null) : null
    const cancelAtIso = subscription
      ? toIsoFromUnix((subscription as any).cancel_at ?? (subscription as any).canceled_at)
      : typeof existingMetadata?.subscription_cancel_at === 'string'
        ? existingMetadata.subscription_cancel_at
        : null

    const metadataUpdate: Record<string, unknown> = {
      membership_tier: effectiveTier,
      membership_status: 'canceled',
      stripe_subscription_id: subscription?.id ?? null,
      stripe_current_period_end: currentPeriodEndIso,
      subscription_cancel_at: cancelAtIso,
      membership_plan_version: planVersion,
      has_paid: existingHasSuccessfulPayment,
      has_successful_payment: existingHasSuccessfulPayment,
      ...(customerId ? { stripe_customer_id: customerId } : {}),
      ...(existingMetadata?.payment_failed_at ? { payment_failed_at: null } : {}),
    }

    await supabase.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...existingMetadata,
        ...metadataUpdate,
      },
    })

    const { error: canceledUsersTableError } = await (supabase.from('users') as any)
      .update({
        subscription_tier: effectiveTier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (canceledUsersTableError) {
      console.error(
        '[STRIPE_SUBSCRIPTION_SYNC] Failed to update users table for canceled subscription:',
        JSON.stringify(canceledUsersTableError, null, 2)
      )
    }
    return
  }

  const resolvedTier: 'sharp' | 'syndicate' = tier ?? 'sharp'
  const currentPeriodEnd = (subscription as any).current_period_end
  const cancelAt = (subscription as any).cancel_at
  const previousStatus = existingMetadata?.membership_status
  const metadataUpdate: Record<string, unknown> = {
    membership_tier: resolvedTier,
    membership_status: subscription.status,
    stripe_subscription_id: subscription.id,
    stripe_current_period_end: currentPeriodEnd
      ? new Date(currentPeriodEnd * 1000).toISOString()
      : null,
    subscription_cancel_at: cancelAt
      ? new Date(cancelAt * 1000).toISOString()
      : null,
    membership_plan_version: planVersion,
    has_paid: existingHasSuccessfulPayment,
    has_successful_payment: existingHasSuccessfulPayment,
  }

  if (subscription.trial_end || subscription.trial_start || subscription.status === 'trialing') {
    metadataUpdate.has_used_trial = true
  }

  if (subscription.status === 'past_due') {
    metadataUpdate.payment_failed_at =
      typeof existingMetadata?.payment_failed_at === 'string' &&
      previousStatus === 'past_due'
        ? existingMetadata.payment_failed_at
        : new Date().toISOString()
  } else if (existingMetadata?.payment_failed_at) {
    metadataUpdate.payment_failed_at = null
  }

  if (customerId) {
    metadataUpdate.stripe_customer_id = customerId
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: {
      ...existingMetadata,
      ...metadataUpdate,
    },
  })

  if (updateError) {
    console.error(
      '[STRIPE_SUBSCRIPTION_SYNC] Failed to update user metadata:',
      JSON.stringify(updateError, null, 2)
    )
    throw new Error(`Failed to update user: ${updateError.message}`)
  }

  const { error: usersTableError } = await (supabase.from('users') as any)
    .update({
      subscription_tier: resolvedTier,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (usersTableError) {
    console.error(
      '[STRIPE_SUBSCRIPTION_SYNC] Failed to update users table:',
      JSON.stringify(usersTableError, null, 2)
    )
  }
}
