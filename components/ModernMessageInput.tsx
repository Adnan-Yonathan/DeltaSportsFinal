'use client'

import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2, Paperclip } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
  userId: string
}

export default function ModernMessageInput({ conversationId, userId }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handler = (event: Event) => {
      const custom = event as CustomEvent<string>
      if (typeof custom.detail === 'string') {
        setMessage(custom.detail)
        requestAnimationFrame(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
            textareaRef.current.focus()
          }
        })
      }
    }

    window.addEventListener('delta-quick-prompt', handler as EventListener)
    return () => {
      window.removeEventListener('delta-quick-prompt', handler as EventListener)
    }
  }, [])

  const handleSend = async () => {
    if (!message.trim() || sending) return

    const userMessage = message.trim()
    setMessage('')
    setSending(true)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    // Detect user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId,
          userId,
          timezone: userTimezone,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }

  return (
    <div className="border-t border-white/5 bg-black/60 backdrop-blur-xl p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px rgba(99, 102, 241, 0.3)'
              : '0 0 0 0px rgba(99, 102, 241, 0)',
          }}
          className="relative flex items-end gap-2 sm:gap-3 rounded-2xl bg-white/5 border border-white/10 p-2 sm:p-3 transition-all"
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask about odds, arbitrage, or log a bet..."
              className="w-full bg-transparent text-white text-sm placeholder:text-white/40 focus:outline-none resize-none"
              rows={1}
              disabled={sending}
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={handleSend}
              disabled={!message.trim() || sending}
              className={`p-2.5 sm:p-2 rounded-lg transition-all ${
                message.trim() && !sending
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20'
                  : 'bg-white/5 text-white/30 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-5 h-5 sm:w-4 sm:h-4" />
              )}
            </motion.button>
          </div>
        </motion.div>

        <div className="hidden sm:block text-xs text-white/40 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Enter</kbd> to send •{' '}
          <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Shift + Enter</kbd> for new line
        </div>
      </div>
    </div>
  )
}
