import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()

  try {
    const supabase = createMiddlewareClient({ req, res })

    // Refresh session if expired - required for Server Components
    await supabase.auth.getSession()

    const {
      data: { session },
    } = await supabase.auth.getSession()

    // Protected routes that require authentication
    const isProtectedRoute = req.nextUrl.pathname.startsWith('/chat')

    // Auth routes
    const isAuthRoute = req.nextUrl.pathname.startsWith('/auth/login') ||
                        req.nextUrl.pathname.startsWith('/auth/signup')

    // If user is not signed in and trying to access protected routes, redirect to login
    if (!session && isProtectedRoute) {
      const redirectUrl = new URL('/auth/login', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // If user is signed in and trying to access auth pages, redirect to chat
    if (session && isAuthRoute) {
      const redirectUrl = new URL('/chat', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    return res
  } catch (error) {
    console.error('Middleware error:', error)
    // On error, allow the request through
    return res
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
