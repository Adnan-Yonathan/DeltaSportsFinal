'use client'

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { UserPlus } from 'lucide-react'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { QuerySuggestions } from '@/components/chat/QuerySuggestions'
import { getSuggestions, buildSuggestionContext } from '@/lib/data/query-suggestions'
import type { QuerySuggestion } from '@/lib/data/suggestion-patterns'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { TopPerformancesStrip } from '@/components/ui/top-performances'
import { AnimatedHero } from '@/components/ui/animated-hero'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
  isGuest?: boolean
  onSignUpClick?: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent, isGuest = false, onSignUpClick }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false)

  // Query suggestions state
  const [inputValue, setInputValue] = useState('')
  const [suggestionsVisible, setSuggestionsVisible] = useState(false)
  const [suggestionsAnchor, setSuggestionsAnchor] = useState<DOMRect | null>(null)
  const formRef = useRef<HTMLFormElement>(null)

  // Update suggestions when input changes
  useEffect(() => {
    if (inputValue.length < 2) {
      setSuggestionsVisible(false)
      return
    }

    const context = buildSuggestionContext(inputValue)
    const suggestions = getSuggestions(inputValue, context, 1)

    if (suggestions.length > 0 && formRef.current) {
      const rect = formRef.current.getBoundingClientRect()
      setSuggestionsAnchor({
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
        x: rect.x,
        y: rect.y,
        toJSON: () => ({}),
      })
      setSuggestionsVisible(true)
    } else {
      setSuggestionsVisible(false)
    }
  }, [inputValue])

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: QuerySuggestion) => {
    const textarea = formRef.current?.querySelector('textarea')
    if (textarea) {
      const trimmed = inputValue.trimEnd()
      const newValue = trimmed + (trimmed ? ' ' : '') + suggestion.phrase

      // Use native setter to update value
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value'
      )?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(textarea, newValue)
      }
      // Dispatch input event so React picks up the change
      const inputEvent = new Event('input', { bubbles: true })
      textarea.dispatchEvent(inputEvent)

      setInputValue(newValue)
      textarea.focus()
    }
    setSuggestionsVisible(false)
  }

  // Track input value changes
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // If guest, redirect to sign up
    if (isGuest && onSignUpClick) {
      onSignUpClick()
      return
    }

    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if (!message || sending) return

    setSending(true)

    try {
      // All queries go to the unified /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          userId,
          capability: selectedCapability,
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
      setSelectedCapability(null)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-3 sm:px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full mb-4 sm:mb-6"
      >
        <AnimatedHero
          staticText="Make money with"
          interval={2500}
        />
      </motion.div>

      <div className="w-full max-w-5xl mx-auto mb-4 sm:mb-6">
        <TopPerformancesStrip />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full"
      >
        <form ref={formRef} onSubmit={handleSubmit} className="w-full relative">
          {isGuest ? (
            <button
              type="button"
              onClick={onSignUpClick}
              className="w-full p-4 rounded-2xl bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 hover:border-emerald-400/50 transition-all group"
            >
              <div className="flex items-center justify-center gap-3">
                <UserPlus className="w-5 h-5 text-emerald-400" />
                <span className="text-white font-medium">Sign up to start chatting</span>
              </div>
              <p className="text-white/50 text-sm mt-2">Create a free account to ask questions about odds, stats, and betting analysis</p>
            </button>
          ) : (
            <PromptBox name="message" disabled={sending} onChange={handleInputChange} />
          )}

          {/* Query suggestions dropdown */}
          <QuerySuggestions
            input={inputValue}
            visible={suggestionsVisible && !isGuest}
            onSelect={handleSuggestionSelect}
            onClose={() => setSuggestionsVisible(false)}
            anchorRect={suggestionsAnchor}
          />
        </form>

        {/* Capabilities */}
        <div className="mt-3 w-full">
          <button
            type="button"
            onClick={() => setCapabilitiesOpen((prev) => !prev)}
            className="md:hidden w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs font-semibold text-white/80 flex items-center justify-between"
            aria-expanded={capabilitiesOpen}
          >
            <span>Prompt shortcuts</span>
            <span className="text-[11px] text-emerald-300">{capabilitiesOpen ? "Hide" : "Show"}</span>
          </button>
          <div
            className={`grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 auto-rows-fr overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out ${
              capabilitiesOpen
                ? "mt-2 max-h-[1200px] opacity-100 translate-y-0"
                : "mt-0 max-h-0 opacity-0 -translate-y-1 pointer-events-none"
            } md:mt-2 md:max-h-none md:opacity-100 md:translate-y-0 md:pointer-events-auto md:overflow-visible`}
          >
            {[
            {
              id: "player_profiles",
              title: "Player Profiles",
              description: "Access player stats, advanced metrics, and projections vs specific teams",
              detail: `PLAYER PROFILES - Get detailed player stats, advanced metrics, and matchup context.

What it does: Returns season averages, advanced stats (TS%, usage, etc.), recent form (last 5-10 games), and performance vs specific opponents.

Example queries:
• "LeBron James stats"
• "Jayson Tatum profile vs Celtics"
• "Wemby season averages and recent form"
• "Anthony Edwards advanced stats"`
            },
            {
              id: "team_profiles",
              title: "Team Profiles",
              description: "Get comprehensive team stats, trends, and performance metrics",
              detail: `TEAM PROFILES - Get comprehensive team stats, ratings, and betting trends.

What it does: Returns basic stats (PPG, rebounds, assists), advanced metrics (pace, offensive/defensive ratings, net rating), recent form, and ATS/O-U trends.

Example queries:
• "Lakers team stats"
• "Thunder offensive rating and pace"
• "Celtics defensive stats"
• "Heat team profile with ATS record"`
            },
            {
              id: "line_shopping",
              title: "Line Shopping",
              description: "Compare lines from every major US sportsbook for any sporting event",
              detail: `LINE SHOPPING - Compare odds across all major US sportsbooks.

What it does: Fetches spread, moneyline, total, and player prop lines from DraftKings, FanDuel, BetMGM, Caesars, and more. Shows best available price and book-by-book comparison.

Example queries:
• "Lakers vs Celtics odds"
• "Best line for Heat spread"
• "Shop Curry points prop"
• "Compare Thunder moneyline across books"`
            },
            {
              id: "cross_market_ev",
              title: "Cross Market EV",
              description: "Find +EV plays where sportsbooks disagree on odds",
              detail: `CROSS MARKET EV - Find positive expected value opportunities.

What it does: Scans betting markets to find plays where one sportsbook offers significantly better odds than the market consensus. Calculates EV% based on implied probability differences.

Example queries:
• "Cross market EV opportunities"
• "Show me +EV plays"
• "Where do sportsbooks disagree on odds"
• "Find value bets tonight"`
            },
            {
              id: "live_betting",
              title: "Live Betting",
              description: "AI-projected live spreads based on game flow, momentum, and in-game factors",
              detail: `LIVE BETTING - Get AI-projected lines for games in progress.

What it does: Calculates fair live spreads and totals using current score, time remaining, pace, and momentum factors. Compares projections to live odds to find edges.

Example queries:
• "Live projections"
• "In-game betting lines"
• "Live betting Lakers game"
• "Current fair spread for the Celtics game"`
            },
            {
              id: "betting_trends",
              title: "Betting Trends",
              description: "Recent records vs spreads, prop covers, and public/sharp money splits",
              detail: `BETTING TRENDS - Track ATS records, O/U trends, and money splits.

What it does: Shows team records against the spread, over/under trends (last 5/10 games, home/away, favorite/underdog), and public vs sharp betting percentages when available.

Example queries:
• "Lakers ATS record"
• "Public vs sharp money on Heat vs Celtics"
• "Betting splits for Thunder game"
• "Which teams cover as underdogs"`
            },
            {
              id: "combo_analysis",
              title: "Combo Analysis",
              description: "Calculate parlay probability with correlation adjustments",
              detail: `COMBO ANALYSIS - Parlay and multi-leg bet probability calculator.

What it does: Calculates combined probability for parlays considering correlations between related events. Shows individual leg probabilities, correlation adjustments (same-player props, same-game outcomes), and implied fair odds.

Example queries:
• "What's the chance Curry scores 25+ AND hits 4+ threes?"
• "Probability of Warriors winning AND Lakers losing"
• "Parlay odds: LeBron 30 pts + Lakers cover"
• "Combo analysis: Jokic 10+ rebounds AND 8+ assists"`
            },
            {
              id: "matchup_analysis",
              title: "Matchup Analysis",
              description: "Team vs team analysis with spread, total, and moneyline edge detection",
              detail: `MATCHUP ANALYSIS - Full team vs team market analysis.

What it does: Analyzes team matchups with current odds (spread, total, moneyline), team stats comparison, ATS trends, and edge detection based on net rating differentials.

Example queries:
• "Matchup analysis Lakers vs Celtics"
• "Is there an edge on the Lakers vs Rockets game"
• "Analyze the spread for Heat vs Thunder"
• "Edge on the Knicks Pacers total"`
            },
            {
              id: "player_analysis",
              title: "Player Analysis",
              description: "Analyze player props with season stats, recent form, and opponent context",
              detail: `PLAYER ANALYSIS - Detailed player prop analysis.

What it does: Compares player season averages to recent form (last 5 games), opponent allowed stats, and current SBD prop lines to assess value.

Example queries:
• "Player analysis Wemby rebounds vs Thunder"
• "Analyze Curry points prop"
• "Is there edge on LeBron assists"
• "Check value on Tatum rebounds"`
            }
            ].map((capability) => (
              <button
                key={capability.title}
                type="button"
                onClick={() => {
                  // If guest, redirect to sign up
                  if (isGuest && onSignUpClick) {
                    onSignUpClick()
                    return
                  }

                  const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
                  if (textarea) {
                    // Use native setter to update the value and trigger React's onChange
                    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                      window.HTMLTextAreaElement.prototype,
                      'value'
                    )?.set
                    if (nativeInputValueSetter) {
                      nativeInputValueSetter.call(textarea, capability.detail)
                    }
                    // Dispatch input event so React picks up the change
                    const inputEvent = new Event('input', { bubbles: true })
                    textarea.dispatchEvent(inputEvent)
                    textarea.focus()
                  }
                  setSelectedCapability(capability.id)
                }}
              className="group text-left p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all h-full min-h-[78px]"
              >
                <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                  {capability.title}
                </h3>
                <p className="text-[11px] text-white/60 leading-relaxed">
                  {capability.description}
                </p>
              </button>
            ))}
          </div>
        </div>

      </motion.div>

      <div className="mt-8 w-full">
        <LatestNewsStrip />
      </div>
    </div>
  )
}
