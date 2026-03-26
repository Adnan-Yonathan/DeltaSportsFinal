import type { PropOrderbookItem } from '@/lib/services/prop-liquidity-detector'
import {
  filterUpcomingEventItems,
  getUsMarketDayKey,
  resolveEventDayKey,
} from '@/lib/utils/upcoming-event-filter'
import { getPropOrderbooksCache, setPropOrderbooksCache } from '@/lib/services/prop-orderbooks-cache'

export type PropOrderbooksDateWindow = 'today' | 'upcoming'
export type PropOrderbooksCacheSource = 'persistent' | 'persistent_all_fallback'

export const DEFAULT_PROP_ORDERBOOKS_DEPTH = 8
export const DEFAULT_PROP_ORDERBOOKS_MIN_SHARP_NOTIONAL = 100
export const DEFAULT_PROP_ORDERBOOKS_LIMIT = 200
export const PERSISTED_PROP_ORDERBOOKS_LIMIT = 320

type PersistedPropOrderbooksPayload = {
  sport: string
  depth: number
  minSharpNotional: number
  updatedAt: string
  items: PropOrderbookItem[]
}

const parseTimestampMs = (value?: string | null) => {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export const filterPropOrderbooksItemsByDateWindow = (
  items: PropOrderbookItem[],
  todayKey: string,
  dateWindow: PropOrderbooksDateWindow
) => {
  if (dateWindow === 'upcoming') {
    return filterUpcomingEventItems(items, todayKey)
  }

  return items.filter((item) => resolveEventDayKey(item.eventDate) === todayKey)
}

const parsePersistedPayload = (value: unknown): PersistedPropOrderbooksPayload | null => {
  if (!value || typeof value !== 'object') return null
  const payload = value as Partial<PersistedPropOrderbooksPayload>
  if (
    typeof payload.sport !== 'string' ||
    typeof payload.depth !== 'number' ||
    typeof payload.minSharpNotional !== 'number' ||
    typeof payload.updatedAt !== 'string' ||
    !Array.isArray(payload.items)
  ) {
    return null
  }
  return payload as PersistedPropOrderbooksPayload
}

export const buildPropOrderbooksCacheKey = (
  sport: string,
  depth: number,
  minSharpNotional: number
) => `prop-orderbooks:sport:${sport}:depth:${depth}:min:${minSharpNotional}`

const applyPayloadFilters = (
  payload: PersistedPropOrderbooksPayload,
  opts: {
    sport: string
    limit: number
    dateWindow: PropOrderbooksDateWindow
    todayKey: string
  }
) => {
  const { sport, limit, dateWindow, todayKey } = opts
  const filteredByDate = filterPropOrderbooksItemsByDateWindow(
    payload.items,
    todayKey,
    dateWindow
  )
  const filteredBySport =
    sport === 'all'
      ? filteredByDate
      : filteredByDate.filter((item) => item.sportKey === sport)

  return filteredBySport.slice(0, limit)
}

export const readPersistedPropOrderbooksSnapshot = async (opts: {
  sport: string
  depth: number
  minSharpNotional: number
  limit: number
  dateWindow: PropOrderbooksDateWindow
  todayKey?: string
}) => {
  const { sport, depth, minSharpNotional, limit, dateWindow } = opts
  const todayKey = opts.todayKey ?? getUsMarketDayKey()
  const exactCacheKey = buildPropOrderbooksCacheKey(sport, depth, minSharpNotional)
  const exact = await getPropOrderbooksCache(exactCacheKey)
  const exactPayload = parsePersistedPayload(exact?.payload)

  if (exactPayload) {
    return {
      source: 'persistent' as const,
      fetchedAt: exact?.fetched_at ?? null,
      cacheAgeMs:
        exact?.fetched_at != null
          ? Math.max(0, Date.now() - (parseTimestampMs(exact.fetched_at) ?? Date.now()))
          : null,
      updatedAt: exactPayload.updatedAt,
      items: applyPayloadFilters(exactPayload, {
        sport,
        limit,
        dateWindow,
        todayKey,
      }),
    }
  }

  if (sport === 'all') return null

  const allCacheKey = buildPropOrderbooksCacheKey('all', depth, minSharpNotional)
  const fallback = await getPropOrderbooksCache(allCacheKey)
  const fallbackPayload = parsePersistedPayload(fallback?.payload)
  if (!fallbackPayload) return null

  return {
    source: 'persistent_all_fallback' as const,
    fetchedAt: fallback?.fetched_at ?? null,
    cacheAgeMs:
      fallback?.fetched_at != null
        ? Math.max(0, Date.now() - (parseTimestampMs(fallback.fetched_at) ?? Date.now()))
        : null,
    updatedAt: fallbackPayload.updatedAt,
    items: applyPayloadFilters(fallbackPayload, {
      sport,
      limit,
      dateWindow,
      todayKey,
    }),
  }
}

export const persistPropOrderbooksSnapshot = async (opts: {
  sport: string
  depth: number
  minSharpNotional: number
  updatedAt: string
  items: PropOrderbookItem[]
}) => {
  const { sport, depth, minSharpNotional, updatedAt, items } = opts
  const cacheKey = buildPropOrderbooksCacheKey(sport, depth, minSharpNotional)
  const payload: PersistedPropOrderbooksPayload = {
    sport,
    depth,
    minSharpNotional,
    updatedAt,
    items,
  }
  return setPropOrderbooksCache(cacheKey, payload)
}

export const buildPropOrderbooksInitialData = async (opts?: {
  sport?: string
  limit?: number
  depth?: number
  minSharpNotional?: number
  dateWindow?: PropOrderbooksDateWindow
}) => {
  const sport = opts?.sport ?? 'all'
  const limit = opts?.limit ?? DEFAULT_PROP_ORDERBOOKS_LIMIT
  const depth = opts?.depth ?? DEFAULT_PROP_ORDERBOOKS_DEPTH
  const minSharpNotional =
    opts?.minSharpNotional ?? DEFAULT_PROP_ORDERBOOKS_MIN_SHARP_NOTIONAL
  const dateWindow = opts?.dateWindow ?? 'upcoming'

  const persisted = await readPersistedPropOrderbooksSnapshot({
    sport,
    depth,
    minSharpNotional,
    limit,
    dateWindow,
  })

  if (!persisted) return null

  return {
    items: persisted.items,
    updatedAt: persisted.updatedAt,
    cache: {
      source: persisted.source,
      fetchedAt: persisted.fetchedAt,
    },
  }
}
