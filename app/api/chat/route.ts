import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export const runtime = 'edge'

const SYSTEM_PROMPT = `You are Delta AI, a professional sports betting assistant. Your role is to help users analyze betting opportunities, manage their bankroll, and understand sports betting markets.

**Core Principles:**
1. Never make picks or tell users what to bet
2. Provide tools, data, and analysis only
3. Always emphasize responsible gambling
4. Keep responses concise (3-5 sentences for simple queries)
5. Use data and statistics to support insights

**Response Guidelines:**
- For odds queries: Show comparison tables with best values highlighted
- For analysis queries: Explain line movement, CLV, public vs sharp indicators
- For bankroll queries: Confirm actions and provide relevant insights
- Always acknowledge uncertainty in sports outcomes
- Use Markdown formatting for structure (tables, lists, bold)

**Prohibited:**
- Never say "bet on X" or "this is a good bet"
- Never guarantee outcomes
- Never encourage increasing bet sizes after losses
- Never promote chasing losses

If asked about current games, odds, or lines, you can fetch live data from The Odds API.`

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
      /(odds|lines|spread|moneyline|total|over|under|bet)/i
    )

    let oddsContext = ''
    if (needsOdds) {
      try {
        // Try to extract sport from message
        const sportMatch = message.toLowerCase().match(
          /(nba|nfl|mlb|nhl|basketball|football|baseball|hockey)/i
        )
        if (sportMatch) {
          const sportMap: Record<string, string> = {
            nba: 'basketball_nba',
            basketball: 'basketball_nba',
            nfl: 'americanfootball_nfl',
            football: 'americanfootball_nfl',
            mlb: 'baseball_mlb',
            baseball: 'baseball_mlb',
            nhl: 'icehockey_nhl',
            hockey: 'icehockey_nhl',
          }

          const sport = sportMap[sportMatch[1].toLowerCase()]
          if (sport) {
            const oddsData = await fetchOdds(sport)
            if (oddsData.length > 0) {
              oddsContext = `\n\n**Live Odds Data Available:**\n${JSON.stringify(
                oddsData.slice(0, 5),
                null,
                2
              )}\n`
            }
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

    // Stream response from OpenAI
    const stream = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview',
      messages: openaiMessages,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000,
    })

    // Create a readable stream for the response
    const encoder = new TextEncoder()
    let fullResponse = ''

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

          // Save assistant message
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: fullResponse,
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
