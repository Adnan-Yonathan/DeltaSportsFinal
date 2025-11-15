/**
 * Stat Threshold Filter
 * Filters based on team/player statistical thresholds
 */

import {
  StatThresholdFilter,
  OddsData,
  FilterExecutionContext,
} from '../research-model-types'

/**
 * Apply stat threshold filter
 * Example: "Team pace must be >= 100"
 *
 * NOTE: This filter requires integration with the stats system
 * For now, this is a placeholder implementation that will be enhanced
 * when stats integration is fully connected
 */
export async function applyStatThresholdFilter(
  opportunity: OddsData,
  filter: StatThresholdFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  const { condition } = filter

  // Extract team names from event
  const teams = extractTeams(opportunity.event)
  if (teams.length === 0) {
    return false
  }

  let statValue: number | undefined

  try {
    switch (condition.scope) {
      case 'team':
        statValue = await getTeamStat(
          opportunity.sport,
          condition.team || teams[0], // Use specified team or home team
          condition.statKey,
          context
        )
        break

      case 'player':
        if (!condition.player) {
          return false // Player name required for player scope
        }
        statValue = await getPlayerStat(
          opportunity.sport,
          condition.player,
          condition.statKey,
          context
        )
        break

      case 'matchup_diff':
        // Get stat for both teams and calculate difference
        const home = await getTeamStat(opportunity.sport, teams[0], condition.statKey, context)
        const away = await getTeamStat(opportunity.sport, teams[1], condition.statKey, context)
        if (home !== undefined && away !== undefined) {
          statValue = home - away
        }
        break

      default:
        throw new Error(`Unknown stat scope: ${condition.scope}`)
    }

    if (statValue === undefined) {
      return false // Stat not available
    }

    // Apply normalization if specified
    if (condition.normalization && condition.normalization !== 'raw') {
      statValue = await normalizeStat(
        statValue,
        condition.statKey,
        condition.normalization,
        opportunity.sport,
        context
      )
    }

    // Evaluate threshold
    return evaluateComparison(statValue, condition.operator, condition.value)
  } catch (error) {
    console.error(`[STAT_FILTER] Error evaluating stat ${condition.statKey}:`, error)
    return false
  }
}

/**
 * Extract team names from event description
 */
function extractTeams(event: string): string[] {
  // Expected format: "Team A @ Team B" or "Team A vs Team B"
  const parts = event.split(/\s+[@vs]+\s+/i)
  return parts.map(t => t.trim()).filter(Boolean)
}

/**
 * Get team stat value
 * Integrated with existing stats system
 */
async function getTeamStat(
  sport: string,
  team: string,
  statKey: string,
  context: FilterExecutionContext
): Promise<number | undefined> {
  // Check cache first
  const cacheKey = `team:${sport}:${team}:${statKey}`
  if (context.statsCache?.has(cacheKey)) {
    return context.statsCache.get(cacheKey)
  }

  try {
    // Import the stats API
    const { getTeamStats } = await import('@/lib/sports-stats-api')

    // Fetch stats for this team
    const teamStats = await getTeamStats(sport, team)

    if (teamStats.length === 0) {
      return undefined
    }

    // Find the matching team (normalize team name for matching)
    const normalizedTeam = team.toLowerCase().replace(/[^a-z0-9]/g, '')
    const matchedTeam = teamStats.find(ts =>
      ts.team.toLowerCase().replace(/[^a-z0-9]/g, '').includes(normalizedTeam) ||
      normalizedTeam.includes(ts.team.toLowerCase().replace(/[^a-z0-9]/g, ''))
    )

    if (!matchedTeam) {
      return undefined
    }

    // Extract the stat value from the stats object
    const value = matchedTeam.stats[statKey]

    // Convert to number if it's a string
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value))

    // Cache the result
    if (!isNaN(numericValue) && context.statsCache) {
      context.statsCache.set(cacheKey, numericValue)
    }

    return isNaN(numericValue) ? undefined : numericValue
  } catch (error: any) {
    console.error(`[STAT_FILTER] Error fetching team stat for ${team}:`, error.message)
    return undefined
  }
}

/**
 * Get player stat value
 * Integrated with player search and stats
 */
async function getPlayerStat(
  sport: string,
  player: string,
  statKey: string,
  context: FilterExecutionContext
): Promise<number | undefined> {
  // Check cache first
  const cacheKey = `player:${sport}:${player}:${statKey}`
  if (context.statsCache?.has(cacheKey)) {
    return context.statsCache.get(cacheKey)
  }

  try {
    // Import the stats API
    const { searchPlayer } = await import('@/lib/sports-stats-api')

    // Search for the player
    const playerData = await searchPlayer(player, sport)

    if (!playerData || !playerData.stats) {
      return undefined
    }

    // Extract the stat value
    const value = (playerData.stats as any)[statKey]

    // Convert to number if it's a string
    const numericValue = typeof value === 'number' ? value : parseFloat(String(value))

    // Cache the result
    if (!isNaN(numericValue) && context.statsCache) {
      context.statsCache.set(cacheKey, numericValue)
    }

    return isNaN(numericValue) ? undefined : numericValue
  } catch (error: any) {
    console.error(`[STAT_FILTER] Error fetching player stat for ${player}:`, error.message)
    return undefined
  }
}

/**
 * Normalize stat value
 */
async function normalizeStat(
  value: number,
  statKey: string,
  normalization: 'zscore' | 'percentile',
  sport: string,
  context: FilterExecutionContext
): Promise<number> {
  if (normalization === 'zscore') {
    // TODO: Get league mean and std dev for this stat
    // For now, return raw value
    return value
  }

  if (normalization === 'percentile') {
    // TODO: Calculate percentile based on league distribution
    // For now, return raw value
    return value
  }

  return value
}

/**
 * Evaluate comparison based on operator
 */
function evaluateComparison(
  value: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case 'gt':
      return value > threshold
    case 'gte':
      return value >= threshold
    case 'lt':
      return value < threshold
    case 'lte':
      return value <= threshold
    case 'eq':
      return Math.abs(value - threshold) < 0.01
    default:
      throw new Error(`Unknown operator: ${operator}`)
  }
}
