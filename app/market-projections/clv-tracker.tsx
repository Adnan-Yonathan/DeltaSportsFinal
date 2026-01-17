"use client"

import type { MarketProjectionClvSummary } from "@/lib/services/market-projection-clv"

const formatSigned = (value: number | null, digits = 1) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits)
}

const formatProbDelta = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`
}

export default function MarketProjectionsClvTracker({
  summary,
  updatedAt,
  sport,
}: {
  summary: MarketProjectionClvSummary
  updatedAt: string
  sport?: string
}) {
  const beatRate =
    summary.total > 0 ? Math.round((summary.beat / summary.total) * 100) : 0
  const isHockey = sport === "icehockey_nhl"

  return (
    <div className="w-full rounded-2xl border border-emerald-400/25 bg-gradient-to-br from-emerald-500/15 via-black/80 to-black px-4 py-3 text-xs text-white/70 md:w-auto">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <span className="text-[10px] uppercase tracking-[0.3em] text-emerald-200/80">
          CLV tracker
        </span>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
            <span className="text-white/50">Avg</span>{" "}
            {isHockey ? (
              <span className="text-white">{formatProbDelta(summary.avgClvImpliedProb)}</span>
            ) : (
              <span className="text-white">{formatSigned(summary.avgClvPoints)} pts</span>
            )}
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
            <span className="text-white/50">Beat</span>{" "}
            <span className="text-emerald-200">{beatRate}%</span>
            <span className="ml-1 text-white/40">
              ({summary.beat}/{summary.total})
            </span>
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
            <span className="text-white/50">Negative</span>{" "}
            <span className="text-rose-200">Miss {summary.miss}</span>
            <span className="ml-2 text-white/40">Push {summary.push}</span>
          </div>
          <div className="rounded-full border border-white/10 bg-black/40 px-3 py-1">
            <span className="text-white/50">Window</span>{" "}
            <span className="text-white">24h</span>
          </div>
        </div>
        <span className="text-[10px] text-white/35">
          {new Date(updatedAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
    </div>
  )
}
