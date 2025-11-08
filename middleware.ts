import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // If user is not signed in and trying to access protected routes, redirect to login
  if (!session && (req.nextUrl.pathname.startsWith('/chat') || req.nextUrl.pathname.startsWith('/api'))) {
    // Allow public API routes if needed
    if (req.nextUrl.pathname.startsWith('/api/')) {
      return res
    }

    return NextResponse.redirect(new URL('/auth/login', req.url))
  }

  // If user is signed in and trying to access auth pages, redirect to chat
  if (session && (req.nextUrl.pathname.startsWith('/auth/login') || req.nextUrl.pathname.startsWith('/auth/signup'))) {
    return NextResponse.redirect(new URL('/chat', req.url))
  }

  return res
}

export const config = {
  matcher: ['/chat/:path*', '/api/:path*', '/auth/:path*'],
}
