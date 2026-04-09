import { fetchOdds } from '@/lib/api/odds-api'
import { fetchTheOddsApiPlayerProps } from '@/lib/api/the-odds-api'
import { resolveOddsSourceKey } from '@/lib/config/odds-sources'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'
import { buildFinalPropOrderbookItems } from '@/lib/services/prop-orderbooks-selection'
import { KALSHI_BASE_CANDIDATES, withKalshiBase } from '@/lib/api/kalshi-base'
import { oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import { resolveOverUnderSide } from '@/lib/utils/props'
import type { Bookmaker, OddsGame } from '@/lib/types/odds'

const KALSHI_BASE = KALSHI_BASE_CANDIDATES[0] ?? 'https://api.elections.kalshi.com/trade-api/v2'
const POLYMARKET_BASE = 'https://gamma-api.polymarket.com'
const POLYMARKET_CLOB = 'https://clob.polymarket.com'
const POLYMARKET_GAMES_TAG_ID = '100639'

const PROP_ORDER_NOTIONAL_MIN = 500
const TEAM_ORDER_NOTIONAL_MIN = 2000
const TEAM_MARKET_LIQUIDITY_MAX = 14000
// Keep sharp props ingestion live-first; disable in-memory staleness caching.
const CACHE_TTL_MS = 0
const MAX_KALSHI_PAGES = 5
const MAX_POLYMARKET_MARKETS = 250
const MAX_POLYMARKET_ORDERBOOKS = 80
const POLYMARKET_SERIES_PAGE_LIMIT = 300
const MAX_POLYMARKET_SERIES_PAGES = 8
const MAX_POLYMARKET_EVENT_FETCHES = 6
const MAX_POLYMARKET_EVENT_MARKETS = 60
const POLYMARKET_COMPETITIVE_BAND_CENTS = 20
const MAX_POLYMARKET_COMPETITIVE_LEVELS = 25
const POLYMARKET_MIN_COMPETITIVE_PRICE_CENTS = 10
const POLYMARKET_MAX_COMPETITIVE_PRICE_CENTS = 90
const KALSHI_RETRY_ATTEMPTS = 3
const KALSHI_RETRY_BASE_DELAY_MS = 250
const US_MARKET_TIME_ZONE = 'America/New_York'
const US_MARKET_DAY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: US_MARKET_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const getUsMarketDayKey = (date = new Date()) => {
  try {
    const value = US_MARKET_DAY_FORMATTER.format(date)
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  } catch {}
  return date.toISOString().slice(0, 10)
}

type PropLiquiditySignal = {
  id: string
  source: 'kalshi' | 'polymarket'
  category: 'player_prop' | 'team_market'
  marketKey?: 'spreads' | 'totals' | 'h2h'
  sportKey: string
  sportLabel: string
  marketTitle: string
  outcome: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  propSide: 'Over' | 'Under' | null
  side: 'yes' | 'no' | null
  priceCents: number | null
  americanOdds: number | null
  liquidity: number
  timestamp: string
  eventDate?: string
  ticker?: string
  slug?: string
  outcomeIndex?: number
  edgePercent?: number | null
  sportsbookNoVigProb?: number | null
  sportsbookBestOdds?: number | null
  sportsbookBookKey?: string | null
  sportsbookBookTitle?: string | null
  sharpStrength: number
  reasons: Array<{ type: 'liquidity' | 'cross-market-ev'; description: string; value?: number }>
}

type KalshiMarket = {
  ticker: string
  title?: string
  yes_sub_title?: string
  no_sub_title?: string
  liquidity_dollars?: string
  liquidity?: number | string
}

type KalshiMarketResponse = {
  market?: {
    title?: string
    yes_sub_title?: string
    no_sub_title?: string
    yes_bid?: number
    yes_bid_dollars?: string
    no_bid?: number
    no_bid_dollars?: string
    yes_ask?: number
    yes_ask_dollars?: string
    no_ask?: number
    no_ask_dollars?: string
  }
}

type KalshiOrderbookResponse = {
  orderbook?: {
    yes?: unknown[]
    no?: unknown[]
  }
  orderbook_fp?: {
    yes_dollars?: unknown[]
    no_dollars?: unknown[]
  }
}

type PolymarketMarket = {
  id: string
  question?: string
  title?: string
  slug?: string
  outcomes?: string
  outcomePrices?: string
  clobTokenIds?: string
  sportsMarketType?: string
  line?: number
  acceptingOrders?: boolean
  bestAsk?: number
  bestBid?: number
  liquidityNum?: number
  liquidity?: string
  active?: boolean
  closed?: boolean
  events?: Array<{
    title?: string
    eventDate?: string
    gameStartTime?: string
    startTime?: string
    endDate?: string
    seriesSlug?: string
    series?: Array<{ slug?: string }>
    ended?: boolean
  }>
}

type PolymarketSeries = {
  id: string
  slug?: string
  ticker?: string
  title?: string
  active?: boolean
  closed?: boolean
}

type PolymarketSeriesDetail = PolymarketSeries & {
  events?: Array<{
    id: string
    title?: string
    slug?: string
    ticker?: string
    active?: boolean
    closed?: boolean
    eventDate?: string
    startTime?: string
  }>
}

type PolymarketEventDetail = {
  id: string
  title?: string
  slug?: string
  ticker?: string
  seriesSlug?: string
  eventDate?: string
  startTime?: string
  active?: boolean
  closed?: boolean
  markets?: PolymarketMarket[]
}

type PolymarketOrderbook = {
  bids?: Array<{ price: string; size: string }>
  asks?: Array<{ price: string; size: string }>
}

export type PropOrderbookLevel = {
  priceCents: number
  notional: number
}

export type PropOrderbookSide = {
  outcome: string
  propSide: 'Over' | 'Under' | null
  platformSide: 'yes' | 'no' | null
  levels: PropOrderbookLevel[]
  totalNotional: number

  // "Wall" = largest resting liquidity level in the displayed depth.
  wallPriceCents: number | null
  wallNotional: number | null
  wallAmericanOdds: number | null

  // OddsJam-style "sharp line" interpretation:
  // liquidity on one side at price P implies the opposite side at (100 - P).
  sharpLinePriceCents: number | null
  sharpLineAmericanOdds: number | null
}

export type PropOrderbookItem = {
  id: string
  source: 'kalshi' | 'polymarket' | 'novig' | 'prophetx'
  sportKey: string
  sportLabel: string
  matchup?: string
  marketTitle: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  eventDate?: string
  ticker?: string
  slug?: string
  sides: PropOrderbookSide[]
  sharpLiquiditySide: 'Over' | 'Under' | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: 'Over' | 'Under' | null
  sharpLeanAmericanOdds: number | null
  sharpLeanBestOdds: number | null
  sharpLeanBestBookTitle: string | null
  pinnacleLeanOdds: number | null
  pinnacleLeanBookTitle: string | null
  fanduelLeanOdds: number | null
  fanduelLeanBookTitle: string | null
  sportsbookOddsByBook?: Record<
    string,
    { over: number | null; under: number | null; title: string | null }
  >
  updatedAt: string
}

const DEFAULT_MAX_FAVORITE_ODDS = -200
const MAX_FAVORITE_ODDS_BY_SPORT: Partial<Record<string, number>> = {
  // MLB props are frequently juiced past -200 (especially 0.5 and combo lines).
  baseball_mlb: -500,
}

const passesFavoriteOddsGate = (odds: number | null, sportKey: string) => {
  if (odds == null || !Number.isFinite(odds)) return true
  const cap = MAX_FAVORITE_ODDS_BY_SPORT[sportKey] ?? DEFAULT_MAX_FAVORITE_ODDS
  return odds >= cap
}

const priceCentsToAmericanOdds = (priceCents: number | null) => {
  if (priceCents == null) return null
  const probability = priceCents / 100
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  return probabilityToAmericanOdds(probability)
}

type KalshiOrderSummary = {
  notional: number
  priceCents: number | null
}

type KalshiOrderbookSummary = {
  yes: KalshiOrderSummary[]
  no: KalshiOrderSummary[]
}

type SportsbookPropLine = {
  playerName: string
  propType: string
  line: number
  bestOverOdds: number | null
  bestUnderOdds: number | null
  bestOverBookTitle: string | null
  bestUnderBookTitle: string | null
  pinnacleOverOdds: number | null
  pinnacleUnderOdds: number | null
  pinnacleOverBookTitle: string | null
  pinnacleUnderBookTitle: string | null
  fanduelOverOdds: number | null
  fanduelUnderOdds: number | null
  fanduelOverBookTitle: string | null
  fanduelUnderBookTitle: string | null
  oddsByBook: Record<string, { over: number | null; under: number | null; title: string | null }>
  noVigOverProbs: number[]
  noVigUnderProbs: number[]
}

const KALSHI_PROP_SERIES = [
  { ticker: 'KXNBAPTS', propType: 'points', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAREB', propType: 'rebounds', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAAST', propType: 'assists', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBA3PT', propType: 'threes', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBABLK', propType: 'blocks', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBASTL', propType: 'steals', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNFLRSHYDS', propType: 'rushing_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLRECYDS', propType: 'receiving_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLPASSYDS', propType: 'passing_yards', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLPASSTDS', propType: 'passing_tds', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLREC', propType: 'receptions', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXMLBHIT', propType: 'hits', sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  { ticker: 'KXMLBTB', propType: 'total_bases', sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  { ticker: 'KXMLBKS', propType: 'strikeouts', sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  { ticker: 'KXMLBHR', propType: 'home_runs', sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  { ticker: 'KXMLBHRR', propType: 'hits_runs_rbis', sportKey: 'baseball_mlb', sportLabel: 'MLB' },
]

const KALSHI_TEAM_SERIES = [
  { ticker: 'KXNBASPREAD', marketKey: 'spreads', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBATOTAL', marketKey: 'totals', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNBAGAME', marketKey: 'h2h', sportKey: 'basketball_nba', sportLabel: 'NBA' },
  { ticker: 'KXNFLSPREAD', marketKey: 'spreads', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLTOTAL', marketKey: 'totals', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNFLGAME', marketKey: 'h2h', sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  { ticker: 'KXNCAAMBSPREAD', marketKey: 'spreads', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNCAAMBTOTAL', marketKey: 'totals', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNCAAMBGAME', marketKey: 'h2h', sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  { ticker: 'KXNHLSPREAD', marketKey: 'spreads', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  { ticker: 'KXNHLTOTAL', marketKey: 'totals', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  { ticker: 'KXNHLGAME', marketKey: 'h2h', sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
] as const

const POLYMARKET_SERIES_TO_SPORT_KEY: Record<string, { sportKey: string; sportLabel: string }> = {
  nba: { sportKey: 'basketball_nba', sportLabel: 'NBA' },
  'ncaa-cbb': { sportKey: 'basketball_ncaab', sportLabel: 'NCAAB' },
  nfl: { sportKey: 'americanfootball_nfl', sportLabel: 'NFL' },
  'ncaa-cfb': { sportKey: 'americanfootball_ncaaf', sportLabel: 'NCAAF' },
  mlb: { sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  baseball: { sportKey: 'baseball_mlb', sportLabel: 'MLB' },
  nhl: { sportKey: 'icehockey_nhl', sportLabel: 'NHL' },
  wnba: { sportKey: 'basketball_wnba', sportLabel: 'WNBA' },
}

const PROP_KEYWORDS: Record<string, Array<{ key: string; patterns: string[] }>> = {
  basketball_nba: [
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'rebounds', patterns: ['rebounds', 'rebs', 'reb'] },
    { key: 'assists', patterns: ['assists', 'ast'] },
    { key: 'threes', patterns: ['three', '3pt', '3-point', '3pointer'] },
    { key: 'blocks', patterns: ['blocks', 'blk'] },
    { key: 'steals', patterns: ['steals', 'stl'] },
  ],
  basketball_ncaab: [
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'rebounds', patterns: ['rebounds', 'rebs', 'reb'] },
    { key: 'assists', patterns: ['assists', 'ast'] },
  ],
  americanfootball_nfl: [
    { key: 'passing_yards', patterns: ['passing yards', 'pass yards', 'pass yds'] },
    { key: 'passing_tds', patterns: ['passing tds', 'passing touchdowns', 'pass tds', 'pass td'] },
    { key: 'rushing_yards', patterns: ['rushing yards', 'rush yards', 'rush yds'] },
    { key: 'rushing_tds', patterns: ['rushing tds', 'rushing touchdowns', 'rush tds', 'rush td'] },
    { key: 'rushing_attempts', patterns: ['rushing attempts', 'rush attempts', 'rush att', 'carries'] },
    { key: 'rushing_receiving_yards', patterns: ['rushing and receiving yards', 'rushing + receiving yards', 'rushing/receiving yards', 'rush+rec yards', 'scrimmage yards'] },
    { key: 'receiving_yards', patterns: ['receiving yards', 'rec yards', 'rec yds'] },
    { key: 'receptions', patterns: ['receptions', 'reception', 'catches', 'recs'] },
  ],
  americanfootball_ncaaf: [
    { key: 'passing_yards', patterns: ['passing yards', 'pass yards', 'pass yds'] },
    { key: 'passing_tds', patterns: ['passing tds', 'passing touchdowns', 'pass tds', 'pass td'] },
    { key: 'rushing_yards', patterns: ['rushing yards', 'rush yards', 'rush yds'] },
    { key: 'rushing_tds', patterns: ['rushing tds', 'rushing touchdowns', 'rush tds', 'rush td'] },
    { key: 'rushing_attempts', patterns: ['rushing attempts', 'rush attempts', 'rush att', 'carries'] },
    { key: 'rushing_receiving_yards', patterns: ['rushing and receiving yards', 'rushing + receiving yards', 'rushing/receiving yards', 'rush+rec yards', 'scrimmage yards'] },
    { key: 'receiving_yards', patterns: ['receiving yards', 'rec yards', 'rec yds'] },
    { key: 'receptions', patterns: ['receptions', 'reception', 'catches', 'recs'] },
  ],
  baseball_mlb: [
    { key: 'strikeouts', patterns: ['strikeouts', 'ks', 'k', 'strikeout'] },
    { key: 'hits', patterns: ['hits', 'hit'] },
    { key: 'hits_runs_rbis', patterns: ['hits + runs + rbis', 'hits+runs+rbis', 'hits runs rbis', 'hits + runs + rbi', 'hits+runs+rbi'] },
    { key: 'home_runs', patterns: ['home runs', 'home run', 'hr', 'homer'] },
    { key: 'rbis', patterns: ['rbis', 'rbi', 'runs batted in'] },
    { key: 'runs', patterns: ['runs scored', 'runs'] },
    { key: 'total_bases', patterns: ['total bases', 'tb'] },
    { key: 'walks', patterns: ['walks', 'bb', 'bases on balls'] },
    { key: 'pitcher_outs', patterns: ['outs recorded', 'outs', 'innings pitched'] },
    { key: 'hits_allowed', patterns: ['hits allowed'] },
    { key: 'earned_runs', patterns: ['earned runs', 'er'] },
  ],
  icehockey_nhl: [
    { key: 'goals', patterns: ['goals', 'goal', 'to score'] },
    { key: 'assists', patterns: ['assists', 'assist'] },
    { key: 'points', patterns: ['points', 'pts'] },
    { key: 'shots', patterns: ['shots on goal', 'shots', 'sog'] },
    { key: 'saves', patterns: ['saves', 'save'] },
    { key: 'blocked_shots', patterns: ['blocked shots', 'blocks', 'blocked'] },
  ],
}

type ExchangeSportKey =
  | 'basketball_nba'
  | 'basketball_ncaab'
  | 'americanfootball_nfl'
  | 'baseball_mlb'
  | 'icehockey_nhl'

const EXCHANGE_PROP_MARKETS: Record<ExchangeSportKey, string[]> = {
  basketball_nba: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    'player_rebounds_assists',
    'player_blocks',
    'player_steals',
    'player_turnovers',
  ],
  basketball_ncaab: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    'player_rebounds_assists',
  ],
  americanfootball_nfl: [
    'player_pass_yds',
    'player_pass_tds',
    'player_pass_completions',
    'player_pass_attempts',
    'player_interceptions',
    'player_rush_yds',
    'player_rush_tds',
    'player_receptions',
    'player_reception_yds',
    'player_receiving_tds',
    'player_longest_reception',
    'player_longest_rush',
  ],
  baseball_mlb: [
    'player_hits',
    'player_total_bases',
    'player_home_runs',
    'player_rbis',
    'player_runs_scored',
    'player_hits_runs_rbis',
    'player_strikeouts',
    'player_walks',
  ],
  icehockey_nhl: [
    'player_points',
    'player_goals',
    'player_assists',
    'player_shots_on_goal',
    'player_blocked_shots',
    'player_total_saves',
  ],
}

const EXCHANGE_BOOKMAKERS = ['novig', 'prophetx'] as const

const EXCHANGE_SOURCE_LABELS: Record<'novig' | 'prophetx', string> = {
  novig: 'NoVig',
  prophetx: 'ProphetX',
}
const EXCHANGE_SPORT_LABELS: Record<ExchangeSportKey, string> = {
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  americanfootball_nfl: 'NFL',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
}

const MARKET_KEY_TO_PROP_TYPE: Record<string, string> = {
  player_points: 'points',
  player_rebounds: 'rebounds',
  player_assists: 'assists',
  player_threes: 'threes',
  player_points_rebounds_assists: 'points_rebounds_assists',
  player_points_rebounds: 'points_rebounds',
  player_points_assists: 'points_assists',
  player_rebounds_assists: 'rebounds_assists',
  player_blocks: 'blocks',
  player_steals: 'steals',
  player_turnovers: 'turnovers',
  player_pass_yds: 'passing_yards',
  player_pass_tds: 'passing_tds',
  player_pass_completions: 'pass_completions',
  player_pass_attempts: 'pass_attempts',
  player_interceptions: 'interceptions',
  player_rush_yds: 'rushing_yards',
  player_rush_tds: 'rushing_tds',
  player_receptions: 'receptions',
  player_reception_yds: 'receiving_yards',
  player_receiving_tds: 'receiving_tds',
  player_longest_reception: 'longest_reception',
  player_longest_rush: 'longest_rush',
  player_goals: 'goals',
  player_shots_on_goal: 'shots',
  player_blocked_shots: 'blocked_shots',
  player_total_saves: 'saves',
  player_saves: 'saves',
  player_hits: 'hits',
  player_total_bases: 'total_bases',
  player_home_runs: 'home_runs',
  player_rbis: 'rbis',
  player_runs_scored: 'runs',
  player_hits_runs_rbis: 'hits_runs_rbis',
  player_strikeouts: 'strikeouts',
  player_walks: 'walks',
}

const SUPPORTED_TEAM_SPORTS = new Set([
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'icehockey_nhl',
])

const TEAM_LOOKUP = new Map<string, string>()
for (const team of TEAMS_REGISTRY) {
  if (!SUPPORTED_TEAM_SPORTS.has(team.sport)) continue
  const key = `${team.sport}:${team.abbreviation.toUpperCase()}`
  TEAM_LOOKUP.set(key, team.name)
}

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const fetchKalshiJson = async <T,>(url: string): Promise<T | null> => {
  const candidateUrls = KALSHI_BASE_CANDIDATES.map((base) => withKalshiBase(base, url))

  for (const candidateUrl of candidateUrls) {
    for (let attempt = 0; attempt <= KALSHI_RETRY_ATTEMPTS; attempt += 1) {
      let res: Response
      try {
        res = await fetch(candidateUrl, { cache: 'no-store' })
      } catch {
        if (attempt < KALSHI_RETRY_ATTEMPTS) {
          await sleep(KALSHI_RETRY_BASE_DELAY_MS * (attempt + 1))
          continue
        }
        break
      }

      if (res.ok) {
        try {
          return (await res.json()) as T
        } catch {
          return null
        }
      }

      const canRetry =
        (res.status === 429 || res.status >= 500) && attempt < KALSHI_RETRY_ATTEMPTS
      if (!canRetry) break
      const waitMs = KALSHI_RETRY_BASE_DELAY_MS * (attempt + 1)
      await sleep(waitMs)
    }
  }
  return null
}

const normalizePlayerName = (name: string): string =>
  name
    .toLowerCase()
    .replace(/['.]/g, '')
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

const resolvePropType = (text: string, sportKey: string) => {
  const patterns = PROP_KEYWORDS[sportKey] ?? []
  for (const entry of patterns) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      return entry.key
    }
  }
  return null
}

const resolvePropSide = (text: string, rawText?: string | null, tradeSide?: string | null) =>
  resolveOverUnderSide(text, rawText, tradeSide)

const resolvePropLine = (text: string, propType: string | null, rawText?: string | null) => {
  if (!propType) return null
  const searchText = rawText?.toLowerCase() ?? text
  const overUnderMatch = searchText.match(/\b(?:over|under)\s+(-?\d+(?:\.\d+)?)/)
  if (overUnderMatch) {
    const value = Number(overUnderMatch[1])
    return Number.isFinite(value) ? value : null
  }
  const propPattern = propType.replace('_', ' ')
  const beforeMatch = searchText.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\+?\\s+${propPattern}`)
  )
  if (beforeMatch) {
    const value = Number(beforeMatch[1])
    return Number.isFinite(value) ? value : null
  }
  const afterMatch = searchText.match(
    new RegExp(`${propPattern}[^\\d]{0,6}(\\d+(?:\\.\\d+)?)`)
  )
  if (afterMatch) {
    const value = Number(afterMatch[1])
    return Number.isFinite(value) ? value : null
  }
  return null
}

const NAME_NOISE_PATTERN = new RegExp(
  '\\b(over|under|rushing|passing|receiving|yards?|yds?|touchdowns?|tds?|receptions?|catches|attempts?|completions?|interceptions?|points?|rebounds?|assists?|blocks?|steals?|threes?|three|three-point|3pt|3-point|line|total|team|anytime|to|score|will)\\b',
  'gi'
)

const extractPlayerNameFromText = (rawText: string) => {
  const cleaned = rawText
    .replace(NAME_NOISE_PATTERN, ' ')
    .replace(/[0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return null
  const nameToken = "[A-Z][A-Za-z'\\.-]+"
  const titleMatch = cleaned.match(
    new RegExp(`\\b(${nameToken}(?:\\s+${nameToken}){1,2})\\b`)
  )
  if (titleMatch?.[1]) {
    return titleMatch[1].trim()
  }
  const upperMatch = cleaned.match(/\b([A-Z]{2,}(?:\s+[A-Z]{2,}){1,2})\b/)
  if (upperMatch?.[1]) {
    const normalized = upperMatch[1]
      .toLowerCase()
      .split(' ')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
    return normalized.trim()
  }
  return null
}

const parsePlayerNameFromKalshiTitle = (title?: string | null) => {
  if (!title) return null
  const colonMatch = title.match(/^([^:]+):/)
  if (colonMatch?.[1]) return colonMatch[1].trim()
  const recordMatch = title.match(
    /^([A-Za-z\s.'-]+?)(?:\s+(?:records|scores|to score)\b)/i
  )
  if (recordMatch?.[1]) return recordMatch[1].trim()
  return null
}

const parseLineFromTicker = (ticker: string) => {
  const parts = ticker.split('-')
  if (parts.length < 4) return null
  const line = parseInt(parts[parts.length - 1], 10)
  return Number.isFinite(line) ? line : null
}

const parseLineFromTitle = (title?: string | null) => {
  if (!title) return null
  const match = title.match(/(\d+(?:\.\d+)?)/)
  if (!match) return null
  const value = Number(match[1])
  return Number.isFinite(value) ? value : null
}

const parseKalshiDate = (ticker: string) => {
  const match = ticker.match(/-(\d{2})([A-Z]{3})(\d{2})/)
  if (!match) return null
  const months: Record<string, string> = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  }
  const [, yy, mon, dd] = match
  const month = months[mon]
  if (!month) return null
  return `20${yy}-${month}-${dd}`
}

const parseTeamsFromTicker = (ticker: string) => {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{2,4})([A-Z]{2,4})-/)
  if (!match) return null
  return { awayCode: match[1], homeCode: match[2] }
}

const parseCombinedTeamCodesFromTicker = (ticker: string) => {
  const match = ticker.match(/-\d{2}[A-Z]{3}\d{2}([A-Z]{4,8})-/)
  return match?.[1] ?? null
}

const splitCombinedTeamCodes = (sportKey: string, combined: string) => {
  const normalized = combined.toUpperCase()
  const preferredSplits = [3, 2, 4]
  const dynamicSplits: number[] = []
  for (let i = 2; i <= normalized.length - 2; i += 1) {
    if (!preferredSplits.includes(i)) dynamicSplits.push(i)
  }

  for (const splitIndex of [...preferredSplits, ...dynamicSplits]) {
    if (splitIndex <= 1 || splitIndex >= normalized.length - 1) continue
    const awayCode = normalized.slice(0, splitIndex)
    const homeCode = normalized.slice(splitIndex)
    if (awayCode.length < 2 || awayCode.length > 4) continue
    if (homeCode.length < 2 || homeCode.length > 4) continue
    if (
      TEAM_LOOKUP.has(`${sportKey}:${awayCode}`) &&
      TEAM_LOOKUP.has(`${sportKey}:${homeCode}`)
    ) {
      return { awayCode, homeCode }
    }
  }

  return null
}

const parseTeamCodeFromTicker = (ticker: string) => {
  const lastSegment = ticker.split('-').pop() ?? ''
  const match = lastSegment.match(/^([A-Z]{2,4})/)
  return match?.[1] ?? null
}

const resolveTeamNameFromCode = (sportKey: string, code: string | null) => {
  if (!code) return null
  return TEAM_LOOKUP.get(`${sportKey}:${code}`) ?? null
}

const resolveMatchupLabel = (
  sportKey: string,
  awayCode: string | null,
  homeCode: string | null
) => {
  if (!awayCode || !homeCode) return null
  const awayLabel = resolveTeamNameFromCode(sportKey, awayCode) ?? awayCode
  const homeLabel = resolveTeamNameFromCode(sportKey, homeCode) ?? homeCode
  return `${awayLabel} @ ${homeLabel}`
}

const resolveKalshiMatchup = (sportKey: string, ticker: string) => {
  const direct = parseTeamsFromTicker(ticker)
  const directMatchup = resolveMatchupLabel(sportKey, direct?.awayCode ?? null, direct?.homeCode ?? null)
  if (directMatchup) return directMatchup

  const combined = parseCombinedTeamCodesFromTicker(ticker)
  if (!combined) return null
  const split = splitCombinedTeamCodes(sportKey, combined)
  if (!split) return null
  return resolveMatchupLabel(sportKey, split.awayCode, split.homeCode)
}

const normalizePriceCents = (value: number) => (value <= 1 ? value * 100 : value)

const formatAmericanOdds = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return null
  const rounded = Math.round(value)
  return rounded >= 0 ? `+${rounded}` : `${rounded}`
}

const parseKalshiOrders = (levels: number[][]): KalshiOrderSummary[] => {
  const orders: KalshiOrderSummary[] = []
  for (const level of levels) {
    const priceRaw = Number(level?.[0])
    const size = Number(level?.[1])
    if (!Number.isFinite(priceRaw) || !Number.isFinite(size)) continue
    const priceCents = normalizePriceCents(priceRaw)
    const notional = (priceCents / 100) * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    orders.push({ notional, priceCents })
  }
  return orders
}

const sumOrderNotional = (orders: KalshiOrderSummary[]) =>
  orders.reduce((sum, order) => sum + order.notional, 0)

const resolveBestPriceOrder = (orders: KalshiOrderSummary[], minNotional: number) => {
  let best: KalshiOrderSummary | null = null
  for (const order of orders) {
    if (order.notional < minNotional) continue
    if (!best || (order.priceCents ?? 0) > (best.priceCents ?? 0)) {
      best = order
    }
  }
  return best
}

const resolveDominantOrder = (
  orders: KalshiOrderSummary[],
  minNotional: number,
  totalMarketLiquidity: number
) => {
  const total = totalMarketLiquidity
  if (!total) return null
  let best: KalshiOrderSummary | null = null
  for (const order of orders) {
    if (order.notional < minNotional) continue
    if (order.notional < total * 0.5) continue
    if (!best || (order.priceCents ?? 0) > (best.priceCents ?? 0)) {
      best = order
    }
  }
  return best
}

const fetchKalshiMarketDetails = async (ticker: string) => {
  const data = await fetchKalshiJson<KalshiMarketResponse>(`${KALSHI_BASE}/markets/${ticker}`)
  if (!data) return null
  return data.market ?? null
}

const fetchKalshiOrderbookSummary = async (
  ticker: string
): Promise<KalshiOrderbookSummary | null> => {
  const url = new URL(`${KALSHI_BASE}/markets/${ticker}/orderbook`)
  url.searchParams.set('depth', '5')
  const data = await fetchKalshiJson<KalshiOrderbookResponse>(
    url.toString()
  )
  if (!data) return null
  const { yes, no } = extractKalshiOrderbookLevels(data)
  return {
    yes: parseKalshiOrders(yes),
    no: parseKalshiOrders(no),
  }
}

const fetchKalshiPropMarkets = async (
  seriesTicker: string,
  maxPages: number = MAX_KALSHI_PAGES
) => {
  const markets: KalshiMarket[] = []
  let cursor: string | null = null
  for (let page = 0; page < maxPages; page += 1) {
    const url = new URL(`${KALSHI_BASE}/markets`)
    url.searchParams.set('series_ticker', seriesTicker)
    url.searchParams.set('limit', '500')
    if (cursor) url.searchParams.set('cursor', cursor)
    const data = await fetchKalshiJson<{ markets?: KalshiMarket[]; cursor?: string | null }>(
      url.toString()
    )
    if (!data) break
    const batch = Array.isArray(data?.markets) ? data.markets : []
    if (batch.length === 0) break
    markets.push(...batch)
    cursor = data?.cursor ?? null
    if (!cursor) break
  }
  return markets
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

const resolvePolymarketEventDate = (market: PolymarketMarket) => {
  const event = market.events?.[0]
  const raw =
    event?.eventDate ||
    event?.gameStartTime ||
    event?.startTime ||
    event?.endDate ||
    null
  if (!raw) return null
  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

const resolvePolymarketSport = (market: PolymarketMarket) => {
  const event = market.events?.[0]
  const seriesSlug = event?.seriesSlug || event?.series?.[0]?.slug || null
  if (!seriesSlug) return null

  const exact = POLYMARKET_SERIES_TO_SPORT_KEY[seriesSlug]
  if (exact) return exact

  // Polymarket sports series slugs often include seasons, e.g. "nba-2026".
  // We treat any slug prefixed by a known series key as the same sport.
  for (const key of Object.keys(POLYMARKET_SERIES_TO_SPORT_KEY)) {
    if (seriesSlug === key || seriesSlug.startsWith(`${key}-`)) {
      return POLYMARKET_SERIES_TO_SPORT_KEY[key]
    }
  }

  return null
}

const resolvePolymarketMatchup = (market: PolymarketMarket) => {
  const event = market.events?.[0]
  const eventTitle = String(event?.title ?? '').trim()
  if (eventTitle) return eventTitle

  const raw = String(market.question || market.title || '').trim()
  if (!raw) return null

  const vsMatch = raw.match(/\bin\s+(.+?\s+vs\.?\s+.+?)(?:\s+game|[?.]|$)/i)
  if (vsMatch?.[1]) return vsMatch[1].trim()

  const atMatch = raw.match(/\bin\s+(.+?\s+@\s+.+?)(?:\s+game|[?.]|$)/i)
  if (atMatch?.[1]) return atMatch[1].trim()

  return null
}

const fetchPolymarketOrderbook = async (tokenId: string): Promise<PolymarketOrderbook | null> => {
  const url = new URL(`${POLYMARKET_CLOB}/book`)
  url.searchParams.set('token_id', tokenId)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as PolymarketOrderbook
  return data
}

const fetchPolymarketSeriesIndex = async () => {
  const results: PolymarketSeries[] = []
  for (let page = 0; page < MAX_POLYMARKET_SERIES_PAGES; page += 1) {
    const url = new URL(`${POLYMARKET_BASE}/series`)
    url.searchParams.set('active', 'true')
    url.searchParams.set('closed', 'false')
    url.searchParams.set('limit', String(POLYMARKET_SERIES_PAGE_LIMIT))
    url.searchParams.set('offset', String(page * POLYMARKET_SERIES_PAGE_LIMIT))
    const res = await fetch(url.toString(), { cache: 'no-store' })
    if (!res.ok) break
    const batch = (await res.json()) as PolymarketSeries[]
    if (!Array.isArray(batch) || batch.length === 0) break
    results.push(...batch)
    if (batch.length < POLYMARKET_SERIES_PAGE_LIMIT) break
  }
  return results
}

const resolveBestPolymarketSeries = (
  series: PolymarketSeries[],
  baseSlug: string
) => {
  const normalized = baseSlug.toLowerCase()
  const candidates = series.filter((entry) => {
    const slug = String(entry.slug || entry.ticker || '').toLowerCase()
    return slug === normalized || slug.startsWith(`${normalized}-`)
  })

  if (candidates.length === 0) return null

  const parseYear = (slug: string) => {
    const match = slug.match(/-(\d{4})$/)
    if (!match) return null
    const year = Number(match[1])
    return Number.isFinite(year) ? year : null
  }

  const withYear = candidates
    .map((entry) => {
      const slug = String(entry.slug || entry.ticker || '')
      return { entry, year: parseYear(slug) }
    })
    .filter((item) => item.year != null)
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))

  return withYear[0]?.entry ?? candidates[0]
}

const resolvePolymarketSportsMarketTypes = (sportKey: string | 'all') => {
  if (sportKey === 'all') {
    return ['points', 'assists', 'rebounds']
  }

  if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
    return ['points', 'assists', 'rebounds']
  }

  return []
}

const fetchPolymarketSeriesDetail = async (id: string) => {
  const res = await fetch(`${POLYMARKET_BASE}/series/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as PolymarketSeriesDetail
  return data
}

const fetchPolymarketEventDetail = async (id: string) => {
  const res = await fetch(`${POLYMARKET_BASE}/events/${id}`, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as PolymarketEventDetail
  return data
}

const isPlayerPropQuestion = (question: string) => {
  const trimmed = question.trim()
  if (!trimmed) return false
  if (/^(spread|total|moneyline|1h\s+spread|1h\s+o\/?u|o\/?u)\s*:/i.test(trimmed)) {
    return false
  }
  // Common "Player Name: Stat Over X" shape.
  if (/^[A-Za-z][A-Za-z'.-]+(?:\s+[A-Za-z][A-Za-z'.-]+){0,2}\s*:\s*/.test(trimmed)) {
    return true
  }
  // Fallback for "Player Name over 15.5 points" style prompts.
  return (
    /\b[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,2}\b/.test(trimmed) &&
    /\b(over|under)\b/i.test(trimmed) &&
    /\d+(?:\.\d+)?/.test(trimmed)
  )
}

const resolveSportMetaFromSeriesSlug = (seriesSlug: string | null) => {
  if (!seriesSlug) return null
  const base = seriesSlug.split('-')[0]
  return POLYMARKET_SERIES_TO_SPORT_KEY[base] ?? null
}

const parsePolymarketOrders = (book: PolymarketOrderbook): KalshiOrderSummary[] => {
  const bids = Array.isArray(book.bids) ? book.bids : []
  const orders: KalshiOrderSummary[] = []
  for (const level of bids) {
    const price = Number(level.price)
    const size = Number(level.size)
    if (!Number.isFinite(price) || !Number.isFinite(size)) continue
    const notional = price * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    orders.push({ notional, priceCents: Math.round(price * 100) })
  }
  return orders
}

const parsePolymarketLevels = (book: PolymarketOrderbook): PropOrderbookLevel[] => {
  const parseEntries = (
    entries: Array<{ price: string; size: string }> | undefined
  ): PropOrderbookLevel[] => {
    if (!Array.isArray(entries)) return []
    const parsed: PropOrderbookLevel[] = []
    for (const level of entries) {
      const price = Number(level.price)
      const size = Number(level.size)
      if (!Number.isFinite(price) || !Number.isFinite(size)) continue
      const notional = price * size
      if (!Number.isFinite(notional) || notional <= 0) continue
      const rawCents = Math.round(price * 100)
      // Clamp to (0, 100) so we can always compute American odds + complements.
      const priceCents = Math.max(1, Math.min(99, rawCents))
      // Ignore deep edge quotes (near 0/1) that are commonly parked and non-actionable.
      if (
        priceCents < POLYMARKET_MIN_COMPETITIVE_PRICE_CENTS ||
        priceCents > POLYMARKET_MAX_COMPETITIVE_PRICE_CENTS
      ) {
        continue
      }
      parsed.push({ priceCents, notional })
    }
    return parsed
  }

  const pickCompetitiveWindow = (
    levels: PropOrderbookLevel[],
    side: 'ask' | 'bid'
  ): PropOrderbookLevel[] => {
    if (!levels.length) return []
    const byPrice = [...levels].sort((a, b) =>
      side === 'ask' ? a.priceCents - b.priceCents : b.priceCents - a.priceCents
    )
    const best = byPrice[0]?.priceCents ?? null
    if (best == null) return byPrice.slice(0, MAX_POLYMARKET_COMPETITIVE_LEVELS)
    const inBand = byPrice.filter((level) =>
      side === 'ask'
        ? level.priceCents <= best + POLYMARKET_COMPETITIVE_BAND_CENTS
        : level.priceCents >= best - POLYMARKET_COMPETITIVE_BAND_CENTS
    )
    return (inBand.length ? inBand : byPrice).slice(0, MAX_POLYMARKET_COMPETITIVE_LEVELS)
  }

  // For Polymarket, actionable liquidity to buy a token is on the ask side.
  // We keep only price-competitive asks to avoid deep, non-actionable parked quotes.
  const askLevels = pickCompetitiveWindow(parseEntries(book.asks), 'ask')
  if (askLevels.length) return askLevels

  // Fallback to bids if asks are empty.
  return pickCompetitiveWindow(parseEntries(book.bids), 'bid')
}

const parseKalshiLevels = (levels: number[][]): PropOrderbookLevel[] => {
  const parsed: PropOrderbookLevel[] = []
  for (const level of levels) {
    const priceRaw = Number(level?.[0])
    const size = Number(level?.[1])
    if (!Number.isFinite(priceRaw) || !Number.isFinite(size)) continue
    const priceCents = normalizePriceCents(priceRaw)
    // 0c/100c levels are effectively locked outcomes and not actionable quotes.
    // Skip them so displayed side odds reflect tradable prices.
    if (priceCents <= 0 || priceCents >= 100) continue
    const notional = (priceCents / 100) * size
    if (!Number.isFinite(notional) || notional <= 0) continue
    parsed.push({ priceCents, notional })
  }
  return parsed
}

const parseKalshiLevelRows = (rows: unknown): number[][] => {
  if (!Array.isArray(rows)) return []
  const parsed: number[][] = []
  for (const row of rows) {
    if (!Array.isArray(row) || row.length < 2) continue
    const price = Number(row[0])
    const size = Number(row[1])
    if (!Number.isFinite(price) || !Number.isFinite(size)) continue
    parsed.push([price, size])
  }
  return parsed
}

const extractKalshiOrderbookLevels = (payload: KalshiOrderbookResponse) => {
  const yesLegacy = parseKalshiLevelRows(payload.orderbook?.yes)
  const noLegacy = parseKalshiLevelRows(payload.orderbook?.no)
  if (yesLegacy.length || noLegacy.length) {
    return { yes: yesLegacy, no: noLegacy }
  }

  return {
    yes: parseKalshiLevelRows(payload.orderbook_fp?.yes_dollars),
    no: parseKalshiLevelRows(payload.orderbook_fp?.no_dollars),
  }
}

const summarizeSide = (
  outcome: string,
  propSide: 'Over' | 'Under' | null,
  platformSide: 'yes' | 'no' | null,
  levels: PropOrderbookLevel[],
  minSharpNotional: number,
  depth: number
): PropOrderbookSide => {
  const byNotional = [...levels].sort((a, b) => b.notional - a.notional)
  const trimmed = byNotional.slice(0, depth)
  const totalNotional = levels.reduce((sum, level) => sum + level.notional, 0)
  const wall = trimmed[0] ?? null
  const wallPriceCents = wall?.priceCents ?? null
  const wallNotional = wall?.notional ?? null
  const wallAmericanOdds = priceCentsToAmericanOdds(wallPriceCents)

  const sharpLinePriceCents =
    wallPriceCents != null ? Math.max(0, Math.min(100, 100 - wallPriceCents)) : null
  const sharpLineAmericanOdds = priceCentsToAmericanOdds(sharpLinePriceCents)

  return {
    outcome,
    propSide,
    platformSide,
    levels: trimmed,
    totalNotional,
    wallPriceCents,
    wallNotional,
    wallAmericanOdds,
    sharpLinePriceCents,
    sharpLineAmericanOdds,
  }
}

type SharpLeanInterpretation = 'complement' | 'direct'

const resolveSharpLean = (
  sides: PropOrderbookSide[],
  minSharpNotional: number,
  opts?: { interpretation?: SharpLeanInterpretation }
): {
  sharpLiquiditySide: 'Over' | 'Under' | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: 'Over' | 'Under' | null
  sharpLeanAmericanOdds: number | null
} => {
  const interpretation = opts?.interpretation ?? 'complement'
  const byLiquidity = sides
    .filter((side) => side.propSide && (side.wallNotional ?? 0) > 0)
  const eligible = byLiquidity.filter((side) => (side.wallNotional ?? 0) >= minSharpNotional)

  if (!byLiquidity.length) {
    return {
      sharpLiquiditySide: null,
      sharpLiquidityNotional: null,
      sharpOrderAmericanOdds: null,
      sharpLeanSide: null,
      sharpLeanAmericanOdds: null,
    }
  }

  const resolveSideLevelOdds = (
    side: PropOrderbookSide | null,
    mode: 'direct' | 'sharp'
  ): number | null => {
    if (!side) return null
    for (const level of side.levels) {
      const cents =
        mode === 'direct'
          ? level.priceCents
          : Math.max(0, Math.min(100, 100 - level.priceCents))
      const odds = priceCentsToAmericanOdds(cents)
      if (odds != null) return odds
    }
    return null
  }

  const candidates = eligible.length ? eligible : byLiquidity
  const best = [...candidates].sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))[0]
  const sharpLiquiditySide = best.propSide as 'Over' | 'Under'
  const sharpLiquidityNotional = best.wallNotional ?? null
  const sharpOrderAmericanOdds = best.wallAmericanOdds ?? resolveSideLevelOdds(best, 'direct')

  const sharpLeanSide: 'Over' | 'Under' =
    interpretation === 'complement'
      ? sharpLiquiditySide === 'Over'
        ? 'Under'
        : 'Over'
      : sharpLiquiditySide
  const oppositeSide =
    sides.find((side) => side.propSide != null && side.propSide === sharpLeanSide) ?? null
  const sharpLeanAmericanOdds =
    interpretation === 'complement'
      ? best.sharpLineAmericanOdds ??
        oppositeSide?.wallAmericanOdds ??
        resolveSideLevelOdds(best, 'sharp') ??
        resolveSideLevelOdds(oppositeSide, 'direct')
      : sharpOrderAmericanOdds ??
        resolveSideLevelOdds(best, 'direct') ??
        oppositeSide?.sharpLineAmericanOdds ??
        resolveSideLevelOdds(oppositeSide, 'sharp')

  return {
    sharpLiquiditySide,
    sharpLiquidityNotional,
    sharpOrderAmericanOdds,
    sharpLeanSide,
    sharpLeanAmericanOdds,
  }
}

const resolveExchangeSource = (
  bookKey?: string | null,
  bookTitle?: string | null
): 'novig' | 'prophetx' | null => {
  const key = String(bookKey ?? '').toLowerCase()
  const title = String(bookTitle ?? '').toLowerCase()
  const combined = `${key} ${title}`
  if (combined.includes('novig')) return 'novig'
  if (combined.includes('prophetx') || combined.includes('prophet x')) return 'prophetx'
  return null
}

const resolveOverUnderFromOutcomeName = (value: string): 'Over' | 'Under' | null => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  if (normalized === 'over' || normalized.startsWith('over ')) return 'Over'
  if (normalized === 'under' || normalized.startsWith('under ')) return 'Under'
  return null
}

const resolveOverUnderFromOutcome = (
  outcome: Record<string, unknown>
): 'Over' | 'Under' | null => {
  const name = String(outcome?.name ?? '')
  const description = String(outcome?.description ?? '')
  return (
    resolveOverUnderFromOutcomeName(name) ??
    resolveOverUnderFromOutcomeName(description) ??
    null
  )
}

const resolveExchangeOutcomePlayerName = (
  outcome: Record<string, unknown>,
  side: 'Over' | 'Under' | null
) => {
  const rawName = String(outcome?.name ?? '').trim()
  const rawDescription = String(outcome?.description ?? '').trim()

  const nameSide = resolveOverUnderFromOutcomeName(rawName)
  const descriptionSide = resolveOverUnderFromOutcomeName(rawDescription)

  if (nameSide && !descriptionSide && rawDescription) return rawDescription
  if (descriptionSide && !nameSide && rawName) return rawName

  return (
    rawDescription ||
    extractPlayerNameFromText(rawName) ||
    extractPlayerNameFromText(rawDescription) ||
    (side ? extractPlayerNameFromText(`${rawName} ${rawDescription}`) : null)
  )
}

const resolveExchangeOutcomeLine = (outcome: Record<string, unknown>) => {
  const direct = parseOptionalNumber(outcome?.point)
  if (direct != null) return direct

  const combined = `${String(outcome?.name ?? '')} ${String(outcome?.description ?? '')}`.toLowerCase()
  const overUnderMatch = combined.match(/\b(?:over|under)\s+(-?\d+(?:\.\d+)?)/)
  if (overUnderMatch?.[1]) {
    const parsed = Number(overUnderMatch[1])
    if (Number.isFinite(parsed)) return parsed
  }

  return null
}

const parseOptionalNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^0-9.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

const isPredictionMarketBookFromOddsApi = (book: { key?: string | null; title?: string | null }) => {
  const normalized = `${book?.key ?? ''} ${book?.title ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return normalized.includes('kalshi') || normalized.includes('polymarket')
}

const oddsToPriceCents = (odds: number): number | null => {
  if (!Number.isFinite(odds)) return null
  const implied = oddsToImpliedProbability(odds)
  if (!Number.isFinite(implied) || implied <= 0 || implied >= 1) return null
  return Math.max(1, Math.min(99, Math.round(implied * 100)))
}

const resolveExchangeOutcomeNotional = (
  outcome: Record<string, unknown>,
  market: Record<string, unknown>,
  bookmaker: Record<string, unknown>
) => {
  const candidates: unknown[] = [
    outcome.bet_limit,
    outcome.betLimit,
    outcome.limit,
    outcome.max,
    outcome.max_limit,
    (outcome.limits as any)?.max,
    (outcome.limits as any)?.bet_limit,
    market.bet_limit,
    market.betLimit,
    market.limit,
    market.max,
    bookmaker.bet_limit,
    bookmaker.betLimit,
    bookmaker.limit,
    bookmaker.max,
  ]

  for (const candidate of candidates) {
    const parsed = parseOptionalNumber(candidate)
    if (parsed != null && parsed > 0) return parsed
  }
  return null
}

const resolvePropTypeFromMarketKey = (marketKey: string) => {
  if (!marketKey) return null
  return MARKET_KEY_TO_PROP_TYPE[marketKey] ?? marketKey.replace(/^player_/, '')
}

const isPinnacleBook = (book: any) => {
  const normalized = `${book?.key ?? ''} ${book?.name ?? ''} ${book?.title ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return normalized.includes('pinnacle')
}

const isFanDuelBook = (book: any) => {
  const normalized = `${book?.key ?? ''} ${book?.name ?? ''} ${book?.title ?? ''}`
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return normalized.includes('fanduel')
}

const resolveEventDate = (commenceTime: string | null | undefined) => {
  const raw = String(commenceTime ?? '').trim()
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isFinite(parsed.getTime())) {
    return getUsMarketDayKey(parsed)
  }

  const match = raw.match(/^\d{4}-\d{2}-\d{2}/)
  return match ? match[0] : null
}

const fetchExchangePropOrderbookItems = async (opts: {
  sportFilter: string | 'all'
  today: string
  depth: number
  minSharpNotional: number
  updatedAt: string
  limit: number
}) => {
  const { sportFilter, today, depth, minSharpNotional, updatedAt, limit } = opts
  const selectedSports: ExchangeSportKey[] =
    sportFilter === 'all'
      ? (Object.keys(EXCHANGE_PROP_MARKETS) as ExchangeSportKey[])
      : (sportFilter in EXCHANGE_PROP_MARKETS
          ? [sportFilter as ExchangeSportKey]
          : [])
  const perSportLimit =
    sportFilter === 'all' && selectedSports.length > 0
      ? Math.max(Math.ceil(limit / selectedSports.length), 40)
      : limit

  const items: PropOrderbookItem[] = []

  for (const sportKey of selectedSports) {
    const sportStartCount = items.length
    const reachedSportLimit = () =>
      sportFilter === 'all' && items.length - sportStartCount >= perSportLimit
    if (items.length >= limit) break

    const markets = EXCHANGE_PROP_MARKETS[sportKey]
    if (!markets?.length) continue

    let events: Array<{
      id: string
      commence_time?: string
      home_team?: string
      away_team?: string
      bookmakers?: Array<{
        key?: string
        title?: string
        markets?: Array<{
          key?: string
          outcomes?: Array<Record<string, unknown>>
        }>
      }>
    }> = []

    try {
      events = await fetchTheOddsApiPlayerProps(sportKey, {
        markets: markets.join(','),
        regions: 'us_ex,us,us2,eu',
        bookmakers: [...EXCHANGE_BOOKMAKERS],
        oddsFormat: 'american',
        dateFormat: 'iso',
        includeBetLimits: true,
      })
    } catch (error) {
      console.warn(`[prop-orderbooks] exchange fetch failed for ${sportKey}:`, error)
      continue
    }

    for (const event of events) {
      if (reachedSportLimit()) break
      if (items.length >= limit) break
      const eventDate = resolveEventDate(event?.commence_time)
      if (!eventDate || eventDate < today) continue
      const gameLabel = `${event?.away_team ?? 'Away'} @ ${event?.home_team ?? 'Home'}`

      for (const bookmaker of event.bookmakers ?? []) {
        if (reachedSportLimit()) break
        if (items.length >= limit) break
        const source = resolveExchangeSource(bookmaker?.key, bookmaker?.title)
        if (!source) continue

        type ExchangeRow = {
          playerName: string
          propType: string
          propLine: number
          eventDate: string
          matchup: string
          marketTitle: string
          over: { odds: number; priceCents: number; notional: number } | null
          under: { odds: number; priceCents: number; notional: number } | null
        }

        const rows = new Map<string, ExchangeRow>()

        for (const market of bookmaker.markets ?? []) {
          const marketKey = String(market?.key ?? '')
          const propType = resolvePropTypeFromMarketKey(marketKey)
          if (!propType) continue

          for (const outcome of market.outcomes ?? []) {
            const normalizedOutcome = (outcome as Record<string, unknown>) ?? {}
            const side = resolveOverUnderFromOutcome(normalizedOutcome)
            if (!side) continue

            const line = resolveExchangeOutcomeLine(normalizedOutcome)
            if (line == null) continue

            const odds = parseOptionalNumber(normalizedOutcome?.price)
            if (odds == null) continue

            const priceCents = oddsToPriceCents(odds)
            if (priceCents == null) continue

            const notional = resolveExchangeOutcomeNotional(
              normalizedOutcome,
              (market as Record<string, unknown>) ?? {},
              (bookmaker as Record<string, unknown>) ?? {}
            )
            const effectiveNotional = notional != null && notional > 0
              ? notional
              : minSharpNotional

            const playerName = resolveExchangeOutcomePlayerName(normalizedOutcome, side) ?? null
            if (!playerName) continue

            const key = `${normalizePlayerName(playerName)}:${propType}:${formatLineKey(line)}`
            const existing = rows.get(key) ?? {
              playerName,
              propType,
              propLine: line,
              eventDate,
              matchup: gameLabel,
              marketTitle: `${gameLabel} | ${playerName}`,
              over: null,
              under: null,
            }

            if (side === 'Over') {
              const current = existing.over
              if (!current || effectiveNotional > current.notional) {
                existing.over = { odds, priceCents, notional: effectiveNotional }
              }
            } else {
              const current = existing.under
              if (!current || effectiveNotional > current.notional) {
                existing.under = { odds, priceCents, notional: effectiveNotional }
              }
            }

            rows.set(key, existing)
          }
        }

        for (const row of rows.values()) {
          if (reachedSportLimit()) break
          if (items.length >= limit) break

          const sides: PropOrderbookSide[] = []
          if (row.over) {
            sides.push(
              summarizeSide(
                'Over',
                'Over',
                'yes',
                [{ priceCents: row.over.priceCents, notional: row.over.notional }],
                minSharpNotional,
                depth
              )
            )
          }
          if (row.under) {
            sides.push(
              summarizeSide(
                'Under',
                'Under',
                'no',
                [{ priceCents: row.under.priceCents, notional: row.under.notional }],
                minSharpNotional,
                depth
              )
            )
          }
          if (!sides.length) continue

          const sharpLean = resolveSharpLean(sides, minSharpNotional, {
            interpretation: 'direct',
          })
          if (!passesFavoriteOddsGate(sharpLean.sharpLeanAmericanOdds, sportKey)) {
            continue
          }

          const quotedLeanOdds =
            sharpLean.sharpLeanSide === 'Over'
              ? row.over?.odds ?? null
              : sharpLean.sharpLeanSide === 'Under'
                ? row.under?.odds ?? null
                : null

          const safeSourceLabel = EXCHANGE_SOURCE_LABELS[source]
          items.push({
            id: `${source}:${event.id}:${normalizePlayerName(row.playerName)}:${row.propType}:${formatLineKey(row.propLine)}`,
            source,
            sportKey,
            sportLabel: EXCHANGE_SPORT_LABELS[sportKey],
            matchup: row.matchup,
            marketTitle: row.marketTitle,
            playerName: row.playerName,
            propType: row.propType,
            propLine: row.propLine,
            eventDate: row.eventDate,
            sides,
            ...sharpLean,
            sharpLeanBestOdds: quotedLeanOdds ?? sharpLean.sharpLeanAmericanOdds ?? null,
            sharpLeanBestBookTitle: safeSourceLabel,
            pinnacleLeanOdds: null,
            pinnacleLeanBookTitle: null,
            fanduelLeanOdds: null,
            fanduelLeanBookTitle: null,
            updatedAt,
          })
        }
      }
    }
  }

  return items
}

type PropOrderbooksSnapshot = {
  updatedAt: string
  items: PropOrderbookItem[]
}
type SnapshotMode = 'fast' | 'full'
const orderbooksInFlight = new Map<string, Promise<PropOrderbooksSnapshot>>()

const mapWithConcurrency = async <T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R | null>
) => {
  if (!items.length) return [] as R[]
  const size = Math.max(1, Math.floor(concurrency))
  const results: R[] = []
  let index = 0

  const runWorker = async () => {
    while (true) {
      const current = index
      index += 1
      if (current >= items.length) break
      const value = await worker(items[current], current)
      if (value != null) results.push(value)
    }
  }

  await Promise.all(Array.from({ length: Math.min(size, items.length) }, () => runWorker()))
  return results
}

export const fetchPropOrderbooksSnapshot = async (opts?: {
  sportKey?: string | 'all'
  limit?: number
  depth?: number
  minSharpNotional?: number
  mode?: SnapshotMode
}) => {
  const sportFilter = opts?.sportKey ?? 'all'
  const requestedLimit = opts?.limit ?? 60
  const depth = opts?.depth ?? 8
  const minSharpNotional = opts?.minSharpNotional ?? 100
  const mode = opts?.mode ?? 'full'
  const isFastMode = mode === 'fast'
  const useLightCollection = isFastMode
  const skipOddsApis = false
  const collectionLimit =
    sportFilter === 'all'
      ? useLightCollection
        ? Math.min(Math.max(requestedLimit + 20, requestedLimit), 110)
        : Math.min(Math.max(requestedLimit * 3, requestedLimit), 360)
      : requestedLimit
  const allKalshiSports =
    sportFilter === 'all'
      ? Array.from(new Set(KALSHI_PROP_SERIES.map((series) => series.sportKey)))
      : []
  const kalshiPerSportCollectionLimit =
    sportFilter === 'all' && allKalshiSports.length > 0
      ? Math.max(
          Math.ceil(collectionLimit / allKalshiSports.length),
          useLightCollection ? 24 : 64
        )
      : collectionLimit
  const cacheKey = `${sportFilter}:${requestedLimit}:${depth}:${minSharpNotional}:${mode}`

  const inFlight = orderbooksInFlight.get(cacheKey)
  if (inFlight) {
    return inFlight
  }

  const computePromise = (async (): Promise<PropOrderbooksSnapshot> => {
    const today = getUsMarketDayKey()
    const updatedAt = new Date().toISOString()
    const polymarketOrderbookLimit = useLightCollection
      ? Math.min(MAX_POLYMARKET_ORDERBOOKS, 16)
      : MAX_POLYMARKET_ORDERBOOKS
    const kalshiPageLimit = useLightCollection ? 1 : MAX_KALSHI_PAGES
    const kalshiMarketBudget = useLightCollection
      ? Math.min(Math.max(requestedLimit + 20, 60), 120)
      : Number.POSITIVE_INFINITY
    const kalshiConcurrency = useLightCollection ? 10 : 5
    const polymarketConcurrency = useLightCollection ? 8 : 4

    const kalshiItems: PropOrderbookItem[] = []
    const kalshiSportCounts = new Map<string, number>()
    const polymarketItems: PropOrderbookItem[] = []
    const exchangeItems = await fetchExchangePropOrderbookItems({
      sportFilter,
      today,
      depth,
      minSharpNotional,
      updatedAt,
      limit: useLightCollection ? Math.min(collectionLimit, 140) : collectionLimit,
    })

    const buildKalshiItem = async (
      series: (typeof KALSHI_PROP_SERIES)[number],
      market: KalshiMarket
    ): Promise<PropOrderbookItem | null> => {
      const url = new URL(`${KALSHI_BASE}/markets/${market.ticker}/orderbook`)
      url.searchParams.set('depth', String(Math.max(depth, 8)))
      const data = await fetchKalshiJson<KalshiOrderbookResponse>(
        url.toString()
      )
      if (!data) return null
      const { yes: yesRaw, no: noRaw } = extractKalshiOrderbookLevels(data)

      let rawYesLabel = market.yes_sub_title || 'Yes'
      let rawNoLabel = market.no_sub_title || 'No'
      if (!useLightCollection && (!market.yes_sub_title || !market.no_sub_title)) {
        const marketDetails = await fetchKalshiMarketDetails(market.ticker)
        rawYesLabel = marketDetails?.yes_sub_title || rawYesLabel
        rawNoLabel = marketDetails?.no_sub_title || rawNoLabel
      }

      const rawText = `${market.title ?? ''}`.trim()
      const matchup = resolveKalshiMatchup(series.sportKey, market.ticker)
      const normalizedText = normalizeText(`${rawText} ${rawYesLabel} ${rawNoLabel}`.trim())
      const playerName =
        parsePlayerNameFromKalshiTitle(market.title) ||
        (rawText ? extractPlayerNameFromText(rawText) : null)
      const propType = series.propType
      const propLine = parseLineFromTicker(market.ticker)
      if (!playerName || !propType) return null

      const yesLevels = parseKalshiLevels(yesRaw)
      const noLevels = parseKalshiLevels(noRaw)

      const yesPropSide = resolvePropSide(normalizedText, rawText, 'yes')
      const noPropSide = resolvePropSide(normalizedText, rawText, 'no')

      const sides: PropOrderbookSide[] = [
        summarizeSide(
          rawYesLabel,
          yesPropSide,
          'yes',
          yesLevels,
          minSharpNotional,
          depth
        ),
        summarizeSide(
          rawNoLabel,
          noPropSide,
          'no',
          noLevels,
          minSharpNotional,
          depth
        ),
      ].filter((side) => side.levels.length > 0 || (side.wallNotional ?? 0) > 0)
      if (!sides.length) return null

      const sharpLean = resolveSharpLean(sides, minSharpNotional, {
        interpretation: 'complement',
      })
      if (!passesFavoriteOddsGate(sharpLean.sharpLeanAmericanOdds, series.sportKey)) {
        return null
      }
      const leanSportsbookQuote =
        !skipOddsApis && sharpLean.sharpLeanSide != null
          ? await resolveSportsbookPropPrices(
              series.sportKey,
              playerName,
              propType,
              propLine,
              sharpLean.sharpLeanSide
            )
          : {
              bestOdds: null,
              noVigProb: null,
              bestBookTitle: null,
              pinnacleOdds: null,
              pinnacleBookTitle: null,
              fanduelOdds: null,
              fanduelBookTitle: null,
              bookOddsByKey: {},
            }
      const leanBestOdds =
        leanSportsbookQuote.fanduelOdds ??
        leanSportsbookQuote.bestOdds ??
        (skipOddsApis ? sharpLean.sharpLeanAmericanOdds : null)
      const leanBestBookTitle =
        leanSportsbookQuote.fanduelBookTitle ??
        leanSportsbookQuote.bestBookTitle ??
        (skipOddsApis ? 'Kalshi' : null)

      return {
        id: `kalshi:${market.ticker}`,
        source: 'kalshi',
        sportKey: series.sportKey,
        sportLabel: series.sportLabel,
        matchup: matchup ?? undefined,
        marketTitle: market.title ?? market.ticker,
        playerName,
        propType,
        propLine,
        eventDate: parseKalshiDate(market.ticker) ?? undefined,
        ticker: market.ticker,
        sides,
        ...sharpLean,
        sharpLeanBestOdds: leanBestOdds,
        sharpLeanBestBookTitle: leanBestBookTitle,
        pinnacleLeanOdds: leanSportsbookQuote.pinnacleOdds ?? null,
        pinnacleLeanBookTitle: leanSportsbookQuote.pinnacleBookTitle ?? null,
        fanduelLeanOdds: leanSportsbookQuote.fanduelOdds ?? null,
        fanduelLeanBookTitle: leanSportsbookQuote.fanduelBookTitle ?? null,
        sportsbookOddsByBook: leanSportsbookQuote.bookOddsByKey ?? {},
        updatedAt,
      }
    }

    let kalshiMarketFetches = 0
    for (const series of KALSHI_PROP_SERIES) {
      if (sportFilter !== 'all' && series.sportKey !== sportFilter) continue
      const collectedForSport = kalshiSportCounts.get(series.sportKey) ?? 0
      if (
        sportFilter === 'all' &&
        collectedForSport >= kalshiPerSportCollectionLimit
      ) {
        continue
      }
      if (kalshiItems.length >= collectionLimit) break
      if (kalshiMarketFetches >= kalshiMarketBudget) break

      const markets = await fetchKalshiPropMarkets(series.ticker, kalshiPageLimit)
      const upcoming = markets.filter((market) => {
        const eventDate = parseKalshiDate(market.ticker)
        return Boolean(eventDate && eventDate >= today)
      })
      const remaining = collectionLimit - kalshiItems.length
      if (remaining <= 0) break
      const remainingBudget = kalshiMarketBudget - kalshiMarketFetches
      if (remainingBudget <= 0) break
      const sportRemaining =
        sportFilter === 'all'
          ? Math.max(0, kalshiPerSportCollectionLimit - collectedForSport)
          : remaining
      if (sportRemaining <= 0) continue
      const seriesCap = useLightCollection
        ? Math.min(
            upcoming.length,
            Math.max(Math.min(remaining, sportRemaining), 8),
            remainingBudget,
            12
          )
        : sportFilter === 'all'
          ? Math.min(
              upcoming.length,
              Math.max(Math.min(remaining, sportRemaining), 10),
              remainingBudget,
              40
            )
          : Math.min(upcoming.length, Math.max(remaining * 2, remaining), 80)
      const candidates = upcoming.slice(0, seriesCap)
      kalshiMarketFetches += candidates.length
      const built = await mapWithConcurrency(candidates, kalshiConcurrency, (market) =>
        buildKalshiItem(series, market)
      )
      if (built.length) {
        let nextSportCount = collectedForSport
        for (const item of built) {
          if (kalshiItems.length >= collectionLimit) break
          if (
            sportFilter === 'all' &&
            nextSportCount >= kalshiPerSportCollectionLimit
          ) {
            break
          }
          kalshiItems.push(item)
          nextSportCount += 1
        }
        kalshiSportCounts.set(series.sportKey, nextSportCount)
      }
    }

    {
      const pageLimit = 250
      const sportsMarketTypes = resolvePolymarketSportsMarketTypes(sportFilter)
      const maxPages = sportsMarketTypes.length ? 6 : 20
      let orderbookFetches = 0

      const buildPolymarketItem = async (
        market: PolymarketMarket
      ): Promise<PropOrderbookItem | null> => {
        const question = market.question || market.title
        if (!question) return null
        const rawText = question.trim()
        const sportMeta = resolvePolymarketSport(market)
        if (!sportMeta) return null
        const normalizedText = normalizeText(rawText)
        const matchup = resolvePolymarketMatchup(market)
        const propType =
          market.sportsMarketType || resolvePropType(normalizedText, sportMeta.sportKey)
        if (!propType) return null

        const outcomes = parseJsonArray<string>(market.outcomes)
        const tokenIds = parseJsonArray<string>(market.clobTokenIds)
        if (outcomes.length < 2 || tokenIds.length < 2) return null

        const [book0, book1] = await Promise.all([
          fetchPolymarketOrderbook(tokenIds[0]),
          fetchPolymarketOrderbook(tokenIds[1]),
        ])
        if (!book0 || !book1) return null

        const levels0 = parsePolymarketLevels(book0)
        const levels1 = parsePolymarketLevels(book1)
        if (levels0.length === 0 && levels1.length === 0) return null

        const outcome0 = outcomes[0] ?? ''
        const outcome1 = outcomes[1] ?? ''
        const side0 =
          outcome0.toLowerCase().trim() === 'yes'
            ? 'yes'
            : outcome0.toLowerCase().trim() === 'no'
              ? 'no'
              : null
        const side1 =
          outcome1.toLowerCase().trim() === 'yes'
            ? 'yes'
            : outcome1.toLowerCase().trim() === 'no'
              ? 'no'
              : null

        const propSide0 = resolvePropSide(normalizedText, rawText, side0)
        const propSide1 = resolvePropSide(normalizedText, rawText, side1)

        const playerName = extractPlayerNameFromText(rawText)
        const propLine =
          typeof market.line === 'number' && Number.isFinite(market.line)
            ? market.line
            : resolvePropLine(normalizedText, propType, rawText)
        if (!playerName || propLine == null) return null

        const sides: PropOrderbookSide[] = [
          summarizeSide(
            outcome0,
            propSide0,
            side0,
            levels0,
            minSharpNotional,
            depth
          ),
          summarizeSide(
            outcome1,
            propSide1,
            side1,
            levels1,
            minSharpNotional,
            depth
          ),
        ].filter((side) => side.levels.length > 0 || (side.wallNotional ?? 0) > 0)
        if (!sides.length) return null

        const sideWalls = sides
          .map((side) => side.wallPriceCents)
          .filter((price): price is number => price != null)
        const hasMirroredExtremeWalls =
          sideWalls.length === 2 &&
          ((sideWalls[0] >= 95 && sideWalls[1] >= 95) ||
            (sideWalls[0] <= 5 && sideWalls[1] <= 5))
        if (hasMirroredExtremeWalls) return null

        const sharpLean = resolveSharpLean(sides, minSharpNotional, {
          interpretation: 'direct',
        })
        if (!passesFavoriteOddsGate(sharpLean.sharpLeanAmericanOdds, sportMeta.sportKey)) {
          return null
        }
        const leanSportsbookQuote =
          !skipOddsApis && sharpLean.sharpLeanSide != null
            ? await resolveSportsbookPropPrices(
                sportMeta.sportKey,
                playerName,
                propType,
                propLine,
                sharpLean.sharpLeanSide
              )
            : {
                bestOdds: null,
                noVigProb: null,
                bestBookTitle: null,
                pinnacleOdds: null,
                pinnacleBookTitle: null,
                fanduelOdds: null,
                fanduelBookTitle: null,
                bookOddsByKey: {},
              }
        const leanBestOdds =
          leanSportsbookQuote.fanduelOdds ??
          leanSportsbookQuote.bestOdds ??
          (skipOddsApis ? sharpLean.sharpLeanAmericanOdds : null)
        const leanBestBookTitle =
          leanSportsbookQuote.fanduelBookTitle ??
          leanSportsbookQuote.bestBookTitle ??
          (skipOddsApis ? 'Polymarket' : null)

        return {
          id: `polymarket:${market.id}`,
          source: 'polymarket',
          sportKey: sportMeta.sportKey,
          sportLabel: sportMeta.sportLabel,
          matchup: matchup ?? undefined,
          marketTitle: rawText,
          playerName,
          propType,
          propLine,
          eventDate: resolvePolymarketEventDate(market) ?? undefined,
          slug: market.slug ?? market.id,
          sides,
          ...sharpLean,
          sharpLeanBestOdds: leanBestOdds,
          sharpLeanBestBookTitle: leanBestBookTitle,
          pinnacleLeanOdds: leanSportsbookQuote.pinnacleOdds ?? null,
          pinnacleLeanBookTitle: leanSportsbookQuote.pinnacleBookTitle ?? null,
          fanduelLeanOdds: leanSportsbookQuote.fanduelOdds ?? null,
          fanduelLeanBookTitle: leanSportsbookQuote.fanduelBookTitle ?? null,
          sportsbookOddsByBook: leanSportsbookQuote.bookOddsByKey ?? {},
          updatedAt,
        }
      }

      for (let page = 0; page < maxPages; page += 1) {
        if (polymarketItems.length >= collectionLimit) break
        if (orderbookFetches >= polymarketOrderbookLimit) break

        const url = new URL(`${POLYMARKET_BASE}/markets`)
        url.searchParams.set('tag_id', POLYMARKET_GAMES_TAG_ID)
        url.searchParams.set('active', 'true')
        url.searchParams.set('closed', 'false')
        url.searchParams.set('limit', String(pageLimit))
        url.searchParams.set('offset', String(page * pageLimit))
        for (const marketType of sportsMarketTypes) {
          url.searchParams.append('sports_market_types', marketType)
        }

        const res = await fetch(url.toString(), { cache: 'no-store' })
        if (!res.ok) break
        const batch = (await res.json()) as PolymarketMarket[]
        if (!Array.isArray(batch) || batch.length === 0) break

        const candidates: PolymarketMarket[] = []
        for (const market of batch) {
          if (!market?.active || market.closed) continue
          const sportMeta = resolvePolymarketSport(market)
          if (!sportMeta) continue
          if (sportFilter !== 'all' && sportMeta.sportKey !== sportFilter) continue
          const eventDate = resolvePolymarketEventDate(market)
          if (!eventDate || eventDate < today) continue
          const question = market.question || market.title
          if (!question) continue
          if (!isPlayerPropQuestion(question.trim())) continue
          candidates.push(market)
        }

        const remainingBudget = polymarketOrderbookLimit - orderbookFetches
        if (remainingBudget <= 0) break
        const cappedCandidates = candidates.slice(0, remainingBudget)
        orderbookFetches += cappedCandidates.length

        const built = await mapWithConcurrency(cappedCandidates, polymarketConcurrency, (market) =>
          buildPolymarketItem(market)
        )
        if (built.length) {
          polymarketItems.push(...built)
          if (polymarketItems.length > collectionLimit) {
            polymarketItems.length = collectionLimit
            break
          }
        }

        if (batch.length < pageLimit) break
      }
    }

    const finalItems = buildFinalPropOrderbookItems({
      sportFilter,
      requestedLimit,
      kalshiItems: kalshiItems.slice(0, collectionLimit),
      polymarketItems: polymarketItems.slice(0, collectionLimit),
      exchangeItems: exchangeItems.slice(0, collectionLimit),
    })

    if (process.env.SHARP_PROPS_DIAGNOSTICS === '1') {
      const sourceCounts = finalItems.reduce<Record<string, number>>((acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1
        return acc
      }, {})
      const highLiquidityCount = finalItems.filter(
        (item) => (item.sharpLiquidityNotional ?? 0) >= 1000
      ).length

      console.info('[prop-orderbooks] snapshot composition', {
        mode,
        sportFilter,
        requestedLimit,
        collectionLimit,
        total: finalItems.length,
        sourceCounts,
        highLiquidityCount,
      })
    }

    return {
      updatedAt,
      items: finalItems,
    }
  })()

  orderbooksInFlight.set(cacheKey, computePromise)
  try {
    return await computePromise
  } finally {
    orderbooksInFlight.delete(cacheKey)
  }
}

const calculateImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

const formatLineKey = (value: number) => Number(value).toFixed(2)

const buildSelectionKey = (name: string, point?: number | null) => {
  const key = name.trim().toLowerCase()
  if (point == null) return key
  return `${key}::${formatLineKey(point)}`
}

const buildNoVigConsensusBySelection = (
  bookmakers: Bookmaker[],
  marketKey: 'spreads' | 'totals' | 'h2h'
) => {
  const selectionProbabilities = new Map<string, number[]>()

  for (const bookmaker of bookmakers) {
    const market = bookmaker.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    const implied = (market.outcomes || [])
      .map((outcome) => {
        const prob = calculateImpliedProbability(Number(outcome.price))
        if (prob == null || !Number.isFinite(prob) || prob <= 0) return null
        return { key: buildSelectionKey(outcome.name, outcome.point), prob }
      })
      .filter(Boolean) as Array<{ key: string; prob: number }>
    if (implied.length < 2) continue
    const totalProb = implied.reduce((sum, entry) => sum + entry.prob, 0)
    if (!Number.isFinite(totalProb) || totalProb <= 0) continue
    for (const entry of implied) {
      const normalized = entry.prob / totalProb
      const bucket = selectionProbabilities.get(entry.key) || []
      bucket.push(normalized)
      selectionProbabilities.set(entry.key, bucket)
    }
  }

  const consensus = new Map<string, { impliedProbability: number; bookCount: number }>()
  for (const [key, probs] of selectionProbabilities.entries()) {
    if (!probs.length) continue
    const avg = probs.reduce((sum, value) => sum + value, 0) / probs.length
    consensus.set(key, { impliedProbability: avg, bookCount: probs.length })
  }

  return consensus
}

const resolveSelectionKeyForTeam = (
  marketKey: 'spreads' | 'totals' | 'h2h',
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number },
  consensus: Map<string, { impliedProbability: number; bookCount: number }>
) => {
  if (marketKey === 'totals' && selection.totalSide && selection.line != null) {
    const target = buildSelectionKey(selection.totalSide, selection.line)
    if (consensus.has(target)) return target
  }

  if (marketKey === 'spreads' && selection.team && selection.line != null) {
    const teamKey = normalizeTeamKey(selection.team)
    const lineKey = formatLineKey(selection.line)
    for (const key of consensus.keys()) {
      const [rawName, rawLine] = key.split('::')
      if (!rawLine || rawLine !== lineKey) continue
      const candidateTeamKey = normalizeTeamKey(rawName)
      if (candidateTeamKey && teamKey && (candidateTeamKey === teamKey || candidateTeamKey.includes(teamKey))) {
        return key
      }
    }
  }

  if (marketKey === 'h2h' && selection.team) {
    const teamKey = normalizeTeamKey(selection.team)
    for (const key of consensus.keys()) {
      const [rawName] = key.split('::')
      const candidateTeamKey = normalizeTeamKey(rawName)
      if (candidateTeamKey && teamKey && (candidateTeamKey === teamKey || candidateTeamKey.includes(teamKey))) {
        return key
      }
    }
  }

  return null
}

const findMatchingGame = (games: OddsGame[], teams: { home: string; away: string } | null) => {
  if (!teams) return null
  const homeKey = normalizeTeamKey(teams.home)
  const awayKey = normalizeTeamKey(teams.away)
  if (!homeKey || !awayKey) return null
  return (
    games.find((game) => {
      const gHome = normalizeTeamKey(game.home_team)
      const gAway = normalizeTeamKey(game.away_team)
      return (
        (gHome.includes(homeKey) && gAway.includes(awayKey)) ||
        (gHome.includes(awayKey) && gAway.includes(homeKey))
      )
    }) ?? null
  )
}

const findBestOdds = (
  game: OddsGame,
  marketKey: 'spreads' | 'totals' | 'h2h',
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number }
) => {
  let bestOdds: number | null = null
  let bestBookKey: string | null = null
  let bestBookTitle: string | null = null
  let bestLineDiff = Number.POSITIVE_INFINITY

  for (const book of game.bookmakers || []) {
    if (isPredictionMarketBookFromOddsApi(book)) continue
    const market = book.markets?.find((m) => m.key === marketKey)
    if (!market) continue
    for (const outcome of market.outcomes || []) {
      const price = Number(outcome.price)
      if (!Number.isFinite(price)) continue
      if (marketKey === 'h2h') {
        if (selection.team && normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) {
          if (bestOdds == null || price > bestOdds) {
            bestOdds = price
            bestBookKey = book.key
            bestBookTitle = book.title ?? book.key
          }
        }
        continue
      }
      if (marketKey === 'totals') {
        if (!selection.totalSide) continue
        const isOver = outcome.name.toLowerCase().includes('over')
        const isUnder = outcome.name.toLowerCase().includes('under')
        if ((selection.totalSide === 'over' && !isOver) || (selection.totalSide === 'under' && !isUnder)) {
          continue
        }
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = selection.line != null ? Math.abs(line - selection.line) : 0
        if (lineDiff < bestLineDiff || (lineDiff === bestLineDiff && (bestOdds == null || price > bestOdds))) {
          bestLineDiff = lineDiff
          bestOdds = price
          bestBookKey = book.key
          bestBookTitle = book.title ?? book.key
        }
        continue
      }
      if (marketKey === 'spreads') {
        if (!selection.team) continue
        if (!normalizeTeamKey(outcome.name).includes(normalizeTeamKey(selection.team))) continue
        const line = Number(outcome.point)
        if (!Number.isFinite(line)) continue
        const lineDiff = selection.line != null ? Math.abs(line - selection.line) : 0
        if (lineDiff < bestLineDiff || (lineDiff === bestLineDiff && (bestOdds == null || price > bestOdds))) {
          bestLineDiff = lineDiff
          bestOdds = price
          bestBookKey = book.key
          bestBookTitle = book.title ?? book.key
        }
      }
    }
  }

  return { bestOdds, bestBookKey, bestBookTitle }
}

const formatCurrency = (value: number) => {
  if (!Number.isFinite(value)) return '$0'
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${Math.round(value)}`
}

const computeSharpStrength = (notional: number, edgePercent?: number | null) => {
  const base = 55 + Math.log10(notional / 1000 + 1) * 20
  const edgeBoost = edgePercent != null && edgePercent >= 3 ? 8 : 0
  return Math.min(100, Math.round(base + edgeBoost))
}

const sportsbookCache = new Map<
  string,
  { fetchedAt: number; data: Map<string, SportsbookPropLine[]> }
>()
const sportsbookInFlight = new Map<string, Promise<Map<string, SportsbookPropLine[]>>>()

const oddsCache = new Map<string, { fetchedAt: number; games: OddsGame[] }>()

const fetchOddsForMarket = async (
  sportKey: string,
  marketKey: 'spreads' | 'totals' | 'h2h',
  teams?: { home: string; away: string } | null
) => {
  const cacheKey = `${sportKey}:${marketKey}`
  const cached = oddsCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.games
  }

  const teamFilter = teams ? [teams.home, teams.away] : undefined
  const games = await fetchOdds(sportKey, [marketKey], {
    revalidateSeconds: 600,
    teamFilter,
    forceProvider: 'the-odds-api',
  })

  oddsCache.set(cacheKey, { fetchedAt: now, games })
  return games
}

const resolveSportsbookNoVig = async (opts: {
  sportKey: string
  marketKey: 'spreads' | 'totals' | 'h2h'
  teams: { home: string; away: string } | null
  selection: { team?: string; totalSide?: 'over' | 'under'; line?: number }
}) => {
  const { sportKey, marketKey, teams, selection } = opts
  if (!teams) return { noVigProb: null, bestOdds: null }
  const games = await fetchOddsForMarket(sportKey, marketKey, teams)
  if (!games.length) return { noVigProb: null, bestOdds: null }
  const game = findMatchingGame(games, teams)
  if (!game) return { noVigProb: null, bestOdds: null }

  const bookmakers =
    game.bookmakers?.filter((book) => !isPredictionMarketBookFromOddsApi(book)) ?? []
  const consensus = buildNoVigConsensusBySelection(bookmakers, marketKey)
  const selectionKey = resolveSelectionKeyForTeam(marketKey, selection, consensus)
  if (!selectionKey) {
    return { noVigProb: null, bestOdds: null }
  }
  const entry = consensus.get(selectionKey)
  const best = findBestOdds(game, marketKey, selection)
  return {
    noVigProb: entry?.impliedProbability ?? null,
    bestOdds: best.bestOdds,
    bestBookKey: best.bestBookKey,
    bestBookTitle: best.bestBookTitle,
  }
}

const SHARP_LINE_SHOP_BOOKMAKERS = [
  'novig',
  'fanduel',
  'circa',
  'prophetx',
  'prizepicks',
  'underdog',
  'pick6',
  'sleeper',
] as const

const SHARP_LINE_SHOP_MARKETS: Record<string, string[]> = {
  basketball_nba: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    'player_rebounds_assists',
    'player_blocks',
    'player_steals',
    'player_turnovers',
  ],
  basketball_ncaab: [
    'player_points',
    'player_rebounds',
    'player_assists',
    'player_threes',
    'player_points_rebounds_assists',
    'player_points_rebounds',
    'player_points_assists',
    'player_rebounds_assists',
  ],
  americanfootball_nfl: [
    'player_pass_yds',
    'player_pass_tds',
    'player_pass_completions',
    'player_pass_attempts',
    'player_interceptions',
    'player_rush_yds',
    'player_rush_tds',
    'player_receptions',
    'player_reception_yds',
    'player_receiving_tds',
    'player_longest_reception',
    'player_longest_rush',
  ],
  baseball_mlb: [
    'player_hits',
    'player_total_bases',
    'player_home_runs',
    'player_rbis',
    'player_runs_scored',
    'player_strikeouts',
    'player_walks',
  ],
  icehockey_nhl: [
    'player_points',
    'player_goals',
    'player_assists',
    'player_shots_on_goal',
    'player_blocked_shots',
    'player_saves',
    'player_total_saves',
  ],
}

const createSportsbookPropLine = (playerName: string, propType: string, line: number): SportsbookPropLine => ({
  playerName,
  propType,
  line,
  bestOverOdds: null,
  bestUnderOdds: null,
  bestOverBookTitle: null,
  bestUnderBookTitle: null,
  pinnacleOverOdds: null,
  pinnacleUnderOdds: null,
  pinnacleOverBookTitle: null,
  pinnacleUnderBookTitle: null,
  fanduelOverOdds: null,
  fanduelUnderOdds: null,
  fanduelOverBookTitle: null,
  fanduelUnderBookTitle: null,
  oddsByBook: {},
  noVigOverProbs: [],
  noVigUnderProbs: [],
})

const upsertBookOdds = (
  bucket: SportsbookPropLine,
  book: { key?: string | null; title?: string | null; name?: string | null },
  overOdds: number | null,
  underOdds: number | null
) => {
  const bookTitle =
    typeof book?.name === 'string'
      ? book.name
      : typeof book?.title === 'string'
        ? book.title
        : book?.key
          ? String(book.key)
          : null

  if (overOdds != null && !Number.isNaN(overOdds)) {
    if (isPinnacleBook(book)) {
      bucket.pinnacleOverOdds = overOdds
      bucket.pinnacleOverBookTitle = bookTitle
    }
    if (isFanDuelBook(book)) {
      bucket.fanduelOverOdds = overOdds
      bucket.fanduelOverBookTitle = bookTitle
    }
    if (bucket.bestOverOdds == null || overOdds > bucket.bestOverOdds) {
      bucket.bestOverOdds = overOdds
      bucket.bestOverBookTitle = bookTitle
    }
  }
  if (underOdds != null && !Number.isNaN(underOdds)) {
    if (isPinnacleBook(book)) {
      bucket.pinnacleUnderOdds = underOdds
      bucket.pinnacleUnderBookTitle = bookTitle
    }
    if (isFanDuelBook(book)) {
      bucket.fanduelUnderOdds = underOdds
      bucket.fanduelUnderBookTitle = bookTitle
    }
    if (bucket.bestUnderOdds == null || underOdds > bucket.bestUnderOdds) {
      bucket.bestUnderOdds = underOdds
      bucket.bestUnderBookTitle = bookTitle
    }
  }

  const canonicalBookKey =
    resolveOddsSourceKey(typeof book?.key === 'string' ? book.key : null) ??
    resolveOddsSourceKey(bookTitle)
  if (canonicalBookKey) {
    const existing = bucket.oddsByBook[canonicalBookKey] ?? {
      over: null,
      under: null,
      title: bookTitle ?? null,
    }
    bucket.oddsByBook[canonicalBookKey] = {
      over:
        overOdds != null && !Number.isNaN(overOdds)
          ? overOdds
          : existing.over,
      under:
        underOdds != null && !Number.isNaN(underOdds)
          ? underOdds
          : existing.under,
      title: existing.title ?? bookTitle ?? null,
    }
  }

  if (overOdds != null && underOdds != null) {
    const overProb = oddsToImpliedProbability(overOdds)
    const underProb = oddsToImpliedProbability(underOdds)
    const total = overProb + underProb
    if (Number.isFinite(total) && total > 0) {
      bucket.noVigOverProbs.push(overProb / total)
      bucket.noVigUnderProbs.push(underProb / total)
    }
  }
}

const buildSportsbookIndexFromOddsApi = async (
  sportKey: string
): Promise<Map<string, SportsbookPropLine[]>> => {
  const markets = SHARP_LINE_SHOP_MARKETS[sportKey]
  if (!markets?.length) return new Map<string, SportsbookPropLine[]>()

  const events = await fetchTheOddsApiPlayerProps(sportKey, {
    markets: markets.join(','),
    regions: 'us,us2,eu,us_ex',
    bookmakers: [...SHARP_LINE_SHOP_BOOKMAKERS],
    oddsFormat: 'american',
    dateFormat: 'iso',
  })

  const result = new Map<string, SportsbookPropLine[]>()
  for (const event of events ?? []) {
    for (const bookmaker of event.bookmakers ?? []) {
      if (isPredictionMarketBookFromOddsApi(bookmaker)) continue
      for (const market of bookmaker.markets ?? []) {
        const marketKey = String(market?.key ?? '')
        const propType = resolvePropTypeFromMarketKey(marketKey)
        if (!propType) continue

        const lineRows = new Map<string, { over: number | null; under: number | null; playerName: string; line: number }>()
        for (const outcome of market.outcomes ?? []) {
          const normalizedOutcome = (outcome as Record<string, unknown>) ?? {}
          const side = resolveOverUnderFromOutcome(normalizedOutcome)
          if (!side) continue
          const line = resolveExchangeOutcomeLine(normalizedOutcome)
          if (line == null || !Number.isFinite(line)) continue
          const odds = parseOptionalNumber(normalizedOutcome?.price)
          if (odds == null || !Number.isFinite(odds)) continue
          const playerName = resolveExchangeOutcomePlayerName(normalizedOutcome, side) ?? null
          if (!playerName) continue

          const key = `${normalizePlayerName(playerName)}:${propType}:${formatLineKey(line)}`
          const existing = lineRows.get(key) ?? {
            over: null,
            under: null,
            playerName,
            line,
          }
          if (side === 'Over') existing.over = odds
          if (side === 'Under') existing.under = odds
          lineRows.set(key, existing)
        }

        for (const row of lineRows.values()) {
          const normalizedPlayer = normalizePlayerName(row.playerName)
          if (!normalizedPlayer) continue
          if (!result.has(normalizedPlayer)) result.set(normalizedPlayer, [])

          let bucket = result.get(normalizedPlayer)!.find(
            (item) => item.propType === propType && Math.abs(item.line - row.line) < 0.001
          )
          if (!bucket) {
            bucket = createSportsbookPropLine(normalizedPlayer, propType, row.line)
            result.get(normalizedPlayer)!.push(bucket)
          }

          upsertBookOdds(
            bucket,
            {
              key: bookmaker?.key ?? null,
              title: bookmaker?.title ?? null,
              name: bookmaker?.title ?? null,
            },
            row.over,
            row.under
          )
        }
      }
    }
  }

  return result
}

const fetchSportsbookPropIndex = async (sportKey: string) => {
  const cached = sportsbookCache.get(sportKey)
  const now = Date.now()
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data
  }

  const pending = sportsbookInFlight.get(sportKey)
  if (pending) {
    return pending
  }

  const loadPromise = (async () => {
    try {
      const oddsApiResult = await buildSportsbookIndexFromOddsApi(sportKey)
      sportsbookCache.set(sportKey, { fetchedAt: now, data: oddsApiResult })
      return oddsApiResult
    } catch (error) {
      console.warn('[prop-liquidity-detector] Failed to fetch sportsbook prop index:', error)
      const empty = new Map<string, SportsbookPropLine[]>()
      sportsbookCache.set(sportKey, { fetchedAt: now, data: empty })
      return empty
    }
  })()

  sportsbookInFlight.set(sportKey, loadPromise)
  try {
    return await loadPromise
  } finally {
    sportsbookInFlight.delete(sportKey)
  }
}

const resolveSportsbookPropPrices = async (
  sportKey: string,
  playerName: string,
  propType: string,
  propLine: number | null,
  propSide: 'Over' | 'Under' | null
): Promise<{
  bestOdds: number | null
  noVigProb: number | null
  bestBookTitle: string | null
  pinnacleOdds: number | null
  pinnacleBookTitle: string | null
  fanduelOdds: number | null
  fanduelBookTitle: string | null
  bookOddsByKey: Record<string, { over: number | null; under: number | null; title: string | null }>
}> => {
  if (!propSide) {
    return {
      bestOdds: null,
      noVigProb: null,
      bestBookTitle: null,
      pinnacleOdds: null,
      pinnacleBookTitle: null,
      fanduelOdds: null,
      fanduelBookTitle: null,
      bookOddsByKey: {},
    }
  }
  const index = await fetchSportsbookPropIndex(sportKey)
  const normalizedPlayer = normalizePlayerName(playerName)
  const props = index.get(normalizedPlayer) ?? []
  let matches = props.filter((item) => item.propType === propType)
  if (propLine != null) {
    matches = matches.filter((item) => Math.abs(item.line - propLine) < 0.01)
  }
  if (!matches.length) {
    return {
      bestOdds: null,
      noVigProb: null,
      bestBookTitle: null,
      pinnacleOdds: null,
      pinnacleBookTitle: null,
      fanduelOdds: null,
      fanduelBookTitle: null,
      bookOddsByKey: {},
    }
  }

  let best: SportsbookPropLine | null = null
  for (const candidate of matches) {
    best = candidate
    break
  }
  if (!best) {
    return {
      bestOdds: null,
      noVigProb: null,
      bestBookTitle: null,
      pinnacleOdds: null,
      pinnacleBookTitle: null,
      fanduelOdds: null,
      fanduelBookTitle: null,
      bookOddsByKey: {},
    }
  }

  const bestOdds = propSide === 'Under' ? best.bestUnderOdds : best.bestOverOdds
  const bestBookTitle =
    propSide === 'Under' ? best.bestUnderBookTitle : best.bestOverBookTitle
  const pinnacleOdds =
    propSide === 'Under' ? best.pinnacleUnderOdds : best.pinnacleOverOdds
  const pinnacleBookTitle =
    propSide === 'Under' ? best.pinnacleUnderBookTitle : best.pinnacleOverBookTitle
  const fanduelOdds =
    propSide === 'Under' ? best.fanduelUnderOdds : best.fanduelOverOdds
  const fanduelBookTitle =
    propSide === 'Under' ? best.fanduelUnderBookTitle : best.fanduelOverBookTitle
  const noVigPool = propSide === 'Under' ? best.noVigUnderProbs : best.noVigOverProbs
  const noVigProb = noVigPool.length
    ? noVigPool.reduce((sum, value) => sum + value, 0) / noVigPool.length
    : null
  return {
    bestOdds: bestOdds ?? null,
    noVigProb,
    bestBookTitle: bestBookTitle ?? null,
    pinnacleOdds: pinnacleOdds ?? null,
    pinnacleBookTitle: pinnacleBookTitle ?? null,
    fanduelOdds: fanduelOdds ?? null,
    fanduelBookTitle: fanduelBookTitle ?? null,
    bookOddsByKey: best.oddsByBook ?? {},
  }
}

const buildLiquidityReason = (
  notional: number,
  outcomeLabel: string,
  americanOdds: number | null,
  priceCents: number | null
) => {
  const oddsLabel =
    formatAmericanOdds(americanOdds) ?? (priceCents != null ? `${priceCents}c` : 'market price')
  return {
    type: 'liquidity' as const,
    description: `${formatCurrency(notional)} order on ${outcomeLabel} at ${oddsLabel}.`,
    value: notional,
  }
}

const buildEvReason = (edgePercent: number, bestOdds: number | null) => {
  const absEdge = Math.abs(edgePercent).toFixed(1)
  const direction =
    edgePercent >= 0
      ? `Sportsbook price is ~${absEdge}% better than the order`
      : `Order price is ~${absEdge}% better than sportsbooks`
  const oddsLabel =
    bestOdds != null ? ` (${bestOdds >= 0 ? `+${bestOdds}` : bestOdds})` : ''
  return {
    type: 'cross-market-ev' as const,
    description: `${direction}${oddsLabel}.`,
    value: edgePercent,
  }
}

const buildLiquidityShareReason = (notional: number, totalMarketLiquidity: number) => {
  if (!totalMarketLiquidity) return null
  const share = Math.round((notional / totalMarketLiquidity) * 100)
  if (!Number.isFinite(share) || share < 50) return null
  return {
    type: 'liquidity' as const,
    description: `Order size is ${share}% of this side's liquidity.`,
    value: notional,
  }
}

let cachedSignals: { fetchedAt: number; signals: PropLiquiditySignal[] } | null = null

export const fetchPropLiquiditySignals = async (opts?: {
  sportKey?: string | 'all'
  minOrderNotional?: number
}) => {
  const now = Date.now()
  const minOrderNotional = opts?.minOrderNotional ?? PROP_ORDER_NOTIONAL_MIN
  const sportFilter = opts?.sportKey ?? 'all'
  if (cachedSignals && now - cachedSignals.fetchedAt < CACHE_TTL_MS) {
    if (sportFilter === 'all') return cachedSignals.signals
    return cachedSignals.signals.filter((signal) => signal.sportKey === sportFilter)
  }
  const today = getUsMarketDayKey()

  const kalshiSignals: PropLiquiditySignal[] = []
  for (const series of KALSHI_PROP_SERIES) {
    if (sportFilter !== 'all' && series.sportKey !== sportFilter) continue
    const markets = await fetchKalshiPropMarkets(series.ticker)
    const upcoming = markets.filter((market) => {
      const eventDate = parseKalshiDate(market.ticker)
      if (!eventDate || eventDate < today) return false
      return true
    })

    for (const market of upcoming) {
      const orderbook = await fetchKalshiOrderbookSummary(market.ticker)
      if (!orderbook) continue
      const eventDate = parseKalshiDate(market.ticker) ?? undefined
      const marketDetails = await fetchKalshiMarketDetails(market.ticker)
      const rawYesLabel = marketDetails?.yes_sub_title || market.yes_sub_title || 'Yes'
      const rawNoLabel = marketDetails?.no_sub_title || market.no_sub_title || 'No'

      const candidateSides: Array<{
        side: 'yes' | 'no'
        orders: KalshiOrderSummary[]
        label: string
        outcomeIndex: number
      }> = [
        { side: 'yes', orders: orderbook.yes, label: rawYesLabel, outcomeIndex: 0 },
        { side: 'no', orders: orderbook.no, label: rawNoLabel, outcomeIndex: 1 },
      ]

      const marketLiquidity =
        sumOrderNotional(orderbook.yes) + sumOrderNotional(orderbook.no)

      for (const candidate of candidateSides) {
        const dominantOrder = resolveDominantOrder(
          candidate.orders,
          minOrderNotional,
          marketLiquidity
        )
        const bestPriceOrder = resolveBestPriceOrder(candidate.orders, minOrderNotional)
        const selectedOrder = dominantOrder ?? bestPriceOrder
        if (!selectedOrder) continue
        if (selectedOrder.notional < marketLiquidity * 0.5) continue
        const priceCents = selectedOrder.priceCents
        if (priceCents == null) continue
        const probability = priceCents / 100
        const americanOdds =
          probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null

        const rawText = `${market.title ?? ''} ${candidate.label}`.trim()
        const normalizedText = normalizeText(rawText)
        const playerName = parsePlayerNameFromKalshiTitle(market.title) || extractPlayerNameFromText(rawText)
        const propType = series.propType
        const propLine = parseLineFromTicker(market.ticker)
        const propSide = resolvePropSide(normalizedText, rawText, candidate.side)

        if (!playerName || !propType || !propSide) continue
        if (americanOdds != null && americanOdds < -250) continue

        const { bestOdds, noVigProb, bestBookTitle } = await resolveSportsbookPropPrices(
          series.sportKey,
          playerName,
          propType,
          propLine,
          propSide
        )
        const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
        const edge =
          sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
        const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

        const displayOutcome =
          propLine != null ? `${propSide} ${propLine}` : propSide

        if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

        const reasons: PropLiquiditySignal['reasons'] = [
          buildLiquidityReason(selectedOrder.notional, displayOutcome, americanOdds, priceCents),
        ]
        const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
        if (shareReason) reasons.push(shareReason)
        reasons.push(buildEvReason(edgePercent, bestOdds))

        const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent ?? undefined)

        const orderOdds =
          americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
        const useSportsbook =
          sportsbookProb != null && sportsbookProb < probability
        const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
        const bestPriceBookTitle = useSportsbook
          ? bestBookTitle ?? null
          : 'Kalshi'
        const bestPriceBookKey = useSportsbook ? null : 'kalshi'

        kalshiSignals.push({
          id: `kalshi:${market.ticker}:${candidate.side}`,
          source: 'kalshi',
          category: 'player_prop',
          sportKey: series.sportKey,
          sportLabel: series.sportLabel,
          marketTitle: market.title ?? market.ticker,
          outcome: displayOutcome,
          playerName,
          propType,
          propLine,
          propSide,
          side: candidate.side,
          priceCents,
          americanOdds,
          liquidity: selectedOrder.notional,
          timestamp: new Date().toISOString(),
          eventDate,
          ticker: market.ticker,
          outcomeIndex: candidate.outcomeIndex,
          edgePercent,
          sportsbookNoVigProb: noVigProb,
          sportsbookBestOdds: bestPriceOdds ?? null,
          sportsbookBookTitle: bestPriceBookTitle,
          sportsbookBookKey: bestPriceBookKey,
          sharpStrength,
          reasons,
        })
      }
    }
  }

  const polymarketSignals: PropLiquiditySignal[] = []
  const polymarketUrl = new URL(`${POLYMARKET_BASE}/markets`)
  polymarketUrl.searchParams.set('tag_id', POLYMARKET_GAMES_TAG_ID)
  polymarketUrl.searchParams.set('active', 'true')
  polymarketUrl.searchParams.set('closed', 'false')
  polymarketUrl.searchParams.set('limit', String(MAX_POLYMARKET_MARKETS))

  const res = await fetch(polymarketUrl.toString(), { cache: 'no-store' })
  const polymarketData = res.ok ? ((await res.json()) as PolymarketMarket[]) : []
  const markets = Array.isArray(polymarketData) ? polymarketData : []

  let orderbookCount = 0
  for (const market of markets) {
    if (!market?.active || market.closed) continue
    const sportMeta = resolvePolymarketSport(market)
    if (!sportMeta) continue
    if (sportFilter !== 'all' && sportMeta.sportKey !== sportFilter) continue

    const question = market.question || market.title
    if (!question) continue
    const rawText = question.trim()
    const normalizedText = normalizeText(rawText)
    const propType = resolvePropType(normalizedText, sportMeta.sportKey)
    if (!propType) continue

    const outcomes = parseJsonArray<string>(market.outcomes)
    const outcomePrices = parseJsonArray<string | number>(market.outcomePrices)
    const tokenIds = parseJsonArray<string>(market.clobTokenIds)
    if (outcomes.length < 2 || tokenIds.length < 2 || outcomePrices.length < 2) continue

    if (orderbookCount >= MAX_POLYMARKET_ORDERBOOKS) break
    orderbookCount += 1

    const [book0, book1] = await Promise.all([
      fetchPolymarketOrderbook(tokenIds[0]),
      fetchPolymarketOrderbook(tokenIds[1]),
    ])
    if (!book0 || !book1) continue
    const orders0 = parsePolymarketOrders(book0)
    const orders1 = parsePolymarketOrders(book1)
    const candidates = [
      { index: 0, orders: orders0 },
      { index: 1, orders: orders1 },
    ]
    const marketLiquidity = sumOrderNotional(orders0) + sumOrderNotional(orders1)

    for (const candidate of candidates) {
      const dominantOrder = resolveDominantOrder(
        candidate.orders,
        minOrderNotional,
        marketLiquidity
      )
      const bestPriceOrder = resolveBestPriceOrder(candidate.orders, minOrderNotional)
      const selectedOrder = dominantOrder ?? bestPriceOrder
      if (!selectedOrder) continue
      if (selectedOrder.notional < marketLiquidity * 0.5) continue
      const outcome = outcomes[candidate.index] ?? ''
      const outcomeLower = outcome.toLowerCase().trim()
      const side = outcomeLower === 'yes' ? 'yes' : outcomeLower === 'no' ? 'no' : null
      const propSide = resolvePropSide(normalizedText, rawText, side)
      if (!propSide) continue

      const playerName = extractPlayerNameFromText(rawText)
      const propLine = resolvePropLine(normalizedText, propType, rawText)
      if (!playerName || propLine == null) continue

      const priceCents = selectedOrder.priceCents
      if (priceCents == null) continue
      const probability = priceCents / 100
      const americanOdds =
        probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null
      if (americanOdds != null && americanOdds < -250) continue

      const { bestOdds, noVigProb, bestBookTitle } = await resolveSportsbookPropPrices(
        sportMeta.sportKey,
        playerName,
        propType,
        propLine,
        propSide
      )
      const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
      const edge =
        sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
      const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

      const displayOutcome =
        propLine != null ? `${propSide} ${propLine}` : propSide

      if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

      const reasons: PropLiquiditySignal['reasons'] = [
        buildLiquidityReason(selectedOrder.notional, displayOutcome, americanOdds, priceCents),
      ]
      const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
      if (shareReason) reasons.push(shareReason)
      reasons.push(buildEvReason(edgePercent, bestOdds))

      const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent ?? undefined)

      const orderOdds =
        americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
      const useSportsbook =
        sportsbookProb != null && sportsbookProb < probability
      const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
      const bestPriceBookTitle = useSportsbook
        ? bestBookTitle ?? null
        : 'Polymarket'
      const bestPriceBookKey = useSportsbook ? null : 'polymarket'

      polymarketSignals.push({
        id: `polymarket:${market.id}:${candidate.index}`,
        source: 'polymarket',
        category: 'player_prop',
        sportKey: sportMeta.sportKey,
        sportLabel: sportMeta.sportLabel,
        marketTitle: rawText,
        outcome: displayOutcome,
        playerName,
        propType,
        propLine,
      propSide,
      side,
      priceCents,
      americanOdds,
      liquidity: selectedOrder.notional,
      timestamp: new Date().toISOString(),
      eventDate: resolvePolymarketEventDate(market) ?? undefined,
      slug: market.id,
      outcomeIndex: candidate.index,
      edgePercent,
      sportsbookNoVigProb: noVigProb,
      sportsbookBestOdds: bestPriceOdds ?? null,
      sportsbookBookTitle: bestPriceBookTitle,
      sportsbookBookKey: bestPriceBookKey,
      sharpStrength,
      reasons,
    })
    }
  }

  const teamSignals: PropLiquiditySignal[] = []
  for (const series of KALSHI_TEAM_SERIES) {
    if (sportFilter !== 'all' && series.sportKey !== sportFilter) continue
    const markets = await fetchKalshiPropMarkets(series.ticker)
    const upcoming = markets.filter((market) => {
      const eventDate = parseKalshiDate(market.ticker)
      if (!eventDate || eventDate < today) return false
      return true
    })

    for (const market of upcoming) {
      const orderbook = await fetchKalshiOrderbookSummary(market.ticker)
      if (!orderbook) continue
      const candidateSides: Array<{
        side: 'yes' | 'no'
        orders: KalshiOrderSummary[]
        outcomeIndex: number
      }> = [
        { side: 'yes', orders: orderbook.yes, outcomeIndex: 0 },
        { side: 'no', orders: orderbook.no, outcomeIndex: 1 },
      ]

      const teamCodes = parseTeamsFromTicker(market.ticker)
      if (!teamCodes) continue
      const awayName = resolveTeamNameFromCode(series.sportKey, teamCodes.awayCode)
      const homeName = resolveTeamNameFromCode(series.sportKey, teamCodes.homeCode)
      if (!awayName || !homeName) continue

      const lineTeamCode = parseTeamCodeFromTicker(market.ticker)
      const lineTeamName = resolveTeamNameFromCode(series.sportKey, lineTeamCode)
      const opponentName =
        lineTeamName === awayName ? homeName : lineTeamName === homeName ? awayName : null

      const lineValue = parseLineFromTitle(market.title ?? '')

      const marketLiquidity =
        sumOrderNotional(orderbook.yes) + sumOrderNotional(orderbook.no)
      if (marketLiquidity > TEAM_MARKET_LIQUIDITY_MAX) continue

      for (const candidate of candidateSides) {
        const dominantOrder = resolveDominantOrder(
          candidate.orders,
          TEAM_ORDER_NOTIONAL_MIN,
          marketLiquidity
        )
        const bestPriceOrder = resolveBestPriceOrder(candidate.orders, TEAM_ORDER_NOTIONAL_MIN)
        const selectedOrder = dominantOrder ?? bestPriceOrder
        if (!selectedOrder) continue
        if (selectedOrder.notional < marketLiquidity * 0.5) continue
        const priceCents = selectedOrder.priceCents
        if (priceCents == null) continue
        const probability = priceCents / 100
        const americanOdds =
          probability > 0 && probability < 1 ? probabilityToAmericanOdds(probability) : null
        if (americanOdds != null && americanOdds < -250) continue

        let selection: { team?: string; totalSide?: 'over' | 'under'; line?: number } = {}
        let outcomeLabel = ''

        if (series.marketKey === 'totals') {
          if (lineValue == null) continue
          const totalSide = candidate.side === 'yes' ? 'over' : 'under'
          selection = { totalSide, line: lineValue }
          outcomeLabel = `${totalSide === 'over' ? 'Over' : 'Under'} ${lineValue}`
        } else if (series.marketKey === 'spreads') {
          if (lineValue == null || !lineTeamName || !opponentName) continue
          const line = Math.abs(lineValue)
          if (candidate.side === 'yes') {
            selection = { team: lineTeamName, line: -line }
            outcomeLabel = `${lineTeamName} -${line}`
          } else {
            selection = { team: opponentName, line }
            outcomeLabel = `${opponentName} +${line}`
          }
        } else {
          if (!lineTeamName || !opponentName) continue
          const team = candidate.side === 'yes' ? lineTeamName : opponentName
          selection = { team }
          outcomeLabel = team
        }

        const { noVigProb, bestOdds, bestBookKey, bestBookTitle } = await resolveSportsbookNoVig({
          sportKey: series.sportKey,
          marketKey: series.marketKey,
          teams: { home: homeName, away: awayName },
          selection,
        })
        const sportsbookProb = bestOdds != null ? oddsToImpliedProbability(bestOdds) : null
        const edge =
          sportsbookProb != null ? (probability - sportsbookProb) * 100 : null
        const edgePercent = edge != null ? Math.round(edge * 10) / 10 : null

        if (edgePercent == null || edgePercent < 3 || bestOdds == null) continue

        const reasons: PropLiquiditySignal['reasons'] = [
          buildLiquidityReason(selectedOrder.notional, outcomeLabel, americanOdds, priceCents),
        ]
        const shareReason = buildLiquidityShareReason(selectedOrder.notional, marketLiquidity)
        if (shareReason) reasons.push(shareReason)
        reasons.push(buildEvReason(edgePercent, bestOdds))
        const sharpStrength = computeSharpStrength(selectedOrder.notional, edgePercent)

        const orderOdds =
          americanOdds != null ? americanOdds : probabilityToAmericanOdds(probability)
        const useSportsbook =
          sportsbookProb != null && sportsbookProb < probability
        const bestPriceOdds = useSportsbook ? bestOdds : orderOdds
        const bestPriceBookTitle = useSportsbook
          ? bestBookTitle ?? null
          : 'Kalshi'
        const bestPriceBookKey = useSportsbook ? bestBookKey ?? null : 'kalshi'

        teamSignals.push({
          id: `kalshi:${market.ticker}:${candidate.side}`,
          source: 'kalshi',
          category: 'team_market',
          marketKey: series.marketKey,
          sportKey: series.sportKey,
          sportLabel: series.sportLabel,
          marketTitle: market.title ?? market.ticker,
          outcome: outcomeLabel,
          playerName: null,
          propType: null,
          propLine: null,
        propSide: null,
        side: candidate.side,
        priceCents,
        americanOdds,
        liquidity: selectedOrder.notional,
        timestamp: new Date().toISOString(),
        eventDate: parseKalshiDate(market.ticker) ?? undefined,
        ticker: market.ticker,
        outcomeIndex: candidate.outcomeIndex,
        edgePercent,
        sportsbookNoVigProb: noVigProb,
        sportsbookBestOdds: bestPriceOdds ?? null,
        sportsbookBookKey: bestPriceBookKey,
        sportsbookBookTitle: bestPriceBookTitle,
        sharpStrength,
        reasons,
      })
      }
    }
  }

  const signals = [...kalshiSignals, ...polymarketSignals, ...teamSignals]
  cachedSignals = { fetchedAt: now, signals }
  return signals
}

export const mapLiquiditySignalsToPlayerPropTrades = (signals: PropLiquiditySignal[]) =>
  signals
    .filter((signal) => signal.category === 'player_prop')
    .map((signal) => ({
    id: signal.id,
    source: signal.source,
    sportKey: signal.sportKey,
    playerName: signal.playerName,
    propType: signal.propType,
    propLine: signal.propLine,
    side: signal.propSide,
    notional: signal.liquidity,
    americanOdds: signal.americanOdds,
    priceCents: signal.priceCents,
    tradeTime: signal.timestamp,
    eventTime: signal.eventDate ? `${signal.eventDate}T20:00:00Z` : '',
    marketTitle: signal.marketTitle,
    outcome: signal.outcome,
  }))

export const mapLiquiditySignalsToSharpTrades = (signals: PropLiquiditySignal[]) =>
  signals.map((signal) => ({
    id: `liquidity:${signal.id}`,
    source: signal.source,
    marketTitle: signal.marketTitle,
    outcome: signal.outcome,
    priceCents: signal.priceCents ?? 50,
    americanOdds: signal.americanOdds ?? null,
    sportsbookBestOdds: signal.sportsbookBestOdds ?? null,
    sportsbookBookKey: signal.sportsbookBookKey ?? null,
    sportsbookBookTitle: signal.sportsbookBookTitle ?? null,
    notional: signal.liquidity,
    contracts:
      signal.priceCents != null && signal.priceCents > 0
        ? Math.round(signal.liquidity / (signal.priceCents / 100))
        : Math.round(signal.liquidity),
    timestamp: signal.timestamp,
    sport: signal.sportLabel,
    eventDate: signal.eventDate,
    ticker: signal.ticker,
    slug: signal.slug,
    outcomeIndex: signal.outcomeIndex,
    side: signal.side ?? undefined,
    sharpStrength: signal.sharpStrength,
    isUltraSharp: true,
    ultraSharpReasons: signal.reasons,
    crossMarketEvPercent: signal.edgePercent ?? null,
  }))


