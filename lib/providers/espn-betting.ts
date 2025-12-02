const ESPN_CORE_BASE = 'https://sports.core.api.espn.com/v2/sports'

const CACHE_TTL = 1000 * 60 * 10 // 10 minutes
type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()

const fetchJson = async <T>(url: string, cacheTtl = CACHE_TTL): Promise<T | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as T
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const data = (await res.json()) as T
  cache.set(url, { ts: Date.now(), data })
  return data
}

export interface FuturesResponse {
  items?: any[]
}

export interface OddsRecordResponse {
  items?: any[]
}

export interface PredictorResponse {
  items?: any[]
}

export const fetchFutures = async (
  sportPath: string,
  season: number
): Promise<FuturesResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/seasons/${season}/futures`
  return fetchJson<FuturesResponse>(url, 1000 * 60 * 60)
}

export const fetchTeamAts = async (
  sportPath: string,
  season: number,
  seasonType: number,
  teamId: string
): Promise<OddsRecordResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/seasons/${season}/types/${seasonType}/teams/${teamId}/ats`
  return fetchJson<OddsRecordResponse>(url, 1000 * 60 * 60)
}

export const fetchTeamOddsRecord = async (
  sportPath: string,
  season: number,
  teamId: string
): Promise<OddsRecordResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/seasons/${season}/types/0/teams/${teamId}/odds-records`
  return fetchJson<OddsRecordResponse>(url, 1000 * 60 * 60)
}

export const fetchTeamPastPerformances = async (
  sportPath: string,
  teamId: string,
  providerId: string,
  limit = 140
): Promise<OddsRecordResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/teams/${teamId}/odds/${providerId}/past-performances?limit=${limit}`
  return fetchJson<OddsRecordResponse>(url, 1000 * 60 * 60)
}

export const fetchPredictor = async (
  sportPath: string,
  eventId: string,
  providerId = 'default'
): Promise<PredictorResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/events/${eventId}/competitions/${eventId}/predictor${providerId !== 'default' ? `/${providerId}` : ''}`
  return fetchJson<PredictorResponse>(url, 1000 * 60 * 5)
}

export const fetchPowerIndex = async (
  sportPath: string,
  eventId: string,
  teamId: string
): Promise<PredictorResponse | null> => {
  const url = `${ESPN_CORE_BASE}/${sportPath}/events/${eventId}/competitions/${eventId}/powerindex/${teamId}`
  return fetchJson<PredictorResponse>(url, 1000 * 60 * 5)
}

