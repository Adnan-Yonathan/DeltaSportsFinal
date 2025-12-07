'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Loader2, Paperclip, Mic, MicOff, Globe2, ChevronDown } from 'lucide-react'

interface MessageInputProps {
  conversationId: string
  userId: string
  mode: 'regular' | 'live' | 'research' | 'statmuse'
  onModeChange: (mode: 'regular' | 'live' | 'research' | 'statmuse') => void
}

export default function ModernMessageInput({ conversationId, userId, mode, onModeChange }: MessageInputProps) {
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [isMicSupported, setIsMicSupported] = useState(true)
  const [webSearchEnabled, setWebSearchEnabled] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const modeDropdownRef = useRef<HTMLDivElement | null>(null)
  const MAX_RECORDING_DURATION = 60000 // 60 seconds

  // Check browser compatibility on mount
  useEffect(() => {
    const isSupported =
      typeof MediaRecorder !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
    setIsMicSupported(isSupported)

    // Cleanup on unmount
    return () => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop()
      }
      if (recordingTimerRef.current) {
        clearTimeout(recordingTimerRef.current)
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

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

  const syncTextareaHeight = () => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
  }

  const appendTranscription = (text: string) => {
    setMessage((prev) => (prev ? `${prev} ${text}` : text))
    // Sync height after appending
    setTimeout(syncTextareaHeight, 0)
  }

  const uploadRecording = async (blob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append('file', blob, 'recording.webm')

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Transcription failed')
      }

      const result = await response.json()
      if (result.text) {
        appendTranscription(result.text.trim())
      }
    } catch (error: any) {
      console.error('Transcription error:', error)
      alert(`Failed to transcribe audio: ${error.message}`)
    } finally {
      setIsTranscribing(false)
    }
  }

  const startRecording = async () => {
    if (!isMicSupported) {
      alert('Voice recording is not supported in your browser.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      const chunks: BlobPart[] = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data)
      }

      mediaRecorder.onstop = () => {
        const recorded = new Blob(chunks, { type: 'audio/webm' })
        stream.getTracks().forEach((track) => track.stop())
        uploadRecording(recorded)

        // Clear timers
        if (recordingTimerRef.current) {
          clearTimeout(recordingTimerRef.current)
          recordingTimerRef.current = null
        }
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current)
          durationIntervalRef.current = null
        }
        setRecordingDuration(0)
      }

      recorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)

      // Start duration counter
      const startTime = Date.now()
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(Date.now() - startTime)
      }, 100)

      // Auto-stop after max duration
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorder.state === 'recording') {
          mediaRecorder.stop()
          setIsRecording(false)
        }
      }, MAX_RECORDING_DURATION)
    } catch (error: any) {
      console.error('Microphone access denied:', error)
      alert('Microphone access denied. Please grant permission to use voice input.')
      setIsRecording(false)
    }
  }

  const stopRecording = () => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop()
      setIsRecording(false)
    }
  }

  const handleMicClick = () => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }

  const sendMessage = useCallback(async (override?: string) => {
    const basePayload = (override ?? message).trim()
    if (!basePayload || sending) return

    const payload = webSearchEnabled ? `enable web search: ${basePayload}` : basePayload

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

      const endpoint = mode === 'statmuse' ? '/api/chat/statmuse' : '/api/chat'

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: payload,
          conversationId,
          userId,
          timezone: userTimezone,
          mode,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          // Decode and log the chunk for debugging
          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            // Stream is being consumed (messages update via Supabase realtime)
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error)

      let errorMessage = 'Failed to send message. Please try again.'

      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The message may still be processing. Please check your conversation.'
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network and try again.'
      } else if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Please check your connection and try again.'
      }

      alert(errorMessage)

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
  }, [conversationId, message, sending, userId, webSearchEnabled, mode])

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
    <div className="border-t border-[#6b6b6b] bg-[#3f3f3f]/90 backdrop-blur-xl p-2 sm:p-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          animate={{
            boxShadow: isFocused
              ? '0 0 0 2px rgba(52, 211, 153, 0.35)'
              : '0 0 0 0px rgba(52, 211, 153, 0)',
          }}
          className="relative flex items-end gap-2 sm:gap-3 rounded-2xl bg-[#4a4a4a] border border-[#6b6b6b] p-2 sm:p-3 transition-all"
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
            {/* Voice Input Button */}
            {isMicSupported && (
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleMicClick}
                disabled={sending || isTranscribing}
                className={`p-2.5 sm:p-2 rounded-lg transition-all ${
                  isRecording
                    ? 'bg-red-500/20 text-red-400 animate-pulse'
                    : isTranscribing
                      ? 'bg-[#5c5c5c] text-white/40 cursor-not-allowed'
                      : 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                }`}
                title={
                  isRecording
                    ? 'Stop recording'
                    : isTranscribing
                      ? 'Transcribing...'
                      : 'Start voice recording'
                }
              >
                {isTranscribing ? (
                  <Loader2 className="w-5 h-5 sm:w-4 sm:h-4 animate-spin" />
                ) : isRecording ? (
                  <MicOff className="w-5 h-5 sm:w-4 sm:h-4" />
                ) : (
                  <Mic className="w-5 h-5 sm:w-4 sm:h-4" />
                )}
              </motion.button>
            )}

            {/* Mode Dropdown */}
            <div className="relative" ref={modeDropdownRef}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setModeDropdownOpen((prev) => !prev)}
                disabled={sending}
                className="px-3 py-2 sm:px-2.5 sm:py-2 rounded-lg transition-all bg-[#34d399]/15 border border-[#34d399]/40 text-white hover:bg-[#34d399]/25 hover:border-[#34d399]/60 flex items-center gap-1.5"
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
                    className="absolute bottom-full mb-2 left-0 w-56 rounded-xl border border-[#6b6b6b] bg-[#3f3f3f] shadow-2xl z-50 overflow-hidden"
                  >
                    <div className="py-1">
                      <button
                        onClick={() => {
                          onModeChange('regular')
                          setModeDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          mode === 'regular'
                          ? 'bg-[#34d399]/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                      >
                        <div className="font-semibold text-sm">Regular</div>
                        <div className="text-xs text-white/60 mt-0.5">Balanced chat with quick answers</div>
                      </button>
                      <button
                        onClick={() => {
                          onModeChange('live')
                          setModeDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          mode === 'live'
                          ? 'bg-[#34d399]/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
                      }`}
                      >
                        <div className="font-semibold text-sm">Live odds/props</div>
                        <div className="text-xs text-white/60 mt-0.5">Prioritize fresh odds & player props</div>
                      </button>
                      <button
                        onClick={() => {
                          onModeChange('research')
                          setModeDropdownOpen(false)
                        }}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      mode === 'research'
                        ? 'bg-[#34d399]/20 text-white'
                        : 'text-white/80 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-semibold text-sm">Research</div>
                    <div className="text-xs text-white/60 mt-0.5">Allow deeper scans (may take longer)</div>
                  </button>
                      <button
                        onClick={() => {
                          onModeChange('statmuse')
                          setModeDropdownOpen(false)
                        }}
                        className={`w-full px-4 py-3 text-left transition-colors ${
                          mode === 'statmuse'
                          ? 'bg-[#34d399]/20 text-white'
                          : 'text-white/80 hover:bg-white/10'
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

            {/* Web Search Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setWebSearchEnabled((prev) => !prev)}
              disabled={sending}
              className={`p-2.5 sm:p-2 rounded-lg transition-all border ${
                webSearchEnabled
                  ? 'bg-[#34d399]/20 border-[#34d399]/50 text-white shadow-inner shadow-[#34d399]/30'
                  : 'bg-[#4a4a4a] border-[#6b6b6b] text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              title="Toggle web search for research mode"
              aria-pressed={webSearchEnabled}
            >
              <Globe2 className="w-5 h-5 sm:w-4 sm:h-4" />
            </motion.button>

            {/* Send Button */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => void sendMessage()}
              disabled={!message.trim() || sending}
              className={`p-2.5 sm:p-2 rounded-lg transition-all ${
                message.trim() && !sending
                  ? 'bg-[#34d399] hover:bg-[#16a34a] text-[#0f1f15] shadow-lg shadow-[#34d399]/30'
                  : 'bg-[#5c5c5c] text-white/40 cursor-not-allowed'
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

        {/* Recording Duration Indicator */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mt-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/20 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span className="text-xs text-red-400 font-medium">
                  Recording {Math.floor(recordingDuration / 1000)}s / {MAX_RECORDING_DURATION / 1000}s
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcribing Indicator */}
        <AnimatePresence>
          {isTranscribing && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center mt-2"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                <span className="text-xs text-emerald-400 font-medium">
                  Transcribing audio...
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!isRecording && !isTranscribing && (
          <div className="hidden sm:block text-xs text-white/40 mt-2 text-center">
            Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Enter</kbd> to send ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢{' '}
            <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Shift + Enter</kbd> for new line
            {isMicSupported && (
              <>
                {' ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢ '}
                <span className="inline-flex items-center gap-1">
                  <Mic className="w-3 h-3 inline" />
                  Voice input available
                </span>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
