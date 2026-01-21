'use client'

import { useRef, useState } from 'react'
import { Share2, Check, Download, Loader2 } from 'lucide-react'
import ShareableSharpPropCard, {
  type ShareableSharpProp,
} from './ShareableSharpPropCard'
import { useShareImage } from '@/hooks/useShareImage'

type SharePropButtonProps = {
  prop: ShareableSharpProp
}

export default function SharePropButton({ prop }: SharePropButtonProps) {
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

    const result = await shareImage(cardRef.current, `delta-prop-${prop.id}.png`)
    setShowCard(false)

    if (result.ok) {
      if (result.message === 'Downloaded') {
        setStatus('downloaded')
      } else {
        setStatus('copied')
      }
      setTimeout(() => setStatus('idle'), 2000)
    } else {
      setStatus('idle')
    }
  }

  return (
    <>
      <button
        onClick={handleShare}
        disabled={status === 'loading'}
        className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-white/60 hover:border-white/20 hover:text-white/80 transition-all disabled:opacity-50"
        title="Share prop"
      >
        {status === 'loading' && (
          <>
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>Sharing...</span>
          </>
        )}
        {status === 'copied' && (
          <>
            <Check className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Copied!</span>
          </>
        )}
        {status === 'downloaded' && (
          <>
            <Download className="w-3 h-3 text-emerald-400" />
            <span className="text-emerald-400">Downloaded!</span>
          </>
        )}
        {status === 'idle' && (
          <>
            <Share2 className="w-3 h-3" />
            <span>Share</span>
          </>
        )}
      </button>

      {showCard && <ShareableSharpPropCard ref={cardRef} prop={prop} />}
    </>
  )
}
