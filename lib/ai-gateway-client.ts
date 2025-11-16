/**
 * Vercel AI Gateway Client
 *
 * This provides both the AI SDK and OpenAI SDK compatible clients
 * for seamless migration to Vercel AI Gateway
 */

import OpenAI from 'openai'
import { createOpenAI } from '@ai-sdk/openai'

// ============================================================================
// OPTION 1: OpenAI SDK (Drop-in replacement for existing code)
// ============================================================================

/**
 * OpenAI client for direct API access
 *
 * NOTE: This uses OPENAI_API_KEY for direct OpenAI access (no gateway).
 * The vck_ API key (AI_GATEWAY_API_KEY) only works with the AI SDK,
 * not the standard OpenAI SDK. To use AI Gateway, the chat route needs
 * to be migrated to use the AI SDK (generateText/streamText).
 */
export const openaiGateway = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Legacy OpenAI client (direct to OpenAI, no gateway)
 * Keep this for comparison or fallback
 */
export const openaiDirect = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

// ============================================================================
// OPTION 2: Vercel AI SDK (For AI Gateway)
// ============================================================================

/**
 * Vercel AI SDK OpenAI provider - this is what works with AI Gateway
 * The vck_ API key automatically routes through Vercel AI Gateway
 */
export const openai = createOpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY || process.env.OPENAI_API_KEY,
})

/**
 * Model configurations for different use cases
 */
export const AI_MODELS = {
  // Main chat - high quality, supports function calling
  chat: process.env.AI_CHAT_MODEL || 'gpt-4o',

  // Title generation - fast, cheap, good enough
  titleGen: process.env.AI_TITLE_MODEL || 'gpt-4o-mini',

  // Custom filters - simple yes/no evaluations
  filters: process.env.AI_FILTER_MODEL || 'gpt-4o-mini',

  // Model runner - custom model execution
  modelRunner: process.env.AI_MODEL_RUNNER || 'gpt-4o',
} as const

/**
 * Get model name with environment override
 */
export function getModel(type: keyof typeof AI_MODELS): string {
  return AI_MODELS[type]
}

/**
 * Check if AI Gateway is enabled
 */
export function isAIGatewayEnabled(): boolean {
  return !!(process.env.AI_GATEWAY_API_KEY &&
            process.env.AI_GATEWAY_API_KEY !== 'your_ai_gateway_api_key_here')
}

/**
 * Log AI Gateway status
 */
export function logAIGatewayStatus() {
  const enabled = isAIGatewayEnabled()
  console.log(`[AI_GATEWAY] Status: ${enabled ? 'ENABLED ✅' : 'DISABLED (using direct OpenAI)'}`)

  if (enabled) {
    console.log(`[AI_GATEWAY] Models:`)
    console.log(`  - Chat: ${AI_MODELS.chat}`)
    console.log(`  - Title Gen: ${AI_MODELS.titleGen}`)
    console.log(`  - Filters: ${AI_MODELS.filters}`)
    console.log(`  - Model Runner: ${AI_MODELS.modelRunner}`)
  }
}
