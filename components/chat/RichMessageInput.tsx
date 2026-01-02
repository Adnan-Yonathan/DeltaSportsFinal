'use client'

import { useState, useRef, useEffect, useCallback, KeyboardEvent } from 'react'
import { motion } from 'framer-motion'
import { Send, Loader2 } from 'lucide-react'
import { TeamAutocomplete } from './TeamAutocomplete'
import { TeamPill } from './TeamPill'
import { QuerySuggestions } from './QuerySuggestions'
import { searchTeams, hasMultipleSportMatches } from '@/lib/data/team-search'
import { getSuggestions, buildSuggestionContext } from '@/lib/data/query-suggestions'
import type { QuerySuggestion } from '@/lib/data/suggestion-patterns'
import type { TeamRecord, TaggedTeam } from '@/lib/types/teams'
import type { CanonicalSportKey } from '@/lib/identity/sport'

interface RichMessageInputProps {
  conversationId: string
  userId: string
}

interface TaggedTeamWithMeta extends TaggedTeam {
  team: TeamRecord
}

export default function RichMessageInput({ conversationId, userId }: RichMessageInputProps) {
  const [message, setMessage] = useState('')
  const [taggedTeams, setTaggedTeams] = useState<TaggedTeamWithMeta[]>([])
  const [sending, setSending] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [autocompleteVisible, setAutocompleteVisible] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [autocompleteAnchor, setAutocompleteAnchor] = useState<DOMRect | null>(null)
  const [cursorPosition, setCursorPosition] = useState(0)

  // Query suggestions state
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [suggestionsAnchor, setSuggestionsAnchor] = useState<DOMRect | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const syncTextareaHeight = () => {
    if (!textareaRef.current) return
    textareaRef.current.style.height = 'auto'
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
  }

  // Detect team name patterns and show autocomplete OR query suggestions
  useEffect(() => {
    if (!message || !isFocused) {
      setAutocompleteVisible(false)
      setSuggestionsVisible(false)
      return
    }

    const beforeCursor = message.slice(0, cursorPosition)
    const words = beforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1] || ''

    // Helper to get anchor rect
    const getAnchorRect = (): DOMRect | null => {
      if (textareaRef.current && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect()
        return {
          top: containerRect.top,
          bottom: containerRect.bottom,
          left: containerRect.left,
          right: containerRect.right,
          width: containerRect.width,
          height: containerRect.height,
          x: containerRect.x,
          y: containerRect.y,
          toJSON: () => ({}),
        }
      }
      return null
    }

    // First, check for team matches (higher priority for entity completion)
    if (currentWord.length >= 2) {
      const teamResults = searchTeams(currentWord, { limit: 1 })
      if (teamResults.length > 0) {
        setAutocompleteQuery(currentWord)
        setAutocompleteVisible(true)
        setSuggestionsVisible(false) // Hide suggestions when team autocomplete shows
        setAutocompleteAnchor(getAnchorRect())
        return
      }
    }

    // No team match - check for query suggestions
    // Show suggestions based on full message context (not just current word)
    if (message.length >= 2) {
      const context = buildSuggestionContext(message, taggedTeams)
      const suggestions = getSuggestions(message, context, 1)
      if (suggestions.length > 0) {
        setSuggestionsVisible(true)
        setAutocompleteVisible(false)
        setSuggestionsAnchor(getAnchorRect())
        return
      }
    }

    // No matches found
    setAutocompleteVisible(false)
    setSuggestionsVisible(false)
  }, [message, cursorPosition, isFocused, taggedTeams])

  const handleTeamSelect = useCallback((team: TeamRecord) => {
    const beforeCursor = message.slice(0, cursorPosition)
    const afterCursor = message.slice(cursorPosition)

    // Find the word being replaced
    const words = beforeCursor.split(/\s+/)
    const currentWord = words[words.length - 1] || ''
    const wordStart = beforeCursor.lastIndexOf(currentWord)

    // Replace current word with team name
    const newBeforeCursor = beforeCursor.slice(0, wordStart)
    const teamMarker = `[${team.abbreviation}]` // Placeholder in text
    const newMessage = newBeforeCursor + teamMarker + ' ' + afterCursor.trimStart()

    // Calculate positions
    const position = {
      start: wordStart,
      end: wordStart + teamMarker.length,
    }

    // Check for duplicates and multiple sports
    const showBadge = hasMultipleSportMatches(autocompleteQuery)

    const newTaggedTeam: TaggedTeamWithMeta = {
      id: team.id,
      name: team.name,
      displayName: team.abbreviation,
      sport: team.sport,
      position,
      team,
    }

    setTaggedTeams((prev) => [...prev, newTaggedTeam])
    setMessage(newMessage)
    setCursorPosition(position.end + 1)
    setAutocompleteVisible(false)

    // Refocus textarea
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = position.end + 1
        textareaRef.current.setSelectionRange(newPos, newPos)
      }
    }, 0)
  }, [message, cursorPosition, autocompleteQuery])

  const handleRemoveTeam = useCallback((index: number) => {
    const teamToRemove = taggedTeams[index]
    if (!teamToRemove) return

    // Remove the marker from message
    const marker = `[${teamToRemove.displayName}]`
    const newMessage = message.replace(marker, '').replace(/\s+/g, ' ').trim()

    setMessage(newMessage)
    setTaggedTeams((prev) => prev.filter((_, i) => i !== index))
  }, [taggedTeams, message])

  // Handle query suggestion selection
  const handleSuggestionSelect = useCallback((suggestion: QuerySuggestion) => {
    // Append the suggestion phrase to the current message
    const trimmedMessage = message.trimEnd()
    const newMessage = trimmedMessage + (trimmedMessage ? ' ' : '') + suggestion.phrase

    setMessage(newMessage)
    setSuggestionsVisible(false)

    // Refocus textarea and move cursor to end
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        const newPos = newMessage.length
        textareaRef.current.setSelectionRange(newPos, newPos)
        setCursorPosition(newPos)
      }
    }, 0)
  }, [message])

  const getPlainTextMessage = useCallback(() => {
    // Replace team markers with team names for the actual message
    let plainMessage = message
    for (const tagged of taggedTeams) {
      const marker = `[${tagged.displayName}]`
      plainMessage = plainMessage.replace(marker, tagged.name)
    }
    return plainMessage.trim()
  }, [message, taggedTeams])

  const sendMessage = useCallback(async (override?: string) => {
    const plainMessage = override ?? getPlainTextMessage()
    if (!plainMessage || sending) return

    setSending(true)
    setMessage('')
    setTaggedTeams([])
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }

    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone

    // Prepare tagged teams for API (without the team object)
    const apiTaggedTeams = taggedTeams.map(({ team, ...rest }) => rest)

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 300000)

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: plainMessage,
          conversationId,
          userId,
          timezone: userTimezone,
          taggedTeams: apiTaggedTeams.length > 0 ? apiTaggedTeams : undefined,
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
      if (reader) {
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          if (value) {
            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n')
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const dataStr = line.slice(6)
                try {
                  const data = JSON.parse(dataStr)
                  if (data.type === 'status' && data.operation) {
                    const event = new CustomEvent('chat-operation-change', {
                      detail: { operation: data.operation }
                    })
                    window.dispatchEvent(event)
                  }
                } catch (e) {
                  // Skip non-JSON lines
                }
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error sending message:', error)

      let errorMessage = 'Failed to send message. Please try again.'
      let shouldRedirectToPricing = false

      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. The message may still be processing.'
      } else if (!navigator.onLine) {
        errorMessage = 'No internet connection. Please check your network.'
      } else if (error.status === 401) {
        errorMessage = 'Please sign in to send messages.'
        shouldRedirectToPricing = true
      } else if (error.status === 403) {
        errorMessage = error.message || 'Subscription required to continue.'
        shouldRedirectToPricing = true
      } else if (error.status === 429) {
        errorMessage = error.message || 'Daily message limit reached.'
        shouldRedirectToPricing = true
      } else if (error.message) {
        errorMessage = error.message
      }

      alert(errorMessage)

      if (shouldRedirectToPricing) {
        window.location.href = '/pricing'
      }

      if (error.name === 'AbortError') {
        setMessage(plainMessage)
      }
    } finally {
      setSending(false)
    }
  }, [conversationId, userId, sending, taggedTeams, getPlainTextMessage])

  const latestSendMessage = useRef(sendMessage)
  useEffect(() => {
    latestSendMessage.current = sendMessage
  }, [sendMessage])

  // Handle quick prompt events
  useEffect(() => {
    if (typeof window === 'undefined') return

    type PromptDetail = string | { text: string; autoSend?: boolean; conversationId?: string }

    const handler = (event: Event) => {
      const custom = event as CustomEvent<PromptDetail>
      const detail = custom.detail

      const incomingText = typeof detail === 'string' ? detail : detail?.text
      const autoSend = typeof detail === 'object' && detail?.autoSend
      const targetConversationId = typeof detail === 'object' ? detail?.conversationId : undefined

      if (!incomingText) return
      if (targetConversationId && targetConversationId !== conversationId) return

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
    return () => window.removeEventListener('delta-quick-prompt', handler as EventListener)
  }, [conversationId])

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Don't send if autocomplete is visible (let it handle navigation)
    if (autocompleteVisible) {
      if (['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
        return // Let TeamAutocomplete handle these
      }
    }

    // Let QuerySuggestions handle keyboard navigation
    if (suggestionsVisible) {
      if (['ArrowUp', 'ArrowDown', 'Tab', 'Escape'].includes(e.key)) {
        return // Let QuerySuggestions handle these
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendMessage()
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
    setCursorPosition(e.target.selectionStart || 0)
    syncTextareaHeight()
  }

  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    setCursorPosition(target.selectionStart || 0)
  }

  // Check if we need to show sport badges for tagged teams
  const showSportBadges = taggedTeams.length > 1 &&
    new Set(taggedTeams.map(t => t.sport)).size > 1

  return (
    <div className="border-t border-[#1f1f1f] bg-black/90 backdrop-blur-xl p-1.5 sm:p-4">
      <div className="max-w-4xl mx-auto">
        {/* Tagged teams display */}
        {taggedTeams.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {taggedTeams.map((tagged, index) => (
              <TeamPill
                key={`${tagged.sport}-${tagged.id}-${index}`}
                team={tagged.team}
                onRemove={() => handleRemoveTeam(index)}
                showSportBadge={showSportBadges}
                size="sm"
              />
            ))}
          </div>
        )}

        <div ref={containerRef} className="relative">
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
                onSelect={handleSelect}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                  setIsFocused(false)
                  // Delay hiding dropdowns to allow click selection
                  setTimeout(() => {
                    setAutocompleteVisible(false)
                    setSuggestionsVisible(false)
                  }, 200)
                }}
                placeholder="Ask about teams, stats, odds... Type a team name to tag it"
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
                onClick={() => void sendMessage()}
                disabled={!getPlainTextMessage() || sending}
                className={`p-1.5 sm:p-2 rounded-md sm:rounded-lg transition-all ${
                  getPlainTextMessage() && !sending
                    ? 'bg-[#34d399] hover:bg-[#16a34a] text-[#0f1f15] shadow-lg shadow-[#34d399]/30'
                    : 'bg-[#5c5c5c] text-white/40 cursor-not-allowed'
                }`}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </motion.button>
            </div>
          </motion.div>

          {/* Team autocomplete dropdown */}
          <TeamAutocomplete
            query={autocompleteQuery}
            visible={autocompleteVisible}
            onSelect={handleTeamSelect}
            onClose={() => setAutocompleteVisible(false)}
            anchorRect={autocompleteAnchor}
          />

          {/* Query suggestions dropdown */}
          <QuerySuggestions
            input={message}
            visible={suggestionsVisible}
            onSelect={handleSuggestionSelect}
            onClose={() => setSuggestionsVisible(false)}
            anchorRect={suggestionsAnchor}
            taggedTeams={taggedTeams}
          />
        </div>

        <div className="hidden sm:block text-xs text-white/40 mt-2 text-center">
          Type a team name to tag it · Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white/60">Enter</kbd> to send
        </div>
      </div>
    </div>
  )
}
