import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
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
    actualResult = parseFloat(bet.stake) + parseFloat(bet.potential_win)
  } else if (result === 'push') {
    actualResult = parseFloat(bet.stake)
  } else if (result === 'lost') {
    actualResult = 0
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

const SYSTEM_PROMPT = `You are Delta AI, a professional sports betting assistant. Your role is to help users analyze betting opportunities, manage their bankroll, and understand sports betting markets.

**Available Sports:**
You have access to live odds data for NBA, NCAA Basketball (NCAAB), NFL, NCAA Football (NCAAF), MLB, and NHL. When users ask about games in these sports, you will receive real-time odds data.

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
- Compare moneyline, spreads, and totals across different sportsbooks
- Highlight which sportsbook has the best odds for each market
- NEVER suggest where to bet, only present the data objectively
- If a user asks about a specific game and you have the data, show it immediately

**Arbitrage Opportunities:**
When users ask for arbitrage opportunities, you MUST:
1. **Calculate actual arbitrage** from the live odds data provided
2. Use the formula: For an arbitrage to exist, (1/decimal_odds_A) + (1/decimal_odds_B) < 1
3. Convert American odds to decimal: positive odds = (odds/100) + 1, negative odds = (100/|odds|) + 1
4. Show ONLY games with real arbitrage opportunities
5. Format as: "**[Game]**: Bet [Amount] on [Team A] at [Book] ([Odds]) + Bet [Amount] on [Team B] at [Book] ([Odds]) = [Profit]%"
6. If no arbitrage exists, say "No arbitrage opportunities found in current odds"
7. NEVER explain what arbitrage is unless asked - just show the opportunities
8. Keep it under 10 lines total

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
      /(odds|lines|spread|moneyline|total|over|under|bet|game|match|tonight|today|tomorrow)/i
    )

    let oddsContext = ''
    if (needsOdds) {
      try {
        // Try to extract sport from message
        const messageLower = message.toLowerCase()

        // NBA team names detection
        const nbaTeams = ['lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
                         'sixers', 'bucks', 'raptors', 'mavericks', 'rockets', 'spurs',
                         'suns', 'clippers', 'nuggets', 'jazz', 'blazers', 'kings', 'thunder',
                         'timberwolves', 'pelicans', 'grizzlies', 'hornets', 'magic',
                         'wizards', 'pistons', 'pacers', 'cavaliers', 'hawks']

        // NFL team names detection
        const nflTeams = ['chiefs', 'bills', 'bengals', 'ravens', 'cowboys', 'eagles',
                         'packers', '49ers', 'rams', 'seahawks', 'buccaneers', 'saints',
                         'patriots', 'dolphins', 'jets', 'steelers', 'browns', 'raiders',
                         'chargers', 'broncos', 'colts', 'jaguars', 'titans', 'texans',
                         'panthers', 'falcons', 'cardinals', 'vikings', 'lions', 'bears',
                         'commanders', 'giants']

        // Major NCAA Football teams detection
        const ncaafTeams = ['alabama', 'georgia', 'ohio state', 'michigan', 'oregon', 'texas',
                           'penn state', 'notre dame', 'usc', 'clemson', 'florida state', 'miami',
                           'lsu', 'oklahoma', 'tennessee', 'auburn', 'florida', 'texas a&m',
                           'ole miss', 'arkansas', 'kentucky', 'south carolina', 'missouri',
                           'wisconsin', 'iowa', 'nebraska', 'minnesota', 'northwestern',
                           'stanford', 'washington', 'ucla', 'utah', 'colorado', 'arizona state']

        let sport = ''

        // Check for explicit sport mentions (prioritize specific leagues)
        // Basketball
        if (messageLower.match(/(ncaa|college basketball|ncaab|march madness|college hoops)/i)) {
          sport = 'basketball_ncaab'
        } else if (messageLower.match(/(nba|pro basketball)/i)) {
          sport = 'basketball_nba'
        } else if (messageLower.match(/basketball/i) && !messageLower.match(/(nba|ncaa|college)/i)) {
          sport = 'basketball_nba'
        }
        // Football
        else if (messageLower.match(/(ncaaf|college football|cfb)/i)) {
          sport = 'americanfootball_ncaaf'
        } else if (messageLower.match(/(nfl|pro football)/i)) {
          sport = 'americanfootball_nfl'
        } else if (messageLower.match(/football/i) && !messageLower.match(/(nfl|ncaa|college)/i)) {
          sport = 'americanfootball_nfl'
        }
        // Other sports
        else if (messageLower.match(/(mlb|baseball)/i)) {
          sport = 'baseball_mlb'
        } else if (messageLower.match(/(nhl|hockey)/i)) {
          sport = 'icehockey_nhl'
        }
        // Check for team names if no explicit sport
        else if (nbaTeams.some(team => messageLower.includes(team))) {
          sport = 'basketball_nba'
        } else if (nflTeams.some(team => messageLower.includes(team))) {
          sport = 'americanfootball_nfl'
        } else if (ncaafTeams.some(team => messageLower.includes(team))) {
          sport = 'americanfootball_ncaaf'
        }

        if (sport) {
          const oddsData = await fetchOdds(sport)
          if (oddsData.length > 0) {
            // Format odds data more cleanly for the AI
            const formattedOdds = oddsData.map(game => ({
              game: `${game.away_team} @ ${game.home_team}`,
              commence_time: game.commence_time,
              bookmakers: game.bookmakers.map(book => ({
                name: book.title,
                markets: book.markets.map(market => ({
                  type: market.key,
                  outcomes: market.outcomes
                }))
              }))
            }))

            oddsContext = `\n\n**Live Odds Data (from The Odds API):**\nUse this data to answer the user's question. Present it in a clean table format comparing sportsbooks.\n${JSON.stringify(
              formattedOdds.slice(0, 5),
              null,
              2
            )}\n`
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
      ...messages.map((msg) => ({
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
      max_tokens: 1000,
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
        max_tokens: 1000,
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
      max_tokens: 1000,
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
