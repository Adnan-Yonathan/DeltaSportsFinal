"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { getWalletAlias } from '@/lib/utils/wallet-alias'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingDown, Info, Zap, X, Lock, Clock, ChartBar } from 'lucide-react'
import Link from 'next/link'
import ShareTradeButton from './ShareTradeButton'
import TutorialPopup from './TutorialPopup'

type UltraSharpReason = {
  type: 'rlm' | 'timing' | 'divergence' | 'cluster' | 'cross-market-ev' | 'big-bet' | 'liquidity'
  description: string
  value?: number
}

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
  sportsbookBestOdds?: number | null
  sportsbookBookTitle?: string | null
  sportsbookBookKey?: string | null
  crossMarketEvPercent?: number | null
  // Ultra-sharp fields
  isUltraSharp?: boolean
  ultraSharpReasons?: UltraSharpReason[]
  timingScore?: number
  rlmScore?: number
  divergencePercent?: number | null
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
type GamePhase = 'all' | 'live' | 'pregame'
type ActiveTab = 'bet-feed' | 'sharp-money'

type SharpAlert = {
  id: string
  trade: SharpTradeWithStatus
  timestamp: string
  dismissed: boolean
}

const MIN_NOTIONAL = 2000
const POLL_INTERVAL_BET_FEED = 30000
const POLL_INTERVAL_SHARP_FEED = 15000
const STORAGE_KEY = 'sharp-detector-trades'
const CACHE_VERSION_KEY = 'sharp-detector-cache-version'
const CACHE_VERSION = '5'
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

const isTradeLive = (trade: SharpTrade) => {
  if (!trade.eventDate) return false
  const eventTime = parseEventTime(trade.eventDate)
  if (!eventTime) return false
  const now = Date.now()
  const fourHoursMs = 4 * 60 * 60 * 1000
  return eventTime <= now && eventTime > now - fourHoursMs
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

const formatDateOptionLabel = (
  dateKey: string,
  todayKey: string | null,
  tomorrowKey: string | null
) => {
  if (todayKey && dateKey === todayKey) return `Today (${dateKey})`
  if (tomorrowKey && dateKey === tomorrowKey) return `Tomorrow (${dateKey})`
  return dateKey
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

const MARKET_SUFFIX_PATTERN =
  /\b(half|quarter|period|inning|set|map|moneyline|ml|spread|total|over|under|winner|to win|points|yards|touchdowns|runs|goals|shots|team|props?)\b/i

const cleanTeamLabel = (value: string) => {
  const trimmed = value.split(':')[0]?.trim() ?? ''
  if (!trimmed) return ''
  const withoutParens = trimmed.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  const normalizedDashes = withoutParens.replace(/[\u2013\u2014]/g, '-')
  const parts = normalizedDashes.split(/\s*-\s*/g)
  if (parts.length > 1) {
    const tail = parts.slice(1).join(' ').toLowerCase()
    if (MARKET_SUFFIX_PATTERN.test(tail)) {
      return parts[0].trim()
    }
  }
  return normalizedDashes
}

const parseTeamsFromTitle = (marketTitle: string) => {
  const match = marketTitle.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i)
  if (match.length !== 2) return null
  const away = cleanTeamLabel(match[0] ?? '')
  const home = cleanTeamLabel(match[1] ?? '')
  if (!away || !home) return null
  return { away, home }
}

const extractSingleTeamKey = (value: string) => {
  const cleaned = value
    .replace(MARKET_SUFFIX_PATTERN, '')
    .replace(/\s+/g, ' ')
    .trim()
  return normalizeTeamKey(cleaned)
}

const buildTeamGameKey = (sport: string, away: string, home: string) => {
  const awayKey = normalizeTeamKey(away)
  const homeKey = normalizeTeamKey(home)
  if (!awayKey || !homeKey) return null
  const ordered = [awayKey, homeKey].sort()
  return `${sport}:${ordered[0]}@${ordered[1]}`
}

const buildMatchupKey = (sport: string, dateKey: string | null, teamKeys: [string, string]) => {
  const ordered = [...teamKeys].sort()
  return `${sport}:${dateKey ?? 'unknown'}:${ordered[0]}@${ordered[1]}`
}

const isTeamKeyMatch = (candidate: string | null | undefined, teamKey: string) => {
  if (!candidate) return false
  return candidate === teamKey || candidate.includes(teamKey) || teamKey.includes(candidate)
}

const extractGameKey = (marketTitle: string, sport: string): string => {
  const teams = parseTeamsFromTitle(marketTitle)
  if (teams) {
    const key = buildTeamGameKey(sport, teams.away, teams.home)
    if (key) return key
  }
  const normalized = marketTitle.toLowerCase().trim()
  const cleaned = normalized
    .replace(/\s*(spread|moneyline|total|over|under|points|yards|touchdowns?|winner|to win).*$/i, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
  return `${sport}:${cleaned}`
}

const resolveGameLabel = (marketTitle: string) => {
  const teams = parseTeamsFromTitle(marketTitle)
  if (teams) return `${teams.away} vs ${teams.home}`
  return marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()
}


const resolveTradeDateKey = (trade: SharpTrade) => {
  if (trade.eventDate) {
    const match = trade.eventDate.match(DATE_ONLY_PATTERN)
    if (match) return trade.eventDate
    const resolved = getEasternDateKey(trade.eventDate)
    if (resolved) return resolved
  }
  return getEasternDateKey(trade.timestamp)
}

const resolveStrengthClass = (value?: number | null) => {
  const strength = Number.isFinite(value) ? Number(value) : 0
  if (strength <= 35) return 'text-rose-300'
  if (strength <= 55) return 'text-amber-300'
  return 'text-emerald-300'
}

// Phase filter helper
const filterByPhase = (trades: SharpTradeWithStatus[], phase: GamePhase): SharpTradeWithStatus[] => {
  if (phase === 'all') return trades

  return trades.filter(trade => {
    const eventDate = trade.eventDate
    if (!eventDate) return phase === 'pregame' // Unknown = treat as pregame

    const eventTime = parseEventTime(eventDate)
    if (!eventTime) return phase === 'pregame'

    const now = Date.now()
    const fourHoursMs = 4 * 60 * 60 * 1000
    const isLive = eventTime <= now && eventTime > now - fourHoursMs

    return phase === 'live' ? isLive : !isLive
  })
}

// "Why it's sharp" reasons display component
const WhyItsSharpSection = ({ reasons }: { reasons: UltraSharpReason[] }) => {
  if (!reasons || reasons.length === 0) return null

  return (
    <div className="mt-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
      <p className="text-xs uppercase tracking-wider text-emerald-400 mb-2">Why this is sharp</p>
      <div className="space-y-1.5">
        {reasons.map((reason, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
            <span className="text-white/70">{reason.description}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// RLM Indicator Badge
const RlmBadge = () => (
  <div className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/10 border border-amber-500/30 rounded-lg">
    <TrendingDown className="w-3.5 h-3.5 text-amber-400" />
    <span className="text-xs font-medium text-amber-300">RLM</span>
    <div className="group relative">
      <Info className="w-3 h-3 text-amber-400/60 cursor-help" />
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-black border border-white/20 rounded-lg text-xs text-white/80 w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        Reverse Line Movement: Price moved toward this side despite more money on the other side. Indicates sharp action.
      </div>
    </div>
  </div>
)

// Alert Banner Component
const SharpAlertBanner = ({
  alert,
  onDismiss
}: {
  alert: SharpAlert
  onDismiss: () => void
}) => (
  <motion.div
    initial={{ opacity: 0, y: -20 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -20 }}
    className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between"
  >
    <div className="flex items-center gap-3">
      <div className="p-2 bg-emerald-500/20 rounded-lg">
        <Zap className="w-4 h-4 text-emerald-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-emerald-300">
          SHARP ALERT: New {alert.trade.sport} play detected
        </p>
        <p className="text-xs text-white/60">
          {alert.trade.marketTitle} • {alert.trade.sharpStrength}% strength
        </p>
      </div>
    </div>
    <button onClick={onDismiss} className="p-1 hover:bg-white/10 rounded transition-colors">
      <X className="w-4 h-4 text-white/50" />
    </button>
  </motion.div>
)

export default function SharpDetectorPanel({
  className,
  onNewSharp,
  onCountChange,
  isSyndicate = false,
  showLocalAlerts = true,
}: {
  className?: string
  onNewSharp?: (count: number) => void
  onCountChange?: (count: number) => void
  isSyndicate?: boolean
  showLocalAlerts?: boolean
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>('bet-feed')
  const [phaseFilter, setPhaseFilter] = useState<GamePhase>('all')
  const [alerts, setAlerts] = useState<SharpAlert[]>([])
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const ultraSharpSeenIds = useRef<Set<string>>(new Set())

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
  const [dateFilter, setDateFilter] = useState<string>('all')
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
  const [trackedWalletSummary, setTrackedWalletSummary] = useState<WalletSummary[]>([])
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)

  const preDateTrades = useMemo(() => {
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

  const dateOptions = useMemo(() => {
    const dates = new Set<string>()
    preDateTrades.forEach((trade) => {
      const dateKey = resolveTradeDateKey(trade)
      if (dateKey) dates.add(dateKey)
    })
    const todayKey = getEasternDateKey(new Date())
    const tomorrowKey = todayKey
      ? getEasternDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000))
      : null
    return Array.from(dates.values())
      .sort((a, b) => b.localeCompare(a))
      .map((key) => ({
        key,
        label: formatDateOptionLabel(key, todayKey, tomorrowKey),
      }))
  }, [preDateTrades])

  const baseTrades = useMemo(() => {
    if (dateFilter === 'all') return preDateTrades
    return preDateTrades.filter((trade) => resolveTradeDateKey(trade) === dateFilter)
  }, [preDateTrades, dateFilter])

  const matchupIndex = useMemo(() => {
    const map = new Map<
      string,
      {
        label: string
        sport: string
        dateKey: string | null
        teamKeys: [string, string]
      }
    >()
    baseTrades.forEach((trade) => {
      const parsed = parseTeamsFromTitle(trade.marketTitle)
      if (!parsed) return
      const awayKey = normalizeTeamKey(parsed.away)
      const homeKey = normalizeTeamKey(parsed.home)
      if (!awayKey || !homeKey) return
      const dateKey = resolveTradeDateKey(trade)
      const matchupKey = buildMatchupKey(trade.sport, dateKey, [awayKey, homeKey])
      if (!map.has(matchupKey)) {
        map.set(matchupKey, {
          label: `${parsed.away} vs ${parsed.home}`,
          sport: trade.sport,
          dateKey,
          teamKeys: [awayKey, homeKey],
        })
      }
    })
    return map
  }, [baseTrades])

  const tradeMatchupKeyMap = useMemo(() => {
    const map = new Map<string, string>()
    baseTrades.forEach((trade) => {
      const dateKey = resolveTradeDateKey(trade)
      const parsed = parseTeamsFromTitle(trade.marketTitle)
      if (parsed) {
        const awayKey = normalizeTeamKey(parsed.away)
        const homeKey = normalizeTeamKey(parsed.home)
        if (awayKey && homeKey) {
          const matchupKey = buildMatchupKey(trade.sport, dateKey, [awayKey, homeKey])
          map.set(trade.id, matchupKey)
          return
        }
      }
      const outcomeKey = normalizeTeamKey(trade.outcome)
      const marketTeamKey = extractSingleTeamKey(trade.marketTitle)
      const candidates: string[] = []
      matchupIndex.forEach((entry, key) => {
        if (entry.sport !== trade.sport) return
        if (dateKey && entry.dateKey && entry.dateKey !== dateKey) return
        const outcomeMatch =
          isTeamKeyMatch(outcomeKey, entry.teamKeys[0]) ||
          isTeamKeyMatch(outcomeKey, entry.teamKeys[1])
        const marketMatch =
          isTeamKeyMatch(marketTeamKey, entry.teamKeys[0]) ||
          isTeamKeyMatch(marketTeamKey, entry.teamKeys[1])
        if (outcomeMatch || marketMatch) {
          candidates.push(key)
        }
      })

      if (candidates.length > 1 && outcomeKey && marketTeamKey) {
        const refined = candidates.filter((key) => {
          const entry = matchupIndex.get(key)
          if (!entry) return false
          const outcomeMatch =
            isTeamKeyMatch(outcomeKey, entry.teamKeys[0]) ||
            isTeamKeyMatch(outcomeKey, entry.teamKeys[1])
          const marketMatch =
            isTeamKeyMatch(marketTeamKey, entry.teamKeys[0]) ||
            isTeamKeyMatch(marketTeamKey, entry.teamKeys[1])
          return outcomeMatch && marketMatch
        })
        if (refined.length === 1) {
          map.set(trade.id, refined[0])
          return
        }
      }

      if (candidates.length === 1) {
        map.set(trade.id, candidates[0])
        return
      }

      const fallbackSlug = normalizeTeamKey(trade.marketTitle) || trade.id
      const fallbackKey = `${trade.sport}:${dateKey ?? 'unknown'}:${fallbackSlug}`
      map.set(trade.id, fallbackKey)
    })
    return map
  }, [baseTrades, matchupIndex])

  const gameOptions = useMemo(() => {
    const map = new Map<string, string>()
    baseTrades.forEach((trade) => {
      const key =
        tradeMatchupKeyMap.get(trade.id) ?? extractGameKey(trade.marketTitle, trade.sport)
      if (!map.has(key)) {
        map.set(key, matchupIndex.get(key)?.label ?? resolveGameLabel(trade.marketTitle))
      }
    })
    return Array.from(map.entries())
      .map(([key, label]) => ({ key, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [baseTrades, matchupIndex, tradeMatchupKeyMap])

  useEffect(() => {
    if (dateFilter === 'all') return
    if (!dateOptions.some((option) => option.key === dateFilter)) {
      setDateFilter('all')
    }
  }, [dateFilter, dateOptions])

  useEffect(() => {
    if (gameFilter === 'all') return
    if (!gameOptions.some((option) => option.key === gameFilter)) {
      setGameFilter('all')
    }
  }, [gameFilter, gameOptions])

  const filteredTrades = useMemo(() => {
    return baseTrades.filter((trade) => {
      if (gameFilter === 'all') return true
      const matchupKey =
        tradeMatchupKeyMap.get(trade.id) ?? extractGameKey(trade.marketTitle, trade.sport)
      return matchupKey === gameFilter
    })
  }, [baseTrades, gameFilter, tradeMatchupKeyMap])

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

  const trackedWalletSummaryMap = useMemo(() => {
    return new Map(
      trackedWalletSummary.map((summary) => [
        normalizeWallet(summary.wallet) ?? summary.wallet,
        summary,
      ])
    )
  }, [trackedWalletSummary])

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

  // Ultra-sharp trades for the Sharp Money Feed tab
  const ultraSharpTrades = useMemo(() => {
    // Apply phase filter first
    const phaseFiltered = filterByPhase(trades, phaseFilter)
    // Filter to only ultra-sharp trades
    return phaseFiltered
      .filter(
        (trade) =>
          trade.isUltraSharp === true &&
          (trade.sharpStrength ?? 0) > 55 &&
          !isTradeLive(trade) &&
          trade.crossMarketEvPercent != null &&
          trade.sportsbookBestOdds != null
      )
      .sort((a, b) => {
        // Sort by strength first, then by time
        const strengthA = a.sharpStrength ?? 0
        const strengthB = b.sharpStrength ?? 0
        if (strengthA !== strengthB) return strengthB - strengthA
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
  }, [trades, phaseFilter])

  // Active sports with ultra-sharp action
  const activeSportsWithUltraSharp = useMemo(() => {
    const sports = new Map<string, number>()
    ultraSharpTrades.forEach((trade) => {
      sports.set(trade.sport, (sports.get(trade.sport) ?? 0) + 1)
    })
    return Array.from(sports.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sport, count]) => ({ sport, count }))
  }, [ultraSharpTrades])

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
    if (!hydrated) return
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

  // Dynamic polling based on active tab
  useEffect(() => {
    fetchTrades()
    const pollInterval = activeTab === 'sharp-money' ? POLL_INTERVAL_SHARP_FEED : POLL_INTERVAL_BET_FEED
    const interval = setInterval(fetchTrades, pollInterval)
    return () => clearInterval(interval)
  }, [activeTab])

  // Alert detection for new ultra-sharp trades
  useEffect(() => {
    if (!showLocalAlerts || !alertsEnabled || activeTab !== 'sharp-money') return

    const newUltraSharp = ultraSharpTrades.filter(
      (trade) => !ultraSharpSeenIds.current.has(trade.id)
    )

    if (newUltraSharp.length > 0) {
      const newAlerts = newUltraSharp.map((trade) => ({
        id: trade.id,
        trade,
        timestamp: new Date().toISOString(),
        dismissed: false,
      }))
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5)) // Keep max 5 alerts

      // Add to seen set
      newUltraSharp.forEach((trade) => ultraSharpSeenIds.current.add(trade.id))
    }
  }, [ultraSharpTrades, alertsEnabled, activeTab])

  // Auto-dismiss alerts after 30 seconds
  useEffect(() => {
    if (!showLocalAlerts || alerts.length === 0) return
    const timer = setTimeout(() => {
      setAlerts((prev) => prev.slice(1))
    }, 30000)
    return () => clearTimeout(timer)
  }, [alerts])

  // Dismiss alert handler
  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

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
        value={dateFilter}
        onChange={(e) => setDateFilter(e.target.value)}
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="all">All Dates</option>
        {dateOptions.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
      <select
        value={sizeFilter}
        onChange={(e) =>
          setSizeFilter(e.target.value as 'all' | 'small' | 'blue' | 'mega' | 'nuke')
        }
        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
      >
        <option value="all">All Sizes</option>
        <option value="small">Swordfish</option>
        <option value="blue">Megalodon</option>
        <option value="mega">Blue whale</option>
        <option value="nuke">Nuke</option>
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

      {/* Header with Title and Tabs */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Sharp Detector</h2>

        {/* Tab Buttons - Centered */}
        <div className="flex items-center gap-2 bg-white/5 rounded-2xl p-1.5">
          <button
            onClick={() => setActiveTab('bet-feed')}
            className={cn(
              'px-8 py-3 text-base font-semibold rounded-xl transition-all min-w-[140px]',
              activeTab === 'bet-feed'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            )}
          >
            Bet Feed
          </button>
          <button
            onClick={() => isSyndicate && setActiveTab('sharp-money')}
            className={cn(
              'px-8 py-3 text-base font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-w-[180px]',
              activeTab === 'sharp-money'
                ? 'bg-emerald-500/20 text-emerald-400 shadow-sm'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5',
              !isSyndicate && 'opacity-50 cursor-not-allowed'
            )}
          >
            <Zap className="w-4 h-4" />
            Sharp Money
            {!isSyndicate && (
              <span className="ml-1 px-2 py-1 text-[10px] bg-amber-500/20 text-amber-300 rounded uppercase tracking-wider">
                Syndicate
              </span>
            )}
            {isSyndicate && ultraSharpTrades.length > 0 && (
              <span className="ml-1 px-2 py-1 text-[10px] bg-emerald-500/30 text-emerald-300 rounded-full font-bold">
                {ultraSharpTrades.length}
              </span>
            )}
          </button>
        </div>

        {/* Spacer to balance the layout */}
        <div className="w-[120px]" />
      </div>

        {/* Bet Feed Tab Content */}
        {activeTab === 'bet-feed' && (
        <>
        <TutorialPopup tutorialId="bet-feed" />
        <div className="flex flex-col gap-4">
          <div className="flex-1 space-y-3">
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
                {walletStats.map((wallet) => {
                  const walletKey = normalizeWallet(wallet.wallet) ?? wallet.wallet
                  const summary = trackedWalletSummaryMap.get(walletKey)
                  const wins = Number(summary?.total_wins ?? 0)
                  const losses = Number(summary?.total_losses ?? 0)
                  const pushes = Number(summary?.total_pushes ?? 0)
                  const pnlValue = Number(summary?.total_realized_pnl ?? 0)
                  const pnlLabel = Number.isFinite(pnlValue) ? formatCurrency(pnlValue) : '--'
                  return (
                    <button
                      type="button"
                      key={wallet.wallet}
                      onClick={() => setWalletFilter(wallet.wallet)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-xl border px-2.5 py-2 text-[11px] text-white/70 transition',
                        walletFilter !== 'all' &&
                          normalizeWallet(wallet.wallet) === normalizeWallet(walletFilter)
                          ? 'border-emerald-400/50 bg-emerald-500/10'
                          : 'border-white/10 bg-black/30 hover:border-white/30'
                      )}
                    >
                      <span className="font-semibold text-white/80">
                        {formatWalletAlias(wallet.wallet)}
                        <span className="ml-2 text-[10px] font-normal text-white/40">
                          {wins}W - {losses}L - {pushes}P
                        </span>
                        <span className="ml-2 text-[10px] font-normal text-emerald-200">
                          P/L {pnlLabel}
                        </span>
                      </span>
                      <span className="text-white/50">
                        {wallet.count} trades
                        {wallet.lastSeen ? ` - last ${formatTimestamp(wallet.lastSeen)}` : ''}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mt-2 text-[11px] text-white/50">
                Click to view tracked wallets.
              </div>
            )}
          </div>
        </div>
      </div>
      {sortedTrades.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-black/40 p-4 text-xs text-white/60">
          No sharp bets detected yet. Trades &gt;= {formatCurrency(MIN_NOTIONAL)} will
          appear here.
        </div>
      )}
      {sortedTrades.length > 0 && (
        <div className="hidden lg:grid grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)] gap-3 px-4 text-[10px] uppercase tracking-[0.25em] text-white/40">
          <span>Matchup</span>
          <span>Bet</span>
          <span>Size</span>
          <span>Date</span>
          <span>Odds</span>
          <span>Detected</span>
        </div>
      )}
      {sortedTrades.map((trade) => {
        const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
        const sharpTier = resolveSharpTier(trade.notional)
        const walletKey = normalizeWallet(trade.proxyWallet)
        const isTrackedWallet =
          trade.source === 'polymarket' && walletKey && trackedWalletSet.has(walletKey)
        const matchupKey = tradeMatchupKeyMap.get(trade.id)
        const matchupLabel =
          (matchupKey && matchupIndex.get(matchupKey)?.label) ??
          resolveGameLabel(trade.marketTitle)
        const eventLabel =
          trade.eventDate ?? new Date(trade.timestamp).toLocaleDateString()
        const detectedLabel = formatTimestamp(trade.timestamp)
        return (
          <div
            key={trade.id}
            className={cn(
              'w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 transition',
              isFresh &&
                'border-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
            )}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1.1fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.5fr)] lg:gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Matchup
                </p>
                <p className="text-sm font-semibold text-white">{matchupLabel}</p>
                <p className="text-[11px] text-white/45">
                  {trade.sport} / {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Bet
                </p>
                <p className="text-sm text-white/80">{trade.outcome}</p>
                <p className="text-[11px] text-white/40">{trade.marketTitle}</p>
                {isTrackedWallet && (
                  <span className="mt-1 inline-flex rounded-full border border-emerald-400/40 px-2 py-0.5 text-[10px] text-emerald-200">
                    Tracked {formatWalletAlias(trade.proxyWallet)}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Size
                </p>
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]',
                    sharpTierClass[sharpTier]
                  )}
                >
                  {sharpTierLabel[sharpTier]}
                </span>
                <p className="mt-1 text-xs text-white/70">
                  {formatCurrency(trade.notional)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Date
                </p>
                <p className="text-sm text-white/80">{eventLabel}</p>
                <p className="text-[11px] text-white/40">{resolvePhase(trade)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Odds
                </p>
                <p className="text-sm text-white/80">{resolveOddsLabel(trade)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-white/40 sm:hidden">
                  Detected
                </p>
                <p className="text-sm text-white/80">{detectedLabel}</p>
              </div>
              <div className="flex items-center justify-end lg:justify-start">
                <ShareTradeButton
                  trade={{
                    id: trade.id,
                    marketTitle: trade.marketTitle,
                    outcome: trade.outcome,
                    notional: trade.notional,
                    source: trade.source,
                    sport: trade.sport,
                    eventDate: trade.eventDate,
                    timestamp: trade.timestamp,
                    priceCents: trade.priceCents,
                    americanOdds: trade.americanOdds,
                  }}
                  matchupLabel={matchupLabel}
                />
              </div>
            </div>
          </div>
        )
      })}
      </>
      )}

      {/* Sharp Money Feed Tab Content */}
      {activeTab === 'sharp-money' && !isSyndicate && (
        <div className="p-6 text-center">
          <Lock className="w-8 h-8 mx-auto text-white/30 mb-3" />
          <h3 className="text-lg font-medium text-white">Sharp Money Feed</h3>
          <p className="text-sm text-white/60 mt-1">Available for Syndicate members</p>
          <Link
            href="/pricing"
            className="mt-4 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
          >
            Upgrade to Syndicate
          </Link>
        </div>
      )}

      {activeTab === 'sharp-money' && isSyndicate && (
          <div className="space-y-4">
            <TutorialPopup tutorialId="sharp-money" />
            {/* Alerts */}
            {showLocalAlerts && (
              <AnimatePresence>
                {alerts.map((alert) => (
                  <SharpAlertBanner
                  key={alert.id}
                  alert={alert}
                  onDismiss={() => dismissAlert(alert.id)}
                />
              ))}
            </AnimatePresence>
          )}

          {/* Header with filters */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Ultra-Sharp Plays
              </h3>
              {activeSportsWithUltraSharp.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {activeSportsWithUltraSharp.slice(0, 4).map(({ sport, count }) => (
                    <span
                      key={sport}
                      className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-white/5 border border-white/10 rounded text-white/60"
                    >
                      {sport} ({count})
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Phase Filter */}
              <select
                value={phaseFilter}
                onChange={(e) => setPhaseFilter(e.target.value as GamePhase)}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Games</option>
                <option value="pregame">Pre-game Only</option>
                <option value="live">Live Only</option>
              </select>
              {showLocalAlerts && (
                <label className="flex items-center gap-2 text-[10px] text-white/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alertsEnabled}
                    onChange={(e) => setAlertsEnabled(e.target.checked)}
                    className="rounded border-white/20 bg-black"
                  />
                  Show alerts
                </label>
              )}
            </div>
          </div>

          {/* Empty State */}
          {ultraSharpTrades.length === 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
              <Zap className="w-10 h-10 text-white/20 mx-auto mb-3" />
              <p className="text-white/60 text-sm">
                No ultra-sharp plays detected right now.
              </p>
              <p className="text-white/40 text-[11px] mt-1">
                Ultra-sharp plays trigger on at least one signal (cluster, timing, divergence, cross-market EV, or big bet).
              </p>
            </div>
          )}

          {/* Ultra-Sharp Trade Cards */}
          {ultraSharpTrades.map((trade) => {
            const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
            const sharpTier = resolveSharpTier(trade.notional)
            const hasRlm = trade.ultraSharpReasons?.some(r => r.type === 'rlm')
            const matchupLabel = resolveGameLabel(trade.marketTitle)

            return (
              <motion.div
                key={trade.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border bg-black/40 p-4 transition',
                  isFresh
                    ? 'border-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.25)]'
                    : 'border-emerald-500/30'
                )}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/30 rounded text-emerald-300">
                        {trade.sport}
                      </span>
                      {hasRlm && <RlmBadge />}
                      {isFresh && (
                        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-white">
                      {trade.marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()}
                    </h4>
                  </div>
                  <div className="text-right">
                    <div className={cn('text-lg font-bold', resolveStrengthClass(trade.sharpStrength))}>
                      {trade.sharpStrength}%
                    </div>
                    <div className="text-[10px] uppercase text-white/40">strength</div>
                  </div>
                </div>

                {/* Bet Details */}
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em]',
                        sharpTierClass[sharpTier]
                      )}
                    >
                      {formatCurrency(trade.notional)}
                    </span>
                    <span className="text-sm text-white/80">{trade.outcome}</span>
                  </div>
                  <span className="text-sm text-white/50">{resolveOddsLabel(trade)}</span>
                  <span className="text-[11px] text-white/40">
                    {trade.eventDate ?? 'TBD'} • {resolvePhase(trade)}
                  </span>
                </div>

                {(trade.sportsbookBestOdds != null || trade.crossMarketEvPercent != null) && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-white/60">
                    {trade.sportsbookBestOdds != null && (
                      <span>
                        Best odds: {formatAmericanOdds(trade.sportsbookBestOdds)}
                        {trade.sportsbookBookTitle || trade.sportsbookBookKey
                          ? ` (${trade.sportsbookBookTitle ?? trade.sportsbookBookKey})`
                          : ''}
                      </span>
                    )}
                    {trade.crossMarketEvPercent != null && (
                      <span>EV: {trade.crossMarketEvPercent.toFixed(1)}%</span>
                    )}
                  </div>
                )}

                {/* Why it's sharp section */}
                {trade.ultraSharpReasons && trade.ultraSharpReasons.length > 0 && (
                  <WhyItsSharpSection reasons={trade.ultraSharpReasons} />
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <Clock className="w-3 h-3" />
                    Detected {formatTimestamp(trade.timestamp)}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] uppercase tracking-wider text-white/30">
                      {trade.source === 'kalshi' ? 'Kalshi' : 'Polymarket'}
                    </span>
                    <ShareTradeButton
                      trade={{
                        id: trade.id,
                        marketTitle: trade.marketTitle,
                        outcome: trade.outcome,
                        notional: trade.notional,
                        source: trade.source,
                        sport: trade.sport,
                        eventDate: trade.eventDate,
                        timestamp: trade.timestamp,
                        priceCents: trade.priceCents,
                        americanOdds: trade.americanOdds,
                      }}
                      matchupLabel={matchupLabel}
                    />
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
