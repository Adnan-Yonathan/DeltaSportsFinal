'use client'

import { useState } from 'react'
import TutorialPopup from "@/components/TutorialPopup"
import EvParlaysClient from './ev-parlays-client'
import EVBuilder from './ev-builder'
import BookSelector, { useBookSelection } from '@/components/BookSelector'

export default function ParlayPredictor({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'ev-parlays' | 'builder'>('builder')
  const { selectedBooks, setSelectedBooks, isHydrated, apiKeys } = useBookSelection()

  return (
    <>
      <TutorialPopup tutorialId="parlay-pro" />
      <div className="mt-4 sm:mt-8 space-y-4 sm:space-y-6">
        {/* Book Selector - applies to both tabs */}
        {isHydrated && (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">
                Your Sportsbooks
              </span>
              <BookSelector
                selectedBooks={selectedBooks}
                onChange={setSelectedBooks}
                variant="compact"
                showLabel={false}
              />
            </div>
            <div className="text-[10px] text-white/40">
              Showing odds from {selectedBooks.length} book{selectedBooks.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {/* Tab Toggle */}
        <div className="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-white/5 p-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('builder')}
            className={`rounded-xl px-8 py-3 text-base font-semibold transition-all min-w-[180px] ${
              activeTab === 'builder'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            Build Your Own
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ev-parlays')}
            className={`rounded-xl px-8 py-3 text-base font-semibold transition-all min-w-[200px] ${
              activeTab === 'ev-parlays'
                ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                : 'text-white/50 hover:text-white/70 hover:bg-white/5'
            }`}
          >
            Done For You Parlays
          </button>
        </div>

        {activeTab === 'builder' ? (
          <EVBuilder selectedBooks={selectedBooks} previewMode={previewMode} />
        ) : (
          <EvParlaysClient selectedBooks={selectedBooks} previewMode={previewMode} />
        )}
      </div>
    </>
  )
}
