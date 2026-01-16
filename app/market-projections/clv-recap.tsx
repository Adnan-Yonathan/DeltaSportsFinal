"use client"

import type {
  MarketProjectionClvGame,
  MarketProjectionClvHistory,
} from "@/lib/services/market-projection-clv"

const formatSigned = (value: number | null, digits = 1) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return value > 0 ? `+${value.toFixed(digits)}` : value.toFixed(digits)
}

const formatProbDelta = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "n/a"
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(2)}%`
}

const resolveOutcome = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "Pending"
  if (value > 0) return "Beat"
  if (value < 0) return "Miss"
  return "Push"
}

const resolveOutcomeClass = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return "text-white/60"
  if (value > 0) return "text-emerald-200"
  if (value < 0) return "text-rose-200"
  return "text-amber-200"
}

const buildPickLabel = (game: MarketProjectionClvGame) => {
  const team = game.pickSide === "home" ? game.homeTeam : game.awayTeam
  return `${team} ${formatSigned(game.pickLine)}`
}

type MarketProjectionsClvRecapProps = {
  games: MarketProjectionClvGame[]
  history: MarketProjectionClvHistory[]
  updatedAt: string
}

export default function MarketProjectionsClvRecap({
  games,
  history,
  updatedAt,
}: MarketProjectionsClvRecapProps) {
  return (
    <details className="group rounded-2xl border border-white/10 bg-white/5 p-4">
      <summary className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-[0.25em] text-white/50 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
        <span>CLV Recap (rolling 24h)</span>
        <span className="flex flex-wrap items-center gap-3">
          <span>Updated {new Date(updatedAt).toLocaleString()}</span>
          <span className="rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/60 group-open:hidden">
            Expand
          </span>
          <span className="hidden rounded-full border border-white/10 bg-black/40 px-2 py-1 text-[10px] text-white/60 group-open:inline-flex">
            Collapse
          </span>
        </span>
      </summary>
      <div className="mt-4 space-y-3">
        {games.length === 0 ? (
          <div className="text-sm text-white/50">
            No closing line recaps yet for the last 24 hours.
          </div>
        ) : (
          games.map((game) => (
            <div
              key={game.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/50 px-3 py-2 text-sm text-white/70"
            >
              <div>
                <div className="text-white">
                  {game.awayTeam} @ {game.homeTeam}
                </div>
                <div className="text-xs text-white/45">
                  Pick {buildPickLabel(game)} {game.pickBook ? `(${game.pickBook})` : ""}
                </div>
              </div>
              <div className="text-xs text-white/50">
                Close {formatSigned(game.closingLine)}
                {game.closingBook ? ` (${game.closingBook})` : ""}
              </div>
              <div className="text-xs">
                <span className={resolveOutcomeClass(game.clvPoints)}>
                  {resolveOutcome(game.clvPoints)} {formatSigned(game.clvPoints)} pts
                </span>
                <span className="ml-2 text-white/40">
                  Odds CLV {formatProbDelta(game.clvImpliedProb)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {history.length > 0 ? (
        <details className="mt-4 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-white/60">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.25em] text-white/50">
            History (last 7 days)
          </summary>
          <div className="mt-3 space-y-2">
            {history.map((entry) => (
              <div
                key={entry.date}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/5 bg-black/50 px-3 py-2"
              >
                <div className="text-white/80">{entry.date}</div>
                <div className="text-xs text-white/50">
                  Beat {entry.beat}/{entry.total} | Miss {entry.miss} | Push {entry.push}
                </div>
                <div className="text-xs text-white/60">
                  Avg {formatSigned(entry.avgClvPoints)} pts | Odds CLV{" "}
                  {formatProbDelta(entry.avgClvImpliedProb)}
                </div>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </details>
  )
}
