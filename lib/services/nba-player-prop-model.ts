import { getPlayerGameLogs, searchAthlete } from '@/lib/services/espn-orchestrator'
import { getNBAPlayerSeasonStats } from '@/lib/sports-stats-api'

export type NbaPropProjection = {
  marketKey: string
  projection: number
  seasonAvg?: number
  recentAvg?: number
  recentGames?: number
  gamesUsed?: number
}

const DEFAULT_RECENT_GAMES = 5
const DEFAULT_RECENT_WEIGHT = 0.4
const POINTS_RECENT_GAMES = 10
const POINTS_SEASON_WEIGHT = 0.35
const POINTS_RECENT_WEIGHT = 0.45
const POINTS_MEDIAN_WEIGHT = 0.2
const POINTS_DECAY = 0.85
const POINTS_MINUTES_CLAMP: [number, number] = [0.85, 1.15]

export const NBA_PROP_MARKET_KEYS = [
  'points',
  'rebounds',
  'assists',
  'threes',
  'points_rebounds',
  'points_assists',
  'pra',
  'rebounds_assists',
  'blocks',
  'steals',
  'blocks_steals',
] as const

const MARKET_COMPONENTS: Record<string, Array<'PTS' | 'REB' | 'AST' | 'STL' | 'BLK' | '3PM'>> = {
  points: ['PTS'],
  rebounds: ['REB'],
  assists: ['AST'],
  threes: ['3PM'],
  blocks: ['BLK'],
  steals: ['STL'],
  points_rebounds: ['PTS', 'REB'],
  points_assists: ['PTS', 'AST'],
  pra: ['PTS', 'REB', 'AST'],
  rebounds_assists: ['REB', 'AST'],
  blocks_steals: ['BLK', 'STL'],
}

const seasonStatLookup = (stats: Record<string, number | string>, key: string) => {
  const pick = (k: string) => {
    const value = stats[k]
    const num = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(num) ? num : null
  }
  switch (key) {
    case 'PTS':
      return pick('PPG') ?? pick('PTS')
    case 'REB':
      return pick('RPG') ?? pick('REB') ?? pick('TRB')
    case 'AST':
      return pick('APG') ?? pick('AST')
    case 'STL':
      return pick('STL')
    case 'BLK':
      return pick('BLK')
    case '3PM':
      return pick('3PM') ?? pick('THREE_PM')
    default:
      return null
  }
}

const seasonMinutesLookup = (stats: Record<string, number | string>) => {
  const pick = (k: string) => {
    const value = stats[k]
    const num = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(num) ? num : null
  }
  return pick('MPG') ?? pick('MIN')
}

export const collectNbaLogStats = (entry: any): Record<string, number> => {     
  const statBlocks: any[] = Array.isArray(entry?.stats)
    ? entry.stats
    : Array.isArray(entry?.statistics)
      ? entry.statistics
      : []
  const stats: Record<string, number> = {}

  const parsePair = (raw: any) => {
    const value = raw == null ? '' : String(raw)
    const parts = value.split('-')
    if (parts.length < 2) return null
    const made = Number(parts[0])
    const att = Number(parts[1])
    if (!Number.isFinite(made) || !Number.isFinite(att)) return null
    return { made, att }
  }

  const pushStat = (label: string, raw: any) => {
    const key = label.toUpperCase().replace(/\s+/g, '_')
    if (key === 'FG' || key === 'FGM') {
      const pair = parsePair(raw)
      if (pair) {
        stats['FGM'] = pair.made
        stats['FGA'] = pair.att
        return
      }
    }
    if (key === '3PT' || key === '3PM' || key === '3P') {
      const pair = parsePair(raw)
      if (pair) {
        stats['3PM'] = pair.made
        stats['3PA'] = pair.att
        return
      }
    }
    if (key === 'FT' || key === 'FTM') {
      const pair = parsePair(raw)
      if (pair) {
        stats['FTM'] = pair.made
        stats['FTA'] = pair.att
        return
      }
    }
    const num = typeof raw === 'number' ? raw : Number(raw)
    if (Number.isFinite(num)) stats[key] = num
  }

  for (const block of statBlocks) {
    const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
    for (const s of entries) {
      const label = s?.label || s?.displayName || s?.name
      const value = s?.value ?? s?.displayValue ?? s?.display_value
      if (!label) continue
      pushStat(label, value)
    }
  }

  const directMap: Record<string, string> = {
    points: 'PTS',
    pts: 'PTS',
    rebounds: 'REB',
    assists: 'AST',
    blocks: 'BLK',
    steals: 'STL',
    threePointersMade: '3PM',
    threePointers: '3PM',
    '3p': '3PM',
    minutes: 'MIN',
    min: 'MIN',
  }
  Object.entries(directMap).forEach(([field, key]) => {
    const v = (entry as any)[field]
    const num = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(num) && stats[key] == null) stats[key] = num
  })

  if (stats['3PT'] != null && stats['3PM'] == null) stats['3PM'] = stats['3PT']
  if (stats['3PTM'] != null && stats['3PM'] == null) stats['3PM'] = stats['3PTM']
  if (stats['3PT_FG'] != null && stats['3PM'] == null) stats['3PM'] = stats['3PT_FG']

  return stats
}

const average = (values: number[]) =>
  values.reduce((sum, val) => sum + val, 0) / values.length

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2
  }
  return sorted[mid]
}

const weightedAverage = (values: number[], decay: number) => {
  let weightedSum = 0
  let weightTotal = 0
  for (let idx = 0; idx < values.length; idx += 1) {
    const weight = Math.pow(decay, idx)
    weightedSum += values[idx] * weight
    weightTotal += weight
  }
  return weightTotal ? weightedSum / weightTotal : average(values)
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const stdDev = (values: number[]) => {
  if (values.length < 2) return 0
  const avg = average(values)
  const variance = average(values.map((v) => (v - avg) ** 2))
  return Math.sqrt(variance)
}

export const getNbaMarketValueFromStats = (stats: Record<string, number>, marketKey: string) => {
  const keys = MARKET_COMPONENTS[marketKey]
  if (!keys) return null
  let total = 0
  for (const key of keys) {
    const value = stats[key]
    if (value == null || !Number.isFinite(value)) return null
    total += value
  }
  return total
}

const getSeasonAverageForMarket = (stats: Record<string, number | string>, marketKey: string) => {
  const keys = MARKET_COMPONENTS[marketKey]
  if (!keys) return null
  let total = 0
  for (const key of keys) {
    const value = seasonStatLookup(stats, key)
    if (value == null || !Number.isFinite(value)) return null
    total += value
  }
  return total
}

const projectionCache = new Map<string, { ts: number; data: Record<string, NbaPropProjection> }>()
const CACHE_TTL_MS = 1000 * 60 * 10

export const getNbaPropProjectionsForPlayer = async (
  playerName: string,
  options?: { recentGames?: number; recentWeight?: number }
): Promise<Record<string, NbaPropProjection>> => {
  const recentGames = options?.recentGames ?? DEFAULT_RECENT_GAMES
  const recentWeight = options?.recentWeight ?? DEFAULT_RECENT_WEIGHT
  const cacheKey = `${playerName.toLowerCase()}|${recentGames}|${recentWeight}`
  const cached = projectionCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.data

  const playerMeta = await searchAthlete('nba', playerName)
  const seasonStats = await getNBAPlayerSeasonStats(playerName)

  const results: Record<string, NbaPropProjection> = {}
  for (const marketKey of NBA_PROP_MARKET_KEYS) {
    const seasonAvg = seasonStats?.stats
      ? getSeasonAverageForMarket(seasonStats.stats as Record<string, number | string>, marketKey)
      : null
    results[marketKey] = {
      marketKey,
      projection: seasonAvg ?? 0,
      seasonAvg: seasonAvg ?? undefined,
    }
  }

  if (!playerMeta?.id) {
    projectionCache.set(cacheKey, { ts: Date.now(), data: results })
    return results
  }

  const seasonYear = new Date().getUTCMonth() >= 8 ? new Date().getUTCFullYear() + 1 : new Date().getUTCFullYear()
  const logsRaw = await getPlayerGameLogs('nba', playerMeta.id, seasonYear, 2).catch(() => [])
  const logs = Array.isArray(logsRaw) ? logsRaw : []
  const recentLogs = logs.slice(0, Math.max(recentGames, POINTS_RECENT_GAMES))

  if (!recentLogs.length) {
    projectionCache.set(cacheKey, { ts: Date.now(), data: results })
    return results
  }

  const recentStats = recentLogs.map((log) => collectNbaLogStats(log))
  const allStats = logs.map((log) => collectNbaLogStats(log))
  const recentMinutes = recentStats
    .map((stats) => stats['MIN'])
    .filter((value): value is number => value != null && Number.isFinite(value))
  const seasonMinutes = allStats
    .map((stats) => stats['MIN'])
    .filter((value): value is number => value != null && Number.isFinite(value))
  const recentMinutesAvg = recentMinutes.length ? average(recentMinutes) : null
  const seasonMinutesAvg = seasonStats?.stats
    ? seasonMinutesLookup(seasonStats.stats as Record<string, number | string>)
    : seasonMinutes.length ? average(seasonMinutes) : null
  const minutesFactor =
    recentMinutesAvg != null && seasonMinutesAvg != null
      ? clamp(recentMinutesAvg / seasonMinutesAvg, POINTS_MINUTES_CLAMP[0], POINTS_MINUTES_CLAMP[1])
      : 1
  for (const marketKey of NBA_PROP_MARKET_KEYS) {
    const values = recentStats
      .map((stats) => getNbaMarketValueFromStats(stats, marketKey))
      .filter((value): value is number => value != null && Number.isFinite(value))
    if (!values.length) continue
    const seasonAvg = results[marketKey].seasonAvg
    const recentAvg = average(values)
    let projection =
      seasonAvg != null && Number.isFinite(seasonAvg)
        ? seasonAvg * (1 - recentWeight) + recentAvg * recentWeight
        : recentAvg
    if (marketKey === 'points') {
      const pointsValues = values.slice(0, POINTS_RECENT_GAMES)
      const pointsMinutes = recentMinutes.slice(0, POINTS_RECENT_GAMES)
      const pointsStd5 = pointsValues.length ? stdDev(pointsValues.slice(0, 5)) : 0

      const recentMinutes3 = recentMinutes.slice(0, 3)
      const recentMinutes3Avg = recentMinutes3.length ? average(recentMinutes3) : null
      const starterProxy =
        recentMinutes3Avg != null
          ? recentMinutes3Avg >= 28
            ? 'starter'
            : recentMinutes3Avg <= 24
              ? 'bench'
              : 'swing'
          : 'swing'

      const usageFromStats = (stats: Record<string, number>) => {
        const fga = stats['FGA']
        const fta = stats['FTA']
        const min = stats['MIN']
        if (!Number.isFinite(fga) || !Number.isFinite(fta) || !Number.isFinite(min) || min <= 0) return null
        return (fga + 0.44 * fta) / min
      }
      const seasonUsageSeries = allStats.map(usageFromStats).filter((v): v is number => v != null)
      const recentUsageSeries = recentStats.map(usageFromStats).filter((v): v is number => v != null)
      const seasonUsage = seasonUsageSeries.length ? average(seasonUsageSeries) : null
      const recentUsage = recentUsageSeries.length ? average(recentUsageSeries) : null
      const usageTrend =
        seasonUsage != null && recentUsage != null ? recentUsage - seasonUsage : 0

      const minutesTrend =
        recentMinutesAvg != null && seasonMinutesAvg != null ? recentMinutesAvg - seasonMinutesAvg : 0

      const starterAdj = starterProxy === 'starter' ? 0.05 : starterProxy === 'bench' ? -0.05 : 0
      const volatilityGuard = pointsStd5 > 6 ? -pointsStd5 * 0.35 * 0.2 : 0

      const roleShiftProjection =
        (seasonAvg ?? recentAvg) +
        clamp(minutesTrend, -6, 6) * (0.15 + starterAdj) +
        clamp(usageTrend, -0.08, 0.08) * 10 +
        volatilityGuard

      projection = roleShiftProjection * minutesFactor
    }
    results[marketKey] = {
      marketKey,
      projection,
      seasonAvg: seasonAvg ?? undefined,
      recentAvg,
      recentGames: values.length,
      gamesUsed: values.length,
    }
  }

  projectionCache.set(cacheKey, { ts: Date.now(), data: results })
  return results
}
