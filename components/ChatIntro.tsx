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
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full mb-12"
      >
        <AnimatedHero
          staticText="How can I help you with"
          interval={2500}
        />
      </motion.div>

      <div className="w-full max-w-5xl mx-auto mb-12">
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
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            {
              title: "Player Profiles",
              description: "Access player stats, advanced metrics, and projections vs specific teams",
              prompt: "how many times has lebron scored 18 points this season?"
            },
            {
              title: "Team Profiles",
              description: "Get comprehensive team stats, trends, and performance metrics",
              prompt: "what is the thunders average margin of victory"
            },
            {
              title: "Line Shopping",
              description: "Compare lines from every major US sportsbook for any sporting event",
              prompt: "which book has the best spread for the lakers game"
            },
            {
              title: "Edge Factors",
              description: "Advanced factors with high impact: travel distance, rest records, player matchups",
              prompt: "what is the knicks record when traveling further than 500 miles?"
            },
            {
              title: "Live Betting",
              description: "AI-projected live spreads based on game flow, momentum, and in-game factors",
              prompt: "what is your projected live line in the spurs game?"
            },
            {
              title: "Betting Trends",
              description: "Recent records vs spreads, prop covers, and public/sharp money splits",
              prompt: "what is the Celtics record ATS this season?"
            }
          ].map((capability) => (
            <button
              key={capability.title}
              type="button"
              onClick={() => {
                const textarea = document.querySelector('textarea')
                if (textarea) {
                  textarea.value = capability.prompt
                  textarea.focus()
                }
              }}
              className="group text-left p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all"
            >
              <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                {capability.title}
              </h3>
              <p className="text-xs text-white/60 leading-relaxed">
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
