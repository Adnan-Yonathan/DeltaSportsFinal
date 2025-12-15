/**
 * Data router for executing tool calls and routing to appropriate data sources.
 * This is the central hub that connects LLM tool calls to actual data fetching.
 */

import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions'
import type { Sport, ToolResult } from './types'
import { executeStaticTeamStats, executeStaticPlayerStats, getLeagueAverage, getTeamStatRank } from './static-data-tools'
import { analyzeTeamSchedule } from './schedule-analyzer'
import { runWebSearchResponse } from '@/lib/ai-gateway-client'
import {
  getTeams,
  getTeamSeasonStats,
  getPlayerSeasonStats,
  getPlayerGameLogs,
  getInjuries,
  getTeamAtsRecord,
  getTeamSchedule,
  getEventsByDateRange,
  getEventSummary,
  type SportKey,
} from '@/lib/services/espn-orchestrator'
import {
  resolvePlayerThresholdQuery,
  resolvePlayerOpponentAggregate,
  resolvePlayerRestSplit,
  resolveTeamAfterLossSplit,
  resolveTeamHomeAwayDefense,
  computeTeamLineSplits,
  resolveAtsLeaderboard,
  resolveTeamBackToBackSplit,
} from '@/lib/services/espn-aggregations'
import { fetchAllLiveScores, type LeagueId } from '@/lib/live-scores'

/**
 * Get current season based on sport
 */
function getCurrentSeason(sport: SportKey): number {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  // ESPN uses the STARTING year of the season (e.g., 2025 for 2025-26 season)
  switch (sport) {
    case 'nba':
      // NBA season starts in October, so Oct-Dec uses current year, Jan-Sep uses previous year
      return month >= 9 ? year : year - 1
    case 'nfl':
      // NFL season starts in September
      return month >= 8 ? year : year - 1
    case 'mlb':
      // MLB season is roughly March-October
      return year
    case 'nhl':
      // NHL like NBA, starts in October
      return month >= 9 ? year : year - 1
    default:
      return year
  }
}

/**
 * Find team ID by name
 */
async function findTeamId(teamName: string, sport: SportKey): Promise<string | null> {
  const teams = await getTeams(sport)
  if (!teams) return null

  const normalized = teamName.toLowerCase().replace(/[^a-z0-9]/g, '')

  for (const team of teams) {
    const teamNormalized = (team.displayName || team.name || '').toLowerCase().replace(/[^a-z0-9]/g, '')
    const abbr = (team.abbreviation || '').toLowerCase()
    // Use shortDisplayName (city name) instead of location which doesn't exist
    const shortName = (team.shortDisplayName || '').toLowerCase().replace(/[^a-z0-9]/g, '')

    if (
      teamNormalized === normalized ||
      teamNormalized.includes(normalized) ||
      normalized.includes(teamNormalized) ||
      abbr === normalized ||
      shortName === normalized
    ) {
      return team.id
    }
  }

  return null
}

/**
 * Find athlete ID by name
 */
async function findAthleteId(playerName: string, sport: SportKey): Promise<string | null> {
  // Use the orchestrator's searchAthlete
  try {
    const { searchAthlete } = await import('@/lib/services/espn-orchestrator')
    if (searchAthlete) {
      const result = await searchAthlete(sport, playerName, 1)
      // searchAthlete returns { id, items } object, not an array
      if (result && result.id) {
        return result.id
      }
    }
  } catch {
    // searchAthlete may not exist or fail
  }
  return null
}

/**
 * Execute a single tool call and return the result
 */
async function executeToolCall(toolCall: ChatCompletionMessageToolCall): Promise<ToolResult> {
  const { id, function: func } = toolCall
  const args = JSON.parse(func.arguments || '{}')

  try {
    let result: any

    switch (func.name) {
      // ========================================
      // STATIC DATA TOOLS
      // ========================================
      case 'getStaticTeamStats': {
        const teamResult = await executeStaticTeamStats(args)
        // Enrich with league average and rank if specific stats requested
        if (args.stats?.length && !teamResult.error) {
          const enriched: Record<string, any> = {}
          for (const stat of args.stats) {
            const value = teamResult.stats[stat]
            if (value != null) {
              const rank = getTeamStatRank(args.team, stat)
              const leagueAvg = getLeagueAverage(stat)
              enriched[stat] = {
                value,
                rank: rank?.rank,
                totalTeams: rank?.total,
                leagueAverage: leagueAvg,
              }
            }
          }
          result = { ...teamResult, enrichedStats: enriched }
        } else {
          result = teamResult
        }
        break
      }

      case 'getStaticPlayerStats': {
        result = await executeStaticPlayerStats(args)
        break
      }

      // ========================================
      // ESPN LIVE DATA TOOLS
      // ========================================
      case 'getEspnTeamStats': {
        const sport = (args.sport || 'nba') as SportKey
        const teamId = await findTeamId(args.team, sport)
        if (!teamId) {
          result = { error: `Team "${args.team}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          result = await getTeamSeasonStats(sport, teamId, season)
        }
        break
      }

      case 'getEspnPlayerStats': {
        const sport = (args.sport || 'nba') as SportKey
        const playerId = await findAthleteId(args.player, sport)
        if (!playerId) {
          result = { error: `Player "${args.player}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          result = await getPlayerSeasonStats(sport, playerId, season)
        }
        break
      }

      case 'getEspnPlayerGameLogs': {
        const sport = (args.sport || 'nba') as SportKey
        const playerId = await findAthleteId(args.player, sport)
        if (!playerId) {
          result = { error: `Player "${args.player}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          let logs = await getPlayerGameLogs(sport, playerId, season)
          if (args.lastNGames && Array.isArray(logs)) {
            logs = logs.slice(0, args.lastNGames)
          }
          result = { player: args.player, games: logs }
        }
        break
      }

      case 'getLiveScores': {
        const sport = (args.sport || 'nba') as SportKey
        const date = args.date || new Date().toISOString().slice(0, 10)
        // Map SportKey to LeagueId (note: mlb not in live-scores currently)
        const leagueMap: Partial<Record<SportKey, LeagueId>> = {
          nba: 'nba',
          nfl: 'nfl',
          nhl: 'nhl',
        }
        const leagueId = leagueMap[sport]
        const response = await fetchAllLiveScores({ date })
        // Filter games by league if we have a mapping
        let games = leagueId
          ? response.games.filter((g) => g.league === leagueId)
          : response.games

        if (args.team) {
          const teamLower = args.team.toLowerCase()
          games = games.filter(
            (g) =>
              g.competitors?.some(
                (c) =>
                  c.name?.toLowerCase().includes(teamLower) ||
                  c.abbreviation?.toLowerCase() === teamLower
              )
          )
        }
        result = games
        break
      }

      case 'getInjuries': {
        const sport = (args.sport || 'nba') as SportKey
        const injuries = await getInjuries(sport)

        if (args.team) {
          const teamLower = args.team.toLowerCase()
          const filtered = injuries?.filter(
            (inj: any) =>
              inj.team?.toLowerCase().includes(teamLower) || inj.teamName?.toLowerCase().includes(teamLower)
          )
          result = filtered || []
        } else {
          result = injuries || []
        }
        break
      }

      // ========================================
      // AGGREGATION TOOLS
      // ========================================
      case 'getPlayerThresholdGames': {
        const sport = (args.sport || 'nba') as SportKey
        result = await resolvePlayerThresholdQuery({
          message: `${args.player} ${args.threshold}+ ${args.stat}`,
          playerNameHint: args.player,
          sportHint: sport,
        })
        break
      }

      case 'getPlayerVsOpponent': {
        const sport = (args.sport || 'nba') as SportKey
        const season = getCurrentSeason(sport)
        result = await resolvePlayerOpponentAggregate({
          playerName: args.player,
          sport,
          season,
          seasonType: 2,
          opponent: args.opponent,
        })
        break
      }

      case 'getPlayerRestSplit': {
        const sport = (args.sport || 'nba') as SportKey
        const season = getCurrentSeason(sport)
        result = await resolvePlayerRestSplit({
          playerName: args.player,
          sport,
          season,
          seasonType: 2,
        })
        break
      }

      // ========================================
      // BETTING/ATS TOOLS
      // ========================================
      case 'getTeamAtsAnalysis': {
        const sport = (args.sport || 'nba') as SportKey
        const teamId = await findTeamId(args.team, sport)
        if (!teamId) {
          result = { error: `Team "${args.team}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          const splits = await computeTeamLineSplits({
            sport,
            teamId,
            season,
            seasonType: 2,
          })

          // Filter to requested situation if specified
          if (args.situation && args.situation !== 'overall' && splits.buckets) {
            const situationMap: Record<string, string> = {
              home: 'home',
              away: 'away',
              favorite: 'favorite',
              underdog: 'underdog',
              home_favorite: 'homeFavorite',
              away_underdog: 'awayUnderdog',
            }
            const key = situationMap[args.situation] || args.situation
            result = {
              team: args.team,
              situation: args.situation,
              data: splits.buckets[key] || splits.buckets['overall'],
            }
          } else {
            result = { team: args.team, splits }
          }
        }
        break
      }

      case 'getTeamAfterLoss': {
        const sport = (args.sport || 'nba') as SportKey
        const teamId = await findTeamId(args.team, sport)
        if (!teamId) {
          result = { error: `Team "${args.team}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          result = await resolveTeamAfterLossSplit({
            sport,
            teamId,
            season,
            seasonType: 2,
            teamName: args.team,
          })
        }
        break
      }

      case 'getTeamHomeAwayDefense': {
        const sport = (args.sport || 'nba') as SportKey
        const teamId = await findTeamId(args.team, sport)
        if (!teamId) {
          result = { error: `Team "${args.team}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          result = await resolveTeamHomeAwayDefense({
            sport,
            teamId,
            season,
            seasonType: 2,
            teamName: args.team,
          })
        }
        break
      }

      case 'getTeamBackToBackSplit': {
        const sport = (args.sport || 'nba') as SportKey
        const teamId = await findTeamId(args.team, sport)
        if (!teamId) {
          result = { error: `Team "${args.team}" not found` }
        } else {
          const season = getCurrentSeason(sport)
          result = await resolveTeamBackToBackSplit({
            sport,
            teamId,
            teamName: args.team,
            season,
            seasonType: 2,
          })
        }
        break
      }

      case 'get_team_ats_records': {
        const { team_name } = args as { team_name: string }

        const { getTeamATSData } = await import('@/lib/providers/covers')
        const coversResult = await getTeamATSData(team_name, 'basketball_nba')

        if (!coversResult.success) {
          result = { error: coversResult.error }
        } else {
          const d = coversResult.data
          result = {
            team: d.team,
            season: d.season,
            overall_ats: d.overallATS,
            home_ats: d.homeATS,
            away_ats: d.awayATS,
            as_favorite: d.favoriteATS,
            as_underdog: d.underdogATS,
            over_under: d.overUnder,
            last_10: d.last10,
            streak: d.streak,
            last_updated: d.lastUpdated
          }
        }
        break
      }

      case 'get_betting_splits': {
        const { getCurrentBettingSplits } = await import('@/lib/providers/covers')
        const splitsResult = await getCurrentBettingSplits('basketball_nba')

        if (!splitsResult.success) {
          result = { error: splitsResult.error }
        } else {
          result = {
            games_count: splitsResult.data.length,
            games: splitsResult.data,
            has_sharp_action: splitsResult.data.some((g: any) => g.sharpAction.length > 0)
          }
        }
        break
      }

      case 'analyze_game_splits': {
        const { game_id, teams } = args as { game_id?: string; teams?: string }

        let targetGameId = game_id

        // If teams provided but no game_id, find the game_id by matching team names
        if (!targetGameId && teams) {
          const { getCurrentBettingSplits } = await import('@/lib/providers/covers')
          const splitsResult = await getCurrentBettingSplits('basketball_nba')

          if (splitsResult.success && splitsResult.data) {
            // Normalize the teams input for matching
            const teamTokens = teams.toLowerCase().replace(/\bvs\b|\bat\b/g, ' ').split(/\s+/).filter(t => t.length > 2)

            // Find game that matches the team names
            const matchingGame = splitsResult.data.find((g: any) => {
              const homeTeam = (g.homeTeam || '').toLowerCase()
              const awayTeam = (g.awayTeam || '').toLowerCase()

              // Check if any token matches home or away team
              return teamTokens.some(token =>
                homeTeam.includes(token) || awayTeam.includes(token)
              )
            })

            if (matchingGame) {
              targetGameId = matchingGame.gameId
            } else {
              result = { error: `Could not find a game matching teams: "${teams}". Games today: ${splitsResult.data.map((g: any) => `${g.awayTeam} @ ${g.homeTeam}`).join(', ')}` }
              break
            }
          } else {
            result = { error: 'Could not retrieve today\'s games to find matching game' }
            break
          }
        }

        if (!targetGameId) {
          result = { error: 'Must provide either game_id or teams parameter' }
          break
        }

        const { analyzeGameSplits } = await import('@/lib/providers/covers')
        const analysisResult = await analyzeGameSplits(targetGameId)

        if (!analysisResult.success) {
          result = { error: analysisResult.error }
        } else {
          result = analysisResult.data
        }
        break
      }

      // ========================================
      // SCHEDULE/CONTEXT TOOLS
      // ========================================
      case 'getTeamScheduleContext': {
        const sport = (args.sport || 'nba') as SportKey
        result = await analyzeTeamSchedule({
          team: args.team,
          sport,
          lookAhead: args.lookAhead || 7,
          lookBack: args.lookBack || 7,
        })
        break
      }

      // ========================================
      // LEADERBOARD TOOLS
      // ========================================
      case 'getLeaderboard': {
        // For leaderboards, we'd need to implement a stat-based ranking
        // For now, return a placeholder that indicates we need this data
        result = {
          stat: args.stat,
          sport: args.sport || 'nba',
          message: 'Leaderboard data - to be implemented with full roster scan',
        }
        break
      }

      case 'getAtsLeaderboard': {
        const sport = (args.sport || 'nba') as SportKey
        const season = getCurrentSeason(sport)
        result = await resolveAtsLeaderboard({
          sport,
          season,
          seasonType: 2,
          limit: args.limit || 10,
        })
        break
      }

      // ========================================
      // FALLBACK
      // ========================================
      case 'webSearch': {
        const searchResult = await runWebSearchResponse(args.query, { maxOutputTokens: 1500 })
        result = { query: args.query, results: searchResult }
        break
      }

      default:
        result = { error: `Unknown tool: ${func.name}` }
    }

    return { id, result }
  } catch (error: any) {
    console.error(`[DATA-ROUTER] Error executing ${func.name}:`, error)
    return {
      id,
      result: null,
      error: error?.message || 'Unknown error executing tool',
    }
  }
}

/**
 * Execute all tool calls in parallel and return results
 */
export async function executeTools(toolCalls: ChatCompletionMessageToolCall[]): Promise<ToolResult[]> {
  const results = await Promise.all(toolCalls.map(executeToolCall))
  return results
}

/**
 * Convert tool results to a format suitable for the LLM
 */
export function formatToolResultsForLLM(results: ToolResult[]): Array<{ role: 'tool'; tool_call_id: string; content: string }> {
  return results.map((r) => ({
    role: 'tool' as const,
    tool_call_id: r.id,
    content: r.error ? JSON.stringify({ error: r.error }) : JSON.stringify(r.result),
  }))
}
