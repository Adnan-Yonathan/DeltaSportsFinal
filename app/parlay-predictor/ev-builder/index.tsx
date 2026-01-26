'use client'

import { useCallback, useMemo, useState } from 'react'
import { EVOpportunity } from '@/lib/utils/ev-calculator'
import { BET_TYPES, SUPPORTED_SPORTS } from './ev-filters'
import EVOpportunityFeed from './ev-opportunity-feed'
import EVParlaySummary from './ev-parlay-summary'
import { type BookKey } from '@/components/BookSelector'

interface SelectedLeg extends EVOpportunity {
  legId: string
}

interface EVBuilderProps {
  selectedBooks?: BookKey[]
  previewMode?: boolean
}

const buildOpportunityId = (opp: EVOpportunity) => {
  return `${opp.gameId}-${opp.market}-${opp.selection}-${opp.point ?? ''}-${opp.bestBook}`
}

export default function EVBuilder({ selectedBooks, previewMode = false }: EVBuilderProps) {
  const [selectedLegs, setSelectedLegs] = useState<SelectedLeg[]>([])
  const bookKeys = useMemo(
    () => (selectedBooks && selectedBooks.length > 0 ? selectedBooks : []),
    [selectedBooks]
  )

  const selectedIds = useMemo(() => {
    return new Set(selectedLegs.map(leg => buildOpportunityId(leg)))
  }, [selectedLegs])

  const handleAddLeg = useCallback((opportunity: EVOpportunity) => {
    const legId = `${buildOpportunityId(opportunity)}-${Date.now()}`
    const newLeg: SelectedLeg = {
      ...opportunity,
      legId,
    }
    setSelectedLegs(prev => [...prev, newLeg])
  }, [])

  const handleRemoveLeg = useCallback((legId: string) => {
    setSelectedLegs(prev => prev.filter(leg => leg.legId !== legId))
  }, [])

  return (
    <div className="space-y-4">
      {/* Main content: Feed + Summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Opportunities Feed */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[400px] max-h-[600px] flex flex-col">
          <EVOpportunityFeed
            selectedBooks={bookKeys}
            sports={SUPPORTED_SPORTS.map(s => s.key)}
            betTypes={BET_TYPES.map(t => t.key)}
            selectedIds={selectedIds}
            onAdd={handleAddLeg}
            previewMode={previewMode}
          />
        </div>

        {/* Parlay Summary */}
        <div className="relative rounded-2xl border border-white/10 bg-white/5 p-4 min-h-[400px] max-h-[600px] flex flex-col">
          <div className={previewMode ? 'pointer-events-none blur-sm' : ''}>
            <EVParlaySummary
              legs={selectedLegs}
              onRemove={handleRemoveLeg}
              targetEV={3}
            />
          </div>
          {previewMode && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/60 text-center text-sm text-white/70">
              Upgrade to build full parlays.
            </div>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            <strong className="text-white/70">How it works:</strong> Your sportsbook dropdown controls which books are scanned for +EV legs.
          </span>
          <span>
            Add legs to build a parlay and see the minimum odds needed for {3}% EV.
          </span>
        </div>
      </div>
    </div>
  )
}
