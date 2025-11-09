import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { searchPlayer } from '@/lib/sports-stats-api'

interface PropOdds {
  book: string
  odds: number
}

interface PropMarket {
  line: number
  over: {
    best: number
    bestBook: string
    allBooks: PropOdds[]
  }
  under: {
    best: number
    bestBook: string
    allBooks: PropOdds[]
  }
}

interface PlayerProp {
  player: string
  team?: string
  teamAbbr?: string
  position?: string
  game?: string
  markets: Record<string, PropMarket>
}

/**
 * GET /api/player-props
 * Query parameters:
 * - sport: 'nba' | 'nfl' | 'mlb' | 'nhl' (required)
 * - player: player name to filter (optional)
 * - market: comma-separated list of markets (optional, defaults to points,rebounds,assists)
 *   Available: points, rebounds, assists, threes, blocks, steals, turnovers, double_double, triple_double, etc.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const playerFilter = searchParams.get('player')
    const marketParam = searchParams.get('market')

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    // Determine which prop markets to fetch
    let markets: string[]
    if (marketParam) {
      markets = marketParam.split(',').map(m => `player_${m.trim()}`)
    } else {
      // Default markets for each sport
      switch (sport.toLowerCase()) {
        case 'nba':
        case 'basketball_nba':
          markets = ['player_points', 'player_rebounds', 'player_assists', 'player_threes']
          break
        case 'nfl':
        case 'americanfootball_nfl':
          markets = ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions']
          break
        case 'mlb':
        case 'baseball_mlb':
          markets = ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored']
          break
        case 'nhl':
        case 'icehockey_nhl':
          markets = ['player_points', 'player_shots_on_goal', 'player_blocked_shots']
          break
        default:
          markets = ['player_points']
      }
    }

    // Fetch odds data with only prop markets
    const oddsData = await fetchOdds(sport, markets)

    // Aggregate props by player
    const playerPropsMap = new Map<string, PlayerProp>()

    for (const game of oddsData) {
      const gameDescription = `${game.away_team} @ ${game.home_team}`

      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          if (!market.key.startsWith('player_')) continue

          const marketType = market.key.replace('player_', '')

          for (const outcome of market.outcomes) {
            const playerName = outcome.name

            // Apply player filter if specified
            if (playerFilter && !playerName.toLowerCase().includes(playerFilter.toLowerCase())) {
              continue
            }

            // Initialize player entry if doesn't exist
            if (!playerPropsMap.has(playerName)) {
              playerPropsMap.set(playerName, {
                player: playerName,
                game: gameDescription,
                markets: {}
              })
            }

            const playerProp = playerPropsMap.get(playerName)!

            // Initialize market if doesn't exist
            if (!playerProp.markets[marketType]) {
              playerProp.markets[marketType] = {
                line: outcome.point || 0,
                over: {
                  best: -Infinity,
                  bestBook: '',
                  allBooks: []
                },
                under: {
                  best: -Infinity,
                  bestBook: '',
                  allBooks: []
                }
              }
            }

            const marketData = playerProp.markets[marketType]

            // Determine if this is over or under
            const isOver = outcome.description?.toLowerCase().includes('over') ||
                          outcome.description?.toLowerCase().includes('more') ||
                          (!outcome.description && outcome.point !== undefined)

            const direction = isOver ? 'over' : 'under'

            // Add to allBooks
            marketData[direction].allBooks.push({
              book: bookmaker.title,
              odds: outcome.price
            })

            // Update best odds (American odds: higher is better for positive, closer to 0 is better for negative)
            if (outcome.price > marketData[direction].best) {
              marketData[direction].best = outcome.price
              marketData[direction].bestBook = bookmaker.title
            }
          }
        }
      }
    }

    // Convert map to array and enrich with player data
    const playerProps = await Promise.all(
      Array.from(playerPropsMap.values()).map(async (prop) => {
        try {
          // Look up player in our roster database
          const playerData = await searchPlayer(prop.player, sport)
          if (playerData) {
            prop.team = playerData.team
            prop.teamAbbr = playerData.teamAbbr
            prop.position = playerData.position
          }
        } catch (error) {
          console.error(`Error looking up player ${prop.player}:`, error)
        }
        return prop
      })
    )

    // Sort by player name
    playerProps.sort((a, b) => a.player.localeCompare(b.player))

    return NextResponse.json({
      sport,
      count: playerProps.length,
      data: playerProps
    })

  } catch (error: any) {
    console.error('Player props API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player props', details: error.message },
      { status: 500 }
    )
  }
}
