import { buildTeamLabel, fetchSbdFuturesMarket, fetchSbdFuturesMarkets, resolveBookIds, resolveSbdLeague, type SbdLeague, formatBookmaker } from '@/lib/api/sbd'

export interface SbdFuturesMarket {
  id: string
  name: string
}

export interface SbdFuturesOdds {
  bookId: string
  bookName: string
  bookKey: string
  bookUrl?: string
  oddsAmerican?: number | null
  oddsDecimal?: number | null
  openOddsAmerican?: number | null
  openOddsDecimal?: number | null
  best?: boolean
}

export interface SbdFuturesSelection {
  id: string
  name: string
  competitorId?: string
  competitorType?: string
  alias?: string
  odds: SbdFuturesOdds[]
}

export interface SbdFuturesSnapshot {
  league: SbdLeague
  market: SbdFuturesMarket | null
  markets: SbdFuturesMarket[]
  selections: SbdFuturesSelection[]
}

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

const normalize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const scoreMarket = (market: SbdFuturesMarket, query: string): number => {
  if (!market?.name) return -1
  const name = normalize(market.name)
  const normalizedQuery = normalize(query)
  if (!normalizedQuery) return -1
  if (market.id === query) return 200
  if (name === normalizedQuery) return 150
  if (name.includes(normalizedQuery)) return 120

  const tokens = normalizedQuery.split(/\s+/).filter(Boolean)
  if (!tokens.length) return -1
  const matches = tokens.filter((t) => name.includes(t)).length
  if (matches === tokens.length) return 100 + matches
  return matches
}

const pickMarket = (markets: SbdFuturesMarket[], query?: string): SbdFuturesMarket | null => {
  if (!markets.length) return null
  if (!query) return markets[0]

  let best: SbdFuturesMarket | null = null
  let bestScore = -1
  for (const market of markets) {
    const score = scoreMarket(market, query)
    if (score > bestScore) {
      best = market
      bestScore = score
    }
  }

  return bestScore >= 1 ? best : markets[0]
}

const buildSelectionName = (entry: any): string => {
  const competitorName = typeof entry?.competitor_name === 'string' ? entry.competitor_name.trim() : ''
  if (competitorName) return competitorName
  const built = buildTeamLabel({ market: entry?.market, name: entry?.name })
  if (built) return built
  return entry?.name || entry?.market || 'Unknown'
}

export async function fetchSbdFuturesSnapshot(opts: {
  sport: string
  market?: string
  books?: string[] | string
  init?: RequestInit
}): Promise<SbdFuturesSnapshot | null> {
  const league = resolveSbdLeague(opts.sport)
  if (!league) return null

  const marketsPayload = await fetchSbdFuturesMarkets(league, { init: opts.init })
  const markets: SbdFuturesMarket[] = Array.isArray(marketsPayload?.data)
    ? marketsPayload.data
        .map((m: any) => ({
          id: String(m?.id || ''),
          name: String(m?.name || ''),
        }))
        .filter((m: SbdFuturesMarket) => m.id && m.name)
    : []

  const market = pickMarket(markets, opts.market)
  if (!market) {
    return {
      league,
      market: null,
      markets,
      selections: [],
    }
  }

  const bookIds = resolveBookIds(opts.books || null)
  const detailPayload = await fetchSbdFuturesMarket(league, market.id, { books: bookIds, init: opts.init })
  const selections: SbdFuturesSelection[] = Array.isArray(detailPayload?.data)
    ? detailPayload.data.map((entry: any) => {
        const odds: SbdFuturesOdds[] = Array.isArray(entry?.odds)
          ? entry.odds.map((book: any) => {
              const bookName = typeof book?.name === 'string' ? book.name : ''
              const formatted = bookName ? formatBookmaker(bookName) : { key: '', title: bookName, url: undefined }
              return {
                bookId: String(book?.id || ''),
                bookName: bookName || String(book?.id || ''),
                bookKey: formatted.key,
                bookUrl: formatted.url,
                oddsAmerican: parseAmerican(book?.odds_american ?? book?.oddsAmerican),
                oddsDecimal: parseNumber(book?.odds_decimal ?? book?.oddsDecimal),
                openOddsAmerican: parseAmerican(book?.open_odds_american ?? book?.openOddsAmerican),
                openOddsDecimal: parseNumber(book?.open_odds_decimal ?? book?.openOddsDecimal),
                best: Boolean(book?.best),
              }
            })
          : []
        return {
          id: String(entry?.id || entry?.competitor_id || ''),
          name: buildSelectionName(entry),
          competitorId: entry?.competitor_id ? String(entry.competitor_id) : undefined,
          competitorType: entry?.competitor_type ? String(entry.competitor_type) : undefined,
          alias: entry?.alias ? String(entry.alias) : undefined,
          odds: odds.filter((o: SbdFuturesOdds) => o.bookId || o.bookName),
        }
      })
    : []

  return {
    league,
    market,
    markets,
    selections,
  }
}
