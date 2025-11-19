"use client"

import { useCallback, useEffect, useState } from "react"
import type { LeagueId, LiveScoreGameDetails } from "@/lib/live-scores"

interface UseGameDetailsOptions {
  league?: LeagueId
  eventId?: string
  enabled?: boolean
}

export function useGameDetails({ league, eventId, enabled = false }: UseGameDetailsOptions) {
  const [data, setData] = useState<LiveScoreGameDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetails = useCallback(async () => {
    if (!league || !eventId) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/live-scores/${eventId}?league=${league}`, {
        cache: "no-store",
      })
      if (!response.ok) {
        throw new Error("Failed to load box score.")
      }
      const payload = (await response.json()) as LiveScoreGameDetails
      setData(payload)
    } catch (err: any) {
      setError(err?.message ?? "Unable to load box score.")
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [league, eventId])

  useEffect(() => {
    if (enabled && league && eventId) {
      fetchDetails()
    } else if (!enabled) {
      setData(null)
      setError(null)
    }
  }, [enabled, league, eventId, fetchDetails])

  return {
    data,
    loading,
    error,
    refetch: fetchDetails,
  }
}
