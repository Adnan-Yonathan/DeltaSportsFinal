/**
 * Chat-friendly helpers for SportsBettingDime data.
 * ATS uses the database; betting splits are fetched live from SBD.
 */

import { createClient } from '@/lib/supabase/server'
import { scrapeDailySplits } from './splits-scraper'

type SharpConfidence = 'none' | 'low' | 'moderate' | 'strong'

interface SplitInference {
  publicSide?: 'home' | 'away'
  sharpSide?: 'home' | 'away'
  confidence: SharpConfidence
  note: string
}

interface MarketSummary {
  homeBets?: number
  awayBets?: number
  homeMoney?: number
  awayMoney?: number
  sharp?: string | null
}

interface GameSplitSummary {
  gameId: string
  matchup: string
  gameTime?: Date | string
  homeTeam?: string
  awayTeam?: string
  markets: Record<string, MarketSummary>
  sharpAction: Array<{ market: string; side: string }>
}

/**
 * Get ATS data for a team
 */
export async function getTeamATSData(
  teamName: string,
  sport: string = 'basketball_nba'
) {
  const supabase = createClient()

  const { data: records, error } = await supabase
    .from('team_ats_records')
    .select('*')
    .eq('sport_key', sport)
    .or(`team_name.ilike.%${teamName}%,covers_slug.ilike.%${teamName}%`)
    .order('captured_at', { ascending: false })
    .limit(1)

  if (error || !records || records.length === 0) {
    return {
      success: false,
      error: `No ATS data found for ${teamName}`
    }
  }

  const r = records[0]

  return {
    success: true,
    data: {
      team: r.team_name,
      season: r.season,
      overallATS: r.record,
      homeATS: r.home_ats_record,
      awayATS: r.away_ats_record,
      favoriteATS: r.favorite_ats_record,
      underdogATS: r.underdog_ats_record,
      overUnder: r.over_under_record,
      last10: r.last_10_ats,
      streak: r.ats_streak,
      extraSplits: r.record?.splits,
      lastUpdated: r.captured_at,
    }
  }
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const normalizeTeamLabel = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]/g, '')

const NBA_TEAM_ALIASES: Record<string, string[]> = {
  hawks: ['atlanta', 'hawks', 'atlanta hawks'],
  celtics: ['boston', 'celtics', 'boston celtics'],
  nets: ['brooklyn', 'nets', 'brooklyn nets'],
  knicks: ['new york', 'knicks', 'new york knicks', 'ny knicks'],
  sixers: ['philadelphia', '76ers', 'sixers', 'philadelphia 76ers'],
  raptors: ['toronto', 'raptors', 'toronto raptors'],
  bulls: ['chicago', 'bulls', 'chicago bulls'],
  cavaliers: ['cleveland', 'cavs', 'cavaliers', 'cleveland cavaliers'],
  pistons: ['detroit', 'pistons', 'detroit pistons'],
  pacers: ['indiana', 'pacers', 'indiana pacers'],
  bucks: ['milwaukee', 'bucks', 'milwaukee bucks'],
  heat: ['miami', 'heat', 'miami heat'],
  magic: ['orlando', 'magic', 'orlando magic'],
  hornets: ['charlotte', 'hornets', 'charlotte hornets'],
  wizards: ['washington', 'wizards', 'washington wizards'],
  nuggets: ['denver', 'nuggets', 'denver nuggets'],
  timberwolves: ['minnesota', 'timberwolves', 'wolves', 'minnesota timberwolves'],
  thunder: ['oklahoma city', 'okc', 'thunder', 'oklahoma city thunder'],
  blazers: ['portland', 'trail blazers', 'blazers', 'portland trail blazers'],
  jazz: ['utah', 'jazz', 'utah jazz'],
  warriors: ['golden state', 'warriors', 'gsw', 'golden state warriors'],
  clippers: ['los angeles clippers', 'la clippers', 'clippers'],
  lakers: ['los angeles lakers', 'la lakers', 'lakers'],
  suns: ['phoenix', 'suns', 'phoenix suns'],
  kings: ['sacramento', 'kings', 'sacramento kings'],
  mavericks: ['dallas', 'mavericks', 'mavs', 'dallas mavericks'],
  rockets: ['houston', 'rockets', 'houston rockets'],
  spurs: ['san antonio', 'spurs', 'san antonio spurs'],
  grizzlies: ['memphis', 'grizzlies', 'memphis grizzlies'],
  pelicans: ['new orleans', 'pelicans', 'pels', 'new orleans pelicans'],
}

const NBA_ALIAS_LOOKUP = Object.entries(NBA_TEAM_ALIASES)
  .flatMap(([canonical, aliases]) =>
    aliases.map((alias) => ({
      alias: normalizeTeamLabel(alias),
      canonical,
    }))
  )
  .filter((entry) => entry.alias.length)
  .sort((a, b) => b.alias.length - a.alias.length)

const resolveTeamKey = (value: string): string | null => {
  const normalized = normalizeTeamLabel(value)
  if (!normalized) return null
  for (const entry of NBA_ALIAS_LOOKUP) {
    if (normalized.includes(entry.alias)) return entry.canonical
  }
  return null
}

const buildRequestedTeamKeys = (teams: string[]): string[] => {
  const keys: string[] = []
  for (const team of teams) {
    const canonical = resolveTeamKey(team)
    const normalized = normalizeTeamLabel(team)
    if (canonical) {
      keys.push(canonical)
    } else if (normalized) {
      keys.push(normalized)
    }
  }
  return Array.from(new Set(keys))
}

const buildGameTeamKeys = (teamName: string): string[] => {
  const keys = new Set<string>()
  const canonical = resolveTeamKey(teamName)
  const normalized = normalizeTeamLabel(teamName)
  if (canonical) keys.add(canonical)
  if (normalized) keys.add(normalized)
  return Array.from(keys)
}

function splitSportKey(sportKey: string): { sport: string; league: string } {
  const parts = (sportKey || '').split('_').filter(Boolean)
  if (parts.length >= 2) {
    return { sport: parts[0], league: parts.slice(1).join('_') }
  }
  return { sport: 'basketball', league: 'nba' }
}

function inferSharpPublic(
  homeBets?: number,
  awayBets?: number,
  homeMoney?: number,
  awayMoney?: number
): SplitInference {
  const hasBets = isNumber(homeBets) && isNumber(awayBets)
  const hasMoney = isNumber(homeMoney) && isNumber(awayMoney)

  if (!hasBets || !hasMoney) {
    const publicSide =
      hasBets && homeBets !== awayBets ? (homeBets > awayBets ? 'home' : 'away') : undefined
    return {
      publicSide,
      confidence: 'none',
      note: 'Missing bet/handle percentages',
    }
  }

  const topBetsSide = homeBets >= awayBets ? 'home' : 'away'
  const topMoneySide = homeMoney >= awayMoney ? 'home' : 'away'
  const gapHandle =
    topMoneySide === 'home' ? homeMoney - homeBets : awayMoney - awayBets
  const gapBets =
    topBetsSide === 'home' ? homeBets - homeMoney : awayBets - awayMoney
  const absGap = Math.max(Math.abs(gapHandle), Math.abs(gapBets))

  const confidence: SharpConfidence =
    absGap >= 30 ? 'strong' : absGap >= 20 ? 'moderate' : absGap >= 10 ? 'low' : 'none'

  if (confidence === 'none') {
    return { confidence, note: 'Handle and bets are aligned' }
  }

  const sharpSide = gapHandle > 0 ? topMoneySide : undefined
  const publicSide = gapBets > 0 ? topBetsSide : undefined

  if (!sharpSide && publicSide) {
    return { publicSide, confidence, note: 'Public and handle align on the same side' }
  }

  return { publicSide, sharpSide, confidence, note: 'Divergence between handle and bets' }
}

function inferSharpIndicator(market: MarketSummary): string | null {
  if (
    !isNumber(market.homeBets) ||
    !isNumber(market.awayBets) ||
    !isNumber(market.homeMoney) ||
    !isNumber(market.awayMoney)
  ) {
    return null
  }

  const inference = inferSharpPublic(
    market.homeBets,
    market.awayBets,
    market.homeMoney,
    market.awayMoney
  )

  if (inference.confidence === 'none') {
    return 'neutral'
  }

  if (inference.sharpSide) {
    return `sharp_${inference.sharpSide}`
  }

  if (inference.publicSide) {
    return `public_${inference.publicSide}`
  }

  return 'neutral'
}

function mergeMoneyIntoSplits(
  betsSplits: any[],
  moneySplits: any[]
): any[] {
  const merged = new Map<string, any>()
  const teamKeyToGameId = new Map<string, string>()

  const buildTeamKey = (away?: string, home?: string): string | null => {
    if (!away || !home) return null
    const awayKey = normalizeTeamLabel(away)
    const homeKey = normalizeTeamLabel(home)
    if (!awayKey || !homeKey) return null
    return `${awayKey}@${homeKey}`
  }

  for (const split of betsSplits) {
    const gameId = split.gameId
    if (gameId) {
      merged.set(gameId, { ...split })
    }
    const teamKey = buildTeamKey(split.awayTeam, split.homeTeam)
    if (teamKey && gameId) {
      teamKeyToGameId.set(teamKey, gameId)
    }
  }

  for (const money of moneySplits) {
    let targetGameId = money.gameId
    if (!targetGameId || !merged.has(targetGameId)) {
      const teamKey = buildTeamKey(money.awayTeam, money.homeTeam)
      const mapped = teamKey ? teamKeyToGameId.get(teamKey) : undefined
      if (mapped) {
        targetGameId = mapped
      }
    }

    const existing = targetGameId ? merged.get(targetGameId) : undefined
    if (existing) {
      merged.set(targetGameId, {
        ...existing,
        spreadHomeMoneyPct: existing.spreadHomeMoneyPct ?? money.spreadHomeMoneyPct,
        spreadAwayMoneyPct: existing.spreadAwayMoneyPct ?? money.spreadAwayMoneyPct,
        totalOverMoneyPct: existing.totalOverMoneyPct ?? money.totalOverMoneyPct,
        totalUnderMoneyPct: existing.totalUnderMoneyPct ?? money.totalUnderMoneyPct,
        mlHomeMoneyPct: existing.mlHomeMoneyPct ?? money.mlHomeMoneyPct,
        mlAwayMoneyPct: existing.mlAwayMoneyPct ?? money.mlAwayMoneyPct,
      })
    } else {
      const fallbackKey = targetGameId || buildTeamKey(money.awayTeam, money.homeTeam)
      if (fallbackKey) {
        merged.set(fallbackKey, { ...money, gameId: money.gameId ?? fallbackKey })
      }
    }
  }

  return Array.from(merged.values())
}

function buildMarketSummary(
  homeBets?: number,
  awayBets?: number,
  homeMoney?: number,
  awayMoney?: number
): MarketSummary {
  const market: MarketSummary = {
    homeBets,
    awayBets,
    homeMoney,
    awayMoney,
  }
  market.sharp = inferSharpIndicator(market)
  return market
}

/**
 * Get today's betting splits
 */
export async function getCurrentBettingSplits(
  sport: string = 'basketball_nba'
) {
  const { sport: sportName, league } = splitSportKey(sport)
  const betsResult = await scrapeDailySplits(sportName, league)

  if (!betsResult.success || !betsResult.data || betsResult.data.length === 0) {
    return {
      success: false,
      error: 'No betting splits found for today'
    }
  }

  const splits = betsResult.data

  const gameMap = new Map<string, GameSplitSummary>()

  for (const split of splits) {
    if (!gameMap.has(split.gameId)) {
      gameMap.set(split.gameId, {
        gameId: split.gameId,
        matchup: `${split.awayTeam} @ ${split.homeTeam}`,
        gameTime: split.gameTime,
        homeTeam: split.homeTeam,
        awayTeam: split.awayTeam,
        markets: {},
        sharpAction: [],
      })
    }

    const game = gameMap.get(split.gameId)!

    const spreadMarket = buildMarketSummary(
      split.spreadHomeBetsPct,
      split.spreadAwayBetsPct,
      split.spreadHomeMoneyPct,
      split.spreadAwayMoneyPct
    )
    if (
      spreadMarket.homeBets != null ||
      spreadMarket.awayBets != null ||
      spreadMarket.homeMoney != null ||
      spreadMarket.awayMoney != null
    ) {
      game.markets.spread = spreadMarket
      if (spreadMarket.sharp?.startsWith('sharp_')) {
        game.sharpAction.push({
          market: 'spread',
          side: spreadMarket.sharp.replace('sharp_', ''),
        })
      }
    }

    const totalMarket = buildMarketSummary(
      split.totalOverBetsPct,
      split.totalUnderBetsPct,
      split.totalOverMoneyPct,
      split.totalUnderMoneyPct
    )
    if (
      totalMarket.homeBets != null ||
      totalMarket.awayBets != null ||
      totalMarket.homeMoney != null ||
      totalMarket.awayMoney != null
    ) {
      game.markets.total = totalMarket
      if (totalMarket.sharp?.startsWith('sharp_')) {
        game.sharpAction.push({
          market: 'total',
          side: totalMarket.sharp.replace('sharp_', ''),
        })
      }
    }
  }

  return {
    success: true,
    data: Array.from(gameMap.values())
  }
}

/**
 * Analyze splits for specific game
 */
export async function analyzeGameSplits(gameId: string, sport: string = 'basketball_nba') {
  const splitsResult = await getCurrentBettingSplits(sport)

  if (!splitsResult.success || !splitsResult.data) {
    return {
      success: false,
      error: splitsResult.error || 'No betting splits found for today'
    }
  }

  const game = splitsResult.data.find((g: GameSplitSummary) => g.gameId === gameId)
  if (!game) {
    return {
      success: false,
      error: `No splits found for game ${gameId}`
    }
  }

  const markets = Object.entries(game.markets).map(([market, data]) => ({
    market,
    homeBets: data.homeBets ?? null,
    awayBets: data.awayBets ?? null,
    homeMoney: data.homeMoney ?? null,
    awayMoney: data.awayMoney ?? null,
    sharp: data.sharp ?? null,
    divergence:
      isNumber(data.homeMoney) && isNumber(data.homeBets)
        ? Math.abs(data.homeMoney - data.homeBets)
        : null
  }))

  return {
    success: true,
    data: {
      matchup: game.matchup,
      gameTime: game.gameTime,
      markets
    }
  }
}

const MARKET_ORDER = ['spread', 'total', 'moneyline'] as const

const guessSportKey = (message?: string): string => {
  const msg = (message || '').toLowerCase()
  if (msg.match(/nfl|pro football/)) return 'americanfootball_nfl'
  if (msg.match(/ncaaf|college football|cfb/)) return 'americanfootball_ncaaf'
  if (msg.match(/ncaab|college basketball|cbb|march madness/)) return 'basketball_ncaab'
  if (msg.match(/nba|pro basketball/)) return 'basketball_nba'
  if (msg.match(/mlb|baseball/)) return 'baseball_mlb'
  if (msg.match(/nhl|hockey/)) return 'icehockey_nhl'
  return 'basketball_nba'
}

const formatPct = (value?: number | null): string =>
  isNumber(value) ? `${Math.round(value)}%` : 'n/a'

const formatGameTime = (value: Date | string | undefined, timezone: string): string => {
  if (!value) return ''
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const formatInference = (
  inference: SplitInference,
  labels: { home: string; away: string }
): string => {
  if (inference.note.startsWith('Missing')) {
    if (inference.publicSide) {
      return `public: ${labels[inference.publicSide]} (bets only; handle n/a)`
    }
    return 'handle n/a'
  }

  if (inference.confidence === 'none') {
    return 'no clear sharp/public split'
  }

  const publicLabel = inference.publicSide ? labels[inference.publicSide] : 'n/a'
  const sharpLabel = inference.sharpSide ? labels[inference.sharpSide] : 'n/a'
  return `public: ${publicLabel}; sharp: ${sharpLabel}; ${inference.confidence}`
}

function formatMarketLine(
  market: string,
  data: MarketSummary,
  labels: { home: string; away: string }
): string {
  const inference = inferSharpPublic(
    data.homeBets,
    data.awayBets,
    data.homeMoney,
    data.awayMoney
  )

  const marketLabel =
    market === 'spread' ? 'Spread' : market === 'total' ? 'Total' : 'Moneyline'

  return `${marketLabel}: ${labels.home} ${formatPct(data.homeBets)} bets / ${formatPct(data.homeMoney)} handle | ${labels.away} ${formatPct(data.awayBets)} bets / ${formatPct(data.awayMoney)} handle (${formatInference(inference, labels)})`
}

function formatGamesForChat(
  games: GameSplitSummary[],
  timezone: string,
  header: string
): string {
  const lines: string[] = [header]

  for (const game of games) {
    const matchup = game.matchup
    const when = formatGameTime(game.gameTime, timezone)
    lines.push('')
    lines.push(when ? `${matchup} - ${when}` : matchup)

    const homeLabel = game.homeTeam || matchup.split(' @ ')[1] || 'Home'
    const awayLabel = game.awayTeam || matchup.split(' @ ')[0] || 'Away'

    for (const market of MARKET_ORDER) {
      const marketData = game.markets[market]
      if (!marketData) continue
      const labels =
        market === 'total'
          ? { home: 'Over', away: 'Under' }
          : { home: homeLabel, away: awayLabel }
      lines.push(`- ${formatMarketLine(market, marketData, labels)}`)
    }
  }

  return lines.join('\n').trim()
}

function findMatchingGame(
  games: GameSplitSummary[],
  teams?: string[]
): GameSplitSummary | undefined {
  if (!teams || teams.length === 0) return undefined
  const requestedKeys = buildRequestedTeamKeys(teams)
  if (!requestedKeys.length) return undefined

  return games.find((g) => {
    const gameKeys = new Set<string>([
      ...buildGameTeamKeys(g.homeTeam || ''),
      ...buildGameTeamKeys(g.awayTeam || ''),
    ])
    if (requestedKeys.length >= 2) {
      return requestedKeys.every((key) => gameKeys.has(key))
    }
    return requestedKeys.some((key) => gameKeys.has(key))
  })
}

export async function summarizeCoversSplitsForChat(opts: {
  message?: string
  teams?: string[]
  sportKey?: string
  timezone?: string
}): Promise<string> {
  const sportKey = opts.sportKey || guessSportKey(opts.message)
  const timezone = opts.timezone || 'America/New_York'

  const splitsResult = await getCurrentBettingSplits(sportKey)
  if (!splitsResult.success || !splitsResult.data || splitsResult.data.length === 0) {
    return splitsResult.error || 'No betting splits available right now.'
  }

  const header = `Here are the latest betting splits from SportsBettingDime (${splitsResult.data.length} games):`
  return formatGamesForChat(splitsResult.data, timezone, header)
}

export async function summarizeCoversGameSplitsForChat(opts: {
  message?: string
  teams?: string[]
  gameId?: string
  sportKey?: string
  timezone?: string
}): Promise<string> {
  const sportKey = opts.sportKey || guessSportKey(opts.message)
  const timezone = opts.timezone || 'America/New_York'

  const splitsResult = await getCurrentBettingSplits(sportKey)
  if (!splitsResult.success || !splitsResult.data || splitsResult.data.length === 0) {
    return splitsResult.error || 'No betting splits available right now.'
  }

  let targetGame = splitsResult.data.find((g: GameSplitSummary) => g.gameId === opts.gameId)
  if (!targetGame) {
    targetGame = findMatchingGame(splitsResult.data, opts.teams)
  }

  if (!targetGame) {
    const available = splitsResult.data
      .map((g) => g.matchup)
      .slice(0, 6)
      .join(', ')
    return `Could not find a matching game. Available matchups: ${available}`
  }

  const header = `Betting splits for ${targetGame.matchup}:`
  return formatGamesForChat([targetGame], timezone, header)
}
