import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { calculateROI } from '@/lib/utils/odds'
import { subDays, format } from 'date-fns'
import { computeClvForBets } from '@/lib/services/clv'
import { normalizePropMarketKey, normalizePropSelection, extractPropLine } from '@/lib/utils/props'

export const dynamic = 'force-dynamic'

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
    const period = searchParams.get('period') || '7d'

    // Get user data
    const { data: userData } = await supabase
      .from('users')
      .select('current_bankroll, starting_bankroll, unit_size')
      .eq('id', user.id)
      .single()

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate date range
    const now = new Date()
    let startDate: Date

    switch (period) {
      case '7d':
        startDate = subDays(now, 7)
        break
      case '30d':
        startDate = subDays(now, 30)
        break
      case 'all':
      default:
        startDate = new Date(0) // Beginning of time
        break
    }

    // Get bets for the period
    const { data: bets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', user.id)
      .gte('placed_at', startDate.toISOString())
      .order('placed_at', { ascending: false })

    // Calculate statistics
    const totalBets = bets?.length || 0
    const wonBets = bets?.filter((b) => b.status === 'won').length || 0
    const lostBets = bets?.filter((b) => b.status === 'lost').length || 0
    const pushBets = bets?.filter((b) => b.status === 'push').length || 0
    const pendingBets = bets?.filter((b) => b.status === 'pending').length || 0

    const totalStake = bets?.reduce((sum, b) => sum + Number(b.stake), 0) || 0
    const totalProfit = bets
      ?.filter((b) => b.actual_result !== null)
      .reduce((sum, b) => sum + Number(b.actual_result || 0), 0) || 0

    const winRate = totalBets > 0 ? (wonBets / (wonBets + lostBets)) * 100 : 0
    const roi = calculateROI(totalStake, totalProfit)

    const avgBetSize = totalBets > 0 ? totalStake / totalBets : 0

    const biggestWin = bets
      ?.filter((b) => b.status === 'won')
      .reduce((max, b) => Math.max(max, Number(b.actual_result || 0)), 0) || 0

    const biggestLoss = bets
      ?.filter((b) => b.status === 'lost')
      .reduce((min, b) => Math.min(min, Number(b.actual_result || 0)), 0) || 0

    // Calculate by sport
    const bySport: Record<string, any> = {}
    bets?.forEach((bet) => {
      if (!bySport[bet.sport]) {
        bySport[bet.sport] = {
          total: 0,
          won: 0,
          lost: 0,
          push: 0,
          profit: 0,
          stake: 0,
        }
      }

      bySport[bet.sport].total++
      bySport[bet.sport].stake += Number(bet.stake)

      if (bet.status === 'won') bySport[bet.sport].won++
      if (bet.status === 'lost') bySport[bet.sport].lost++
      if (bet.status === 'push') bySport[bet.sport].push++
      if (bet.actual_result !== null) {
        bySport[bet.sport].profit += Number(bet.actual_result)
      }
    })

    // Add ROI and win rate to each sport
    Object.keys(bySport).forEach((sport) => {
      const sportData = bySport[sport]
      sportData.roi = calculateROI(sportData.stake, sportData.profit)
      sportData.winRate =
        sportData.won + sportData.lost > 0
          ? (sportData.won / (sportData.won + sportData.lost)) * 100
          : 0
    })

    // Get daily balances from snapshots
    const { data: snapshots } = await supabase
      .from('bankroll_snapshots')
      .select('balance, snapshot_date')
      .eq('user_id', user.id)
      .gte('snapshot_date', format(startDate, 'yyyy-MM-dd'))
      .order('snapshot_date', { ascending: true })

    const dailyBalances =
      snapshots?.map((s) => ({
        date: s.snapshot_date,
        balance: Number(s.balance),
      })) || []

    // Compute CLV aggregates on-demand
    const { clvAgg } = await computeClvForBets(bets || [])

    // Calculate unit-based metrics
    const startingBalance = Number(userData.starting_bankroll)
    const currentBalance = Number(userData.current_bankroll)
    // Use user's configured unit_size, fallback to 1% of starting bankroll if not set
    const unitSize = Number(userData.unit_size) || (startingBalance > 0 ? startingBalance / 100 : 100)

    const startingUnits = startingBalance / unitSize
    const currentUnits = currentBalance / unitSize

    // Calculate units won from winning bets (actual_result - stake = profit)
    const unitsWon = bets
      ?.filter((b) => b.status === 'won' && b.actual_result !== null)
      .reduce((sum, b) => sum + ((Number(b.actual_result || 0) - Number(b.stake)) / unitSize), 0) || 0

    // Calculate units lost from losing bets (absolute value of negative actual_result)
    const unitsLost = Math.abs(bets
      ?.filter((b) => b.status === 'lost' && b.actual_result !== null)
      .reduce((sum, b) => sum + (Number(b.actual_result || 0) / unitSize), 0) || 0)

    // Convert daily balances to units
    const dailyUnits = dailyBalances.map(day => ({
      date: day.date,
      units: day.balance / unitSize
    }))

    return NextResponse.json({
      currentBalance,
      startingBalance,
      totalProfit,
      roi,
      totalBets,
      wonBets,
      lostBets,
      pushBets,
      pendingBets,
      winRate,
      avgBetSize,
      biggestWin,
      biggestLoss,
      bySport,
      dailyBalances,
      // Unit metrics
      currentUnits,
      startingUnits,
      unitsWon,
      unitsLost,
      unitSize,
      dailyUnits,
      clv: clvAgg || null,
      propLiveBets: await buildPropLiveInsights(supabase, bets || []),
    })
  } catch (error) {
    console.error('Bankroll stats API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function buildPropLiveInsights(supabase: any, bets: any[]) {
  const pendingProps = bets.filter(
    (bet) => bet?.is_prop && bet?.status === 'pending' && bet?.player_name
  )
  const insights: any[] = []

  for (const bet of pendingProps) {
    const marketKey = normalizePropMarketKey(bet.prop_market)
    if (!marketKey) continue
    const snapshot = await fetchLatestPropSnapshot(supabase, {
      playerName: bet.player_name,
      marketKey,
      eventId: bet.odds_api_id,
      book: bet.book,
    })

    const selection = normalizePropSelection(bet.prop_selection || bet.bet_side)
    const placedLine = bet.prop_line ?? extractPropLine(bet.bet_side)

    insights.push({
      betId: bet.id,
      player: bet.player_name,
      market: marketKey,
      selection,
      placedLine: placedLine != null ? Number(placedLine) : null,
      currentLine: snapshot?.line ?? null,
      currentOverOdds: snapshot?.over_odds ?? null,
      currentUnderOdds: snapshot?.under_odds ?? null,
      book: snapshot?.book ?? bet.book ?? null,
      capturedAt: snapshot?.captured_at ?? null,
    })
  }

  return insights
}

async function fetchLatestPropSnapshot(
  supabase: any,
  params: { playerName: string; marketKey: string; eventId?: string | null; book?: string | null }
) {
  const { playerName, marketKey, eventId, book } = params
  const baseQuery = () =>
    supabase
      .from('player_prop_snapshots')
      .select('player_name,market_key,line,over_odds,under_odds,book,captured_at')
      .eq('player_name', playerName)
      .eq('market_key', marketKey)
      .order('captured_at', { ascending: false })
      .limit(1)

  let query = baseQuery()
  if (eventId) query = query.eq('event_id', eventId)
  if (book) query = query.eq('book', book)

  let { data, error } = await query
  if (error) {
    console.error('[BANKROLL] Failed to fetch prop snapshot:', error.message)
    return null
  }

  if (data && data.length > 0) return data[0]

  // Retry without book constraint if no match
  if (book) {
    let retry = baseQuery()
    if (eventId) retry = retry.eq('event_id', eventId)
    const retryResult = await retry
    if (retryResult.error) {
      console.error('[BANKROLL] Failed to fetch prop snapshot (retry):', retryResult.error.message)
      return null
    }
    return retryResult.data?.[0] ?? null
  }

  return null
}
