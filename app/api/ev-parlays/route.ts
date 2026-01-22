import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'
import { buildEvParlays } from '@/lib/services/ev-parlays'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const membership = getMembershipStatusFromMetadata(user?.user_metadata)
  const planVersion = membership.planVersion ?? 1
  const hasAccess = membership.isActive
    ? planVersion >= 2
      ? membership.tier === 'sharp' || membership.tier === 'syndicate'
      : true
    : false

  if (!hasAccess) {
    return NextResponse.json(
      { ok: false, error: 'Upgrade required.' },
      { status: 403 }
    )
  }

  try {
    const url = new URL(request.url)
    const maxLegOddsParam = url.searchParams.get('maxLegOdds')
    const maxLegOdds = maxLegOddsParam ? Number(maxLegOddsParam) : undefined
    const parlays = await buildEvParlays(
      Number.isFinite(maxLegOdds) ? { maxLegOdds: maxLegOdds as number } : undefined
    )

    return NextResponse.json({
      ok: true,
      updatedAt: new Date().toISOString(),
      data: parlays,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load EV parlays.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
