import { NextRequest, NextResponse } from 'next/server'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { openai, AI_MODELS } from '@/lib/ai-gateway-client'
import { guideTools, GUIDE_TOOL_NAMES } from '@/lib/guide/guide-tools'
import { GUIDE_SYSTEM_PROMPT, GUIDE_ANALYSIS_PROMPT } from '@/lib/guide/system-prompt'
import { classifyGuideIntent, getIntentResponsePrefix } from '@/lib/guide/intent-classifier'
import { fetchAllLiveScores } from '@/lib/live-scores'
import { getInjuries, getTeamAtsRecord, getTeams, type SportKey } from '@/lib/services/espn-orchestrator'
import { summarizeCoversSplitsForChat, summarizeCoversGameSplitsForChat } from '@/lib/providers/covers'
import { fetchOdds } from '@/lib/api/odds-api'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute is plenty for the guide

// Create Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Execute a guide tool and return the result.
 */
async function executeGuideTool(
  toolName: string,
  args: Record<string, unknown>
): Promise<string> {
  try {
    switch (toolName) {
      case GUIDE_TOOL_NAMES.LIVE_SCORES: {
        const sport = (args.sport as string) || 'nba'
        const teamFilter = (args.team as string)?.toLowerCase()
        const response = await fetchAllLiveScores({})
        const scores = response.games || []

        if (!scores || scores.length === 0) {
          return `No live games found for ${sport.toUpperCase()}.`
        }

        // Filter by sport and team
        const sportFiltered = scores.filter(g =>
          g.league?.toLowerCase() === sport.toLowerCase()
        )

        const filtered = teamFilter
          ? sportFiltered.filter(g => {
              const home = g.competitors?.find(c => c.homeAway === 'home')
              const away = g.competitors?.find(c => c.homeAway === 'away')
              return (
                home?.name.toLowerCase().includes(teamFilter) ||
                away?.name.toLowerCase().includes(teamFilter)
              )
            })
          : sportFiltered.slice(0, 5)

        if (filtered.length === 0) {
          return teamFilter
            ? `No games found matching "${args.team}" in ${sport.toUpperCase()}.`
            : `No live games found for ${sport.toUpperCase()}.`
        }

        const lines = filtered.map(g => {
          const home = g.competitors?.find(c => c.homeAway === 'home')
          const away = g.competitors?.find(c => c.homeAway === 'away')
          const stateStr = g.status?.state?.toLowerCase()
          const statusLabel = stateStr === 'in' ? 'LIVE' : stateStr === 'post' ? 'FINAL' : 'Upcoming'
          return `${away?.name || 'TBD'} ${away?.score ?? '-'} @ ${home?.name || 'TBD'} ${home?.score ?? '-'} (${statusLabel})`
        })

        return lines.join('\n')
      }

      case GUIDE_TOOL_NAMES.INJURIES: {
        const sport = (args.sport as string) || 'nba'
        const injuries = await getInjuries(sport as SportKey)

        if (!injuries || injuries.length === 0) {
          return `No injury reports available for ${sport.toUpperCase()}.`
        }

        // Get team name from injury entry (varies by sport)
        const getTeamName = (entry: unknown): string => {
          const e = entry as { displayName?: string; team?: { displayName?: string } }
          return e.displayName || e.team?.displayName || ''
        }

        // Filter by team if specified
        const teamFilter = (args.team as string)?.toLowerCase()
        const filtered = teamFilter
          ? injuries.filter(i => getTeamName(i).toLowerCase().includes(teamFilter))
          : injuries.slice(0, 10)

        if (filtered.length === 0) {
          return `No injuries found for "${args.team}".`
        }

        // Format injury entries
        const lines: string[] = []
        for (const entry of filtered) {
          const e = entry as { injuries?: Array<{ name?: string; status?: string; description?: string }> }
          const teamName = getTeamName(entry)
          if (e.injuries) {
            for (const inj of e.injuries.slice(0, 3)) {
              lines.push(`${inj.name || 'Unknown'} (${teamName}): ${inj.status || 'Unknown'} - ${inj.description || 'No details'}`)
            }
          }
        }

        return lines.length > 0 ? lines.join('\n') : `No injury details found for ${sport.toUpperCase()}.`
      }

      case GUIDE_TOOL_NAMES.BETTING_SPLITS: {
        const summary = await summarizeCoversSplitsForChat({})
        return summary || 'Unable to fetch betting splits at this time.'
      }

      case GUIDE_TOOL_NAMES.ANALYZE_SPLITS: {
        const gameId = args.game_id as string | undefined
        const teams = args.teams as string | undefined
        const summary = await summarizeCoversGameSplitsForChat({
          gameId,
          teams: teams ? [teams] : undefined
        })
        return summary || 'Unable to analyze game splits at this time.'
      }

      case GUIDE_TOOL_NAMES.TEAM_ATS: {
        const team = args.team as string
        const sport = (args.sport as string) || 'nba'

        // Find team ID
        const teams = await getTeams(sport as SportKey)
        const matchedTeam = teams?.find(t => {
          const name = (t.displayName || t.name || '').toLowerCase()
          const abbr = (t.abbreviation || '').toLowerCase()
          return name.includes(team.toLowerCase()) || abbr === team.toLowerCase()
        })

        if (!matchedTeam) {
          return `Could not find team "${team}" in ${sport.toUpperCase()}.`
        }

        const now = new Date()
        const month = now.getMonth() + 1
        const year = now.getFullYear()
        const season = sport === 'nba' || sport === 'nhl' ? (month >= 10 ? year + 1 : year) : year

        const atsData = await getTeamAtsRecord(sport as SportKey, matchedTeam.id, season)

        if (!atsData) {
          return `No ATS data available for ${matchedTeam.displayName}.`
        }

        const record = (atsData as { record?: { wins?: number; losses?: number; pushes?: number } }).record || atsData as { wins?: number; losses?: number; pushes?: number }
        return `${matchedTeam.displayName} ATS Record: ${record.wins || 0}-${record.losses || 0}-${record.pushes || 0}`
      }

      case GUIDE_TOOL_NAMES.UPCOMING_GAMES: {
        const sport = (args.sport as string) || 'nba'
        const teamFilter = (args.team as string)?.toLowerCase()

        // Map sport to odds-api sport key
        const sportKeyMap: Record<string, string> = {
          nba: 'basketball_nba',
          nfl: 'americanfootball_nfl',
          ncaab: 'basketball_ncaab',
          nhl: 'icehockey_nhl',
        }
        const sportKey = sportKeyMap[sport] || 'basketball_nba'

        const games = await fetchOdds(sportKey, ['spreads', 'totals'], {
          forceProvider: 'sportsbettingdime',
        })

        if (!games || games.length === 0) {
          return `No upcoming games found for ${sport.toUpperCase()}.`
        }

        // Filter by team if specified
        const filtered = teamFilter
          ? games.filter(g =>
              g.home_team.toLowerCase().includes(teamFilter) ||
              g.away_team.toLowerCase().includes(teamFilter)
            )
          : games.slice(0, 6)

        if (filtered.length === 0) {
          return `No games found matching "${args.team}" in ${sport.toUpperCase()}.`
        }

        const lines = filtered.map(g => {
          const gameTime = new Date(g.commence_time).toLocaleString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short',
          })

          // Get consensus spread and total from first bookmaker
          const book = g.bookmakers?.[0]
          const spreadsMarket = book?.markets?.find(m => m.key === 'spreads')
          const totalsMarket = book?.markets?.find(m => m.key === 'totals')

          const homeSpread = spreadsMarket?.outcomes?.find(o => o.name === g.home_team)
          const total = totalsMarket?.outcomes?.find(o => o.name === 'Over')

          const spreadStr = homeSpread?.point !== undefined
            ? `${g.home_team} ${homeSpread.point > 0 ? '+' : ''}${homeSpread.point}`
            : 'N/A'
          const totalStr = total?.point !== undefined ? `O/U ${total.point}` : 'N/A'

          return `**${g.away_team} @ ${g.home_team}**\n  ${gameTime}\n  Spread: ${spreadStr} | Total: ${totalStr}`
        })

        return lines.join('\n\n')
      }

      case GUIDE_TOOL_NAMES.GAME_ODDS: {
        const team = (args.team as string)?.toLowerCase()
        const sport = (args.sport as string) || 'nba'

        if (!team) {
          return 'Please specify a team to get odds for.'
        }

        // Map sport to odds-api sport key
        const sportKeyMap: Record<string, string> = {
          nba: 'basketball_nba',
          nfl: 'americanfootball_nfl',
          ncaab: 'basketball_ncaab',
          nhl: 'icehockey_nhl',
        }
        const sportKey = sportKeyMap[sport] || 'basketball_nba'

        const games = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], {
          forceProvider: 'sportsbettingdime',
        })

        // Find the game matching the team
        const game = games?.find(g =>
          g.home_team.toLowerCase().includes(team) ||
          g.away_team.toLowerCase().includes(team)
        )

        if (!game) {
          return `No upcoming games found for "${args.team}" in ${sport.toUpperCase()}.`
        }

        const gameTime = new Date(game.commence_time).toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })

        // Collect odds from multiple books
        const oddsLines: string[] = [`**${game.away_team} @ ${game.home_team}**`, `${gameTime}`, '']

        // Get consensus from first major book
        const book = game.bookmakers?.[0]
        if (book) {
          const h2hMarket = book.markets?.find(m => m.key === 'h2h')
          const spreadsMarket = book.markets?.find(m => m.key === 'spreads')
          const totalsMarket = book.markets?.find(m => m.key === 'totals')

          if (spreadsMarket) {
            const homeSpread = spreadsMarket.outcomes?.find(o => o.name === game.home_team)
            const awaySpread = spreadsMarket.outcomes?.find(o => o.name === game.away_team)
            if (homeSpread && awaySpread) {
              oddsLines.push(`**Spread:**`)
              oddsLines.push(`  ${game.away_team}: ${awaySpread.point! > 0 ? '+' : ''}${awaySpread.point} (${awaySpread.price > 0 ? '+' : ''}${awaySpread.price})`)
              oddsLines.push(`  ${game.home_team}: ${homeSpread.point! > 0 ? '+' : ''}${homeSpread.point} (${homeSpread.price > 0 ? '+' : ''}${homeSpread.price})`)
            }
          }

          if (totalsMarket) {
            const over = totalsMarket.outcomes?.find(o => o.name === 'Over')
            const under = totalsMarket.outcomes?.find(o => o.name === 'Under')
            if (over && under) {
              oddsLines.push(`**Total:** ${over.point}`)
              oddsLines.push(`  Over: ${over.price > 0 ? '+' : ''}${over.price}`)
              oddsLines.push(`  Under: ${under.price > 0 ? '+' : ''}${under.price}`)
            }
          }

          if (h2hMarket) {
            const awayML = h2hMarket.outcomes?.find(o => o.name === game.away_team)
            const homeML = h2hMarket.outcomes?.find(o => o.name === game.home_team)
            if (awayML && homeML) {
              oddsLines.push(`**Moneyline:**`)
              oddsLines.push(`  ${game.away_team}: ${awayML.price > 0 ? '+' : ''}${awayML.price}`)
              oddsLines.push(`  ${game.home_team}: ${homeML.price > 0 ? '+' : ''}${homeML.price}`)
            }
          }

          oddsLines.push(`\n_Odds via ${book.title}_`)
        }

        return oddsLines.join('\n')
      }

      default:
        return `Unknown tool: ${toolName}`
    }
  } catch (error) {
    console.error(`Tool execution error (${toolName}):`, error)
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : 'Unknown error'}`
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationId, userId, history = [] } = body as {
      message: string
      conversationId?: string
      userId?: string
      history?: ChatMessage[]
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Save user message to database if conversationId provided
    if (conversationId && userId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
      })
    }

    // Classify the user's intent
    const intent = classifyGuideIntent(message)
    const intentPrefix = getIntentResponsePrefix(intent)

    let responseContent: string

    // Handle intents that don't need LLM
    if (intent.type === 'PAGE_ROUTE') {
      const cards = intent.pages.map(page =>
        page === intent.recommendedPage
          ? `[PAGE_CARD:${page}:recommended]`
          : `[PAGE_CARD:${page}]`
      ).join('\n')

      responseContent = `${intentPrefix}\n\n${cards}`
    } else if (intent.type === 'INLINE_SCORE') {
      responseContent = `${intentPrefix}\n\n[LIVE_SCORE:${intent.team}:${intent.sport}]`
    } else if (intent.type === 'INLINE_STATS') {
      responseContent = `${intentPrefix}\n\n[STATS:${intent.entityType}:${intent.name}:${intent.sport}]`
    } else if (intent.type === 'OFF_TOPIC') {
      responseContent = "I'm focused on sports betting - can I help you find some bets or explain betting concepts instead?"
    } else if (intent.type === 'GAME_INFO') {
      // Fetch game data using tools, then provide page links for deeper analysis
      try {
        const sport = intent.sport || 'nba'
        let gameData: string

        if (intent.team) {
          // User asked about a specific team - get their game odds
          gameData = await executeGuideTool(GUIDE_TOOL_NAMES.GAME_ODDS, {
            team: intent.team,
            sport,
          })
        } else {
          // User asked about schedule in general
          gameData = await executeGuideTool(GUIDE_TOOL_NAMES.UPCOMING_GAMES, {
            sport,
          })
        }

        // Add page cards for deeper analysis
        const pageCards = `\n\nFor projections and edge analysis:\n\n[PAGE_CARD:market-projections:recommended]\n[PAGE_CARD:player-projections]`

        responseContent = gameData + pageCards
      } catch (error) {
        console.error('[Chat API] Game info fetch failed:', error)
        responseContent = `I couldn't fetch the game info right now. Check out our tools:\n\n[PAGE_CARD:market-projections:recommended]\n[PAGE_CARD:live-scores]`
      }
    } else {
      // Build messages for LLM
      const messages: ChatCompletionMessageParam[] = [
        { role: 'system', content: GUIDE_SYSTEM_PROMPT },
        ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
        { role: 'user', content: message },
      ]

      // For LINE_MOVEMENT intent, use tools
      // For EDUCATION, ADVICE, and CONVERSATION, let LLM handle directly
      const useTools = intent.type === 'LINE_MOVEMENT'

      try {
        console.log(`[Chat API] Calling LLM with model: ${AI_MODELS.chat}, intent: ${intent.type}`)

        const completion = await openai.chat.completions.create({
          model: AI_MODELS.chat,
          messages,
          tools: useTools ? guideTools : undefined,
          tool_choice: useTools ? 'auto' : undefined,
          max_completion_tokens: 1024,
        })

        const assistantMessage = completion.choices[0]?.message

        // Handle tool calls
        if (assistantMessage?.tool_calls && assistantMessage.tool_calls.length > 0) {
          const toolResults: string[] = []

          for (const toolCall of assistantMessage.tool_calls) {
            const toolName = toolCall.function.name
            const toolArgs = JSON.parse(toolCall.function.arguments || '{}')
            const result = await executeGuideTool(toolName, toolArgs)
            toolResults.push(`**${toolName}:**\n${result}`)
          }

          // Second LLM call to synthesize results
          const analysisMessages: ChatCompletionMessageParam[] = [
            { role: 'system', content: GUIDE_ANALYSIS_PROMPT },
            { role: 'user', content: `User asked: "${message}"\n\nTool results:\n${toolResults.join('\n\n')}\n\nProvide a concise summary for the user.` },
          ]

          const analysisCompletion = await openai.chat.completions.create({
            model: AI_MODELS.chat,
            messages: analysisMessages,
            max_completion_tokens: 512,
          })

          responseContent = analysisCompletion.choices[0]?.message?.content || 'Unable to analyze the data.'
        } else {
          // Direct response from LLM
          responseContent = assistantMessage?.content || "I'm not sure how to help with that. Can you try rephrasing your question?"
        }
      } catch (llmError: any) {
        console.error('[Chat API] LLM call failed:', llmError?.message || llmError)
        // Provide a helpful fallback for advice queries
        if (intent.type === 'ADVICE' || intent.type === 'EDUCATION') {
          responseContent = `Here are some key tips for becoming a profitable bettor:

**1. Find Value, Not Winners**
Don't just pick who will win - find lines where the true probability differs from what the odds imply.

**2. Track Everything**
Record every bet you make. This helps identify what's working and what isn't.

**3. Bankroll Management**
Never bet more than 1-5% of your bankroll on a single play. This protects you from variance.

**4. Shop Lines**
Compare odds across multiple sportsbooks. Even half a point matters over hundreds of bets.

**5. Focus on CLV (Closing Line Value)**
Consistently beating the closing line is the best predictor of long-term profitability.

Check out our tools to help:

[PAGE_CARD:market-projections:recommended]
[PAGE_CARD:sharp-props]`
        } else {
          responseContent = "I'm having trouble processing that request. Please try again in a moment."
        }
      }
    }

    // Save assistant response to database if conversationId provided
    if (conversationId && userId) {
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'assistant',
        content: responseContent,
      })
    }

    return NextResponse.json({
      response: responseContent,
      intent: intent.type,
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    )
  }
}
