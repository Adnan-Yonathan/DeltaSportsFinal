import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { format } from 'date-fns'

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
    const { operation, data } = body

    switch (operation) {
      case 'log_bet':
        return await logBet(supabase, user.id, data)

      case 'settle_bet':
        return await settleBet(supabase, user.id, data)

      case 'adjust_bankroll':
        return await adjustBankroll(supabase, user.id, data)

      default:
        return NextResponse.json(
          { error: 'Invalid operation' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Bankroll operations API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function logBet(supabase: any, userId: string, data: any) {
  const {
    sport,
    league,
    game_description,
    bet_type,
    bet_side,
    odds,
    stake,
    book,
    conversation_id,
    notes,
  } = data

  // Calculate potential win based on American odds
  let potentialWin = 0
  if (odds > 0) {
    potentialWin = (stake * odds) / 100
  } else {
    potentialWin = (stake * 100) / Math.abs(odds)
  }

  // Insert bet
  const { data: bet, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      conversation_id: conversation_id || null,
      sport,
      league,
      game_description,
      bet_type,
      bet_side,
      odds: parseInt(odds),
      stake: parseFloat(stake),
      potential_win: potentialWin,
      book,
      notes: notes || null,
      status: 'pending',
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: 'Failed to log bet', details: error.message },
      { status: 500 }
    )
  }

  // Update current bankroll (subtract stake)
  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  const newBankroll = parseFloat(userData.current_bankroll) - parseFloat(stake)

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  return NextResponse.json({
    success: true,
    bet,
    newBankroll,
    message: `Bet logged: $${stake} on ${game_description}`,
  })
}

async function settleBet(supabase: any, userId: string, data: any) {
  const { bet_id, result } = data // result: 'won', 'lost', 'push'

  // Get the bet
  const { data: bet } = await supabase
    .from('bets')
    .select('*')
    .eq('id', bet_id)
    .eq('user_id', userId)
    .single()

  if (!bet) {
    return NextResponse.json({ error: 'Bet not found' }, { status: 404 })
  }

  if (bet.status !== 'pending') {
    return NextResponse.json(
      { error: 'Bet already settled' },
      { status: 400 }
    )
  }

  let actualResult = 0

  if (result === 'won') {
    // Stake was removed at log time; profit is potential_win
    actualResult = parseFloat(bet.potential_win)
  } else if (result === 'push') {
    // No profit/loss; stake was already removed at log time
    actualResult = 0
  } else if (result === 'lost') {
    // Lose the stake (record negative profit)
    actualResult = -parseFloat(bet.stake)
  }

  // Update bet
  await supabase
    .from('bets')
    .update({
      status: result,
      actual_result: actualResult,
      settled_at: new Date().toISOString(),
    })
    .eq('id', bet_id)

  // Update bankroll
  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  const newBankroll = parseFloat(userData.current_bankroll) + actualResult

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  const profitLoss = actualResult

  return NextResponse.json({
    success: true,
    newBankroll,
    profitLoss,
    message: `Bet settled as ${result}: ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}`,
  })
}

async function adjustBankroll(supabase: any, userId: string, data: any) {
  const { amount, type, notes } = data // type: 'deposit', 'withdrawal'

  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  let newBankroll = parseFloat(userData.current_bankroll)

  if (type === 'deposit') {
    newBankroll += parseFloat(amount)
  } else if (type === 'withdrawal') {
    newBankroll -= parseFloat(amount)
  }

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  return NextResponse.json({
    success: true,
    newBankroll,
    message: `${type === 'deposit' ? 'Deposited' : 'Withdrew'} $${amount}`,
  })
}

async function createDailySnapshot(
  supabase: any,
  userId: string,
  balance: number
) {
  const today = format(new Date(), 'yyyy-MM-dd')

  await supabase
    .from('bankroll_snapshots')
    .upsert(
      {
        user_id: userId,
        balance: balance,
        snapshot_date: today,
      },
      {
        onConflict: 'user_id,snapshot_date',
      }
    )
}
