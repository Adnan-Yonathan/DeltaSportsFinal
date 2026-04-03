'use client'

import type { SeriesCoverData } from '../templates/SeriesCover'

type Props = {
  data: SeriesCoverData
  onChange: (patch: Partial<SeriesCoverData>) => void
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

export default function SeriesCoverEditor({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Series Name" value={data.seriesName} onChange={(v) => onChange({ seriesName: v })} placeholder="SPLASH FRIDAY" />
      <Field label="Subtitle" value={data.subtitle} onChange={(v) => onChange({ subtitle: v })} placeholder="3PT Trends" />
    </div>
  )
}
