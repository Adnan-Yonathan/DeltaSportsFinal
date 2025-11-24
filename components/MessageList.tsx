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
          <div className="text-6xl mb-6">dYZ_</div>
          <h2 className="text-2xl font-bold text-accent-cyan mb-4">
            Start a conversation
          </h2>
          <p className="text-text-secondary mb-6">
            Ask me about odds, line movements, arbitrage opportunities, or bankroll
            management. I&apos;m here to help!
          </p>
          <div className="grid grid-cols-1 gap-3 text-sm">
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                &ldquo;Show me tonight&rsquo;s NBA odds&rdquo;
              </div>
            </div>
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                &ldquo;Any arbitrage opportunities in NFL today?&rdquo;
              </div>
            </div>
            <div className="bg-bg-secondary p-3 rounded-lg text-left">
              <div className="text-accent-orange font-semibold mb-1">Example:</div>
              <div className="text-text-secondary">
                &ldquo;I bet $110 on Lakers -5.5 at FanDuel&rdquo;
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
        {messages.map((message) => {
          const isUser = message.role === 'user'
          const bubbleBase =
            'relative max-w-[85%] rounded-2xl px-5 py-4 shadow-xl transition-transform duration-150 hover:-translate-y-[1px]'
          const userStyles =
            'bg-gradient-to-br from-cyan-500/90 via-cyan-500/80 to-blue-500/70 text-white border border-cyan-200/30 shadow-cyan-500/25 ml-auto'
          const assistantStyles =
            'bg-gradient-to-br from-white/8 via-white/6 to-white/4 text-white border border-white/10 shadow-black/30 mr-auto backdrop-blur-sm'

          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`${bubbleBase} ${isUser ? userStyles : assistantStyles}`}>
                <div className="prose prose-invert prose-sm max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      table: ({ node, ...props }) => (
                        <div className="overflow-x-auto my-4">
                          <table className="odds-table" {...props} />
                        </div>
                      ),
                      th: ({ node, ...props }) => <th className="text-left px-4 py-2" {...props} />,
                      td: ({ node, ...props }) => <td className="px-4 py-2" {...props} />,
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code className="bg-bg-primary px-1 py-0.5 rounded text-accent-cyan" {...props} />
                        ) : (
                          <code className="block bg-bg-primary p-3 rounded my-2" {...props} />
                        ),
                      a: ({ node, ...props }) => (
                        <a
                          className="text-accent-cyan underline hover:text-accent-orange"
                          target="_blank"
                          rel="noopener noreferrer"
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
          )
        })}
        <div ref={messagesEndRef} />
      </div>
    </div>
  )
}
