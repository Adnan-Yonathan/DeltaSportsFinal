import { useEffect, useMemo, useState } from 'react'

interface UseRequestState<T> {
  data?: T
  loading: boolean
  error?: string
}

const createState = <T,>(overrides?: Partial<UseRequestState<T>>): UseRequestState<T> => ({
  loading: true,
  ...overrides,
})

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || res.statusText)
  }
  return res.json()
}

export function useSports() {
  const [state, setState] = useState<UseRequestState<{ count: number; sports: any[] }>>(
    createState()
  )

  useEffect(() => {
    const controller = new AbortController()
    fetchJson<{ count: number; sports: any[] }>('/api/sports', controller.signal)
      .then((data) => setState({ data, loading: false }))
      .catch((error: any) => {
        if (controller.signal.aborted) return
        setState({ loading: false, error: error?.message || 'Failed to load sports' })
      })

    return () => controller.abort()
  }, [])

  return state
}

export function useLeagues(sport?: string) {
  const [state, setState] = useState<UseRequestState<{ sport: string; leagues: any[] }>>(
    createState({ loading: Boolean(sport) })
  )

  useEffect(() => {
    if (!sport) {
      setState(createState({ loading: false }))
      return
    }
    const controller = new AbortController()
    fetchJson<{ sport: string; leagues: any[] }>(
      `/api/leagues?sport=${encodeURIComponent(sport)}`,
      controller.signal
    )
      .then((data) => setState({ data, loading: false }))
      .catch((error: any) => {
        if (controller.signal.aborted) return
        setState({ loading: false, error: error?.message || 'Failed to load leagues' })
      })
    return () => controller.abort()
  }, [sport])

  return state
}

interface UseEventsParams {
  sport?: string
  league?: string
  live?: boolean
}

export function useEvents(params: UseEventsParams) {
  const { sport, league, live } = params || {}
  const [state, setState] = useState<UseRequestState<{ events: any[]; count: number }>>(
    createState({ loading: Boolean(sport) })
  )

  const query = useMemo(() => {
    if (!sport) return ''
    const url = new URLSearchParams({ sport })
    if (league) url.set('league', league)
    if (live) url.set('live', 'true')
    return url.toString()
  }, [sport, league, live])

  useEffect(() => {
    if (!sport) {
      setState(createState({ loading: false }))
      return
    }
    const endpoint = live ? '/api/events/live' : '/api/events'
    const controller = new AbortController()
    fetchJson<{ events: any[]; count: number }>(
      `${endpoint}?${query}`,
      controller.signal
    )
      .then((data) => setState({ data, loading: false }))
      .catch((error: any) => {
        if (controller.signal.aborted) return
        setState({ loading: false, error: error?.message || 'Failed to load events' })
      })
    return () => controller.abort()
  }, [sport, live, query])

  return state
}
