'use client'

import type { SharpPropData } from '../templates/PlayerPropCard'
import ImageUploadZone from '../shared/ImageUploadZone'

type Props = {
  data: SharpPropData
  onChange: (patch: Partial<SharpPropData>) => void
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

export default function SharpPropsEditor({ data, onChange, onFile, onClearImage }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Sport" value={data.sportLabel} onChange={(v) => onChange({ sportLabel: v })} placeholder="NBA" />
      <Field label="Player Name" value={data.playerName} onChange={(v) => onChange({ playerName: v })} placeholder="Jalen Green" />
      <Field label="Team" value={data.teamName} onChange={(v) => onChange({ teamName: v })} placeholder="PHX | G" />
      <Field label="Prop" value={data.propLabel} onChange={(v) => onChange({ propLabel: v })} placeholder="Over 24.5 Points" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Pred Odds" value={data.predOdds} onChange={(v) => onChange({ predOdds: v })} placeholder="-110" />
        <Field label="Book Odds" value={data.bookOdds} onChange={(v) => onChange({ bookOdds: v })} placeholder="-105" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Edge" value={data.edge} onChange={(v) => onChange({ edge: v })} placeholder="8.2%" />
        <Field label="Score" value={data.score} onChange={(v) => onChange({ score: v })} placeholder="87" />
        <Field label="Volume" value={data.volume} onChange={(v) => onChange({ volume: v })} placeholder="12" />
      </div>
      <Field label="Sources" value={data.sources} onChange={(v) => onChange({ sources: v })} placeholder="Polymarket, Kalshi, Novig" />
      <ImageUploadZone
        imageUrl={data.playerImageUrl}
        onFile={onFile}
        onClear={onClearImage}
        label="Player Photo"
      />
    </div>
  )
}
