import { NextRequest, NextResponse } from 'next/server'
import {
  getTeamStats,
  getInjuryReports,
  getAllInjuries,
  formatStatsForAI,
  searchPlayer,
  getRoster,
  TeamStats,
  InjuryReport,
  RosterPlayer
} from '@/lib/sports-stats-api'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/stats
 * Query parameters:
 * - type: 'team' | 'injuries' | 'all-injuries' | 'player' | 'roster' | 'recent_form'
 * - sport: 'nba' | 'nfl' | 'mlb' | 'nhl'
 * - team: optional team identifier (abbreviation or ID)
 * - player: player name to search (for type=player)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'team'
    const sport = searchParams.get('sport') || 'nba'
    const team = searchParams.get('team') || undefined
    const player = searchParams.get('player') || undefined
    const format = searchParams.get('format') || 'json' // 'json' or 'text'

    let result: any

    switch (type) {
      case 'team':
        result = await getTeamStats(sport, team)
        break

      case 'injuries': {
        const supabase = createClient()
        let data: any[] | null = null
        try {
          const { data: cached } = await supabase
            .from('injury_reports')
            .select('*')
            .eq('sport_key', sport)
            .order('captured_at', { ascending: false })
            .limit(200)

          data = cached
        } catch (error) {
          console.warn('[STATS] Failed to read injury cache:', error)
        }

        result = data && data.length > 0 ? data : await getInjuryReports(sport)
        break
      }

      case 'all-injuries':
        result = await getAllInjuries()
        break

      case 'player':
        if (!player) {
          return NextResponse.json(
            { error: 'Player name required for player search' },
            { status: 400 }
          )
        }
        result = await searchPlayer(player, sport)
        break

      case 'roster':
        result = await getRoster(sport, team)
        break

      case 'recent_form': {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('team_recent_form')
          .select('*')
          .eq('sport_key', sport)
          .eq('team_name', team || '')
          .order('game_date', { ascending: false })
          .limit(10)

        if (error) {
          console.error('Stats API error (recent_form):', error)
          return NextResponse.json({ error: 'Failed to fetch recent form' }, { status: 500 })
        }

        result = data || []
        break
      }

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
