import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Pages that don't require authentication
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/signup',
  '/auth/callback',
  '/pricing',
  '/onboarding',
  '/chat', // Chat page handles its own guest/member logic
]

// Check if path starts with any public path
const isPublicPath = (pathname: string) => {
  // All API routes handle their own auth
  if (pathname.startsWith('/api/')) return true
  return PUBLIC_PATHS.some(path => pathname === path || pathname.startsWith(path + '/'))
}

// Check membership status from metadata (mirrors lib/utils/membership.ts logic)
const checkMembershipActive = (metadata: Record<string, any>): boolean => {
  const tier = metadata?.membership_tier
  const status = metadata?.membership_status

  // Check modern status-based membership
  if (tier && status) {
    const activeStatuses = ['active', 'trialing', 'past_due']
    return activeStatuses.includes(status)
  }

  // Legacy support: check expiration date if no status but has tier
  if (tier && !status) {
    const expiresAt = metadata?.membership_expires_at
    if (expiresAt) {
      const expDate = new Date(expiresAt)
      return !isNaN(expDate.getTime()) && expDate.getTime() > Date.now()
    }
  }

  return false
}

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  const pathname = req.nextUrl.pathname

  // Allow public paths and API routes (except protected ones)
  if (isPublicPath(pathname)) {
    await supabase.auth.getSession()
    return res
  }

  // Get session
  const { data: { session } } = await supabase.auth.getSession()

  // If no session, redirect to login
  if (!session) {
    const loginUrl = new URL('/auth/login', req.url)
    loginUrl.searchParams.set('redirect', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Check membership status from user metadata
  const metadata = session.user?.user_metadata || {}
  const isActive = checkMembershipActive(metadata)

  // If not an active member, redirect to pricing
  if (!isActive) {
    const pricingUrl = new URL('/pricing', req.url)
    return NextResponse.redirect(pricingUrl)
  }

  return res
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)',
  ],
}
