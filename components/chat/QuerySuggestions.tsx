'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Target,
  TrendingUp,
  User,
  BarChart2,
  Activity,
  Calendar,
  BookOpen,
  type LucideIcon,
} from 'lucide-react'
import type { QuerySuggestion, SuggestionCategory } from '@/lib/data/suggestion-patterns'
import { CATEGORY_CONFIG } from '@/lib/data/suggestion-patterns'
import { getSuggestions, buildSuggestionContext } from '@/lib/data/query-suggestions'

// ============================================================
// ICON MAPPING
// ============================================================

const CATEGORY_ICONS: Record<SuggestionCategory, LucideIcon> = {
  edge: Target,
  betting: TrendingUp,
  props: User,
  stats: BarChart2,
  live: Activity,
  schedule: Calendar,
  education: BookOpen,
}

const CATEGORY_COLORS: Record<SuggestionCategory, string> = {
  edge: 'text-amber-400 bg-amber-500/20',
  betting: 'text-blue-400 bg-blue-500/20',
  props: 'text-orange-400 bg-orange-500/20',
  stats: 'text-green-400 bg-green-500/20',
  live: 'text-red-400 bg-red-500/20',
  schedule: 'text-purple-400 bg-purple-500/20',
  education: 'text-slate-400 bg-slate-500/20',
}

// ============================================================
// COMPONENT INTERFACES
// ============================================================

interface QuerySuggestionsProps {
  input: string
  visible: boolean
  onSelect: (suggestion: QuerySuggestion) => void
  onClose: () => void
  anchorRect?: DOMRect | null
  taggedTeams?: Array<{ name: string }>
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export function QuerySuggestions({
  input,
  visible,
  onSelect,
  onClose,
  anchorRect,
  taggedTeams = [],
}: QuerySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<QuerySuggestion[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Get suggestions when input changes
  useEffect(() => {
    if (!visible || input.length < 2) {
      setSuggestions([])
      return
    }

    const context = buildSuggestionContext(input, taggedTeams)
    const results = getSuggestions(input, context, 6)
    setSuggestions(results)
    setSelectedIndex(0)
  }, [input, visible, taggedTeams])

  // Keyboard navigation
  useEffect(() => {
    if (!visible || suggestions.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if no other autocomplete is open (check for team autocomplete)
      const teamAutocomplete = document.querySelector('[data-team-autocomplete]')
      if (teamAutocomplete) return

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => (prev + 1) % suggestions.length)
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
          break
        case 'Tab':
          // Tab selects suggestion (but only if visible and has suggestions)
          if (suggestions.length > 0) {
            e.preventDefault()
            onSelect(suggestions[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [visible, suggestions, selectedIndex, onSelect, onClose])

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

  if (!visible || suggestions.length === 0) {
    return null
  }

  // Calculate position (below input)
  const style: React.CSSProperties = {
    position: 'fixed',
    zIndex: 2147483647,
  }

  if (anchorRect) {
    style.top = anchorRect.bottom + 4
    style.left = anchorRect.left
    style.maxWidth = 'min(400px, calc(100vw - 32px))'
  }

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        data-query-suggestions
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.15 }}
        style={{ ...style, backgroundColor: '#1a1a1a' }}
        className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl overflow-hidden isolate pointer-events-auto"
      >
        {/* Header */}
        <div className="px-3 py-2 border-b border-[#2a2a2a]" style={{ backgroundColor: '#141414' }}>
          <span className="text-xs text-white/50 font-medium">Suggestions</span>
        </div>

        {/* Suggestions list */}
        <div ref={listRef} className="max-h-[240px] overflow-y-auto" style={{ backgroundColor: '#1a1a1a' }}>
          {suggestions.map((suggestion, index) => (
            <SuggestionItem
              key={`${suggestion.category}-${suggestion.phrase}`}
              suggestion={suggestion}
              isSelected={index === selectedIndex}
              onSelect={() => onSelect(suggestion)}
              onHover={() => setSelectedIndex(index)}
            />
          ))}
        </div>

        {/* Footer with keyboard hints */}
        <div className="border-t border-[#2a2a2a] px-3 py-1.5 text-xs text-white/40" style={{ backgroundColor: '#1a1a1a' }}>
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">↑↓</kbd>
          navigate
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">Tab</kbd>
          select
          <span className="mx-2">·</span>
          <kbd className="px-1 py-0.5 bg-white/10 rounded text-white/60 mr-1">Esc</kbd>
          dismiss
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ============================================================
// SUGGESTION ITEM
// ============================================================

interface SuggestionItemProps {
  suggestion: QuerySuggestion
  isSelected: boolean
  onSelect: () => void
  onHover: () => void
}

function SuggestionItem({
  suggestion,
  isSelected,
  onSelect,
  onHover,
}: SuggestionItemProps) {
  const Icon = CATEGORY_ICONS[suggestion.category]
  const colorClass = CATEGORY_COLORS[suggestion.category]
  const config = CATEGORY_CONFIG[suggestion.category]

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={onHover}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors
        ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}
      `}
    >
      {/* Icon */}
      <div className={`p-1.5 rounded ${colorClass.split(' ')[1]}`}>
        <Icon className={`w-4 h-4 ${colorClass.split(' ')[0]}`} />
      </div>

      {/* Phrase */}
      <div className="flex-1 min-w-0">
        <span className={`text-sm ${isSelected ? 'text-white' : 'text-white/80'}`}>
          {suggestion.phrase}
        </span>
      </div>

      {/* Category badge */}
      <span
        className={`text-xs px-2 py-0.5 rounded-full ${colorClass} flex-shrink-0`}
      >
        {config.label}
      </span>
    </button>
  )
}

// ============================================================
// HOOK FOR DETECTING WHEN TO SHOW SUGGESTIONS
// ============================================================

/**
 * Hook to determine if query suggestions should be shown.
 * Returns true if the input matches suggestion-triggering patterns.
 */
export function useShouldShowSuggestions(
  input: string,
  taggedTeams: Array<{ name: string }> = []
): boolean {
  const [shouldShow, setShouldShow] = useState(false)

  useEffect(() => {
    if (input.length < 2) {
      setShouldShow(false)
      return
    }

    const context = buildSuggestionContext(input, taggedTeams)
    const suggestions = getSuggestions(input, context, 1)
    setShouldShow(suggestions.length > 0)
  }, [input, taggedTeams])

  return shouldShow
}
