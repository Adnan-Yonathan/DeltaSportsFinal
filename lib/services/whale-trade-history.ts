import { createServiceClient } from '@/lib/supabase/service'
import { fetchWhaleTrades, type WhaleTrade } from '@/lib/services/whale-detector'
import { getCbbAdvancedRatingsSnapshot } from '@/lib/services/cbb-advanced-ratings'
import { normalizeNcaabTeamKey } from '@/lib/providers/ncaab-free-sources'
import {
  HBCU_TEAM_SET,
  P4_TEAM_SET,
  normalizeCollegeTeam,
} from '@/lib/services/sharp-projections'

type MarketType = 'spread' | 'moneyline' | 'total'

type WhaleHistoryRow = {
  matchup_key: string
  market_type: MarketType
  side: string
  notional: number | null
  trade_time: string
}

type PlayerPropRow = {
  id: string
  source: 'kalshi' | 'polymarket'
  sport_key: string
  player_name: string | null
  prop_type: string | null
  prop_line: number | null
  side: string | null
  notional: number | null
  american_odds: number | null
  price_cents: number | null
  trade_time: string
  event_time: string
  market_title: string | null
  outcome: string | null
}

export type WhaleHistorySignal = {
  marketType: MarketType
  side: string
  count: number
  totalNotional: number
  lastTradeAt: string
}

export type WhaleHistorySummary = {
  matchupKey: string
  homeTeam: string
  awayTeam: string
  eventTime: string
  signals: WhaleHistorySignal[]
  totalTrades: number
  totalNotional: number
}

export type WhaleHistoryGame = {
  homeTeam: string
  awayTeam: string
  commenceTime: string
}

export type PlayerPropWhaleTrade = {
  id: string
  source: 'kalshi' | 'polymarket'
  sportKey: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  side: string | null
  notional: number | null
  americanOdds: number | null
  priceCents: number | null
  tradeTime: string
  eventTime: string
  marketTitle: string | null
  outcome: string | null
}

const SPORT_LABEL_TO_KEY: Record<string, string> = {
  NBA: 'basketball_nba',
  WNBA: 'basketball_wnba',
  NCAAB: 'basketball_ncaab',
  NFL: 'americanfootball_nfl',
  NCAAF: 'americanfootball_ncaaf',
  NHL: 'icehockey_nhl',
  MLB: 'baseball_mlb',
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const TEAM_SPLIT_PATTERN = /\s+(?:vs\.?|v\.?|@|at)\s+/i
const EASTERN_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})
const NCAAB_MID_MAJOR_NET_RANK_MAX = 150
const SPORT_PREGAME_WINDOWS: Record<string, number> = {
  basketball_nba: 1,
  basketball_ncaab: 1,
  basketball_wnba: 1,
  baseball_mlb: 1,
  icehockey_nhl: 1,
  americanfootball_nfl: 7,
  americanfootball_ncaaf: 7,
}
const PLAYER_PROP_RECENT_WINDOW_DAYS = 7

export const resolveSportWindowDays = (sportKey: string) =>
  SPORT_PREGAME_WINDOWS[sportKey] ?? 3

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const normalizeKey = (value: string) => normalizeText(value).replace(/\s+/g, '-')

const BIG_EAST_TEAMS = [
  'Butler',
  'Creighton',
  'DePaul',
  'Georgetown',
  'Marquette',
  'Providence',
  'Seton Hall',
  "St. John's",
  'Villanova',
  'Xavier',
  'Connecticut',
]

const BIG_EAST_TEAM_SET = new Set(
  BIG_EAST_TEAMS.map((team) => normalizeCollegeTeam(team))
)

type NetRankLookup = Map<string, number>

const resolveNcaabWhaleThreshold = (
  homeTeam: string,
  awayTeam: string,
  netRanks?: NetRankLookup | null
) => {
  const home = normalizeCollegeTeam(homeTeam)
  const away = normalizeCollegeTeam(awayTeam)
  const isBigMajor =
    P4_TEAM_SET.has(home) ||
    P4_TEAM_SET.has(away) ||
    BIG_EAST_TEAM_SET.has(home) ||
    BIG_EAST_TEAM_SET.has(away)
  if (isBigMajor) return 2000
  const isSmall = HBCU_TEAM_SET.has(home) || HBCU_TEAM_SET.has(away)
  if (isSmall) return 500
  const homeRank = netRanks?.get(normalizeNcaabTeamKey(homeTeam)) ?? null
  const awayRank = netRanks?.get(normalizeNcaabTeamKey(awayTeam)) ?? null
  const isLowMajor = [homeRank, awayRank].some(
    (rank) => rank != null && rank > NCAAB_MID_MAJOR_NET_RANK_MAX
  )
  if (isLowMajor) return 500
  return 1000
}

const normalizePlayerName = (name: string): string => {
  let normalized = name.toLowerCase().trim()
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map((part) => part.trim())
    if (parts.length === 2) {
      normalized = `${parts[1]} ${parts[0]}`
    }
  }
  return normalized
    .replace(/\s+(jr\.?|sr\.?|ii|iii|iv|v)$/i, '')
    .replace(/['.]/g, '')
    .replace(/\s+/g, ' ')
}

type PlayerIndexEntry = {
  name: string
  normalized: string
  tokens: string[]
  firstName: string | null
  lastName: string | null
  firstInitial: string | null
  team?: string | null
  game?: string | null
}

type PlayerPropInfo = {
  player: PlayerIndexEntry | null
  playerName: string | null
  propType: string | null
  propLine: number | null
  side: string | null
  matchup: { away: string; home: string } | null
}

export const buildMatchupKey = (homeTeam: string, awayTeam: string) =>
  `${normalizeKey(awayTeam)}@${normalizeKey(homeTeam)}`

const formatEasternDate = (date: Date) => {
  const [month, day, year] = EASTERN_FORMATTER.format(date).split('/')
  return `${year}-${month}-${day}`
}

const parseDate = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isFinite(parsed.valueOf()) ? parsed : null
}

const resolveNflWeekStart = (dayStart: Date) => {
  const dayOfWeek = dayStart.getUTCDay()
  const offset = (dayOfWeek + 5) % 7
  return new Date(dayStart.getTime() - offset * MS_PER_DAY)
}

const resolveNflWeekWindow = (date: Date) => {
  const dateLabel = formatEasternDate(date)
  const dayStart = new Date(`${dateLabel}T00:00:00-05:00`)
  const weekStart = resolveNflWeekStart(dayStart)
  const weekEnd = new Date(weekStart.getTime() + 7 * MS_PER_DAY)
  return { weekStart, weekEnd }
}

const resolvePregameWindow = (sportKey: string, eventTime: Date) => {
  const eventDate = formatEasternDate(eventTime)
  const dayStart = new Date(`${eventDate}T00:00:00-05:00`)
  if (sportKey === 'americanfootball_nfl') {
    const weekStart = resolveNflWeekStart(dayStart)
    return { windowStart: weekStart, eventTime }
  }
  const windowDays = resolveSportWindowDays(sportKey)
  const windowStart = new Date(dayStart.getTime() - windowDays * MS_PER_DAY)
  return { windowStart, eventTime }
}

const resolvePlayerPropWindow = (sportKey: string, eventTime: Date) => {
  const eventDate = formatEasternDate(eventTime)
  const dayStart = new Date(`${eventDate}T00:00:00-05:00`)
  if (sportKey === 'americanfootball_nfl') {
    const weekStart = resolveNflWeekStart(dayStart)
    return { windowStart: weekStart, eventTime }
  }
  const windowDays = Math.max(resolveSportWindowDays(sportKey), 3)
  const windowStart = new Date(dayStart.getTime() - windowDays * MS_PER_DAY)
  return { windowStart, eventTime }
}

const parseTeamsFromTitle = (title: string) => {
  const parts = title.split(TEAM_SPLIT_PATTERN)
  if (parts.length !== 2) return null
  const away = parts[0]?.trim()
  const home = parts[1]?.trim()
  if (!away || !home) return null
  return { away, home }
}

const parseMatchupFromGameLabel = (label?: string | null) => {
  if (!label) return null
  const parts = label.split(/\s+@+\s+/)
  if (parts.length !== 2) return null
  const away = parts[0]?.trim()
  const home = parts[1]?.trim()
  if (!away || !home) return null
  return { away, home }
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

const resolvePropType = (text: string, sportKey: string) => {
  const patterns = PROP_KEYWORDS[sportKey] ?? []
  for (const entry of patterns) {
    if (entry.patterns.some((pattern) => text.includes(pattern))) {
      return entry.key
    }
  }
  return null
}

const resolvePropSide = (text: string, rawText?: string | null, tradeSide?: string | null) => {
  if (text.includes(' over ')) return 'Over'
  if (text.includes(' under ')) return 'Under'
  if (text.endsWith(' over')) return 'Over'
  if (text.endsWith(' under')) return 'Under'
  // For Kalshi "X+ yards" format, "yes" = Over, "no" = Under
  // Check raw text for "+" since normalization removes it
  if (rawText && /\d+\+/.test(rawText) && tradeSide) {
    return tradeSide.toLowerCase() === 'yes' ? 'Over' : 'Under'
  }
  return null
}

const resolvePropLine = (text: string, propType: string | null, rawText?: string | null) => {
  if (!propType) return null
  const overUnderMatch = text.match(/(?:over|under)\s+(\d+(?:\.\d+)?)/)
  if (overUnderMatch) {
    const value = Number(overUnderMatch[1])
    return Number.isFinite(value) ? value : null
  }
  // Match "records 60+ rushing yards" format (number before prop type)
  // Use raw text if available to preserve "+"
  const propPattern = propType.replace('_', ' ')
  const searchText = rawText?.toLowerCase() ?? text
  const beforeMatch = searchText.match(
    new RegExp(`(\\d+(?:\\.\\d+)?)\\+?\\s+${propPattern}`)
  )
  if (beforeMatch) {
    const value = Number(beforeMatch[1])
    return Number.isFinite(value) ? value : null
  }
  // Match "rushing yards 60" format (number after prop type)
  const afterMatch = text.match(
    new RegExp(`${propPattern}[^\\d]{0,6}(\\d+(?:\\.\\d+)?)`)
  )
  if (afterMatch) {
    const value = Number(afterMatch[1])
    return Number.isFinite(value) ? value : null
  }
  return null
}

const findPlayerMatch = (text: string, players: PlayerIndexEntry[]) => {
  if (!players.length) return null
  const textTokens = normalizeText(text).split(' ').filter(Boolean)
  const tokenSet = new Set(textTokens)
  const lastNameCounts = new Map<string, number>()
  for (const entry of players) {
    if (!entry.lastName) continue
    const count = lastNameCounts.get(entry.lastName) ?? 0
    lastNameCounts.set(entry.lastName, count + 1)
  }
  let best: { entry: PlayerIndexEntry; score: number } | null = null
  for (const entry of players) {
    if (entry.tokens.length < 2) continue
    if (entry.tokens.every((token) => tokenSet.has(token))) {
      const score = 3 + entry.tokens.length
      if (!best || score > best.score) {
        best = { entry, score }
      }
      continue
    }
    if (!entry.lastName || !tokenSet.has(entry.lastName)) continue
    const hasFirst = entry.firstName ? tokenSet.has(entry.firstName) : false
    const hasInitial = entry.firstInitial ? tokenSet.has(entry.firstInitial) : false
    const lastNameUnique = lastNameCounts.get(entry.lastName) === 1
    if (!hasFirst && !hasInitial && !lastNameUnique) continue
    const score = hasFirst ? 2.5 : hasInitial ? 2 : 1.5
    if (!best || score > best.score) {
      best = { entry, score }
    }
  }
  return best?.entry ?? null
}

const NAME_NOISE_PATTERN = new RegExp(
  '\\\\b(over|under|rushing|passing|receiving|yards?|yds?|touchdowns?|tds?|receptions?|catches|attempts?|completions?|interceptions?|points?|rebounds?|assists?|blocks?|steals?|threes?|three|three-point|3pt|3-point|line|total|team|anytime|to|score)\\\\b',
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
    new RegExp(`\\\\b(${nameToken}(?:\\\\s+${nameToken}){1,2})\\\\b`)
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

const resolveMarketType = (trade: WhaleTrade): MarketType => {
  const combined = `${trade.outcome} ${trade.marketTitle}`.toLowerCase()
  if (combined.includes('total') || combined.includes('over') || combined.includes('under')) {
    return 'total'
  }
  if (combined.includes('spread') || /[+-]\d/.test(combined)) {
    return 'spread'
  }
  return 'moneyline'
}

const resolveTotalSide = (trade: WhaleTrade): 'Over' | 'Under' | null => {
  const combined = `${trade.outcome} ${trade.marketTitle}`.toLowerCase()
  if (combined.includes('over')) return 'Over'
  if (combined.includes('under')) return 'Under'
  return null
}

const buildTokens = (value: string) =>
  normalizeText(value)
    .split(' ')
    .filter((token) => token.length > 2)

const selectionMatchesTeam = (selection: string, team: string) => {
  const selectionTokens = buildTokens(selection)
  const teamTokens = buildTokens(team)
  if (!selectionTokens.length || !teamTokens.length) return false
  const selectionJoined = selectionTokens.join(' ')
  const teamJoined = teamTokens.join(' ')
  if (selectionJoined.includes(teamJoined) || teamJoined.includes(selectionJoined)) {
    return true
  }
  return (
    teamTokens.every((token) => selectionTokens.includes(token)) ||
    selectionTokens.every((token) => teamTokens.includes(token))
  )
}

const resolveSideLabel = (
  trade: WhaleTrade,
  teams: { home: string; away: string },
  marketType: MarketType
) => {
  if (marketType === 'total') {
    return resolveTotalSide(trade)
  }
  const selection = trade.outcome || ''
  if (selectionMatchesTeam(selection, teams.home)) return teams.home
  if (selectionMatchesTeam(selection, teams.away)) return teams.away
  return selection.trim() || null
}

const resolveSportKey = (trade: WhaleTrade) =>
  SPORT_LABEL_TO_KEY[trade.sport] ?? null

const buildPlayerIndex = (players: Array<Record<string, any>>): PlayerIndexEntry[] => {
  const index: PlayerIndexEntry[] = []
  for (const player of players) {
    const name = player?.name
    if (!name || typeof name !== 'string') continue
    const normalized = normalizePlayerName(name)
    const rawTokens = normalizeText(normalized).split(' ').filter(Boolean)
    const tokens = rawTokens.filter((token) => token.length > 1)
    if (!tokens.length) continue
    const firstName = rawTokens[0] ?? null
    const lastName = rawTokens.length > 1 ? rawTokens[rawTokens.length - 1] : null
    index.push({
      name,
      normalized,
      tokens,
      firstName,
      lastName,
      firstInitial: firstName ? firstName[0] : null,
      team: player?.team ?? null,
      game: player?.game ?? null,
    })
  }
  return index
}

const loadPlayerIndexBySport = async (supabase: ReturnType<typeof createServiceClient>) => {
  const { data, error } = (await supabase
    .from('player_projections_cache' as any)
    .select('sport, players')) as unknown as {
    data: Array<{ sport: string; players: Array<Record<string, any>> }> | null
    error: { message?: string } | null
  }

  if (error || !data) {
    console.warn('[WHALE HISTORY] Failed to load player cache:', error?.message ?? error)
    return new Map<string, PlayerIndexEntry[]>()
  }

  const map = new Map<string, PlayerIndexEntry[]>()
  for (const entry of data) {
    if (!entry?.sport || !Array.isArray(entry.players)) continue
    map.set(entry.sport, buildPlayerIndex(entry.players))
  }
  return map
}

const resolvePlayerPropInfo = (
  trade: WhaleTrade,
  sportKey: string,
  players: PlayerIndexEntry[]
): PlayerPropInfo | null => {
  const rawText = `${trade.marketTitle} ${trade.outcome}`.trim()
  const text = normalizeText(rawText)
  const propType = resolvePropType(text, sportKey)
  if (!propType) return null
  const player = findPlayerMatch(text, players)
  const side = resolvePropSide(text, rawText, trade.side)
  const propLine = resolvePropLine(text, propType, rawText)
  const matchup = player ? parseMatchupFromGameLabel(player.game) : null
  const fallbackName = extractPlayerNameFromText(rawText)
  const playerName = player?.name ?? fallbackName ?? null
  if (!playerName) return null
  return { player, playerName, propType, propLine, side, matchup }
}

export const ingestWhaleTradeHistory = async ({
  sportKey,
  minNotional = 2000,
  limit = 500,
}: {
  sportKey?: string
  minNotional?: number
  limit?: number
}) => {
  const supabase = createServiceClient()
  const playerIndexBySport = await loadPlayerIndexBySport(supabase)
  let netRankLookup: NetRankLookup | null = null
  const ensureNetRankLookup = async () => {
    if (netRankLookup) return netRankLookup
    const ratings = await getCbbAdvancedRatingsSnapshot()
    const map: NetRankLookup = new Map()
    for (const entry of ratings) {
      if (!entry?.teamKey) continue
      if (!Number.isFinite(entry.netRank)) continue
      map.set(entry.teamKey, entry.netRank as number)
    }
    netRankLookup = map
    return netRankLookup
  }

  const effectiveMinNotional =
    sportKey === 'basketball_ncaab' ? Math.min(minNotional, 500) : minNotional
  const trades = await fetchWhaleTrades({ limit, minNotional: effectiveMinNotional })
  if (!trades.length) {
    return { inserted: 0, skipped: 0, attempted: 0, attemptedBySport: {} }
  }

  const rows: Array<Record<string, unknown>> = []
  let skipped = 0
  const attemptedBySport: Record<string, number> = {}

  for (const trade of trades) {
    const resolvedKey = resolveSportKey(trade)
    if (!resolvedKey || (sportKey && resolvedKey !== sportKey)) {
      skipped += 1
      continue
    }

    const eventTime = parseDate(trade.eventDate)
    const tradeTime = parseDate(trade.timestamp)
    if (!eventTime || !tradeTime) {
      skipped += 1
      continue
    }

    const playerIndex = playerIndexBySport.get(resolvedKey) ?? []
    const playerPropInfo = resolvePlayerPropInfo(trade, resolvedKey, playerIndex)
    const { windowStart } = playerPropInfo
      ? resolvePlayerPropWindow(resolvedKey, eventTime)
      : resolvePregameWindow(resolvedKey, eventTime)

    if (tradeTime < windowStart || tradeTime >= eventTime) {
      skipped += 1
      continue
    }

    if (playerPropInfo) {
      const matchup = playerPropInfo.matchup
      if (resolvedKey === 'basketball_ncaab' && matchup) {
        const ranks = await ensureNetRankLookup()
        const threshold = resolveNcaabWhaleThreshold(matchup.home, matchup.away, ranks)
        if (trade.notional < threshold) {
          skipped += 1
          continue
        }
      } else if (resolvedKey === 'basketball_ncaab' && trade.notional < 1000) {
        skipped += 1
        continue
      }
      rows.push({
        source: trade.source,
        trade_id: trade.id,
        sport_key: resolvedKey,
        event_time: eventTime.toISOString(),
        event_date: formatEasternDate(eventTime),
        trade_time: tradeTime.toISOString(),
        market_type: 'player_prop',
        side: playerPropInfo.side ?? trade.side?.toUpperCase() ?? null,
        home_team: matchup?.home ?? null,
        away_team: matchup?.away ?? null,
        matchup_key: matchup ? buildMatchupKey(matchup.home, matchup.away) : null,
        player_name: playerPropInfo.playerName,
        prop_type: playerPropInfo.propType,
        prop_line: playerPropInfo.propLine,
        market_title: trade.marketTitle,
        outcome: trade.outcome,
        notional: trade.notional,
        contracts: trade.contracts,
        price_cents: trade.priceCents,
        american_odds: trade.americanOdds,
        is_pregame: true,
      })
      attemptedBySport[resolvedKey] = (attemptedBySport[resolvedKey] ?? 0) + 1
      continue
    }

    const teams = parseTeamsFromTitle(trade.marketTitle)
    if (!teams) {
      skipped += 1
      continue
    }

    if (resolvedKey === 'basketball_ncaab') {
      const ranks = await ensureNetRankLookup()
      const threshold = resolveNcaabWhaleThreshold(teams.home, teams.away, ranks)
      if (trade.notional < threshold) {
        skipped += 1
        continue
      }
    } else if (trade.notional < minNotional) {
      skipped += 1
      continue
    }

    const marketType = resolveMarketType(trade)
    const side = resolveSideLabel(trade, teams, marketType)
    if (!side) {
      skipped += 1
      continue
    }

    rows.push({
      source: trade.source,
      trade_id: trade.id,
      sport_key: resolvedKey,
      event_time: eventTime.toISOString(),
      event_date: formatEasternDate(eventTime),
      trade_time: tradeTime.toISOString(),
      market_type: marketType,
      side,
      home_team: teams.home,
      away_team: teams.away,
      matchup_key: buildMatchupKey(teams.home, teams.away),
      market_title: trade.marketTitle,
      outcome: trade.outcome,
      notional: trade.notional,
      contracts: trade.contracts,
      price_cents: trade.priceCents,
      american_odds: trade.americanOdds,
      is_pregame: true,
    })
    attemptedBySport[resolvedKey] = (attemptedBySport[resolvedKey] ?? 0) + 1
  }

  if (rows.length === 0) {
    return { inserted: 0, skipped, attempted: 0, attemptedBySport }
  }

  const chunkSize = 200
  let inserted = 0

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('whale_trade_history' as any)
      .upsert(chunk as any, { onConflict: 'source,trade_id' } as any)
      .select('id')

    if (error) {
      console.error('[WHALE HISTORY] Upsert failed:', error)
      continue
    }

    inserted += data?.length ?? 0
  }

  return {
    inserted,
    skipped,
    attempted: rows.length,
    attemptedBySport,
  }
}

export const fetchWhaleHistoryForGames = async ({
  sportKey,
  games,
}: {
  sportKey: string
  games: WhaleHistoryGame[]
}): Promise<Map<string, WhaleHistorySummary>> => {
  const result = new Map<string, WhaleHistorySummary>()
  if (!games.length) return result

  const matchupMap = new Map<
    string,
    { homeTeam: string; awayTeam: string; eventTime: Date; windowStart: Date }
  >()

  for (const game of games) {
    const eventTime = parseDate(game.commenceTime)
    if (!eventTime) continue
    const { windowStart } = resolvePregameWindow(sportKey, eventTime)
    const matchupKey = buildMatchupKey(game.homeTeam, game.awayTeam)
    matchupMap.set(matchupKey, {
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      eventTime,
      windowStart,
    })
  }

  if (matchupMap.size === 0) return result

  const windows = Array.from(matchupMap.values())
  const minStart = windows.reduce(
    (min, entry) => (entry.windowStart < min ? entry.windowStart : min),
    windows[0].windowStart
  )
  const maxEnd = windows.reduce(
    (max, entry) => (entry.eventTime > max ? entry.eventTime : max),
    windows[0].eventTime
  )

  const supabase = createServiceClient()
  const matchupKeys = Array.from(matchupMap.keys())
  const { data, error } = (await supabase
    .from('whale_trade_history' as any)
    .select('matchup_key, market_type, side, notional, trade_time')
    .eq('sport_key', sportKey)
    .eq('is_pregame', true)
    .in('market_type', ['spread', 'moneyline', 'total'])
    .gte('trade_time', minStart.toISOString())
    .lte('trade_time', maxEnd.toISOString())
    .in('matchup_key', matchupKeys)) as unknown as {
    data: WhaleHistoryRow[] | null
    error: { message?: string } | null
  }

  if (error || !data) {
    console.warn('[WHALE HISTORY] Query failed:', error?.message ?? error)
    return result
  }

  const aggregateMap = new Map<
    string,
    Map<string, WhaleHistorySignal>
  >()

  for (const row of data) {
    const game = matchupMap.get(row.matchup_key)
    if (!game) continue
    const tradeTime = parseDate(row.trade_time)
    if (!tradeTime) continue
    if (tradeTime < game.windowStart || tradeTime >= game.eventTime) continue

    const key = `${row.market_type}:${row.side}`
    if (!aggregateMap.has(row.matchup_key)) {
      aggregateMap.set(row.matchup_key, new Map())
    }
    const sideMap = aggregateMap.get(row.matchup_key)!
    const existing = sideMap.get(key)
    const notional = row.notional ?? 0
    if (existing) {
      existing.count += 1
      existing.totalNotional += notional
      if (tradeTime.toISOString() > existing.lastTradeAt) {
        existing.lastTradeAt = tradeTime.toISOString()
      }
    } else {
      sideMap.set(key, {
        marketType: row.market_type,
        side: row.side,
        count: 1,
        totalNotional: notional,
        lastTradeAt: tradeTime.toISOString(),
      })
    }
  }

  for (const [matchupKey, sideMap] of aggregateMap.entries()) {
    const meta = matchupMap.get(matchupKey)
    if (!meta) continue
    const signals = Array.from(sideMap.values())
    const totalTrades = signals.reduce((sum, signal) => sum + signal.count, 0)
    const totalNotional = signals.reduce(
      (sum, signal) => sum + signal.totalNotional,
      0
    )
    result.set(matchupKey, {
      matchupKey,
      homeTeam: meta.homeTeam,
      awayTeam: meta.awayTeam,
      eventTime: meta.eventTime.toISOString(),
      signals,
      totalTrades,
      totalNotional,
    })
  }

  return result
}

export const fetchPlayerPropWhaleTrades = async ({
  sportKey,
  limit = 30,
}: {
  sportKey: string | 'all'
  limit?: number
}): Promise<PlayerPropWhaleTrade[]> => {
  const supabase = createServiceClient()
  const now = new Date()
  const tradeWindowStart = new Date(
    now.getTime() - PLAYER_PROP_RECENT_WINDOW_DAYS * MS_PER_DAY
  )

  // Build query
  let query = supabase
    .from('whale_trade_history' as any)
    .select(
      'id, source, sport_key, player_name, prop_type, prop_line, side, notional, american_odds, price_cents, trade_time, event_time, market_title, outcome'
    )
    .eq('market_type', 'player_prop')
    .gte('trade_time', tradeWindowStart.toISOString())
    .order('trade_time', { ascending: false })
    .limit(limit)

  // Apply sport filter if not "all"
  if (sportKey !== 'all') {
    query = query.eq('sport_key', sportKey)
  }

  const { data, error } = (await query) as unknown as {
    data: PlayerPropRow[] | null
    error: { message?: string } | null
  }

  if (error || !data) {
    console.warn('[WHALE HISTORY] Player prop lookup failed:', error?.message ?? error)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    source: row.source,
    sportKey: row.sport_key,
    playerName: row.player_name,
    propType: row.prop_type,
    propLine: row.prop_line,
    side: row.side,
    notional: row.notional,
    americanOdds: row.american_odds,
    priceCents: row.price_cents,
    tradeTime: row.trade_time,
    eventTime: row.event_time,
    marketTitle: row.market_title,
    outcome: row.outcome,
  }))
}
