'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { TopPerformancesStrip } from '@/components/ui/top-performances'

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
      <div className="w-full max-w-5xl mx-auto pt-2 mb-12">
        <TopPerformancesStrip />
      </div>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full"
      >
        <h2 className="text-3xl font-bold text-white mb-4">
          How can I help you today?
        </h2>
        <p className="text-white/60 mb-8">
          Ask me anything about sports stats, betting analysis, live scores, player performance,
          opponent matchups, or historical trends. I understand natural language questions.
        </p>

        <form onSubmit={handleSubmit} className="w-full relative">
          <PromptBox name="message" disabled={sending} />
        </form>

        {/* Example queries */}
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {[
            "What's the Thunder's defensive rating?",
            "How many 40-point games has Luka had?",
            "Opponents 3pt% vs Celtics",
            "How do the Lakers do on back-to-backs?",
          ].map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                const textarea = document.querySelector('textarea')
                if (textarea) {
                  textarea.value = example
                  textarea.focus()
                }
              }}
              className="px-3 py-1.5 text-xs text-white/60 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>

        <div className="mt-24 space-y-16">
          <LatestNewsStrip />
        </div>
      </motion.div>
    </div>
  )
}
