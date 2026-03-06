'use client'

import { useRef, useState } from 'react'
import { Check, Download, Loader2, Share2 } from 'lucide-react'
import { useShareImage } from '@/hooks/useShareImage'
import ShareableSharpPropsToolCard, {
  type ShareableSharpPropsToolPayload,
} from './ShareableSharpPropsToolCard'

type ShareSharpPropsToolButtonProps = {
  payload: ShareableSharpPropsToolPayload
}

export default function ShareSharpPropsToolButton({ payload }: ShareSharpPropsToolButtonProps) {
  const [status, setStatus] = useState<'idle' | 'loading' | 'copied' | 'downloaded'>('idle')
  const [showCard, setShowCard] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const { shareImage } = useShareImage()

  const handleShare = async () => {
    setStatus('loading')
    setShowCard(true)

    await new Promise((resolve) => setTimeout(resolve, 300))

    if (!cardRef.current) {
      setStatus('idle')
      setShowCard(false)
      return
    }

    const result = await shareImage(cardRef.current, `delta-sharp-props-${payload.id}.png`)
    setShowCard(false)

    if (result.ok) {
      if (result.message === 'Downloaded') {
        setStatus('downloaded')
      } else {
        setStatus('copied')
      }
      setTimeout(() => setStatus('idle'), 2000)
      return
    }

    setStatus('idle')
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/60 transition-all hover:border-white/20 hover:text-white/80 disabled:opacity-50"
        title="Share sharp props snapshot"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Sharing...</span>
          </>
        )}
        {status === 'copied' && (
          <>
            <Check className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
          </>
        )}
        {status === 'downloaded' && (
          <>
            <Download className="h-3 w-3 text-emerald-400" />
            <span className="text-emerald-400">Downloaded!</span>
          </>
        )}
        {status === 'idle' && (
          <>
            <Share2 className="h-3 w-3" />
            <span>Share</span>
          </>
        )}
      </button>

      {showCard && <ShareableSharpPropsToolCard ref={cardRef} payload={payload} />}
    </>
  )
}
