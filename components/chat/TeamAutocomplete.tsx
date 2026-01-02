'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { searchTeams, hasMultipleSportMatches } from '@/lib/data/team-search'
import type { TeamRecord, TeamSearchResult } from '@/lib/types/teams'
import { SPORT_DISPLAY } from '@/lib/types/teams'

interface TeamAutocompleteProps {
  query: string
  visible: boolean
  onSelect: (team: TeamRecord) => void
  onClose: () => void
  anchorRect?: DOMRect | null
}

export function TeamAutocomplete({
  query,
  visible,
  onSelect,
  onClose,
  anchorRect,
}: TeamAutocompleteProps) {
  const [results, setResults] = useState<TeamSearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [showSportBadges, setShowSportBadges] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Search teams when query changes
  useEffect(() => {
    if (!visible || query.length < 2) {
      setResults([])
      return
    }

    const searchResults = searchTeams(query, { limit: 8 })
    setResults(searchResults)
    setSelectedIndex(0)
    setShowSportBadges(hasMultipleSportMatches(query))
  }, [query, visible])

  // Keyboard navigation
  useEffect(() => {
    if (!visible || results.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % results.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + results.length) % results.length)
          break
        case 'Enter':
          e.preventDefault()
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
        case 'Tab':
          e.preventDefault()
          if (results[selectedIndex]) {
            onSelect(results[selectedIndex])
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, results, selectedIndex, onSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.children[selectedIndex] as HTMLElement | undefined
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  // Click outside to close
  useEffect(() => {
    if (!visible) return

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [visible, onClose])

  if (!visible || results.length === 0) {
    return null
  }

  // Calculate position (below cursor/anchor)
  const style: React.CSSProperties = {
    position: 'absolute',
    zIndex: 50,
  }

  if (anchorRect) {
    style.top = anchorRect.bottom + 4
    style.left = anchorRect.left
    // Ensure it doesn't go off-screen
    style.maxWidth = 'min(320px, calc(100vw - 32px))'
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        style={style}
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-xl overflow-hidden"
      >
        <div ref={listRef} className="max-h-[280px] overflow-y-auto">
          {results.map((team, index) => (
            <TeamAutocompleteItem
              key={`${team.sport}-${team.id}`}
              team={team}
              isSelected={index === selectedIndex}
              showSportBadge={showSportBadges}
              onSelect={() => onSelect(team)}
              onHover={() => setSelectedIndex(index)}
            />
          ))}
        </div>
        <div className="border-t border-[#2a2a2a] px-3 py-1.5 text-xs text-white/40">
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">↑↓</kbd>
          navigate
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">Enter</kbd>
          select
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">Esc</kbd>
          close
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

interface TeamAutocompleteItemProps {
  team: TeamSearchResult
  isSelected: boolean
  showSportBadge: boolean
  onSelect: () => void
  onHover: () => void
}

function TeamAutocompleteItem({
  team,
  isSelected,
  showSportBadge,
  onSelect,
  onHover,
}: TeamAutocompleteItemProps) {
  const sportLabel = SPORT_DISPLAY[team.sport]?.shortLabel || ''

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`
        w-full flex items-center gap-3 px-3 py-2 text-left transition-colors
        ${isSelected ? 'bg-emerald-500/20' : 'hover:bg-white/5'}
      `}
    >
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.shortName}
          className="w-6 h-6 object-contain flex-shrink-0"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`font-medium truncate ${isSelected ? 'text-emerald-400' : 'text-white'}`}>
            {team.name}
          </span>
          {showSportBadge && sportLabel && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-white/60 flex-shrink-0">
              {sportLabel}
            </span>
          )}
        </div>
        <div className="text-xs text-white/50 truncate">
          {team.abbreviation}
          {team.conference && ` · ${team.conference}`}
        </div>
      </div>
    </button>
  )
}

/**
 * Hook to detect if user is typing a team name and return the query fragment.
 * Used by RichMessageInput to trigger autocomplete.
 */
export function useTeamAutocomplete(text: string, cursorPosition: number) {
  const [autocompleteState, setAutocompleteState] = useState<{
    active: boolean
    query: string
    startPosition: number
  }>({
    active: false,
    query: '',
    startPosition: 0,
  })

  useEffect(() => {
    // Find the word being typed at cursor position
    const beforeCursor = text.slice(0, cursorPosition)
    const words = beforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1] || ''

    // Activate autocomplete if:
    // 1. Current word is 2+ characters
    // 2. Current word starts with a capital letter (likely a team name)
    // OR current word matches partial team abbreviation/name
    const shouldActivate = currentWord.length >= 2

    if (shouldActivate) {
      const startPosition = beforeCursor.lastIndexOf(currentWord)
      setAutocompleteState({
        active: true,
        query: currentWord,
        startPosition,
      })
    } else {
      setAutocompleteState({
        active: false,
        query: '',
        startPosition: 0,
      })
    }
  }, [text, cursorPosition])

  return autocompleteState
}
