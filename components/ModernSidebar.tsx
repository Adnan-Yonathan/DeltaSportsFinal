'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Trash2, Sparkles } from 'lucide-react'

interface SidebarProps {
  userId: string
  currentConversationId: string | null
  onConversationSelect: (id: string) => void
  onNewConversation: () => void
}

interface Conversation {
  id: string
  title: string | null
  created_at: string
  updated_at: string
}

export default function ModernSidebar({
  userId,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadConversations()

    const channel = supabase
      .channel('conversations')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadConversations()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const loadConversations = async () => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })

    if (data) {
      setConversations(data)
    }
    setLoading(false)
  }

  const deleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()

    const confirmed = confirm('Delete this conversation?')
    if (!confirmed) return

    await supabase.from('conversations').delete().eq('id', id)

    if (currentConversationId === id) {
      const remaining = conversations.filter((c) => c.id !== id)
      if (remaining.length > 0) {
        onConversationSelect(remaining[0].id)
      } else {
        onNewConversation()
      }
    }
  }

  const groupConversations = () => {
    const now = new Date()
    const today: Conversation[] = []
    const week: Conversation[] = []
    const older: Conversation[] = []

    conversations.forEach((conv) => {
      const updatedAt = new Date(conv.updated_at)
      const diffDays = Math.floor(
        (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (diffDays === 0) {
        today.push(conv)
      } else if (diffDays <= 7) {
        week.push(conv)
      } else {
        older.push(conv)
      }
    })

    return { today, week, older }
  }

  const { today, week, older } = groupConversations()

  if (loading) {
    return (
      <div className="h-full bg-black/40 backdrop-blur-xl border-r border-white/5 p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const renderGroup = (title: string, convs: Conversation[]) => {
    if (convs.length === 0) return null

    return (
      <div className="mb-6">
        <div className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-3 px-3">
          {title}
        </div>
        <div className="space-y-1">
          {convs.map((conv) => (
            <motion.div
              key={conv.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              whileHover={{ x: 4 }}
              transition={{ duration: 0.2 }}
            >
              <div
                onClick={() => onConversationSelect(conv.id)}
                onMouseEnter={() => setHoveredId(conv.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`group relative p-3 rounded-lg cursor-pointer transition-all ${
                  currentConversationId === conv.id
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                      <div className="text-sm font-medium text-white truncate">
                        {conv.title || 'New Chat'}
                      </div>
                    </div>
                    <div className="text-xs text-white/40">
                      {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
                    </div>
                  </div>
                  <AnimatePresence>
                    {(hoveredId === conv.id || currentConversationId === conv.id) && (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        onClick={(e) => deleteConversation(conv.id, e)}
                        className="text-white/40 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">DELTA</h2>
            <p className="text-xs text-white/40">Chat History</p>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium shadow-lg shadow-indigo-500/20 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </motion.button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence mode="wait">
          {conversations.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center text-white/30 text-sm mt-8"
            >
              No conversations yet
            </motion.div>
          ) : (
            <div>
              {renderGroup('Today', today)}
              {renderGroup('Last 7 Days', week)}
              {renderGroup('Older', older)}
            </div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      `}</style>
    </div>
  )
}
