'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import MatchupIntelPanel, {
  buildMatchupIntelKey,
  type MatchupIntelPanelStatus,
  type MatchupIntelResponse,
  type MatchupPanelContext,
} from '@/components/intel/matchup-intel-panel'
import {
  formatSharpSignalStrengthPlain,
  formatSharpSignalSummaryLine,
  getSharpSignalPlainExplanation,
  getSharpSignalPlainLabel,
  getSharpSignalStrengthPlain,
} from '@/lib/utils/sharp-signal-language'

type MarketPriceSeries = {
  label: string
  points: { t: string; value: number }[]
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
  marketPriceSeries?: Record<string, MarketPriceSeries>
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

type MatchupIntelRequest = {
  sportKey: string
  awayTeam: string
  homeTeam: string
  commenceTime?: string | null
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
      `Top signal: ${formatSharpSignalSummaryLine(strongest)}`
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

const OUTCOME_COLORS = ['#f59e0b', '#22d3ee', '#a855f7', '#f472b6']

const MarketPriceChart = ({
  series,
}: {
  series?: Record<string, MarketPriceSeries>
}) => {
  const entries = series ? Object.values(series) : []
  const hasData = entries.some((e) => e.points.length > 0)

  if (!hasData) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
          <span>Market Line Movement</span>
          <span>Market</span>
        </div>
        <div className="mt-3 flex h-28 items-center justify-center">
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">
            No market data yet
          </span>
        </div>
      </div>
    )
  }

  // Merge all entries into a unified timeline
  const allTimestamps = new Set<string>()
  for (const entry of entries) {
    for (const pt of entry.points) allTimestamps.add(pt.t)
  }
  const sortedTimes = Array.from(allTimestamps).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  )

  // Build data array with one key per outcome
  const data = sortedTimes.map((t) => {
    const row: Record<string, any> = { time: t }
    for (const entry of entries) {
      const key = entry.label
      const pt = entry.points.find((p) => p.t === t)
      if (pt) {
        row[key] = Math.round(pt.value * 100)
      }
    }
    return row
  })

  // Forward-fill missing values
  const keys = entries.map((e) => e.label)
  for (let i = 1; i < data.length; i++) {
    for (const key of keys) {
      if (data[i][key] == null && data[i - 1][key] != null) {
        data[i][key] = data[i - 1][key]
      }
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>Market Line Movement</span>
        <span>Market</span>
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
        {entries.map((entry, idx) => (
          <div key={entry.label} className="flex items-center gap-1.5 text-[10px] text-white/60">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: OUTCOME_COLORS[idx % OUTCOME_COLORS.length] }}
            />
            {entry.label}
            {entry.points.length > 0 && (
              <span className="text-white/40">
                {Math.round(entry.points[entry.points.length - 1].value * 100)}¢
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="mt-2 h-32">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin - 2', 'dataMax + 2']} />
            <Tooltip
              labelFormatter={(label) => formatTooltipTime(label as string)}
              formatter={(value: number, name: string) => [`${value}¢`, name]}
              contentStyle={{
                background: 'rgba(0,0,0,0.85)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                fontSize: '12px',
              }}
            />
            {entries.map((entry, idx) => (
              <Line
                key={entry.label}
                type="monotone"
                dataKey={entry.label}
                stroke={OUTCOME_COLORS[idx % OUTCOME_COLORS.length]}
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const isValidMatchupIntelPayload = (payload: unknown): payload is MatchupIntelResponse => {
  if (!payload || typeof payload !== 'object') return false
  const candidate = payload as MatchupIntelResponse
  return Boolean(
    candidate?.matchup &&
      candidate?.sbd &&
      Array.isArray(candidate?.insights) &&
      candidate?.updatedAt
  )
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
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelContext, setPanelContext] = useState<MatchupPanelContext | null>(null)
  const [intelByKey, setIntelByKey] = useState<Record<string, MatchupIntelResponse>>({})
  const [intelLoadingByKey, setIntelLoadingByKey] = useState<Record<string, boolean>>({})
  const [intelErrorByKey, setIntelErrorByKey] = useState<Record<string, string>>({})
  const isMountedRef = useRef(true)

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const fetchMatchupIntel = useCallback(async (item: MatchupIntelRequest) => {
    const params = new URLSearchParams({
      sportKey: item.sportKey,
      awayTeam: item.awayTeam,
      homeTeam: item.homeTeam,
    })
    if (item.commenceTime) params.set('commenceTime', item.commenceTime)

    const res = await fetch(`/api/intel/matchup?${params.toString()}`, {
      cache: 'no-store',
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) {
      throw new Error(body?.error || 'Failed to preload matchup intel.')
    }
    if (!isValidMatchupIntelPayload(body)) {
      throw new Error('Invalid matchup intel payload.')
    }
    return body
  }, [])

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

      // Show games immediately, then load price history in background
      setSections(nextSections)
      setLoading(false)

      // Fetch market price history for all games in parallel (background)
      const allGames = nextSections.flatMap((section) =>
        section.games.map((game) => ({ sportKey: section.key, game }))
      )

      if (allGames.length > 0) {
        const chunkSize = 6
        for (let i = 0; i < allGames.length; i += chunkSize) {
          const chunk = allGames.slice(i, i + chunkSize)
          const results = await Promise.allSettled(
            chunk.map(async ({ sportKey, game }) => {
              const params = new URLSearchParams({
                sportKey,
                homeTeam: game.homeTeam,
                awayTeam: game.awayTeam,
              })
              const res = await fetch(`/api/market-price-history?${params.toString()}`, {
                cache: 'no-store',
              })
              if (!res.ok) return { gameId: game.gameId, series: null }
              const body = await res.json()
              return {
                gameId: game.gameId,
                series: body?.series ?? null,
              }
            })
          )

          if (!isMountedRef.current) return

          const newEntries: Record<string, Record<string, MarketPriceSeries>> = {}
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value.series) {
              newEntries[result.value.gameId] = result.value.series
            }
          }

          if (Object.keys(newEntries).length > 0) {
            setSections((prev) =>
              prev.map((section) => ({
                ...section,
                games: section.games.map((game) =>
                  newEntries[game.gameId]
                    ? { ...game, marketPriceSeries: newEntries[game.gameId] }
                    : game
                ),
              }))
            )
          }
        }
      }

      return
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

  const visibleIntelRequests = useMemo(
    () =>
      visibleSections.flatMap((section) =>
        section.games.map((game) => ({
          sportKey: section.key,
          awayTeam: game.awayTeam,
          homeTeam: game.homeTeam,
          commenceTime: game.gameTime,
        }))
      ),
    [visibleSections]
  )

  useEffect(() => {
    const requests = visibleIntelRequests
      .map((item) => ({
        item,
        key: buildMatchupIntelKey(item),
      }))
      .filter(({ key }) => !intelByKey[key] && !intelLoadingByKey[key] && !intelErrorByKey[key])

    if (requests.length === 0) return

    const run = async () => {
      const chunkSize = 8

      for (let i = 0; i < requests.length; i += chunkSize) {
        const chunk = requests.slice(i, i + chunkSize)

        if (!isMountedRef.current) return
        setIntelLoadingByKey((prev) => {
          const next = { ...prev }
          chunk.forEach(({ key }) => {
            next[key] = true
          })
          return next
        })

        await Promise.all(
          chunk.map(async ({ item, key }) => {
            try {
              const body = await fetchMatchupIntel(item)
              if (!isMountedRef.current) return

              setIntelByKey((prev) => ({ ...prev, [key]: body }))
              setIntelErrorByKey((prev) => {
                if (!prev[key]) return prev
                const next = { ...prev }
                delete next[key]
                return next
              })
            } catch (error: any) {
              if (!isMountedRef.current) return
              setIntelErrorByKey((prev) => ({
                ...prev,
                [key]: error?.message || 'Failed to preload matchup intel.',
              }))
            } finally {
              if (!isMountedRef.current) return
              setIntelLoadingByKey((prev) => {
                if (!prev[key]) return prev
                const next = { ...prev }
                delete next[key]
                return next
              })
            }
          })
        )
      }
    }

    void run()
  }, [visibleIntelRequests, intelByKey, intelLoadingByKey, intelErrorByKey, fetchMatchupIntel])

  const openMatchupPanel = (sportKey: string, game: GameSharpAction) => {
    const market = game.sharpMarket !== 'none' ? game.sharpMarket : 'No market lean'
    const lineValue =
      game.sharpMarket === 'spread'
        ? game.fallbackLines?.spread
        : game.sharpMarket === 'total'
          ? game.fallbackLines?.total
          : game.sharpMarket === 'moneyline'
            ? game.fallbackLines?.moneyline
            : null
    const intelKey = buildMatchupIntelKey({
      sportKey,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      commenceTime: game.gameTime || null,
    })

    setIntelErrorByKey((prev) => {
      if (!prev[intelKey]) return prev
      const next = { ...prev }
      delete next[intelKey]
      return next
    })

    setPanelContext({
      id: `research-${sportKey}-${game.gameId}`,
      source: 'research-mode',
      sportKey,
      awayTeam: game.awayTeam,
      homeTeam: game.homeTeam,
      commenceTime: game.gameTime || null,
      summary: {
        betLabel: game.sharpSide,
        market,
        line: lineValue == null || !Number.isFinite(lineValue) ? 'n/a' : String(lineValue),
        lineMovement: game.narrative,
        narrative: game.narrative,
        sharpSignals: game.sharpSignals
          .slice(0, 4)
          .map((signal) => formatSharpSignalSummaryLine(signal)),
      },
    })
    setPanelOpen(true)
  }

  const activeIntelKey = panelContext
    ? buildMatchupIntelKey({
        sportKey: panelContext.sportKey,
        awayTeam: panelContext.awayTeam,
        homeTeam: panelContext.homeTeam,
        commenceTime: panelContext.commenceTime,
      })
    : null
  const activeIntel = activeIntelKey ? intelByKey[activeIntelKey] ?? null : null
  const activeIntelError = activeIntelKey ? intelErrorByKey[activeIntelKey] ?? null : null
  const activeIntelLoading = activeIntelKey ? Boolean(intelLoadingByKey[activeIntelKey]) : false
  const activeIntelStatus: MatchupIntelPanelStatus =
    activeIntelLoading || (!activeIntel && !activeIntelError)
      ? 'loading'
      : activeIntelError
        ? 'error'
        : 'ready'

  useEffect(() => {
    if (!panelContext || !activeIntelKey) return
    if (intelErrorByKey[activeIntelKey]) return
    if (intelByKey[activeIntelKey] || intelLoadingByKey[activeIntelKey]) return

    setIntelLoadingByKey((prev) => ({ ...prev, [activeIntelKey]: true }))

    const request: MatchupIntelRequest = {
      sportKey: panelContext.sportKey,
      awayTeam: panelContext.awayTeam,
      homeTeam: panelContext.homeTeam,
      commenceTime: panelContext.commenceTime,
    }

    const run = async () => {
      try {
        const body = await fetchMatchupIntel(request)
        if (!isMountedRef.current) return
        setIntelByKey((prev) => ({ ...prev, [activeIntelKey]: body }))
        setIntelErrorByKey((prev) => {
          if (!prev[activeIntelKey]) return prev
          const next = { ...prev }
          delete next[activeIntelKey]
          return next
        })
      } catch (error: any) {
        if (!isMountedRef.current) return
        setIntelErrorByKey((prev) => ({
          ...prev,
          [activeIntelKey]: error?.message || 'Failed to preload matchup intel.',
        }))
      } finally {
        if (!isMountedRef.current) return
        setIntelLoadingByKey((prev) => {
          if (!prev[activeIntelKey]) return prev
          const next = { ...prev }
          delete next[activeIntelKey]
          return next
        })
      }
    }

    void run()
  }, [panelContext, activeIntelKey, intelByKey, intelLoadingByKey, intelErrorByKey, fetchMatchupIntel])

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
          Signals are graded on a 5-point scale based on how clearly market behavior suggests
          respected bettors are driving the move.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/60">
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {getSharpSignalPlainLabel('RLM')}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {getSharpSignalPlainLabel('STEAM')}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {getSharpSignalPlainLabel('SHARP_MONEY')}
          </span>
          <span className="rounded-full border border-white/10 px-2.5 py-1">
            {getSharpSignalPlainLabel('STALLED')}
          </span>
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
                <article
                  key={game.gameId}
                  role="button"
                  tabIndex={0}
                  onClick={() => openMatchupPanel(section.key, game)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      openMatchupPanel(section.key, game)
                    }
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.07] hover:shadow-[0_16px_48px_rgba(0,0,0,0.35)] focus:outline-none focus:ring-1 focus:ring-amber-300/40"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-white/50">
                        <span>{formatGameTime(game.gameTime)}</span>
                        {game.strongestSignal ? (
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            {formatSharpSignalStrengthPlain(game.strongestSignal.strength)}
                          </span>
                        ) : (
                          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.2em] text-white/40">
                            No sharp
                          </span>
                        )}
                      </div>
                      <div className="mt-2 text-left text-lg font-semibold text-white">
                        {game.awayTeam} @ {game.homeTeam}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                        Pro Betting Lean
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

                  <div className="mt-4">
                    <MarketPriceChart series={game.marketPriceSeries} />
                  </div>

                  <div className="mt-4">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                      Signal Breakdown
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
                              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 ${getStrengthColor(signal.strength)}`}
                              title={getSharpSignalPlainExplanation(signal.type)}
                            >
                              <Icon className="h-3 w-3" />
                              <span className="text-[10px] font-medium">
                                {getSharpSignalPlainLabel(signal.type)}
                              </span>
                              <span className="text-[10px] opacity-80">
                                Pros leaning {signal.side} ({signal.market})
                              </span>
                              <span className="text-[9px] opacity-60">
                                {getSharpSignalStrengthPlain(signal.strength)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </article>
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

      <MatchupIntelPanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        context={panelContext}
        intel={activeIntel}
        status={activeIntelStatus}
        errorMessage={activeIntelError}
      />
    </div>
  )
}
