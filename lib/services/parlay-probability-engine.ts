import { resolveSportKey, normalizeTeamKey, type CanonicalSportKey } from '@/lib/identity/sport'
import { searchTeams } from '@/lib/data/team-search'
import {
  fetchSbdOdds,
  fetchSbdGamePropsList,
  fetchSbdPlayerProps,
  mapSbdOddsToOddsGames,
  resolveSbdLeague,
} from '@/lib/api/sbd'
import { MARKETS, type OddsGame } from '@/lib/types/odds'
import { americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'
import { normalCDF, oddsToImpliedProbability, probabilityToAmericanOdds } from '@/lib/utils/statistics'
import {
  projectPlayerProp,
  calculatePropProbability,
  type MatchupContext,
  type PropProjection,
  type SportKey,
} from '@/lib/services/player-prop-projector'
import { getGameRecommendations } from '@/lib/services/recommendation-engine'
import { formatProbability } from '@/lib/utils/prop-probability'

const SUPPORTED_SPORTS: CanonicalSportKey[] = [
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'icehockey_nhl',
]

const SUPPORTED_SPORT_SET = new Set(SUPPORTED_SPORTS)
const BLOCKED_SPORTS = new Set<CanonicalSportKey>(['baseball_mlb', 'soccer_fifwc'])
const LINE_TOLERANCE = 0.25

const SPREAD_STD_DEV: Record<CanonicalSportKey, number> = {
  basketball_nba: 12,
  basketball_ncaab: 11,
  americanfootball_nfl: 13,
  americanfootball_ncaaf: 14,
  icehockey_nhl: 1.6,
  baseball_mlb: 4,
  soccer_fifwc: 1.4,
}

const TOTAL_STD_DEV: Record<CanonicalSportKey, number> = {
  basketball_nba: 16,
  basketball_ncaab: 14,
  americanfootball_nfl: 10,
  americanfootball_ncaaf: 13,
  icehockey_nhl: 1.3,
  baseball_mlb: 3.5,
  soccer_fifwc: 1.2,
}

const DEFAULT_PROP_CORRELATION = 0.04

const PROP_CORRELATIONS: Record<string, Record<string, number>> = {
  points: { threes: 0.06, assists: 0.04, rebounds: 0.03, pra: 0.06 },
  threes: { points: 0.06 },
  assists: { points: 0.04, pra: 0.05 },
  rebounds: { points: 0.03, pra: 0.05 },
  pra: { points: 0.06, rebounds: 0.05, assists: 0.05 },
  passing_yards: { passing_touchdowns: 0.06, passing_completions: 0.05 },
  rushing_yards: { rushing_touchdowns: 0.05 },
  receiving_yards: { receptions: 0.05, receiving_touchdowns: 0.04 },
  receptions: { receiving_yards: 0.05 },
  goals: { shots: 0.06, points: 0.05 },
  shots: { goals: 0.06 },
}

const GAME_CORRELATIONS = {
  spreadToTotal: 0.03,
  moneylineToSpread: 0.08,
}

type LegType = 'player_prop' | 'game_spread' | 'game_total' | 'game_moneyline'

export type PlayerPropLegInput = {
  type: 'player_prop'
  playerName?: string
  propType?: string
  threshold?: number
  propDirection?: 'over' | 'under'
  homeTeam?: string
  awayTeam?: string
  marketOdds?: number
  sport?: string
}

export type GameOutcomeLegInput = {
  type: 'game_spread' | 'game_total' | 'game_moneyline'
  homeTeam?: string
  awayTeam?: string
  line?: number
  direction?: 'home' | 'away' | 'over' | 'under'
  marketOdds?: number
  sport?: string
}

export type ParlayLegInput = PlayerPropLegInput | GameOutcomeLegInput

export interface CorrelationAdjustment {
  type: 'same_player' | 'same_game'
  description: string
  adjustment: number
}

export interface ProbabilityLeg {
  type: LegType
  description: string
  probability: number
  confidence: 'low' | 'medium' | 'high'
  sport: CanonicalSportKey
  book?: string | null
  marketOdds?: number | null
  line?: number | null
  modelLine?: number | null
  modelProbability?: number | null
  impliedProbability?: number | null
  edge?: number | null
  playerName?: string
  propType?: string
  propDirection?: 'over' | 'under'
  homeTeam?: string
  awayTeam?: string
  direction?: 'home' | 'away' | 'over' | 'under'
  teamSide?: string
  gameKey?: string
}

export interface ParlayProbabilityResult {
  legs: ProbabilityLeg[]
  independentProbability: number
  correlatedProbability: number
  correlationAdjustments: CorrelationAdjustment[]
  impliedOdds: number | null
  bestBook?: string
  bestBookOdds?: number | null
  marketImpliedProbability?: number | null
  parlayEdge?: number | null
  confidence: 'low' | 'medium' | 'high'
}

type LegQuote = {
  bookKey: string
  bookTitle: string
  odds: number
  line?: number
}

type PreparedLeg = {
  type: LegType
  sport: CanonicalSportKey
  quotes: LegQuote[]
  confidence: 'low' | 'medium' | 'high'
  modelLine?: number | null
  projection?: PropProjection
  meanHomeMargin?: number
  meanTotal?: number
  playerName?: string
  propType?: string
  propDirection?: 'over' | 'under'
  threshold?: number
  homeTeam?: string
  awayTeam?: string
  direction?: 'home' | 'away' | 'over' | 'under'
  selectedTeam?: string
  actualHomeTeam?: string
  actualAwayTeam?: string
  gameKey?: string
}

type ParlayBookQuote = {
  bookKey: string
  bookTitle: string
  decimal: number
  american: number
}

const normalizeValue = (value?: string | null) => (value || '').trim()

const normalizeBookKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const normalizeMarketKey = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

const normalizePlayerName = (name: string): string => {
  if (!name) return ''
  if (name.includes(',')) {
    const parts = name.split(',').map((part) => part.trim())
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`
    }
  }
  return name
}

const normalizePlayerKey = (name: string) =>
  normalizePlayerName(name).toLowerCase().replace(/[^a-z0-9]/g, '')

const formatSignedLine = (value: number) =>
  value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1)

const formatLineValue = (value: number, type: 'spread' | 'total' | 'prop') => {
  if (type === 'spread') return formatSignedLine(value)
  return value.toFixed(1)
}

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${odds}` : `${odds}`
}

const lineMatches = (
  line: number | null | undefined,
  target: number | null | undefined
) => {
  if (line == null || !Number.isFinite(line)) return false
  if (target == null || !Number.isFinite(target)) return true
  return Math.abs(line - target) <= LINE_TOLERANCE
}

const parseOddsValue = (value: unknown): number | null => {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const normalizePropType = (input?: string | null): string | null => {
  const raw = normalizeMarketKey(String(input || ''))
  if (!raw) return null
  switch (raw) {
    case 'pts':
    case 'point':
    case 'points':
      return 'points'
    case 'reb':
    case 'rebs':
    case 'rebounds':
      return 'rebounds'
    case 'ast':
    case 'assists':
      return 'assists'
    case '3pm':
    case '3pt':
    case 'three_point':
    case 'three_points':
    case 'threes':
    case '3s':
      return 'threes'
    case 'pra':
    case 'points_rebounds_assists':
    case 'points_rebounds_assist':
      return 'pra'
    case 'points_rebounds':
    case 'points_plus_rebounds':
      return 'points_rebounds'
    case 'points_assists':
    case 'points_plus_assists':
      return 'points_assists'
    case 'rebounds_assists':
    case 'rebounds_plus_assists':
      return 'rebounds_assists'
    case 'passing_yards':
    case 'pass_yards':
      return 'passing_yards'
    case 'passing_touchdowns':
    case 'passing_tds':
    case 'pass_tds':
    case 'pass_td':
      return 'passing_touchdowns'
    case 'passing_completions':
    case 'pass_completions':
      return 'passing_completions'
    case 'passing_attempts':
    case 'pass_attempts':
      return 'passing_attempts'
    case 'rushing_yards':
    case 'rush_yards':
      return 'rushing_yards'
    case 'rushing_touchdowns':
    case 'rush_tds':
    case 'rush_touchdowns':
      return 'rushing_touchdowns'
    case 'receiving_yards':
    case 'rec_yards':
      return 'receiving_yards'
    case 'receiving_touchdowns':
    case 'rec_touchdowns':
      return 'receiving_touchdowns'
    case 'receptions':
    case 'catches':
      return 'receptions'
    case 'goals':
      return 'goals'
    case 'shots':
    case 'shots_on_goal':
      return 'shots'
    case 'blocked_shots':
    case 'blocks':
      return 'blocked_shots'
    case 'saves':
      return 'saves'
    case 'powerplay_points':
      return 'powerplay_points'
    default:
      return raw
  }
}

const normalizePropMarketKey = (value: string): string => {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, '').trim()
  if (cleaned.includes('points plus assists plus rebounds')) return 'pra'
  if (cleaned.includes('points plus rebounds')) return 'points_rebounds'
  if (cleaned.includes('points plus assists')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists')) return 'rebounds_assists'
  if (cleaned.includes('blocks plus steals')) return 'blocks_steals'
  if (cleaned.includes('passing yards')) return 'passing_yards'
  if (cleaned.includes('passing touchdowns')) return 'passing_touchdowns'
  if (cleaned.includes('passing completions')) return 'passing_completions'
  if (cleaned.includes('passing attempts')) return 'passing_attempts'
  if (cleaned.includes('interceptions')) return 'interceptions'
  if (cleaned.includes('rushing plus receiving yards')) return 'rushing_receiving_yards'
  if (cleaned.includes('rushing yards')) return 'rushing_yards'
  if (cleaned.includes('rushing touchdowns')) return 'rushing_touchdowns'
  if (cleaned.includes('receiving yards')) return 'receiving_yards'
  if (cleaned.includes('receiving touchdowns')) return 'receiving_touchdowns'
  if (cleaned.includes('receptions')) return 'receptions'
  if (cleaned.includes('touchdowns')) return 'touchdowns'
  if (cleaned.includes('blocked shots')) return 'blocked_shots'
  if (cleaned.includes('powerplay points')) return 'powerplay_points'
  if (cleaned.includes('shots on goal')) return 'shots'
  if (cleaned.includes('shots')) return 'shots'
  if (cleaned.includes('goals')) return 'goals'
  if (cleaned.includes('saves')) return 'saves'
  if (cleaned.includes('3-point')) return 'threes'
  if (cleaned.includes('points')) return 'points'
  if (cleaned.includes('rebounds')) return 'rebounds'
  if (cleaned.includes('assists')) return 'assists'
  if (cleaned.includes('steals')) return 'steals'
  if (cleaned.includes('blocks')) return 'blocks'
  return normalizeMarketKey(cleaned)
}

const resolvePropLine = (odds: any, sportsbook: any): number | null => {
  const line =
    odds?.over_points ??
    odds?.under_points ??
    odds?.over_goals ??
    odds?.under_goals ??
    odds?.over_assists ??
    odds?.under_assists ??
    odds?.over_shots_on_goal ??
    odds?.under_shots_on_goal ??
    odds?.over_shots ??
    odds?.under_shots ??
    odds?.over_blocked_shots ??
    odds?.under_blocked_shots ??
    odds?.over_saves ??
    odds?.under_saves ??
    odds?.over_powerplay_points ??
    odds?.under_powerplay_points ??
    sportsbook?.over_points ??
    sportsbook?.under_points ??
    sportsbook?.over_goals ??
    sportsbook?.under_goals ??
    sportsbook?.over_assists ??
    sportsbook?.under_assists ??
    sportsbook?.over_shots_on_goal ??
    sportsbook?.under_shots_on_goal ??
    sportsbook?.over_shots ??
    sportsbook?.under_shots ??
    sportsbook?.over_blocked_shots ??
    sportsbook?.under_blocked_shots ??
    sportsbook?.over_saves ??
    sportsbook?.under_saves ??
    sportsbook?.over_powerplay_points ??
    sportsbook?.under_powerplay_points
  const parsed = Number(line)
  return Number.isFinite(parsed) ? parsed : null
}

const matchesTeamName = (candidate: string, target: string) => {
  const a = normalizeTeamKey(candidate)
  const b = normalizeTeamKey(target)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const resolveSportFromTeams = (
  homeTeam: string,
  awayTeam: string
): CanonicalSportKey | undefined => {
  const homeMatches = searchTeams(homeTeam, { limit: 5 })
  const awayMatches = searchTeams(awayTeam, { limit: 5 })
  if (!homeMatches.length || !awayMatches.length) return undefined

  const homeScores = new Map<CanonicalSportKey, number>()
  for (const match of homeMatches) {
    const prev = homeScores.get(match.sport) ?? 0
    homeScores.set(match.sport, Math.max(prev, match.score))
  }
  const awayScores = new Map<CanonicalSportKey, number>()
  for (const match of awayMatches) {
    const prev = awayScores.get(match.sport) ?? 0
    awayScores.set(match.sport, Math.max(prev, match.score))
  }

  let best: { sport: CanonicalSportKey; score: number } | null = null
  for (const [sport, homeScore] of homeScores.entries()) {
    const awayScore = awayScores.get(sport)
    if (awayScore == null) continue
    const combined = homeScore + awayScore
    if (!best || combined > best.score) {
      best = { sport, score: combined }
    }
  }

  return best?.sport
}

const inferSportFromPropType = (
  propType?: string | null
): CanonicalSportKey | undefined => {
  const normalized = normalizePropType(propType)
  if (!normalized) return undefined
  if (
    normalized.includes('passing') ||
    normalized.includes('rushing') ||
    normalized.includes('receiving') ||
    normalized.includes('receptions') ||
    normalized.includes('touchdowns')
  ) {
    return 'americanfootball_nfl'
  }
  if (
    normalized.includes('goals') ||
    normalized.includes('shots') ||
    normalized.includes('blocked') ||
    normalized.includes('saves') ||
    normalized.includes('powerplay')
  ) {
    return 'icehockey_nhl'
  }
  return undefined
}

const resolveLegSport = (
  leg: ParlayLegInput,
  sportHint?: string
): CanonicalSportKey => {
  const explicit = resolveSportKey(leg.sport || sportHint)
  if (explicit) return explicit
  if (leg.homeTeam && leg.awayTeam) {
    const fromTeams = resolveSportFromTeams(leg.homeTeam, leg.awayTeam)
    if (fromTeams) return fromTeams
  }
  if (leg.type === 'player_prop') {
    const fromProp = inferSportFromPropType(leg.propType)
    if (fromProp) return fromProp
  }
  return 'basketball_nba'
}

const ensureSportSupported = (sport: CanonicalSportKey) => {
  if (BLOCKED_SPORTS.has(sport)) {
    throw new Error('MLB is not supported yet for parlay analysis.')
  }
  if (!SUPPORTED_SPORT_SET.has(sport)) {
    throw new Error(`Sport ${sport} is not supported for parlay analysis.`)
  }
}

const toSportKey = (sport: CanonicalSportKey): SportKey => sport as SportKey

const buildGameKey = (homeTeam: string, awayTeam: string) =>
  `${normalizeTeamKey(homeTeam)}_${normalizeTeamKey(awayTeam)}`

const matchGame = (games: OddsGame[], homeTeam: string, awayTeam: string) => {
  let best: { game: OddsGame; score: number; swapped: boolean } | null = null

  for (const game of games) {
    const direct =
      (matchesTeamName(game.home_team, homeTeam) ? 1 : 0) +
      (matchesTeamName(game.away_team, awayTeam) ? 1 : 0)
    const reverse =
      (matchesTeamName(game.home_team, awayTeam) ? 1 : 0) +
      (matchesTeamName(game.away_team, homeTeam) ? 1 : 0)
    if (direct > 0 && (!best || direct > best.score)) {
      best = { game, score: direct, swapped: false }
    }
    if (reverse > 0 && (!best || reverse > best.score)) {
      best = { game, score: reverse, swapped: true }
    }
  }

  return best
}

const buildGamePropsEntriesFromSbdPlayerProps = (payload: any) => {
  const raw = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload)
      ? payload
      : []
  const entries: any[] = []

  for (const item of raw) {
    const playerName = item?.player?.name
    if (!playerName) continue
    const teamName = item?.player?.team_name || ''
    const competition = item?.competition || {}
    const markets = Array.isArray(item?.markets) ? item.markets : []

    for (const market of markets) {
      const marketName = market?.name || ''
      const books = Array.isArray(market?.books) ? market.books : []
      const sportsbooks: any[] = []

      for (const book of books) {
        const outcomes = Array.isArray(book?.outcomes) ? book.outcomes : []
        const overOutcome = outcomes.find((o: any) => o?.type === 'over')
        const underOutcome = outcomes.find((o: any) => o?.type === 'under')
        if (!overOutcome && !underOutcome) continue

        const total = overOutcome?.total ?? underOutcome?.total
        sportsbooks.push({
          name: book?.name,
          odds: {
            over_american: overOutcome?.odds_american,
            under_american: underOutcome?.odds_american,
            over_points: total,
            under_points: total,
          },
          over_points: total,
          under_points: total,
        })
      }

      if (!sportsbooks.length) continue

      entries.push({
        player_name: playerName,
        player: { name: playerName, team: teamName },
        name: marketName,
        sportsbooks,
        sport_event: { id: competition?.id },
        competition,
      })
    }
  }

  return entries
}

const loadOddsBySport = async (
  sport: CanonicalSportKey,
  cache: Map<CanonicalSportKey, OddsGame[]>
) => {
  if (cache.has(sport)) return cache.get(sport) as OddsGame[]
  const league = resolveSbdLeague(sport)
  if (!league) {
    throw new Error(`No odds league mapping for ${sport}.`)
  }
  const payload = await fetchSbdOdds(league, { format: 'us' })
  const games = mapSbdOddsToOddsGames(league, payload, [
    MARKETS.H2H,
    MARKETS.SPREADS,
    MARKETS.TOTALS,
  ])
  cache.set(sport, games)
  return games
}

const loadPropEntries = async (
  sport: CanonicalSportKey,
  cache: Map<CanonicalSportKey, any[]>
) => {
  if (cache.has(sport)) return cache.get(sport) as any[]
  const league = resolveSbdLeague(sport)
  if (!league) {
    throw new Error(`No props league mapping for ${sport}.`)
  }

  const propsData =
    league === 'nhl'
      ? await fetchSbdPlayerProps(league, { limit: 1000 })
      : await fetchSbdGamePropsList(league, {})

  const entries =
    league === 'nhl'
      ? buildGamePropsEntriesFromSbdPlayerProps(propsData)
      : Array.isArray(propsData)
        ? propsData
        : Array.isArray(propsData?.data)
          ? propsData.data
          : []

  cache.set(sport, entries)
  return entries
}

const findPropEntry = (
  entries: any[],
  playerName: string,
  propType: string
) => {
  const normalizedTarget = normalizePlayerKey(playerName)
  const normalizedProp = normalizePropType(propType) ?? propType
  const candidates: any[] = []

  for (const entry of entries) {
    const entryPlayer = entry?.player_name || entry?.player?.name || ''
    if (!entryPlayer) continue
    const entryKey = normalizePlayerKey(entryPlayer)
    if (!entryKey) continue
    if (
      entryKey === normalizedTarget ||
      entryKey.includes(normalizedTarget) ||
      normalizedTarget.includes(entryKey)
    ) {
      const entryMarket = normalizePropMarketKey(entry?.name || '')
      if (entryMarket === normalizedProp) {
        candidates.push(entry)
      }
    }
  }

  if (!candidates.length) return null
  if (candidates.length === 1) return candidates[0]

  return candidates.sort((a, b) => {
    const aCount = Array.isArray(a?.sportsbooks) ? a.sportsbooks.length : 0
    const bCount = Array.isArray(b?.sportsbooks) ? b.sportsbooks.length : 0
    return bCount - aCount
  })[0]
}

const EXCLUDED_PROP_BOOKS = new Set([
  'consensus',
  'prizepicks',
  'sleeper',
  'thrivefantasy',
])

const extractPropQuotes = (
  entry: any,
  line: number | null,
  direction: 'over' | 'under'
): LegQuote[] => {
  const quotes = new Map<string, LegQuote>()
  const sportsbooks = Array.isArray(entry?.sportsbooks) ? entry.sportsbooks : []

  for (const sportsbook of sportsbooks) {
    const bookName = String(sportsbook?.name || '')
    if (!bookName || EXCLUDED_PROP_BOOKS.has(bookName.toLowerCase())) continue

    const odds = sportsbook?.odds || {}
    const lineValue = resolvePropLine(odds, sportsbook)
    if (!lineMatches(lineValue, line)) continue

    const oddsValue = direction === 'over'
      ? parseOddsValue(odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds)
      : parseOddsValue(odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds)

    if (oddsValue == null) continue

    const bookKey = normalizeBookKey(bookName)
    const existing = quotes.get(bookKey)
    if (!existing || oddsValue > existing.odds) {
      quotes.set(bookKey, {
        bookKey,
        bookTitle: bookName,
        odds: oddsValue,
        line: lineValue ?? undefined,
      })
    }
  }

  return Array.from(quotes.values())
}

const extractSpreadQuotes = (
  game: OddsGame,
  selectedTeam: string,
  line: number | null
): LegQuote[] => {
  const quotes = new Map<string, LegQuote>()

  for (const book of game.bookmakers || []) {
    const market = (book.markets || []).find((m) => m.key === MARKETS.SPREADS)
    if (!market) continue
    const outcomes = (market.outcomes || []).filter((o) =>
      matchesTeamName(o.name || '', selectedTeam)
    )
    if (!outcomes.length) continue
    const outcome =
      line == null
        ? outcomes
            .map((o) => ({ outcome: o, odds: parseOddsValue(o.price) }))
            .filter((entry) => entry.odds != null)
            .sort((a, b) => (b.odds as number) - (a.odds as number))[0]?.outcome
        : outcomes.find((o) => lineMatches(o.point, line))
    if (!outcome) continue
    const oddsValue = parseOddsValue(outcome.price)
    if (oddsValue == null) continue

    const bookKey = normalizeBookKey(book.key || book.title || '')
    const existing = quotes.get(bookKey)
    if (!existing || oddsValue > existing.odds) {
      quotes.set(bookKey, {
        bookKey,
        bookTitle: book.title || book.key || 'Unknown',
        odds: oddsValue,
        line: outcome.point ?? undefined,
      })
    }
  }

  return Array.from(quotes.values())
}

const extractTotalQuotes = (
  game: OddsGame,
  direction: 'over' | 'under',
  line: number | null
): LegQuote[] => {
  const quotes = new Map<string, LegQuote>()

  const isOver = direction === 'over'
  const matchesDirection = (name: string) => {
    const normalized = name.toLowerCase()
    return isOver ? normalized.startsWith('over') : normalized.startsWith('under')
  }

  for (const book of game.bookmakers || []) {
    const market = (book.markets || []).find((m) => m.key === MARKETS.TOTALS)   
    if (!market) continue
    const outcomes = (market.outcomes || []).filter((o) =>
      matchesDirection(o.name || '')
    )
    if (!outcomes.length) continue
    const outcome =
      line == null
        ? outcomes
            .map((o) => ({ outcome: o, odds: parseOddsValue(o.price) }))
            .filter((entry) => entry.odds != null)
            .sort((a, b) => (b.odds as number) - (a.odds as number))[0]?.outcome
        : outcomes.find((o) => lineMatches(o.point, line))
    if (!outcome) continue
    const oddsValue = parseOddsValue(outcome.price)
    if (oddsValue == null) continue

    const bookKey = normalizeBookKey(book.key || book.title || '')
    const existing = quotes.get(bookKey)
    if (!existing || oddsValue > existing.odds) {
      quotes.set(bookKey, {
        bookKey,
        bookTitle: book.title || book.key || 'Unknown',
        odds: oddsValue,
        line: outcome.point ?? undefined,
      })
    }
  }

  return Array.from(quotes.values())
}

const extractMoneylineQuotes = (
  game: OddsGame,
  selectedTeam: string
): LegQuote[] => {
  const quotes = new Map<string, LegQuote>()

  for (const book of game.bookmakers || []) {
    const market = (book.markets || []).find((m) => m.key === MARKETS.H2H)
    if (!market) continue
    const outcome = (market.outcomes || []).find(
      (o) => matchesTeamName(o.name || '', selectedTeam)
    )
    if (!outcome) continue
    const oddsValue = parseOddsValue(outcome.price)
    if (oddsValue == null) continue

    const bookKey = normalizeBookKey(book.key || book.title || '')
    const existing = quotes.get(bookKey)
    if (!existing || oddsValue > existing.odds) {
      quotes.set(bookKey, {
        bookKey,
        bookTitle: book.title || book.key || 'Unknown',
        odds: oddsValue,
      })
    }
  }

  return Array.from(quotes.values())
}

const buildMatchupContext = (
  entry: any,
  leg: PlayerPropLegInput
): MatchupContext | undefined => {
  const homeTeam = normalizeValue(leg.homeTeam)
  const awayTeam = normalizeValue(leg.awayTeam)
  if (!homeTeam || !awayTeam) return undefined

  const playerTeam = normalizeValue(
    entry?.player?.team || entry?.player?.team_name || ''
  )
  if (!playerTeam) return undefined

  const playerKey = normalizeTeamKey(playerTeam)
  const homeKey = normalizeTeamKey(homeTeam)
  const awayKey = normalizeTeamKey(awayTeam)
  if (!playerKey || !homeKey || !awayKey) return undefined

  if (playerKey.includes(homeKey) || homeKey.includes(playerKey)) {
    return { opponent: awayTeam, isHome: true }
  }
  if (playerKey.includes(awayKey) || awayKey.includes(playerKey)) {
    return { opponent: homeTeam, isHome: false }
  }

  return undefined
}

const resolveDirectionForTeam = (
  selectedTeam: string | undefined,
  actualHomeTeam: string | undefined,
  actualAwayTeam: string | undefined,
  fallback: 'home' | 'away'
): 'home' | 'away' => {
  if (selectedTeam && actualHomeTeam && matchesTeamName(selectedTeam, actualHomeTeam)) {
    return 'home'
  }
  if (selectedTeam && actualAwayTeam && matchesTeamName(selectedTeam, actualAwayTeam)) {
    return 'away'
  }
  return fallback
}

const calculateSpreadProbabilityFromProjection = (
  meanHomeMargin: number,
  line: number,
  direction: 'home' | 'away',
  sport: CanonicalSportKey
): number => {
  if (!Number.isFinite(meanHomeMargin) || !Number.isFinite(line)) return 0.5
  const stdDev = SPREAD_STD_DEV[sport] ?? 12
  const threshold = direction === 'home' ? -line : line
  const z = (threshold - meanHomeMargin) / stdDev
  const probability = direction === 'home' ? 1 - normalCDF(z) : normalCDF(z)
  return clampProbability(probability)
}

const calculateTotalProbabilityFromProjection = (
  meanTotal: number,
  line: number,
  direction: 'over' | 'under',
  sport: CanonicalSportKey
): number => {
  if (!Number.isFinite(meanTotal) || !Number.isFinite(line)) return 0.5
  const stdDev = TOTAL_STD_DEV[sport] ?? 14
  const z = (line - meanTotal) / stdDev
  const probability = direction === 'over' ? 1 - normalCDF(z) : normalCDF(z)
  return clampProbability(probability)
}

const calculateMoneylineProbabilityFromProjection = (
  meanHomeMargin: number,
  direction: 'home' | 'away',
  sport: CanonicalSportKey
): number => {
  if (!Number.isFinite(meanHomeMargin)) return 0.5
  const stdDev = SPREAD_STD_DEV[sport] ?? 12
  const homeWinProb = normalCDF(meanHomeMargin / stdDev)
  const probability = direction === 'home' ? homeWinProb : 1 - homeWinProb
  return clampProbability(probability)
}

const clampProbability = (value: number) => {
  if (!Number.isFinite(value)) return 0.5
  return Math.min(0.99, Math.max(0.01, value))
}

const selectBestBook = (legs: PreparedLeg[]): ParlayBookQuote => {
  if (!legs.length) {
    throw new Error('No parlay legs were provided.')
  }

  const legMaps = legs.map((leg) => {
    if (!leg.quotes.length) {
      throw new Error('Missing sportsbook odds for one or more legs.')
    }
    return new Map(leg.quotes.map((quote) => [quote.bookKey, quote]))
  })

  let intersection = new Set(legMaps[0].keys())
  for (const map of legMaps.slice(1)) {
    intersection = new Set(Array.from(intersection).filter((key) => map.has(key)))
  }

  if (!intersection.size) {
    throw new Error('No single sportsbook offers all legs in this parlay.')
  }

  let best: ParlayBookQuote | null = null
  for (const bookKey of intersection) {
    const quotes = legMaps.map((map) => map.get(bookKey) as LegQuote)
    const decimal = quotes.reduce(
      (total, quote) => total * americanToDecimal(quote.odds),
      1
    )
    const american = decimalToAmerican(decimal)
    const bookTitle = quotes.find((quote) => quote.bookTitle)?.bookTitle || bookKey

    if (!best || decimal > best.decimal) {
      best = { bookKey, bookTitle, decimal, american }
    }
  }

  if (!best) {
    throw new Error('Unable to select a sportsbook for this parlay.')
  }

  return best
}

const buildProbabilityLeg = (leg: PreparedLeg, quote: LegQuote): ProbabilityLeg => {
  const impliedProbability = oddsToImpliedProbability(quote.odds)
  let probability = impliedProbability
  let modelProbability: number | null = null
  let modelLine: number | null = null
  let description = ''
  let teamSide: string | undefined

  const matchupHome = leg.actualHomeTeam || leg.homeTeam
  const matchupAway = leg.actualAwayTeam || leg.awayTeam
  const matchupLabel = matchupHome && matchupAway ? `${matchupAway} @ ${matchupHome}` : ''
  const line = quote.line ?? leg.threshold ?? null

  if (leg.type === 'player_prop' && leg.projection && leg.propDirection) {
    if (line != null) {
      const result = calculatePropProbability(leg.projection, line, leg.propDirection)
      probability = result.probability
      modelProbability = probability
      modelLine = leg.projection.projection
      const propLabel = leg.propType?.replace(/_/g, ' ') || 'prop'
      description = `${leg.playerName} ${propLabel} ${leg.propDirection} ${formatLineValue(line, 'prop')}`
    }
  }

  if (leg.type === 'game_spread' && leg.direction) {
    teamSide = leg.selectedTeam || (leg.direction === 'home' ? matchupHome : matchupAway)
    if (line != null) {
      description = `${teamSide || 'Team'} ${formatLineValue(line, 'spread')}${
        matchupLabel ? ` (${matchupLabel})` : ''
      }`
    }
  }

  if (leg.type === 'game_spread' && leg.meanHomeMargin != null && leg.direction) {
    if (line != null) {
      probability = calculateSpreadProbabilityFromProjection(
        leg.meanHomeMargin,
        line,
        leg.direction as 'home' | 'away',
        leg.sport
      )
      modelProbability = probability
      if (leg.modelLine != null) {
        modelLine = leg.direction === 'home' ? leg.modelLine : -leg.modelLine
      }
    }
  }

  if (leg.type === 'game_total' && leg.direction) {
    if (line != null) {
      description = `${matchupLabel ? `${matchupLabel} ` : ''}total ${leg.direction} ${formatLineValue(
        line,
        'total'
      )}`
    }
  }

  if (leg.type === 'game_total' && leg.meanTotal != null && leg.direction) {
    if (line != null) {
      probability = calculateTotalProbabilityFromProjection(
        leg.meanTotal,
        line,
        leg.direction as 'over' | 'under',
        leg.sport
      )
      modelProbability = probability
      modelLine = leg.meanTotal
    }
  }

  if (leg.type === 'game_moneyline' && leg.direction) {
    teamSide = leg.selectedTeam || (leg.direction === 'home' ? matchupHome : matchupAway)
    description = `${teamSide || 'Team'} moneyline${matchupLabel ? ` (${matchupLabel})` : ''}`
  }

  if (leg.type === 'game_moneyline' && leg.meanHomeMargin != null && leg.direction) {
    probability = calculateMoneylineProbabilityFromProjection(
      leg.meanHomeMargin,
      leg.direction as 'home' | 'away',
      leg.sport
    )
    modelProbability = probability
  }

  const edge = modelProbability != null ? modelProbability - impliedProbability : null

  return {
    type: leg.type,
    description,
    probability,
    confidence: leg.confidence,
    sport: leg.sport,
    book: quote.bookTitle,
    marketOdds: quote.odds,
    line: quote.line ?? null,
    modelLine,
    modelProbability,
    impliedProbability,
    edge,
    playerName: leg.playerName,
    propType: leg.propType,
    propDirection: leg.propDirection,
    homeTeam: matchupHome,
    awayTeam: matchupAway,
    direction: leg.direction,
    teamSide,
    gameKey: leg.gameKey,
  }
}

const calculateCorrelationAdjustments = (legs: ProbabilityLeg[]): CorrelationAdjustment[] => {
  const adjustments: CorrelationAdjustment[] = []

  for (let i = 0; i < legs.length; i++) {
    for (let j = i + 1; j < legs.length; j++) {
      const a = legs[i]
      const b = legs[j]

      if (
        a.type === 'player_prop' &&
        b.type === 'player_prop' &&
        a.playerName &&
        b.playerName &&
        normalizePlayerKey(a.playerName) === normalizePlayerKey(b.playerName)
      ) {
        const propA = a.propType || ''
        const propB = b.propType || ''
        const base =
          PROP_CORRELATIONS[propA]?.[propB] ||
          PROP_CORRELATIONS[propB]?.[propA] ||
          DEFAULT_PROP_CORRELATION
        const sameDirection = a.propDirection && b.propDirection && a.propDirection === b.propDirection
        const adjustment = base * (sameDirection ? 1 : -1)
        adjustments.push({
          type: 'same_player',
          description: `Same-player props (${a.playerName})`,
          adjustment,
        })
      }

      if (a.gameKey && b.gameKey && a.gameKey === b.gameKey) {
        const spreadLeg = a.type === 'game_spread' ? a : b.type === 'game_spread' ? b : null
        const totalLeg = a.type === 'game_total' ? a : b.type === 'game_total' ? b : null
        if (spreadLeg && totalLeg && spreadLeg.line != null && totalLeg.direction) {
          const isFavorite = spreadLeg.line < 0
          const totalOver = totalLeg.direction === 'over'
          const sign = (isFavorite && totalOver) || (!isFavorite && !totalOver) ? 1 : -1
          adjustments.push({
            type: 'same_game',
            description: 'Same-game spread and total',
            adjustment: GAME_CORRELATIONS.spreadToTotal * sign,
          })
        }

        const moneylineLeg = a.type === 'game_moneyline' ? a : b.type === 'game_moneyline' ? b : null
        if (spreadLeg && moneylineLeg && spreadLeg.teamSide && moneylineLeg.teamSide) {
          const sameTeam = matchesTeamName(spreadLeg.teamSide, moneylineLeg.teamSide)
          const sign = sameTeam ? 1 : -1
          adjustments.push({
            type: 'same_game',
            description: 'Same-game moneyline and spread',
            adjustment: GAME_CORRELATIONS.moneylineToSpread * sign,
          })
        }
      }
    }
  }

  return adjustments
}

const deriveParlayConfidence = (legs: ProbabilityLeg[]): 'low' | 'medium' | 'high' => {
  if (!legs.length) return 'low'
  const scores = legs.map((leg) =>
    leg.confidence === 'high' ? 3 : leg.confidence === 'medium' ? 2 : 1
  )
  const average = scores.reduce((sum, value) => sum + value, 0) / scores.length
  if (average >= 2.6) return 'high'
  if (average >= 1.8) return 'medium'
  return 'low'
}

const formatEdge = (edge: number) =>
  `${edge >= 0 ? '+' : ''}${(edge * 100).toFixed(1)}%`

const formatParlayResult = (result: ParlayProbabilityResult): string => {
  const lines: string[] = []
  lines.push('Parlay probability (pregame)')

  if (result.bestBook && result.bestBookOdds != null) {
    lines.push(`Best same-book price: ${formatOdds(result.bestBookOdds)} (${result.bestBook})`)
  }

  lines.push(`Model probability: ${formatProbability(result.correlatedProbability)} (independent ${formatProbability(result.independentProbability)})`)

  if (result.impliedOdds != null) {
    lines.push(`Fair odds: ${formatOdds(result.impliedOdds)}`)
  }

  if (result.marketImpliedProbability != null) {
    lines.push(`Market implied probability: ${formatProbability(result.marketImpliedProbability)}`)
  }

  if (result.parlayEdge != null) {
    lines.push(`Model edge: ${formatEdge(result.parlayEdge)}`)
  }

  if (result.correlationAdjustments.length) {
    lines.push('')
    lines.push('Correlation adjustments')
    for (const adjustment of result.correlationAdjustments) {
      lines.push(`- ${adjustment.description}: ${formatEdge(adjustment.adjustment)}`)
    }
  }

  lines.push('')
  lines.push('Legs')

  result.legs.forEach((leg, index) => {
    const details: string[] = []
    if (leg.book) details.push(`book ${leg.book}`)
    if (leg.marketOdds != null) details.push(`odds ${formatOdds(leg.marketOdds)}`)
    if (leg.impliedProbability != null) details.push(`imp ${formatProbability(leg.impliedProbability)}`)
    if (leg.modelProbability != null) details.push(`model ${formatProbability(leg.modelProbability)}`)
    if (leg.edge != null) details.push(`edge ${formatEdge(leg.edge)}`)

    if (leg.modelLine != null && leg.line != null) {
      const lineType = leg.type === 'game_spread' ? 'spread' : leg.type === 'game_total' ? 'total' : 'prop'
      details.push(`model line ${formatLineValue(leg.modelLine, lineType)}`)
    }

    const detailText = details.length ? ` | ${details.join(', ')}` : ''
    lines.push(`${index + 1}. ${leg.description}${detailText}`)
  })

  return lines.join('\n')
}

const preparePlayerPropLeg = async (
  leg: PlayerPropLegInput,
  sport: CanonicalSportKey,
  propsCache: Map<CanonicalSportKey, any[]>
): Promise<PreparedLeg> => {
  const playerName = normalizeValue(leg.playerName)
  const propType = normalizePropType(leg.propType)
  const threshold = Number(leg.threshold)
  const propDirection = leg.propDirection

  if (!playerName || !propType) {
    throw new Error('Player prop legs require a player name and prop type.')
  }
  if (!Number.isFinite(threshold)) {
    throw new Error(`Player prop leg for ${playerName} is missing a valid line.`)
  }
  if (!propDirection) {
    throw new Error(`Player prop leg for ${playerName} is missing direction.`)
  }

  const entries = await loadPropEntries(sport, propsCache)
  const entry = findPropEntry(entries, playerName, propType)
  if (!entry) {
    throw new Error(`No props found for ${playerName} ${propType}.`)
  }

  const quotes = extractPropQuotes(entry, threshold, propDirection)
  if (!quotes.length) {
    throw new Error(`No sportsbook odds found for ${playerName} ${propType} at ${threshold}.`)
  }

  const matchupContext = buildMatchupContext(entry, leg)
  const projection = await projectPlayerProp(
    playerName,
    propType,
    toSportKey(sport),
    matchupContext
  )
  if (!projection) {
    throw new Error(`No projection model available for ${playerName} ${propType}.`)
  }

  return {
    type: 'player_prop',
    sport,
    quotes,
    confidence: projection.confidence || 'low',
    projection,
    playerName,
    propType,
    propDirection,
    threshold,
  }
}

const prepareGameLeg = async (
  leg: GameOutcomeLegInput,
  sport: CanonicalSportKey,
  oddsCache: Map<CanonicalSportKey, OddsGame[]>
): Promise<PreparedLeg> => {
  const homeTeam = normalizeValue(leg.homeTeam)
  const awayTeam = normalizeValue(leg.awayTeam)

  if (!homeTeam || !awayTeam) {
    throw new Error('Game legs require home and away teams.')
  }

  const oddsGames = await loadOddsBySport(sport, oddsCache)
  const match = matchGame(oddsGames, homeTeam, awayTeam)
  if (!match) {
    throw new Error(`No odds found for ${awayTeam} @ ${homeTeam}.`)
  }

  const actualHomeTeam = match.game.home_team || homeTeam
  const actualAwayTeam = match.game.away_team || awayTeam
  const gameKey = buildGameKey(actualHomeTeam, actualAwayTeam)

  const line = leg.line != null ? Number(leg.line) : null
  const direction = leg.direction

  if (leg.type === 'game_spread' && (direction !== 'home' && direction !== 'away')) {
    throw new Error(`Spread leg for ${awayTeam} @ ${homeTeam} must specify home or away.`)
  }
  if (leg.type === 'game_total' && (direction !== 'over' && direction !== 'under')) {
    throw new Error(`Total leg for ${awayTeam} @ ${homeTeam} must specify over or under.`)
  }
  if (leg.type === 'game_moneyline' && (direction !== 'home' && direction !== 'away')) {
    throw new Error(`Moneyline leg for ${awayTeam} @ ${homeTeam} must specify home or away.`)
  }

  if (
    (leg.type === 'game_spread' || leg.type === 'game_total') &&
    line != null &&
    !Number.isFinite(line)
  ) {
    throw new Error(`Game leg for ${awayTeam} @ ${homeTeam} is missing a line.`)
  }

  let quotes: LegQuote[] = []
  let resolvedDirection: 'home' | 'away' | 'over' | 'under' | undefined = direction
  let selectedTeam: string | undefined

  if (leg.type === 'game_spread') {
    selectedTeam = direction === 'home' ? homeTeam : awayTeam
    const actualDirection = resolveDirectionForTeam(
      selectedTeam,
      actualHomeTeam,
      actualAwayTeam,
      direction as 'home' | 'away'
    )
    resolvedDirection = actualDirection
    quotes = extractSpreadQuotes(match.game, selectedTeam, line)
  }

  if (leg.type === 'game_total') {
    resolvedDirection = direction
    quotes = extractTotalQuotes(match.game, direction as 'over' | 'under', line)
  }

  if (leg.type === 'game_moneyline') {
    selectedTeam = direction === 'home' ? homeTeam : awayTeam
    const actualDirection = resolveDirectionForTeam(
      selectedTeam,
      actualHomeTeam,
      actualAwayTeam,
      direction as 'home' | 'away'
    )
    resolvedDirection = actualDirection
    quotes = extractMoneylineQuotes(match.game, selectedTeam)
  }

  if (!quotes.length) {
    throw new Error(`No sportsbook odds found for ${awayTeam} @ ${homeTeam}.`)
  }

  let modelLine: number | null = null
  let meanHomeMargin: number | undefined
  let meanTotal: number | undefined
  let confidence: 'low' | 'medium' | 'high' = 'low'

  const marketType = leg.type === 'game_total' ? 'total' : 'spread'
  try {
    const recs = await getGameRecommendations(
      actualHomeTeam,
      actualAwayTeam,
      marketType,
      sport
    )
    const rec = recs.find((item) => item.type === marketType)
    if (rec) {
      confidence = rec.confidence || 'low'

      if (marketType === 'spread') {
        modelLine = rec.targetLine
        meanHomeMargin = -rec.targetLine
      } else if (marketType === 'total') {
        modelLine = rec.targetLine
        meanTotal = rec.targetLine
      }
    }
  } catch (error) {
    console.warn(
      `[PARLAY_PROBABILITY] Model unavailable for ${awayTeam} @ ${homeTeam}:`,
      error
    )
  }

  return {
    type: leg.type,
    sport,
    quotes,
    confidence,
    modelLine,
    meanHomeMargin,
    meanTotal,
    homeTeam,
    awayTeam,
    actualHomeTeam,
    actualAwayTeam,
    direction: resolvedDirection,
    selectedTeam,
    threshold: line ?? undefined,
    gameKey,
  }
}

export async function calculateParlayProbability(
  legs: ParlayLegInput[],
  opts: { sport?: string } = {}
): Promise<ParlayProbabilityResult> {
  if (!legs || !legs.length) {
    throw new Error('At least one leg is required for parlay analysis.')
  }

  const oddsCache = new Map<CanonicalSportKey, OddsGame[]>()
  const propsCache = new Map<CanonicalSportKey, any[]>()
  const prepared: PreparedLeg[] = []

  for (const leg of legs) {
    const sport = resolveLegSport(leg, opts.sport)
    ensureSportSupported(sport)

    if (leg.type === 'player_prop') {
      prepared.push(await preparePlayerPropLeg(leg, sport, propsCache))
    } else {
      prepared.push(await prepareGameLeg(leg, sport, oddsCache))
    }
  }

  const bestBook = selectBestBook(prepared)

  const probabilityLegs: ProbabilityLeg[] = []
  let independentProbability = 1

  for (const leg of prepared) {
    const quote = leg.quotes.find((q) => q.bookKey === bestBook.bookKey)
    if (!quote) {
      throw new Error(`No odds found at ${bestBook.bookTitle} for one of the legs.`)
    }
    const probabilityLeg = buildProbabilityLeg(leg, quote)
    independentProbability *= probabilityLeg.probability
    probabilityLegs.push(probabilityLeg)
  }

  const correlationAdjustments = calculateCorrelationAdjustments(probabilityLegs)
  let correlatedProbability = independentProbability
  for (const adjustment of correlationAdjustments) {
    correlatedProbability *= 1 + adjustment.adjustment
  }

  correlatedProbability = clampProbability(correlatedProbability)

  const impliedOdds = Number.isFinite(correlatedProbability)
    ? probabilityToAmericanOdds(correlatedProbability)
    : null

  const marketImpliedProbability = Number.isFinite(bestBook.american)
    ? oddsToImpliedProbability(bestBook.american)
    : null

  const parlayEdge =
    marketImpliedProbability != null
      ? correlatedProbability - marketImpliedProbability
      : null

  const confidence = deriveParlayConfidence(probabilityLegs)

  return {
    legs: probabilityLegs,
    independentProbability,
    correlatedProbability,
    correlationAdjustments,
    impliedOdds,
    bestBook: bestBook.bookTitle,
    bestBookOdds: bestBook.american,
    marketImpliedProbability,
    parlayEdge,
    confidence,
  }
}

export async function calculateCombinedPlayerProps(
  props: Array<{
    playerName: string
    propType: string
    threshold: number
    direction: 'over' | 'under'
    sport?: string
  }>
) {
  const legs: ParlayLegInput[] = props.map((prop) => ({
    type: 'player_prop',
    playerName: prop.playerName,
    propType: prop.propType,
    threshold: prop.threshold,
    propDirection: prop.direction,
    sport: prop.sport,
  }))
  return calculateParlayProbability(legs, { sport: props[0]?.sport })
}

export function formatParlayResultForChat(result: ParlayProbabilityResult): string {
  return formatParlayResult(result)
}

