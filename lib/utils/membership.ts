export type MembershipTier = 'pro' | 'unlimited'

export const MEMBERSHIP_DURATION_DAYS = 7

const parseDate = (value: unknown): Date | null => {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export const getMembershipStatus = (metadata: any) => {
  if (process.env.NODE_ENV !== 'production') {
    const devExpiresAt = new Date()
    devExpiresAt.setFullYear(devExpiresAt.getFullYear() + 10)
    return {
      tier: 'unlimited' as MembershipTier,
      expiresAt: devExpiresAt,
      isActive: true,
    }
  }

  const tier =
    metadata && typeof metadata.membership_tier === 'string'
      ? (metadata.membership_tier as MembershipTier)
      : null
  const expiresAt = parseDate(metadata?.membership_expires_at)
  const isActive = Boolean(tier) && Boolean(expiresAt) && expiresAt!.getTime() > Date.now()

  return {
    tier,
    expiresAt,
    isActive,
  }
}
