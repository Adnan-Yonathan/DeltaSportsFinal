import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculatePotentialWin } from '@/lib/utils/odds'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const {
      sport,
      league,
      gameDescription,
      betType,
      betSide,
      odds,
      stake,
      book,
      gameTime,
      conversationId,
      notes,
    } = body

    // Validate required fields
    if (!sport || !league || !gameDescription || !betType || !betSide || !odds || !stake || !book) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate potential win
    const potentialWin = calculatePotentialWin(stake, odds)

    // Insert bet
    const { data: bet, error: betError } = await supabase
      .from('bets')
      .insert({
        user_id: user.id,
        conversation_id: conversationId || null,
        sport,
        league,
        game_description: gameDescription,
        bet_type: betType,
        bet_side: betSide,
        odds,
        stake,
        potential_win: potentialWin,
        book,
        game_time: gameTime || null,
        notes: notes || null,
        status: 'pending',
      })
      .select()
      .single()

    if (betError) {
      console.error('Error inserting bet:', betError)
      return NextResponse.json(
        { error: 'Failed to create bet' },
        { status: 500 }
      )
    }

    // Get updated bankroll (doesn't change for pending bets, but fetch current)
    const { data: userData } = await supabase
      .from('users')
      .select('current_bankroll')
      .eq('id', user.id)
      .single()

    const updatedBankroll = Number(userData?.current_bankroll ?? 0)

    return NextResponse.json({
      bet,
      updatedBankroll,
    })
  } catch (error) {
    console.error('Bets API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .order('placed_at', { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq('status', status)
    }

    const { data: bets, error } = await query

    if (error) {
      console.error('Error fetching bets:', error)
      return NextResponse.json(
        { error: 'Failed to fetch bets' },
        { status: 500 }
      )
    }

    return NextResponse.json({ bets })
  } catch (error) {
    console.error('Bets API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
