import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createRouteHandlerClient<Database>({ cookies })
  const { event, session } = await request.json()

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    await supabase.auth.setSession(session)
  }

  if (event === 'SIGNED_OUT') {
    await supabase.auth.signOut()
  }

  return NextResponse.json({ success: true })
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')

  if (code) {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
