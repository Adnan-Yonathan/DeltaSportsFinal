"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import BoxLoader from "@/components/ui/box-loader"

type OrderbookLevel = {
  priceCents: number
  notional: number
}

type OrderbookSide = {
  outcome: string
  propSide: "Over" | "Under" | null
  platformSide: "yes" | "no" | null
  levels: OrderbookLevel[]
  totalNotional: number
  wallPriceCents: number | null
  wallNotional: number | null
  wallAmericanOdds: number | null
  sharpLinePriceCents: number | null
  sharpLineAmericanOdds: number | null
}

export type OrderbookItem = {
  id: string
  source: "kalshi" | "polymarket" | "novig" | "prophetx"
  sportKey: string
  sportLabel: string
  matchup?: string
  marketTitle: string
  playerName: string | null
  propType: string | null
  propLine: number | null
  eventDate?: string
  ticker?: string
  slug?: string
  sharpLiquiditySide: "Over" | "Under" | null
  sharpLiquidityNotional: number | null
  sharpOrderAmericanOdds: number | null
  sharpLeanSide: "Over" | "Under" | null
  sharpLeanAmericanOdds: number | null
  sharpLeanBestOdds: number | null
  sharpLeanBestBookTitle: string | null
  pinnacleLeanOdds: number | null
  pinnacleLeanBookTitle: string | null
  updatedAt: string
  sides: OrderbookSide[]
}

type OrderbooksInitialData = {
  items: OrderbookItem[]
  updatedAt: string
  cache: {
    source: "persistent" | "persistent_all_fallback"
    fetchedAt: string | null
  }
} | null

type OrderbooksApiResponse = {
  ok?: boolean
  updatedAt?: string
  items?: OrderbookItem[]
  cache?: {
    source?: string
    fetchedAt?: string | null
  }
  error?: string
}

type PlayerHeadshotResponse = {
  ok?: boolean
  headshots?: Record<string, string | null>
}

type LadderRow = {
  id: string
  side: "Over" | "Under" | null
  odds: number | null
  notional: number
}

type OddsPreset = "all" | "default" | "underdog200" | "plusMoney" | "evenish" | "favorites" | "custom"

const AUTO_REFRESH_INTERVAL_MS = 5 * 60 * 1000
const BACKGROUND_ITEM_RETENTION_MS = 15 * 60 * 1000

const COMPACT_USD = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
})

const formatCompactCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return COMPACT_USD.format(value)
}

const formatAmericanOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const formatSourceLabel = (source: OrderbookItem["source"]) => {
  if (source === "kalshi") return "Kalshi"
  if (source === "polymarket") return "Polymarket"
  if (source === "novig") return "NoVig"
  return "ProphetX"
}

const formatDateLabel = (value?: string | null) => {
  if (!value) return "TBD"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const formatCacheLabel = (source?: string | null) => {
  if (!source) return "live"
  if (source === "persistent") return "cached"
  if (source === "persistent_all_fallback") return "cached(all)"
  if (source.includes("fast_refresh")) return "live fast"
  if (source.includes("fast")) return "live"
  if (source.includes("full")) return "live full"
  return source.replace(/_/g, " ")
}

const parseTimestampMs = (value?: string | null) => {
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const mergeBackgroundItems = (
  previousItems: OrderbookItem[],
  incomingItems: OrderbookItem[],
  limit: number
) => {
  if (!previousItems.length) return incomingItems.slice(0, limit)
  if (!incomingItems.length) return previousItems.slice(0, limit)

  const now = Date.now()
  const cutoff = now - BACKGROUND_ITEM_RETENTION_MS
  const incomingIds = new Set(incomingItems.map((item) => item.id))
  const retained = previousItems.filter((item) => {
    if (incomingIds.has(item.id)) return false
    return parseTimestampMs(item.updatedAt) >= cutoff
  })

  return [...incomingItems, ...retained].slice(0, limit)
}

const resolveLargestWall = (item: OrderbookItem) =>
  [...item.sides]
    .filter((side) => (side.wallNotional ?? 0) > 0)
    .sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))[0] ?? null

const resolveDisplayOrderSize = (item: OrderbookItem) => {
  if ((item.sharpLiquidityNotional ?? 0) > 0) return item.sharpLiquidityNotional
  return resolveLargestWall(item)?.wallNotional ?? null
}

const resolveOppositeSide = (side: "Over" | "Under" | null) => {
  if (side === "Over") return "Under"
  if (side === "Under") return "Over"
  return null
}

const resolveSideLevelOdds = (side: OrderbookSide | null, mode: "direct" | "sharp" = "direct") => {
  if (!side) return null
  for (const level of side.levels) {
    const priceCents =
      mode === "direct"
        ? level.priceCents
        : Math.max(0, Math.min(100, 100 - level.priceCents))
    const odds = priceCentsToAmericanOdds(priceCents)
    if (odds != null) return odds
  }
  return null
}

const resolveDisplayLean = (item: OrderbookItem) => {
  const overSide = item.sides.find((side) => side.propSide === "Over") ?? null
  const underSide = item.sides.find((side) => side.propSide === "Under") ?? null
  const largestWallSide = resolveLargestWall(item)?.propSide ?? null
  const liquiditySide = item.sharpLiquiditySide ?? largestWallSide
  const side = item.sharpLeanSide ?? resolveOppositeSide(liquiditySide)
  const oddsFromSide =
    side === "Over"
      ? overSide?.wallAmericanOdds ??
        resolveSideLevelOdds(overSide, "direct") ??
        underSide?.sharpLineAmericanOdds ??
        resolveSideLevelOdds(underSide, "sharp")
      : side === "Under"
        ? underSide?.wallAmericanOdds ??
          resolveSideLevelOdds(underSide, "direct") ??
          overSide?.sharpLineAmericanOdds ??
          resolveSideLevelOdds(overSide, "sharp")
        : null
  const odds = item.pinnacleLeanOdds ?? item.sharpLeanBestOdds ?? item.sharpLeanAmericanOdds ?? oddsFromSide
  const bestBookTitle =
    item.pinnacleLeanOdds != null
      ? item.pinnacleLeanBookTitle
      : item.sharpLeanBestBookTitle

  return {
    side,
    odds,
    liquiditySide,
    bestBookTitle,
  }
}

const resolvePropText = (item: OrderbookItem, side?: "Over" | "Under" | null) => {
  const propType = item.propType?.replace(/_/g, " ") ?? "prop"
  const line = item.propLine != null ? `${item.propLine}` : ""
  if (side && line) return `${item.playerName ?? "Unknown"} ${side} ${line} ${propType}`
  if (side) return `${item.playerName ?? "Unknown"} ${side} ${propType}`
  return `${item.playerName ?? "Unknown"} ${propType}${line ? ` ${line}` : ""}`
}

const normalizePlayerToken = (value?: string | null) =>
  String(value ?? "")
    .toLowerCase()
    .replace(/['.]/g, "")
    .replace(/\s+(jr|sr|ii|iii|iv|v)$/i, "")
    .replace(/[^a-z0-9]/g, "")
    .trim()

const buildPlayerHeadshotKey = (sportKey: string, playerName: string) =>
  `${sportKey}:${normalizePlayerToken(playerName)}`

const buildPlayerFaceRoute = (sportKey: string, playerName?: string | null) =>
  playerName
    ? `/api/intel/player-face?sportKey=${encodeURIComponent(sportKey)}&name=${encodeURIComponent(
        playerName
      )}`
    : null

const hasOwn = (obj: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(obj, key)

const resolvePlayerHeadshot = (
  item: OrderbookItem,
  headshotsByKey: Record<string, string | null>
) => {
  if (!item.playerName) return null
  const key = buildPlayerHeadshotKey(item.sportKey, item.playerName)
  if (!hasOwn(headshotsByKey, key)) return null
  return headshotsByKey[key]
}

const resolvePlayerInitials = (name?: string | null) => {
  if (!name) return "?"
  const parts = name.split(" ").filter(Boolean)
  if (!parts.length) return "?"
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase()
}

const probabilityToAmericanOdds = (probability: number) => {
  if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) return null
  if (probability >= 0.5) {
    return -Math.round((probability / (1 - probability)) * 100)
  }
  return Math.round(((1 - probability) / probability) * 100)
}

const oddsToImpliedProbability = (odds: number) => {
  if (!Number.isFinite(odds) || odds === 0) return null
  if (odds > 0) return 100 / (odds + 100)
  const absolute = Math.abs(odds)
  return absolute / (absolute + 100)
}

const priceCentsToAmericanOdds = (priceCents: number | null) => {
  if (priceCents == null) return null
  const probability = priceCents / 100
  return probabilityToAmericanOdds(probability)
}

const resolveMiniBarShares = (item: OrderbookItem) => {
  const overNotional =
    item.sides
      .filter((side) => side.propSide === "Over")
      .reduce((sum, side) => sum + (side.wallNotional ?? 0), 0) ?? 0
  const underNotional =
    item.sides
      .filter((side) => side.propSide === "Under")
      .reduce((sum, side) => sum + (side.wallNotional ?? 0), 0) ?? 0
  const total = overNotional + underNotional
  if (total <= 0) return { overPct: 0, underPct: 0 }
  return {
    overPct: Math.round((overNotional / total) * 100),
    underPct: Math.round((underNotional / total) * 100),
  }
}

const buildLadderRows = (item: OrderbookItem, limit: number) => {
  const rows: LadderRow[] = []
  for (const side of item.sides) {
    if (side.levels.length) {
      side.levels.forEach((level, index) => {
        rows.push({
          id: `${item.id}:${side.outcome}:${index}`,
          side: side.propSide,
          odds: priceCentsToAmericanOdds(level.priceCents),
          notional: level.notional,
        })
      })
      continue
    }
    if ((side.wallNotional ?? 0) > 0) {
      rows.push({
        id: `${item.id}:${side.outcome}:wall`,
        side: side.propSide,
        odds: side.wallAmericanOdds,
        notional: side.wallNotional ?? 0,
      })
    }
  }

  return rows
    .filter((row) => row.notional > 0)
    .sort((a, b) => b.notional - a.notional)
    .slice(0, limit)
}

const resolveWeightedAverageOdds = (rows: LadderRow[]) => {
  let weightedProbability = 0
  let totalNotional = 0
  for (const row of rows) {
    if (row.odds == null) continue
    const implied = oddsToImpliedProbability(row.odds)
    if (implied == null) continue
    weightedProbability += implied * row.notional
    totalNotional += row.notional
  }
  if (totalNotional <= 0) return null
  return probabilityToAmericanOdds(weightedProbability / totalNotional)
}

export default function PropOrderbooksPanel({
  sport,
  limit = 80,
  depth = 8,
  minSharpNotional = 100,
  initialData = null,
}: {
  sport: string
  limit?: number
  depth?: number
  minSharpNotional?: number
  initialData?: OrderbooksInitialData
}) {
  const [items, setItems] = useState<OrderbookItem[]>(initialData?.items ?? [])
  const [search, setSearch] = useState("")
  const [oddsPreset, setOddsPreset] = useState<OddsPreset>("all")
  const [minOdds, setMinOdds] = useState<string>("-200")
  const [maxOdds, setMaxOdds] = useState<string>("")
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialData?.items?.[0]?.id ?? null
  )
  const [loading, setLoading] = useState((initialData?.items?.length ?? 0) === 0)
  const [refreshing, setRefreshing] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(
    initialData?.updatedAt ?? null
  )
  const [cacheSource, setCacheSource] = useState<string | null>(
    initialData?.cache?.source ?? null
  )
  const [cacheFetchedAt, setCacheFetchedAt] = useState<string | null>(
    initialData?.cache?.fetchedAt ?? null
  )
  const [playerHeadshotsByKey, setPlayerHeadshotsByKey] = useState<Record<string, string | null>>({})
  const [headshotLoadingByKey, setHeadshotLoadingByKey] = useState<Record<string, boolean>>({})

  const requestIdRef = useRef(0)
  const abortControllerRef = useRef<AbortController | null>(null)
  const hasItemsRef = useRef((initialData?.items?.length ?? 0) > 0)
  const itemsRef = useRef<OrderbookItem[]>(initialData?.items ?? [])
  const isMountedRef = useRef(true)

  const load = useCallback(
    async ({
      forceRefresh = false,
      background = false,
    }: {
      forceRefresh?: boolean
      background?: boolean
    } = {}) => {
      const requestId = requestIdRef.current + 1
      requestIdRef.current = requestId
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      if (background) {
        setRefreshing(true)
        if (!hasItemsRef.current) setLoading(true)
      } else {
        setLoading(true)
      }

      try {
        const params = new URLSearchParams({
          sport,
          limit: String(limit),
          depth: String(depth),
          minSharpNotional: String(minSharpNotional),
        })
        if (forceRefresh) {
          params.set("refresh", "1")
          params.set("mode", "full")
        }

        const res = await fetch(`/api/prop-orderbooks?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        })

        const payload = (await res.json().catch(() => ({}))) as OrderbooksApiResponse
        if (!res.ok) {
          throw new Error(payload?.error || "Failed to load order books.")
        }
        if (requestId !== requestIdRef.current) return

        const nextItems = Array.isArray(payload?.items) ? payload.items : []
        const resolvedItems = background
          ? mergeBackgroundItems(itemsRef.current, nextItems, limit)
          : nextItems
        hasItemsRef.current = resolvedItems.length > 0
        itemsRef.current = resolvedItems
        setItems(resolvedItems)
        setSelectedItemId((prev) => {
          if (!resolvedItems.length) return null
          if (prev && resolvedItems.some((item) => item.id === prev)) return prev
          return resolvedItems[0].id
        })
        setLastUpdatedAt(payload?.updatedAt ?? new Date().toISOString())
        setCacheSource(payload?.cache?.source ?? null)
        setCacheFetchedAt(payload?.cache?.fetchedAt ?? null)
        setErrorMessage(null)
      } catch (error: any) {
        if (controller.signal.aborted || requestId !== requestIdRef.current) return
        setErrorMessage(error?.message ?? "Failed to load order books.")
      } finally {
        if (requestId !== requestIdRef.current) return
        setLoading(false)
        setRefreshing(false)
      }
    },
    [depth, limit, minSharpNotional, sport]
  )

  useEffect(() => {
    requestIdRef.current += 1
    abortControllerRef.current?.abort()
    const seededItems = initialData?.items ?? []
    hasItemsRef.current = seededItems.length > 0
    itemsRef.current = seededItems
    setItems(seededItems)
    setSelectedItemId(seededItems[0]?.id ?? null)
    setLoading(!seededItems.length)
    setRefreshing(false)
    setErrorMessage(null)
    setLastUpdatedAt(initialData?.updatedAt ?? null)
    setCacheSource(initialData?.cache?.source ?? null)
    setCacheFetchedAt(initialData?.cache?.fetchedAt ?? null)
    setPlayerHeadshotsByKey({})
    setHeadshotLoadingByKey({})
    setSearch("")
    setOddsPreset("all")
    setMinOdds("-200")
    setMaxOdds("")

    if (!seededItems.length) {
      load()
      return
    }

    load({ forceRefresh: true, background: true })
  }, [initialData, load, sport])

  useEffect(() => {
    const interval = window.setInterval(() => {
      load({ forceRefresh: true, background: true })
    }, AUTO_REFRESH_INTERVAL_MS)
    return () => window.clearInterval(interval)
  }, [load])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const pendingHeadshotGroups = useMemo(() => {
    const groups = new Map<string, Array<{ playerName: string; key: string }>>()
    const seen = new Set<string>()

    for (const item of items) {
      if (!item.playerName) continue
      const playerName = item.playerName.trim()
      if (!playerName) continue
      const key = buildPlayerHeadshotKey(item.sportKey, playerName)
      if (seen.has(key)) continue
      seen.add(key)
      if (hasOwn(playerHeadshotsByKey, key) || headshotLoadingByKey[key]) continue
      const group = groups.get(item.sportKey) ?? []
      group.push({ playerName, key })
      groups.set(item.sportKey, group)
    }

    return Array.from(groups.entries()).map(([sportKey, players]) => ({ sportKey, players }))
  }, [items, playerHeadshotsByKey, headshotLoadingByKey])

  useEffect(() => {
    let cancelled = false
    if (pendingHeadshotGroups.length === 0) return

    const run = async () => {
      const chunkSize = 20
      for (const group of pendingHeadshotGroups) {
        for (let i = 0; i < group.players.length; i += chunkSize) {
          if (cancelled) return
          const chunk = group.players.slice(i, i + chunkSize)
          const names = chunk.map((entry) => entry.playerName)

          setHeadshotLoadingByKey((prev) => {
            const next = { ...prev }
            chunk.forEach((entry) => {
              next[entry.key] = true
            })
            return next
          })

          try {
            const res = await fetch("/api/intel/player-headshots", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              cache: "no-store",
              body: JSON.stringify({
                sportKey: group.sportKey,
                players: names,
              }),
            })
            const payload = (await res.json().catch(() => ({}))) as PlayerHeadshotResponse
            if (!res.ok) {
              throw new Error("Failed to preload player headshots.")
            }
            if (!payload?.ok || !payload?.headshots || typeof payload.headshots !== "object") {
              throw new Error("Invalid player headshot payload.")
            }
            if (cancelled) return

            setPlayerHeadshotsByKey((prev) => {
              const next = { ...prev }
              chunk.forEach((entry) => {
                const value = payload?.headshots?.[entry.playerName]
                next[entry.key] =
                  typeof value === "string" && value.trim().length > 0 ? value : null
              })
              return next
            })
          } catch {
            if (cancelled) return
            // Keep keys unresolved on request failure so subsequent renders can retry.
          } finally {
            if (!isMountedRef.current) return
            setHeadshotLoadingByKey((prev) => {
              const next = { ...prev }
              chunk.forEach((entry) => {
                delete next[entry.key]
              })
              return next
            })
          }
        }
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [pendingHeadshotGroups])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()
    const resolvedRange = (() => {
      if (oddsPreset === "all") return { min: null as number | null, max: null as number | null }
      if (oddsPreset === "underdog200") return { min: 200, max: null as number | null }
      if (oddsPreset === "plusMoney") return { min: 100, max: null as number | null }
      if (oddsPreset === "evenish") return { min: -120, max: 120 }
      if (oddsPreset === "favorites") return { min: -200, max: -101 }
      if (oddsPreset === "custom") {
        const min = minOdds.trim() === "" ? null : Number(minOdds)
        const max = maxOdds.trim() === "" ? null : Number(maxOdds)
        return {
          min: Number.isFinite(min as number) ? (min as number) : null,
          max: Number.isFinite(max as number) ? (max as number) : null,
        }
      }
      return { min: -200, max: null as number | null }
    })()

    const matchesOddsRange = (candidateOdds: number | null) => {
      if (resolvedRange.min == null && resolvedRange.max == null) return true
      if (candidateOdds == null) return false
      if (resolvedRange.min != null && candidateOdds < resolvedRange.min) return false
      if (resolvedRange.max != null && candidateOdds > resolvedRange.max) return false
      return true
    }

    return items
      .filter((item) => {
        if (query) {
          const haystack = `${item.playerName ?? ""} ${item.matchup ?? ""} ${item.marketTitle ?? ""}`
            .toLowerCase()
            .trim()
          if (!haystack.includes(query)) return false
        }
        const displayLean = resolveDisplayLean(item)
        return matchesOddsRange(displayLean.odds)
      })
      .sort((a, b) => {
        const aSize = resolveDisplayOrderSize(a) ?? 0
        const bSize = resolveDisplayOrderSize(b) ?? 0
        if (bSize !== aSize) return bSize - aSize
        return a.marketTitle.localeCompare(b.marketTitle)
      })
  }, [items, maxOdds, minOdds, oddsPreset, search])

  useEffect(() => {
    if (!filteredItems.length) {
      setSelectedItemId(null)
      return
    }
    if (!selectedItemId || !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0].id)
    }
  }, [filteredItems, selectedItemId])

  const selectedItem = useMemo(
    () => filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null,
    [filteredItems, selectedItemId]
  )
  const selectedDisplayLean = useMemo(
    () => (selectedItem ? resolveDisplayLean(selectedItem) : null),
    [selectedItem]
  )
  const selectedPlayerHeadshot = selectedItem
    ? resolvePlayerHeadshot(selectedItem, playerHeadshotsByKey)
    : null
  const selectedFaceSrc = selectedItem
    ? selectedPlayerHeadshot
      ? `/api/image-proxy?url=${encodeURIComponent(selectedPlayerHeadshot)}`
      : buildPlayerFaceRoute(selectedItem.sportKey, selectedItem.playerName)
    : null

  const ladderRows = useMemo(
    () => (selectedItem ? buildLadderRows(selectedItem, 12) : []),
    [selectedItem]
  )
  const maxLadderNotional = useMemo(
    () => ladderRows.reduce((max, row) => Math.max(max, row.notional), 0),
    [ladderRows]
  )
  const ladderVolume = useMemo(
    () => ladderRows.reduce((sum, row) => sum + row.notional, 0),
    [ladderRows]
  )
  const ladderAverageOdds = useMemo(
    () => resolveWeightedAverageOdds(ladderRows),
    [ladderRows]
  )

  const totalCountLabel = `${filteredItems.length} order books`
  const updatedLabel = lastUpdatedAt ? formatDateLabel(lastUpdatedAt) : "--"
  const fetchedLabel = cacheFetchedAt ? formatDateLabel(cacheFetchedAt) : null

  if (loading && !items.length) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <BoxLoader />
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">Loading orderbooks...</span>
        </div>
      </div>
    )
  }

  if (!loading && !items.length && errorMessage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-red-200">
        {errorMessage}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#06090f]">
      <div className="border-b border-white/10 bg-black/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Sharp Prop Orderbook</div>
            <div className="mt-1 text-xs text-white/55">
              {totalCountLabel} | refreshes every 15m
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-white/50">
            <span>Updated {updatedLabel}</span>
            {fetchedLabel && <span>Cache {fetchedLabel}</span>}
            <span className="rounded-md border border-white/10 px-2 py-1 text-white/60">
              {formatCacheLabel(cacheSource)}
            </span>
            <button
              type="button"
              onClick={() => load({ forceRefresh: true, background: true })}
              className="rounded-md border border-white/15 px-2.5 py-1 text-white/75 transition-colors hover:border-emerald-400/50 hover:text-emerald-200"
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player or matchup"
            className="h-9 w-[220px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          />
          <select
            value={oddsPreset}
            onChange={(event) => setOddsPreset(event.target.value as OddsPreset)}
            className="h-9 rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
          >
            <option value="all">Odds: Any</option>
            <option value="default">Odds: -200 or better</option>
            <option value="underdog200">Odds: +200 or worse</option>
            <option value="plusMoney">Odds: +100 or worse</option>
            <option value="evenish">Odds: -120 to +120</option>
            <option value="favorites">Odds: -200 to -101</option>
            <option value="custom">Custom range</option>
          </select>
          {oddsPreset === "custom" && (
            <div className="flex items-center gap-2">
              <input
                value={minOdds}
                onChange={(e) => setMinOdds(e.target.value)}
                placeholder="Min"
                inputMode="numeric"
                className="h-9 w-[88px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
              <span className="text-xs text-white/45">to</span>
              <input
                value={maxOdds}
                onChange={(e) => setMaxOdds(e.target.value)}
                placeholder="Max"
                inputMode="numeric"
                className="h-9 w-[88px] rounded-xl border border-white/10 bg-black/50 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/25"
              />
            </div>
          )}
          {errorMessage && <span className="text-xs text-amber-200">{errorMessage}</span>}
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="px-4 py-10 text-sm text-white/55">No order books match your filters.</div>
      ) : (
        <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="max-h-[72vh] overflow-y-auto border-b border-white/10 bg-black/30 lg:border-b-0 lg:border-r">
            <div className="space-y-2 p-3">
              {filteredItems.map((item) => {
                const isSelected = selectedItem?.id === item.id
                const orderSize = resolveDisplayOrderSize(item)
                const displayLean = resolveDisplayLean(item)
                const miniShares = resolveMiniBarShares(item)
                const playerHeadshot = resolvePlayerHeadshot(item, playerHeadshotsByKey)
                const playerFaceSrc = playerHeadshot
                  ? `/api/image-proxy?url=${encodeURIComponent(playerHeadshot)}`
                  : buildPlayerFaceRoute(item.sportKey, item.playerName)

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
                      isSelected
                        ? "border-emerald-400/60 bg-emerald-500/10"
                        : "border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="text-3xl font-bold leading-none text-lime-300">
                        {formatCompactCurrency(orderSize)}
                      </div>
                      <div className="text-[10px] text-white/40">{item.eventDate ?? "TBD"}</div>
                    </div>

                    <div className="mt-2 line-clamp-1 text-sm font-semibold text-white">
                      {item.matchup ?? item.marketTitle}
                    </div>
                    <div className="mt-1 text-[11px] text-white/45">
                      {item.sportLabel} | {formatSourceLabel(item.source)}
                    </div>

                    <div className="mt-3 flex items-center justify-between rounded-lg border border-white/10 bg-black/45 px-2.5 py-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                          {playerFaceSrc ? (
                            <Image
                              src={playerFaceSrc}
                              alt={item.playerName ?? "Player"}
                              width={28}
                              height={28}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-[10px] font-semibold text-white/65">
                              {resolvePlayerInitials(item.playerName)}
                            </span>
                          )}
                        </div>
                        <div className="line-clamp-1 text-xs text-white/80">
                          {resolvePropText(item, displayLean.side)}
                        </div>
                      </div>
                      <div className="rounded-md bg-lime-500/20 px-2 py-0.5 text-[11px] font-semibold text-lime-300">
                        {formatAmericanOdds(displayLean.odds)}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-white/40">
                        <span>Over</span>
                        <span>Under</span>
                      </div>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-lime-400"
                            style={{ width: `${miniShares.overPct}%` }}
                          />
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-slate-300/60"
                            style={{ width: `${miniShares.underPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="p-4">
            {!selectedItem ? (
              <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-6 text-sm text-white/60">
                Select a market to inspect the live orderbook.
              </div>
            ) : (
              <>
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
                  {selectedItem.sportLabel} | {formatSourceLabel(selectedItem.source)}
                </div>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  {selectedItem.matchup ?? selectedItem.marketTitle}
                </h2>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <div className="text-4xl font-bold leading-none text-lime-300">
                    {formatCompactCurrency(resolveDisplayOrderSize(selectedItem))}
                  </div>
                  <div className="text-sm text-white/55">Whale Volume</div>
                </div>

                <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-3">
                  <div className="text-[10px] uppercase tracking-[0.2em] text-lime-300">The Play</div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-white/5">
                          {selectedFaceSrc ? (
                            <Image
                              src={selectedFaceSrc}
                              alt={selectedItem.playerName ?? "Player"}
                              width={36}
                              height={36}
                              className="h-full w-full object-cover"
                              unoptimized
                            />
                          ) : (
                            <span className="text-xs font-semibold text-white/65">
                              {resolvePlayerInitials(selectedItem.playerName)}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 text-base font-semibold text-white">
                          {resolvePropText(selectedItem, selectedDisplayLean?.side)}
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-white/50">
                        {selectedDisplayLean?.bestBookTitle
                          ? `${selectedDisplayLean.bestBookTitle} best price`
                          : "Best available market price"}
                      </div>
                    </div>
                    <div className="rounded-md bg-lime-500 px-2.5 py-1 text-sm font-semibold text-black">
                      {formatAmericanOdds(selectedDisplayLean?.odds ?? null)}
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/45">Whale Bets</div>
                    <div className="text-xs text-white/50">
                      {formatAmericanOdds(ladderAverageOdds)} avg | {formatCompactCurrency(ladderVolume)} vol
                    </div>
                  </div>

                  <div className="mt-2 space-y-2">
                    {ladderRows.map((row) => {
                      const isHotSide =
                        row.side != null && row.side === selectedDisplayLean?.liquiditySide
                      const widthPct =
                        maxLadderNotional > 0 ? Math.max((row.notional / maxLadderNotional) * 100, 3) : 0
                      return (
                        <div key={row.id} className="grid grid-cols-[74px_minmax(0,1fr)_84px] items-center gap-2">
                          <div
                            className={`text-sm font-semibold ${
                              isHotSide ? "text-lime-300" : "text-slate-200/70"
                            }`}
                          >
                            {formatAmericanOdds(row.odds)}
                          </div>
                          <div className="h-6 overflow-hidden rounded-md border border-white/10 bg-black/35">
                            <div
                              className={`h-full ${
                                isHotSide
                                  ? "bg-gradient-to-r from-lime-500/70 to-lime-400"
                                  : "bg-slate-500/45"
                              }`}
                              style={{ width: `${widthPct}%` }}
                            />
                          </div>
                          <div className="text-right text-xs text-white/70">
                            {formatCompactCurrency(row.notional)}
                          </div>
                        </div>
                      )
                    })}

                    {ladderRows.length === 0 && (
                      <div className="rounded-xl border border-white/10 bg-black/30 px-3 py-4 text-sm text-white/55">
                        No actionable resting levels were found in the current snapshot.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
