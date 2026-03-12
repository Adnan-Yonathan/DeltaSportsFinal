"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { SimpleHeader } from "@/components/ui/simple-header"
import MobileToolsNav from "@/components/mobile-tools-nav"
import ShareTradeButton from "@/components/ShareTradeButton"
import { createClient } from "@/lib/supabase/client"
import { getMembershipStatus, type MembershipInfo } from "@/lib/utils/membership"
import { formatAmericanOdds, formatCurrency } from "@/lib/utils/odds"
import { cn } from "@/lib/utils"

type WhaleTrade = {
  id: string
  source: "kalshi" | "polymarket"
  marketTitle: string
  outcome: string
  proxyWallet?: string
  walletRoiLifetime?: number | null
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
}

type DateWindowFilter = "all" | "today" | "24h" | "3d"
type FeedMode = "all" | "hot"
type FeedActivity = "active" | "resting"
type SourceFilter = "all" | "kalshi" | "polymarket"
type TradeSort = "detected" | "size_desc" | "roi_desc"
type RecentFlowBar = {
  timestampLabel: string
  notional: string
  oddsLabel: string
  direction: "up" | "down" | "neutral"
  normalizedHeight: number
}

type RestingOrderbookSide = {
  propSide: "Over" | "Under" | null
  wallPriceCents: number | null
  wallNotional: number | null
  wallAmericanOdds: number | null
}

type RestingOrderbookItem = {
  id: string
  source: "kalshi" | "polymarket" | "novig" | "prophetx"
  sportLabel: string
  matchup?: string
  marketTitle: string
  propLine: number | null
  eventDate?: string
  ticker?: string
  slug?: string
  sharpLiquiditySide: "Over" | "Under" | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: "Over" | "Under" | null
  sharpLeanAmericanOdds: number | null
  updatedAt: string
  sides: RestingOrderbookSide[]
}

const POLL_INTERVAL_MS = 30000
const FEED_MIN_NOTIONAL = 2000
const FETCH_LIMIT = 600
const DAILY_FETCH_LIMIT = 1200
const RESTING_LIMIT = 240
const RESTING_DEPTH = 8
const RESTING_MIN_NOTIONAL = 2000
const MAX_DAY_CACHE_TRADES = 1500
const INITIAL_RENDER_LIMIT = 200
const RENDER_PAGE_SIZE = 200
const DAY_CACHE_STORAGE_KEY = "whale-feed-day-cache-v1"
const DEFAULT_LEAGUE_FILTER_OPTIONS = [
  "NBA",
  "NCAAB",
  "CFB",
  "NFL",
  "NHL",
  "MLB",
  "SOCCER",
  "TENNIS",
  "UFC",
]
const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

const normalizeSportLabel = (value?: string | null) => {
  if (!value) return ""
  return value.trim().toUpperCase()
}

const formatShortDateTime = (value?: string | null) => {
  if (!value) return "n/a"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const FLOW_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

const formatFlowNotional = (value: number) => {
  if (!Number.isFinite(value)) return "$0"
  return FLOW_USD.format(value)
}

const formatFlowTime = (value: string) => {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

const formatRoiPercent = (value?: number | null) => {
  if (typeof value !== "number" || !Number.isFinite(value)) return "0.0%"
  return `${(value * 100).toFixed(1)}%`
}

const resolveTradeOddsNumber = (trade: WhaleTrade) => {
  const value =
    typeof trade.currentAmericanOdds === "number" && Number.isFinite(trade.currentAmericanOdds)
      ? trade.currentAmericanOdds
      : typeof trade.americanOdds === "number" && Number.isFinite(trade.americanOdds)
        ? trade.americanOdds
        : null
  return value
}

const resolveTradeOddsShortLabel = (trade: WhaleTrade) => {
  const odds = resolveTradeOddsNumber(trade)
  if (odds != null) return formatAmericanOdds(odds)
  return `${Math.round(trade.priceCents)}c`
}

const buildRecentFlowBars = (
  trades: WhaleTrade[],
  limit = 8
): RecentFlowBar[] => {
  const matched = [...trades]
    .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    .slice(-limit)

  if (!matched.length) return []
  const maxNotional = matched.reduce((max, trade) => Math.max(max, trade.notional), 0)
  return matched.map((trade, index) => {
    const currentOdds = resolveTradeOddsNumber(trade)
    const prevOdds = index > 0 ? resolveTradeOddsNumber(matched[index - 1]) : null
    const direction: "up" | "down" | "neutral" =
      currentOdds == null || prevOdds == null
        ? "neutral"
        : currentOdds > prevOdds
          ? "up"
          : currentOdds < prevOdds
            ? "down"
            : "neutral"
    return {
      timestampLabel: formatFlowTime(trade.timestamp),
      notional: formatFlowNotional(trade.notional),
      oddsLabel: resolveTradeOddsShortLabel(trade),
      direction,
      normalizedHeight:
        maxNotional > 0 ? Math.max((trade.notional / maxNotional) * 100, 14) : 14,
    }
  })
}

const getEasternDateKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const year = parts.find((part) => part.type === "year")?.value
  const month = parts.find((part) => part.type === "month")?.value
  const day = parts.find((part) => part.type === "day")?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const loadCachedDayTrades = (dayKey: string) => {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(DAY_CACHE_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as { dayKey?: string; trades?: WhaleTrade[] }
    if (parsed?.dayKey !== dayKey) return []
    return Array.isArray(parsed?.trades) ? parsed.trades : []
  } catch {
    return []
  }
}

const storeCachedDayTrades = (dayKey: string, trades: WhaleTrade[]) => {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(
      DAY_CACHE_STORAGE_KEY,
      JSON.stringify({ dayKey, trades })
    )
  } catch {
    // ignore cache write failures
  }
}

const isTradeForDay = (trade: WhaleTrade, dayKey: string) => {
  const key = getEasternDateKey(trade.timestamp)
  return key === dayKey
}

const getTradeKey = (trade: WhaleTrade) => `${trade.source}:${trade.id}`

const mergeTradesForDay = (dayKey: string, tradeSets: WhaleTrade[][]) => {
  const merged = new Map<string, WhaleTrade>()
  for (const trades of tradeSets) {
    for (const trade of trades) {
      if (!isTradeForDay(trade, dayKey)) continue
      const key = getTradeKey(trade)
      const existing = merged.get(key)
      merged.set(key, existing ? { ...existing, ...trade } : trade)
    }
  }
  return Array.from(merged.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_DAY_CACHE_TRADES)
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

const resolvePhase = (trade: WhaleTrade) => {
  if (!trade.eventDate) return "Pregame"
  const eventTime = parseEventTime(trade.eventDate)
  if (eventTime == null || !Number.isFinite(eventTime)) return "Pregame"
  return eventTime < Date.now() ? "Live" : "Pregame"
}

const resolveOddsLabel = (trade: WhaleTrade) => {
  const currentOdds =
    typeof trade.currentAmericanOdds === "number" && Number.isFinite(trade.currentAmericanOdds)
      ? trade.currentAmericanOdds
      : null
  const baseOdds =
    typeof trade.americanOdds === "number" && Number.isFinite(trade.americanOdds)
      ? trade.americanOdds
      : null
  const chosen = currentOdds ?? baseOdds
  if (chosen == null) return "n/a"
  return formatAmericanOdds(chosen)
}

const resolveGameLabel = (marketTitle: string) =>
  marketTitle.split(/\s*(spread|moneyline|total)/i)[0].trim()

const extractGameKey = (trade: WhaleTrade) => {
  const normalized = trade.marketTitle
    .toLowerCase()
    .replace(/\s*(spread|moneyline|total|over|under|points|yards|touchdowns?|winner|to win).*$/i, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
  return `${normalizeSportLabel(trade.sport)}:${normalized}`
}

const mapRestingOrderbookToTrade = (item: RestingOrderbookItem): WhaleTrade | null => {
  if (item.source !== "kalshi" && item.source !== "polymarket") return null

  const rankedSides = [...(item.sides ?? [])].sort(
    (a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0)
  )
  const liquiditySide =
    item.sharpLiquiditySide ??
    rankedSides.find((side) => side.propSide === item.sharpLeanSide)?.propSide ??
    rankedSides[0]?.propSide ??
    null
  const selectedSide =
    rankedSides.find((side) => side.propSide === liquiditySide) ?? rankedSides[0] ?? null

  const notionalRaw = item.sharpLiquidityNotional ?? selectedSide?.wallNotional ?? 0
  const notional = Number(notionalRaw)
  if (!Number.isFinite(notional) || notional < RESTING_MIN_NOTIONAL) return null

  const priceCentsRaw = selectedSide?.wallPriceCents
  const priceCents =
    typeof priceCentsRaw === "number" && Number.isFinite(priceCentsRaw) ? priceCentsRaw : 50
  const americanOdds =
    typeof item.sharpOrderAmericanOdds === "number" && Number.isFinite(item.sharpOrderAmericanOdds)
      ? item.sharpOrderAmericanOdds
      : typeof selectedSide?.wallAmericanOdds === "number" &&
          Number.isFinite(selectedSide.wallAmericanOdds)
        ? selectedSide.wallAmericanOdds
        : typeof item.sharpLeanAmericanOdds === "number" &&
            Number.isFinite(item.sharpLeanAmericanOdds)
          ? item.sharpLeanAmericanOdds
          : null
  const outcomeSide = liquiditySide ?? item.sharpLeanSide ?? "Resting"
  const outcome =
    item.propLine != null && Number.isFinite(item.propLine)
      ? `${outcomeSide} ${item.propLine}`
      : outcomeSide
  const timestamp = item.updatedAt || new Date().toISOString()
  const marketTitle = item.matchup
    ? `${item.matchup} | ${item.marketTitle}`
    : item.marketTitle

  return {
    id: `resting:${item.id}`,
    source: item.source,
    marketTitle,
    outcome,
    priceCents,
    americanOdds,
    notional,
    contracts: priceCents > 0 ? Math.round(notional / (priceCents / 100)) : Math.round(notional),
    timestamp,
    sport: item.sportLabel,
    eventDate: item.eventDate,
    ticker: item.ticker,
    slug: item.slug,
  }
}

const matchesDateWindow = (timestamp: string, window: DateWindowFilter) => {
  if (window === "all") return true
  if (window === "today") {
    const todayKey = getEasternDateKey(new Date())
    const tradeDayKey = getEasternDateKey(timestamp)
    return Boolean(todayKey && tradeDayKey && todayKey === tradeDayKey)
  }

  const time = Date.parse(timestamp)
  if (!Number.isFinite(time)) return false
  const now = Date.now()
  if (window === "24h") return time >= now - 24 * 60 * 60 * 1000
  return time >= now - 72 * 60 * 60 * 1000
}

export default function SharpDetectorClient() {
  const supabase = useMemo(() => createClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [user, setUser] = useState<any>(null)

  const [feedActivity, setFeedActivity] = useState<FeedActivity>("active")
  const [trades, setTrades] = useState<WhaleTrade[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)
  const [restingTrades, setRestingTrades] = useState<WhaleTrade[]>([])
  const [isRestingRefreshing, setIsRestingRefreshing] = useState(false)
  const [restingError, setRestingError] = useState<string | null>(null)
  const [restingUpdatedAt, setRestingUpdatedAt] = useState<string | null>(null)

  const [feedMode, setFeedMode] = useState<FeedMode>("all")
  const [leagueFilter, setLeagueFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [tradeSort, setTradeSort] = useState<TradeSort>("detected")
  const [matchFilter, setMatchFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<DateWindowFilter>("today")
  const [searchQuery, setSearchQuery] = useState("")
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT)

  const isSignedIn = Boolean(user)
  const hasAccess = Boolean(user && membership?.isActive)

  const fetchTrades = useCallback(async () => {
    if (!hasAccess) return
    const todayKey = getEasternDateKey(new Date())
    if (!todayKey) return
    setIsRefreshing(true)
    try {
      const [liveResult, dailyResult] = await Promise.allSettled([
        fetch(
          `/api/whale-detector?minNotional=${FEED_MIN_NOTIONAL}&limit=${FETCH_LIMIT}`,
          { cache: "no-store" }
        ),
        fetch(
          `/api/whale-trades-daily?date=${todayKey}&minNotional=${FEED_MIN_NOTIONAL}&limit=${DAILY_FETCH_LIMIT}`,
          { cache: "no-store" }
        ),
      ])

      const errors: string[] = []
      let liveTrades: WhaleTrade[] = []
      let dailyTrades: WhaleTrade[] = []

      if (liveResult.status === "fulfilled") {
        if (!liveResult.value.ok) {
          errors.push(`live feed (${liveResult.value.status})`)
        } else {
          const payload = (await liveResult.value.json()) as { trades?: WhaleTrade[] }
          liveTrades = Array.isArray(payload.trades) ? payload.trades : []
        }
      } else {
        errors.push("live feed unavailable")
      }

      if (dailyResult.status === "fulfilled") {
        if (!dailyResult.value.ok) {
          errors.push(`daily store (${dailyResult.value.status})`)
        } else {
          const payload = (await dailyResult.value.json()) as { trades?: WhaleTrade[] }
          dailyTrades = Array.isArray(payload.trades) ? payload.trades : []
        }
      } else {
        errors.push("daily store unavailable")
      }

      setTrades((prev) => {
        const merged = mergeTradesForDay(todayKey, [prev, dailyTrades, liveTrades])
        storeCachedDayTrades(todayKey, merged)
        return merged
      })

      setError(errors.length === 2 ? `Whale feed sync issue: ${errors.join(" | ")}` : null)
      setLastUpdatedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load whale feed.")
    } finally {
      setIsRefreshing(false)
    }
  }, [hasAccess])

  const fetchRestingTrades = useCallback(async () => {
    if (!hasAccess) return
    setIsRestingRefreshing(true)
    try {
      const params = new URLSearchParams({
        sport: "all",
        limit: String(RESTING_LIMIT),
        depth: String(RESTING_DEPTH),
        minSharpNotional: String(RESTING_MIN_NOTIONAL),
        refresh: "1",
        mode: "full",
      })
      const response = await fetch(`/api/prop-orderbooks?${params.toString()}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error(`Resting feed request failed (${response.status})`)
      }

      const payload = (await response.json()) as { items?: RestingOrderbookItem[] }
      const nextItems = Array.isArray(payload.items) ? payload.items : []
      const mapped = nextItems
        .map(mapRestingOrderbookToTrade)
        .filter((trade): trade is WhaleTrade => Boolean(trade))
        .sort((a, b) => {
          const timeDiff = new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          if (timeDiff !== 0) return timeDiff
          return b.notional - a.notional
        })
      setRestingTrades(mapped)
      setRestingError(null)
      setRestingUpdatedAt(new Date().toISOString())
    } catch (err) {
      setRestingError(err instanceof Error ? err.message : "Failed to load resting feed.")
    } finally {
      setIsRestingRefreshing(false)
    }
  }, [hasAccess])

  useEffect(() => {
    let mounted = true
    const loadAuth = async () => {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()
        if (!mounted) return
        setUser(authUser ?? null)
        setMembership(authUser ? getMembershipStatus(authUser.user_metadata) : null)
      } catch {
        if (!mounted) return
        setUser(null)
        setMembership(null)
      } finally {
        if (mounted) setAuthLoading(false)
      }
    }
    loadAuth()
    return () => {
      mounted = false
    }
  }, [supabase])

  useEffect(() => {
    if (!hasAccess || feedActivity !== "active") return
    const todayKey = getEasternDateKey(new Date())
    if (todayKey) {
      const cached = loadCachedDayTrades(todayKey)
      if (cached.length) {
        setTrades(cached)
      }
    }
    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasAccess, feedActivity, fetchTrades])

  useEffect(() => {
    if (!hasAccess || feedActivity !== "resting") return
    fetchRestingTrades()
    const interval = setInterval(fetchRestingTrades, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasAccess, feedActivity, fetchRestingTrades])

  const feedRows = useMemo(
    () => (feedActivity === "active" ? trades : restingTrades),
    [feedActivity, trades, restingTrades]
  )

  const activeErrorMessage = feedActivity === "active" ? error : restingError
  const activeRefreshingState = feedActivity === "active" ? isRefreshing : isRestingRefreshing
  const activeUpdatedAt = feedActivity === "active" ? lastUpdatedAt : restingUpdatedAt

  const leagueOptions = useMemo(() => {
    const detected = Array.from(
      new Set(feedRows.map((trade) => normalizeSportLabel(trade.sport)).filter(Boolean))
    )
    const merged = Array.from(new Set([...DEFAULT_LEAGUE_FILTER_OPTIONS, ...detected])).sort(
      (a, b) => a.localeCompare(b)
    )
    return ["all", ...merged]
  }, [feedRows])

  const preFilteredTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const minDisplayNotional =
      feedActivity === "active" ? FEED_MIN_NOTIONAL : RESTING_MIN_NOTIONAL
    return feedRows.filter((trade) => {
      if (!Number.isFinite(trade.notional) || trade.notional < minDisplayNotional) return false
      const sport = normalizeSportLabel(trade.sport)
      if (leagueFilter !== "all" && sport !== leagueFilter) return false
      if (sourceFilter !== "all" && trade.source !== sourceFilter) return false
      if (!matchesDateWindow(trade.timestamp, dateFilter)) return false
      if (!query) return true
      const haystack = `${trade.marketTitle} ${trade.outcome} ${sport}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [feedRows, feedActivity, leagueFilter, sourceFilter, dateFilter, searchQuery])

  const matchOptions = useMemo(() => {
    const labels = Array.from(new Set(preFilteredTrades.map((trade) => resolveGameLabel(trade.marketTitle))))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return ["all", ...labels]
  }, [preFilteredTrades])

  useEffect(() => {
    if (matchFilter !== "all" && !matchOptions.includes(matchFilter)) {
      setMatchFilter("all")
    }
  }, [matchFilter, matchOptions])

  const withMatchFilter = useMemo(() => {
    if (matchFilter === "all") return preFilteredTrades
    return preFilteredTrades.filter((trade) => resolveGameLabel(trade.marketTitle) === matchFilter)
  }, [preFilteredTrades, matchFilter])

  const hotCountByGame = useMemo(() => {
    const map = new Map<string, number>()
    withMatchFilter.forEach((trade) => {
      const key = extractGameKey(trade)
      map.set(key, (map.get(key) ?? 0) + 1)
    })
    return map
  }, [withMatchFilter])

  const hotGameCount = useMemo(
    () => Array.from(hotCountByGame.values()).filter((count) => count >= 2).length,
    [hotCountByGame]
  )

  const baseVisibleTrades = useMemo(() => {
    if (feedMode === "all") return withMatchFilter
    return withMatchFilter.filter((trade) => (hotCountByGame.get(extractGameKey(trade)) ?? 0) >= 2)
  }, [withMatchFilter, feedMode, hotCountByGame])

  const visibleTrades = useMemo(() => {
    if (tradeSort === "detected") return baseVisibleTrades
    if (tradeSort === "size_desc") {
      return [...baseVisibleTrades].sort((a, b) => {
        const sizeDiff = b.notional - a.notional
        if (sizeDiff !== 0) return sizeDiff
        return Date.parse(b.timestamp) - Date.parse(a.timestamp)
      })
    }
    return [...baseVisibleTrades].sort((a, b) => {
      const roiA =
        typeof a.walletRoiLifetime === "number" && Number.isFinite(a.walletRoiLifetime)
          ? a.walletRoiLifetime
          : 0
      const roiB =
        typeof b.walletRoiLifetime === "number" && Number.isFinite(b.walletRoiLifetime)
          ? b.walletRoiLifetime
          : 0
      const roiDiff = roiB - roiA
      if (roiDiff !== 0) return roiDiff
      const sizeDiff = b.notional - a.notional
      if (sizeDiff !== 0) return sizeDiff
      return Date.parse(b.timestamp) - Date.parse(a.timestamp)
    })
  }, [baseVisibleTrades, tradeSort])

  const recentFlowBarsByGame = useMemo(() => {
    const byGame = new Map<string, WhaleTrade[]>()
    for (const trade of visibleTrades) {
      const key = extractGameKey(trade)
      const group = byGame.get(key)
      if (group) {
        group.push(trade)
      } else {
        byGame.set(key, [trade])
      }
    }
    const barsByGame = new Map<string, RecentFlowBar[]>()
    byGame.forEach((group, key) => {
      barsByGame.set(key, buildRecentFlowBars(group))
    })
    return barsByGame
  }, [visibleTrades])

  useEffect(() => {
    setRenderLimit(INITIAL_RENDER_LIMIT)
  }, [feedActivity, feedMode, leagueFilter, sourceFilter, matchFilter, dateFilter, searchQuery, tradeSort])

  const displayedTrades = useMemo(
    () => visibleTrades.slice(0, renderLimit),
    [visibleTrades, renderLimit]
  )
  const hasMoreTrades = displayedTrades.length < visibleTrades.length

  if (authLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-6xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/60">
            Checking access...
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-black text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-semibold text-white">Sign in to access Whale Feed</h2>
            <p className="mt-2 text-sm text-white/60">
              Live whale trade tape is available to active members.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/auth/login"
                className="rounded-full border border-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-white/60"
              >
                Sign in
              </Link>
              <Link
                href="/pricing"
                className="rounded-full border border-emerald-400/60 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white"
              >
                View plans
              </Link>
            </div>
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
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Upgrade required</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Whale Feed is for members.</h2>
            <p className="mt-2 text-sm text-white/60">
              Upgrade to unlock live whale tape, all-sport filters, and hot game clustering.
            </p>
            <Link
              href="/pricing"
              className="mt-5 inline-flex rounded-full border border-emerald-400/60 px-6 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white"
            >
              Upgrade
            </Link>
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader />

      <div className="mx-auto w-full max-w-6xl px-3 pb-[108px] pt-20 sm:px-4 sm:pb-8">
        <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex overflow-hidden rounded-lg border border-white/15 bg-black/40">
              <button
                type="button"
                onClick={() => setFeedActivity("active")}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  feedActivity === "active"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-white/75 hover:bg-white/5"
                )}
              >
                Active Feed
              </button>
              <button
                type="button"
                onClick={() => setFeedActivity("resting")}
                className={cn(
                  "border-l border-white/10 px-3 py-1.5 text-xs transition-colors",
                  feedActivity === "resting"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-white/75 hover:bg-white/5"
                )}
              >
                Resting Feed
              </button>
            </div>

            <div className="inline-flex overflow-hidden rounded-lg border border-white/15 bg-black/40">
              <button
                type="button"
                onClick={() => setFeedMode("all")}
                className={cn(
                  "px-3 py-1.5 text-xs transition-colors",
                  feedMode === "all"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-white/75 hover:bg-white/5"
                )}
              >
                Regular Feed
              </button>
              <button
                type="button"
                onClick={() => setFeedMode("hot")}
                className={cn(
                  "border-l border-white/10 px-3 py-1.5 text-xs transition-colors",
                  feedMode === "hot"
                    ? "bg-emerald-500/20 text-emerald-200"
                    : "text-white/75 hover:bg-white/5"
                )}
              >
                Hot Games
              </button>
            </div>

            <select
              value={leagueFilter}
              onChange={(event) => setLeagueFilter(event.target.value)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              {leagueOptions.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "League: All" : `League: ${value}`}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value as SourceFilter)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              <option value="all">Source: All</option>
              <option value="kalshi">Source: Kalshi</option>
              <option value="polymarket">Source: Polymarket</option>
            </select>

            <select
              value={matchFilter}
              onChange={(event) => setMatchFilter(event.target.value)}
              className="max-w-[220px] rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              {matchOptions.map((value) => (
                <option key={value} value={value}>
                  {value === "all" ? "Match: All" : value}
                </option>
              ))}
            </select>

            <select
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value as DateWindowFilter)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              <option value="today">Date: Today</option>
              <option value="24h">Date: 24h</option>
              <option value="3d">Date: 3d</option>
              <option value="all">Date: All</option>
            </select>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search teams or markets..."
              className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-300/60 focus:outline-none"
            />

            <button
              type="button"
              onClick={() => {
                if (feedActivity === "active") {
                  void fetchTrades()
                } else {
                  void fetchRestingTrades()
                }
              }}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-emerald-300/60"
            >
              Refresh
            </button>

            <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
              <span
                className={cn(
                  "h-2 w-2 rounded-full",
                  activeRefreshingState ? "bg-amber-300" : "bg-emerald-300"
                )}
              />
              <span>live</span>
              <span>|</span>
              <span>
                {displayedTrades.length}
                {hasMoreTrades ? `/${visibleTrades.length}` : ""} rows
              </span>
              <span>|</span>
              <span>{hotGameCount} hot</span>
              {activeUpdatedAt && (
                <>
                  <span>|</span>
                  <span>{formatShortDateTime(activeUpdatedAt)}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {activeErrorMessage ? (
            <div className="px-4 py-6 text-sm text-rose-200">{activeErrorMessage}</div>
          ) : visibleTrades.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">
              {feedActivity === "active"
                ? "No whale prints match the current filters."
                : "No resting orders match the current filters."}
            </div>
          ) : (
            <>
              <div className="max-h-[68vh] divide-y divide-white/5 overflow-y-auto sm:hidden">
                {displayedTrades.map((trade) => {
                  const hotCount = hotCountByGame.get(extractGameKey(trade)) ?? 0
                  return (
                    <article
                      key={trade.id}
                      className="space-y-3 px-3 py-3 text-xs text-white/70 transition-colors hover:bg-white/[0.03]"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                            {trade.source === "kalshi" ? "Kalshi" : "Polymarket"} |{" "}
                            {formatShortDateTime(trade.timestamp)}
                          </div>
                          <div className="text-left text-sm font-semibold text-white">
                            {resolveGameLabel(trade.marketTitle)}
                          </div>
                        </div>
                        <span className="rounded-md border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                          {formatCurrency(trade.notional)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Bet</div>
                          <div className="mt-1 text-white">{trade.outcome || "n/a"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Odds</div>
                          <div className="mt-1 text-white">{resolveOddsLabel(trade)}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">ROI %</div>
                          <div className="mt-1 text-white">
                            {formatRoiPercent(trade.walletRoiLifetime)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Sport</div>
                          <div className="mt-1 text-white">{normalizeSportLabel(trade.sport) || "SPORTS"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Hot</div>
                          <div className="mt-1 text-white">{hotCount >= 2 ? `${hotCount} bets` : "--"}</div>
                        </div>
                      </div>

                      <div className="flex justify-end">
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
                            roiLifetime: trade.walletRoiLifetime,
                            recentFlowBars: recentFlowBarsByGame.get(extractGameKey(trade)) ?? [],
                          }}
                          matchupLabel={resolveGameLabel(trade.marketTitle)}
                        />
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="hidden sm:block">
                <div className="max-h-[72vh] overflow-auto">
                  <Table className="min-w-[1320px] text-[13px] text-white/75">
                    <TableHeader className="bg-black/70">
                      <TableRow className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        <TableHead className="w-[120px]">
                          <button
                            type="button"
                            onClick={() =>
                              setTradeSort((prev) =>
                                prev === "size_desc" ? "detected" : "size_desc"
                              )
                            }
                            className="inline-flex items-center gap-1 text-left hover:text-white"
                            aria-label="Toggle size sort"
                            title={
                              tradeSort === "size_desc"
                                ? "Sorted by size (largest first). Click to return to detected order."
                                : "Sort by size (largest first)"
                            }
                          >
                            <span>Size</span>
                            <span className="text-[11px]">
                              {tradeSort === "size_desc" ? "v" : ""}
                            </span>
                          </button>
                        </TableHead>
                        <TableHead className="w-[90px]">
                          <button
                            type="button"
                            onClick={() =>
                              setTradeSort((prev) =>
                                prev === "roi_desc" ? "detected" : "roi_desc"
                              )
                            }
                            className="inline-flex items-center gap-1 text-left hover:text-white"
                            aria-label="Toggle ROI sort"
                            title={
                              tradeSort === "roi_desc"
                                ? "Sorted by ROI (highest first). Click to return to detected order."
                                : "Sort by ROI (highest first)"
                            }
                          >
                            <span>ROI %</span>
                            <span className="text-[11px]">
                              {tradeSort === "roi_desc" ? "v" : ""}
                            </span>
                          </button>
                        </TableHead>
                        <TableHead className="w-[240px]">Game</TableHead>
                        <TableHead className="w-[220px]">Bet</TableHead>
                        <TableHead className="w-[110px]">Source</TableHead>
                        <TableHead className="w-[90px]">Sport</TableHead>
                        <TableHead className="w-[90px]">Phase</TableHead>
                        <TableHead className="w-[90px]">Odds</TableHead>
                        <TableHead className="w-[170px]">Detected</TableHead>
                        <TableHead className="w-[110px]">Hot Game</TableHead>
                        <TableHead className="w-[120px] text-right">Share</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-white/5">
                      {displayedTrades.map((trade) => {
                        const hotCount = hotCountByGame.get(extractGameKey(trade)) ?? 0
                        return (
                          <TableRow key={trade.id} className="border-white/5 transition-colors hover:bg-white/[0.03]">
                            <TableCell className="align-top">
                              <div className="font-semibold text-emerald-200">
                                {formatCurrency(trade.notional)}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div
                                className={cn(
                                  "font-semibold",
                                  Number.isFinite(trade.walletRoiLifetime)
                                    ? "text-emerald-200"
                                    : "text-white/35"
                                )}
                              >
                                {formatRoiPercent(trade.walletRoiLifetime)}
                              </div>
                            </TableCell>
                            <TableCell className="align-top">
                              <div className="text-sm font-semibold text-white">
                                {resolveGameLabel(trade.marketTitle)}
                              </div>
                              <div className="mt-1 text-[11px] text-white/45">{trade.marketTitle}</div>
                            </TableCell>
                            <TableCell className="align-top text-white/85">{trade.outcome || "n/a"}</TableCell>
                            <TableCell className="align-top">
                              <span
                                className={cn(
                                  "rounded-md border px-2 py-1 text-xs font-semibold",
                                  trade.source === "kalshi"
                                    ? "border-cyan-400/40 bg-cyan-500/10 text-cyan-200"
                                    : "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-200"
                                )}
                              >
                                {trade.source === "kalshi" ? "Kalshi" : "Polymarket"}
                              </span>
                            </TableCell>
                            <TableCell className="align-top">{normalizeSportLabel(trade.sport) || "SPORTS"}</TableCell>
                            <TableCell className="align-top">{resolvePhase(trade)}</TableCell>
                            <TableCell className="align-top">{resolveOddsLabel(trade)}</TableCell>
                            <TableCell className="align-top">{formatShortDateTime(trade.timestamp)}</TableCell>
                            <TableCell className="align-top">
                              {hotCount >= 2 ? (
                                <span className="rounded-md border border-emerald-400/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-200">
                                  {hotCount} bets
                                </span>
                              ) : (
                                <span className="text-white/35">--</span>
                              )}
                            </TableCell>
                            <TableCell className="align-top text-right">
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
                                  roiLifetime: trade.walletRoiLifetime,
                                  recentFlowBars: recentFlowBarsByGame.get(extractGameKey(trade)) ?? [],
                                }}
                                matchupLabel={resolveGameLabel(trade.marketTitle)}
                              />
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {hasMoreTrades && (
                <div className="border-t border-white/10 px-3 py-3 text-center">
                  <button
                    type="button"
                    onClick={() => setRenderLimit((prev) => prev + RENDER_PAGE_SIZE)}
                    className="rounded-lg border border-white/20 px-4 py-1.5 text-xs text-white/80 transition-colors hover:border-emerald-300/60"
                  >
                    Show more ({visibleTrades.length - displayedTrades.length} remaining)
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <MobileToolsNav />
    </div>
  )
}
