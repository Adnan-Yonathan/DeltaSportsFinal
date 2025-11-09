'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent }: ChatIntroProps) {
  const [sending, setSending] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if (!message || sending) return

    setSending(true)

    try {
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
          Ask me about odds, line movements, arbitrage opportunities, or bankroll
          management. I'm here to help!
        </p>

        <form onSubmit={handleSubmit} className="w-full">
          <PromptBox name="message" disabled={sending} />
        </form>
      </motion.div>
    </div>
  )
}
