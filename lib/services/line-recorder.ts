import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'

interface LineSnapshot {
  sport: string
  league: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  oddsApiId: string
  bookmaker: string
  marketType: 'spread' | 'total' | 'moneyline'
  lineType: 'opening' | 'current' | 'closing'
  spreadHome?: number
  spreadAway?: number
  spreadHomeOdds?: number
  spreadAwayOdds?: number
  totalLine?: number
  totalOverOdds?: number
  totalUnderOdds?: number
  moneylineHome?: number
  moneylineAway?: number
}

const normalizeBookToken = (value: string | null | undefined) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
const isPinnacleBook = (value: string | null | undefined) =>
  normalizeBookToken(value).includes('pinnacle')
const resolveLeagueFromSport = (sport: string) =>
  sport
    .replace('basketball_', '')
    .replace('americanfootball_', '')
    .replace('icehockey_', '')
    .toUpperCase()
const appendSnapshotsFromGames = ({
  sport,
  games,
  snapshots,
  includePinnacleOnly = false,
}: {
  sport: string
  games: any[]
  snapshots: LineSnapshot[]
  includePinnacleOnly?: boolean
}) => {
  const league = resolveLeagueFromSport(sport)
  for (const game of games || []) {
    for (const bookmaker of game.bookmakers || []) {
      const bookTitle = String(bookmaker?.title || bookmaker?.key || '')
      const pinnacle = isPinnacleBook(bookTitle)
      if (includePinnacleOnly && !pinnacle) continue
      const spreadMarket = bookmaker.markets.find((m: any) => m.key === 'spreads')
      if (spreadMarket && spreadMarket.outcomes.length >= 2) {
        const homeOutcome = spreadMarket.outcomes.find((o: any) => o.name === game.home_team)
        const awayOutcome = spreadMarket.outcomes.find((o: any) => o.name === game.away_team)
        if (homeOutcome && awayOutcome) {
          snapshots.push({
            sport,
            league,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookTitle,
            marketType: 'spread',
            lineType: 'current',
            spreadHome: homeOutcome.point,
            spreadAway: awayOutcome.point,
            spreadHomeOdds: homeOutcome.price,
            spreadAwayOdds: awayOutcome.price,
          })
        }
      }
      const totalMarket = bookmaker.markets.find((m: any) => m.key === 'totals')
      if (totalMarket && totalMarket.outcomes.length >= 2) {
        const overOutcome = totalMarket.outcomes.find((o: any) => o.name === 'Over')
        const underOutcome = totalMarket.outcomes.find((o: any) => o.name === 'Under')
        if (overOutcome && underOutcome) {
          snapshots.push({
            sport,
            league,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookTitle,
            marketType: 'total',
            lineType: 'current',
            totalLine: overOutcome.point,
            totalOverOdds: overOutcome.price,
            totalUnderOdds: underOutcome.price,
          })
        }
      }
      const mlMarket = bookmaker.markets.find((m: any) => m.key === 'h2h')
      if (mlMarket && mlMarket.outcomes.length >= 2) {
        const homeOutcome = mlMarket.outcomes.find((o: any) => o.name === game.home_team)
        const awayOutcome = mlMarket.outcomes.find((o: any) => o.name === game.away_team)
        if (homeOutcome && awayOutcome) {
          snapshots.push({
            sport,
            league,
            homeTeam: game.home_team,
            awayTeam: game.away_team,
            gameTime: game.commence_time,
            oddsApiId: game.id,
            bookmaker: bookTitle,
            marketType: 'moneyline',
            lineType: 'current',
            moneylineHome: homeOutcome.price,
            moneylineAway: awayOutcome.price,
          })
        }
      }
    }
  }
}

/**
 * Record current lines for specified sports
 * This should be called periodically (e.g., every 30 minutes) to track line movements
 */
export async function recordCurrentLines(sports: string[]): Promise<number> {
  const supabase = createClient()
  const allSnapshots: LineSnapshot[] = []
  for (const sport of sports) {
    try {
      const sbdGames = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
        revalidateSeconds: 600,
        forceProvider: 'the-odds-api',
      })
      appendSnapshotsFromGames({
        sport,
        games: sbdGames,
        snapshots: allSnapshots,
      })
    } catch (err) {
      console.error(`Error fetching baseline lines for ${sport}:`, err)
      // Continue with other sports even if one fails
    }
    try {
      const pinnacleGames = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
        revalidateSeconds: 600,
        forceProvider: 'the-odds-api',
        bookmakers: ['pinnacle'],
      })
      appendSnapshotsFromGames({
        sport,
        games: pinnacleGames,
        snapshots: allSnapshots,
        includePinnacleOnly: true,
      })
    } catch (err) {
      console.warn(`Pinnacle-only fetch unavailable for ${sport}:`, err)
      // Continue with other sports even if one fails
    }
  }
  const dedupedSnapshots = Array.from(
    new Map(
      allSnapshots.map((snap) => {
        const key = [
          snap.sport,
          snap.oddsApiId,
          snap.marketType,
          normalizeBookToken(snap.bookmaker),
          snap.lineType,
          snap.spreadHome ?? '',
          snap.spreadAway ?? '',
          snap.totalLine ?? '',
          snap.moneylineHome ?? '',
          snap.moneylineAway ?? '',
        ].join('|')
        return [key, snap]
      })
    ).values()
  )
  // Batch insert all snapshots
  if (dedupedSnapshots.length > 0) {
    const { error } = await supabase.from('lines').insert(
      dedupedSnapshots.map(snap => ({
        sport: snap.sport,
        league: snap.league,
        home_team: snap.homeTeam,
        away_team: snap.awayTeam,
        game_time: snap.gameTime,
        odds_api_id: snap.oddsApiId,
        market_type: snap.marketType,
        bookmaker: snap.bookmaker,
        line_type: snap.lineType,
        spread_home: snap.spreadHome,
        spread_away: snap.spreadAway,
        spread_home_odds: snap.spreadHomeOdds,
        spread_away_odds: snap.spreadAwayOdds,
        total_line: snap.totalLine,
        total_over_odds: snap.totalOverOdds,
        total_under_odds: snap.totalUnderOdds,
        moneyline_home: snap.moneylineHome,
        moneyline_away: snap.moneylineAway,
      }))
    )
    if (error) {
      console.error('Error recording lines:', error)
      throw new Error(`Failed to record lines: ${error.message}`)
    } else {
      console.log(`Recorded ${dedupedSnapshots.length} line snapshots`)
    }
  }
  return dedupedSnapshots.length
}

/**
 * Detect sharp line movement
 * Sharp moves are characterized by:
 * - Significant line movement (>2 points for spreads, >3 points for totals)
 * - Movement against public betting percentage
 * - Simultaneous movement across multiple sharp books
 */
export async function detectSharpMoves(): Promise<void> {
  const supabase = createClient()

  // Get all games happening in next 48 hours
  const now = new Date()
  const futureWindow = new Date(now.getTime() + 48 * 60 * 60 * 1000)

  const { data: recentLines, error } = await supabase
    .from('lines')
    .select('*')
    .gte('game_time', now.toISOString())
    .lte('game_time', futureWindow.toISOString())
    .eq('line_type', 'current')
    .order('recorded_at', { ascending: false })

  if (error) {
    console.error('Error fetching recent lines:', error)
    return
  }

  if (!recentLines || recentLines.length === 0) {
    console.log('No recent lines found for sharp move detection')
    return
  }

  // Group lines by game and market
  const gameMarkets = new Map<string, any[]>()

  for (const line of recentLines) {
    const key = `${line.odds_api_id}_${line.market_type}_${line.bookmaker}`
    if (!gameMarkets.has(key)) {
      gameMarkets.set(key, [])
    }
    gameMarkets.get(key)!.push(line)
  }

  // Analyze each game/market for sharp moves
  const sharpMoves: string[] = []

  for (const [key, lines] of gameMarkets.entries()) {
    if (lines.length < 2) continue // Need at least 2 data points

    // Sort by recorded time
    lines.sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())

    const oldest = lines[0]
    const newest = lines[lines.length - 1]

    // Check for significant line movement
    let isSharpMove = false
    let movement = 0

    if (oldest.market_type === 'spread' && oldest.spread_home !== null && newest.spread_home !== null) {
      movement = Math.abs(newest.spread_home - oldest.spread_home)
      if (movement >= 2) {
        isSharpMove = true
      }
    } else if (oldest.market_type === 'total' && oldest.total_line !== null && newest.total_line !== null) {
      movement = Math.abs(newest.total_line - oldest.total_line)
      if (movement >= 3) {
        isSharpMove = true
      }
    }

    // Flag the newest line as a sharp move if criteria met
    if (isSharpMove) {
      const { error: updateError } = await supabase
        .from('lines')
        .update({ is_sharp_move: true })
        .eq('id', newest.id)

      if (!updateError) {
        sharpMoves.push(key)
        console.log(`✓ Sharp move detected: ${key} (${movement} point movement)`)
      }
    }
  }

  console.log(`Sharp move detection complete: ${sharpMoves.length} sharp moves found`)
}

/**
 * Calculate CLV (Closing Line Value) for a bet
 * CLV measures how much better (or worse) your line was compared to the closing line
 * Positive CLV = You got a better line than the closing line (good!)
 * Negative CLV = You got a worse line than the closing line (bad)
 */
export async function calculateCLV(betId: string): Promise<{ clvValue: number; clvPercent: number } | null> {
  const supabase = createClient()

  // Get bet details
  const { data: bet, error: betError } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .single()

  if (betError || !bet) {
    console.error('Bet not found:', betError)
    return null
  }

  // If bet doesn't have an odds_api_id, we can't calculate CLV
  if (!bet.odds_api_id) {
    console.log('Bet has no odds_api_id, cannot calculate CLV')
    return null
  }

  // Determine market type from bet_type
  let marketType = bet.bet_type
  if (marketType === 'prop') {
    // Can't calculate CLV for props yet
    return null
  }

  // Get closing line for this game
  const { data: closingLine, error: closingError } = await supabase
    .from('lines')
    .select('*')
    .eq('odds_api_id', bet.odds_api_id)
    .eq('market_type', marketType)
    .eq('line_type', 'closing')
    .limit(1)
    .single()

  if (closingError || !closingLine) {
    console.log('No closing line found for bet')
    return null
  }

  // Calculate CLV based on bet type
  let clvValue = 0
  let clvPercent = 0

  if (bet.bet_type === 'spread' && bet.opening_line !== null && closingLine.spread_home !== null) {
    // CLV = (closing line - opening line) * bet direction
    // Positive CLV = got a better line than closing
    clvValue = Math.abs(closingLine.spread_home - bet.opening_line)
    if (bet.opening_line !== 0) {
      clvPercent = (clvValue / Math.abs(bet.opening_line)) * 100
    }
  } else if (bet.bet_type === 'total' && bet.opening_line !== null && closingLine.total_line !== null) {
    clvValue = Math.abs(closingLine.total_line - bet.opening_line)
    if (bet.opening_line !== 0) {
      clvPercent = (clvValue / bet.opening_line) * 100
    }
  }

  // Update bet with CLV
  const { error: updateError } = await supabase
    .from('bets')
    .update({
      closing_line: closingLine.spread_home || closingLine.total_line || closingLine.moneyline_home,
      clv_value: clvValue,
      clv_percent: clvPercent,
    })
    .eq('id', betId)

  if (updateError) {
    console.error('Error updating bet with CLV:', updateError)
    return null
  }

  console.log(`✓ CLV calculated for bet ${betId}: ${clvValue} (${clvPercent.toFixed(2)}%)`)

  return { clvValue, clvPercent }
}

/**
 * Mark opening lines for upcoming games
 * This should be called when new games appear in the odds feed
 */
export async function markOpeningLines(sport: string): Promise<number> {
  const supabase = createClient()

  // Get all games for this sport that don't have opening lines yet
  const { data: allGames, error } = await supabase
    .from('lines')
    .select('odds_api_id')
    .eq('sport', sport)
    .eq('line_type', 'current')

  if (error || !allGames) {
    console.error('Error fetching games:', error)
    return 0
  }

  // Get unique game IDs
  const uniqueGameIds = [...new Set(allGames.map(g => g.odds_api_id))]

  let markedCount = 0

  for (const gameId of uniqueGameIds) {
    if (!gameId) continue

    // Check if this game already has opening lines
    const { data: existingOpening } = await supabase
      .from('lines')
      .select('id')
      .eq('odds_api_id', gameId)
      .eq('line_type', 'opening')
      .limit(1)

    if (!existingOpening || existingOpening.length === 0) {
      // Get the earliest current lines for this game
      const { data: earliestLines } = await supabase
        .from('lines')
        .select('*')
        .eq('odds_api_id', gameId)
        .eq('line_type', 'current')
        .order('recorded_at', { ascending: true })
        .limit(10)

      if (earliestLines && earliestLines.length > 0) {
        // Copy these as opening lines
        const openingLines = earliestLines.map(line => ({
          ...line,
          id: undefined, // Let database generate new ID
          line_type: 'opening' as const,
        }))

        const { error: insertError } = await supabase
          .from('lines')
          .insert(openingLines)

        if (!insertError) {
          markedCount++
          console.log(`✓ Marked opening lines for game ${gameId}`)
        }
      }
    }
  }

  console.log(`Marked ${markedCount} games with opening lines`)
  return markedCount
}


