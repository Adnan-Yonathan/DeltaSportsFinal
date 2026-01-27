import { createServiceClient } from "@/lib/supabase/service"
import type { OddsGame } from "@/lib/types/odds"

const DEFAULT_ODDS_CACHE_TTL_MS = 10 * 60 * 1000

export async function getOddsCache(
  cacheKey: string,
  maxAgeMs: number = DEFAULT_ODDS_CACHE_TTL_MS
): Promise<OddsGame[] | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("odds_cache" as any)
    .select("payload, updated_at")
    .eq("cache_key", cacheKey)
    .maybeSingle()

  const row = data as { payload?: OddsGame[]; updated_at?: string } | null
  if (error || !row?.payload || !row?.updated_at) return null
  const updatedAt = new Date(row.updated_at).getTime()
  if (!Number.isFinite(updatedAt)) return null
  if (Date.now() - updatedAt > maxAgeMs) return null
  return row.payload as OddsGame[]
}

export async function setOddsCache(
  cacheKey: string,
  sport: string,
  markets: string[],
  payload: OddsGame[]
) {
  const supabase = createServiceClient()
  await supabase.from("odds_cache" as any).upsert(
    {
      cache_key: cacheKey,
      sport,
      markets: markets.join(","),
      payload,
      updated_at: new Date().toISOString(),
    } as any,
    { onConflict: "cache_key" }
  )
}
