"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'

type SharpTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  marketTitle: string
  outcome: string
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
const STORAGE_KEY = 'sharp-detector-trades'
const CACHE_VERSION_KEY = 'sharp-detector-cache-version'
const CACHE_VERSION = '3'
const MAX_RESOLVED_TRADES = 300
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MS_PER_DAY = 24 * 60 * 60 * 1000
const MAJOR_SPORTS = new Set(['NBA', 'NFL', 'MLB', 'NHL'])
const TEAM_SPLIT_PATTERN = /\s+(?:vs\.?|v\.?|@|at)\s+/i
const P4_COLLEGE_TEAMS = [
  'Arizona', 'Arizona State', 'Baylor', 'BYU', 'Cincinnati', 'Colorado', 'Houston',
  'Iowa State', 'Kansas', 'Kansas State', 'Oklahoma State', 'TCU', 'Texas Tech',
  'UCF', 'Utah', 'West Virginia',
  'Alabama', 'Arkansas', 'Auburn', 'Florida', 'Georgia', 'Kentucky', 'LSU',
  'Mississippi State', 'Missouri', 'Ole Miss', 'South Carolina', 'Tennessee',
  'Texas', 'Texas A&M', 'Vanderbilt', 'Oklahoma',
  'Boston College', 'Clemson', 'Duke', 'Florida State', 'Georgia Tech', 'Louisville',
  'Miami', 'NC State', 'North Carolina', 'Pittsburgh', 'Syracuse', 'Virginia',
  'Virginia Tech', 'Wake Forest', 'Notre Dame', 'SMU', 'Stanford', 'Cal',
  'Illinois', 'Indiana', 'Iowa', 'Maryland', 'Michigan', 'Michigan State', 'Minnesota',
  'Nebraska', 'Northwestern', 'Ohio State', 'Penn State', 'Purdue', 'Rutgers',
  'Wisconsin', 'USC', 'UCLA', 'Oregon', 'Washington',
]
const P4_TEAM_SET = new Set(
  P4_COLLEGE_TEAMS.map((team) =>
    team
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
  )
)

const DEFAULT_SMALL_MARKET_THRESHOLD = {
  earlyDays: 3,
  earlyTrades: 2,
  earlyNotional: 5000,
  dayTrades: 3,
  dayNotional: 8000,
}

const SPORT_UNUSUAL_THRESHOLDS: Record<string, typeof DEFAULT_SMALL_MARKET_THRESHOLD> = {
  NBA: { earlyDays: 3, earlyTrades: 3, earlyNotional: 12000, dayTrades: 4, dayNotional: 18000 },
  NFL: { earlyDays: 7, earlyTrades: 3, earlyNotional: 12000, dayTrades: 4, dayNotional: 18000 },
  MLB: { earlyDays: 3, earlyTrades: 3, earlyNotional: 12000, dayTrades: 4, dayNotional: 18000 },
  NHL: { earlyDays: 3, earlyTrades: 3, earlyNotional: 12000, dayTrades: 4, dayNotional: 18000 },
  WNBA: { earlyDays: 3, earlyTrades: 2, earlyNotional: 5000, dayTrades: 3, dayNotional: 8000 },
  UFC: { earlyDays: 3, earlyTrades: 2, earlyNotional: 5000, dayTrades: 3, dayNotional: 8000 },
  SOCCER: { earlyDays: 5, earlyTrades: 2, earlyNotional: 5000, dayTrades: 3, dayNotional: 8000 },
  GOLF: { earlyDays: 5, earlyTrades: 2, earlyNotional: 5000, dayTrades: 3, dayNotional: 8000 },
}

const COLLEGE_UNUSUAL_THRESHOLDS = {
  NCAAB: {
    regular: { earlyDays: 1, earlyTrades: 2, earlyNotional: 4000, dayTrades: 3, dayNotional: 6000 },
    marquee: { earlyDays: 1, earlyTrades: 3, earlyNotional: 10000, dayTrades: 4, dayNotional: 15000 },
  },
  NCAAF: {
    regular: { earlyDays: 5, earlyTrades: 2, earlyNotional: 6000, dayTrades: 3, dayNotional: 10000 },
    marquee: { earlyDays: 5, earlyTrades: 3, earlyNotional: 15000, dayTrades: 4, dayNotional: 20000 },
  },
}

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

const normalizeTeamLabel = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\b(spread|moneyline|total|over|under|points|winner|to win)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

const parseMatchupTeams = (marketTitle: string) => {
  const parts = marketTitle.split(TEAM_SPLIT_PATTERN)
  if (parts.length !== 2) return null
  const homeAway = parts.map((part) => normalizeTeamLabel(part))
  if (homeAway.some((part) => !part)) return null
  return homeAway
}

const isMarqueeCollegeMatchup = (marketTitle: string) => {
  const teams = parseMatchupTeams(marketTitle)
  if (!teams) return false
  return teams.every((team) => P4_TEAM_SET.has(team))
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

const resolveStrengthClass = (value?: number | null) => {
  const strength = Number.isFinite(value) ? Number(value) : 0
  if (strength <= 35) return 'text-rose-300'
  if (strength <= 55) return 'text-amber-300'
  return 'text-emerald-300'
}

const resolveUnusualReason = (cluster: {
  marketTitle: string
  sport: string
  eventDate?: string
  tradeCount: number
  totalNotional: number
}, nowMs: number) => {
  if (!cluster.eventDate) return null
  const eventTime = parseEventTime(cluster.eventDate)
  if (eventTime == null || !Number.isFinite(eventTime)) return null
  if (eventTime < nowMs) return null

  const daysUntil = Math.floor((eventTime - nowMs) / MS_PER_DAY)
  const isCollegeSport = cluster.sport === 'NCAAB' || cluster.sport === 'NCAAF'
  const isMarquee = isCollegeSport && isMarqueeCollegeMatchup(cluster.marketTitle)

  const thresholds = isCollegeSport
    ? COLLEGE_UNUSUAL_THRESHOLDS[cluster.sport as 'NCAAB' | 'NCAAF'][
        isMarquee ? 'marquee' : 'regular'
      ]
    : SPORT_UNUSUAL_THRESHOLDS[cluster.sport] ?? DEFAULT_SMALL_MARKET_THRESHOLD

  const isEarly = daysUntil >= thresholds.earlyDays
  const isDayOf = daysUntil >= 0 && daysUntil < 1

  const meetsEarly =
    isEarly &&
    cluster.tradeCount >= thresholds.earlyTrades &&
    cluster.totalNotional >= thresholds.earlyNotional
  const meetsDayOf =
    isDayOf &&
    cluster.tradeCount >= thresholds.dayTrades &&
    cluster.totalNotional >= thresholds.dayNotional

  if (meetsEarly) {
    if (isCollegeSport && !isMarquee) {
      return `College non-marquee early action (${daysUntil}d out)`
    }
    if (!MAJOR_SPORTS.has(cluster.sport)) {
      return `Small-market early action (${daysUntil}d out)`
    }
    return `Early big bet (${daysUntil}d out)`
  }

  if (meetsDayOf) {
    if (isCollegeSport && !isMarquee) {
      return 'College small-market day-of surge'
    }
    if (!MAJOR_SPORTS.has(cluster.sport)) {
      return 'Small-market day-of surge'
    }
    return 'Day-of surge'
  }

  return null
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
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)

  const baseTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return trades.filter((trade) => {
      if (sportFilter !== 'all' && trade.sport !== sportFilter) return false
      if (sizeFilter !== 'all' && resolveSharpTier(trade.notional) !== sizeFilter) return false
      if (query) {
        const haystack = `${trade.marketTitle} ${trade.outcome} ${trade.sport}`.toLowerCase()
        if (!haystack.includes(query)) return false
      }
      return true
    })
  }, [trades, sportFilter, sizeFilter, searchQuery])

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

  const sportButtons = useMemo(
    () => ['all', 'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'SOCCER', 'GOLF', 'UFC'],
    []
  )

  const topUpcomingSharps = useMemo(() => {
    const now = Date.now()
    const scoredTrades = trades
      .filter((trade) => Number.isFinite(trade.sharpStrength))
      .map((trade) => ({
        trade,
        strength: trade.sharpStrength ?? 0,
        eventTime: parseEventTime(trade.eventDate),
        tradeTime: new Date(trade.timestamp).getTime(),
      }))
    const upcoming = scoredTrades.filter(
      (entry) => entry.eventTime != null && entry.eventTime >= now
    )
    const sortedUpcoming = [...upcoming].sort((a, b) => {
      if (a.strength !== b.strength) return b.strength - a.strength
      if (a.eventTime != null && b.eventTime != null && a.eventTime !== b.eventTime) {
        return a.eventTime - b.eventTime
      }
      return a.tradeTime - b.tradeTime
    })
    const primary = sortedUpcoming.slice(0, 3).map((entry) => entry.trade)
    if (primary.length >= 3) return primary
    const fallback = scoredTrades
      .filter((entry) => !primary.some((trade) => trade.id === entry.trade.id))
      .sort((a, b) => {
        if (a.strength !== b.strength) return b.strength - a.strength
        return b.tradeTime - a.tradeTime
      })
      .slice(0, 3 - primary.length)
      .map((entry) => entry.trade)
    return [...primary, ...fallback]
  }, [trades])

  const unusualClusters = useMemo(() => {
    const nowMs = Date.now()
    const clusters = new Map<string, GameCluster>()

    trades.forEach((trade) => {
      const gameKey = extractGameKey(trade.marketTitle, trade.sport)
      if (!clusters.has(gameKey)) {
        clusters.set(gameKey, {
          gameKey,
          marketTitle: resolveGameLabel(trade.marketTitle),
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

    return Array.from(clusters.values())
      .map((cluster) => {
        const reason = resolveUnusualReason(cluster, nowMs)
        if (!reason) return null
        return { cluster, reason }
      })
      .filter(
        (value): value is { cluster: GameCluster; reason: string } => Boolean(value)
      )
      .sort((a, b) => {
        if (a.cluster.tradeCount !== b.cluster.tradeCount) {
          return b.cluster.tradeCount - a.cluster.tradeCount
        }
        return b.cluster.totalNotional - a.cluster.totalNotional
      })
      .slice(0, 3)
  }, [trades])

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

  const now = Date.now()

  useEffect(() => {
    onCountChange?.(sortedTrades.length)
  }, [onCountChange, sortedTrades.length])

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
        <option value="small">Sharp bet</option>
        <option value="blue">Big sharp</option>
        <option value="mega">Whale</option>
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
        {filteredTrades.length} trades
      </span>
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
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white">
            Top 3 upcoming sharps
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            live
          </span>
        </div>
        {topUpcomingSharps.length === 0 ? (
          <div className="text-[11px] text-white/50">
            No upcoming sharp strength rankings yet.
          </div>
        ) : (
          <div className="space-y-2">
            {topUpcomingSharps.map((trade) => (
              <div
                key={trade.id}
                className="rounded-xl border border-white/10 bg-black/40 p-2"
              >
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span className="uppercase tracking-[0.2em]">{trade.sport}</span>
                  <span className={cn('font-semibold', resolveStrengthClass(trade.sharpStrength))}>
                    {trade.sharpStrength ?? 0}%
                  </span>
                </div>
                <div className="text-[11px] text-white mt-1">
                  {trade.outcome}
                </div>
                <div className="text-[10px] text-white/50">
                  {trade.marketTitle}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-white">
            Unusual big bets
          </span>
          <span className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            signal
          </span>
        </div>
        {unusualClusters.length === 0 ? (
          <div className="text-[11px] text-white/50">
            No unusual betting clusters yet.
          </div>
        ) : (
          <div className="space-y-2">
            {unusualClusters.map(({ cluster, reason }) => (
              <div
                key={cluster.gameKey}
                className="rounded-xl border border-white/10 bg-black/40 p-2"
              >
                <div className="flex items-center justify-between text-[10px] text-white/50">
                  <span className="uppercase tracking-[0.2em]">{cluster.sport}</span>
                  <span className="text-rose-200 font-semibold">
                    {cluster.tradeCount} bets
                  </span>
                </div>
                <div className="text-[11px] text-white mt-1">
                  {cluster.marketTitle}
                </div>
                <div className="text-[10px] text-white/50">
                  {formatCurrency(cluster.totalNotional)}
                </div>
                <div className="text-[10px] text-white/40 mt-1">{reason}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {filters}
      {sortedTrades.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          No sharp bets detected yet. Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will
          appear here.
        </div>
      )}
      {sortedTrades.map((trade) => {
        const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
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
