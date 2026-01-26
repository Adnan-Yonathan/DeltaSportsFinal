'use client'

import { useMemo } from 'react'

// Book configurations
export const COMPARE_BOOKS = [
  { key: 'fanduel', label: 'FanDuel' },
  { key: 'draftkings', label: 'DraftKings' },
  { key: 'betmgm', label: 'BetMGM' },
  { key: 'caesars', label: 'Caesars' },
  { key: 'bet365', label: 'Bet365' },
  { key: 'betrivers', label: 'BetRivers' },
  { key: 'pinnacle', label: 'Pinnacle' },
]

export const PLACE_AT_BOOKS = [
  { key: 'kalshi', label: 'Kalshi' },
  { key: 'polymarket', label: 'Polymarket' },
  { key: 'fanduel', label: 'FanDuel' },
  { key: 'draftkings', label: 'DraftKings' },
  { key: 'betmgm', label: 'BetMGM' },
  { key: 'caesars', label: 'Caesars' },
  { key: 'bet365', label: 'Bet365' },
  { key: 'betrivers', label: 'BetRivers' },
]

export const SUPPORTED_SPORTS = [
  { key: 'americanfootball_nfl', label: 'NFL' },
  { key: 'basketball_nba', label: 'NBA' },
  { key: 'basketball_ncaab', label: 'NCAAB' },
  { key: 'americanfootball_ncaaf', label: 'CFB' },
  { key: 'icehockey_nhl', label: 'NHL' },
  { key: 'baseball_mlb', label: 'MLB' },
]

export const BET_TYPES = [
  { key: 'h2h', label: 'Moneyline' },
  { key: 'spreads', label: 'Spread' },
  { key: 'totals', label: 'Total' },
  { key: 'player_prop', label: 'Player Props' },
]

interface MultiSelectChipsProps {
  label: string
  options: Array<{ key: string; label: string }>
  selected: string[]
  onChange: (selected: string[]) => void
}

function MultiSelectChips({ label, options, selected, onChange }: MultiSelectChipsProps) {
  const toggleOption = (key: string) => {
    if (selected.includes(key)) {
      onChange(selected.filter(k => k !== key))
    } else {
      onChange([...selected, key])
    }
  }

  const selectAll = () => {
    onChange(options.map(o => o.key))
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/50">{label}</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/70 hover:text-emerald-400"
          >
            All
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="text-[9px] uppercase tracking-[0.15em] text-white/40 hover:text-white/60"
          >
            Clear
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const isSelected = selected.includes(option.key)
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => toggleOption(option.key)}
              className={`rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] transition ${
                isSelected
                  ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/15 text-white/50 hover:border-white/30 hover:text-white/70'
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export interface EVFiltersState {
  compareBooks: string[]
  placeAtBooks: string[]
  sports: string[]
  betTypes: string[]
}

interface EVFiltersProps {
  filters: EVFiltersState
  onChange: (filters: EVFiltersState) => void
}

export default function EVFilters({ filters, onChange }: EVFiltersProps) {
  const updateFilter = <K extends keyof EVFiltersState>(key: K, value: EVFiltersState[K]) => {
    onChange({ ...filters, [key]: value })
  }

  const filterSummary = useMemo(() => {
    const parts: string[] = []
    if (filters.placeAtBooks.length > 0) {
      const labels = filters.placeAtBooks
        .slice(0, 2)
        .map(k => PLACE_AT_BOOKS.find(b => b.key === k)?.label || k)
      const more = filters.placeAtBooks.length > 2 ? ` +${filters.placeAtBooks.length - 2}` : ''
      parts.push(`Betting at: ${labels.join(', ')}${more}`)
    }
    if (filters.compareBooks.length > 0) {
      parts.push(`vs ${filters.compareBooks.length} books consensus`)
    }
    return parts.join(' | ')
  }, [filters.compareBooks, filters.placeAtBooks])

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-white/90">EV Filters</p>
          {filterSummary && (
            <p className="mt-1 text-[10px] text-white/50">{filterSummary}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelectChips
          label="Compare Against (Consensus)"
          options={COMPARE_BOOKS}
          selected={filters.compareBooks}
          onChange={value => updateFilter('compareBooks', value)}
        />

        <MultiSelectChips
          label="Place Bets At (Show Opportunities)"
          options={PLACE_AT_BOOKS}
          selected={filters.placeAtBooks}
          onChange={value => updateFilter('placeAtBooks', value)}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <MultiSelectChips
          label="Sports"
          options={SUPPORTED_SPORTS}
          selected={filters.sports}
          onChange={value => updateFilter('sports', value)}
        />

        <MultiSelectChips
          label="Bet Type"
          options={BET_TYPES}
          selected={filters.betTypes}
          onChange={value => updateFilter('betTypes', value)}
        />
      </div>
    </div>
  )
}
