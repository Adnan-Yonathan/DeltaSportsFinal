import { fetchSbdGamePropsList, resolveSbdLeague } from '@/lib/api/sbd'
import { evaluatePropEdge, type EdgeAssessment } from '@/lib/analysis/bet-tools'
import {
  calculateOverProbability,
  calculateOverProbabilityNormal,
  calculateUnderProbability,
} from '@/lib/utils/prop-probability'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'
import {
  getPlayerSeasonStats,
  getTeamStats,
  type PlayerStats,
  type TeamStats,
} from '@/lib/sports-stats-api'

type PropDirection = 'over' | 'under'

export interface PlayerPropEdge {
  player: string
  team?: string
  opponent?: string
  game?: string
  market: string
  line: number
  direction: PropDirection
  projection: number
  edgePoints: number
  edgePercent: number
  modelProbability: number
  impliedProbability: number
  bestBook?: string
  bestOdds?: number
  verdict: EdgeAssessment
  factors: string[]
  sampleSize: number
}

export interface SlatePropEdgeResult {
  sport: string
  sportLabel: string
  date: string
  propsAnalyzed: number
  edges: PlayerPropEdge[]
  summary: {
    strongEdges: number
    softEdges: number
    noEdges: number
  }
}

const SUPPORTED_PROP_SPORTS = new Set([
  'basketball_nba',
  'basketball_ncaab',
  'americanfootball_nfl',
  'americanfootball_ncaaf',
  'icehockey_nhl',
])

const PROP_MARKETS_BY_SPORT: Record<string, string[]> = {
  basketball_nba: ['points', 'rebounds', 'assists', 'threes', 'pra'],
  basketball_ncaab: ['points', 'rebounds', 'assists', 'threes'],
  americanfootball_nfl: [
    'passing_yards',
    'passing_touchdowns',
    'passing_completions',
    'passing_attempts',
    'interceptions',
    'rushing_yards',
    'rushing_touchdowns',
    'receiving_yards',
    'receptions',
    'receiving_touchdowns',
  ],
  americanfootball_ncaaf: [
    'passing_yards',
    'passing_touchdowns',
    'rushing_yards',
    'receiving_yards',
    'receptions',
    'rushing_receiving_yards',
    'longest_reception',
    'touchdowns',
  ],
  icehockey_nhl: [
    'goals',
    'assists',
    'points',
    'shots',
    'blocked_shots',
    'saves',
    'powerplay_points',
  ],
}

const MARKET_TO_SBD_PROP: Record<string, string | undefined> = {
  points: 'total points (incl. overtime)',
  rebounds: 'total rebounds (incl. overtime)',
  assists: 'total assists (incl. overtime)',
  threes: 'total 3-point field goals (incl. overtime)',
  points_rebounds: 'total points plus rebounds (incl. extra overtime)',
  points_assists: 'total points plus assists (incl. extra overtime)',
  pra: 'total points plus assists plus rebounds (incl. extra overtime)',
  rebounds_assists: 'total rebounds plus assists (incl. extra overtime)',
  blocks: 'total blocks (incl. extra overtime)',
  steals: 'total steals (incl. extra overtime)',
  blocks_steals: 'total blocks plus steals (incl. extra overtime)',
  passing_yards: 'total passing yards (incl. overtime)',
  passing_touchdowns: 'total passing touchdowns (incl. overtime)',
  passing_completions: 'total pass completions (incl. overtime)',
  passing_attempts: 'total passing attempts (incl. overtime)',
  interceptions: 'total passing interceptions (incl. overtime)',
  rushing_yards: 'total rushing yards (incl. overtime)',
  rushing_touchdowns: undefined,
  receiving_yards: 'total receiving yards (incl. overtime)',
  receptions: 'total receptions (incl. overtime)',
  receiving_touchdowns: undefined,
  touchdowns: undefined,
  rushing_receiving_yards: 'total rushing plus receiving yards (incl. overtime)',
  longest_reception: 'longest reception (incl. overtime)',
  goals: 'goals',
  shots: 'shots',
  blocked_shots: 'blocked shots',
  saves: 'saves',
  powerplay_points: 'powerplay points',
}

const EXCLUDED_BOOKS = new Set(['consensus', 'prizepicks', 'thrivefantasy', 'sleeper'])
const PREFERRED_BOOKS = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle']
const PROP_EDGE_THRESHOLDS = { soft: 3, strong: 7 }
// Base line delta thresholds by sport (for yardage props)
const PROP_LINE_DELTA: Record<string, number> = {
  basketball_nba: 2,
  basketball_ncaab: 1.5,
  americanfootball_nfl: 10,
  americanfootball_ncaaf: 12,
  icehockey_nhl: 0.5,
}

// Market-specific line delta thresholds (overrides sport default)
const MARKET_LINE_DELTA: Record<string, number> = {
  // NFL counting stats need lower thresholds
  receptions: 0.5,
  passing_touchdowns: 0.3,
  rushing_touchdowns: 0.3,
  receiving_touchdowns: 0.3,
  interceptions: 0.3,
  // NBA
  threes: 0.5,
  blocks: 0.3,
  steals: 0.3,
  // NHL
  goals: 0.3,
  assists: 0.3,
  points: 0.5,
}

type LeagueAverages = {
  points?: number
  rebounds?: number
  assists?: number
  threes?: number
  pace?: number
  goalsAgainst?: number
  goalsFor?: number
}

const LEAGUE_AVG_FALLBACK: Record<string, LeagueAverages> = {
  basketball_nba: { points: 114, rebounds: 44, assists: 26, threes: 13, pace: 100 },
  basketball_ncaab: { points: 71, rebounds: 35, assists: 13, threes: 7, pace: 70 },
  icehockey_nhl: { goalsAgainst: 3.1, goalsFor: 3.1 },
}

type LineBucket = {
  line: number
  over: Array<{ book: string; odds: number }>
  under: Array<{ book: string; odds: number }>
}

const normalizeToken = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '')

/**
 * Normalize player name from "Last, First" to "First Last" format
 * SBD returns names in "Last, First" format which doesn't match ESPN lookups
 */
const normalizePlayerName = (name: string): string => {
  if (!name) return name
  // Check for "Last, First" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim())
    if (parts.length >= 2) {
      return `${parts[1]} ${parts[0]}`
    }
  }
  return name
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

const normalizeMarketKey = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

const normalizeSbdPropName = (value: string): string => {
  const cleaned = value.toLowerCase().replace(/\(.*?\)/g, '').trim()
  if (cleaned.includes('points plus assists plus rebounds')) return 'pra'
  if (cleaned.includes('points plus rebounds')) return 'points_rebounds'
  if (cleaned.includes('points plus assists')) return 'points_assists'
  if (cleaned.includes('rebounds plus assists')) return 'rebounds_assists'
  if (cleaned.includes('blocks plus steals')) return 'blocks_steals'
  if (cleaned.includes('passing yards')) return 'passing_yards'
  if (cleaned.includes('passing touchdowns')) return 'passing_touchdowns'
  if (cleaned.includes('rushing plus receiving yards')) return 'rushing_receiving_yards'
  if (cleaned.includes('longest reception')) return 'longest_reception'
  if (cleaned.includes('passing completions')) return 'passing_completions'
  if (cleaned.includes('passing attempts')) return 'passing_attempts'
  if (cleaned.includes('interceptions')) return 'interceptions'
  if (cleaned.includes('rushing yards')) return 'rushing_yards'
  if (cleaned.includes('rushing touchdowns')) return 'rushing_touchdowns'
  if (cleaned.includes('receiving yards')) return 'receiving_yards'
  if (cleaned.includes('receiving touchdowns')) return 'receiving_touchdowns'
  if (cleaned === 'receptions' || cleaned.includes('receptions')) return 'receptions'
  if (cleaned.includes('touchdowns')) return 'touchdowns'
  if (cleaned.includes('blocked shots')) return 'blocked_shots'
  if (cleaned.includes('powerplay points')) return 'powerplay_points'
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

const parseOddsValue = (value: any): number | null => {
  if (value == null) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed > 1 && parsed < 10) {
    if (parsed >= 2) return Math.round((parsed - 1) * 100)
    return Math.round(-100 / (parsed - 1))
  }
  return Math.round(parsed)
}

const parseLineValue = (value: any): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const pickStatValue = (
  statMap: Record<string, number>,
  keys: string[]
): number | null => {
  for (const key of keys) {
    const val = statMap[key]
    if (typeof val === 'number' && Number.isFinite(val)) return val
  }
  return null
}

const getPropStatFromMap = (
  statMap: Record<string, number>,
  propType: string
): number | null => {
  const pts = pickStatValue(statMap, ['PTS', 'POINTS', 'PPG'])
  const reb = pickStatValue(statMap, ['REB', 'REBOUNDS', 'TRB', 'RPG', 'TOTAL_REBOUNDS'])
  const ast = pickStatValue(statMap, ['AST', 'ASSISTS', 'APG'])
  const threes = pickStatValue(statMap, [
    '3PM',
    '3PT',
    '3P',
    '3PTM',
    'THREE_PM',
    'THREE_POINTERS_MADE',
    'FG3M',
    '3FGM',
  ])
  const blk = pickStatValue(statMap, ['BLK', 'BLOCKS', 'BPG'])
  const stl = pickStatValue(statMap, ['STL', 'STEALS', 'SPG'])
  const passingYards = pickStatValue(statMap, [
    'PASSING_YARDS',
    'PASS_YARDS',
    'PYDS',
    'PASSING_YDS',
    'PASS_YDS',
  ])
  const passingTds = pickStatValue(statMap, [
    'PASSING_TDS',
    'PASS_TDS',
    'PASS_TD',
    'PASSING_TOUCHDOWNS',
  ])
  const passingCompletions = pickStatValue(statMap, [
    'COMPLETIONS',
    'PASS_COMPLETIONS',
    'PASS_COMP',
    'CMP',
    'PASSING_COMPLETIONS',
  ])
  const passingAttempts = pickStatValue(statMap, [
    'ATTEMPTS',
    'PASS_ATTEMPTS',
    'PASS_ATT',
    'PASSING_ATTEMPTS',
  ])
  const interceptions = pickStatValue(statMap, [
    'INTERCEPTIONS',
    'INT',
  ])
  const rushingYards = pickStatValue(statMap, [
    'RUSHING_YARDS',
    'RUSH_YARDS',
    'RYDS',
    'RUSH_YDS',
  ])
  const rushingTds = pickStatValue(statMap, [
    'RUSHING_TDS',
    'RUSH_TDS',
    'RUSH_TD',
    'RUSHING_TOUCHDOWNS',
  ])
  const receivingYards = pickStatValue(statMap, [
    'RECEIVING_YARDS',
    'REC_YARDS',
    'RECYDS',
    'RECEIVING_YDS',
  ])
  const receptions = pickStatValue(statMap, ['RECEPTIONS', 'REC'])
  const receivingTds = pickStatValue(statMap, [
    'RECEIVING_TDS',
    'RECEIVING_TOUCHDOWNS',
    'REC_TDS',
    'REC_TD',
  ])
  const longestReception = pickStatValue(statMap, [
    'LONG_RECEPTION',
    'LONGEST_RECEPTION',
    'LONG_REC',
  ])
  const totalYards = pickStatValue(statMap, [
    'TOTAL_YARDS',
    'TOTAL_YARDS_FROM_SCRIMMAGE',
    'YARDS_FROM_SCRIMMAGE',
  ])
  const totalTds = pickStatValue(statMap, ['TOTAL_TDS', 'TDS', 'TD'])
  const goals = pickStatValue(statMap, ['GOALS', 'goals'])
  const assists = pickStatValue(statMap, ['ASSISTS', 'assists', 'AST'])
  const points = pickStatValue(statMap, ['POINTS', 'points', 'PTS'])
  const shots = pickStatValue(statMap, ['SHOTS', 'shots'])
  const blockedShots = pickStatValue(statMap, ['BLOCKED_SHOTS', 'blockedShots', 'blocked_shots'])
  const saves = pickStatValue(statMap, ['SAVES', 'saves'])
  const powerplayPoints = pickStatValue(statMap, [
    'POWERPLAY_POINTS',
    'powerPlayPoints',
    'powerplayPoints',
  ])

  switch (propType) {
    case 'points':
      return pts ?? points ?? (goals != null && assists != null ? goals + assists : null)
    default:
      return pts ?? points
    case 'rebounds':
      return reb
    case 'assists':
      return ast ?? assists
    case 'threes':
      return threes
    case 'blocks':
      return blk
    case 'steals':
      return stl
    case 'passing_yards':
      return passingYards
    case 'passing_touchdowns':
      return passingTds ?? totalTds
    case 'passing_completions':
      return passingCompletions
    case 'passing_attempts':
      return passingAttempts
    case 'interceptions':
      return interceptions
    case 'rushing_yards':
      return rushingYards
    case 'rushing_touchdowns':
      return rushingTds ?? totalTds
    case 'receiving_yards':
      return receivingYards
    case 'receptions':
      return receptions
    case 'receiving_touchdowns':
      return receivingTds ?? totalTds
    case 'rushing_receiving_yards':
      return totalYards ?? (rushingYards != null && receivingYards != null ? rushingYards + receivingYards : null)
    case 'longest_reception':
      return longestReception
    case 'touchdowns':
      return totalTds
    case 'goals':
      return goals
    case 'shots':
      return shots
    case 'blocked_shots':
      return blockedShots
    case 'saves':
      return saves
    case 'powerplay_points':
      return powerplayPoints
    case 'points_rebounds':
      return pts != null && reb != null ? pts + reb : null
    case 'points_assists':
      return pts != null && ast != null ? pts + ast : null
    case 'rebounds_assists':
      return reb != null && ast != null ? reb + ast : null
    case 'pra':
      return pts != null && reb != null && ast != null ? pts + reb + ast : null
    case 'blocks_steals':
      return blk != null && stl != null ? blk + stl : null
  }
}

const getRecentValues = (
  recent: PlayerStats['recent'],
  propType: string
): number[] => {
  if (!recent || !recent.length) return []
  return recent
    .map((game) => getPropStatFromMap(game.stats, propType))
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
}

const average = (values: number[]): number | null => {
  if (!values.length) return null
  const total = values.reduce((sum, val) => sum + val, 0)
  return total / values.length
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const getTeamStat = (stats: Record<string, any>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = toNumber(stats[key])
    if (value != null) return value
  }
  return null
}

const formatPct = (value: number) => {
  if (!Number.isFinite(value)) return 'n/a'
  const pct = value <= 1 ? value * 100 : value
  return `${pct.toFixed(1)}%`
}

const formatEasternDate = (value: Date): string => {
  const easternFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const [month, day, year] = easternFormatter.format(value).split('/')
  return `${year}-${month}-${day}`
}

const resolveDateFilter = (value?: string): string | null => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return null
}

const getEntryStartTime = (entry: any): string | null => {
  const start =
    entry?.start_time ||
    entry?.sport_event?.start_time ||
    entry?.sport_event?.startTime ||
    entry?.sport_event?.start_date ||
    entry?.sport_event?.startDate ||
    entry?.sport_event?.scheduled
  return typeof start === 'string' ? start : null
}

const entryMatchesDate = (entry: any, targetDate: string): boolean => {
  const start = getEntryStartTime(entry)
  if (!start) return false
  const parsed = new Date(start)
  if (Number.isNaN(parsed.getTime())) return false
  return formatEasternDate(parsed) === targetDate
}

const resolveTeamPerGameStat = (
  stats: Record<string, any>,
  perGameKeys: string[],
  totalKeys: string[]
) => {
  const perGame = getTeamStat(stats, perGameKeys)
  if (perGame != null) return perGame
  const total = getTeamStat(stats, totalKeys)
  const games = getTeamStat(stats, ['gamesPlayed'])
  if (total != null && games && games > 0) return total / games
  return null
}

type FootballLeagueContext = {
  playsPerGame?: number
  passRate?: number
  rushRate?: number
  yardsAllowedPerGame?: number
  pointsAllowedPerGame?: number
  sacksPerGame?: number
  interceptionsPerGame?: number
}

const buildFootballLeagueContext = (teams: TeamStats[]): FootballLeagueContext | null => {
  if (!teams.length) return null
  let plays = 0
  let passRate = 0
  let rushRate = 0
  let yardsAllowed = 0
  let pointsAllowed = 0
  let counts = 0
  let sacksPerGame = 0
  let sacksCount = 0
  let interceptionsPerGame = 0
  let interceptionsCount = 0

  for (const team of teams) {
    const stats = (team.stats || {}) as Record<string, any>
    const playsPerGame = resolveTeamPerGameStat(
      stats,
      ['playsPerGame'],
      ['totalOffensivePlays']
    )
    const teamPassRate = getTeamStat(stats, ['passRate'])
    const teamRushRate = getTeamStat(stats, ['rushRate'])
    const allowedYards = getTeamStat(stats, ['yardsAllowedPerGame', 'yardsAllowed'])
    const allowedPoints = getTeamStat(stats, ['pointsAgainstPerGame', 'pointsAgainst'])
    const defensiveSacksPerGame = resolveTeamPerGameStat(
      stats,
      ['defensiveSacksPerGame'],
      ['defensiveSacks']
    )
    const defensiveInterceptionsPerGame = resolveTeamPerGameStat(
      stats,
      ['defensiveInterceptionsPerGame'],
      ['defensiveInterceptions']
    )

    if (
      playsPerGame == null &&
      teamPassRate == null &&
      teamRushRate == null &&
      allowedYards == null &&
      allowedPoints == null
    ) {
      continue
    }

    counts += 1
    plays += playsPerGame ?? 0
    passRate += teamPassRate ?? 0
    rushRate += teamRushRate ?? 0
    yardsAllowed += allowedYards ?? 0
    pointsAllowed += allowedPoints ?? 0
    if (defensiveSacksPerGame != null) {
      sacksPerGame += defensiveSacksPerGame
      sacksCount += 1
    }
    if (defensiveInterceptionsPerGame != null) {
      interceptionsPerGame += defensiveInterceptionsPerGame
      interceptionsCount += 1
    }
  }

  if (!counts) return null

  return {
    playsPerGame: plays ? plays / counts : undefined,
    passRate: passRate ? passRate / counts : undefined,
    rushRate: rushRate ? rushRate / counts : undefined,
    yardsAllowedPerGame: yardsAllowed ? yardsAllowed / counts : undefined,
    pointsAllowedPerGame: pointsAllowed ? pointsAllowed / counts : undefined,
    sacksPerGame: sacksCount ? sacksPerGame / sacksCount : undefined,
    interceptionsPerGame: interceptionsCount ? interceptionsPerGame / interceptionsCount : undefined,
  }
}

const computeFootballProjection = (opts: {
  market: string
  baseAvg: number
  recentAvg?: number | null
  statMap: Record<string, number>
  teamStats?: Record<string, any>
  opponentStats?: Record<string, any>
  leagueContext?: FootballLeagueContext | null
  isHome?: boolean
}) => {
  const {
    market,
    baseAvg,
    recentAvg,
    statMap,
    teamStats = {},
    opponentStats = {},
    leagueContext,
    isHome,
  } = opts

  const recentFactor =
    recentAvg && recentAvg > 0 ? clamp(recentAvg / baseAvg, 0.85, 1.15) : 1
  const homeFactor = isHome == null ? 1 : isHome ? 1.02 : 0.98

  const teamPlays = resolveTeamPerGameStat(
    teamStats,
    ['playsPerGame'],
    ['totalOffensivePlays']
  )
  const oppPlays = resolveTeamPerGameStat(
    opponentStats,
    ['playsPerGame'],
    ['totalOffensivePlays']
  )
  const paceAvg =
    teamPlays != null && oppPlays != null
      ? (teamPlays + oppPlays) / 2
      : teamPlays ?? oppPlays ?? null
  const paceFactor =
    paceAvg != null && leagueContext?.playsPerGame
      ? clamp(paceAvg / leagueContext.playsPerGame, 0.9, 1.1)
      : 1

  const teamPassRate = getTeamStat(teamStats, ['passRate'])
  const teamRushRate = getTeamStat(teamStats, ['rushRate'])
  const passRateFactor =
    teamPassRate != null && leagueContext?.passRate
      ? clamp(teamPassRate / leagueContext.passRate, 0.9, 1.1)
      : 1
  const rushRateFactor =
    teamRushRate != null && leagueContext?.rushRate
      ? clamp(teamRushRate / leagueContext.rushRate, 0.9, 1.1)
      : 1

  const passingAttempts = pickStatValue(statMap, [
    'PASSING_ATTEMPTS',
    'PASS_ATTEMPTS',
    'PASS_ATT',
  ])
  const passingYpa = pickStatValue(statMap, [
    'YARDS_PER_PASS_ATTEMPT',
    'YPA',
  ])
  const passingTdPct = pickStatValue(statMap, ['PASSING_TD_PCT'])
  const rushingAttempts = pickStatValue(statMap, [
    'RUSHING_ATTEMPTS',
    'RUSH_ATTEMPTS',
    'RUSH_ATT',
  ])
  const rushingYpa = pickStatValue(statMap, ['YARDS_PER_RUSH_ATTEMPT'])
  const receivingTargets = pickStatValue(statMap, [
    'RECEIVING_TARGETS',
    'TARGETS',
  ])
  const receivingYards = pickStatValue(statMap, ['RECEIVING_YARDS', 'REC_YARDS'])
  const receptions = pickStatValue(statMap, ['RECEPTIONS', 'REC'])
  const yardsPerReception = pickStatValue(statMap, ['YARDS_PER_RECEPTION'])
  const longReception = pickStatValue(statMap, ['LONG_RECEPTION'])
  const completionPct = pickStatValue(statMap, ['COMPLETION_PCT'])
  const qbr = pickStatValue(statMap, ['QBR', 'ADJ_QBR', 'ESPN_QBR'])

  const yardsPerTarget =
    receivingTargets && receivingYards ? receivingYards / receivingTargets : null
  const catchRate =
    receivingTargets && receptions ? receptions / receivingTargets : null

  const teamPassAttempts = resolveTeamPerGameStat(
    teamStats,
    ['passingAttemptsPerGame'],
    ['passingAttempts']
  )
  const teamRushAttempts = resolveTeamPerGameStat(
    teamStats,
    ['rushingAttemptsPerGame'],
    ['rushingAttempts']
  )

  const factors: string[] = [
    `Base avg: ${baseAvg.toFixed(1)}`,
    recentAvg != null ? `Recent avg: ${recentAvg.toFixed(1)}` : 'Recent avg: n/a',
  ]

  if (passingAttempts != null && teamPassAttempts != null && teamPassAttempts > 0) {
    const share = passingAttempts / teamPassAttempts
    factors.push(`Usage: ${formatPct(share)} of team pass attempts`)
  }
  if (rushingAttempts != null && teamRushAttempts != null && teamRushAttempts > 0) {
    const share = rushingAttempts / teamRushAttempts
    factors.push(`Rush share: ${formatPct(share)} of team rush attempts`)
  }
  if (receivingTargets != null && teamPassAttempts != null && teamPassAttempts > 0) {
    const share = receivingTargets / teamPassAttempts
    factors.push(`Target share: ${formatPct(share)} of team attempts`)
  }

  if (passingYpa != null) factors.push(`YPA: ${passingYpa.toFixed(2)}`)
  if (rushingYpa != null) factors.push(`YPC: ${rushingYpa.toFixed(2)}`)
  if (yardsPerReception != null) factors.push(`YPR: ${yardsPerReception.toFixed(2)}`)
  if (yardsPerTarget != null) factors.push(`YPT: ${yardsPerTarget.toFixed(2)}`)
  if (completionPct != null) factors.push(`Comp%: ${formatPct(completionPct)}`)
  if (catchRate != null) factors.push(`Catch%: ${formatPct(catchRate)}`)
  if (qbr != null) factors.push(`QBR: ${qbr.toFixed(1)}`)

  let opportunityProjection: number | null = null
  if (market === 'passing_yards' && passingAttempts != null && passingYpa != null) {
    opportunityProjection = passingAttempts * passingYpa
  } else if (market === 'passing_touchdowns' && passingAttempts != null && passingTdPct != null) {
    opportunityProjection = passingAttempts * (passingTdPct / 100)
  } else if (market === 'rushing_yards' && rushingAttempts != null && rushingYpa != null) {
    opportunityProjection = rushingAttempts * rushingYpa
  } else if (market === 'receiving_yards' && receivingTargets != null && yardsPerTarget != null) {
    opportunityProjection = receivingTargets * yardsPerTarget
  } else if (market === 'receptions' && receivingTargets != null && catchRate != null) {
    opportunityProjection = receivingTargets * catchRate
  } else if (market === 'rushing_receiving_yards') {
    const rushPart =
      rushingAttempts != null && rushingYpa != null ? rushingAttempts * rushingYpa : 0
    const recPart =
      receivingTargets != null && yardsPerTarget != null
        ? receivingTargets * yardsPerTarget
        : 0
    opportunityProjection = rushPart + recPart
  } else if (market === 'longest_reception') {
    if (longReception != null) {
      opportunityProjection = longReception * 0.7
      factors.push(`Longest rec baseline: ${longReception.toFixed(1)} (damped)`)
    } else if (yardsPerReception != null && receptions != null && receptions > 0) {
      const scale = Math.min(4, 1.1 + Math.log(receptions + 1))
      opportunityProjection = yardsPerReception * scale
    }
  }

  const projectionBase =
    opportunityProjection != null
      ? baseAvg * 0.6 + opportunityProjection * 0.4
      : baseAvg

  const opponentYardsAllowed = resolveTeamPerGameStat(
    opponentStats,
    ['yardsAllowedPerGame'],
    ['yardsAllowed', 'totalYardsAllowed', 'opponentTotalYards']
  )
  const opponentPointsAllowed = resolveTeamPerGameStat(
    opponentStats,
    ['pointsAgainstPerGame', 'pointsAllowedPerGame', 'pointsAllowed'],
    ['pointsAgainst', 'pointsAllowed']
  )
  const opponentSacksPerGame = resolveTeamPerGameStat(
    opponentStats,
    ['defensiveSacksPerGame'],
    ['defensiveSacks']
  )
  const opponentIntsPerGame = resolveTeamPerGameStat(
    opponentStats,
    ['defensiveInterceptionsPerGame'],
    ['defensiveInterceptions']
  )

  const yardageMarkets = new Set([
    'passing_yards',
    'rushing_yards',
    'receiving_yards',
    'rushing_receiving_yards',
    'longest_reception',
  ])
  const volumeMarkets = new Set(['passing_attempts', 'passing_completions', 'receptions'])
  const tdMarkets = new Set(['passing_touchdowns', 'rushing_touchdowns', 'receiving_touchdowns', 'touchdowns'])
  const passingMarkets = new Set([
    'passing_yards',
    'passing_touchdowns',
    'passing_attempts',
    'passing_completions',
    'receiving_yards',
    'receptions',
    'longest_reception',
  ])

  if (opponentPointsAllowed != null || opponentYardsAllowed != null) {
    const parts: string[] = []
    if (opponentPointsAllowed != null) parts.push(`${opponentPointsAllowed.toFixed(1)} PA/G`)
    if (opponentYardsAllowed != null) parts.push(`${opponentYardsAllowed.toFixed(1)} YDS/G allowed`)
    if (parts.length) factors.push(`Opponent defense: ${parts.join(', ')}`)
  }
  if (opponentSacksPerGame != null && passingMarkets.has(market)) {
    factors.push(`Opp sacks: ${opponentSacksPerGame.toFixed(2)} per game`)
  }
  if (opponentIntsPerGame != null && market === 'interceptions') {
    factors.push(`Opp INTs: ${opponentIntsPerGame.toFixed(2)} per game`)
  }

  const yardsFactor =
    opponentYardsAllowed != null && leagueContext?.yardsAllowedPerGame
      ? clamp(opponentYardsAllowed / leagueContext.yardsAllowedPerGame, 0.85, 1.15)
      : 1
  const pointsFactor =
    opponentPointsAllowed != null && leagueContext?.pointsAllowedPerGame
      ? clamp(opponentPointsAllowed / leagueContext.pointsAllowedPerGame, 0.85, 1.15)
      : 1
  const pressureFactor =
    opponentSacksPerGame != null && leagueContext?.sacksPerGame && passingMarkets.has(market)
      ? clamp(1 - (opponentSacksPerGame / leagueContext.sacksPerGame - 1) * 0.08, 0.9, 1.05)
      : 1
  const interceptionFactor =
    opponentIntsPerGame != null && leagueContext?.interceptionsPerGame
      ? clamp(opponentIntsPerGame / leagueContext.interceptionsPerGame, 0.85, 1.2)
      : 1

  let opponentFactor = 1
  if (yardageMarkets.has(market) || volumeMarkets.has(market)) {
    opponentFactor = yardsFactor
  } else if (tdMarkets.has(market)) {
    opponentFactor = pointsFactor
  } else if (market === 'interceptions') {
    opponentFactor = interceptionFactor !== 1 ? interceptionFactor : pointsFactor
  }
  opponentFactor = clamp(opponentFactor * pressureFactor, 0.85, 1.15)

  const schemeFactor = ['passing_yards', 'passing_touchdowns', 'receiving_yards', 'receptions', 'longest_reception'].includes(market)
    ? passRateFactor
    : ['rushing_yards', 'rushing_receiving_yards'].includes(market)
      ? rushRateFactor
      : 1

  const combined =
    1 +
    (paceFactor - 1) * 0.35 +
    (schemeFactor - 1) * 0.25 +
    (opponentFactor - 1) * 0.25 +
    (recentFactor - 1) * 0.3 +
    (homeFactor - 1)

  const projection = clamp(projectionBase * combined, 0, projectionBase * 1.5)

  if (paceFactor !== 1) factors.push(`Pace adj: ${paceFactor.toFixed(2)}x`)
  if (schemeFactor !== 1) factors.push(`Script adj: ${schemeFactor.toFixed(2)}x`)
  if (opponentFactor !== 1) factors.push(`Opponent adj: ${opponentFactor.toFixed(2)}x`)
  factors.push(`Projection: ${projection.toFixed(1)}`)

  return {
    projection,
    factors,
    meta: { paceFactor, schemeFactor, opponentFactor, recentFactor, homeFactor },
  }
}

const matchTeamEntry = (team: TeamStats, teamName: string): boolean => {
  const target = normalizeToken(teamName)
  if (!target) return false
  const name = normalizeToken(team.team)
  const abbr = normalizeToken((team as any).teamAbbr || '')
  return (
    name === target ||
    name.endsWith(target) ||
    target.endsWith(name) ||
    (abbr ? (abbr === target || abbr.endsWith(target) || target.endsWith(abbr)) : false)
  )
}

const leagueAverageCache = new Map<string, { ts: number; data: LeagueAverages }>()
const LEAGUE_AVG_TTL = 1000 * 60 * 15

const getLeagueAverages = async (sportKey: string): Promise<LeagueAverages> => {
  const cached = leagueAverageCache.get(sportKey)
  if (cached && Date.now() - cached.ts < LEAGUE_AVG_TTL) return cached.data

  if (sportKey === 'icehockey_nhl') {
    const teams = await getTeamStats(sportKey)
    const fallback = LEAGUE_AVG_FALLBACK[sportKey] || { goalsAgainst: 3.1, goalsFor: 3.1 }
    if (!teams.length) return fallback

    let count = 0
    let goalsAgainst = 0
    let goalsFor = 0

    for (const team of teams) {
      const stats = (team.stats || {}) as Record<string, any>
      const gamesPlayed = getTeamStat(stats, ['gamesPlayed'])
      const ga = getTeamStat(stats, ['goalsAgainst'])
      const gf = getTeamStat(stats, ['goalsFor'])
      const gaPer = ga != null && gamesPlayed ? ga / gamesPlayed : null
      const gfPer = gf != null && gamesPlayed ? gf / gamesPlayed : null
      if (gaPer == null && gfPer == null) continue
      count += 1
      goalsAgainst += gaPer ?? fallback.goalsAgainst ?? 3.1
      goalsFor += gfPer ?? fallback.goalsFor ?? 3.1
    }

    if (!count) return fallback
    const averages = {
      goalsAgainst: goalsAgainst / count,
      goalsFor: goalsFor / count,
    }
    leagueAverageCache.set(sportKey, { ts: Date.now(), data: averages })
    return averages
  }

  if (sportKey !== 'basketball_nba' && sportKey !== 'basketball_ncaab') {
    return LEAGUE_AVG_FALLBACK[sportKey] || LEAGUE_AVG_FALLBACK.basketball_nba
  }

  const teams = await getTeamStats(sportKey)
  const fallback =
    LEAGUE_AVG_FALLBACK[sportKey] ??
    LEAGUE_AVG_FALLBACK.basketball_nba ??
    { points: 114, rebounds: 44, assists: 26, threes: 13, pace: 100 }

  if (!teams.length) return fallback

  let count = 0
  let points = 0
  let rebounds = 0
  let assists = 0
  let threes = 0
  let pace = 0

  for (const team of teams) {
    const stats = (team.stats || {}) as Record<string, any>
    const oppPts = getTeamStat(stats, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPpg'])
    const oppReb = getTeamStat(stats, ['opponentReboundsPerGame', 'opponentRebounds'])
    const oppAst = getTeamStat(stats, ['opponentAssistsPerGame', 'opponentAssists'])
    const opp3pm = getTeamStat(stats, ['opponentThreePointMadePerGame', 'opponentThreePointMade'])
    const teamPace = getTeamStat(stats, ['pace'])
    if (oppPts == null && oppReb == null && oppAst == null && opp3pm == null && teamPace == null) {
      continue
    }
    count++
    points += oppPts ?? fallback.points ?? 0
    rebounds += oppReb ?? fallback.rebounds ?? 0
    assists += oppAst ?? fallback.assists ?? 0
    threes += opp3pm ?? fallback.threes ?? 0
    pace += teamPace ?? fallback.pace ?? 0
  }

  if (!count) return fallback

  const averages = {
    points: points / count,
    rebounds: rebounds / count,
    assists: assists / count,
    threes: threes / count,
    pace: pace / count,
  }

  leagueAverageCache.set(sportKey, { ts: Date.now(), data: averages })
  return averages
}

const computeProjection = (sportKey: string, opts: {
  baseAvg: number
  recentAvg?: number | null
  opponentAllowed?: number | null
  teamPace?: number | null
  opponentPace?: number | null
  leagueAverages: LeagueAverages
  statKey: string
  isHome?: boolean
}) => {
  const recentFactor =
    opts.recentAvg && opts.recentAvg > 0
      ? clamp(opts.recentAvg / opts.baseAvg, 0.85, 1.15)
      : 1
  const homeFactor = opts.isHome == null ? 1 : opts.isHome ? 1.02 : 0.98

  if (sportKey === 'icehockey_nhl') {
    const league = opts.leagueAverages
    const baseline =
      opts.statKey === 'saves'
        ? league.goalsFor
        : league.goalsAgainst
    const opponentAllowed = opts.opponentAllowed ?? baseline ?? opts.baseAvg
    const opponentFactor =
      baseline != null && baseline > 0
        ? clamp(opponentAllowed / baseline, 0.85, 1.15)
        : 1
    const combined =
      1 +
      (opponentFactor - 1) * 0.35 +
      (recentFactor - 1) * 0.35 +
      (homeFactor - 1)
    return {
      projection: clamp(opts.baseAvg * combined, 0, opts.baseAvg * 1.3),
      factors: {
        opponentFactor,
        paceFactor: 1,
        recentFactor,
        homeFactor,
      },
    }
  }

  if (sportKey !== 'basketball_nba' && sportKey !== 'basketball_ncaab') {
    const combined = 1 + (recentFactor - 1) * 0.35 + (homeFactor - 1)
    return {
      projection: clamp(opts.baseAvg * combined, 0, opts.baseAvg * 1.3),
      factors: {
        opponentFactor: 1,
        paceFactor: 1,
        recentFactor,
        homeFactor,
      },
    }
  }

  const league = opts.leagueAverages
  const leagueBaseline =
    opts.statKey === 'pra'
      ? (league.points ?? 0) + (league.rebounds ?? 0) + (league.assists ?? 0)
      : (league as Record<string, number>)[opts.statKey]
  const opponentAllowed = opts.opponentAllowed ?? leagueBaseline ?? opts.baseAvg
  const paceAvg =
    opts.teamPace != null && opts.opponentPace != null
      ? (opts.teamPace + opts.opponentPace) / 2
      : opts.teamPace ?? opts.opponentPace ?? league.pace ?? 100

  const opponentFactor = clamp(opponentAllowed / (leagueBaseline || 1), 0.85, 1.15)
  const paceFactor = clamp(paceAvg / (league.pace ?? 100), 0.9, 1.1)
  const combined =
    1 +
    (opponentFactor - 1) * 0.6 +
    (paceFactor - 1) * 0.5 +
    (recentFactor - 1) * 0.4 +
    (homeFactor - 1)

  return {
    projection: clamp(opts.baseAvg * combined, 0, opts.baseAvg * 1.4),
    factors: {
      opponentFactor,
      paceFactor,
      recentFactor,
      homeFactor,
    },
  }
}

const buildLineBuckets = (sportsbooks: any[]): Map<number, LineBucket> => {
  const buckets = new Map<number, LineBucket>()

  for (const sportsbook of sportsbooks) {
    const name = String(sportsbook?.name || '')
    if (!name || EXCLUDED_BOOKS.has(name.toLowerCase())) continue

    const odds = sportsbook?.odds || {}
    const line = parseLineValue(
      odds?.over_points ?? odds?.under_points ?? sportsbook?.over_points ?? sportsbook?.under_points
    )
    const overOdds = parseOddsValue(odds?.over_american ?? odds?.over_decimal ?? sportsbook?.over_odds)
    const underOdds = parseOddsValue(odds?.under_american ?? odds?.under_decimal ?? sportsbook?.under_odds)
    if (!Number.isFinite(line) || line === 0) continue

    if (!buckets.has(line)) {
      buckets.set(line, { line, over: [], under: [] })
    }
    const bucket = buckets.get(line)!
    if (Number.isFinite(overOdds)) bucket.over.push({ book: name, odds: overOdds! })
    if (Number.isFinite(underOdds)) bucket.under.push({ book: name, odds: underOdds! })
  }

  return buckets
}

const pickPrimaryLine = (buckets: Map<number, LineBucket>): LineBucket | null => {
  if (!buckets.size) return null
  let best: LineBucket | null = null
  let bestScore = -1

  for (const bucket of buckets.values()) {
    const uniqueBooks = new Set([
      ...bucket.over.map((b) => b.book.toLowerCase()),
      ...bucket.under.map((b) => b.book.toLowerCase()),
    ])
    let preferredHits = 0
    for (const preferred of PREFERRED_BOOKS) {
      if (uniqueBooks.has(preferred.toLowerCase())) preferredHits += 1
    }
    const score = uniqueBooks.size + preferredHits * 0.5
    if (!best || score > bestScore) {
      best = bucket
      bestScore = score
    }
  }

  return best
}

const pickBestOdds = (entries: Array<{ book: string; odds: number }>) => {
  if (!entries.length) return null
  return entries.reduce((best, current) => (current.odds > best.odds ? current : best))
}

const computeHitRate = (values: number[], line: number, direction: PropDirection) => {
  if (!values.length) return null
  const isInteger = Number.isInteger(line)
  const hits = values.filter((value) =>
    direction === 'over' ? value > line : isInteger ? value <= line : value < line
  )
  return hits.length / values.length
}

const computeModelProbabilities = (
  projection: number,
  line: number,
  market: string
) => {
  const normalMarkets = new Set([
    'points',
    'pra',
    'passing_yards',
    'rushing_receiving_yards',
    'rushing_yards',
    'receiving_yards',
    'passing_completions',
    'passing_attempts',
    'receptions',
    'longest_reception',
    'shots',
    'blocked_shots',
    'saves',
    'powerplay_points',
  ])
  if (normalMarkets.has(market)) {
    const overProb = calculateOverProbabilityNormal(projection, line)
    return {
      over: overProb,
      under: 1 - overProb,
    }
  }

  const threshold = Math.floor(line) + 1
  const overProb = calculateOverProbability(projection, threshold)
  const underProb = calculateUnderProbability(projection, threshold)
  return { over: overProb, under: underProb }
}

const resolveOpponentStat = (
  sportKey: string,
  market: string,
  stats: Record<string, any>
): number | null => {
  if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
    const points = getTeamStat(stats, ['pointsAgainstPerGame', 'pointsAgainst', 'oppPpg'])
    const rebounds = getTeamStat(stats, ['opponentReboundsPerGame', 'opponentRebounds'])
    const assists = getTeamStat(stats, ['opponentAssistsPerGame', 'opponentAssists'])

    switch (market) {
      case 'points':
        return points
      case 'rebounds':
        return rebounds
      case 'assists':
        return assists
      case 'threes':
        return getTeamStat(stats, ['opponentThreePointMadePerGame', 'opponentThreePointMade'])
      case 'pra':
        if (points != null && rebounds != null && assists != null) {
          return points + rebounds + assists
        }
        return points
      default:
        return null
    }
  }

  if (sportKey === 'icehockey_nhl') {
    const gamesPlayed = getTeamStat(stats, ['gamesPlayed'])
    const goalsAgainst = getTeamStat(stats, ['goalsAgainst', 'goalAgainst'])
    const goalsFor = getTeamStat(stats, ['goalsFor', 'goalFor'])
    const gaPer = goalsAgainst != null && gamesPlayed ? goalsAgainst / gamesPlayed : null
    const gfPer = goalsFor != null && gamesPlayed ? goalsFor / gamesPlayed : null

    switch (market) {
      case 'goals':
      case 'assists':
      case 'points':
      case 'shots':
      case 'blocked_shots':
      case 'powerplay_points':
        return gaPer
      case 'saves':
        return gfPer
      default:
        return null
    }
  }

  return null
}

export async function analyzeSlatePropEdges(
  sportKey: string,
  options: {
    limit?: number
    minEdgePercent?: number
    minEdge?: 'soft' | 'strong'
    minBooks?: number
    markets?: string[]
    date?: string // YYYY-MM-DD (America/New_York)
    teams?: string[] // Filter to specific teams (e.g., ["Lakers", "Celtics"] for a matchup)
  } = {}
): Promise<SlatePropEdgeResult> {
  const {
    limit = 30,
    minEdgePercent = PROP_EDGE_THRESHOLDS.soft,
    minEdge,
    minBooks = 2,
    date,
    teams,
  } = options
  const sportLabel =
    sportKey === 'basketball_ncaab'
      ? 'NCAAB'
      : sportKey === 'basketball_nba'
        ? 'NBA'
        : sportKey === 'americanfootball_nfl'
          ? 'NFL'
          : sportKey === 'americanfootball_ncaaf'
            ? 'NCAAF'
            : sportKey === 'icehockey_nhl'
              ? 'NHL'
              : sportKey.toUpperCase()

  if (!SUPPORTED_PROP_SPORTS.has(sportKey)) {
    const dateLabel = resolveDateFilter(date) || new Date().toISOString().split('T')[0]
    return {
      sport: sportKey,
      sportLabel,
      date: dateLabel,
      propsAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0 },
    }
  }

  const league = resolveSbdLeague(sportKey)
  if (!league) {
    const dateLabel = resolveDateFilter(date) || new Date().toISOString().split('T')[0]
    return {
      sport: sportKey,
      sportLabel,
      date: dateLabel,
      propsAnalyzed: 0,
      edges: [],
      summary: { strongEdges: 0, softEdges: 0, noEdges: 0 },
    }
  }

  const marketKeys = options.markets?.length ? options.markets : PROP_MARKETS_BY_SPORT[sportKey]
  const isBasketball = sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab'
  const isFootball = sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf'
  const needsTeamStats = isBasketball || isFootball
  const shouldFilterProps = isBasketball || sportKey === 'icehockey_nhl'
  const propsFilter = shouldFilterProps
    ? marketKeys
        .map((key) => MARKET_TO_SBD_PROP[key])
        .filter((value): value is string => Boolean(value))
    : []

  let propEntries: any[] = []
  try {
    propEntries = await fetchSbdGamePropsList(league, {
      props: propsFilter.length ? propsFilter : undefined,
      limit: 1200,
    })
  } catch (error) {
    console.error('[SLATE PROP] Failed to fetch props list:', error)
    propEntries = []
  }

  const [teamStats, leagueAverages] = await Promise.all([
    needsTeamStats ? getTeamStats(sportKey) : Promise.resolve([] as TeamStats[]),
    getLeagueAverages(sportKey),
  ])
  const footballLeagueContext = isFootball ? buildFootballLeagueContext(teamStats) : null

  const entries = Array.isArray(propEntries)
    ? propEntries
    : Array.isArray((propEntries as any)?.data)
      ? (propEntries as any).data
      : []
  const targetDate = resolveDateFilter(date)
  let filteredEntries = targetDate
    ? entries.filter((entry: any) => entryMatchesDate(entry, targetDate))
    : entries

  // Filter by teams if specified (for matchup-specific queries)
  if (teams && teams.length > 0) {
    const normalizedTeams = teams.map((t) => normalizeToken(t))
    filteredEntries = filteredEntries.filter((entry: any) => {
      const homeTeam = normalizeToken(entry?.home_team?.name || '')
      const awayTeam = normalizeToken(entry?.away_team?.name || '')
      const playerTeam = normalizeToken(entry?.player?.team || entry?.team || '')
      // Check if either team in the matchup matches any of the requested teams
      return normalizedTeams.some(
        (t) =>
          homeTeam.includes(t) ||
          t.includes(homeTeam) ||
          awayTeam.includes(t) ||
          t.includes(awayTeam) ||
          playerTeam.includes(t) ||
          t.includes(playerTeam)
      )
    })
    console.log(`[SLATE PROP] Filtered to ${filteredEntries.length} entries for teams: ${teams.join(', ')}`)
  }

  const edges: PlayerPropEdge[] = []
  let strongEdges = 0
  let softEdges = 0
  let noEdges = 0

  for (const entry of filteredEntries) {
    const rawPlayerName = entry?.player_name || entry?.player?.name
    if (!rawPlayerName) continue

    // Normalize player name from "Last, First" to "First Last" format
    const playerName = normalizePlayerName(rawPlayerName)

    const market = normalizeSbdPropName(entry?.name || '')
    if (marketKeys.length && !marketKeys.includes(market)) continue

    const sportsbooks = Array.isArray(entry?.sportsbooks) ? entry.sportsbooks : []
    const buckets = buildLineBuckets(sportsbooks)
    const primary = pickPrimaryLine(buckets)
    if (!primary) continue

    const bestOver = pickBestOdds(primary.over)
    const bestUnder = pickBestOdds(primary.under)
    const totalBooks = new Set([
      ...primary.over.map((o) => o.book.toLowerCase()),
      ...primary.under.map((o) => o.book.toLowerCase()),
    ]).size
    if (totalBooks < minBooks) continue

    const homeTeam = entry?.home_team?.name || ''
    const awayTeam = entry?.away_team?.name || ''
    const gameDescription = homeTeam && awayTeam ? `${awayTeam} @ ${homeTeam}` : undefined
    const playerTeam = entry?.player?.team || entry?.team || ''
    const isHome =
      playerTeam && homeTeam ? normalizeToken(playerTeam) === normalizeToken(homeTeam) : undefined
    const opponentName =
      playerTeam && homeTeam && awayTeam
        ? isHome
          ? awayTeam
          : homeTeam
        : undefined

    const opponentTeam = opponentName
      ? teamStats.find((team) => matchTeamEntry(team, opponentName))
      : null

    const playerStats = await getPlayerSeasonStats(playerName, sportKey)
    if (!playerStats) continue

    const seasonAvg =
      sportKey === 'basketball_ncaab'
        ? null
        : getPropStatFromMap(playerStats.stats as Record<string, number>, market)
    const recentValues = getRecentValues(playerStats.recent, market)
    const recentAvg = average(recentValues)
    const baseAvg = seasonAvg ?? recentAvg
    if (baseAvg == null) continue

    const opponentStats = (opponentTeam?.stats || {}) as Record<string, any>
    const opponentAllowed = resolveOpponentStat(sportKey, market, opponentStats)
    const teamEntry = playerTeam
      ? teamStats.find((team) => matchTeamEntry(team, playerTeam))
      : null
    const teamPace = teamEntry ? getTeamStat(teamEntry.stats as Record<string, any>, ['pace']) : null
    const oppPace = opponentTeam ? getTeamStat(opponentStats, ['pace']) : null

    const footballProjection = isFootball
      ? computeFootballProjection({
          market,
          baseAvg,
          recentAvg,
          statMap: playerStats.stats as Record<string, number>,
          teamStats: teamEntry?.stats as Record<string, any>,
          opponentStats,
          leagueContext: footballLeagueContext,
          isHome,
        })
      : null

    const projectionInfo = !isFootball
      ? computeProjection(sportKey, {
          baseAvg,
          recentAvg,
          opponentAllowed,
          teamPace,
          opponentPace: oppPace,
          leagueAverages,
          statKey: market,
          isHome,
        })
      : null

    const projection = footballProjection?.projection ?? projectionInfo?.projection ?? baseAvg
    const probabilities = computeModelProbabilities(projection, primary.line, market)
    const overProb = probabilities.over
    const underProb = probabilities.under
    const impliedOver = bestOver ? oddsToImpliedProbability(bestOver.odds) : null
    const impliedUnder = bestUnder ? oddsToImpliedProbability(bestUnder.odds) : null

    const overEdge = impliedOver != null ? (overProb - impliedOver) * 100 : -Infinity
    const underEdge = impliedUnder != null ? (underProb - impliedUnder) * 100 : -Infinity

    const direction: PropDirection = overEdge >= underEdge ? 'over' : 'under'
    const edgePercent = direction === 'over' ? overEdge : underEdge
    if (!Number.isFinite(edgePercent) || edgePercent < minEdgePercent) {
      noEdges++
      continue
    }

    const lineDelta = projection - primary.line
    const edgePoints = direction === 'over' ? lineDelta : -lineDelta
    // Use market-specific threshold if available, otherwise fall back to sport default
    const lineDeltaThreshold = MARKET_LINE_DELTA[market] ?? PROP_LINE_DELTA[sportKey] ?? 2
    const recentOverHitRate = computeHitRate(recentValues, primary.line, 'over')
    const recentUnderHitRate = computeHitRate(recentValues, primary.line, 'under')

    const edgeAssessment = evaluatePropEdge({
      line: primary.line,
      direction,
      seasonHitRate: direction === 'over' ? overProb : underProb,
      lastTenHitRate: direction === 'over' ? recentOverHitRate : recentUnderHitRate,
      seasonAvg: projection,
      lineDeltaThreshold,
    })

    if (edgeAssessment.verdict === 'none') {
      noEdges++
      continue
    }

    if (edgeAssessment.verdict === 'strong') strongEdges++
    else softEdges++

    if (minEdge === 'strong' && edgeAssessment.verdict !== 'strong') {
      continue
    }

    const factors: string[] = []
    if (footballProjection) {
      factors.push(...footballProjection.factors)
    } else {
      const opponentAllowedLabel =
        opponentAllowed != null ? `Opponent allowed: ${opponentAllowed.toFixed(1)}` : 'Opponent allowed: n/a'
      const opponentAdjLabel = projectionInfo
        ? `Opponent adj: ${projectionInfo.factors.opponentFactor.toFixed(2)}x`
        : 'Opponent adj: n/a'
      const paceAdjLabel = projectionInfo
        ? `Pace adj: ${projectionInfo.factors.paceFactor.toFixed(2)}x`
        : 'Pace adj: n/a'
      factors.push(
        `Base avg: ${baseAvg.toFixed(1)}`,
        recentAvg != null ? `Recent avg: ${recentAvg.toFixed(1)}` : 'Recent avg: n/a',
        opponentAllowedLabel,
        opponentAdjLabel,
        paceAdjLabel,
        `Projection: ${projection.toFixed(1)}`
      )
    }

    edges.push({
      player: playerStats.name || playerName,
      team: playerStats.team || playerTeam || undefined,
      opponent: opponentName,
      game: gameDescription,
      market,
      line: primary.line,
      direction,
      projection,
      edgePoints,
      edgePercent: Math.round(edgePercent * 10) / 10,
      modelProbability: direction === 'over' ? overProb : underProb,
      impliedProbability: direction === 'over' ? impliedOver ?? 0 : impliedUnder ?? 0,
      bestBook: direction === 'over' ? bestOver?.book : bestUnder?.book,
      bestOdds: direction === 'over' ? bestOver?.odds : bestUnder?.odds,
      verdict: edgeAssessment,
      factors,
      sampleSize: recentValues.length,
    })
  }

  edges.sort((a, b) => b.edgePercent - a.edgePercent)
  const trimmed = edges.slice(0, limit)

  return {
    sport: sportKey,
    sportLabel,
    date: targetDate || new Date().toISOString().split('T')[0],
    propsAnalyzed: filteredEntries.length,
    edges: trimmed,
    summary: { strongEdges, softEdges, noEdges },
  }
}

export function formatSlatePropEdgesForChat(result: SlatePropEdgeResult): string {
  if (result.propsAnalyzed === 0) {
    return `No ${result.sportLabel} props found for ${result.date}.`
  }

  const lines: string[] = []
  lines.push(`## ${result.sportLabel} Prop Edge Detection - ${result.date}`)
  lines.push('')
  lines.push(`**Props Analyzed:** ${result.propsAnalyzed}`)
  lines.push(
    `**Summary:** ${result.summary.strongEdges} strong edges | ${result.summary.softEdges} soft edges | ${result.summary.noEdges} no edge`
  )
  lines.push('')

  if (!result.edges.length) {
    lines.push("No significant prop edges detected in today's slate.")
    return lines.join('\n')
  }

  const strongEdges = result.edges.filter((edge) => edge.verdict.verdict === 'strong')
  const softEdges = result.edges.filter((edge) => edge.verdict.verdict === 'soft')

  if (strongEdges.length > 0) {
    lines.push('### Strong Edges')
    lines.push('')
    for (const edge of strongEdges) {
      lines.push(formatPropEdge(edge))
      lines.push('')
    }
  }

  if (softEdges.length > 0) {
    lines.push('### Soft Edges')
    lines.push('')
    for (const edge of softEdges) {
      lines.push(formatPropEdge(edge))
      lines.push('')
    }
  }

  return lines.join('\n')
}

const formatOdds = (odds: number | undefined) => {
  if (odds == null) return 'n/a'
  return odds > 0 ? `+${odds}` : `${odds}`
}

const formatPropEdge = (edge: PlayerPropEdge): string => {
  const lines: string[] = []
  const contextParts = [edge.team, edge.game].filter(Boolean).join(' | ')
  const header = contextParts ? `**${edge.player}** (${contextParts})` : `**${edge.player}**`
  const marketLabel = edge.market.replace(/_/g, ' ')
  const direction = edge.direction.toUpperCase()
  const projection = edge.projection.toFixed(1)
  const edgeGap = `${edge.edgePoints >= 0 ? '+' : ''}${edge.edgePoints.toFixed(1)}`
  const edgePct = `${edge.edgePercent.toFixed(1)}%`
  const book = edge.bestBook ? `${edge.bestBook} ${formatOdds(edge.bestOdds)}` : 'n/a'
  const edgeTag =
    edge.verdict.verdict === 'strong'
      ? '[STRONG]'
      : edge.verdict.verdict === 'soft'
        ? '[SOFT]'
        : ''

  lines.push(header)
  lines.push(
    `- ${edgeTag} **${marketLabel}:** Line ${edge.line} | Model ${projection} | Edge: ${edgeGap} (${edgePct}) -> ${direction} | Book: ${book}`
  )
  if (edge.verdict.flag) {
    lines.push(`  - Note: ${edge.verdict.flag}`)
  }
  if (edge.factors?.length) {
    lines.push(`- Factors: ${edge.factors.join(' | ')}`)
  }
  return lines.join('\n')
}
