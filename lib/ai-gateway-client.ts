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
const CHAT_MODEL = process.env.CHAT_MODEL || 'gpt-5-mini'
export const AI_MODELS = {
  // Main chat - high quality, supports function calling
  chat: CHAT_MODEL,

  // Title generation - fast, cheap, good enough
  titleGen: 'gpt-5-mini',

  // Custom filters - simple yes/no evaluations
  filters: 'gpt-5-mini',

  // Model runner - custom model execution
  modelRunner: 'gpt-5-mini',

  // Web search augmented model (Responses API)
  search: process.env.SEARCH_MODEL || 'gpt-5-mini',
} as const

/**
 * Get model name
 */
export function getModel(type: keyof typeof AI_MODELS): string {
  return AI_MODELS[type]
}

/**
 * Web search helper: wraps OpenAI Responses API with optional web_search tool.
 */
export async function runWebSearchResponse(
  input: string,
  opts: { maxOutputTokens?: number; retry?: number } = {}
): Promise<string> {
  const enabled = process.env.ENABLE_WEB_SEARCH === 'true'
  if (!enabled) {
    throw new Error('Web search is disabled. Set ENABLE_WEB_SEARCH=true to enable.')
  }

  const model = AI_MODELS.search
  const maxOutputTokens = opts.maxOutputTokens ?? 600
  const retries = opts.retry ?? 1

  let lastError: any
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await openai.responses.create({
        model,
        tools: [{ type: 'web_search' }],
        input,
        max_output_tokens: maxOutputTokens,
      } as any)

      const maybeOutput = (response as any)?.output_text
      if (typeof maybeOutput === 'string') return maybeOutput
      return JSON.stringify(response)
    } catch (error: any) {
      lastError = error
      const status = error?.status || error?.response?.status
      const retryAfterMs =
        Number(error?.headers?.['retry-after-ms']) || Number(error?.headers?.['retry-after']) * 1000 || 0

      if (status === 429 && retryAfterMs > 0) {
        await new Promise((res) => setTimeout(res, retryAfterMs))
        continue
      }
      if (status >= 500 && attempt < retries) {
        await new Promise((res) => setTimeout(res, 500 * (attempt + 1)))
        continue
      }
      throw error
    }
  }

  throw lastError || new Error('Web search failed')
}
