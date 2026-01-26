'use client'

import { useMemo } from 'react'
import { EVOpportunity } from '@/lib/utils/ev-calculator'
import {
  calculateCombinedProbability,
  calculateMinOddsForTargetEV,
  ParlayLeg,
} from '@/lib/utils/parlay-ev-calculator'
import { americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${Math.round(odds)}` : `${Math.round(odds)}`
}

const formatProbability = (prob: number) => {
  return `${(prob * 100).toFixed(1)}%`
}

const formatPoint = (point?: number) => {
  if (point == null || !Number.isFinite(point)) return ''
  return point > 0 ? `+${point}` : `${point}`
}

interface SelectedLeg extends EVOpportunity {
  legId: string
}

interface EVParlaySummaryProps {
  legs: SelectedLeg[]
  onRemove: (legId: string) => void
  targetEV?: number
}

export default function EVParlaySummary({
  legs,
  onRemove,
  targetEV = 3,
}: EVParlaySummaryProps) {
  const calculations = useMemo(() => {
    if (legs.length === 0) {
      return {
        combinedProbability: 0,
        currentCombinedOdds: 0,
        minOddsForTargetEV: 0,
        currentEV: 0,
        evGap: 0,
        meetsTarget: false,
      }
    }

    // Convert EVOpportunities to ParlayLegs
    const parlayLegs: ParlayLeg[] = legs.map(leg => ({
      id: leg.legId,
      game: leg.game,
      gameId: leg.gameId,
      market: leg.market,
      selection: leg.selection,
      point: leg.point,
      consensusProbability: leg.consensus.impliedProbability,
      bestBook: leg.bestBook,
      bestOdds: leg.bestOdds,
      allBooks: leg.allBooks,
    }))

    // Calculate combined probability
    const combinedProbability = calculateCombinedProbability(parlayLegs)

    // Calculate current combined odds
    const currentCombinedDecimal = parlayLegs.reduce(
      (acc, leg) => acc * americanToDecimal(leg.bestOdds),
      1
    )
    const currentCombinedOdds = decimalToAmerican(currentCombinedDecimal)

    // Calculate minimum odds for target EV
    const minOddsForTargetEV = calculateMinOddsForTargetEV(combinedProbability, targetEV)

    // Calculate current EV
    const currentEV = (combinedProbability * currentCombinedDecimal - 1) * 100

    // Calculate gap
    const evGap = minOddsForTargetEV - currentCombinedOdds

    return {
      combinedProbability,
      currentCombinedOdds,
      minOddsForTargetEV,
      currentEV,
      evGap,
      meetsTarget: currentEV >= targetEV,
    }
  }, [legs, targetEV])

  return (
    <div className="flex flex-col h-full">
      <div className="px-1 pb-2">
        <p className="text-xs font-semibold text-white/90">
          Your Parlay ({legs.length} {legs.length === 1 ? 'leg' : 'legs'})
        </p>
      </div>

      {legs.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-center p-4">
          <p className="text-sm text-white/50">
            Add legs from the EV opportunities feed<br />
            <span className="text-[11px]">to build your parlay.</span>
          </p>
        </div>
      ) : (
        <>
          {/* Legs list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {legs.map((leg, index) => {
              const pointDisplay = leg.point != null ? ` ${formatPoint(leg.point)}` : ''
              return (
                <div
                  key={leg.legId}
                  className="rounded-xl border border-white/10 bg-black/30 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-white/40">
                          {index + 1}.
                        </span>
                        <span className="text-sm font-medium text-white truncate">
                          {leg.selection}{pointDisplay}
                        </span>
                      </div>
                      <p className="mt-1 text-[10px] text-white/50">
                        {leg.market} | {leg.game}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onRemove(leg.legId)}
                      className="shrink-0 text-white/30 hover:text-white/60 transition"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                    <div>
                      <span className="text-white/40">Book:</span>{' '}
                      <span className="text-emerald-200">{leg.bestBook}</span>
                    </div>
                    <div>
                      <span className="text-white/40">Odds:</span>{' '}
                      <span className="text-white/70">{formatOdds(leg.bestOdds)}</span>
                    </div>
                    <div>
                      <span className="text-white/40">True Prob:</span>{' '}
                      <span className="text-white/70">{formatProbability(leg.consensus.impliedProbability)}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Calculations summary */}
          <div className="mt-4 space-y-3 pt-3 border-t border-white/10">
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-white/40">Combined Prob</p>
                <p className="text-base font-semibold text-white/90">
                  {formatProbability(calculations.combinedProbability)}
                </p>
              </div>
              <div className="rounded-lg bg-black/30 p-2.5">
                <p className="text-white/40">Current Odds</p>
                <p className="text-base font-semibold text-white/90">
                  {formatOdds(calculations.currentCombinedOdds)}
                </p>
              </div>
            </div>

            {/* Min odds for target EV */}
            <div
              className={`rounded-xl border p-3 ${
                calculations.meetsTarget
                  ? 'border-emerald-400/40 bg-emerald-500/10'
                  : 'border-yellow-400/30 bg-yellow-500/10'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">
                    Min Odds for {targetEV}% EV
                  </p>
                  <p
                    className={`text-xl font-bold ${
                      calculations.meetsTarget ? 'text-emerald-300' : 'text-yellow-200'
                    }`}
                  >
                    {formatOdds(calculations.minOddsForTargetEV)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase tracking-[0.15em] text-white/50">
                    Current EV
                  </p>
                  <p
                    className={`text-lg font-semibold ${
                      calculations.currentEV >= targetEV
                        ? 'text-emerald-300'
                        : calculations.currentEV > 0
                          ? 'text-yellow-200'
                          : 'text-red-300'
                    }`}
                  >
                    {calculations.currentEV > 0 ? '+' : ''}{calculations.currentEV.toFixed(1)}%
                  </p>
                </div>
              </div>
              {!calculations.meetsTarget && calculations.evGap > 0 && (
                <p className="mt-2 text-[10px] text-yellow-200/70">
                  Need {formatOdds(calculations.evGap)} more odds to hit {targetEV}% EV
                </p>
              )}
              {calculations.meetsTarget && (
                <p className="mt-2 text-[10px] text-emerald-200/70">
                  This parlay exceeds {targetEV}% EV target
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
