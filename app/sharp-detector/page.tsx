"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency, formatPercent } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'
import { SimpleHeader } from '@/components/ui/simple-header'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, Filter, ChevronDown, Target, Zap, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react'

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

type GameCluster = {
  gameKey: string
  marketTitle: string
  sport: string
  eventDate?: string
  trades: SharpTradeWithStatus[]
  totalNotional: number
  tradeCount: number
}

const MIN_NOTIONAL = 2000
const POLL_INTERVAL_MS = 30000
const RESPECT_CHECK_MS = 15 * 60 * 1000
const RESPECT_TOLERANCE_CENTS = 2
const RESOLUTION_POLL_MS = 5 * 60 * 1000
const STORAGE_KEY = 'sharp-detector-trades'
const CACHE_VERSION_KEY = 'sharp-detector-cache-version'
const CACHE_VERSION = '2'
const MAX_RESOLVED_TRADES = 300

const ensureSharpCacheVersion = () => {
  if (typeof window === 'undefined') return
  try {
    const current = window.localStorage.getItem(CACHE_VERSION_KEY)
    if (current !== CACHE_VERSION) {
      window.localStorage.removeItem(STORAGE_KEY)
      window.localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
    }
  } catch (error) {
    console.warn('Failed to validate sharp detector cache version:', error)
  }
}

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

// Extract game key from market title for clustering
const extractGameKey = (marketTitle: string, sport: string): string => {
  // Normalize and create a key based on teams/event
  const normalized = marketTitle.toLowerCase().trim()
  // Remove common suffixes like "spread", "moneyline", "total", etc.
  const cleaned = normalized
    .replace(/\s*(spread|moneyline|total|over|under|points|yards|touchdowns?|winner|to win).*$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
  return `${sport}:${cleaned}`
}

const resolveGameLabel = (marketTitle: string) =>
  marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()

const resolveStrengthClass = (value?: number | null) => {
  const strength = Number.isFinite(value) ? Number(value) : 0
  if (strength <= 35) return 'text-rose-300'
  if (strength <= 55) return 'text-amber-300'
  return 'text-emerald-300'
}

export default function SharpDetectorPage() {
  const [trades, setTrades] = useState<SharpTradeWithStatus[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      ensureSharpCacheVersion()
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
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null)
  const [lastFetchError, setLastFetchError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'games'>('all')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [sortFilter, setSortFilter] = useState<'newest' | 'strength'>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'blue' | 'mega'>('all')
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)
  const scheduledRef = useRef<Set<string>>(new Set())
  const resolvingRef = useRef<Set<string>>(new Set())

  // Get unique sports for filter
  const sportButtons = useMemo(
    () => ['all', 'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'SOCCER', 'GOLF', 'UFC'],
    []
  )

  const baseTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return trades.filter(trade => {
      if (sportFilter !== 'all' && trade.sport !== sportFilter) return false
      if (statusFilter === 'respected' && trade.status !== 'respected') return false
      if (statusFilter === 'faded' && trade.status !== 'faded') return false
      if (statusFilter === 'pending' && trade.status && trade.status !== 'pending') return false
      if (sizeFilter !== 'all' && resolveSharpTier(trade.notional) !== sizeFilter) return false
      if (query) {
        const haystack = `${trade.marketTitle} ${trade.outcome} ${trade.sport}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [trades, sportFilter, statusFilter, sizeFilter, searchQuery])

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

  // Filter trades
  const filteredTrades = useMemo(() => {
    return baseTrades.filter((trade) => {
      if (gameFilter === 'all') return true
      return extractGameKey(trade.marketTitle, trade.sport) === gameFilter
    })
  }, [baseTrades, gameFilter])

  // Cluster trades by game
  const gameClusters = useMemo(() => {
    const clusters = new Map<string, GameCluster>()

    filteredTrades.forEach(trade => {
      const gameKey = extractGameKey(trade.marketTitle, trade.sport)

      if (!clusters.has(gameKey)) {
        clusters.set(gameKey, {
          gameKey,
          marketTitle: trade.marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim(),
          sport: trade.sport,
          eventDate: trade.eventDate,
          trades: [],
          totalNotional: 0,
          tradeCount: 0,
        })
      }

      const cluster = clusters.get(gameKey)!
      cluster.trades.push(trade)
      cluster.totalNotional += trade.notional
      cluster.tradeCount += 1
    })

    // Sort by total notional (highest first), then filter to games with 2+ trades
    return Array.from(clusters.values())
      .filter(c => c.tradeCount >= 2)
      .sort((a, b) => b.totalNotional - a.totalNotional)
  }, [filteredTrades])

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
      if (sortFilter === 'strength') {
        const strengthA = a.sharpStrength ?? 0
        const strengthB = b.sharpStrength ?? 0
        if (strengthA !== strengthB) return strengthB - strengthA
      }
      const timeA = new Date(a.timestamp).getTime()
      const timeB = new Date(b.timestamp).getTime()
      return timeB - timeA
    })
  }, [filteredTrades, sortFilter])

  const topUpcomingSharps = useMemo(() => {
    const now = Date.now()
    const upcoming = trades.filter((trade) => {
      if (!trade.eventDate) return false
      const eventTime = new Date(trade.eventDate).getTime()
      if (!Number.isFinite(eventTime)) return false
      return eventTime >= now
    })
    return [...upcoming]
      .filter((trade) => Number.isFinite(trade.sharpStrength))
      .sort((a, b) => {
        const strengthA = a.sharpStrength ?? 0
        const strengthB = b.sharpStrength ?? 0
        if (strengthA !== strengthB) return strengthB - strengthA
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      })
      .slice(0, 3)
  }, [trades])

  // Stats
  const stats = useMemo(() => {
    const respected = trades.filter(t => t.status === 'respected').length
    const faded = trades.filter(t => t.status === 'faded').length
    const pending = trades.filter(t => !t.status || t.status === 'pending').length
    const totalNotional = trades.reduce((sum, t) => sum + t.notional, 0)
    const wins = trades.filter(t => t.result === 'win').length
    const losses = trades.filter(t => t.result === 'loss').length
    const totalPnl = trades.reduce((sum, t) => sum + (t.pnl ?? 0), 0)

    return { respected, faded, pending, totalNotional, wins, losses, totalPnl }
  }, [trades])

  const fetchTrades = async () => {
    try {
      const res = await fetch(
        `/api/whale-detector?minNotional=${MIN_NOTIONAL}&limit=200`,
        { cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      const incoming: SharpTrade[] = Array.isArray(data?.trades)
        ? data.trades
        : []
      setLastFetchAt(new Date().toISOString())
      setLastFetchCount(incoming.length)
      setLastFetchError(null)

      setTrades((prev) => {
        const existing = new Map(prev.map((trade) => [trade.id, trade]))
        incoming.forEach((trade) => {
          const current = existing.get(trade.id)
          existing.set(trade.id, current ? { ...current, ...trade } : trade)
          if (!seenIdsRef.current.has(trade.id)) {
            seenIdsRef.current.add(trade.id)
          }
        })
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
      setLastFetchAt(new Date().toISOString())
      setLastFetchError(error instanceof Error ? error.message : 'Unknown error')
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
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      setDebugEnabled(params.has('sharpDebug'))
    } catch {
      setDebugEnabled(false)
    }
  }, [])

  useEffect(() => {
    if (!hydrated) return
    trades.forEach((trade) => seenIdsRef.current.add(trade.id))
  }, [hydrated, trades])

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

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />

      <div className="max-w-6xl mx-auto px-4 py-8 pt-20">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <Target className="w-6 h-6 text-emerald-400" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold">Sharp Detector</h1>
          </div>
          <p className="text-white/60 text-sm">
            Track $2k+ prediction market trades and see if the market respects or fades them
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              Total Volume
            </div>
            <p className="text-lg font-bold text-white">{formatCurrency(stats.totalNotional)}</p>
          </div>
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <div className="flex items-center gap-2 text-emerald-300/70 text-xs mb-1">
              <CheckCircle className="w-3.5 h-3.5" />
              Respected
            </div>
            <p className="text-lg font-bold text-emerald-300">{stats.respected}</p>
          </div>
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4">
            <div className="flex items-center gap-2 text-rose-300/70 text-xs mb-1">
              <XCircle className="w-3.5 h-3.5" />
              Faded
            </div>
            <p className="text-lg font-bold text-rose-300">{stats.faded}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white/50 text-xs mb-1">
              <Clock className="w-3.5 h-3.5" />
              Pending
            </div>
            <p className="text-lg font-bold text-white">{stats.pending}</p>
          </div>
        </div>

        {/* Top upcoming sharps */}
        <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-semibold text-white">Top 3 upcoming sharps</span>
            </div>
            <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              live
            </span>
          </div>
          {topUpcomingSharps.length === 0 ? (
            <p className="text-xs text-white/50">
              No upcoming sharp strength rankings yet.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {topUpcomingSharps.map((trade) => (
                <div
                  key={trade.id}
                  className="rounded-xl border border-white/10 bg-black/50 p-3"
                >
                  <div className="flex items-center justify-between text-[11px] text-white/50 mb-2">
                    <span className="uppercase tracking-[0.2em]">
                      {trade.sport}
                    </span>
                    <span className={cn('font-semibold', resolveStrengthClass(trade.sharpStrength))}>
                      {trade.sharpStrength ?? 0}%
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {trade.outcome}
                  </div>
                  <div className="text-[11px] text-white/50 mt-1">
                    {trade.marketTitle}
                  </div>
                  {trade.eventDate && (
                    <div className="text-[11px] text-white/40 mt-2">
                      {trade.eventDate}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {debugEnabled && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-100">
            <div className="flex flex-wrap items-center gap-3">
              <span>Last fetch: {lastFetchAt ?? 'N/A'}</span>
              <span>API trades: {lastFetchCount ?? 'N/A'}</span>
              <span>Visible trades: {sortedTrades.length}</span>
              <span>Min notional: {formatCurrency(MIN_NOTIONAL)}</span>
              {lastFetchError && <span>Error: {lastFetchError}</span>}
            </div>
          </div>
        )}

        {/* Sport Filters */}
        <div className="mb-4 overflow-x-auto">
          <div className="flex items-center gap-2 min-w-max">
            {sportButtons.map((sport) => (
              <button
                key={sport}
                type="button"
                onClick={() => setSportFilter(sport)}
                className={cn(
                  'px-3 py-1.5 rounded-full border text-[11px] uppercase tracking-[0.2em] transition',
                  sportFilter === sport
                    ? 'border-emerald-400 text-emerald-200 bg-emerald-400/10'
                    : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                )}
              >
                {sport === 'all' ? 'All' : sport}
              </button>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[220px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search bets, teams, or markets..."
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-sm text-white/80 placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          {/* View Mode Toggle */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-2 text-sm font-medium transition",
                viewMode === 'all'
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-white/60 hover:bg-white/5"
              )}
            >
              All Trades
            </button>
            <button
              onClick={() => setViewMode('games')}
              className={cn(
                "px-4 py-2 text-sm font-medium transition flex items-center gap-2",
                viewMode === 'games'
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-white/60 hover:bg-white/5"
              )}
            >
              <Zap className="w-4 h-4" />
              Hot Games
              {gameClusters.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/30 text-[10px] font-bold">
                  {gameClusters.length}
                </span>
              )}
            </button>
          </div>

          {/* Matchup Filter */}
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-sm text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Games</option>
            {gameOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-sm text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="respected">Respected</option>
            <option value="faded">Faded</option>
          </select>

          {/* Sort Filter */}
          <select
            value={sortFilter}
            onChange={(e) =>
              setSortFilter(e.target.value as 'newest' | 'strength')
            }
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-sm text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="newest">Newest</option>
            <option value="strength">Highest %</option>
          </select>

          {/* Bet Size Filter */}
          <select
            value={sizeFilter}
            onChange={(e) =>
              setSizeFilter(e.target.value as 'all' | 'small' | 'blue' | 'mega')
            }
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-sm text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Sizes</option>
            <option value="small">Sharp bet</option>
            <option value="blue">Big sharp</option>
            <option value="mega">Whale</option>
          </select>

          <span className="text-xs text-white/40">
            {filteredTrades.length} trades
          </span>
        </div>

        {/* Game Clusters View */}
        {viewMode === 'games' && (
          <div className="space-y-4 mb-8">
            {gameClusters.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
                <Zap className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-sm">
                  No games with multiple sharp bets yet.
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Games appear here when 2+ big bets are placed on the same event.
                </p>
              </div>
            ) : (
              gameClusters.map((cluster) => (
                <motion.div
                  key={cluster.gameKey}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-transparent p-5"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Zap className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs uppercase tracking-wider text-emerald-300/70">
                          Hot Game - {cluster.tradeCount} sharp bets
                        </span>
                      </div>
                      <h3 className="text-lg font-semibold text-white">{cluster.marketTitle}</h3>
                      <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                        <span className="px-2 py-0.5 rounded-full border border-white/10">
                          {cluster.sport}
                        </span>
                        {cluster.eventDate && (
                          <span className="px-2 py-0.5 rounded-full border border-white/10">
                            {cluster.eventDate}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-emerald-300">
                        {formatCurrency(cluster.totalNotional)}
                      </p>
                      <p className="text-xs text-white/50">total volume</p>
                    </div>
                  </div>

                  {/* Trades in this cluster */}
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    {cluster.trades.map((trade) => {
                      const tier = resolveSharpTier(trade.notional)
                      return (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full border text-[10px] font-semibold uppercase",
                              sharpTierClass[tier]
                            )}>
                              {formatCurrency(trade.notional)}
                            </span>
                            <span className="text-sm text-white/80">{trade.outcome}</span>
                            <span className="text-xs text-white/40">
                              {formatOddsLabel(trade.priceCents, trade.americanOdds)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                      {Number.isFinite(trade.sharpStrength) && (
                        <span className={cn('text-[10px] uppercase font-semibold', resolveStrengthClass(trade.sharpStrength))}>
                          {trade.sharpStrength}% strength
                        </span>
                      )}
                            {trade.status && (
                              <span className={cn(
                                "text-[10px] uppercase font-semibold",
                                trade.status === 'respected' ? 'text-emerald-300' : 'text-rose-300'
                              )}>
                                {trade.status}
                              </span>
                            )}
                            <span className="text-xs text-white/40">
                              {formatTimestamp(trade.timestamp)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* All Trades View */}
        {viewMode === 'all' && (
          <div className="space-y-3">
            {sortedTrades.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
                <Target className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-sm">
                  No sharp bets detected yet.
                </p>
                <p className="text-white/40 text-xs mt-1">
                  Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will appear here.
                </p>
              </div>
            )}
            {sortedTrades.map((trade) => {
              const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
              const pnl = trade.pnl ?? null
              const sharpTier = resolveSharpTier(trade.notional)
              return (
                <motion.div
                  key={trade.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
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
                        <span className={cn('text-[10px] uppercase tracking-[0.3em] font-semibold', resolveStrengthClass(trade.sharpStrength))}>
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
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
