"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'
import { getWalletAlias } from '@/lib/utils/wallet-alias'

type SharpTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
  proxyWallet?: string
  priceCents: number
  americanOdds: number | null
  currentPriceCents?: number | null
  currentAmericanOdds?: number | null
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
  result?: 'win' | 'loss' | 'push'
  resolvedAt?: string
  pnl?: number
  roi?: number
}

type SharpTier = 'small' | 'blue' | 'mega'

const MIN_NOTIONAL = 2000
const POLL_INTERVAL_MS = 30000
const STORAGE_KEY = 'sharp-detector-trades'
const CACHE_VERSION_KEY = 'sharp-detector-cache-version'
const CACHE_VERSION = '3'
const WALLET_STORAGE_KEY = 'sharp-detector-wallets'
const MAX_RESOLVED_TRADES = 300
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

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

const resolveOddsLabel = (trade: SharpTrade) => {
  const priceCents = trade.currentPriceCents ?? trade.priceCents
  const odds = trade.currentAmericanOdds ?? trade.americanOdds
  const label = formatOddsLabel(priceCents, odds)
  if (trade.currentPriceCents != null && trade.currentPriceCents !== trade.priceCents) {
    return `${label} now`
  }
  return label
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

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const trimmed = value.trim().toLowerCase()
  return trimmed ? trimmed : null
}

const formatWalletAlias = (value?: string | null) => getWalletAlias(value)

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

const resolvePhase = (trade: SharpTrade) => {
  if (!trade.eventDate) return 'Pregame'
  const eventTime = parseEventTime(trade.eventDate)
  if (eventTime == null || !Number.isFinite(eventTime)) return 'Pregame'
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  return eventTime < todayStart.getTime() ? 'Live' : 'Pregame'
}

const resolveSharpTier = (notional: number): SharpTier => {
  if (notional >= 10000) return 'mega'
  if (notional >= 5000) return 'blue'
  return 'small'
}

const EASTERN_TIMEZONE = 'America/New_York'

const getEasternDateKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const sharpTierLabel: Record<SharpTier, string> = {
  small: 'Swordfish',
  blue: 'Megalodon',
  mega: 'Blue whale',
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

const resolveStrengthClass = (value?: number | null) => {
  const strength = Number.isFinite(value) ? Number(value) : 0
  if (strength <= 35) return 'text-rose-300'
  if (strength <= 55) return 'text-amber-300'
  return 'text-emerald-300'
}

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
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [sortFilter, setSortFilter] = useState<'newest' | 'strength'>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'blue' | 'mega'>('all')
  const [walletFilter, setWalletFilter] = useState<string>('all')
  const [trackedWallets, setTrackedWallets] = useState<string[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const cached = window.localStorage.getItem(WALLET_STORAGE_KEY)
      if (cached) {
        const parsed = JSON.parse(cached)
        return Array.isArray(parsed) ? parsed : []
      }
    } catch (error) {
      console.warn('Failed to load tracked wallets:', error)
    }
    return []
  })
  const [showTrackedWallets, setShowTrackedWallets] = useState(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)

  const baseTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const walletKey = walletFilter === 'all' ? null : normalizeWallet(walletFilter)
    return trades.filter((trade) => {
      if (sportFilter !== 'all' && trade.sport !== sportFilter) return false
      if (sizeFilter !== 'all' && resolveSharpTier(trade.notional) !== sizeFilter) return false
      if (walletKey) {
        if (trade.source !== 'polymarket') return false
        const tradeWallet = normalizeWallet(trade.proxyWallet)
        if (!tradeWallet || tradeWallet !== walletKey) return false
      }
      if (query) {
        const haystack = `${trade.marketTitle} ${trade.outcome} ${trade.sport}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [trades, sportFilter, sizeFilter, searchQuery, walletFilter])

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

  const todaySharps = useMemo(() => {
    const todayKey = getEasternDateKey(new Date())
    return trades.filter(
      (trade) => getEasternDateKey(trade.timestamp) === todayKey
    ).length
  }, [trades])

  const sportButtons = useMemo(
    () => ['all', 'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'SOCCER', 'GOLF', 'UFC'],
    []
  )

  const trackedWalletSet = useMemo(
    () => new Set(trackedWallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[]),
    [trackedWallets]
  )

  const trackedWalletTradePreview = useMemo(() => {
    const preview = trades
      .filter((trade) => {
        if (trade.source !== 'polymarket') return false
        const wallet = normalizeWallet(trade.proxyWallet)
        return wallet ? trackedWalletSet.has(wallet) : false
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
    return preview
  }, [trades, trackedWalletSet])

  const winningWallets = useMemo(() => {
    const stats = new Map<string, { wallet: string; wins: number; pnl: number }>()
    trades.forEach((trade) => {
      if (trade.source !== 'polymarket') return
      const wallet = normalizeWallet(trade.proxyWallet)
      if (!wallet || !trackedWalletSet.has(wallet)) return
      const hasWin = trade.result === 'win'
      const pnl = Number.isFinite(trade.pnl) ? Number(trade.pnl) : 0
      const roi = Number.isFinite(trade.roi) ? Number(trade.roi) : 0
      if (!hasWin && pnl <= 0 && roi <= 0) return
      const entry = stats.get(wallet) ?? { wallet, wins: 0, pnl: 0 }
      if (hasWin) entry.wins += 1
      if (pnl > 0) entry.pnl += pnl
      stats.set(wallet, entry)
    })
    return Array.from(stats.values()).sort((a, b) => {
      if (a.pnl !== b.pnl) return b.pnl - a.pnl
      return b.wins - a.wins
    })
  }, [trades, trackedWalletSet])

  const winningWalletTradePreview = useMemo(() => {
    if (!winningWallets.length) return []
    const winners = new Set(winningWallets.map((entry) => entry.wallet))
    return trades
      .filter((trade) => {
        if (trade.source !== 'polymarket') return false
        const wallet = normalizeWallet(trade.proxyWallet)
        return wallet ? winners.has(wallet) : false
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
  }, [trades, winningWallets])

  const walletStats = useMemo(() => {
    const stats = new Map<string, { wallet: string; count: number; lastSeen?: string }>()
    trades.forEach((trade) => {
      if (trade.source !== 'polymarket') return
      const walletKey = normalizeWallet(trade.proxyWallet)
      if (!walletKey) return
      const entry = stats.get(walletKey) ?? { wallet: walletKey, count: 0 }
      entry.count += 1
      if (!entry.lastSeen || trade.timestamp > entry.lastSeen) {
        entry.lastSeen = trade.timestamp
      }
      stats.set(walletKey, entry)
    })

    const rows = trackedWallets.map((wallet) => {
      const walletKey = normalizeWallet(wallet) ?? wallet
      const entry = stats.get(walletKey)
      return {
        wallet: walletKey,
        count: entry?.count ?? 0,
        lastSeen: entry?.lastSeen ?? null,
      }
    })

    return rows.sort((a, b) => {
      const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0
      const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0
      if (timeA !== timeB) return timeB - timeA
      return b.count - a.count
    })
  }, [trades, trackedWallets])

  const sortedTrades = useMemo(() => {
    const weight = (status?: SharpTradeStatus) => {
      if (status === 'respected') return 0
      if (status === 'pending' || !status) return 1
      return 2
    }
    return [...filteredTrades].sort((a, b) => {
      if (sortFilter === 'strength') {
        const weightA = weight(a.status)
        const weightB = weight(b.status)
        if (weightA !== weightB) return weightA - weightB
      }
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
      setLastFetchAt(new Date().toISOString())
      setLastFetchError(error instanceof Error ? error.message : 'Unknown error')
    }
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
    if (!hydrated) return
    setTrackedWallets((prev) => {
      const next = new Set(prev)
      trades.forEach((trade) => {
        if (trade.source !== 'polymarket') return
        const wallet = normalizeWallet(trade.proxyWallet)
        if (wallet) next.add(wallet)
      })
      if (next.size === prev.length) return prev
      return Array.from(next)
    })
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
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(trackedWallets))
    } catch (error) {
      console.warn('Failed to persist tracked wallets:', error)
    }
  }, [hydrated, trackedWallets])

  const now = Date.now()

  useEffect(() => {
    onCountChange?.(todaySharps)
  }, [onCountChange, todaySharps])

  const filters = (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search bets..."
        className="min-w-[180px] flex-1 rounded-lg border border-white/10 bg-black px-2.5 py-1.5 text-[11px] text-white/80 placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none"
      />
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
      <select
        value={sizeFilter}
        onChange={(e) =>
          setSizeFilter(e.target.value as 'all' | 'small' | 'blue' | 'mega')
        }
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="all">All Sizes</option>
        <option value="small">Swordfish</option>
        <option value="blue">Megalodon</option>
        <option value="mega">Blue whale</option>
      </select>
      <select
        value={sortFilter}
        onChange={(e) =>
          setSortFilter(e.target.value as 'newest' | 'strength')
        }
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="newest">Newest</option>
        <option value="strength">Highest %</option>
      </select>
      <span className="text-[10px] text-white/40">
        {todaySharps} sharps detected
      </span>
      {walletFilter !== 'all' && (
        <button
          type="button"
          onClick={() => setWalletFilter('all')}
          className="rounded-lg border border-emerald-400/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.2em] text-emerald-200"
        >
          Wallet {formatWalletAlias(walletFilter)} x
        </button>
      )}
    </div>
  )

  return (
    <div className={cn('space-y-3', className)}>
      {debugEnabled && (
        <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-3 text-[11px] text-amber-100">
          <div className="flex flex-wrap items-center gap-2">
            <span>Last fetch: {lastFetchAt ?? 'N/A'}</span>
            <span>API trades: {lastFetchCount ?? 'N/A'}</span>
            <span>Visible trades: {sortedTrades.length}</span>
            <span>Min notional: {formatCurrency(MIN_NOTIONAL)}</span>
            {lastFetchError && <span>Error: {lastFetchError}</span>}
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          {sportButtons.map((sport) => (
            <button
              key={sport}
              type="button"
              onClick={() => setSportFilter(sport)}
              className={cn(
                'px-2.5 py-1 rounded-full border text-[10px] uppercase tracking-[0.2em] transition',
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
      {filters}
      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <div className="flex items-center justify-between text-[11px] text-white/60">
          <span className="uppercase tracking-[0.3em]">Tracked wallets</span>
          <button
            type="button"
            onClick={() => setShowTrackedWallets((prev) => !prev)}
            className={cn(
              'rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] transition',
              showTrackedWallets
                ? 'border-emerald-400/60 text-emerald-200 bg-emerald-400/10'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            )}
          >
            {showTrackedWallets ? 'Hide' : 'View'} ({trackedWallets.length})
          </button>
        </div>
        <div className="mt-3 space-y-3">
          <div className="rounded-xl border border-white/10 bg-black/30 p-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Recent tracked bets
            </div>
            {trackedWalletTradePreview.length === 0 ? (
              <div className="mt-2 text-[11px] text-white/50">
                No tracked Polymarket bets yet.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {trackedWalletTradePreview.map((trade) => (
                  <div key={trade.id} className="text-[11px] text-white/70">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white/80">
                        {formatWalletAlias(trade.proxyWallet)}
                      </span>
                      <span className="text-white/50">
                        {trade.outcome} - {formatCurrency(trade.notional)}
                      </span>
                    </div>
                    <div className="mt-1 text-white/40">{trade.marketTitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-xl border border-white/10 bg-black/30 p-2">
            <div className="text-[10px] uppercase tracking-[0.3em] text-white/40">
              Winning wallet bets
            </div>
            {winningWalletTradePreview.length === 0 ? (
              <div className="mt-2 text-[11px] text-white/50">
                No winning wallets yet.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {winningWalletTradePreview.map((trade) => (
                  <div key={trade.id} className="text-[11px] text-white/70">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-emerald-200">
                        {formatWalletAlias(trade.proxyWallet)}
                      </span>
                      <span className="text-white/50">
                        {trade.outcome} - {formatCurrency(trade.notional)}
                      </span>
                    </div>
                    <div className="mt-1 text-white/40">{trade.marketTitle}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        {walletStats.length === 0 ? (
          <div className="mt-2 text-[11px] text-white/50">
            No Polymarket wallets tracked yet.
          </div>
        ) : showTrackedWallets ? (
          <div className="mt-2 space-y-2">
            {walletStats.map((wallet) => (
              <button
                type="button"
                key={wallet.wallet}
                onClick={() => setWalletFilter(wallet.wallet)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-[11px] text-white/70 transition',
                  walletFilter !== 'all' && normalizeWallet(wallet.wallet) === normalizeWallet(walletFilter)
                    ? 'border-emerald-400/50 bg-emerald-500/10'
                    : 'border-white/10 bg-black/30 hover:border-white/30'
                )}
              >
                <span className="font-semibold text-white/80">
                  {formatWalletAlias(wallet.wallet)}
                </span>
                <span className="text-white/50">
                  {wallet.count} trades
                  {wallet.lastSeen ? ` - last ${formatTimestamp(wallet.lastSeen)}` : ''}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-2 text-[11px] text-white/50">
            Click to view tracked wallets.
          </div>
        )}
      </div>
      {sortedTrades.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          No sharp bets detected yet. Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will
          appear here.
        </div>
      )}
      {sortedTrades.map((trade) => {
        const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
        const sharpTier = resolveSharpTier(trade.notional)
        const walletKey = normalizeWallet(trade.proxyWallet)
        const isTrackedWallet =
          trade.source === 'polymarket' && walletKey && trackedWalletSet.has(walletKey)
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
                        <span className={cn('text-[10px] uppercase tracking-[0.3em] font-semibold', resolveStrengthClass(trade.sharpStrength))}>
                          {trade.sharpStrength}% strength
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
                {resolveOddsLabel(trade)}
              </span>
              {isTrackedWallet && (
                <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-emerald-200">
                  Tracked {formatWalletAlias(trade.proxyWallet)}
                </span>
              )}
              <span className="rounded-full border border-white/10 px-2 py-0.5">
                Detected {formatTimestamp(trade.timestamp)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
