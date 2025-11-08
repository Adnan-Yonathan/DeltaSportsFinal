import posthog from 'posthog-js'

export function getPostHogClient() {
  if (typeof window !== 'undefined') {
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST

    if (!apiKey) {
      console.warn('PostHog API key not found')
      return null
    }

    if (!posthog.__loaded) {
      posthog.init(apiKey, {
        api_host: apiHost || 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // We'll manually capture pageviews
        capture_pageleave: true,
      })
    }

    return posthog
  }
  
  return null
}
