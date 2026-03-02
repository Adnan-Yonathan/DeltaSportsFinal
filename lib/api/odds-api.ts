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
import { OddsAPIError } from '@/lib/api/odds-errors'
import {
  fetchSbdOdds,
  fetchSbdSportEvent,
  mapSbdOddsToOddsGames,
  mapSbdEventToOddsGame,
  mapSbdMarketsToBookmakers,
  resolveSbdLeague,
  resolveSportKey as resolveSportKeyFromLeague,
  DEFAULT_BOOK_IDS,
  getDefaultBookIds,
  resolveBookIds,
  buildTeamLabel,
  type SbdLeague,
} from '@/lib/api/sbd'
import { fetchPolymarketOdds } from '@/lib/api/polymarket'
import { fetchKalshiOdds } from '@/lib/api/kalshi'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { fetchTheOddsApiOdds, getSportKey as getTheOddsApiSportKey } from '@/lib/api/the-odds-api'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const ODDS_IO_BASE = 'https://api.odds-api.io/v3'

type NextFetchRequestInit = RequestInit & { next?: { revalidate?: number } }
type QueryValue = string | number | boolean | Array<string | number | boolean> | undefined

export { OddsAPIError } from '@/lib/api/odds-errors'

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

const DEFAULT_REVALIDATE_SECONDS = 600
type OddsCacheEntry = { value: OddsGame[]; expiresAt: number }
const oddsCache = new Map<string, OddsCacheEntry>()

const STANDARD_MARKETS = [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS] as const

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

const SBD_LEAGUES: SbdLeague[] = ['nba', 'nfl', 'mlb', 'nhl', 'ncaamb', 'ncaafb']

const LEGACY_LEAGUE_MAP: Record<string, SbdLeague> = {
  'usa-nba': 'nba',
  'usa-ncaab': 'ncaamb',
  'usa-nfl': 'nfl',
  'usa-ncaaf': 'ncaafb',
  'usa-mlb': 'mlb',
  'usa-nhl': 'nhl',
}

const resolveSbdLeagueFromFilters = (sport: string, league?: string): SbdLeague | null => {
  const leagueValue = (league || '').toLowerCase().trim()
  if (leagueValue) {
    const legacy = LEGACY_LEAGUE_MAP[leagueValue]
    if (legacy) return legacy
    const direct = resolveSbdLeague(leagueValue)
    if (direct) return direct
  }

  const sportValue = (sport || '').toLowerCase().trim()
  const direct = resolveSbdLeague(sportValue)
  if (direct) return direct

    if (sportValue.includes('basketball')) {
      if (
        sportValue.includes('ncaab') ||
        sportValue.includes('ncaam') ||
        sportValue.includes('college')
      ) {
        return 'ncaamb'
      }
      return leagueValue.includes('nca') ? 'ncaamb' : 'nba'
    }
    if (sportValue.includes('football')) {
      if (
        sportValue.includes('ncaaf') ||
        sportValue.includes('cfb') ||
        sportValue.includes('college')
      ) {
        return 'ncaafb'
      }
      return leagueValue.includes('nca') ? 'ncaafb' : 'nfl'
    }
  if (sportValue.includes('baseball')) return 'mlb'
  if (sportValue.includes('hockey')) return 'nhl'
  return null
}

const normalizeSbdStatus = (status?: string | null): string => {
  const normalized = (status || '').toLowerCase()
  if (!normalized) return 'pending'
  if (normalized === 'live') return 'live'
  if (
    normalized === 'not_started' ||
    normalized === 'scheduled' ||
    normalized === 'pre' ||
    normalized === 'pre_match'
  ) {
    return 'pending'
  }
  if (
    normalized === 'closed' ||
    normalized === 'ended' ||
    normalized === 'finished' ||
    normalized === 'settled'
  ) {
    return 'settled'
  }
  return normalized
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
  if (sportKey === 'americanfootball_nfl') return ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_rush_tds', 'player_receptions', 'player_reception_yds']
  if (sportKey === 'baseball_mlb') return ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored']
  if (sportKey === 'icehockey_nhl') return ['player_points', 'player_shots_on_goal', 'player_blocked_shots']
  return null
}

let lastAppliedBookmakers: string | null = null
let selectingBookmakersPromise: Promise<void> | null = null
let selectedSbdBookIds: string[] | null = null

const pickSbdBookIds = (bookmakers?: string | string[] | null): string[] => {
  if (bookmakers !== undefined) {
    return resolveBookIds(bookmakers)
  }
  if (selectedSbdBookIds && selectedSbdBookIds.length) {
    return selectedSbdBookIds
  }
  return getDefaultBookIds()
}

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

// Normalize provider odds that may be decimal or already American
function normalizePrice(value: any): number | undefined {
  const num = parseNumber(value)
  if (num == null) return undefined

  // Decimal odds (common range)
  if (num > 1 && num < 20) {
    const converted = decimalToAmerican(num)
    return isFinite(converted) ? converted : undefined
  }

  // American odds
  if (Math.abs(num) >= 100 && Math.abs(num) <= 2000) {
    return Math.round(num)
  }

  return undefined
}

function parseNumber(value: any): number | undefined {
  if (typeof value === 'number' && isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (isFinite(parsed)) return parsed
  }
  return undefined
}

function resolveTotalsMarketKey(normalizedName: string, normalizedKey: string): string | null {
  const combined = `${normalizedName} ${normalizedKey}`.trim()

  if (
    combined.includes('team total') ||
    normalizedKey.includes('team_total') ||
    normalizedKey.includes('teamtotal')
  ) {
    return null
  }

  const firstHalf =
    combined.includes('1st half') ||
    combined.includes('first half') ||
    /\b1h\b/.test(combined) ||
    normalizedKey.includes('1st_half') ||
    normalizedKey.includes('first_half') ||
    normalizedKey.includes('1h')
  const secondHalf =
    combined.includes('2nd half') ||
    combined.includes('second half') ||
    /\b2h\b/.test(combined) ||
    normalizedKey.includes('2nd_half') ||
    normalizedKey.includes('second_half') ||
    normalizedKey.includes('2h')

  if (firstHalf) return MARKETS.TOTALS_1H
  if (secondHalf) return MARKETS.TOTALS_2H

  const quarterMatch =
    combined.match(/\bq([1-4])\b/) ||
    combined.match(/\b([1-4])(st|nd|rd|th)\s*quarter\b/) ||
    combined.match(/\bquarter\s*([1-4])\b/)
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

  if (combined.includes('half')) {
    return null
  }

  return MARKETS.TOTALS
}

function resolveTeamTotalsMarketKey(
  normalizedName: string,
  normalizedKey: string
): string | null {
  const combined = `${normalizedName} ${normalizedKey}`.trim()
  if (
    !combined.includes('team') ||
    !(combined.includes('total') || combined.includes('over/under'))
  ) {
    return null
  }

  const firstHalf =
    combined.includes('1st half') ||
    combined.includes('first half') ||
    /\b1h\b/.test(combined)
  const secondHalf =
    combined.includes('2nd half') ||
    combined.includes('second half') ||
    /\b2h\b/.test(combined)

  if (firstHalf) return MARKETS.TEAM_TOTALS_1H
  if (secondHalf) return MARKETS.TEAM_TOTALS_2H
  return MARKETS.TEAM_TOTALS
}

function resolveSpreadMarketKey(
  normalizedName: string,
  normalizedKey: string
): string | null {
  const combined = `${normalizedName} ${normalizedKey}`.trim()
  if (!combined.includes('spread') && !combined.includes('handicap')) {
    return null
  }

  const firstHalf =
    combined.includes('1st half') ||
    combined.includes('first half') ||
    /\b1h\b/.test(combined)
  const secondHalf =
    combined.includes('2nd half') ||
    combined.includes('second half') ||
    /\b2h\b/.test(combined)

  if (firstHalf) return MARKETS.SPREADS_1H
  if (secondHalf) return MARKETS.SPREADS_2H
  if (combined.includes('half')) return null
  return MARKETS.SPREADS
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
  if (
    oddsObj &&
    typeof oddsObj === 'object' &&
    (Object.prototype.hasOwnProperty.call(oddsObj, 'moneyline') ||
      Object.prototype.hasOwnProperty.call(oddsObj, 'spread') ||
      Object.prototype.hasOwnProperty.call(oddsObj, 'total'))
  ) {
    return mapSbdMarketsToBookmakers(oddsObj, home, away, allowedMarkets)
  }

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
        const homePrice = normalizePrice(o?.home ?? o?.homeOdds ?? o?.home_price)
        const awayPrice = normalizePrice(o?.away ?? o?.awayOdds ?? o?.away_price)
        if (homePrice != null) out.push({ name: home, price: homePrice })
        if (o?.draw != null || o?.drawOdds != null) {
          const drawPrice = normalizePrice(o?.draw ?? o?.drawOdds ?? o?.draw_price)
          if (drawPrice != null) out.push({ name: 'Draw', price: drawPrice })
        }
        if (awayPrice != null) out.push({ name: away, price: awayPrice })
        if (out.length && shouldInclude('h2h')) {
          mappedMarkets.push({ key: 'h2h', outcomes: out, last_update })
        }
      }

      const spreadMarketKey = resolveSpreadMarketKey(
        normalizedName,
        normalizedKey
      )
      const isSpread = !!spreadMarketKey

      if (isSpread && oddsEntries.length) {
        let filteredCount = 0
        let totalSpreadCount = 0

        for (const row of oddsEntries) {
          const hdp = parseNumber(
            row?.hdp ?? row?.handicap ?? row?.line ?? row?.points ?? row?.point
          )
          if (hdp == null) continue

          totalSpreadCount++
          const homePrice = normalizePrice(row?.home ?? row?.homeOdds ?? row?.home_price)
          const awayPrice = normalizePrice(row?.away ?? row?.awayOdds ?? row?.away_price)

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
          if (out.length && spreadMarketKey && shouldInclude(spreadMarketKey)) {
            mappedMarkets.push({ key: spreadMarketKey, outcomes: out, last_update })
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
        const totalsMarketKey = resolveTotalsMarketKey(normalizedName, normalizedKey)
        const teamTotalsMarketKey = resolveTeamTotalsMarketKey(
          normalizedName,
          normalizedKey
        )
        const activeTotalsKey = totalsMarketKey ?? teamTotalsMarketKey
        if (!activeTotalsKey) {
          continue
        }

        const totalsWithinWindow = (prices: number[]) =>
          prices.every((price) => price >= -150 && price <= 150)
        const totalsPenalty = (prices: number[]) => {
          if (!prices.length) return Number.POSITIVE_INFINITY
          const targetPenalty = prices.reduce((sum, price) => {
            const target = price < 0 ? -110 : 100
            return sum + Math.abs(price - target)
          }, 0) / prices.length
          const windowPenalty = prices.reduce((sum, price) => {
            if (price < -150) return sum + (-150 - price)
            if (price > 150) return sum + (price - 150)
            return sum
          }, 0) / prices.length
          return targetPenalty + windowPenalty
        }

        let bestTotals:
          | {
              outcomes: OddsOutcome[]
              last_update?: string
              prices: number[]
              point?: number
            }
          | null = null

        for (const row of oddsEntries) {
          const totalLine = parseNumber(
            row?.max ?? row?.line ?? row?.points ?? row?.point ?? row?.total ?? row?.hdp
          )
          if (totalLine == null || totalLine < 5 || totalLine > 400) continue
          const overPrice = normalizePrice(row?.over ?? row?.overOdds ?? row?.over_price)
          const underPrice = normalizePrice(row?.under ?? row?.underOdds ?? row?.under_price)
          const teamLabel =
            teamTotalsMarketKey &&
            (row?.label || row?.team || row?.name || row?.side || row?.participant)
          const outcomes: OddsOutcome[] = []
          const teamPrefix =
            teamLabel && typeof teamLabel === 'string' ? `${teamLabel} ` : ''
          if (overPrice != null)
            outcomes.push({
              name: `${teamPrefix}Over`.trim(),
              price: overPrice,
              point: totalLine,
            })
          if (underPrice != null)
            outcomes.push({
              name: `${teamPrefix}Under`.trim(),
              price: underPrice,
              point: totalLine,
            })
          if (outcomes.length && shouldInclude(activeTotalsKey)) {
            const prices = outcomes.map((o) => o.price).filter((p) => isFinite(p))
            if (!prices.length) continue
            const candidate = { outcomes, last_update, prices, point: totalLine }
            if (!bestTotals) {
              bestTotals = candidate
            } else {
              const candWithin = totalsWithinWindow(candidate.prices)
              const bestWithin = totalsWithinWindow(bestTotals.prices)
              const candPenalty = totalsPenalty(candidate.prices)
              const bestPenalty = totalsPenalty(bestTotals.prices)
              if (
                (candWithin && !bestWithin) ||
                (candWithin === bestWithin && candPenalty <= bestPenalty)
              ) {
                bestTotals = candidate
              }
            }
          }
        }

        if (bestTotals) {
          mappedMarkets.push({
            key: activeTotalsKey,
            outcomes: bestTotals.outcomes,
            last_update: bestTotals.last_update,
          })
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

const buildLeagueDto = (league: SbdLeague) => ({
  name: league.toUpperCase(),
  slug: league,
})

const buildSportDto = (league: SbdLeague) => {
  const sportKey = resolveSportKeyFromLeague(league) || league
  return {
    name: sportKey.toUpperCase(),
    slug: sportKey,
  }
}

const buildSimpleEventFromSbd = (league: SbdLeague, game: any): SimpleEventDto => ({
  id: String(game?.id ?? ''),
  date: String(game?.scheduled ?? ''),
  home: buildTeamLabel(game?.competitors?.home),
  away: buildTeamLabel(game?.competitors?.away),
  status: normalizeSbdStatus(game?.status),
  league: buildLeagueDto(league),
  sport: buildSportDto(league),
})

const buildEventResponseFromSbd = (league: SbdLeague, game: any): EventResponse => ({
  ...buildSimpleEventFromSbd(league, game),
  bookmakers: game?.markets || {},
})

const parseSinceTimestamp = (since: number) => {
  if (!Number.isFinite(since)) return null
  if (since > 10_000_000_000) return since // already ms
  return since * 1000
}

const filterSbdMarkets = (markets: any, allowedMarkets?: string[] | null) => {
  if (!markets || !allowedMarkets || allowedMarkets.length === 0) return markets
  const allowed = new Set(allowedMarkets.map((m) => m.toLowerCase()))
  const filtered: Record<string, any> = {}
  if (allowed.has(MARKETS.H2H) || allowed.has('moneyline')) {
    if (markets.moneyline) filtered.moneyline = markets.moneyline
  }
  const wantsSpreads =
    allowed.has(MARKETS.SPREADS) ||
    allowed.has('spread') ||
    allowed.has(MARKETS.SPREADS_1H) ||
    allowed.has(MARKETS.SPREADS_2H)
  if (wantsSpreads) {
    if (markets.spread) filtered.spread = markets.spread
  }
  const wantsTotals = allowed.has(MARKETS.TOTALS) || allowed.has('total')
  const wantsPartialTotals = Array.from(allowed).some((key) => key.startsWith('totals_'))
  const wantsTeamTotals = Array.from(allowed).some((key) =>
    key.startsWith('team_totals')
  )
  if (wantsTotals) {
    if (markets.total) filtered.total = markets.total
  }
  if (wantsPartialTotals || wantsTeamTotals || wantsSpreads) {
    for (const key of Object.keys(markets)) {
      const normalized = key.toLowerCase()
      if (normalized === 'total' || normalized === 'totals') continue
      if (normalized === 'spread' || normalized === 'spreads') continue
      const hasTotal = normalized.includes('total')
      const hasSpread = normalized.includes('spread')
      if (!hasTotal && !hasSpread) continue
      filtered[key] = markets[key]
    }
  }
  return filtered
}

export async function listSports(options?: { revalidateSeconds?: number }): Promise<SportResponse[]> {
  return [
    { name: 'NBA', slug: 'nba' },
    { name: 'NFL', slug: 'nfl' },
    { name: 'MLB', slug: 'mlb' },
    { name: 'NHL', slug: 'nhl' },
    { name: 'NCAAB', slug: 'ncaamb' },
    { name: 'NCAAF', slug: 'ncaafb' },
  ]
}

export async function listLeagues(
  sport: string,
  options?: { revalidateSeconds?: number }
): Promise<LeagueResponse[]> {
  if (!sport) throw new OddsAPIError('Sport parameter is required for leagues lookup')

  const normalized = sport.toLowerCase()
  const leagues: LeagueResponse[] = []

  const pushLeague = (name: string, slug: string) => {
    leagues.push({ name, slug, eventsCount: 0 })
  }

  if (normalized.includes('basketball')) {
    pushLeague('NBA', 'nba')
    pushLeague('NCAAB', 'ncaamb')
  } else if (normalized.includes('football') && !normalized.includes('soccer')) {
    pushLeague('NFL', 'nfl')
    pushLeague('NCAAF', 'ncaafb')
  } else if (normalized.includes('baseball')) {
    pushLeague('MLB', 'mlb')
  } else if (normalized.includes('hockey')) {
    pushLeague('NHL', 'nhl')
  } else if (resolveSbdLeague(normalized)) {
    const league = resolveSbdLeague(normalized)!
    pushLeague(league.toUpperCase(), league)
  }

  if (leagues.length === 0) {
    throw new OddsAPIError(`No leagues found for sport "${sport}"`)
  }

  return leagues
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
  const league = resolveSbdLeagueFromFilters(filters.sport, filters.league)
  if (!league) {
    throw new OddsAPIError(`Unsupported sport/league: ${filters.sport}${filters.league ? ` (${filters.league})` : ''}`)
  }

  const init = buildFetchInit({
    live: options?.live,
    revalidateSeconds: options?.revalidateSeconds ?? (options?.live ? 15 : 60),
  })
  const payload = await fetchSbdOdds(league, { books: getDefaultBookIds(), init })
  const games = Array.isArray(payload?.data) ? payload.data : []
  let events: SimpleEventDto[] = games.map((game: any) => buildSimpleEventFromSbd(league, game))

  const statusParam = normalizeEventStatuses(filters.status)
  if (statusParam) {
    const allowed = new Set(statusParam.split(',').filter(Boolean))
    events = events.filter((event) => allowed.has(event.status))
  } else if (options?.live) {
    events = events.filter((event) => event.status === 'live')
  }

  const fromTime = filters.from ? Date.parse(filters.from) : null
  const toTime = filters.to ? Date.parse(filters.to) : null
  if (fromTime || toTime) {
    events = events.filter((event) => {
      const ts = Date.parse(event.date)
      if (!Number.isFinite(ts)) return false
      if (fromTime && ts < fromTime) return false
      if (toTime && ts > toTime) return false
      return true
    })
  }

  if (filters.limit && Number.isFinite(filters.limit)) {
    events = events.slice(0, Math.max(0, filters.limit))
  }

  return events
}

export async function fetchLiveEventsList(
  sport?: string,
  options?: { revalidateSeconds?: number }
): Promise<SimpleEventDto[]> {
  const init =
    options?.revalidateSeconds != null
      ? buildFetchInit({ revalidateSeconds: options.revalidateSeconds })
      : buildFetchInit({ live: true })

  const leagues = sport ? [resolveSbdLeagueFromFilters(sport, undefined)].filter(Boolean) : SBD_LEAGUES
  const events: SimpleEventDto[] = []

  for (const league of leagues as SbdLeague[]) {
    const payload = await fetchSbdOdds(league, { books: getDefaultBookIds(), init })
    const games = Array.isArray(payload?.data) ? payload.data : []
    games
      .filter((game: any) => normalizeSbdStatus(game?.status) === 'live')
      .forEach((game: any) => {
        events.push(buildSimpleEventFromSbd(league, game))
      })
  }

  return events
}

export async function fetchEventById(id: string, options?: { revalidateSeconds?: number }) {
  if (!id) throw new OddsAPIError('Event ID is required')
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 120 })
  const target = String(id)

  for (const league of SBD_LEAGUES) {
    const payload = await fetchSbdOdds(league, { books: getDefaultBookIds(), init })
    const game = Array.isArray(payload?.data)
      ? payload.data.find((entry: any) => String(entry?.id) === target)
      : null
    if (game) return buildSimpleEventFromSbd(league, game)
  }

  throw new OddsAPIError(`Event ${id} not found`, 404)
}

export async function searchEvents(
  query: string,
  options?: { revalidateSeconds?: number }
): Promise<SimpleEventDto[]> {
  if (!query || query.length < 3) throw new OddsAPIError('Search query must be at least 3 characters')
  const init = buildFetchInit({ revalidateSeconds: options?.revalidateSeconds ?? 60 })
  const token = query.toLowerCase()
  const matches: SimpleEventDto[] = []

  for (const league of SBD_LEAGUES) {
    const payload = await fetchSbdOdds(league, { books: getDefaultBookIds(), init })
    const games = Array.isArray(payload?.data) ? payload.data : []
    for (const game of games) {
      const home = buildTeamLabel(game?.competitors?.home).toLowerCase()
      const away = buildTeamLabel(game?.competitors?.away).toLowerCase()
      if (home.includes(token) || away.includes(token)) {
        matches.push(buildSimpleEventFromSbd(league, game))
      }
    }
  }

  return matches
}

export async function fetchEventOdds(
  eventId: string,
  bookmakers?: string | string[] | null,
  init?: NextFetchRequestInit,
  markets?: string[] | null
): Promise<EventResponse> {
  if (!eventId) throw new OddsAPIError('eventId is required')
  const books = pickSbdBookIds(bookmakers)
  const allowedMarkets =
    markets === null ? null : (markets && markets.length ? markets : [...STANDARD_MARKETS])
  const target = String(eventId)

  for (const league of SBD_LEAGUES) {
    const payload = await fetchSbdOdds(league, { books, init })
    const games = Array.isArray(payload?.data) ? payload.data : []
    const game = games.find((entry: any) => String(entry?.id) === target)
    if (game) {
      const filtered = allowedMarkets ? filterSbdMarkets(game.markets, allowedMarkets) : game.markets
      return {
        ...buildEventResponseFromSbd(league, game),
        bookmakers: filtered || {},
      }
    }
  }

  throw new OddsAPIError(`Event ${eventId} not found`, 404)
}

export async function fetchMultiEventOdds(
  eventIds: string[],
  bookmakers?: string | string[] | null,
  init?: NextFetchRequestInit,
  markets?: string[] | null
): Promise<EventResponse[]> {
  const ids = eventIds.map((id) => String(id).trim()).filter(Boolean)
  if (!ids.length) return []
  const books = pickSbdBookIds(bookmakers)
  const allowedMarkets =
    markets === null ? null : (markets && markets.length ? markets : [...STANDARD_MARKETS])

  const remaining = new Set(ids)
  const results: EventResponse[] = []

  for (const league of SBD_LEAGUES) {
    if (remaining.size === 0) break
    const payload = await fetchSbdOdds(league, { books, init })
    const games = Array.isArray(payload?.data) ? payload.data : []

    for (const game of games) {
      const id = String(game?.id ?? '')
      if (!remaining.has(id)) continue
      remaining.delete(id)
      const filtered = allowedMarkets ? filterSbdMarkets(game.markets, allowedMarkets) : game.markets
      results.push({
        ...buildEventResponseFromSbd(league, game),
        bookmakers: filtered || {},
      })
    }
  }

  if (remaining.size) {
    console.warn('[ODDS] Some event IDs not found in SBD odds:', Array.from(remaining))
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

  const league = resolveSbdLeagueFromFilters(params.sport)
  if (!league) {
    throw new OddsAPIError(`Unsupported sport for updated odds: ${params.sport}`)
  }

  const books = resolveBookIds(params.bookmaker)
  const sinceMs = parseSinceTimestamp(params.since)
  const payload = await fetchSbdOdds(league, { books, init })
  const games = Array.isArray(payload?.data) ? payload.data : []

  const updatedGames = games.filter((game: any) => {
    if (!sinceMs) return true
    const updated = [
      game?.bettingSplits?.moneyline?.updated,
      game?.bettingSplits?.spread?.updated,
      game?.bettingSplits?.total?.updated,
    ]
      .map((val: string) => Date.parse(val))
      .filter((val: number) => Number.isFinite(val))
    if (!updated.length) return true
    const latest = Math.max(...updated)
    return latest >= sinceMs
  })

  return updatedGames.map((game: any) => buildEventResponseFromSbd(league, game))
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

  const event = await fetchEventOdds(params.eventId, params.bookmaker, init)
  const markets: Record<string, any> = event.bookmakers || {}
  const marketKey = params.market.toLowerCase()

  const resolveMarket = () => {
    if (marketKey.includes('spread')) return markets.spread
    if (marketKey.includes('total')) return markets.total
    if (marketKey.includes('h2h') || marketKey.includes('money')) return markets.moneyline
    return markets[marketKey]
  }

  const targetMarket = resolveMarket() as { books?: any[] } | undefined
  if (!targetMarket || !Array.isArray(targetMarket.books)) {
    throw new OddsAPIError(`Market "${params.market}" not available`)
  }

  const normalizeBook = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
  const targetToken = normalizeBook(params.bookmaker)
  const book =
    targetMarket.books.find((entry: any) => normalizeBook(entry?.name || '') === targetToken) ||
    targetMarket.books.find((entry: any) => normalizeBook(entry?.id || '') === targetToken) ||
    targetMarket.books[0]

  if (!book) {
    throw new OddsAPIError(`Bookmaker "${params.bookmaker}" not found`)
  }

  const now = Date.now()
  const parseOdds = (val: any) => {
    const parsed = parseNumber(val)
    return parsed == null ? 0 : Math.round(parsed)
  }

  const buildMovement = (useOpening: boolean) => {
    if (targetMarket === markets.total) {
      const over = useOpening ? book?.over?.opening_odds : book?.over?.odds
      const under = useOpening ? book?.under?.opening_odds : book?.under?.odds
      const total = useOpening ? book?.opening_total ?? book?.total : book?.total
      return {
        away: parseOdds(under),
        home: parseOdds(over),
        max: parseNumber(total),
        timestamp: now,
      }
    }

    const homeOdds = useOpening ? book?.home?.opening_odds : book?.home?.odds
    const awayOdds = useOpening ? book?.away?.opening_odds : book?.away?.odds
    const spread = useOpening ? book?.home?.opening_spread ?? book?.home?.spread : book?.home?.spread

    return {
      away: parseOdds(awayOdds),
      home: parseOdds(homeOdds),
      hdp: spread ? String(spread) : undefined,
      timestamp: now,
    }
  }

  const opening = buildMovement(true)
  const latest = buildMovement(false)

  return {
    bookmaker: String(book?.name || params.bookmaker),
    eventid: String(params.eventId),
    market: params.market,
    marketLine: params.marketLine,
    latest,
    opening,
    movements: [],
  }
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
  console.warn('[ODDS] Remote arbitrage not supported for SportsBettingDime provider')
  return []
}

export async function selectBookmakersRemote(bookmakers: string | string[]) {
  const resolved = resolveBookIds(bookmakers)
  if (!resolved.length) {
    throw new OddsAPIError('At least one bookmaker is required')
  }
  selectedSbdBookIds = resolved
}


async function fetchOddsIO(
  sportKey: string,
  _markets: string[] = [...STANDARD_MARKETS],
  opts: { live?: boolean; revalidateSeconds?: number; teamFilter?: string[]; bookmakers?: string | string[] | null } = {}
): Promise<OddsGame[]> {
  const baseMapping = SPORT_MAP[sportKey]
  if (!baseMapping) return []
  const mapping = baseMapping
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
    to.setDate(to.getDate() + 10)
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

  if (sportKey === 'basketball_ncaab' && Array.isArray(events)) {
    const isNcaabLeague = (value?: string | null) => {
      const normalized = (value || '').toLowerCase()
      return (
        normalized.includes('ncaab') ||
        normalized.includes('ncaam') ||
        normalized.includes('ncaa-basketball') ||
        normalized.includes('ncaa men')
      )
    }
    events = events.filter((event) => {
      const leagueValue =
        typeof event.league === 'string'
          ? event.league
          : event.league?.slug || event.league?.name || ''
      return isNcaabLeague(leagueValue)
    })
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

  const hasExplicitBookmakers = Array.isArray(opts.bookmakers)
    ? opts.bookmakers.some((entry) => String(entry).trim().length > 0)
    : opts.bookmakers != null
      ? String(opts.bookmakers)
          .split(',')
          .some((entry) => entry.trim().length > 0)
      : false
  const envBookmakers = hasExplicitBookmakers
    ? normalizeBookmakerList(opts.bookmakers)
    : pickBookmakersParam()

  // Apply bookmaker selection; if the provided list fails, fall back to a safe default set
  let appliedBookmakers: string | null | undefined = envBookmakers
  let bookmakerSelectionApplied = await ensureBookmakersSelection(appliedBookmakers ?? null)
  if (!bookmakerSelectionApplied && !hasExplicitBookmakers) {
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
      const data = await fetchMultiEventOdds(
        chunk,
        activeFilter ?? getDefaultBookmakers(),
        oddsFetchInit,
        _markets
      )
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
      !hasExplicitBookmakers &&
      (error instanceof OddsAPIError || message.includes('bookmaker')) &&
      message.toLowerCase().includes('not a valid bookmaker')
    ) {
      console.warn(
        `[ODDS] Invalid bookmaker in filter "${defaultBookmakersFilter}", retrying without filter`
      )
      const fallbackBookmakers = getDefaultBookmakers()
      await ensureBookmakersSelection(fallbackBookmakers)
      games = await loadGames(fallbackBookmakers)
    } else {
      throw error
    }
  }

  if (!games.length && defaultBookmakersFilter && !hasExplicitBookmakers) {
    console.warn(
      '[ODDS] No bookmakers returned for ' + sportKey + ' with filter "' + defaultBookmakersFilter + '", retrying without filter'
    )
    const fallbackBookmakers = getDefaultBookmakers()
    await ensureBookmakersSelection(fallbackBookmakers)
    games = await loadGames(fallbackBookmakers)
  }

  // Best-effort retry for totals when a provider omits them in the initial response
  const wantsTotals = _markets.includes(MARKETS.TOTALS)
  if (wantsTotals && games.length > 0) {
    const missingTotalsGameIds = games
      .filter(
        (game) =>
          !game.bookmakers.some((bk) => bk.markets.some((m) => m.key === MARKETS.TOTALS))
      )
      .map((game) => game.id)

    if (missingTotalsGameIds.length > 0) {
      console.warn(
        `[ODDS] Totals missing for ${missingTotalsGameIds.length} game(s); fetching totals-only fallback`
      )
      const totalChunks: string[][] = []
      for (let i = 0; i < missingTotalsGameIds.length; i += 10) {
        totalChunks.push(missingTotalsGameIds.slice(i, i + 10))
      }

      for (const chunk of totalChunks) {
        try {
          const totalsEvents = await fetchMultiEventOdds(
            chunk,
            defaultBookmakersFilter ?? getDefaultBookmakers(),
            oddsFetchInit,
            [MARKETS.TOTALS]
          )

          for (const ev of totalsEvents) {
            const meta = eventLookup.get(String(ev.id))
            const home = ev.home || meta?.home || ''
            const away = ev.away || meta?.away || ''
            const totalsBooks = mapBookmakersIO(ev.bookmakers || {}, home, away, [
              MARKETS.TOTALS,
            ])
            const target = games.find((g) => g.id === String(ev.id))
            if (target && totalsBooks.length > 0) {
              target.bookmakers = mergeTotalsMarkets(target.bookmakers, totalsBooks)
            }
          }
        } catch (error) {
          console.error('[ODDS] Failed totals-only fallback fetch:', error)
        }
      }
    }
  }

  return games
}

function mergeTotalsMarkets(existing: Bookmaker[], totalsOnly: Bookmaker[]): Bookmaker[] {
  const existingMap = new Map(existing.map((bk) => [bk.key, bk]))

  for (const totalsBk of totalsOnly) {
    const totalsMarket = totalsBk.markets.find((m) => m.key === MARKETS.TOTALS)
    if (!totalsMarket) continue
    const target = existingMap.get(totalsBk.key)
    if (target) {
      const withoutTotals = target.markets.filter((m) => m.key !== MARKETS.TOTALS)
      target.markets = [...withoutTotals, totalsMarket]
    } else {
      // If we didn't have this book before, add it with totals only
      existing.push({ ...totalsBk, markets: [totalsMarket] })
      existingMap.set(totalsBk.key, existing[existing.length - 1])
    }
  }

  return existing
}

const isTeamMatch = (a: string, b: string) => {
  const left = normalizeTeamKey(a)
  const right = normalizeTeamKey(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const isSameMatchup = (game: OddsGame, candidate: OddsGame) => {
  const direct =
    isTeamMatch(game.home_team, candidate.home_team) &&
    isTeamMatch(game.away_team, candidate.away_team)
  const swapped =
    isTeamMatch(game.home_team, candidate.away_team) &&
    isTeamMatch(game.away_team, candidate.home_team)
  return direct || swapped
}

const resolveMarketLine = (market: OddsMarket) => {
  const rawPoint = market.outcomes.find((outcome) =>
    Number.isFinite(outcome.point)
  )?.point
  if (!Number.isFinite(rawPoint)) return null
  const line = Number(rawPoint)
  if (market.key.startsWith('spreads')) return Math.abs(line)
  return line
}

const buildMarketSignature = (market: OddsMarket) => {
  const line = resolveMarketLine(market)
  const lineLabel = Number.isFinite(line) ? `:${line}` : ''
  return `${market.key}${lineLabel}`
}

const mergeBookmakerMarkets = (existing: Bookmaker, incoming: Bookmaker) => {
  const mergedMarkets = [...existing.markets]
  incoming.markets.forEach((market) => {
    const signature = buildMarketSignature(market)
    const index = mergedMarkets.findIndex(
      (current) => buildMarketSignature(current) === signature
    )
    if (index === -1) {
      mergedMarkets.push(market)
      return
    }
    if (market.outcomes.length > mergedMarkets[index].outcomes.length) {
      mergedMarkets[index] = market
    }
  })
  return { ...existing, markets: mergedMarkets }
}

const mergeBookmakers = (existing: Bookmaker[], incoming: Bookmaker[]) => {
  const merged = [...existing]
  incoming.forEach((book) => {
    const index = merged.findIndex((current) => current.key === book.key)
    if (index === -1) {
      merged.push(book)
      return
    }
    merged[index] = mergeBookmakerMarkets(merged[index], book)
  })
  return merged
}

const mergePredictionMarketGames = (
  games: OddsGame[],
  additions: OddsGame[],
  bookKey: string
) => {
  if (!additions.length) return games
  const merged = [...games]
  additions.forEach((candidate) => {
    const candidateBooks = candidate.bookmakers.filter(
      (book) => book.key === bookKey
    )
    if (!candidateBooks.length) return
    const match = merged.find((game) => isSameMatchup(game, candidate))
    if (match) {
      match.bookmakers = mergeBookmakers(match.bookmakers, candidateBooks)
    } else {
      merged.push({ ...candidate, bookmakers: candidateBooks })
    }
  })
  return merged
}

const attachPredictionMarketOdds = async (
  games: OddsGame[],
  sport: string,
  markets: string[],
  options: FetchOddsOptions
) => {
  const sources = [
    { key: 'polymarket', fetcher: fetchPolymarketOdds },
    { key: 'kalshi', fetcher: fetchKalshiOdds },
  ]
  const results = await Promise.allSettled(
    sources.map((source) =>
      source.fetcher(sport, markets, {
        live: options.live,
        revalidateSeconds: options.revalidateSeconds,
        teamFilter: options.teamFilter,
      })
    )
  )

  let merged = games
  results.forEach((result, index) => {
    const source = sources[index]
    if (!source) return
    if (result.status === 'fulfilled') {
      merged = mergePredictionMarketGames(merged, result.value, source.key)
    } else {
      console.warn(`[ODDS] ${source.key} fetch failed:`, result.reason)
    }
  })

  return merged
}

/**
 * Fetch odds for a specific sport
 */
export interface FetchOddsOptions {
  live?: boolean
  revalidateSeconds?: number
  teamFilter?: string[] // Filter events to only these team names (case-insensitive partial match)
  bookmakers?: string | string[] | null // Optional override of bookmaker filter
  forceProvider?: 'the-odds-api' | 'odds-api-io' | 'sportsbettingdime'
}

const resolveOddsProvider = () => {
  const raw = (process.env.ODDS_PROVIDER || '').trim().toLowerCase()

  // If explicit provider set, use it
  if (raw) {
    if (raw === 'the-odds-api' || raw === 'theoddsapi') {
      return 'the-odds-api'
    }
    if (raw === 'sbd' || raw === 'sportsbettingdime' || raw === 'sports-betting-dime') {
      return 'sportsbettingdime'
    }
    if (raw.includes('odds-api')) return 'odds-api-io'
    return raw
  }

  // Default: prefer The Odds API v4 if key is available
  if (process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY) {
    return 'the-odds-api'
  }

  return 'sportsbettingdime'
}

async function fetchOddsSbd(
  sport: string,
  markets: string[] = [...STANDARD_MARKETS],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  const league = resolveSbdLeagueFromFilters(sport)
  if (!league) {
    throw new OddsAPIError(`Unsupported sport: ${sport}`)
  }

  const fetchInit: NextFetchRequestInit = options.live
    ? { cache: 'no-store' }
    : { next: { revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS } }

  let books = pickSbdBookIds(options.bookmakers)
  if (league === 'ncaamb' && options.bookmakers === undefined) {
    books = DEFAULT_BOOK_IDS.slice()
  }
  const fetchLeagueGames = async (targetLeague: string, bookIds = books) => {
    const payload = await fetchSbdOdds(targetLeague as SbdLeague, {
      books: bookIds,
      init: fetchInit,
    })
    let games = mapSbdOddsToOddsGames(targetLeague as SbdLeague, payload, markets)
    games = games.filter((game) => game.bookmakers && game.bookmakers.length > 0)
    return games
  }

  let games = await fetchLeagueGames(league)
  if (league === 'ncaamb' && books.length > 1) {
    const merged: OddsGame[] = []
    for (const book of books) {
      try {
        const bookGames = await fetchLeagueGames(league, [book])
        if (!bookGames.length) continue
        bookGames.forEach((candidate) => {
          const match = merged.find((game) => isSameMatchup(game, candidate))
          if (match) {
            match.bookmakers = mergeBookmakers(
              match.bookmakers || [],
              candidate.bookmakers || []
            )
          } else {
            merged.push(candidate)
          }
        })
      } catch (error) {
        console.warn('[ODDS] NCAAB book fetch failed:', book, error)
      }
    }
    if (merged.length) {
      games = merged
    }
  } else if (games.length === 0 && league === 'ncaamb' && books.length > 1) {
    books = ['sr:book:18149']
    games = await fetchLeagueGames(league)
  }
  if (
    games.length === 0 &&
    String(sport).toLowerCase().includes('ncaab')
  ) {
    const fallbackLeagues = ['ncaab', 'ncaam', 'ncaamb']
    for (const fallback of fallbackLeagues) {
      if (fallback === league) continue
      try {
        const fallbackGames = await fetchLeagueGames(fallback)
        if (fallbackGames.length > 0) {
          games = fallbackGames
          break
        }
      } catch (error) {
        console.warn('[ODDS] NCAAB fallback league failed:', fallback, error)
      }
    }
  }

  if (options.teamFilter && options.teamFilter.length > 0) {
    const filters = options.teamFilter.map((t) => t.toLowerCase())
    games = games.filter((game) => {
      const home = game.home_team.toLowerCase()
      const away = game.away_team.toLowerCase()
      return filters.some((team) => home.includes(team) || away.includes(team))
    })
  }

  return games
}

/**
 * Fetch odds from The Odds API v4 (the-odds-api.com)
 * This is the preferred provider with 50+ bookmakers
 */
async function fetchOddsTheOddsApi(
  sport: string,
  markets: string[] = [...STANDARD_MARKETS],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  // Convert sport key to The Odds API format
  const sportKey = getTheOddsApiSportKey(sport)
  if (!sportKey) {
    console.warn(`[ODDS] The Odds API: Unknown sport "${sport}", falling back`)
    return []
  }

  try {
    // Map market keys to The Odds API format
    const marketKeys: string[] = []
    if (markets.includes(MARKETS.H2H) || markets.includes('h2h') || markets.includes('moneyline')) {
      marketKeys.push('h2h')
    }
    if (markets.includes(MARKETS.SPREADS) || markets.includes('spreads')) {
      marketKeys.push('spreads')
    }
    if (markets.includes(MARKETS.TOTALS) || markets.includes('totals')) {
      marketKeys.push('totals')
    }
    // Default to all markets if none specified
    if (marketKeys.length === 0) {
      marketKeys.push('h2h', 'spreads', 'totals')
    }

    console.log(`[ODDS] Fetching from The Odds API v4: ${sportKey} with markets: ${marketKeys.join(',')}`)

    const requestedBookmakers = Array.isArray(options.bookmakers)
      ? options.bookmakers
      : typeof options.bookmakers === 'string'
        ? options.bookmakers.split(',').map((entry) => entry.trim()).filter(Boolean)
        : undefined

    const games = await fetchTheOddsApiOdds(sportKey, {
      markets: marketKeys.join(','),
      regions: 'us,us2,eu',
      bookmakers: requestedBookmakers,
    })

    // Apply team filter if specified
    if (options.teamFilter && options.teamFilter.length > 0) {
      const filters = options.teamFilter.map((t) => t.toLowerCase())
      return games.filter((game) => {
        const home = game.home_team.toLowerCase()
        const away = game.away_team.toLowerCase()
        return filters.some((team) => home.includes(team) || away.includes(team))
      })
    }

    console.log(`[ODDS] The Odds API v4 returned ${games.length} games with ${games.reduce((acc, g) => acc + g.bookmakers.length, 0)} total bookmaker entries`)
    return games
  } catch (error) {
    console.error('[ODDS] The Odds API v4 fetch failed:', error)
    return []
  }
}

export async function fetchOdds(
  sport: string,
  markets: string[] = [...STANDARD_MARKETS],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  if (options.live) {
    console.warn('[ODDS] Live odds disabled; returning empty set.')
    return []
  }
  const shouldCache = true
  const cacheKey = shouldCache
    ? JSON.stringify({
        sport,
        markets,
        live: false,
        revalidateSeconds: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS,
        teamFilter: options.teamFilter ?? null,
        bookmakers: options.bookmakers ?? null,
        forceProvider: options.forceProvider ?? null,
      })
    : null

  if (shouldCache && cacheKey) {
    const cached = oddsCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value
    }
  }

  const shouldUseDbCache = process.env.NEXT_RUNTIME !== 'edge'
  if (shouldCache && cacheKey && shouldUseDbCache) {
    try {
      const { getOddsCache } = await import('@/lib/services/odds-cache')
      const cached = await getOddsCache(
        cacheKey,
        (options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS) * 1000
      )
      if (cached) {
        oddsCache.set(cacheKey, {
          value: cached,
          expiresAt:
            Date.now() +
            (options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS) * 1000,
        })
        return cached
      }
    } catch (error) {
      console.warn('[ODDS] Failed to read odds cache:', error)
    }
  }

  const cacheResult = async (value: OddsGame[]) => {
    if (shouldCache && cacheKey) {
      oddsCache.set(cacheKey, {
        value,
        expiresAt:
          Date.now() +
          (options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS) * 1000,
      })
      if (shouldUseDbCache) {
        try {
          const { setOddsCache } = await import('@/lib/services/odds-cache')
          await setOddsCache(cacheKey, sport, markets, value)
        } catch (error) {
          console.warn('[ODDS] Failed to persist odds cache:', error)
        }
      }
    }
    return value
  }

  const resolvedProvider = resolveOddsProvider()
  let provider = options.forceProvider ?? resolvedProvider
  const hasTheOddsApiKey = Boolean(process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY)
  if (provider === 'the-odds-api' && !hasTheOddsApiKey) {
    console.warn('[ODDS] The Odds API key missing; falling back to default provider.')
    provider = resolvedProvider
  }

  // Primary: The Odds API v4 (50+ bookmakers)
    if (provider === 'the-odds-api') {
      const games = await fetchOddsTheOddsApi(sport, markets, options)
      if (games.length) {
        const result = await attachPredictionMarketOdds(games, sport, markets, options)
        return await cacheResult(result)
      }
      // Fallback to odds-api-io if The Odds API returns no data
      console.warn('[ODDS] The Odds API v4 returned no games, trying odds-api-io fallback')
      try {
        const fallback = await fetchOddsIO(sport, markets, options)
        if (fallback.length) {
          const result = await attachPredictionMarketOdds(fallback, sport, markets, options)
          return await cacheResult(result)
        }
      } catch (error) {
        console.warn('[ODDS] Odds-api-io fallback failed:', error)
      }
      // Final fallback to SBD
      const sbdFallback = await fetchOddsSbd(sport, markets, options)
      const result = await attachPredictionMarketOdds(sbdFallback, sport, markets, options)
      return await cacheResult(result)
    }

  // Legacy: odds-api-io provider
    if (provider === 'odds-api-io') {
      const games = await fetchOddsIO(sport, markets, options)
      const result = await attachPredictionMarketOdds(games, sport, markets, options)
      return await cacheResult(result)
    }

  // Legacy: SportsBettingDime provider
    if (provider === 'sportsbettingdime') {
      const games = await fetchOddsSbd(sport, markets, options)
      if (!games.length && process.env.ODDS_API_KEY) {
        try {
          const fallback = await fetchOddsIO(sport, markets, options)
          if (fallback.length) {
            const result = await attachPredictionMarketOdds(fallback, sport, markets, options)
            return await cacheResult(result)
          }
        } catch (error) {
          console.warn('[ODDS] SBD fallback to odds-api-io failed:', error)
        }
      }
      const result = await attachPredictionMarketOdds(games, sport, markets, options)
      return await cacheResult(result)
    }

  // Default fallback chain: The Odds API v4 -> odds-api-io -> SBD
    if (process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY) {
      try {
        const games = await fetchOddsTheOddsApi(sport, markets, options)
        if (games.length) {
          const result = await attachPredictionMarketOdds(games, sport, markets, options)
          return await cacheResult(result)
        }
      } catch (error) {
        console.warn('[ODDS] The Odds API v4 failed:', error)
      }

      try {
        const games = await fetchOddsIO(sport, markets, options)
        if (games.length) {
          const result = await attachPredictionMarketOdds(games, sport, markets, options)
          return await cacheResult(result)
        }
      } catch (error) {
        console.warn('[ODDS] Odds-api-io provider failed:', error)
      }
    }

    const fallback = await fetchOddsSbd(sport, markets, options)
    const result = await attachPredictionMarketOdds(fallback, sport, markets, options)
    return await cacheResult(result)
  }

/**
 * Fetch player props via odds-api.io player props endpoint
 */
export async function fetchPlayerProps(
  sportKey: string,
  markets?: string[] | null,
  options: { teamFilter?: string[]; playerFilter?: string[] } = {}
): Promise<EventResponse[]> {
  console.warn('[ODDS] fetchPlayerProps is not supported with SportsBettingDime provider')
  return []
}

/**
 * Fetch available sports (provider-aware; Odds-API.io preferred)
 */
export async function fetchSports(): Promise<any[]> {
  return listSports()
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
  const league = resolveSbdLeagueFromFilters(sportKey)
  if (!league) return []
  const requestedStatus = opts.status || 'pending'
  const init: NextFetchRequestInit = { next: { revalidate: requestedStatus === 'live' ? 10 : 60 } }

  const payload = await fetchSbdOdds(league, { books: getDefaultBookIds(), init })
  const games = Array.isArray(payload?.data) ? payload.data : []
  const events: SimpleEventDto[] = games.map((game: any) => buildSimpleEventFromSbd(league, game))

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
    if (requestedStatus && ev.status !== requestedStatus) {
      return false
    }
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
