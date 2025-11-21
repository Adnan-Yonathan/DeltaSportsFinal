import { OddsGame, ArbitrageOpportunity, MARKETS, Bookmaker, OddsMarket, OddsOutcome } from '@/lib/types/odds'
import { getBookmakerLink } from '@/lib/config/bookmaker-links'
import {
  SportResponse,
  LeagueResponse,
  SimpleEventDto,
  EventResponse,
  HandicapMovementsResponse,
  ArbitrageOpportunityDto,
} from '@/lib/types/odds-io'
import { isArbitrage, calculateArbitrageStakes, americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const ODDS_IO_BASE = 'https://api.odds-api.io/v3'

type NextFetchRequestInit = RequestInit & { next?: { revalidate?: number } }
type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined

export class OddsAPIError extends Error {
  public isRateLimited: boolean = false

  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'OddsAPIError'

    // Detect rate limit errors
    if (
      statusCode === 429 ||
      message.toLowerCase().includes('rate limit') ||
      message.toLowerCase().includes('too many requests') ||
      message.toLowerCase().includes('quota exceeded')
    ) {
      this.isRateLimited = true
    }
  }
}

const getRequiredOddsKey = (): string => {
  const key = process.env.ODDS_API_KEY
  if (!key) {
    throw new OddsAPIError('ODDS_API_KEY is not configured')
  }
  return key
}

async function fetchWithSingleKey(urlBase: string, init?: NextFetchRequestInit): Promise<Response> {
  const apiKey = getRequiredOddsKey()
  const url = new URL(urlBase)
  url.searchParams.set('apiKey', apiKey)

  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `Odds provider returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res
}

const DEFAULT_REVALIDATE_SECONDS = 30

// Alternate spread filtering disabled (include all spreads)
const FILTER_ALTERNATE_SPREADS = false
const MIN_STANDARD_SPREAD_ODDS = Number.NEGATIVE_INFINITY
const MAX_STANDARD_SPREAD_ODDS = Number.POSITIVE_INFINITY

// ============ Odds-API.io Provider (inline) ============
const SPORT_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba: { sport: 'basketball', league: 'usa-nba' },
  basketball_ncaab: { sport: 'basketball', league: 'usa-ncaab' },
  americanfootball_nfl: { sport: 'american-football', league: 'usa-nfl' },
  americanfootball_ncaaf: { sport: 'american-football', league: 'usa-ncaaf' },
  baseball_mlb: { sport: 'baseball', league: 'usa-mlb' },
  icehockey_nhl: { sport: 'ice-hockey', league: 'usa-nhl' },
}

function pickBookmakersParam(): string | undefined {
  const raw = process.env.ODDS_BOOKMAKERS
  if (!raw) return undefined
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list.join(',') : undefined
}

function getDefaultBookmakers(): string | undefined {
  const env = pickBookmakersParam()
  if (env) return env
  // Safe fallback set accepted by odds-api.io
  return ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365'].join(',')
}

const getPlayerPropMarkets = (sportKey: string): string[] | null => {
  if (sportKey === 'basketball_nba') return ['player_points', 'player_rebounds', 'player_assists', 'player_threes']
  if (sportKey === 'americanfootball_nfl') return ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions']
  if (sportKey === 'baseball_mlb') return ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored']
  if (sportKey === 'icehockey_nhl') return ['player_points', 'player_shots_on_goal', 'player_blocked_shots']
  return null
}

let lastAppliedBookmakers: string | null = null
let selectingBookmakersPromise: Promise<void> | null = null

const extractInvalidBookmakers = (message: string): string[] => {
  try {
    const jsonMatch = message.match(/Odds-API\.io error \d+:\s*(\{.*\})/i)
    if (jsonMatch && jsonMatch[1]) {
      const parsed = JSON.parse(jsonMatch[1])
      if (Array.isArray(parsed.invalidBookmakers)) {
        return parsed.invalidBookmakers.map((b: any) => String(b)).filter(Boolean)
      }
    }
  } catch {
    // ignore parsing errors
  }
  return []
}

async function ensureBookmakersSelection(bookmakers?: string | null): Promise<boolean> {
  if (!bookmakers) return false
  const entries = bookmakers
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
  if (!entries.length) return false

  const normalized = entries.join(',')
  if (lastAppliedBookmakers === normalized) return true

  const applySelection = async (list: string[]) => {
    selectingBookmakersPromise = selectBookmakersRemote(list)
    await selectingBookmakersPromise
    lastAppliedBookmakers = list.join(',')
  }

  if (selectingBookmakersPromise) {
    try {
      await selectingBookmakersPromise
    } catch {
      // ignore previous failure; we will retry below
    }
  }

  try {
    await applySelection(entries)
    return true
  } catch (error: any) {
    const message = error?.message ? String(error.message) : ''
    const invalid = extractInvalidBookmakers(message)
    if (invalid.length > 0) {
      const filtered = entries.filter(
        (bk) => !invalid.some((inv) => inv.toLowerCase() === bk.toLowerCase())
      )
      if (filtered.length > 0 && filtered.length < entries.length) {
        console.warn(
          `[ODDS] Removing invalid bookmakers (${invalid.join(
            ', '
          )}) and retrying selection`
        )
        try {
          await applySelection(filtered)
          return true
        } catch (retryError) {
          console.error('[ODDS] Failed to apply bookmaker selection after cleanup:', retryError)
        }
      }
    }
    console.error('[ODDS] Failed to apply bookmaker selection:', error)
    return false
  } finally {
    selectingBookmakersPromise = null
  }
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

const formatQueryValue = (value: QueryValue): string | undefined => {
  if (value === undefined) return undefined
  if (Array.isArray(value)) {
    const filtered = value
      .map((entry) => (typeof entry === 'boolean' ? (entry ? 'true' : 'false') : String(entry)))
      .filter(Boolean)
    return filtered.length ? filtered.join(',') : undefined
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

const buildFetchInit = (opts?: { revalidateSeconds?: number; live?: boolean }): NextFetchRequestInit | undefined => {
  if (!opts) return undefined
  if (opts.live) return { cache: 'no-store' }
  if (typeof opts.revalidateSeconds === 'number') {
    return { next: { revalidate: opts.revalidateSeconds } }
  }
  return undefined
}

interface OddsIoRequestOptions {
  params?: Record<string, QueryValue>
  init?: NextFetchRequestInit
  requireAuth?: boolean
}

async function oddsIoFetch<T>(
  path: string,
  options: OddsIoRequestOptions = {}
): Promise<{ data: T; headers: Headers }> {
  const { params = {}, init, requireAuth = true } = options
  const base = path.startsWith('http') ? path : `${ODDS_IO_BASE}${path}`
  const url = new URL(base)

  if (requireAuth) {
    url.searchParams.set('apiKey', getOddsIOKey())
  }

  for (const [key, rawValue] of Object.entries(params)) {
    const value = formatQueryValue(rawValue)
    if (value != null && value !== '') {
      url.searchParams.set(key, value)
    }
  }

  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    const error = new OddsAPIError(`Odds-API.io error ${res.status}: ${body || res.statusText}`, res.status)

    // Log rate limit warnings
    if (error.isRateLimited) {
      console.error('⚠️ [ODDS API] RATE LIMIT HIT:', {
        status: res.status,
        message: body || res.statusText,
        endpoint: path,
        remainingCalls: res.headers.get('x-ratelimit-remaining'),
        resetTime: res.headers.get('x-ratelimit-reset'),
      })
    }

    throw error
  }

  return { data: (await res.json()) as T, headers: res.headers }
}

function toAmerican(value?: string | number | null): number | undefined {
  if (value == null) return undefined
  const dec = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(dec) || dec <= 1) return undefined
  return decimalToAmerican(dec)
}

function parseNumber(value: any): number | undefined {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (isFinite(parsed)) return parsed
  }
  return undefined
}

// Check if odds are within the allowed spread range (currently unbounded to include all spreads)
function isStandardSpreadOdds(price: number | null | undefined): boolean {
  if (price == null) return false
  return price >= MIN_STANDARD_SPREAD_ODDS && price <= MAX_STANDARD_SPREAD_ODDS
}

export function mapBookmakersIO(
  oddsObj: any,
  home: string,
  away: string,
  allowedMarkets?: string[]
): Bookmaker[] {
  const result: Bookmaker[] = []
  const allowedSet =
    allowedMarkets && allowedMarkets.length
      ? new Set(allowedMarkets.map((m) => m.toLowerCase()))
      : null

  const shouldInclude = (key: string) => !allowedSet || allowedSet.has(key)

  for (const [bookName, markets] of Object.entries(oddsObj || {})) {
    const rawTitle = String(bookName).trim()
    const normalizedLower = rawTitle.toLowerCase()
    const compact = normalizedLower.replace(/[^a-z0-9]/g, '')

    if (compact === 'bet365') {
      continue
    }

    const isBet365NoLatency =
      compact.startsWith('bet365') && normalizedLower.includes('no latency')

    const title = isBet365NoLatency ? 'Bet365' : rawTitle
    const key = slugify(title)
    const mappedMarkets: OddsMarket[] = []
    const url = getBookmakerLink(key)

    for (const market of markets as any[]) {
      const name = market?.name || ''
      const normalizedName = name.toLowerCase()
      const normalizedKey = typeof market?.key === 'string' ? market.key.toLowerCase() : ''
      const last_update = market?.updatedAt

      const oddsEntries = Array.isArray(market?.odds)
        ? market.odds
        : Array.isArray(market?.lines)
          ? market.lines
          : []

      const isMoneyline =
        normalizedName === 'ml' ||
        normalizedName.includes('moneyline') ||
        normalizedName.includes('money line') ||
        normalizedName.includes('h2h') ||
        normalizedKey === 'ml' ||
        normalizedKey === 'moneyline' ||
        normalizedKey === 'h2h'

      if (isMoneyline) {
        const o = oddsEntries.length ? oddsEntries[0] : market.odds
        const out: OddsOutcome[] = []
        const homePrice = toAmerican(o?.home ?? o?.homeOdds ?? o?.home_price)
        const awayPrice = toAmerican(o?.away ?? o?.awayOdds ?? o?.away_price)
        if (homePrice != null) out.push({ name: home, price: homePrice })
        if (o?.draw != null || o?.drawOdds != null) {
          const drawPrice = toAmerican(o?.draw ?? o?.drawOdds ?? o?.draw_price)
          if (drawPrice != null) out.push({ name: 'Draw', price: drawPrice })
        }
        if (awayPrice != null) out.push({ name: away, price: awayPrice })
        if (out.length && shouldInclude('h2h')) {
          mappedMarkets.push({ key: 'h2h', outcomes: out, last_update })
        }
      }

      const isSpread =
        normalizedName.includes('spread') ||
        normalizedName.includes('handicap') ||
        normalizedName.includes('point spread') ||
        normalizedKey.includes('spread') ||
        normalizedKey.includes('handicap')

      if (isSpread && oddsEntries.length) {
        let filteredCount = 0
        let totalSpreadCount = 0

        for (const row of oddsEntries) {
          const hdp = parseNumber(
            row?.hdp ?? row?.handicap ?? row?.line ?? row?.points ?? row?.point
          )
          if (hdp == null) continue

          totalSpreadCount++
          const homePrice = toAmerican(row?.home ?? row?.homeOdds ?? row?.home_price)
          const awayPrice = toAmerican(row?.away ?? row?.awayOdds ?? row?.away_price)

          // Filter out alternate spreads with extreme odds (if enabled)
          // Only include if BOTH sides have standard spread odds (between MIN and MAX)
          if (FILTER_ALTERNATE_SPREADS) {
            if (!isStandardSpreadOdds(homePrice) || !isStandardSpreadOdds(awayPrice)) {
              filteredCount++
              console.log(
                `[ODDS] Filtered alternate spread: ${bookName} ${home} vs ${away} ` +
                `(line: ${hdp}, odds: ${homePrice}/${awayPrice})`
              )
              continue
            }
          }

          const out: OddsOutcome[] = []
          if (homePrice != null) out.push({ name: home, price: homePrice, point: hdp })
          if (awayPrice != null) out.push({ name: away, price: awayPrice, point: -hdp })
          if (out.length && shouldInclude('spreads')) {
            mappedMarkets.push({ key: 'spreads', outcomes: out, last_update })
          }
        }

        if (filteredCount > 0) {
          console.log(
            `[ODDS] ${bookName}: Filtered ${filteredCount}/${totalSpreadCount} alternate spreads ` +
            `(kept ${totalSpreadCount - filteredCount} standard spreads)`
          )
        }
      }

      const isTotal =
        normalizedName.includes('over/under') ||
        normalizedName.includes('total') ||
        normalizedName.includes('over under') ||
        normalizedKey.includes('total') ||
        normalizedKey.includes('over_under')

      if (isTotal && oddsEntries.length) {
        for (const row of oddsEntries) {
          const totalLine = parseNumber(
            row?.max ?? row?.line ?? row?.points ?? row?.point ?? row?.total
          )
          if (totalLine == null) continue
          const overPrice = toAmerican(row?.over ?? row?.overOdds ?? row?.over_price)
          const underPrice = toAmerican(row?.under ?? row?.underOdds ?? row?.under_price)
          const outcomes: OddsOutcome[] = []
          if (overPrice != null) outcomes.push({ name: 'Over', price: overPrice, point: totalLine })
          if (underPrice != null)
            outcomes.push({ name: 'Under', price: underPrice, point: totalLine })
          if (outcomes.length && shouldInclude('totals')) {
            mappedMarkets.push({ key: 'totals', outcomes: outcomes, last_update })
          }
        }
      }

      if (
        !isMoneyline &&
        !isSpread &&
        !isTotal &&
        typeof market?.key === 'string' &&
        shouldInclude(market.key)
      ) {
        const outcomes = Array.isArray(market?.odds) ? market.odds : market?.outcomes
        if (Array.isArray(outcomes) && outcomes.length) {
          const normalizedOutcomes = outcomes
            .map((o) => {
              const price = toAmerican(o?.price ?? o?.odds ?? o?.lineOdds)
              if (price == null) return undefined
              const point = parseNumber(o?.point ?? o?.line ?? o?.threshold)
              const normalized: OddsOutcome = {
                name: o?.name ?? o?.selection ?? '',
                price,
              }
              if (point != null) normalized.point = point
              return normalized
            })
            .filter((value): value is OddsOutcome => Boolean(value))

          if (normalizedOutcomes.length) {
            mappedMarkets.push({
              key: market.key,
              outcomes: normalizedOutcomes,
              last_update,
            })
          }
        }
      }
    }

    if (mappedMarkets.length) {
      result.push({ key, title, url, markets: mappedMarkets })
    }
  }
  return result
}

const VALID_EVENT_STATUSES = new Set(['pending', 'live', 'settled'])
const UPCOMING_STATUSES = ['pending'] as const

const normalizeEventStatuses = (status?: string | ReadonlyArray<string> | null): string | undefined => {
  if (!status) return undefined
  const source = Array.isArray(status) ? Array.from(status) : String(status).split(',')
  const normalized = source
    .map((entry: string) => entry.trim().toLowerCase())
    .filter((entry: string) => VALID_EVENT_STATUSES.has(entry))
  if (!normalized.length) return undefined
  return Array.from(new Set(normalized)).join(',')
}

const normalizeBookmakerList = (input?: string | string[] | null): string | undefined => {
  if (input === null) return undefined
  if (input === undefined) return pickBookmakersParam()
  const source = Array.isArray(input) ? input : input.split(',')
  const list = source.map((entry) => entry.trim()).filter(Boolean)
  if (!list.length) return pickBookmakersParam()
  return list.join(',')
}

export async function listSports(options?: { revalidateSeconds?: number }): Promise<SportResponse[]> {
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 3600 })
  const { data } = await oddsIoFetch<SportResponse[]>('/sports', {
    init,
    requireAuth: false,
  })
  return data
}

export async function listLeagues(
  sport: string,
  options?: { revalidateSeconds?: number }
): Promise<LeagueResponse[]> {
  if (!sport) throw new OddsAPIError('Sport parameter is required for leagues lookup')
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 900 })
  const { data } = await oddsIoFetch<LeagueResponse[]>('/leagues', {
    params: { sport },
    init,
  })
  return data
}

export interface FetchProviderEventsParams {
  sport: string
  league?: string
  status?: string | ReadonlyArray<string>
  from?: string
  to?: string
  limit?: number
}

export async function fetchEventsList(
  filters: FetchProviderEventsParams,
  options?: { revalidateSeconds?: number; live?: boolean }
): Promise<SimpleEventDto[]> {
  if (!filters?.sport) throw new OddsAPIError('Sport is required to fetch events')
  const init = buildFetchInit({
    live: options?.live,
    revalidateSeconds: options?.revalidateSeconds,
  })
  const statusParam = normalizeEventStatuses(filters.status)
  const params: Record<string, QueryValue> = {
    sport: filters.sport,
    league: filters.league,
    status: statusParam,
    from: filters.from,
    to: filters.to,
    limit: filters.limit,
  }
  const { data } = await oddsIoFetch<SimpleEventDto[]>('/events', { params, init })
  return data
}

export async function fetchLiveEventsList(
  sport?: string,
  options?: { revalidateSeconds?: number }
): Promise<SimpleEventDto[]> {
  const init =
    options?.revalidateSeconds != null
      ? buildFetchInit({ revalidateSeconds: options.revalidateSeconds })
      : buildFetchInit({ live: true })

  const { data } = await oddsIoFetch<SimpleEventDto[]>('/events/live', {
    params: { sport },
    init,
  })
  return data
}

export async function fetchEventById(id: string, options?: { revalidateSeconds?: number }) {
  if (!id) throw new OddsAPIError('Event ID is required')
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 120 })
  const { data } = await oddsIoFetch<SimpleEventDto>(`/events/${id}`, { init })
  return data
}

export async function searchEvents(
  query: string,
  options?: { revalidateSeconds?: number }
): Promise<SimpleEventDto[]> {
  if (!query || query.length < 3) throw new OddsAPIError('Search query must be at least 3 characters')
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 60 })
  const { data } = await oddsIoFetch<SimpleEventDto[]>('/events/search', {
    params: { query },
    init,
  })
  return data
}

export async function fetchEventOdds(
  eventId: string,
  bookmakers?: string | string[] | null,
  init?: NextFetchRequestInit,
  markets?: string[] | null
): Promise<EventResponse> {
  if (!eventId) throw new OddsAPIError('eventId is required')
  let bookmakerParam: string | undefined
  if (bookmakers === null) {
    // Explicit null disables the bookmaker filter so we can fetch all available data
    bookmakerParam = undefined
  } else {
    bookmakerParam = normalizeBookmakerList(bookmakers) ?? getDefaultBookmakers()
  }
  const params: Record<string, QueryValue> = {
    eventId,
    regions: process.env.ODDS_REGIONS || 'us',
  }
  if (bookmakerParam) {
    params.bookmakers = bookmakerParam
  }
  if (markets && markets.length) {
    params.markets = markets.join(',')
  }
  const { data } = await oddsIoFetch<EventResponse>('/odds', {
    params,
    init,
  })
  return data
}

export async function fetchMultiEventOdds(
  eventIds: string[],
  bookmakers?: string | string[] | null,
  init?: NextFetchRequestInit,
  markets?: string[] | null
): Promise<EventResponse[]> {
  const ids = eventIds.map((id) => String(id).trim()).filter(Boolean)
  if (!ids.length) return []
  const results: EventResponse[] = []

  for (const id of ids) {
    try {
      const event = await fetchEventOdds(id, bookmakers, init, markets)
      results.push(event)
    } catch (error) {
      console.error(`[ODDS] Failed to fetch odds for event ${id}:`, error)
    }
  }

  return results
}

export interface UpdatedOddsParams {
  since: number
  bookmaker: string
  sport: string
}

export async function fetchUpdatedOdds(
  params: UpdatedOddsParams,
  init?: NextFetchRequestInit
): Promise<EventResponse[]> {
  if (!params?.since) throw new OddsAPIError('"since" is required for updated odds')
  if (!params.bookmaker) throw new OddsAPIError('"bookmaker" is required for updated odds')
  if (!params.sport) throw new OddsAPIError('"sport" is required for updated odds')
  const query: Record<string, QueryValue> = {
    since: params.since,
    bookmaker: params.bookmaker,
    sport: params.sport,
  }
  const { data } = await oddsIoFetch<EventResponse[]>('/odds/updated', {
    params: query,
    init,
  })
  return data
}

export interface OddsMovementParams {
  eventId: string
  bookmaker: string
  market: string
  marketLine?: string
}

export async function fetchOddsMovements(
  params: OddsMovementParams,
  init?: NextFetchRequestInit
): Promise<HandicapMovementsResponse> {
  if (!params.eventId) throw new OddsAPIError('"eventId" is required for odds movements')
  if (!params.bookmaker) throw new OddsAPIError('"bookmaker" is required for odds movements')
  if (!params.market) throw new OddsAPIError('"market" is required for odds movements')
  const { data } = await oddsIoFetch<HandicapMovementsResponse>('/odds/movements', {
    params: {
      eventId: params.eventId,
      bookmaker: params.bookmaker,
      market: params.market,
      marketLine: params.marketLine,
    },
    init,
  })
  return data
}

export interface ArbitrageQueryParams {
  bookmakers: string | string[]
  limit?: number
  includeEventDetails?: boolean
}

export async function fetchArbitrageOpportunitiesRemote(
  params: ArbitrageQueryParams,
  init?: NextFetchRequestInit
): Promise<ArbitrageOpportunityDto[]> {
  const bookmakerParam = normalizeBookmakerList(params.bookmakers)
  if (!bookmakerParam) {
    throw new OddsAPIError('At least one bookmaker is required to fetch arbitrage opportunities')
  }
  const { data } = await oddsIoFetch<ArbitrageOpportunityDto[]>('/arbitrage-bets', {
    params: {
      bookmakers: bookmakerParam,
      limit: params.limit,
      includeEventDetails: params.includeEventDetails,
    },
    init,
  })
  return data
}

export async function selectBookmakersRemote(bookmakers: string | string[]) {
  const bookmakerParam = normalizeBookmakerList(bookmakers)
  if (!bookmakerParam) {
    throw new OddsAPIError('At least one bookmaker is required')
  }
  await oddsIoFetch('/bookmakers/selected/select', {
    params: { bookmakers: bookmakerParam },
    init: { method: 'PUT' },
  })
}


async function fetchOddsIO(
  sportKey: string,
  _markets: string[] = ['h2h', 'spreads', 'totals'],
  opts: { live?: boolean; revalidateSeconds?: number; teamFilter?: string[]; bookmakers?: string | string[] | null } = {}
): Promise<OddsGame[]> {
  const baseMapping = SPORT_MAP[sportKey]
  if (!baseMapping) return []
  // NCAAB league slug is unstable; omit league filter to avoid provider errors/timeouts
  const mapping = sportKey === 'basketball_ncaab' ? { ...baseMapping, league: undefined } : baseMapping
  const oddsFetchInit = buildFetchInit({
    live: opts.live,
    revalidateSeconds: opts.live ? undefined : opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS,
  })
  const statusFilters = opts.live ? ['live'] : UPCOMING_STATUSES

  const fetchEventsSafe = async (
    filters: FetchProviderEventsParams,
    options?: { revalidateSeconds?: number; live?: boolean }
  ): Promise<SimpleEventDto[]> => {
    try {
      return await fetchEventsList(filters, options)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (
        filters.league &&
        error instanceof OddsAPIError &&
        message.toLowerCase().includes('league not found')
      ) {
        console.warn(
          `[ODDS] League "${filters.league}" not recognized for ${sportKey}, retrying without league filter`
        )
        const { league, ...rest } = filters
        return fetchEventsList(rest as FetchProviderEventsParams, options)
      } else if (
        error instanceof OddsAPIError &&
        message.toLowerCase().includes('invalid status')
      ) {
        console.warn(
          `[ODDS] Invalid status filter "${filters.status}" for ${sportKey}, retrying without status filter`
        )
        const { status, ...rest } = filters
        return fetchEventsList(rest as FetchProviderEventsParams, options)
      }
      throw error instanceof Error ? error : new OddsAPIError(message)
    }
  }

  const timeWindowNcaab = () => {
    const now = new Date()
    const from = new Date(now)
    const to = new Date(now)
    to.setDate(to.getDate() + 3)
    return { from: from.toISOString(), to: to.toISOString(), limit: 200 }
  }

  let events: SimpleEventDto[] = []
  try {
    const baseFilters: FetchProviderEventsParams = {
      sport: mapping.sport,
      league: mapping.league,
      status: statusFilters,
    }
    if (sportKey === 'basketball_ncaab') {
      const window = timeWindowNcaab()
      baseFilters.from = window.from
      baseFilters.to = window.to
      baseFilters.limit = window.limit
    }

    if (opts.live) {
      const liveEvents = await fetchLiveEventsList(mapping.sport, {
        revalidateSeconds: Math.max(opts.revalidateSeconds ?? 20, 10),
      })
      events = liveEvents.filter((event) => {
        const leagueSlug =
          typeof event.league === 'string'
            ? event.league
            : event.league?.slug || event.league?.name
        return !mapping.league || leagueSlug?.toLowerCase() === mapping.league
      })

      // Fallback to the traditional status filter if /events/live misses anything.
      if (events.length === 0) {
        console.warn(
          `[ODDS] No live events found via /events/live for ${sportKey}, retrying with status filter`
        )
        events = await fetchEventsSafe(baseFilters, {
          live: true,
          revalidateSeconds: Math.max(opts.revalidateSeconds ?? 20, 10),
        })
      }
    } else {
      events = await fetchEventsSafe(baseFilters, {
        live: opts.live,
        revalidateSeconds: opts.live ? undefined : Math.max(opts.revalidateSeconds ?? 60, 30),
      })
    }
  } catch (error) {
    throw error instanceof Error ? error : new OddsAPIError(String(error))
  }

  if (!Array.isArray(events) || events.length === 0) {
    if (!opts.live) {
      console.warn(
        `[ODDS] No pre-match events found for ${sportKey} with statuses ${statusFilters.join(',')}, retrying without status filter`
      )
      const base: FetchProviderEventsParams = {
        sport: mapping.sport,
        league: mapping.league,
      }
      if (sportKey === 'basketball_ncaab') {
        const window = timeWindowNcaab()
        base.from = window.from
        base.to = window.to
        base.limit = window.limit
      }
      events = await fetchEventsSafe(base, {
        live: opts.live,
        revalidateSeconds: opts.live ? undefined : Math.max(opts.revalidateSeconds ?? 60, 30),
      })
    }
  }

  if (!Array.isArray(events) || events.length === 0) {
    if (!opts.live && mapping.league) {
      console.warn(
        `[ODDS] Still no events for ${sportKey}; retrying without league or status filters`
      )
      const base: FetchProviderEventsParams = { sport: mapping.sport }
      if (sportKey === 'basketball_ncaab') {
        const window = timeWindowNcaab()
        base.from = window.from
        base.to = window.to
        base.limit = window.limit
      }
      events = await fetchEventsSafe(base, {
        live: opts.live,
        revalidateSeconds: opts.live ? undefined : Math.max(opts.revalidateSeconds ?? 60, 30),
      })
    }
  }

  if (!Array.isArray(events) || events.length === 0) {
    return []
  }

  // Filter events by team name BEFORE loading odds (massive optimization!)
  let filteredEvents = events
  if (opts.teamFilter && opts.teamFilter.length > 0) {
    console.log(`[ODDS] Filtering ${events.length} events by teams:`, opts.teamFilter)
    filteredEvents = events.filter((event) => {
      const home = (event.home || '').toLowerCase()
      const away = (event.away || '').toLowerCase()
      return opts.teamFilter!.some((team) => {
        const teamLower = team.toLowerCase()
        return home.includes(teamLower) || away.includes(teamLower)
      })
    })
    console.log(`[ODDS] After team filter: ${filteredEvents.length} events (saved ${events.length - filteredEvents.length} API calls)`)
  }

  const eventLookup = new Map(filteredEvents.map((event) => [String(event.id), event]))
  const ids: string[] = Array.from(eventLookup.keys())
  if (ids.length === 0) return []

  const envBookmakers = opts.bookmakers ? normalizeBookmakerList(opts.bookmakers) : pickBookmakersParam()

  // Apply bookmaker selection; if the provided list fails, fall back to a safe default set
  let appliedBookmakers: string | null | undefined = envBookmakers
  let bookmakerSelectionApplied = await ensureBookmakersSelection(appliedBookmakers ?? null)
  if (!bookmakerSelectionApplied) {
    const fallbackBookmakers = getDefaultBookmakers()
    if (fallbackBookmakers && fallbackBookmakers !== appliedBookmakers) {
      appliedBookmakers = fallbackBookmakers
      bookmakerSelectionApplied = await ensureBookmakersSelection(appliedBookmakers)
    }
  }
  const defaultBookmakersFilter = bookmakerSelectionApplied
    ? appliedBookmakers
    : appliedBookmakers ?? getDefaultBookmakers()
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

  const loadGames = async (bookmakersFilter?: string | null): Promise<OddsGame[]> => {
    const games: OddsGame[] = []

    for (const chunk of chunks) {
      const activeFilter =
        bookmakersFilter === undefined ? defaultBookmakersFilter : bookmakersFilter
      const data = await fetchMultiEventOdds(chunk, activeFilter ?? null, oddsFetchInit, _markets)
      if (!Array.isArray(data) || !data.length) continue

      for (const ev of data) {
        const meta = eventLookup.get(String(ev.id))
        const home = ev.home || meta?.home || ''
        const away = ev.away || meta?.away || ''
        const bk = mapBookmakersIO(ev.bookmakers || {}, home, away, _markets)
        if (bk.length === 0) continue

        const commence = ev.date || meta?.date || new Date().toISOString()
        games.push({
          id: String(ev.id),
          sport_key: sportKey,
          sport_title: (mapping.league || mapping.sport || sportKey).toUpperCase(),
          commence_time: String(commence),
          home_team: String(home),
          away_team: String(away),
          bookmakers: bk,
        })
      }
    }

    return games
  }

  let games: OddsGame[] = []
  try {
    games = await loadGames(undefined)
  } catch (error: any) {
    const message = String(error?.message || '')
    if (
      defaultBookmakersFilter &&
      (error instanceof OddsAPIError || message.includes('bookmaker')) &&
      message.toLowerCase().includes('not a valid bookmaker')
    ) {
      console.warn(
        `[ODDS] Invalid bookmaker in filter "${defaultBookmakersFilter}", retrying without filter`
      )
      games = await loadGames(null)
    } else {
      throw error
    }
  }

  if (!games.length && defaultBookmakersFilter) {
    console.warn(
      '[ODDS] No bookmakers returned for ' + sportKey + ' with filter "' + defaultBookmakersFilter + '", retrying without filter'
    )
    games = await loadGames(null)
  }

  return games
}

/**
 * Fetch odds for a specific sport
 */
export interface FetchOddsOptions {
  live?: boolean
  revalidateSeconds?: number
  teamFilter?: string[] // Filter events to only these team names (case-insensitive partial match)
  bookmakers?: string | string[] | null // Optional override of bookmaker filter
}

export async function fetchOdds(
  sport: string,
  markets: string[] = ['h2h', 'spreads', 'totals'],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  const provider = (process.env.ODDS_PROVIDER || 'odds-api-io').toLowerCase()
  if (provider === 'odds-api-io') {
    return fetchOddsIO(sport, markets, {
      live: options.live,
      revalidateSeconds: options.revalidateSeconds,
      teamFilter: options.teamFilter,
    })
  }

  const marketsParam = markets.join(',')
  const url = `${ODDS_API_BASE}/sports/${sport}/odds/?regions=us&markets=${marketsParam}&oddsFormat=american`
  const fetchInit: NextFetchRequestInit = options.live
    ? { cache: 'no-store' }
    : { next: { revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS } }

  try {
    const response = await fetchWithSingleKey(url, fetchInit)
    const data = await response.json()
    return data as OddsGame[]
  } catch (error: any) {
    if (error instanceof OddsAPIError) throw error
    throw new OddsAPIError(`Failed to fetch odds: ${error?.message || error}`)
  }
}

/**
 * Fetch player props via odds-api.io player props endpoint
 */
export async function fetchPlayerProps(
  sportKey: string,
  markets?: string[] | null,
  options: { teamFilter?: string[]; playerFilter?: string[] } = {}
): Promise<EventResponse[]> {
  const mapping = SPORT_MAP[sportKey]
  if (!mapping) return []
  const appliedMarkets = markets && markets.length ? markets : getPlayerPropMarkets(sportKey) || []
  if (!appliedMarkets.length) return []

  const params: Record<string, QueryValue> = {
    sport: mapping.sport,
    league: mapping.league,
    markets: appliedMarkets.join(','),
    regions: process.env.ODDS_REGIONS || 'us',
  }

  const bookmakers = normalizeBookmakerList(null) ?? getDefaultBookmakers()
  if (bookmakers) params.bookmakers = bookmakers

  if (options.teamFilter && options.teamFilter.length) {
    params.teams = options.teamFilter.join(',')
  }
  if (options.playerFilter && options.playerFilter.length) {
    params.players = options.playerFilter.join(',')
  }

  const { data } = await oddsIoFetch<EventResponse[]>('/player-props', {
    params,
    init: { cache: 'no-store' },
  })
  return data
}

/**
 * Fetch available sports (provider-aware; Odds-API.io preferred)
 */
export async function fetchSports(): Promise<any[]> {
  const provider = (process.env.ODDS_PROVIDER || 'odds-api-io').toLowerCase()
  if (provider === 'odds-api-io') {
    return listSports()
  }

  const url = `${ODDS_API_BASE}/sports/`
  try {
    const response = await fetchWithSingleKey(url, { next: { revalidate: 3600 } })
    return await response.json()
  } catch (error) {
    if (error instanceof OddsAPIError) throw error
    throw new OddsAPIError(`Failed to fetch sports: ${error}`)
  }
}

/**
 * Find arbitrage opportunities in a list of games
 */
export function findArbitrageOpportunities(
  games: OddsGame[],
  minProfitPercent: number = 1
): ArbitrageOpportunity[] {
  const opportunities: ArbitrageOpportunity[] = []

  for (const game of games) {
    const gameDescription = `${game.away_team} @ ${game.home_team}`

    for (const marketKey of Object.values(MARKETS)) {
      const marketOdds = new Map<string, { book: string; odds: number; point?: number }[]>()

      for (const bookmaker of game.bookmakers) {
        const market = bookmaker.markets.find((m) => m.key === marketKey)
        if (!market) continue

        for (const outcome of market.outcomes) {
          const key = outcome.point !== undefined
            ? `${outcome.name}_${outcome.point}`
            : outcome.name

          if (!marketOdds.has(key)) {
            marketOdds.set(key, [])
          }

          marketOdds.get(key)!.push({
            book: bookmaker.title,
            odds: outcome.price,
            point: outcome.point,
          })
        }
      }

      const outcomes = Array.from(marketOdds.keys())

      for (let i = 0; i < outcomes.length; i++) {
        for (let j = i + 1; j < outcomes.length; j++) {
          const outcome1Options = marketOdds.get(outcomes[i])!
          const outcome2Options = marketOdds.get(outcomes[j])!

          const best1 = outcome1Options.reduce((best, curr) =>
            curr.odds > best.odds ? curr : best
          )
          const best2 = outcome2Options.reduce((best, curr) =>
            curr.odds > best.odds ? curr : best
          )

          if (isArbitrage(best1.odds, best2.odds)) {
            const totalStake = 1000
            const arb = calculateArbitrageStakes(totalStake, best1.odds, best2.odds)

            if (arb.profitPercent >= minProfitPercent) {
              opportunities.push({
                game: gameDescription,
                market: marketKey,
                profitPercent: arb.profitPercent,
                totalStake,
                guaranteedProfit: arb.profit,
                legs: [
                  {
                    book: best1.book,
                    selection: outcomes[i],
                    odds: americanToDecimal(best1.odds),
                    stake: arb.stake1,
                    americanOdds: best1.odds,
                  },
                  {
                    book: best2.book,
                    selection: outcomes[j],
                    odds: americanToDecimal(best2.odds),
                    stake: arb.stake2,
                    americanOdds: best2.odds,
                  },
                ],
              })
            }
          }
        }
      }
    }
  }

  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent)
}

export function getBestOdds(game: OddsGame, marketKey: string): Map<string, {
  book: string
  odds: number
  point?: number
}> {
  const bestOdds = new Map<string, { book: string; odds: number; point?: number }>()

  for (const bookmaker of game.bookmakers) {
    const market = bookmaker.markets.find((m) => m.key === marketKey)
    if (!market) continue

    for (const outcome of market.outcomes) {
      const key = outcome.point !== undefined
        ? `${outcome.name}_${outcome.point}`
        : outcome.name

      const current = bestOdds.get(key)
      if (!current || outcome.price > current.odds) {
        bestOdds.set(key, {
          book: bookmaker.title,
          odds: outcome.price,
          point: outcome.point,
        })
      }
    }
  }

  return bestOdds
}


// (duplicate SPORT_MAP removed; single definition kept above)

function getOddsIOKey(): string {
  const key = process.env.ODDS_API_KEY as string | undefined
  if (!key) throw new OddsAPIError('ODDS_API_KEY is not configured')
  return key
}

export async function fetchEventsIO(
  sportKey: string,
  opts: { status?: 'pending' | 'live'; tz?: string; day?: 'today' | 'tomorrow' } = {}
): Promise<Array<{ id: string; home: string; away: string; date: string; status: string }>> {
  const mapping = SPORT_MAP[sportKey]
  if (!mapping) return []
  const apiKey = getOddsIOKey()
  const requestedStatus = opts.status || 'pending'
  const statusQueue = requestedStatus === 'live' ? ['live'] : ['pending']

  let events: any[] = []
  let lastError: Error | undefined
  let hadSuccessfulResponse = false

  for (const status of statusQueue) {
    const url = new URL(`${ODDS_IO_BASE}/events`)
    url.searchParams.set('apiKey', apiKey)
    url.searchParams.set('sport', mapping.sport)
    url.searchParams.set('league', mapping.league)
    url.searchParams.set('status', status)

    try {
      const init: NextFetchRequestInit = { next: { revalidate: status === 'live' ? 10 : 60 } }
      const res = await fetch(url.toString(), init)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        lastError = new OddsAPIError(
          `Odds-API.io events error ${res.status}: ${body || res.statusText}`,
          res.status
        )
        continue
      }

      hadSuccessfulResponse = true
      const payload = (await res.json()) as any[]
      if (Array.isArray(payload) && payload.length > 0) {
        events = payload
        break
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
    }
  }

  if (!events.length) {
    if (lastError && !hadSuccessfulResponse) throw lastError
    return []
  }

  const tz = opts.tz || 'America/New_York'
  const day = opts.day || 'today'
  const now = new Date()
  const base = new Date(now.toLocaleString('en-US', { timeZone: tz }))
  if (day === 'tomorrow') base.setDate(base.getDate() + 1)
  const start = new Date(base)
  start.setHours(0, 0, 0, 0)
  const end = new Date(base)
  end.setHours(23, 59, 59, 999)

  const filtered = events.filter((ev) => {
    const d = new Date(ev.date)
    const local = new Date(d.toLocaleString('en-US', { timeZone: tz }))
    return local >= start && local <= end
  })

  return filtered.map((ev) => ({
    id: String(ev.id),
    home: String(ev.home),
    away: String(ev.away),
    date: String(ev.date),
    status: String(ev.status || requestedStatus),
  }))
}
