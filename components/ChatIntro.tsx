'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { ChevronDown } from 'lucide-react'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
  mode: 'regular' | 'live' | 'research' | 'statmuse'
  onModeChange: (mode: 'regular' | 'live' | 'research' | 'statmuse') => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent, mode, onModeChange }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const modeDropdownRef = useRef<HTMLDivElement | null>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modeDropdownRef.current && !modeDropdownRef.current.contains(event.target as Node)) {
        setModeDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if (!message || sending) return

    setSending(true)

    try {
      const endpoint = mode === 'statmuse' ? '/api/chat/statmuse' : '/api/chat'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          userId,
          mode,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Clear the textarea
      if (textarea) {
        textarea.value = ''
      }

      // Read the response stream first
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Wait a bit for the database to update, then trigger the callback
      await new Promise(resolve => setTimeout(resolve, 300))

      // Trigger the callback to indicate message was sent
      onMessageSent()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-full bg-black px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl w-full -mt-20"
      >
        <h2 className="text-3xl font-bold text-white mb-4">
          How can I help you today?
        </h2>
        <p className="text-white/60 mb-8">
          Get real-time stats, compare odds, analyze betting lines, track your bankroll,
          and discover value plays across all major sports.
        </p>

        <form onSubmit={handleSubmit} className="w-full relative">
          <PromptBox name="message" disabled={sending} />

          {/* Mode Dropdown - positioned absolutely over the PromptBox, left side */}
          <div className="absolute bottom-3 left-14 z-10" ref={modeDropdownRef}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setModeDropdownOpen((prev) => !prev)}
              disabled={sending}
              className="px-3 py-2 rounded-lg transition-all bg-indigo-500/10 border border-indigo-500/30 text-white hover:bg-indigo-500/20 hover:border-indigo-500/50 flex items-center gap-1.5"
              title="Select mode"
            >
              <span className="text-xs font-semibold">
                {mode === 'regular' ? 'Regular' : mode === 'live' ? 'Live' : mode === 'research' ? 'Research' : 'Statmuse'}
              </span>
              <ChevronDown className="w-3.5 h-3.5" />
            </motion.button>

            <AnimatePresence>
              {modeDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute bottom-full mb-2 left-0 w-56 rounded-xl border border-white/10 bg-[#0f132d] shadow-2xl overflow-hidden"
                >
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        onModeChange('regular')
                        setModeDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        mode === 'regular'
                          ? 'bg-indigo-500/20 text-white'
                          : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-sm">Regular</div>
                      <div className="text-xs text-white/60 mt-0.5">Balanced chat with quick answers</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onModeChange('live')
                        setModeDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        mode === 'live'
                          ? 'bg-indigo-500/20 text-white'
                          : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-sm">Live odds/props</div>
                      <div className="text-xs text-white/60 mt-0.5">Prioritize fresh odds & player props</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onModeChange('research')
                        setModeDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        mode === 'research'
                          ? 'bg-indigo-500/20 text-white'
                          : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                        <div className="font-semibold text-sm">Research</div>
                        <div className="text-xs text-white/60 mt-0.5">Allow deeper scans (may take longer)</div>
                      </button>
                    <button
                      type="button"
                      onClick={() => {
                        onModeChange('statmuse')
                        setModeDropdownOpen(false)
                      }}
                      className={`w-full px-4 py-3 text-left transition-colors ${
                        mode === 'statmuse'
                          ? 'bg-indigo-500/20 text-white'
                          : 'text-white/80 hover:bg-white/5'
                      }`}
                    >
                      <div className="font-semibold text-sm">Statmuse</div>
                      <div className="text-xs text-white/60 mt-0.5">Stats-only Q&A (NBA/NFL style)</div>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
