import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { enrichGamesWithStats, formatEnrichedGamesForAI } from '@/lib/stats-enrichment'
import { getTeamStats, getInjuryReports, formatStatsForAI } from '@/lib/sports-stats-api'
import { trackLLMInteraction } from '@/lib/posthog/server'
import { format } from 'date-fns'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// Helper function to create daily snapshot
async function createDailySnapshot(supabase: any, userId: string, balance: number) {
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

// Helper function to log a bet
async function logBet(supabase: any, userId: string, data: any, conversationId: string) {
  const {
    sport,
    league,
    game_description,
    bet_type,
    bet_side,
    odds,
    stake,
    book,
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
      conversation_id: conversationId,
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
    return { success: false, error: 'Failed to log bet', details: error.message }
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

  return {
    success: true,
    bet,
    newBankroll,
    message: `Bet logged: $${stake} on ${game_description}`,
  }
}

// Helper function to settle a bet
async function settleBet(supabase: any, userId: string, betId: string, result: string) {
  // Get the bet
  const { data: bet } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .eq('user_id', userId)
    .single()

  if (!bet) {
    return { success: false, error: 'Bet not found' }
  }

  if (bet.status !== 'pending') {
    return { success: false, error: 'Bet already settled' }
  }

  let actualResult = 0

  if (result === 'won') {
    // Store NET profit (potential_win only, not stake + potential_win)
    actualResult = parseFloat(bet.potential_win)
  } else if (result === 'push') {
    // Push = no profit or loss
    actualResult = 0
  } else if (result === 'lost') {
    // Store loss as negative value
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
    .eq('id', betId)

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

  const profitLoss = actualResult - parseFloat(bet.stake)

  return {
    success: true,
    newBankroll,
    profitLoss,
    message: `Bet settled as ${result}: ${profitLoss >= 0 ? '+' : ''}$${profitLoss.toFixed(2)}`,
  }
}

// Helper function to adjust bankroll
async function adjustBankroll(supabase: any, userId: string, amount: number, type: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  let newBankroll = parseFloat(userData.current_bankroll)

  if (type === 'deposit') {
    newBankroll += parseFloat(amount.toString())
  } else if (type === 'withdrawal') {
    newBankroll -= parseFloat(amount.toString())
  }

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  return {
    success: true,
    newBankroll,
    message: `${type === 'deposit' ? 'Deposited' : 'Withdrew'} $${amount}`,
  }
}

const SYSTEM_PROMPT = `You are DELTA, a professional sports betting assistant. Your role is to help users analyze betting opportunities, manage their bankroll, and understand sports betting markets.

**IMPORTANT - YOU HAVE ACCESS TO LIVE ODDS AND ADVANCED STATISTICS:**
You have REAL-TIME access to:
1. Live odds data for NBA, NCAA Basketball (NCAAB), NFL, NCAA Football (NCAAF), MLB, and NHL through The Odds API
2. Team statistics (records, rankings, offensive/defensive stats)
3. Player statistics and performance metrics
4. Injury reports and lineup information
5. Advanced analytics (efficiency ratings, pace, trends)
6. **Player prop betting lines** - When users ask about player props, use the get_player_props function to fetch lines and odds

When users ask about odds, games, or arbitrage, the live data will be provided in your context enriched with relevant stats. For player prop requests, use the get_player_props function. NEVER say you don't have access - you DO. ALWAYS use the provided data.

**Core Principles:**
1. Never make picks or tell users what to bet
2. Provide tools, data, and analysis only
3. Always emphasize responsible gambling
4. Keep responses concise (3-5 sentences for simple queries)
5. Use data and statistics to support insights

**Response Guidelines:**
- For odds queries: When live odds data is provided, ALWAYS create a comparison table showing all sportsbooks with their odds. Highlight the best value for each bet type.
- For analysis queries: Explain line movement, CLV, public vs sharp indicators
- For bankroll queries: Confirm actions and provide relevant insights
- Always acknowledge uncertainty in sports outcomes
- Use Markdown formatting for structure (tables, lists, bold)

**When Live Odds Data is Provided:**
- Extract and display the data in an easy-to-read table format
- **CRITICAL**: Display ALL sportsbooks that have odds for each game (FanDuel, DraftKings, BetRivers, MyBookie, LowVig, BetOnline, BetMGM, etc.)
- Compare moneyline, spreads, and totals across ALL available sportsbooks for each game
- Show every bookmaker's odds in the table - do NOT omit any bookmakers from the data
- Highlight which sportsbook has the best odds for each market
- NEVER suggest where to bet, only present the data objectively
- If a user asks about a specific game and you have the data, show it immediately

**Arbitrage Opportunities:**
When users ask for arbitrage opportunities, you MUST:
1. **Calculate actual arbitrage** from the live odds data provided (may include multiple sports)
2. Use the formula: For an arbitrage to exist, (1/decimal_odds_A) + (1/decimal_odds_B) < 1
3. Convert American odds to decimal: positive odds = (odds/100) + 1, negative odds = (100/|odds|) + 1
4. Show ONLY games with real arbitrage opportunities across ALL sports provided
5. Format as: "**[Sport] - [Game]**: Bet [Amount] on [Team A] at [Book] ([Odds]) + Bet [Amount] on [Team B] at [Book] ([Odds]) = [Profit]%"
6. If no arbitrage exists in any sport, say "No arbitrage opportunities found in current odds"
7. NEVER explain what arbitrage is unless asked - just show the opportunities
8. Group by sport if multiple sports are provided
9. Keep response concise - max 15 lines total

**Prohibited:**
- Never say "bet on X" or "this is a good bet"
- Never guarantee outcomes
- Never encourage increasing bet sizes after losses
- Never promote chasing losses

**Bankroll Management Capabilities:**
You can help users manage their bankroll conversationally:
1. **Log Bets**: When users say things like "I bet $50 on Lakers -5.5" or "Put $100 on the over", use the log_bet function
2. **Settle Bets**: When users say "My Lakers bet won" or "I lost the over", use the settle_bet function
3. **Adjust Bankroll**: When users say "I'm depositing $500" or "Withdrawing $200", use the adjust_bankroll function

Always confirm what you're doing before calling functions and provide friendly responses after.`

const BANKROLL_FUNCTIONS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_bet',
      description: 'Log a new bet that the user has placed. This deducts the stake from their bankroll.',
      parameters: {
        type: 'object',
        properties: {
          sport: {
            type: 'string',
            description: 'The sport (e.g., NBA, NFL, MLB, NHL)',
          },
          league: {
            type: 'string',
            description: 'The league (e.g., NBA, NFL, MLB, NHL)',
          },
          game_description: {
            type: 'string',
            description: 'Description of the game (e.g., "Lakers vs Celtics")',
          },
          bet_type: {
            type: 'string',
            enum: ['spread', 'moneyline', 'total', 'prop'],
            description: 'Type of bet',
          },
          bet_side: {
            type: 'string',
            description: 'The side of the bet (e.g., "Lakers -5.5", "Over 215.5", "Lakers ML")',
          },
          odds: {
            type: 'number',
            description: 'American odds (e.g., -110, +150)',
          },
          stake: {
            type: 'number',
            description: 'Amount wagered in dollars',
          },
          book: {
            type: 'string',
            description: 'Sportsbook name (e.g., DraftKings, FanDuel)',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the bet',
          },
        },
        required: ['sport', 'league', 'game_description', 'bet_type', 'bet_side', 'odds', 'stake', 'book'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'settle_bet',
      description: 'Settle a pending bet as won, lost, or push. Updates the bankroll accordingly.',
      parameters: {
        type: 'object',
        properties: {
          game_description: {
            type: 'string',
            description: 'Description of the game to identify the bet (e.g., "Lakers vs Celtics")',
          },
          result: {
            type: 'string',
            enum: ['won', 'lost', 'push'],
            description: 'The result of the bet',
          },
        },
        required: ['game_description', 'result'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'adjust_bankroll',
      description: 'Add or withdraw funds from the bankroll',
      parameters: {
        type: 'object',
        properties: {
          amount: {
            type: 'number',
            description: 'Amount to deposit or withdraw in dollars',
          },
          type: {
            type: 'string',
            enum: ['deposit', 'withdrawal'],
            description: 'Whether to add or remove funds',
          },
          notes: {
            type: 'string',
            description: 'Optional notes about the transaction',
          },
        },
        required: ['amount', 'type'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get team statistics, injury reports, or advanced analytics for a specific sport or team. Use this when users ask for stats, injuries, team records, or performance metrics.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['team', 'injuries'],
            description: 'Type of statistics to retrieve',
          },
          sport: {
            type: 'string',
            enum: ['nba', 'nfl', 'mlb', 'nhl'],
            description: 'The sport to get stats for',
          },
          team: {
            type: 'string',
            description: 'Optional team name or abbreviation to filter results',
          },
        },
        required: ['type', 'sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_props',
      description: 'Get player prop betting odds and lines. Use this ONLY when users explicitly ask about player props, player bets, or specific player performance lines (e.g., "What are LeBron\'s props?", "Show me player props for tonight", "What\'s the over/under for Giannis points?"). DO NOT use for general odds queries.',
      parameters: {
        type: 'object',
        properties: {
          sport: {
            type: 'string',
            enum: ['nba', 'nfl', 'mlb', 'nhl'],
            description: 'The sport to get player props for',
          },
          player: {
            type: 'string',
            description: 'Player name to filter props (optional - if not provided, returns all available player props)',
          },
          market: {
            type: 'string',
            description: 'Comma-separated list of prop markets to fetch. For NBA: points,rebounds,assists,threes. For NFL: pass_tds,pass_yds,rush_yds,receptions. For MLB: hits,total_bases,rbis,runs_scored. For NHL: points,shots_on_goal,blocked_shots. Leave empty for default markets.',
          },
        },
        required: ['sport'],
      },
    },
  },
]

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId, userId } = await req.json()

    if (!message || !conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Verify user authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Save user message
    await supabase.from('messages').insert({
      conversation_id: conversationId,
      role: 'user',
      content: message,
    })

    // Fetch conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const messages = (history || []).reverse()

    // Fetch user context
    const { data: userData } = await supabase
      .from('users')
      .select('current_bankroll, starting_bankroll')
      .eq('id', userId)
      .single()

    // Fetch active bets
    const { data: activeBets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('placed_at', { ascending: false })
      .limit(5)

    // Build context
    let contextMessage = `\n\n**Current User Context:**\n`
    if (userData) {
      contextMessage += `- Bankroll: $${userData.current_bankroll.toFixed(2)}\n`
      contextMessage += `- Starting: $${userData.starting_bankroll.toFixed(2)}\n`
    }
    if (activeBets && activeBets.length > 0) {
      contextMessage += `- Active bets: ${activeBets.length}\n`
    }

    // Determine if we need to fetch odds data
    const needsOdds = message.toLowerCase().match(
      /(odds|lines|spread|moneyline|total|over|under|bet|game|match|tonight|today|tomorrow|arbitrage|arb)/i
    )

    let oddsContext = ''
    if (needsOdds) {
      try {
        // Try to extract sport from message
        const messageLower = message.toLowerCase()

        // Comprehensive team name mapping with variations
        const teamVariations: { [key: string]: string[] } = {
          // NBA Teams (base name as key)
          'lakers': ['lakers', 'la lakers', 'los angeles lakers', 'l.a. lakers'],
          'warriors': ['warriors', 'golden state', 'gsw'],
          'celtics': ['celtics', 'boston'],
          'heat': ['heat', 'miami heat'],
          'bucks': ['bucks', 'milwaukee'],
          'suns': ['suns', 'phoenix'],
          'nets': ['nets', 'brooklyn'],
          'nuggets': ['nuggets', 'denver'],
          'clippers': ['clippers', 'la clippers', 'los angeles clippers'],
          'mavericks': ['mavericks', 'mavs', 'dallas'],
          'grizzlies': ['grizzlies', 'memphis'],
          'timberwolves': ['timberwolves', 'wolves', 'minnesota', 't-wolves'],
          'pelicans': ['pelicans', 'pels', 'new orleans'],
          'kings': ['kings', 'sacramento'],
          'sixers': ['76ers', 'sixers', 'philadelphia', 'philly'],
          'knicks': ['knicks', 'new york knicks', 'ny knicks'],
          'hawks': ['hawks', 'atlanta'],
          'bulls': ['bulls', 'chicago bulls'],
          'cavaliers': ['cavaliers', 'cavs', 'cleveland'],
          'raptors': ['raptors', 'toronto'],
          'pacers': ['pacers', 'indiana'],
          'magic': ['magic', 'orlando'],
          'hornets': ['hornets', 'charlotte'],
          'pistons': ['pistons', 'detroit'],
          'wizards': ['wizards', 'washington'],
          'thunder': ['thunder', 'okc', 'oklahoma city'],
          'jazz': ['jazz', 'utah'],
          'rockets': ['rockets', 'houston rockets'],
          'spurs': ['spurs', 'san antonio'],
          'blazers': ['blazers', 'trail blazers', 'portland'],
          // NFL Teams
          'chiefs': ['chiefs', 'kansas city', 'kc'],
          'bills': ['bills', 'buffalo'],
          'bengals': ['bengals', 'cincinnati'],
          'ravens': ['ravens', 'baltimore'],
          '49ers': ['49ers', 'niners', 'san francisco', 'sf'],
          'eagles': ['eagles', 'philadelphia eagles'],
          'cowboys': ['cowboys', 'dallas cowboys'],
          'packers': ['packers', 'green bay'],
          'rams': ['rams', 'la rams', 'los angeles rams'],
          'buccaneers': ['buccaneers', 'bucs', 'tampa bay', 'tampa'],
          'chargers': ['chargers', 'la chargers', 'los angeles chargers'],
          'dolphins': ['dolphins', 'miami dolphins'],
          'jets': ['jets', 'new york jets', 'ny jets'],
          'patriots': ['patriots', 'pats', 'new england'],
          'raiders': ['raiders', 'las vegas', 'lv raiders'],
          'broncos': ['broncos', 'denver broncos'],
          'colts': ['colts', 'indianapolis'],
          'jaguars': ['jaguars', 'jags', 'jacksonville'],
          'titans': ['titans', 'tennessee'],
          'texans': ['texans', 'houston texans'],
          'steelers': ['steelers', 'pittsburgh'],
          'browns': ['browns', 'cleveland browns'],
          'saints': ['saints', 'new orleans saints'],
          'seahawks': ['seahawks', 'seattle'],
          'panthers': ['panthers', 'carolina'],
          'falcons': ['falcons', 'atlanta falcons'],
          'cardinals': ['cardinals', 'arizona'],
          'vikings': ['vikings', 'minnesota vikings'],
          'lions': ['lions', 'detroit lions'],
          'bears': ['bears', 'chicago bears'],
          'commanders': ['commanders', 'washington'],
          'giants': ['giants', 'new york giants', 'ny giants'],
        }

        // Extract team names from message
        const extractTeamNames = (msg: string): string[] => {
          const foundTeams: string[] = []
          const lowerMsg = msg.toLowerCase()

          for (const [baseTeam, variations] of Object.entries(teamVariations)) {
            if (variations.some(variation => lowerMsg.includes(variation))) {
              foundTeams.push(baseTeam)
            }
          }

          return foundTeams
        }

        const mentionedTeams = extractTeamNames(messageLower)

        // Simple team lists for league detection
        const nbaTeams = ['lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
                         'sixers', 'bucks', 'raptors', 'mavericks', 'rockets', 'spurs',
                         'suns', 'clippers', 'nuggets', 'jazz', 'blazers', 'kings', 'thunder',
                         'timberwolves', 'pelicans', 'grizzlies', 'hornets', 'magic',
                         'wizards', 'pistons', 'pacers', 'cavaliers', 'hawks']

        const nflTeams = ['chiefs', 'bills', 'bengals', 'ravens', 'cowboys', 'eagles',
                         'packers', '49ers', 'rams', 'seahawks', 'buccaneers', 'saints',
                         'patriots', 'dolphins', 'jets', 'steelers', 'browns', 'raiders',
                         'chargers', 'broncos', 'colts', 'jaguars', 'titans', 'texans',
                         'panthers', 'falcons', 'cardinals', 'vikings', 'lions', 'bears',
                         'commanders', 'giants']

        const ncaafTeams = ['alabama', 'georgia', 'ohio state', 'michigan', 'oregon', 'texas',
                           'penn state', 'notre dame', 'usc', 'clemson', 'florida state', 'miami',
                           'lsu', 'oklahoma', 'tennessee', 'auburn', 'florida', 'texas a&m',
                           'ole miss', 'arkansas', 'kentucky', 'south carolina', 'missouri',
                           'wisconsin', 'iowa', 'nebraska', 'minnesota', 'northwestern',
                           'stanford', 'washington', 'ucla', 'utah', 'colorado', 'arizona state']

        let sports: string[] = []

        // Check for explicit sport mentions (prioritize specific leagues)
        // Basketball
        if (messageLower.match(/(ncaa|college basketball|ncaab|march madness|college hoops)/i)) {
          sports = ['basketball_ncaab']
        } else if (messageLower.match(/(nba|pro basketball)/i)) {
          sports = ['basketball_nba']
        } else if (messageLower.match(/basketball/i) && !messageLower.match(/(nba|ncaa|college)/i)) {
          sports = ['basketball_nba']
        }
        // Football
        else if (messageLower.match(/(ncaaf|college football|cfb)/i)) {
          sports = ['americanfootball_ncaaf']
        } else if (messageLower.match(/(nfl|pro football)/i)) {
          sports = ['americanfootball_nfl']
        } else if (messageLower.match(/football/i) && !messageLower.match(/(nfl|ncaa|college)/i)) {
          sports = ['americanfootball_nfl']
        }
        // Other sports
        else if (messageLower.match(/(mlb|baseball)/i)) {
          sports = ['baseball_mlb']
        } else if (messageLower.match(/(nhl|hockey)/i)) {
          sports = ['icehockey_nhl']
        }
        // Check for team names if no explicit sport
        else if (nbaTeams.some(team => messageLower.includes(team))) {
          sports = ['basketball_nba']
        } else if (nflTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_nfl']
        } else if (ncaafTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_ncaaf']
        }
        // If asking for arbitrage without specifying sport, fetch all major sports
        else if (messageLower.match(/(arbitrage|arb)/i)) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
        }
        // If no specific sport detected but user is asking about odds/games, fetch all major sports
        else if (needsOdds && sports.length === 0) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
        }

        if (sports.length > 0) {
          const allOddsData: any[] = []

          // Top 25 College Football Teams (updated weekly during season)
          const top25CFBTeams = [
            'oregon', 'georgia', 'ohio state', 'texas', 'penn state',
            'tennessee', 'indiana', 'notre dame', 'miami', 'byu',
            'ole miss', 'alabama', 'boise state', 'smu', 'army',
            'clemson', 'colorado', 'washington state', 'kansas state', 'lsu',
            'louisville', 'south carolina', 'missouri', 'tulane', 'iowa state'
          ]

          // Helper function to check if a team is Top 25
          const isTop25Team = (teamName: string): boolean => {
            const lowerTeamName = teamName.toLowerCase()
            return top25CFBTeams.some(ranked => lowerTeamName.includes(ranked))
          }

          // Fetch odds for each sport
          for (const sport of sports) {
            try {
              let oddsData = await fetchOdds(sport)

              // Filter NCAAF to only Top 25 matchups
              if (sport === 'americanfootball_ncaaf' && oddsData.length > 0) {
                oddsData = oddsData.filter(game =>
                  isTop25Team(game.home_team) || isTop25Team(game.away_team)
                )
              }

              // Filter by mentioned teams if any were detected
              if (mentionedTeams.length > 0 && oddsData.length > 0) {
                const filteredGames = oddsData.filter(game => {
                  const homeTeam = game.home_team.toLowerCase()
                  const awayTeam = game.away_team.toLowerCase()

                  return mentionedTeams.some(team => {
                    const variations = teamVariations[team] || [team]
                    return variations.some(variation =>
                      homeTeam.includes(variation) || awayTeam.includes(variation)
                    )
                  })
                })

                if (filteredGames.length > 0) {
                  oddsData = filteredGames
                }
              }

              if (oddsData.length > 0) {
                // Dynamic game limit based on query specificity
                let gameLimit = 5 // default
                if (mentionedTeams.length >= 2) {
                  gameLimit = 3 // Specific matchup query - fewer games needed
                } else if (mentionedTeams.length === 1) {
                  gameLimit = 5 // One team mentioned - show their games
                } else if (messageLower.match(/(arbitrage|arb)/i)) {
                  gameLimit = 15 // Arbitrage queries need more games
                } else {
                  gameLimit = 10 // General queries - show more options
                }

                allOddsData.push({
                  sport: sport,
                  games: oddsData.slice(0, gameLimit)
                })
              }
            } catch (err) {
              console.error(`Error fetching ${sport}:`, err)
            }
          }

          if (allOddsData.length > 0) {
            // Enrich odds with team stats and injury data
            const enrichedOddsData = await Promise.all(
              allOddsData.map(async (sportData) => {
                try {
                  const enrichedGames = await enrichGamesWithStats(sportData.games, sportData.sport)
                  return {
                    sport: sportData.sport,
                    games: sportData.games,
                    enrichedGames
                  }
                } catch (error) {
                  console.error(`Error enriching ${sportData.sport}:`, error)
                  return sportData
                }
              })
            )

            // Format odds data with enriched stats for the AI
            const formattedOdds = enrichedOddsData.map(sportData => ({
              sport: sportData.sport,
              games: sportData.games.map((game: any) => ({
                game: `${game.away_team} @ ${game.home_team}`,
                commence_time: game.commence_time,
                bookmakers: game.bookmakers.map((book: any) => ({
                  name: book.title,
                  markets: book.markets.map((market: any) => ({
                    type: market.key,
                    outcomes: market.outcomes
                  }))
                }))
              }))
            }))

            // Generate enriched stats summary for AI
            let statsEnrichment = '\n\n**📊 ENRICHED STATISTICS & INJURY DATA:**\n'
            for (const sportData of enrichedOddsData) {
              if (sportData.enrichedGames && sportData.enrichedGames.length > 0) {
                statsEnrichment += `\n**${sportData.sport.toUpperCase()}:**\n`
                statsEnrichment += formatEnrichedGamesForAI(sportData.enrichedGames)
                statsEnrichment += '\n'
              }
            }

            const totalGames = formattedOdds.reduce((sum, sport) => sum + sport.games.length, 0)

            oddsContext = `\n\n**🔴 CRITICAL - YOU HAVE LIVE ODDS DATA + STATISTICS 🔴**
YOU HAVE ACCESS TO REAL-TIME ODDS AND COMPREHENSIVE STATISTICS. DO NOT SAY YOU DON'T HAVE ACCESS.

**Data Summary:**
- ${formattedOdds.length} sport(s) with live odds
- ${totalGames} game(s) with odds from multiple bookmakers
- Data fetched from The Odds API specifically for this query
- Enriched with team stats, records, and injury reports
- Includes: ${formattedOdds.map(s => s.sport).join(', ')}

**YOUR TASK:**
Use the odds data AND statistics below to provide informed analysis. NEVER claim you don't have access.
- Compare bookmakers' odds for each game
- Consider team records, recent performance, and injuries in your analysis
- For any matchup questions, reference the stats data provided
- If additional stats are needed, use the get_stats function

**LIVE ODDS DATA:**
${JSON.stringify(
              formattedOdds,
              null,
              2
            )}

${statsEnrichment}\n`
          }
        }
      } catch (error) {
        console.error('Error fetching odds:', error)
        // Continue without odds data
      }
    }

    // Create OpenAI messages
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: SYSTEM_PROMPT + contextMessage + oddsContext,
      },
      ...messages
        .filter((msg) => msg.content && msg.content.trim().length > 0)
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: msg.content,
        })),
    ]

    // First call to check for function calls (non-streaming)
    const initialResponse = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: openaiMessages,
      tools: BANKROLL_FUNCTIONS,
      temperature: 0.7,
      max_tokens: 4000,
    })

    const initialMessage = initialResponse.choices[0].message

    // Check if AI wants to call a function
    if (initialMessage.tool_calls && initialMessage.tool_calls.length > 0) {
      // Execute the function call
      const tool_call = initialMessage.tool_calls[0]
      const functionName = tool_call.function.name
      const functionArgs = JSON.parse(tool_call.function.arguments)

      let functionResult: any

      // Execute the appropriate function
      if (functionName === 'settle_bet') {
        const { data: pendingBets } = await supabase
          .from('bets')
          .select('*')
          .eq('user_id', userId)
          .eq('status', 'pending')
          .order('placed_at', { ascending: false })

        // Find the bet matching the game description
        const matchingBet = pendingBets?.find((bet: any) =>
          bet.game_description.toLowerCase().includes(functionArgs.game_description.toLowerCase())
        )

        if (!matchingBet) {
          functionResult = { success: false, error: 'No pending bet found for that game' }
        } else {
          functionResult = await settleBet(supabase, userId, matchingBet.id, functionArgs.result)
        }
      } else if (functionName === 'log_bet') {
        functionResult = await logBet(supabase, userId, functionArgs, conversationId)
      } else if (functionName === 'adjust_bankroll') {
        functionResult = await adjustBankroll(supabase, userId, functionArgs.amount, functionArgs.type)
      } else if (functionName === 'get_stats') {
        // Fetch requested stats
        if (functionArgs.type === 'team') {
          const teamStats = await getTeamStats(functionArgs.sport, functionArgs.team)
          functionResult = {
            success: true,
            data: teamStats,
            formatted: formatStatsForAI(teamStats)
          }
        } else if (functionArgs.type === 'injuries') {
          const injuries = await getInjuryReports(functionArgs.sport)
          functionResult = {
            success: true,
            data: injuries,
            formatted: formatStatsForAI(injuries)
          }
        }
      } else if (functionName === 'get_player_props') {
        // Fetch player props from our API endpoint
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
          const params = new URLSearchParams({
            sport: functionArgs.sport
          })

          if (functionArgs.player) {
            params.append('player', functionArgs.player)
          }

          if (functionArgs.market) {
            params.append('market', functionArgs.market)
          }

          const response = await fetch(`${baseUrl}/api/player-props?${params.toString()}`)
          const propsData = await response.json()

          if (!response.ok) {
            functionResult = {
              success: false,
              error: propsData.error || 'Failed to fetch player props'
            }
          } else {
            // Format props data for AI
            let formatted = ''
            if (propsData.data && propsData.data.length > 0) {
              formatted = `Found ${propsData.count} player(s) with prop bets:\n\n`

              for (const playerProp of propsData.data) {
                formatted += `**${playerProp.player}**`
                if (playerProp.team) {
                  formatted += ` (${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
                }
                formatted += `\n`
                if (playerProp.game) {
                  formatted += `Game: ${playerProp.game}\n`
                }
                formatted += `\n`

                for (const [marketType, marketData] of Object.entries(playerProp.markets)) {
                  formatted += `  ${marketType.toUpperCase()}: Line ${marketData.line}\n`
                  formatted += `    Over: ${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})\n`
                  formatted += `    Under: ${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})\n`

                  // Show all books if there are multiple
                  if (marketData.over.allBooks.length > 1) {
                    formatted += `    All books: ${marketData.over.allBooks.map(b => `${b.book} ${b.odds > 0 ? '+' : ''}${b.odds}`).join(', ')}\n`
                  }
                  formatted += `\n`
                }
                formatted += `\n`
              }
            } else {
              formatted = 'No player props available for the specified criteria.'
            }

            functionResult = {
              success: true,
              data: propsData.data,
              count: propsData.count,
              formatted
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch player props: ${error.message}`
          }
        }
      }

      // Add function result to messages
      openaiMessages.push({
        role: 'assistant',
        content: initialMessage.content || null,
        tool_calls: initialMessage.tool_calls,
      } as any)

      openaiMessages.push({
        role: 'tool',
        content: JSON.stringify(functionResult),
        tool_call_id: tool_call.id,
      } as any)

      // Get final response with function result
      const stream = await openai.chat.completions.create({
        model: 'gpt-4-turbo-preview',
        messages: openaiMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 4000,
      })

      // Stream the response...
      const encoder = new TextEncoder()
      let fullResponse = ''
      const startTime = Date.now()

      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || ''
              if (content) {
                fullResponse += content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
              }
            }

            const latencyMs = Date.now() - startTime

            // Save assistant message
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponse,
            })

            // Track LLM interaction in PostHog
            trackLLMInteraction({
              userId: userId,
              model: 'gpt-4-turbo-preview',
              prompt: message,
              completion: fullResponse,
              latencyMs: latencyMs,
              conversationId: conversationId,
            })

            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // No function call, stream the initial response
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: openaiMessages,
      tools: BANKROLL_FUNCTIONS,
      stream: true,
      temperature: 0.7,
      max_tokens: 4000,
    })

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    let fullResponse = ''
    const startTime = Date.now()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              fullResponse += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }

          const latencyMs = Date.now() - startTime

          // Save assistant message
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullResponse,
          })

          // Track LLM interaction in PostHog
          trackLLMInteraction({
            userId: userId,
            model: 'gpt-4-turbo-preview',
            prompt: message,
            completion: fullResponse,
            latencyMs: latencyMs,
            conversationId: conversationId,
          })

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
