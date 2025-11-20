"use client"

import { useCallback, useEffect, useState } from "react"
import type { LeagueId, LiveScoreGameDetails } from "@/lib/live-scores"

interface UseGameDetailsOptions {
  league?: LeagueId
  eventId?: string
  enabled?: boolean
  refreshIntervalMs?: number
}

export function useGameDetails({
  league,
  eventId,
  enabled = false,
  refreshIntervalMs = 15000,
}: UseGameDetailsOptions) {
  const [data, setData] = useState<LiveScoreGameDetails | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDetails = useCallback(
    async ({ withLoader = true }: { withLoader?: boolean } = {}) => {
      if (!league || !eventId) return
      if (withLoader) {
        setLoading(true)
        setError(null)
      }
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
        if (withLoader) {
          setError(err?.message ?? "Unable to load box score.")
          setData(null)
        } else {
          console.error("[use-game-details] background refresh failed", err)
        }
      } finally {
        if (withLoader) {
          setLoading(false)
        }
      }
    },
    [league, eventId]
  )

  useEffect(() => {
    if (!enabled || !league || !eventId) {
      setData(null)
      setError(null)
      setLoading(false)
      return
    }

    let interval: ReturnType<typeof setInterval> | null = null
    fetchDetails({ withLoader: true })

    if (refreshIntervalMs > 0) {
      interval = setInterval(() => {
        fetchDetails({ withLoader: false })
      }, refreshIntervalMs)
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [enabled, league, eventId, refreshIntervalMs, fetchDetails])

  const handleRefetch = useCallback(() => {
    if (!league || !eventId) return
    fetchDetails({ withLoader: true })
  }, [league, eventId, fetchDetails])

  return {
    data,
    loading,
    error,
    refetch: handleRefetch,
  }
}
