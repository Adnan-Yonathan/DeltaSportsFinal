'use client'

import { useState } from 'react'
import { useShareImage } from '@/hooks/useShareImage'

type Props = {
  captureRef: React.RefObject<HTMLDivElement | null>
  templateName: string
}

export default function ExportBar({ captureRef, templateName }: Props) {
  const { shareImage } = useShareImage()
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleExport = async (forceDownload?: boolean) => {
    if (!captureRef.current || loading) return
    setLoading(true)
    setStatus(null)

    const filename = `delta-ig-${templateName}-${Date.now()}.png`

    // If forceDownload, temporarily override clipboard support
    const result = await shareImage(captureRef.current, filename, {
      profile: 'mobile-portrait',
    })

    setLoading(false)
    if (result.ok) {
      setStatus(result.message ?? 'Exported')
      setTimeout(() => setStatus(null), 2500)
    } else {
      setStatus(`Error: ${result.message}`)
      setTimeout(() => setStatus(null), 4000)
    }
  }

  return (
    <div className="flex items-center gap-2 pt-4 border-t border-white/10">
      <button
        onClick={() => handleExport()}
        disabled={loading}
        className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
      >
        {loading ? 'Exporting...' : 'Export PNG'}
      </button>
      {status && (
        <span className="text-xs text-emerald-400 animate-pulse">{status}</span>
      )}
    </div>
  )
}
