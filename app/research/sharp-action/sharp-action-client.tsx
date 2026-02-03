'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { TrendingUp, Zap, DollarSign, BarChart3, AlertTriangle } from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { SharpSignal } from '@/lib/services/edge-detection'

type LinePoint = {
  t: string
  value: number
}

type LineSeries = {
  book?: string
  points: LinePoint[]
}

type GameLineHistory = {
  spread?: LineSeries
  total?: LineSeries
  moneyline?: LineSeries
}

type GameSharpAction = {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  sharpSide: string
  sharpMarket: 'spread' | 'moneyline' | 'total' | 'none'
  narrative: string
  sharpSignals: SharpSignal[]
  strongestSignal?: SharpSignal
  lineHistory?: GameLineHistory
  fallbackLines?: {
    spread?: number | null
    total?: number | null
    moneyline?: number | null
  }
}

type SportSection = {
  key: string
  label: string
  updatedAt?: string
  games: GameSharpAction[]
}

const CORE_SPORTS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'basketball_ncaab', label: 'NCAAB' },
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'icehockey_nhl', label: 'NHL' },
]

const getEasternDateString = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [month, day, year] = formatter.format(new Date()).split('/')
  return `${year}-${month}-${day}`
}

const formatGameTime = (time: string) => {
  try {
    const date = new Date(time)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

const formatTooltipTime = (value: string) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

const getSignalIcon = (type: SharpSignal['type']) => {
  switch (type) {
    case 'RLM':
      return TrendingUp
    case 'STEAM':
      return Zap
    case 'SHARP_MONEY':
      return DollarSign
    case 'STALLED':
      return AlertTriangle
    default:
      return BarChart3
  }
}

const formatSignalLabel = (type: SharpSignal['type']) =>
  type === 'SHARP_MONEY' ? 'SHARP MONEY' : type

const getStrengthColor = (strength: number) => {
  if (strength >= 5) return 'text-emerald-300 border-emerald-400/40'
  if (strength >= 4) return 'text-amber-300 border-amber-400/40'
  if (strength >= 3) return 'text-white/70 border-white/20'
  return 'text-white/50 border-white/10'
}

const buildAnalyticalNarrative = (edge: any) => {
  const signals: SharpSignal[] = Array.isArray(edge?.sharpSignals)
    ? edge.sharpSignals
    : []
  const moves = Array.isArray(edge?.lineMovements) ? edge.lineMovements : []
  const parts: string[] = []

  if (signals.length) {
    const strongest = signals.reduce((best, next) =>
      next.strength > best.strength ? next : best
    )
    parts.push(
      `Top signal: ${formatSignalLabel(strongest.type)} on ${strongest.side} (${strongest.strength}/5).`
    )
  } else {
    parts.push('No sharp signals yet; line history shows early positioning.')
  }

  if (moves.length) {
    const highlight = moves.find((move: any) => move.isSharp || move.isSignificant) || moves[0]
    if (highlight?.openingLine != null && highlight?.currentLine != null) {
      parts.push(
        `${highlight.market} moved from ${highlight.openingLine} to ${highlight.currentLine}.`
      )
    }
  }

  if (edge?.spread) {
    const gap = Math.abs(
      Number(edge.spread.targetLine) - Number(edge.spread.marketLine)
    )
    if (Number.isFinite(gap) && gap > 0.4) {
      parts.push(`Model vs market gap: ${gap.toFixed(1)} points.`)
    }
  } else if (edge?.total) {
    const gap = Math.abs(
      Number(edge.total.targetLine) - Number(edge.total.marketLine)
    )
    if (Number.isFinite(gap) && gap > 0.8) {
      parts.push(`Total gap: ${gap.toFixed(1)} points.`)
    }
  }

  return parts.join(' ')
}

const buildConsensusSharpSide = (
  signals: SharpSignal[],
  fallback: { homeTeam: string; awayTeam: string }
): { side: string; market: GameSharpAction['sharpMarket'] } => {
  if (!signals.length) return { side: 'No sharp lean', market: 'none' }

  const scores = new Map<string, number>()
  for (const signal of signals) {
    const key = signal.side
    const weight = signal.strength ?? 0
    scores.set(key, (scores.get(key) ?? 0) + weight)
  }

  const ranked = Array.from(scores.entries()).sort((a, b) => b[1] - a[1])
  if (!ranked.length) return { side: 'No sharp lean', market: 'none' }

  const [topSide, topScore] = ranked[0]
  const secondScore = ranked[1]?.[1]
  if (secondScore != null && secondScore === topScore) {
    return { side: 'Mixed signals', market: 'none' }
  }

  const preferredSignal =
    signals.find((signal) => signal.side === topSide) ||
    signals.find((signal) => signal.side === fallback.homeTeam) ||
    signals.find((signal) => signal.side === fallback.awayTeam)

  return {
    side: topSide,
    market: preferredSignal?.market ?? 'none',
  }
}

const LineMovementChart = ({
  title,
  series,
  color,
  fallbackValue,
}: {
  title: string
  series?: LineSeries
  color?: string
  fallbackValue?: number | null
}) => {
  const rawPoints = series?.points?.length
    ? series.points
    : Number.isFinite(fallbackValue)
      ? [
          {
            t: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
            value: Number(fallbackValue),
          },
          {
            t: new Date().toISOString(),
            value: Number(fallbackValue),
          },
        ]
      : []

  const fallbackUsed = rawPoints.length === 0
  const points = rawPoints.length
    ? rawPoints
    : [
        {
          t: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
          value: 0,
        },
        {
          t: new Date().toISOString(),
          value: 0,
        },
      ]

  const sorted = points
    .slice()
    .sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime())
  const data = sorted.map((point) => ({
    time: point.t,
    value: point.value,
  }))

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>{title}</span>
        <span>{series?.book ? series.book.toUpperCase() : 'Market'}</span>
      </div>
      <div className="mt-3 h-28">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin', 'dataMax']} />
            <Tooltip
              labelFormatter={(label) => formatTooltipTime(label as string)}
              formatter={(value) => [Number(value).toFixed(2), 'Line']}
              contentStyle={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
              itemStyle={{ color: '#f59e0b' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color || '#f59e0b'}
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {fallbackUsed && (
        <div className="mt-2 text-[10px] uppercase tracking-[0.2em] text-white/30">
          No market line yet
        </div>
      )}
    </div>
  )
}

const buildSeriesFromMovements = (
  lineMovements: any[],
  market: 'spread' | 'total' | 'moneyline'
): LineSeries | undefined => {
  const movement = lineMovements.find((item) => item.market === market)
  if (!movement) return undefined

  const opening = Number.isFinite(movement.openingLine)
    ? Number(movement.openingLine)
    : null
  const current = Number.isFinite(movement.currentLine)
    ? Number(movement.currentLine)
    : null
  if (opening == null && current == null) return undefined

  const now = Date.now()
  const points: LinePoint[] = []
  if (opening != null) {
    points.push({
      t: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
      value: opening,
    })
  }
  if (current != null) {
    points.push({
      t: new Date().toISOString(),
      value: current,
    })
  }

  return points.length ? { points } : undefined
}

export default function SharpActionClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [sections, setSections] = useState<SportSection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeDate, setActiveDate] = useState(getEasternDateString())
  const [activeSport, setActiveSport] = useState<'all' | string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchSharpAction = useCallback(async () => {
    setLoading(true)
    setError(null)
    const date = getEasternDateString()
    setActiveDate(date)

    try {
      const results = await Promise.allSettled(
        CORE_SPORTS.map(async (sport) => {
          const res = await fetch(
            `/api/market-projections?sport=${sport.key}&include=1&limit=500&date=${date}`,
            { cache: 'no-store' }
          )
          if (!res.ok) throw new Error(`Failed to load ${sport.label}`)
          const payload = await res.json()
          const edges = Array.isArray(payload?.edges) ? payload.edges : []

          const games: GameSharpAction[] = edges.map((edge: any) => {
            const sharpSignals: SharpSignal[] = Array.isArray(edge?.sharpSignals)
              ? edge.sharpSignals
              : []
            const strongestSignal = sharpSignals.length
              ? sharpSignals.reduce((best, next) =>
                  next.strength > best.strength ? next : best
                )
              : undefined
            const lineMovements = Array.isArray(edge?.lineMovements)
              ? edge.lineMovements
              : []
            const resolveFallback = (market: 'spread' | 'total' | 'moneyline') => {
              const move = lineMovements.find((item: any) => item.market === market)
              if (move?.currentLine != null) return Number(move.currentLine)
              if (move?.openingLine != null) return Number(move.openingLine)
              return null
            }

            const consensus = buildConsensusSharpSide(sharpSignals, {
              homeTeam: edge.homeTeam,
              awayTeam: edge.awayTeam,
            })

            return {
              gameId: edge.oddsApiId || edge.id || `${edge.homeTeam}-${edge.awayTeam}`,
              homeTeam: edge.homeTeam,
              awayTeam: edge.awayTeam,
              gameTime: edge.commenceTime || edge.gameTime || '',
              sharpSide: consensus.side,
              sharpMarket: consensus.market,
              narrative: buildAnalyticalNarrative(edge),
              sharpSignals,
              strongestSignal,
              fallbackLines: {
                spread: edge?.spread?.marketLine ?? resolveFallback('spread'),
                total: edge?.total?.marketLine ?? resolveFallback('total'),
                moneyline:
                  edge?.moneyline?.sportsbook?.homeOdds ?? resolveFallback('moneyline'),
              },
              lineHistory: {
                spread: buildSeriesFromMovements(lineMovements, 'spread'),
                total: buildSeriesFromMovements(lineMovements, 'total'),
                moneyline: buildSeriesFromMovements(lineMovements, 'moneyline'),
              },
            }
          })

          games.sort((a, b) =>
            new Date(a.gameTime).getTime() - new Date(b.gameTime).getTime()
          )

          return {
            key: sport.key,
            label: sport.label,
            updatedAt: payload?.updatedAt,
            games,
          }
        })
      )

      const nextSections: SportSection[] = results
        .map((result, index) => {
          if (result.status === 'fulfilled') return result.value
          return {
            key: CORE_SPORTS[index].key,
            label: CORE_SPORTS[index].label,
            games: [],
          }
        })

      const allGameIds = nextSections
        .flatMap((section) => section.games)
        .map((game) => game.gameId)
        .filter(Boolean)

      let historySeries: Record<string, GameLineHistory> = {}
      if (allGameIds.length > 0) {
        const historyRes = await fetch('/api/lines/history-batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            gameIds: allGameIds,
            markets: ['spread', 'total', 'moneyline'],
            hours: 36,
            lineType: 'current',
          }),
        })
        if (historyRes.ok) {
          const historyPayload = await historyRes.json()
          historySeries = historyPayload?.series || {}
        }
      }

      const enrichedSections = nextSections.map((section) => ({
        ...section,
        games: section.games.map((game) => {
          const history = historySeries[game.gameId]
          return {
            ...game,
            lineHistory: {
              spread: history?.spread ?? game.lineHistory?.spread,
              total: history?.total ?? game.lineHistory?.total,
              moneyline: history?.moneyline ?? game.lineHistory?.moneyline,
            },
          }
        }),
      }))

      setSections(enrichedSections)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sharp action')
      setSections([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSharpAction()
  }, [fetchSharpAction])

  const visibleSections = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const shouldHideEmpty = activeSport === 'all' && normalizedQuery.length > 0

    const filtered = sections
      .filter((section) => activeSport === 'all' || section.key === activeSport)
      .map((section) => {
        const games = normalizedQuery
          ? section.games.filter((game) => {
              const haystack = `${game.homeTeam} ${game.awayTeam} ${game.sharpSide} ${game.narrative}`.toLowerCase()
              return haystack.includes(normalizedQuery)
            })
          : section.games
        return { ...section, games }
      })
      .filter((section) => (shouldHideEmpty ? section.games.length > 0 : true))

    if (!previewMode) return filtered
    const first = filtered[0]
    if (!first) return []
    return [
      {
        ...first,
        games: first.games.slice(0, 1),
      },
    ]
  }, [sections, previewMode, activeSport, searchQuery])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSport('all')}
            className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
              activeSport === 'all'
                ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
            }`}
          >
            All Sports
          </button>
          {CORE_SPORTS.map((sport) => (
            <button
              key={sport.key}
              type="button"
              onClick={() => setActiveSport(sport.key)}
              className={`rounded-full border px-4 py-1.5 text-[10px] uppercase tracking-[0.2em] transition ${
                activeSport === sport.key
                  ? 'border-amber-400/60 bg-amber-500/10 text-amber-200'
                  : 'border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
              }`}
            >
              {sport.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-[220px]">
          <input
            type="search"
            placeholder="Search teams or signals"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
        </div>
      </div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p>
          Signal strength uses a 5-point scale. 3/5 = credible sharp action, 4/5 = strong,
          5/5 = elite market move. Strongest signals are highlighted per game.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/10 px-2.5 py-1">RLM: line moves against public</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">STEAM: fast coordinated move</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">SHARP MONEY: money vs tickets split</span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">STALLED: move fades or stalls</span>
        </div>
      </div>

      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-white/60">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Loading today&apos;s slate...
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && visibleSections.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-white/60">No games found for today&apos;s slate.</p>
        </div>
      )}

      {visibleSections.map((section) => (
        <div key={section.key} className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/40">
                {section.label} Slate
              </p>
              <h2 className="text-xl font-semibold text-white">
                {section.label} Games ({section.games.length})
              </h2>
            </div>
            <div className="text-xs text-white/40">Date: {activeDate}</div>
          </div>

          {section.games.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
              No games found for this sport today.
            </div>
          ) : (
            <div className="space-y-4">
              {section.games.map((game) => (
                <div
                  key={game.gameId}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{formatGameTime(game.gameTime)}</span>
                        {game.strongestSignal ? (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-emerald-300">
                            {game.strongestSignal.strength}/5
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            No sharp
                          </span>
                        )}
                      </div>
                      <h3 className="mt-2 text-lg font-semibold text-white">
                        {game.awayTeam} @ {game.homeTeam}
                      </h3>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        Sharp Side
                      </div>
                      <div className="mt-1 text-base font-semibold text-amber-200">
                        {game.sharpSide}
                      </div>
                      <div className="text-[11px] text-white/50">
                        {game.sharpMarket !== 'none' ? game.sharpMarket : 'No market lean'}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-white/5 bg-black/30 p-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      Analytical Summary
                    </p>
                    <p className="mt-2 text-sm text-white/80 leading-relaxed">
                      {game.narrative}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    <LineMovementChart
                      title="Spread line"
                      series={game.lineHistory?.spread}
                      color="#f59e0b"
                      fallbackValue={(game as any).fallbackLines?.spread ?? null}
                    />
                    <LineMovementChart
                      title="Total line"
                      series={game.lineHistory?.total}
                      color="#22d3ee"
                      fallbackValue={(game as any).fallbackLines?.total ?? null}
                    />
                    <LineMovementChart
                      title="Moneyline (home)"
                      series={game.lineHistory?.moneyline}
                      color="#a855f7"
                      fallbackValue={(game as any).fallbackLines?.moneyline ?? null}
                    />
                  </div>

                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      Sharp signals
                    </div>
                    {game.sharpSignals.length === 0 ? (
                      <p className="mt-2 text-xs text-white/50">No sharp signals detected yet.</p>
                    ) : (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {game.sharpSignals.map((signal, idx) => {
                          const Icon = getSignalIcon(signal.type)
                          return (
                            <div
                              key={`${signal.type}-${idx}`}
                              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${getStrengthColor(signal.strength)}`}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="text-[10px] font-medium">
                                {formatSignalLabel(signal.type)} {signal.market} {signal.side}
                              </span>
                              <span className="text-[9px] opacity-60">
                                ({signal.strength}/5)
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {previewMode && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm">
            <div className="space-y-4 px-4 py-8">
              {[1, 2].map((row) => (
                <div
                  key={row}
                  className="rounded-xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="h-4 w-48 rounded bg-white/10 mb-3" />
                  <div className="h-3 w-full rounded bg-white/5 mb-2" />
                  <div className="h-3 w-3/4 rounded bg-white/5" />
                </div>
              ))}
            </div>
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
                Unlock every sharp narrative and signal.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">Sharp Action</strong> now tracks every game
        on today&apos;s slate, with line movement charts and sharp signal strength per market.
      </div>
    </div>
  )
}
