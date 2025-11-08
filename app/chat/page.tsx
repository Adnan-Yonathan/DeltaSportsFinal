'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import MessageList from '@/components/MessageList'
import MessageInput from '@/components/MessageInput'
import BankrollTracker from '@/components/BankrollTracker'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
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
      await createInitialConversation(user.id)
      setLoading(false)
    }

    checkUser()
  }, [])

  const createInitialConversation = async (userId: string) => {
    // Check if user has any conversations
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (conversations && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id)
    } else {
      // Create new conversation
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
      <div className="flex items-center justify-center min-h-screen bg-bg-primary">
        <div className="animate-pulse text-accent-cyan text-xl">Loading Delta AI...</div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-bg-primary overflow-hidden">
      {/* Sidebar - 20% */}
      <div className="w-1/5 border-r border-gray-800">
        <Sidebar
          userId={user?.id}
          currentConversationId={currentConversationId}
          onConversationSelect={setCurrentConversationId}
          onNewConversation={handleNewConversation}
        />
      </div>

      {/* Main Chat Area - 55% */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-bg-secondary border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-accent-orange">DELTA AI</h1>
          <div className="flex items-center gap-4">
            <span className="text-text-secondary text-sm">{user?.email}</span>
            <button
              onClick={async () => {
                await supabase.auth.signOut()
                router.push('/auth/login')
              }}
              className="text-text-secondary hover:text-accent-cyan text-sm transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-hidden">
          {currentConversationId ? (
            <MessageList
              conversationId={currentConversationId}
              userId={user?.id}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-6xl mb-4">🎯</div>
                <h2 className="text-2xl font-bold text-accent-cyan mb-2">
                  Welcome to Delta AI
                </h2>
                <p className="text-text-secondary">
                  Your intelligent sports betting assistant
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {currentConversationId && (
          <div className="bg-bg-secondary border-t border-gray-800">
            <MessageInput
              conversationId={currentConversationId}
              userId={user?.id}
            />
          </div>
        )}
      </div>

      {/* Bankroll Tracker - 25% */}
      <div className="w-1/4 border-l border-gray-800">
        {user && <BankrollTracker userId={user.id} />}
      </div>
    </div>
  )
}
