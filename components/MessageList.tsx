'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface MessageListProps {
  conversationId: string
  userId: string
}

export default function MessageList({ conversationId, userId }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    loadMessages()

    // Subscribe to new messages
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const loadMessages = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })

    if (data) {
      setMessages(data)
    }
    setLoading(false)
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-pulse text-accent-cyan">Loading messages...</div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center max-w-2xl px-8">
          <div className="text-6xl mb-6">💬</div>
          <h2 className="text-2xl font-bold text-accent-cyan mb-4">
            Start a conversation
          </h2>
          <p className="text-text-secondary mb-6">
            Ask me about odds, line movements, arbitrage opportunities, or bankroll
            management. I'm here to help!
          </p>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                "Show me tonight's NBA odds"
              </div>
            </div>
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                "Any arbitrage opportunities in NFL today?"
              </div>
            </div>
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                "I bet $110 on Lakers -5.5 at FanDuel"
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto px-4 py-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-accent-cyan text-bg-primary ml-auto'
                  : 'bg-bg-secondary text-text-primary mr-auto'
              }`}
            >
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    table: ({ node, ...props }) => (
                      <div className="overflow-x-auto my-4">
                        <table className="odds-table" {...props} />
                      </div>
                    ),
                    th: ({ node, ...props }) => (
                      <th className="text-left px-4 py-2" {...props} />
                    ),
                    td: ({ node, ...props }) => (
                      <td className="px-4 py-2" {...props} />
                    ),
                    code: ({ node, inline, ...props }: any) =>
                      inline ? (
                        <code
                          className="bg-bg-primary px-1 py-0.5 rounded text-accent-cyan"
                          {...props}
                        />
                      ) : (
                        <code
                          className="block bg-bg-primary p-3 rounded my-2"
                          {...props}
                        />
                      ),
                  }}
                >
                  {message.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
