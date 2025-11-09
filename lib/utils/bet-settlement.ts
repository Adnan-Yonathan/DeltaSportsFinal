import { LiveScore } from '@/lib/espn-api'

interface Bet {
  id: string
  sport: string
  league: string
  game_description: string
  bet_type: string
  bet_side: string
  odds: number
  stake: number
  potential_win: number
  status: string
}

export interface BetSettlement {
  betId: string
  status: 'won' | 'lost' | 'push'
  actualResult: number
}

/**
 * Determines if a bet should be settled based on game status
 */
export function shouldSettleBet(gameStatus: string): boolean {
  // Only settle completed games
  return gameStatus === 'post'
}

/**
 * Parses spread from bet side (e.g., "Lakers -5.5" -> {team: "Lakers", spread: -5.5})
 */
function parseSpread(betSide: string): { team: string; spread: number } | null {
  const spreadMatch = betSide.match(/(.+?)\s*([+-]?\d+\.?\d*)/)
  if (!spreadMatch) return null

  const team = spreadMatch[1].trim()
  const spread = parseFloat(spreadMatch[2])

  return { team, spread }
}

/**
 * Parses total from bet side (e.g., "Over 223.5" -> {type: "over", line: 223.5})
 */
function parseTotal(betSide: string): { type: 'over' | 'under'; line: number } | null {
  const totalMatch = betSide.match(/(over|under)\s*(\d+\.?\d*)/i)
  if (!totalMatch) return null

  return {
    type: totalMatch[1].toLowerCase() as 'over' | 'under',
    line: parseFloat(totalMatch[2])
  }
}

/**
 * Determines which team was bet on for moneyline
 */
function parseMoneylineTeam(betSide: string): string {
  // Just return the cleaned bet side (should be team name)
  return betSide.trim()
}

/**
 * Checks if a team name matches the bet (fuzzy matching)
 */
function teamMatches(betTeam: string, actualTeam: string): boolean {
  const betLower = betTeam.toLowerCase()
  const actualLower = actualTeam.toLowerCase()

  // Direct match
  if (actualLower.includes(betLower) || betLower.includes(actualLower)) {
    return true
  }

  // Check individual words (for team nicknames like "Lakers" matching "Los Angeles Lakers")
  const betWords = betLower.split(' ')
  const actualWords = actualLower.split(' ')

  for (const betWord of betWords) {
    if (betWord.length > 3) {
      for (const actualWord of actualWords) {
        if (actualWord.includes(betWord) || betWord.includes(actualWord)) {
          return true
        }
      }
    }
  }

  return false
}

/**
 * Settles a moneyline bet
 */
function settleMoneyline(bet: Bet, game: LiveScore): BetSettlement | null {
  const betTeam = parseMoneylineTeam(bet.bet_side)

  let winner: string
  if (game.homeScore > game.awayScore) {
    winner = game.homeTeam
  } else if (game.awayScore > game.homeScore) {
    winner = game.awayTeam
  } else {
    // Tie - push
    return {
      betId: bet.id,
      status: 'push',
      actualResult: 0 // Return stake
    }
  }

  const won = teamMatches(betTeam, winner)

  return {
    betId: bet.id,
    status: won ? 'won' : 'lost',
    actualResult: won ? bet.potential_win : -bet.stake
  }
}

/**
 * Settles a spread bet
 */
function settleSpread(bet: Bet, game: LiveScore): BetSettlement | null {
  const parsed = parseSpread(bet.bet_side)
  if (!parsed) {
    console.error(`Could not parse spread from: ${bet.bet_side}`)
    return null
  }

  const { team, spread } = parsed

  // Determine if bet is on home or away team
  const isHomeTeam = teamMatches(team, game.homeTeam)
  const isAwayTeam = teamMatches(team, game.awayTeam)

  if (!isHomeTeam && !isAwayTeam) {
    console.error(`Could not match team "${team}" to game: ${game.homeTeam} vs ${game.awayTeam}`)
    return null
  }

  // Calculate adjusted scores
  let betTeamScore: number
  let opposingScore: number

  if (isHomeTeam) {
    betTeamScore = game.homeScore + spread
    opposingScore = game.awayScore
  } else {
    betTeamScore = game.awayScore + spread
    opposingScore = game.homeScore
  }

  // Determine result
  if (betTeamScore > opposingScore) {
    return {
      betId: bet.id,
      status: 'won',
      actualResult: bet.potential_win
    }
  } else if (betTeamScore < opposingScore) {
    return {
      betId: bet.id,
      status: 'lost',
      actualResult: -bet.stake
    }
  } else {
    // Exactly on the spread - push
    return {
      betId: bet.id,
      status: 'push',
      actualResult: 0
    }
  }
}

/**
 * Settles a total (over/under) bet
 */
function settleTotal(bet: Bet, game: LiveScore): BetSettlement | null {
  const parsed = parseTotal(bet.bet_side)
  if (!parsed) {
    console.error(`Could not parse total from: ${bet.bet_side}`)
    return null
  }

  const { type, line } = parsed
  const actualTotal = game.homeScore + game.awayScore

  let won: boolean
  if (type === 'over') {
    won = actualTotal > line
  } else {
    won = actualTotal < line
  }

  // Check for push (total exactly equals line)
  if (actualTotal === line) {
    return {
      betId: bet.id,
      status: 'push',
      actualResult: 0
    }
  }

  return {
    betId: bet.id,
    status: won ? 'won' : 'lost',
    actualResult: won ? bet.potential_win : -bet.stake
  }
}

/**
 * Main function to determine bet outcome from live score
 */
export function determineBetOutcome(bet: Bet, game: LiveScore): BetSettlement | null {
  // Only settle completed games
  if (!shouldSettleBet(game.status)) {
    return null
  }

  const betType = bet.bet_type.toLowerCase()

  switch (betType) {
    case 'moneyline':
      return settleMoneyline(bet, game)
    case 'spread':
      return settleSpread(bet, game)
    case 'total':
      return settleTotal(bet, game)
    default:
      console.error(`Unknown bet type: ${bet.bet_type}`)
      return null
  }
}
