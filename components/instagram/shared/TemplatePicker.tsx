'use client'

export type TemplateType = 'sharp-props' | 'team-insider' | 'series-cover' | 'rankings' | 'promo-cta'

const templates: { id: TemplateType; name: string; desc: string }[] = [
  { id: 'sharp-props', name: 'Sharp Props', desc: 'Player prop with edge & signal data' },
  { id: 'team-insider', name: 'Insider / Whale', desc: 'Team bet with stake & flow data' },
  { id: 'series-cover', name: 'Series Cover', desc: 'Photo overlay with bold title' },
  { id: 'rankings', name: 'Win Rate', desc: 'Rankings & authority stats' },
  { id: 'promo-cta', name: 'Promo / CTA', desc: 'Promo code & call to action' },
]

type Props = {
  active: TemplateType
  onChange: (t: TemplateType) => void
}

export default function TemplatePicker({ active, onChange }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {templates.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-lg border p-3 text-left transition-colors ${
            active === t.id
              ? 'border-emerald-400/60 bg-emerald-400/10'
              : 'border-white/10 bg-black/20 hover:border-white/25'
          }`}
        >
          <div className="text-sm font-semibold text-white">{t.name}</div>
          <div className="text-xs text-white/50 mt-0.5">{t.desc}</div>
        </button>
      ))}
    </div>
  )
}
