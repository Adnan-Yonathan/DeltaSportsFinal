import * as espn from '@/lib/services/espn-orchestrator'

type Resolver = (args: any) => Promise<any>

export const toolResolvers: Record<string, Resolver> = {
  espnTeamAtsRecord: ({ sport, teamId, season, seasonType = 2 }) =>
    espn.getTeamAtsRecord(sport, teamId, season, seasonType),
  espnTeamOddsRecord: ({ sport, teamId, season }) =>
    espn.getTeamOddsRecord(sport, teamId, season),
  espnTeamPastPerformances: ({ sport, teamId, providerId = '1003', limit }) =>
    espn.getTeamPastPerformances(sport, teamId, providerId, limit),
  espnTeamFutures: ({ sport, season }) => espn.getFutures(sport, season),
  espnPredictor: ({ sport, eventId }) => espn.getPredictor(sport, eventId),
  espnTeamSeasonStats: ({ sport, teamId, season, seasonType = 2 }) =>
    espn.getTeamSeasonStats(sport, teamId, season, seasonType),
  espnPlayerSeasonStats: ({ sport, playerId, season, seasonType = 2 }) =>
    espn.getPlayerSeasonStats(sport, playerId, season, seasonType),
  espnPlayerGameLogs: ({ sport, playerId, season, seasonType = 2 }) =>
    espn.getPlayerGameLogs(sport, playerId, season, seasonType),
  espnEventsByDateRange: ({ sport, from, to }) => espn.getEventsByDateRange(sport, from, to),
  espnEventSnapshot: ({ sport, eventId }) => espn.getEventSnapshot(sport, eventId),
  espnInjuries: ({ sport }) => espn.getInjuries(sport),
}
