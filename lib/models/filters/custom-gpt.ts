/**
 * Custom GPT Filter
 * AI-powered filtering using natural language criteria
 */

import OpenAI from 'openai'
import {
  CustomFilter,
  OddsData,
  FilterExecutionContext,
} from '../research-model-types'

// Initialize OpenAI client (lazy initialization)
let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

/**
 * Apply custom GPT filter
 * Uses AI to evaluate opportunities against natural language criteria
 */
export async function applyCustomFilter(
  opportunity: OddsData,
  filter: CustomFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  const { condition } = filter

  // If AI evaluation is disabled, just return true
  if (!condition.aiEvaluate) {
    return true
  }

  try {
    const openai = getOpenAIClient()

    // Build comprehensive context for the opportunity
    const opportunityContext = formatOpportunityForGPT(opportunity, allOddsForEvent, context)

    // Create the evaluation prompt
    const prompt = buildEvaluationPrompt(opportunityContext, condition.description)

    // Call GPT for evaluation
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano', // Use nano for cost efficiency
      messages: [
        {
          role: 'system',
          content: 'You are a betting opportunity evaluator. You will receive details about a betting opportunity and user-defined criteria. Respond with ONLY "YES" or "NO" to indicate whether the opportunity matches the criteria.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0, // Deterministic responses
      max_completion_tokens: 10, // Just need YES/NO
    })

    const answer = response.choices[0]?.message?.content?.trim().toUpperCase()

    // Log for debugging
    console.log(`[CUSTOM_FILTER] Criteria: "${condition.description}" | Answer: ${answer}`)

    return answer === 'YES'
  } catch (error: any) {
    console.error('[CUSTOM_FILTER] Error evaluating with GPT:', error.message)
    // On error, don't filter out the opportunity (fail open)
    return true
  }
}

/**
 * Format opportunity data for GPT evaluation
 */
function formatOpportunityForGPT(
  opportunity: OddsData,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): string {
  let formatted = `**Betting Opportunity:**\n`
  formatted += `- Game: ${opportunity.event}\n`
  formatted += `- Sport: ${opportunity.sport}\n`
  formatted += `- Market: ${opportunity.market}\n`
  formatted += `- Book: ${opportunity.book}\n`
  formatted += `- Selection: ${opportunity.selection || 'N/A'}\n`
  formatted += `- Odds: ${opportunity.odds > 0 ? '+' : ''}${opportunity.odds}\n`

  if (opportunity.line !== undefined && opportunity.line !== null) {
    formatted += `- Line: ${opportunity.line > 0 ? '+' : ''}${opportunity.line}\n`
  }

  formatted += `- Game Time: ${new Date(opportunity.gameTime).toLocaleString()}\n`

  if (opportunity.isLive) {
    formatted += `- Status: LIVE (in-play)\n`
  }

  // Add comparison data if available
  if (allOddsForEvent.length > 1) {
    const allOdds = allOddsForEvent
      .filter(o => o.market === opportunity.market && o.selection === opportunity.selection)
      .map(o => o.odds)

    if (allOdds.length > 0) {
      const avgOdds = allOdds.reduce((sum, val) => sum + val, 0) / allOdds.length
      formatted += `- Average Odds (across ${allOdds.length} books): ${avgOdds > 0 ? '+' : ''}${avgOdds.toFixed(0)}\n`

      const pinnacle = allOddsForEvent.find(o =>
        o.book.toLowerCase().includes('pinnacle') &&
        o.market === opportunity.market &&
        o.selection === opportunity.selection
      )
      if (pinnacle) {
        formatted += `- Pinnacle Odds: ${pinnacle.odds > 0 ? '+' : ''}${pinnacle.odds}\n`
      }
    }

    const allLines = allOddsForEvent
      .filter(o => o.market === opportunity.market && o.selection === opportunity.selection && o.line !== undefined)
      .map(o => o.line!)

    if (allLines.length > 0) {
      const avgLine = allLines.reduce((sum, val) => sum + val, 0) / allLines.length
      formatted += `- Average Line: ${avgLine > 0 ? '+' : ''}${avgLine.toFixed(1)}\n`
    }
  }

  // Add game context if available
  if (context.gameContext) {
    formatted += `\n**Additional Game Context:**\n`
    formatted += formatGameContext(context.gameContext)
  }

  return formatted
}

/**
 * Format game context from the context object
 */
function formatGameContext(gameContext: any): string {
  let formatted = ''

  // Add injury information if available
  if (gameContext.injuries && Array.isArray(gameContext.injuries)) {
    if (gameContext.injuries.length > 0) {
      formatted += `- Injuries: ${gameContext.injuries.map((i: any) => `${i.player} (${i.status})`).join(', ')}\n`
    }
  }

  // Add recent form if available
  if (gameContext.recentForm) {
    formatted += `- Recent Form: ${JSON.stringify(gameContext.recentForm)}\n`
  }

  // Add any other context
  if (gameContext.notes) {
    formatted += `- Notes: ${gameContext.notes}\n`
  }

  return formatted
}

/**
 * Build the evaluation prompt
 */
function buildEvaluationPrompt(opportunityContext: string, criteria: string): string {
  return `${opportunityContext}

**Evaluation Criteria:**
"${criteria}"

**Question:**
Does this betting opportunity match the above criteria?

**Instructions:**
- Carefully analyze the opportunity details against the criteria
- Consider all provided context (odds, lines, game info, etc.)
- Respond with ONLY "YES" if it matches or "NO" if it doesn't
- Do not provide any explanation or additional text

**Answer (YES or NO):**`
}

/**
 * Batch evaluate multiple opportunities (for efficiency)
 * This can be used to evaluate many opportunities in parallel
 */
export async function batchEvaluateCustomFilter(
  opportunities: OddsData[],
  filter: CustomFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()

  // Evaluate in parallel but limit concurrency to avoid rate limits
  const BATCH_SIZE = 5
  for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
    const batch = opportunities.slice(i, i + BATCH_SIZE)
    const batchResults = await Promise.allSettled(
      batch.map(opp => applyCustomFilter(opp, filter, allOddsForEvent, context))
    )

    batchResults.forEach((result, idx) => {
      const opp = batch[idx]
      const oppId = `${opp.eventId}-${opp.book}-${opp.market}-${opp.selection}`

      if (result.status === 'fulfilled') {
        results.set(oppId, result.value)
      } else {
        // On error, fail open (include the opportunity)
        console.error(`[CUSTOM_FILTER] Failed to evaluate ${oppId}:`, result.reason)
        results.set(oppId, true)
      }
    })

    // Add small delay between batches to avoid rate limits
    if (i + BATCH_SIZE < opportunities.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  return results
}
