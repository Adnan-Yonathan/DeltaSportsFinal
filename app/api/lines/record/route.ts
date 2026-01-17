import { NextRequest, NextResponse } from 'next/server'
import { recordCurrentLines, markOpeningLines } from '@/lib/services/line-recorder'

/**
 * POST /api/lines/record
 * Records current lines for specified sports
 * Requires authentication via CRON_SECRET for automated calls
 */
export async function POST(req: NextRequest) {
  try {
    // Verify cron secret or admin auth
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get sports from request body, or use defaults
    const body = await req.json().catch(() => ({}))
    const sports = body.sports || [
      'basketball_nba',
      'basketball_ncaab',
      'americanfootball_nfl',
      'icehockey_nhl',
      'baseball_mlb'
    ]

    console.log(`[Line Recorder] Starting line recording for sports: ${sports.join(', ')}`)

    const count = await recordCurrentLines(sports)

    // Also mark opening lines for new games
    let openingLinesMarked = 0
    for (const sport of sports) {
      const marked = await markOpeningLines(sport)
      openingLinesMarked += marked
    }

    console.log(`[Line Recorder] Successfully recorded ${count} lines, marked ${openingLinesMarked} opening lines`)

    return NextResponse.json({
      success: true,
      linesRecorded: count,
      openingLinesMarked,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Line Recorder] Error:', error)
    return NextResponse.json(
      { error: 'Failed to record lines', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET /api/lines/record
 * Manual trigger for testing (no auth required in development)
 */
export async function GET(req: NextRequest) {
  // In production, require auth
  if (process.env.NODE_ENV === 'production') {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
  }

  try {
    const sports = [
      'basketball_nba',
      'basketball_ncaab',
      'americanfootball_nfl',
      'icehockey_nhl',
      'baseball_mlb'
    ]

    console.log(`[Line Recorder] Manual trigger - recording lines for: ${sports.join(', ')}`)

    const count = await recordCurrentLines(sports)

    // Also mark opening lines for new games
    let openingLinesMarked = 0
    for (const sport of sports) {
      const marked = await markOpeningLines(sport)
      openingLinesMarked += marked
    }

    return NextResponse.json({
      success: true,
      linesRecorded: count,
      openingLinesMarked,
      timestamp: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('[Line Recorder] Error:', error)
    return NextResponse.json(
      { error: 'Failed to record lines', details: error.message },
      { status: 500 }
    )
  }
}
