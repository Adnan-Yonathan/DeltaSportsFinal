import type { LiveScoresResponse, LiveScoreGameDetails } from "@/lib/live-scores"

const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) {
    throw new Error(`Live metrics fetch failed: ${res.status}`)
  }
  const payload = await res.json()
  return (payload.data ?? payload) as T
}

export async function getCachedScores(date?: string): Promise<LiveScoresResponse> {
  const query = date ? `?date=${encodeURIComponent(date)}` : ""
  return fetcher<LiveScoresResponse>(`/api/live-scores/cache${query}`)
}

export async function getCachedGameDetails(league: string, eventId: string): Promise<LiveScoreGameDetails> {
  return fetcher<LiveScoreGameDetails>(`/api/live-scores/cache/${eventId}?league=${league}`)
}
