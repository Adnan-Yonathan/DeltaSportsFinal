'use client'

import type { TeamInsiderData } from '../templates/TeamInsiderCard'
import ImageUploadZone from '../shared/ImageUploadZone'

type Props = {
  data: TeamInsiderData
  onChange: (patch: Partial<TeamInsiderData>) => void
  onFile: (file: File) => void
  onClearImage: () => void
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1">
      <label className="text-xs uppercase tracking-wider text-white/50">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
      />
    </div>
  )
}

export default function TeamInsiderEditor({ data, onChange, onFile, onClearImage }: Props) {
  return (
    <div className="space-y-4">
      {/* Feed type toggle */}
      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-white/50">Feed Type</label>
        <div className="flex gap-2">
          {(['insider', 'whale'] as const).map((type) => (
            <button
              key={type}
              onClick={() => onChange({ feedType: type })}
              className={`flex-1 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                data.feedType === type
                  ? 'border-emerald-400/60 bg-emerald-400/10 text-emerald-400'
                  : 'border-white/10 text-white/50 hover:border-white/25'
              }`}
            >
              {type === 'insider' ? 'Insider Feed' : 'Whale Feed'}
            </button>
          ))}
        </div>
      </div>

      <Field label="Sport" value={data.sportLabel} onChange={(v) => onChange({ sportLabel: v })} placeholder="NBA" />
      <Field label="Matchup" value={data.matchupTitle} onChange={(v) => onChange({ matchupTitle: v })} placeholder="LAL vs BOS" />
      <Field label="Outcome / Position" value={data.outcome} onChange={(v) => onChange({ outcome: v })} placeholder="Lakers ML" />
      <Field label="Odds" value={data.odds} onChange={(v) => onChange({ odds: v })} placeholder="-110" />
      <Field label="Insider Score" value={data.insiderScore} onChange={(v) => onChange({ insiderScore: v })} placeholder="92" />

      <div className="grid grid-cols-2 gap-3">
        <Field label="Stake" value={data.stakeUsd} onChange={(v) => onChange({ stakeUsd: v })} placeholder="$5k" />
        <Field label="To Win" value={data.toWinUsd} onChange={(v) => onChange({ toWinUsd: v })} placeholder="$4.5k" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="ROI" value={data.walletRoi} onChange={(v) => onChange({ walletRoi: v })} placeholder="+42%" />
        <Field label="Size Ratio" value={data.sizeRatio} onChange={(v) => onChange({ sizeRatio: v })} placeholder="3.2x" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Total Bets" value={data.totalBets} onChange={(v) => onChange({ totalBets: v })} placeholder="12" />
        <Field label="Total Wagered" value={data.totalWagered} onChange={(v) => onChange({ totalWagered: v })} placeholder="$62k" />
      </div>

      <ImageUploadZone
        imageUrl={data.teamImageUrl}
        onFile={onFile}
        onClear={onClearImage}
        label="Team / Logo Image"
      />
    </div>
  )
}
