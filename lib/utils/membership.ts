export type MembershipTier = 'pro' | 'unlimited'
export type MembershipStatus = 'active' | 'trialing' | 'past_due' | 'canceled' | 'unpaid' | 'incomplete' | 'incomplete_expired' | 'paused'

const parseDate = (value: unknown): Date | null => {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export interface MembershipInfo {
  tier: MembershipTier | null
  status: MembershipStatus | null
  isActive: boolean
  isTrial: boolean
  currentPeriodEnd: Date | null
  cancelAt: Date | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
}

const resolveMembershipStatus = (metadata: any): MembershipInfo => {
  const tier =
    metadata && typeof metadata.membership_tier === 'string'
      ? (metadata.membership_tier as MembershipTier)
      : null

  const status =
    metadata && typeof metadata.membership_status === 'string'
      ? (metadata.membership_status as MembershipStatus)
      : null

  const currentPeriodEnd = parseDate(metadata?.stripe_current_period_end)
  const cancelAt = parseDate(metadata?.subscription_cancel_at)
  const stripeCustomerId = metadata?.stripe_customer_id || null
  const stripeSubscriptionId = metadata?.stripe_subscription_id || null

  // Active statuses: 'active' and 'trialing' allow full access
  // 'past_due' allows access but should show warning
  const activeStatuses: MembershipStatus[] = ['active', 'trialing', 'past_due']
  const isActive = Boolean(tier) && Boolean(status) && activeStatuses.includes(status!)

  // Legacy support: check expiration date if no status but has tier
  // This handles old subscriptions that used expiration dates
  if (!status && tier) {
    const expiresAt = parseDate(metadata?.membership_expires_at)
    const legacyActive = Boolean(expiresAt) && expiresAt!.getTime() > Date.now()
    return {
      tier,
      status: legacyActive ? 'active' : 'canceled',
      isActive: legacyActive,
      isTrial: false,
      currentPeriodEnd: expiresAt,
      cancelAt: null,
      stripeCustomerId,
      stripeSubscriptionId,
    }
  }

  return {
    tier,
    status,
    isActive,
    isTrial: status === 'trialing',
    currentPeriodEnd,
    cancelAt,
    stripeCustomerId,
    stripeSubscriptionId,
  }
}

export const getMembershipStatus = (metadata: any): MembershipInfo => {
  // In development, grant unlimited access for easier testing
  if (process.env.NODE_ENV !== 'production') {
    const devExpiresAt = new Date()
    devExpiresAt.setFullYear(devExpiresAt.getFullYear() + 10)
    return {
      tier: 'unlimited',
      status: 'active',
      isActive: true,
      isTrial: false,
      currentPeriodEnd: devExpiresAt,
      cancelAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    }
  }

  return resolveMembershipStatus(metadata)
}

export const getMembershipStatusFromMetadata = (metadata: any): MembershipInfo =>
  resolveMembershipStatus(metadata)

// Helper to check if user should see payment warning
export const shouldShowPaymentWarning = (metadata: any): boolean => {
  const membership = getMembershipStatus(metadata)
  return membership.status === 'past_due'
}

// Helper to check if subscription is set to cancel
export const isSubscriptionCanceling = (metadata: any): boolean => {
  const membership = getMembershipStatus(metadata)
  return membership.isActive && membership.cancelAt !== null
}
