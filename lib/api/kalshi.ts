import { Bookmaker, OddsGame, OddsMarket, OddsOutcome, MARKETS } from '@/lib/types/odds'
import { decimalToAmerican } from '@/lib/utils/odds'
import { normalizeTeamKey, resolveSportKey } from '@/lib/identity/sport'

const KALSHI_BASE = 'https://api.elections.kalshi.com/trade-api/v2'
const KALSHI_EVENT_LIMIT = 200
const KALSHI_MAX_PAGES = 3
const DEFAULT_REVALIDATE_SECONDS = 30

type KalshiSeriesConfig = {
  ticker: string
  market: typeof MARKETS.H2H | typeof MARKETS.SPREADS | typeof MARKETS.TOTALS
}

const KALSHI_SERIES_BY_SPORT: Record<string, KalshiSeriesConfig[]> = {
  basketball_nba: [
    { ticker: 'KXNBAGAME', market: MARKETS.H2H },
    { ticker: 'KXNBASPREAD', market: MARKETS.SPREADS },
    { ticker: 'KXNBATOTAL', market: MARKETS.TOTALS },
  ],
  basketball_ncaab: [
    { ticker: 'KXNCAAMBGAME', market: MARKETS.H2H },
    { ticker: 'KXNCAAMBSPREAD', market: MARKETS.SPREADS },
    { ticker: 'KXNCAAMBTOTAL', market: MARKETS.TOTALS },
  ],
  americanfootball_nfl: [
    { ticker: 'KXNFLGAME', market: MARKETS.H2H },
    { ticker: 'KXNFLSPREAD', market: MARKETS.SPREADS },
    { ticker: 'KXNFLTOTAL', market: MARKETS.TOTALS },
  ],
  americanfootball_ncaaf: [
    { ticker: 'KXNCAAFGAME', market: MARKETS.H2H },
    { ticker: 'KXNCAAFSPREAD', market: MARKETS.SPREADS },
    { ticker: 'KXNCAAFTOTAL', market: MARKETS.TOTALS },
  ],
  icehockey_nhl: [
    { ticker: 'KXNHLGAME', market: MARKETS.H2H },
    { ticker: 'KXNHLSPREAD', market: MARKETS.SPREADS },
    { ticker: 'KXNHLTOTAL', market: MARKETS.TOTALS },
  ],
}

type KalshiMarket = {
  ticker?: string
  title?: string
  yes_sub_title?: string
  no_sub_title?: string
  yes_bid?: number
  yes_ask?: number
  yes_bid_dollars?: string
  yes_ask_dollars?: string
  no_bid?: number
  no_ask?: number
  no_bid_dollars?: string
  no_ask_dollars?: string
  last_price?: number
  last_price_dollars?: string
  floor_strike?: number
  cap_strike?: number
  strike_type?: string
  status?: string
  market_type?: string
  expected_expiration_time?: string
  close_time?: string
}

type KalshiEvent = {
  event_ticker: string
  title?: string
  sub_title?: string
  markets?: KalshiMarket[]
  product_metadata?: {
    competition?: string
    competition_scope?: string
  }
}

type KalshiFetchOptions = {
  live?: boolean
  revalidateSeconds?: number
  teamFilter?: string[]
}

type NextFetchRequestInit = RequestInit & { next?: { revalidate?: number } }

type ParsedTeams = {
  home: string
  away: string
}

const buildFetchInit = (options: KalshiFetchOptions): NextFetchRequestInit => {
  if (options.live) {
    return { cache: 'no-store' }
  }
  return {
    next: {
      revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS,
    },
  }
}

const isTeamMatch = (a: string, b: string) => {
  const left = normalizeTeamKey(a)
  const right = normalizeTeamKey(b)
  if (!left || !right) return false
  return left === right || left.includes(right) || right.includes(left)
}

const cleanTeamLabel = (value: string) => value.split(':')[0]?.trim() ?? ''

const parseTeamsFromTitle = (title: string): ParsedTeams | null => {
  const match = title.split(/\s+(?:vs\.?|v\.?|@|at)\s+/i)
  if (match.length !== 2) return null
  const first = cleanTeamLabel(match[0]?.trim() ?? '')
  const second = cleanTeamLabel(match[1]?.trim() ?? '')
  if (!first || !second) return null
  return { away: first, home: second }
}

const resolveSportTitle = (sport: string) => {
  const canonical = resolveSportKey(sport)
  if (!canonical) return sport.toUpperCase()
  const mapping: Record<string, string> = {
    basketball_nba: 'NBA',
    basketball_ncaab: 'NCAAB',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    icehockey_nhl: 'NHL',
  }
  return mapping[canonical] ?? canonical.toUpperCase()
}

const isMarketActive = (status?: string | null) => {
  if (!status) return true
  const normalized = status.toLowerCase()
  return normalized === 'active' || normalized === 'initialized'
}

const parseNumber = (value?: number | string | null) => {
  if (value == null) return null
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : value
  if (!Number.isFinite(parsed)) return null
  return parsed
}

const extractLineFromText = (text?: string) => {
  if (!text) return null
  const match =
    text.match(/(?:over|under|by)\s+([0-9]+(?:\.[0-9]+)?)/i) ||
    text.match(/([0-9]+(?:\.[0-9]+)?)/)
  if (!match) return null
  return parseNumber(match[1])
}

const resolveLineValue = (market: KalshiMarket) => {
  const line = parseNumber(market.floor_strike ?? market.cap_strike)
  if (line != null) return line
  const label =
    market.title || market.yes_sub_title || market.no_sub_title || ''
  return extractLineFromText(label)
}

const resolveSpreadTeam = (market: KalshiMarket, teams: ParsedTeams) => {
  const labels = [
    market.yes_sub_title,
    market.no_sub_title,
    market.title,
  ].filter((value): value is string => Boolean(value))

  for (const label of labels) {
    if (isTeamMatch(label, teams.home) && !isTeamMatch(label, teams.away)) {
      return teams.home
    }
    if (isTeamMatch(label, teams.away) && !isTeamMatch(label, teams.home)) {
      return teams.away
    }
    const match = label.match(/^(.*)\s+wins by\s+(?:over|under|at least|more|less)/i)
    if (match && match[1]) {
      const candidate = match[1].trim()
      if (isTeamMatch(candidate, teams.home)) return teams.home
      if (isTeamMatch(candidate, teams.away)) return teams.away
    }
  }
  return null
}

const resolveSpreadDirection = (market: KalshiMarket) => {
  const strikeType = (market.strike_type || '').toLowerCase()
  if (strikeType === 'greater' || strikeType === 'greater_equal') return 'over'
  if (strikeType === 'less' || strikeType === 'less_equal') return 'under'

  const label = (
    market.title ||
    market.yes_sub_title ||
    market.no_sub_title ||
    ''
  ).toLowerCase()
  if (label.includes('over') || label.includes('at least') || label.includes('more than')) {
    return 'over'
  }
  if (label.includes('under') || label.includes('or fewer') || label.includes('less than')) {
    return 'under'
  }
  return null
}

const resolveTotalsDirection = (market: KalshiMarket) => {
  const strikeType = (market.strike_type || '').toLowerCase()
  if (strikeType === 'greater' || strikeType === 'greater_equal') return 'over'
  if (strikeType === 'less' || strikeType === 'less_equal') return 'under'

  const label = (
    market.title ||
    market.yes_sub_title ||
    market.no_sub_title ||
    ''
  ).toLowerCase()
  if (label.includes('over')) return 'over'
  if (label.includes('under')) return 'under'
  return null
}

const parsePrice = (value?: string | number | null) => {
  if (value == null) return null
  const parsed =
    typeof value === 'string' ? Number.parseFloat(value) : Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1) return parsed / 100
  if (parsed >= 0 && parsed <= 1) return parsed
  return null
}

const resolveMarketProbability = (market: KalshiMarket) => {
  const yesBid = parsePrice(market.yes_bid_dollars ?? market.yes_bid)
  const yesAsk = parsePrice(market.yes_ask_dollars ?? market.yes_ask)
  if (yesBid != null && yesAsk != null) {
    return (yesBid + yesAsk) / 2
  }
  const last = parsePrice(market.last_price_dollars ?? market.last_price)
  if (last != null) return last
  if (yesBid != null) return yesBid
  if (yesAsk != null) return yesAsk

  const noBid = parsePrice(market.no_bid_dollars ?? market.no_bid)
  const noAsk = parsePrice(market.no_ask_dollars ?? market.no_ask)
  if (noBid != null && noAsk != null) {
    return 1 - (noBid + noAsk) / 2
  }
  if (noBid != null) return 1 - noBid
  if (noAsk != null) return 1 - noAsk
  return null
}

const probabilityToAmerican = (probability: number) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
    return null
  }
  const decimal = 1 / probability
  return decimalToAmerican(decimal)
}

const resolveTeamLabel = (market: KalshiMarket) =>
  market.yes_sub_title || market.no_sub_title || ''

const resolveCommenceTime = (event: KalshiEvent) => {
  const times = (event.markets ?? [])
    .map((market) => market.expected_expiration_time || market.close_time)
    .filter((value): value is string => Boolean(value))
  return times[0] ?? new Date().toISOString()
}

const buildMoneylineOutcomes = (
  markets: KalshiMarket[],
  teams: ParsedTeams
): OddsOutcome[] => {
  const outcomeBySide: Record<'home' | 'away', OddsOutcome | null> = {
    home: null,
    away: null,
  }

  markets.forEach((market) => {
    if (market.market_type && market.market_type !== 'binary') return
    if (!isMarketActive(market.status)) return
    const teamLabel = resolveTeamLabel(market)
    if (!teamLabel) return
    const probability = resolveMarketProbability(market)
    if (probability == null) return
    const odds = probabilityToAmerican(probability)
    if (!Number.isFinite(odds)) return

    if (isTeamMatch(teamLabel, teams.home)) {
      outcomeBySide.home = {
        name: teams.home,
        price: odds as number,
        probability,
      }
    } else if (isTeamMatch(teamLabel, teams.away)) {
      outcomeBySide.away = {
        name: teams.away,
        price: odds as number,
        probability,
      }
    }
  })

  const outcomes = [outcomeBySide.away, outcomeBySide.home].filter(
    (outcome): outcome is OddsOutcome => Boolean(outcome)
  )
  return outcomes.length >= 2 ? outcomes : []
}

type MarketCandidate = {
  market: OddsMarket
  line: number
  probability: number
}

const pickMainMarket = (candidates: MarketCandidate[]): OddsMarket[] => {
  if (!candidates.length) return []
  if (candidates.length === 1) return [candidates[0].market]

  const meanLine =
    candidates.reduce((sum, item) => sum + item.line, 0) / candidates.length

  const sorted = [...candidates].sort((a, b) => {
    const scoreA = Math.abs(a.probability - 0.5)
    const scoreB = Math.abs(b.probability - 0.5)
    if (scoreA !== scoreB) return scoreA - scoreB
    const lineA = Math.abs(a.line - meanLine)
    const lineB = Math.abs(b.line - meanLine)
    if (lineA !== lineB) return lineA - lineB
    return a.line - b.line
  })

  return [sorted[0].market]
}

const buildSpreadMarkets = (
  markets: KalshiMarket[],
  teams: ParsedTeams
): OddsMarket[] => {
  const candidates: MarketCandidate[] = []
  markets.forEach((market) => {
    if (market.market_type && market.market_type !== 'binary') return
    if (!isMarketActive(market.status)) return
    const line = resolveLineValue(market)
    if (line == null) return
    const lineValue = Math.abs(line)
    const team = resolveSpreadTeam(market, teams)
    if (!team) return
    const direction = resolveSpreadDirection(market)
    if (!direction) return
    const probability = resolveMarketProbability(market)
    if (probability == null) return

    const opponent = team === teams.home ? teams.away : teams.home
    const yesProb = probability
    const noProb = 1 - yesProb
    if (!Number.isFinite(noProb) || noProb <= 0 || noProb >= 1) return

    const teamProb = direction === 'over' ? yesProb : noProb
    const opponentProb = direction === 'over' ? noProb : yesProb
    const teamOdds = probabilityToAmerican(teamProb)
    const opponentOdds = probabilityToAmerican(opponentProb)
    if (!Number.isFinite(teamOdds) || !Number.isFinite(opponentOdds)) return

    const outcomeByTeam = new Map<string, OddsOutcome>()
    outcomeByTeam.set(team, {
      name: team,
      price: teamOdds as number,
      point: -lineValue,
      probability: teamProb,
    })
    outcomeByTeam.set(opponent, {
      name: opponent,
      price: opponentOdds as number,
      point: lineValue,
      probability: opponentProb,
    })

    const outcomes: OddsOutcome[] = []
    const awayOutcome = outcomeByTeam.get(teams.away)
    const homeOutcome = outcomeByTeam.get(teams.home)
    if (awayOutcome) outcomes.push(awayOutcome)
    if (homeOutcome) outcomes.push(homeOutcome)
    if (outcomes.length < 2) return

    const oddsMarket: OddsMarket = {
      key: MARKETS.SPREADS,
      outcomes,
    }
    candidates.push({ market: oddsMarket, line: lineValue, probability: teamProb })
  })
  return pickMainMarket(candidates)
}

const buildTotalsMarkets = (markets: KalshiMarket[]): OddsMarket[] => {
  const candidates: MarketCandidate[] = []
  markets.forEach((market) => {
    if (market.market_type && market.market_type !== 'binary') return
    if (!isMarketActive(market.status)) return
    const line = resolveLineValue(market)
    if (line == null) return
    const lineValue = Math.abs(line)
    const direction = resolveTotalsDirection(market)
    if (!direction) return
    const probability = resolveMarketProbability(market)
    if (probability == null) return

    const yesProb = probability
    const noProb = 1 - yesProb
    if (!Number.isFinite(noProb) || noProb <= 0 || noProb >= 1) return

    const overProb = direction === 'over' ? yesProb : noProb
    const underProb = direction === 'over' ? noProb : yesProb
    const overOdds = probabilityToAmerican(overProb)
    const underOdds = probabilityToAmerican(underProb)
    if (!Number.isFinite(overOdds) || !Number.isFinite(underOdds)) return

    const oddsMarket: OddsMarket = {
      key: MARKETS.TOTALS,
      outcomes: [
        {
          name: 'Over',
          price: overOdds as number,
          point: lineValue,
          probability: overProb,
        },
        {
          name: 'Under',
          price: underOdds as number,
          point: lineValue,
          probability: underProb,
        },
      ],
    }
    candidates.push({ market: oddsMarket, line: lineValue, probability: overProb })
  })
  return pickMainMarket(candidates)
}

const buildKalshiMarkets = (
  markets: KalshiMarket[] = [],
  teams: ParsedTeams,
  marketKey: KalshiSeriesConfig['market']
): OddsMarket[] => {
  if (marketKey === MARKETS.H2H) {
    const outcomes = buildMoneylineOutcomes(markets, teams)
    if (outcomes.length < 2) return []
    return [
      {
        key: MARKETS.H2H,
        outcomes,
      },
    ]
  }
  if (marketKey === MARKETS.SPREADS) {
    return buildSpreadMarkets(markets, teams)
  }
  if (marketKey === MARKETS.TOTALS) {
    return buildTotalsMarkets(markets)
  }
  return []
}

const matchesTeamFilter = (teams: ParsedTeams, filters: string[]) => {
  if (!filters.length) return true
  return filters.some(
    (filter) =>
      isTeamMatch(teams.home, filter) || isTeamMatch(teams.away, filter)
  )
}

const buildMatchKey = (teams: ParsedTeams) => {
  const away = normalizeTeamKey(teams.away) || teams.away.toLowerCase()
  const home = normalizeTeamKey(teams.home) || teams.home.toLowerCase()
  return `${away}@${home}`
}

const fetchKalshiEvents = async (
  seriesTicker: string,
  init: NextFetchRequestInit
): Promise<KalshiEvent[]> => {
  const events: KalshiEvent[] = []
  let cursor = ''

  for (let page = 0; page < KALSHI_MAX_PAGES; page += 1) {
    const url = new URL(`${KALSHI_BASE}/events`)
    url.searchParams.set('series_ticker', seriesTicker)
    url.searchParams.set('limit', String(KALSHI_EVENT_LIMIT))
    url.searchParams.set('with_nested_markets', 'true')
    url.searchParams.set('status', 'open')
    if (cursor) {
      url.searchParams.set('cursor', cursor)
    }

    const res = await fetch(url.toString(), init)
    if (!res.ok) {
      throw new Error(`Kalshi events fetch failed (${res.status})`)
    }
    const data = await res.json()
    const pageEvents = Array.isArray(data?.events) ? data.events : []
    events.push(...pageEvents)
    cursor = typeof data?.cursor === 'string' ? data.cursor : ''
    if (!cursor) break
  }

  return events
}

const resolveMarketLine = (market: OddsMarket) => {
  const rawPoint = market.outcomes.find((outcome) =>
    Number.isFinite(outcome.point)
  )?.point
  if (!Number.isFinite(rawPoint)) return null
  const line = Number(rawPoint)
  if (market.key === MARKETS.SPREADS) return Math.abs(line)
  return line
}

const buildMarketSignature = (market: OddsMarket) => {
  const line = resolveMarketLine(market)
  const lineLabel = Number.isFinite(line) ? `:${line}` : ''
  return `${market.key}${lineLabel}`
}

const mergeMarkets = (existing: OddsMarket[], additions: OddsMarket[]) => {
  const merged = [...existing]
  additions.forEach((market) => {
    const signature = buildMarketSignature(market)
    const index = merged.findIndex(
      (current) => buildMarketSignature(current) === signature
    )
    if (index === -1) {
      merged.push(market)
      return
    }
    if (market.outcomes.length > merged[index].outcomes.length) {
      merged[index] = market
    }
  })
  return merged
}

export async function fetchKalshiOdds(
  sport: string,
  markets: string[] = [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS],
  options: KalshiFetchOptions = {}
): Promise<OddsGame[]> {
  const canonical = resolveSportKey(sport)
  if (!canonical) return []
  const seriesConfigs = KALSHI_SERIES_BY_SPORT[canonical]
  if (!seriesConfigs?.length) return []

  const allowedMarketKeys = new Set(
    markets.filter((market) =>
      [MARKETS.H2H, MARKETS.SPREADS, MARKETS.TOTALS].includes(
        market as typeof MARKETS.H2H | typeof MARKETS.SPREADS | typeof MARKETS.TOTALS
      )
    )
  )
  if (!allowedMarketKeys.size) return []

  const selectedSeries = seriesConfigs.filter((config) =>
    allowedMarketKeys.has(config.market)
  )
  if (!selectedSeries.length) return []

  const init = buildFetchInit(options)
  const eventsBySeries = await Promise.allSettled(
    selectedSeries.map((config) => fetchKalshiEvents(config.ticker, init))
  )

  const sportTitle = resolveSportTitle(sport)
  const filters = options.teamFilter ?? []
  const bookmakerBase: Bookmaker = {
    key: 'kalshi',
    title: 'Kalshi',
    url: 'https://kalshi.com',
    markets: [],
  }

  const gamesByMatch = new Map<string, OddsGame>()

  eventsBySeries.forEach((result, index) => {
    if (result.status !== 'fulfilled') return
    const series = selectedSeries[index]
    if (!series) return
    result.value.forEach((event) => {
      if (!event?.title) return
      const teams = parseTeamsFromTitle(event.title)
      if (!teams || !matchesTeamFilter(teams, filters)) return

      const oddsMarkets = buildKalshiMarkets(
        event.markets ?? [],
        teams,
        series.market
      )
      if (!oddsMarkets.length) return

      const matchKey = buildMatchKey(teams)
      const commenceTime = resolveCommenceTime(event)
      const existing = gamesByMatch.get(matchKey)
      if (existing) {
        const existingBook = existing.bookmakers.find(
          (book) => book.key === 'kalshi'
        )
        if (existingBook) {
          existingBook.markets = mergeMarkets(
            existingBook.markets,
            oddsMarkets
          )
        } else {
          existing.bookmakers = [
            ...existing.bookmakers,
            { ...bookmakerBase, markets: oddsMarkets },
          ]
        }

        const existingTime = new Date(existing.commence_time).getTime()
        const nextTime = new Date(commenceTime).getTime()
        if (
          Number.isFinite(nextTime) &&
          (!Number.isFinite(existingTime) || nextTime < existingTime)
        ) {
          existing.commence_time = commenceTime
        }
        return
      }

      gamesByMatch.set(matchKey, {
        id: `kalshi:${event.event_ticker}`,
        sport_key: sport,
        sport_title: sportTitle,
        commence_time: commenceTime,
        home_team: teams.home,
        away_team: teams.away,
        bookmakers: [{ ...bookmakerBase, markets: oddsMarkets }],
      })
    })
  })

  return Array.from(gamesByMatch.values())
}
