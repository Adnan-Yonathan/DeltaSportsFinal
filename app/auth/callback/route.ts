import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { Database } from '@/lib/supabase/types'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'

export const dynamic = 'force-dynamic'
const AFFILIATE_REF_COOKIE = 'affiliate_ref'

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
      const affiliateRef = cookies().get(AFFILIATE_REF_COOKIE)?.value
      const metadata = user.user_metadata || {}
      if (affiliateRef && !metadata.affiliate_ref) {
        await supabase.auth.updateUser({
          data: {
            affiliate_ref: affiliateRef,
            affiliate_ref_assigned_at: new Date().toISOString(),
          },
        })
      }

      const forceOnboarding =
        process.env.NEXT_PUBLIC_FORCE_ONBOARDING === 'true'
      if (forceOnboarding) {
        return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
      }

      const metadataCompleted = Boolean(
        (user.user_metadata as { onboarding_completed?: boolean })
          ?.onboarding_completed
      )

      let onboardingCompleted = metadataCompleted
      if (!onboardingCompleted) {
        const { data: profile, error } = await supabase
          .from('users')
          .select('onboarding_completed')
          .eq('id', user.id)
          .single()

        if (!error) {
          onboardingCompleted = Boolean(profile?.onboarding_completed)
        }
      }

      if (!onboardingCompleted) {
        return NextResponse.redirect(new URL('/onboarding', requestUrl.origin))
      }

      const membership = getMembershipStatusFromMetadata(user.user_metadata)
      if (!membership.isActive) {
        return NextResponse.redirect(new URL('/pricing', requestUrl.origin))
      }
    }
  }

  return NextResponse.redirect(
    new URL(redirectPath || '/', requestUrl.origin)
  )
}
