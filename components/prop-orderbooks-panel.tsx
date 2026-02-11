"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  source: "kalshi" | "polymarket"
  sportKey: string
  sportLabel: string
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
  updatedAt: string
  sides: OrderbookSide[]
}

const formatCurrency = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return `$${Math.round(value).toLocaleString("en-US")}`
}

const formatAmericanOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return "--"
  return value > 0 ? `+${Math.round(value)}` : `${Math.round(value)}`
}

const resolveLargestWall = (item: OrderbookItem) =>
  [...item.sides]
    .filter((side) => (side.wallNotional ?? 0) > 0)
    .sort((a, b) => (b.wallNotional ?? 0) - (a.wallNotional ?? 0))[0] ?? null

const resolveDisplayOrderSize = (item: OrderbookItem) => {
  if ((item.sharpLiquidityNotional ?? 0) > 0) return item.sharpLiquidityNotional
  return resolveLargestWall(item)?.wallNotional ?? null
}

export default function PropOrderbooksPanel({
  sport,
  limit = 80,
  depth = 8,
  minSharpNotional = 1000,
}: {
  sport: string
  limit?: number
  depth?: number
  minSharpNotional?: number
}) {
  const [items, setItems] = useState<OrderbookItem[]>([])
  const [search, setSearch] = useState("")
  const [oddsPreset, setOddsPreset] = useState<
    "default" | "underdog200" | "plusMoney" | "evenish" | "favorites" | "custom"
  >("default")
  const [minOdds, setMinOdds] = useState<string>("-200")
  const [maxOdds, setMaxOdds] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [expandedCards, setExpandedCards] = useState<Record<string, boolean>>({})
  const loadedRef = useRef(false)

  const load = useCallback(async () => {
    if (loadedRef.current) return
    setLoading(true)
    setErrorMessage(null)

    try {
      const params = new URLSearchParams({
        sport,
        limit: String(limit),
        depth: String(depth),
        minSharpNotional: String(minSharpNotional),
      })

      const res = await fetch(`/api/prop-orderbooks?${params.toString()}`, {
        cache: "no-store",
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload?.error || "Failed to load order books.")
      }

      const json = await res.json()
      setItems(Array.isArray(json?.items) ? json.items : [])
      loadedRef.current = true
    } catch (err: any) {
      setErrorMessage(err?.message ?? "Failed to load order books.")
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [sport, limit, depth, minSharpNotional])

  useEffect(() => {
    loadedRef.current = false
    setItems([])
    setErrorMessage(null)
    setSearch("")
    setOddsPreset("default")
    setMinOdds("-200")
    setMaxOdds("")
    setExpandedCards({})
  }, [sport])

  useEffect(() => {
    load()
  }, [load])

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase()

    const resolvedRange = (() => {
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

    const matchesOddsRange = (
      candidateOdds: number | null,
      range: { min: number | null; max: number | null }
    ) => {
      if (candidateOdds == null) return false
      if (range.min != null && candidateOdds < range.min) return false
      if (range.max != null && candidateOdds > range.max) return false
      return true
    }

    const filtered = items.filter((item) => {
      if (query) {
        const haystack = `${item.playerName ?? ""} ${item.marketTitle ?? ""}`
          .toLowerCase()
          .trim()
        if (!haystack.includes(query)) return false
      }

      const displayLeanOdds =
        item.sharpLeanBestOdds ?? item.sharpLeanAmericanOdds ?? null
      const hasSharpLeanOdds =
        item.sharpLeanSide != null &&
        displayLeanOdds != null &&
        Number.isFinite(displayLeanOdds)
      if (!hasSharpLeanOdds) return false

      if (resolvedRange.min == null && resolvedRange.max == null) return true

      return matchesOddsRange(displayLeanOdds, resolvedRange)
    })

    return filtered.sort((a, b) => {
      const aDisplayLeanOdds = a.sharpLeanBestOdds ?? a.sharpLeanAmericanOdds ?? null
      const bDisplayLeanOdds = b.sharpLeanBestOdds ?? b.sharpLeanAmericanOdds ?? null
      const aHasSharpLean = aDisplayLeanOdds != null && Number.isFinite(aDisplayLeanOdds)
      const bHasSharpLean = bDisplayLeanOdds != null && Number.isFinite(bDisplayLeanOdds)
      if (aHasSharpLean !== bHasSharpLean) return aHasSharpLean ? -1 : 1

      const aLiquidity = resolveDisplayOrderSize(a) ?? 0
      const bLiquidity = resolveDisplayOrderSize(b) ?? 0
      if (bLiquidity !== aLiquidity) return bLiquidity - aLiquidity
      return a.marketTitle.localeCompare(b.marketTitle)
    })
  }, [items, search, oddsPreset, minOdds, maxOdds])

  const totalCountLabel = useMemo(
    () => `${filteredItems.length} order books`,
    [filteredItems.length]
  )

  if (loading) {
    return (
      <div className="flex min-h-[320px] items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-6">
        <div className="flex flex-col items-center gap-4">
          <BoxLoader />
          <span className="text-xs uppercase tracking-[0.3em] text-white/50">
            Loading...
          </span>
        </div>
      </div>
    )
  }

  if (errorMessage) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-red-200">
        {errorMessage}
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-6 text-sm text-white/60">
        No order books available.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 bg-black/50 px-4 py-3">
        <div className="space-y-1">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
            Largest resting liquidity wall | Min wall {formatCurrency(minSharpNotional)}
          </div>
          <div className="text-[10px] text-white/40">
            Sharp lean uses complement pricing (100 - wall price).
          </div>
          <div className="text-[10px] text-white/40">
            Showing props with a resolved sharp lean odds signal.
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <select
            value={oddsPreset}
            onChange={(event) => setOddsPreset(event.target.value as any)}
            className="h-9 rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white/80 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          >
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
                className="h-9 w-[92px] rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
              <span className="text-xs text-white/40">to</span>
              <input
                value={maxOdds}
                onChange={(e) => setMaxOdds(e.target.value)}
                placeholder="Max"
                inputMode="numeric"
                className="h-9 w-[92px] rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search player"
            className="h-9 w-[180px] rounded-xl border border-white/10 bg-black/40 px-3 text-xs text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
          <div className="text-[10px] text-white/40">{totalCountLabel}</div>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {filteredItems.map((item) => {
          const isExpanded = Boolean(expandedCards[item.id])
          const largestWall = resolveLargestWall(item)
          const orderSize = resolveDisplayOrderSize(item)
          const liquiditySide = item.sharpLiquiditySide ?? largestWall?.propSide ?? null
          const inferredLeanSide =
            item.sharpLeanSide ??
            (liquiditySide === "Over"
              ? "Under"
              : liquiditySide === "Under"
                ? "Over"
                : null)
          const inferredLeanOdds =
            item.sharpLeanAmericanOdds ?? largestWall?.sharpLineAmericanOdds ?? null
          const orderTakenOdds =
            item.sharpOrderAmericanOdds ?? largestWall?.wallAmericanOdds ?? null
          const bestLeanOdds =
            item.sharpLeanBestOdds ?? inferredLeanOdds ?? null
          const bestLeanBook = item.sharpLeanBestBookTitle ?? null
          const totalWallLiquidity = item.sides.reduce(
            (sum, side) => sum + (side.wallNotional ?? 0),
            0
          )
          const wallSharePercent =
            orderSize != null && totalWallLiquidity > 0
              ? Math.round((orderSize / totalWallLiquidity) * 100)
              : null
          const leanLabel = item.sharpLeanSide
            ? `${item.sharpLeanSide} ${formatAmericanOdds(bestLeanOdds)}`
            : "No clear sharp lean"

          return (
            <div key={item.id} className="px-4 py-4 transition-colors hover:bg-white/5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {item.playerName ?? "Unknown"}{" "}
                    <span className="font-normal text-white/50">
                      {item.propType?.replace(/_/g, " ")}
                      {item.propLine != null ? ` ${item.propLine}` : ""}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-white/50">
                    {item.sportLabel} | {item.source === "polymarket" ? "Polymarket" : "Kalshi"}
                    {item.eventDate ? ` | ${item.eventDate}` : ""}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setExpandedCards((prev) => ({
                      ...prev,
                      [item.id]: !prev[item.id],
                    }))
                  }
                  className="rounded-full border border-white/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/70 transition-colors hover:border-emerald-400/40 hover:text-emerald-200"
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Order Size
                  </div>
                  <div className="mt-1 text-lg font-semibold text-emerald-200">
                    {formatCurrency(orderSize)}
                  </div>
                  <div className="text-[11px] text-white/45">
                    {liquiditySide ? `Largest wall on ${liquiditySide}` : "Largest visible liquidity wall"}
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                    Best Odds
                  </div>
                  <div className="mt-1 text-base font-semibold text-white">{leanLabel}</div>
                  <div className="text-[11px] text-white/45">
                    {item.sharpLiquiditySide && item.sharpLeanSide
                      ? bestLeanBook
                        ? `Best available at ${bestLeanBook}`
                        : `Wall on ${item.sharpLiquiditySide} implies ${item.sharpLeanSide}`
                      : "Waiting for a wall above the sharp threshold"}
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3">
                  <div className="text-xs text-white/55">{item.marketTitle}</div>
                  <div className="mt-3 grid gap-3 lg:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300/90">
                        We Detect
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-white/75">
                        We scan both outcomes and locate the largest resting orderbook wall. Here that wall is{" "}
                        <span className="font-semibold text-white">
                          {liquiditySide ?? "the active side"} {formatAmericanOdds(largestWall?.wallAmericanOdds)}
                        </span>{" "}
                        with about{" "}
                        <span className="font-semibold text-emerald-200">
                          {formatCurrency(orderSize)}
                        </span>{" "}
                        in visible size, posted around{" "}
                        <span className="font-semibold text-white">
                          {formatAmericanOdds(orderTakenOdds)}
                        </span>
                        .
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300/90">
                        We Analyze
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-white/75">
                        The model uses complement pricing. If liquidity is stacked on one side at price{" "}
                        <span className="font-semibold text-white">
                          {formatAmericanOdds(largestWall?.wallAmericanOdds)}
                        </span>
                        , sharp intent is inferred on the opposite side around{" "}
                        <span className="font-semibold text-white">
                          {inferredLeanSide ?? "N/A"} {formatAmericanOdds(inferredLeanOdds)}
                        </span>{" "}
                        and the best available book price is{" "}
                        <span className="font-semibold text-white">
                          {inferredLeanSide ?? "N/A"} {formatAmericanOdds(bestLeanOdds)}
                        </span>
                        {bestLeanBook ? ` at ${bestLeanBook}` : ""}
                        . {wallSharePercent != null ? `That wall is ${wallSharePercent}% of visible wall liquidity.` : ""}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/30 p-3">
                      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/90">
                        How To Use
                      </div>
                      <p className="mt-2 text-[12px] leading-relaxed text-white/75">
                        Treat this as a price-discovery signal, not an auto-bet. The card above shows the current best
                        sportsbook price; this order was posted at{" "}
                        <span className="font-semibold text-white">
                          {formatAmericanOdds(orderTakenOdds)}
                        </span>
                        . Follow the inferred lean only if you can execute at{" "}
                        <span className="font-semibold text-white">
                          {formatAmericanOdds(bestLeanOdds)}
                        </span>{" "}
                        or better, and re-check before placing since orderbook walls can move quickly.
                      </p>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {item.sides.map((side) => {
                      const impliedLeanSide =
                        side.propSide === "Over"
                          ? "Under"
                          : side.propSide === "Under"
                            ? "Over"
                            : null

                      return (
                        <div
                          key={`${item.id}-${side.outcome}`}
                          className="rounded-2xl border border-white/10 bg-black/30 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs font-semibold text-white">
                              {side.propSide ?? side.outcome}
                            </div>
                            <div className="text-[11px] text-white/50">
                              Wall price {formatAmericanOdds(side.wallAmericanOdds)}
                            </div>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-3 text-[12px]">
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                                Wall Size
                              </div>
                              <div className="mt-1 font-semibold text-white">
                                {formatCurrency(side.wallNotional)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] uppercase tracking-[0.18em] text-white/40">
                                Sharp Lean
                              </div>
                              <div className="mt-1 font-semibold text-white">
                                {impliedLeanSide ? `${impliedLeanSide} ` : ""}
                                {formatAmericanOdds(side.sharpLineAmericanOdds)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

