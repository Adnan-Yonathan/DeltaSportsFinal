"use client"

import { useEffect, useState } from "react"
import MarketProjectionsRefresh from "./market-projections-refresh"
import MarketProjectionsTable from "./market-projections-table"
import type { GameEdgeAnalysis } from "@/lib/services/slate-edge-detector"

type MarketProjectionsClientProps = {
  initialEdges: GameEdgeAnalysis[]
  initialUpdatedAt: string | null
  hasCache: boolean
  errorMessage: string | null
  sport: string
  isLocked?: boolean
}

type RefreshPayload = {
  updatedAt?: string
  edges?: unknown[]
  sport?: string
  fromCache?: boolean
  refreshing?: boolean
  error?: string
}

export default function MarketProjectionsClient({
  initialEdges,
  initialUpdatedAt,
  hasCache,
  errorMessage,
  sport,
  isLocked,
}: MarketProjectionsClientProps) {
  const [edges, setEdges] = useState<GameEdgeAnalysis[]>(initialEdges)
  const [lastUpdated, setLastUpdated] = useState<string | null>(initialUpdatedAt)
  const [cacheReady, setCacheReady] = useState(hasCache)
  const [error, setError] = useState<string | null>(errorMessage)
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    setEdges(initialEdges)
    setLastUpdated(initialUpdatedAt)
    setCacheReady(hasCache)
    setError(errorMessage)
  }, [initialEdges, initialUpdatedAt, hasCache, errorMessage, sport])

  const handleUpdated = (payload: RefreshPayload) => {
    if (payload.sport && payload.sport !== sport) return
    if (payload.updatedAt) setLastUpdated(payload.updatedAt)
    if (Array.isArray(payload.edges)) {
      setEdges(payload.edges as GameEdgeAnalysis[])
      setCacheReady(true)
      setError(null)
    }
    if (payload.error) {
      setError(payload.error)
    }
  }

  const handleStatusChange = (
    status: "idle" | "loading" | "done" | "error" | "timeout"
  ) => {
    setIsRefreshing(status === "loading")
  }

  const showLoading = isRefreshing && edges.length === 0

  return (
    <>
      <MarketProjectionsRefresh
        hasCache={cacheReady}
        errorMessage={error}
        sport={sport}
        isLocked={isLocked}
        lastUpdated={lastUpdated}
        includeEdges
        onUpdated={handleUpdated}
        onStatusChange={handleStatusChange}
      />
      {showLoading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Loading projections...
          </div>
        </div>
      )}
      <MarketProjectionsTable
        edges={edges}
        errorMessage={cacheReady ? error : null}
        sport={sport}
      />
    </>
  )
}
