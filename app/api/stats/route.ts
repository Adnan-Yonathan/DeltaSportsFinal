import { NextRequest, NextResponse } from 'next/server'
import {
  getTeamStats,
  getInjuryReports,
  getAllInjuries,
  formatStatsForAI,
  searchPlayer,
  getRoster,
  getNBAPlayerSeasonStats,
  getNFLPlayerSeasonStats,
  TeamStats,
  InjuryReport,
  RosterPlayer
} from '@/lib/sports-stats-api'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/stats
 * Query parameters:
 * - type: 'team' | 'injuries' | 'all-injuries' | 'player' | 'player-season' | 'roster' | 'recent_form' | 'home_away' | 'head_to_head'
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

      case 'player-season': {
        if (!player) {
          return NextResponse.json(
            { error: 'Player name required for player-season query' },
            { status: 400 }
          )
        }
        if (['nba', 'basketball_nba'].includes(sport.toLowerCase())) {
          result = await getNBAPlayerSeasonStats(player)
        } else if (['nfl', 'americanfootball_nfl'].includes(sport.toLowerCase())) {
          result = await getNFLPlayerSeasonStats(player)
        } else {
          return NextResponse.json(
            { error: `player-season not supported for sport ${sport}` },
            { status: 400 }
          )
        }
        if (!result) {
          return NextResponse.json({ error: 'Player season stats not found' }, { status: 404 })
        }
        break
      }

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

      case 'home_away': {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('team_splits')
          .select('*')
          .eq('sport_key', sport)
          .eq('team_name', team || '')
          .order('captured_at', { ascending: false })
          .limit(2)

        if (error) {
          console.error('Stats API error (home_away):', error)
          return NextResponse.json({ error: 'Failed to fetch splits' }, { status: 500 })
        }

        result = data || []
        break
      }

      case 'head_to_head': {
        const teamTwo = searchParams.get('opponent')
        if (!team || !teamTwo) {
          return NextResponse.json(
            { error: 'team and opponent parameters are required for head_to_head' },
            { status: 400 }
          )
        }

        const supabase = createClient()
        const { data, error } = await supabase
          .from('head_to_head_results')
          .select('*')
          .eq('sport_key', sport)
          .or(
            `(team_one.eq.${team},team_two.eq.${teamTwo}),(team_one.eq.${teamTwo},team_two.eq.${team})`
          )
          .order('matchup_date', { ascending: false })
          .limit(10)

        if (error) {
          console.error('Stats API error (head_to_head):', error)
          return NextResponse.json({ error: 'Failed to fetch head-to-head data' }, { status: 500 })
        }

        result = data || []
        break
      }

      case 'pace_eff': {
        if (!team) {
          return NextResponse.json(
            { error: 'team parameter is required for pace_eff' },
            { status: 400 }
          )
        }

        const supabase = createClient()
        const { data, error } = await supabase
          .from('team_recent_form')
          .select('*')
          .eq('sport_key', sport)
          .eq('team_name', team)
          .order('game_date', { ascending: false })
          .limit(5)

        if (error) {
          console.error('Stats API error (pace_eff):', error)
          return NextResponse.json({ error: 'Failed to fetch pace/efficiency' }, { status: 500 })
        }

        const entries = data || []
        const games = entries.length || 1
        const summary = {
          pace: entries.reduce((sum, e) => sum + (e.pace || 0), 0) / games,
          offensive_rating: entries.reduce((sum, e) => sum + (e.offensive_rating || 0), 0) / games,
          defensive_rating: entries.reduce((sum, e) => sum + (e.defensive_rating || 0), 0) / games,
          net_rating: entries.reduce((sum, e) => sum + (e.net_rating || 0), 0) / games,
        }

        result = { team, sport, games, summary, entries }
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
