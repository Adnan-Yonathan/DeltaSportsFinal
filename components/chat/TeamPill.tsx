'use client'

import { X } from 'lucide-react'
import type { TeamRecord } from '@/lib/types/teams'
import { SPORT_DISPLAY } from '@/lib/types/teams'

interface TeamPillProps {
  team: TeamRecord
  onRemove?: () => void
  showSportBadge?: boolean
  size?: 'sm' | 'md'
  className?: string
}

export function TeamPill({
  team,
  onRemove,
  showSportBadge = false,
  size = 'md',
  className = '',
}: TeamPillProps) {
  const sportLabel = SPORT_DISPLAY[team.sport]?.shortLabel || ''

  const sizeClasses = {
    sm: 'text-xs px-1.5 py-0.5 gap-1',
    md: 'text-sm px-2 py-1 gap-1.5',
  }

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
  }

  const logoSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
  }

  return (
    <span
      className={`
        inline-flex items-center rounded-md
        bg-emerald-500/20 text-emerald-400 border border-emerald-500/30
        font-medium select-none
        ${sizeClasses[size]}
        ${className}
      `}
      contentEditable={false}
    >
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.shortName}
          className={`${logoSizes[size]} object-contain`}
          onError={(e) => {
            // Hide broken images
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <span>{team.abbreviation}</span>
      {showSportBadge && sportLabel && (
        <span className="text-emerald-400/60 text-[0.65em]">
          {sportLabel}
        </span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 p-0.5 rounded hover:bg-emerald-500/30 transition-colors"
          aria-label={`Remove ${team.shortName}`}
        >
          <X className={iconSizes[size]} />
        </button>
      )}
    </span>
  )
}

/**
 * Inline version of TeamPill for use in contenteditable areas.
 * This is a static display without interactive remove button.
 */
export function InlineTeamPill({
  team,
  showSportBadge = false,
}: {
  team: TeamRecord
  showSportBadge?: boolean
}) {
  const sportLabel = SPORT_DISPLAY[team.sport]?.shortLabel || ''

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-sm font-medium"
      contentEditable={false}
      data-team-id={team.id}
      data-team-sport={team.sport}
    >
      {team.logoUrl && (
        <img
          src={team.logoUrl}
          alt={team.shortName}
          className="w-3.5 h-3.5 object-contain"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none'
          }}
        />
      )}
      <span>{team.abbreviation}</span>
      {showSportBadge && sportLabel && (
        <span className="text-emerald-400/60 text-[0.65em]">
          {sportLabel}
        </span>
      )}
    </span>
  )
}
