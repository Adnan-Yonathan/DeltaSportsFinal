'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getPostHogClient } from '@/lib/posthog/client'
import ModernSidebar from '@/components/ModernSidebar'
import ModernMessageList from '@/components/ModernMessageList'
import ModernMessageInput from '@/components/ModernMessageInput'
import BentoGridBankroll from '@/components/BentoGridBankroll'
import { motion } from 'framer-motion'
import { LogOut, Sparkles } from 'lucide-react'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [hasMessages, setHasMessages] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/auth/login')
        return
      }

      setUser(user)

      const posthog = getPostHogClient()
      if (posthog) {
        posthog.identify(user.id, {
          email: user.email,
          created_at: user.created_at,
        })
      }

      await createInitialConversation(user.id)
      setLoading(false)
    }

    checkUser()
  }, [])

  const createInitialConversation = async (userId: string) => {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (conversations && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id)
    } else {
      const { data: newConv } = await supabase
        .from('conversations')
        .insert({
          user_id: userId,
          title: 'New Chat',
        })
        .select()
        .single()

      if (newConv) {
        setCurrentConversationId(newConv.id)
      }
    }
  }

  const handleNewConversation = async () => {
    if (!user) return

    const { data: newConv } = await supabase
      .from('conversations')
      .insert({
        user_id: user.id,
        title: 'New Chat',
      })
      .select()
      .single()

    if (newConv) {
      setCurrentConversationId(newConv.id)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-16 h-16 rounded-full border-4 border-indigo-500 border-t-transparent"
          />
          <p className="text-white/80 text-xl font-medium">Loading Delta AI...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      <div className="w-1/5">
        <ModernSidebar
          userId={user?.id}
          currentConversationId={currentConversationId}
          onConversationSelect={setCurrentConversationId}
          onNewConversation={handleNewConversation}
        />
      </div>

      <div className="flex-1 flex flex-col">
        <div className="bg-black/60 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DELTA AI</h1>
              <p className="text-xs text-white/40">Intelligent Sports Betting Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-white/60 text-sm">{user?.email}</span>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signOut()
                  if (error) {
                    console.error('Sign out error:', error)
                  }
                  // Redirect regardless of error
                  router.push('/auth/login')
                  // Force refresh to clear any cached state
                  window.location.href = '/auth/login'
                } catch (err) {
                  console.error('Sign out error:', err)
                  window.location.href = '/auth/login'
                }
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm">Sign Out</span>
            </motion.button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          {currentConversationId ? (
            <ModernMessageList
              conversationId={currentConversationId}
              userId={user?.id}
              onMessagesChange={setHasMessages}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-6xl mb-4"
                >
                  🎯
                </motion.div>
                <h2 className="text-3xl font-bold text-white mb-2">
                  Welcome to Delta AI
                </h2>
                <p className="text-white/60">
                  Your intelligent sports betting assistant
                </p>
              </motion.div>
            </div>
          )}
        </div>

        {currentConversationId && hasMessages && (
          <ModernMessageInput
            conversationId={currentConversationId}
            userId={user?.id}
          />
        )}
      </div>

      <div className="w-1/4">
        {user && <BentoGridBankroll userId={user.id} />}
      </div>
    </div>
  )
}
