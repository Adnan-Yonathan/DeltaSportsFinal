import { OddsGame, ArbitrageOpportunity, MARKETS } from '@/lib/types/odds'
import { isArbitrage, calculateArbitrageStakes, americanToDecimal } from '@/lib/utils/odds'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

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

/**
 * Fetch odds for a specific sport
 */
export interface FetchOddsOptions {
  /**
   * When true, skip Next.js caching and always pull fresh odds.
   */
  live?: boolean
  /**
   * Override the cache revalidation window (seconds) used when `live` is false.
   */
  revalidateSeconds?: number
}

export async function fetchOdds(
  sport: string,
  markets: string[] = ['h2h', 'spreads', 'totals'],
  options: FetchOddsOptions = {}
): Promise<OddsGame[]> {
  const marketsParam = markets.join(',')
  const url = `${ODDS_API_BASE}/sports/${sport}/odds/?regions=us&markets=${marketsParam}&oddsFormat=american`
  const fetchInit: RequestInit =
    options.live
      ? { cache: 'no-store' }
      : { next: { revalidate: options.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS } }

  try {
    const response = await fetchWithSingleKey(url, fetchInit)
    const data = await response.json()
    return data as OddsGame[]
  } catch (error) {
    if (error instanceof OddsAPIError) throw error
    throw new OddsAPIError(`Failed to fetch odds: ${error}`)
  }
}

/**
 * Fetch available sports
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

    // Check each market type
    for (const marketKey of Object.values(MARKETS)) {
      // Collect all odds for this market across all bookmakers
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

      // Check for arbitrage between opposing outcomes
      const outcomes = Array.from(marketOdds.keys())

      for (let i = 0; i < outcomes.length; i++) {
        for (let j = i + 1; j < outcomes.length; j++) {
          const outcome1Options = marketOdds.get(outcomes[i])!
          const outcome2Options = marketOdds.get(outcomes[j])!

          // Find best odds for each outcome
          const best1 = outcome1Options.reduce((best, curr) =>
            curr.odds > best.odds ? curr : best
          )
          const best2 = outcome2Options.reduce((best, curr) =>
            curr.odds > best.odds ? curr : best
          )

          // Check if it's an arbitrage
          if (isArbitrage(best1.odds, best2.odds)) {
            const totalStake = 1000 // Default stake for calculation
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

  // Sort by profit percentage (highest first)
  return opportunities.sort((a, b) => b.profitPercent - a.profitPercent)
}

/**
 * Get best odds for a specific game and market
 */
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
