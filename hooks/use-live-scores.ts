"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LiveScoresResponse } from "@/lib/live-scores"

interface UseLiveScoresOptions {
  refreshInterval?: number
  date?: string
}

export function useLiveScores({ refreshInterval = 5000, date }: UseLiveScoresOptions = {}) {
  const [data, setData] = useState<LiveScoresResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)

  const fetchScores = useCallback(
    async (showInitialLoader = false) => {
      if (showInitialLoader) {
        setLoading(true)
        setIsRefreshing(false)
      } else {
        setIsRefreshing(true)
      }
      setError(null)

      controllerRef.current?.abort()
      const controller = new AbortController()
      controllerRef.current = controller

      try {
        const query = date ? `?date=${encodeURIComponent(date)}` : ""
        const response = await fetch(`/api/live-scores${query}`, {
          signal: controller.signal,
          cache: "no-store",
        })

        if (!response.ok) {
          throw new Error("Failed to load live scores")
        }

        const payload = (await response.json()) as LiveScoresResponse
        setData(payload)
      } catch (err: any) {
        if (err.name === "AbortError") return
        setError(err?.message ?? "Unable to load live scores")
      } finally {
        setLoading(false)
        setIsRefreshing(false)
      }
    },
    [date]
  )

  useEffect(() => {
    fetchScores(true)
    const interval = setInterval(() => {
      fetchScores(false)
    }, refreshInterval)

    return () => {
      clearInterval(interval)
      controllerRef.current?.abort()
    }
  }, [fetchScores, refreshInterval])

  const lastUpdated = useMemo(() => data?.updatedAt ?? null, [data])

  return {
    data,
    loading,
    error,
    lastUpdated,
    isRefreshing,
    refetch: () => fetchScores(false),
  }
}
