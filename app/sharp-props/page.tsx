import ToolsNav from "@/components/tools-nav"
import MobileToolsNav from "@/components/mobile-tools-nav"
import SportSelector from "../market-projections/sport-selector"
import PropOrderbooksPanel from "@/components/prop-orderbooks-panel"
import { getPropOrderbooksCache } from "@/lib/services/prop-orderbooks-cache"
import type { PropOrderbookItem } from "@/lib/services/prop-liquidity-detector"

export const dynamic = "force-dynamic"
export const revalidate = 0

type SportOption = {
  key: string
  label: string
  locked?: boolean
}

const SPORT_OPTIONS: SportOption[] = [
  { key: "all", label: "All Sports", locked: false },
  { key: "basketball_nba", label: "NBA", locked: false },
  { key: "basketball_ncaab", label: "NCAAB", locked: false },
  { key: "americanfootball_nfl", label: "NFL", locked: false },
  { key: "icehockey_nhl", label: "NHL", locked: false },
  { key: "baseball_mlb", label: "MLB", locked: false },
]

const DEFAULT_ORDERBOOK_DEPTH = 8
const DEFAULT_ORDERBOOK_MIN_SHARP_NOTIONAL = 100
const DEFAULT_ORDERBOOK_LIMIT = 80

type PersistedOrderbooksPayload = {
  sport: string
  depth: number
  minSharpNotional: number
  updatedAt: string
  items: PropOrderbookItem[]
}

type InitialOrderbooksData = {
  items: PropOrderbookItem[]
  updatedAt: string
  cache: {
    source: "persistent" | "persistent_all_fallback"
    fetchedAt: string | null
  }
}

const buildOrderbooksCacheKey = (
  sport: string,
  depth: number,
  minSharpNotional: number
) => `sport:${sport}:depth:${depth}:min:${minSharpNotional}`

const parsePersistedOrderbooksPayload = (
  value: unknown
): PersistedOrderbooksPayload | null => {
  if (!value || typeof value !== "object") return null
  const payload = value as Partial<PersistedOrderbooksPayload>
  if (
    typeof payload.sport !== "string" ||
    typeof payload.depth !== "number" ||
    typeof payload.minSharpNotional !== "number" ||
    typeof payload.updatedAt !== "string" ||
    !Array.isArray(payload.items)
  ) {
    return null
  }
  return payload as PersistedOrderbooksPayload
}

const resolveInitialOrderbooks = async (
  sport: string,
  limit: number
): Promise<InitialOrderbooksData | null> => {
  const exactKey = buildOrderbooksCacheKey(
    sport,
    DEFAULT_ORDERBOOK_DEPTH,
    DEFAULT_ORDERBOOK_MIN_SHARP_NOTIONAL
  )
  const exactCache = await getPropOrderbooksCache(exactKey)
  const exactPayload = parsePersistedOrderbooksPayload(exactCache?.payload)

  if (exactPayload) {
    const items =
      sport === "all"
        ? exactPayload.items
        : exactPayload.items.filter((item) => item.sportKey === sport)
    return {
      items: items.slice(0, limit),
      updatedAt: exactPayload.updatedAt,
      cache: {
        source: "persistent",
        fetchedAt: exactCache?.fetched_at ?? null,
      },
    }
  }

  if (sport === "all") return null

  const allKey = buildOrderbooksCacheKey(
    "all",
    DEFAULT_ORDERBOOK_DEPTH,
    DEFAULT_ORDERBOOK_MIN_SHARP_NOTIONAL
  )
  const allCache = await getPropOrderbooksCache(allKey)
  const allPayload = parsePersistedOrderbooksPayload(allCache?.payload)
  if (!allPayload) return null

  return {
    items: allPayload.items.filter((item) => item.sportKey === sport).slice(0, limit),
    updatedAt: allPayload.updatedAt,
    cache: {
      source: "persistent_all_fallback",
      fetchedAt: allCache?.fetched_at ?? null,
    },
  }
}

export default async function SharpPropsPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>
}) {
  const requestedSport = Array.isArray(searchParams?.sport)
    ? searchParams?.sport[0]
    : searchParams?.sport

  const sport =
    SPORT_OPTIONS.find((option) => option.key === requestedSport)?.key ?? "all"

  const initialOrderbooks = await resolveInitialOrderbooks(sport, DEFAULT_ORDERBOOK_LIMIT)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="sticky top-0 z-50 border-b border-white/5 bg-black/95 backdrop-blur-sm">
        <div className="px-2 py-3 sm:px-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden shrink-0 md:block">
              <ToolsNav />
            </div>
            <div className="ml-auto shrink-0">
              <SportSelector options={SPORT_OPTIONS} currentSport={sport} />
            </div>
          </div>
        </div>
      </div>
      <div className="px-2 pb-[96px] sm:px-4 sm:pb-0">
        <div className="mx-auto w-full max-w-none">
          <PropOrderbooksPanel sport={sport} initialData={initialOrderbooks} />
        </div>
      </div>
      <MobileToolsNav />
    </div>
  )
}
