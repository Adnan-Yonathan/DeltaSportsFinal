'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

type MatchupGame = {
  gameId: string
  game: string
  label: string
  homeTeam: string
  awayTeam: string
  commence_time: string
}

export type PlayerPropSelection = {
  playerName: string
  team: string
  propMarket: string
  direction: 'over' | 'under'
  line: number
  odds: number
  book: string
  projection?: number
  edge?: number
  gameId?: string
}

type PlayerPropData = {
  name: string
  team: string
  teamAbbr: string
  position: string
  props: Record<string, {
    line: number
    overOdds?: number
    underOdds?: number
    book?: string
  }>
  projections?: Record<string, number>
  delta?: Record<string, number>
  edge?: Record<string, number>
}

type DailyProjectionsResponse = {
  sport: string
  players: Array<{
    id: string
    name: string
    team: string
    teamAbbr: string
    position: string
    game: string
    projections: Record<string, number | null>
    marketLines?: Record<string, {
      line: number
      overOdds?: number
      underOdds?: number
      bestBook?: string
    }>
    delta?: Record<string, number | null>
    edge?: Record<string, number | null>
  }>
  games: Array<{
    gameId: string
    matchup: string
    startTime: string
  }>
}

const SPORTS = [
  { value: 'americanfootball_nfl', label: 'NFL' },
  { value: 'basketball_nba', label: 'NBA' },
  { value: 'basketball_ncaab', label: 'NCAAB' },
  { value: 'americanfootball_ncaaf', label: 'CFB' },
]

const NFL_POSITIONS = ['All', 'QB', 'RB', 'WR', 'TE', 'K'] as const
const NBA_POSITIONS = ['All', 'G', 'F', 'C'] as const

const PROP_MARKETS_BY_SPORT: Record<string, readonly string[]> = {
  americanfootball_nfl: ['passing_yards', 'passing_tds', 'rushing_yards', 'receiving_yards', 'receptions'],
  basketball_nba: ['points', 'rebounds', 'assists', 'threes', 'pra'],
  basketball_ncaab: ['points', 'rebounds', 'assists'],
  americanfootball_ncaaf: ['passing_yards', 'rushing_yards', 'receiving_yards'],
}

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
  receptions: 'REC',
}

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${odds}` : `${odds}`
}

interface PlayerPropSelectorProps {
  sport?: string
  games: MatchupGame[]
  selectedPlayer?: string
  selectedProp?: string
  selectedDirection?: 'over' | 'under'
  onSelect: (selection: PlayerPropSelection) => void
  onSportChange?: (sport: string) => void
  showSportSelector?: boolean
}

export default function PlayerPropSelector({
  sport,
  games,
  selectedPlayer,
  selectedProp,
  selectedDirection,
  onSelect,
  onSportChange,
  showSportSelector = false,
}: PlayerPropSelectorProps) {
  const [selectedGameId, setSelectedGameId] = useState<string>('')
  const [positionFilter, setPositionFilter] = useState<string>('All')
  const [teamFilter, setTeamFilter] = useState<string>('All')
  const [players, setPlayers] = useState<PlayerPropData[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null)
  const [projectionsData, setProjectionsData] = useState<DailyProjectionsResponse | null>(null)
  const [projectionsError, setProjectionsError] = useState<string | null>(null)

  const isNfl = sport?.includes('nfl') || sport?.includes('ncaaf')
  const positions = isNfl ? NFL_POSITIONS : NBA_POSITIONS
  const propMarkets = sport ? PROP_MARKETS_BY_SPORT[sport] || [] : []

  // Get teams for the selected game
  const gameTeams = useMemo(() => {
    if (!selectedGameId) return []
    const selectedGame = games.find(g => g.gameId === selectedGameId)
    if (!selectedGame) return []
    return [
      { abbr: selectedGame.awayTeam, label: selectedGame.awayTeam },
      { abbr: selectedGame.homeTeam, label: selectedGame.homeTeam },
    ]
  }, [selectedGameId, games])

  // Fetch projections data when sport changes
  useEffect(() => {
    if (!sport) return

    // Clear stale data when sport changes
    setProjectionsData(null)
    setProjectionsError(null)

    const fetchProjections = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/daily-projections?sport=${sport}`)
        const data = await res.json()
        if (res.ok) {
          setProjectionsData(data)
          setProjectionsError(null)
        } else {
          // Handle API errors (e.g., unsupported sport)
          setProjectionsError(data.error || 'Failed to load player projections')
          setProjectionsData(null)
        }
      } catch (err) {
        console.error('Failed to fetch projections:', err)
        setProjectionsError('Failed to load player projections')
        setProjectionsData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchProjections()
  }, [sport])

  // Build players list from projections data filtered by selected game
  const filteredPlayers = useMemo(() => {
    if (!projectionsData?.players || !selectedGameId) return []

    // Find the selected game
    const selectedGame = games.find(g => g.gameId === selectedGameId)
    if (!selectedGame) return []

    // Normalize team abbreviations for matching
    const normalize = (s: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    // Get both team abbreviations from the selected game
    const homeTeamNorm = normalize(selectedGame.homeTeam)
    const awayTeamNorm = normalize(selectedGame.awayTeam)
    const gameMatchupNorm = normalize(selectedGame.game)

    // Filter players by game and position
    return projectionsData.players
      .filter(player => {
        // Match by team abbreviation and full team name
        const playerTeamAbbr = normalize(player.teamAbbr || '')
        const playerTeamFull = normalize(player.team || '')
        const playerGameNorm = normalize(player.game)

        // Check if player's team matches either team in the game
        // Use both abbreviation and full team name for matching
        const matchesTeam =
          // Exact matches
          playerTeamFull === homeTeamNorm ||
          playerTeamFull === awayTeamNorm ||
          // Abbreviation in full name (e.g., "cle" in "clevelandcavaliers")
          homeTeamNorm.includes(playerTeamAbbr) ||
          awayTeamNorm.includes(playerTeamAbbr) ||
          // Full name contains abbreviation check (rarely matches but harmless)
          playerTeamAbbr.includes(homeTeamNorm) ||
          playerTeamAbbr.includes(awayTeamNorm) ||
          // Full team name substring matches
          playerTeamFull.includes(homeTeamNorm) ||
          playerTeamFull.includes(awayTeamNorm) ||
          homeTeamNorm.includes(playerTeamFull) ||
          awayTeamNorm.includes(playerTeamFull)

        // Also try matching by game string from projections (e.g., "LAR @ CAR")
        // with the full game matchup string (e.g., "losangelesramscarolinapanthers")
        const matchesGameStr = playerGameNorm && (
          playerGameNorm.includes(homeTeamNorm) ||
          playerGameNorm.includes(awayTeamNorm) ||
          gameMatchupNorm.includes(playerTeamAbbr) ||
          gameMatchupNorm.includes(playerTeamFull)
        )

        if (!matchesTeam && !matchesGameStr) return false

        // Team filter
        if (teamFilter !== 'All') {
          const teamFilterNorm = normalize(teamFilter)
          const matchesTeamFilter =
            playerTeamAbbr === teamFilterNorm ||
            playerTeamFull === teamFilterNorm ||
            playerTeamAbbr.includes(teamFilterNorm) ||
            playerTeamFull.includes(teamFilterNorm) ||
            teamFilterNorm.includes(playerTeamAbbr)
          if (!matchesTeamFilter) {
            return false
          }
        }

        // Position filter
        if (positionFilter !== 'All') {
          const pos = player.position?.toUpperCase() || ''
          if (isNfl) {
            if (pos !== positionFilter) return false
          } else {
            // NBA position matching
            if (positionFilter === 'G' && !['G', 'PG', 'SG'].includes(pos)) return false
            if (positionFilter === 'F' && !['F', 'SF', 'PF'].includes(pos)) return false
            if (positionFilter === 'C' && pos !== 'C') return false
          }
        }

        return true
      })
      .map(player => ({
        name: player.name,
        team: player.team,
        teamAbbr: player.teamAbbr,
        position: player.position,
        props: Object.fromEntries(
          Object.entries(player.marketLines || {}).map(([key, line]) => [
            key,
            {
              line: line.line,
              overOdds: line.overOdds,
              underOdds: line.underOdds,
              book: line.bestBook,
            }
          ])
        ),
        projections: Object.fromEntries(
          Object.entries(player.projections || {})
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, v as number])
        ),
        delta: Object.fromEntries(
          Object.entries(player.delta || {})
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, v as number])
        ),
        edge: Object.fromEntries(
          Object.entries(player.edge || {})
            .filter(([, v]) => v != null)
            .map(([k, v]) => [k, v as number])
        ),
      }))
      .sort((a, b) => {
        // Sort by position priority for NFL
        if (isNfl) {
          const posOrder: Record<string, number> = { QB: 1, RB: 2, WR: 3, TE: 4, K: 5 }
          const posA = posOrder[a.position] ?? 99
          const posB = posOrder[b.position] ?? 99
          if (posA !== posB) return posA - posB
        }
        return a.name.localeCompare(b.name)
      })
  }, [projectionsData, selectedGameId, games, positionFilter, teamFilter, isNfl])

  const handlePropSelect = useCallback((
    player: PlayerPropData,
    propKey: string,
    direction: 'over' | 'under'
  ) => {
    const prop = player.props[propKey]
    if (!prop) return

    const projection = player.projections?.[propKey]
    const edge = player.edge?.[propKey]

    onSelect({
      playerName: player.name,
      team: player.teamAbbr || player.team,
      propMarket: propKey,
      direction,
      line: prop.line,
      odds: direction === 'over' ? (prop.overOdds || -110) : (prop.underOdds || -110),
      book: prop.book || 'Best',
      projection,
      edge,
      gameId: selectedGameId,
    })
  }, [onSelect, selectedGameId])

  // Reset filters when sport changes
  useEffect(() => {
    setPositionFilter('All')
    setTeamFilter('All')
    setSelectedGameId('')
  }, [sport])

  // Reset team filter when game changes
  useEffect(() => {
    setTeamFilter('All')
  }, [selectedGameId])

  return (
    <div className="mt-4 space-y-4">
      {/* Sport selector (for multi-sport mode) */}
      {showSportSelector && onSportChange && (
        <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
          Sport
          <select
            value={sport || ''}
            onChange={(e) => onSportChange(e.target.value)}
            className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
          >
            <option value="" disabled>Select sport</option>
            {SPORTS.map((item) => (
              <option key={item.value} value={item.value} className="bg-black">
                {item.label}
              </option>
            ))}
          </select>
        </label>
      )}

      {/* Game selector */}
      <label className="flex flex-col gap-2 text-xs uppercase tracking-[0.2em] text-white/50">
        Game
        <select
          value={selectedGameId}
          onChange={(e) => {
            setSelectedGameId(e.target.value)
            setExpandedPlayer(null)
          }}
          className="rounded-xl border border-white/20 bg-black/40 px-3 py-2 text-sm text-white"
        >
          <option value="" disabled>Select game</option>
          {games.map((game) => (
            <option key={game.gameId} value={game.gameId} className="bg-black">
              {game.label}
            </option>
          ))}
        </select>
      </label>

      {/* Filters row: Position tabs + Team dropdown */}
      {selectedGameId && (
        <div className="flex flex-wrap items-center gap-4">
          {/* Position filter tabs */}
          <div className="flex flex-wrap gap-2">
            {positions.map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => setPositionFilter(pos)}
                className={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] transition ${
                  positionFilter === pos
                    ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                    : 'border-white/20 text-white/60 hover:border-white/40 hover:text-white'
                }`}
            >
              {pos}
            </button>
          ))}
          </div>

          {/* Team filter dropdown */}
          {gameTeams.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-[0.15em] text-white/40">Team</span>
              <select
                value={teamFilter}
                onChange={(e) => setTeamFilter(e.target.value)}
                className="rounded-lg border border-white/20 bg-black/40 px-2 py-1.5 text-xs text-white"
              >
                <option value="All" className="bg-black">All</option>
                {gameTeams.map((team) => (
                  <option key={team.abbr} value={team.abbr} className="bg-black">
                    {team.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}

      {/* Players list */}
      {loading ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
          Loading players...
        </div>
      ) : projectionsError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {projectionsError}
        </div>
      ) : !selectedGameId ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
          Select a game to see available player props.
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/60">
          No players found for this game{positionFilter !== 'All' ? ` at position ${positionFilter}` : ''}.
        </div>
      ) : (
        <div className="max-h-[400px] overflow-y-auto rounded-xl border border-white/10 bg-black/30">
          <div className="divide-y divide-white/5">
            {filteredPlayers.map((player) => {
              const isExpanded = expandedPlayer === player.name
              const hasProps = Object.keys(player.props).length > 0
              const hasProjections = Object.keys(player.projections || {}).length > 0

              return (
                <div key={player.name} className="p-3">
                  {/* Player header */}
                  <button
                    type="button"
                    onClick={() => setExpandedPlayer(isExpanded ? null : player.name)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <span className="font-semibold text-white">{player.name}</span>
                      <span className="ml-2 text-xs text-white/50">
                        {player.teamAbbr || player.team} · {player.position}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasProjections && (
                        <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] text-emerald-300">
                          Projection
                        </span>
                      )}
                      <svg
                        className={`h-4 w-4 text-white/50 transition ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded props */}
                  {isExpanded && (
                    <div className="mt-3 space-y-2">
                      {propMarkets.map((propKey) => {
                        const prop = player.props[propKey]
                        const projection = player.projections?.[propKey]
                        const edge = player.edge?.[propKey]

                        // Show prop even without line if we have projection
                        if (!prop && !projection) return null

                        const line = prop?.line
                        const overSelected = selectedPlayer === player.name && selectedProp === propKey && selectedDirection === 'over'
                        const underSelected = selectedPlayer === player.name && selectedProp === propKey && selectedDirection === 'under'

                        return (
                          <div
                            key={propKey}
                            className="rounded-lg border border-white/10 bg-black/40 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold uppercase text-white/70">
                                  {PROP_LABELS[propKey] || propKey}
                                </span>
                                {line != null && (
                                  <span className="text-sm text-white">
                                    Line: {line}
                                  </span>
                                )}
                              </div>
                              {projection != null && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-white/50">Proj:</span>
                                  <span className="text-sm font-semibold text-emerald-300">
                                    {projection.toFixed(1)}
                                  </span>
                                  {edge != null && (
                                    <span className={`text-xs ${edge > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                      {edge > 0 ? '+' : ''}{edge.toFixed(1)}%
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Over/Under buttons */}
                            {prop && (
                              <div className="mt-2 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => handlePropSelect(player, propKey, 'over')}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition ${
                                    overSelected
                                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                                      : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                                  }`}
                                >
                                  <div className="font-semibold">Over {line}</div>
                                  <div className="text-white/50">{formatOdds(prop.overOdds)}</div>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handlePropSelect(player, propKey, 'under')}
                                  className={`flex-1 rounded-lg border px-3 py-2 text-xs transition ${
                                    underSelected
                                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                                      : 'border-white/20 text-white/70 hover:border-white/40 hover:text-white'
                                  }`}
                                >
                                  <div className="font-semibold">Under {line}</div>
                                  <div className="text-white/50">{formatOdds(prop.underOdds)}</div>
                                </button>
                              </div>
                            )}

                            {/* Show projection only if no line */}
                            {!prop && projection != null && (
                              <div className="mt-2 text-xs text-white/50">
                                No line available - projection only
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {!hasProps && !hasProjections && (
                        <div className="text-xs text-white/50">
                          No props or projections available for this player.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
