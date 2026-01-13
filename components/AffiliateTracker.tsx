"use client"

import { useEffect } from "react"

const AFFILIATE_REF_COOKIE = "affiliate_ref"
const AFFILIATE_CLICK_KEY = "affiliate_click_logged"

const readAffiliateRef = () => {
  if (typeof document === "undefined") return null
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${AFFILIATE_REF_COOKIE}=([^;]+)`)
  )
  return match ? decodeURIComponent(match[1]) : null
}

const readUrlRef = () => {
  if (typeof window === "undefined") return null
  const params = new URLSearchParams(window.location.search)
  return params.get("ref")
}

export default function AffiliateTracker() {
  useEffect(() => {
    const ref = readUrlRef() || readAffiliateRef()
    if (!ref) return

    const storageKey = `${AFFILIATE_CLICK_KEY}:${ref}`
    if (window.localStorage.getItem(storageKey)) return

    const send = async () => {
      try {
        await fetch("/api/affiliate/click", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: ref }),
        })
        window.localStorage.setItem(storageKey, "1")
      } catch {
        // Best-effort tracking only.
      }
    }

    void send()
  }, [])

  return null
}
