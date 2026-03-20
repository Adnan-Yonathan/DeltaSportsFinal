import { createServiceClient } from '@/lib/supabase/service'
import { fetchAllLiveScores, type LiveScoreGame } from '@/lib/live-scores'
import type { WhaleTrade } from './whale-detector'
import { hydrateWhaleTradesWithWalletMetrics } from './whale-wallet-metrics'

export type GameStatus = 'pregame' | 'live' | 'final'

export interface DailyWhaleTrade extends WhaleTrade {
  is_live: boolean
  game_status: GameStatus
}

export interface FetchDailyTradesOptions {
  date?: string // YYYY-MM-DD, defaults to today
  sport?: string
  minNotional?: number
  limit?: number
}

export interface TradeResolutionUpdate {
  source: string
  trade_id: string
  result: 'win' | 'loss' | 'push'
  pnl: number
  current_price_cents: number
}

// Cache for live games to avoid repeated ESPN calls within the same request
let liveGamesCache: {
  games: LiveScoreGame[]
  timestamp: number
} | null = null

const LIVE_GAMES_CACHE_TTL_MS = 30_000 // 30 seconds

/**
 * Fetch live games from ESPN with caching
 */
async function fetchLiveGamesWithCache(): Promise<LiveScoreGame[]> {
  const now = Date.now()
  if (liveGamesCache && now - liveGamesCache.timestamp < LIVE_GAMES_CACHE_TTL_MS) {
    return liveGamesCache.games
  }

  try {
    const response = await fetchAllLiveScores()
    const liveGames = response.games.filter((game) => game.bucket === 'live')
    liveGamesCache = { games: liveGames, timestamp: now }
    return liveGames
  } catch (error) {
    console.warn('[whale-trades-daily] Failed to fetch live games:', error)
    return liveGamesCache?.games ?? []
  }
}

/**
 * Normalize team name for fuzzy matching
 */
export function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
}

/**
 * Extract team names from market title
 */
export function extractTeamsFromTitle(title: string): string[] {
  // Common patterns: "Lakers vs Celtics", "Lakers @ Celtics", "Lakers - Celtics"
  const patterns = [
    /(.+?)\s+(?:vs\.?|@|v\.?|-)\s+(.+)/i,
    /(.+?)\s+(?:spread|moneyline|total|over|under)/i,
  ]

  for (const pattern of patterns) {
    const match = title.match(pattern)
    if (match) {
      return match.slice(1).map((t) => normalizeTeamName(t))
    }
  }

  // Just return normalized title words as potential team identifiers
  return title.split(/\s+/).map(normalizeTeamName).filter(Boolean)
}

/** Map sport labels to ESPN league IDs */
export const ESPN_SPORT_TO_LEAGUE: Record<string, string[]> = {
  NBA: ['nba'],
  NFL: ['nfl'],
  NHL: ['nhl'],
  MLB: ['mlb'],
  NCAAB: ['ncaab'],
  NCAAF: ['cfb'],
  WNBA: ['wnba'],
}

/**
 * Check if a game is currently live by matching market title to ESPN live games
 */
export async function isGameLive(
  sport: string,
  marketTitle: string
): Promise<{ isLive: boolean; status: GameStatus }> {
  const liveGames = await fetchLiveGamesWithCache()

  const sportToLeague = ESPN_SPORT_TO_LEAGUE

  const leagues = sportToLeague[sport] ?? []
  const relevantGames = leagues.length
    ? liveGames.filter((g) => leagues.includes(g.league))
    : liveGames

  if (relevantGames.length === 0) {
    return { isLive: false, status: 'pregame' }
  }

  const marketTeams = extractTeamsFromTitle(marketTitle)

  for (const game of relevantGames) {
    const gameTeams = game.competitors.flatMap((c) => [
      normalizeTeamName(c.name),
      normalizeTeamName(c.shortName),
      normalizeTeamName(c.abbreviation),
    ])

    // Check if any market team matches any game team
    const hasMatch = marketTeams.some((marketTeam) =>
      gameTeams.some(
        (gameTeam) =>
          gameTeam.includes(marketTeam) || marketTeam.includes(gameTeam)
      )
    )

    if (hasMatch) {
      return { isLive: true, status: 'live' }
    }
  }

  return { isLive: false, status: 'pregame' }
}

/**
 * Get today's date in YYYY-MM-DD format (Eastern timezone)
 */
function getTodayDateET(): string {
  const now = new Date()
  const eastern = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)

  const year = eastern.find((p) => p.type === 'year')?.value ?? ''
  const month = eastern.find((p) => p.type === 'month')?.value ?? ''
  const day = eastern.find((p) => p.type === 'day')?.value ?? ''

  return `${year}-${month}-${day}`
}

/**
 * Parse event date string to Date object
 */
function parseEventDate(eventDate?: string): Date | null {
  if (!eventDate) return null
  const match = eventDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(`${match[0]}T00:00:00Z`)
  }
  const parsed = new Date(eventDate)
  return isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Store whale trades to the database with live game detection
 * Uses upsert to prevent duplicates
 */
export async function storeWhaleTrades(trades: WhaleTrade[]): Promise<void> {
  if (!trades.length) return

  const supabase = createServiceClient()
  const todayDate = getTodayDateET()

  // Batch check live status for all unique sport/title combinations
  const uniqueChecks = new Map<string, { sport: string; title: string }>()
  trades.forEach((trade) => {
    const key = `${trade.sport}:${trade.marketTitle}`
    if (!uniqueChecks.has(key)) {
      uniqueChecks.set(key, { sport: trade.sport, title: trade.marketTitle })
    }
  })

  const liveStatusMap = new Map<string, { isLive: boolean; status: GameStatus }>()
  await Promise.all(
    Array.from(uniqueChecks.entries()).map(async ([key, { sport, title }]) => {
      const status = await isGameLive(sport, title)
      liveStatusMap.set(key, status)
    })
  )

  // Transform trades for insertion
  const records = trades.map((trade) => {
    const key = `${trade.sport}:${trade.marketTitle}`
    const liveStatus = liveStatusMap.get(key) ?? { isLive: false, status: 'pregame' as const }
    const eventDate = parseEventDate(trade.eventDate)

    return {
      trade_id: trade.id,
      source: trade.source,
      trade_date: todayDate,
      trade_time: trade.timestamp,
      market_title: trade.marketTitle,
      outcome: trade.outcome,
      sport: trade.sport,
      ticker: trade.ticker ?? null,
      slug: trade.slug ?? null,
      outcome_index: trade.outcomeIndex ?? null,
      side: trade.side ?? null,
      event_date: eventDate?.toISOString().slice(0, 10) ?? null,
      notional: trade.notional,
      contracts: trade.contracts,
      price_cents: trade.priceCents,
      american_odds: trade.americanOdds ?? null,
      proxy_wallet: trade.proxyWallet ?? null,
      is_live: liveStatus.isLive,
      game_status: liveStatus.status,
    }
  })

  // Upsert in batches to avoid hitting limits
  const BATCH_SIZE = 100
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    const table = supabase.from('whale_trades_daily' as any) as any
    const { error } = await table.upsert(batch, {
      onConflict: 'source,trade_id',
      ignoreDuplicates: true,
    })

    if (error) {
      console.error('[whale-trades-daily] Storage error:', error)
    }
  }
}

/**
 * Fetch today's trades (or specific date) from the database
 */
export async function fetchDailyWhaleTrades(
  options: FetchDailyTradesOptions = {}
): Promise<DailyWhaleTrade[]> {
  const supabase = createServiceClient()
  const date = options.date ?? getTodayDateET()
  const limit = options.limit ?? 500

  let query = supabase
    .from('whale_trades_daily' as any)
    .select('*')
    .eq('trade_date', date)
    .order('trade_time', { ascending: false })
    .limit(limit)

  if (options.sport) {
    query = query.eq('sport', options.sport)
  }

  if (options.minNotional) {
    query = query.gte('notional', options.minNotional)
  }

  const { data, error } = await query

  if (error) {
    console.error('[whale-trades-daily] Fetch error:', error)
    return []
  }

  // Transform database records back to DailyWhaleTrade format
  const mappedTrades = (data ?? []).map((row: any) => ({
    id: row.trade_id,
    source: row.source as 'kalshi' | 'polymarket',
    marketTitle: row.market_title,
    outcome: row.outcome,
    proxyWallet: row.proxy_wallet ?? undefined,
    priceCents: row.price_cents,
    americanOdds: row.american_odds,
    notional: Number(row.notional),
    contracts: Number(row.contracts) || 0,
    timestamp: row.trade_time,
    sport: row.sport ?? 'Sports',
    eventDate: row.event_date ?? undefined,
    ticker: row.ticker ?? undefined,
    slug: row.slug ?? undefined,
    outcomeIndex: row.outcome_index ?? undefined,
    side: row.side ?? undefined,
    is_live: row.is_live ?? false,
    game_status: (row.game_status as GameStatus) ?? 'pregame',
  }))

  return hydrateWhaleTradesWithWalletMetrics(mappedTrades)
}

/**
 * Update resolution status for trades
 */
export async function updateTradeResolutions(
  updates: TradeResolutionUpdate[]
): Promise<void> {
  if (!updates.length) return

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  for (const update of updates) {
    const table = supabase.from('whale_trades_daily' as any) as any
    const { error } = await table
      .update({
        result: update.result,
        pnl: update.pnl,
        current_price_cents: update.current_price_cents,
        resolved_at: now,
      })
      .eq('source', update.source)
      .eq('trade_id', update.trade_id)

    if (error) {
      console.error('[whale-trades-daily] Resolution update error:', error)
    }
  }
}

/**
 * Get count of today's trades and live trades
 */
export async function getDailyTradeStats(): Promise<{
  totalTrades: number
  liveTrades: number
  totalVolume: number
}> {
  const supabase = createServiceClient()
  const todayDate = getTodayDateET()

  const { data, error } = await supabase
    .from('whale_trades_daily' as any)
    .select('notional, is_live')
    .eq('trade_date', todayDate)

  if (error || !data) {
    console.error('[whale-trades-daily] Stats error:', error)
    return { totalTrades: 0, liveTrades: 0, totalVolume: 0 }
  }

  const totalTrades = data.length
  const liveTrades = data.filter((r: any) => r.is_live).length
  const totalVolume = data.reduce((sum: number, r: any) => sum + Number(r.notional || 0), 0)

  return { totalTrades, liveTrades, totalVolume }
}
