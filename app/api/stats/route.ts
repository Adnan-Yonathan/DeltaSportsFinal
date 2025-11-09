import { NextRequest, NextResponse } from 'next/server'
import {
  getTeamStats,
  getInjuryReports,
  getAllInjuries,
  formatStatsForAI,
  TeamStats,
  InjuryReport
} from '@/lib/sports-stats-api'

/**
 * GET /api/stats
 * Query parameters:
 * - type: 'team' | 'injuries' | 'all-injuries'
 * - sport: 'nba' | 'nfl' | 'mlb' | 'nhl'
 * - team: optional team identifier (abbreviation or ID)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'team'
    const sport = searchParams.get('sport') || 'nba'
    const team = searchParams.get('team') || undefined
    const format = searchParams.get('format') || 'json' // 'json' or 'text'

    let result: any

    switch (type) {
      case 'team':
        result = await getTeamStats(sport, team)
        break

      case 'injuries':
        result = await getInjuryReports(sport)
        break

      case 'all-injuries':
        result = await getAllInjuries()
        break

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        )
    }

    // Return formatted text for AI or JSON for structured data
    if (format === 'text') {
      let text = ''

      if (type === 'all-injuries') {
        text = result.map((r: any) =>
          `${r.sport} INJURIES:\n${formatStatsForAI(r.injuries)}`
        ).join('\n\n')
      } else {
        text = formatStatsForAI(result)
      }

      return NextResponse.json({ text, data: result })
    }

    return NextResponse.json({ data: result })

  } catch (error: any) {
    console.error('Stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
