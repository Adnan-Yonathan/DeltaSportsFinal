"use client"

import { useEffect, useState, useRef, ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ModernSidebar from '@/components/ModernSidebar'
import ModernMessageList from '@/components/ModernMessageList'
import ModernMessageInput from '@/components/ModernMessageInput'
import BentoGridBankroll from '@/components/BentoGridBankroll'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu, X, DollarSign, Sparkles, Home, Image as ImageIcon } from 'lucide-react'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [hasMessages, setHasMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [bankrollOpen, setBankrollOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

      const { data: profile } = await supabase
        .from('users')
        .select('display_name')
        .eq('id', user.id)
        .single()
      setProfileName(profile?.display_name || user.email || 'Guest')

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

  const scrollToSavedModels = () => {
    if (typeof window === 'undefined') return

    const scroll = () => {
      const sections = Array.from(document.querySelectorAll('[data-section="saved-models"]'))
      const target =
        (sections.find((el) => el instanceof HTMLElement && (el as HTMLElement).offsetParent !== null) as
          | HTMLElement
          | undefined) || (sections[0] as HTMLElement | undefined)

      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }

    if (window.innerWidth < 1024 && !sidebarOpen) {
      setSidebarOpen(true)
      setTimeout(scroll, 400)
    } else {
      scroll()
    }
  }

  const handleSignOut = async () => {
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
  }

  const triggerAvatarUpload = () => {
    setProfileMenuOpen(false)
    fileInputRef.current?.click()
  }

  const handleAvatarFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    try {
      const fileExt = file.name.split('.').pop()
      const filePath = `${user.id}/${Date.now()}.${fileExt}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, {
        upsert: true,
      })
      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('avatars').getPublicUrl(filePath)

      const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl },
      })
      if (updateError) throw updateError

      if (updatedUser) {
        setUser((prev: any) =>
          prev
            ? {
                ...prev,
                user_metadata: {
                  ...(prev.user_metadata || {}),
                  avatar_url: publicUrl,
                },
              }
            : prev
        )
      }
      setProfileMenuOpen(false)
    } catch (error) {
      console.error('Failed to update profile photo:', error)
    } finally {
      if (event.target) {
        event.target.value = ''
      }
    }
  }

  const profileImage = (user?.user_metadata as { avatar_url?: string })?.avatar_url
  const fallbackName = profileName || user?.email || 'Guest'
  const profileInitials = fallbackName
    .split(' ')
    .map((part: string) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
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
    <>
      <div className="flex h-screen bg-black text-white overflow-hidden">
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
                aria-label="Open sidebar"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                onClick={() => router.push('/')}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                aria-label="Home"
              >
                <Home className="w-5 h-5" />
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
                aria-label="Open bankroll"
              >
                <DollarSign className="w-4 h-4" />
              </button>

              <div className="relative" ref={profileMenuRef}>
                <button
                  onClick={() => setProfileMenuOpen((prev) => !prev)}
                  className="h-10 w-10 rounded-full border border-white/20 hover:border-white/60 overflow-hidden transition-colors"
                  aria-label="Profile menu"
                >
                  {profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profileImage} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-sm font-semibold bg-white/10 text-white">
                      {profileInitials}
                    </div>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarFileChange}
                />

                <AnimatePresence>
                  {profileMenuOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-3 w-60 rounded-2xl border border-white/10 bg-[#0f132d] text-white shadow-2xl z-50 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-white/10">
                        <p className="text-sm font-semibold">{fallbackName}</p>
                        <p className="text-xs text-white/60 truncate">{user?.email}</p>
                      </div>
                      <button
                        onClick={triggerAvatarUpload}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
                      >
                        <ImageIcon className="w-4 h-4" />
                        <span>Change Photo</span>
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-300 hover:bg-white/5 border-t border-white/10 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Sign Out</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
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
                    dYZ_
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

      <button
        type="button"
        onClick={scrollToSavedModels}
        className="fixed bottom-4 left-4 z-40 flex items-center gap-2 rounded-full bg-indigo-600/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 backdrop-blur focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:ring-offset-2 focus-visible:ring-offset-black hover:bg-indigo-500 transition"
      >
        <Sparkles className="w-4 h-4" />
        <span>Saved Models</span>
      </button>
    </>
  )
}
