"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import mixpanel from "mixpanel-browser"

export function MixpanelInit() {
  const pathname = usePathname()

  useEffect(() => {
    mixpanel.init("e77c1ca33e99927aa80cfcdc0ef3fae9", {
      debug: true,
      track_pageview: true,
      persistence: "localStorage",
      autocapture: true,
      record_sessions_percent: 100,
    })
  }, [])

  useEffect(() => {
    if (!pathname) return
    const pageUrl =
      typeof window !== "undefined" ? window.location.href : pathname
    mixpanel.track("Page View", {
      page_url: pageUrl,
      page_title: typeof document !== "undefined" ? document.title : "",
      user_id: mixpanel.get_distinct_id(),
    })
  }, [pathname])

  return null
}
