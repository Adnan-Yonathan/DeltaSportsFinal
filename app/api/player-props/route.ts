import { NextRequest, NextResponse } from 'next/server'
import { fetchOdds, fetchPlayerProps, mapBookmakersIO, fetchEventsIO, fetchMultiEventOdds } from '@/lib/api/odds-api'
import { searchPlayer } from '@/lib/sports-stats-api'
import type { RosterPlayer } from '@/lib/sports-stats-api'
import { resolveSportKey } from '@/lib/utils/live-game'
import type { OddsGame } from '@/lib/types/odds'

interface PropOdds {
  book: string
  odds: number
}

interface PropMarket {
  line: number
  over: {
    best: number
    bestBook: string
    allBooks: PropOdds[]
  }
  under: {
    best: number
    bestBook: string
    allBooks: PropOdds[]
  }
}

interface PlayerProp {
  player: string
  team?: string
  teamAbbr?: string
  position?: string
  game?: string
  markets: Record<string, PropMarket>
}

const SUPPORTED_PROP_SPORTS = new Set([
  'basketball_nba',
  'americanfootball_nfl',
  'baseball_mlb',
  'icehockey_nhl',
])

const DEFAULT_MARKETS: Record<string, string[]> = {
  basketball_nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  americanfootball_nfl: ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions'],
  baseball_mlb: ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored'],
  icehockey_nhl: ['player_points', 'player_shots_on_goal', 'player_blocked_shots'],
}

const CACHE_TTL_MS = 60 * 1000
type CacheEntry = { expires: number; data: OddsGame[] }
const oddsCache = new Map<string, CacheEntry>()
const playerLookupCache = new Map<string, Promise<RosterPlayer | null>>()

const SAFE_PROP_BOOKMAKERS = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365']

const normalizeSportKey = (raw: string) => {
  const resolved = resolveSportKey(raw)
  if (resolved && SUPPORTED_PROP_SPORTS.has(resolved)) {
    return resolved
  }
  const lowered = raw.trim().toLowerCase()
  return SUPPORTED_PROP_SPORTS.has(lowered) ? lowered : null
}

const cacheKeyFor = (
  sport: string,
  markets: string[],
  teamFilter?: string[],
  playerFilter?: string[]
) =>
  `${sport}:${markets.slice().sort().join(',')}:${teamFilter?.slice().sort().join(',') || 'all'}:${playerFilter?.slice().sort().join(',') || 'all'}`

async function getCachedOdds(
  sport: string,
  markets: string[],
  teamFilter?: string[],
  playerFilter?: string[]
): Promise<OddsGame[]> {
  const key = cacheKeyFor(sport, markets, teamFilter, playerFilter)
  const cached = oddsCache.get(key)
  if (cached && cached.expires > Date.now()) {
    console.log(`[PLAYER_PROPS] Cache hit for ${key}`)
    return cached.data
  }

  // Try fetching by eventId (per provider docs)
  try {
    const events = await fetchEventsIO(sport, { status: 'pending' })
    const filteredEvents = teamFilter && teamFilter.length
      ? events.filter(ev => {
          const home = (ev.home || '').toLowerCase()
          const away = (ev.away || '').toLowerCase()
          return teamFilter.some(t => {
            const lower = t.toLowerCase()
            return home.includes(lower) || away.includes(lower)
          })
        })
      : events

    const eventIds = filteredEvents.slice(0, 10).map(ev => String(ev.id))
    if (eventIds.length) {
      const eventOdds = await fetchMultiEventOdds(eventIds, null, { cache: 'no-store' }, markets)
      const games: OddsGame[] = eventOdds.map((ev: any) => {
        const bookmakers = mapBookmakersIO(ev.bookmakers || {}, ev.home || '', ev.away || '', markets)
        return {
          id: String(ev.id),
          sport_key: sport,
          sport_title: ev.league?.toString() || '',
          commence_time: String(ev.date || ''),
          home_team: String(ev.home || ''),
          away_team: String(ev.away || ''),
          bookmakers,
        }
      })
      if (games.length) {
        oddsCache.set(key, { data: games, expires: Date.now() + CACHE_TTL_MS })
        return games
      }
    }
  } catch (err) {
    console.warn('[PLAYER_PROPS] Event-based props fetch failed, falling back:', err instanceof Error ? err.message : err)
  }

  // Prefer dedicated player-props endpoint when available, fall back to odds
  try {
    const playerProps = await fetchPlayerProps(sport, markets, {
      teamFilter,
      playerFilter: playerFilter && playerFilter.length ? playerFilter : undefined,
    })

    const games: OddsGame[] = playerProps.map((ev) => {
      const bookmakers = mapBookmakersIO(ev.bookmakers || {}, ev.home || '', ev.away || '', markets)
      return {
        id: String(ev.id),
        sport_key: sport,
        sport_title: ev.league?.toString() || '',
        commence_time: String(ev.date || ''),
        home_team: String(ev.home || ''),
        away_team: String(ev.away || ''),
        bookmakers,
      }
    })

    if (games.length) {
      oddsCache.set(key, { data: games, expires: Date.now() + CACHE_TTL_MS })
      return games
    }
  } catch (err) {
    console.warn('[PLAYER_PROPS] Player-props endpoint failed, falling back to odds:', err instanceof Error ? err.message : err)
  }

  const tryFetch = async (live: boolean) => {
    console.log(`[PLAYER_PROPS] Cache miss, fetching odds for ${key}${live ? ':live' : ':prematch'}`)
    const fresh = await fetchOdds(sport, markets, {
      live,
      teamFilter,
      bookmakers: SAFE_PROP_BOOKMAKERS,
    })
    oddsCache.set(key, { data: fresh, expires: Date.now() + CACHE_TTL_MS })
    return fresh
  }

  let games = await tryFetch(false)
  if (!games.length) {
    games = await tryFetch(true)
  }

  if (!games.length) {
    console.warn(`[PLAYER_PROPS] No props returned for ${key}`)
  }

  return games
}

const playerCacheKey = (sport: string, player: string) =>
  `${sport}:${player.toLowerCase()}`

function getPlayerLookup(sport: string, playerName: string) {
  const key = playerCacheKey(sport, playerName)
  if (!playerLookupCache.has(key)) {
    playerLookupCache.set(
      key,
      searchPlayer(playerName, sport).catch((error) => {
        console.error(`Player lookup failed for ${playerName} (${sport}):`, error)
        return null
      })
    )
  }
  return playerLookupCache.get(key)!
}

const stripPlayerName = (value?: string | null) => {
  if (!value) return ''
  return value.replace(/\b(over|under)\b.*$/i, '').trim()
}

const inferDirection = (outcome: any, index: number): 'over' | 'under' => {
  const label = `${outcome.description ?? ''} ${outcome.name ?? ''}`.toLowerCase()
  if (label.includes('under') || label.includes('less')) return 'under'
  if (label.includes('over') || label.includes('more')) return 'over'
  return index === 0 ? 'over' : 'under'
}

const isBetterOdds = (current: number, candidate: number): boolean => {
  if (!Number.isFinite(candidate)) return false
  if (current === Number.NEGATIVE_INFINITY) return true
  if (candidate >= 0 && current >= 0) return candidate > current
  if (candidate >= 0 && current < 0) return true
  if (candidate < 0 && current < 0) return candidate > current
  return false
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const playerFilter = searchParams.get('player')
    const marketParam = searchParams.get('market')
    const teamParam = searchParams.get('team')

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    const normalizedSport = normalizeSportKey(sport)
    if (!normalizedSport) {
      return NextResponse.json(
        {
          error: `Unsupported sport "${sport}". Supported options: ${Array.from(
            SUPPORTED_PROP_SPORTS
          ).join(', ')}`,
        },
        { status: 400 }
      )
    }

    // Determine which prop markets to fetch
    let markets: string[]
    if (marketParam) {
      markets = marketParam.split(',').map(m => `player_${m.trim()}`)
    } else {
      markets = DEFAULT_MARKETS[normalizedSport] || ['player_points']
    }

    // Parse team filter (comma-separated list of teams)
    const teamFilter = teamParam
      ? teamParam.split(',').map(t => t.trim()).filter(Boolean)
      : undefined

    if (teamFilter && teamFilter.length > 0) {
      console.log(`[PLAYER_PROPS] Filtering to teams: ${teamFilter.join(', ')}`)
    }

    // Fetch odds data with only prop markets (cached briefly)
    const oddsData = await getCachedOdds(
      normalizedSport,
      markets,
      teamFilter,
      playerFilter ? [playerFilter] : undefined
    )

    // Aggregate props by player
    const playerPropsMap = new Map<string, PlayerProp>()

    for (const game of oddsData) {
      const gameDescription = `${game.away_team} @ ${game.home_team}`

      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          if (!market.key.startsWith('player_')) continue

          const marketType = market.key.replace('player_', '')

          market.outcomes.forEach((outcome, index) => {
            const rawName = stripPlayerName(outcome.name)
            const playerName = rawName || outcome.name || 'Unknown Player'

            if (
              playerFilter &&
              !playerName.toLowerCase().includes(playerFilter.toLowerCase())
            ) {
              return
            }

            if (!playerPropsMap.has(playerName)) {
              playerPropsMap.set(playerName, {
                player: playerName,
                game: gameDescription,
                markets: {},
              })
            }

            const playerProp = playerPropsMap.get(playerName)!

            if (!playerProp.markets[marketType]) {
              playerProp.markets[marketType] = {
                line: outcome.point ?? 0,
                over: {
                  best: Number.NEGATIVE_INFINITY,
                  bestBook: '',
                  allBooks: [],
                },
                under: {
                  best: Number.NEGATIVE_INFINITY,
                  bestBook: '',
                  allBooks: [],
                },
              }
            }

            const marketData = playerProp.markets[marketType]
            if (outcome.point !== undefined) {
              marketData.line = outcome.point
            }

            const direction = inferDirection(outcome, index)
            const bucket = marketData[direction]

            bucket.allBooks.push({
              book: bookmaker.title,
              odds: outcome.price,
            })

            if (isBetterOdds(bucket.best, outcome.price)) {
              bucket.best = outcome.price
              bucket.bestBook = bookmaker.title
            }
          })
        }
      }
    }

    // Convert map to array and enrich with player data
    const playerProps = await Promise.all(
      Array.from(playerPropsMap.values()).map(async (prop) => {
        const playerData = await getPlayerLookup(normalizedSport, prop.player)
        if (playerData) {
          prop.team = playerData.team
          prop.teamAbbr = playerData.teamAbbr
          prop.position = playerData.position
        }
        return prop
      })
    )

    // Sort by player name
    playerProps.sort((a, b) => a.player.localeCompare(b.player))

    return NextResponse.json({
      sport: normalizedSport,
      count: playerProps.length,
      data: playerProps
    })

  } catch (error: any) {
    console.error('Player props API error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch player props', details: error.message },
      { status: 500 }
    )
  }
}
