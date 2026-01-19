import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getLatestDailyRecap } from '@/lib/services/daily-recap'

export const dynamic = 'force-dynamic'

const RECAP_DISMISS_KEY = 'daily_recap_dismissed_date'

/**
 * GET /api/daily-recap
 * Returns the latest daily recap with dismissal status for authenticated users
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    // Fetch the latest recap
    const recap = await getLatestDailyRecap()

    if (!recap) {
      return NextResponse.json({
        ok: true,
        recap: null,
        dismissed: false,
      })
    }

    // Check if user has dismissed this specific recap
    let dismissed = false
    if (user) {
      const dismissedDate = (user.user_metadata as Record<string, any> | null)?.[
        RECAP_DISMISS_KEY
      ]
      dismissed = dismissedDate === recap.recapDate
    }

    return NextResponse.json({
      ok: true,
      recap,
      dismissed,
    })
  } catch (error: any) {
    console.error('[daily-recap] Failed to fetch recap:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
