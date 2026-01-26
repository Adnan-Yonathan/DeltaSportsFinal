'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, Activity } from 'lucide-react'

type MarketSummary = {
  sampleCount: number
  avgAbsMove: number | null
  avgMove: number | null
  movedUpPct: number | null
  movedDownPct: number | null
  sharpMoveRate: number | null
  avgImpliedProbChange?: number | null
  avgImpliedProbChangeAbs?: number | null
}

type LineMove = {
  oddsApiId: string
  marketType: 'spread' | 'total' | 'moneyline'
  homeTeam: string | null
  awayTeam: string | null
  gameTime: string | null
  openingLine: number
  closingLine: number
  delta: number
}

type BettingTrendsResponse = {
  ok: boolean
  updatedAt: string
  sport: string
  days: number
  summary: Record<string, MarketSummary>
  topMoves: LineMove[]
  sampleCount: number
}

const SPORT_OPTIONS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'basketball_ncaab', label: 'NCAAB' },
  { key: 'icehockey_nhl', label: 'NHL' },
]

const formatGameTime = (time: string) => {
  try {
    const date = new Date(time)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

const formatSigned = (value: number) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2))

const formatPercent = (value?: number | null) =>
  value == null ? 'n/a' : `${value.toFixed(1)}%`

const formatDelta = (value: number) => (value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2))

export default function BettingTrendsClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [trends, setTrends] = useState<BettingTrendsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('basketball_nba')
  const days = 30

  const fetchTrends = useCallback(async () => {
    setLoading(true)
    setError(null)
    setTrends(null)
    try {
      const res = await fetch(`/api/betting-trends?sport=${selectedSport}&days=${days}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        throw new Error('Failed to load betting trends')
      }

      const payload = (await res.json()) as BettingTrendsResponse
      setTrends(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load betting trends')
      setTrends(null)
    } finally {
      setLoading(false)
    }
  }, [selectedSport, days])

  useEffect(() => {
    fetchTrends()
  }, [fetchTrends])

  return (
    <div className="space-y-4">
      {/* Sport Filter */}
      <div className="flex flex-wrap items-center gap-2">
        {SPORT_OPTIONS.map((sport) => (
          <button
            key={sport.key}
            type="button"
            onClick={() => setSelectedSport(sport.key)}
            className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
              selectedSport === sport.key
                ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            }`}
          >
            {sport.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-white/60">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Loading betting trends...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && (!trends || trends.sampleCount === 0) && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-white/60">
            No line history found for this sport in the last {days} days.
          </p>
        </div>
      )}

      {trends && trends.sampleCount > 0 && (
        <>
          {/* Summary */}
          <div className="grid gap-3 sm:grid-cols-3">
            {(['spread', 'total', 'moneyline'] as const)
              .slice(0, previewMode ? 1 : undefined)
              .map((market) => {
              const summary = trends.summary?.[market]
              if (!summary) return null
              const Icon = summary.avgMove != null && summary.avgMove > 0 ? TrendingUp : TrendingDown
              return (
                <div
                  key={market}
                  className="rounded-2xl border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
                    <span>{market} trend</span>
                    <Icon className="h-4 w-4 text-amber-300" />
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-white/70">
                    <div className="flex items-center justify-between">
                      <span>Avg move</span>
                      <span className="text-white">
                        {summary.avgMove != null ? formatSigned(summary.avgMove) : 'n/a'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Avg abs move</span>
                      <span className="text-white">
                        {summary.avgAbsMove != null ? summary.avgAbsMove.toFixed(2) : 'n/a'}
                      </span>
                    </div>
                    {market === 'moneyline' ? (
                      <div className="flex items-center justify-between">
                        <span>Avg CLV (implied)</span>
                        <span className="text-white">
                          {summary.avgImpliedProbChangeAbs != null
                            ? formatPercent(summary.avgImpliedProbChangeAbs * 100)
                            : 'n/a'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between">
                        <span>Sharp move rate</span>
                        <span className="text-white">
                          {formatPercent(summary.sharpMoveRate)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="mt-3 text-[10px] uppercase tracking-[0.2em] text-white/40">
                    {summary.sampleCount} samples
                  </div>
                </div>
              )
            })}
          </div>
          {previewMode && (
            <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="pointer-events-none blur-sm grid gap-3 px-4 py-4 sm:grid-cols-2">
                {[1, 2].map((row) => (
                  <div key={row} className="h-28 rounded-xl border border-white/10 bg-white/5" />
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center text-center text-xs uppercase tracking-[0.2em] text-white/70">
                Upgrade for full access
              </div>
            </div>
          )}

          {/* Top movers */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-white/40">
                  Biggest Moves (30d)
                </p>
                <p className="mt-1 text-sm text-white/70">
                  Opening to closing line swings
                </p>
              </div>
              <Activity className="h-4 w-4 text-amber-300" />
            </div>
            <div className="mt-4 space-y-3">
              {(previewMode ? trends.topMoves.slice(0, 1) : trends.topMoves).map((move) => (
                <div
                  key={`${move.oddsApiId}-${move.marketType}`}
                  className="rounded-xl border border-white/10 bg-black/30 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <div className="font-semibold text-white break-words">
                    {move.awayTeam ?? 'Away'} @ {move.homeTeam ?? 'Home'}
                  </div>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/50">
                      {move.marketType}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                    <span>{formatGameTime(move.gameTime ?? '')}</span>
                    <span className="text-white/20">|</span>
                    <span>
                      Open {move.openingLine.toFixed(2)} → Close {move.closingLine.toFixed(2)}
                    </span>
                    <span className="text-white/20">|</span>
                    <span className="text-amber-200">
                      Δ {formatDelta(move.delta)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {previewMode && (
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
              <div className="pointer-events-none blur-sm space-y-3 px-4 py-4">
                {[1, 2, 3].map((row) => (
                  <div key={row} className="h-14 rounded-xl border border-white/10 bg-black/30" />
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
                    Unlock every 30-day trend and movement.
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Info Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">Betting Trends</strong> shows ATS
        movement and closing line shifts using 30 days of line history. Use the
        biggest movers to understand where the market is trending.
      </div>
    </div>
  )
}
