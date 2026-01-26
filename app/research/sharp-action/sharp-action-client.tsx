'use client'

import { useCallback, useEffect, useState } from 'react'
import { TrendingUp, Zap, DollarSign, BarChart3, AlertTriangle } from 'lucide-react'

type SharpFactor = {
  type: 'rlm' | 'money_divergence' | 'model_edge' | 'steam_move' | 'closing_line'
  label: string
  value: string
  strength: number // 1-5
}

type GameSharpAction = {
  gameId: string
  homeTeam: string
  awayTeam: string
  gameTime: string
  isSharp: boolean
  sharpSide: string
  sharpMarket: 'spread' | 'moneyline' | 'total'
  narrative: string
  factors: SharpFactor[]
  confidence: number // 0-100
}

const SPORT_OPTIONS = [
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'basketball_ncaab', label: 'NCAAB' },
  { key: 'americanfootball_nfl', label: 'NFL' },
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

const getFactorIcon = (type: string) => {
  switch (type) {
    case 'rlm':
      return TrendingUp
    case 'money_divergence':
      return DollarSign
    case 'model_edge':
      return BarChart3
    case 'steam_move':
      return Zap
    default:
      return AlertTriangle
  }
}

const getStrengthColor = (strength: number) => {
  if (strength >= 4) return 'text-emerald-400 border-emerald-400/40'
  if (strength >= 3) return 'text-amber-400 border-amber-400/40'
  return 'text-white/60 border-white/20'
}

const buildSignalSummary = (factors: SharpFactor[]) => {
  if (factors.length === 0) return 'No sharp factors detected.'
  const primary = factors.slice(0, 3)
  const notes = primary.map((factor) => `${factor.label}: ${factor.value}`)
  return notes.join(' • ')
}

const buildAnalyticalNarrative = (edge: any, factors: SharpFactor[]) => {
  const parts: string[] = []
  const hasRlm = factors.some((f) => f.type === 'rlm')
  const hasMoney = factors.some((f) => f.type === 'money_divergence')
  const hasSteam = factors.some((f) => f.type === 'steam_move')
  const hasModel = factors.some((f) => f.type === 'model_edge')

  if (edge.spread) {
    const gap = Math.abs(
      Number(edge.spread.targetLine) - Number(edge.spread.marketLine)
    )
    parts.push(
      `Model vs market: ${edge.spread.favoredTeam} ${
        edge.spread.targetLine > 0 ? '+' : ''
      }${edge.spread.targetLine} vs market ${
        edge.spread.marketLine > 0 ? '+' : ''
      }${edge.spread.marketLine}.`
    )
    if (gap > 0.5) {
      parts.push(`Projected gap of ${gap.toFixed(1)} points suggests mispricing.`)
    }
  } else if (edge.total) {
    const gap = Math.abs(
      Number(edge.total.targetLine) - Number(edge.total.marketLine)
    )
    parts.push(
      `Total projection: ${edge.total.side === 'over' ? 'Over' : 'Under'} ${
        edge.total.targetLine
      } vs market ${edge.total.marketLine}.`
    )
    if (gap > 1) {
      parts.push(`Projection gap of ${gap.toFixed(1)} points flags value.`)
    }
  } else if (edge.moneyline) {
    parts.push('Moneyline misprice flagged by the model probability curve.')
  }

  if (hasRlm && hasMoney) {
    parts.push(
      'Reverse line movement with concentrated money indicates sharp side alignment.'
    )
  } else if (hasRlm) {
    parts.push('Line moved against public action, a classic sharp signal.')
  } else if (hasMoney) {
    parts.push('Ticket vs money divergence suggests pro liquidity on this side.')
  }

  if (hasSteam) {
    parts.push('Steam activity implies coordinated market pressure.')
  }

  if (hasModel && factors.length >= 2) {
    parts.push('Multiple independent signals reinforce conviction.')
  }

  if (parts.length === 0) {
    parts.push('Signals are light; monitor for additional movement closer to tip-off.')
  }

  return parts.join(' ')
}

const SignalGraph = ({ factors }: { factors: SharpFactor[] }) => {
  if (!factors.length) return null
  const maxStrength = 5
  const width = 320
  const height = 160
  const paddingLeft = 36
  const paddingBottom = 28
  const paddingTop = 16
  const paddingRight = 16
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const step = factors.length > 1 ? plotWidth / (factors.length - 1) : 0

  const toX = (index: number) => paddingLeft + step * index
  const toY = (strength: number) =>
    paddingTop + (1 - strength / maxStrength) * plotHeight

  const shortLabel = (label: string) =>
    label
      .split(' ')
      .slice(0, 2)
      .join(' ')
      .toUpperCase()

  const points = factors.map((factor, index) => ({
    label: shortLabel(factor.label),
    x: toX(index),
    y: toY(factor.strength),
    strength: factor.strength,
  }))

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x},${point.y}`)
    .join(' ')

  return (
    <div className="rounded-xl border border-white/5 bg-black/30 p-4">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-white/40">
        <span>Signal Strength</span>
        <span>1-5 scale</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="min-w-[320px] w-full max-w-[520px]"
          role="img"
          aria-label="Signal strength point graph"
        >
          <rect width={width} height={height} fill="transparent" />
          {/* Axes */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={paddingLeft}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="1"
          />
          {/* Y-axis ticks */}
          {[1, 3, 5].map((tick) => {
            const y = toY(tick)
            return (
              <g key={tick}>
                <line
                  x1={paddingLeft - 4}
                  y1={y}
                  x2={paddingLeft}
                  y2={y}
                  stroke="rgba(255,255,255,0.25)"
                  strokeWidth="1"
                />
                <text
                  x={paddingLeft - 8}
                  y={y + 4}
                  fontSize="10"
                  textAnchor="end"
                  fill="rgba(255,255,255,0.5)"
                >
                  {tick}
                </text>
              </g>
            )
          })}
          {/* X-axis ticks */}
          {points.map((point) => (
            <g key={`tick-${point.label}`}>
              <line
                x1={point.x}
                y1={height - paddingBottom}
                x2={point.x}
                y2={height - paddingBottom + 4}
                stroke="rgba(255,255,255,0.25)"
                strokeWidth="1"
              />
              <text
                x={point.x}
                y={height - 8}
                fontSize="9"
                textAnchor="middle"
                fill="rgba(255,255,255,0.55)"
              >
                {point.label}
              </text>
            </g>
          ))}
          {/* Line path */}
          {points.length > 1 && (
            <path
              d={linePath}
              fill="none"
              stroke="rgba(245,158,11,0.55)"
              strokeWidth="2"
            />
          )}
          {/* Points */}
          {points.map((point) => (
            <g key={`point-${point.label}`}>
              <circle
                cx={point.x}
                cy={point.y}
                r="5"
                fill="#f59e0b"
                stroke="rgba(245,158,11,0.4)"
                strokeWidth="2"
              />
              <text
                x={point.x}
                y={point.y - 10}
                fontSize="9"
                textAnchor="middle"
                fill="rgba(255,255,255,0.55)"
              >
                {point.strength}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  )
}

export default function SharpActionClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [games, setGames] = useState<GameSharpAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSport, setSelectedSport] = useState('basketball_nba')

  const fetchSharpAction = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/market-projections?sport=${selectedSport}&include=1`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Failed to load projections')

      const payload = await res.json()
      const edges = Array.isArray(payload?.edges) ? payload.edges : []

      // Transform edges into sharp action narratives
      const sharpGames: GameSharpAction[] = edges
        .filter((edge: any) => edge?.spread || edge?.moneyline || edge?.total)
        .slice(0, 10)
        .map((edge: any): GameSharpAction => {
          const factors: SharpFactor[] = []

          // Build factors from edge data
          if (edge.spread) {
            const gap = Math.abs(
              Number(edge.spread.targetLine) - Number(edge.spread.marketLine)
            )
            if (gap > 0.5) {
              factors.push({
                type: 'model_edge',
                label: 'Model Edge',
                value: `${gap.toFixed(1)} pts`,
                strength: Math.min(5, Math.ceil(gap / 0.5)),
              })
            }
          }

          // Add RLM factor if present
          if (edge.factors?.some((f: any) => f.type === 'rlm')) {
            factors.push({
              type: 'rlm',
              label: 'Reverse Line Movement',
              value: 'Detected',
              strength: 4,
            })
          }

          // Add money divergence if present
          if (edge.factors?.some((f: any) => f.type === 'money_divergence')) {
            factors.push({
              type: 'money_divergence',
              label: 'Money vs Tickets',
              value: 'Sharp $ detected',
              strength: 4,
            })
          }

          // Determine sharp side
          let sharpSide = ''
          let sharpMarket: 'spread' | 'moneyline' | 'total' = 'spread'
          if (edge.spread) {
            sharpSide = `${edge.spread.favoredTeam} ${edge.spread.targetLine > 0 ? '+' : ''}${edge.spread.targetLine}`
            sharpMarket = 'spread'
          } else if (edge.moneyline) {
            sharpSide = `${edge.homeTeam} ML`
            sharpMarket = 'moneyline'
          } else if (edge.total) {
            sharpSide = `${edge.total.side === 'over' ? 'Over' : 'Under'} ${edge.total.targetLine}`
            sharpMarket = 'total'
          }

          // Generate narrative
          const narrative = buildAnalyticalNarrative(edge, factors)

          return {
            gameId: edge.id || `${edge.homeTeam}-${edge.awayTeam}`,
            homeTeam: edge.homeTeam,
            awayTeam: edge.awayTeam,
            gameTime: edge.commenceTime || edge.gameTime || '',
            isSharp: factors.length > 0,
            sharpSide,
            sharpMarket,
            narrative,
            factors,
            confidence: Math.min(95, 50 + factors.length * 15),
          }
        })
        .filter((g: GameSharpAction) => g.isSharp)

      setGames(sharpGames)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sharp action')
      setGames([])
    } finally {
      setLoading(false)
    }
  }, [selectedSport])

  useEffect(() => {
    fetchSharpAction()
  }, [fetchSharpAction])

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
            Analyzing sharp action...
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
      {!loading && !error && games.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-white/60">
            No sharp action detected for today&apos;s games.
          </p>
          <p className="mt-2 text-xs text-white/40">
            Check back closer to game time when lines move.
          </p>
        </div>
      )}

      {/* Games */}
      <div className="space-y-4">
        {(previewMode ? games.slice(0, 1) : games).map((game) => (
          <div
            key={game.gameId}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-300">
                    Sharp
                  </span>
                  <span className="text-xs text-white/50">
                    {formatGameTime(game.gameTime)}
                  </span>
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
              </div>
            </div>

            {/* Narrative */}
            <div className="rounded-xl border border-white/5 bg-black/30 p-4 mb-4">
              <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Analytical Summary
              </p>
              <p className="mt-2 text-sm text-white/80 leading-relaxed">
                {game.narrative}
              </p>
              <p className="mt-3 text-[11px] text-white/50">
                {buildSignalSummary(game.factors)}
              </p>
            </div>

            <SignalGraph factors={game.factors} />

            {/* Factors */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                Key factors:
              </span>
              {game.factors.map((factor, idx) => {
                const Icon = getFactorIcon(factor.type)
                return (
                  <div
                    key={idx}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 ${getStrengthColor(factor.strength)}`}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="text-[10px] font-medium">
                      {factor.label}: {factor.value}
                    </span>
                    <span className="text-[9px] opacity-60">
                      ({factor.strength}/5)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
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

      {/* Info Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">Sharp Action</strong> blends model deltas,
        line movement, and money vs. tickets data to explain why pros lean a side.
        Signal strength bars summarize how strong each factor is.
      </div>
    </div>
  )
}
