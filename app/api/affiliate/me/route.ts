import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { createServiceClient } from '@/lib/supabase/service'
import { buildAffiliateReferralPath } from '@/lib/affiliate'
import { ensureAffiliateProfile } from '@/lib/services/affiliate-program'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createRouteHandlerClient<any>({ cookies })
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const serviceSupabase = createServiceClient()
    const affiliate = await ensureAffiliateProfile(serviceSupabase as any, user.id)
    const origin =
      req.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      req.nextUrl.origin ||
      'http://localhost:3000'

    return NextResponse.json({
      affiliate,
      referralPath: buildAffiliateReferralPath(affiliate.code),
      referralUrl: `${origin}${buildAffiliateReferralPath(affiliate.code)}`,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to resolve affiliate profile' },
      { status: 500 }
    )
  }
}
