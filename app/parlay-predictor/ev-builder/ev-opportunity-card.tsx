'use client'

import { EVOpportunity } from '@/lib/utils/ev-calculator'

const formatOdds = (odds?: number | null) => {
  if (odds == null || !Number.isFinite(odds)) return 'n/a'
  return odds > 0 ? `+${odds}` : `${odds}`
}

const formatPoint = (point?: number) => {
  if (point == null || !Number.isFinite(point)) return ''
  return point > 0 ? `+${point}` : `${point}`
}

interface EVOpportunityCardProps {
  opportunity: EVOpportunity
  onAdd: (opportunity: EVOpportunity) => void
  isSelected: boolean
  disabled?: boolean
}

export default function EVOpportunityCard({
  opportunity,
  onAdd,
  isSelected,
  disabled = false,
}: EVOpportunityCardProps) {
  const pointDisplay = opportunity.point != null ? ` ${formatPoint(opportunity.point)}` : ''
  const betDescription = `${opportunity.selection}${pointDisplay}`

  return (
    <div
      className={`rounded-xl border p-3 transition ${
        isSelected
          ? 'border-emerald-400/40 bg-emerald-500/10'
          : 'border-white/10 bg-black/30 hover:border-white/20'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">
              {betDescription}
            </span>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                opportunity.ev >= 5
                  ? 'bg-emerald-500/20 text-emerald-300'
                  : opportunity.ev >= 3
                    ? 'bg-emerald-500/15 text-emerald-300/90'
                    : 'bg-yellow-500/15 text-yellow-300/90'
              }`}
            >
              +{opportunity.ev.toFixed(1)}% EV
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/50 truncate">
            {opportunity.market} | {opportunity.game}
          </p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <div className="flex items-center gap-1.5">
          <span className="text-white/40">Best:</span>
          <span className="font-medium text-emerald-200">
            {opportunity.bestBook} {formatOdds(opportunity.bestOdds)}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40">Consensus:</span>
          <span className="text-white/60">
            {formatOdds(Math.round(opportunity.consensus.averageOdds))}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-white/40">Books:</span>
          <span className="text-white/50">{opportunity.consensus.bookCount}</span>
        </div>
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={() => onAdd(opportunity)}
          disabled={isSelected || disabled}
          className={`rounded-full border px-3 py-1 text-[10px] uppercase tracking-[0.15em] transition ${
            isSelected || disabled
              ? 'border-emerald-400/30 bg-emerald-500/10 text-emerald-300/60 cursor-not-allowed'
              : 'border-emerald-400/50 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
          }`}
        >
          {isSelected ? 'Added' : disabled ? 'Locked' : '+ Add'}
        </button>
      </div>
    </div>
  )
}
