"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'
import { getWalletAlias } from '@/lib/utils/wallet-alias'
import { SimpleHeader } from '@/components/ui/simple-header'
import MobileToolsNav from '@/components/mobile-tools-nav'
import { motion } from 'framer-motion'
import { Target, Zap, DollarSign } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import Link from 'next/link'

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
  is_live?: boolean
  game_status?: 'pregame' | 'live' | 'final'
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

type WalletSummary = {
  wallet: string
  total_realized_pnl: number
  total_wins: number
  total_losses: number
  total_pushes: number
  last_computed_at: string
}

type SharpTier = 'small' | 'blue' | 'mega' | 'nuke'

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
const WALLET_STORAGE_KEY = 'sharp-detector-wallets'
const MAX_RESOLVED_TRADES = 300
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

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
  if (notional > 100000) return 'nuke'
  if (notional > 50000) return 'mega'
  if (notional > 25000) return 'blue'
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

const getEventEasternDateKey = (value?: string | null) => {
  if (!value) return null
  const match = value.match(DATE_ONLY_PATTERN)
  if (match) return `${match[1]}-${match[2]}-${match[3]}`
  return getEasternDateKey(value)
}

const sharpTierLabel: Record<SharpTier, string> = {
  small: 'Swordfish',
  blue: 'Megalodon',
  mega: 'Blue whale',
  nuke: 'Nuke',
}

const sharpTierClass: Record<SharpTier, string> = {
  small: 'border-emerald-500/30 text-emerald-200',
  blue: 'border-sky-400/40 text-sky-200',
  mega: 'border-blue-400/40 text-blue-200',
  nuke: 'border-rose-400/40 text-rose-200',
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

export default function SharpDetectorPage() {
  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [user, setUser] = useState<any>(null)
  const supabase = useMemo(() => createClient(), [])
  const [trades, setTrades] = useState<SharpTradeWithStatus[]>([])
  const [hydrated, setHydrated] = useState(typeof window !== 'undefined')
  const [debugEnabled, setDebugEnabled] = useState(false)
  const [lastFetchAt, setLastFetchAt] = useState<string | null>(null)
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null)
  const [lastFetchError, setLastFetchError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'all' | 'games'>('all')
  const [sportFilter, setSportFilter] = useState<string>('all')
  const [gameFilter, setGameFilter] = useState<string>('all')
  const [sortFilter, setSortFilter] = useState<'newest' | 'strength'>('newest')
  const [searchQuery, setSearchQuery] = useState('')
  const [sizeFilter, setSizeFilter] = useState<'all' | 'small' | 'blue' | 'mega' | 'nuke'>('all')
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
  const [walletSummary, setWalletSummary] = useState<WalletSummary[]>([])
  const [walletSummaryError, setWalletSummaryError] = useState<string | null>(null)
  const [trackedWalletSummary, setTrackedWalletSummary] = useState<WalletSummary[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)
  const hasAccess = Boolean(user)

  // Get unique sports for filter
  const sportButtons = useMemo(
    () => ['all', 'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'SOCCER', 'GOLF', 'UFC'],
    []
  )

  const baseTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const walletKey = walletFilter === 'all' ? null : normalizeWallet(walletFilter)
    return trades.filter(trade => {
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
    const todayEasternKey = getEasternDateKey(new Date())

    filteredTrades.forEach(trade => {
      if (!todayEasternKey) return
      const eventKey = getEventEasternDateKey(trade.eventDate)
      if (eventKey !== todayEasternKey) return
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
    return [...filteredTrades].sort((a, b) => {
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

  const trackedWalletSet = useMemo(
    () => new Set(trackedWallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[]),
    [trackedWallets]
  )

  const trackedWalletSummaryMap = useMemo(() => {
    return new Map(
      trackedWalletSummary.map((summary) => [
        normalizeWallet(summary.wallet) ?? summary.wallet,
        summary,
      ])
    )
  }, [trackedWalletSummary])

  const trackedWalletTradePreview = useMemo(() => {
    return trades
      .filter((trade) => {
        if (trade.source !== 'polymarket') return false
        const wallet = normalizeWallet(trade.proxyWallet)
        return wallet ? trackedWalletSet.has(wallet) : false
      })
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 3)
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
    const stats = new Map<
      string,
      { wallet: string; count: number; wins: number; losses: number; pushes: number; lastSeen?: string }
    >()
    trades.forEach((trade) => {
      if (trade.source !== 'polymarket') return
      const walletKey = normalizeWallet(trade.proxyWallet)
      if (!walletKey) return
      const entry = stats.get(walletKey) ?? {
        wallet: walletKey,
        count: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
      }
      entry.count += 1
      if (!entry.lastSeen || trade.timestamp > entry.lastSeen) {
        entry.lastSeen = trade.timestamp
      }
      if (trade.result === 'win') entry.wins += 1
      if (trade.result === 'loss') entry.losses += 1
      if (trade.result === 'push') entry.pushes += 1
      stats.set(walletKey, entry)
    })

    const rows = trackedWallets.map((wallet) => {
      const walletKey = normalizeWallet(wallet) ?? wallet
      const entry = stats.get(walletKey)
      return {
        wallet: walletKey,
        count: entry?.count ?? 0,
        lastSeen: entry?.lastSeen ?? null,
        wins: entry?.wins ?? 0,
        losses: entry?.losses ?? 0,
        pushes: entry?.pushes ?? 0,
      }
    })

    return rows.sort((a, b) => {
      const timeA = a.lastSeen ? new Date(a.lastSeen).getTime() : 0
      const timeB = b.lastSeen ? new Date(b.lastSeen).getTime() : 0
      if (timeA !== timeB) return timeB - timeA
      return b.count - a.count
    })
  }, [trades, trackedWallets])

  // Stats
  const stats = useMemo(() => {
    const totalNotional = trades.reduce((sum, t) => sum + t.notional, 0)
    const todayKey = getEasternDateKey(new Date())
    const todayTrades = trades.filter(
      (trade) => getEasternDateKey(trade.timestamp) === todayKey
    ).length
    const liveTrades = trades.filter((trade) => trade.is_live).length
    return { totalNotional, todayTrades, liveTrades }
  }, [trades])

  // Merge incoming trades with existing trades
  const mergeTrades = (prev: SharpTradeWithStatus[], incoming: SharpTrade[]) => {
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
  }

  // Fetch today's trades from the daily database (persistent storage)
  const fetchDailyTrades = async () => {
    try {
      const res = await fetch(
        `/api/whale-trades-daily?minNotional=${MIN_NOTIONAL}&limit=500`,
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
      setTrades((prev) => mergeTrades(prev, incoming))
    } catch (error) {
      console.warn('Daily trades fetch failed:', error)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    setHydrated(true)
  }, [])

  useEffect(() => {
    let isMounted = true
    const loadUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!isMounted) return
        if (!user) {
          setUser(null)
          setMembership(null)
          setAuthLoading(false)
          return
        }
        setUser(user)
        const membershipInfo = getMembershipStatus(user.user_metadata)
        setMembership(membershipInfo)
        setAuthLoading(false)
      } catch (err) {
        if (!isMounted) return
        console.error('[sharp-detector] auth check failed', err)
        setMembership(null)
        setAuthLoading(false)
      }
    }
    loadUser()
    return () => {
      isMounted = false
    }
  }, [supabase])

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
    if (!hydrated || !hasAccess) return
    const wallets = Array.from(
      new Set(
        trackedWallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[]
      )
    )
    if (!wallets.length) {
      setTrackedWalletSummary([])
      return
    }
    const controller = new AbortController()
    const fetchTrackedSummary = async () => {
      try {
        const params = new URLSearchParams()
        const limitedWallets = wallets.slice(0, 200)
        params.set('wallets', limitedWallets.join(','))
        params.set('limit', String(limitedWallets.length))
        const res = await fetch(`/api/polymarket/wallets/summary?${params.toString()}`, {
          cache: 'no-store',
          signal: controller.signal,
        })
        if (!res.ok) {
          throw new Error(`Tracked summary fetch failed (${res.status})`)
        }
        const data = await res.json()
        setTrackedWalletSummary(Array.isArray(data?.wallets) ? data.wallets : [])
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn(
          'Failed to load tracked wallet summary:',
          error instanceof Error ? error.message : error
        )
      }
    }
    fetchTrackedSummary()
    return () => controller.abort()
  }, [hydrated, trackedWallets])

  useEffect(() => {
    if (!hasAccess) return
    // Only use daily storage so every user sees the same feed.
    fetchDailyTrades()
    const interval = setInterval(fetchDailyTrades, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasAccess])

  useEffect(() => {
    if (!hasAccess) return
    const fetchSummary = async () => {
      try {
        const res = await fetch('/api/polymarket/wallets/summary?limit=5', {
          cache: 'no-store',
        })
        if (!res.ok) {
          throw new Error(`Summary fetch failed (${res.status})`)
        }
        const data = await res.json()
        setWalletSummary(Array.isArray(data?.wallets) ? data.wallets : [])
        setWalletSummaryError(null)
      } catch (error) {
        setWalletSummaryError(
          error instanceof Error ? error.message : 'Failed to load wallet summary.'
        )
      }
    }
    fetchSummary()
  }, [hasAccess])

  // No local caching: always render the latest fetch results.

  useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return
    try {
      window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(trackedWallets))
    } catch (error) {
      console.warn('Failed to persist tracked wallets:', error)
    }
  }, [hydrated, trackedWallets])

  const now = Date.now()

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="max-w-6xl mx-auto px-4 py-8 pt-20 pb-[108px] sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/60">
            Checking access...
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="max-w-6xl mx-auto px-4 py-8 pt-20 pb-[108px] sm:pb-8">
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            <div className="pointer-events-none blur-sm">
              <div className="space-y-4 p-6">
                <div className="h-6 w-56 rounded bg-white/10" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
                  <div className="h-20 rounded-2xl border border-white/10 bg-white/5" />
                </div>
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((row) => (
                    <div key={row} className="h-14 rounded-2xl border border-white/10 bg-white/5" />
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center p-6">
              <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
                <p className="text-sm uppercase tracking-[0.3em] text-white/50">
                  Upgrade required
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Whale Feed is for Syndicate members.
                </h2>
                <p className="mt-2 text-base text-white/60">
                  Upgrade to Syndicate to unlock sharp trade alerts and tracking.
                </p>
                <Link
                  href="/pricing"
                  className="mt-5 inline-flex items-center rounded-full border border-emerald-400/60 px-6 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                >
                  Start your free trial
                </Link>
              </div>
            </div>
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />

      <div className="max-w-6xl mx-auto px-4 py-8 pt-20 pb-[108px] sm:pb-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <DollarSign className="w-4 h-4" />
              Total Volume
            </div>
            <p className="text-xl font-bold text-white">{formatCurrency(stats.totalNotional)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <Target className="w-4 h-4" />
              Sharps detected
            </div>
            <p className="text-xl font-bold text-white">{stats.todayTrades}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-white/50 text-sm mb-1">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
              Live bets
            </div>
            <p className="text-xl font-bold text-rose-400">{stats.liveTrades}</p>
          </div>
        </div>

        {debugEnabled && (
          <div className="mb-6 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
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
                  'px-4 py-2 rounded-full border text-sm uppercase tracking-[0.2em] transition',
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
              className="w-full px-3 py-2 rounded-xl border border-white/10 bg-black text-base text-white/80 placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50"
            />
          </div>
          {/* View Mode Toggle */}
          <div className="flex rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-2.5 text-base font-medium transition",
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
                "px-4 py-2.5 text-base font-medium transition flex items-center gap-2",
                viewMode === 'games'
                  ? "bg-emerald-500/20 text-emerald-300"
                  : "text-white/60 hover:bg-white/5"
              )}
            >
              <Zap className="w-4 h-4" />
              Hot Games
              {gameClusters.length > 0 && (
                <span className="px-2 py-1 rounded-full bg-emerald-500/30 text-xs font-bold">
                  {gameClusters.length}
                </span>
              )}
            </button>
          </div>

          {/* Matchup Filter */}
          <select
            value={gameFilter}
            onChange={(e) => setGameFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-base text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Games</option>
            {gameOptions.map((option) => (
              <option key={option.key} value={option.key}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Sort Filter */}
          <select
            value={sortFilter}
            onChange={(e) =>
              setSortFilter(e.target.value as 'newest' | 'strength')
            }
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-base text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="newest">Newest</option>
            <option value="strength">Highest %</option>
          </select>

          {/* Bet Size Filter */}
          <select
            value={sizeFilter}
            onChange={(e) =>
              setSizeFilter(e.target.value as 'all' | 'small' | 'blue' | 'mega' | 'nuke')
            }
            className="px-3 py-2 rounded-xl border border-white/10 bg-black text-base text-white/80 focus:outline-none focus:border-emerald-500/50"
          >
            <option value="all">All Sizes</option>
            <option value="small">Swordfish</option>
            <option value="blue">Megalodon</option>
            <option value="mega">Blue whale</option>
            <option value="nuke">Nuke</option>
          </select>

          {walletFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setWalletFilter('all')}
              className="px-3 py-2 rounded-xl border border-emerald-400/40 text-sm uppercase tracking-[0.2em] text-emerald-200"
            >
              Wallet {formatWalletAlias(walletFilter)} x
            </button>
          )}

          <span className="text-sm text-white/40">
            {filteredTrades.length} trades
          </span>
        </div>
        {/* Game Clusters View */}
        {viewMode === 'games' && (
          <div className="space-y-4 mb-8">
            {gameClusters.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
                <Zap className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-base">
                  No games with multiple sharp bets yet.
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Games appear here when 2+ big bets are placed on the same event.
                </p>
              </div>
            ) : (
              gameClusters.map((cluster) => {
                return (
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
                          <span className="text-sm uppercase tracking-wider text-emerald-300/70">
                            Hot Game - {cluster.tradeCount} sharp bets
                          </span>
                        </div>
                        <h3 className="text-xl font-semibold text-white">{cluster.marketTitle}</h3>
                        <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                          <span className="px-3 py-1 rounded-full border border-white/10">
                            {cluster.sport}
                          </span>
                          {cluster.eventDate && (
                            <span className="px-3 py-1 rounded-full border border-white/10">
                              {cluster.eventDate}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-emerald-300">
                          {formatCurrency(cluster.totalNotional)}
                        </p>
                        <p className="text-sm text-white/50">total volume</p>
                      </div>
                    </div>

                  {/* Trades in this cluster */}
                  <div className="space-y-2 border-t border-white/10 pt-4">
                    {cluster.trades.map((trade) => {
                      const tier = resolveSharpTier(trade.notional)
                      const walletKey = normalizeWallet(trade.proxyWallet)
                      const isTrackedWallet =
                        trade.source === 'polymarket' && walletKey && trackedWalletSet.has(walletKey)
                      return (
                        <div
                          key={trade.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-white/5"
                        >
                          <div className="flex items-center gap-3">
                            {trade.is_live && (
                              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-400 text-xs font-semibold uppercase">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                LIVE
                              </span>
                            )}
                            <span className={cn(
                              "px-3 py-1 rounded-full border text-xs font-semibold uppercase",
                              sharpTierClass[tier]
                            )}>
                              {formatCurrency(trade.notional)}
                            </span>
                            <span className="text-base text-white/80">{trade.outcome}</span>
                            <span className="text-sm text-white/40">
                              {resolveOddsLabel(trade)}
                            </span>
                            {isTrackedWallet && (
                              <span className="px-3 py-1 rounded-full border border-emerald-400/40 text-xs text-emerald-200">
                                Tracked {formatWalletAlias(trade.proxyWallet)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-white/40">
                              {formatTimestamp(trade.timestamp)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  </motion.div>
                )
              })
            )}
          </div>
        )}

        {/* All Trades View */}
        {viewMode === 'all' && (
          <div className="space-y-3">
            {sortedTrades.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/40 p-6 text-center">
                <Target className="w-8 h-8 text-white/30 mx-auto mb-3" />
                <p className="text-white/60 text-base">
                  No sharp bets detected yet.
                </p>
                <p className="text-white/40 text-sm mt-1">
                  Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will appear here.
                </p>
              </div>
            )}
            {sortedTrades.map((trade) => {
              const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
              const sharpTier = resolveSharpTier(trade.notional)
              const walletKey = normalizeWallet(trade.proxyWallet)
              const isTrackedWallet =
                trade.source === 'polymarket' && walletKey && trackedWalletSet.has(walletKey)
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
                    <div className="flex items-center gap-2">
                      <span className="text-xs uppercase tracking-[0.3em] text-white/40">
                        {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                      </span>
                      {trade.is_live && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/20 border border-rose-500/50 text-rose-400 text-xs font-semibold uppercase tracking-wide">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                    </div>
                  </div>
                  <p className="mt-2 text-base font-semibold text-white">
                    Someone put {formatCurrency(trade.notional)} on {trade.outcome} in{' '}
                    {trade.marketTitle}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-white/60">
                    <span
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]',
                        sharpTierClass[sharpTier]
                      )}
                    >
                      {sharpTierLabel[sharpTier]}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {trade.outcome}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {resolvePhase(trade)}
                    </span>
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {trade.sport}
                    </span>
                    {trade.eventDate && (
                      <span className="rounded-full border border-white/10 px-3 py-1">
                        {trade.eventDate}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      {resolveOddsLabel(trade)}
                    </span>
                    {isTrackedWallet && (
                      <span className="rounded-full border border-emerald-400/40 px-3 py-1 text-emerald-200">
                        Tracked {formatWalletAlias(trade.proxyWallet)}
                      </span>
                    )}
                    <span className="rounded-full border border-white/10 px-3 py-1">
                      Detected {formatTimestamp(trade.timestamp)}
                    </span>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>
      <MobileToolsNav />
    </div>
  )
}

