import { Bookmaker, MARKETS, OddsGame, OddsMarket, OddsOutcome } from '@/lib/types/odds'
import { OddsAPIError } from '@/lib/api/odds-errors'
import { getBookmakerLink } from '@/lib/config/bookmaker-links'

export type SbdLeague = 'nba' | 'nfl' | 'mlb' | 'nhl' | 'ncaamb' | 'ncaafb'

const SBD_API_BASE = 'https://www.sportsbettingdime.com'
const SBD_SRF_BASE = 'https://srfeeds.sportsbettingdime.com'
const SBD_FUEL_BASE = 'https://cdn-sde.sbdfuel.com'

const SPORT_KEY_TO_LEAGUE: Record<string, SbdLeague> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaamb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'ncaafb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

const LEAGUE_TO_SPORT_KEY: Record<SbdLeague, string> = {
  nba: 'basketball_nba',
  ncaamb: 'basketball_ncaab',
  nfl: 'americanfootball_nfl',
  ncaafb: 'americanfootball_ncaaf',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
}

const LEAGUE_TITLES: Record<SbdLeague, string> = {
  nba: 'NBA',
  ncaamb: 'NCAAB',
  nfl: 'NFL',
  ncaafb: 'NCAAF',
  mlb: 'MLB',
  nhl: 'NHL',
}

export const DEFAULT_BOOK_IDS = [
  'sr:book:17324', // MGM
  'sr:book:28901', // Bet365
  'sr:book:18149', // DraftKings
  'sr:book:32219', // Caesars / William Hill NJ
  'sr:book:18186', // FanDuel
  'sr:book:27447', // BetRivers
]

const BOOK_NAME_TO_SLUG: Record<string, string> = {
  mgm: 'betmgm',
  betmgm: 'betmgm',
  draftkings: 'draftkings',
  fanduel: 'fanduel',
  bet365: 'bet365',
  bet365usnj: 'bet365',
  betrivers: 'betrivers',
  williamhillnewjersey: 'caesars',
  caesars: 'caesars',
  pinnacle: 'pinnacle',
}

const BOOK_NAME_TO_TITLE: Record<string, string> = {
  mgm: 'BetMGM',
  betmgm: 'BetMGM',
  draftkings: 'DraftKings',
  fanduel: 'FanDuel',
  bet365: 'Bet365',
  bet365usnj: 'Bet365',
  betrivers: 'BetRivers',
  williamhillnewjersey: 'Caesars',
  caesars: 'Caesars',
  pinnacle: 'Pinnacle',
}

const BOOK_ID_TO_SLUG: Record<string, string> = {
  'sr:book:17324': 'betmgm',
  'sr:book:18149': 'draftkings',
  'sr:book:18186': 'fanduel',
  'sr:book:28901': 'bet365',
  'sr:book:32219': 'caesars',
  'sr:book:27447': 'betrivers',
  'sr:book:30334': 'pinnacle',
}

const normalizeBookName = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const parseNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const parseAmerican = (value: unknown): number | null => {
  const parsed = parseNumber(value)
  if (parsed == null) return null
  return Math.round(parsed)
}

const resolveSbdTotalsMarketKey = (rawKey: string): string | null => {
  if (!rawKey) return null
  const normalized = rawKey.toLowerCase().replace(/_/g, ' ')
  if (!normalized.includes('total')) return null
  if (normalized.includes('team')) return null

  const firstHalf =
    normalized.includes('1st half') ||
    normalized.includes('first half') ||
    /\b1h\b/.test(normalized)
  const secondHalf =
    normalized.includes('2nd half') ||
    normalized.includes('second half') ||
    /\b2h\b/.test(normalized)
  if (firstHalf) return MARKETS.TOTALS_1H
  if (secondHalf) return MARKETS.TOTALS_2H

  const periodMatch =
    normalized.match(/\b([1-3])(st|nd|rd)\s*period\b/) ||
    normalized.match(/\bperiod\s*([1-3])\b/) ||
    normalized.match(/\b([1-3])p\b/) ||
    normalized.match(/\bp([1-3])\b/)
  if (periodMatch) {
    const period = periodMatch[1]
    switch (period) {
      case '1':
        return MARKETS.TOTALS_P1
      case '2':
        return MARKETS.TOTALS_P2
      case '3':
        return MARKETS.TOTALS_P3
      default:
        break
    }
  }

  const quarterMatch =
    normalized.match(/\bq([1-4])\b/) ||
    normalized.match(/\b([1-4])(st|nd|rd|th)\s*quarter\b/) ||
    normalized.match(/\bquarter\s*([1-4])\b/)
  if (quarterMatch) {
    const quarter = quarterMatch[1]
    switch (quarter) {
      case '1':
        return MARKETS.TOTALS_Q1
      case '2':
        return MARKETS.TOTALS_Q2
      case '3':
        return MARKETS.TOTALS_Q3
      case '4':
        return MARKETS.TOTALS_Q4
      default:
        break
    }
  }

  return MARKETS.TOTALS
}

const resolveSbdSpreadMarketKey = (rawKey: string): string | null => {
  if (!rawKey) return null
  const normalized = rawKey.toLowerCase().replace(/_/g, ' ')
  const isSpread =
    normalized.includes('spread') ||
    normalized.includes('puck line') ||
    normalized.includes('puckline') ||
    normalized.includes('run line') ||
    normalized.includes('runline')
  if (!isSpread) return null
  const firstHalf =
    normalized.includes('1st half') ||
    normalized.includes('first half') ||
    /\b1h\b/.test(normalized)
  const secondHalf =
    normalized.includes('2nd half') ||
    normalized.includes('second half') ||
    /\b2h\b/.test(normalized)
  if (firstHalf) return MARKETS.SPREADS_1H
  if (secondHalf) return MARKETS.SPREADS_2H
  const periodMatch =
    normalized.match(/\b([1-3])(st|nd|rd)\s*period\b/) ||
    normalized.match(/\bperiod\s*([1-3])\b/) ||
    normalized.match(/\b([1-3])p\b/) ||
    normalized.match(/\bp([1-3])\b/)
  if (periodMatch) {
    const period = periodMatch[1]
    switch (period) {
      case '1':
        return MARKETS.SPREADS_P1
      case '2':
        return MARKETS.SPREADS_P2
      case '3':
        return MARKETS.SPREADS_P3
      default:
        break
    }
  }
  if (normalized.includes('half')) return null
  return MARKETS.SPREADS
}

const resolveSbdTeamTotalMarketKey = (rawKey: string): string | null => {       
  if (!rawKey) return null
  const normalized = rawKey.toLowerCase().replace(/_/g, ' ')
  if (!normalized.includes('total') || !normalized.includes('team')) return null
  const firstHalf =
    normalized.includes('1st half') ||
    normalized.includes('first half') ||
    /\b1h\b/.test(normalized)
  const secondHalf =
    normalized.includes('2nd half') ||
    normalized.includes('second half') ||
    /\b2h\b/.test(normalized)
  if (firstHalf) return MARKETS.TEAM_TOTALS_1H
  if (secondHalf) return MARKETS.TEAM_TOTALS_2H
  const periodMatch =
    normalized.match(/\b([1-3])(st|nd|rd)\s*period\b/) ||
    normalized.match(/\bperiod\s*([1-3])\b/) ||
    normalized.match(/\b([1-3])p\b/) ||
    normalized.match(/\bp([1-3])\b/)
  if (periodMatch) {
    const period = periodMatch[1]
    switch (period) {
      case '1':
        return MARKETS.TEAM_TOTALS_P1
      case '2':
        return MARKETS.TEAM_TOTALS_P2
      case '3':
        return MARKETS.TEAM_TOTALS_P3
      default:
        break
    }
  }
  return MARKETS.TEAM_TOTALS
}

export const buildTeamLabel = (team: any): string => {
  if (!team) return ''
  const market = typeof team.market === 'string' ? team.market.trim() : ''
  const name = typeof team.name === 'string' ? team.name.trim() : ''
  if (market && name) return `${market} ${name}`.trim()
  return name || market || ''
}

const resolveBookSlug = (value: string): string => {
  const normalized = normalizeBookName(value)
  return BOOK_NAME_TO_SLUG[normalized] || normalized
}

const resolveBookId = (slug: string): string => {
  switch (slug) {
    case 'betmgm':
      return 'sr:book:17324'
    case 'draftkings':
      return 'sr:book:18149'
    case 'fanduel':
      return 'sr:book:18186'
    case 'bet365':
      return 'sr:book:28901'
    case 'caesars':
      return 'sr:book:32219'
    case 'betrivers':
      return 'sr:book:27447'
    case 'pinnacle':
      return 'sr:book:30334'
    default:
      return ''
  }
}

export const resolveSbdLeague = (sportKey: string): SbdLeague | null => {       
  if (!sportKey) return null
  if (sportKey in SPORT_KEY_TO_LEAGUE) return SPORT_KEY_TO_LEAGUE[sportKey]
  const normalized = sportKey.toLowerCase() as SbdLeague
  return LEAGUE_TO_SPORT_KEY[normalized] ? normalized : null
}

export const resolveSportKey = (league: string): string | null => {
  const normalized = league.toLowerCase() as SbdLeague
  return LEAGUE_TO_SPORT_KEY[normalized] || null
}

export const getDefaultBookIds = (): string[] => {
  const env = process.env.SBD_BOOK_IDS || process.env.ODDS_BOOKMAKERS
  if (!env) return DEFAULT_BOOK_IDS.slice()
  const entries = env.split(',').map((entry) => entry.trim()).filter(Boolean)
  if (!entries.length) return DEFAULT_BOOK_IDS.slice()

  // Allow raw SBD book ids in env
  if (entries.some((entry) => entry.startsWith('sr:book:'))) {
    return entries
  }

  const mapped = entries.map(resolveBookSlug).filter(Boolean)
  const resolvedIds = mapped.map(resolveBookId).filter(Boolean)

  return resolvedIds.length ? resolvedIds : DEFAULT_BOOK_IDS.slice()
}

export const resolveBookIds = (bookmakers?: string | string[] | null): string[] => {
  if (!bookmakers) return getDefaultBookIds()
  const entries = Array.isArray(bookmakers)
    ? bookmakers.map((entry) => String(entry).trim()).filter(Boolean)
    : String(bookmakers)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

  if (!entries.length) return getDefaultBookIds()
  if (entries.some((entry) => entry.startsWith('sr:book:'))) {
    return entries
  }

  const mapped = entries.map(resolveBookSlug).filter(Boolean)
  const resolvedIds = mapped.map(resolveBookId).filter(Boolean)
  return resolvedIds.length ? resolvedIds : getDefaultBookIds()
}

export const resolveBookSlugs = (bookmakers?: string | string[] | null): string[] => {
  const fallback = DEFAULT_BOOK_IDS.map((id) => BOOK_ID_TO_SLUG[id]).filter(Boolean)
  if (!bookmakers) return fallback.slice()
  const entries = Array.isArray(bookmakers)
    ? bookmakers.map((entry) => String(entry).trim()).filter(Boolean)
    : String(bookmakers)
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)

  if (!entries.length) return fallback.slice()

  const resolved = entries
    .map((entry) => {
      if (entry.startsWith('sr:book:')) return BOOK_ID_TO_SLUG[entry]
      return resolveBookSlug(entry)
    })
    .filter(Boolean)

  return resolved.length ? resolved : fallback.slice()
}

export const formatBookmaker = (name: string) => {
  const normalized = normalizeBookName(name)
  const key = BOOK_NAME_TO_SLUG[normalized] || normalized || name.toLowerCase()
  const title = BOOK_NAME_TO_TITLE[normalized] || name
  const url = getBookmakerLink(key)
  return { key, title, url }
}

export const mapSbdMarketsToBookmakers = (
  markets: any,
  homeTeam: string,
  awayTeam: string,
  allowedMarkets?: string[]
): Bookmaker[] => {
  if (!markets) return []
  const allowed = allowedMarkets && allowedMarkets.length
    ? new Set(allowedMarkets.map((m) => m.toLowerCase()))
    : null

  const shouldInclude = (key: string) => !allowed || allowed.has(key)
  const byBook = new Map<string, Bookmaker>()

  const ensureBook = (book: any) => {
    const id = typeof book?.id === 'string' ? book.id : ''
    const name = typeof book?.name === 'string' ? book.name : id || 'Unknown'
    const normalized = normalizeBookName(name)
    const slug = BOOK_NAME_TO_SLUG[normalized] || normalizeBookName(id) || normalized
    if (byBook.has(slug)) return byBook.get(slug)!
    const formatted = formatBookmaker(name)
    const entry: Bookmaker = {
      key: formatted.key,
      title: formatted.title,
      url: formatted.url,
      markets: [],
    }
    byBook.set(slug, entry)
    return entry
  }

  const addMarket = (book: any, market: OddsMarket) => {
    if (!market.outcomes.length) return
    const target = ensureBook(book)
    target.markets.push(market)
  }

  const moneylineMarket =
    markets.moneyline ||
    markets.money_line ||
    markets.h2h ||
    markets.ml
  if (moneylineMarket && shouldInclude(MARKETS.H2H)) {
    for (const book of moneylineMarket.books || []) {
      const homeOdds = parseAmerican(book?.home?.odds ?? book?.home?.price)
      const awayOdds = parseAmerican(book?.away?.odds ?? book?.away?.price)
      const drawOdds = parseAmerican(book?.draw?.odds ?? book?.draw?.price)
      const outcomes: OddsOutcome[] = []
      if (homeOdds != null) outcomes.push({ name: homeTeam, price: homeOdds })
      if (awayOdds != null) outcomes.push({ name: awayTeam, price: awayOdds })
      if (drawOdds != null) outcomes.push({ name: 'Draw', price: drawOdds })
      if (outcomes.length) {
        addMarket(book, { key: MARKETS.H2H, outcomes })
      }
    }
  }

  const spreadMarket =
    markets.spread ||
    markets.spreads ||
    markets.point_spread ||
    markets.pointspread
  if (spreadMarket && shouldInclude(MARKETS.SPREADS)) {
    for (const book of spreadMarket.books || []) {
      const homeOdds = parseAmerican(book?.home?.odds)
      const awayOdds = parseAmerican(book?.away?.odds)
      const homeSpread = parseNumber(book?.home?.spread)
      const awaySpread = parseNumber(book?.away?.spread)
      const outcomes: OddsOutcome[] = []
      if (homeOdds != null && homeSpread != null) {
        outcomes.push({ name: homeTeam, price: homeOdds, point: homeSpread })
      }
      if (awayOdds != null && awaySpread != null) {
        outcomes.push({ name: awayTeam, price: awayOdds, point: awaySpread })
      }
      if (outcomes.length) {
        addMarket(book, { key: MARKETS.SPREADS, outcomes })
      }
    }
  }

  const totalMarket =
    markets.total ||
    markets.totals ||
    markets.over_under ||
    markets.overunder
  if (totalMarket && shouldInclude(MARKETS.TOTALS)) {
    for (const book of totalMarket.books || []) {
      const overOdds = parseAmerican(book?.over?.odds)
      const underOdds = parseAmerican(book?.under?.odds)
      const total = parseNumber(book?.total)
      const outcomes: OddsOutcome[] = []
      if (overOdds != null && total != null) {
        outcomes.push({ name: 'Over', price: overOdds, point: total })
      }
      if (underOdds != null && total != null) {
        outcomes.push({ name: 'Under', price: underOdds, point: total })
      }
      if (outcomes.length) {
        addMarket(book, { key: MARKETS.TOTALS, outcomes })
      }
    }
  }

  const parseSpreadBooks = (books: any[], marketKey: string) => {
    for (const book of books || []) {
      const homeOdds = parseAmerican(book?.home?.odds)
      const awayOdds = parseAmerican(book?.away?.odds)
      const homeSpread = parseNumber(book?.home?.spread)
      const awaySpread = parseNumber(book?.away?.spread)
      const outcomes: OddsOutcome[] = []
      if (homeOdds != null && homeSpread != null) {
        outcomes.push({ name: homeTeam, price: homeOdds, point: homeSpread })
      }
      if (awayOdds != null && awaySpread != null) {
        outcomes.push({ name: awayTeam, price: awayOdds, point: awaySpread })
      }
      if (outcomes.length) {
        addMarket(book, { key: marketKey, outcomes })
      }
    }
  }

  const parseTeamTotalBooks = (books: any[], marketKey: string) => {
    for (const book of books || []) {
      const teamLabel =
        buildTeamLabel(book?.team) ||
        book?.team?.name ||
        book?.teamName ||
        book?.side ||
        book?.label ||
        ''
      const overOdds = parseAmerican(book?.over?.odds)
      const underOdds = parseAmerican(book?.under?.odds)
      const total = parseNumber(book?.total ?? book?.team_total ?? book?.line)
      const outcomes: OddsOutcome[] = []
      const teamPrefix = teamLabel ? `${teamLabel} ` : ''
      if (overOdds != null && total != null) {
        outcomes.push({
          name: `${teamPrefix}Over`.trim(),
          price: overOdds,
          point: total,
        })
      }
      if (underOdds != null && total != null) {
        outcomes.push({
          name: `${teamPrefix}Under`.trim(),
          price: underOdds,
          point: total,
        })
      }
      if (outcomes.length) {
        addMarket(book, { key: marketKey, outcomes })
      }
    }
  }

  for (const [key, market] of Object.entries(markets)) {
    const normalizedKey = key.toLowerCase()
    if (normalizedKey === 'total' || normalizedKey === 'totals') continue
    if (normalizedKey === 'spread' || normalizedKey === 'spreads') continue

    const teamTotalsKey = resolveSbdTeamTotalMarketKey(normalizedKey)
    if (teamTotalsKey && shouldInclude(teamTotalsKey)) {
      const books = (market as any)?.books || []
      parseTeamTotalBooks(books, teamTotalsKey)
      continue
    }

    const totalsKey = resolveSbdTotalsMarketKey(normalizedKey)
    if (totalsKey && shouldInclude(totalsKey)) {
      const books = (market as any)?.books || []
      for (const book of books) {
        const overOdds = parseAmerican(book?.over?.odds)
        const underOdds = parseAmerican(book?.under?.odds)
        const total = parseNumber(book?.total)
        const outcomes: OddsOutcome[] = []
        if (overOdds != null && total != null) {
          outcomes.push({ name: 'Over', price: overOdds, point: total })
        }
        if (underOdds != null && total != null) {
          outcomes.push({ name: 'Under', price: underOdds, point: total })
        }
        if (outcomes.length) {
          addMarket(book, { key: totalsKey, outcomes })
        }
      }
      continue
    }

    const spreadKey = resolveSbdSpreadMarketKey(normalizedKey)
    if (spreadKey && spreadKey !== MARKETS.SPREADS && shouldInclude(spreadKey)) {
      const books = (market as any)?.books || []
      parseSpreadBooks(books, spreadKey)
    }
  }

  return Array.from(byBook.values()).filter((book) => book.markets.length > 0)
}

export async function fetchSbdOdds(
  league: SbdLeague,
  opts: { books?: string[]; format?: string; init?: RequestInit } = {}
): Promise<any> {
  const books =
    opts.books && opts.books.length
      ? opts.books
      : league === 'ncaamb'
        ? ['sr:book:18149']
        : getDefaultBookIds()
  const format = opts.format || 'us'
  const url = `${SBD_API_BASE}/wp-json/adpt/v1/${league}-odds?books=${books.join(',')}&format=${format}`

  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD odds returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdSportEvent(
  league: SbdLeague,
  eventId: string,
  opts: { books?: string[]; init?: RequestInit } = {}
): Promise<any> {
  if (!eventId) throw new OddsAPIError('eventId is required')
  const books = opts.books && opts.books.length ? opts.books : getDefaultBookIds()
  const url = `${SBD_API_BASE}/wp-json/adpt/v1/sport-event/${league}/${eventId}?books=${books.join(',')}`

  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD event returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdPlayerProps(
  league: SbdLeague,
  opts: { books?: string[]; markets?: string[]; limit?: number; init?: RequestInit } = {}
): Promise<any> {
  const books = opts.books && opts.books.length ? opts.books : getDefaultBookIds()
  const params = new URLSearchParams({ books: books.join(',') })
  if (opts.limit) params.set('limit', String(opts.limit))
  if (opts.markets && opts.markets.length) {
    params.set('market', opts.markets.join(','))
  }
  const url = `${SBD_API_BASE}/wp-json/adpt/v1/player-props/${league}?${params.toString()}`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD player props returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdFuturesMarkets(
  league: SbdLeague,
  opts: { init?: RequestInit } = {}
): Promise<any> {
  const url = `${SBD_API_BASE}/wp-json/adpt/v1/futures/${league}/markets`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD futures markets returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdFuturesMarket(
  league: SbdLeague,
  eventId: string,
  opts: { books?: string[]; init?: RequestInit } = {}
): Promise<any> {
  if (!eventId) throw new OddsAPIError('eventId is required')
  const books = opts.books && opts.books.length ? opts.books : getDefaultBookIds()
  const url = `${SBD_API_BASE}/wp-json/adpt/v1/futures/${league}/markets/${eventId}?books=${books.join(',')}`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD futures market returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdGamePropsFilters(
  league: SbdLeague,
  opts: { init?: RequestInit } = {}
): Promise<any> {
  const url = `${SBD_FUEL_BASE}/gameprops/${league}/filters`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD game props filters returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export async function fetchSbdGamePropsList(
  league: SbdLeague,
  opts: { limit?: number; props?: string[]; matchups?: string[]; books?: string[]; init?: RequestInit } = {}
): Promise<any> {
  // Note: SBD fuel API doesn't support limit/props/matchups params - they cause 500 errors
  // Fetch all and filter client-side
  const url = `${SBD_FUEL_BASE}/gameprops/${league}/list`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD game props returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  const data = await res.json()

  // Apply client-side filtering if props filter specified
  if (opts.props && opts.props.length && Array.isArray(data)) {
    const propsSet = new Set(opts.props.map(p => p.toLowerCase()))
    return data.filter((entry: any) => {
      const entryName = (entry?.name || '').toLowerCase()
      return propsSet.has(entryName) || opts.props!.some(p => entryName.includes(p.toLowerCase()))
    })
  }

  return data
}

export async function fetchSbdTrends(
  league: SbdLeague,
  filters: { location?: 'home' | 'away'; expectation?: 'favorite' | 'underdog' } = {},
  opts: { init?: RequestInit } = {}
): Promise<any> {
  const params = new URLSearchParams()
  if (filters.location) params.set('location', filters.location)
  if (filters.expectation) params.set('expectation', filters.expectation)
  const url = `${SBD_SRF_BASE}/v2/trends/${league}${params.toString() ? `?${params.toString()}` : ''}`
  const res = await fetch(url, opts.init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `SBD trends returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res.json()
}

export const mapSbdOddsToOddsGames = (
  league: SbdLeague,
  payload: any,
  allowedMarkets?: string[]
): OddsGame[] => {
  if (!payload || !Array.isArray(payload.data)) return []
  const sportKey = resolveSportKey(league) || league
  const sportTitle = LEAGUE_TITLES[league] || league.toUpperCase()

  return payload.data.map((game: any) => {
    const homeTeam = buildTeamLabel(game?.competitors?.home)
    const awayTeam = buildTeamLabel(game?.competitors?.away)
    const bookmakers = mapSbdMarketsToBookmakers(game?.markets, homeTeam, awayTeam, allowedMarkets)
    return {
      id: String(game?.id ?? ''),
      sport_key: sportKey,
      sport_title: sportTitle,
      commence_time: String(game?.scheduled ?? ''),
      home_team: homeTeam,
      away_team: awayTeam,
      bookmakers,
    }
  })
}

export const mapSbdEventToOddsGame = (
  league: SbdLeague,
  payload: any,
  allowedMarkets?: string[]
): OddsGame | null => {
  if (!payload?.data) return null
  const game = payload.data
  const homeTeam = buildTeamLabel(game?.competitors?.home)
  const awayTeam = buildTeamLabel(game?.competitors?.away)
  const sportKey = resolveSportKey(league) || league
  const sportTitle = LEAGUE_TITLES[league] || league.toUpperCase()
  return {
    id: String(game?.id ?? ''),
    sport_key: sportKey,
    sport_title: sportTitle,
    commence_time: String(game?.scheduled ?? ''),
    home_team: homeTeam,
    away_team: awayTeam,
    bookmakers: mapSbdMarketsToBookmakers(game?.markets, homeTeam, awayTeam, allowedMarkets),
  }
}
