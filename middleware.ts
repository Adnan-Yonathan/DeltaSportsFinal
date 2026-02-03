import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that don't require authentication or membership access
const PUBLIC_PATHS = [
  '/',
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/stripe/success',
]

// Public paths where paid users should be redirected to /chat
const PAID_REDIRECT_PATHS = ['/welcome', '/pricing']

const ALWAYS_PUBLIC_PREFIXES = ['/blog', '/tools', '/calculators', '/about']
const MEMBERSHIP_EXEMPT_PATHS = ['/onboarding']

const AFFILIATE_REF_COOKIE = 'affiliate_ref'
const AFFILIATE_REF_TTL = 60 * 60 * 24 * 30

// Check if path starts with any public path
const isPublicPath = (pathname: string) => {
  // All API routes handle their own auth
  if (pathname.startsWith('/api/')) return true
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))
}

const isAlwaysPublicPath = (pathname: string) =>
  ALWAYS_PUBLIC_PREFIXES.some(path => pathname === path || pathname.startsWith(path + '/'))

const isMembershipExemptPath = (pathname: string) =>
  MEMBERSHIP_EXEMPT_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))

// Check membership paid status from metadata (mirrors lib/utils/membership.ts logic)
const parseDate = (value?: string | null) => {
  if (!value || typeof value !== 'string') return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const checkMembershipPaid = (metadata: Record<string, any>): boolean => {
  const status = metadata?.membership_status
  const paidStatuses = ['active', 'trialing', 'past_due']
  const hasPaidStatus =
    Boolean(status) && paidStatuses.includes(status)
  const hasPaidFlag = Boolean(metadata?.has_paid)
  const legacyExpiresAt = parseDate(metadata?.membership_expires_at)
  const hasLegacyPaid = Boolean(legacyExpiresAt && legacyExpiresAt.getTime() > Date.now())
  const tier = typeof metadata?.membership_tier === 'string'
    ? metadata.membership_tier
    : typeof metadata?.subscription_tier === 'string'
      ? metadata.subscription_tier
      : null
  const hasTierAccess = tier === 'sharp' || tier === 'syndicate' || tier === 'unlimited' || tier === 'pro'

  if (status && !hasPaidStatus) {
    return false
  }

  return hasPaidStatus || hasPaidFlag || hasLegacyPaid || hasTierAccess
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const pathname = req.nextUrl.pathname
  const affiliateRef = req.nextUrl.searchParams.get('ref')
  if (affiliateRef) {
    res.cookies.set(AFFILIATE_REF_COOKIE, affiliateRef, {
      maxAge: AFFILIATE_REF_TTL,
      path: '/',
      sameSite: 'lax',
    })
  }

  if (isAlwaysPublicPath(pathname)) {
    return res
  }

  const supabase = createMiddlewareClient({ req, res })

  const isPaidRedirectPath = PAID_REDIRECT_PATHS.some(
    path => pathname === path || pathname.startsWith(path + '/')
  )

  // Allow public paths (but not paid-redirect paths, which need the paid check below)
  if (isPublicPath(pathname) && !isPaidRedirectPath) {
    await supabase.auth.getSession()
    return res
  }

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  // For paid-redirect paths (/welcome, /pricing), allow access if no session
  // but continue to the paid check if there IS a session
  if (isPaidRedirectPath && !session) {
    return res
  }

  // If no session, redirect to login
  if (!session) {
    const landingUrl = new URL('/welcome', req.url)
    landingUrl.searchParams.set('redirect', pathname)
    const redirect = NextResponse.redirect(landingUrl)
    if (affiliateRef) {
      redirect.cookies.set(AFFILIATE_REF_COOKIE, affiliateRef, {
        maxAge: AFFILIATE_REF_TTL,
        path: '/',
        sameSite: 'lax',
      })
    }
    return redirect
  }

  // Use session metadata from the JWT cookie (no API call).
  // If the JWT is stale (e.g. after Stripe webhook), the DB lookup below
  // will catch the updated subscription_tier as a fallback.
  const metadata = session.user?.user_metadata || {}
  let isPaid = checkMembershipPaid(metadata)
  let onboardingCompleted = Boolean(metadata?.onboarding_completed)

  if (isMembershipExemptPath(pathname)) {
    return res
  }

  try {
    const { data: userProfile } = await supabase
      .from('users')
      .select('onboarding_completed,subscription_tier')
      .eq('id', session.user.id)
      .single()
    if (userProfile?.onboarding_completed) {
      onboardingCompleted = true
    }
    if (!isPaid) {
      const tier = userProfile?.subscription_tier
      if (tier === 'pro' || tier === 'unlimited' || tier === 'sharp' || tier === 'syndicate') {
        isPaid = true
      }
    }
  } catch {
    // Ignore lookup failures and fall back to redirects below.
  }

  if (isPaid) {
    if (pathname === '/welcome' || pathname === '/pricing' || pathname === '/onboarding') {
      return NextResponse.redirect(new URL('/chat', req.url))
    }
    return res
  }

  if (!onboardingCompleted) {
    const onboardingUrl = new URL('/onboarding', req.url)
    return NextResponse.redirect(onboardingUrl)
  }

  // If not an active member, redirect to pricing
  const pricingUrl = new URL('/pricing', req.url)
  const redirect = NextResponse.redirect(pricingUrl)
  if (affiliateRef) {
    redirect.cookies.set(AFFILIATE_REF_COOKIE, affiliateRef, {
      maxAge: AFFILIATE_REF_TTL,
      path: '/',
      sameSite: 'lax',
    })
  }
  return redirect
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
}
