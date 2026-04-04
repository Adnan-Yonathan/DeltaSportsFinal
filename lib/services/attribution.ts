import type { NextRequest } from 'next/server'
import type Stripe from 'stripe'
import {
  ATTRIBUTION_FIRST_TOUCH_COOKIE_NAME,
  ATTRIBUTION_LAST_TOUCH_COOKIE_NAME,
  ATTRIBUTION_SESSION_COOKIE_NAME,
  type AttributionTouch,
  parseAttributionTouchCookies,
  resolveTouchesFromStripeMetadata,
  mapTouchToRecord,
} from '@/lib/attribution'

export type AttributionSnapshot = {
  sessionId: string | null
  touchModel: 'first_touch' | 'last_touch' | 'last_non_direct'
  selectedTouch: AttributionTouch | null
  firstTouch: AttributionTouch | null
  lastTouch: AttributionTouch | null
}

export type AttributionEventName = 'page_view' | 'stripe_portal_opened'

const toStripeString = (value: string | null | undefined, fallback = '') => {
  if (!value) return fallback
  return value.slice(0, 500)
}

const touchToMetadata = (
  prefix: 'attr' | 'attr_first' | 'attr_last',
  touch: AttributionTouch | null
): Record<string, string> => {
  if (!touch) return {}
  const base: Record<string, string> = {
    [`${prefix}_channel`]: toStripeString(touch.channel, 'unknown'),
    [`${prefix}_landing_path`]: toStripeString(touch.landingPath, '/'),
  }
  const optionalEntries: Array<[string, string | null]> = [
    [`${prefix}_source`, touch.source],
    [`${prefix}_medium`, touch.medium],
    [`${prefix}_campaign`, touch.campaign],
    [`${prefix}_term`, touch.term],
    [`${prefix}_content`, touch.content],
    [`${prefix}_referrer_host`, touch.referrerHost],
    [`${prefix}_affiliate_code`, touch.affiliateCode],
  ]
  for (const [key, value] of optionalEntries) {
    if (!value) continue
    base[key] = toStripeString(value)
  }
  return base
}

const chooseLastNonDirectTouch = (firstTouch: AttributionTouch | null, lastTouch: AttributionTouch | null) => {
  if (lastTouch && lastTouch.channel !== 'direct') return lastTouch
  if (firstTouch && firstTouch.channel !== 'direct') return firstTouch
  return lastTouch || firstTouch
}

export const resolveAttributionSnapshotFromRequest = (req: NextRequest): AttributionSnapshot => {
  const parsed = parseAttributionTouchCookies(req)

  const selectedTouch = chooseLastNonDirectTouch(parsed.firstTouch, parsed.lastTouch)

  return {
    sessionId: parsed.sessionId || null,
    touchModel: 'last_non_direct',
    selectedTouch,
    firstTouch: parsed.firstTouch,
    lastTouch: parsed.lastTouch,
  }
}

export const buildCheckoutAttributionMetadata = (snapshot: AttributionSnapshot): Record<string, string> => {
  if (!snapshot.selectedTouch) return {}

  const metadata: Record<string, string> = {
    attr_model: snapshot.touchModel,
    ...touchToMetadata('attr', snapshot.selectedTouch),
    ...touchToMetadata('attr_first', snapshot.firstTouch),
    ...touchToMetadata('attr_last', snapshot.lastTouch),
  }
  if (snapshot.sessionId) {
    metadata.attr_session_id = toStripeString(snapshot.sessionId)
  }
  return metadata
}

export const persistAttributionTouches = async (
  supabase: any,
  userId: string | null | undefined,
  snapshot: AttributionSnapshot
) => {
  if (!snapshot.sessionId) return
  const db = supabase as any

  const rows: Array<Record<string, unknown>> = []
  if (snapshot.firstTouch) {
    rows.push(mapTouchToRecord('first_touch', userId, snapshot.firstTouch))
  }
  if (snapshot.lastTouch) {
    rows.push(mapTouchToRecord('last_touch', userId, snapshot.lastTouch))
  }

  if (!rows.length) return

  const { error } = await db
    .from('attribution_touches')
    .upsert(rows, { onConflict: 'session_id,touch_kind' })

  if (error) {
    console.warn('[ATTRIBUTION] Failed to persist attribution touches:', error)
  }
}

export const persistAttributionEvent = async (
  supabase: any,
  params: {
    eventName: AttributionEventName
    snapshot: AttributionSnapshot
    userId?: string | null
    stripeCustomerId?: string | null
    landingPath?: string | null
    metadata?: Record<string, unknown>
  }
) => {
  const db = supabase as any
  if (!params.snapshot.sessionId) return

  const touch = params.snapshot.selectedTouch || params.snapshot.lastTouch || params.snapshot.firstTouch
  const occurredAt = new Date().toISOString()
  const payload: Record<string, unknown> = {
    session_id: params.snapshot.sessionId,
    user_id: params.userId ?? null,
    event_name: params.eventName,
    stripe_customer_id: params.stripeCustomerId ?? null,
    channel: touch?.channel || 'unknown',
    source: touch?.source || null,
    medium: touch?.medium || null,
    campaign: touch?.campaign || null,
    term: touch?.term || null,
    content: touch?.content || null,
    referrer_host: touch?.referrerHost || null,
    landing_path: params.landingPath || touch?.landingPath || '/',
    affiliate_code: touch?.affiliateCode || null,
    metadata: {
      touch_model: params.snapshot.touchModel,
      ...(params.metadata || {}),
    },
    occurred_at: occurredAt,
    created_at: occurredAt,
  }

  const { error } = await db.from('attribution_events').insert(payload)
  if (error) {
    console.warn('[ATTRIBUTION] Failed to persist attribution event:', error)
  }
}

const fallbackTouchFromDb = async (supabase: any, sessionId: string | null) => {
  if (!sessionId) return { firstTouch: null, lastTouch: null }
  const db = supabase as any
  const { data, error } = await db
    .from('attribution_touches')
    .select('touch_kind,channel,source,medium,campaign,term,content,referrer_host,landing_path,affiliate_code,occurred_at,session_id,click_ids')
    .eq('session_id', sessionId)

  if (error || !Array.isArray(data)) {
    if (error) {
      console.warn('[ATTRIBUTION] Failed loading fallback touches:', error)
    }
    return { firstTouch: null, lastTouch: null }
  }

  const toTouch = (row: any): AttributionTouch => ({
    sessionId: String(row.session_id || sessionId),
    occurredAt: String(row.occurred_at || new Date().toISOString()),
    channel: String(row.channel || 'unknown') as AttributionTouch['channel'],
    source: row.source ? String(row.source) : null,
    medium: row.medium ? String(row.medium) : null,
    campaign: row.campaign ? String(row.campaign) : null,
    term: row.term ? String(row.term) : null,
    content: row.content ? String(row.content) : null,
    referrerHost: row.referrer_host ? String(row.referrer_host) : null,
    landingPath: row.landing_path ? String(row.landing_path) : '/',
    affiliateCode: row.affiliate_code ? String(row.affiliate_code) : null,
    clickIds: row.click_ids && typeof row.click_ids === 'object'
      ? (Object.fromEntries(
          Object.entries(row.click_ids).filter(([key, value]) => typeof key === 'string' && typeof value === 'string')
        ) as Record<string, string>)
      : {},
  })

  const first = data.find((row: any) => row.touch_kind === 'first_touch')
  const last = data.find((row: any) => row.touch_kind === 'last_touch')

  return {
    firstTouch: first ? toTouch(first) : null,
    lastTouch: last ? toTouch(last) : null,
  }
}

export const upsertTrialAttributionFromCheckoutSession = async (
  supabase: any,
  params: {
    userId: string
    session: Stripe.Checkout.Session
    subscriptionStatus: string | null
    stripeCustomerId: string | null
  }
) => {
  const db = supabase as any
  const metadata = Object.fromEntries(
    Object.entries(params.session.metadata || {}).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
  ) as Record<string, string>

  const parsed = resolveTouchesFromStripeMetadata(metadata)
  let firstTouch = parsed.firstTouch
  let lastTouch = parsed.lastTouch
  let selectedTouch = parsed.selectedTouch

  if (!firstTouch || !lastTouch || !selectedTouch) {
    const fallback = await fallbackTouchFromDb(supabase, parsed.sessionId)
    firstTouch = firstTouch || fallback.firstTouch
    lastTouch = lastTouch || fallback.lastTouch
    selectedTouch = selectedTouch || chooseLastNonDirectTouch(firstTouch, lastTouch)
  }

  if (!selectedTouch) return

  const nowIso = new Date().toISOString()
  const payload: Record<string, unknown> = {
    user_id: params.userId,
    checkout_session_id: params.session.id,
    stripe_customer_id: params.stripeCustomerId,
    subscription_id: typeof params.session.subscription === 'string' ? params.session.subscription : null,
    trial_started_at: nowIso,
    trial_status: params.subscriptionStatus || 'pending',
    touch_model: parsed.model || 'last_non_direct',
    channel: selectedTouch.channel,
    source: selectedTouch.source,
    medium: selectedTouch.medium,
    campaign: selectedTouch.campaign,
    term: selectedTouch.term,
    content: selectedTouch.content,
    referrer_host: selectedTouch.referrerHost,
    landing_path: selectedTouch.landingPath,
    affiliate_code: metadata.affiliate_code || selectedTouch.affiliateCode,
    affiliate_attribution_id: metadata.affiliate_attribution_id || null,
    first_touch: firstTouch,
    last_touch: lastTouch,
    metadata: {
      checkout_mode: params.session.mode,
      payment_status: params.session.payment_status || null,
      source_cookies: {
        first: ATTRIBUTION_FIRST_TOUCH_COOKIE_NAME,
        last: ATTRIBUTION_LAST_TOUCH_COOKIE_NAME,
        session: ATTRIBUTION_SESSION_COOKIE_NAME,
      },
    },
    updated_at: nowIso,
  }

  const { error } = await db
    .from('trial_attributions')
    .upsert(payload, { onConflict: 'checkout_session_id' })

  if (error) {
    console.warn('[ATTRIBUTION] Failed upserting trial attribution from checkout session:', error)
  }
}

export const syncTrialAttributionStatusBySubscription = async (
  supabase: any,
  params: {
    subscriptionId: string
    status: string
    stripeCustomerId?: string | null
  }
) => {
  const db = supabase as any
  const patch: Record<string, unknown> = {
    trial_status: params.status,
    updated_at: new Date().toISOString(),
  }

  if (params.stripeCustomerId) {
    patch.stripe_customer_id = params.stripeCustomerId
  }

  const { error } = await db
    .from('trial_attributions')
    .update(patch)
    .eq('subscription_id', params.subscriptionId)

  if (error) {
    console.warn('[ATTRIBUTION] Failed syncing trial attribution status:', error)
  }
}

