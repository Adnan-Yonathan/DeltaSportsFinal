import { resolveSportKey, type CanonicalSportKey } from '@/lib/identity/sport'
import {
  getInjuryReports,
  getPlayerSeasonStats,
  getRoster,
  getTeamStats,
  searchPlayer,
  type InjuryReport,
  type PlayerStats,
  type RosterPlayer,
  type TeamStats,
} from '@/lib/sports-stats-api'

export type SportProvider = {
  sportKey: CanonicalSportKey
  getTeamStats: (team?: string) => Promise<TeamStats[]>
  getPlayerSeasonStats: (playerName: string) => Promise<PlayerStats | null>
  searchPlayer: (playerName: string) => Promise<RosterPlayer | null>
  getRoster: (teamAbbr?: string) => Promise<RosterPlayer[]>
  getInjuryReports: () => Promise<InjuryReport[]>
}

const DEFAULT_SPORT: CanonicalSportKey = 'basketball_nba'

export const resolveProviderSportKey = (
  sport?: string | null
): CanonicalSportKey => resolveSportKey(sport) ?? DEFAULT_SPORT

export const getSportProvider = (sport?: string | null): SportProvider => {
  const sportKey = resolveProviderSportKey(sport)
  return {
    sportKey,
    getTeamStats: (team) => getTeamStats(sportKey, team),
    getPlayerSeasonStats: (playerName) =>
      getPlayerSeasonStats(playerName, sportKey),
    searchPlayer: (playerName) => searchPlayer(playerName, sportKey),
    getRoster: (teamAbbr) => getRoster(sportKey, teamAbbr),
    getInjuryReports: () => getInjuryReports(sportKey),
  }
}
