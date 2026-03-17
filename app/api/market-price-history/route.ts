import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const POLYMARKET_GAMMA = 'https://gamma-api.polymarket.com'
const POLYMARKET_CLOB = 'https://clob.polymarket.com'

const POLYMARKET_SPORT_MAP: Record<string, string> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'cbb',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'cfb',
  baseball_mlb: 'mlb',
  icehockey_nhl: 'nhl',
}

type PricePoint = { t: number; p: number }

const cache = new Map<string, { expiresAt: number; data: any }>()
const CACHE_TTL_MS = 5 * 60 * 1000

/**
 * Searches Polymarket events for a game matching homeTeam vs awayTeam,
 * then fetches CLOB price history for the moneyline market.
 *
 * Query params:
 *   sportKey  - e.g. basketball_nba
 *   homeTeam  - e.g. Boston Celtics
 *   awayTeam  - e.g. Los Angeles Lakers
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const sportKey = searchParams.get('sportKey') || ''
  const homeTeam = searchParams.get('homeTeam') || ''
  const awayTeam = searchParams.get('awayTeam') || ''

  if (!sportKey || !homeTeam || !awayTeam) {
    return NextResponse.json({ error: 'sportKey, homeTeam, awayTeam required' }, { status: 400 })
  }

  const cacheKey = `${sportKey}:${normalizeKey(homeTeam)}:${normalizeKey(awayTeam)}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.data)
  }

  try {
    const polySport = POLYMARKET_SPORT_MAP[sportKey]
    if (!polySport) {
      return NextResponse.json({ series: null, matched: false })
    }

    // Step 1: Find the Polymarket event for this game
    const sportsRes = await fetch(`${POLYMARKET_GAMMA}/sports`, { cache: 'no-store' })
    if (!sportsRes.ok) return NextResponse.json({ series: null, matched: false })
    const sports = await sportsRes.json()
    const sportEntry = Array.isArray(sports)
      ? sports.find((s: any) => s.sport === polySport)
      : null
    if (!sportEntry?.series) {
      return NextResponse.json({ series: null, matched: false })
    }

    const eventsUrl = new URL(`${POLYMARKET_GAMMA}/events`)
    eventsUrl.searchParams.set('series_id', String(sportEntry.series))
    eventsUrl.searchParams.set('tag_id', '100639')
    eventsUrl.searchParams.set('active', 'true')
    eventsUrl.searchParams.set('closed', 'false')
    eventsUrl.searchParams.set('limit', '200')

    const eventsRes = await fetch(eventsUrl.toString(), { cache: 'no-store' })
    if (!eventsRes.ok) return NextResponse.json({ series: null, matched: false })
    const events: any[] = await eventsRes.json()
    if (!Array.isArray(events)) return NextResponse.json({ series: null, matched: false })

    // Match event to this game
    // Polymarket titles use nicknames like "Nuggets vs. Grizzlies"
    // Research mode sends full names like "Denver Nuggets" or "Boston Celtics"
    const homeTokens = teamTokens(homeTeam)
    const awayTokens = teamTokens(awayTeam)
    let matchedEvent: any = null
    let bestScore = 0

    for (const event of events) {
      const title = String(event.title || '')
      const titleNorm = normalizeKey(title)
      const titleLower = title.toLowerCase()
      let score = 0

      // Try full normalized key match
      const homeNorm = normalizeKey(homeTeam)
      const awayNorm = normalizeKey(awayTeam)
      if (titleNorm.includes(homeNorm) && titleNorm.includes(awayNorm)) {
        score = 3
      }

      // Try nickname/token matching (most common case)
      if (score < 2) {
        const homeMatch = homeTokens.some((t) => titleLower.includes(t))
        const awayMatch = awayTokens.some((t) => titleLower.includes(t))
        if (homeMatch && awayMatch) {
          score = Math.max(score, 2)
        }
      }

      if (score > bestScore) {
        bestScore = score
        matchedEvent = event
      }
    }

    if (!matchedEvent || bestScore < 2) {
      console.log(`[market-price-history] no match for "${homeTeam}" vs "${awayTeam}" in ${events.length} events`)
      return NextResponse.json({ series: null, matched: false })
    }

    console.log(`[market-price-history] matched "${matchedEvent.title}" for "${homeTeam}" vs "${awayTeam}"`)

    // Step 2: Extract token IDs from the moneyline market
    const markets: any[] = Array.isArray(matchedEvent.markets) ? matchedEvent.markets : []
    const moneylineMarket = markets.find(
      (m: any) => m.sportsMarketType?.toLowerCase() === 'moneyline' && m.active && !m.closed
    )
    // Fallback: any active market
    const targetMarket = moneylineMarket || markets.find((m: any) => m.active && !m.closed)

    if (!targetMarket) {
      return NextResponse.json({ series: null, matched: true, reason: 'no active market' })
    }

    const tokenIds = parseJsonArray<string>(targetMarket.clobTokenIds)
    const outcomes = parseJsonArray<string>(targetMarket.outcomes)

    if (!tokenIds.length) {
      return NextResponse.json({ series: null, matched: true, reason: 'no token IDs' })
    }

    // Step 3: Fetch price history from CLOB for each token
    const seriesResult: Record<string, { label: string; points: { t: string; value: number }[] }> = {}

    await Promise.all(
      tokenIds.map(async (tokenId, idx) => {
        try {
          const histUrl = `${POLYMARKET_CLOB}/prices-history?market=${tokenId}&interval=all&fidelity=60`
          const histRes = await fetch(histUrl, { cache: 'no-store' })
          if (!histRes.ok) return
          const histData = await histRes.json()
          const history: PricePoint[] = Array.isArray(histData?.history)
            ? histData.history
            : Array.isArray(histData)
              ? histData
              : []

          const label = outcomes[idx] || `Outcome ${idx + 1}`
          const points = history
            .filter((p: any) => p.t != null && p.p != null)
            .map((p: any) => ({
              t: new Date(Number(p.t) * 1000).toISOString(),
              value: Number(p.p),
            }))

          if (points.length > 0) {
            seriesResult[label.toLowerCase()] = { label, points }
          }
        } catch {
          // skip failed token
        }
      })
    )

    const result = {
      matched: true,
      eventTitle: matchedEvent.title,
      marketType: targetMarket.sportsMarketType || 'moneyline',
      series: Object.keys(seriesResult).length > 0 ? seriesResult : null,
    }

    cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, data: result })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[market-price-history] error', err)
    return NextResponse.json({ series: null, matched: false, error: 'fetch failed' })
  }
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/**
 * Extract meaningful tokens from a team name for matching.
 * "Denver Nuggets" → ["nuggets", "denver"]
 * "Boston Celtics" → ["celtics", "boston"]
 * "LA Clippers" → ["clippers"]
 * Returns tokens in priority order (nickname first, then city).
 */
function teamTokens(teamName: string): string[] {
  const parts = teamName.trim().toLowerCase().split(/\s+/)
  if (parts.length === 0) return []
  // Last word is usually the nickname — most reliable for matching
  const tokens: string[] = []
  const last = parts[parts.length - 1]
  if (last && last.length >= 3) tokens.push(last)
  // Also add multi-word nicknames (e.g., "Trail Blazers", "Blue Jays")
  if (parts.length >= 3) {
    const lastTwo = parts.slice(-2).join(' ')
    tokens.push(lastTwo)
  }
  // Add city/first word for disambiguation
  if (parts.length >= 2 && parts[0].length >= 3) {
    tokens.push(parts[0])
  }
  return tokens
}

function parseJsonArray<T>(value?: string): T[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
