'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { getPostHogClient } from '@/lib/posthog/client'
import ModernSidebar from '@/components/ModernSidebar'
import ModernMessageList from '@/components/ModernMessageList'
import ModernMessageInput from '@/components/ModernMessageInput'
import BentoGridBankroll from '@/components/BentoGridBankroll'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu, X, DollarSign } from 'lucide-react'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [hasMessages, setHasMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bankrollOpen, setBankrollOpen] = useState(false)
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
          <p className="text-white/80 text-xl font-medium">Loading DELTA...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/80 z-40 lg:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-80 z-50 lg:hidden"
            >
              <ModernSidebar
                userId={user?.id}
                currentConversationId={currentConversationId}
                onConversationSelect={(id) => {
                  setCurrentConversationId(id)
                  setSidebarOpen(false)
                }}
                onNewConversation={() => {
                  handleNewConversation()
                  setSidebarOpen(false)
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block lg:w-1/5">
        <ModernSidebar
          userId={user?.id}
          currentConversationId={currentConversationId}
          onConversationSelect={setCurrentConversationId}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="bg-black/60 backdrop-blur-xl border-b border-white/5 px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div>
              <h1 className="text-base sm:text-xl font-bold text-white">DELTA</h1>
              <p className="text-xs text-white/40 hidden sm:block">Intelligent Sports Betting Assistant</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Bankroll Button (Mobile) */}
            <button
              onClick={() => setBankrollOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10"
            >
              <DollarSign className="w-4 h-4" />
            </button>

            {/* Email (Desktop Only) */}
            <span className="hidden md:block text-white/60 text-sm">{user?.email}</span>

            {/* Sign Out Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={async () => {
                try {
                  const { error } = await supabase.auth.signOut()
                  if (error) {
                    console.error('Sign out error:', error)
                  }
                  router.push('/auth/login')
                  window.location.href = '/auth/login'
                } catch (err) {
                  console.error('Sign out error:', err)
                  window.location.href = '/auth/login'
                }
              }}
              className="flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all border border-white/10"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm hidden sm:inline">Sign Out</span>
            </motion.button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-hidden">
          {currentConversationId ? (
            <ModernMessageList
              conversationId={currentConversationId}
              userId={user?.id}
              onMessagesChange={setHasMessages}
            />
          ) : (
            <div className="flex items-center justify-center h-full bg-black px-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl sm:text-6xl mb-4"
                >
                  🎯
                </motion.div>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">
                  Welcome to DELTA
                </h2>
                <p className="text-white/60 text-sm sm:text-base">
                  Your intelligent sports betting assistant
                </p>
              </motion.div>
            </div>
          )}
        </div>

        {/* Message Input */}
        {currentConversationId && hasMessages && (
          <ModernMessageInput
            conversationId={currentConversationId}
            userId={user?.id}
          />
        )}
      </div>

      {/* Desktop Bankroll Panel */}
      <div className="hidden lg:block lg:w-1/4">
        {user && <BentoGridBankroll userId={user.id} />}
      </div>

      {/* Mobile Bankroll Modal */}
      <AnimatePresence>
        {bankrollOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setBankrollOpen(false)}
              className="fixed inset-0 bg-black/80 z-40 lg:hidden"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 max-h-[80vh] z-50 lg:hidden overflow-hidden"
            >
              <div className="bg-black border-t border-white/10 rounded-t-2xl">
                <div className="flex items-center justify-between p-4 border-b border-white/10">
                  <h3 className="text-lg font-bold text-white">Bankroll</h3>
                  <button
                    onClick={() => setBankrollOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 text-white/60 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
                  {user && <BentoGridBankroll userId={user.id} />}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
