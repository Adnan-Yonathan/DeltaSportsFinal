'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'

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

export default function Sidebar({
  userId,
  currentConversationId,
  onConversationSelect,
  onNewConversation,
}: SidebarProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    loadConversations()

    // Subscribe to new conversations
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
      // Select the next available conversation or create a new one
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

  const renderConversation = (conv: Conversation) => (
    <div
      key={conv.id}
      onClick={() => onConversationSelect(conv.id)}
      className={`p-3 rounded-lg cursor-pointer transition-all group relative ${
        currentConversationId === conv.id
          ? 'bg-accent-orange/20 border-l-2 border-accent-orange'
          : 'hover:bg-bg-secondary'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="text-text-primary text-sm font-medium truncate">
            {conv.title || 'New Chat'}
          </div>
          <div className="text-text-secondary text-xs mt-1">
            {formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })}
          </div>
        </div>
        <button
          onClick={(e) => deleteConversation(conv.id, e)}
          className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-warning-red transition-all ml-2"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="h-full bg-bg-primary p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-10 bg-bg-secondary rounded"></div>
          <div className="h-16 bg-bg-secondary rounded"></div>
          <div className="h-16 bg-bg-secondary rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full bg-bg-primary flex flex-col">
      {/* New Chat Button */}
      <div className="p-4 border-b border-gray-800">
        <button
          onClick={onNewConversation}
          className="w-full btn-primary flex items-center justify-center gap-2"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          New Chat
        </button>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {today.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-text-secondary uppercase mb-2 px-1">
              Today
            </div>
            <div className="space-y-2">{today.map(renderConversation)}</div>
          </div>
        )}

        {week.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-text-secondary uppercase mb-2 px-1">
              Last 7 Days
            </div>
            <div className="space-y-2">{week.map(renderConversation)}</div>
          </div>
        )}

        {older.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-text-secondary uppercase mb-2 px-1">
              Older
            </div>
            <div className="space-y-2">{older.map(renderConversation)}</div>
          </div>
        )}

        {conversations.length === 0 && (
          <div className="text-center text-text-secondary text-sm mt-8">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  )
}
