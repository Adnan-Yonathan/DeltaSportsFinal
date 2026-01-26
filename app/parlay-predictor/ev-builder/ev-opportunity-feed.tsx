'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EVOpportunity } from '@/lib/utils/ev-calculator'
import EVOpportunityCard from './ev-opportunity-card'
import { AVAILABLE_BOOKS } from '@/lib/config/books'

const REFRESH_MS = 60000

interface EVOpportunityFeedProps {
  selectedBooks: string[]
  sports: string[]
  betTypes: string[]
  selectedIds: Set<string>
  onAdd: (opportunity: EVOpportunity) => void
  previewMode?: boolean
}

export default function EVOpportunityFeed({
  selectedBooks,
  sports,
  betTypes,
  selectedIds,
  onAdd,
  previewMode = false,
}: EVOpportunityFeedProps) {
  const [opportunities, setOpportunities] = useState<EVOpportunity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const lastFetchedRef = useRef(0)

  const fetchOpportunities = useCallback(async () => {
    // Don't fetch if no books selected
    if (selectedBooks.length === 0) {
      setOpportunities([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('compareBooks', selectedBooks.join(','))
      params.set('placeAtBooks', selectedBooks.join(','))
      if (sports.length > 0) {
        params.set('sports', sports.join(','))
      }
      if (betTypes.length > 0) {
        params.set('betTypes', betTypes.join(','))
      }
      params.set('minEV', '0')
      params.set('limit', '100')

      const res = await fetch(`/api/ev-opportunities?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || 'Failed to load EV opportunities.')
      }

      const payload = await res.json()
      const data = Array.isArray(payload?.data) ? payload.data : []
      setOpportunities(data)
      setLastUpdated(new Date().toISOString())
      lastFetchedRef.current = Date.now()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load EV opportunities.')
      setOpportunities([])
    } finally {
      setLoading(false)
    }
  }, [selectedBooks, sports, betTypes])

  // Initial fetch and interval
  useEffect(() => {
    fetchOpportunities()
    const interval = window.setInterval(fetchOpportunities, REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [fetchOpportunities])

  // Visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      const elapsed = Date.now() - lastFetchedRef.current
      if (elapsed >= REFRESH_MS) {
        fetchOpportunities()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [fetchOpportunities])

  // Update timer
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(interval)
  }, [])

  const lastUpdatedLabel = useMemo(() => {
    if (!lastUpdated) return '-'
    const date = new Date(lastUpdated)
    if (Number.isNaN(date.getTime())) return '-'
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }, [lastUpdated])

  const remainingSeconds = useMemo(() => {
    if (!lastUpdated) return Math.ceil(REFRESH_MS / 1000)
    const updatedMs = Date.parse(lastUpdated)
    if (!Number.isFinite(updatedMs)) return Math.ceil(REFRESH_MS / 1000)
    return Math.max(0, Math.ceil((updatedMs + REFRESH_MS - now) / 1000))
  }, [lastUpdated, now])

  const placeAtLabels = useMemo(() => {
    return selectedBooks
      .slice(0, 3)
      .map(k => AVAILABLE_BOOKS.find(b => b.key === k)?.label || k)
      .join(', ')
  }, [selectedBooks])

  const buildOpportunityId = (opp: EVOpportunity) => {
    return `${opp.gameId}-${opp.market}-${opp.selection}-${opp.point ?? ''}-${opp.bestBook}`
  }
  const visibleOpportunities = previewMode ? opportunities.slice(0, 1) : opportunities

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-1 pb-2">
        <div>
          <p className="text-xs font-semibold text-white/90">
            EV Opportunities ({opportunities.length})
          </p>
          {selectedBooks.length > 0 && (
            <p className="text-[10px] text-white/50">
              Showing: {placeAtLabels} bets
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] text-white/40">
            Updated {lastUpdatedLabel}
          </p>
          <p className="text-[9px] text-white/40">
            Refresh in {remainingSeconds}s
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
          {error}
        </div>
      )}

      {loading && opportunities.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-sm text-white/50">
          Scanning markets...
        </div>
      )}

      {!loading && !error && selectedBooks.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <p className="text-sm text-white/50">
            Select books to scan for opportunities.
          </p>
        </div>
      )}

      {!loading && !error && opportunities.length === 0 && selectedBooks.length > 0 && (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <p className="text-sm text-white/50">
            No +EV opportunities found with current selection.<br />
            <span className="text-[11px]">Try adjusting your book selections or check back later.</span>
          </p>
        </div>
      )}

      {visibleOpportunities.length > 0 && (
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {visibleOpportunities.map(opp => {
            const id = buildOpportunityId(opp)
            return (
              <EVOpportunityCard
                key={id}
                opportunity={opp}
                onAdd={onAdd}
                isSelected={selectedIds.has(id)}
                disabled={previewMode}
              />
            )
          })}
        </div>
      )}
      {previewMode && (
        <div className="relative mt-3 overflow-hidden rounded-xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm space-y-3 px-3 py-4">
            {[1, 2, 3].map((row) => (
              <div key={row} className="h-16 rounded-lg bg-white/5 border border-white/10" />
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center text-center text-[11px] uppercase tracking-[0.2em] text-white/70">
            Upgrade for full access
          </div>
        </div>
      )}
    </div>
  )
}
