"use client"

import { useEffect, useState, useRef, ChangeEvent, Suspense } from 'react'
import { createPortal } from 'react-dom'
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
import SharpDetectorPanel from '@/components/SharpDetectorPanel'
import ToolsNav from '@/components/tools-nav'
import { motion, AnimatePresence } from 'framer-motion'
import { LogOut, Menu, X, Sparkles, Image as ImageIcon, Radio, ChevronLeft, ChevronRight, Crown, CreditCard, Target, Check, ArrowUpRight, Twitter } from 'lucide-react'
import ChatIntro from '@/components/ChatIntro'
import ModeToggle, { type DeltaMode } from '@/components/ModeToggle'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { getMembershipStatus, type MembershipInfo } from '@/lib/utils/membership'
import { countUserMessagesToday, PRO_DAILY_MESSAGE_LIMIT } from '@/lib/utils/message-count'
import { formatCurrency } from '@/lib/utils/odds'

const SHARP_STORAGE_KEY = 'sharp-detector-trades'
const SHARP_CACHE_VERSION_KEY = 'sharp-detector-cache-version'
const SHARP_CACHE_VERSION = '6'
const EASTERN_TIMEZONE = 'America/New_York'
const PROMO_DISMISS_KEY = 'promo_links_dismissed'
const PROMO_CLICK_KEY = 'promo_links_click_source'
const DISCORD_INVITE_URL = 'https://discord.gg/8jUcaKT9'
const KALSHI_REFERRAL_URL = 'https://kalshi.com/sign-up/?referral=4807d3a2-7c7c-40bb-986c-608115b5a2c5'
const DELTA_MODE_STORAGE_KEY = 'delta-mode'

type SharpTradePreview = {
  id?: string
  marketTitle?: string
  outcome?: string
  notional?: number
  timestamp?: string
  priceCents?: number
  americanOdds?: number | null
  currentPriceCents?: number | null
  currentAmericanOdds?: number | null
  sport?: string
  source?: string
}

const getEasternDateKey = (value: Date | string | number) => {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EASTERN_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (!year || !month || !day) return null
  return `${year}-${month}-${day}`
}

const countSharpsToday = (trades: Array<{ timestamp?: string }>) => {
  const todayKey = getEasternDateKey(new Date())
  if (!todayKey) return 0
  return trades.filter(
    (trade) => getEasternDateKey(trade.timestamp ?? '') === todayKey
  ).length
}

const ensureSharpCacheVersion = () => {
  if (typeof window === 'undefined') return
  try {
    const current = window.localStorage.getItem(SHARP_CACHE_VERSION_KEY)
    if (current !== SHARP_CACHE_VERSION) {
      window.localStorage.removeItem(SHARP_STORAGE_KEY)
      window.localStorage.setItem(SHARP_CACHE_VERSION_KEY, SHARP_CACHE_VERSION)
    }
  } catch (error) {
    console.warn('Failed to validate Whale Feed cache version:', error)
  }
}

const formatTradeTimestamp = (value?: string) => {
  if (!value) return 'n/a'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const formatTradeOdds = (trade: SharpTradePreview) => {
  const priceCents = trade.currentPriceCents ?? trade.priceCents
  const odds = trade.currentAmericanOdds ?? trade.americanOdds
  if (!priceCents && !odds) return 'n/a'
  const centsLabel = priceCents ? `${priceCents}c` : ''
  const oddsLabel = odds != null ? `${odds > 0 ? `+${odds}` : `${odds}`}` : ''
  if (centsLabel && oddsLabel) return `${centsLabel} (${oddsLabel})`
  return centsLabel || oddsLabel
}

const pickLatestTrade = (trades: SharpTradePreview[]) => {
  if (!trades.length) return null
  return trades.reduce<SharpTradePreview | null>((acc, trade) => {
    if (!trade?.timestamp) return acc
    if (!acc?.timestamp) return trade
    const accTime = new Date(acc.timestamp).getTime()
    const tradeTime = new Date(trade.timestamp).getTime()
    return tradeTime > accTime ? trade : acc
  }, null)
}

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
  const [sharpDetectorOpen, setSharpDetectorOpen] = useState(false)
  const [sharpDetectorExpanded, setSharpDetectorExpanded] = useState(false)
  const [sharpUnreadCount, setSharpUnreadCount] = useState(0)
  const [latestSharpTrade, setLatestSharpTrade] = useState<SharpTradePreview | null>(null)
  const [sharpTotalCount, setSharpTotalCount] = useState(() => {
    if (typeof window === 'undefined') return 0
    try {
      ensureSharpCacheVersion()
      const cached = window.localStorage.getItem(SHARP_STORAGE_KEY)
      if (!cached) return 0
      const parsed = JSON.parse(cached)
      return Array.isArray(parsed) ? countSharpsToday(parsed) : 0
    } catch (error) {
      console.warn('Failed to read sharp cache:', error)
      return 0
    }
  })
  const sharpSeenIds = useRef<Set<string>>(new Set())
  const sharpCountInitialized = useRef(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [membership, setMembership] = useState<MembershipInfo | null>(null)
  const [messagesToday, setMessagesToday] = useState<number>(0)
  const [promoDismissed, setPromoDismissed] = useState(false)
  const [promoMounted, setPromoMounted] = useState(false)
  const [guestCalcOpen, setGuestCalcOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const prefillMessage = searchParams.get('prompt') ?? undefined
  const [deltaMode, setDeltaMode] = useState<DeltaMode>('projections')
  const supabase = createClient()
  const profileMenuRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const hasWarmedUp = useRef(false)
  const readCachedSharps = () => {
    if (typeof window === 'undefined') return [] as Array<{ id?: string; timestamp?: string }>
    try {
      ensureSharpCacheVersion()
      const cached = window.localStorage.getItem(SHARP_STORAGE_KEY)
      const parsed = cached ? JSON.parse(cached) : []
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      console.warn('Failed to read sharp cache:', error)
      return []
    }
  }

  const writeCachedSharps = (trades: Array<{ id?: string; timestamp?: string }>) => {
    try {
      window.localStorage.setItem(SHARP_STORAGE_KEY, JSON.stringify(trades))
    } catch (error) {
      console.warn('Failed to persist sharp trades:', error)
    }
  }

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
    setPromoMounted(true)
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
      const storedPromoDismissed =
        typeof window !== 'undefined' &&
        window.localStorage.getItem(PROMO_DISMISS_KEY) === '1'
      setPromoDismissed(
        Boolean(
          storedPromoDismissed ||
            (user.user_metadata as Record<string, any> | null)?.[PROMO_DISMISS_KEY]
        )
      )

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

      // Fetch message count for Free users
      if (membershipInfo.tier === 'free' && membershipInfo.isActive) {
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
    if (typeof window === 'undefined') return
    window.localStorage.setItem(DELTA_MODE_STORAGE_KEY, deltaMode)
    const root = document.documentElement
    root.setAttribute('data-delta-mode', deltaMode)
  }, [deltaMode])

  useEffect(() => {
    if (hasWarmedUp.current) return
    if (!user || !membership?.hasPaidAccess) return
    hasWarmedUp.current = true
    const warm = async () => {
      try {
        await fetch('/api/warmup', { cache: 'no-store' })
      } catch (err) {
        console.warn('Warmup call failed (non-blocking):', err)
      }
    }
    warm()
  }, [user, membership?.hasPaidAccess])

  useEffect(() => {
    if (!hasMessages) return
    setSharpDetectorExpanded(false)
    setSharpDetectorOpen(false)
    setSharpUnreadCount(0)
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

  const handlePromoDismiss = async (
    source: 'discord' | 'kalshi' | 'opt_out' = 'opt_out'
  ) => {
    setPromoDismissed(true)
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(PROMO_DISMISS_KEY, '1')
      } catch (error) {
        console.warn('Failed to persist promo dismissal locally:', error)
      }
    }
    if (!user) return
    try {
      const metadataUpdate: Record<string, unknown> = {
        [PROMO_DISMISS_KEY]: true,
      }
      if (source === 'discord' || source === 'kalshi') {
        metadataUpdate[PROMO_CLICK_KEY] = source
      }
      const { data: updatedUser, error: updateError } = await supabase.auth.updateUser({
        data: metadataUpdate,
      })
      if (updateError) {
        console.warn('Failed to persist promo dismissal:', updateError.message)
        return
      }
      if (updatedUser?.user) {
        setUser((prev: any) =>
          prev
            ? {
                ...prev,
                user_metadata: {
                  ...(prev.user_metadata || {}),
                  [PROMO_DISMISS_KEY]: true,
                  ...(source === 'discord' || source === 'kalshi'
                    ? { [PROMO_CLICK_KEY]: source }
                    : {}),
                },
              }
            : prev
        )
      }
    } catch (error) {
      console.warn('Failed to persist promo dismissal:', error)
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
  const canUseSharpDetector = Boolean(user)
  const isSyndicate = membership?.tier === 'syndicate'
  const projectionsTabs = [
    {
      key: 'market-projections',
      label: 'Sharp Projections',
      shortLabel: 'Markets',
      href: '/market-projections',
      description: 'AI-powered spread, total, and moneyline projections with edge detection',
    },
    {
      key: 'player-prop-odds',
      label: 'Prop Odds',
      shortLabel: 'Props',
      href: '/player-prop-odds',
      description: 'Player prop odds shopper across main books and DFS markets',
    },
    {
      key: 'line-shopping',
      label: 'Line Shopping',
      shortLabel: 'Lines',
      href: '/line-shopping',
      description: 'Compare odds across sportsbooks to find the best lines',
    },
    {
      key: 'parlay-predictor',
      label: 'Parlay Pro',
      shortLabel: 'Parlay',
      href: '/parlay-predictor',
      description: 'Sportsbook EV parlays plus a correlation-aware parlay builder',
    },
    {
      key: 'ev-bets',
      label: 'EV Bets',
      shortLabel: 'EV',
      href: '/ev-bets',
      description: 'Find +EV opportunities using Pinnacle as sharp baseline',
    },
  ]

  const researchTabs = [
    {
      key: 'sharp-action',
      label: 'Sharp Action',
      shortLabel: 'Action',
      href: '/research/sharp-action',
      description: 'Narrative explanations for why sharps are targeting specific games',
    },
    {
      key: 'betting-trends',
      label: 'Betting Trends',
      shortLabel: 'Trends',
      href: '/research/betting-trends',
      description: 'ATS records and historical trends for today\'s games',
    },
    {
      key: 'backtesting',
      label: 'Backtesting',
      shortLabel: 'Backtest',
      href: '/research/backtesting',
      description: 'Simulate betting strategies with historical odds data',
    },
  ]

  const baseChatTabs = deltaMode === 'research' ? researchTabs : projectionsTabs
  const chatTabs = baseChatTabs
  const membershipLabel = membership?.tier
    ? ({ free: 'Free', sharp: 'Sharp', syndicate: 'Syndicate' } as const)[membership.tier] || 'Free'
    : 'Free'
  const showSharpToggle = !hasMessages
  const sharpPanelOpen = sharpDetectorExpanded || sharpDetectorOpen
  const showPromoCard = Boolean(user && !promoDismissed)

  const openSharpDetector = () => {
    if (!canUseSharpDetector) return
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setSharpDetectorExpanded(true)
    } else {
      setSharpDetectorOpen(true)
    }
    setSharpUnreadCount(0)
  }

  const handleSharpNotification = (count: number) => {
    if (!showSharpToggle || sharpPanelOpen) return
    setSharpUnreadCount((prev) => Math.min(9, prev + count))
  }

  useEffect(() => {
    if (!user || !canUseSharpDetector) return
    const cached = readCachedSharps()
    cached.forEach((trade) => {
      if (trade?.id) {
        sharpSeenIds.current.add(trade.id)
      }
    })
    setSharpTotalCount(countSharpsToday(cached))
    const latest = pickLatestTrade(cached as SharpTradePreview[])
    if (latest?.id) {
      setLatestSharpTrade(latest)
    }
  }, [user, canUseSharpDetector])

  useEffect(() => {
    if (!user || !canUseSharpDetector || !showSharpToggle || sharpPanelOpen) return
    let active = true
    const poll = async () => {
      try {
        const res = await fetch('/api/whale-detector?minNotional=2000&limit=200', {
          cache: 'no-store',
        })
        if (!res.ok || !active) return
        const data = await res.json()
        const trades = Array.isArray(data?.trades) ? data.trades : []
        const cached = readCachedSharps()
        const merged = new Map<string, { id?: string; timestamp?: string }>()
        cached.forEach((trade) => {
          if (trade?.id) merged.set(trade.id, trade)
        })
        trades.forEach((trade: { id?: string; timestamp?: string }) => {
          if (trade?.id) merged.set(trade.id, trade)
        })
        const combined = Array.from(merged.values())
        setSharpTotalCount(countSharpsToday(combined))
        if (combined.length > 0) {
          writeCachedSharps(combined)
        }
        const latest = pickLatestTrade(combined as SharpTradePreview[])
        if (latest?.id) {
          setLatestSharpTrade(latest)
        }
        let newCount = 0
        trades.forEach((trade: { id?: string }) => {
          if (!trade?.id) return
          if (!sharpSeenIds.current.has(trade.id)) {
            sharpSeenIds.current.add(trade.id)
            newCount += 1
          }
        })
        if (!sharpCountInitialized.current) {
          sharpCountInitialized.current = true
          return
        }
        if (newCount > 0) {
          setSharpUnreadCount((prev) => Math.min(9, prev + newCount))
        }
      } catch (error) {
        console.warn('Sharp count polling failed:', error)
      }
    }
    poll()
    const interval = setInterval(poll, 30000)
    return () => {
      active = false
      clearInterval(interval)
    }
  }, [user, canUseSharpDetector, showSharpToggle, sharpPanelOpen])

  const headerActions = (
      <div className="flex items-center gap-1.5 lg:border-l lg:border-white/10 lg:pl-2">
        <button
          onClick={() => router.push('/pricing')}
          className="px-2 py-1 text-[#34d399] hover:text-[#16a34a] transition-colors"
          aria-label="View pricing"
        >
          <span className="text-[10px] sm:text-xs font-semibold leading-none">Pricing</span>
        </button>
        <button
          onClick={() => router.push('/live-scores')}
          className="inline-flex items-center gap-2 rounded-full border border-[#34d399]/60 px-4 py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
        >
          <Radio className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
          <span className="hidden sm:inline">Live</span>
          <span className="sm:hidden">Live</span>
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
                    {membership.tier === 'free' && membership.isActive && (
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
          widthClass="max-w-6xl"
          rightSlot={headerActions}
          onLogoClick={() => handleNewConversation()}
        />
      {user && (
        <div className="sm:hidden px-2 pt-2">
          <ToolsNav hideMobileTop showMobileChatBack={false} />
        </div>
      )}
      {user && showSharpToggle && (
        <div className="sm:hidden fixed left-0 right-0 top-12 z-40 border-b border-emerald-400/30 bg-black/90 backdrop-blur">
          <div className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                Whale Feed
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
                {canUseSharpDetector ? `${sharpTotalCount} sharps detected today` : 'Syndicate only'}
              </p>
            </div>
            <div className="relative flex items-center gap-2">
              {sharpUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-semibold text-black">
                    {sharpUnreadCount}
                  </span>
                </span>
              )}
              <ParticleButton
                type="button"
                disabled={!canUseSharpDetector}
                onClick={openSharpDetector}
                className="gap-2 rounded-full bg-emerald-400/20 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  canUseSharpDetector
                    ? 'Open Whale Feed'
                    : 'Syndicate required to access Whale Feed'
                }
              >
                Open Sharps
              </ParticleButton>
            </div>
          </div>
        </div>
      )}
      {user && currentConversationId && (
        <div className={`fixed left-0 right-0 top-12 sm:top-16 z-40 border-b ${deltaMode === 'research' ? 'border-amber-500/30' : 'border-emerald-500/30'} bg-gradient-to-b from-black via-black/95 to-black/90 backdrop-blur-xl shadow-lg ${deltaMode === 'research' ? 'shadow-amber-500/5' : 'shadow-emerald-500/5'}`}>
          <div className={`hidden sm:grid w-full ${
            chatTabs.length === 3
              ? 'grid-cols-3'
              : chatTabs.length === 5
                ? 'grid-cols-5'
                : 'grid-cols-4'
          }`}>
            {chatTabs.map((tab, index) => (
              <Link
                key={tab.label}
                href={tab.href}
                className={`group relative w-full px-1 py-3 text-center transition-all ${deltaMode === 'research' ? 'hover:bg-amber-500/15' : 'hover:bg-emerald-500/15'} sm:px-3 sm:py-4`}
              >
                <span className={`relative z-10 text-[10px] font-bold uppercase tracking-[0.15em] text-white/90 ${deltaMode === 'research' ? 'group-hover:text-amber-300' : 'group-hover:text-emerald-300'} sm:text-xs lg:text-sm`}>
                  <span className="sm:hidden">{tab.shortLabel}</span>
                  <span className="hidden sm:inline">{tab.label}</span>
                </span>
                <span className={`absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent ${deltaMode === 'research' ? 'via-amber-400/50' : 'via-emerald-400/50'} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
                {index < chatTabs.length - 1 && (
                  <span className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-px bg-white/10" />
                )}
                {/* Desktop hover tooltip */}
                {tab.description && (
                  <span className={`pointer-events-none absolute left-1/2 top-full z-50 mt-2 hidden w-48 -translate-x-1/2 rounded-lg border ${deltaMode === 'research' ? 'border-amber-500/30' : 'border-emerald-500/30'} bg-black/95 px-3 py-2 text-[11px] font-normal normal-case tracking-normal text-white/80 shadow-xl backdrop-blur-xl lg:group-hover:block`}>
                    {tab.description}
                    <span className={`absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 border-l border-t ${deltaMode === 'research' ? 'border-amber-500/30' : 'border-emerald-500/30'} bg-black/95`} />
                  </span>
                )}
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
              <div className="flex-1 overflow-hidden min-h-0 pt-[152px] pb-[150px] sm:pt-[144px] sm:pb-[160px]">
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
                      <div className="mx-auto w-full max-w-5xl h-full min-h-0 flex flex-col">
                        <div className="flex-1 min-h-0">
                          <ModernMessageList
                            conversationId={currentConversationId}
                            userId={user?.id}
                            onMessagesChange={setHasMessages}
                            prefillMessage={prefillMessage}
                            mode={deltaMode}
                            onModeChange={setDeltaMode}
                          />
                        </div>
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
                      <div className="mb-6 w-full max-w-md rounded-2xl border border-[#2a2a2a] bg-black/70 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex flex-col gap-2 text-left">
                            <span className="text-[10px] uppercase tracking-[0.3em] text-white/50">
                              Patch 0.5
                            </span>
                            <span className="text-sm text-white/80">
                              Free tier previews, Odds API expansion, research upgrades.
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 text-white/70">
                            <ArrowUpRight className="h-4 w-4 text-emerald-300" />
                            <span className="text-[10px] uppercase tracking-[0.25em] text-white/60">
                              follow our twitter
                            </span>
                            <Link
                              href="https://x.com/DeltaSportsAI"
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Delta Sports on X"
                              className="relative z-20 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/5 text-white/70 transition-colors hover:border-emerald-400/60 hover:text-emerald-200 pointer-events-auto"
                            >
                              <Twitter className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                        <Link
                          href="/patch-notes"
                          className="relative z-10 pointer-events-auto mt-3 inline-flex items-center gap-2 rounded-full border border-[#34d399] px-3 py-1 text-[10px] uppercase tracking-[0.3em] text-[#34d399] hover:bg-[#34d399] hover:text-[#0f1f15] transition-colors"
                        >
                          View Patch Notes
                        </Link>
                      </div>

                      {/* Mode Toggle */}
                      <div className="mb-6">
                        <ModeToggle mode={deltaMode} onChange={setDeltaMode} />
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
        {sharpDetectorExpanded && (
          <motion.div
            key="desktop-sharp-fullpage"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="pointer-events-auto fixed inset-0 z-[80] bg-black/95 backdrop-blur-xl overflow-y-auto"
            >
              <div className="min-h-full">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/80 backdrop-blur px-6 py-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
                      Whale Feed
                    </p>
                    <p className="mt-1 text-xs text-white/60">
                      {sharpTotalCount} sharps detected today &bull; $2k+ trade alerts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSharpDetectorExpanded(false)}
                    className="p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                    aria-label="Close Whale Feed"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="w-full p-6">
                  <SharpDetectorPanel
                    onNewSharp={handleSharpNotification}
                    onCountChange={setSharpTotalCount}
                    isSyndicate={isSyndicate}
                    showLocalAlerts={false}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      {user && showSharpToggle && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-emerald-400/30 bg-black/90 backdrop-blur">
          <div className="hidden sm:grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                Whale Feed
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-[0.3em] text-white/50">
                {canUseSharpDetector ? `${sharpTotalCount} sharps detected today` : 'Syndicate only'}
              </p>
              <p className="text-[11px] text-white/60">
                $2k+ trades with price in cents + American odds.
              </p>
            </div>
            {canUseSharpDetector && latestSharpTrade && (
              <div className="hidden md:block px-4">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={latestSharpTrade.id ?? latestSharpTrade.timestamp}
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ type: 'spring', stiffness: 140, damping: 18 }}
                    className="text-[11px] font-semibold uppercase tracking-[0.2em] text-center truncate bg-gradient-to-r from-emerald-300 via-emerald-200 to-emerald-300 bg-clip-text text-transparent"
                  >
                    Latest: {latestSharpTrade.marketTitle || 'Unknown market'} -{' '}
                    {latestSharpTrade.outcome || 'Unknown outcome'}{' '}
                    {formatTradeOdds(latestSharpTrade)} -{' '}
                    {formatCurrency(latestSharpTrade.notional ?? 0)} -{' '}
                    {formatTradeTimestamp(latestSharpTrade.timestamp)}
                  </motion.p>
                </AnimatePresence>
              </div>
            )}
            <div className="relative flex items-center justify-end gap-3">
              {!canUseSharpDetector && (
                <span className="rounded-full border border-emerald-400/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-200/80">
                  Syndicate Only
                </span>
              )}
              {sharpUnreadCount > 0 && (
                <span className="absolute -top-2 -right-2 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
                  <span className="relative inline-flex h-4 w-4 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-semibold text-black">
                    {sharpUnreadCount}
                  </span>
                </span>
              )}
              <ParticleButton
                type="button"
                disabled={!canUseSharpDetector}
                onClick={openSharpDetector}
                className="gap-2 rounded-full bg-emerald-400/20 px-5 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:bg-emerald-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
                title={
                  canUseSharpDetector
                    ? 'Open Whale Feed'
                    : 'Syndicate required to access Whale Feed'
                }
              >
                Open Whale Feed
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

      {promoMounted && showPromoCard && typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/70 backdrop-blur-md px-4 py-6">
            <div className="relative w-full max-w-xl rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/15 via-black/85 to-black/70 p-6 shadow-2xl">
              <div className="space-y-5">
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                    Join the Discord
                  </p>
                  <h2 className="text-xl font-semibold text-white">
                    Join the community
                  </h2>
                  <p className="text-sm text-white/60">
                    Connect with the crew for alerts, model drops, and live chatter.
                  </p>
                  <Link
                    href={DISCORD_INVITE_URL}
                    onClick={() => void handlePromoDismiss('discord')}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                  >
                    Join Discord
                  </Link>
                </div>
                <div className="border-t border-white/10 pt-4 space-y-2">
                  <p className="text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
                    Kalshi referral
                  </p>
                  <h3 className="text-base font-semibold text-white">
                    Get $10 free when you trade $10 on Kalshi.
                  </h3>
                  <p className="text-sm text-white/60">
                    Use the referral link to activate the bonus.
                  </p>
                  <Link
                    href={KALSHI_REFERRAL_URL}
                    onClick={() => void handlePromoDismiss('kalshi')}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-400/60 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                  >
                    Claim $10 on Kalshi
                  </Link>
                  <p className="text-[11px] text-white/50">
                    Referral disclosure: I receive $10 too if you sign up and trade. Offer
                    subject to Kalshi terms and eligibility; must be 18+ and in an approved
                    location. Not financial advice.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handlePromoDismiss('opt_out')}
                className="absolute bottom-4 right-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-emerald-400/50 bg-black/70 text-emerald-200 hover:border-emerald-300 hover:text-white transition-colors"
                aria-label="Hide this message"
                title="Hide this message"
              >
                <Check className="h-4 w-4" />
              </button>
            </div>
          </div>,
          document.body
        )}

      {/* Mini ROI calculator for guests */}
      {!user && (
        <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[320px] z-50">
          <div className="sm:hidden">
            {guestCalcOpen ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setGuestCalcOpen(false)}
                  className="absolute -top-3 -right-2 rounded-full border border-emerald-400/40 bg-black/80 px-2.5 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-200"
                >
                  Close
                </button>
                <ROICalculator
                  variant="mini"
                  heading="Calculate Your Edge"
                  description="Here's what you can make betting with delta's edge:"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setGuestCalcOpen(true)}
                className="ml-auto flex items-center gap-2 rounded-full border border-emerald-400/40 bg-black/80 px-4 py-2 text-[10px] uppercase tracking-[0.25em] text-emerald-200 shadow-lg shadow-emerald-500/20"
              >
                Calculate Edge
              </button>
            )}
          </div>
          <div className="hidden sm:block">
            <ROICalculator
              variant="mini"
              heading="Calculate Your Edge"
              description="Here's what you can make betting with delta's edge:"
            />
          </div>
        </div>
      )}

      {/* Mobile Whale Feed Full-Page Overlay */}
      <AnimatePresence>
        {sharpDetectorOpen && (
          <motion.div
            key="mobile-sharp-fullpage"
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-xl overflow-y-auto lg:hidden"
          >
            <div className="min-h-full">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-black/80 backdrop-blur px-4 py-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-300">
                    Whale Feed
                  </p>
                  <p className="mt-1 text-xs text-white/60">
                    {sharpTotalCount} sharps detected &bull; $2k+ trade alerts
                  </p>
                </div>
                <button
                  onClick={() => setSharpDetectorOpen(false)}
                  className="p-2 rounded-full bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-colors"
                  aria-label="Close Whale Feed"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="p-4 pb-20">
                <SharpDetectorPanel
                  onNewSharp={handleSharpNotification}
                  onCountChange={setSharpTotalCount}
                  isSyndicate={isSyndicate}
                  showLocalAlerts={false}
                />
              </div>
            </div>
          </motion.div>
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
