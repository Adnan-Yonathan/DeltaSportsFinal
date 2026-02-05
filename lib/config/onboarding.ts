// Temporary A/B test: disable onboarding flow on Feb 5, 2026.
export const ONBOARDING_ENABLED = false

export const FORCE_ONBOARDING =
  ONBOARDING_ENABLED && process.env.NEXT_PUBLIC_FORCE_ONBOARDING === 'true'
