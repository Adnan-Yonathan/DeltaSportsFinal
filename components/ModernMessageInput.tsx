'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
  userId: string
}

export default function ModernMessageInput({ conversationId, userId }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const syncTextareaHeight = () => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
  }

  const sendMessage = useCallback(async (override?: string) => {
    const basePayload = (override ?? message).trim()
    if (!basePayload || sending) return

    const payload = basePayload

    setSending(true)
    setMessage('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    try {
      // Add timeout to prevent hanging
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000) // 5 minute timeout

      // All queries go to the unified /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: payload,
          conversationId,
          userId,
          timezone: userTimezone,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        const error = new Error(errorData.error || 'Failed to send message') as Error & { status?: number }
        error.status = response.status
        throw error
      }

      const reader = response.body?.getReader()
      let streamedResponse = ''
      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            const chunk = decoder.decode(value, { stream: true })

            // Parse SSE events to detect status updates
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6).trim()
                if (dataStr === '[DONE]') {
                  continue
                }
                try {
                  const data = JSON.parse(dataStr)
                  console.log('[ModernMessageInput] Received SSE event:', data)

                  if (typeof data.content === 'string' && data.content.length) {
                    streamedResponse += data.content
                  }

                  // Handle status events for dynamic operation messages        
                  if (data.type === 'status' && data.operation) {
                    console.log('[ModernMessageInput] Dispatching operation change:', data.operation)
                    // Dispatch custom event for ModernMessageList to listen to 
                    const event = new CustomEvent('chat-operation-change', {    
                      detail: { operation: data.operation }
                    })
                    window.dispatchEvent(event)
                  }
                  // Content events are handled by Supabase realtime
                } catch (e) {
                  // Skip non-JSON lines (like keep-alive)
                }
              }
            }
          }
        }
        const event = new CustomEvent('chat-stream-complete', {
          detail: {
            conversationId,
            content: streamedResponse.trim(),
          },
        })
        window.dispatchEvent(event)
      }
    } catch (error: any) {
      console.error('Error sending message:', error)

      let errorMessage = 'Failed to send message. Please try again.'
      let shouldRedirectToPricing = false

      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The message may still be processing. Please check your conversation.'
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network and try again.'
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      } else if (error.status === 401) {
        errorMessage = 'Please sign in to send messages.'
        shouldRedirectToPricing = true
      } else if (error.status === 403) {
        // Free message used or subscription required
        errorMessage = error.message || 'Subscription required to continue. Upgrade your plan to keep chatting!'
        shouldRedirectToPricing = true
      } else if (error.status === 429) {
        // Rate limit reached (Pro tier)
        errorMessage = error.message || 'Daily message limit reached. Upgrade to Sharp or Syndicate for unrestricted access!'
        shouldRedirectToPricing = true
      } else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)

      if (shouldRedirectToPricing) {
        window.location.href = '/pricing'
      }

      // Restore message if send failed
      if (error.name === 'AbortError') {
        setMessage(payload)
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
          }
        }, 0)
      }
    } finally {
      setSending(false)
    }
  }, [conversationId, message, sending, userId])

  const latestSendMessage = useRef(sendMessage)
  useEffect(() => {
    latestSendMessage.current = sendMessage
  }, [sendMessage])

  useEffect(() => {
    if (typeof window === 'undefined') return

    type PromptDetail =
      | string
      | {
          text: string
          autoSend?: boolean
          conversationId?: string
        }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<PromptDetail>
      const detail = custom.detail

      const incomingText =
        typeof detail === 'string'
          ? detail
          : typeof detail === 'object'
            ? detail.text
            : undefined
      const autoSend =
        typeof detail === 'object' && detail?.autoSend ? true : false
      const targetConversationId =
        typeof detail === 'object' && detail?.conversationId
          ? detail.conversationId
          : undefined

      if (!incomingText) return
      if (targetConversationId && targetConversationId !== conversationId) {
        return
      }

      setMessage(incomingText)
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto'
          textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
          textareaRef.current.focus()
        }
        if (autoSend) {
          requestAnimationFrame(() => {
            void latestSendMessage.current(incomingText)
          })
        }
      })
    }

    window.addEventListener('delta-quick-prompt', handler as EventListener)
    return () => {
      window.removeEventListener('delta-quick-prompt', handler as EventListener)
    }
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    syncTextareaHeight()
  }

  return (
    <div className="border-t border-[#1f1f1f] bg-black/90 backdrop-blur-xl p-1.5 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px rgba(52, 211, 153, 0.35)'
              : '0 0 0 0px rgba(52, 211, 153, 0)',
          }}
          className="relative flex items-end gap-1.5 sm:gap-3 rounded-xl sm:rounded-2xl bg-[#0f0f0f] border border-[#1f1f1f] p-1.5 sm:p-3 transition-all"
        >
          <div className="flex-1">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask anything about sports stats, betting, odds..."
              className="w-full bg-transparent text-white text-sm placeholder:text-white/40 focus:outline-none resize-none"
              rows={1}
              disabled={sending}
              style={{ minHeight: '24px', maxHeight: '200px' }}
            />
          </div>

          <div className="flex items-center gap-2">
            {/* Send Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => void sendMessage()}
              disabled={!message.trim() || sending}
              className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all ${
                message.trim() && !sending
                  ? 'bg-[#34d399] hover:bg-[#16a34a] text-[#0f1f15] shadow-lg shadow-[#34d399]/30'
                  : 'bg-[#5c5c5c] text-white/40 cursor-not-allowed'
              }`}
            >
              {sending ? (
                <Loader2 className="w-4 h-4 sm:w-4 sm:h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4 sm:w-4 sm:h-4" />
              )}
            </motion.button>
          </div>
        </motion.div>
        <div className="hidden sm:block text-xs text-white/40 mt-2 text-center">
          Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Enter</kbd> to send. <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Shift + Enter</kbd> for new line.
        </div>
      </div>
    </div>
  )
}



