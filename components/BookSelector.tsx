'use client'

import { useState, useEffect, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  AVAILABLE_BOOKS,
  DEFAULT_SELECTED_BOOKS,
  getBookApiKeys,
  type BookKey,
} from '@/lib/config/books'

export { AVAILABLE_BOOKS, DEFAULT_SELECTED_BOOKS, getBookApiKeys }
export type { BookKey }

const BOOK_STORAGE_KEY = 'selected-books'

export function getStoredBooks(): BookKey[] {
  if (typeof window === 'undefined') return DEFAULT_SELECTED_BOOKS
  try {
    const stored = window.localStorage.getItem(BOOK_STORAGE_KEY)
    if (!stored) return DEFAULT_SELECTED_BOOKS
    const parsed = JSON.parse(stored)
    if (!Array.isArray(parsed) || parsed.length === 0) return DEFAULT_SELECTED_BOOKS
    // Filter to only valid keys
    const validKeys = new Set(AVAILABLE_BOOKS.map(b => b.key))
    const filtered = parsed.filter((k: string) => validKeys.has(k as BookKey))
    return filtered.length > 0 ? filtered : DEFAULT_SELECTED_BOOKS
  } catch {
    return DEFAULT_SELECTED_BOOKS
  }
}

export function setStoredBooks(books: BookKey[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(BOOK_STORAGE_KEY, JSON.stringify(books))
  } catch {
    // ignore
  }
}

interface BookSelectorProps {
  selectedBooks: BookKey[]
  onChange: (books: BookKey[]) => void
  className?: string
  variant?: 'default' | 'compact'
  showLabel?: boolean
}

export default function BookSelector({
  selectedBooks,
  onChange,
  className,
  variant = 'default',
  showLabel = true,
}: BookSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleBook = (bookKey: BookKey) => {
    const newBooks = selectedBooks.includes(bookKey)
      ? selectedBooks.filter(k => k !== bookKey)
      : [...selectedBooks, bookKey]

    // Ensure at least one book is selected
    if (newBooks.length === 0) return

    onChange(newBooks)
    setStoredBooks(newBooks)
  }

  const selectedLabels = selectedBooks
    .map(k => AVAILABLE_BOOKS.find(b => b.key === k)?.label)
    .filter(Boolean)
    .join(', ')

  const isCompact = variant === 'compact'

  return (
    <div ref={dropdownRef} className={cn('relative', className)}>
      {showLabel && (
        <label className="block text-[10px] uppercase tracking-[0.2em] text-white/50 mb-1.5">
          Your Sportsbooks
        </label>
      )}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 text-left transition-colors hover:border-emerald-500/40',
          isCompact ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
          isOpen && 'border-emerald-500/60 bg-emerald-500/10'
        )}
      >
        <span className={cn('truncate text-white/80', isCompact ? 'max-w-[150px]' : 'max-w-[200px]')}>
          {selectedLabels || 'Select books...'}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-white/50 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-white/10 bg-black/95 p-2 shadow-2xl backdrop-blur-xl">
          <div className="mb-2 px-2 py-1 text-[10px] uppercase tracking-[0.2em] text-white/40">
            Select sportsbooks to display
          </div>
          <div className="max-h-64 overflow-y-auto">
            {AVAILABLE_BOOKS.map((book) => {
              const isSelected = selectedBooks.includes(book.key)
              return (
                <button
                  key={book.key}
                  type="button"
                  onClick={() => toggleBook(book.key)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isSelected
                      ? 'bg-emerald-500/20 text-emerald-200'
                      : 'text-white/70 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <span
                    className={cn(
                      'flex h-4 w-4 items-center justify-center rounded border transition-colors',
                      isSelected
                        ? 'border-emerald-400 bg-emerald-500'
                        : 'border-white/30 bg-transparent'
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3 text-black" />}
                  </span>
                  <span className="flex-1 text-left">{book.label}</span>
                  {book.key === 'pinnacle' && (
                    <span className="rounded-full border border-amber-400/40 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/80">
                      Sharp
                    </span>
                  )}
                  {book.source === 'prediction' && (
                    <span className="rounded-full border border-emerald-400/40 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-200/80">
                      Prediction
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <div className="mt-2 border-t border-white/10 pt-2 px-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-white/40">
                {selectedBooks.length} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  onChange(DEFAULT_SELECTED_BOOKS)
                  setStoredBooks(DEFAULT_SELECTED_BOOKS)
                }}
                className="text-[10px] text-emerald-400 hover:text-emerald-300"
              >
                Reset to default
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Hook for using book selection with localStorage persistence
export function useBookSelection() {
  const [selectedBooks, setSelectedBooks] = useState<BookKey[]>(DEFAULT_SELECTED_BOOKS)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    setSelectedBooks(getStoredBooks())
    setIsHydrated(true)
  }, [])

  const handleChange = (books: BookKey[]) => {
    setSelectedBooks(books)
    setStoredBooks(books)
  }

  return {
    selectedBooks,
    setSelectedBooks: handleChange,
    isHydrated,
    apiKeys: getBookApiKeys(selectedBooks),
  }
}
