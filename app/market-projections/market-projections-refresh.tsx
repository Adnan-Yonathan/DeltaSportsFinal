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
}) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "error" | "timeout"
  >("idle")
  const [details, setDetails] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [retryCount, setRetryCount] = useState(0)
  const MAX_RETRIES = 3

  const parsedUpdated = lastUpdated ? Date.parse(lastUpdated) : NaN
  const lastUpdatedMs = Number.isFinite(parsedUpdated) ? parsedUpdated : null
  const cooldownMs =
    lastUpdatedMs != null ? 15 * 60 * 1000 - (now - lastUpdatedMs) : 0
  const remainingSeconds = Math.max(0, Math.ceil(cooldownMs / 1000))
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(
    remainingSeconds % 60
  ).padStart(2, "0")}`

  const refresh = async () => {
    if (isLocked) return
    if (status === "loading") return
    setStatus("loading")
    setDetails(null)
    const controller = new AbortController()
    const timeout = window.setTimeout(() => {
      controller.abort()
      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1)
        setStatus("idle")
        setDetails(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
        return
      }
      setStatus("timeout")
      setDetails("Refresh is still running. It can take a minute.")
    }, 60000)

    try {
      const res = await fetch(
        `/api/market-projections?sport=${sport}&refresh=1${
          includeEdges ? "&include=1" : ""
        }`,
        { signal: controller.signal, cache: "no-store" }
      )
      window.clearTimeout(timeout)
      if (!res.ok) throw new Error("Refresh failed")
      const payload = await res.json()
      const refreshedAt = payload?.updatedAt
      if (onUpdated) {
        onUpdated(payload)
      }
      if (payload?.refreshing) {
        setStatus("done")
        setDetails("Refresh queued. This can take a moment.")
        setRetryCount(0)
        window.setTimeout(() => {
          setStatus("idle")
          setDetails(null)
        }, 1500)
        return
      }
      setStatus("done")
      setRetryCount(0)
      window.setTimeout(() => {
        setStatus("idle")
        setDetails(null)
      }, 1500)
      if (!onUpdated && refreshedAt && lastUpdated && refreshedAt !== lastUpdated) {
        window.location.reload()
      }
    } catch (err) {
      if (controller.signal.aborted) return
      window.clearTimeout(timeout)
      if (retryCount < MAX_RETRIES) {
        setRetryCount((prev) => prev + 1)
        setStatus("idle")
        setDetails(`Retrying... (${retryCount + 1}/${MAX_RETRIES})`)
        return
      }
      setStatus("error")
      setDetails(err instanceof Error ? err.message : "Refresh failed.")
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
    if (status !== "idle" || isLocked) return
    refresh()
  }, [status, isLocked, sport])

  // Auto-refresh interval - created once, fires every 15 minutes
  useEffect(() => {
    if (isLocked) return
    const interval = window.setInterval(() => {
      refreshRef.current()
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [isLocked])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">
          Auto refresh
        </div>
        {!isLocked && (
          <div className="text-xs text-white/50">
            Next refresh in {remainingLabel}
          </div>
        )}
      </div>
      {isLocked && "This sport is locked. Upgrade to unlock projections."}
      {status === "loading" && "Loading projections..."}
      {status === "done" && (details || "Projections refreshed.")}
      {status === "idle" && hasCache && "Projections are up to date."}
      {status === "idle" && !hasCache && "Preparing projections..."}
      {status === "error" &&
        (details || errorMessage || "Unable to refresh projections.")}
      {status === "timeout" &&
        (details || "Refresh is taking longer than expected.")}
    </div>
  )
}
