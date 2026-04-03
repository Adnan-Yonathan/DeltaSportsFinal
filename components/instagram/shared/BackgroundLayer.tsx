'use client'

export type BackgroundSettings = {
  imageUrl: string | null
  positionX: number
  positionY: number
  overlayOpacity: number
  overlayColor: string // hex color, e.g. '#000000'
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.slice(0, 2), 16) || 0
  const g = parseInt(cleaned.slice(2, 4), 16) || 0
  const b = parseInt(cleaned.slice(4, 6), 16) || 0
  return { r, g, b }
}

export default function BackgroundLayer({ bg }: { bg: BackgroundSettings }) {
  if (!bg.imageUrl) return null

  const opacity = (bg.overlayOpacity ?? 70) / 100
  const { r, g, b } = hexToRgb(bg.overlayColor || '#000000')

  return (
    <>
      {/* Full-bleed background image */}
      <img
        src={bg.imageUrl}
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: `${bg.positionX ?? 50}% ${bg.positionY ?? 50}%`,
          zIndex: 0,
        }}
      />
      {/* Color overlay gradient */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, rgba(${r},${g},${b},${(opacity * 0.3).toFixed(2)}) 0%, rgba(${r},${g},${b},${opacity.toFixed(2)}) 70%)`,
          zIndex: 1,
        }}
      />
    </>
  )
}
