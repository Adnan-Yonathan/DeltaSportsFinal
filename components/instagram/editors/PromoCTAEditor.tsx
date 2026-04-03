'use client'

import type { PromoCTAData } from '../templates/PromoCTA'

type Props = {
  data: PromoCTAData
  onChange: (patch: Partial<PromoCTAData>) => void
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

export default function PromoCTAEditor({ data, onChange }: Props) {
  return (
    <div className="space-y-4">
      <Field label="Headline" value={data.headline} onChange={(v) => onChange({ headline: v })} placeholder="Get Your Edge" />
      <Field label="Subtitle" value={data.subtitle} onChange={(v) => onChange({ subtitle: v })} placeholder="Find profitable bets by tracking sharp money" />
      <Field label="CTA Button Text" value={data.ctaText} onChange={(v) => onChange({ ctaText: v })} placeholder="Try Free for 7 Days" />
    </div>
  )
}
