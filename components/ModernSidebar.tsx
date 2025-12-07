'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDistanceToNow } from 'date-fns'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, Plus, Trash2, Sparkles, RefreshCw, Eye } from 'lucide-react'
import Link from 'next/link'

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
  model_type?: string
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
      .select('id, model_name, sport_key, market_type, target_metric, confidence_level, model_type, updated_at, last_used_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(5)

    if (data) {
      setCustomModels(data)
    }
    setModelsLoading(false)
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
      <div className="h-full bg-black border-r border-[#1f1f1f] p-4">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white/10 rounded-lg animate-pulse" />
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
                    ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/20 border border-emerald-500/30'
                    : 'hover:bg-white/5 border border-transparent'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                      <div className="text-sm font-medium text-white truncate">
                        {conv.title || 'New Chat'}
                      </div>
                    </div>
                    <div className="text-xs text-white/60">
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
                        className="text-white/50 hover:text-red-400 transition-colors p-1 rounded hover:bg-red-500/10"
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
    <div className="h-full bg-black border-r border-[#1f1f1f] flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#1f1f1f]">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">DELTA</h2>
          <p className="text-xs text-white/60">Chat History</p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onNewConversation}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#34d399] text-[#0f1f15] hover:bg-[#16a34a] font-medium shadow-lg shadow-[#34d399]/30 transition-all"
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
              className="text-center text-white/50 text-sm mt-8"
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

        <div
          className="mt-8 border-t border-[#1f1f1f] pt-4"
          id="saved-models-section"
          data-section="saved-models"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-full bg-white/10 text-emerald-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Saved Models</p>
                <p className="text-xs text-white/60">Call conversationally (e.g., &quot;run my model&quot;)</p>
              </div>
            </div>
            <button
              onClick={loadModels}
              className="p-2 rounded-lg border border-[#1f1f1f] text-white/70 hover:text-white hover:border-white/40 transition-colors"
              title="Refresh models"
            >
              <RefreshCw className={`w-4 h-4 ${modelsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Create Model and View All Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <Link
              href="/models/new"
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#34d399] text-white hover:bg-[#34d399]/10 hover:text-white font-medium text-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create</span>
            </Link>
            <Link
              href="/models"
              className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[#1f1f1f] hover:border-white/50 text-white/70 hover:text-white font-medium text-xs transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>View All</span>
            </Link>
          </div>

          {modelsLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-white/10 animate-pulse" />
              ))}
            </div>
          ) : customModels.length > 0 ? (
            <div className="space-y-2">
              {customModels.map((model) => {
                const isResearch = model.model_type === 'research'
                return (
                  <div
                    key={model.id}
                    className={`p-3 rounded-lg border ${
                      isResearch
                        ? 'border-[#34d399]/40 bg-[#34d399]/10 hover:border-[#34d399]/60'
                        : 'border-[#1f1f1f] bg-[#0f0f0f] hover:border-[#34d399]/60'
                    } transition-all`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-semibold text-white">{model.model_name}</p>
                          {isResearch && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#34d399]/20 text-[#0f1f15] font-semibold border border-[#34d399]/50">
                              SCANNER
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/50">
                          {formatSportLabel(model.sport_key)} &middot; {model.market_type}
                        </p>
                        <p className="text-[11px] text-white/40 mt-1">
                          {isResearch ? (
                            <>Auto-scanner &middot; {getModelTimeLabel(model)}</>
                          ) : (
                            <>Confidence {Math.round(Number(model.confidence_level) * 100)}% &middot; {getModelTimeLabel(model)}</>
                          )}
                        </p>
                      </div>
                      <p className="text-[11px] text-white/50 text-right leading-4">
                        {isResearch ? (
                          <>Ask DELTA to &quot;run {model.model_name}&quot;</>
                        ) : (
                          <>Ask DELTA to &quot;apply {model.model_name}&quot;</>
                        )}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-white/60">
              No saved models yet. Ask DELTA to &quot;create a custom model&quot; or &quot;create a research model&quot; and it will guide you.
            </p>
          )}

          <p className="text-[11px] text-white/60 mt-3">
            <strong>Prediction models:</strong> Apply to matchups for projections<br/>
            <strong>Research models:</strong> Run to find betting opportunities
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




