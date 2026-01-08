"use client"

import { useEffect, useState, useRef, ChangeEvent, Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ModernSidebar from '@/components/ModernSidebar'
import ModernMessageList from '@/components/ModernMessageList'
import RichMessageInput from '@/components/chat/RichMessageInput'
import { LiveScoresPreview } from '@/components/LiveScoresPreview'
import { AnimatedHero } from '@/components/ui/animated-hero'
import { SimpleHeader } from '@/components/ui/simple-header'
import { ParticleButton } from '@/components/ui/particle-button'
import WhaleDetectorPanel from '@/components/WhaleDetectorPanel'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu, X, Sparkles, Image as ImageIcon, Radio, ChevronLeft, ChevronRight, Crown, CreditCard, MessageSquare } from 'lucide-react'
import ChatIntro from '@/components/ChatIntro'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import { countUserMessagesToday, PRO_DAILY_MESSAGE_LIMIT } from '@/lib/utils/message-count'

const WHALE_STORAGE_KEY = 'whale-detector-trades'

function ChatPageContent() {
  const [user, setUser] = useState<any>(null)
  const [profileName, setProfileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [hasMessages, setHasMessages] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const [liveScoresOpen, setLiveScoresOpen] = useState(false)
  const [liveScoresExpanded, setLiveScoresExpanded] = useState(false)
  const [whaleDetectorOpen, setWhaleDetectorOpen] = useState(false)
  const [whaleDetectorExpanded, setWhaleDetectorExpanded] = useState(false)
  const [whaleUnreadCount, setWhaleUnreadCount] = useState(0)
  const [whaleTotalCount, setWhaleTotalCount] = useState(() => {
    if (typeof window === 'undefined') return 0
    try {
      const cached = window.localStorage.getItem(WHALE_STORAGE_KEY)
      if (!cached) return 0
      const parsed = JSON.parse(cached)
      return Array.isArray(parsed) ? parsed.length : 0
    } catch (error) {
      console.warn('Failed to read whale cache:', error)
      return 0
    }
  })
  const whaleSeenIds = useRef<Set<string>>(new Set())
  const whaleCountInitialized = useRef(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [messagesToday, setMessagesToday] = useState<number>(0)
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillMessage = searchParams.get('prompt') ?? undefined
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

      const forceOnboarding =
        process.env.NEXT_PUBLIC_FORCE_ONBOARDING === 'true'
      if (forceOnboarding) {
        router.push('/onboarding')
        setLoading(false)
        return
      }

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

  useEffect(() => {
    if (!hasMessages) return
    setWhaleDetectorExpanded(false)
    setWhaleDetectorOpen(false)
    setWhaleUnreadCount(0)
  }, [hasMessages])

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
  const canUseWhaleDetector = Boolean(user && membership?.isActive)
  const chatTabs = [
    {
      label: 'Market Projections',
      shortLabel: 'Markets',
      href: '/market-projections',
    },
    {
      label: 'Player Projections',
      shortLabel: 'Players',
      href: '/player-projections',
    },
    {
      label: 'Parlay Predictor',
      shortLabel: 'Parlay',
      href: '/parlay-predictor',
    },
    {
      label: 'EV Bets',
      shortLabel: 'EV',
      href: '/ev-bets',
    },
    {
      label: 'Live Projections',
      shortLabel: 'Live',
      href: '/live-projections',
    },
  ]
  const membershipLabel = membership?.tier
    ? ({ pro: 'Pro', sharp: 'Sharp', syndicate: 'Syndicate' } as const)[membership.tier] || 'Pro'
    : 'Pro'
  const showWhaleToggle = !hasMessages
  const whalePanelOpen = whaleDetectorExpanded || whaleDetectorOpen

  const openWhaleDetector = () => {
    if (!canUseWhaleDetector) return
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setWhaleDetectorExpanded(true)
    } else {
      setWhaleDetectorOpen(true)
    }
    setWhaleUnreadCount(0)
  }

  const handleWhaleNotification = (count: number) => {
    if (!showWhaleToggle || whalePanelOpen) return
    setWhaleUnreadCount((prev) => Math.min(9, prev + count))
  }

  const readCachedWhales = () => {
    if (typeof window === 'undefined') return [] as Array<{ id?: string }>
    try {
      const cached = window.localStorage.getItem(WHALE_STORAGE_KEY)
      const parsed = cached ? JSON.parse(cached) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('Failed to read whale cache:', error)
      return []
    }
  }

  const writeCachedWhales = (trades: Array<{ id?: string }>) => {
    try {
      window.localStorage.setItem(WHALE_STORAGE_KEY, JSON.stringify(trades))
    } catch (error) {
      console.warn('Failed to persist whale trades:', error)
    }
  }

  useEffect(() => {
    if (!user) return
    const cached = readCachedWhales()
    cached.forEach((trade) => {
      if (trade?.id) {
        whaleSeenIds.current.add(trade.id)
      }
    })
    setWhaleTotalCount(cached.length)
  }, [user])

  useEffect(() => {
    if (!user || !showWhaleToggle || whalePanelOpen) return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch('/api/whale-detector?minNotional=2000&limit=200', {
          cache: 'no-store',
        })
        if (!res.ok || !active) return
        const data = await res.json()
        const trades = Array.isArray(data?.trades) ? data.trades : []
        const cached = readCachedWhales()
        const merged = new Map<string, { id?: string }>()
        cached.forEach((trade) => {
          if (trade?.id) merged.set(trade.id, trade)
        })
        trades.forEach((trade: { id?: string }) => {
          if (trade?.id) merged.set(trade.id, trade)
        })
        const combined = Array.from(merged.values())
        setWhaleTotalCount(combined.length)
        if (combined.length > 0) {
          writeCachedWhales(combined)
        }
        let newCount = 0
        trades.forEach((trade: { id?: string }) => {
          if (!trade?.id) return
          if (!whaleSeenIds.current.has(trade.id)) {
            whaleSeenIds.current.add(trade.id)
            newCount += 1
          }
        })
        if (!whaleCountInitialized.current) {
          whaleCountInitialized.current = true
          return
        }
        if (newCount > 0) {
          setWhaleUnreadCount((prev) => Math.min(9, prev + newCount))
        }
      } catch (error) {
        console.warn('Whale count polling failed:', error)
      }
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user, showWhaleToggle, whalePanelOpen])

  const headerActions = (
    <div className="flex items-center gap-2 lg:border-l lg:border-white/10 lg:pl-3">
      <button
        onClick={() => router.push('/promos')}
        className="sm:hidden px-2 py-2 text-[#34d399] hover:text-[#16a34a] transition-colors"
        aria-label="View sportsbook promos"
      >
        <span className="text-sm font-semibold leading-none">$10k</span>
      </button>
      <button
        onClick={() => router.push('/promos')}
        className="hidden sm:inline-flex items-center px-3 py-2 text-base font-semibold text-[#34d399] hover:text-[#16a34a] transition-colors"
      >
        <span className="text-base font-semibold leading-none">$10k</span>
      </button>

      <button
        onClick={() => router.push('/live-scores')}
        className="inline-flex items-center gap-2 rounded-full border border-[#34d399] px-3 sm:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
      >
        <Radio className="w-3 h-3 sm:w-4 sm:h-4" />
        Live Odds
      </button>

      {user && (
        <div className="relative hidden sm:block" ref={profileMenuRef}>
          <button
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            className="h-10 w-10 rounded-full border border-[#2a2a2a] hover:border-white/60 overflow-hidden transition-colors"
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
                        {membershipLabel}
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
                    {(membership.tier === 'sharp' || membership.tier === 'syndicate') && (
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
      <SimpleHeader
        rightSlot={headerActions}
        mobileLeftSlot={user ? (
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Open chat history"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium uppercase tracking-wide">History</span>
          </button>
        ) : undefined}
        onLogoClick={() => handleNewConversation()}
      />
      {user && currentConversationId && (
        <div className="fixed left-0 right-0 top-12 sm:top-16 z-40 border-b border-white/10 bg-black/90 backdrop-blur">
          <div className="grid w-full grid-cols-5 divide-x divide-white/10">
            {chatTabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="w-full px-1 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/75 transition-colors hover:bg-emerald-500/10 hover:text-emerald-200 sm:px-2 sm:py-3 sm:text-[11px] lg:text-sm"
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
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
            <div className="w-full max-w-none flex flex-col h-full min-h-0">
              <div className="flex-1 overflow-hidden min-h-0 pt-[104px] pb-[90px] sm:pt-[144px] sm:pb-[160px]">
                {!user ? (
                  // Guest view - show intro with sign-up prompt
                  <div className="h-full overflow-y-auto">
                    <ChatIntro
                      conversationId=""
                      userId=""
                      onMessageSent={() => {}}
                      isGuest={true}
                      onSignUpClick={() => router.push('/auth/signup')}
                      prefillMessage={prefillMessage}
                    />
                  </div>
                ) : currentConversationId ? (
                  <div className="h-full flex flex-col">
                    <div className="flex-1 overflow-hidden min-h-0">
                      <div className="mx-auto w-full max-w-5xl h-full min-h-0">
                        <ModernMessageList
                          conversationId={currentConversationId}
                          userId={user?.id}
                          onMessagesChange={setHasMessages}
                          prefillMessage={prefillMessage}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full bg-[#4E4E4E] px-4">
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-center"
                    >
                      <div className="mb-6 flex flex-col items-center gap-3 rounded-2xl border border-[#2a2a2a] bg-black/70 px-4 py-3">
                        <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                          Patch 0.2
                        </span>
                        <span className="text-sm text-white/80">
                          Whale detection, new dashboards, and a sharper live odds experience.
                        </span>
                        <Link
                          href="/patch-notes"
                          className="relative z-10 pointer-events-auto inline-flex items-center gap-2 rounded-full border border-[#34d399] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
                        >
                          View Patch Notes
                        </Link>
                      </div>
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
      </div>

      {user && (
          <button
            type="button"
            className="hidden lg:flex fixed left-4 top-1/2 z-40 -translate-y-1/2 items-center justify-center rounded-full border border-[#34d399] bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#34d399] transition hover:bg-[#34d399] hover:text-[#0f1f15] backdrop-blur"
            onClick={() => setSidebarExpanded(true)}
            aria-label="Open chat history"
          >
            Chat History
          </button>
        )}

        {user && (
          <button
            type="button"
            className="hidden lg:flex fixed right-4 top-1/2 z-40 -translate-y-1/2 items-center justify-center rounded-full border border-[#34d399] bg-black/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-[#34d399] transition hover:bg-[#34d399] hover:text-[#0f1f15] backdrop-blur"
            onClick={() => setLiveScoresExpanded(true)}
            aria-label="Open live scores"
          >
            Live Scores
          </button>
        )}

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

        <AnimatePresence>
          {whaleDetectorExpanded && (
            <>
              <motion.div
                key="desktop-whale-backdrop"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setWhaleDetectorExpanded(false)}
                className="pointer-events-auto absolute inset-0 bg-black/60 backdrop-blur"
              />
              <motion.aside
                key="desktop-whale-panel"
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="pointer-events-auto absolute inset-y-0 right-0 z-50 w-full max-w-sm border-l border-white/10 bg-black/80 backdrop-blur-xl shadow-2xl overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                      Whale Detector
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
                      {whaleTotalCount} whales detected
                    </p>
                    <p className="text-[11px] text-white/60">$2k+ trade alerts</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setWhaleDetectorExpanded(false)}
                    className="p-1 rounded-full bg-white/10 text-white/60 hover:text-white"
                    aria-label="Close whale detector"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4">
                  <WhaleDetectorPanel
                    onNewWhale={handleWhaleNotification}
                    onCountChange={setWhaleTotalCount}
                  />
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

      {user && showWhaleToggle && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-400/30 bg-black/90 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                Whale Detector
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
                {whaleTotalCount} whales detected
              </p>
              <p className="text-[11px] text-white/60">
                $2k+ trades with price in cents + American odds.
              </p>
            </div>
            <div className="relative flex items-center gap-3">
              {!canUseWhaleDetector && (
                <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-200/80">
                  Members Only
                </span>
              )}
              {whaleUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-semibold text-black">
                    {whaleUnreadCount}
                  </span>
                </span>
              )}
              <ParticleButton
                type="button"
                disabled={!canUseWhaleDetector}
                onClick={openWhaleDetector}
                className="gap-2 rounded-full bg-emerald-400/20 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  canUseWhaleDetector
                    ? 'Open Whale Detector'
                    : 'Membership required to access Whale Detector'
                }
              >
                Open Whale Detector
              </ParticleButton>
            </div>
          </div>
        </div>
      )}

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

      {/* Mobile Whale Detector Modal */}
      <AnimatePresence>
        {whaleDetectorOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setWhaleDetectorOpen(false)}
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
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-emerald-300/80">
                      Whale Detector
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
                      {whaleTotalCount} whales detected
                    </p>
                    <p className="text-[11px] text-white/60">$2k+ trade alerts</p>
                  </div>
                  <button
                    onClick={() => setWhaleDetectorOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors"
                    aria-label="Close whale detector"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
                  <div className="p-4">
                    <WhaleDetectorPanel
                      onNewWhale={handleWhaleNotification}
                      onCountChange={setWhaleTotalCount}
                    />
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
            <RichMessageInput
              conversationId={currentConversationId}
              userId={user?.id}
            />
          </div>
        </div>
      )}

    </div>
  )
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white" />}>
      <ChatPageContent />
    </Suspense>
  )
}















