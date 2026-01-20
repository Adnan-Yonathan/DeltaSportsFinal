"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { OddsGame } from "@/lib/types/odds"
import { SPORTS } from "@/lib/types/odds"
import LiveOddsTable from "./ev-bets-table"

const REFRESH_MS = 30000

const SPORT_OPTIONS = [
  { label: "NBA", key: SPORTS.NBA },
  { label: "NFL", key: SPORTS.NFL },
  { label: "NHL", key: SPORTS.NHL },
  { label: "MLB", key: SPORTS.MLB },
  { label: "NCAAB", key: SPORTS.NCAA_BB },
  { label: "NCAAF", key: SPORTS.NCAA_FB },
]

export default function LiveOddsClient() {
  const [sportKey, setSportKey] = useState<string>(SPORTS.NBA)
  const [liveOnly, setLiveOnly] = useState(false)
  const [games, setGames] = useState<OddsGame[]>([])
  const [marketKey, setMarketKey] = useState<"h2h" | "spreads" | "totals">("h2h")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())

  const fetchOdds = useCallback(async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const url = new URL("/api/odds/games", window.location.origin)
      url.searchParams.set("sport", sportKey)
      url.searchParams.set("markets", "h2h,spreads,totals")
      url.searchParams.set("live", liveOnly ? "true" : "false")
      const res = await fetch(url.toString(), { cache: "no-store" })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to load odds.")
      }
      const payload = await res.json()
      const nextGames = Array.isArray(payload?.games) ? payload.games : []
      const filtered = nextGames.filter((game: OddsGame) => {
        if (game.sport_key !== sportKey) return false
        if (sportKey === "basketball_ncaab") {
          const title = (game.sport_title || "").toLowerCase()
          if (!title.includes("ncaab") && !title.includes("college")) {
            return false
          }
        }
        return true
      })
      setGames(filtered)
      setLastUpdated(new Date().toISOString())
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to load odds."
      )
      setGames([])
    } finally {
      setLoading(false)
    }
  }, [sportKey, liveOnly])

  useEffect(() => {
    setGames([])
  }, [sportKey, liveOnly])

  useEffect(() => {
    fetchOdds()
    const interval = window.setInterval(fetchOdds, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchOdds])

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

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {SPORT_OPTIONS.map((sport) => (
            <button
              key={sport.key}
              type="button"
              onClick={() => setSportKey(sport.key)}
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
                sportKey === sport.key
                  ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                  : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setMarketKey("h2h")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              marketKey === "h2h"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            Moneyline
          </button>
          <button
            type="button"
            onClick={() => setMarketKey("spreads")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              marketKey === "spreads"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            Spread
          </button>
          <button
            type="button"
            onClick={() => setMarketKey("totals")}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              marketKey === "totals"
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            Over/Under
          </button>
          <button
            type="button"
            onClick={() => setLiveOnly(false)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              !liveOnly
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            Pregame
          </button>
          <button
            type="button"
            onClick={() => setLiveOnly(true)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.2em] transition ${
              liveOnly
                ? "border-emerald-400/60 bg-emerald-500/10 text-emerald-200"
                : "border-white/10 text-white/50 hover:border-white/30 hover:text-white/80"
            }`}
          >
            Live
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span>
            {games.length} games | Updated {lastUpdatedLabel}
          </span>
          <span>Refresh in {remainingSeconds}s</span>
        </div>
        {errorMessage && (
          <div className="mt-2 text-xs text-red-200">{errorMessage}</div>
        )}
      </div>

      <LiveOddsTable
        games={games}
        loading={loading}
        errorMessage={errorMessage}
        marketKey={marketKey}
        sportKey={sportKey}
      />
    </div>
  )
}
