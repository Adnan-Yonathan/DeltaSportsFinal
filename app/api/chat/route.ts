import { NextRequest, NextResponse } from 'next/server'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { openai, AI_MODELS } from '@/lib/ai-gateway-client'
import { guideTools, GUIDE_TOOL_NAMES } from '@/lib/guide/guide-tools'
import { GUIDE_SYSTEM_PROMPT, GUIDE_ANALYSIS_PROMPT } from '@/lib/guide/system-prompt'
import { classifyGuideIntent, getIntentResponsePrefix } from '@/lib/guide/intent-classifier'
import { fetchAllLiveScores } from '@/lib/live-scores'
import { getInjuries, getTeamAtsRecord, getTeams, type SportKey } from '@/lib/services/espn-orchestrator'
import { summarizeCoversSplitsForChat, summarizeCoversGameSplitsForChat } from '@/lib/providers/covers'

export const runtime = 'nodejs'
export const maxDuration = 60 // 1 minute is plenty for the guide

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
    const { message, history = [] } = body as {
      message: string
      history?: ChatMessage[]
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message required' }, { status: 400 })
    }

    // Classify the user's intent
    const intent = classifyGuideIntent(message)
    const intentPrefix = getIntentResponsePrefix(intent)

    // Handle intents that don't need LLM
    if (intent.type === 'PAGE_ROUTE') {
      const cards = intent.pages.map(page =>
        page === intent.recommendedPage
          ? `[PAGE_CARD:${page}:recommended]`
          : `[PAGE_CARD:${page}]`
      ).join('\n')

      return NextResponse.json({
        response: `${intentPrefix}\n\n${cards}`,
        intent: intent.type,
      })
    }

    if (intent.type === 'INLINE_SCORE') {
      return NextResponse.json({
        response: `${intentPrefix}\n\n[LIVE_SCORE:${intent.team}:${intent.sport}]`,
        intent: intent.type,
      })
    }

    if (intent.type === 'INLINE_STATS') {
      return NextResponse.json({
        response: `${intentPrefix}\n\n[STATS:${intent.entityType}:${intent.name}:${intent.sport}]`,
        intent: intent.type,
      })
    }

    if (intent.type === 'OFF_TOPIC') {
      return NextResponse.json({
        response: "I'm focused on sports betting - can I help you find some bets or explain betting concepts instead?",
        intent: intent.type,
      })
    }

    // Build messages for LLM
    const messages: ChatCompletionMessageParam[] = [
      { role: 'system', content: GUIDE_SYSTEM_PROMPT },
      ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
      { role: 'user', content: message },
    ]

    // For LINE_MOVEMENT intent, use tools
    // For EDUCATION and CONVERSATION, let LLM handle directly
    const useTools = intent.type === 'LINE_MOVEMENT'

    const completion = await openai.chat.completions.create({
      model: AI_MODELS.chat,
      messages,
      tools: useTools ? guideTools : undefined,
      tool_choice: useTools ? 'auto' : undefined,
      max_completion_tokens: 1024,
      temperature: 0.7,
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
        temperature: 0.5,
      })

      const analysis = analysisCompletion.choices[0]?.message?.content || 'Unable to analyze the data.'

      return NextResponse.json({
        response: analysis,
        intent: intent.type,
        toolsUsed: assistantMessage.tool_calls.map(tc => tc.function.name),
      })
    }

    // Direct response from LLM
    const response = assistantMessage?.content || "I'm not sure how to help with that. Can you try rephrasing your question?"

    return NextResponse.json({
      response,
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
