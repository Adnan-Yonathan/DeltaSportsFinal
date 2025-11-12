import { OddsGame, ArbitrageOpportunity, MARKETS } from '@/lib/types/odds'
import { isArbitrage, calculateArbitrageStakes, americanToDecimal } from '@/lib/utils/odds'

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

export class OddsAPIError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message)
    this.name = 'OddsAPIError'
  }
}

// --- Rotating API key support ---
type KeyStatus = { coolingUntil?: number }

const parseKeyPool = (): string[] => {
  try {
    if (process.env.ODDS_API_KEYS) {
      const arr = JSON.parse(process.env.ODDS_API_KEYS)
      if (Array.isArray(arr)) return arr.filter(Boolean)
    }
  } catch {
    // ignore parse errors; fall back below
  }
  return process.env.ODDS_API_KEY ? [process.env.ODDS_API_KEY] : []
}

const keyPool = parseKeyPool()
const keyStatus = new Map<string, KeyStatus>()
let startIndex = 0

const COOLDOWN_MS = 10 * 60 * 1000 // 10 minutes
const MAX_ATTEMPTS = Math.min(Math.max(keyPool.length, 1), 10)

const shouldSkipKey = (key: string) => {
  const s = keyStatus.get(key)
  return !!(s?.coolingUntil && s.coolingUntil > Date.now())
}

const markCooling = (key: string, reason: string) => {
  keyStatus.set(key, { coolingUntil: Date.now() + COOLDOWN_MS })
  try {
    console.warn(`[OddsAPI] Cooling key due to ${reason}. Key tail: ${key.slice(-4)}`)
  } catch {}
}

const isRateLimitOrAuthError = (status: number, bodyText?: string) => {
  if (status === 401 || status === 403 || status === 429) return true
  if (!bodyText) return false
  const t = bodyText.toLowerCase()
  return (
    t.includes('rate') ||
    t.includes('quota') ||
    t.includes('limit') ||
    t.includes('unauthorized') ||
    t.includes('invalid api key')
  )
}

async function fetchWithRotation(urlBase: string, init?: RequestInit): Promise<Response> {
  if (keyPool.length === 0) {
    throw new OddsAPIError('ODDS_API_KEY is not configured')
  }

  let attempts = 0
  let lastErr: any = null

  for (let i = 0; i < keyPool.length && attempts < MAX_ATTEMPTS; i++) {
    const idx = (startIndex + i) % keyPool.length
    const apiKey = keyPool[idx]
    if (!apiKey) continue
    if (shouldSkipKey(apiKey)) {
      continue
    }

    const u = new URL(urlBase)
    u.searchParams.set('apiKey', apiKey)

    try {
      const res = await fetch(u.toString(), init)

      const remaining = res.headers.get('x-requests-remaining')
      if (remaining && !isNaN(Number(remaining)) && Number(remaining) <= 1) {
        markCooling(apiKey, `low remaining (${remaining})`)
        startIndex = (idx + 1) % keyPool.length
      }

      if (res.ok) {
        startIndex = (idx + 1) % keyPool.length
        return res
      } else {
        const bodyText = await res.text().catch(() => '')
        if (isRateLimitOrAuthError(res.status, bodyText)) {
          markCooling(apiKey, `status ${res.status}`)
          lastErr = new OddsAPIError(`Odds API returned ${res.status}: ${res.statusText}`, res.status)
          attempts++
          continue
        }
        throw new OddsAPIError(`Odds API returned ${res.status}: ${res.statusText}`, res.status)
      }
    } catch (err: any) {
      lastErr = err
      attempts++
      markCooling(apiKey, 'network/error')
      continue
    }
  }

  if (lastErr instanceof OddsAPIError) throw lastErr
  throw new OddsAPIError(`Failed to fetch after rotating keys: ${lastErr}`)
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
    const response = await fetchWithRotation(url, fetchInit)
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
    const response = await fetchWithRotation(url, { next: { revalidate: 3600 } })
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
