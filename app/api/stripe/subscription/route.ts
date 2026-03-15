import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBillingSnapshotForUser } from '@/lib/stripe-billing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const billing = await getBillingSnapshotForUser(user)
    return NextResponse.json({ billing })
  } catch (error) {
    console.error('[STRIPE_SUBSCRIPTION] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load subscription' },
      { status: 500 }
    )
  }
}
