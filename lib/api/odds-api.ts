import { OddsGame, ArbitrageOpportunity, MARKETS, Bookmaker, OddsMarket, OddsOutcome } from '@/lib/types/odds'
import { isArbitrage, calculateArbitrageStakes, americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'
const ODDS_IO_BASE = 'https://api.odds-api.io/v3'

export class OddsAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'OddsAPIError'
  }
}

const getRequiredOddsKey = (): string => {
  const key = process.env.ODDS_API_KEY
  if (!key) {
    throw new OddsAPIError('ODDS_API_KEY is not configured')
  }
  return key
}

async function fetchWithSingleKey(urlBase: string, init?: RequestInit): Promise<Response> {
  const apiKey = getRequiredOddsKey()
  const url = new URL(urlBase)
  url.searchParams.set('apiKey', apiKey)

  const res = await fetch(url.toString(), init)
  if (!res.ok) {
    const bodyText = await res.text().catch(() => '')
    throw new OddsAPIError(
      `Odds API returned ${res.status}: ${bodyText || res.statusText}`,
      res.status
    )
  }
  return res
}

const DEFAULT_REVALIDATE_SECONDS = 30

// ============ Odds-API.io Provider (inline) ============
const SPORT_MAP: Record<string, { sport: string; league: string }> = {
  basketball_nba: { sport: 'basketball', league: 'nba' },
  basketball_ncaab: { sport: 'basketball', league: 'ncaab' },
  americanfootball_nfl: { sport: 'football', league: 'nfl' },
  americanfootball_ncaaf: { sport: 'football', league: 'ncaaf' },
  baseball_mlb: { sport: 'baseball', league: 'mlb' },
  icehockey_nhl: { sport: 'hockey', league: 'nhl' },
}

function pickBookmakersParam(): string | undefined {
  const raw = process.env.ODDS_BOOKMAKERS
  if (!raw) return undefined
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean)
  return list.length ? list.join(',') : undefined
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
}

async function fetchJson(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OddsAPIError(`Odds-API.io error ${res.status}: ${body || res.statusText}`, res.status)
  }
  return res.json()
}

function toAmerican(value?: string | number | null): number | undefined {
  if (value == null) return undefined
  const dec = typeof value === 'string' ? parseFloat(value) : value
  if (!isFinite(dec) || dec <= 1) return undefined
  return decimalToAmerican(dec)
}

function mapBookmakersIO(oddsObj: any, home: string, away: string): Bookmaker[] {
  const result: Bookmaker[] = []
  for (const [bookName, markets] of Object.entries(oddsObj || {})) {
    const title = String(bookName)
    const key = slugify(title)
    const mappedMarkets: OddsMarket[] = []

    for (const market of markets as any[]) {
      const name = market?.name || ''
      const last_update = market?.updatedAt

      if (name === 'ML' && market.odds?.[0]) {
        const o = market.odds[0]
        const out: OddsOutcome[] = []
        const homePrice = toAmerican(o.home)
        const awayPrice = toAmerican(o.away)
        if (homePrice != null) out.push({ name: home, price: homePrice })
        if (o.draw != null) {
          const drawPrice = toAmerican(o.draw)
          if (drawPrice != null) out.push({ name: 'Draw', price: drawPrice })
        }
        if (awayPrice != null) out.push({ name: away, price: awayPrice })
        if (out.length) mappedMarkets.push({ key: 'h2h', outcomes: out, last_update })
      }

      if ((name.includes('Asian Handicap') || name.includes('Spread')) && Array.isArray(market.odds)) {
        for (const row of market.odds) {
          const hdp = typeof row.hdp === 'number' ? row.hdp : parseFloat(row.hdp)
          if (!isFinite(hdp)) continue
          const out: OddsOutcome[] = []
          const homePrice = toAmerican(row.home)
          const awayPrice = toAmerican(row.away)
          if (homePrice != null) out.push({ name: home, price: homePrice, point: hdp })
          if (awayPrice != null) out.push({ name: away, price: awayPrice, point: -hdp })
          if (out.length) mappedMarkets.push({ key: 'spreads', outcomes: out, last_update })
        }
      }

      if ((name.includes('Over/Under') || name.includes('Total')) && Array.isArray(market.odds)) {
        for (const row of market.odds) {
          const max = typeof row.max === 'number' ? row.max : parseFloat(row.max)
          if (!isFinite(max)) continue
          const overPrice = toAmerican(row.over)
          const underPrice = toAmerican(row.under)
          const outcomes: OddsOutcome[] = []
          if (overPrice != null) outcomes.push({ name: 'Over', price: overPrice, point: max })
          if (underPrice != null) outcomes.push({ name: 'Under', price: underPrice, point: max })
          if (outcomes.length) mappedMarkets.push({ key: 'totals', outcomes, last_update })
        }
      }
    }

    if (mappedMarkets.length) {
      result.push({ key, title, markets: mappedMarkets })
    }
  }
  return result
}

async function fetchOddsIO(
  sportKey: string,
  _markets: string[] = ['h2h', 'spreads', 'totals'],
  opts: { live?: boolean; revalidateSeconds?: number } = {}
): Promise<OddsGame[]> {
  const mapping = SPORT_MAP[sportKey]
  if (!mapping) return []
  const apiKey = getRequiredOddsKey()
  const status = opts.live ? 'live' : 'pending'
  const fetchInit: RequestInit = opts.live ? { cache: 'no-store' } : { next: { revalidate: opts.revalidateSeconds ?? 30 } }

  const eventsUrl = `${ODDS_IO_BASE}/events?apiKey=${apiKey}&sport=${mapping.sport}&league=${mapping.league}&status=${status}`
  const events = await fetchJson(eventsUrl, fetchInit)
  if (!Array.isArray(events) || events.length === 0) return []

  const ids: string[] = events.map((e: any) => String(e.id)).filter(Boolean)
  if (ids.length === 0) return []

  const bookmakersParam = pickBookmakersParam()
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10))

  const games: OddsGame[] = []

  for (const chunk of chunks) {
    const oddsUrl = new URL(`${ODDS_IO_BASE}/odds/multi`)
    oddsUrl.searchParams.set('apiKey', apiKey)
    oddsUrl.searchParams.set('eventIds', chunk.join(','))
    if (bookmakersParam) oddsUrl.searchParams.set('bookmakers', bookmakersParam)

    const data = await fetchJson(oddsUrl.toString(), fetchInit)
    if (!Array.isArray(data)) continue

    for (const ev of data) {
      const home = ev.home || events.find((e: any) => String(e.id) === String(ev.id))?.home || ''
      const away = ev.away || events.find((e: any) => String(e.id) === String(ev.id))?.away || ''
      const bk = mapBookmakersIO(ev.bookmakers || {}, home, away)
      if (bk.length === 0) continue

      const commence = ev.date || events.find((e: any) => String(e.id) === String(ev.id))?.date || new Date().toISOString()
      games.push({
        id: String(ev.id),
        sport_key: sportKey,
        sport_title: mapping.league.toUpperCase(),
        commence_time: String(commence),
        home_team: String(home),
        away_team: String(away),
        bookmakers: bk,
      })
    }
  }

  return games
}

/**
 * Fetch odds for a specific sport
 */
export interface FetchOddsOptions {
  live?: boolean
  revalidateSeconds?: number
}

export async function fetchOdds(
  sport: string,
  markets: string[] = ['h2h', 'spreads', 'totals'],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  const provider = (process.env.ODDS_PROVIDER || '').toLowerCase()
  if (provider === 'odds-api-io') {
    return fetchOddsIO(sport, markets, {
      live: options.live,
      revalidateSeconds: options.revalidateSeconds,
    })
  }

  const marketsParam = markets.join(',')
  const url = `${ODDS_API_BASE}/sports/${sport}/odds/?regions=us&markets=${marketsParam}&oddsFormat=american`
  const fetchInit: RequestInit = options.live
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
 * Fetch available sports (legacy; The Odds API only)
 */
export async function fetchSports(): Promise<any[]> {
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
  const status = opts.status || 'pending'
  const url = new URL(`${ODDS_IO_BASE}/events`)
  url.searchParams.set('apiKey', apiKey)
  url.searchParams.set('sport', mapping.sport)
  url.searchParams.set('league', mapping.league)
  url.searchParams.set('status', status)

  const res = await fetch(url.toString(), { next: { revalidate: status === 'live' ? 10 : 60 } })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OddsAPIError(`Odds-API.io events error ${res.status}: ${body || res.statusText}`, res.status)
  }
  const events = (await res.json()) as any[]
  if (!Array.isArray(events)) return []

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
    status: String(ev.status || 'pending'),
  }))
}
