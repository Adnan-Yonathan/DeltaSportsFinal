'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { MoreHorizontal } from 'lucide-react'
import { MobileMoreSheet } from '@/components/mobile-tools-nav'

export default function MobileMoreButton() {
  const pathname = usePathname() ?? ''
  const pushedHistoryRef = useRef(false)
  const [isOpen, setIsOpen] = useState(false)

  // Close on route change
  useEffect(() => {
    setIsOpen(false)
    pushedHistoryRef.current = false
  }, [pathname])

  // Push history entry when opening so back button closes the sheet
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return
    window.history.pushState({ mobileMoreMenu: true }, '')
    pushedHistoryRef.current = true
  }, [isOpen])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handlePopState = () => {
      if (!isOpen) return
      setIsOpen(false)
      pushedHistoryRef.current = false
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        if (typeof window !== 'undefined' && pushedHistoryRef.current) {
          pushedHistoryRef.current = false
          window.history.back()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const dismiss = useCallback(() => {
    setIsOpen(false)
    if (typeof window !== 'undefined' && pushedHistoryRef.current) {
      pushedHistoryRef.current = false
      window.history.back()
    }
  }, [])

  return (
    <>
      <button
        type="button"
        aria-label="More navigation"
        aria-expanded={isOpen}
        aria-controls="mobile-more-sheet"
        onClick={() => (isOpen ? dismiss() : setIsOpen(true))}
        className="flex items-center justify-center rounded-lg border border-white/10 bg-white/5 p-2 text-white/60 transition hover:border-white/25 hover:text-white md:hidden"
      >
        <MoreHorizontal className="h-5 w-5" />
      </button>
      <MobileMoreSheet isOpen={isOpen} onDismiss={dismiss} />
    </>
  )
}
