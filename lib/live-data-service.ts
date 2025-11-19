import type { LiveScoreGameDetails, LiveScoresResponse, LeagueId } from "@/lib/live-scores"
import { ESPN_LEAGUES, fetchAllLiveScores, fetchGameDetails } from "@/lib/live-scores"
import { loadCachedGameDetails, loadCachedScores } from "@/lib/live-score-cache"

interface LeagueConfig {
  id: LeagueId
  sport: string
  league: string
  label: string
}

const getConfig = (league: LeagueId): LeagueConfig => {
  const config = ESPN_LEAGUES.find((entry) => entry.id === league)
  if (!config) {
    throw new Error(`Unsupported league ${league}`)
  }
  return config as LeagueConfig
}

const ESPN_API_BASE = "https://site.api.espn.com/apis/site/v2/sports"

export interface LiveScoresRequest {
  date?: string
  league?: LeagueId
}

export const getLiveScoresData = async ({ date, league }: LiveScoresRequest): Promise<LiveScoresResponse> => {
  const cached = loadCachedScores()
  const useCache = cached && (!date || cached.requestedDate === date)
  const response = useCache ? cached : await fetchAllLiveScores({ date })
  const filteredGames = league ? response.games.filter((game) => game.league === league) : response.games
  return { ...response, games: filteredGames }
}

export interface GameDetailsRequest {
  league: LeagueId
  eventId: string
}

export const getGameDetailsData = async ({ league, eventId }: GameDetailsRequest): Promise<LiveScoreGameDetails> => {
  const cached = loadCachedGameDetails(league, eventId)
  if (cached) {
    return cached
  }
  return fetchGameDetails(league, eventId)
}

export const getTeamSnapshot = async (league: LeagueId, teamId: string) => {
  const config = getConfig(league)
  const url = `${ESPN_API_BASE}/${config.sport}/${config.league}/teams/${teamId}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    throw new Error(`Unable to fetch team snapshot (${res.status})`)
  }
  return res.json()
}

export const getPlayerSeasonStats = async (league: LeagueId, playerId: string) => {
  const config = getConfig(league)
  const url = `${ESPN_API_BASE}/${config.sport}/${config.league}/athletes/${playerId}`
  const res = await fetch(url, { next: { revalidate: 300 } })
  if (!res.ok) {
    throw new Error(`Unable to fetch player stats (${res.status})`)
  }
  return res.json()
}
