'use client'

import React from 'react'

type OddsMatrixSurfaceProps = {
  className?: string
  intensity?: number
  tone?: 'emerald' | 'amber'
}

export function OddsMatrixSurface({
  className = '',
  intensity,
  tone,
}: OddsMatrixSurfaceProps) {
  void intensity
  void tone

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-0 opacity-90 ${className}`}
    >
      <div className="h-full w-full bg-gradient-to-br from-emerald-950 via-emerald-900 to-emerald-800" />
    </div>
  )
}
