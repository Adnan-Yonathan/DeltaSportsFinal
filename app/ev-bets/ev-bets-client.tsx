'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Zap, TrendingUp, Filter } from 'lucide-react'
import BookSelector, { useBookSelection, type BookKey } from '@/components/BookSelector'
import type { PinnacleEVOpportunity } from '@/lib/services/pinnacle-ev'

const REFRESH_MS = 300000 // 5 minutes

const SPORT_OPTIONS = [
  { key: 'all', label: 'All Sports' },
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'basketball_ncaab', label: 'NCAAB' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'icehockey_nhl', label: 'NHL' },
]

const MIN_EV_OPTIONS = [
  { value: 2, label: '2%+' },
  { value: 3, label: '3%+' },
  { value: 5, label: '5%+' },
]

const MARKET_OPTIONS = [
  { key: 'all', label: 'All Markets' },
  { key: 'h2h', label: 'Moneyline' },
  { key: 'spreads', label: 'Spread' },
  { key: 'totals', label: 'Total' },
]

const EV_BETS_DEFAULT_BOOKS: BookKey[] = [
  'fanduel',
  'betmgm',
  'bet365',
  'draftkings',
]

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`
}

const formatMarketLabel = (market: string) => {
  if (market === 'h2h') return 'Moneyline'
  if (market === 'spreads') return 'Spread'
  if (market === 'totals') return 'Total'
  return market
}

const formatGameTime = (commenceTime: string) => {
  try {
    const date = new Date(commenceTime)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

const getSportLabel = (sportKey: string) => {
  const sport = SPORT_OPTIONS.find((s) => s.key === sportKey)
  return sport?.label ?? sportKey.toUpperCase()
}

export default function EVBetsClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [opportunities, setOpportunities] = useState<PinnacleEVOpportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('all')
  const [selectedMarket, setSelectedMarket] = useState('all')
  const [minEV, setMinEV] = useState(3)
  const [now, setNow] = useState(Date.now())
  const lastFetchedRef = useRef(0)

  const { selectedBooks, setSelectedBooks, isHydrated } = useBookSelection()

  const hasInitializedBooks = useRef(false)

  useEffect(() => {
    if (!isHydrated || hasInitializedBooks.current) return
    setSelectedBooks(EV_BETS_DEFAULT_BOOKS)
    hasInitializedBooks.current = true
  }, [isHydrated, setSelectedBooks])

  const fetchEVOpportunities = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('/api/ev-bets', window.location.origin)
      url.searchParams.set('minEV', String(minEV))
      if (selectedSport !== 'all') {
        url.searchParams.set('sport', selectedSport)
      }
      if (selectedMarket !== 'all') {
        url.searchParams.set('market', selectedMarket)
      }
      if (selectedBooks.length > 0) {
        url.searchParams.set('books', selectedBooks.join(','))
      }

      const res = await fetch(url.toString(), { cache: 'no-store' })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to load EV opportunities')
      }

      const payload = await res.json()
      setOpportunities(Array.isArray(payload.data) ? payload.data : [])
      setLastUpdated(new Date().toISOString())
      lastFetchedRef.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load EV opportunities')
      setOpportunities([])
    } finally {
      setLoading(false)
    }
  }, [minEV, selectedSport, selectedMarket, selectedBooks])

  useEffect(() => {
    if (isHydrated) {
      fetchEVOpportunities()
    }
  }, [fetchEVOpportunities, isHydrated])

  useEffect(() => {
    if (!isHydrated) return
    const interval = window.setInterval(fetchEVOpportunities, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchEVOpportunities, isHydrated])

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const remainingSeconds = useMemo(() => {
    if (!lastUpdated) return Math.ceil(REFRESH_MS / 1000)
    const updatedMs = Date.parse(lastUpdated)
    if (!Number.isFinite(updatedMs)) return Math.ceil(REFRESH_MS / 1000)
    return Math.max(0, Math.ceil((updatedMs + REFRESH_MS - now) / 1000))
  }, [lastUpdated, now])

  const sportCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const opp of opportunities) {
      counts[opp.sport] = (counts[opp.sport] || 0) + 1
    }
    return counts
  }, [opportunities])

  const totalCount = opportunities.length
  const visibleOpportunities = previewMode ? opportunities.slice(0, 1) : opportunities

  return (
    <div className="space-y-4">
      {/* Header with Book Selector */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <h2 className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Your Sportsbooks (where you bet)
            </h2>
            {isHydrated && (
              <BookSelector
                selectedBooks={selectedBooks}
                onChange={setSelectedBooks}
                variant="default"
                showLabel={false}
              />
            )}
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-[0.2em] text-white/50">
              Sharp Reference
            </div>
            <div className="mt-1 flex items-center gap-2">
              <span className="rounded-full border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-300">
                PINNACLE
              </span>
              <span className="text-[10px] text-white/40">(cannot be changed)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
        <Filter className="h-4 w-4 text-white/40" />

        {/* Sport Filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {SPORT_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setSelectedSport(option.key)}
              className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition ${
                selectedSport === option.key
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="h-4 w-px bg-white/10" />

        {/* Min EV Filter */}
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">Min EV</span>
        {MIN_EV_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setMinEV(option.value)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition ${
              minEV === option.value
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            }`}
          >
            {option.label}
          </button>
        ))}

        <div className="h-4 w-px bg-white/10" />

        {/* Market Filter */}
        {MARKET_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setSelectedMarket(option.key)}
            className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition ${
              selectedMarket === option.key
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Summary Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-emerald-400" />
          <span className="text-sm font-semibold text-white">
            {totalCount} +EV opportunities
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-white/50">
              across {Object.keys(sportCounts).length} sport{Object.keys(sportCounts).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span className="text-[10px] text-white/40">
          Refresh in {remainingSeconds}s
        </span>
      </div>

      {/* Loading State */}
      {loading && opportunities.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-white/60">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Scanning sportsbooks for +EV opportunities...
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && opportunities.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-white/60">
            No +EV opportunities found with {minEV}%+ EV threshold.
          </p>
          <p className="mt-2 text-xs text-white/40">
            Try lowering the minimum EV or check back when lines move.
          </p>
        </div>
      )}

      {/* Opportunities List */}
      <div className="space-y-3">
        {visibleOpportunities.map((opp, index) => (
          <div
            key={`${opp.gameId}-${opp.market}-${opp.selection}-${opp.betBook}-${index}`}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-colors hover:border-emerald-500/30"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              {/* Left: EV + Selection */}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-1 text-sm font-bold text-emerald-300">
                    +{opp.ev.toFixed(1)}% EV
                  </span>
                  <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-white/50">
                    {getSportLabel(opp.sport)}
                  </span>
                </div>

                <div className="mt-2 text-base font-semibold text-white">
                  {opp.selection}
                  {opp.point != null && (
                    <span className="text-white/70">
                      {' '}
                      {opp.point > 0 ? '+' : ''}{opp.point}
                    </span>
                  )}
                </div>

                <div className="mt-1 text-xs text-white/50">
                  {formatMarketLabel(opp.market)} | {opp.game}
                </div>
              </div>

              {/* Right: Book + Odds */}
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  Best at
                </div>
                <div className="mt-1 text-lg font-semibold text-white">
                  {opp.betBook}{' '}
                  <span className="text-emerald-300">{formatOdds(opp.betOdds)}</span>
                </div>
                <div className="mt-1 text-[10px] text-white/40">
                  Game: {formatGameTime(opp.commenceTime)}
                </div>
              </div>
            </div>

            {/* Pinnacle Comparison */}
            <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/5 bg-black/30 px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="rounded-full border border-amber-400/30 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/80">
                  PIN
                </span>
                <span className="text-xs text-white/60">
                  {formatOdds(opp.pinnacleOdds)}
                </span>
                <span className="text-[10px] text-white/40">
                  ({(opp.pinnacleImpliedProb * 100).toFixed(1)}% true prob)
                </span>
              </div>

              <ArrowRight className="h-3 w-3 text-white/30" />

              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span className="text-xs text-emerald-300">
                  {opp.edge.toFixed(1)}% edge
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      {previewMode && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm space-y-3 px-4 py-6">
            {[1, 2, 3].map((row) => (
              <div
                key={row}
                className="rounded-xl border border-white/10 bg-white/5 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-24 rounded bg-emerald-500/20" />
                    <div className="h-3 w-32 rounded bg-white/10" />
                  </div>
                  <div className="h-6 w-20 rounded bg-white/10" />
                </div>
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Upgrade required
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Upgrade to get full access.
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Unlock every EV opportunity across all books.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">How it works:</strong> We use Pinnacle&apos;s
        odds as the sharp baseline (they have the lowest vig and sharpest lines).
        When other books offer better odds than Pinnacle&apos;s fair price, that&apos;s +EV.
      </div>
    </div>
  )
}
