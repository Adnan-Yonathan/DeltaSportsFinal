import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const RECAP_DISMISS_KEY = 'daily_recap_dismissed_date'

/**
 * POST /api/daily-recap/dismiss
 * Marks the current daily recap as dismissed for the authenticated user
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the recap date from the request body
    const body = await req.json().catch(() => ({}))
    const recapDate = body.recapDate

    if (!recapDate) {
      return NextResponse.json(
        { ok: false, error: 'Missing recapDate' },
        { status: 400 }
      )
    }

    // Update user metadata to mark this recap as dismissed
    const { error: updateError } = await supabase.auth.updateUser({
      data: {
        [RECAP_DISMISS_KEY]: recapDate,
      },
    })

    if (updateError) {
      console.error('[daily-recap] Failed to dismiss recap:', updateError)
      return NextResponse.json(
        { ok: false, error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      ok: true,
      dismissedDate: recapDate,
    })
  } catch (error: any) {
    console.error('[daily-recap] Failed to dismiss recap:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
