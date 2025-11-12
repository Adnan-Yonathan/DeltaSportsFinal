import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInjuryReports } from '@/lib/sports-stats-api'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sport = searchParams.get('sport')
  const team = searchParams.get('team')

  if (!sport) {
    return NextResponse.json({ error: 'sport parameter is required' }, { status: 400 })
  }

  const supabase = createClient()
  let injuries: any[] = []
  let source = 'cache'

  try {
    const query = supabase
      .from('injury_reports')
      .select('*')
      .eq('sport_key', sport)
      .order('captured_at', { ascending: false })
      .limit(200)

    const { data, error } = await (team ? query.eq('team_name', team) : query)

    if (error) throw error

    if (data && data.length > 0) {
      injuries = data
    } else {
      source = 'live'
      injuries = await getInjuryReports(sport)
    }
  } catch (error: any) {
    console.error('[API] Failed to load injuries from cache:', error)
    source = 'live'
    injuries = await getInjuryReports(sport)
  }

  return NextResponse.json({
    sport,
    team: team || null,
    count: injuries.length,
    source,
    data: injuries,
  })
}
