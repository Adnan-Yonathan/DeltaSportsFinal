"use client"

import { useEffect, useState, useRef } from "react"

export default function MarketProjectionsRefresh({
  hasCache,
  errorMessage,
  sport,
  isLocked,
  lastUpdated,
  includeEdges = false,
  onUpdated,
  onStatusChange,
}: {
  hasCache: boolean
  errorMessage: string | null
  sport: string
  isLocked?: boolean
  lastUpdated?: string | null
  includeEdges?: boolean
  onUpdated?: (payload: {
    updatedAt?: string
    edges?: unknown[]
    fromCache?: boolean
    refreshing?: boolean
    error?: string
  }) => void
  onStatusChange?: (
    status: "idle" | "loading" | "done" | "error" | "timeout"
  ) => void
}) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "error" | "timeout"
  >("idle")
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<number | null>(null)

  const clearRefreshTimeout = () => {
    if (timeoutRef.current != null) {
      window.clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }

  const refresh = async () => {
    if (isLocked) return
    if (status === "loading") return
    setStatus("loading")
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    clearRefreshTimeout()
    timeoutRef.current = window.setTimeout(() => {
      controller.abort()
      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1)
        setStatus("idle")
        return
      }
      setStatus("timeout")
    }, 60000)

    try {
      const res = await fetch(
        `/api/market-projections?sport=${sport}&refresh=1${
          includeEdges ? "&include=1" : ""
        }`,
        { signal: controller.signal, cache: "no-store" }
      )
      clearRefreshTimeout()
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (!res.ok) throw new Error("Refresh failed")
      const payload = await res.json()
      const refreshedAt = payload?.updatedAt
      if (onUpdated) {
        onUpdated(payload)
      }
      if (payload?.refreshing) {
        setStatus("done")
        setRetryCount(0)
        window.setTimeout(() => {
          setStatus("idle")
        }, 1500)
        return
      }
      setStatus("done")
      setRetryCount(0)
      window.setTimeout(() => {
        setStatus("idle")
      }, 1500)
      if (!onUpdated && refreshedAt && lastUpdated && refreshedAt !== lastUpdated) {
        window.location.reload()
      }
    } catch (err) {
      if (controller.signal.aborted) {
        clearRefreshTimeout()
        if (abortRef.current === controller) {
          abortRef.current = null
        }
        return
      }
      clearRefreshTimeout()
      if (abortRef.current === controller) {
        abortRef.current = null
      }
      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1)
        setStatus("idle")
        return
      }
      setStatus("error")
      if (onUpdated) {
        onUpdated({
          error: err instanceof Error ? err.message : "Refresh failed.",
        })
      }
    }
  }

  // Keep ref to latest refresh function to avoid stale closures
  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
  })

  useEffect(() => {
    if (onStatusChange) onStatusChange(status)
  }, [status, onStatusChange])

  useEffect(() => {
    if (status !== "idle" || isLocked) return
    refresh()
  }, [status, isLocked, sport])

  useEffect(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    clearRefreshTimeout()
    setRetryCount(0)
    setStatus("idle")
  }, [sport])

  // Auto-refresh interval - created once, fires every 15 minutes
  useEffect(() => {
    if (isLocked) return
    const interval = window.setInterval(() => {
      refreshRef.current()
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [isLocked])

  return null
}
