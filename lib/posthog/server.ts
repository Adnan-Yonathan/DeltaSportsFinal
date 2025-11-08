import { PostHog } from 'posthog-node'

let posthogInstance: PostHog | null = null

export function getPostHogServer(): PostHog | null {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

  if (!apiKey) {
    console.warn('PostHog API key not found')
    return null
  }

  if (!posthogInstance) {
    posthogInstance = new PostHog(apiKey, {
      host: apiHost || 'https://us.i.posthog.com',
    })
  }

  return posthogInstance
}

interface LLMTrackingData {
  userId: string
  model: string
  prompt: string
  completion: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  latencyMs?: number
  conversationId?: string
}

export function trackLLMInteraction(data: LLMTrackingData) {
  const posthog = getPostHogServer()

  if (!posthog) return

  posthog.capture({
    distinctId: data.userId,
    event: 'ai_chat_completion',
    properties: {
      $ai_model: data.model,
      $ai_input: data.prompt,
      $ai_output: data.completion,
      $ai_prompt_tokens: data.promptTokens,
      $ai_completion_tokens: data.completionTokens,
      $ai_total_tokens: data.totalTokens,
      $ai_latency_ms: data.latencyMs,
      conversation_id: data.conversationId,
      timestamp: new Date().toISOString(),
    },
  })
}

export async function shutdownPostHog() {
  if (posthogInstance) {
    await posthogInstance.shutdown()
  }
}
