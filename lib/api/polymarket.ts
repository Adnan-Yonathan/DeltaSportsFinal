import { Bookmaker, OddsGame, OddsMarket, OddsOutcome, MARKETS } from '@/lib/types/odds'
import { decimalToAmerican } from '@/lib/utils/odds'
import { normalizeTeamKey, resolveSportKey } from '@/lib/identity/sport'

const POLYMARKET_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_GAMES_TAG_ID = '100639'
const POLYMARKET_EVENT_LIMIT = 200
const DEFAULT_REVALIDATE_SECONDS = 30

const POLYMARKET_SPORT_MAP: Record<string, string> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'cbb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'cfb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

type PolymarketSport = {
  sport: string
  series?: string | number
  ordering?: string
}

type PolymarketMarket = {
  sportsMarketType?: string
  outcomes?: string
  outcomePrices?: string
  line?: number
  active?: boolean
  closed?: boolean
  updatedAt?: string
}

type PolymarketEvent = {
  id: string
  title?: string
  startTime?: string
  endDate?: string
  eventDate?: string
  updatedAt?: string
  markets?: PolymarketMarket[]
}

type PolymarketFetchOptions = {
  live?: boolean
  revalidateSeconds?: number
  teamFilter?: string[]
}

type NextFetchRequestInit = RequestInit & { next?: { revalidate?: number } }

type ParsedTeams = {
  home: string
  away: string
}

const parseJsonArray = <T,>(value?: string): T[] => {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const parseProbability = (value: unknown) => {
  const prob = Number(value)
  if (!Number.isFinite(prob) || prob <= 0 || prob >= 1) return null
  return prob
}

const probabilityToAmerican = (probability: number) => {
  const decimal = 1 / probability
  return decimalToAmerican(decimal)
}

const isTeamMatch = (a: string, b: string) => {
  const left = normalizeTeamKey(a)
  const right = normalizeTeamKey(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const parseTeamsFromTitle = (title: string, ordering?: string | null): ParsedTeams | null => {
  const match = title.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i)
  if (match.length !== 2) return null
  const first = match[0]?.trim()
  const second = match[1]?.trim()
  if (!first || !second) return null
  if (ordering && ordering.toLowerCase() === 'home') {
    return { home: first, away: second }
  }
  return { away: first, home: second }
}

const pickMarketKey = (marketType?: string | null) => {
  if (!marketType) return null
  const normalized = marketType.toLowerCase()
  if (normalized === 'moneyline') return MARKETS.H2H
  if (normalized === 'spreads') return MARKETS.SPREADS
  if (normalized === 'totals') return MARKETS.TOTALS
  return null
}

const buildPolymarketOutcomes = (
  marketKey: string,
  market: PolymarketMarket
): OddsOutcome[] => {
  const outcomeNames = parseJsonArray<string>(market.outcomes)
  const outcomePrices = parseJsonArray<string | number>(market.outcomePrices)
  if (!outcomeNames.length || !outcomePrices.length) return []
  const lineValue = Number(market.line)
  const hasLine = Number.isFinite(lineValue)

  const outcomes: OddsOutcome[] = []
  outcomeNames.forEach((name, index) => {
    const prob = parseProbability(outcomePrices[index])
    if (prob == null) return
    const odds = probabilityToAmerican(prob)
    const outcome: OddsOutcome = {
      name,
      price: odds,
      probability: prob,
    }
    if (hasLine && marketKey === MARKETS.SPREADS) {
      outcome.point = index === 0 ? lineValue : -lineValue
    } else if (hasLine && marketKey === MARKETS.TOTALS) {
      outcome.point = lineValue
    }
    outcomes.push(outcome)
  })

  return outcomes
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

const resolveMarketProbability = (market: OddsMarket) => {
  const preferred =
    market.key === MARKETS.TOTALS
      ? market.outcomes.find(
          (outcome) => outcome.name.toLowerCase() === 'over'
        )
      : market.outcomes[0]
  const probability = preferred?.probability
  if (!Number.isFinite(probability)) return null
  return probability as number
}

const pickMainMarket = (markets: OddsMarket[]) => {
  if (!markets.length) return [] as OddsMarket[]
  if (markets.length === 1) return markets

  const candidates = markets.map((market) => ({
    market,
    line: resolveMarketLine(market),
    probability: resolveMarketProbability(market),
  }))
  const valid = candidates.filter(
    (item) => Number.isFinite(item.line) && Number.isFinite(item.probability)
  )
  const pool = valid.length ? valid : candidates
  const meanLine =
    pool.reduce((sum, item) => sum + (Number(item.line) || 0), 0) / pool.length

  const sorted = [...pool].sort((a, b) => {
    const scoreA = Number.isFinite(a.probability)
      ? Math.abs((a.probability as number) - 0.5)
      : Number.POSITIVE_INFINITY
    const scoreB = Number.isFinite(b.probability)
      ? Math.abs((b.probability as number) - 0.5)
      : Number.POSITIVE_INFINITY
    if (scoreA !== scoreB) return scoreA - scoreB
    const lineA = Number.isFinite(a.line)
      ? Math.abs((a.line as number) - meanLine)
      : Number.POSITIVE_INFINITY
    const lineB = Number.isFinite(b.line)
      ? Math.abs((b.line as number) - meanLine)
      : Number.POSITIVE_INFINITY
    if (lineA !== lineB) return lineA - lineB
    return 0
  })

  return [sorted[0].market]
}

const buildPolymarketMarkets = (
  markets: PolymarketMarket[] = [],
  allowedMarketKeys: Set<string>
): OddsMarket[] => {
  const h2hMarkets: OddsMarket[] = []
  const spreadMarkets: OddsMarket[] = []
  const totalMarkets: OddsMarket[] = []
  markets.forEach((market) => {
    if (!market?.active || market.closed) return
    const marketKey = pickMarketKey(market.sportsMarketType)
    if (!marketKey || !allowedMarketKeys.has(marketKey)) return
    const outcomes = buildPolymarketOutcomes(marketKey, market)
    if (outcomes.length < 2) return
    const oddsMarket: OddsMarket = {
      key: marketKey,
      outcomes,
      last_update: market.updatedAt,
    }
    if (marketKey === MARKETS.H2H) {
      h2hMarkets.push(oddsMarket)
    } else if (marketKey === MARKETS.SPREADS) {
      spreadMarkets.push(oddsMarket)
    } else if (marketKey === MARKETS.TOTALS) {
      totalMarkets.push(oddsMarket)
    }
  })
  return [
    ...h2hMarkets,
    ...pickMainMarket(spreadMarkets),
    ...pickMainMarket(totalMarkets),
  ]
}

const resolvePolymarketSport = (sport: string): string | null => {
  const canonical = resolveSportKey(sport)
  if (!canonical) return null
  return POLYMARKET_SPORT_MAP[canonical] ?? null
}

const fetchPolymarketSports = async (
  init: NextFetchRequestInit
): Promise<PolymarketSport[]> => {
  const res = await fetch(`${POLYMARKET_BASE}/sports`, init)
  if (!res.ok) {
    throw new Error(`Polymarket sports fetch failed (${res.status})`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

const resolveSeriesForSport = async (
  polymarketSport: string,
  init: NextFetchRequestInit
) => {
  const sports = await fetchPolymarketSports(init)
  const entry = sports.find((item) => item.sport === polymarketSport)
  if (!entry?.series) return null
  return {
    seriesId: String(entry.series),
    ordering: entry.ordering,
  }
}

const buildFetchInit = (options: PolymarketFetchOptions): NextFetchRequestInit => {
  if (options.live) {
    return { cache: 'no-store' }
  }
  return {
    next: {
      revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS,
    },
  }
}

const matchesTeamFilter = (teams: ParsedTeams, filters: string[]) => {
  if (!filters.length) return true
  return filters.some(
    (filter) =>
      isTeamMatch(teams.home, filter) || isTeamMatch(teams.away, filter)
  )
}

const resolveCommenceTime = (event: PolymarketEvent) =>
  event.startTime || event.endDate || event.eventDate || new Date().toISOString()

const resolveSportTitle = (sport: string) => {
  const canonical = resolveSportKey(sport)
  if (!canonical) return sport.toUpperCase()
  const mapping: Record<string, string> = {
    basketball_nba: 'NBA',
    basketball_ncaab: 'NCAAB',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  }
  return mapping[canonical] ?? canonical.toUpperCase()
}

export async function fetchPolymarketOdds(
  sport: string,
  markets: string[] = [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  options: PolymarketFetchOptions = {}
): Promise<OddsGame[]> {
  const polymarketSport = resolvePolymarketSport(sport)
  if (!polymarketSport) return []

  const allowedMarketKeys = new Set(
    markets.filter((market) =>
      [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS].includes(
        market as typeof MARKETS.H2H | typeof MARKETS.SPREADS | typeof MARKETS.TOTALS
      )
    )
  )
  if (!allowedMarketKeys.size) return []

  const init = buildFetchInit(options)
  const seriesInfo = await resolveSeriesForSport(polymarketSport, init)
  if (!seriesInfo) return []

  const url = new URL(`${POLYMARKET_BASE}/events`)
  url.searchParams.set('series_id', seriesInfo.seriesId)
  url.searchParams.set('tag_id', POLYMARKET_GAMES_TAG_ID)
  url.searchParams.set('active', 'true')
  url.searchParams.set('closed', 'false')
  url.searchParams.set('order', 'startTime')
  url.searchParams.set('ascending', 'true')
  url.searchParams.set('limit', String(POLYMARKET_EVENT_LIMIT))

  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    throw new Error(`Polymarket events fetch failed (${res.status})`)
  }
  const data = await res.json()
  const events: PolymarketEvent[] = Array.isArray(data) ? data : []

  const filters = options.teamFilter ?? []
  const sportTitle = resolveSportTitle(sport)

  return events.reduce<OddsGame[]>((acc, event) => {
    if (!event?.title) return acc
    const teams = parseTeamsFromTitle(event.title, seriesInfo.ordering)
    if (!teams || !matchesTeamFilter(teams, filters)) return acc

    const markets = buildPolymarketMarkets(event.markets ?? [], allowedMarketKeys)
    if (!markets.length) return acc

    const bookmaker: Bookmaker = {
      key: 'polymarket',
      title: 'Polymarket',
      url: 'https://polymarket.com',
      markets,
      last_update: event.updatedAt,
    }

    acc.push({
      id: `polymarket:${event.id}`,
      sport_key: sport,
      sport_title: sportTitle,
      commence_time: resolveCommenceTime(event),
      home_team: teams.home,
      away_team: teams.away,
      bookmakers: [bookmaker],
    })

    return acc
  }, [])
}
