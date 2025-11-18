'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { createClient } from '@/lib/supabase/client'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [mode, setMode] = useState<'regular' | 'live' | 'research'>('regular')
  
  const [models, setModels] = useState<Array<{ id: string; model_name: string }>>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [loadingModels, setLoadingModels] = useState(false)

  useEffect(() => {
    const fetchModels = async () => {
      if (!userId || models.length > 0 || loadingModels) return
      setLoadingModels(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('custom_models')
        .select('id, model_name')
        .eq('user_id', userId)
        .eq('model_type', 'research')
        .order('updated_at', { ascending: false })
        .limit(20)
      if (!error && data) {
        setModels(data as any)
      }
      setLoadingModels(false)
    }
    if (mode === 'research') {
      fetchModels()
    }
  }, [mode, userId, models.length, loadingModels])

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
          mode,
          researchModelId: mode === 'research' && selectedModelId ? selectedModelId : undefined,
          researchModelName:
            mode === 'research' && selectedModelId
              ? models.find((m) => m.id === selectedModelId)?.model_name
              : undefined,
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
          management. I&apos;m here to help!
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6 text-left">
          <label className={`rounded-lg border ${mode === 'regular' ? 'border-white/80 bg-white/5' : 'border-white/10'} p-3 text-white/80 cursor-pointer`}>
            <input
              type="radio"
              name="mode"
              value="regular"
              className="mr-2 accent-blue-500"
              checked={mode === 'regular'}
              onChange={() => setMode('regular')}
            />
            <span className="font-semibold text-white">Regular</span>
            <div className="text-xs text-white/60 mt-1">Balanced chat with quick answers.</div>
          </label>
          <label className={`rounded-lg border ${mode === 'live' ? 'border-white/80 bg-white/5' : 'border-white/10'} p-3 text-white/80 cursor-pointer`}>
            <input
              type="radio"
              name="mode"
              value="live"
              className="mr-2 accent-blue-500"
              checked={mode === 'live'}
              onChange={() => setMode('live')}
            />
            <span className="font-semibold text-white">Live odds/props</span>
            <div className="text-xs text-white/60 mt-1">Prioritize fresh odds & player props.</div>
          </label>
          <label className={`rounded-lg border ${mode === 'research' ? 'border-white/80 bg-white/5' : 'border-white/10'} p-3 text-white/80 cursor-pointer`}>
            <input
              type="radio"
              name="mode"
              value="research"
              className="mr-2 accent-blue-500"
              checked={mode === 'research'}
              onChange={() => setMode('research')}
            />
            <span className="font-semibold text-white">Research</span>
            <div className="text-xs text-white/60 mt-1">Allow deeper scans (may take longer).</div>
          </label>
        </div>

        {mode === 'research' && (
          <div className="mb-6 text-left">
            <label className="block text-white font-semibold mb-2">Select a saved research model (optional)</label>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              disabled={loadingModels}
              className="w-full rounded-lg bg-white/5 border border-white/10 text-white p-3"
            >
              <option value="">{loadingModels ? 'Loading models...' : 'None selected'}</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.model_name}
                </option>
              ))}
            </select>
            {!loadingModels && models.length === 0 && (
              <p className="text-xs text-white/60 mt-2">No saved research models yet.</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="w-full">
          <PromptBox name="message" disabled={sending} />
        </form>
      </motion.div>
    </div>
  )
}
