import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { AFFILIATE_COOKIE_NAME, normalizeAffiliateCode } from '@/lib/affiliate'

type AffiliateRecord = {
  id: string
  user_id: string
  code: string
  status: string
}

type AffiliateAttributionRecord = {
  id: string
  code: string
  referred_user_id: string
  subscription_id: string | null
  status: string
}

const isUniqueViolation = (error: any) =>
  error?.code === '23505' || String(error?.message ?? '').toLowerCase().includes('duplicate')

export const buildDefaultAffiliateCode = (userId: string) =>
  `aff_${String(userId).replace(/-/g, '').slice(0, 12).toLowerCase()}`

export const ensureAffiliateProfile = async (
  supabase: SupabaseClient,
  userId: string
): Promise<AffiliateRecord> => {
  const db = supabase as any
  const { data: existing, error: existingError } = await db
    .from('affiliates')
    .select('id,user_id,code,status')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    throw new Error(existingError.message || 'Failed to load affiliate profile')
  }
  if (existing) return existing as AffiliateRecord

  const baseCode = buildDefaultAffiliateCode(userId)
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = attempt === 0 ? baseCode : `${baseCode}${attempt}`
    const { data, error } = await db
      .from('affiliates')
      .insert({
        user_id: userId,
        code,
        status: 'active',
      })
      .select('id,user_id,code,status')
      .single()

    if (!error && data) return data as AffiliateRecord
    if (isUniqueViolation(error)) continue
    throw new Error(error?.message || 'Failed to create affiliate profile')
  }

  const { data: fallback, error: fallbackError } = await db
    .from('affiliates')
    .select('id,user_id,code,status')
    .eq('user_id', userId)
    .maybeSingle()

  if (fallbackError || !fallback) {
    throw new Error(fallbackError?.message || 'Failed to resolve affiliate profile')
  }
  return fallback as AffiliateRecord
}

export const resolveAffiliateCodeFromRequest = (req: NextRequest): string | null => {
  const queryCode = normalizeAffiliateCode(req.nextUrl.searchParams.get('aff'))
  if (queryCode) return queryCode
  const cookieCode = normalizeAffiliateCode(req.cookies.get(AFFILIATE_COOKIE_NAME)?.value)
  return cookieCode
}

type PrepareAffiliateAttributionInput = {
  supabase: SupabaseClient
  referredUserId: string
  affiliateCode: string
  subscriptionId?: string | null
  stripeCustomerId?: string | null
  subscriberStatus?: string | null
}

export const prepareAffiliateAttribution = async ({
  supabase,
  referredUserId,
  affiliateCode,
  subscriptionId = null,
  stripeCustomerId = null,
  subscriberStatus = null,
}: PrepareAffiliateAttributionInput): Promise<AffiliateAttributionRecord | null> => {
  const db = supabase as any
  const code = normalizeAffiliateCode(affiliateCode)
  if (!code) return null

  const { data: affiliate, error: affiliateError } = await db
    .from('affiliates')
    .select('id,user_id,code,status')
    .eq('code', code)
    .maybeSingle()

  if (affiliateError || !affiliate) return null
  if (affiliate.status !== 'active') return null
  if (affiliate.user_id === referredUserId) return null

  const now = new Date().toISOString()
  const payload: Record<string, unknown> = {
    code,
    referred_user_id: referredUserId,
    status: 'pending',
  }
  if (subscriptionId) payload.subscription_id = subscriptionId
  if (stripeCustomerId) payload.stripe_customer_id = stripeCustomerId
  if (subscriberStatus) payload.subscriber_status = subscriberStatus
  if (subscriptionId || stripeCustomerId || subscriberStatus) {
    payload.attribution_locked_at = now
  }

  const { data, error } = await db
    .from('affiliate_attributions')
    .upsert(payload, { onConflict: 'referred_user_id' })
    .select('id,code,referred_user_id,subscription_id,status')
    .single()

  if (error || !data) {
    console.warn('[AFFILIATE] Failed to prepare attribution:', error)
    return null
  }

  return data as AffiliateAttributionRecord
}
