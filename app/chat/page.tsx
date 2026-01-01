"use client"

import { useEffect, useState, useRef, ChangeEvent } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import ModernSidebar from '@/components/ModernSidebar'
import ModernMessageList from '@/components/ModernMessageList'
import ModernMessageInput from '@/components/ModernMessageInput'
import { LiveScoresPreview } from '@/components/LiveScoresPreview'
import { AnimatedHero } from '@/components/ui/animated-hero'
import { SimpleHeader } from '@/components/ui/simple-header'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu, X, Sparkles, Image as ImageIcon, Radio, Activity, ChevronLeft, ChevronRight, Crown, CreditCard, Twitter } from 'lucide-react'
import ChatIntro from '@/components/ChatIntro'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import { countUserMessagesToday, PRO_DAILY_MESSAGE_LIMIT } from '@/lib/utils/message-count'

export default function ChatPage() {
  const [user, setUser] = useState<any>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [hasMessages, setHasMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [liveScoresOpen, setLiveScoresOpen] = useState(false)
  const [liveScoresExpanded, setLiveScoresExpanded] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [messagesToday, setMessagesToday] = useState<number>(0)
  const router = useRouter()
  const supabase = createClient()
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasWarmedUp = useRef(false)

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

      // Allow unauthenticated users to view the chat page
      if (!user) {
        setLoading(false)
        return
      }

      setUser(user)

      // Get membership status from user metadata
      const membershipInfo = getMembershipStatus(user.user_metadata)
      setMembership(membershipInfo)

      // Fetch message count for Pro users
      if (membershipInfo.tier === 'pro' && membershipInfo.isActive) {
        const count = await countUserMessagesToday(supabase, user.id)
        setMessagesToday(count)
      }

      const metadataCompleted = Boolean(
        (user.user_metadata as { onboarding_completed?: boolean })?.onboarding_completed
      )

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('display_name, onboarding_completed')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.warn('Profile lookup failed:', profileError.message)
        if (!metadataCompleted) {
          router.push('/onboarding')
          setLoading(false)
          return
        }
      } else if (profile?.onboarding_completed === false && !metadataCompleted) {
        router.push('/onboarding')
        setLoading(false)
        return
      }

      setProfileName(profile?.display_name || user.email || 'Guest')

      await createInitialConversation(user.id)
      setLoading(false)
    }

    checkUser()
  }, [])

  // Warm up odds endpoints once on load to avoid first-request cold start
  useEffect(() => {
    if (hasWarmedUp.current) return
    hasWarmedUp.current = true
    const warm = async () => {
      try {
        await fetch('/api/warmup', { cache: 'no-store' })
      } catch (err) {
        console.warn('Warmup call failed (non-blocking):', err)
      }
    }
    warm()
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

  const headerActions = (
    <div className="flex items-center gap-2 lg:border-l lg:border-white/10 lg:pl-3">
      {user && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="lg:hidden p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
          aria-label="Open chat history"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      <button
        onClick={() => router.push('/promos')}
        className="sm:hidden p-1 text-[#34d399] hover:text-[#16a34a] transition-colors"
        aria-label="View sportsbook promos"
      >
        <span className="text-[8px] font-bold leading-none tracking-tight">$10k</span>
      </button>
      <button
        onClick={() => router.push('/promos')}
        className="hidden sm:inline-flex items-center px-1 py-1 text-xs font-semibold text-[#34d399] hover:text-[#16a34a] transition-colors"
      >
        <span className="text-[10px] font-bold leading-none">$10k</span>
      </button>

      <button
        onClick={() => setLiveScoresOpen(true)}
        className="sm:hidden p-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-all border border-white/20"
        aria-label="Open live scores preview"
      >
        <Activity className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => router.push('/live-scores')}
        className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#34d399] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
      >
        <Radio className="w-4 h-4" />
        Live Scores
      </button>

      {user && (
        <div className="relative" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="h-7 w-7 sm:h-10 sm:w-10 rounded-full border border-[#2a2a2a] hover:border-white/60 overflow-hidden transition-colors"
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
                className="absolute right-0 mt-3 w-60 rounded-2xl border border-[#1f1f1f] bg-black text-white shadow-2xl z-50 overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-[#1f1f1f]">
                  <p className="text-sm font-semibold">{fallbackName}</p>
                  <p className="text-xs text-white/60 truncate">{user?.email}</p>
                </div>
                {/* Subscription Status */}
                {membership && (
                  <div className="px-4 py-3 border-b border-[#1f1f1f]">
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-4 h-4 text-emerald-400" />
                      <span className="text-sm font-medium">
                        {membership.tier === 'unlimited' ? 'Unlimited' : 'Pro'}
                        {membership.isTrial && (
                          <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-emerald-500/20 text-emerald-400 rounded">
                            Trial
                          </span>
                        )}
                      </span>
                    </div>
                    {membership.tier === 'pro' && membership.isActive && (
                      <p className="text-xs text-white/50">
                        {messagesToday} / {PRO_DAILY_MESSAGE_LIMIT} messages today
                      </p>
                    )}
                    {membership.tier === 'unlimited' && (
                      <p className="text-xs text-white/50">Unlimited messages</p>
                    )}
                  </div>
                )}
                {!membership?.isActive && (
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false)
                      router.push('/pricing')
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-emerald-400 hover:bg-white/5 transition-colors"
                  >
                    <Crown className="w-4 h-4" />
                    <span>Upgrade Plan</span>
                  </button>
                )}
                {membership?.isActive && (
                  <button
                    onClick={async () => {
                      setProfileMenuOpen(false)
                      try {
                        const res = await fetch('/api/stripe/portal', { method: 'POST' })
                        const data = await res.json()
                        if (data.url) {
                          window.location.href = data.url
                        }
                      } catch (err) {
                        console.error('Failed to open billing portal:', err)
                      }
                    }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Manage Subscription</span>
                  </button>
                )}
                <button
                  onClick={triggerAvatarUpload}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/5 transition-colors"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Change Photo</span>
                </button>
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-red-300 hover:bg-white/5 border-t border-[#1f1f1f] transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )

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
            className="w-16 h-16 rounded-full border-4 border-emerald-500 border-t-transparent"
          />
          <p className="text-white/80 text-xl font-medium">Loading DELTA...</p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-black text-white overflow-hidden">
      <SimpleHeader rightSlot={headerActions} onLogoClick={() => handleNewConversation()} />
      <div className="flex flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarOpen(false)}
                className="fixed inset-0 bg-black/80 z-[60] lg:hidden"
              />
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="fixed left-0 top-0 bottom-0 w-80 z-[70] lg:hidden"
              >
                <div className="flex h-full flex-col bg-black">
                  <div className="flex-1 overflow-y-auto">
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
                  </div>
                  <div className="border-t border-[#1f1f1f] p-4">
                    <button
                      type="button"
                      onClick={() => {
                        scrollToSavedModels()
                        setSidebarOpen(false)
                      }}
                      className="flex w-full items-center justify-center gap-2 rounded-full bg-[#34d399] text-[#0f1f15] px-4 py-2 text-sm font-semibold shadow-lg shadow-[#34d399]/30 transition hover:bg-[#16a34a]"
                    >
                      <Sparkles className="w-4 h-4" />
                      Saved Models
                    </button>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex-1 flex flex-col items-center overflow-hidden min-h-0">
            <div className="w-full max-w-5xl flex flex-col h-full min-h-0">
              <div className="flex-1 overflow-hidden min-h-0 pt-[56px] pb-[90px] sm:pt-[96px] sm:pb-[160px]">
                {!user ? (
                  // Guest view - show intro with sign-up prompt
                  <div className="h-full overflow-y-auto">
                    <ChatIntro
                      conversationId=""
                      userId=""
                      onMessageSent={() => {}}
                      isGuest={true}
                      onSignUpClick={() => router.push('/auth/signup')}
                    />
                  </div>
                ) : currentConversationId ? (
                  <ModernMessageList
                    conversationId={currentConversationId}
                    userId={user?.id}
                    onMessagesChange={setHasMessages}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-[#4E4E4E] px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="text-4xl sm:text-6xl mb-6"
                      >
                        <Sparkles className="w-10 h-10 sm:w-12 sm:h-12 text-[#34d399] mx-auto" />
                      </motion.div>
                      <AnimatedHero
                        staticText="Welcome to DELTA"
                        interval={2500}
                      />
                      <p className="text-white/60 text-sm sm:text-base mt-4">
                        Your intelligent sports betting assistant
                      </p>
                    </motion.div>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>

        <button
          type="button"
          className="hidden lg:flex fixed left-4 top-1/2 z-40 -translate-y-1/2 items-center justify-center rounded-full border border-[#34d399] bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#34d399] transition hover:bg-[#34d399] hover:text-[#0f1f15] backdrop-blur"
          onClick={() => setSidebarExpanded(true)}
          aria-label="Open chat history"
        >
          Chat History
        </button>

        <button
          type="button"
          className="hidden lg:flex fixed right-4 top-1/2 z-40 -translate-y-1/2 items-center justify-center rounded-full border border-[#34d399] bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#34d399] transition hover:bg-[#34d399] hover:text-[#0f1f15] backdrop-blur"
          onClick={() => setLiveScoresExpanded(true)}
          aria-label="Open live scores"
        >
          Live Scores
        </button>

        <AnimatePresence>
          {sidebarExpanded && (
            <>
              <motion.div
                key="desktop-sidebar-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSidebarExpanded(false)}
                className="pointer-events-auto absolute inset-0 bg-black/60 backdrop-blur"
              />
              <motion.aside
                key="desktop-sidebar-panel"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="pointer-events-auto absolute inset-y-0 left-0 z-50 w-full max-w-xs border-r border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Menu className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Chat History</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSidebarExpanded(false)}
                    className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ModernSidebar
                    userId={user?.id}
                    currentConversationId={currentConversationId}
                    onConversationSelect={setCurrentConversationId}
                    onNewConversation={handleNewConversation}
                  />
                </div>
                <div className="border-t border-white/10 p-4">
                  <button
                    type="button"
                    onClick={scrollToSavedModels}
                    className="flex w-full items-center justify-center gap-2 rounded-full bg-[#34d399] text-[#0f1f15] px-4 py-2 text-sm font-semibold shadow-lg shadow-[#34d399]/30 transition hover:bg-[#16a34a]"
                  >
                    <Sparkles className="w-4 h-4" />
                    Saved Models
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {liveScoresExpanded && (
            <>
              <motion.div
                key="desktop-live-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setLiveScoresExpanded(false)}
                className="pointer-events-auto absolute inset-0 bg-black/60 backdrop-blur"
              />
              <motion.aside
                key="desktop-live-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="pointer-events-auto absolute inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-400" />
                    <span className="text-sm font-semibold text-white">Live Scores</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLiveScoresExpanded(false)}
                    className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <LiveScoresPreview variant="chat" />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile Live Scores Modal */}
      <AnimatePresence>
        {liveScoresOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLiveScoresOpen(false)}
              className="fixed inset-0 bg-[#2f2f2f]/80 z-[60] lg:hidden"
            />
              <motion.div
                initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 right-0 bottom-0 max-h-[80vh] z-[70] lg:hidden overflow-hidden"
            >
              <div className="bg-black border-t border-[#1f1f1f] rounded-t-2xl">
                <div className="flex items-center justify-between p-4 border-b border-[#1f1f1f]">
                  <h3 className="text-lg font-bold text-white">Live Scores</h3>
                  <button
                    onClick={() => setLiveScoresOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
                  <div className="p-3">
                    <LiveScoresPreview variant="chat" />
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      {currentConversationId && hasMessages && (
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto max-w-5xl px-2 py-1.5 sm:px-4 sm:py-3">
            <ModernMessageInput
              conversationId={currentConversationId}
              userId={user?.id}
            />
          </div>
        </div>
      )}

      <a
        href="https://x.com/AtrainOlillard"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 left-4 z-40 h-10 w-10 rounded-full border border-white/15 bg-black/70 text-white/80 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center"
        aria-label="Visit AtrainOlillard on X"
      >
        <Twitter className="h-4 w-4" />
      </a>
      <a
        href="https://x.com/DeltaSportsAI"
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-4 right-4 z-40 h-10 w-10 rounded-full border border-white/15 bg-black/70 text-white/80 hover:text-white hover:border-white/40 transition-colors flex items-center justify-center"
        aria-label="Visit DeltaSportsAI on X"
      >
        <Twitter className="h-4 w-4" />
      </a>
    </div>
  )
}















