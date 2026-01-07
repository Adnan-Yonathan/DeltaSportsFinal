"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'

type WhaleTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  priceCents: number
  americanOdds: number | null
  notional: number
  timestamp: string
  sport: string
  eventDate?: string
  ticker?: string
  slug?: string
  outcomeIndex?: number
  side?: string
}

type WhaleTradeStatus = 'pending' | 'respected' | 'faded'

type WhaleTradeWithStatus = WhaleTrade & {
  status?: WhaleTradeStatus
  checkedAt?: string
}

const MIN_NOTIONAL = 2000
const POLL_INTERVAL_MS = 30000
const RESPECT_CHECK_MS = 15 * 60 * 1000
const RESPECT_TOLERANCE_CENTS = 2
const STORAGE_KEY = 'whale-detector-trades'
const MAX_RESOLVED_TRADES = 300

const formatOddsLabel = (priceCents: number, americanOdds: number | null) => {
  const centsLabel = `${priceCents}c`
  if (americanOdds == null) return centsLabel
  return `${centsLabel} (${formatAmericanOdds(americanOdds)})`
}

const formatTimestamp = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const resolvePhase = (trade: WhaleTrade) => {
  if (!trade.eventDate) return 'Pregame'
  const today = new Date()
  const todayLabel = today.toISOString().slice(0, 10)
  if (trade.eventDate === todayLabel) return 'Live'
  return new Date(trade.eventDate) < today ? 'Live' : 'Pregame'
}

export default function WhaleDetectorPanel({
  className,
  onNewWhale,
  onCountChange,
}: {
  className?: string
  onNewWhale?: (count: number) => void
  onCountChange?: (count: number) => void
}) {
  const [trades, setTrades] = useState<WhaleTradeWithStatus[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = window.localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.warn('Failed to load whale detector cache:', error)
    }
    return []
  })
  const [hydrated, setHydrated] = useState(typeof window !== 'undefined')
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)
  const scheduledRef = useRef<Set<string>>(new Set())

  const sortedTrades = useMemo(() => {
    const weight = (status?: WhaleTradeStatus) => {
      if (status === 'respected') return 0
      if (status === 'pending' || !status) return 1
      return 2
    }
    return [...trades].sort((a, b) => {
      const weightA = weight(a.status)
      const weightB = weight(b.status)
      if (weightA !== weightB) return weightA - weightB
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeB - timeA
    })
  }, [trades])

  const fetchTrades = async () => {
    try {
      const res = await fetch(
        `/api/whale-detector?minNotional=${MIN_NOTIONAL}&limit=40`,
        { cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      const incoming: WhaleTrade[] = Array.isArray(data?.trades)
        ? data.trades
        : []

      setTrades((prev) => {
        const existing = new Map(prev.map((trade) => [trade.id, trade]))
        const newIds: string[] = []
        incoming.forEach((trade) => {
          const current = existing.get(trade.id)
          existing.set(trade.id, current ? { ...trade, ...current } : trade)
          if (!seenIdsRef.current.has(trade.id)) {
            newIds.push(trade.id)
            seenIdsRef.current.add(trade.id)
          }
        })
        if (hasInitializedRef.current && newIds.length > 0) {
          onNewWhale?.(newIds.length)
        }
        if (!hasInitializedRef.current) {
          hasInitializedRef.current = true
        }
        const next = Array.from(existing.values())
        const pending = next
          .filter((trade) => !trade.status || trade.status === 'pending')
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        const resolved = next
          .filter((trade) => trade.status && trade.status !== 'pending')
          .sort(
            (a, b) =>
              new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
          .slice(0, MAX_RESOLVED_TRADES)
        return [...pending, ...resolved]
      })
    } catch (error) {
      console.warn('Whale detector fetch failed:', error)
    }
  }

  const fetchCurrentPrice = async (trade: WhaleTradeWithStatus) => {
    try {
      if (trade.source === 'kalshi' && trade.ticker) {
        const res = await fetch(
          `/api/whale-detector/price?source=kalshi&ticker=${encodeURIComponent(
            trade.ticker
          )}&side=${trade.side ?? 'yes'}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return null
        const data = await res.json()
        return Number(data?.priceCents)
      }
      if (
        trade.source === 'polymarket' &&
        trade.slug &&
        Number.isFinite(trade.outcomeIndex)
      ) {
        const res = await fetch(
          `/api/whale-detector/price?source=polymarket&slug=${encodeURIComponent(
            trade.slug
          )}&outcomeIndex=${trade.outcomeIndex}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return null
        const data = await res.json()
        return Number(data?.priceCents)
      }
    } catch (error) {
      console.warn('Whale detector price fetch failed:', error)
    }
    return null
  }

  const evaluateTrade = async (trade: WhaleTradeWithStatus) => {
    const currentPrice = await fetchCurrentPrice(trade)
    if (!Number.isFinite(currentPrice)) return
    const delta = currentPrice - trade.priceCents
    const status: WhaleTradeStatus =
      delta >= -RESPECT_TOLERANCE_CENTS ? 'respected' : 'faded'
    setTrades((prev) =>
      prev.map((item) =>
        item.id === trade.id
          ? {
              ...item,
              status,
              checkedAt: new Date().toISOString(),
            }
          : item
      )
    )
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    trades.forEach((trade) => seenIdsRef.current.add(trade.id))
    setHydrated(true)
  }, [trades])

  useEffect(() => {
    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trades))
    } catch (error) {
      console.warn('Failed to persist whale detector cache:', error)
    }
  }, [hydrated, trades])

  useEffect(() => {
    const now = Date.now()
    trades.forEach((trade) => {
      if (trade.status || scheduledRef.current.has(trade.id)) return
      const tradeTime = new Date(trade.timestamp).getTime()
      if (!Number.isFinite(tradeTime)) return
      const delay = tradeTime + RESPECT_CHECK_MS - now
      if (delay <= 0) {
        scheduledRef.current.add(trade.id)
        void evaluateTrade(trade)
        return
      }
      scheduledRef.current.add(trade.id)
      setTimeout(() => {
        void evaluateTrade(trade)
      }, delay)
    })
  }, [trades])

  const now = Date.now()

  useEffect(() => {
    onCountChange?.(sortedTrades.length)
  }, [onCountChange, sortedTrades.length])

  return (
    <div className={cn('space-y-3', className)}>
      {sortedTrades.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          No whale alerts yet. Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will
          appear here.
        </div>
      )}
      {sortedTrades.map((trade) => {
        const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
        return (
          <div
            key={trade.id}
            className={cn(
              'rounded-2xl border border-white/10 bg-black/40 p-4 transition',
              isFresh &&
                'border-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
                {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
              </span>
              {trade.status && (
                <span
                  className={cn(
                    'text-[10px] uppercase tracking-[0.3em] font-semibold',
                    trade.status === 'respected'
                      ? 'text-emerald-300'
                      : 'text-rose-300'
                  )}
                >
                  {trade.status}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm font-semibold text-white">
              Someone put {formatCurrency(trade.notional)} on {trade.outcome} in{' '}
              {trade.marketTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                {trade.outcome}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                {resolvePhase(trade)}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                {trade.sport}
              </span>
              {trade.eventDate && (
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  {trade.eventDate}
                </span>
              )}
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                {formatOddsLabel(trade.priceCents, trade.americanOdds)}
              </span>
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                Detected {formatTimestamp(trade.timestamp)}
              </span>
            </div>
            {!trade.status && (
              <p className="mt-2 text-[11px] text-white/40">
                Respect check in 15 minutes.
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
