"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Activity, Clock3, LineChart, RefreshCw, Trophy, Wallet } from 'lucide-react'
import { SimpleHeader } from '@/components/ui/simple-header'
import MobileToolsNav from '@/components/mobile-tools-nav'
import { createClient } from '@/lib/supabase/client'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import { formatAmericanOdds, formatCurrency } from '@/lib/utils/odds'
import { getWalletAlias } from '@/lib/utils/wallet-alias'
import { cn } from '@/lib/utils'

type BettorLeaderboardRow = {
  rank: number
  wallet: string
  display_name: string | null
  risk_adjusted_score: number
  total_realized_pnl: number
  roi_lifetime: number
  settled_markets: number
  open_positions_count: number
  open_notional: number
}

type BettorFeedTrade = {
  id: string
  wallet: string
  display_name: string | null
  side: 'BUY' | 'SELL'
  size: number | null
  price: number | null
  implied_probability: number | null
  entry_american_odds: number | null
  stake_usd: number | null
  notional: number | null
  trade_time: string
  sport: string
  slug: string
  title: string | null
  outcome: string | null
  risk_adjusted_score: number
  total_realized_pnl: number
  roi_lifetime: number
}

type BettorFeedResponse = {
  trades?: BettorFeedTrade[]
  next_cursor?: number | null
  has_more?: boolean
}

type BettorSummary = {
  wallet: string
  total_realized_pnl: number
  roi_lifetime: number
  risk_adjusted_score: number
  settled_markets: number
  open_positions_count: number
  open_notional: number
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

type BettorPositionsResponse = {
  wallet: string
  display_name?: string | null
  summary?: BettorSummary | null
  positions?: BettorPosition[]
}

const POLL_INTERVAL_MS = 30000
const FEED_LIMIT = 40

const formatTimestamp = (value?: string | null) => {
  if (!value) return 'N/A'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const formatDisplayName = (wallet: string, displayName?: string | null) =>
  displayName ?? getWalletAlias(wallet)

const normalizeWallet = (value?: string | null) => {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

export default function SharpDetectorPage() {
  const supabase = useMemo(() => createClient(), [])

  const [authLoading, setAuthLoading] = useState(true)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [user, setUser] = useState<any>(null)

  const [leaderboard, setLeaderboard] = useState<BettorLeaderboardRow[]>([])
  const [feedRows, setFeedRows] = useState<BettorFeedTrade[]>([])
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null)
  const [selectedWalletLabel, setSelectedWalletLabel] = useState<string | null>(null)
  const [positions, setPositions] = useState<BettorPosition[]>([])
  const [walletSummary, setWalletSummary] = useState<BettorSummary | null>(null)

  const [sportFilter, setSportFilter] = useState<string>('all')
  const [walletFilter, setWalletFilter] = useState<string>('all')
  const [nextCursor, setNextCursor] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null)

  const [leaderboardLoading, setLeaderboardLoading] = useState(false)
  const [feedLoading, setFeedLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [positionsLoading, setPositionsLoading] = useState(false)

  const [feedError, setFeedError] = useState<string | null>(null)
  const [leaderboardError, setLeaderboardError] = useState<string | null>(null)
  const [positionsError, setPositionsError] = useState<string | null>(null)

  const isSignedIn = Boolean(user)
  const hasAccess = Boolean(user && membership?.hasResearchAccess)

  const sportOptions = useMemo(() => {
    const uniqueSports = Array.from(new Set(feedRows.map((row) => row.sport).filter(Boolean)))
    return ['all', ...uniqueSports.sort((a, b) => a.localeCompare(b))]
  }, [feedRows])

  const mergedPnl = useMemo(
    () => leaderboard.reduce((sum, row) => sum + Number(row.total_realized_pnl ?? 0), 0),
    [leaderboard]
  )

  const mergedOpenExposure = useMemo(
    () => leaderboard.reduce((sum, row) => sum + Number(row.open_notional ?? 0), 0),
    [leaderboard]
  )

  const fetchLeaderboard = useCallback(async () => {
    if (!hasAccess) return
    setLeaderboardLoading(true)
    setLeaderboardError(null)

    try {
      const response = await fetch('/api/polymarket/bettors/leaderboard?limit=30', {
        cache: 'no-store',
      })
      if (!response.ok) {
        throw new Error(`Leaderboard request failed (${response.status})`)
      }
      const payload = (await response.json()) as { bettors?: BettorLeaderboardRow[] }
      const rows = Array.isArray(payload.bettors) ? payload.bettors : []
      setLeaderboard(rows)

      if (!selectedWallet && rows.length > 0) {
        const firstWallet = rows[0].wallet
        setSelectedWallet(firstWallet)
        setSelectedWalletLabel(formatDisplayName(firstWallet, rows[0].display_name))
      }
    } catch (error) {
      setLeaderboardError(error instanceof Error ? error.message : 'Failed to load leaderboard.')
    } finally {
      setLeaderboardLoading(false)
    }
  }, [hasAccess, selectedWallet])

  const fetchFeed = useCallback(
    async ({
      append = false,
      cursor,
    }: {
      append?: boolean
      cursor?: number | null
    } = {}) => {
      if (!hasAccess) return

      if (append) {
        setLoadingMore(true)
      } else {
        setFeedLoading(true)
        setFeedError(null)
      }

      try {
        const params = new URLSearchParams()
        params.set('limit', String(FEED_LIMIT))
        if (sportFilter !== 'all') {
          params.set('sport', sportFilter)
        }
        const wallet = walletFilter === 'all' ? null : normalizeWallet(walletFilter)
        if (wallet) {
          params.set('wallet', wallet)
        }
        if (append && cursor != null) {
          params.set('cursor', String(cursor))
        }

        const response = await fetch(`/api/polymarket/bettors/feed?${params.toString()}`, {
          cache: 'no-store',
        })
        if (!response.ok) {
          throw new Error(`Feed request failed (${response.status})`)
        }

        const payload = (await response.json()) as BettorFeedResponse
        const rows = Array.isArray(payload.trades) ? payload.trades : []
        const nextCursorValue = Number.isFinite(payload.next_cursor)
          ? Number(payload.next_cursor)
          : null

        setFeedRows((prev) => {
          if (!append) return rows
          const merged = new Map<string, BettorFeedTrade>()
          prev.forEach((row) => merged.set(row.id, row))
          rows.forEach((row) => merged.set(row.id, row))
          return Array.from(merged.values()).sort(
            (a, b) => new Date(b.trade_time).getTime() - new Date(a.trade_time).getTime()
          )
        })
        setNextCursor(nextCursorValue)
        setHasMore(Boolean(payload.has_more))
        setLastRefreshedAt(new Date().toISOString())
      } catch (error) {
        setFeedError(error instanceof Error ? error.message : 'Failed to load bettor feed.')
      } finally {
        setFeedLoading(false)
        setLoadingMore(false)
      }
    },
    [hasAccess, sportFilter, walletFilter]
  )

  const fetchPositions = useCallback(
    async (wallet: string) => {
      if (!hasAccess) return
      const normalized = normalizeWallet(wallet)
      if (!normalized) return

      setPositionsLoading(true)
      setPositionsError(null)
      setWalletSummary(null)

      try {
        const response = await fetch(
          `/api/polymarket/bettors/${encodeURIComponent(normalized)}/positions?limit=100`,
          { cache: 'no-store' }
        )
        if (!response.ok) {
          throw new Error(`Position request failed (${response.status})`)
        }
        const payload = (await response.json()) as BettorPositionsResponse
        setPositions(Array.isArray(payload.positions) ? payload.positions : [])
        setWalletSummary(payload.summary ?? null)
        setSelectedWalletLabel(formatDisplayName(normalized, payload.display_name))
      } catch (error) {
        setPositionsError(error instanceof Error ? error.message : 'Failed to load positions.')
        setPositions([])
      } finally {
        setPositionsLoading(false)
      }
    },
    [hasAccess]
  )

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
      } catch (error) {
        if (!mounted) return
        console.error('[sharp-detector] auth failed', error)
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
    fetchLeaderboard()
    fetchFeed()
    const interval = setInterval(() => {
      fetchLeaderboard()
      fetchFeed()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [hasAccess, fetchFeed, fetchLeaderboard])

  useEffect(() => {
    if (!hasAccess) return
    if (!selectedWallet) return
    fetchPositions(selectedWallet)
  }, [hasAccess, selectedWallet, fetchPositions])

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#070b10] text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-7xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 px-6 py-8 text-sm text-white/70">
            Checking access...
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#070b10] text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <h2 className="text-2xl font-semibold text-white">Sign in to access Sharp Detector</h2>
            <p className="mt-2 text-sm text-white/60">
              The pro bettor intelligence feed is available to signed-in Syndicate members.
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full border border-white/30 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white hover:border-white/60"
              >
                Sign in
              </Link>
              <Link
                href="/checkout"
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
      <div className="min-h-screen bg-[#070b10] text-white">
        <SimpleHeader />
        <div className="mx-auto max-w-4xl px-4 pb-[108px] pt-20 sm:pb-8">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
            <div className="pointer-events-none absolute -left-20 -top-20 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-16 -right-16 h-56 w-56 rounded-full bg-emerald-400/10 blur-3xl" />
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Syndicate only</p>
            <h2 className="mt-3 text-2xl font-semibold text-white">Pro Bettor Feed Locked</h2>
            <p className="mx-auto mt-2 max-w-xl text-sm text-white/65">
              Sharp Detector now tracks qualified profitable Polymarket sports bettors, their fills,
              and open position exposure. Upgrade to Syndicate to unlock it.
            </p>
            <Link
              href="/checkout"
              className="mt-6 inline-flex rounded-full border border-emerald-400/60 px-6 py-2.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white"
            >
              Start your trial
            </Link>
          </div>
        </div>
        <MobileToolsNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#070b10] text-white">
      <SimpleHeader />
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[8%] top-[14%] h-64 w-64 rounded-full bg-cyan-500/12 blur-3xl" />
        <div className="absolute right-[10%] top-[24%] h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute bottom-[8%] left-[28%] h-96 w-96 rounded-full bg-sky-600/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 pb-[108px] pt-20 sm:pb-8">
        <div className="mb-5 rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-slate-900/70 to-emerald-500/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/70">Sharp Detector</p>
              <h1 className="mt-2 text-2xl font-semibold text-white md:text-3xl">
                Pro Bettors Only Intelligence Feed
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-white/70">
                Track qualified profitable Polymarket sports bettors, every fill they make, and
                their current open position exposure. Aggregate KPIs are realized P/L only.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={sportFilter}
                onChange={(event) => setSportFilter(event.target.value)}
                className="rounded-xl border border-white/15 bg-[#04070c] px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/80 focus:border-cyan-300/50 focus:outline-none"
              >
                {sportOptions.map((sport) => (
                  <option key={sport} value={sport}>
                    {sport === 'all' ? 'All Sports' : sport}
                  </option>
                ))}
              </select>
              <select
                value={walletFilter}
                onChange={(event) => {
                  const nextWallet = event.target.value
                  setWalletFilter(nextWallet)
                  if (nextWallet !== 'all') {
                    setSelectedWallet(nextWallet)
                  }
                }}
                className="rounded-xl border border-white/15 bg-[#04070c] px-3 py-2 text-xs uppercase tracking-[0.16em] text-white/80 focus:border-cyan-300/50 focus:outline-none"
              >
                <option value="all">All Bettors</option>
                {leaderboard.map((bettor) => (
                  <option key={bettor.wallet} value={bettor.wallet}>
                    {formatDisplayName(bettor.wallet, bettor.display_name)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  fetchLeaderboard()
                  fetchFeed()
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300/40 px-3 py-2 text-xs uppercase tracking-[0.16em] text-cyan-100 hover:border-cyan-200"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', feedLoading && 'animate-spin')} />
                Refresh
              </button>
            </div>
          </div>
          <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-white/45">
            Last refresh: {formatTimestamp(lastRefreshedAt)}
          </p>
        </div>

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Qualified Bettors</p>
            <p className="mt-2 text-2xl font-semibold text-cyan-200">{leaderboard.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Realized P/L (Shown)</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-300">{formatCurrency(mergedPnl)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Open Exposure</p>
            <p className="mt-2 text-2xl font-semibold text-white">{formatCurrency(mergedOpenExposure)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">Recent Tape Prints</p>
            <p className="mt-2 text-2xl font-semibold text-sky-200">{feedRows.length}</p>
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <section className="rounded-3xl border border-white/10 bg-black/30 p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Pro Bettor Tape
              </h2>
              {feedError && <p className="text-xs text-rose-300">{feedError}</p>}
            </div>

            {feedLoading && feedRows.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-center text-sm text-white/60">
                Loading bettor feed...
              </div>
            )}

            {!feedLoading && feedRows.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-black/35 p-6 text-center">
                <p className="text-sm text-white/70">No qualified bettor prints right now.</p>
                <p className="mt-1 text-xs text-white/45">
                  This feed only includes sports trades from qualified profitable bettors.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {feedRows.map((trade, index) => {
                const displayName = formatDisplayName(trade.wallet, trade.display_name)
                const entryOdds =
                  trade.entry_american_odds != null ? formatAmericanOdds(trade.entry_american_odds) : 'n/a'
                const stake = trade.stake_usd ?? trade.notional ?? 0
                const sideClass =
                  trade.side === 'SELL'
                    ? 'border-rose-400/40 bg-rose-500/15 text-rose-200'
                    : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'

                return (
                  <motion.article
                    key={`${trade.id}-${trade.wallet}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index < 8 ? index * 0.02 : 0 }}
                    className="rounded-2xl border border-white/10 bg-gradient-to-r from-white/[0.04] to-transparent p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.17em] text-white/45">{trade.sport}</p>
                        <h3 className="mt-1 text-sm font-semibold text-white">
                          {trade.title ?? trade.slug}
                        </h3>
                        <p className="mt-0.5 text-xs text-white/65">
                          {displayName} | {trade.outcome ?? 'Outcome'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Realized P/L</p>
                        <p className="text-sm font-semibold text-emerald-300">
                          {formatCurrency(trade.total_realized_pnl)}
                        </p>
                        <p className="text-[10px] text-white/45">
                          ROI {(Number(trade.roi_lifetime ?? 0) * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn('rounded-full border px-2.5 py-1 font-semibold uppercase tracking-[0.16em]', sideClass)}>
                        {trade.side}
                      </span>
                      <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">
                        Stake {formatCurrency(stake)}
                      </span>
                      <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">
                        Entry {entryOdds}
                      </span>
                      <span className="rounded-full border border-white/15 px-2.5 py-1 text-white/80">
                        Score {Math.round(trade.risk_adjusted_score)}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                      <p className="inline-flex items-center gap-1.5 text-[11px] text-white/50">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatTimestamp(trade.trade_time)}
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedWallet(trade.wallet)
                          setSelectedWalletLabel(displayName)
                        }}
                        className="rounded-full border border-cyan-300/35 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 hover:border-cyan-200"
                      >
                        View Positions
                      </button>
                    </div>
                  </motion.article>
                )
              })}
            </div>

            {hasMore && (
              <div className="mt-4 flex justify-center">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => fetchFeed({ append: true, cursor: nextCursor })}
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/80 hover:border-white/50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loadingMore && 'animate-spin')} />
                  {loadingMore ? 'Loading' : 'Load more'}
                </button>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  <Trophy className="h-4 w-4" />
                  Leaderboard
                </h2>
                {leaderboardLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-white/55" />}
              </div>
              {leaderboardError && <p className="mb-2 text-xs text-rose-300">{leaderboardError}</p>}
              <div className="space-y-2">
                {leaderboard.map((bettor) => {
                  const isSelected =
                    selectedWallet != null &&
                    normalizeWallet(selectedWallet) === normalizeWallet(bettor.wallet)
                  const name = formatDisplayName(bettor.wallet, bettor.display_name)

                  return (
                    <button
                      key={bettor.wallet}
                      type="button"
                      onClick={() => {
                        setSelectedWallet(bettor.wallet)
                        setSelectedWalletLabel(name)
                      }}
                      className={cn(
                        'w-full rounded-2xl border p-3 text-left transition',
                        isSelected
                          ? 'border-cyan-300/55 bg-cyan-500/10'
                          : 'border-white/10 bg-white/[0.03] hover:border-white/30'
                      )}
                    >
                      <p className="text-xs text-white/65">#{bettor.rank} {name}</p>
                      <p className="mt-1 text-sm font-semibold text-emerald-300">
                        {formatCurrency(bettor.total_realized_pnl)}
                      </p>
                      <p className="mt-1 text-[10px] text-white/45">
                        Score {Math.round(bettor.risk_adjusted_score)} | ROI {(bettor.roi_lifetime * 100).toFixed(1)}% | Settled {bettor.settled_markets}
                      </p>
                    </button>
                  )
                })}
                {!leaderboardLoading && leaderboard.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-white/55">
                    No qualified bettors are available yet.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-black/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-200">
                  <Wallet className="h-4 w-4" />
                  Open Positions
                </h2>
                {positionsLoading && <RefreshCw className="h-3.5 w-3.5 animate-spin text-white/55" />}
              </div>

              <p className="text-xs text-white/55">
                {selectedWalletLabel ?? (selectedWallet ? getWalletAlias(selectedWallet) : 'Select a bettor')}
              </p>

              {walletSummary && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-[11px] text-white/70">
                  <p className="inline-flex items-center gap-1.5 text-cyan-100">
                    <LineChart className="h-3.5 w-3.5" />
                    Score {Math.round(walletSummary.risk_adjusted_score ?? 0)} | Settled {walletSummary.settled_markets}
                  </p>
                  <p className="mt-1 text-emerald-300">
                    Realized P/L {formatCurrency(walletSummary.total_realized_pnl ?? 0)}
                  </p>
                  <p className="mt-1 text-white/60">
                    Open Exposure {formatCurrency(walletSummary.open_notional ?? 0)} across {walletSummary.open_positions_count ?? 0} positions
                  </p>
                </div>
              )}

              {positionsError && <p className="mt-3 text-xs text-rose-300">{positionsError}</p>}

              <div className="mt-3 space-y-2">
                {positions.map((position) => (
                  <div
                    key={`${position.slug}:${position.outcome}`}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"
                  >
                    <p className="text-sm font-medium text-white">{position.title ?? position.slug}</p>
                    <p className="mt-0.5 text-[11px] text-white/55">
                      {(position.sport ?? 'SPORTS').toUpperCase()} | {position.outcome ?? 'Outcome'}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-white/75">
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        Shares {position.net_shares.toFixed(2)}
                      </span>
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        Stake {formatCurrency(position.stake_usd)}
                      </span>
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        Payout {formatCurrency(position.potential_payout_usd)}
                      </span>
                      <span className="rounded-full border border-white/15 px-2 py-0.5">
                        Entry {position.avg_entry_american_odds != null ? formatAmericanOdds(position.avg_entry_american_odds) : 'n/a'}
                      </span>
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-[10px] text-white/45">
                      <Activity className="h-3 w-3" />
                      Updated {formatTimestamp(position.last_trade_time)}
                    </p>
                  </div>
                ))}
                {!positionsLoading && positions.length === 0 && (
                  <p className="rounded-xl border border-white/10 bg-black/35 p-3 text-xs text-white/55">
                    No open sports positions for this bettor.
                  </p>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
