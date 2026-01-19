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

  const isSyndicate = Boolean(membership?.isActive && membership?.tier === 'syndicate')

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
        const res = await fetch('/api/whale-detector?minNotional=2000&limit=200', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        const incoming: SharpTrade[] = Array.isArray(data?.trades) ? data.trades : []
        const ultraSharps = incoming.filter(
          (trade) =>
            trade.isUltraSharp === true &&
            (trade.sharpStrength ?? 0) > 55 &&
            !isTradeLive(trade)
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
    <div className="fixed right-4 top-20 z-50 flex w-[320px] flex-col gap-3 sm:right-6 sm:top-24">
      {alerts.map((alert) => {
        const trade = alert.trade
        const previewClass = isSyndicate ? '' : 'blur-sm select-none'
        return (
          <div
            key={alert.id}
            className="rounded-2xl border border-emerald-500/30 bg-black/90 p-3 shadow-[0_15px_40px_rgba(0,0,0,0.45)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-emerald-500/20 p-2">
                  <Zap className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
                    Sharp Alert
                  </p>
                  <p className="text-[11px] text-white/50">{formatTimestamp(trade.timestamp)}</p>
                </div>
              </div>
              <button
                onClick={() => dismissAlert(alert.id)}
                className="rounded-full p-1 text-white/40 transition hover:text-white"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 space-y-1">
              <p className={cn('text-sm font-semibold text-white', previewClass)}>
                {trade.marketTitle}
              </p>
              <p className={cn('text-sm text-white/70', previewClass)}>
                {trade.outcome} • {trade.sport}
              </p>
              <p className={cn('text-xs text-emerald-300', previewClass)}>
                Grade: {Number.isFinite(trade.sharpStrength) ? `${trade.sharpStrength}%` : '—'}
              </p>
            </div>

            {!isSyndicate && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                <div className="flex items-center gap-2 text-[11px] text-white/60">
                  <Lock className="h-3.5 w-3.5" />
                  Syndicate preview
                </div>
                <Link
                  href="/pricing"
                  className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-300"
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
