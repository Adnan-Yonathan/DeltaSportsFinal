"use client"

import { useEffect, useState } from "react"

export default function MarketProjectionsRefresh({
  hasCache,
  errorMessage,
  sport,
  isLocked,
  lastUpdated,
}: {
  hasCache: boolean
  errorMessage: string | null
  sport: string
  isLocked?: boolean
  lastUpdated?: string | null
}) {
  const [status, setStatus] = useState<
    "idle" | "loading" | "done" | "error" | "timeout"
  >("idle")
  const [details, setDetails] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const parsedUpdated = lastUpdated ? Date.parse(lastUpdated) : NaN
  const lastUpdatedMs = Number.isFinite(parsedUpdated) ? parsedUpdated : null
  const cooldownMs =
    lastUpdatedMs != null ? 15 * 60 * 1000 - (now - lastUpdatedMs) : 0
  const canRefresh = !isLocked && (lastUpdatedMs == null || cooldownMs <= 0)
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
      setStatus("timeout")
      setDetails("Refresh is still running. It can take a minute.")
    }, 60000)

    try {
      const res = await fetch(`/api/market-projections?sport=${sport}&refresh=1`, {
        signal: controller.signal,
      })
      window.clearTimeout(timeout)
      if (!res.ok) throw new Error("Refresh failed")
      const payload = await res.json()
      const refreshedAt = payload?.updatedAt
      if (refreshedAt && lastUpdated && refreshedAt !== lastUpdated) {
        setStatus("done")
        window.location.reload()
        return
      }
      if (payload?.refreshing) {
        setStatus("done")
        setDetails("Refresh queued. This can take a moment.")
        return
      }
      setStatus("done")
      window.location.reload()
    } catch (err) {
      if (controller.signal.aborted) return
      window.clearTimeout(timeout)
      setStatus("error")
      setDetails(err instanceof Error ? err.message : "Refresh failed.")
    }
  }

  useEffect(() => {
    if (hasCache || status !== "idle" || isLocked) return
    refresh()
  }, [hasCache, status, isLocked])

  useEffect(() => {
    if (isLocked) return
    const interval = window.setInterval(() => {
      refresh()
    }, 15 * 60 * 1000)
    return () => window.clearInterval(interval)
  }, [isLocked, sport, status])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">
          Refresh control
        </div>
        {!isLocked && (
          <button
            type="button"
            onClick={refresh}
            disabled={!canRefresh || status === "loading"}
            className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:border-emerald-400/40 hover:text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            {canRefresh ? "Refresh now" : `Refresh in ${remainingLabel}`}
          </button>
        )}
      </div>
      {isLocked && "This sport is locked. Upgrade to unlock projections."}
      {status === "loading" && "Loading projections..."}
      {status === "done" &&
        (details || "Projections refreshed. Reloading...")}
      {status === "idle" && hasCache && "Projections are up to date."}
      {status === "idle" && !hasCache && "Preparing projections..."}
      {status === "error" &&
        (details || errorMessage || "Unable to refresh projections.")}
      {status === "timeout" &&
        (details || "Refresh is taking longer than expected.")}
      {!isLocked && (status === "error" || status === "timeout") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded-md border border-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80 hover:border-emerald-400/40 hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  )
}
