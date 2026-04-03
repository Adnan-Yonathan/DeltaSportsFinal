'use client'

import type { BackgroundSettings } from '../shared/BackgroundLayer'
import ImageUploadZone from '../shared/ImageUploadZone'
import ImagePositioner from '../shared/ImagePositioner'

type Props = {
  bg: BackgroundSettings
  onChange: (patch: Partial<BackgroundSettings>) => void
  onFile: (file: File) => void
  onClear: () => void
}

const PRESET_COLORS = [
  { hex: '#000000', label: 'Black' },
  { hex: '#0a0f1c', label: 'Navy' },
  { hex: '#1a1a2e', label: 'Dark Blue' },
  { hex: '#0d1b2a', label: 'Midnight' },
  { hex: '#1b4332', label: 'Forest' },
  { hex: '#3c1361', label: 'Purple' },
  { hex: '#7f1d1d', label: 'Crimson' },
  { hex: '#4E4E4E', label: 'Graphite' },
]

export default function BackgroundEditor({ bg, onChange, onFile, onClear }: Props) {
  return (
    <div className="space-y-4 rounded-lg border border-white/10 bg-black/20 p-4">
      <label className="text-xs uppercase tracking-wider text-white/50 block">Background Image</label>

      {bg.imageUrl ? (
        <>
          <ImagePositioner
            imageUrl={bg.imageUrl}
            positionX={bg.positionX}
            positionY={bg.positionY}
            onPositionChange={(x, y) => onChange({ positionX: x, positionY: y })}
            onFile={onFile}
            onClear={onClear}
            label="Image Position"
          />

          {/* Overlay opacity */}
          <div className="space-y-1">
            <label className="text-xs uppercase tracking-wider text-white/50">
              Overlay Opacity: {bg.overlayOpacity}%
            </label>
            <input
              type="range"
              min={0}
              max={100}
              value={bg.overlayOpacity}
              onChange={(e) => onChange({ overlayOpacity: parseInt(e.target.value) })}
              className="w-full accent-emerald-400"
            />
          </div>

          {/* Overlay color */}
          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-white/50">Overlay Color</label>
            <div className="flex items-center gap-3">
              {/* Native color picker */}
              <div className="relative">
                <input
                  type="color"
                  value={bg.overlayColor}
                  onChange={(e) => onChange({ overlayColor: e.target.value })}
                  className="w-9 h-9 rounded-lg border border-white/20 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0.5 [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-none"
                />
              </div>
              <span className="text-xs text-white/40 font-mono">{bg.overlayColor}</span>
            </div>

            {/* Preset swatches */}
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c.hex}
                  onClick={() => onChange({ overlayColor: c.hex })}
                  title={c.label}
                  className={`w-7 h-7 rounded-md border-2 transition-all ${
                    bg.overlayColor === c.hex
                      ? 'border-emerald-400 scale-110'
                      : 'border-white/15 hover:border-white/40'
                  }`}
                  style={{ backgroundColor: c.hex }}
                />
              ))}
            </div>
          </div>
        </>
      ) : (
        <ImageUploadZone
          imageUrl={null}
          onFile={onFile}
          onClear={onClear}
          label="Drop an image for the background"
        />
      )}
    </div>
  )
}
