import type { LiveScoreGameDetails, LeagueId } from '@/lib/live-scores'
import { fetchGameDetails } from '@/lib/live-scores'
import { analyzeLiveGame, type LiveGameState } from '@/lib/services/live-game-analyzer'
import {
  loadCachedAnalysis,
  loadCachedGameDetails,
  saveCachedAnalysis,
  saveCachedGameDetails,
} from '@/lib/live-score-cache'

const CACHE_TTL_MS = 24 * 60 * 60 * 1000

export async function getCachedGameDetails(
  league: LeagueId,
  eventId: string
): Promise<LiveScoreGameDetails> {
  const cached = loadCachedGameDetails(league, eventId, { ttlMs: CACHE_TTL_MS })
  if (cached) return cached
  const fresh = await fetchGameDetails(league, eventId)
  saveCachedGameDetails(league, eventId, fresh)
  return fresh
}

export async function getCachedLiveGameAnalysis(
  league: LeagueId,
  eventId: string
): Promise<LiveGameState> {
  const cached = loadCachedAnalysis(league, eventId, { ttlMs: CACHE_TTL_MS })
  if (cached) return cached
  const liveGame = await getCachedGameDetails(league, eventId)
  const analysis = await analyzeLiveGame(liveGame)
  saveCachedAnalysis(league, eventId, analysis)
  return analysis
}
