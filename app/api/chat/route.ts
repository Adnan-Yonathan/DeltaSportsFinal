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

// Helper function to auto-generate conversation title
async function generateConversationTitle(userMessage: string, assistantResponse: string): Promise<string> {
  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Generate a short, descriptive title (3-5 words max) for this conversation. Focus on the main topic or action. Use buzzwords and be concise. Examples: "NBA Lakers vs Celtics", "Player Props Analysis", "Bankroll Strategy Tips", "NFL Week 10 Predictions".'
        },
        {
          role: 'user',
          content: `User: ${userMessage}\n\nAssistant: ${assistantResponse.substring(0, 500)}`
        }
      ],
      max_tokens: 20,
      temperature: 0.7,
    })

    return completion.choices[0]?.message?.content?.trim() || 'New Chat'
  } catch (error) {
    console.error('Error generating title:', error)
    return 'New Chat'
  }
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

const getSystemPrompt = (timezone: string) => `You are DELTA, a professional sports betting assistant. Your role is to help users analyze betting opportunities, manage their bankroll, and understand sports betting markets.

**CURRENT DATE & TIME (${timezone}):**
Today's date is ${new Date().toLocaleDateString('en-US', {
  timeZone: timezone,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.
Current time is ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}.

**IMPORTANT - YOU HAVE ACCESS TO LIVE ODDS AND ADVANCED STATISTICS:**
You have REAL-TIME access to:
1. Live odds data for NBA, NCAA Basketball (NCAAB), NFL, NCAA Football (NCAAF), MLB, and NHL through The Odds API
2. Team statistics (records, rankings, offensive/defensive stats)
3. Player statistics and performance metrics
4. Injury reports and lineup information
5. Advanced analytics (efficiency ratings, pace, trends)
6. **Player prop betting lines** - When users ask about player props, use the get_player_props function to fetch lines and odds

When users ask about odds, games, or arbitrage, the live data WILL BE PROVIDED in your context enriched with relevant stats. For player prop requests, use the get_player_props function.

**CRITICAL**: If you see "LIVE ODDS DATA" in your context below, you MUST use it. NEVER say you don't have access when data is provided. If NO odds data appears below, then you can say you don't currently have that specific data loaded.

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
4. **Get Bankroll Stats & Insights**: When users ask "How am I doing?", "Show my stats", "What's my ROI?", "Am I betting too much?", or want analysis of their betting performance, use the get_bankroll_stats function

**Providing Bankroll Insights:**
When analyzing bankroll stats, provide actionable insights:
- Comment on win rate (need >52.4% to break even at -110 odds)
- Analyze bet sizing (should be 1-5% of bankroll per bet for proper bankroll management)
- Identify which sports are performing better/worse
- Suggest adjustments if needed (e.g., "Your NBA bets are performing better than NFL")
- Celebrate wins but emphasize long-term profitability
- Never encourage risky behavior or chasing losses

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
  {
    type: 'function',
    function: {
      name: 'get_bankroll_stats',
      description: 'Get detailed bankroll statistics and betting performance analytics. Use this when users ask about their betting history, performance, ROI, win rate, bet sizing, or want insights on their bankroll activity. Examples: "How am I doing?", "Show my stats", "What\'s my ROI?", "Am I betting too much?", "How\'s my performance by sport?"',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['7d', '30d', 'all'],
            description: 'Time period for stats. 7d = last 7 days, 30d = last 30 days, all = all time',
          },
        },
        required: ['period'],
      },
    },
  },
]

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      conversationId,
      userId,
      timezone = 'America/New_York' // Default fallback
    } = await req.json()

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
      console.log('[ODDS] Odds request detected, fetching data...')
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

          for (const [baseTeam, variations] of Object.entries(teamVariations) as [string, string[]][]) {
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

              // Filter games to user's "today" in their timezone
              if (oddsData.length > 0) {
                const now = new Date()
                const todayInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }))
                const startOfDay = new Date(todayInUserTZ)
                startOfDay.setHours(0, 0, 0, 0)
                const endOfDay = new Date(todayInUserTZ)
                endOfDay.setHours(23, 59, 59, 999)

                oddsData = oddsData.filter(game => {
                  const gameTime = new Date(game.commence_time)
                  const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))
                  return gameInUserTZ >= startOfDay && gameInUserTZ <= endOfDay
                })
              }

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
            console.log(`[ODDS] Successfully fetched odds for ${allOddsData.length} sport(s)`)

            // Helper to format game time in user's timezone
            const formatGameTime = (commence_time: string) => {
              return new Date(commence_time).toLocaleString('en-US', {
                timeZone: timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short'
              })
            }

            // Format odds data FIRST (don't let enrichment failures break everything)
            const formattedOdds = allOddsData.map(sportData => ({
              sport: sportData.sport,
              games: sportData.games.map((game: any) => ({
                game: `${game.away_team} @ ${game.home_team}`,
                commence_time: game.commence_time,
                commence_time_formatted: formatGameTime(game.commence_time),
                bookmakers: game.bookmakers.map((book: any) => ({
                  name: book.title,
                  markets: book.markets.map((market: any) => ({
                    type: market.key,
                    outcomes: market.outcomes
                  }))
                }))
              }))
            }))

            const totalGames = formattedOdds.reduce((sum, sport) => sum + sport.games.length, 0)
            console.log(`[ODDS] Total games formatted: ${totalGames}`)

            // Try to enrich with stats (but don't fail if this errors)
            let statsEnrichment = ''
            try {
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
                    console.error(`[ODDS] Error enriching ${sportData.sport}:`, error)
                    return { ...sportData, enrichedGames: [] }
                  }
                })
              )

              // Generate enriched stats summary for AI
              statsEnrichment = '\n\n**📊 ENRICHED STATISTICS & INJURY DATA:**\n'
              for (const sportData of enrichedOddsData) {
                if (sportData.enrichedGames && sportData.enrichedGames.length > 0) {
                  statsEnrichment += `\n**${sportData.sport.toUpperCase()}:**\n`
                  statsEnrichment += formatEnrichedGamesForAI(sportData.enrichedGames)
                  statsEnrichment += '\n'
                }
              }
            } catch (enrichError) {
              console.error('[ODDS] Stats enrichment failed, continuing with odds only:', enrichError)
              statsEnrichment = '\n(Stats enrichment unavailable)\n'
            }

            oddsContext = `\n\n**🔴 LIVE ODDS DATA LOADED 🔴**
YOU HAVE REAL-TIME ODDS DATA. USE IT. DO NOT SAY YOU DON'T HAVE ACCESS.

**Data Available:**
- ${formattedOdds.length} sport(s): ${formattedOdds.map(s => s.sport.replace('basketball_', '').replace('americanfootball_', '').replace('icehockey_', '').toUpperCase()).join(', ')}
- ${totalGames} game(s) today/upcoming
- Multiple bookmakers per game
- Current as of ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}

**YOUR TASK:**
Present this odds data to the user. Create a table or list showing:
- Game matchups
- Available odds from different sportsbooks
- Highlight best odds for each market

**LIVE ODDS DATA:**
${JSON.stringify(
              formattedOdds,
              null,
              2
            )}

${statsEnrichment}\n`

            console.log(`[ODDS] Context built successfully, length: ${oddsContext.length} characters`)
          } else {
            console.log('[ODDS] No games found after filtering')
          }
        } else {
          console.log('[ODDS] No sports detected for odds fetching')
        }
      } catch (error) {
        console.error('[ODDS] Critical error fetching odds:', error)
        // Add a note to context about the error
        oddsContext = '\n\n(Note: Odds data temporarily unavailable due to API error)\n'
      }
    }

    // Create OpenAI messages
    const openaiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSystemPrompt(timezone) + contextMessage + oddsContext,
      },
      ...messages
        .filter((msg) => {
          // Ensure content exists and is a non-empty string
          return msg.content != null &&
                 typeof msg.content === 'string' &&
                 msg.content.trim().length > 0
        })
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: String(msg.content), // Ensure content is always a string
        })),
    ]

    // First call to check for function calls (non-streaming)
    const initialResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
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

                for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
                  formatted += `  ${marketType.toUpperCase()}: Line ${marketData.line}\n`
                  formatted += `    Over: ${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})\n`
                  formatted += `    Under: ${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})\n`

                  // Show all books if there are multiple
                  if (marketData.over.allBooks.length > 1) {
                    formatted += `    All books: ${marketData.over.allBooks.map((b: any) => `${b.book} ${b.odds > 0 ? '+' : ''}${b.odds}`).join(', ')}\n`
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
      } else if (functionName === 'get_bankroll_stats') {
        // Fetch bankroll statistics
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3002'
          const period = functionArgs.period || 'all'

          const response = await fetch(`${baseUrl}/api/bankroll/stats?period=${period}`)
          const statsData = await response.json()

          if (!response.ok) {
            functionResult = {
              success: false,
              error: statsData.error || 'Failed to fetch bankroll stats'
            }
          } else {
            // Format stats for AI analysis
            const {
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
              bySport
            } = statsData

            const periodLabel = period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'

            let formatted = `**Bankroll Statistics (${periodLabel})**\n\n`
            formatted += `**Overall Performance:**\n`
            formatted += `- Current Balance: $${currentBalance.toFixed(2)}\n`
            formatted += `- Starting Balance: $${startingBalance.toFixed(2)}\n`
            formatted += `- Total Profit/Loss: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}\n`
            formatted += `- ROI: ${roi.toFixed(2)}%\n`
            formatted += `- Win Rate: ${winRate.toFixed(1)}% (${wonBets}W-${lostBets}L-${pushBets}P)\n\n`

            formatted += `**Betting Activity:**\n`
            formatted += `- Total Bets: ${totalBets} (${pendingBets} pending)\n`
            formatted += `- Average Bet Size: $${avgBetSize.toFixed(2)}\n`
            formatted += `- Biggest Win: $${biggestWin.toFixed(2)}\n`
            formatted += `- Biggest Loss: $${Math.abs(biggestLoss).toFixed(2)}\n\n`

            if (Object.keys(bySport).length > 0) {
              formatted += `**Performance by Sport:**\n`
              for (const [sport, data] of Object.entries(bySport) as [string, any][]) {
                formatted += `- ${sport.toUpperCase()}: ${data.won}W-${data.lost}L (${data.winRate.toFixed(1)}% WR, ${data.roi.toFixed(1)}% ROI, $${data.profit.toFixed(2)} profit)\n`
              }
            }

            functionResult = {
              success: true,
              stats: statsData,
              formatted,
              insights: {
                isPositive: totalProfit > 0,
                isBreakingEven: totalProfit >= -50 && totalProfit <= 50,
                hasGoodWinRate: winRate >= 52.4, // Breakeven at -110 odds
                avgBetSizeVsBankroll: (avgBetSize / currentBalance * 100).toFixed(1),
                bestSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => b[1].roi - a[1].roi)[0]?.[0],
                worstSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => a[1].roi - b[1].roi)[0]?.[0]
              }
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch bankroll stats: ${error.message}`
          }
        }
      }

      // Add function result to messages
      const assistantMessage: any = {
        role: 'assistant',
        tool_calls: initialMessage.tool_calls,
      }
      // Only include content if it exists (OpenAI requires string or omitted, not null)
      if (initialMessage.content) {
        assistantMessage.content = initialMessage.content
      }
      openaiMessages.push(assistantMessage)

      openaiMessages.push({
        role: 'tool',
        content: JSON.stringify(functionResult),
        tool_call_id: tool_call.id,
      } as any)

      // Get final response with function result
      const stream = await openai.chat.completions.create({
        model: 'gpt-4o',
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

            // Save assistant message (only if it has content)
            if (fullResponse && fullResponse.trim().length > 0) {
              await supabase.from('messages').insert({
                conversation_id: conversationId,
                role: 'assistant',
                content: fullResponse,
              })
            }

            // Auto-generate title for first exchange
            const { count: messageCount } = await supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .eq('conversation_id', conversationId)

            if (messageCount === 2) {
              // This is the first exchange, generate a title
              const title = await generateConversationTitle(message, fullResponse)
              await supabase
                .from('conversations')
                .update({ title })
                .eq('id', conversationId)
            }

            // Track LLM interaction in PostHog
            trackLLMInteraction({
              userId: userId,
              model: 'gpt-4o',
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
      model: 'gpt-4o',
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

          // Save assistant message (only if it has content)
          if (fullResponse && fullResponse.trim().length > 0) {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponse,
            })
          }

          // Auto-generate title for first exchange
          const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)

          if (messageCount === 2) {
            // This is the first exchange, generate a title
            const title = await generateConversationTitle(message, fullResponse)
            await supabase
              .from('conversations')
              .update({ title })
              .eq('id', conversationId)
          }

          // Track LLM interaction in PostHog
          trackLLMInteraction({
            userId: userId,
            model: 'gpt-4o',
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
