import type { NextRequest, NextResponse } from 'next/server'
import { normalizeAffiliateCode } from '@/lib/affiliate'

export const ATTRIBUTION_SESSION_COOKIE_NAME = 'delta_attr_sid'
export const ATTRIBUTION_FIRST_TOUCH_COOKIE_NAME = 'delta_attr_first'
export const ATTRIBUTION_LAST_TOUCH_COOKIE_NAME = 'delta_attr_last'
export const ATTRIBUTION_ACCESS_COOKIE_NAME = 'delta_attribution_access'
export const ATTRIBUTION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

export type AttributionChannel =
  | 'affiliate'
  | 'organic_search'
  | 'paid_search'
  | 'social'
  | 'referral'
  | 'email'
  | 'direct'
  | 'unknown'

export type AttributionTouch = {
  sessionId: string
  occurredAt: string
  channel: AttributionChannel
  source: string | null
  medium: string | null
  campaign: string | null
  term: string | null
  content: string | null
  referrerHost: string | null
  landingPath: string
  affiliateCode: string | null
  clickIds: Record<string, string>
}

type ParsedTouchCookies = {
  sessionId: string
  firstTouch: AttributionTouch | null
  lastTouch: AttributionTouch | null
}

type TouchKind = 'first_touch' | 'last_touch'

type TouchContext = {
  pathname: string
  host: string
  referrerHost: string | null
  utmSource: string | null
  utmMedium: string | null
  utmCampaign: string | null
  utmTerm: string | null
  utmContent: string | null
  affiliateCode: string | null
  clickIds: Record<string, string>
  explicitSource: string | null
}

const SEARCH_HOST_PATTERNS = [
  'google.',
  'google',
  'bing.com',
  'bing',
  'duckduckgo.com',
  'duckduckgo',
  'search.yahoo.com',
  'yahoo.com',
  'yahoo',
  'ecosia.org',
  'ecosia',
  'search.brave.com',
  'brave',
  'yandex.',
  'yandex',
]

const SOCIAL_HOST_PATTERNS = [
  'x.com',
  'x',
  'twitter.com',
  'twitter',
  't.co',
  'reddit.com',
  'reddit',
  'instagram.com',
  'instagram',
  'facebook.com',
  'fb.com',
  'facebook',
  'fb',
  'linkedin.com',
  'linkedin',
  'youtube.com',
  'youtube',
  'tiktok.com',
  'tiktok',
]

const EMAIL_MEDIUMS = new Set(['email', 'newsletter'])
const PAID_SEARCH_MEDIUMS = new Set(['cpc', 'ppc', 'paidsearch', 'paid_search', 'sem'])
const SOCIAL_MEDIUMS = new Set(['social', 'social_paid', 'paidsocial', 'paid_social'])

const normalize = (value: string | null | undefined) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed.length ? trimmed : null
}

const tryParseUrl = (value: string) => {
  try {
    return new URL(value)
  } catch {
    return null
  }
}

const matchesHostPattern = (value: string | null, patterns: string[]) => {
  if (!value) return false
  return patterns.some((pattern) => value === pattern || value.endsWith(`.${pattern}`) || value.includes(pattern))
}

const normalizeSourceFromReferrer = (host: string | null) => {
  if (!host) return null
  if (host.includes('google')) return 'google'
  if (host.includes('bing')) return 'bing'
  if (host.includes('duckduckgo')) return 'duckduckgo'
  if (host.includes('yahoo')) return 'yahoo'
  if (host.includes('ecosia')) return 'ecosia'
  if (host.includes('x.com') || host.includes('twitter.com') || host.includes('t.co')) return 'twitter'
  if (host.includes('reddit')) return 'reddit'
  if (host.includes('instagram')) return 'instagram'
  if (host.includes('facebook') || host.includes('fb.com')) return 'facebook'
  if (host.includes('linkedin')) return 'linkedin'
  if (host.includes('youtube')) return 'youtube'
  if (host.includes('tiktok')) return 'tiktok'
  return host
}

const toCookieValue = (touch: AttributionTouch) => encodeURIComponent(JSON.stringify(touch))

const parseTouchCookie = (value: string | undefined): AttributionTouch | null => {
  if (!value) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(value)) as Partial<AttributionTouch>
    if (!parsed || typeof parsed !== 'object') return null
    if (typeof parsed.sessionId !== 'string' || typeof parsed.occurredAt !== 'string') return null
    if (typeof parsed.channel !== 'string' || typeof parsed.landingPath !== 'string') return null
    return {
      sessionId: parsed.sessionId,
      occurredAt: parsed.occurredAt,
      channel: parsed.channel as AttributionChannel,
      source: typeof parsed.source === 'string' ? parsed.source : null,
      medium: typeof parsed.medium === 'string' ? parsed.medium : null,
      campaign: typeof parsed.campaign === 'string' ? parsed.campaign : null,
      term: typeof parsed.term === 'string' ? parsed.term : null,
      content: typeof parsed.content === 'string' ? parsed.content : null,
      referrerHost: typeof parsed.referrerHost === 'string' ? parsed.referrerHost : null,
      landingPath: parsed.landingPath,
      affiliateCode: typeof parsed.affiliateCode === 'string' ? parsed.affiliateCode : null,
      clickIds: parsed.clickIds && typeof parsed.clickIds === 'object'
        ? Object.fromEntries(
            Object.entries(parsed.clickIds).filter(
              ([key, item]) => typeof key === 'string' && typeof item === 'string'
            )
          )
        : {},
    }
  } catch {
    return null
  }
}

const shouldTrackRequest = (req: NextRequest) => {
  if (req.method !== 'GET') return false
  const pathname = req.nextUrl.pathname
  if (pathname.startsWith('/_next/')) return false
  if (pathname.startsWith('/api/')) return false
  if (pathname.startsWith('/favicon')) return false
  if (/\.(?:css|js|map|ico|png|jpg|jpeg|gif|svg|webp|woff2?|ttf)$/i.test(pathname)) return false

  const destination = req.headers.get('sec-fetch-dest')
  if (!destination) return true
  return destination === 'document' || destination === 'empty'
}

const buildClickIds = (req: NextRequest) => {
  const searchParams = req.nextUrl.searchParams
  const candidates = ['gclid', 'fbclid', 'ttclid', 'msclkid'] as const
  const output: Record<string, string> = {}
  for (const key of candidates) {
    const value = normalize(searchParams.get(key))
    if (!value) continue
    output[key] = value
  }
  return output
}

const resolveReferrerHost = (req: NextRequest) => {
  const rawReferrer = req.headers.get('referer') || req.headers.get('referrer')
  if (!rawReferrer) return null
  const parsed = tryParseUrl(rawReferrer)
  if (!parsed) return null

  const refHost = normalize(parsed.hostname)
  const host = normalize(req.nextUrl.host)
  if (!refHost || !host) return null
  return refHost === host ? null : refHost
}

const resolveAffiliateCodeFromPath = (pathname: string) => {
  if (!pathname.startsWith('/a/')) return null
  const segments = pathname.split('/').filter(Boolean)
  if (segments.length < 2) return null
  return normalizeAffiliateCode(segments[1])
}

const deriveTouchContext = (req: NextRequest): TouchContext => {
  const searchParams = req.nextUrl.searchParams
  const pathname = req.nextUrl.pathname
  const explicitSource = normalize(searchParams.get('source'))
  const utmSource = normalize(searchParams.get('utm_source'))
  const utmMedium = normalize(searchParams.get('utm_medium'))

  return {
    pathname,
    host: normalize(req.nextUrl.host) || '',
    referrerHost: resolveReferrerHost(req),
    utmSource,
    utmMedium,
    utmCampaign: normalize(searchParams.get('utm_campaign')),
    utmTerm: normalize(searchParams.get('utm_term')),
    utmContent: normalize(searchParams.get('utm_content')),
    affiliateCode:
      normalizeAffiliateCode(searchParams.get('aff')) ||
      normalizeAffiliateCode(searchParams.get('affiliate')) ||
      resolveAffiliateCodeFromPath(pathname),
    clickIds: buildClickIds(req),
    explicitSource,
  }
}

const resolveChannelAndSource = (context: TouchContext): {
  channel: AttributionChannel
  source: string | null
} => {
  if (context.affiliateCode || context.explicitSource === 'affiliate') {
    return { channel: 'affiliate', source: context.affiliateCode || 'affiliate' }
  }

  if (context.utmMedium && EMAIL_MEDIUMS.has(context.utmMedium)) {
    return { channel: 'email', source: context.utmSource || 'email' }
  }

  if (context.utmMedium && PAID_SEARCH_MEDIUMS.has(context.utmMedium)) {
    return { channel: 'paid_search', source: context.utmSource || 'paid_search' }
  }

  if (context.utmMedium && SOCIAL_MEDIUMS.has(context.utmMedium)) {
    return { channel: 'social', source: context.utmSource || 'social' }
  }

  if (context.clickIds.gclid || context.clickIds.msclkid) {
    return {
      channel: 'paid_search',
      source: context.clickIds.gclid ? 'google_ads' : 'microsoft_ads',
    }
  }

  if (context.clickIds.fbclid || context.clickIds.ttclid) {
    return {
      channel: 'social',
      source: context.clickIds.fbclid ? 'facebook' : 'tiktok',
    }
  }

  const normalizedSource = normalize(context.utmSource)
  if (normalizedSource) {
    if (matchesHostPattern(normalizedSource, SOCIAL_HOST_PATTERNS)) {
      return { channel: 'social', source: normalizedSource }
    }
    if (matchesHostPattern(normalizedSource, SEARCH_HOST_PATTERNS)) {
      return { channel: 'organic_search', source: normalizedSource }
    }
    return { channel: 'referral', source: normalizedSource }
  }

  if (context.referrerHost) {
    if (matchesHostPattern(context.referrerHost, SEARCH_HOST_PATTERNS)) {
      return {
        channel: 'organic_search',
        source: normalizeSourceFromReferrer(context.referrerHost),
      }
    }
    if (matchesHostPattern(context.referrerHost, SOCIAL_HOST_PATTERNS)) {
      return {
        channel: 'social',
        source: normalizeSourceFromReferrer(context.referrerHost),
      }
    }

    return {
      channel: 'referral',
      source: normalizeSourceFromReferrer(context.referrerHost),
    }
  }

  return { channel: 'direct', source: null }
}

const buildTouchFromRequest = (req: NextRequest, sessionId: string): AttributionTouch => {
  const context = deriveTouchContext(req)
  const resolved = resolveChannelAndSource(context)

  return {
    sessionId,
    occurredAt: new Date().toISOString(),
    channel: resolved.channel,
    source: resolved.source,
    medium: context.utmMedium,
    campaign: context.utmCampaign,
    term: context.utmTerm,
    content: context.utmContent,
    referrerHost: context.referrerHost,
    landingPath: context.pathname,
    affiliateCode: context.affiliateCode,
    clickIds: context.clickIds,
  }
}

const touchesDiffer = (left: AttributionTouch | null, right: AttributionTouch) => {
  if (!left) return true
  return (
    left.channel !== right.channel ||
    left.source !== right.source ||
    left.medium !== right.medium ||
    left.campaign !== right.campaign ||
    left.term !== right.term ||
    left.content !== right.content ||
    left.referrerHost !== right.referrerHost ||
    left.landingPath !== right.landingPath ||
    left.affiliateCode !== right.affiliateCode ||
    JSON.stringify(left.clickIds) !== JSON.stringify(right.clickIds)
  )
}

const isMeaningfulTouch = (touch: AttributionTouch) => {
  if (touch.channel !== 'direct') return true
  if (touch.affiliateCode) return true
  if (touch.campaign || touch.medium || touch.source) return true
  if (touch.referrerHost) return true
  return false
}

export const parseAttributionTouchCookies = (req: NextRequest): ParsedTouchCookies => {
  const firstTouch = parseTouchCookie(req.cookies.get(ATTRIBUTION_FIRST_TOUCH_COOKIE_NAME)?.value)
  const lastTouch = parseTouchCookie(req.cookies.get(ATTRIBUTION_LAST_TOUCH_COOKIE_NAME)?.value)
  const existingSessionId = req.cookies.get(ATTRIBUTION_SESSION_COOKIE_NAME)?.value
  const sessionId = existingSessionId || firstTouch?.sessionId || lastTouch?.sessionId || crypto.randomUUID()

  return {
    sessionId,
    firstTouch,
    lastTouch,
  }
}

export const applyAttributionCookies = (req: NextRequest, response: NextResponse) => {
  if (!shouldTrackRequest(req)) return response

  const parsed = parseAttributionTouchCookies(req)
  const currentTouch = buildTouchFromRequest(req, parsed.sessionId)

  const nextFirstTouch = parsed.firstTouch || currentTouch
  const shouldUpdateLast = touchesDiffer(parsed.lastTouch, currentTouch)

  if (!parsed.sessionId || req.cookies.get(ATTRIBUTION_SESSION_COOKIE_NAME)?.value !== parsed.sessionId) {
    response.cookies.set(ATTRIBUTION_SESSION_COOKIE_NAME, parsed.sessionId, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
    })
  }

  if (!parsed.firstTouch) {
    response.cookies.set(ATTRIBUTION_FIRST_TOUCH_COOKIE_NAME, toCookieValue(nextFirstTouch), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
    })
  }

  if (shouldUpdateLast && (isMeaningfulTouch(currentTouch) || !parsed.lastTouch)) {
    response.cookies.set(ATTRIBUTION_LAST_TOUCH_COOKIE_NAME, toCookieValue(currentTouch), {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: ATTRIBUTION_COOKIE_MAX_AGE_SECONDS,
    })
  }

  return response
}

const touchFromMetadata = (prefix: 'attr_first' | 'attr_last' | 'attr', metadata: Record<string, string>) => {
  const channel = normalize(metadata[`${prefix}_channel`]) as AttributionChannel | null
  if (!channel) return null

  return {
    sessionId: normalize(metadata.attr_session_id) || 'unknown',
    occurredAt: new Date().toISOString(),
    channel,
    source: normalize(metadata[`${prefix}_source`]),
    medium: normalize(metadata[`${prefix}_medium`]),
    campaign: normalize(metadata[`${prefix}_campaign`]),
    term: normalize(metadata[`${prefix}_term`]),
    content: normalize(metadata[`${prefix}_content`]),
    referrerHost: normalize(metadata[`${prefix}_referrer_host`]),
    landingPath: metadata[`${prefix}_landing_path`] || '/',
    affiliateCode: normalize(metadata[`${prefix}_affiliate_code`]),
    clickIds: {},
  } as AttributionTouch
}

export const resolveTouchesFromStripeMetadata = (metadata: Record<string, string>) => ({
  model: normalize(metadata.attr_model) || 'last_non_direct',
  sessionId: normalize(metadata.attr_session_id),
  selectedTouch: touchFromMetadata('attr', metadata),
  firstTouch: touchFromMetadata('attr_first', metadata),
  lastTouch: touchFromMetadata('attr_last', metadata),
})

export const mapTouchToRecord = (touchKind: TouchKind, userId: string, touch: AttributionTouch) => ({
  session_id: touch.sessionId,
  user_id: userId,
  touch_kind: touchKind,
  channel: touch.channel,
  source: touch.source,
  medium: touch.medium,
  campaign: touch.campaign,
  term: touch.term,
  content: touch.content,
  referrer_host: touch.referrerHost,
  landing_path: touch.landingPath,
  affiliate_code: touch.affiliateCode,
  click_ids: touch.clickIds,
  occurred_at: touch.occurredAt,
  updated_at: new Date().toISOString(),
})

