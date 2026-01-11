"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency, formatPercent } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'

type SharpTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  priceCents: number
  americanOdds: number | null
  notional: number
  contracts: number
  timestamp: string
  sport: string
  eventDate?: string
  ticker?: string
  slug?: string
  outcomeIndex?: number
  side?: string
  sharpStrength?: number
}

type SharpTradeStatus = 'pending' | 'respected' | 'faded'

type SharpTradeWithStatus = SharpTrade & {
  status?: SharpTradeStatus
  checkedAt?: string
  result?: 'win' | 'loss'
  resolvedAt?: string
  pnl?: number
  roi?: number
}

type SharpTier = 'small' | 'blue' | 'mega'

const MIN_NOTIONAL = 2000
const POLL_INTERVAL_MS = 30000
const RESPECT_CHECK_MS = 15 * 60 * 1000
const RESPECT_TOLERANCE_CENTS = 2
const RESOLUTION_POLL_MS = 5 * 60 * 1000
const STORAGE_KEY = 'sharp-detector-trades'
const MAX_RESOLVED_TRADES = 300

const formatOddsLabel = (priceCents: number, americanOdds: number | null) => {  
  const centsLabel = `${priceCents}c`
  if (americanOdds == null) return centsLabel
  return `${centsLabel} (${formatAmericanOdds(americanOdds)})`
}

const formatSignedCurrency = (amount: number) => {
  const sign = amount >= 0 ? '+' : '-'
  return `${sign}${formatCurrency(Math.abs(amount))}`
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

const resolvePhase = (trade: SharpTrade) => {
  if (!trade.eventDate) return 'Pregame'
  const eventDate = new Date(trade.eventDate)
  if (Number.isNaN(eventDate.getTime())) return 'Pregame'
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return eventDate < todayStart ? 'Live' : 'Pregame'
}

const resolveSharpTier = (notional: number): SharpTier => {
  if (notional >= 10000) return 'mega'
  if (notional >= 5000) return 'blue'
  return 'small'
}

const sharpTierLabel: Record<SharpTier, string> = {
  small: 'Sharp bet',
  blue: 'Big sharp',
  mega: 'Whale',
}

const sharpTierClass: Record<SharpTier, string> = {
  small: 'border-emerald-500/30 text-emerald-200',
  blue: 'border-sky-400/40 text-sky-200',
  mega: 'border-rose-400/40 text-rose-200',
}

const extractGameKey = (marketTitle: string, sport: string): string => {
  const normalized = marketTitle.toLowerCase().trim()
  const cleaned = normalized
    .replace(/\s*(spread|moneyline|total|over|under|points|yards|touchdowns?|winner|to win).*$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
  return `${sport}:${cleaned}`
}

const resolveGameLabel = (marketTitle: string) =>
  marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()

export default function SharpDetectorPanel({
  className,
  onNewSharp,
  onCountChange,
}: {
  className?: string
  onNewSharp?: (count: number) => void
  onCountChange?: (count: number) => void
}) {
  const [trades, setTrades] = useState<SharpTradeWithStatus[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = window.localStorage.getItem(STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.warn('Failed to load sharp detector cache:', error)
    }
    return []
  })
  const [hydrated, setHydrated] = useState(typeof window !== 'undefined')       
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)
  const scheduledRef = useRef<Set<string>>(new Set())
  const resolvingRef = useRef<Set<string>>(new Set())

  const baseTrades = useMemo(() => {
    return trades.filter((trade) => {
      if (sportFilter !== 'all' && trade.sport !== sportFilter) return false
      return true
    })
  }, [trades, sportFilter])

  const gameOptions = useMemo(() => {
    const map = new Map<string, string>()
    baseTrades.forEach((trade) => {
      const key = extractGameKey(trade.marketTitle, trade.sport)
      if (!map.has(key)) {
        map.set(key, resolveGameLabel(trade.marketTitle))
      }
    })
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [baseTrades])

  useEffect(() => {
    if (gameFilter === 'all') return
    if (!gameOptions.some((option) => option.key === gameFilter)) {
      setGameFilter('all')
    }
  }, [gameFilter, gameOptions])

  const filteredTrades = useMemo(() => {
    return baseTrades.filter((trade) => {
      if (gameFilter === 'all') return true
      return extractGameKey(trade.marketTitle, trade.sport) === gameFilter
    })
  }, [baseTrades, gameFilter])

  const uniqueSports = useMemo(() => {
    const sports = new Set(trades.map((trade) => trade.sport))
    return Array.from(sports).sort()
  }, [trades])

  const sortedTrades = useMemo(() => {
    const weight = (status?: SharpTradeStatus) => {
      if (status === 'respected') return 0
      if (status === 'pending' || !status) return 1
      return 2
    }
    return [...filteredTrades].sort((a, b) => {
      const weightA = weight(a.status)
      const weightB = weight(b.status)
      if (weightA !== weightB) return weightA - weightB
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeB - timeA
    })
  }, [filteredTrades])

  const fetchTrades = async () => {
    try {
      const res = await fetch(
        `/api/whale-detector?minNotional=${MIN_NOTIONAL}&limit=40`,
        { cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      const incoming: SharpTrade[] = Array.isArray(data?.trades)
        ? data.trades
        : []

      setTrades((prev) => {
        const existing = new Map(prev.map((trade) => [trade.id, trade]))
        const newIds: string[] = []
        incoming.forEach((trade) => {
          const current = existing.get(trade.id)
          existing.set(trade.id, current ? { ...current, ...trade } : trade)
          if (!seenIdsRef.current.has(trade.id)) {
            newIds.push(trade.id)
            seenIdsRef.current.add(trade.id)
          }
        })
        if (hasInitializedRef.current && newIds.length > 0) {
          onNewSharp?.(newIds.length)
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
      console.warn('Sharp detector fetch failed:', error)
    }
  }

  const fetchCurrentPrice = async (trade: SharpTradeWithStatus) => {
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
      console.warn('Sharp detector price fetch failed:', error)
    }
    return null
  }

  const fetchResolvedOutcome = async (trade: SharpTradeWithStatus) => {
    try {
      if (trade.source === 'kalshi' && trade.ticker) {
        const res = await fetch(
          `/api/whale-detector/resolve?source=kalshi&ticker=${encodeURIComponent(
            trade.ticker
          )}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.resolved || !data?.outcome) return null
        return String(data.outcome)
      }
      if (trade.source === 'polymarket' && trade.slug) {
        const res = await fetch(
          `/api/whale-detector/resolve?source=polymarket&slug=${encodeURIComponent(
            trade.slug
          )}`,
          { cache: 'no-store' }
        )
        if (!res.ok) return null
        const data = await res.json()
        if (!data?.resolved || !data?.outcome) return null
        return String(data.outcome)
      }
    } catch (error) {
      console.warn('Sharp detector resolve fetch failed:', error)
    }
    return null
  }

  const normalizeOutcome = (value: string) =>
    value.trim().toLowerCase().replace(/\s+/g, ' ')

  const resolveTradeResult = async (trade: SharpTradeWithStatus) => {
    if (trade.result || resolvingRef.current.has(trade.id)) return
    resolvingRef.current.add(trade.id)
    const outcome = await fetchResolvedOutcome(trade)
    resolvingRef.current.delete(trade.id)
    if (!outcome) return
    const normalizedOutcome = normalizeOutcome(outcome)
    const tradeOutcome = normalizeOutcome(trade.outcome)
    const isWin =
      trade.source === 'kalshi' && trade.side
        ? trade.side === normalizedOutcome
        : tradeOutcome === normalizedOutcome
    const price = trade.priceCents / 100
    const contracts =
      Number.isFinite(trade.contracts) && trade.contracts > 0
        ? trade.contracts
        : price > 0
          ? trade.notional / price
          : 0
    if (!Number.isFinite(contracts) || contracts <= 0) return
    const pnl = isWin ? contracts * (1 - price) : -contracts * price
    const roi = trade.notional > 0 ? pnl / trade.notional : 0
    setTrades((prev) =>
      prev.map((item) =>
        item.id === trade.id
          ? {
              ...item,
              result: isWin ? 'win' : 'loss',
              resolvedAt: new Date().toISOString(),
              pnl,
              roi,
            }
          : item
      )
    )
  }

  const evaluateTrade = async (trade: SharpTradeWithStatus) => {
    const currentPrice = await fetchCurrentPrice(trade)
    if (currentPrice == null || !Number.isFinite(currentPrice)) return
    const delta = currentPrice - trade.priceCents
    const status: SharpTradeStatus =
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
      console.warn('Failed to persist sharp detector cache:', error)
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

  useEffect(() => {
    const unresolved = trades.filter((trade) => !trade.result)
    if (unresolved.length === 0) return
    unresolved.forEach((trade) => {
      void resolveTradeResult(trade)
    })
    const interval = setInterval(() => {
      unresolved.forEach((trade) => {
        void resolveTradeResult(trade)
      })
    }, RESOLUTION_POLL_MS)
    return () => clearInterval(interval)
  }, [trades])

  const now = Date.now()

  useEffect(() => {
    onCountChange?.(sortedTrades.length)
  }, [onCountChange, sortedTrades.length])

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={sportFilter}
        onChange={(e) => setSportFilter(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="all">All Sports</option>
        {uniqueSports.map((sport) => (
          <option key={sport} value={sport}>
            {sport}
          </option>
        ))}
      </select>
      <select
        value={gameFilter}
        onChange={(e) => setGameFilter(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="all">All Games</option>
        {gameOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <span className="text-[10px] text-white/40">
        {filteredTrades.length} trades
      </span>
    </div>
  )

  return (
    <div className={cn('space-y-3', className)}>
      {filters}
      {sortedTrades.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          No sharp bets detected yet. Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will
          appear here.
        </div>
      )}
      {sortedTrades.map((trade) => {
        const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
        const pnl = trade.pnl ?? null
        const sharpTier = resolveSharpTier(trade.notional)
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
                    <div className="flex items-center gap-2">
                      {Number.isFinite(trade.sharpStrength) && (
                        <span className="text-[10px] uppercase tracking-[0.3em] font-semibold text-emerald-300">
                          {trade.sharpStrength}% strength
                        </span>
                      )}
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
                  </div>
            <p className="mt-2 text-sm font-semibold text-white">
              Someone put {formatCurrency(trade.notional)} on {trade.outcome} in{' '}
              {trade.marketTitle}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
              <span
                className={cn(
                  'rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
                  sharpTierClass[sharpTier]
                )}
              >
                {sharpTierLabel[sharpTier]}
              </span>
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
              {trade.result && (
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  {trade.result === 'win' ? 'Win' : 'Loss'}
                </span>
              )}
              {trade.result && pnl != null && Number.isFinite(pnl) && (
                <span className="rounded-full border border-white/10 px-2 py-0.5">
                  {formatSignedCurrency(pnl)} ({formatPercent(trade.roi ?? 0)})
                </span>
              )}
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
