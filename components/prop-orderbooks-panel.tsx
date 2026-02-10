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
  sharpLeanSide: "Over" | "Under" | null
  sharpLeanAmericanOdds: number | null
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

      // Default: keep earlier behavior (no odds worse than -200)
      return { min: -200, max: null as number | null }
    })()

    const matchesOddsRange = (candidateOdds: number | null, range: { min: number | null; max: number | null }) => {
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

      const oddsCandidates: Array<number | null> = [item.sharpLeanAmericanOdds]
      item.sides.forEach((side) => {
        oddsCandidates.push(side.sharpLineAmericanOdds)
      })

      if (
        oddsCandidates.some(
          (odds) => odds != null && (odds > 1000 || odds < -1000)
        )
      ) {
        return false
      }

      if (resolvedRange.min == null && resolvedRange.max == null) return true

      return oddsCandidates.some((odds) => matchesOddsRange(odds, resolvedRange))
    })

    return filtered.sort((a, b) => {
      const aLiquidity = a.sharpLiquidityNotional ?? 0
      const bLiquidity = b.sharpLiquidityNotional ?? 0
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
        <BoxLoader />
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
            Largest resting liquidity wall • Min wall {formatCurrency(minSharpNotional)}
          </div>
          <div className="text-[10px] text-white/40">
            Sharp lean uses complement pricing (100 - wall price).
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
        {filteredItems.map((item) => (
          <div key={item.id} className="px-4 py-4 hover:bg-white/5 transition-colors">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">
                  {item.playerName ?? "Unknown"}{" "}
                  <span className="text-white/50 font-normal">
                    {item.propType?.replace(/_/g, " ")}
                    {item.propLine != null ? ` ${item.propLine}` : ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {item.source.toUpperCase()} • {item.marketTitle}
                </div>
              </div>

              {item.sharpLeanSide && (
                <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                  Sharp leaning {item.sharpLeanSide} ({formatAmericanOdds(item.sharpLeanAmericanOdds)})
                </span>
              )}
            </div>

            {item.sharpLiquiditySide && (
              <div className="mt-2 text-xs text-white/60">
                Liquidity wall on {item.sharpLiquiditySide}: {formatCurrency(item.sharpLiquidityNotional)}
              </div>
            )}

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {item.sides.map((side) => {
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
                        Wall: {formatAmericanOdds(side.wallAmericanOdds)}
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
                          Sharp Line
                        </div>
                        <div className="mt-1 font-semibold text-white">
                          {formatAmericanOdds(side.sharpLineAmericanOdds)}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
