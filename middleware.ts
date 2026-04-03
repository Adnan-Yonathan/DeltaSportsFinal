import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import {
  canAccessPrecheckoutOnboarding,
  PRECHECKOUT_ONBOARDING_COOKIE,
  PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED,
  shouldStartPrecheckoutOnboarding,
} from '@/lib/trial-flow'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'
import { applyAttributionCookies } from '@/lib/attribution'

// Pages that don't require authentication or membership access
const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/stripe/success',
  '/checkout',
]

// Public paths where we still need to inspect the session when one exists.
const SESSION_AWARE_PUBLIC_PATHS = ['/welcome', '/pricing', '/checkout']

const ALWAYS_PUBLIC_PREFIXES = [
  '/a',
  '/blog',
  '/tools',
  '/calculators',
  '/about',
  '/socials',
  '/privacy-policy',
  '/terms-of-service',
  '/refund-policy',
  '/sharp-betting-tools',
  '/oddsjam-alternative',
  '/vs',
  '/line-shopping',
  '/player-prop-odds',
  '/live-scores',
  '/market-projections',
  '/sharp-props',
  '/odds-screen',
  '/attribution',
]

const TOOL_ROUTE_TO_GUIDE: Array<{ toolPrefix: string; guidePath: string }> = [
  { toolPrefix: '/market-projections', guidePath: '/tools/sharp-projections' },
  { toolPrefix: '/sharp-props', guidePath: '/tools/sharp-props' },
  { toolPrefix: '/sharp-detector', guidePath: '/tools/whale-feed' },
  { toolPrefix: '/research', guidePath: '/tools/research-mode' },
  { toolPrefix: '/polymarket-insider', guidePath: '/tools/insider-feed' },
]

const PAST_DUE_GRACE_PERIOD_MS = 3 * 24 * 60 * 60 * 1000

// Check if path starts with any public path
const isPublicPath = (pathname: string) => {
  // All API routes handle their own auth
  if (pathname.startsWith('/api/')) return true
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))
}

const isAlwaysPublicPath = (pathname: string) =>
  ALWAYS_PUBLIC_PREFIXES.some(path => pathname === path || pathname.startsWith(path + '/'))

const resolveGuidePathForToolRoute = (pathname: string) => {
  const match = TOOL_ROUTE_TO_GUIDE.find(
    ({ toolPrefix }) => pathname === toolPrefix || pathname.startsWith(`${toolPrefix}/`)
  )
  return match?.guidePath ?? null
}

// Check membership paid status from metadata (mirrors lib/utils/membership.ts logic)
const parseDate = (value?: string | null) => {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const parseBoolean = (value: unknown) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'y', 't'].includes(value.trim().toLowerCase())
  }
  return false
}

const checkMembershipPaid = (metadata: Record<string, any>): boolean => {
  const status = typeof metadata?.membership_status === 'string'
    ? metadata.membership_status
    : null
  const hasPaidFlag = parseBoolean(metadata?.has_paid)
  const legacyExpiresAt = parseDate(metadata?.membership_expires_at)
  const hasLegacyPaid = Boolean(legacyExpiresAt && legacyExpiresAt.getTime() > Date.now())

  if (status === 'active' || status === 'trialing') {
    return true
  }
  if (status === 'past_due') {
    const paymentFailedAt = parseDate(metadata?.payment_failed_at)
    const currentPeriodEnd = parseDate(metadata?.stripe_current_period_end)
    const anchor = paymentFailedAt || currentPeriodEnd
    if (!anchor) return false
    return Date.now() <= anchor.getTime() + PAST_DUE_GRACE_PERIOD_MS
  }
  if (status === 'canceled') {
    const currentPeriodEnd = parseDate(metadata?.stripe_current_period_end)
    return Boolean(
      (currentPeriodEnd && currentPeriodEnd.getTime() > Date.now()) ||
      hasLegacyPaid
    )
  }
  if (status) {
    return false
  }

  const tier = typeof metadata?.membership_tier === 'string'
    ? metadata.membership_tier
    : typeof metadata?.subscription_tier === 'string'
      ? metadata.subscription_tier
      : null
  const hasTierAccess =
    tier === 'sharp' || tier === 'syndicate' || tier === 'unlimited' || tier === 'pro'

  return hasPaidFlag || hasLegacyPaid || hasTierAccess
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  const isAffiliatePath = pathname === '/affiliate' || pathname.startsWith('/affiliate/')
  const guidePathForToolRoute = resolveGuidePathForToolRoute(pathname)
  const withAttribution = (response: NextResponse) => applyAttributionCookies(req, response)
  const isPrefetchRequest =
    req.headers.get('purpose') === 'prefetch' ||
    req.headers.has('next-router-prefetch')

  // Avoid caching auth redirects from speculative prefetch requests.
  // Actual navigations still go through the full auth/membership checks below.
  if (isPrefetchRequest) {
    return withAttribution(res)
  }

  if (isAlwaysPublicPath(pathname)) {
    return withAttribution(res)
  }

  const isSessionAwarePublicPath = SESSION_AWARE_PUBLIC_PATHS.some(
    path => pathname === path || pathname.startsWith(path + '/')
  )

  // Allow public paths (but not session-aware public paths, which need the auth check below)
  if (isPublicPath(pathname) && !isSessionAwarePublicPath) {
    return withAttribution(res)
  }

  const supabase = createMiddlewareClient({ req, res })

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  // For session-aware public paths (/welcome, /pricing, /checkout), allow access if no session
  // but continue to the auth and membership checks if there IS a session.
  if (isSessionAwarePublicPath && !session) {
    return withAttribution(res)
  }

  // If no session, redirect to login
  if (!session) {
    if (guidePathForToolRoute) {
      const guideUrl = new URL(guidePathForToolRoute, req.url)
      return withAttribution(NextResponse.redirect(guideUrl))
    }

    const landingUrl = new URL('/welcome', req.url)
    landingUrl.searchParams.set('redirect', pathname)
    return withAttribution(NextResponse.redirect(landingUrl))
  }

  // Use session metadata from the JWT cookie (no API call).
  // If the JWT is stale (e.g. after Stripe webhook), the DB lookup below
  // will catch the updated subscription_tier as a fallback.
  const metadata = session.user?.user_metadata || {}
  const hasCompletedOnboardingCookie =
    req.cookies.get(PRECHECKOUT_ONBOARDING_COOKIE)?.value === PRECHECKOUT_ONBOARDING_COOKIE_COMPLETED
  const effectiveMetadata = hasCompletedOnboardingCookie
    ? { ...metadata, precheckout_onboarding_completed: true }
    : metadata
  let isPaid = checkMembershipPaid(effectiveMetadata)

  try {
    const { data: userProfile } = await supabase
      .from('users')
      .select('subscription_tier')
      .eq('id', session.user.id)
      .single()
    const hasAuthoritativeStatus =
      typeof effectiveMetadata?.membership_status === 'string' &&
      effectiveMetadata.membership_status.length > 0
    if (!isPaid && !hasAuthoritativeStatus) {
      const tier = userProfile?.subscription_tier
      if (tier === 'pro' || tier === 'unlimited' || tier === 'sharp' || tier === 'syndicate') {
        isPaid = true
      }
    }
  } catch {
    // Ignore lookup failures and fall back to redirects below.
  }

  const membership = {
    ...getMembershipStatusFromMetadata(effectiveMetadata),
    hasPaidAccess: isPaid,
  }

  const isTrialOnboardingPath =
    pathname === '/trial-onboarding' || pathname.startsWith('/trial-onboarding/')
  if (isTrialOnboardingPath) {
    if (isPaid) {
      return withAttribution(NextResponse.redirect(new URL('/', req.url)))
    }
    if (canAccessPrecheckoutOnboarding(membership, effectiveMetadata)) {
      return withAttribution(res)
    }
    return withAttribution(NextResponse.redirect(new URL('/checkout', req.url)))
  }

  if (isAffiliatePath) {
    return withAttribution(res)
  }

  if (shouldStartPrecheckoutOnboarding(membership, effectiveMetadata)) {
    return withAttribution(NextResponse.redirect(new URL('/trial-onboarding', req.url)))
  }

  const isOnboardingPath = pathname === '/onboarding' || pathname.startsWith('/onboarding/')
  if (isOnboardingPath) {
    if (!isPaid) {
      return withAttribution(NextResponse.redirect(new URL('/checkout', req.url)))
    }
    return withAttribution(res)
  }

  if (isPaid) {
    if (pathname === '/welcome' || pathname === '/pricing') {
      return withAttribution(NextResponse.redirect(new URL('/chat', req.url)))
    }
    return withAttribution(res)
  }

  if (guidePathForToolRoute) {
    return withAttribution(NextResponse.redirect(new URL(guidePathForToolRoute, req.url)))
  }

  // If they cancel checkout or choose not to continue, let them stay on the landing page.
  if (pathname === '/welcome') {
    return withAttribution(res)
  }

  // Unpaid users can stay on pricing or checkout.
  if (!isPaid && (pathname.startsWith('/pricing') || pathname.startsWith('/checkout'))) {
    return withAttribution(res)
  }

  // If not an active member, redirect to pricing
  const pricingUrl = new URL('/pricing', req.url)
  return withAttribution(NextResponse.redirect(pricingUrl))
}

export const config = {
  matcher: [
    // Match all paths except static files and public SEO resources
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|PNG|JPG|JPEG|GIF|SVG|ICO|WEBP)$).*)',
  ],
}
