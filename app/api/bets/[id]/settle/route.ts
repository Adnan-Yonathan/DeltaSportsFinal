import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { status, actualResult } = await req.json()

    if (!status || !['won', 'lost', 'push', 'cancelled'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status' },
        { status: 400 }
      )
    }

    // Update bet
    const { data: bet, error: updateError } = await supabase
      .from('bets')
      .update({
        status,
        actual_result: actualResult,
        settled_at: new Date().toISOString(),
      })
      .eq('id', params.id)
      .eq('user_id', user.id) // Ensure user owns the bet
      .select()
      .single()

    if (updateError) {
      console.error('Error updating bet:', updateError)
      return NextResponse.json(
        { error: 'Failed to settle bet' },
        { status: 500 }
      )
    }

    if (!bet) {
      return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
    }

    // Trigger will automatically update bankroll and create snapshot

    // Get updated bankroll
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
    console.error('Settle bet API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
