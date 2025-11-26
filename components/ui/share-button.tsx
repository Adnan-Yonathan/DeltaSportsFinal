import { useState } from 'react'
import { Share2, Check, AlertTriangle } from 'lucide-react'
import { useShareImage } from '@/hooks/useShareImage'

interface ShareButtonProps {
  targetRef: React.RefObject<HTMLElement>
  filename?: string
}

export const ShareButton = ({ targetRef, filename = 'delta-card.png' }: ShareButtonProps) => {
  const { shareImage } = useShareImage()
  const [isSharing, setIsSharing] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [message, setMessage] = useState<string | undefined>()

  const handleShare = async () => {
    if (!targetRef.current) return
    setIsSharing(true)
    setStatus('idle')
    setMessage(undefined)
    const result = await shareImage(targetRef.current, filename)
    setStatus(result.ok ? 'ok' : 'error')
    if (!result.ok) setMessage(result.message)
    setIsSharing(false)
    // Reset status after a brief moment to hide checkmark/error indicator
    setTimeout(() => {
      setStatus('idle')
      setMessage(undefined)
    }, 2000)
  }

  return (
    <button
      onClick={handleShare}
      disabled={isSharing || !targetRef.current}
      className="inline-flex items-center gap-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-1 text-xs font-semibold text-white/80 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      title={message || 'Share card (copies image or downloads)'}
    >
      {status === 'ok' ? (
        <Check className="w-3.5 h-3.5 text-green-400" />
      ) : status === 'error' ? (
        <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
      ) : (
        <Share2 className="w-3.5 h-3.5" />
      )}
      {isSharing ? 'Preparing…' : status === 'ok' ? 'Copied' : status === 'error' ? 'Retry' : 'Share'}
    </button>
  )
}
