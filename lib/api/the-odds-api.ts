/**
 * Direct integration with The Odds API v4 (the-odds-api.com)
 * This provides access to 100+ bookmakers for line shopping
 */

import { OddsGame, Bookmaker, OddsMarket, OddsOutcome, MARKETS } from '@/lib/types/odds'

const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const DEFAULT_DAILY_LIMIT = 2000

type OddsApiQuotaState = {
  day: string
  limit: number
  used: number | null
  remaining: number | null
  localCount: number
}

const getQuotaDayKey = () => new Date().toISOString().slice(0, 10)

const getQuotaState = (): OddsApiQuotaState => {
  const globalState = globalThis as typeof globalThis & {
    __oddsApiQuotaState?: OddsApiQuotaState
  }
  const limitRaw = process.env.ODDS_API_DAILY_LIMIT
  const limit = Number.isFinite(Number(limitRaw)) ? Number(limitRaw) : DEFAULT_DAILY_LIMIT
  const day = getQuotaDayKey()

  if (!globalState.__oddsApiQuotaState || globalState.__oddsApiQuotaState.day !== day) {
    globalState.__oddsApiQuotaState = {
      day,
      limit,
      used: null,
      remaining: null,
      localCount: 0,
    }
  } else {
    globalState.__oddsApiQuotaState.limit = limit
  }

  return globalState.__oddsApiQuotaState
}

const shouldBlockOddsApi = (_state: OddsApiQuotaState) => false

const updateQuotaFromHeaders = (state: OddsApiQuotaState, headers: Headers) => {
  const remaining = Number(headers.get('x-requests-remaining'))
  const used = Number(headers.get('x-requests-used'))
  if (Number.isFinite(remaining)) {
    state.remaining = remaining
  }
  if (Number.isFinite(used)) {
    state.used = used
    state.localCount = Math.max(state.localCount, used)
  }
  if (!Number.isFinite(used) && !Number.isFinite(remaining)) {
    state.localCount += 1
  }
}

export interface TheOddsApiBookmaker {
  key: string
  title: string
}

export interface TheOddsApiOutcome {
  name: string
  price: number
  point?: number
  description?: string
  bet_limit?: number
  [key: string]: unknown
}

export interface TheOddsApiMarket {
  key: string
  last_update: string
  outcomes: TheOddsApiOutcome[]
  [key: string]: unknown
}

export interface TheOddsApiBookmakerOdds {
  key: string
  title: string
  last_update: string
  markets: TheOddsApiMarket[]
  [key: string]: unknown
}

export interface TheOddsApiEvent {
  id: string
  sport_key: string
  sport_title: string
  commence_time: string
  home_team: string
  away_team: string
  bookmakers: TheOddsApiBookmakerOdds[]
}

export interface TheOddsApiSport {
  key: string
  group: string
  title: string
  description: string
  active: boolean
  has_outrights: boolean
}

// Sport key mappings
export const SPORT_KEYS = {
  nba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  mlb: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  ncaab: 'basketball_ncaab',
  ncaaf: 'americanfootball_ncaaf',
} as const

// Region for US bookmakers
const DEFAULT_REGIONS = 'us,us2,eu'

// All available markets
const ALL_MARKETS = 'h2h,spreads,totals'

function getApiKey(): string {
  const key = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY
  if (!key) {
    throw new Error('THE_ODDS_API_KEY or ODDS_API_KEY is not configured')
  }
  return key
}

/**
 * Fetch list of all available sports
 */
export async function fetchTheOddsApiSports(): Promise<TheOddsApiSport[]> {
  const quota = getQuotaState()
  if (shouldBlockOddsApi(quota)) {
    console.warn(`[THE-ODDS-API] Daily quota reached (${quota.limit}); skipping sports list.`)
    throw new Error(`[THE-ODDS-API] Daily quota reached (${quota.limit}).`)
  }

  const url = new URL(`${THE_ODDS_API_BASE}/sports`)
  url.searchParams.set('apiKey', getApiKey())

  const res = await fetch(url.toString(), {
    next: { revalidate: 3600 }, // Cache for 1 hour
  })

  if (!res.ok) {
    throw new Error(`The Odds API error: ${res.status} ${res.statusText}`)
  }

  updateQuotaFromHeaders(quota, res.headers)
  return res.json()
}

/**
 * Fetch all available bookmakers from The Odds API
 */
export async function fetchAvailableBookmakers(): Promise<TheOddsApiBookmaker[]> {
  // The Odds API doesn't have a dedicated bookmakers endpoint,
  // but we can get them from a sample request. Here's the known list:
  return [
    // US Primary
    { key: 'fanduel', title: 'FanDuel' },
    { key: 'draftkings', title: 'DraftKings' },
    { key: 'betmgm', title: 'BetMGM' },
    { key: 'caesars', title: 'Caesars' },
    { key: 'pointsbetus', title: 'PointsBet (US)' },
    { key: 'betrivers', title: 'BetRivers' },
    { key: 'unibet_us', title: 'Unibet' },
    { key: 'wynnbet', title: 'WynnBET' },
    { key: 'superbook', title: 'SuperBook' },
    { key: 'bovada', title: 'Bovada' },
    { key: 'betonlineag', title: 'BetOnline.ag' },
    { key: 'mybookieag', title: 'MyBookie.ag' },
    { key: 'betus', title: 'BetUS' },
    { key: 'lowvig', title: 'LowVig.ag' },

    // Sharp / International
    { key: 'pinnacle', title: 'Pinnacle' },
    { key: 'betfair_ex_us', title: 'Betfair Exchange' },
    { key: 'matchbook', title: 'Matchbook' },
    { key: 'betfair_sb_uk', title: 'Betfair Sportsbook' },

    // EU / UK Books
    { key: 'bet365', title: 'Bet365' },
    { key: 'williamhill', title: 'William Hill' },
    { key: 'betway', title: 'Betway' },
    { key: 'sport888', title: '888sport' },
    { key: 'unibet', title: 'Unibet' },
    { key: 'ladbrokes_uk', title: 'Ladbrokes' },
    { key: 'coral', title: 'Coral' },
    { key: 'skybet', title: 'Sky Bet' },
    { key: 'paddypower', title: 'Paddy Power' },
    { key: 'betvictor', title: 'BetVictor' },
    { key: 'betfred', title: 'Betfred' },
    { key: 'mrgreen', title: 'Mr Green' },
    { key: 'leovegas', title: 'LeoVegas' },
    { key: 'nordicbet', title: 'NordicBet' },

    // Australia
    { key: 'sportsbet', title: 'Sportsbet' },
    { key: 'tab', title: 'TAB' },
    { key: 'neds', title: 'Neds' },
    { key: 'pointsbetau', title: 'PointsBet (AU)' },
    { key: 'betfair_ex_au', title: 'Betfair Exchange (AU)' },

    // Other
    { key: 'marathon_bet', title: 'Marathon Bet' },
    { key: 'gtbets', title: 'GTbets' },
    { key: 'intertops', title: 'Intertops' },
    { key: 'twinspires', title: 'TwinSpires' },
    { key: 'tipico_us', title: 'Tipico' },
    { key: 'williamhill_us', title: 'William Hill (US)' },
    { key: 'barstool', title: 'Barstool Sportsbook' },
    { key: 'betparx', title: 'BetParx' },
    { key: 'espnbet', title: 'ESPN BET' },
    { key: 'hardrockbet', title: 'Hard Rock Bet' },
    { key: 'fliff', title: 'Fliff' },
    { key: 'livescorebet_us', title: 'LiveScore Bet' },
    { key: 'ballybet', title: 'Bally Bet' },
    { key: 'circa', title: 'Circa Sports' },
    { key: 'station', title: 'Station Casinos' },
    { key: 'sisportsbook', title: 'SI Sportsbook' },
  ]
}

/**
 * Convert American odds from decimal
 */
function decimalToAmerican(decimal: number): number {
  if (decimal >= 2.0) {
    return Math.round((decimal - 1) * 100)
  }
  return Math.round(-100 / (decimal - 1))
}

function parseOptionalPositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

function resolveOutcomeBetLimit(outcome: TheOddsApiOutcome): number | undefined {
  const outcomeAny = outcome as Record<string, unknown> & {
    limits?: Record<string, unknown>
  }
  const candidates: unknown[] = [
    outcome.bet_limit,
    outcomeAny.betLimit,
    outcomeAny.limit,
    outcomeAny.max_limit,
    outcomeAny.max,
    outcomeAny.limits?.bet_limit,
    outcomeAny.limits?.max,
  ]

  for (const candidate of candidates) {
    const parsed = parseOptionalPositiveNumber(candidate)
    if (parsed != null) return parsed
  }
  return undefined
}

/**
 * Map The Odds API response to our internal format
 */
function mapTheOddsApiEvent(event: TheOddsApiEvent): OddsGame {
  const bookmakers: Bookmaker[] = event.bookmakers.map((bk) => {
    const markets: OddsMarket[] = bk.markets.map((market) => {
      // Map market keys
      let marketKey = market.key
      if (marketKey === 'h2h') marketKey = MARKETS.H2H
      else if (marketKey === 'spreads') marketKey = MARKETS.SPREADS
      else if (marketKey === 'totals') marketKey = MARKETS.TOTALS

      const outcomes: OddsOutcome[] = market.outcomes.map((outcome) => ({
        name: outcome.name,
        price: decimalToAmerican(outcome.price),
        point: outcome.point,
        betLimit: resolveOutcomeBetLimit(outcome),
      }))

      return {
        key: marketKey,
        outcomes,
        last_update: market.last_update,
      }
    })

    return {
      key: bk.key,
      title: bk.title,
      markets,
    }
  })

  return {
    id: event.id,
    sport_key: event.sport_key,
    sport_title: event.sport_title,
    commence_time: event.commence_time,
    home_team: event.home_team,
    away_team: event.away_team,
    bookmakers,
  }
}

export interface FetchTheOddsApiOptions {
  regions?: string
  markets?: string
  bookmakers?: string[] // Specific bookmakers to fetch
  oddsFormat?: 'decimal' | 'american'
  dateFormat?: 'iso' | 'unix'
  includeLinks?: boolean
  includeSids?: boolean
  includeBetLimits?: boolean
  includeRotationNumbers?: boolean
  includeMultipliers?: boolean
}

/**
 * Fetch odds from The Odds API v4
 */
export async function fetchTheOddsApiOdds(
  sportKey: string,
  options: FetchTheOddsApiOptions = {}
): Promise<OddsGame[]> {
  const quota = getQuotaState()
  if (shouldBlockOddsApi(quota)) {
    console.warn(`[THE-ODDS-API] Daily quota reached (${quota.limit}); skipping odds fetch.`)
    throw new Error(`[THE-ODDS-API] Daily quota reached (${quota.limit}).`)
  }

  const {
    regions = DEFAULT_REGIONS,
    markets = ALL_MARKETS,
    bookmakers,
    oddsFormat = 'decimal',
    dateFormat = 'iso',
    includeLinks = false,
    includeSids = false,
    includeBetLimits = false,
    includeRotationNumbers = false,
    includeMultipliers = false,
  } = options

  const url = new URL(`${THE_ODDS_API_BASE}/sports/${sportKey}/odds`)
  url.searchParams.set('apiKey', getApiKey())
  url.searchParams.set('regions', regions)
  url.searchParams.set('markets', markets)
  url.searchParams.set('oddsFormat', oddsFormat)
  url.searchParams.set('dateFormat', dateFormat)

  // If specific bookmakers requested, add them
  if (bookmakers && bookmakers.length > 0) {
    url.searchParams.set('bookmakers', bookmakers.join(','))
  }
  if (includeLinks) {
    url.searchParams.set('includeLinks', 'true')
  }
  if (includeSids) {
    url.searchParams.set('includeSids', 'true')
  }
  if (includeBetLimits) {
    url.searchParams.set('includeBetLimits', 'true')
  }
  if (includeRotationNumbers) {
    url.searchParams.set('includeRotationNumbers', 'true')
  }
  if (includeMultipliers) {
    url.searchParams.set('includeMultipliers', 'true')
  }

  console.log(`[THE-ODDS-API] Fetching odds for ${sportKey} from ${url.toString().replace(getApiKey(), '***')}`)

  const res = await fetch(url.toString(), {
    next: { revalidate: 300 }, // Cache for 5 minutes
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[THE-ODDS-API] Error: ${res.status} ${body}`)
    throw new Error(`The Odds API error: ${res.status} ${body || res.statusText}`)
  }

  updateQuotaFromHeaders(quota, res.headers)

  // Log remaining quota
  const remaining = res.headers.get('x-requests-remaining')
  const used = res.headers.get('x-requests-used')
  if (remaining) {
    console.log(`[THE-ODDS-API] Quota: ${remaining} remaining, ${used} used`)
  }

  const events: TheOddsApiEvent[] = await res.json()
  return events.map(mapTheOddsApiEvent)
}

/**
 * Get sport key from league name
 * Handles all the various formats used throughout the app
 */
export function getSportKey(league: string): string | null {
  const normalized = league.toLowerCase().trim()

  // NBA - various formats
  if (
    normalized === 'nba' ||
    normalized === 'basketball_nba' ||
    normalized === 'usa-nba' ||
    normalized.includes('basketball') && normalized.includes('nba')
  ) {
    return 'basketball_nba'
  }

  // NFL - various formats
  if (
    normalized === 'nfl' ||
    normalized === 'americanfootball_nfl' ||
    normalized === 'usa-nfl' ||
    (normalized.includes('football') && normalized.includes('nfl') && !normalized.includes('ncaa'))
  ) {
    return 'americanfootball_nfl'
  }

  // MLB - various formats
  if (
    normalized === 'mlb' ||
    normalized === 'baseball_mlb' ||
    normalized === 'usa-mlb' ||
    normalized.includes('baseball')
  ) {
    return 'baseball_mlb'
  }

  // NHL - various formats
  if (
    normalized === 'nhl' ||
    normalized === 'icehockey_nhl' ||
    normalized === 'usa-nhl' ||
    normalized.includes('hockey')
  ) {
    return 'icehockey_nhl'
  }

  // NCAAB - various formats
  if (
    normalized === 'ncaab' ||
    normalized === 'ncaamb' ||
    normalized === 'ncaam' ||
    normalized === 'basketball_ncaab' ||
    normalized === 'usa-ncaab' ||
    normalized === 'usa-ncaamb' ||
    (normalized.includes('basketball') && (normalized.includes('ncaa') || normalized.includes('college')))
  ) {
    return 'basketball_ncaab'
  }

  // NCAAF - various formats
  if (
    normalized === 'ncaaf' ||
    normalized === 'ncaafb' ||
    normalized === 'cfb' ||
    normalized === 'americanfootball_ncaaf' ||
    normalized === 'usa-ncaaf' ||
    normalized === 'usa-ncaafb' ||
    (normalized.includes('football') && (normalized.includes('ncaa') || normalized.includes('college')))
  ) {
    return 'americanfootball_ncaaf'
  }

  // Direct sport key format (already in correct format)
  if (
    normalized === 'basketball_nba' ||
    normalized === 'americanfootball_nfl' ||
    normalized === 'baseball_mlb' ||
    normalized === 'icehockey_nhl' ||
    normalized === 'basketball_ncaab' ||
    normalized === 'americanfootball_ncaaf'
  ) {
    return normalized
  }

  // Fallback: accept already-normalized The Odds API keys
  if (/^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(normalized)) {
    return normalized
  }

  return null
}

export interface FetchTheOddsApiPlayerPropsOptions extends FetchTheOddsApiOptions {
  markets: string
}

export async function fetchTheOddsApiEvents(
  sportKey: string,
  options: { dateFormat?: 'iso' | 'unix' } = {}
): Promise<TheOddsApiEvent[]> {
  const quota = getQuotaState()
  if (shouldBlockOddsApi(quota)) {
    console.warn(`[THE-ODDS-API] Daily quota reached (${quota.limit}); skipping events fetch.`)
    throw new Error(`[THE-ODDS-API] Daily quota reached (${quota.limit}).`)
  }

  const { dateFormat = 'iso' } = options
  const url = new URL(`${THE_ODDS_API_BASE}/sports/${sportKey}/events`)
  url.searchParams.set('apiKey', getApiKey())
  url.searchParams.set('dateFormat', dateFormat)

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 }, // Cache for 10 minutes
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[THE-ODDS-API] Events error: ${res.status} ${body}`)
    throw new Error(`The Odds API error: ${res.status} ${body || res.statusText}`)
  }

  updateQuotaFromHeaders(quota, res.headers)
  return res.json()
}

export async function fetchTheOddsApiEventOdds(
  sportKey: string,
  eventId: string,
  options: FetchTheOddsApiPlayerPropsOptions
): Promise<TheOddsApiEvent> {
  const quota = getQuotaState()
  if (shouldBlockOddsApi(quota)) {
    console.warn(`[THE-ODDS-API] Daily quota reached (${quota.limit}); skipping event odds fetch.`)
    throw new Error(`[THE-ODDS-API] Daily quota reached (${quota.limit}).`)
  }

  const {
    regions = DEFAULT_REGIONS,
    markets,
    bookmakers,
    oddsFormat = 'american',
    dateFormat = 'iso',
    includeLinks = false,
    includeSids = false,
    includeBetLimits = false,
    includeRotationNumbers = false,
    includeMultipliers = false,
  } = options

  const url = new URL(`${THE_ODDS_API_BASE}/sports/${sportKey}/events/${eventId}/odds`)
  url.searchParams.set('apiKey', getApiKey())
  url.searchParams.set('regions', regions)
  url.searchParams.set('markets', markets)
  url.searchParams.set('oddsFormat', oddsFormat)
  url.searchParams.set('dateFormat', dateFormat)

  if (bookmakers && bookmakers.length > 0) {
    url.searchParams.set('bookmakers', bookmakers.join(','))
  }
  if (includeLinks) {
    url.searchParams.set('includeLinks', 'true')
  }
  if (includeSids) {
    url.searchParams.set('includeSids', 'true')
  }
  if (includeBetLimits) {
    url.searchParams.set('includeBetLimits', 'true')
  }
  if (includeRotationNumbers) {
    url.searchParams.set('includeRotationNumbers', 'true')
  }
  if (includeMultipliers) {
    url.searchParams.set('includeMultipliers', 'true')
  }

  const res = await fetch(url.toString(), {
    next: { revalidate: 600 }, // Cache for 10 minutes
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error(`[THE-ODDS-API] Event odds error: ${res.status} ${body}`)
    throw new Error(`The Odds API error: ${res.status} ${body || res.statusText}`)
  }

  updateQuotaFromHeaders(quota, res.headers)
  return res.json()
}

export async function fetchTheOddsApiPlayerProps(
  sportKey: string,
  options: FetchTheOddsApiPlayerPropsOptions
): Promise<TheOddsApiEvent[]> {
  const {
    markets,
    regions = DEFAULT_REGIONS,
    bookmakers,
    oddsFormat = 'american',
    dateFormat = 'iso',
    includeLinks = false,
    includeSids = false,
    includeBetLimits = false,
    includeRotationNumbers = false,
    includeMultipliers = false,
  } = options

  const sleep = (ms: number) =>
    new Promise<void>((resolve) => {
      setTimeout(resolve, ms)
    })

  const shouldRetryRateLimit = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error ?? '')
    return message.includes('429') || message.includes('EXCEEDED_FREQ_LIMIT')
  }

  const fetchEventOddsWithRetry = async (eventId: string) => {
    const maxAttempts = 4
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        return await fetchTheOddsApiEventOdds(sportKey, eventId, {
          markets,
          regions,
          bookmakers,
          oddsFormat,
          dateFormat,
          includeLinks,
          includeSids,
          includeBetLimits,
          includeRotationNumbers,
          includeMultipliers,
        })
      } catch (error) {
        if (!shouldRetryRateLimit(error) || attempt === maxAttempts) {
          throw error
        }
        const waitMs = 400 * attempt
        await sleep(waitMs)
      }
    }
    throw new Error('Failed to fetch event odds after retries')
  }

  const events = await fetchTheOddsApiEvents(sportKey, { dateFormat })
  const results: TheOddsApiEvent[] = []
  const batchSize = 2

  for (let i = 0; i < events.length; i += batchSize) {
    const batch = events.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(
      batch.map((event) => fetchEventOddsWithRetry(event.id))
    )
    batchResults.forEach((result) => {
      if (result.status === 'fulfilled') {
        results.push(result.value)
      } else {
        console.warn('[THE-ODDS-API] Event props fetch failed:', result.reason)
      }
    })
    if (i + batchSize < events.length) {
      await sleep(150)
    }
  }

  return results
}

/**
 * Fetch odds for line shopping with all available books
 */
export async function fetchLineShoppingOdds(
  league: string,
  selectedBooks?: string[]
): Promise<OddsGame[]> {
  const sportKey = getSportKey(league)
  if (!sportKey) {
    console.warn(`[THE-ODDS-API] Unknown league: ${league}`)
    return []
  }

  try {
    const games = await fetchTheOddsApiOdds(sportKey, {
      regions: DEFAULT_REGIONS,
      markets: ALL_MARKETS,
      bookmakers: selectedBooks,
    })

    console.log(`[THE-ODDS-API] Fetched ${games.length} games for ${league}`)
    return games
  } catch (error) {
    console.error(`[THE-ODDS-API] Failed to fetch odds for ${league}:`, error)
    throw error
  }
}
