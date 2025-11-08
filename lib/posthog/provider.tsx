'use client'

import { Suspense, useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { getPostHogClient } from './client'

function PostHogPageView() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const posthog = getPostHogClient()

    if (posthog) {
      // Track pageviews
      let url = window.origin + pathname
      if (searchParams && searchParams.toString()) {
        url += `?${searchParams.toString()}`
      }
      posthog.capture('$pageview', {
        '$current_url': url
      })
    }
  }, [pathname, searchParams])

  return null
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Suspense fallback={null}>
        <PostHogPageView />
      </Suspense>
      {children}
    </>
  )
}
