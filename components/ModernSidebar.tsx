'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Trash2, Sparkles, RefreshCw } from 'lucide-react'

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

interface CustomModel {
  id: string
  model_name: string
  sport_key: string
  market_type: string
  target_metric: string
  confidence_level: number
  updated_at: string
  last_used_at: string | null
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
  const [customModels, setCustomModels] = useState<CustomModel[]>([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [quickPromptModel, setQuickPromptModel] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadConversations()
    loadModels()

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

    const modelsChannel = supabase
      .channel('custom_models')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'custom_models',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadModels()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(modelsChannel)
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

  const loadModels = async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('custom_models')
      .select('id, model_name, sport_key, market_type, target_metric, confidence_level, updated_at, last_used_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (data) {
      setCustomModels(data)
    }
    setModelsLoading(false)
  }

  const handleQuickPrompt = (model: CustomModel) => {
    if (typeof window === 'undefined') return
    const defaultPrompt = `Apply my ${model.model_name} model for ${model.market_type} (add matchup/context here)`
    window.dispatchEvent(
      new CustomEvent('delta-quick-prompt', {
        detail: {
          text: defaultPrompt,
          autoSend: true,
        },
      })
    )
    setQuickPromptModel(model.id)
    setTimeout(() => setQuickPromptModel(null), 2000)
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

  const formatSportLabel = (sportKey: string) => {
    if (!sportKey) return 'N/A'
    return sportKey.replace('americanfootball_', 'NFL ').replace('basketball_', 'NBA ').replace('baseball_', 'MLB ').replace('icehockey_', 'NHL ').replace(/_/g, ' ').toUpperCase()
  }

  const getModelTimeLabel = (model: CustomModel) => {
    const timestamp = model.last_used_at || model.updated_at
    if (!timestamp) return 'never used'
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
  }

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
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">DELTA</h2>
          <p className="text-xs text-white/40">Chat History</p>
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

        <div className="mt-8 border-t border-white/5 pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-white/5 text-indigo-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Saved Models</p>
                <p className="text-xs text-white/40">Prefill prompts to apply them fast</p>
              </div>
            </div>
            <button
              onClick={loadModels}
              className="p-2 rounded-lg border border-white/10 text-white/60 hover:text-white hover:border-white/30 transition-colors"
              title="Refresh models"
            >
              <RefreshCw className={`w-4 h-4 ${modelsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {modelsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : customModels.length > 0 ? (
            <div className="space-y-2">
              {customModels.map((model) => (
                <div
                  key={model.id}
                  className="p-3 rounded-lg border border-white/10 bg-white/5 hover:border-indigo-400/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-white">{model.model_name}</p>
                      <p className="text-xs text-white/50">
                        {formatSportLabel(model.sport_key)} GÃ‡Ã³ {model.market_type}
                      </p>
                      <p className="text-[11px] text-white/40 mt-1">
                        Conf {Math.round(Number(model.confidence_level) * 100)}% GÃ‡Ã³ {getModelTimeLabel(model)}
                      </p>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleQuickPrompt(model)}
                      className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-100 border border-indigo-500/40 hover:bg-indigo-500/30 transition-colors"
                    >
                      {quickPromptModel === model.id ? 'Prompt Ready' : 'Prefill prompt'}
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-white/40">
              No saved models yet. Ask DELTA to &quot;create a custom model&quot; and it will guide you.
            </p>
          )}

          <p className="text-[11px] text-white/40 mt-3">
            Prefill now auto-sends &quot;Apply my model&quot; into the chat so you get projections instantly - adjust with a follow-up message if needed.
          </p>
        </div>
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


