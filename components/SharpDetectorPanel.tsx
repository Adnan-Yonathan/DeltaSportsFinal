"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { cn } from '@/lib/utils'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { getWalletAlias } from '@/lib/utils/wallet-alias'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, Lock, Clock } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import ShareTradeButton from './ShareTradeButton'
import TutorialPopup from './TutorialPopup'
import {
  ALL_SPORTS_FILTER,
  ALLOWED_POLYMARKET_SPORT_LABELS,
} from '@/lib/services/polymarket-sports'

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
  sportsbookNoVigProb?: number | null
  evPercent?: number | null
  evTargetPriceCents?: number | null
  evTargetAmericanOdds?: number | null
  crossMarketEvPercent?: number | null
  sportRoi?: number | null
  totalRoi?: number | null
  tradeCount?: number | null
  buyTradeCount?: number | null
  priceMoveCents?: number | null
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

type BettorLeaderboardRow = {
  rank: number
  wallet: string
  display_name: string | null
  risk_adjusted_score: number
  total_realized_pnl: number
  roi_lifetime: number
  settled_markets: number
  sport_label?: string | null
  sport_risk_adjusted_score?: number
  sport_total_realized_pnl?: number
  sport_roi_lifetime?: number
  sport_settled_markets?: number
  trade_count?: number
  buy_trade_count?: number
  sport_trade_count?: number
  sport_buy_trade_count?: number
  global_trade_count?: number
  global_buy_trade_count?: number
  global_roi_lifetime?: number
}

type BettorFeedTrade = {
  id: string
  wallet: string
  display_name: string | null
  side: 'BUY' | 'SELL'
  size: number | null
  price: number | null
  entry_american_odds: number | null
  stake_usd: number | null
  trade_time: string
  sport: string
  eventDate?: string | null
  slug: string
  title: string | null
  outcome: string | null
  outcome_index: number | null
  current_price_cents?: number | null
  current_american_odds?: number | null
  price_move_cents?: number | null
  risk_adjusted_score: number
  total_realized_pnl: number
  roi_lifetime: number
  trade_count?: number
  buy_trade_count?: number
  sport_risk_adjusted_score?: number
  sport_total_realized_pnl?: number
  sport_roi_lifetime?: number
  sport_trade_count?: number
  sport_buy_trade_count?: number
  global_total_realized_pnl?: number
  global_roi_lifetime?: number
  global_trade_count?: number
  global_buy_trade_count?: number
}

type BettorPosition = {
  wallet: string
  slug: string
  sport: string | null
  title: string | null
  outcome: string | null
  net_shares: number
  avg_entry_american_odds: number | null
  stake_usd: number
  potential_payout_usd: number
  last_trade_time: string | null
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
const MIN_PROP_NOTIONAL = 1000
const POLL_INTERVAL_BET_FEED = 30000
const POLL_INTERVAL_SHARP_FEED = 15000
const WALLET_STORAGE_KEY = 'sharp-detector-wallets'
const MAX_RESOLVED_TRADES = 300
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const SHARP_MONEY_SPORT_OPTIONS = [ALL_SPORTS_FILTER, ...ALLOWED_POLYMARKET_SPORT_LABELS]

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

const FLOW_USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const formatFlowNotional = (value: number) => {
  if (!Number.isFinite(value)) return '$0'
  return FLOW_USD.format(value)
}

const formatFlowTime = (value: string) => {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

const resolveTradeOddsNumber = (trade: SharpTrade) => {
  const value = trade.currentAmericanOdds ?? trade.americanOdds
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const resolveTradeOddsShortLabel = (trade: SharpTrade) => {
  const odds = resolveTradeOddsNumber(trade)
  return odds != null ? formatAmericanOdds(odds) : `${Math.round(trade.priceCents)}c`
}

const buildRecentFlowBars = (
  referenceTrade: SharpTrade,
  pool: SharpTradeWithStatus[],
  limit = 8
): Array<{
  timestampLabel: string
  notional: string
  oddsLabel: string
  direction: 'up' | 'down' | 'neutral'
  normalizedHeight: number
}> => {
  const referenceKey = extractGameKey(referenceTrade.marketTitle, referenceTrade.sport)
  const matched = pool
    .filter(
      (trade) =>
        trade.sport === referenceTrade.sport &&
        extractGameKey(trade.marketTitle, trade.sport) === referenceKey
    )
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-limit)

  if (!matched.length) return []

  const maxNotional = matched.reduce((max, trade) => Math.max(max, trade.notional), 0)
  return matched.map((trade, index) => {
    const currentOdds = resolveTradeOddsNumber(trade)
    const prevOdds = index > 0 ? resolveTradeOddsNumber(matched[index - 1]) : null
    const direction: 'up' | 'down' | 'neutral' =
      currentOdds == null || prevOdds == null
        ? 'neutral'
        : currentOdds > prevOdds
          ? 'up'
          : currentOdds < prevOdds
            ? 'down'
            : 'neutral'
    return {
      timestampLabel: formatFlowTime(trade.timestamp),
      notional: formatFlowNotional(trade.notional),
      oddsLabel: resolveTradeOddsShortLabel(trade),
      direction,
      normalizedHeight: maxNotional > 0 ? Math.max((trade.notional / maxNotional) * 100, 14) : 14,
    }
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

const isPastEvent = (trade: SharpTrade) => {
  if (!trade.eventDate) return false
  const todayKey = getEasternDateKey(new Date())
  const eventKey = trade.eventDate.match(DATE_ONLY_PATTERN)
    ? trade.eventDate
    : getEasternDateKey(trade.eventDate)
  if (!todayKey || !eventKey) return false
  return eventKey < todayKey
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

const formatSignedCents = (value: number | null | undefined) => {
  if (!Number.isFinite(value)) return 'n/a'
  const rounded = Math.round(Number(value))
  return `${rounded > 0 ? '+' : ''}${rounded}c`
}

const formatCompactCount = (value: number | null | undefined, decimals = 0) => {
  if (!Number.isFinite(value)) return '0'
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: decimals,
  }).format(Number(value))
}

const formatRoiPercent = (value: number | null | undefined) =>
  `${((value ?? 0) * 100).toFixed(1)}%`

const resolvePolymarketEventUrl = (slug?: string | null) => {
  if (!slug) return 'https://polymarket.com/'
  return `https://polymarket.com/event/${encodeURIComponent(slug)}`
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

const isLiquidityTrade = (trade: SharpTrade) => trade.id?.startsWith('liquidity:')

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
  defaultTab = 'bet-feed',
  lockedTab,
  panelTitle = 'Sharp Money Feed',
}: {
  className?: string
  onNewSharp?: (count: number) => void
  onCountChange?: (count: number) => void
  isSyndicate?: boolean
  showLocalAlerts?: boolean
  defaultTab?: ActiveTab
  lockedTab?: ActiveTab
  panelTitle?: string
}) {
  const [activeTab, setActiveTab] = useState<ActiveTab>(lockedTab ?? defaultTab)
  const [phaseFilter, setPhaseFilter] = useState<GamePhase>('all')
  const [alerts, setAlerts] = useState<SharpAlert[]>([])
  const [alertsEnabled, setAlertsEnabled] = useState(true)
  const sharpMoneySeenIds = useRef<Set<string>>(new Set())

  const [trades, setTrades] = useState<SharpTradeWithStatus[]>([])
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
  const [bettorLeaderboard, setBettorLeaderboard] = useState<BettorLeaderboardRow[]>([])
  const [bettorFeedRows, setBettorFeedRows] = useState<BettorFeedTrade[]>([])
  const [bettorSportFilter, setBettorSportFilter] = useState<string>(ALL_SPORTS_FILTER)
  const [bettorWalletFilter, setBettorWalletFilter] = useState<string>('all')
  const [selectedBettorWallet, setSelectedBettorWallet] = useState<string | null>(null)
  const [selectedBettorPositions, setSelectedBettorPositions] = useState<BettorPosition[]>([])
  const [selectedBettorLabel, setSelectedBettorLabel] = useState<string | null>(null)
  const [bettorLoading, setBettorLoading] = useState(false)
  const seenIdsRef = useRef<Set<string>>(new Set())
  const hasInitializedRef = useRef(false)

  const betFeedTrades = useMemo(
    () =>
      trades.filter(
        (trade) => !isLiquidityTrade(trade) && trade.notional >= MIN_NOTIONAL
      ),
    [trades]
  )

  const preDateTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const walletKey = walletFilter === 'all' ? null : normalizeWallet(walletFilter)
    return betFeedTrades.filter((trade) => {
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
  }, [betFeedTrades, sportFilter, sizeFilter, searchQuery, walletFilter])

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

  useEffect(() => {
    if (bettorWalletFilter === 'all') return
    if (!bettorLeaderboard.some((bettor) => bettor.wallet === bettorWalletFilter)) {
      setBettorWalletFilter('all')
    }
  }, [bettorWalletFilter, bettorLeaderboard])

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
    return betFeedTrades.filter(
      (trade) => getEasternDateKey(trade.timestamp) === todayKey
    ).length
  }, [betFeedTrades])

  const sportButtons = useMemo(
    () => ['all', 'NBA', 'NFL', 'MLB', 'NHL', 'NCAAB', 'NCAAF', 'WNBA', 'SOCCER', 'GOLF', 'UFC'],
    []
  )

  const trackedWalletSet = useMemo(
    () => new Set(trackedWallets.map((wallet) => normalizeWallet(wallet)).filter(Boolean) as string[]),
    [trackedWallets]
  )

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

  const sharpMoneySourceTrades = useMemo(() => {
    const rows = bettorFeedRows.filter((row) => {
      if (bettorWalletFilter !== 'all' && row.wallet !== bettorWalletFilter) return false
      return true
    })

    return rows.map<SharpTradeWithStatus>((row) => ({
      id: row.id,
      source: 'polymarket',
      marketTitle: row.title ?? row.slug,
      outcome: row.outcome ?? 'Market',
      proxyWallet: row.wallet,
      priceCents: Number.isFinite(row.price) ? Math.round((row.price ?? 0) * 100) : 0,
      americanOdds: row.entry_american_odds,
      currentPriceCents: row.current_price_cents ?? null,
      currentAmericanOdds: row.current_american_odds ?? null,
      notional: row.stake_usd ?? 0,
      contracts: row.size ?? 0,
      timestamp: row.trade_time,
      sport: (row.sport || 'SPORTS').toUpperCase(),
      eventDate: row.eventDate ?? undefined,
      slug: row.slug,
      outcomeIndex: row.outcome_index ?? undefined,
      side: row.side,
      sharpStrength: Math.round(
        row.sport_risk_adjusted_score ?? row.risk_adjusted_score ?? 0
      ),
      sportRoi: row.sport_roi_lifetime ?? row.roi_lifetime ?? 0,
      totalRoi: row.global_roi_lifetime ?? row.roi_lifetime ?? 0,
      tradeCount: row.global_trade_count ?? row.trade_count ?? 0,
      buyTradeCount: row.global_buy_trade_count ?? row.buy_trade_count ?? 0,
      priceMoveCents: row.price_move_cents ?? null,
    }))
  }, [bettorFeedRows, bettorWalletFilter])

  const sharpMoneyTrades = useMemo(() => {
    const phaseFiltered = filterByPhase(sharpMoneySourceTrades, phaseFilter).filter(
      (trade) => !isPastEvent(trade)
    )
    return phaseFiltered
      .map((trade) => ({
        trade,
        minNotional: 0,
      }))
      .sort((a, b) => {
        const timeA = new Date(a.trade.timestamp).getTime()
        const timeB = new Date(b.trade.timestamp).getTime()
        return timeB - timeA
      })
  }, [sharpMoneySourceTrades, phaseFilter])

  const activeSportsWithSharpMoney = useMemo(() => {
    const sports = new Map<string, number>()
    sharpMoneyTrades.forEach((entry) => {
      sports.set(entry.trade.sport, (sports.get(entry.trade.sport) ?? 0) + 1)
    })
    return Array.from(sports.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([sport, count]) => ({ sport, count }))
  }, [sharpMoneyTrades])

  const fetchTrades = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('minNotional', String(MIN_PROP_NOTIONAL))
      params.set('limit', '500')
      if (dateFilter !== 'all') {
        params.set('date', dateFilter)
      }
      const res = await fetch(`/api/whale-trades-daily?${params.toString()}`, {
        cache: 'no-store',
      })
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
            if (trade.notional >= MIN_NOTIONAL && !isLiquidityTrade(trade)) {
              newIds.push(trade.id)
            }
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
      console.warn('Whale Feed fetch failed:', error)
      setLastFetchAt(new Date().toISOString())
      setLastFetchError(error instanceof Error ? error.message : 'Unknown error')
    }
  }, [dateFilter, onNewSharp])

  const fetchBettorData = useCallback(async () => {
    try {
      setBettorLoading(true)
      const leaderboardParams = new URLSearchParams()
      leaderboardParams.set('limit', '12')
      leaderboardParams.set('sport', bettorSportFilter)
      leaderboardParams.set('eligibility', 'profitable')
      const leaderboardRes = await fetch(
        `/api/polymarket/bettors/leaderboard?${leaderboardParams.toString()}`,
        {
          cache: 'no-store',
        }
      )
      if (!leaderboardRes.ok) {
        throw new Error(`Bettor leaderboard request failed (${leaderboardRes.status})`)
      }
      const leaderboardPayload = await leaderboardRes.json()
      const leaderboardRows: BettorLeaderboardRow[] = Array.isArray(leaderboardPayload?.bettors)
        ? leaderboardPayload.bettors
        : []
      setBettorLeaderboard(leaderboardRows)

      const params = new URLSearchParams()
      params.set('limit', '120')
      params.set('sport', bettorSportFilter)
      params.set('eligibility', 'profitable')
      if (bettorWalletFilter !== 'all') {
        params.set('wallet', bettorWalletFilter)
      }
      const feedRes = await fetch(`/api/polymarket/bettors/feed?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!feedRes.ok) {
        throw new Error(`Bettor feed request failed (${feedRes.status})`)
      }
      const feedPayload = await feedRes.json()
      const feedRows: BettorFeedTrade[] = Array.isArray(feedPayload?.trades)
        ? feedPayload.trades
        : []
      setBettorFeedRows(feedRows)
      setLastFetchAt(new Date().toISOString())
      setLastFetchCount(feedRows.length)
      setLastFetchError(null)
    } catch (error) {
      console.warn('Bettor feed fetch failed:', error)
      setLastFetchAt(new Date().toISOString())
      setLastFetchError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setBettorLoading(false)
    }
  }, [bettorSportFilter, bettorWalletFilter])

  useEffect(() => {
    if (typeof window === 'undefined') return
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!lockedTab) return
    setActiveTab(lockedTab)
  }, [lockedTab])

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
      betFeedTrades.forEach((trade) => {
        if (trade.source !== 'polymarket') return
        const wallet = normalizeWallet(trade.proxyWallet)
        if (wallet) next.add(wallet)
      })
      if (next.size === prev.length) return prev
      return Array.from(next)
    })
  }, [hydrated, betFeedTrades])

  // Dynamic polling based on active tab
  useEffect(() => {
    if (activeTab === 'sharp-money' && isSyndicate) {
      fetchBettorData()
      const interval = setInterval(fetchBettorData, POLL_INTERVAL_SHARP_FEED)
      return () => clearInterval(interval)
    }

    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_INTERVAL_BET_FEED)
    return () => clearInterval(interval)
  }, [activeTab, isSyndicate, fetchBettorData, fetchTrades])

  useEffect(() => {
    if (!selectedBettorWallet || activeTab !== 'sharp-money' || !isSyndicate) {
      setSelectedBettorPositions([])
      return
    }
    const controller = new AbortController()
    const load = async () => {
      try {
        const params = new URLSearchParams()
        params.set('limit', '50')
        if (bettorSportFilter !== ALL_SPORTS_FILTER) {
          params.set('sport', bettorSportFilter)
        }
        const res = await fetch(
          `/api/polymarket/bettors/${encodeURIComponent(selectedBettorWallet)}/positions?${params.toString()}`,
          {
            cache: 'no-store',
            signal: controller.signal,
          }
        )
        if (!res.ok) return
        const payload = await res.json()
        setSelectedBettorPositions(
          Array.isArray(payload?.positions) ? payload.positions : []
        )
        const name = payload?.display_name
        setSelectedBettorLabel(typeof name === 'string' && name.length > 0 ? name : selectedBettorWallet)
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        console.warn('Bettor positions fetch failed:', error)
      }
    }
    load()
    return () => controller.abort()
  }, [selectedBettorWallet, activeTab, isSyndicate, bettorSportFilter])

  // Alert detection for new sharp money trades
  useEffect(() => {
    if (!showLocalAlerts || !alertsEnabled || activeTab !== 'sharp-money') return

    const newSharpMoney = sharpMoneyTrades
      .map((entry) => entry.trade)
      .filter((trade) => !sharpMoneySeenIds.current.has(trade.id))

    if (newSharpMoney.length > 0) {
      const newAlerts = newSharpMoney.map((trade) => ({
        id: trade.id,
        trade,
        timestamp: new Date().toISOString(),
        dismissed: false,
      }))
      setAlerts((prev) => [...newAlerts, ...prev].slice(0, 5)) // Keep max 5 alerts

      // Add to seen set
      newSharpMoney.forEach((trade) => sharpMoneySeenIds.current.add(trade.id))
    }
  }, [sharpMoneyTrades, alertsEnabled, activeTab, showLocalAlerts])

  // Auto-dismiss alerts after 30 seconds
  useEffect(() => {
    if (!showLocalAlerts || alerts.length === 0) return
    const timer = setTimeout(() => {
      setAlerts((prev) => prev.slice(1))
    }, 30000)
    return () => clearTimeout(timer)
  }, [alerts, showLocalAlerts])

  // Dismiss alert handler
  const dismissAlert = (alertId: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== alertId))
  }

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
        <h2 className="text-lg font-semibold text-white">{panelTitle}</h2>

        {!lockedTab ? (
          <>
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
                {isSyndicate && sharpMoneyTrades.length > 0 && (
                  <span className="ml-1 px-2 py-1 text-[10px] bg-emerald-500/30 text-emerald-300 rounded-full font-bold">
                    {sharpMoneyTrades.length}
                  </span>
                )}
              </button>
            </div>

            {/* Spacer to balance the layout */}
            <div className="w-[120px]" />
          </>
        ) : (
          <div className="text-xs uppercase tracking-[0.18em] text-emerald-300/80">
            {lockedTab === 'sharp-money' ? 'Syndicate' : ''}
          </div>
        )}
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
                    recentFlowBars: buildRecentFlowBars(trade, sortedTrades),
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
          <h3 className="text-lg font-medium text-white">Pro Bettor Feed</h3>
          <p className="text-sm text-white/60 mt-1">
            Track qualified profitable Polymarket sports bettors, their fills, and live position exposure.
          </p>
          <Link
            href="/checkout"
            className="mt-4 inline-flex items-center rounded-full border border-emerald-400/60 px-5 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
          >
            Start your free trial
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
                Profitable Bettor Tape
              </h3>
              {activeSportsWithSharpMoney.length > 0 && (
                <div className="flex items-center gap-1.5">
                  {activeSportsWithSharpMoney.slice(0, 4).map(({ sport, count }) => (
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
              <select
                value={bettorSportFilter}
                onChange={(e) => setBettorSportFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
              >
                {SHARP_MONEY_SPORT_OPTIONS.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport === ALL_SPORTS_FILTER ? 'All Sports' : sport}
                  </option>
                ))}
              </select>
              <select
                value={bettorWalletFilter}
                onChange={(e) => setBettorWalletFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-black text-[11px] text-white/80 focus:outline-none focus:border-emerald-500/50"
              >
                <option value="all">All Bettors</option>
                {bettorLeaderboard.map((bettor) => (
                  <option key={bettor.wallet} value={bettor.wallet}>
                    {(bettor.display_name ?? formatWalletAlias(bettor.wallet))} ({Math.round(bettor.risk_adjusted_score)})
                  </option>
                ))}
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

          {bettorLeaderboard.length > 0 && (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <p className="mb-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                Leaderboard (Profitable ROI)
              </p>
              <div className="grid gap-2 md:grid-cols-3">
                {bettorLeaderboard.slice(0, 6).map((bettor) => (
                  <button
                    key={bettor.wallet}
                    type="button"
                    onClick={() => {
                      setSelectedBettorWallet(bettor.wallet)
                      setSelectedBettorLabel(bettor.display_name ?? formatWalletAlias(bettor.wallet))
                      setBettorWalletFilter(bettor.wallet)
                    }}
                    className="rounded-xl border border-white/10 bg-black/40 p-2 text-left hover:border-emerald-400/40 transition"
                  >
                    <p className="text-[11px] text-white/70">
                      #{bettor.rank} {bettor.display_name ?? formatWalletAlias(bettor.wallet)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-300">
                      {formatCurrency(
                        bettor.sport_total_realized_pnl ?? bettor.total_realized_pnl
                      )}
                    </p>
                    <p className="text-[10px] text-white/45">
                      ROI {formatRoiPercent(bettor.sport_roi_lifetime ?? bettor.roi_lifetime)} | Trades{' '}
                      {formatCompactCount(
                        bettor.global_trade_count ?? bettor.trade_count ?? 0
                      )}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {!bettorLoading && sharpMoneyTrades.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center">
            <Zap className="w-10 h-10 text-white/20 mx-auto mb-3" />
            <p className="text-white/60 text-sm">
              No profitable bettor prints detected right now.
            </p>
            <p className="text-white/40 text-[11px] mt-1">
              This stream only includes profitable Polymarket sports bettors with positive ROI and enough sample.
            </p>
          </div>
        )}

          {bettorLoading && (
            <div className="rounded-2xl border border-white/10 bg-black/40 p-8 text-center text-sm text-white/60">
              Loading bettor feed...
            </div>
          )}

          {/* Sharp Money Trade Cards */}
          {sharpMoneyTrades.map((entry) => {
            const { trade } = entry
            const isFresh = now - new Date(trade.timestamp).getTime() < 2 * 60 * 1000
            const sharpTier = resolveSharpTier(trade.notional)
            const walletKey = normalizeWallet(trade.proxyWallet) ?? ''
            const bettor = bettorLeaderboard.find((row) => row.wallet === walletKey)
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
                      {isFresh && (
                        <span className="px-2 py-0.5 text-[9px] uppercase tracking-wider bg-amber-500/20 border border-amber-500/30 rounded text-amber-300 animate-pulse">
                          New
                        </span>
                      )}
                    </div>
                    <h4 className="text-base font-semibold text-white">
                      {trade.marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()}
                    </h4>
                    <p className="text-[11px] text-white/50">
                      Bettor: {bettor?.display_name ?? formatWalletAlias(trade.proxyWallet)}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] uppercase text-white/40">Risk score</div>
                    <div className="text-lg font-bold text-emerald-300">
                      {trade.sharpStrength != null ? `${trade.sharpStrength}%` : 'n/a'}
                    </div>
                    <div className="text-[11px] text-white/50">Trades {formatCompactCount(trade.tradeCount)}</div>
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
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-200">
                      {trade.side === 'SELL' ? 'Sell' : 'Buy'}
                    </span>
                    <span className="text-sm text-white/80">{trade.outcome}</span>
                  </div>
                  <span className="text-sm text-white/50">
                    Entry {formatOddsLabel(trade.priceCents, trade.americanOdds)}
                  </span>
                  <span className="text-sm text-white/50">
                    Current{' '}
                    {trade.currentPriceCents != null
                      ? formatOddsLabel(trade.currentPriceCents, trade.currentAmericanOdds ?? null)
                      : 'n/a'}
                  </span>
                  <span className="text-sm text-white/50">
                    Move {formatSignedCents(trade.priceMoveCents)}
                  </span>
                  <span className="text-[11px] text-white/40">
                    {trade.eventDate ?? 'TBD'} | {resolvePhase(trade)}
                  </span>
                </div>

                <div className="grid gap-2 rounded-xl border border-white/10 bg-black/30 p-3 text-[11px] text-white/70 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Bet Size</div>
                    <div className="mt-1 text-sm text-white">
                      {formatCurrency(trade.notional)} · {formatCompactCount(trade.contracts, 2)} shares
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">ROI</div>
                    <div className="mt-1 text-sm text-white">
                      Sport {formatRoiPercent(trade.sportRoi)} | Total {formatRoiPercent(trade.totalRoi)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">Activity</div>
                    <div className="mt-1 text-sm text-white">
                      {formatCompactCount(trade.tradeCount)} trades · {formatCompactCount(trade.buyTradeCount)} buys
                    </div>
                  </div>
                </div>

                {trade.sportsbookBestOdds != null && (
                  <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px] text-white/60">
                    {trade.sportsbookBestOdds != null && (
                      <span>
                        Best book: {formatAmericanOdds(trade.sportsbookBestOdds)}
                        {trade.sportsbookBookTitle || trade.sportsbookBookKey
                          ? ` (${trade.sportsbookBookTitle ?? trade.sportsbookBookKey})`
                          : ''}
                      </span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/5">
                  <div className="flex items-center gap-2 text-[10px] text-white/40">
                    <Clock className="w-3 h-3" />
                    Detected {formatTimestamp(trade.timestamp)}
                  </div>
                  <div className="flex items-center gap-3">
                    <a
                      href={resolvePolymarketEventUrl(trade.slug)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-lg border border-white/10 bg-black/30 px-2 py-1 hover:border-emerald-300/50"
                      aria-label="Open market on Polymarket"
                      title="Open market on Polymarket"
                    >
                      <Image
                        src="/polymarket.png"
                        alt="Polymarket"
                        width={78}
                        height={16}
                        className="h-4 w-auto object-contain"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        if (!walletKey) return
                        setSelectedBettorWallet(walletKey)
                        setSelectedBettorLabel(bettor?.display_name ?? formatWalletAlias(walletKey))
                      }}
                      className="rounded-full border border-white/20 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-white/70 hover:border-emerald-300 hover:text-emerald-200"
                    >
                      Positions
                    </button>
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
                        recentFlowBars: buildRecentFlowBars(
                          trade,
                          sharpMoneyTrades.map((entry) => entry.trade)
                        ),
                      }}
                      matchupLabel={matchupLabel}
                    />
                  </div>
                </div>
              </motion.div>
            )
          })}

          {selectedBettorWallet && (
            <div className="rounded-2xl border border-emerald-500/30 bg-black/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  {selectedBettorLabel ?? formatWalletAlias(selectedBettorWallet)} Positions
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBettorWallet(null)
                    setSelectedBettorPositions([])
                  }}
                  className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/60 hover:text-white"
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {selectedBettorPositions.length === 0 && (
                  <p className="text-xs text-white/55">No open sports positions.</p>
                )}
                {selectedBettorPositions.map((position) => (
                  <div
                    key={`${position.slug}:${position.outcome}`}
                    className="rounded-xl border border-white/10 bg-black/30 p-3"
                  >
                    <p className="text-sm font-medium text-white">{position.title ?? position.slug}</p>
                    <p className="text-[11px] text-white/60">
                      {position.sport ?? 'SPORTS'} | {position.outcome ?? 'Outcome'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-white/70">
                      <span>Shares: {position.net_shares.toFixed(2)}</span>
                      <span>Stake: {formatCurrency(position.stake_usd)}</span>
                      <span>Payout: {formatCurrency(position.potential_payout_usd)}</span>
                      <span>
                        Entry:{' '}
                        {position.avg_entry_american_odds != null
                          ? formatAmericanOdds(position.avg_entry_american_odds)
                          : 'n/a'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

