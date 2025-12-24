'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { TopPerformancesStrip } from '@/components/ui/top-performances'
import { AnimatedHero } from '@/components/ui/animated-hero'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

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
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full mb-6"
      >
        <AnimatedHero
          staticText="Make money with"
          interval={2500}
        />
      </motion.div>

      <div className="w-full max-w-5xl mx-auto mb-6">
        <TopPerformancesStrip />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full"
      >
        <form onSubmit={handleSubmit} className="w-full relative">
          <PromptBox name="message" disabled={sending} />
        </form>

        {/* Capabilities */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 auto-rows-fr">
          {[
            {
              id: "player_profiles",
              title: "Player Profiles",
              description: "Access player stats, advanced metrics, and projections vs specific teams",
              detail: "NBA player profile with season averages, advanced stats, recent form (last 5-10 games), and matchup context vs an opponent to support prop analysis and edge checks."
            },
            {
              id: "team_profiles",
              title: "Team Profiles",
              description: "Get comprehensive team stats, trends, and performance metrics",
              detail: "NBA team profile with full basic and advanced stats, pace, offensive/defensive ratings, recent form, and betting context like ATS and split trends when available."
            },
            {
              id: "line_shopping",
              title: "Line Shopping",
              description: "Compare lines from every major US sportsbook for any sporting event",
              detail: "Line shop NBA games and props across SBD books for spread, total, moneyline, and player props; returns best price and book-by-book lines."
            },
            {
              id: "edge_factors",
              title: "Edge Factors",
              description: "Advanced factors with high impact: travel distance, rest records, player matchups",
              detail: "Surface high-impact NBA situational edges like rest, travel, back-to-back, opponent style, and matchup-specific factors that can move a line."
            },
            {
              id: "live_betting",
              title: "Live Betting",
              description: "AI-projected live spreads based on game flow, momentum, and in-game factors",
              detail: "Live NBA projections with updated fair lines using current score, time, pace, and in-game trends; includes live odds when available."
            },
            {
              id: "betting_trends",
              title: "Betting Trends",
              description: "Recent records vs spreads, prop covers, and public/sharp money splits",
              detail: "NBA betting trends: ATS, O/U, last 5/10, home/away, favorite/underdog splits, plus public vs sharp splits when available."
            },
            {
              id: "pick_guidance",
              title: "Pick Guidance",
              description: "Walk through the best bets, tools, and edge signals for a matchup",
              detail: "Walk through how Delta helps decide a pick: compare model vs market, highlight key stats, and show what data would change the call."
            },
            {
              id: "market_analysis",
              title: "Market Analysis",
              description: "Break down matchups with splits, injuries, stats, and edge alerts",
              detail: "Full NBA matchup analysis with odds snapshot, injuries, team stats, recent form, betting splits, and model vs market edge summary."
            },
            {
              id: "edge_awareness",
              title: "Edge Awareness",
              description: "Flag when a line or prop does not line up with the data",
              detail: "Check whether an NBA line or prop looks mispriced vs season averages, recent form, and matchup context; call out specific players/teams and explain why."
            }
          ].map((capability) => (
            <button
              key={capability.title}
              type="button"
              onClick={() => {
                const textarea = document.querySelector('textarea')
                if (textarea) {
                  textarea.value = capability.detail
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

      </motion.div>

      <div className="mt-8 w-full">
        <LatestNewsStrip />
      </div>
    </div>
  )
}
