/**
 * League Average Data Service
 *
 * Provides league average statistics for contextualizing individual team/player stats.
 * Includes in-memory caching with 1-hour TTL for performance.
 */

import { getStaticNbaTeams } from '@/lib/nba-static-team-stats'
import type { TeamStats } from '@/lib/sports-stats-api'
import type { LeagueAverage, LeagueRank } from '@/lib/formatters/types'

/**
 * Cache entry with timestamp
 */
interface CacheEntry<T> {
  data: T
  timestamp: number
}

/**
 * In-memory cache for league averages (1-hour TTL)
 */
const CACHE_TTL = 60 * 60 * 1000 // 1 hour in milliseconds
const cache = new Map<string, CacheEntry<any>>()

/**
 * Get data from cache or return null if expired/missing
 */
function getFromCache<T>(key: string): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  const age = Date.now() - entry.timestamp
  if (age > CACHE_TTL) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

/**
 * Store data in cache with timestamp
 */
function setInCache<T>(key: string, data: T): void {
  cache.set(key, {
    data,
    timestamp: Date.now(),
  })
}

/**
 * Calculate mean from array of numbers
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0
  const sum = values.reduce((acc, val) => acc + val, 0)
  return sum / values.length
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values: number[], mean: number): number {
  if (values.length === 0) return 0
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  const variance = calculateMean(squaredDiffs)
  return Math.sqrt(variance)
}

/**
 * Extract numeric value from stat field
 */
function extractNumericValue(stat: any): number | null {
  if (typeof stat === 'number') return stat
  if (typeof stat === 'string') {
    const num = parseFloat(stat)
    return isNaN(num) ? null : num
  }
  return null
}

/**
 * Get league average for a specific stat (NBA)
 *
 * @param sport - Sport identifier (currently supports 'nba')
 * @param stat - Stat name (must match TeamStats.stats keys)
 * @param season - Season year (defaults to 2025)
 * @returns League average value or null if unavailable
 */
export async function getLeagueAverage(
  sport: string,
  stat: string,
  season: number = 2025
): Promise<number | null> {
  // Normalize sport
  const normalizedSport = sport.toLowerCase().replace(/[^a-z]/g, '')
  if (normalizedSport !== 'nba' && normalizedSport !== 'basketball') {
    // Only NBA supported for now
    return null
  }

  // Check cache
  const cacheKey = `league_avg:nba:${stat}:${season}`
  const cached = getFromCache<number>(cacheKey)
  if (cached !== null) return cached

  try {
    // Get all NBA teams
    const teams = getStaticNbaTeams()
    if (!teams || teams.length === 0) return null

    // Extract stat values from all teams
    const values: number[] = []
    for (const team of teams) {
      const value = team.stats[stat]
      const numValue = extractNumericValue(value)
      if (numValue !== null) {
        values.push(numValue)
      }
    }

    if (values.length === 0) return null

    // Calculate league average
    const average = calculateMean(values)

    // Cache and return
    setInCache(cacheKey, average)
    return average
  } catch (error) {
    console.error(`[LEAGUE AVERAGES] Error calculating average for ${stat}:`, error)
    return null
  }
}

/**
 * Get full league average data including std dev
 */
export async function getLeagueAverageData(
  sport: string,
  stat: string,
  season: number = 2025
): Promise<LeagueAverage | null> {
  const normalizedSport = sport.toLowerCase().replace(/[^a-z]/g, '')
  if (normalizedSport !== 'nba' && normalizedSport !== 'basketball') {
    return null
  }

  // Check cache
  const cacheKey = `league_avg_data:nba:${stat}:${season}`
  const cached = getFromCache<LeagueAverage>(cacheKey)
  if (cached !== null) return cached

  try {
    const teams = getStaticNbaTeams()
    if (!teams || teams.length === 0) return null

    const values: number[] = []
    for (const team of teams) {
      const value = team.stats[stat]
      const numValue = extractNumericValue(value)
      if (numValue !== null) {
        values.push(numValue)
      }
    }

    if (values.length === 0) return null

    const average = calculateMean(values)
    const stdDev = calculateStdDev(values, average)

    const result: LeagueAverage = {
      sport: 'nba',
      stat,
      season,
      average,
      stdDev,
      sampleSize: values.length,
    }

    setInCache(cacheKey, result)
    return result
  } catch (error) {
    console.error(`[LEAGUE AVERAGES] Error getting league average data for ${stat}:`, error)
    return null
  }
}

/**
 * Get league rank for a team stat
 *
 * @param sport - Sport identifier
 * @param entity - Team name or abbreviation
 * @param stat - Stat name
 * @param value - Stat value to rank
 * @returns League rank data or null if unavailable
 */
export async function getLeagueRank(
  sport: string,
  entity: string,
  stat: string,
  value: number
): Promise<LeagueRank | null> {
  const normalizedSport = sport.toLowerCase().replace(/[^a-z]/g, '')
  if (normalizedSport !== 'nba' && normalizedSport !== 'basketball') {
    return null
  }

  try {
    const teams = getStaticNbaTeams()
    if (!teams || teams.length === 0) return null

    // Extract all values for this stat
    const allValues: number[] = []
    for (const team of teams) {
      const teamValue = team.stats[stat]
      const numValue = extractNumericValue(teamValue)
      if (numValue !== null) {
        allValues.push(numValue)
      }
    }

    if (allValues.length === 0) return null

    // Sort descending (higher is better for most stats)
    const sorted = [...allValues].sort((a, b) => b - a)

    // Find rank (1-based)
    const rank = sorted.findIndex((v) => v <= value) + 1

    if (rank === 0) return null

    const totalEntities = sorted.length
    const percentile = ((totalEntities - rank) / totalEntities) * 100

    return {
      entity,
      stat,
      rank,
      totalEntities,
      percentile: Math.round(percentile),
    }
  } catch (error) {
    console.error(`[LEAGUE AVERAGES] Error calculating rank for ${entity} ${stat}:`, error)
    return null
  }
}

/**
 * Compare a value to league average and return contextual string
 *
 * @param value - The value to compare
 * @param leagueAvg - The league average
 * @param stat - Stat name (for context)
 * @param options - Formatting options
 * @returns Formatted comparison string
 *
 * @example
 * compareToLeague(28.5, 25.0, "PPG")
 * // Returns: "28.5 (3.5 above league avg of 25.0)"
 */
export function compareToLeague(
  value: number,
  leagueAvg: number,
  stat?: string,
  options: {
    includeValue?: boolean
    precision?: number
  } = {}
): string {
  const { includeValue = true, precision = 1 } = options

  const diff = value - leagueAvg
  const absDiff = Math.abs(diff)
  const direction = diff > 0 ? 'above' : 'below'

  // Format values
  const formattedValue = value.toFixed(precision)
  const formattedAvg = leagueAvg.toFixed(precision)
  const formattedDiff = absDiff.toFixed(precision)

  if (Math.abs(diff) < 0.1) {
    // Essentially at league average
    return includeValue
      ? `${formattedValue} (league avg: ${formattedAvg})`
      : `at league avg (${formattedAvg})`
  }

  if (includeValue) {
    return `${formattedValue} (${formattedDiff} ${direction} league avg of ${formattedAvg})`
  } else {
    return `${formattedDiff} ${direction} league avg (${formattedAvg})`
  }
}

/**
 * Get comparison with emoji indicator
 *
 * @param value - The value to compare
 * @param leagueAvg - The league average
 * @param higherIsBetter - Whether higher values are better (default: true)
 * @returns String with emoji indicator
 *
 * @example
 * compareToLeagueWithEmoji(115.2, 110.0, true)
 * // Returns: "⬆️ 5.2 above league avg"
 */
export function compareToLeagueWithEmoji(
  value: number,
  leagueAvg: number,
  higherIsBetter: boolean = true
): string {
  const diff = value - leagueAvg
  const absDiff = Math.abs(diff)

  if (Math.abs(diff) < 0.1) {
    return `➡️ At league average (${leagueAvg.toFixed(1)})`
  }

  const isAbove = diff > 0
  const direction = isAbove ? 'above' : 'below'

  // Determine if this is good or bad
  const isGood = (isAbove && higherIsBetter) || (!isAbove && !higherIsBetter)
  const emoji = isGood ? '⬆️' : '⬇️'

  return `${emoji} ${absDiff.toFixed(1)} ${direction} league avg`
}

/**
 * Clear the cache (useful for testing or manual refresh)
 */
export function clearCache(): void {
  cache.clear()
}

/**
 * Get cache stats (for debugging)
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: cache.size,
    entries: Array.from(cache.keys()),
  }
}
