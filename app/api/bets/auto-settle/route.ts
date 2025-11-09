import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAllLiveScores, matchBetToGame } from '@/lib/espn-api'
import { determineBetOutcome } from '@/lib/utils/bet-settlement'

/**
 * Auto-settle endpoint - checks all pending bets against live scores
 * Can be called manually or via cron job
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()

    // Verify user authentication (if called by user)
    // For cron jobs, you might want to use an API key instead
    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Allow both authenticated users and API key access
    const apiKey = req.headers.get('x-api-key')
    const validApiKey = process.env.AUTO_SETTLE_API_KEY

    if (!user && (!apiKey || apiKey !== validApiKey)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all pending bets (either for user or all if using API key)
    let betsQuery = supabase
      .from('bets')
      .select('*')
      .eq('status', 'pending')

    // If user authenticated, only their bets
    if (user) {
      betsQuery = betsQuery.eq('user_id', user.id)
    }

    const { data: pendingBets, error: betsError } = await betsQuery

    if (betsError) {
      console.error('Error fetching pending bets:', betsError)
      return NextResponse.json(
        { error: 'Failed to fetch pending bets' },
        { status: 500 }
      )
    }

    if (!pendingBets || pendingBets.length === 0) {
      return NextResponse.json({
        message: 'No pending bets to settle',
        settled: 0
      })
    }

    // Fetch live scores
    const liveScores = await getAllLiveScores()

    if (liveScores.length === 0) {
      return NextResponse.json({
        message: 'No live scores available',
        settled: 0
      })
    }

    const settledBets = []
    const failedBets = []

    // Process each pending bet
    for (const bet of pendingBets) {
      try {
        // Match bet to a game
        const matchedGame = matchBetToGame(bet.game_description, liveScores)

        if (!matchedGame) {
          // No matching game found - skip
          continue
        }

        // Determine bet outcome
        const settlement = determineBetOutcome(bet, matchedGame)

        if (!settlement) {
          // Game not finished yet or couldn't determine outcome
          continue
        }

        // Update bet in database
        const { data: updatedBet, error: updateError } = await supabase
          .from('bets')
          .update({
            status: settlement.status,
            actual_result: settlement.actualResult,
            settled_at: new Date().toISOString(),
          })
          .eq('id', bet.id)
          .select()
          .single()

        if (updateError) {
          console.error(`Error settling bet ${bet.id}:`, updateError)
          failedBets.push({
            betId: bet.id,
            error: updateError.message
          })
          continue
        }

        settledBets.push({
          betId: bet.id,
          gameDescription: bet.game_description,
          status: settlement.status,
          actualResult: settlement.actualResult
        })

      } catch (error: any) {
        console.error(`Error processing bet ${bet.id}:`, error)
        failedBets.push({
          betId: bet.id,
          error: error.message
        })
      }
    }

    return NextResponse.json({
      message: `Auto-settlement complete`,
      totalPending: pendingBets.length,
      settled: settledBets.length,
      failed: failedBets.length,
      settledBets,
      failedBets: failedBets.length > 0 ? failedBets : undefined
    })

  } catch (error: any) {
    console.error('Auto-settle API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to check what bets would be settled (dry run)
 */
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

    // Fetch pending bets for this user
    const { data: pendingBets, error: betsError } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'pending')

    if (betsError) {
      console.error('Error fetching pending bets:', betsError)
      return NextResponse.json(
        { error: 'Failed to fetch pending bets' },
        { status: 500 }
      )
    }

    if (!pendingBets || pendingBets.length === 0) {
      return NextResponse.json({
        message: 'No pending bets',
        settleable: []
      })
    }

    // Fetch live scores
    const liveScores = await getAllLiveScores()

    const settleable = []

    // Check each bet
    for (const bet of pendingBets) {
      const matchedGame = matchBetToGame(bet.game_description, liveScores)

      if (matchedGame && matchedGame.status === 'post') {
        const settlement = determineBetOutcome(bet, matchedGame)

        if (settlement) {
          settleable.push({
            betId: bet.id,
            gameDescription: bet.game_description,
            betType: bet.bet_type,
            betSide: bet.bet_side,
            stake: bet.stake,
            game: {
              homeTeam: matchedGame.homeTeam,
              awayTeam: matchedGame.awayTeam,
              homeScore: matchedGame.homeScore,
              awayScore: matchedGame.awayScore,
              status: matchedGame.status
            },
            projectedOutcome: {
              status: settlement.status,
              actualResult: settlement.actualResult
            }
          })
        }
      }
    }

    return NextResponse.json({
      totalPending: pendingBets.length,
      settleable: settleable.length,
      bets: settleable
    })

  } catch (error: any) {
    console.error('Auto-settle check API error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
