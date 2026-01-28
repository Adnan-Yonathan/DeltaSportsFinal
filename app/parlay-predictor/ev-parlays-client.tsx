"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { type BookKey } from '@/components/BookSelector'

type EvParlayLeg = {
  game: string
  gameId: string
  market: string
  selection: string
  point?: number
  bookOdds: Record<string, number>
}

type EvParlay = {
  id: string
  legs: EvParlayLeg[]
  bestBook: string
  bestBookOdds: number
  legCount: number
  trueProbability: number
  minOddsForEv: number
  evPercent: number
}

interface EvParlaysClientProps {
  selectedBooks?: BookKey[]
  previewMode?: boolean
}

const REFRESH_MS = 300000
const MAX_ODDS_OPTIONS = [
  { label: 'Max +500', value: 500 },
  { label: 'Max +1000', value: 1000 },
  { label: 'Max +1500', value: 1500 },
]

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return "n/a"
  return odds > 0 ? `+${odds}` : `${odds}`
}

const formatMarketLabel = (market: string) => {
  if (market === "h2h") return "Moneyline"
  if (market === "spreads") return "Spread"
  if (market === "totals") return "Total"
  return market
}

export default function EvParlaysClient({
  selectedBooks,
  previewMode = false,
}: EvParlaysClientProps) {
  const [parlays, setParlays] = useState<EvParlay[]>([])
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [maxParlayOdds, setMaxParlayOdds] = useState<number>(500)
  const lastFetchedRef = useRef(0)

  const fetchParlays = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const url = new URL("/api/ev-parlays", window.location.origin)
      url.searchParams.set("maxParlayOdds", String(maxParlayOdds))
      const res = await fetch(url.toString(), { cache: "no-store" })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to load EV parlays.")
      }
      const payload = await res.json()
      const data = Array.isArray(payload?.data) ? payload.data : []
      setParlays(data)
      const stamp = new Date().toISOString()
      setLastUpdated(stamp)
      lastFetchedRef.current = Date.now()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load EV parlays."
      )
      setParlays([])
    } finally {
      setLoading(false)
    }
  }, [maxParlayOdds])

  useEffect(() => {
    fetchParlays()
    const interval = window.setInterval(fetchParlays, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchParlays])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== "visible") return
      const elapsed = Date.now() - lastFetchedRef.current
      if (elapsed >= REFRESH_MS) {
        fetchParlays()
      }
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange)
  }, [fetchParlays])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return "-"
    const date = new Date(lastUpdated)
    if (Number.isNaN(date.getTime())) return "-"
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }, [lastUpdated])

  const remainingSeconds = useMemo(() => {
    if (!lastUpdated) return Math.ceil(REFRESH_MS / 1000)
    const updatedMs = Date.parse(lastUpdated)
    if (!Number.isFinite(updatedMs)) return Math.ceil(REFRESH_MS / 1000)
    return Math.max(0, Math.ceil((updatedMs + REFRESH_MS - now) / 1000))
  }, [lastUpdated, now])

  const visibleParlays = previewMode ? parlays.slice(0, 1) : parlays

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
          Max parlay odds
        </span>
        {MAX_ODDS_OPTIONS.map((option) => (
          <button
            key={option.label}
            type="button"
            onClick={() => setMaxParlayOdds(option.value)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              maxParlayOdds === option.value
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            Pregame only | Sportsbook-only cross-market EV | EV 3%+ | Legs 2-5 | Max parlay odds +{maxParlayOdds}
          </span>
          <span>
            Updated {lastUpdatedLabel} | Refresh in {remainingSeconds}s
          </span>
        </div>
        {errorMessage && (
          <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
          Scanning sportsbooks for EV parlays...
        </div>
      )}

      {!loading && !errorMessage && parlays.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
          No EV parlays above 3% right now. Check back after lines move.
        </div>
      )}

      <div className="space-y-4">
        {visibleParlays.map((parlay) => {
          return (
            <div
              key={parlay.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                    EV Parlay
                  </p>
                  <p className="mt-1 text-lg font-semibold text-emerald-200">
                    +{parlay.evPercent.toFixed(1)}% EV
                  </p>
                  <p className="mt-1 text-xs text-white/50">
                    {parlay.legCount} legs
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                    Best Book
                  </p>
                  <p className="text-sm text-white/90">
                    {parlay.bestBook} {formatOdds(parlay.bestBookOdds)}
                  </p>
                  <div className="mt-2 inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-400/10 px-3 py-1">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-200/80">
                      Target 3% EV
                    </span>
                    <span className="text-base font-semibold text-emerald-200">
                      {formatOdds(parlay.minOddsForEv)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {parlay.legs.map((leg, index) => {
                  const bookOdds = leg.bookOdds[parlay.bestBook]
                  return (
                    <div
                      key={`${parlay.id}-${index}`}
                      className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                        <div className="text-white/90">
                          {leg.selection}
                          {leg.point != null ? ` ${leg.point > 0 ? "+" : ""}${leg.point}` : ""}
                        </div>
                        <div className="text-xs text-white/60">
                          {formatMarketLabel(leg.market)} | {leg.game}
                        </div>
                        <div className="text-xs text-white/70">
                          {parlay.bestBook} {formatOdds(bookOdds)}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      {previewMode && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm space-y-4 px-4 py-6">
            {[1, 2].map((row) => (
              <div
                key={row}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="h-4 w-40 rounded bg-white/10 mb-2" />
                <div className="h-16 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Upgrade required
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Upgrade to get full access.
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Unlock every parlay and builder.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
