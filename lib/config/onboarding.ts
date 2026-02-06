// Onboarding gate.
// Default: enabled. Set `NEXT_PUBLIC_ONBOARDING_ENABLED=false` to disable.
export const ONBOARDING_ENABLED =
  process.env.NEXT_PUBLIC_ONBOARDING_ENABLED !== 'false'

export const FORCE_ONBOARDING =
  ONBOARDING_ENABLED && process.env.NEXT_PUBLIC_FORCE_ONBOARDING === 'true'
