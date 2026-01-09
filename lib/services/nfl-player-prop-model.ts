import { searchNFLPlayer, getNFLRoster, getTeamStats } from '@/lib/sports-stats-api'
import { fetchAthleteGamelog, fetchAthleteStatistics, EspnStatCategory } from '@/lib/providers/espn-nfl'

export type NflPropProjection = {
  marketKey: string
  projection: number
  seasonAvg?: number
  recentAvg?: number
  recentGames?: number
  gamesUsed?: number
  factors?: {
    opponent?: number
    playoff?: number
    dependency?: number
    homeAway?: number
  }
}

export type NflProjectionContext = {
  opponent?: string
  isHome?: boolean
  seasonType?: number
  gameWeek?: number
}

const DEFAULT_RECENT_GAMES = 5
const DEFAULT_RECENT_WEIGHT = 0.4
const DECAY_FACTOR = 0.85
const CACHE_TTL_MS = 1000 * 60 * 10 // 10 minutes

export const NFL_PROP_MARKET_KEYS = [
  'rushing_yards',
  'receiving_yards',
  'receptions',
] as const

const NFL_LEAGUE_AVG = {
  rushYardsAllowed: 115,
  passYardsAllowed: 220,
  receptionsAllowed: 22,
  sacksPerGame: 2.5,
}

const MARKET_STAT_KEYS: Record<string, { season: string[]; gamelog: string[] }> = {
  rushing_yards: {
    season: ['rushingYardsPerGame', 'rushingYards', 'netRushingYards'],
    gamelog: ['RUSHING_YARDS', 'RUSH_YDS', 'rushingYards'],
  },
  receiving_yards: {
    season: ['receivingYardsPerGame', 'receivingYards'],
    gamelog: ['RECEIVING_YARDS', 'REC_YDS', 'receivingYards'],
  },
  receptions: {
    season: ['receptionsPerGame', 'receptions'],
    gamelog: ['RECEPTIONS', 'REC', 'receptions'],
  },
}

const DEFENSE_STAT_KEYS: Record<string, { allowed: string[]; leagueAvg: number }> = {
  rushing_yards: {
    allowed: ['rushingYardsAllowedPerGame', 'opponentRushingYards', 'rushYardsAllowed'],
    leagueAvg: NFL_LEAGUE_AVG.rushYardsAllowed,
  },
  receiving_yards: {
    allowed: ['passingYardsAllowedPerGame', 'opponentPassingYards', 'passYardsAllowed'],
    leagueAvg: NFL_LEAGUE_AVG.passYardsAllowed,
  },
  receptions: {
    allowed: ['receptionsAllowedPerGame', 'opponentReceptions'],
    leagueAvg: NFL_LEAGUE_AVG.receptionsAllowed,
  },
}

const projectionCache = new Map<string, { ts: number; data: Record<string, NflPropProjection> }>()

const getCurrentNFLSeason = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const year = now.getUTCFullYear()
  return month >= 6 ? year : year - 1
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const average = (values: number[]) =>
  values.length ? values.reduce((sum, val) => sum + val, 0) / values.length : 0

const weightedAverage = (values: number[], decay: number) => {
  if (!values.length) return 0
  let weightedSum = 0
  let weightTotal = 0
  for (let idx = 0; idx < values.length; idx++) {
    const weight = Math.pow(decay, idx)
    weightedSum += values[idx] * weight
    weightTotal += weight
  }
  return weightTotal ? weightedSum / weightTotal : average(values)
}

const pickStat = (
  stats: Record<string, any> | undefined,
  keys: string[]
): number | null => {
  if (!stats) return null
  for (const key of keys) {
    const value = stats[key]
    const num = typeof value === 'number' ? value : Number(value)
    if (Number.isFinite(num)) return num
  }
  return null
}

const pickStatFromCategories = (
  categories: EspnStatCategory[] | undefined,
  names: string[],
  opts: { perGame?: boolean } = {}
): number | null => {
  if (!categories) return null
  for (const category of categories) {
    for (const stat of category.stats || []) {
      const key = stat.name?.toLowerCase()
      if (key && names.some((n) => n.toLowerCase() === key)) {
        const value = opts.perGame ? stat.perGameValue : stat.value
        if (typeof value === 'number' && Number.isFinite(value)) {
          return value
        }
      }
    }
  }
  return null
}

const collectGamelogStats = (entry: any): Record<string, number> => {
  const stats: Record<string, number> = {}

  // Try direct fields first
  const directMap: Record<string, string> = {
    rushingYards: 'RUSHING_YARDS',
    receivingYards: 'RECEIVING_YARDS',
    receptions: 'RECEPTIONS',
    targets: 'TARGETS',
    rushingAttempts: 'RUSHING_ATTEMPTS',
  }

  for (const [field, key] of Object.entries(directMap)) {
    const v = entry?.[field]
    const num = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(num)) stats[key] = num
  }

  // Try nested stats structure
  const statBlocks: any[] = Array.isArray(entry?.stats)
    ? entry.stats
    : Array.isArray(entry?.statistics)
      ? entry.statistics
      : []

  for (const block of statBlocks) {
    const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
    for (const s of entries) {
      const label = s?.label || s?.displayName || s?.name
      const value = s?.value ?? s?.displayValue ?? s?.display_value
      if (!label) continue
      const key = label.toUpperCase().replace(/\s+/g, '_')
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(num)) stats[key] = num
    }
  }

  return stats
}

const getSeasonAvgForMarket = (
  categories: EspnStatCategory[] | undefined,
  marketKey: string,
  gamesPlayed: number
): number | null => {
  const keys = MARKET_STAT_KEYS[marketKey]
  if (!keys) return null

  // Try per-game stat first
  const perGameKeys = keys.season.filter(k => k.toLowerCase().includes('pergame'))
  const perGame = pickStatFromCategories(categories, perGameKeys, { perGame: true })
  if (perGame != null) return perGame

  // Try total and divide by games
  const total = pickStatFromCategories(categories, keys.season)
  if (total != null && gamesPlayed > 0) return total / gamesPlayed

  return null
}

const getRecentAvgForMarket = (
  gameLogs: Record<string, number>[],
  marketKey: string,
  maxGames: number
): { avg: number; gamesUsed: number } | null => {
  const keys = MARKET_STAT_KEYS[marketKey]
  if (!keys) return null

  const values: number[] = []
  for (const log of gameLogs.slice(0, maxGames)) {
    const value = pickStat(log, keys.gamelog)
    if (value != null) values.push(value)
  }

  if (!values.length) return null
  return {
    avg: weightedAverage(values, DECAY_FACTOR),
    gamesUsed: values.length,
  }
}

const getOpponentAdjustment = async (
  opponent: string | undefined,
  marketKey: string
): Promise<number> => {
  if (!opponent) return 1

  const defenseKeys = DEFENSE_STAT_KEYS[marketKey]
  if (!defenseKeys) return 1

  try {
    const oppTeams = await getTeamStats('americanfootball_nfl', opponent)
    const oppStats = oppTeams?.[0]?.stats as Record<string, any> ?? {}

    const defenseAllowed = pickStat(oppStats, defenseKeys.allowed)
    if (defenseAllowed == null) return 1

    const multiplier = clamp(defenseAllowed / defenseKeys.leagueAvg, 0.85, 1.15)
    // Apply with 35% weight
    return 1 + (multiplier - 1) * 0.35
  } catch {
    return 1
  }
}

const getPlayoffAdjustment = (
  seasonType: number | undefined,
  marketKey: string
): number => {
  // Regular season = type 2, Postseason = type 3
  if (seasonType !== 3) return 1

  // Playoff games tend to have tighter defense
  const adjustments: Record<string, number> = {
    rushing_yards: 0.95,
    receiving_yards: 0.97,
    receptions: 0.98,
  }
  return adjustments[marketKey] ?? 1
}

const getDependencyAdjustment = async (
  playerTeam: string | undefined,
  position: string | undefined,
  marketKey: string
): Promise<number> => {
  // Only apply to pass catchers for receiving markets
  if (!playerTeam) return 1
  if (marketKey !== 'receiving_yards' && marketKey !== 'receptions') return 1
  if (position && !['WR', 'TE', 'RB'].includes(position.toUpperCase())) return 1

  try {
    // Get team's recent vs season passing trend
    const teamStats = await getTeamStats('americanfootball_nfl', playerTeam)
    const stats = teamStats?.[0]?.stats as Record<string, any> ?? {}

    // Look for passing yards trend indicator
    const seasonPassYPG = pickStat(stats, ['passingYardsPerGame', 'netPassingYards'])
    if (!seasonPassYPG) return 1

    // We don't have recent team stats readily available, so use a simplified approach:
    // Check opponent's pass defense for this game (already covered in opponent adjustment)
    // This factor will focus on team-level passing efficiency
    return 1 // Simplified for v1 - can enhance later with team game logs
  } catch {
    return 1
  }
}

const getHomeAwayAdjustment = (isHome: boolean | undefined): number => {
  if (isHome === true) return 1.015
  if (isHome === false) return 0.985
  return 1
}

const inferPosition = (
  categories: EspnStatCategory[] | undefined
): string | null => {
  const passAttempts = pickStatFromCategories(categories, ['passingAttempts', 'attempts']) ?? 0
  const rushAttempts = pickStatFromCategories(categories, ['rushingAttempts']) ?? 0
  const targets = pickStatFromCategories(categories, ['receivingTargets', 'targets']) ?? 0

  if (passAttempts > 100) return 'QB'
  if (rushAttempts > 50 && rushAttempts > targets) return 'RB'
  if (targets > 20) return 'WR'
  return null
}

export const getNflPropProjectionsForPlayer = async (
  playerName: string,
  options?: {
    recentGames?: number
    recentWeight?: number
    context?: NflProjectionContext
  }
): Promise<Record<string, NflPropProjection>> => {
  const recentGames = options?.recentGames ?? DEFAULT_RECENT_GAMES
  const recentWeight = options?.recentWeight ?? DEFAULT_RECENT_WEIGHT
  const context = options?.context ?? {}

  const cacheKey = `${playerName.toLowerCase()}|${recentGames}|${recentWeight}|${context.opponent ?? ''}`
  const cached = projectionCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data
  }

  const results: Record<string, NflPropProjection> = {}

  // Initialize with zeros
  for (const marketKey of NFL_PROP_MARKET_KEYS) {
    results[marketKey] = {
      marketKey,
      projection: 0,
    }
  }

  // Find player
  const playerMeta = await searchNFLPlayer(playerName)
  if (!playerMeta?.id) {
    projectionCache.set(cacheKey, { ts: Date.now(), data: results })
    return results
  }

  const season = getCurrentNFLSeason()
  const seasonType = context.seasonType ?? 2

  // Fetch season stats and game logs in parallel
  const [statsResp, gameLogs] = await Promise.all([
    fetchAthleteStatistics(playerMeta.id, season, seasonType).catch(() => null),
    fetchAthleteGamelog(playerMeta.id, season, seasonType).catch(() => []),
  ])

  const categories = statsResp?.splits?.categories
  const gamesPlayed = pickStatFromCategories(categories, ['gamesPlayed', 'games']) ?? gameLogs.length ?? 0
  const position = playerMeta.position || inferPosition(categories)

  // Parse game logs
  const parsedLogs = gameLogs.map(collectGamelogStats)

  // Calculate projections for each market
  for (const marketKey of NFL_PROP_MARKET_KEYS) {
    const seasonAvg = getSeasonAvgForMarket(categories, marketKey, gamesPlayed)
    const recent = getRecentAvgForMarket(parsedLogs, marketKey, recentGames)

    // Calculate base projection
    let baseProjection: number
    if (seasonAvg != null && recent != null) {
      baseProjection = seasonAvg * (1 - recentWeight) + recent.avg * recentWeight
    } else if (recent != null) {
      baseProjection = recent.avg
    } else if (seasonAvg != null) {
      baseProjection = seasonAvg
    } else {
      continue // No data available
    }

    // Get adjustment factors
    const [opponentFactor, dependencyFactor] = await Promise.all([
      getOpponentAdjustment(context.opponent, marketKey),
      getDependencyAdjustment(playerMeta.team, position ?? undefined, marketKey),
    ])
    const playoffFactor = getPlayoffAdjustment(seasonType, marketKey)
    const homeAwayFactor = getHomeAwayAdjustment(context.isHome)

    // Apply all adjustments
    const projection = baseProjection * opponentFactor * playoffFactor * dependencyFactor * homeAwayFactor

    results[marketKey] = {
      marketKey,
      projection: Number(projection.toFixed(1)),
      seasonAvg: seasonAvg != null ? Number(seasonAvg.toFixed(1)) : undefined,
      recentAvg: recent?.avg != null ? Number(recent.avg.toFixed(1)) : undefined,
      recentGames: recent?.gamesUsed,
      gamesUsed: recent?.gamesUsed,
      factors: {
        opponent: opponentFactor !== 1 ? Number(opponentFactor.toFixed(3)) : undefined,
        playoff: playoffFactor !== 1 ? Number(playoffFactor.toFixed(3)) : undefined,
        dependency: dependencyFactor !== 1 ? Number(dependencyFactor.toFixed(3)) : undefined,
        homeAway: homeAwayFactor !== 1 ? Number(homeAwayFactor.toFixed(3)) : undefined,
      },
    }
  }

  projectionCache.set(cacheKey, { ts: Date.now(), data: results })
  return results
}
