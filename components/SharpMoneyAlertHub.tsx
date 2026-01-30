"use client"

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Zap, Lock, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'

type SharpTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  isUltraSharp?: boolean
  sharpStrength?: number
  sportsbookBestOdds?: number | null
  sportsbookBookTitle?: string | null
  sportsbookBookKey?: string | null
  crossMarketEvPercent?: number | null
  sport: string
  timestamp: string
  eventDate?: string
}

type SharpAlert = {
  id: string
  trade: SharpTrade
  createdAt: string
}

const POLL_INTERVAL_MS = 15000
const ALERT_TTL_MS = 30000
const MAX_ALERTS = 4
const SEEN_STORAGE_KEY = 'sharp-money-alerts-seen'
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const parseEventTime = (value?: string | null) => {
  if (!value) return null
  const match = value.match(DATE_ONLY_PATTERN)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const date = new Date(year, month - 1, day, 23, 59, 59, 999)
    const time = date.getTime()
    return Number.isFinite(time) ? time : null
  }
  const parsed = new Date(value)
  const time = parsed.getTime()
  return Number.isFinite(time) ? time : null
}

const isTradeLive = (trade: SharpTrade) => {
  if (!trade.eventDate) return false
  const eventTime = parseEventTime(trade.eventDate)
  if (!eventTime) return false
  const now = Date.now()
  const fourHoursMs = 4 * 60 * 60 * 1000
  return eventTime <= now && eventTime > now - fourHoursMs
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatOddsLabel = (value?: number | null) => {
  if (!Number.isFinite(value)) return null
  const odds = Number(value)
  return odds >= 0 ? `+${odds}` : `${odds}`
}

const isLiquidityTrade = (trade: SharpTrade) => trade.id?.startsWith('liquidity:')

const loadSeenIds = () => {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = window.localStorage.getItem(SEEN_STORAGE_KEY)
    if (!raw) return new Set<string>()
    const parsed = JSON.parse(raw)
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set<string>()
  }
}

const persistSeenIds = (ids: Set<string>) => {
  if (typeof window === 'undefined') return
  try {
    const capped = Array.from(ids.values()).slice(-500)
    window.localStorage.setItem(SEEN_STORAGE_KEY, JSON.stringify(capped))
  } catch {
    // ignore
  }
}

export default function SharpMoneyAlertHub() {
  const [alerts, setAlerts] = useState<SharpAlert[]>([])
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)

  const isSyndicate = membership?.tier === 'syndicate'

  useEffect(() => {
    seenIdsRef.current = loadSeenIds()
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const loadMembership = async () => {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (!user) {
        setMembership(null)
        return
      }
      setMembership(getMembershipStatus(user.user_metadata))
    }
    loadMembership()
  }, [])

  useEffect(() => {
    let active = true
    const fetchTrades = async () => {
      try {
        const res = await fetch(
          '/api/whale-detector?minNotional=2000&limit=200&includeLiquidity=true',
          {
          cache: 'no-store',
          }
        )
        if (!res.ok) return
        const data = await res.json()
        const incoming: SharpTrade[] = Array.isArray(data?.trades) ? data.trades : []
        const ultraSharps = incoming.filter(
          (trade) =>
            trade.isUltraSharp === true &&
            (trade.sharpStrength ?? 0) > 55 &&
            !isTradeLive(trade) &&
            (trade.crossMarketEvPercent != null || isLiquidityTrade(trade)) &&
            trade.sportsbookBestOdds != null
        )

        if (!hasInitializedRef.current) {
          const latest = [...ultraSharps].sort((a, b) => {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          })[0]
          if (latest && !seenIdsRef.current.has(latest.id)) {
            seenIdsRef.current.add(latest.id)
            persistSeenIds(seenIdsRef.current)
            setAlerts((prev) => [
              {
                id: latest.id,
                trade: latest,
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ].slice(0, MAX_ALERTS))
            setTimeout(() => {
              setAlerts((prev) => prev.filter((entry) => entry.id !== latest.id))
            }, ALERT_TTL_MS)
          } else {
            ultraSharps.forEach((trade) => seenIdsRef.current.add(trade.id))
            persistSeenIds(seenIdsRef.current)
          }
          hasInitializedRef.current = true
          return
        }

        const newTrades = ultraSharps.filter(
          (trade) => !seenIdsRef.current.has(trade.id)
        )
        if (newTrades.length === 0) return

        newTrades.forEach((trade) => seenIdsRef.current.add(trade.id))
        persistSeenIds(seenIdsRef.current)

        const nextAlerts = newTrades.map((trade) => ({
          id: trade.id,
          trade,
          createdAt: new Date().toISOString(),
        }))

        if (!active) return
        setAlerts((prev) => [...nextAlerts, ...prev].slice(0, MAX_ALERTS))
        nextAlerts.forEach((alert) => {
          setTimeout(() => {
            setAlerts((prev) => prev.filter((entry) => entry.id !== alert.id))
          }, ALERT_TTL_MS)
        })
      } catch {
        // ignore
      }
    }

    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((alert) => alert.id !== id))
  }

  if (alerts.length === 0) return null

  return (
    <div className="fixed right-3 top-16 z-50 flex w-[220px] flex-col gap-2 sm:right-6 sm:top-24 sm:w-[320px] sm:gap-3">
      {alerts.map((alert) => {
        const trade = alert.trade
        const previewClass = isSyndicate ? '' : 'blur-sm select-none'
        return (
          <div
            key={alert.id}
            className="rounded-full border border-emerald-500/30 bg-black/90 px-3 py-2 shadow-[0_12px_30px_rgba(0,0,0,0.45)] sm:rounded-2xl sm:p-3"
          >
            <div className="flex items-center justify-between gap-2 sm:items-start">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-emerald-500/20 p-1.5 sm:p-2">
                  <Zap className="h-3.5 w-3.5 text-emerald-300 sm:h-4 sm:w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300 sm:text-xs sm:tracking-[0.25em]">
                    Sharp Alert
                  </p>
                  <p className="text-[10px] text-white/50 sm:text-[11px]">{formatTimestamp(trade.timestamp)}</p>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="rounded-full p-1 text-white/40 transition hover:text-white"
                aria-label="Dismiss alert"
              >
                <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </button>
            </div>

            <div className="mt-2 space-y-1 sm:mt-3">
              <p className={cn('text-[11px] font-semibold text-white sm:text-sm', previewClass)}>
                {trade.marketTitle}
              </p>
              <p className={cn('text-[11px] text-white/70 sm:text-sm', previewClass)}>
                {trade.outcome} • {trade.sport}
              </p>
              {trade.sportsbookBestOdds != null && (
                <p className={cn('text-[10px] text-white/60 sm:text-xs', previewClass)}>
                  Best odds: {formatOddsLabel(trade.sportsbookBestOdds)}
                  {trade.sportsbookBookTitle || trade.sportsbookBookKey
                    ? ` (${trade.sportsbookBookTitle ?? trade.sportsbookBookKey})`
                    : ''}
                </p>
              )}
              {trade.crossMarketEvPercent != null && (
                <p className={cn('text-[10px] text-white/60 sm:text-xs', previewClass)}>
                  EV: {trade.crossMarketEvPercent.toFixed(1)}%
                </p>
              )}
              <p className={cn('text-[10px] text-emerald-300 sm:text-xs', previewClass)}>
                Grade: {Number.isFinite(trade.sharpStrength) ? `${trade.sharpStrength}%` : '—'}
              </p>
            </div>

            {!isSyndicate && (
              <div className="mt-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1 sm:mt-3 sm:py-1.5">
                <div className="flex items-center gap-2 text-[10px] text-white/60 sm:text-[11px]">
                  <Lock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                  Syndicate preview
                </div>
                <Link
                  href="/pricing"
                  className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-300 sm:text-[11px]"
                >
                  Upgrade
                </Link>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

