'use client'

import { useState, useEffect, useCallback } from 'react'
import type { DailyRecap } from '@/lib/services/daily-recap'

const RECAP_DISMISS_STORAGE_KEY = 'daily_recap_dismissed_date'

export interface UseDailyRecapResult {
  recap: DailyRecap | null
  dismissed: boolean
  loading: boolean
  error: string | null
  dismiss: () => Promise<void>
}

export function useDailyRecap(): UseDailyRecapResult {
  const [recap, setRecap] = useState<DailyRecap | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch recap on mount
  useEffect(() => {
    const fetchRecap = async () => {
      try {
        const res = await fetch('/api/daily-recap', { cache: 'no-store' })
        if (!res.ok) {
          throw new Error(`Failed to fetch recap: ${res.status}`)
        }

        const data = await res.json()

        if (data.ok && data.recap) {
          setRecap(data.recap)

          // Check localStorage for dismissal (fallback for unauthenticated or stale state)
          const localDismissed =
            typeof window !== 'undefined' &&
            window.localStorage.getItem(RECAP_DISMISS_STORAGE_KEY) ===
              data.recap.recapDate

          setDismissed(data.dismissed || localDismissed)
        } else {
          setRecap(null)
          setDismissed(false)
        }
      } catch (err: any) {
        console.error('[useDailyRecap] Failed to fetch:', err)
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchRecap()
  }, [])

  // Dismiss the current recap
  const dismiss = useCallback(async () => {
    if (!recap) return

    setDismissed(true)

    // Persist to localStorage immediately
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(RECAP_DISMISS_STORAGE_KEY, recap.recapDate)
      } catch (err) {
        console.warn('[useDailyRecap] Failed to persist to localStorage:', err)
      }
    }

    // Persist to user metadata via API
    try {
      await fetch('/api/daily-recap/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recapDate: recap.recapDate }),
      })
    } catch (err) {
      console.warn('[useDailyRecap] Failed to persist dismissal:', err)
    }
  }, [recap])

  return {
    recap,
    dismissed,
    loading,
    error,
    dismiss,
  }
}
