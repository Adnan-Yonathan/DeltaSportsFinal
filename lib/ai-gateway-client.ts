/**
 * OpenAI Client Configuration
 *
 * Direct OpenAI SDK client using OPENAI_API_KEY
 */

import OpenAI from 'openai'

/**
 * OpenAI client for direct API access
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Model configurations for different use cases
 */
export const AI_MODELS = {
  // Main chat - high quality, supports function calling
  chat: 'gpt-4o',

  // Title generation - fast, cheap, good enough
  titleGen: 'gpt-4o-mini',

  // Custom filters - simple yes/no evaluations
  filters: 'gpt-4o-mini',

  // Model runner - custom model execution
  modelRunner: 'gpt-4o',
} as const

/**
 * Get model name
 */
export function getModel(type: keyof typeof AI_MODELS): string {
  return AI_MODELS[type]
}
