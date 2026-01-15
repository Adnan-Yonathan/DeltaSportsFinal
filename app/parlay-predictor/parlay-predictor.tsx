'use client'

import { useEffect, useMemo, useState } from 'react'
import PlayerPropSelector from './player-prop-selector'

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
  legType: 'game' | 'player_prop'
  sport?: string
  gameId?: string
  // Game bet fields
  market?: MarketType
  selectionKey?: string
  // Player prop fields
  playerName?: string
  playerTeam?: string
  propMarket?: string
  propDirection?: 'over' | 'under'
  propLine?: number
  propOdds?: number
  propBook?: string
  propProjection?: number
  propEdge?: number
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

type SharpTrade = {
  id: string
  marketTitle: string
  outcome: string
  sport: string
  timestamp: string
  sharpStrength?: number
  notional?: number
}

const NHL_ENABLED = false
const SPORTS = [
  { value: 'americanfootball_nfl', label: 'NFL' },
  { value: 'basketball_nba', label: 'NBA' },
  { value: 'basketball_ncaab', label: 'NCAAB' },
  { value: 'americanfootball_ncaaf', label: 'CFB' },
  { value: 'icehockey_nhl', label: 'NHL', disabled: !NHL_ENABLED },
]

const PROP_LABELS: Record<string, string> = {
  points: 'PTS',
  rebounds: 'REB',
  assists: 'AST',
  threes: '3PM',
  pra: 'PRA',
  passing_yards: 'Pass Yds',
  passing_tds: 'Pass TDs',
  rushing_yards: 'Rush Yds',
  receiving_yards: 'Rec Yds',
  receptions: 'Receptions',
}

const createLeg = (): LegState => ({
  id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
  legType: 'game',
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

const formatSharpPercent = (value?: number) => {
  if (!Number.isFinite(value)) return 'n/a'
  return `${Math.round(value as number)}%`
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
  const [sharpBets, setSharpBets] = useState<SharpTrade[]>([])
  const [sharpLoading, setSharpLoading] = useState(false)
  const [sharpError, setSharpError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const loadSharps = async () => {
      setSharpLoading(true)
      setSharpError(null)
      try {
        const res = await fetch('/api/whale-detector?minNotional=2000&limit=200', {
          cache: 'no-store',
        })
        const payload = await res.json()
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load sharp bets.')
        }
        const trades = Array.isArray(payload?.trades) ? payload.trades : []
        if (active) {
          setSharpBets(trades)
        }
      } catch (err: any) {
        if (active) {
          setSharpError(err?.message || 'Failed to load sharp bets.')
        }
      } finally {
        if (active) setSharpLoading(false)
      }
    }

    loadSharps()
    const interval = setInterval(loadSharps, 60000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [])

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

  const topSharps = useMemo(() => {
    return sharpBets
      .filter((trade) => Number.isFinite(trade.sharpStrength))
      .sort((a, b) => (b.sharpStrength ?? 0) - (a.sharpStrength ?? 0))
      .slice(0, 10)
  }, [sharpBets])

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
    if (mode === 'multi' && !leg.sport) return false

    if (leg.legType === 'player_prop') {
      // Player prop requires: player, market, direction, line, odds
      if (!leg.playerName || !leg.propMarket || !leg.propDirection) return false
      if (leg.propLine == null || leg.propOdds == null) return false
      return true
    }

    // Game bet requires: game, market, selection
    if (!leg.gameId || !leg.market || !leg.selectionKey) return false
    return true
  })

  const handleProject = async () => {
    if (!canProject) return
    setProjecting(true)
    setError(null)
    setResult(null)

    try {
      const payloadLegs = legs.map((leg) => {
        const legSport = mode === 'multi' ? leg.sport : sport

        // Handle player prop legs
        if (leg.legType === 'player_prop') {
          return {
            type: 'player_prop',
            playerName: leg.playerName,
            propType: leg.propMarket,
            threshold: leg.propLine,
            propDirection: leg.propDirection,
            marketOdds: leg.propOdds,
            sport: legSport,
          }
        }

        // Handle game bet legs
        const game = mode === 'multi'
          ? gameBySportId.get(leg.gameId || '')
          : gameById.get(leg.gameId || '')
        const selections = buildSelections(game, leg.market)
        const selection = selections.find((item) => item.key === leg.selectionKey)

        if (!game || !selection) {
          throw new Error('Missing selection data for one or more legs.')
        }

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
    <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50">
            Mode
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`rounded-full border px-3 py-1.5 text-[10px] sm:text-xs uppercase tracking-[0.15em] ${
                mode === 'single'
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              Single
            </button>
            <button
              type="button"
              onClick={() => setMode('multi')}
              className={`rounded-full border px-3 py-1.5 text-[10px] sm:text-xs uppercase tracking-[0.15em] ${
                mode === 'multi'
                  ? 'border-emerald-400/60 bg-emerald-500/10 text-emerald-200'
                  : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
              }`}
            >
              Multi
            </button>
          </div>
        </div>
        {mode === 'single' && (
          <div className="flex items-center gap-2">
            <label className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50">
              Sport
            </label>
            <select
              value={sport}
              onChange={(event) => setSport(event.target.value)}
              className="rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-xs sm:text-sm text-white"
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
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/50">
              Sharpest bets right now
            </p>
            <p className="text-sm text-white/70">
              Top 10 by sharp % from the Sharp Detector.
            </p>
          </div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {sharpLoading ? 'Updating...' : 'Live'}
          </span>
        </div>
        {sharpError ? (
          <div className="mt-3 text-xs text-red-200">{sharpError}</div>
        ) : topSharps.length === 0 ? (
          <div className="mt-3 text-xs text-white/50">
            No sharp bets detected yet.
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {topSharps.map((trade) => (
              <div
                key={trade.id}
                className="rounded-xl border border-white/10 bg-black/40 p-3"
              >
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span className="uppercase tracking-[0.2em]">{trade.sport}</span>
                  <span className="text-emerald-200">
                    {formatSharpPercent(trade.sharpStrength)}
                  </span>
                </div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {trade.outcome}
                </div>
                <div className="mt-1 text-[11px] text-white/50">
                  {trade.marketTitle}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {mode === 'single' && !loading && games.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/60">
          No matchups found for today. Try another sport or refresh later.
        </div>
      )}

      <div className="space-y-3 sm:space-y-4">
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
              className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs sm:text-sm font-semibold">Leg {index + 1}</p>
                {legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(leg.id)}
                    className="text-[10px] sm:text-xs uppercase tracking-[0.15em] text-white/50 hover:text-white"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Leg type toggle */}
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => updateLeg(leg.id, {
                    legType: 'game',
                    playerName: undefined,
                    propMarket: undefined,
                    propDirection: undefined,
                    propLine: undefined,
                    propOdds: undefined,
                  })}
                  className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
                    leg.legType === 'game'
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
                  }`}
                >
                  Game Bet
                </button>
                <button
                  type="button"
                  onClick={() => updateLeg(leg.id, {
                    legType: 'player_prop',
                    gameId: undefined,
                    market: undefined,
                    selectionKey: undefined,
                  })}
                  className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
                    leg.legType === 'player_prop'
                      ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
                  }`}
                >
                  Player Prop
                </button>
              </div>

              {/* Game bet UI */}
              {leg.legType === 'game' && (
              <>
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
                  <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 text-xs sm:text-sm text-white/60">
                    No lines available for this market.
                  </div>
                ) : (
                  <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-black/40">
                    <div className="hidden sm:grid grid-cols-[minmax(0,1.4fr)_80px_80px_minmax(0,1fr)_60px] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
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
                            className={`w-full text-left transition ${
                              isSelected ? 'bg-emerald-500/10' : 'hover:bg-white/5'
                            }`}
                          >
                            {/* Mobile layout */}
                            <div className="sm:hidden px-3 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-sm font-semibold text-white">{option.name}</span>
                                <span className={`text-[10px] uppercase tracking-[0.1em] ${isSelected ? 'text-emerald-300' : 'text-white/40'}`}>
                                  {isSelected ? 'Selected' : 'Pick'}
                                </span>
                              </div>
                              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-white/60">
                                {option.line != null && <span>Line {formatLine(option.line)}</span>}
                                <span>{formatOdds(option.odds)}</span>
                                <span className="text-white/40">{option.book || 'n/a'}</span>
                              </div>
                            </div>
                            {/* Desktop layout */}
                            <div className="hidden sm:grid gap-2 px-3 py-3 grid-cols-[minmax(0,1.4fr)_80px_80px_minmax(0,1fr)_60px] text-[13px]">
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
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
              </>
              )}

              {/* Player prop UI */}
              {leg.legType === 'player_prop' && (
                <PlayerPropSelector
                  sport={mode === 'multi' ? leg.sport : sport}
                  games={mode === 'multi' && leg.sport ? gamesBySport[leg.sport] || [] : games}
                  selectedPlayer={leg.playerName}
                  selectedProp={leg.propMarket}
                  selectedDirection={leg.propDirection}
                  onSelect={(selection) => {
                    updateLeg(leg.id, {
                      playerName: selection.playerName,
                      playerTeam: selection.team,
                      propMarket: selection.propMarket,
                      propDirection: selection.direction,
                      propLine: selection.line,
                      propOdds: selection.odds,
                      propBook: selection.book,
                      propProjection: selection.projection,
                      propEdge: selection.edge,
                      gameId: selection.gameId,
                    })
                  }}
                  onSportChange={mode === 'multi' ? (newSport) => {
                    updateLeg(leg.id, { sport: newSport })
                    loadGamesForSport(newSport)
                  } : undefined}
                  showSportSelector={mode === 'multi'}
                />
              )}

              {/* Selected player prop display */}
              {leg.legType === 'player_prop' && leg.playerName && leg.propMarket && leg.propDirection && (
                <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        {leg.playerName} {leg.propDirection === 'over' ? 'Over' : 'Under'} {leg.propLine} {PROP_LABELS[leg.propMarket] || leg.propMarket}
                      </p>
                      <p className="mt-1 text-xs text-white/60">
                        {leg.propBook} | {formatOdds(leg.propOdds)}
                      </p>
                    </div>
                    {leg.propProjection != null && (
                      <div className="text-right">
                        <p className="text-xs text-white/50">Projection</p>
                        <p className="text-sm font-semibold text-emerald-200">
                          {leg.propProjection.toFixed(1)}
                          {leg.propEdge != null && (
                            <span className={`ml-2 ${leg.propEdge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {leg.propEdge > 0 ? '+' : ''}{leg.propEdge.toFixed(1)}%
                            </span>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          type="button"
          onClick={addLeg}
          className="rounded-full border border-white/20 px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/70 hover:border-white/40 hover:text-white"
        >
          + Add leg
        </button>
        <button
          type="button"
          onClick={handleProject}
          disabled={!canProject || projecting}
          className="rounded-full bg-emerald-500/80 px-4 sm:px-5 py-1.5 sm:py-2 text-[10px] sm:text-xs uppercase tracking-[0.2em] text-black font-semibold transition disabled:cursor-not-allowed disabled:bg-emerald-500/30"
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
        <div className="rounded-xl sm:rounded-2xl border border-white/10 bg-white/5 p-3 sm:p-5 space-y-3 sm:space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50">Parlay edge</p>
              <p className="text-lg sm:text-xl font-semibold">
                {result.parlayEdge != null
                  ? `${(result.parlayEdge * 100).toFixed(1)}%`
                  : 'n/a'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50">Best book</p>
              <p className="text-xs sm:text-sm text-white/80">
                {result.bestBook || 'n/a'} {result.bestBookOdds != null ? `(${formatOdds(result.bestBookOdds)})` : ''}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/30 p-2 sm:p-4">
              <p className="text-[9px] sm:text-xs uppercase tracking-[0.15em] text-white/50">Model</p>
              <p className="text-sm sm:text-lg font-semibold">
                {(result.correlatedProbability * 100).toFixed(1)}%
              </p>
              <p className="hidden sm:block text-xs text-white/50">
                Independent {(result.independentProbability * 100).toFixed(1)}%
              </p>
            </div>
            <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/30 p-2 sm:p-4">
              <p className="text-[9px] sm:text-xs uppercase tracking-[0.15em] text-white/50">Implied</p>
              <p className="text-sm sm:text-lg font-semibold">
                {result.marketImpliedProbability != null
                  ? `${(result.marketImpliedProbability * 100).toFixed(1)}%`
                  : 'n/a'}
              </p>
              <p className="hidden sm:block text-xs text-white/50">
                Fair {result.impliedOdds != null ? formatOdds(result.impliedOdds) : 'n/a'}
              </p>
            </div>
            <div className="rounded-lg sm:rounded-xl border border-white/10 bg-black/30 p-2 sm:p-4">
              <p className="text-[9px] sm:text-xs uppercase tracking-[0.15em] text-white/50">Confidence</p>
              <p className="text-sm sm:text-lg font-semibold capitalize">{result.confidence}</p>
              <p className="hidden sm:block text-xs text-white/50">Blended view</p>
            </div>
          </div>
          <div className="space-y-2 sm:space-y-3">
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.2em] text-white/50">Leg breakdown</p>
            {result.legs.map((leg, idx) => (
              <div key={`${leg.description}-${idx}`} className="rounded-lg sm:rounded-xl border border-white/10 bg-black/30 p-2.5 sm:p-4">
                <p className="text-xs sm:text-sm font-semibold">{leg.description}</p>
                <div className="mt-1.5 sm:mt-2 flex flex-wrap gap-2 sm:gap-3 text-[10px] sm:text-xs text-white/60">
                  <span>
                    Model {((leg.modelProbability ?? leg.probability) * 100).toFixed(1)}%
                  </span>
                  <span>Implied {leg.impliedProbability != null ? `${(leg.impliedProbability * 100).toFixed(1)}%` : 'n/a'}</span>
                  <span className="hidden sm:inline">Edge {leg.edge != null ? `${(leg.edge * 100).toFixed(1)}%` : 'n/a'}</span>
                  <span>{leg.book || 'n/a'} {formatOdds(leg.marketOdds)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
