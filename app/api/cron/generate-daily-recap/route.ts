import { NextRequest, NextResponse } from 'next/server'
import {
  settlePickResults,
  generateDailyRecap,
  upsertDailyRecap,
} from '@/lib/services/daily-recap'

export const dynamic = 'force-dynamic'

/**
 * GET /api/cron/generate-daily-recap
 * Settles pick results and generates daily recap for yesterday
 * Runs at 6 AM EST (11:00 UTC) daily via Vercel cron
 */
export async function GET(req: NextRequest) {
  try {
    // Verify cron secret for production security
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get yesterday's date in Eastern Time
    const now = new Date()
    const easternFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    const parts = easternFormatter.formatToParts(
      new Date(now.getTime() - 24 * 60 * 60 * 1000)
    )
    const year = parts.find((p) => p.type === 'year')?.value
    const month = parts.find((p) => p.type === 'month')?.value
    const day = parts.find((p) => p.type === 'day')?.value
    const yesterdayDate = `${year}-${month}-${day}`

    console.log(`[Cron: Daily Recap] Generating recap for ${yesterdayDate}`)

    // Step 1: Settle pick results using ESPN scores
    const settleResult = await settlePickResults(yesterdayDate)
    console.log(`[Cron: Daily Recap] Settled ${settleResult.settled} picks`)

    // Step 2: Generate the daily recap
    const recap = await generateDailyRecap(yesterdayDate)

    if (!recap) {
      console.log('[Cron: Daily Recap] No picks to recap for this date')
      return NextResponse.json({
        ok: true,
        timestamp: new Date().toISOString(),
        date: yesterdayDate,
        message: 'No picks to recap',
        settled: settleResult.settled,
      })
    }

    // Step 3: Upsert to database
    const savedRecap = await upsertDailyRecap(recap)

    if (!savedRecap) {
      console.error('[Cron: Daily Recap] Failed to save recap')
      return NextResponse.json(
        { ok: false, error: 'Failed to save recap' },
        { status: 500 }
      )
    }

    console.log(`[Cron: Daily Recap] Successfully generated recap:`, {
      date: yesterdayDate,
      record: `${recap.wins}-${recap.losses}-${recap.pushes}`,
      roi: recap.roi_percent,
      avgClv: recap.avg_clv_points,
    })

    return NextResponse.json({
      ok: true,
      timestamp: new Date().toISOString(),
      date: yesterdayDate,
      settled: settleResult.settled,
      recap: {
        record: `${recap.wins}-${recap.losses}-${recap.pushes}`,
        roiPercent: recap.roi_percent,
        avgClvPoints: recap.avg_clv_points,
        clvTier: recap.clv_tier,
        hypothetical100Profit: recap.hypothetical_100_profit,
        sports: recap.sports,
      },
    })
  } catch (error: any) {
    console.error('[Cron: Daily Recap] Fatal error:', error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    )
  }
}
