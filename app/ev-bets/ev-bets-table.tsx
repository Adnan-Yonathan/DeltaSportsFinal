"use client"

import { useMemo, useState } from "react"
import { calculateEV, type EVOpportunity } from "@/lib/utils/ev-calculator"
import { formatAmericanOdds } from "@/lib/utils/odds"

type OddsFilter =
  | "highest"
  | "plus_1000"
  | "plus_750_999"
  | "plus_501_749"
  | "plus_251_100"
  | "minus_101"
  | "minus_500"
  | "minus_500_lower"

type PredictionFilter = "all" | "prediction_only" | "no_prediction"

const FILTER_OPTIONS: Array<{ value: OddsFilter; label: string }> = [
  { value: "highest", label: "Highest EV" },
  { value: "plus_1000", label: "+1000 and up" },
  { value: "plus_750_999", label: "+750 to +999" },
  { value: "plus_501_749", label: "+501 to +749" },
  { value: "plus_251_100", label: "+251 to +100" },
  { value: "minus_101", label: "-101" },
  { value: "minus_500", label: "-500" },
  { value: "minus_500_lower", label: "-500 and lower" },
]

const PREDICTION_FILTER_OPTIONS: Array<{
  value: PredictionFilter
  label: string
}> = [
  { value: "all", label: "All books" },
  { value: "prediction_only", label: "Prediction markets only" },
  { value: "no_prediction", label: "No prediction markets" },
]

const MARKET_LABELS: Record<string, string> = {
  h2h: "Moneyline",
  spreads: "Spread",
  totals: "Total",
}

const formatPoint = (point?: number) => {
  if (!Number.isFinite(point)) return ""
  return point && point > 0 ? ` +${point}` : ` ${point}`
}

const formatSignedPercent = (value: number) => {
  if (!Number.isFinite(value)) return "0.0%"
  const sign = value >= 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

const formatGameTime = (value: string) => {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return "TBD"
  return date.toLocaleString()
}

const isPredictionMarketBook = (bookName?: string | null) => {
  if (!bookName) return false
  const normalized = bookName.toLowerCase()
  return normalized.includes("polymarket") || normalized.includes("kalshi")
}

const matchesFilter = (odds: number, filter: OddsFilter) => {
  if (filter === "highest") return true
  if (filter === "plus_1000") return odds >= 1000
  if (filter === "plus_750_999") return odds >= 750 && odds <= 999
  if (filter === "plus_501_749") return odds >= 501 && odds <= 749
  if (filter === "plus_251_100") return odds >= 100 && odds <= 251
  if (filter === "minus_101") return odds === -101
  if (filter === "minus_500") return odds === -500
  if (filter === "minus_500_lower") return odds <= -500
  return true
}

export default function EvBetsTable({
  opportunities,
  errorMessage,
}: {
  opportunities: EVOpportunity[]
  errorMessage: string | null
}) {
  const [filter, setFilter] = useState<OddsFilter>("highest")
  const [predictionFilter, setPredictionFilter] =
    useState<PredictionFilter>("all")

  const filtered = useMemo(() => {
    const base = opportunities.filter((opp) => {
      if (!matchesFilter(opp.bestOdds, filter)) return false
      const isPrediction = isPredictionMarketBook(opp.bestBook)
      if (predictionFilter === "prediction_only") return isPrediction
      if (predictionFilter === "no_prediction") return !isPrediction
      return true
    })
    return [...base]
      .map((opp) => ({
        ...opp,
        computedEv: calculateEV(
          opp.consensus.impliedProbability,
          opp.bestOdds
        ),
      }))
      .sort((a, b) => b.computedEv - a.computedEv)
  }, [opportunities, filter, predictionFilter])

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Odds filter
          </p>
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as OddsFilter)}
            className="rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/80"
          >
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Prediction markets
          </p>
          <select
            value={predictionFilter}
            onChange={(event) =>
              setPredictionFilter(event.target.value as PredictionFilter)
            }
            className="rounded-md border border-white/10 bg-black/60 px-3 py-2 text-xs text-white/80"
          >
            {PREDICTION_FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-[11px] text-white/40">
          Default view shows highest EV plays across all books.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5">
        <div className="grid grid-cols-[200px_repeat(4,minmax(0,1fr))] gap-2 bg-black/70 px-3 py-2 text-[10px] uppercase tracking-[0.2em] text-white/50">
          <span>Matchup</span>
          <span>Market</span>
          <span>Best Odds</span>
          <span>Consensus</span>
          <span>EV Edge</span>
        </div>
        {errorMessage ? (
          <div className="px-4 py-6 text-sm text-red-200">{errorMessage}</div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-6 text-sm text-white/60">
            No EV opportunities found for that odds class.
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {filtered.map((opp) => (
              <div
                key={`${opp.gameId}-${opp.market}-${opp.selection}-${opp.point ?? "na"}`}
                className="grid grid-cols-[200px_repeat(4,minmax(0,1fr))] gap-2 px-3 py-3 text-[13px] text-white/70"
              >
                <div className="space-y-2">
                  <div className="text-xs uppercase tracking-[0.2em] text-white/40">
                    {formatGameTime(opp.commenceTime)}
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {opp.game}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-white/70">
                  <div className="text-white">
                    {MARKET_LABELS[opp.market] ?? opp.market}
                  </div>
                  <div className="text-white/70">
                    {opp.selection}
                    {formatPoint(opp.point)}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-white/70">
                  <div>
                    <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                      {opp.bestBook} {formatAmericanOdds(opp.bestOdds)}
                    </span>
                  </div>
                  <div className="text-white/50">
                    {opp.allBooks.length} books compared
                  </div>
                </div>
                <div className="space-y-2 text-xs text-white/70">
                  <div>
                    Avg {formatAmericanOdds(Math.round(opp.consensus.averageOdds))}
                  </div>
                  <div className="text-white/50">
                    Median {formatAmericanOdds(Math.round(opp.consensus.medianOdds))}
                  </div>
                </div>
                <div className="space-y-2 text-xs text-white/70">
                  <div className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-emerald-200">
                    EV {formatSignedPercent(opp.computedEv)}
                  </div>
                  <div className="text-white/50">
                    Edge {formatSignedPercent(opp.edgePercent)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
