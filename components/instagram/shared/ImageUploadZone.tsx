'use client'

import { useRef, useState, useCallback } from 'react'

type Props = {
  imageUrl: string | null
  onFile: (file: File) => void
  onClear: () => void
  label?: string
}

export default function ImageUploadZone({ imageUrl, onFile, onClear, label = 'Upload Image' }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files?.[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const file = e.clipboardData.files?.[0]
      if (file) onFile(file)
    },
    [onFile]
  )

  if (imageUrl) {
    return (
      <div className="space-y-2">
        <label className="text-xs uppercase tracking-wider text-white/50">{label}</label>
        <div className="relative rounded-lg overflow-hidden border border-white/10">
          <img src={imageUrl} alt="Upload preview" className="w-full h-32 object-cover" />
          <button
            onClick={onClear}
            className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded hover:bg-red-600 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <label className="text-xs uppercase tracking-wider text-white/50">{label}</label>
      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onPaste={handlePaste}
        tabIndex={0}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors ${
          dragging ? 'border-emerald-400 bg-emerald-400/10' : 'border-white/20 hover:border-white/40'
        }`}
      >
        <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 3.75 3.75 0 013.57 5.408A3.75 3.75 0 0118 19.5H6.75z" />
        </svg>
        <span className="text-xs text-white/50">Drop image, paste, or click</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
        />
      </div>
    </div>
  )
}
