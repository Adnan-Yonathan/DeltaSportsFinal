export type MembershipTier = 'free' | 'sharp' | 'syndicate'
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
  hasUsedTrial: boolean
  hasPaidAccess: boolean
  hasProjectionAccess: boolean
  hasResearchAccess: boolean
  hasFullAccess: boolean
  currentPeriodEnd: Date | null
  cancelAt: Date | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  planVersion: number
}

const resolveMembershipStatus = (metadata: any): MembershipInfo => {
  const rawTier = metadata && typeof metadata.membership_tier === 'string'
    ? String(metadata.membership_tier)
    : null
  const tier =
    rawTier === 'sharp' || rawTier === 'syndicate'
      ? (rawTier as MembershipTier)
      : rawTier === 'pro' || rawTier === 'free'
        ? 'free'
        : null

  const status =
    metadata && typeof metadata.membership_status === 'string'
      ? (metadata.membership_status as MembershipStatus)
      : null

  const currentPeriodEnd = parseDate(metadata?.stripe_current_period_end)
  const cancelAt = parseDate(metadata?.subscription_cancel_at)
  const stripeCustomerId = metadata?.stripe_customer_id || null
  const stripeSubscriptionId = metadata?.stripe_subscription_id || null
  const planVersionRaw = metadata?.membership_plan_version
  const hasUsedTrial = Boolean(metadata?.has_used_trial)
  const planVersion = Number.isFinite(Number(planVersionRaw))
    ? Number(planVersionRaw)
    : 1
  const legacyExpiresAt = parseDate(metadata?.membership_expires_at)
  const hasLegacyPaid = Boolean(legacyExpiresAt)

  const fullAccessStatuses: MembershipStatus[] = ['active', 'trialing']
  const isFullAccessStatus =
    Boolean(status) && fullAccessStatuses.includes(status as MembershipStatus)

  // Active statuses: 'active' and 'trialing' allow full access
  // 'past_due' allows access but should show warning
  const activeStatuses: MembershipStatus[] = ['active', 'trialing', 'past_due']
  const isActive =
    Boolean(status) &&
    activeStatuses.includes(status as MembershipStatus) &&
    (Boolean(tier) || isFullAccessStatus)
  const paidStatuses: MembershipStatus[] = ['active', 'trialing', 'past_due']
  const hasPaidStatus =
    Boolean(status) && paidStatuses.includes(status as MembershipStatus)
  const hasPaidAccess =
    Boolean(metadata?.has_paid) || hasPaidStatus || hasLegacyPaid
  const hasProjectionAccess = hasPaidAccess
  const hasResearchAccess = hasPaidAccess && tier === 'syndicate'
  const hasFullAccess = hasPaidAccess

  const effectiveTier = tier

  // Legacy support: check expiration date if no status but has tier
  // This handles old subscriptions that used expiration dates
  if (!status && tier) {
    const legacyActive = Boolean(legacyExpiresAt) && legacyExpiresAt!.getTime() > Date.now()
    const legacyHasPaid = Boolean(legacyExpiresAt)
    return {
      tier,
      status: legacyActive ? 'active' : 'canceled',
      isActive: legacyActive,
      isTrial: false,
      hasUsedTrial,
      hasPaidAccess: legacyHasPaid,
      hasProjectionAccess: legacyHasPaid,
      hasResearchAccess: legacyHasPaid && tier === 'syndicate',
      hasFullAccess: legacyHasPaid,
      currentPeriodEnd: legacyExpiresAt,
      cancelAt: null,
      stripeCustomerId,
      stripeSubscriptionId,
      planVersion,
    }
  }

  return {
    tier: effectiveTier,
    status,
    isActive,
    isTrial: status === 'trialing',
    hasUsedTrial,
    hasPaidAccess,
    hasProjectionAccess,
    hasResearchAccess,
    hasFullAccess,
    currentPeriodEnd,
    cancelAt,
    stripeCustomerId,
    stripeSubscriptionId,
    planVersion,
  }
}

export const getMembershipStatus = (metadata: any): MembershipInfo => {
  // In development, grant full access for easier testing
  if (process.env.NODE_ENV !== 'production') {
    const devExpiresAt = new Date()
    devExpiresAt.setFullYear(devExpiresAt.getFullYear() + 10)
    return {
      tier: 'syndicate',
      status: 'active',
      isActive: true,
      isTrial: false,
      hasUsedTrial: false,
      hasPaidAccess: true,
      hasProjectionAccess: true,
      hasResearchAccess: true,
      hasFullAccess: true,
      currentPeriodEnd: devExpiresAt,
      cancelAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      planVersion: 2,
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
