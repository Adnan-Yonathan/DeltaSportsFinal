'use client'

import { useEffect, useMemo, useRef } from 'react'
import { usePathname } from 'next/navigation'

export default function AttributionVisitorTracker() {
  const pathname = usePathname() ?? '/'
  const trackedPath = useMemo(() => {
    if (typeof window === 'undefined') return pathname
    const query = window.location.search || ''
    return query ? `${pathname}${query}` : pathname
  }, [pathname])
  const lastSentRef = useRef<string | null>(null)

  useEffect(() => {
    if (!trackedPath) return
    if (lastSentRef.current === trackedPath) return
    lastSentRef.current = trackedPath

    const controller = new AbortController()
    fetch('/api/attribution/touch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: trackedPath }),
      keepalive: true,
      signal: controller.signal,
    }).catch(() => {
      // Best-effort attribution logging only.
    })

    return () => controller.abort()
  }, [trackedPath])

  return null
}
