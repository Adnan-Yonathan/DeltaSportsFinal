export const AFFILIATE_COOKIE_NAME = 'delta_affiliate_code'
export const AFFILIATE_SESSION_COOKIE_NAME = 'delta_affiliate_session'
export const AFFILIATE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

const AFFILIATE_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/i

export const normalizeAffiliateCode = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (!AFFILIATE_CODE_PATTERN.test(normalized)) return null
  return normalized
}

export const buildAffiliateReferralPath = (code: string) => `/a/${encodeURIComponent(code)}`
