import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateParlayPayout } from '@/lib/utils/odds'

type ParlayPickInput = {
  sport?: string
  league?: string
  game_description?: string
  event_id?: string
  market?: string
  selection?: string
  line?: number
  odds: number
  book?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const picks: ParlayPickInput[] = body.picks || []
    const stake = Number(body.stake || 0)
    const conversationId = body.conversationId || null

    if (!Array.isArray(picks) || picks.length < 2) {
      return NextResponse.json({ error: 'At least 2 picks are required for a parlay' }, { status: 400 })
    }
    if (stake <= 0) {
      return NextResponse.json({ error: 'Stake must be greater than zero' }, { status: 400 })
    }

    const oddsList = picks.map((p) => Number(p.odds))
    if (oddsList.some((o) => !Number.isFinite(o))) {
      return NextResponse.json({ error: 'Each pick must include valid odds' }, { status: 400 })
    }

    const { combinedAmerican, combinedDecimal, potentialWin, potentialPayout } = calculateParlayPayout(stake, oddsList)

    const { data: parlay, error: parlayError } = await supabase
      .from('parlays')
      .insert({
        user_id: user.id,
        conversation_id: conversationId,
        stake,
        combined_decimal_odds: combinedDecimal,
        combined_american_odds: combinedAmerican,
        potential_payout: potentialPayout,
        status: 'pending',
      })
      .select()
      .single()

    if (parlayError || !parlay) {
      console.error('Error inserting parlay:', parlayError)
      return NextResponse.json({ error: 'Failed to create parlay' }, { status: 500 })
    }

    const pickRows = picks.map((p) => ({
      parlay_id: parlay.id,
      sport: p.sport || null,
      league: p.league || null,
      game_description: p.game_description || null,
      event_id: p.event_id || null,
      market: p.market || null,
      selection: p.selection || null,
      line: p.line != null ? Number(p.line) : null,
      odds: Number(p.odds),
      book: p.book || null,
      result: 'pending',
    }))

    const { error: picksError } = await supabase.from('parlay_picks').insert(pickRows)
    if (picksError) {
      console.error('Error inserting parlay picks:', picksError)
      return NextResponse.json({ error: 'Failed to create parlay picks' }, { status: 500 })
    }

    return NextResponse.json({
      parlay: {
        ...parlay,
        potential_win: potentialWin,
        picks: pickRows,
      },
    })
  } catch (error) {
    console.error('Parlay create error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '20', 10)

    const { data: parlays, error: parlayError } = await supabase
      .from('parlays')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (parlayError) {
      console.error('Error fetching parlays:', parlayError)
      return NextResponse.json({ error: 'Failed to fetch parlays' }, { status: 500 })
    }

    const parlayIds = (parlays || []).map((p) => p.id)
    let picksByParlay: Record<string, any[]> = {}
    if (parlayIds.length) {
      const { data: picks, error: picksError } = await supabase
        .from('parlay_picks')
        .select('*')
        .in('parlay_id', parlayIds)

      if (picksError) {
        console.error('Error fetching parlay picks:', picksError)
      } else {
        picksByParlay = (picks || []).reduce((acc: Record<string, any[]>, pick: any) => {
          acc[pick.parlay_id] = acc[pick.parlay_id] || []
          acc[pick.parlay_id].push(pick)
          return acc
        }, {})
      }
    }

    const response = (parlays || []).map((p) => ({
      ...p,
      picks: picksByParlay[p.id] || [],
    }))

    return NextResponse.json({ parlays: response })
  } catch (error) {
    console.error('Parlay GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
