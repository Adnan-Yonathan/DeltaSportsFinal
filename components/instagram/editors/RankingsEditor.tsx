'use client'

import type { RankingsData, RankingEntry } from '../templates/RankingsAuthority'

type Props = {
  data: RankingsData
  onChange: (patch: Partial<RankingsData>) => void
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

export default function RankingsEditor({ data, onChange }: Props) {
  const entries = data.entries.length > 0
    ? data.entries
    : [{ rank: 1, label: '', value: '' }]

  const updateEntry = (index: number, patch: Partial<RankingEntry>) => {
    const next = entries.map((e, i) => (i === index ? { ...e, ...patch } : e))
    onChange({ entries: next })
  }

  const addEntry = () => {
    if (entries.length >= 7) return
    onChange({ entries: [...entries, { rank: entries.length + 1, label: '', value: '' }] })
  }

  const removeEntry = (index: number) => {
    if (entries.length <= 1) return
    const next = entries.filter((_, i) => i !== index).map((e, i) => ({ ...e, rank: i + 1 }))
    onChange({ entries: next })
  }

  return (
    <div className="space-y-4">
      <Field label="Headline" value={data.headline} onChange={(v) => onChange({ headline: v })} placeholder="83% HIT RATE THIS WEEK" />
      <Field label="Badge Text" value={data.badgeText} onChange={(v) => onChange({ badgeText: v })} placeholder="DELTA SPORTS" />

      <div className="space-y-1">
        <label className="text-xs uppercase tracking-wider text-white/50">Entries</label>
        <div className="space-y-2">
          {entries.map((entry, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-emerald-400 font-bold text-sm w-5 text-center">{entry.rank}</span>
              <input
                value={entry.label}
                onChange={(e) => updateEntry(i, { label: e.target.value })}
                placeholder="Pick label"
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
              />
              <input
                value={entry.value}
                onChange={(e) => updateEntry(i, { value: e.target.value })}
                placeholder="W/L"
                className="w-16 rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-sm text-white placeholder:text-white/30 focus:border-emerald-400/50 focus:outline-none"
              />
              <button
                onClick={() => removeEntry(i)}
                className="text-white/30 hover:text-red-400 text-sm px-1"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        {entries.length < 7 && (
          <button
            onClick={addEntry}
            className="text-xs text-emerald-400 hover:text-emerald-300 mt-1"
          >
            + Add entry
          </button>
        )}
      </div>
    </div>
  )
}
