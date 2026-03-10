import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'

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
  const redirectPath = requestUrl.searchParams.get('redirect')

  if (code) {
    const supabase = createRouteHandlerClient<Database>({ cookies })
    await supabase.auth.exchangeCodeForSession(code)
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      // Resolve paid access (auth metadata first, then public.users.subscription_tier as a fallback).
      let membership = getMembershipStatusFromMetadata(user.user_metadata)
      const isPaidNow = (info: typeof membership) =>
        info.hasPaidAccess

      if (!isPaidNow(membership) && !membership.status) {
        const { data: profile, error } = await supabase
          .from('users')
          .select('subscription_tier')
          .eq('id', user.id)
          .single()

        const tier = profile?.subscription_tier
        if (!error && (tier === 'pro' || tier === 'unlimited' || tier === 'sharp' || tier === 'syndicate')) {
          const normalizedTier =
            tier === 'unlimited' ? 'syndicate' : tier === 'pro' ? 'sharp' : tier
          await supabase.auth.updateUser({
            data: {
              membership_tier: normalizedTier,
              membership_status: 'active',
              has_paid: true,
            },
          })
          membership = getMembershipStatusFromMetadata({
            ...user.user_metadata,
            membership_tier: normalizedTier,
            membership_status: 'active',
            has_paid: true,
          })
        }
      }

      // Route only by paid access.
      if (!isPaidNow(membership)) {
        return NextResponse.redirect(new URL('/checkout', requestUrl.origin))
      }

      return NextResponse.redirect(new URL('/', requestUrl.origin))
    }
  }

  return NextResponse.redirect(
    new URL(redirectPath || '/', requestUrl.origin)
  )
}
