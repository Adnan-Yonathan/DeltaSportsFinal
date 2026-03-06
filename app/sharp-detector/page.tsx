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

type DateWindowFilter = "all" | "today" | "24h" | "3d"
type FeedMode = "all" | "hot"
type SourceFilter = "all" | "kalshi" | "polymarket"

const POLL_INTERVAL_MS = 30000
const MIN_NOTIONAL_OPTIONS = [2000, 5000, 10000, 25000, 50000]
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

const matchesDateWindow = (timestamp: string, window: DateWindowFilter) => {
  if (window === "all") return true
  const time = Date.parse(timestamp)
  if (!Number.isFinite(time)) return false
  const now = Date.now()

  if (window === "24h") return time >= now - 24 * 60 * 60 * 1000
  if (window === "3d") return time >= now - 72 * 60 * 60 * 1000

  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return time >= start.getTime()
}

export default function SharpDetectorPage() {
  const supabase = useMemo(() => createClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [user, setUser] = useState<any>(null)

  const [trades, setTrades] = useState<WhaleTrade[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null)

  const [feedMode, setFeedMode] = useState<FeedMode>("all")
  const [leagueFilter, setLeagueFilter] = useState<string>("all")
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all")
  const [matchFilter, setMatchFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<DateWindowFilter>("24h")
  const [searchQuery, setSearchQuery] = useState("")
  const [minNotional, setMinNotional] = useState<number>(2000)

  const isSignedIn = Boolean(user)
  const hasAccess = Boolean(user && membership?.isActive)

  const fetchTrades = useCallback(async () => {
    if (!hasAccess) return
    setIsRefreshing(true)
    try {
      const response = await fetch(
        `/api/whale-detector?minNotional=${minNotional}&limit=300`,
        { cache: "no-store" }
      )
      if (!response.ok) {
        throw new Error(`Whale feed request failed (${response.status})`)
      }
      const payload = (await response.json()) as { trades?: WhaleTrade[] }
      const nextTrades = Array.isArray(payload.trades) ? payload.trades : []
      const sorted = [...nextTrades].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      setTrades(sorted)
      setError(null)
      setLastUpdatedAt(new Date().toISOString())
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load whale feed.")
    } finally {
      setIsRefreshing(false)
    }
  }, [hasAccess, minNotional])

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
    if (!hasAccess) return
    fetchTrades()
    const interval = setInterval(fetchTrades, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasAccess, fetchTrades])

  const leagueOptions = useMemo(() => {
    const detected = Array.from(
      new Set(trades.map((trade) => normalizeSportLabel(trade.sport)).filter(Boolean))
    )
    const merged = Array.from(new Set([...DEFAULT_LEAGUE_FILTER_OPTIONS, ...detected])).sort(
      (a, b) => a.localeCompare(b)
    )
    return ["all", ...merged]
  }, [trades])

  const preFilteredTrades = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return trades.filter((trade) => {
      const sport = normalizeSportLabel(trade.sport)
      if (leagueFilter !== "all" && sport !== leagueFilter) return false
      if (sourceFilter !== "all" && trade.source !== sourceFilter) return false
      if (!matchesDateWindow(trade.timestamp, dateFilter)) return false
      if (!query) return true
      const haystack = `${trade.marketTitle} ${trade.outcome} ${sport}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [trades, leagueFilter, sourceFilter, dateFilter, searchQuery])

  const matchOptions = useMemo(() => {
    const labels = Array.from(new Set(preFilteredTrades.map((trade) => resolveGameLabel(trade.marketTitle))))
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
    return ["all", ...labels.slice(0, 120)]
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

  const visibleTrades = useMemo(() => {
    if (feedMode === "all") return withMatchFilter
    return withMatchFilter.filter((trade) => (hotCountByGame.get(extractGameKey(trade)) ?? 0) >= 2)
  }, [withMatchFilter, feedMode, hotCountByGame])

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
        <div className="mb-4 rounded-2xl border border-white/10 bg-black/40 p-4">
          <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Whale Feed</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">Live Sharp Trade Tape</h1>
          <p className="mt-1 text-sm text-white/65">
            Streaming bets over {formatCurrency(minNotional)} from Kalshi and Polymarket.
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-white/45">
            Last refresh: {formatShortDateTime(lastUpdatedAt)}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/40 p-2.5">
          <div className="flex flex-wrap items-center gap-2">
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
              value={feedMode}
              onChange={(event) => setFeedMode(event.target.value as FeedMode)}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              <option value="all">Feed: All Prints</option>
              <option value="hot">Feed: Hot Games</option>
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

            <select
              value={String(minNotional)}
              onChange={(event) => setMinNotional(Number(event.target.value))}
              className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white/75 focus:border-emerald-300/60 focus:outline-none"
            >
              {MIN_NOTIONAL_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  Min: {formatCurrency(value)}
                </option>
              ))}
            </select>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search teams or markets..."
              className="min-w-[180px] flex-1 rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder:text-white/35 focus:border-emerald-300/60 focus:outline-none"
            />

            <button
              type="button"
              onClick={fetchTrades}
              className="rounded-lg border border-white/15 bg-black/40 px-3 py-1.5 text-xs text-white/80 transition-colors hover:border-emerald-300/60"
            >
              Refresh
            </button>

            <div className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.16em] text-white/50">
              <span className={cn("h-2 w-2 rounded-full", isRefreshing ? "bg-amber-300" : "bg-emerald-300")} />
              <span>live</span>
              <span>|</span>
              <span>{visibleTrades.length} rows</span>
              <span>|</span>
              <span>{hotGameCount} hot</span>
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          {error ? (
            <div className="px-4 py-6 text-sm text-rose-200">{error}</div>
          ) : visibleTrades.length === 0 ? (
            <div className="px-4 py-6 text-sm text-white/60">
              No whale prints match the current filters.
            </div>
          ) : (
            <>
              <div className="divide-y divide-white/5 sm:hidden">
                {visibleTrades.map((trade) => {
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
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Sport</div>
                          <div className="mt-1 text-white">{normalizeSportLabel(trade.sport) || "SPORTS"}</div>
                        </div>
                        <div className="rounded-lg border border-white/10 bg-black/35 px-2 py-1.5">
                          <div className="text-[10px] uppercase tracking-[0.15em] text-white/40">Hot</div>
                          <div className="mt-1 text-white">{hotCount >= 2 ? `${hotCount} bets` : "--"}</div>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>

              <div className="hidden sm:block">
                <div className="overflow-x-auto">
                  <Table className="min-w-[1180px] text-[13px] text-white/75">
                    <TableHeader className="bg-black/70">
                      <TableRow className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        <TableHead className="w-[120px]">Size</TableHead>
                        <TableHead className="w-[240px]">Game</TableHead>
                        <TableHead className="w-[220px]">Bet</TableHead>
                        <TableHead className="w-[110px]">Source</TableHead>
                        <TableHead className="w-[90px]">Sport</TableHead>
                        <TableHead className="w-[90px]">Phase</TableHead>
                        <TableHead className="w-[90px]">Odds</TableHead>
                        <TableHead className="w-[170px]">Detected</TableHead>
                        <TableHead className="w-[110px]">Hot Game</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-white/5">
                      {visibleTrades.map((trade) => {
                        const hotCount = hotCountByGame.get(extractGameKey(trade)) ?? 0
                        return (
                          <TableRow key={trade.id} className="border-white/5 transition-colors hover:bg-white/[0.03]">
                            <TableCell className="align-top">
                              <div className="font-semibold text-emerald-200">
                                {formatCurrency(trade.notional)}
                              </div>
                              {Number.isFinite(trade.sharpStrength) && (
                                <div className="mt-1 text-[11px] text-white/45">
                                  {Math.round(Number(trade.sharpStrength))}% strength
                                </div>
                              )}
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
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <MobileToolsNav />
    </div>
  )
}
