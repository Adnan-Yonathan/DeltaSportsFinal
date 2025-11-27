import { NextRequest, NextResponse } from 'next/server'
import { fetchPlayerProps, mapBookmakersIO, fetchEventsIO, fetchMultiEventOdds } from '@/lib/api/odds-api'
import { searchPlayer } from '@/lib/sports-stats-api'
import type { RosterPlayer } from '@/lib/sports-stats-api'
import { resolveSportKey } from '@/lib/utils/live-game'
import type { OddsGame } from '@/lib/types/odds'

interface PropOdds {
  book: string
  odds: number
  line?: number
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

const DEFAULT_MARKETS: Record<string, string[]> = {
  basketball_nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  americanfootball_nfl: [
    'player_pass_tds',
    'player_pass_yds',
    'player_rush_yds',
    'player_receptions',
    'player_receiving_yds',
    'player_rush_tds',
    'player_anytime_td',
    'player_receiving_tds',
  ],
  baseball_mlb: ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored'],
  icehockey_nhl: ['player_points', 'player_shots_on_goal', 'player_blocked_shots'],
}

const CACHE_TTL_MS = 60 * 1000
type CacheEntry = { expires: number; data: OddsGame[] }
const oddsCache = new Map<string, CacheEntry>()
const playerLookupCache = new Map<string, Promise<RosterPlayer | null>>()

const SAFE_PROP_BOOKMAKERS = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Fanatics', 'Bovada', 'Underdog', 'Fliff', 'BetRivers', 'Pinnacle']
const FALLBACK_SINGLE_BOOK = ['FanDuel', 'DraftKings', 'BetMGM']
const EXCLUDED_FANTASY_BOOKS = new Set(['PrizePicks', 'ThriveFantasy', 'Sleeper'])

const STAT_KEY_MAP: Record<string, string> = {
  'passing attempts': 'player_pass_atts',
  'passing yards': 'player_pass_yds',
  'td passes': 'player_pass_tds',
  'passing tds': 'player_pass_tds',
  'completions': 'player_pass_completions',
  'passing completions': 'player_pass_completions',
  'passing + rushing yards': 'player_pass_rush_yds',
  'rushing yards': 'player_rush_yds',
  'rush attempts': 'player_rush_attempts',
  'rushing + receiving yards': 'player_rush_rec_yds',
  'receiving yards': 'player_receiving_yds',
  'receptions': 'player_receptions',
  'receiving receptions': 'player_receptions',
  'longest reception': 'player_longest_rec',
  'interceptions': 'player_interceptions',
  'anytime td': 'player_anytime_td',
  'rushing tds': 'player_rush_tds',
  'rushing touchdowns': 'player_rush_tds',
  'rush tds': 'player_rush_tds',
  'receiving tds': 'player_receiving_tds',
  'receiving touchdowns': 'player_receiving_tds',
  'touchdowns': 'player_anytime_td',
}

const normalizeStatKey = (label: string): string => {
  const key = label.trim().toLowerCase()
  return STAT_KEY_MAP[key] || `player_prop_${key.replace(/\s+/g, '_')}`
}

// Normalize odds to American format; incoming data can be decimal (e.g., 1.9x)
const toAmericanOdds = (price: number): number => {
  if (!Number.isFinite(price)) return price
  // Treat values between 1 and 10 as decimal odds and convert
  if (price > 1 && price < 10) {
    const decimal = price
    if (decimal >= 2) return Math.round((decimal - 1) * 100)
    return Math.round(-100 / (decimal - 1))
  }
  return price
}

const parsePlayerPropsFromBookmaker = (
  bookName: string,
  markets: any[],
  requestedMarkets: string[],
  allowedKeys: Set<string> | null,
  playerFilter?: string[]
) => {
  const marketsOut: any[] = []
  const seen = new Set<string>() // de-dupe by player + key

  for (const market of markets || []) {
    if (typeof market?.name !== 'string') continue
    if (market.name.toLowerCase() !== 'player props') continue
    if (!Array.isArray(market.odds)) continue

    for (const entry of market.odds) {
      const rawLabel = String(entry?.label || '')
      const match = rawLabel.match(/^(.*?)\s*\((.+)\)$/)
      const playerName = (match?.[1] || rawLabel).trim()
      const statLabel = (match?.[2] || '').trim()
      if (!playerName || !statLabel) continue

      if (playerFilter && playerFilter.length) {
        const lower = playerName.toLowerCase()
        if (!playerFilter.some(p => lower.includes(p.toLowerCase()))) continue
      }

      const key = normalizeStatKey(statLabel)
      if (allowedKeys && !allowedKeys.has(key)) continue
      // Do not drop markets solely because they aren't in requestedMarkets; we normalize and keep first per player/key

      const line = typeof entry.hdp === 'number' ? entry.hdp : parseFloat(entry.hdp)
      const dedupeKey = `${playerName.toLowerCase()}|${key}`
      if (seen.has(dedupeKey)) continue

      const outcomes: any[] = []
      if (entry.over != null && entry.over !== 'N/A') {
        outcomes.push({
          name: `${playerName} Over`,
          price: toAmericanOdds(parseFloat(entry.over)),
          point: line,
        })
      }
      if (entry.under != null && entry.under !== 'N/A') {
        outcomes.push({
          name: `${playerName} Under`,
          price: toAmericanOdds(parseFloat(entry.under)),
          point: line,
        })
      }
      if (!outcomes.length && entry.price != null) {
        outcomes.push({
          name: `${playerName} Over`,
          price: toAmericanOdds(parseFloat(entry.price)),
          point: line,
        })
      }
      if (!outcomes.length) continue

      seen.add(dedupeKey)
      marketsOut.push({
        key,
        outcomes,
      })
    }
  }

  if (!marketsOut.length) return null
  return {
    key: bookName.toLowerCase(),
    title: bookName,
    markets: marketsOut,
  }
}

const parsePlayerPropBookmakers = (
  bookmakers: Record<string, any>,
  requestedMarkets: string[],
  allowedKeys: Set<string> | null,
  playerFilter?: string[]
) => {
  const result: any[] = []
  for (const [bookName, markets] of Object.entries(bookmakers || {})) {
    if (EXCLUDED_FANTASY_BOOKS.has(bookName)) continue
    const parsed = parsePlayerPropsFromBookmaker(bookName, markets as any[], requestedMarkets, allowedKeys, playerFilter)
    if (parsed) result.push(parsed)
  }
  return result
}

// Fallback parser when provider returns flat prop markets (e.g., key: player_points)
const parseFlatPlayerPropBookmakers = (
  bookmakers: Record<string, any>,
  requestedMarkets: string[],
  playerFilter?: string[]
) => {
  const marketsSet = requestedMarkets && requestedMarkets.length ? new Set(requestedMarkets) : null
  const result: any[] = []

  for (const [bookName, markets] of Object.entries(bookmakers || {})) {
    if (EXCLUDED_FANTASY_BOOKS.has(bookName)) continue
    if (!Array.isArray(markets)) continue

    const mappedMarkets: any[] = []
    for (const market of markets) {
      const key = typeof market?.key === 'string' ? market.key : ''
      if (!key.startsWith('player_')) continue
      if (marketsSet && !marketsSet.has(key)) continue

      const rawOutcomes = Array.isArray(market?.odds) ? market.odds : Array.isArray(market?.outcomes) ? market.outcomes : []
      if (!rawOutcomes.length) continue

      const outcomes = rawOutcomes
        .map((o: any, idx: number) => {
          const name = o?.name || o?.label || ''
          const playerName = stripPlayerName(name) || name
          if (!playerName) return null
          if (playerFilter && playerFilter.length) {
            const lower = playerName.toLowerCase()
            if (!playerFilter.some(p => lower.includes(p.toLowerCase()))) return null
          }
          const price = toAmericanOdds(o?.price ?? o?.odds ?? o?.lineOdds ?? o?.over ?? o?.under)
          if (!Number.isFinite(price)) return null
          const point = normalizeLineValue(o?.point ?? o?.line ?? o?.threshold ?? o?.hdp)
          const direction = inferDirection(o, idx)
          const label = direction === 'under' ? `${playerName} Under` : `${playerName} Over`
          return {
            name: label,
            price,
            point,
          }
        })
        .filter(Boolean)

      if (outcomes.length) {
        mappedMarkets.push({
          key,
          outcomes,
        })
      }
    }

    if (mappedMarkets.length) {
      result.push({
        key: bookName.toLowerCase(),
        title: bookName,
        markets: mappedMarkets,
      })
    }
  }

  return result
}

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
  let sampleLogged = false
  const key = cacheKeyFor(sport, markets, teamFilter, playerFilter)
  const cached = oddsCache.get(key)
  if (cached && cached.expires > Date.now()) {
    console.log(`[PLAYER_PROPS] Cache hit for ${key}`)
    return cached.data
  }

  // Allow all prop markets; do not restrict NFL props to a narrow subset
  const allowedKeys = null

  // Try fetching by eventId (per provider docs)
  const logNoBooks = (ev: any, markets: string[]) => {
    console.warn(
      '[PLAYER_PROPS] No bookmakers mapped for event',
      ev.id,
      'market keys:',
      ev.bookmakers ? Object.keys(ev.bookmakers) : [],
      'requested markets:',
      markets
    )
  }

  const mapEventsToGames = (eventOdds: any[]): OddsGame[] => {
    return eventOdds
      .map((ev: any) => {
        const parsedBooks = parsePlayerPropBookmakers(ev.bookmakers || {}, markets, allowedKeys, playerFilter)
        const flatParsed =
          parsedBooks && parsedBooks.length
            ? parsedBooks
            : parseFlatPlayerPropBookmakers(ev.bookmakers || {}, markets, playerFilter)
        const mapped =
          flatParsed && flatParsed.length
            ? flatParsed
            : mapBookmakersIO(ev.bookmakers || {}, ev.home || '', ev.away || '', undefined)
                .map(book => ({
                  ...book,
                  markets: book.markets.filter(mkt =>
                    (!markets || !markets.length) ? true : markets.includes(mkt.key)
                  ),
                }))
                .filter(book => book.markets.length > 0 && !EXCLUDED_FANTASY_BOOKS.has(book.title))

        if (!mapped.length) {
          logNoBooks(ev, markets)
          if (!sampleLogged) {
            const firstBook = Object.entries(ev.bookmakers || {})[0]
            if (firstBook) {
              console.log(
                '[PLAYER_PROPS][DEBUG] sample bookmaker payload:',
                firstBook[0],
                JSON.stringify(firstBook[1], null, 2).slice(0, 1200)
              )
              sampleLogged = true
            }
          }
        } else if (mapped[0]?.markets?.length) {
          console.log('[PLAYER_PROPS] Mapped bookmaker markets example:', mapped[0].key, mapped[0].markets.map((m: any) => m.key))
        }

        return {
          id: String(ev.id),
          sport_key: sport,
          sport_title: ev.league?.toString() || '',
          commence_time: String(ev.date || ''),
          home_team: String(ev.home || ''),
          away_team: String(ev.away || ''),
          bookmakers: mapped,
        }
      })
      .filter(g => g.bookmakers && g.bookmakers.length)
  }

  const tryDirectPlayerProps = async (): Promise<OddsGame[] | null> => {
    try {
      const propsEvents = await fetchPlayerProps(sport, markets, {
        teamFilter,
        playerFilter,
      })
      console.log(`[PLAYER_PROPS] /player-props returned ${propsEvents.length} events for ${sport}`)
      const games = mapEventsToGames(propsEvents)
      if (games.length) {
        oddsCache.set(key, { data: games, expires: Date.now() + CACHE_TTL_MS })
        return games
      }
    } catch (err) {
      console.warn('[PLAYER_PROPS] Direct /player-props fetch failed:', err instanceof Error ? err.message : err)
    }
    return null
  }

  const fetchEventBatch = async (bookmakers: string[] | null, live: boolean) => {
    const events = await fetchEventsIO(sport, { status: live ? 'live' : 'pending' })
    console.log(`[PLAYER_PROPS] Loaded ${events.length} ${live ? 'live' : 'pending'} events for ${sport}`)
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

    const maxEvents = playerFilter && playerFilter.length ? 10 : 25
    const eventIds = filteredEvents.slice(0, maxEvents).map(ev => String(ev.id))
    console.log(`[PLAYER_PROPS] Using ${eventIds.length} eventIds (${live ? 'live' : 'pending'}) for props fetch with books=${bookmakers?.join(',') || 'ALL'}`)
    if (!eventIds.length) return []

    const eventOdds = await fetchMultiEventOdds(
      eventIds,
      bookmakers,
      { cache: 'no-store' },
      markets
    )
    console.log(`[PLAYER_PROPS] eventOdds length: ${eventOdds.length}`)
    return mapEventsToGames(eventOdds)
  }

  // Try pending events with safe bookmaker set, then single-book fallback, then no filter; repeat for live
  const attempts: Array<{ live: boolean; books: string[] | null }> =
    playerFilter && playerFilter.length
      ? [
          { live: false, books: SAFE_PROP_BOOKMAKERS },
          { live: false, books: null },
          { live: true, books: SAFE_PROP_BOOKMAKERS },
          { live: true, books: null },
        ]
      : [
          { live: false, books: SAFE_PROP_BOOKMAKERS },
          { live: false, books: FALLBACK_SINGLE_BOOK },
          { live: false, books: null },
          { live: true, books: SAFE_PROP_BOOKMAKERS },
          { live: true, books: FALLBACK_SINGLE_BOOK },
          { live: true, books: null },
        ]

  // Fast-path: provider's player-props endpoint returns all props in one request
  const direct = await tryDirectPlayerProps()
  if (direct && direct.length) return direct

  for (const attempt of attempts) {
    try {
      const games = await fetchEventBatch(attempt.books, attempt.live)
      if (games.length) {
        oddsCache.set(key, { data: games, expires: Date.now() + CACHE_TTL_MS })
        return games
      }
    } catch (err) {
      console.warn('[PLAYER_PROPS] Event batch fetch failed:', err instanceof Error ? err.message : err)
    }
  }

  console.warn(`[PLAYER_PROPS] No props returned for ${key}`)

  return []
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

const normalizeLineValue = (value: any): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = typeof value === 'string' ? parseFloat(value) : NaN
  return Number.isFinite(parsed) ? parsed : 0
}

const lineKeyFor = (value: any): string => {
  if (typeof value === 'number' && Number.isFinite(value)) return value.toString()
  const parsed = typeof value === 'string' ? parseFloat(value) : NaN
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

const pickPrimaryLine = (lineBuckets: Map<string, PropMarket>): PropMarket | null => {
  // Build per-book-per-line rows to preserve alternates
  const lineMap = new Map<string, { book: string; line: number; overOdds?: number; underOdds?: number }>()
  const priority = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle', 'Bovada', 'BetRivers', 'Fanatics', 'Fliff']

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

  // Select up to 6 rows, ensuring best over/under are included
  const selected: typeof rows = []
  const used = new Set<string>()
  const pushUnique = (row: typeof rows[number]) => {
    const key = `${row.book.toLowerCase()}|${row.line}`
    if (used.has(key)) return
    selected.push(row)
    used.add(key)
  }

  if (bestOver) {
    const r = rows.find(r => r.book === bestOver!.book && r.line === bestOver!.line)
    if (r) pushUnique(r)
  }
  if (bestUnder) {
    const r = rows.find(r => r.book === bestUnder!.book && r.line === bestUnder!.line)
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
    .forEach(r => pushUnique(r))

  merged.lines = selected.slice(0, 6)

  // Set best odds from the best found (allBooks already has ALL bookmakers from lines 559-572)
  if (bestOver) {
    merged.over.best = bestOver.odds
    merged.over.bestBook = bestOver.book
    merged.line = bestOver.line
  }
  if (bestUnder) {
    merged.under.best = bestUnder.odds
    merged.under.bestBook = bestUnder.book
  }

  console.log('[PLAYER-PROPS API] Returning market with', merged.over.allBooks.length, 'over bookmakers,', merged.under.allBooks.length, 'under bookmakers')

  return merged
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
      // Narrow markets when a specific player is requested to speed up lookups
      if (playerFilter) {
        markets = ['player_points']
      } else {
        markets = DEFAULT_MARKETS[normalizedSport] || ['player_points']
      }
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
    type PlayerPropAccumulator = Omit<PlayerProp, 'markets'> & {
      marketLines: Map<string, Map<string, PropMarket>>
    }
    const playerPropsMap = new Map<string, PlayerPropAccumulator>()

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
                marketLines: new Map(),
              })
            }

            const playerProp = playerPropsMap.get(playerName)!
            if (!playerProp.marketLines.has(marketType)) {
              playerProp.marketLines.set(marketType, new Map())
            }

            const lineBuckets = playerProp.marketLines.get(marketType)!
            const lineKey = lineKeyFor(outcome.point)
            const normalizedLine = normalizeLineValue(outcome.point)
            if (!lineBuckets.has(lineKey)) {
              lineBuckets.set(lineKey, createEmptyMarketBucket(normalizedLine))
            }

            const marketData = lineBuckets.get(lineKey)!

            const direction = inferDirection(outcome, index)
            const bucket = marketData[direction]
            const price = toAmericanOdds(outcome.price)

            bucket.allBooks.push({
              book: bookmaker.title,
              odds: price,
              line: normalizedLine,
            })

            if (isBetterOdds(bucket.best, price)) {
              bucket.best = price
              bucket.bestBook = bookmaker.title
            }
          })
        }
      }
    }

    // Convert map to array and enrich with player data
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
          game: prop.game,
          markets,
        }
        const playerData = await getPlayerLookup(normalizedSport, hydrated.player)
        if (playerData) {
          hydrated.team = playerData.team
          hydrated.teamAbbr = playerData.teamAbbr
          hydrated.position = playerData.position
        }
        return hydrated
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
