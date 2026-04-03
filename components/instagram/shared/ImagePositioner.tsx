'use client'

import { useRef, useCallback, useState } from 'react'

type Props = {
  imageUrl: string
  positionX: number // 0-100
  positionY: number // 0-100
  onPositionChange: (x: number, y: number) => void
  onFile: (file: File) => void
  onClear: () => void
  label?: string
}

export default function ImagePositioner({ imageUrl, positionX, positionY, onPositionChange, onFile, onClear, label = 'Background Image' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      draggingRef.current = true
      setIsDragging(true)
      startRef.current = { x: e.clientX, y: e.clientY, posX: positionX, posY: positionY }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    },
    [positionX, positionY]
  )

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      // Invert delta: dragging right moves the image left (decreases position %)
      const dx = ((e.clientX - startRef.current.x) / rect.width) * -100
      const dy = ((e.clientY - startRef.current.y) / rect.height) * -100
      const newX = Math.max(0, Math.min(100, startRef.current.posX + dx))
      const newY = Math.max(0, Math.min(100, startRef.current.posY + dy))
      onPositionChange(Math.round(newX), Math.round(newY))
    },
    [onPositionChange]
  )

  const handlePointerUp = useCallback(() => {
    draggingRef.current = false
    setIsDragging(false)
  }, [])

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wider text-white/50">{label}</label>

      {/* Draggable preview */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative rounded-lg overflow-hidden border h-36 select-none ${
          isDragging ? 'border-emerald-400/60 cursor-grabbing' : 'border-white/10 cursor-grab'
        }`}
        style={{ touchAction: 'none' }}
      >
        <img
          src={imageUrl}
          alt="Background"
          className="w-full h-full pointer-events-none"
          draggable={false}
          style={{
            objectFit: 'cover',
            objectPosition: `${positionX}% ${positionY}%`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`rounded-full bg-black/60 px-3 py-1 text-xs text-white/70 transition-opacity ${isDragging ? 'opacity-100' : 'opacity-0'}`}>
            {positionX}% , {positionY}%
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => inputRef.current?.click()}
          className="flex-1 text-xs text-white/50 border border-white/10 rounded-md px-2 py-1.5 hover:border-white/25 transition-colors"
        >
          Replace
        </button>
        <button
          onClick={() => onPositionChange(50, 50)}
          className="text-xs text-white/50 border border-white/10 rounded-md px-2 py-1.5 hover:border-white/25 transition-colors"
        >
          Center
        </button>
        <button
          onClick={onClear}
          className="text-xs text-red-400/70 border border-white/10 rounded-md px-2 py-1.5 hover:border-red-400/40 transition-colors"
        >
          Remove
        </button>
      </div>

      <p className="text-[10px] text-white/30">Drag the image to reposition</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}
