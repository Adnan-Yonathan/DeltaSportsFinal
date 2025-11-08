// Client-side PostHog
export { getPostHogClient } from './client'
export { PostHogProvider } from './provider'

// Server-side PostHog
export { getPostHogServer, trackLLMInteraction, shutdownPostHog } from './server'
