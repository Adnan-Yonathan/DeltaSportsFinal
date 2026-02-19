import { createServiceClient } from '@/lib/supabase/service'

type CacheRow = {
  cache_key: string
  payload: unknown
  fetched_at: string | null
}

const TABLE_NAME = 'prop_orderbooks_cache'

const getClient = () => {
  try {
    return createServiceClient()
  } catch (error) {
    console.warn('[Prop Orderbooks Cache] Missing service client configuration.')
    return null
  }
}

export const getPropOrderbooksCache = async (cacheKey: string) => {
  const supabase = getClient()
  if (!supabase) return null

  const { data, error } = (await supabase
    .from(TABLE_NAME as any)
    .select('cache_key, payload, fetched_at')
    .eq('cache_key', cacheKey)
    .maybeSingle()) as unknown as {
    data: CacheRow | null
    error: { message?: string } | null
  }

  if (error) {
    console.warn('[Prop Orderbooks Cache] Failed to read cache:', error)
    return null
  }

  return data
}

export const setPropOrderbooksCache = async (cacheKey: string, payload: unknown) => {
  const supabase = getClient()
  if (!supabase) return false

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
    console.warn('[Prop Orderbooks Cache] Failed to write cache:', error)
    return false
  }

  return true
}
