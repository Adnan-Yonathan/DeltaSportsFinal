"use client"

import { useEffect, useState } from "react"
import EvBetsTable from "./ev-bets-table"
import TutorialPopup from "@/components/TutorialPopup"
import type { EVOpportunity } from "@/lib/utils/ev-calculator"

type EvBetsClientProps = {
  initialOpportunities: EVOpportunity[]
  initialUpdatedAt: string | null
  initialError: string | null
}

export default function EvBetsClient({
  initialOpportunities,
  initialUpdatedAt,
  initialError,
}: EvBetsClientProps) {
  const [opportunities, setOpportunities] = useState(initialOpportunities)
  const [errorMessage, setErrorMessage] = useState(initialError)
  const [lastUpdated, setLastUpdated] = useState(initialUpdatedAt)
  const [now, setNow] = useState(Date.now())

  const parsedUpdated = lastUpdated ? Date.parse(lastUpdated) : NaN
  const lastUpdatedMs = Number.isFinite(parsedUpdated) ? parsedUpdated : null
  const cooldownMs =
    lastUpdatedMs != null ? 15 * 60 * 1000 - (now - lastUpdatedMs) : 0
  const remainingSeconds = Math.max(0, Math.ceil(cooldownMs / 1000))
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(
    remainingSeconds % 60
  ).padStart(2, "0")}`

  useEffect(() => {
    let active = true
    const refresh = async () => {
      try {
        const res = await fetch("/api/ev-bets", { cache: "no-store" })
        if (!res.ok) {
          const payload = await res.json().catch(() => ({}))
          throw new Error(payload?.error || "Failed to refresh EV bets.")
        }
        const payload = await res.json()
        if (!active) return
        if (Array.isArray(payload?.data)) {
          setOpportunities(payload.data)
        }
        if (payload?.updatedAt) {
          setLastUpdated(payload.updatedAt)
        }
        setErrorMessage(null)
      } catch (error) {
        if (!active) return
        setErrorMessage(
          error instanceof Error ? error.message : "Failed to refresh EV bets."
        )
      }
    }

    refresh()
    const interval = window.setInterval(refresh, 15 * 60 * 1000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  return (
    <>
      <TutorialPopup tutorialId="ev-bets" />
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">
            Auto refresh
          </div>
          <div className="text-xs text-white/50">
            Next refresh in {remainingLabel}
          </div>
        </div>
        {errorMessage && (
          <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
        )}
      </div>
      <EvBetsTable opportunities={opportunities} errorMessage={errorMessage} />
    </>
  )
}
