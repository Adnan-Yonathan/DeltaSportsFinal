import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that don't require authentication
const PUBLIC_PATHS = [
  '/',
  '/blog',
  '/about',
  '/calculators',
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/pricing',
  '/tools',
  '/onboarding',
  '/chat', // Chat page handles its own guest/member logic
  '/affiliate',
  '/admin/affiliates',
]

const ALWAYS_PUBLIC_PREFIXES = ['/blog', '/tools', '/calculators', '/about', '/slate']

const SOFT_GATED_PATHS = [
  '/sharp-detector',
  '/market-projections',
  '/player-projections',
  '/player-prop-odds',
  '/parlay-predictor',
  '/ev-bets',
  '/line-shopping',
  '/research',
  '/stats',
  '/live-projections',
  '/live-scores',
]

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

const isSoftGatedPath = (pathname: string) =>
  SOFT_GATED_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))

// Check membership paid status from metadata (mirrors lib/utils/membership.ts logic)
const checkMembershipPaid = (metadata: Record<string, any>): boolean => {
  const status = metadata?.membership_status
  const paidStatuses = ['active', 'past_due']
  const hasPaidStatus =
    Boolean(status) && paidStatuses.includes(status)
  const hasPaidFlag = Boolean(metadata?.has_paid)
  const hasLegacyPaid = Boolean(metadata?.membership_expires_at)

  return hasPaidFlag || hasPaidStatus || hasLegacyPaid
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

  // Allow public paths, API routes, and soft-gated pages that handle their own access UI
  if (isPublicPath(pathname) || isSoftGatedPath(pathname)) {
    await supabase.auth.getSession()
    return res
  }

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  // If no session, redirect to login
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    const redirect = NextResponse.redirect(loginUrl)
    if (affiliateRef) {
      redirect.cookies.set(AFFILIATE_REF_COOKIE, affiliateRef, {
        maxAge: AFFILIATE_REF_TTL,
        path: '/',
        sameSite: 'lax',
      })
    }
    return redirect
  }

  // Check membership status from user metadata
  const metadata = session.user?.user_metadata || {}
  const isPaid = checkMembershipPaid(metadata)

  // If not an active member, redirect to pricing
  if (!isPaid) {
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

  return res
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
}
