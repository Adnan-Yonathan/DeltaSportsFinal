import { NextRequest, NextResponse } from 'next/server'
import { fetchSbdGamePropsList, resolveSbdLeague, formatBookmaker, resolveBookSlugs } from '@/lib/api/sbd'
import { searchPlayer } from '@/lib/sports-stats-api'
import type { RosterPlayer } from '@/lib/sports-stats-api'
import { resolveSportKey } from '@/lib/utils/live-game'
import { getNbaPropProjectionsForPlayer } from '@/lib/services/nba-player-prop-model'

export const dynamic = 'force-dynamic'

interface PropOdds {
  book: string
  odds: number
  line?: number
}

interface PropMarket {
  line: number
  projection?: number
  seasonAvg?: number
  recentAvg?: number
  recentGames?: number
  delta?: number
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
  lines?: Array<{ book: string; line: number; overOdds?: number; underOdds?: number }>
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

const MARKET_TO_SBD_PROP: Record<string, string> = {
  points: 'total points (incl. overtime)',
  rebounds: 'total rebounds (incl. overtime)',
  assists: 'total assists (incl. overtime)',
  threes: 'total 3-point field goals (incl. overtime)',
  points_rebounds: 'total points plus rebounds (incl. extra overtime)',
  points_assists: 'total points plus assists (incl. extra overtime)',
  pra: 'total points plus assists plus rebounds (incl. extra overtime)',
  rebounds_assists: 'total rebounds plus assists (incl. extra overtime)',
  blocks: 'total blocks (incl. extra overtime)',
  steals: 'total steals (incl. extra overtime)',
  blocks_steals: 'total blocks plus steals (incl. extra overtime)',
}

const DEFAULT_MARKETS: Record<string, string[]> = {
  basketball_nba: [
    'points',
    'rebounds',
    'assists',
    'threes',
    'points_rebounds',
    'points_assists',
    'pra',
    'rebounds_assists',
    'blocks',
    'steals',
    'blocks_steals',
  ],
  americanfootball_nfl: ['passing_yards', 'rushing_yards', 'receiving_yards', 'receptions'],
  baseball_mlb: ['hits', 'total_bases', 'rbis', 'runs'],
  icehockey_nhl: ['points', 'shots_on_goal', 'blocked_shots'],
}

const CACHE_TTL_MS = 60 * 1000
type CacheEntry = { expires: number; data: any[] }
const gamePropsCache = new Map<string, CacheEntry>()
const playerLookupCache = new Map<string, Promise<RosterPlayer | null>>()

const EXCLUDED_BOOKS = new Set(['consensus', 'prizepicks', 'thrivefantasy', 'sleeper'])

const normalizeToken = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '')

const normalizeNameTokens = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

const matchesPlayerName = (playerName: string, filter: string): boolean => {
  const playerTokens = normalizeNameTokens(playerName)
  const filterTokens = normalizeNameTokens(filter)
  if (!filterTokens.length) return true
  if (!playerTokens.length) return false
  if (filterTokens.length === 1) {
    return playerTokens.includes(filterTokens[0])
  }
  return filterTokens.every((token) => playerTokens.includes(token))
}

const normalizeMarketKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const normalizeSbdPropName = (value: string): string => {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, '').trim()
  if (cleaned.includes('points plus assists plus rebounds')) return 'pra'
  if (cleaned.includes('points plus rebounds')) return 'points_rebounds'
  if (cleaned.includes('points plus assists')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists')) return 'rebounds_assists'
  if (cleaned.includes('blocks plus steals')) return 'blocks_steals'
  if (cleaned.includes('3-point')) return 'threes'
  if (cleaned.includes('points')) return 'points'
  if (cleaned.includes('rebounds')) return 'rebounds'
  if (cleaned.includes('assists')) return 'assists'
  if (cleaned.includes('steals')) return 'steals'
  if (cleaned.includes('blocks')) return 'blocks'
  return normalizeMarketKey(cleaned)
}

const parseOddsValue = (value: any): number | null => {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const parseLineValue = (value: any): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const lineKeyFor = (value: any): string => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed.toString() : 'no-line'
}

const createEmptyMarketBucket = (line: number): PropMarket => ({
  line,
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
})

const isBetterOdds = (current: number, candidate: number): boolean => {
  if (!Number.isFinite(candidate)) return false
  if (current === Number.NEGATIVE_INFINITY) return true
  if (candidate >= 0 && current >= 0) return candidate > current
  if (candidate >= 0 && current < 0) return true
  if (candidate < 0 && current < 0) return candidate > current
  return false
}

const pickPrimaryLine = (lineBuckets: Map<string, PropMarket>): PropMarket | null => {
  const lineMap = new Map<string, { book: string; line: number; overOdds?: number; underOdds?: number }>()
  const priority = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle', 'BetRivers']

  for (const bucket of lineBuckets.values()) {
    const line = bucket.line
    for (const entry of bucket.over.allBooks) {
      const key = `${entry.book.toLowerCase()}|${line}`
      if (!lineMap.has(key)) lineMap.set(key, { book: entry.book, line })
      const row = lineMap.get(key)!
      row.overOdds = entry.odds
      if (!Number.isFinite(row.line) || row.line === 0) row.line = entry.line ?? line
    }
    for (const entry of bucket.under.allBooks) {
      const key = `${entry.book.toLowerCase()}|${line}`
      if (!lineMap.has(key)) lineMap.set(key, { book: entry.book, line })
      const row = lineMap.get(key)!
      row.underOdds = entry.odds
      if (!Number.isFinite(row.line) || row.line === 0) row.line = entry.line ?? line
    }
  }

  const rows = Array.from(lineMap.values())
  if (!rows.length) return null

  const merged: PropMarket = {
    line: rows[0].line,
    over: { best: Number.NEGATIVE_INFINITY, bestBook: '', allBooks: [] },
    under: { best: Number.NEGATIVE_INFINITY, bestBook: '', allBooks: [] },
    lines: [],
  }

  let bestOver: { book: string; line: number; odds: number } | null = null
  let bestUnder: { book: string; line: number; odds: number } | null = null

  for (const row of rows) {
    if (Number.isFinite(row.overOdds)) {
      merged.over.allBooks.push({ book: row.book, odds: row.overOdds!, line: row.line })
      if (!bestOver || row.overOdds! > bestOver.odds) {
        bestOver = { book: row.book, line: row.line, odds: row.overOdds! }
      }
    }
    if (Number.isFinite(row.underOdds)) {
      merged.under.allBooks.push({ book: row.book, odds: row.underOdds!, line: row.line })
      if (!bestUnder || row.underOdds! > bestUnder.odds) {
        bestUnder = { book: row.book, line: row.line, odds: row.underOdds! }
      }
    }
  }

  const selected: typeof rows = []
  const used = new Set<string>()
  const pushUnique = (row: typeof rows[number]) => {
    const key = `${row.book.toLowerCase()}|${row.line}`
    if (used.has(key)) return
    selected.push(row)
    used.add(key)
  }

  if (bestOver) {
    const r = rows.find((r) => r.book === bestOver!.book && r.line === bestOver!.line)
    if (r) pushUnique(r)
  }
  if (bestUnder) {
    const r = rows.find((r) => r.book === bestUnder!.book && r.line === bestUnder!.line)
    if (r) pushUnique(r)
  }

  rows
    .sort((a, b) => {
      const aP = priority.indexOf(a.book)
      const bP = priority.indexOf(b.book)
      if (aP !== -1 && bP !== -1) return aP - bP
      if (aP !== -1) return -1
      if (bP !== -1) return 1
      if (a.line !== b.line) return (a.line ?? 0) - (b.line ?? 0)
      return a.book.localeCompare(b.book)
    })
    .forEach((r) => pushUnique(r))

  merged.lines = selected.slice(0, 6)

  if (bestOver) {
    merged.over.best = bestOver.odds
    merged.over.bestBook = bestOver.book
    merged.line = bestOver.line
  }
  if (bestUnder) {
    merged.under.best = bestUnder.odds
    merged.under.bestBook = bestUnder.book
  }

  return merged
}

const cacheKeyFor = (
  league: string,
  props?: string[],
  teamFilter?: string[],
  playerFilter?: string[],
  books?: string[]
) =>
  `${league}:${props?.slice().sort().join(',') || 'all'}:${teamFilter?.slice().sort().join(',') || 'all'}:${playerFilter?.slice().sort().join(',') || 'all'}:${books?.slice().sort().join(',') || 'all'}`

async function getCachedGameProps(
  league: string,
  props?: string[],
  teamFilter?: string[],
  playerFilter?: string[],
  books?: string[]
): Promise<any[]> {
  const key = cacheKeyFor(league, props, teamFilter, playerFilter, books)
  const cached = gamePropsCache.get(key)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const limit = props && props.length ? 2500 : 2500
  const payload = await fetchSbdGamePropsList(league as any, {
    props,
    limit,
    books,
    init: props && props.length ? undefined : { cache: 'no-store' },
  })
  const items = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : []

  const filtered = items.filter((entry: any) => {
    if (playerFilter && playerFilter.length) {
      const playerName = (entry.player_name || entry?.player?.name || '').toLowerCase()
      if (!playerFilter.some((name) => matchesPlayerName(playerName, name))) return false
    }
    if (teamFilter && teamFilter.length) {
      const home = normalizeToken(entry?.home_team?.name || '')
      const away = normalizeToken(entry?.away_team?.name || '')
      const playerTeam = normalizeToken(entry?.player?.team || '')
      if (!teamFilter.some((team) => home.includes(team) || away.includes(team) || playerTeam.includes(team))) {
        return false
      }
    }
    return true
  })

  gamePropsCache.set(key, { data: filtered, expires: Date.now() + CACHE_TTL_MS })
  return filtered
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

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const sport = searchParams.get('sport')
    const playerFilter = searchParams.get('player')
    const marketParam = searchParams.get('market')
    const teamParam = searchParams.get('team')
    const booksParam = searchParams.get('books')

    if (!sport) {
      return NextResponse.json(
        { error: 'Sport parameter is required' },
        { status: 400 }
      )
    }

    const normalizedSport = resolveSportKey(sport)
    if (!normalizedSport || !SUPPORTED_PROP_SPORTS.has(normalizedSport)) {
      return NextResponse.json(
        {
          error: `Unsupported sport "${sport}". Supported options: ${Array.from(
            SUPPORTED_PROP_SPORTS
          ).join(', ')}`,
        },
        { status: 400 }
      )
    }

    const league = resolveSbdLeague(normalizedSport)
    if (!league) {
      return NextResponse.json(
        { error: `No SportsBettingDime props feed for "${normalizedSport}"` },
        { status: 400 }
      )
    }

    const normalizedMarketParam = marketParam
      ? marketParam.split(',').map((m) => normalizeMarketKey(m.trim()))
      : []
    const wantsAllMarkets = normalizedMarketParam.includes('all')
    const requestedMarkets = wantsAllMarkets
      ? []
      : normalizedMarketParam.length
        ? normalizedMarketParam
        : DEFAULT_MARKETS[normalizedSport] || ['points']

    const propsFilter = wantsAllMarkets
      ? undefined
      : requestedMarkets
          .map((key) => MARKET_TO_SBD_PROP[key])
          .filter(Boolean)
    const propsFilterList = propsFilter ?? []

    const teamFilter = teamParam
      ? teamParam.split(',').map((t) => normalizeToken(t))
      : undefined
    const books = resolveBookSlugs(booksParam)

    const usePerMarketFetch =
      !!playerFilter && propsFilterList.length > 1 && !marketParam
    const playerFilters = playerFilter ? [playerFilter] : undefined
    const entries = usePerMarketFetch
      ? (
          await Promise.all(
            propsFilterList.map((prop) =>
              getCachedGameProps(league, [prop], teamFilter, playerFilters, books)
            )
          )
        ).flat()
      : await getCachedGameProps(
          league,
          propsFilterList.length === 1 ? propsFilterList : undefined,
          teamFilter,
          playerFilters,
          books
        )

    type PlayerPropAccumulator = Omit<PlayerProp, 'markets'> & {
      marketLines: Map<string, Map<string, PropMarket>>
    }
    const playerPropsMap = new Map<string, PlayerPropAccumulator>()

    for (const entry of entries) {
      const playerName = entry.player_name || entry?.player?.name
      if (!playerName) continue

      const marketType = normalizeSbdPropName(entry.name || '')
      if (requestedMarkets.length && !requestedMarkets.includes(marketType)) continue

      const homeTeam = entry?.home_team?.name || ''
      const awayTeam = entry?.away_team?.name || ''
      const gameDescription = homeTeam && awayTeam ? `${awayTeam} @ ${homeTeam}` : undefined

      if (!playerPropsMap.has(playerName)) {
        playerPropsMap.set(playerName, {
          player: playerName,
          game: gameDescription,
          team: entry?.player?.team || undefined,
          teamAbbr: entry?.player?.alias || entry?.player?.code || undefined,
          marketLines: new Map(),
        })
      }

      const playerProp = playerPropsMap.get(playerName)!
      if (!playerProp.marketLines.has(marketType)) {
        playerProp.marketLines.set(marketType, new Map())
      }

      const lineBuckets = playerProp.marketLines.get(marketType)!
      const sportsbooks = Array.isArray(entry?.sportsbooks) ? entry.sportsbooks : []

      for (const sportsbook of sportsbooks) {
        const name = String(sportsbook?.name || '')
        if (EXCLUDED_BOOKS.has(name.toLowerCase())) continue
        const formatted = formatBookmaker(name)
        const odds = sportsbook?.odds || {}
        const line = parseLineValue(
          odds?.over_points ?? odds?.under_points ?? sportsbook?.over_points ?? sportsbook?.under_points
        )
        const lineKey = lineKeyFor(line)
        if (!lineBuckets.has(lineKey)) {
          lineBuckets.set(lineKey, createEmptyMarketBucket(line))
        }
        const bucket = lineBuckets.get(lineKey)!

        const overOdds = parseOddsValue(odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds)
        const underOdds = parseOddsValue(odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds)

        if (Number.isFinite(overOdds)) {
          bucket.over.allBooks.push({ book: formatted.title, odds: overOdds!, line })
          if (isBetterOdds(bucket.over.best, overOdds!)) {
            bucket.over.best = overOdds!
            bucket.over.bestBook = formatted.title
          }
        }
        if (Number.isFinite(underOdds)) {
          bucket.under.allBooks.push({ book: formatted.title, odds: underOdds!, line })
          if (isBetterOdds(bucket.under.best, underOdds!)) {
            bucket.under.best = underOdds!
            bucket.under.bestBook = formatted.title
          }
        }
      }
    }

    const playerProps = await Promise.all(
      Array.from(playerPropsMap.values()).map(async (prop) => {
        const markets: Record<string, PropMarket> = {}
        for (const [marketType, lineBuckets] of prop.marketLines.entries()) {
          const primary = pickPrimaryLine(lineBuckets)
          if (primary) {
            markets[marketType] = primary
          }
        }
        const hydrated: PlayerProp = {
          player: prop.player,
          team: prop.team,
          teamAbbr: prop.teamAbbr,
          game: prop.game,
          markets,
        }
        const playerData = await getPlayerLookup(normalizedSport, hydrated.player)
        if (playerData) {
          hydrated.team = playerData.team
          hydrated.teamAbbr = playerData.teamAbbr
          hydrated.position = playerData.position
        }
        if (normalizedSport === 'basketball_nba' && Object.keys(hydrated.markets).length) {
          const projections = await getNbaPropProjectionsForPlayer(hydrated.player)
          for (const [marketKey, marketData] of Object.entries(hydrated.markets)) {
            const projection = projections[marketKey]
            if (!projection || !Number.isFinite(projection.projection)) continue
            marketData.projection = Number(projection.projection.toFixed(1))
            if (projection.seasonAvg != null && Number.isFinite(projection.seasonAvg)) {
              marketData.seasonAvg = Number(projection.seasonAvg.toFixed(1))
            }
            if (projection.recentAvg != null && Number.isFinite(projection.recentAvg)) {
              marketData.recentAvg = Number(projection.recentAvg.toFixed(1))
            }
            if (projection.recentGames != null) {
              marketData.recentGames = projection.recentGames
            }
            if (Number.isFinite(marketData.line)) {
              marketData.delta = Number((marketData.projection - marketData.line).toFixed(1))
            }
          }
        }
        return hydrated
      })
    )

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
