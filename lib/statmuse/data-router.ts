/**
 * Data router for executing tool calls and routing to appropriate data sources.
 * This is the central hub that connects LLM tool calls to actual data fetching.
 */

import type { ChatCompletionMessageToolCall } from 'openai/resources/chat/completions'
import type { Sport, ToolResult } from './types'
import { executeStaticTeamStats, executeStaticPlayerStats, getLeagueAverage, getTeamStatRank, getPlayerLeaderboard } from './static-data-tools'
import { analyzeTeamSchedule } from './schedule-analyzer'
import { runWebSearchResponse } from '@/lib/ai-gateway-client'
import { getTeamStats as getSportsTeamStats } from '@/lib/sports-stats-api'
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
import { getCachedGameDetails, getCachedLiveGameAnalysis } from '@/lib/services/live-game-cache'
import {
  getTeamQuarterThreshold,
  getTeamQuarterAverages,
  getQuarterWinners,
  getTeamFirstToScore,
  getFirstBasketScorer,
} from '@/lib/services/quarter-analytics'
import {
  calculateLiveSpread,
  calculateLiveTotal,
  formatLiveRecommendation,
  formatLivePeriodLabel,
} from '@/lib/services/live-line-calculator'
import { getLiveTeamStats } from '@/lib/services/live-team-stats'
import { fetchOdds } from '@/lib/api/odds-api'
import { detectEdgeForGame } from '@/lib/services/edge-detection'
import {
  buildSharpSignalsFromSplits,
  calculateSharpBiasFromSignals,
} from '@/lib/services/sharp-bias'

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

const normalizeTeamName = (value?: string) => {
  const cleaned = (value || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return ''
  const tokens = cleaned
    .split(' ')
    .map((token) => {
      if (token === 'state' || token === 'st' || token === 'saint') return 'st'
      if (token === 'university' || token === 'college' || token === 'the') {
        return ''
      }
      return token
    })
    .filter(Boolean)
  return tokens.join('')
}

const matchesTeamName = (candidate: string, target: string) => {
  const a = normalizeTeamName(candidate)
  const b = normalizeTeamName(target)
  if (!a || !b) return false
  return a === b || a.includes(b) || b.includes(a)
}

const buildTeamFilters = (team: string) => {
  const cleaned = (team || '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return []
  const tokens = cleaned.split(' ')
  const withoutCommon = tokens
    .filter((t) => t !== 'university' && t !== 'college' && t !== 'the')
    .join(' ')
  const replaceState = cleaned.replace(/\bstate\b/g, 'st').replace(/\bsaint\b/g, 'st')
  const replaceSaint = cleaned.replace(/\bsaint\b/g, 'st')
  const expandStState = cleaned.replace(/\bst\b/g, 'state')
  const expandStSaint = cleaned.replace(/\bst\b/g, 'saint')
  const candidates = new Set([
    cleaned,
    withoutCommon,
    replaceState,
    replaceSaint,
    expandStState,
    expandStSaint,
  ])
  return Array.from(candidates).filter((entry) => entry.length >= 3)
}

const median = (values: number[]): number | null => {
  const nums = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b)
  if (!nums.length) return null
  const mid = Math.floor(nums.length / 2)
  return nums.length % 2 === 0 ? (nums[mid - 1] + nums[mid]) / 2 : nums[mid]
}

const resolveSportKeyForLeague = (league: LeagueId): string => {
  if (league === 'ncaab') return 'basketball_ncaab'
  if (league === 'nba') return 'basketball_nba'
  if (league === 'nfl') return 'americanfootball_nfl'
  if (league === 'cfb') return 'americanfootball_ncaaf'
  if (league === 'nhl') return 'icehockey_nhl'
  return 'basketball_nba'
}

const resolveSbdLeagueForLive = (
  league: LeagueId
): 'nba' | 'nfl' | 'nhl' | 'mlb' | 'ncaamb' | 'ncaafb' | null => {
  if (league === 'nba') return 'nba'
  if (league === 'nfl') return 'nfl'
  if (league === 'ncaab') return 'ncaamb'
  if (league === 'cfb') return 'ncaafb'
  if (league === 'nhl') return 'nhl'
  return null
}

const buildPregameSpreadContext = async (
  league: LeagueId,
  homeTeam: string,
  awayTeam: string
) => {
  try {
    const sportKey = resolveSportKeyForLeague(league)
    const teamFilter = Array.from(
      new Set([
        homeTeam,
        awayTeam,
        ...buildTeamFilters(homeTeam),
        ...buildTeamFilters(awayTeam),
      ])
    ).filter(Boolean)
    let oddsGames = await fetchOdds(sportKey, ['spreads', 'totals'], {
      live: false,
      teamFilter: teamFilter.length ? teamFilter : [homeTeam, awayTeam],
      revalidateSeconds: 60,
    })
    if (!oddsGames.length) {
      oddsGames = await fetchOdds(sportKey, ['spreads', 'totals'], {
        live: false,
        revalidateSeconds: 60,
      })
    }
    if (!oddsGames.length) return null

    const matches = oddsGames.map((game) => {
      const directScore =
        (matchesTeamName(game.home_team, homeTeam) ? 1 : 0) +
        (matchesTeamName(game.away_team, awayTeam) ? 1 : 0)
      const reverseScore =
        (matchesTeamName(game.home_team, awayTeam) ? 1 : 0) +
        (matchesTeamName(game.away_team, homeTeam) ? 1 : 0)
      const score = Math.max(directScore, reverseScore)
      return { game, score }
    })
    const bestMatch = matches.sort((a, b) => b.score - a.score)[0]
    if (!bestMatch || bestMatch.score <= 0) return null
    const best = bestMatch.game
    if (!best) return null

    const spreadPoints: number[] = []
    const totalPoints: number[] = []

    for (const book of best.bookmakers || []) {
      for (const market of book.markets || []) {
        if (market.key === 'spreads') {
          for (const outcome of market.outcomes || []) {
            if (matchesTeamName(outcome.name, homeTeam) && outcome.point != null) {
              spreadPoints.push(outcome.point)
            }
          }
        }
        if (market.key === 'totals') {
          const total = market.outcomes?.find((o) => o.point != null)?.point
          if (total != null) totalPoints.push(total)
        }
      }
    }

    const openingSpread = median(spreadPoints)
    const openingTotal = median(totalPoints)
    if (openingSpread == null) return null

    let sharpSpreadBias: number | undefined
    let sharpTotalBias: number | undefined
    let sharpNotes: string[] | undefined
    const sbdLeague = resolveSbdLeagueForLive(league)
    if (sbdLeague) {
      try {
        const sharpResult = await detectEdgeForGame(
          sbdLeague,
          `${awayTeam} @ ${homeTeam}`
        )
        let sharpSignals = sharpResult?.sharpSignals || []
        if (!sharpSignals.length && sharpResult?.splits) {
          sharpSignals = buildSharpSignalsFromSplits({
            splits: sharpResult.splits,
            homeTeam,
            awayTeam,
          })
        }
        const sharpBias = calculateSharpBiasFromSignals({
          sharpSignals,
          homeTeam,
          awayTeam,
          sport: sportKey,
        })
        sharpSpreadBias = sharpBias.spreadBias || undefined
        sharpTotalBias = sharpBias.totalBias || undefined
        const notes = [...sharpBias.spreadNotes, ...sharpBias.totalNotes]
        sharpNotes = notes.length ? notes : undefined
      } catch {
        sharpSpreadBias = undefined
        sharpTotalBias = undefined
        sharpNotes = undefined
      }
    }

    return {
      openingSpread,
      openingTotal: openingTotal ?? 0,
      currentSpread: openingSpread,
      currentTotal: openingTotal ?? undefined,
      source: 'SBD',
      sharpSpreadBias,
      sharpTotalBias,
      sharpNotes,
    }
  } catch {
    return null
  }
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
              const rank = await getTeamStatRank(args.team, stat)
              const leagueAvg = await getLeagueAverage(stat)
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
        if (sport === 'nfl') {
          let teamName = args.team
          if (/^\d+$/.test(teamName)) {
            const teams = await getTeams('nfl')
            const match = teams.find((team: any) => String(team?.id) === teamName)
            teamName = match?.displayName || match?.name || teamName
          }
          const teams = await getSportsTeamStats('americanfootball_nfl', teamName)
          if (!teams.length) {
            result = { error: `Team "${args.team}" not found` }
          } else {
            const team = teams[0]
            result = {
              team: team.team,
              record: `${team.wins}-${team.losses}`,
              stats: team.stats,
              source: 'record+team-stats',
            }
          }
        } else {
          const teamId = await findTeamId(args.team, sport)
          if (!teamId) {
            result = { error: `Team "${args.team}" not found` }
          } else {
            const season = getCurrentSeason(sport)
            result = await getTeamSeasonStats(sport, teamId, season)
          }
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
      // QUARTER ANALYTICS TOOLS
      // ========================================
      case 'getTeamQuarterThreshold': {
        const sport = args.sport === 'nfl' ? 'americanfootball_nfl' : 'basketball_nba'
        result = await getTeamQuarterThreshold({
          team: args.team,
          quarter: args.quarter,
          threshold: args.threshold,
          operator: args.operator || '>=',
          sport,
          limit: 100,
        })
        break
      }

      case 'getTeamQuarterAverages': {
        const sport = args.sport === 'nfl' ? 'americanfootball_nfl' : 'basketball_nba'
        result = await getTeamQuarterAverages({
          team: args.team,
          sport,
        })
        break
      }

      case 'getQuarterWinners': {
        const sport = args.sport === 'nfl' ? 'americanfootball_nfl' : 'basketball_nba'
        result = await getQuarterWinners({
          team: args.team,
          sport,
          limit: 50,
        })
        break
      }

      case 'getTeamFirstToScore': {
        const sport = args.sport === 'nfl' ? 'americanfootball_nfl' : 'basketball_nba'
        result = await getTeamFirstToScore({
          team: args.team,
          sport,
          limit: 20,
        })
        break
      }

      case 'getFirstBasketScorer': {
        result = await getFirstBasketScorer({
          player: args.player,
          team: args.team,
          sport: 'basketball_nba',
          limit: 20,
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
          const { getTeamATSData } = await import('@/lib/providers/covers')
          const sportKey = sport === 'nba' ? 'basketball_nba' : sport
          const coversResult = await getTeamATSData(args.team, sportKey)
          if (coversResult.success && coversResult.data) {
            const parseRecord = (record?: string | null) => {
              if (!record) return null
              const match = record.match(/^(\d+)-(\d+)(?:-(\d+))?$/)
              if (!match) return null
              return {
                wins: Number(match[1]),
                losses: Number(match[2]),
                pushes: match[3] ? Number(match[3]) : 0,
              }
            }
            const toBucket = (record?: string | null) => {
              const parsed = parseRecord(record)
              if (!parsed) return null
              const games = parsed.wins + parsed.losses + parsed.pushes
              return {
                games,
                cover: parsed.wins,
                fail: parsed.losses,
                push: parsed.pushes,
                over: 0,
                under: 0,
                ouPush: 0,
                missingOdds: 0,
              }
            }
            const extra = coversResult.data.extraSplits || {}
            result = {
              team: coversResult.data.team || args.team,
              season: coversResult.data.season,
              source: 'SBD',
              splits: {
                buckets: {
                  overall: toBucket(coversResult.data.overallATS),
                  home: toBucket(coversResult.data.homeATS),
                  away: toBucket(coversResult.data.awayATS),
                  favorite: toBucket(coversResult.data.favoriteATS),
                  underdog: toBucket(coversResult.data.underdogATS),
                  homeFavorite: toBucket(extra.homeFavorite),
                  homeUnderdog: toBucket(extra.homeUnderdog),
                  awayFavorite: toBucket(extra.awayFavorite),
                  awayUnderdog: toBucket(extra.awayUnderdog),
                },
                meta: {
                  last10: coversResult.data.last10,
                  streak: coversResult.data.streak,
                  lastUpdated: coversResult.data.lastUpdated,
                },
              },
            }
            break
          }
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


      case 'get_betting_splits': {
        const { getCurrentBettingSplits } = await import('@/lib/providers/covers')
        const splitsResult = await getCurrentBettingSplits('basketball_nba')

        if (!splitsResult.success) {
          result = { error: splitsResult.error }
        } else if (splitsResult.data) {
          result = {
            games_count: splitsResult.data.length,
            games: splitsResult.data,
            has_sharp_action: splitsResult.data.some((g: any) => g.sharpAction.length > 0)
          }
        } else {
          result = { error: 'No data returned' }
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

      case 'get_game_recommendations': {
        const { gameIdentifier, marketType = 'all' } = args as {
          gameIdentifier: string
          marketType?: 'spread' | 'total' | 'all'
        }

        const { getGameRecommendations, formatRecommendationForChat } = await import(
          '@/lib/services/recommendation-engine'
        )
        const recommendations = await getGameRecommendations(gameIdentifier, marketType)

        if (!recommendations || recommendations.length === 0) {
          result = {
            message: `Could not calculate target lines for ${gameIdentifier}. Team stats may be unavailable.`,
            recommendations: [],
          }
        } else {
          result = {
            message: `Calculated ${recommendations.length} target line(s) for ${gameIdentifier}`,
            recommendations: recommendations.map((rec) => ({
              type: rec.type,
              homeTeam: rec.homeTeam,
              awayTeam: rec.awayTeam,
              recommendation: rec.recommendation,
              targetLine: rec.targetLine,
              confidence: rec.confidence,
              factors: rec.factors,
              formatted: formatRecommendationForChat(rec),
            })),
          }
        }
        break
      }

      case 'get_slate_prop_edge_detection': {
        const { sport = 'basketball_nba', minEdge, limit, markets, teams, date } = args as {
          sport?: 'basketball_nba' | 'basketball_ncaab' | 'americanfootball_nfl' | 'americanfootball_ncaaf' | 'icehockey_nhl'
          minEdge?: 'soft' | 'strong'
          limit?: number
          markets?: string[]
          teams?: string[]
          date?: string
        }
        const supported = new Set([
          'basketball_nba',
          'basketball_ncaab',
          'americanfootball_nfl',
          'americanfootball_ncaaf',
          'icehockey_nhl',
        ])
        if (!supported.has(sport)) {
          result = {
            message: 'Prop edge detection is available for NBA, NCAAB, NFL, NCAAF, and NHL.',
            edges: [],
          }
        } else {
          const { analyzeSlatePropEdges, formatSlatePropEdgesForChat } = await import(
            '@/lib/services/slate-prop-edge-detector'
          )
          const propResult = await analyzeSlatePropEdges(sport, {
            limit,
            minEdge,
            markets,
            teams,
            date,
          })
          const teamsLabel = teams?.length ? ` for ${teams.join(' vs ')}` : ''
          result = {
            message: `Analyzed ${propResult.propsAnalyzed} props for ${propResult.sportLabel}${teamsLabel}`,
            edges: propResult.edges,
            formatted: formatSlatePropEdgesForChat(propResult),
          }
        }
        break
      }

      case 'get_prop_recommendations': {
        const { playerName, propType, gameIdentifier } = args as {
          playerName: string
          propType: string
          gameIdentifier?: string
        }

        const { getPropRecommendations, formatRecommendationForChat } = await import(
          '@/lib/services/recommendation-engine'
        )
        const recommendations = await getPropRecommendations(playerName, propType, gameIdentifier)

        if (!recommendations || recommendations.length === 0) {
          result = {
            message: `Could not calculate target line for ${playerName} ${propType}. Player stats may be unavailable.`,
            recommendations: [],
          }
        } else {
          result = {
            message: `Calculated target line for ${playerName} ${propType}`,
            recommendations: recommendations.map((rec) => ({
              type: rec.type,
              playerName: rec.playerName,
              statType: rec.statType,
              recommendation: rec.recommendation,
              targetLine: rec.targetLine,
              confidence: rec.confidence,
              factors: rec.factors,
              formatted: formatRecommendationForChat(rec),
            })),
          }
        }
        break
      }

      case 'get_ranked_players_by_prop_threshold': {
        const { propType, threshold, sport: argSport, todayOnly, limit } = args as {
          propType: string
          threshold: number
          sport?: 'nba' | 'nfl' | 'nhl'
          todayOnly?: boolean
          limit?: number
        }
        const { getRankedPlayersByPropThreshold, formatRankedPlayersForChat } = await import(
          '@/lib/services/prop-threshold-ranker'
        )
        const selectedSport = argSport || 'nba'
        const rankedPlayers = await getRankedPlayersByPropThreshold(propType, threshold, {
          sport: selectedSport,
          todayOnly: todayOnly ?? true,
          limit: Math.min(limit ?? 20, 50),
        })

        if (!rankedPlayers || rankedPlayers.length === 0) {
          result = {
            message: `No ${selectedSport.toUpperCase()} players found for ${propType} ≥ ${threshold}`,
            players: [],
          }
        } else {
          result = {
            message: `Found ${rankedPlayers.length} ${selectedSport.toUpperCase()} players ranked by probability of ${propType} ≥ ${threshold}`,
            players: rankedPlayers,
            formatted: formatRankedPlayersForChat(rankedPlayers, propType, threshold, selectedSport),
          }
        }
        break
      }

      case 'get_single_player_prop_probability': {
        const { playerName, propType, threshold, sport: argSport } = args as {
          playerName: string
          propType: string
          threshold: number
          sport?: 'nba' | 'nfl' | 'nhl'
        }
        const { getSinglePlayerPropProbability, formatSinglePlayerPropForChat } = await import(
          '@/lib/services/prop-threshold-ranker'
        )
        const selectedSport = argSport || 'nba'
        const propResult = await getSinglePlayerPropProbability(playerName, propType, threshold, {
          sport: selectedSport,
        })

        if (!propResult) {
          result = {
            message: `Could not find stats for ${playerName}. Make sure the player name is spelled correctly.`,
            player: null,
          }
        } else {
          result = {
            message: `Calculated probability for ${playerName} ${propType} ${threshold}+`,
            player: propResult,
            formatted: formatSinglePlayerPropForChat(propResult),
          }
        }
        break
      }

      case 'combo_analysis': {
        const { legs, sport } = args as {
          sport?: string
          legs: Array<{
            type: 'player_prop' | 'game_spread' | 'game_total' | 'game_moneyline'
            sport?: string
            player?: string
            propType?: string
            threshold?: number
            propDirection?: 'over' | 'under'
            homeTeam?: string
            awayTeam?: string
            line?: number
            direction?: 'home' | 'away' | 'over' | 'under'
            marketOdds?: number
          }>
        }

        const { calculateParlayProbability, formatParlayResultForChat } = await import(
          '@/lib/services/parlay-probability-engine'
        )

        // Map the LLM args to engine format
        const mappedLegs = legs.map(leg => ({
          type: leg.type,
          sport: leg.sport ?? sport,
          playerName: leg.player,
          propType: leg.propType,
          threshold: leg.threshold,
          propDirection: leg.propDirection,
          homeTeam: leg.homeTeam,
          awayTeam: leg.awayTeam,
          line: leg.line,
          direction: leg.direction,
          marketOdds: leg.marketOdds,
        }))

        try {
          const parlayResult = await calculateParlayProbability(mappedLegs, { sport })

          if (!parlayResult) {
            result = {
              error: 'Could not calculate parlay probability. Check that player names and teams are valid.',
            }
          } else {
            result = {
              legCount: parlayResult.legs.length,
              independentProbability: `${(parlayResult.independentProbability * 100).toFixed(1)}%`,
              correlatedProbability: `${(parlayResult.correlatedProbability * 100).toFixed(1)}%`,
              correlationAdjustments: parlayResult.correlationAdjustments,
              impliedOdds: parlayResult.impliedOdds,
              confidence: parlayResult.confidence,
              legs: parlayResult.legs.map(leg => ({
                description: leg.description,
                probability: `${(leg.probability * 100).toFixed(1)}%`,
                confidence: leg.confidence,
              })),
              formatted: formatParlayResultForChat(parlayResult),
            }
          }
        } catch (error: any) {
          result = {
            error: error?.message || 'Failed to calculate parlay probability.',
          }
        }
        break
      }
      case 'get_live_boxscore_stats': {
        const { league, eventId } = args as { league: LeagueId; eventId: string }
        if (!league || !eventId) {
          result = { error: 'league and eventId are required' }
          break
        }

        const liveGame = await getCachedGameDetails(league as LeagueId, eventId)
        if (!liveGame) {
          result = { error: `Could not fetch live game data for event ${eventId}` }
          break
        }

        const buildStatMap = (stats: any[] = []) => {
          const map: Record<string, string> = {}
          for (const stat of stats) {
            const key =
              stat?.abbreviation ||
              stat?.label ||
              stat?.name ||
              ''
            if (!key) continue
            map[key] = stat?.value ?? stat?.displayValue ?? ''
          }
          return map
        }

        const mapPlayer = (player: any) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          jersey: player.jersey,
          summaryLine: player.summaryLine,
          statMap: player.statMap || {},
        })

        const teams = liveGame.teams.map((team) => ({
          id: team.id,
          name: team.name,
          abbreviation: team.abbreviation,
          homeAway: team.homeAway,
          score: team.score,
          linescore: team.linescore,
          stats: buildStatMap(team.statistics),
          players: {
            starters: team.starters.map(mapPlayer),
            bench: team.bench.map(mapPlayer),
            offense: team.offense?.map(mapPlayer) || [],
            defense: team.defense?.map(mapPlayer) || [],
            specialTeams: team.specialTeams?.map(mapPlayer) || [],
            forwards: team.forwards?.map(mapPlayer) || [],
            defensemen: team.defensemen?.map(mapPlayer) || [],
            goalies: team.goalies?.map(mapPlayer) || [],
          },
        }))

        result = {
          eventId,
          league,
          status: liveGame.status,
          statusText: liveGame.statusText,
          venue: liveGame.venue,
          teams,
        }
        break
      }

      case 'get_live_betting_projection': {
        console.log('[LIVE_PROJECTION] TOOL CALLED - Starting execution')
        const { gameIdentifier, sport } = args as {
          gameIdentifier: string
          sport?: string
        }
        console.log('[LIVE_PROJECTION] Args received:', args)

        // Parse team names from gameIdentifier (e.g., "Spurs Hawks", "Lakers vs Celtics")
        const teamTokens = gameIdentifier
          .toLowerCase()
          .replace(/\bvs\b|\bat\b/g, ' ')
          .split(/\s+/)
          .filter((t) => t.length > 2)

        const sportHint = (sport || '').toLowerCase()
        const requestedLeague: LeagueId | null = sportHint.includes('ncaab') ||
          sportHint.includes('college')
          ? 'ncaab'
          : sportHint.includes('nba')
            ? 'nba'
            : null

        console.log('[LIVE_PROJECTION] gameIdentifier:', gameIdentifier)
        console.log('[LIVE_PROJECTION] teamTokens:', teamTokens)

        // Fetch all live games (NBA + NCAAB unless sport override provided)
        const today = new Date().toISOString().slice(0, 10)
        console.log('[LIVE_PROJECTION] Fetching live scores for date:', today)
        const allGames = await fetchAllLiveScores({ date: today })
        const candidateLeagues: LeagueId[] = requestedLeague
          ? [requestedLeague]
          : ['nba', 'ncaab']
        const candidateGames = allGames.games.filter((g) =>
          candidateLeagues.includes(g.league)
        )

        console.log('[LIVE_PROJECTION] Total games found:', allGames.games.length)
        console.log('[LIVE_PROJECTION] Candidate games found:', candidateGames.length)
        console.log('[LIVE_PROJECTION] Candidate games:', candidateGames.map((g) => ({
          id: g.id,
          league: g.league,
          status: g.status,
          competitors: g.competitors?.map((c) => ({
            name: c.name,
            abbrev: c.abbreviation,
            short: c.shortName,
          })),
        })))

        const getMatchScore = (game: (typeof candidateGames)[number]) => {
          const competitors = game.competitors || []
          let score = 0
          for (const token of teamTokens) {
            for (const comp of competitors) {
              if (
                comp.name?.toLowerCase().includes(token) ||
                comp.abbreviation?.toLowerCase().includes(token) ||
                comp.shortName?.toLowerCase().includes(token)
              ) {
                score += 1
              }
            }
          }
          return score
        }

        const rankedMatches = candidateGames
          .map((game) => ({ game, score: getMatchScore(game) }))
          .filter((entry) => entry.score > 0)
          .sort((a, b) => b.score - a.score)

        const matchingGame = rankedMatches[0]?.game

        console.log(
          '[LIVE_PROJECTION] Matching game found:',
          matchingGame ? matchingGame.id : 'NONE'
        )

        if (!matchingGame) {
          const availableGames = candidateGames
            .map((g) => {
              const home = g.competitors?.find((c) => c.homeAway === 'home')
              const away = g.competitors?.find((c) => c.homeAway === 'away')
              return `${away?.name} @ ${home?.name}`
            })
            .join(', ')
          const leagueLabel =
            requestedLeague === 'ncaab'
              ? 'NCAAB'
              : requestedLeague === 'nba'
                ? 'NBA'
                : 'NBA/NCAAB'
          result = {
            error: `No live ${leagueLabel} game found matching "${gameIdentifier}". ${
              availableGames
                ? `Available live games: ${availableGames}`
                : 'No live games currently.'
            }`,
          }
          break
        }

        // Get full game details
        const liveGame = await getCachedGameDetails(
          matchingGame.league as LeagueId,
          matchingGame.id
        )

        if (!liveGame) {
          result = { error: `Could not fetch detailed data for game ${matchingGame.id}` }
          break
        }

        // Analyze momentum
        const gameState = await getCachedLiveGameAnalysis(
          matchingGame.league as LeagueId,
          matchingGame.id
        )

        // Get team stats
        const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
        const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

        if (!homeTeam || !awayTeam) {
          result = { error: 'Could not find home/away teams in game data' }
          break
        }

        const homeStats = await getLiveTeamStats(homeTeam.name || '', liveGame.league)
        const awayStats = await getLiveTeamStats(awayTeam.name || '', liveGame.league)

        if (!homeStats || !awayStats) {
          result = { error: 'Could not load team stats for analysis' }
          break
        }

        const pregameSpread = await buildPregameSpreadContext(
          liveGame.league,
          homeTeam.name || 'Home',
          awayTeam.name || 'Away'
        )
        if (pregameSpread) {
          gameState.pregameSpread = pregameSpread
        }

        // Calculate live spread projection
        const spreadRec = calculateLiveSpread(gameState, { homeStats, awayStats })
        const spreadFormatted = formatLiveRecommendation(spreadRec, gameState)

        // Calculate live total projection
        const totalRec = calculateLiveTotal(gameState, { homeStats, awayStats })
        const totalFormatted = formatLiveRecommendation(totalRec, gameState)

        // Format for LLM
        result = {
          gameIdentifier,
          matchup: `${awayTeam.name} @ ${homeTeam.name}`,
          gameState: {
            score: `${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
            period: `${formatLivePeriodLabel(gameState.sport, gameState.period)} ${gameState.displayClock}`,
            timeRemaining: gameState.timeRemaining,
          },
          pregameSpread: gameState.pregameSpread ?? null,
          teamStats: {
            [homeTeam.name || 'Home']: {
              net: (homeStats.ortg - homeStats.drtg).toFixed(1),
              offensiveRating: homeStats.ortg.toFixed(1),
              defensiveRating: homeStats.drtg.toFixed(1),
              pace: homeStats.pace.toFixed(1),
              trueShootingPct: homeStats.ts?.toFixed(3) || 'N/A',
              effectiveFieldGoalPct: homeStats.eFG?.toFixed(3) || 'N/A',
            },
            [awayTeam.name || 'Away']: {
              net: (awayStats.ortg - awayStats.drtg).toFixed(1),
              offensiveRating: awayStats.ortg.toFixed(1),
              defensiveRating: awayStats.drtg.toFixed(1),
              pace: awayStats.pace.toFixed(1),
              trueShootingPct: awayStats.ts?.toFixed(3) || 'N/A',
              effectiveFieldGoalPct: awayStats.eFG?.toFixed(3) || 'N/A',
            },
          },
          projections: {
            spread: spreadFormatted,
            spreadType: 'projection',
            total: totalFormatted,
          },
        }
        break
      }

      case 'getLiveBettingRecommendation': {
        const { league, eventId, betType = 'both' } = args as {
          league: string
          eventId: string
          betType?: 'spread' | 'total' | 'both'
        }

        // 1. Fetch live game data
        const liveGame = await getCachedGameDetails(league as LeagueId, eventId)

        if (!liveGame) {
          result = { error: `Could not fetch live game data for event ${eventId}` }
          break
        }

        // 2. Analyze momentum
        const gameState = await getCachedLiveGameAnalysis(
          league as LeagueId,
          eventId
        )

        // 3. Get pre-game team stats (with injuries)
        const homeTeam = liveGame.teams.find((t) => t.homeAway === 'home')
        const awayTeam = liveGame.teams.find((t) => t.homeAway === 'away')

        if (!homeTeam || !awayTeam) {
          result = { error: 'Could not find home/away teams in game data' }
          break
        }

        const homeStats = await getLiveTeamStats(homeTeam.name || '', liveGame.league)
        const awayStats = await getLiveTeamStats(awayTeam.name || '', liveGame.league)

        if (!homeStats || !awayStats) {
          result = { error: 'Could not load team stats for analysis' }
          break
        }

        const pregameSpread = await buildPregameSpreadContext(
          liveGame.league,
          homeTeam.name || 'Home',
          awayTeam.name || 'Away'
        )
        if (pregameSpread) {
          gameState.pregameSpread = pregameSpread
        }

        // 4. Calculate live lines
        const recommendations: string[] = []

        if (betType === 'spread' || betType === 'both') {
          const spreadRec = calculateLiveSpread(gameState, { homeStats, awayStats })
          recommendations.push(formatLiveRecommendation(spreadRec, gameState))
        }

        if (betType === 'total' || betType === 'both') {
          const totalRec = calculateLiveTotal(gameState, { homeStats, awayStats })
          recommendations.push(formatLiveRecommendation(totalRec, gameState))
        }

        // 5. Format for LLM
        result = {
          eventId,
          gameState: {
            score: `${gameState.awayTeam} ${gameState.awayScore} - ${gameState.homeScore} ${gameState.homeTeam}`,
            period: `${formatLivePeriodLabel(gameState.sport, gameState.period)} ${gameState.displayClock}`,
            timeRemaining: gameState.timeRemaining,
          },
          pregameSpread: gameState.pregameSpread ?? null,
          recommendations: recommendations.join('\n\n---\n\n'),
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
        const sport = args.sport || 'nba'
        const limit = args.limit || 10

        // Currently only NBA is supported with ESPN stats
        if (sport !== 'nba') {
          result = {
            stat: args.stat,
            sport,
            error: `Leaderboard data for ${sport.toUpperCase()} not yet available. NBA only for now.`,
          }
          break
        }

        const leaderboard = await getPlayerLeaderboard(args.stat, limit)

        if (leaderboard.error) {
          result = {
            stat: args.stat,
            sport,
            error: leaderboard.error,
          }
        } else {
          // Format for easy LLM consumption
          const formatted = leaderboard.leaders
            .map((entry) => `${entry.rank}. ${entry.player} (${entry.team}) - ${entry.value.toFixed(1)}`)
            .join('\n')

          result = {
            stat: leaderboard.stat,
            sport,
            count: leaderboard.leaders.length,
            leaders: leaderboard.leaders,
            formatted: `NBA Leaders - ${leaderboard.stat}:\n${formatted}`,
          }
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
