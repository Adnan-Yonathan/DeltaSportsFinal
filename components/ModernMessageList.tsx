'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Sparkles } from 'lucide-react'
import AnimatedMessage from './AnimatedMessage'
import ChatIntro from './ChatIntro'
import { ShiningText } from '@/components/ui/shining-text'
import { getOperationMessage } from '@/lib/chat/operation-messages'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

interface MessageListProps {
  conversationId: string
  userId: string
  onMessagesChange?: (hasMessages: boolean) => void
}

export default function ModernMessageList({ conversationId, userId, onMessagesChange }: MessageListProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [latestMessageId, setLatestMessageId] = useState<string | null>(null)
  const [isThinking, setIsThinking] = useState(false)
  const [currentOperation, setCurrentOperation] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const loadMessages = useCallback(async () => {
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
  }, [conversationId, supabase])

  useEffect(() => {
    loadMessages()

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
          const newMessage = payload.new as Message
          setMessages((prev) => [...prev, newMessage])
          // Track the latest assistant message for animation
          if (newMessage.role === 'assistant') {
            setLatestMessageId(newMessage.id)
            setIsThinking(false) // Stop thinking when assistant responds
          } else if (newMessage.role === 'user') {
            setIsThinking(true) // Start thinking when user sends message
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, loadMessages, supabase])

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (onMessagesChange) {
      onMessagesChange(messages.length > 0)
    }
  }, [messages.length, onMessagesChange])

  // Listen for operation changes
  useEffect(() => {
    const handleOperationChange = (event: CustomEvent<{ operation: string }>) => {
      console.log('[ModernMessageList] Received operation change:', event.detail.operation)
      setCurrentOperation(event.detail.operation)
    }

    console.log('[ModernMessageList] Setting up operation change listener')
    window.addEventListener('chat-operation-change', handleOperationChange as EventListener)

    return () => {
      console.log('[ModernMessageList] Removing operation change listener')
      window.removeEventListener('chat-operation-change', handleOperationChange as EventListener)
    }
  }, [])

  useEffect(() => {
    const handleStreamComplete = (event: CustomEvent<{ conversationId: string; content?: string }>) => {
      if (event.detail.conversationId !== conversationId) return
      setIsThinking(false)

      const content = event.detail.content?.trim()
      if (content) {
        const optimisticMessage: Message = {
          id: `stream-${Date.now()}`,
          role: 'assistant',
          content,
          created_at: new Date().toISOString(),
        }

        setMessages((prev) => {
          const alreadyPresent = prev.some(
            (msg) => msg.role === 'assistant' && msg.content.trim() === content
          )
          if (alreadyPresent) return prev
          return [...prev, optimisticMessage]
        })
        setLatestMessageId(optimisticMessage.id)
      }

      const syncDelay = content ? 800 : 250
      setTimeout(() => {
        void loadMessages()
      }, syncDelay)
    }

    window.addEventListener('chat-stream-complete', handleStreamComplete as EventListener)

    return () => {
      window.removeEventListener('chat-stream-complete', handleStreamComplete as EventListener)
    }
  }, [conversationId, loadMessages])

  // Reset operation when thinking stops
  useEffect(() => {
    if (!isThinking) {
      console.log('[ModernMessageList] Thinking stopped, resetting operation')
      setCurrentOperation(null)
    }
  }, [isThinking])

  // Log current operation changes
  useEffect(() => {
    console.log('[ModernMessageList] Current operation changed to:', currentOperation)
  }, [currentOperation])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-12 h-12 rounded-full border-2 border-emerald-500 border-t-transparent"
          />
          <p className="text-white/60 text-sm">Loading messages...</p>
        </motion.div>
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <ChatIntro
        conversationId={conversationId}
        userId={userId}
        onMessageSent={loadMessages}
      />
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-black px-1.5 sm:px-4 py-2 sm:py-6 custom-scrollbar">
      <div className="max-w-4xl mx-auto space-y-2 sm:space-y-6">
        <AnimatePresence initial={false}>
          {messages.map((message, index) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className={`flex gap-1.5 sm:gap-4 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && (
                <div className="flex-shrink-0">
                  <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                    <Sparkles className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                  </div>
                </div>
              )}

              <div
                className={`max-w-[88%] sm:max-w-[75%] rounded-xl sm:rounded-2xl px-2.5 py-2 sm:px-5 sm:py-4 ${
                  message.role === 'user'
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                    : 'bg-[#0f0f0f] border border-[#1f1f1f] text-white'
                }`}
              >
                {message.role === 'assistant' ? (
                  <AnimatedMessage
                    content={message.content}
                    isAnimating={message.id === latestMessageId}
                  />
                ) : (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: ({ node, ...props }) => (
                          <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                            <table className="w-full" {...props} />
                          </div>
                        ),
                        thead: ({ node, ...props }) => (
                          <thead className="bg-white/5" {...props} />
                        ),
                        th: ({ node, ...props }) => (
                          <th className="text-left px-4 py-3 text-emerald-300 font-semibold text-xs uppercase tracking-wider" {...props} />
                        ),
                        td: ({ node, ...props }) => (
                          <td className="px-4 py-3 border-t border-white/5 text-sm" {...props} />
                        ),
                        code: ({ node, inline, ...props }: any) =>
                          inline ? (
                            <code
                              className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300 text-xs font-mono"
                              {...props}
                            />
                          ) : (
                            <code
                              className="block bg-white/5 p-4 rounded-lg my-2 text-xs font-mono border border-white/10"
                              {...props}
                            />
                          ),
                        p: ({ node, ...props }) => (
                          <p className="mb-2 last:mb-0 leading-relaxed" {...props} />
                        ),
                        ul: ({ node, ...props }) => (
                          <ul className="space-y-1 my-2" {...props} />
                        ),
                        ol: ({ node, ...props }) => (
                          <ol className="space-y-1 my-2" {...props} />
                        ),
                        li: ({ node, ...props }) => (
                          <li className="ml-4" {...props} />
                        ),
                        h1: ({ node, ...props }) => (
                          <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />
                        ),
                        h2: ({ node, ...props }) => (
                          <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />
                        ),
                        h3: ({ node, ...props }) => (
                          <h3 className="text-base font-semibold mt-2 mb-1 text-white" {...props} />
                        ),
                        a: ({ node, ...props }) => (
                          <a
                            className="text-emerald-300 underline hover:text-emerald-200"
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
                )}
              </div>

              {message.role === 'user' && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg">
                    <User className="w-4 h-4 text-white" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Thinking indicator */}
        {isThinking && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
            className="flex gap-2 sm:gap-4 justify-start"
          >
            <div className="flex-shrink-0">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
              </div>
            </div>
            <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 py-3 sm:px-5 sm:py-4 bg-[#0f0f0f] border border-[#1f1f1f]">
              <ShiningText
                text={currentOperation ? getOperationMessage(currentOperation) : "DELTA is thinking..."}
              />
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
