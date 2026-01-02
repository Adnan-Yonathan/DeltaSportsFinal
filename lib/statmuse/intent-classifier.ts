/**
 * Main LLM pipeline for processing unified sports queries.
 * Uses OpenAI function calling to understand intent and route to appropriate data sources.
 */

import { openai, AI_MODELS } from '@/lib/ai-gateway-client'
import { unifiedTools } from './tools'
import { resolveSportKey, type CanonicalSportKey } from '@/lib/identity/sport'
import { SPORT_TOOL_MAP } from './tool-sport-map'
import { executeTools, formatToolResultsForLLM } from './data-router'
import { QUERY_SYSTEM_PROMPT, ANALYSIS_SYSTEM_PROMPT, GENERAL_CONVERSATION_PROMPT } from './analysis-engine'
import type { UnifiedQueryResponse } from './types'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import {
  preprocessQuery,
  enhanceQueryForLLM,
  type PreprocessedQuery,
} from './query-preprocessor'

const MAX_TOOL_ITERATIONS = 3 // Prevent infinite loops

interface TaggedTeamInput {
  id: string
  name: string
  displayName: string
  sport: string
  position: { start: number; end: number }
}

interface ProcessQueryOptions {
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  sportHint?: string
  taggedTeams?: TaggedTeamInput[]
}

const needsExplicitSport = (
  message: string,
  preprocessed: PreprocessedQuery,
  resolvedSport?: CanonicalSportKey
) => {
  if (resolvedSport) return false
  if (preprocessed.sport && preprocessed.sport !== 'unknown') return false
  if (preprocessed.matched) return true
  return /\b(odds?|bet|bets|betting|props?|line|spread|total|moneyline|stats?|injur|schedule|leaderboard|rank|record|edge|slate)\b/i.test(
    message
  )
}

const filterToolsForSport = (resolvedSport?: CanonicalSportKey) => {
  if (!resolvedSport) return unifiedTools
  const allowed = SPORT_TOOL_MAP[resolvedSport]
  if (!allowed || !allowed.length) return unifiedTools
  const allowedSet = new Set(allowed)
  return unifiedTools.filter((tool) =>
    tool.type !== 'function' ? false : allowedSet.has(tool.function.name)
  )
}

/**
 * Process a unified query through the LLM pipeline.
 * This is the main entry point for all chat queries.
 */
export async function processUnifiedQuery(
  message: string,
  options: ProcessQueryOptions = {}
): Promise<UnifiedQueryResponse> {
  const { conversationHistory = [], sportHint, taggedTeams } = options

  // Preprocess query to extract player/team names
  // Pass tagged teams so preprocessor can prioritize them
  const preprocessed = preprocessQuery(message, { taggedTeams })
  console.log('[INTENT-CLASSIFIER] Preprocessed query:', {
    matched: preprocessed.matched,
    queryType: preprocessed.queryType,
    playerName: preprocessed.playerName,
    teamName: preprocessed.teamName,
    taggedTeamsCount: taggedTeams?.length ?? 0,
  })

  // Resolve sport: tagged teams take priority, then sportHint, then detected
  const taggedSport = taggedTeams?.[0]?.sport
  const resolvedSport =
    resolveSportKey(taggedSport) ??
    resolveSportKey(sportHint) ??
    resolveSportKey(preprocessed.sport ? String(preprocessed.sport) : '')

  if (needsExplicitSport(message, preprocessed, resolvedSport)) {
    return {
      reply:
        'Which sport is this for? Please specify NBA, NCAAB, NFL, NCAAF, NHL, or MLB.',
    }
  }

  // For simple player/team stat queries, bypass OpenAI and call tool directly
  if (preprocessed.matched && preprocessed.queryType === 'player_stats' && preprocessed.playerName) {
    try {
      const { executeStaticPlayerStats } = await import('./static-data-tools')
      const result = await executeStaticPlayerStats({
        player: preprocessed.playerName,
        stats: preprocessed.stats,
      })

      if (!result.error) {
        console.log('[INTENT-CLASSIFIER] Direct execution successful for player stats')
        if (result.stats && Object.keys(result.stats).length === 1) {
          const [[label, value]] = Object.entries(result.stats)
          const formattedValue =
            typeof value === 'number'
              ? /pct|%/i.test(label)
                ? `${value.toFixed(1)}%`
                : value.toFixed(1)
              : String(value)
          return {
            reply: `${result.player} ${label}: ${formattedValue}`,
            data: { playerStats: result },
            toolsUsed: ['getStaticPlayerStats'],
          }
        }
        return {
          reply: result.formatted || `Stats for ${result.player} (${result.team}):\n\n${JSON.stringify(result.stats, null, 2)}`,
          data: { playerStats: result },
          toolsUsed: ['getStaticPlayerStats'],
        }
      }
    } catch (error) {
      console.error('[INTENT-CLASSIFIER] Direct execution failed, falling back to LLM:', error)
    }
  }

  if (preprocessed.matched && preprocessed.queryType === 'team_stats' && preprocessed.teamName) {
    try {
      const { executeStaticTeamStats } = await import('./static-data-tools')
      const result = await executeStaticTeamStats({
        team: preprocessed.teamName,
        stats: preprocessed.stats,
      })

      if (!result.error) {
        console.log('[INTENT-CLASSIFIER] Direct execution successful for team stats')
        if (result.stats && Object.keys(result.stats).length === 1) {
          const [[label, value]] = Object.entries(result.stats)
          const formattedValue =
            typeof value === 'number'
              ? /pct|%/i.test(label)
                ? `${value.toFixed(1)}%`
                : value.toFixed(1)
              : String(value)
          return {
            reply: `${result.team} ${label}: ${formattedValue}`,
            data: { teamStats: result },
            toolsUsed: ['getStaticTeamStats'],
          }
        }
        return {
          reply: result.formatted || `Stats for ${result.team}:\n\n${JSON.stringify(result.stats, null, 2)}`,
          data: { teamStats: result },
          toolsUsed: ['getStaticTeamStats'],
        }
      }
    } catch (error) {
      console.error('[INTENT-CLASSIFIER] Direct execution failed, falling back to LLM:', error)
    }
  }

  // Enhance query with hints if we detected player/team names (for LLM fallback)
  const enhancedMessage = enhanceQueryForLLM(message, preprocessed)

  // Build initial messages
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: QUERY_SYSTEM_PROMPT },
    // Include recent conversation history for context (limit to last 6 messages)
    ...conversationHistory.slice(-6).map((msg) => ({
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
    })),
    { role: 'user', content: enhancedMessage },
  ]

  // If there's a sport hint, add it to the context
  if (sportHint) {
    messages[0] = {
      role: 'system',
      content: `${QUERY_SYSTEM_PROMPT}\n\nNote: The user is likely asking about ${sportHint}.`,
    }
  }

  try {
    // First LLM call: Understand intent and select tools
    const initialResponse = await openai.chat.completions.create({
      model: AI_MODELS.chat,
      messages,
      tools: filterToolsForSport(resolvedSport),
      tool_choice: 'auto',
      // GPT-5 only supports temperature: 1 (default)
      ...(AI_MODELS.chat.includes('gpt-5') ? {} : { temperature: 0.3 }),
    })

    const assistantMessage = initialResponse.choices[0].message
    const toolCalls = assistantMessage.tool_calls

    console.log('[INTENT-CLASSIFIER] Tool calls:', toolCalls ? toolCalls.map(tc => tc.function.name) : 'none')
    console.log('[INTENT-CLASSIFIER] Assistant content:', assistantMessage.content?.substring(0, 100))

    // If no tools called, this is a general conversation
    if (!toolCalls || toolCalls.length === 0) {
      // Check if the assistant wants to respond directly
      if (assistantMessage.content) {
        return { reply: assistantMessage.content }
      }

      // Fall back to general conversation
      const generalResponse = await openai.chat.completions.create({
        model: AI_MODELS.chat,
        messages: [
          { role: 'system', content: GENERAL_CONVERSATION_PROMPT },
          ...conversationHistory.slice(-4).map((msg) => ({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          })),
          { role: 'user', content: message },
        ],
        // GPT-5 only supports temperature: 1 (default)
        ...(AI_MODELS.chat.includes('gpt-5') ? {} : { temperature: 0.7 }),
      })

      return { reply: generalResponse.choices[0].message.content || "I'm not sure how to help with that." }
    }

    // Execute tool calls
    const toolResults = await executeTools(toolCalls)
    const toolsUsed = toolCalls.map((tc) => tc.function.name)

    // Build messages for analysis phase
    const analysisMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: message },
      {
        role: 'assistant',
        content: assistantMessage.content || null,
        tool_calls: toolCalls,
      },
      ...formatToolResultsForLLM(toolResults),
    ]

    // Second LLM call: Analyze results and generate response
    const analysisResponse = await openai.chat.completions.create({
      model: AI_MODELS.chat,
      messages: analysisMessages,
      // GPT-5 only supports temperature: 1 (default)
      ...(AI_MODELS.chat.includes('gpt-5') ? {} : { temperature: 0.5 }),
    })

    const reply = analysisResponse.choices[0].message.content

    // Check if analysis response wants to call more tools (iterative tool use)
    // This handles cases where initial data wasn't sufficient
    if (analysisResponse.choices[0].message.tool_calls) {
      // For now, just use what we have. Could implement iterative tool calls here.
      console.log('[INTENT-CLASSIFIER] Analysis requested additional tools, using current data')
    }

    return {
      reply: reply || 'I found some data but had trouble analyzing it. Please try rephrasing your question.',
      data: Object.fromEntries(toolResults.map((r) => [r.id, r.result])),
      toolsUsed,
    }
  } catch (error: any) {
    console.error('[INTENT-CLASSIFIER] Error processing query:', error)

    // If OpenAI fails, try a simple web search as fallback
    if (error?.status === 429 || error?.code === 'rate_limit_exceeded') {
      return {
        reply: "I'm currently experiencing high demand. Please try again in a moment.",
        fallback: true,
      }
    }

    return {
      reply: "I encountered an error processing your request. Please try rephrasing your question.",
      fallback: true,
    }
  }
}

/**
 * Lightweight query processing for simple stat lookups.
 * Bypasses LLM for common patterns to reduce latency and cost.
 */
export async function processSimpleQuery(message: string): Promise<UnifiedQueryResponse | null> {
  const msgLower = message.toLowerCase()

  // Pattern: "What's [player]'s [stat]?" - Direct player stat lookup
  const playerStatMatch = msgLower.match(
    /what(?:'s| is)\s+([a-z\s]+?)(?:'s)?\s+(ppg|points|rebounds|assists|steals|blocks|fg%|3p%|shooting)/i
  )
  if (playerStatMatch) {
    const { executeStaticPlayerStats } = await import('./static-data-tools')
    const playerName = playerStatMatch[1].trim()
    const result = await executeStaticPlayerStats({ player: playerName })

    if (!result.error) {
      const statMap: Record<string, string> = {
        ppg: 'PPG',
        points: 'PPG',
        rebounds: 'RPG',
        assists: 'APG',
        steals: 'SPG',
        blocks: 'BPG',
        'fg%': 'FG_PERCENT',
        '3p%': '3P_PERCENT',
        shooting: 'FG_PERCENT',
      }
      const statKey = statMap[playerStatMatch[2].toLowerCase()]
      const value = result.stats[statKey]

      if (value != null) {
        return {
          reply: `${result.player} (${result.team}) averages ${value} ${statKey.replace('_', ' ')} this season.`,
          data: { playerStats: result },
          toolsUsed: ['getStaticPlayerStats'],
        }
      }
    }
  }

  // Pattern: Team defensive stat
  const teamDefenseMatch = msgLower.match(
    /(?:what|how many).+?(?:opponents?|teams?).+?(3pt?|three|points?|rebounds?).+?(?:vs|against|allow).+?([a-z\s]+)/i
  )
  if (teamDefenseMatch) {
    // Let the full pipeline handle this - it's complex enough
    return null
  }

  // No simple pattern matched, use full pipeline
  return null
}

/**
 * Main entry point that tries simple processing first, then falls back to full LLM.
 */
export async function processQuery(
  message: string,
  options: ProcessQueryOptions = {}
): Promise<UnifiedQueryResponse> {
  // Try simple pattern matching first for common queries
  const simpleResult = await processSimpleQuery(message)
  if (simpleResult) {
    return simpleResult
  }

  // Fall back to full LLM pipeline
  return processUnifiedQuery(message, options)
}
