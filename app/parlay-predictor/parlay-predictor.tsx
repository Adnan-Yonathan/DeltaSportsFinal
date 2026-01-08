'use client'

import { useEffect, useMemo, useState } from 'react'

type BestOddsSelection = {
  selection: string
  book: string
  odds: number
  point?: number | null
}

type BestOddsGame = {
  gameId: string
  game: string
  commence_time: string
  best: {
    h2h?: BestOddsSelection[]
    spreads?: BestOddsSelection[]
    totals?: BestOddsSelection[]
  }
}

type MatchupGame = BestOddsGame & {
  homeTeam: string
  awayTeam: string
  label: string
}

type MarketType = 'spread' | 'moneyline' | 'total'

type MarketSelection = {
  key: string
  name: string
  label: string
  direction: 'home' | 'away' | 'over' | 'under'
  line?: number | null
  odds?: number | null
  book?: string | null
}

type LegState = {
  id: string
  sport?: string
  gameId?: string
  market?: MarketType
  selectionKey?: string
}

type ParlayResult = {
  legs: Array<{
    description: string
    probability: number
    book?: string | null
    marketOdds?: number | null
    impliedProbability?: number | null
    modelProbability?: number | null
    edge?: number | null
  }>
  independentProbability: number
  correlatedProbability: number
  impliedOdds: number | null
  bestBook?: string
  bestBookOdds?: number | null
  marketImpliedProbability?: number | null
  parlayEdge?: number | null
  confidence: 'low' | 'medium' | 'high'
}

const NHL_ENABLED = false
const SPORTS = [
  { value: 'americanfootball_nfl', label: 'NFL' },
  { value: 'basketball_nba', label: 'NBA' },
  { value: 'basketball_ncaab', label: 'NCAAB' },
  { value: 'americanfootball_ncaaf', label: 'CFB' },
  { value: 'icehockey_nhl', label: 'NHL', disabled: !NHL_ENABLED },
]

const createLeg = (): LegState => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  market: 'spread',
})

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${odds}` : `${odds}`
}

const formatLine = (line?: number | null) => {
  if (line == null || !Number.isFinite(line)) return 'n/a'
  return line > 0 ? `+${line}` : `${line}`
}

const normalizeTeamKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const isSameTeam = (left: string, right: string) => {
  const a = normalizeTeamKey(left)
  const b = normalizeTeamKey(right)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const parseMatchup = (game: string) => {
  const parts = game.split(' @ ')
  if (parts.length === 2) {
    return { awayTeam: parts[0].trim(), homeTeam: parts[1].trim() }
  }
  return { awayTeam: game.trim(), homeTeam: '' }
}

const buildGameLabel = (game: BestOddsGame) => {
  const { awayTeam, homeTeam } = parseMatchup(game.game)
  const date = new Date(game.commence_time)
  const time = Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return {
    homeTeam,
    awayTeam,
    label: time ? `${game.game} - ${time}` : game.game,
  }
}

const normalizeDirection = (value: string): 'over' | 'under' => {
  return value.toLowerCase().startsWith('under') ? 'under' : 'over'
}

const buildSelections = (
  game: MatchupGame | undefined,
  market?: MarketType
): MarketSelection[] => {
  if (!game || !market) return []

  if (market === 'spread') {
    return (game.best.spreads || []).map((entry) => {
      const key = `${entry.selection}|${entry.point ?? ''}`
      const lineLabel =
        entry.point != null && Number.isFinite(entry.point) ? ` ${formatLine(entry.point)}` : ''
      const label = `${entry.selection}${lineLabel} | ${formatOdds(entry.odds)} ${entry.book}`
      const direction =
        isSameTeam(entry.selection, game.homeTeam) ? 'home' : 'away'
      return {
        key,
        name: entry.selection,
        label,
        direction,
        line: entry.point ?? null,
        odds: entry.odds ?? null,
        book: entry.book ?? null,
      }
    })
  }

  if (market === 'moneyline') {
    return (game.best.h2h || []).map((entry) => {
      const key = `${entry.selection}`
      const label = `${entry.selection} ML | ${formatOdds(entry.odds)} ${entry.book}`
      const direction =
        isSameTeam(entry.selection, game.homeTeam) ? 'home' : 'away'
      return {
        key,
        name: entry.selection,
        label,
        direction,
        odds: entry.odds ?? null,
        book: entry.book ?? null,
      }
    })
  }

  if (market === 'total') {
    return (game.best.totals || []).map((entry) => {
      const key = `${entry.selection}|${entry.point ?? ''}`
      const direction = normalizeDirection(entry.selection)
      const lineLabel =
        entry.point != null && Number.isFinite(entry.point) ? ` ${formatLine(entry.point)}` : ''
      const label = `${entry.selection}${lineLabel} | ${formatOdds(entry.odds)} ${entry.book}`
      return {
        key,
        name: entry.selection,
        label,
        direction,
        line: entry.point ?? null,
        odds: entry.odds ?? null,
        book: entry.book ?? null,
      }
    })
  }

  return []
}

export default function ParlayPredictor() {
  const [sport, setSport] = useState(SPORTS[0]?.value || 'americanfootball_nfl')
  const [mode, setMode] = useState<'single' | 'multi'>('single')
  const [games, setGames] = useState<MatchupGame[]>([])
  const [gamesBySport, setGamesBySport] = useState<Record<string, MatchupGame[]>>({})
  const [legs, setLegs] = useState<LegState[]>([createLeg(), createLeg()])
  const [loading, setLoading] = useState(false)
  const [projecting, setProjecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ParlayResult | null>(null)

  useEffect(() => {
    if (mode !== 'single') return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/odds/best?sport=${sport}`)
        const payload = await res.json()
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load matchups')
        }
        const data = Array.isArray(payload?.data) ? payload.data : []
        const mapped = data.map((game: BestOddsGame) => ({
          ...game,
          ...buildGameLabel(game),
        }))
        if (active) {
          setGames(mapped)
          setResult(null)
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message || 'Failed to load matchups')
        }
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [sport, mode])

  const loadGamesForSport = async (targetSport: string) => {
    if (gamesBySport[targetSport]) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/odds/best?sport=${targetSport}`)
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load matchups')
      }
      const data = Array.isArray(payload?.data) ? payload.data : []
      const mapped = data.map((game: BestOddsGame) => ({
        ...game,
        ...buildGameLabel(game),
      }))
      setGamesBySport((prev) => ({ ...prev, [targetSport]: mapped }))
    } catch (err: any) {
      setError(err?.message || 'Failed to load matchups')
    } finally {
      setLoading(false)
    }
  }

  const gameById = useMemo(() => {
    const map = new Map<string, MatchupGame>()
    games.forEach((game) => map.set(game.gameId, game))
    return map
  }, [games])

  const gameBySportId = useMemo(() => {
    const map = new Map<string, MatchupGame>()
    Object.values(gamesBySport).forEach((list) => {
      list.forEach((game) => map.set(game.gameId, game))
    })
    return map
  }, [gamesBySport])

  const updateLeg = (id: string, next: Partial<LegState>) => {
    setLegs((prev) =>
      prev.map((leg) => (leg.id === id ? { ...leg, ...next } : leg))
    )
  }

  const addLeg = () => {
    setLegs((prev) => [...prev, createLeg()])
  }

  const removeLeg = (id: string) => {
    setLegs((prev) => prev.filter((leg) => leg.id !== id))
  }

  const canProject = legs.every((leg) => {
    if (!leg.gameId || !leg.market || !leg.selectionKey) return false
    if (mode === 'multi' && !leg.sport) return false
    return true
  })

  const handleProject = async () => {
    if (!canProject) return
    setProjecting(true)
    setError(null)
    setResult(null)

    try {
      const payloadLegs = legs.map((leg) => {
        const game = mode === 'multi'
          ? gameBySportId.get(leg.gameId || '')
          : gameById.get(leg.gameId || '')
        const selections = buildSelections(game, leg.market)
        const selection = selections.find((item) => item.key === leg.selectionKey)

        if (!game || !selection) {
          throw new Error('Missing selection data for one or more legs.')
        }

        const legSport = mode === 'multi' ? leg.sport : sport

        if (leg.market === 'spread') {
          return {
            type: 'game_spread',
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            line: selection.line,
            direction: selection.direction,
            marketOdds: selection.odds ?? undefined,
            sport: legSport,
          }
        }

        if (leg.market === 'moneyline') {
          return {
            type: 'game_moneyline',
            homeTeam: game.homeTeam,
            awayTeam: game.awayTeam,
            direction: selection.direction,
            marketOdds: selection.odds ?? undefined,
            sport: legSport,
          }
        }

        return {
          type: 'game_total',
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          line: selection.line,
          direction: selection.direction,
          marketOdds: selection.odds ?? undefined,
          sport: legSport,
        }
      })

      const res = await fetch('/api/parlay-projection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: mode === 'multi' ? undefined : sport,
          legs: payloadLegs,
        }),
      })
      const payload = await res.json()
      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to project parlay')
      }
      setResult(payload?.result || null)
    } catch (err: any) {
      setError(err?.message || 'Failed to project parlay')
    } finally {
      setProjecting(false)
    }
  }

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs uppercase tracking-[0.25em] text-white/50">
          Mode
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setMode('single')}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] ${
              mode === 'single'
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            Single sport
          </button>
          <button
            type="button"
            onClick={() => setMode('multi')}
            className={`rounded-full border px-4 py-2 text-xs uppercase tracking-[0.25em] ${
              mode === 'multi'
                ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
            }`}
          >
            Multi-sport
          </button>
        </div>
        {mode === 'single' && (
          <>
            <label className="text-xs uppercase tracking-[0.25em] text-white/50">
              Sport
            </label>
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="rounded-full border border-white/20 bg-black/40 px-4 py-2 text-sm text-white"
            >
              {SPORTS.map((item) => (
                <option
                  key={item.value}
                  value={item.value}
                  className="bg-black"
                  disabled={item.disabled}
                >
                  {item.label}{item.disabled ? ' (locked)' : ''}
                </option>
              ))}
            </select>
          </>
        )}
      </div>

      {mode === 'single' && !loading && games.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No matchups found for today. Try another sport or refresh later.
        </div>
      )}

      <div className="space-y-4">
        {legs.map((leg, index) => {
          const game = mode === 'multi'
            ? leg.gameId
              ? gameBySportId.get(leg.gameId)
              : undefined
            : leg.gameId
              ? gameById.get(leg.gameId)
              : undefined
          const selections = buildSelections(game, leg.market)
          return (
            <div
              key={leg.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold">Leg {index + 1}</p>
                {legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(leg.id)}
                    className="text-xs uppercase tracking-[0.2em] text-white/50 hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div
                className={`mt-4 grid gap-4 ${
                  mode === 'multi'
                    ? 'md:grid-cols-[1fr_2fr_1fr]'
                    : 'md:grid-cols-[2fr_1fr]'
                }`}
              >
                {mode === 'multi' && (
                  <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                    Sport
                    <select
                      value={leg.sport || ''}
                      onChange={(event) => {
                        const nextSport = event.target.value || undefined
                        updateLeg(leg.id, {
                          sport: nextSport,
                          gameId: undefined,
                          selectionKey: undefined,
                        })
                        if (nextSport) {
                          loadGamesForSport(nextSport)
                        }
                      }}
                      className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                    >
                      <option value="" disabled>
                        Select sport
                      </option>
                      {SPORTS.map((item) => (
                        <option
                          key={item.value}
                          value={item.value}
                          className="bg-black"
                          disabled={item.disabled}
                        >
                          {item.label}{item.disabled ? ' (locked)' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  Matchup
                  <select
                    value={leg.gameId || ''}
                    onChange={(event) =>
                      updateLeg(leg.id, {
                        gameId: event.target.value || undefined,
                        selectionKey: undefined,
                      })
                    }
                    className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="" disabled>
                      {loading ? 'Loading games...' : 'Select matchup'}
                    </option>
                    {(mode === 'multi' && leg.sport ? gamesBySport[leg.sport] || [] : games).map((item) => (
                      <option key={item.gameId} value={item.gameId} className="bg-black">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
                  Market
                  <select
                    value={leg.market || ''}
                    onChange={(event) =>
                      updateLeg(leg.id, {
                        market: event.target.value as MarketType,
                        selectionKey: undefined,
                      })
                    }
                    className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
                  >
                    <option value="spread" className="bg-black">
                      Spread
                    </option>
                    <option value="moneyline" className="bg-black">
                      Moneyline
                    </option>
                    <option value="total" className="bg-black">
                      Total
                    </option>
                  </select>
                </label>
              </div>
              <div className="mt-4">
                <div className="text-xs uppercase tracking-[0.25em] text-white/50">
                  Selection
                </div>
                {!game ? (
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/60">
                    {mode === 'multi' && !leg.sport
                      ? 'Select a sport to see available matchups.'
                      : 'Select a matchup to see available lines.'}
                  </div>
                ) : selections.length === 0 ? (
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-white/60">
                    No lines available for this market.
                  </div>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <div className="hidden sm:grid grid-cols-[minmax(0,1.4fr)_90px_90px_minmax(0,1fr)_70px] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
                      <span>Selection</span>
                      <span>Line</span>
                      <span>Odds</span>
                      <span>Book</span>
                      <span className="text-right">Pick</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {selections.map((option) => {
                        const isSelected = leg.selectionKey === option.key
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => updateLeg(leg.id, { selectionKey: option.key })}
                            className={`w-full text-left text-sm transition sm:text-[13px] ${
                              isSelected ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                            }`}
                          >
                            <div className="grid gap-2 px-3 py-3 sm:grid-cols-[minmax(0,1.4fr)_90px_90px_minmax(0,1fr)_70px]">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-white">{option.name}</span>
                              </div>
                              <div className="text-white/70">
                                {option.line != null ? formatLine(option.line) : 'n/a'}
                              </div>
                              <div className="text-white/70">{formatOdds(option.odds)}</div>
                              <div className="text-white/50">{option.book || 'n/a'}</div>
                              <div className="text-right text-xs uppercase tracking-[0.2em] text-white/50">
                                {isSelected ? 'Selected' : 'Pick'}
                              </div>
                            </div>
                            <div className="px-3 pb-3 text-[11px] text-white/40 sm:hidden">
                              {option.label}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={addLeg}
          className="rounded-full border border-white/20 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/70 hover:border-white/40 hover:text-white"
        >
          Add leg
        </button>
        <button
          type="button"
          onClick={handleProject}
          disabled={!canProject || projecting}
          className="rounded-full bg-emerald-500/80 px-5 py-2 text-xs uppercase tracking-[0.3em] text-black transition disabled:cursor-not-allowed disabled:bg-emerald-500/30"
        >
          {projecting ? 'Projecting...' : 'Project'}
        </button>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Parlay edge</p>
              <p className="text-xl font-semibold">
                {result.parlayEdge != null
                  ? `${(result.parlayEdge * 100).toFixed(1)}%`
                  : 'n/a'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">Best book</p>
              <p className="text-sm text-white/80">
                {result.bestBook || 'n/a'} {result.bestBookOdds != null ? `(${formatOdds(result.bestBookOdds)})` : ''}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Model</p>
              <p className="text-lg font-semibold">
                {(result.correlatedProbability * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-white/50">
                Independent {(result.independentProbability * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Market implied</p>
              <p className="text-lg font-semibold">
                {result.marketImpliedProbability != null
                  ? `${(result.marketImpliedProbability * 100).toFixed(1)}%`
                  : 'n/a'}
              </p>
              <p className="text-xs text-white/50">
                Fair odds {result.impliedOdds != null ? formatOdds(result.impliedOdds) : 'n/a'}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-white/50">Confidence</p>
              <p className="text-lg font-semibold capitalize">{result.confidence}</p>
              <p className="text-xs text-white/50">Model + market blended view</p>
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.25em] text-white/50">Leg breakdown</p>
            {result.legs.map((leg, idx) => (
              <div key={`${leg.description}-${idx}`} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <p className="text-sm font-semibold">{leg.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/60">
                  <span>
                    Model {((leg.modelProbability ?? leg.probability) * 100).toFixed(1)}%
                  </span>
                  <span>Implied {leg.impliedProbability != null ? `${(leg.impliedProbability * 100).toFixed(1)}%` : 'n/a'}</span>
                  <span>Edge {leg.edge != null ? `${(leg.edge * 100).toFixed(1)}%` : 'n/a'}</span>
                  <span>Book {leg.book || 'n/a'}</span>
                  <span>Odds {formatOdds(leg.marketOdds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
