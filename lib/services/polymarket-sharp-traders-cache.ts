import { createServiceClient } from '@/lib/supabase/service'

type CacheRow = {
  cache_key: string
  payload: unknown
  fetched_at: string
}

const TABLE_NAME = 'polymarket_sharp_traders_cache'

export const getSharpTradersCache = async (cacheKey: string) => {
  const supabase = createServiceClient()
  const { data, error } = (await supabase
    .from(TABLE_NAME as any)
    .select('cache_key, payload, fetched_at')
    .eq('cache_key', cacheKey)
    .maybeSingle()) as unknown as {
    data: CacheRow | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Sharp Traders Cache] Failed to read cache:', error)
    return null
  }

  return data
}

export const setSharpTradersCache = async (cacheKey: string, payload: unknown) => {
  const supabase = createServiceClient()
  const row = {
    cache_key: cacheKey,
    payload,
    fetched_at: new Date().toISOString(),
  }

  const { error } = (await supabase
    .from(TABLE_NAME as any)
    .upsert(row as any, { onConflict: 'cache_key' } as any)) as unknown as {
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Sharp Traders Cache] Failed to write cache:', error)
    return false
  }

  return true
}
