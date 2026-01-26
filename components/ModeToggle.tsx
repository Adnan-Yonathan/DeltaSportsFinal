'use client'

import { cn } from '@/lib/utils'
import { BarChart3, BookOpen } from 'lucide-react'

export type DeltaMode = 'projections' | 'research'

interface ModeToggleProps {
  mode: DeltaMode
  onChange: (mode: DeltaMode) => void
  className?: string
}

export default function ModeToggle({ mode, onChange, className }: ModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-white/15 bg-white/5 p-0.5',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onChange('projections')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all',
          mode === 'projections'
            ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/40'
            : 'text-white/50 hover:text-white/80'
        )}
      >
        <BarChart3 className="h-3 w-3" />
        <span className="hidden sm:inline">Projections</span>
        <span className="sm:hidden">Proj</span>
      </button>
      <button
        type="button"
        onClick={() => onChange('research')}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.15em] transition-all',
          mode === 'research'
            ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
            : 'text-white/50 hover:text-white/80'
        )}
      >
        <BookOpen className="h-3 w-3" />
        <span className="hidden sm:inline">Research</span>
        <span className="sm:hidden">Res</span>
      </button>
    </div>
  )
}
