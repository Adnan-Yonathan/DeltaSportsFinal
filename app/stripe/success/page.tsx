'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMembershipStatusFromMetadata } from '@/lib/utils/membership'

type OnboardingProfile = {
  favorite_sports?: string[]
  preferred_markets?: string[]
  experience_level?: string
  risk_tolerance?: string
  signup_reasons?: string[]
}

type ToolDefinition = {
  id: string
  title: string
  description: string
  href: string
  goals?: string[]
  markets?: string[]
  risk?: string[]
  experience?: string[]
}

type ToolRecommendation = ToolDefinition & { tags: string[] }

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    id: 'live-scores',
    title: 'Live Scores + Line Shopping',
    description: 'Compare odds across books and jump into line shopping fast.',
    href: '/live-scores',
    goals: ['live-lines', 'arbitrage-ev', 'alerts'],
    markets: ['spreads', 'totals', 'moneyline'],
  },
  {
    id: 'arb-ev',
    title: 'Arbitrage + EV Scanner',
    description: 'Spot pricing gaps and value windows on the odds board.',
    href: '/live-scores',
    goals: ['arbitrage-ev'],
    markets: ['spreads', 'totals', 'moneyline'],
    risk: ['moderate', 'aggressive'],
  },
  {
    id: 'props',
    title: 'Player Prop Analyzer',
    description: 'Use the copilot to compare prop lines and recent form.',
    href: '/chat',
    goals: ['prop-edges'],
    markets: ['player-props'],
    risk: ['moderate', 'aggressive'],
  },
  {
    id: 'matchups',
    title: 'Matchup Research',
    description: 'Get matchup notes, edges, and market context in chat.',
    href: '/chat',
    goals: ['matchup-research'],
    markets: ['spreads', 'totals', 'moneyline'],
  },
  {
    id: 'education',
    title: 'Betting Education',
    description: 'Review fundamentals, market terms, and risk discipline.',
    href: '/docs',
    goals: ['education'],
    risk: ['conservative'],
    experience: ['beginner'],
  },
  {
    id: 'models',
    title: 'Custom Models',
    description: 'Upload or test models for sharper projections.',
    href: '/models',
    goals: ['matchup-research', 'prop-edges'],
    experience: ['advanced'],
  },
]

const SPORT_LABELS: Record<string, string> = {
  nba: 'NBA',
  ncaab: 'NCAAB',
  nfl: 'NFL',
  ncaaf: 'NCAAF',
  mlb: 'MLB',
  nhl: 'NHL',
  other: 'Other',
}

const MARKET_LABELS: Record<string, string> = {
  spreads: 'Spreads',
  totals: 'Totals',
  moneyline: 'Moneyline',
  'player-props': 'Player props',
  sgp: 'Parlays',
}

const GOAL_LABELS: Record<string, string> = {
  'live-lines': 'Live lines',
  'prop-edges': 'Prop edges',
  'matchup-research': 'Matchup research',
  'arbitrage-ev': 'Arbitrage and EV',
  education: 'Betting education',
  alerts: 'Alerts',
}

const RISK_LABELS: Record<string, string> = {
  conservative: 'Conservative',
  moderate: 'Moderate',
  aggressive: 'Aggressive',
}

const normalizeList = (value?: string[]) =>
  Array.isArray(value) ? value.filter(Boolean) : []

const formatList = (value: string[] | undefined, labels: Record<string, string>, fallback: string) => {
  const items = normalizeList(value).map((item) => labels[item] ?? item.toUpperCase())
  return items.length ? items.join(', ') : fallback
}

const intersectionCount = (a: string[], b: string[]) =>
  a.reduce((total, item) => (b.includes(item) ? total + 1 : total), 0)

const scoreTool = (tool: ToolDefinition, profile: OnboardingProfile | null) => {
  if (!profile) return 0
  const goals = normalizeList(profile.signup_reasons)
  const markets = normalizeList(profile.preferred_markets)
  let score = 0

  if (tool.goals?.length) {
    score += intersectionCount(tool.goals, goals) * 3
  }
  if (tool.markets?.length) {
    score += intersectionCount(tool.markets, markets) * 2
  }
  if (profile.risk_tolerance && tool.risk?.includes(profile.risk_tolerance)) {
    score += 1
  }
  if (profile.experience_level && tool.experience?.includes(profile.experience_level)) {
    score += 1
  }

  return score
}

const buildTags = (tool: ToolDefinition, profile: OnboardingProfile | null) => {
  if (!profile) return []
  const tags: string[] = []
  const goals = normalizeList(profile.signup_reasons)
  const markets = normalizeList(profile.preferred_markets)

  if (tool.goals?.length) {
    tool.goals.forEach((goal) => {
      if (goals.includes(goal)) {
        tags.push(GOAL_LABELS[goal] ?? goal)
      }
    })
  }

  if (tool.markets?.length) {
    tool.markets.forEach((market) => {
      if (markets.includes(market)) {
        tags.push(MARKET_LABELS[market] ?? market)
      }
    })
  }

  if (profile.risk_tolerance && tool.risk?.includes(profile.risk_tolerance)) {
    tags.push(`Risk: ${RISK_LABELS[profile.risk_tolerance] ?? profile.risk_tolerance}`)
  }

  return tags.slice(0, 3)
}

const buildRecommendations = (profile: OnboardingProfile | null): ToolRecommendation[] => {
  const scored = TOOL_DEFINITIONS.map((tool) => ({
    tool,
    score: scoreTool(tool, profile),
  }))

  const ranked = scored
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.tool)

  const selected: ToolDefinition[] = []
  ranked.forEach((tool) => {
    if (selected.length >= 4) return
    if (!profile || scoreTool(tool, profile) > 0) {
      selected.push(tool)
    }
  })

  if (selected.length < 4) {
    TOOL_DEFINITIONS.forEach((tool) => {
      if (selected.length >= 4) return
      if (!selected.find((item) => item.id === tool.id)) {
        selected.push(tool)
      }
    })
  }

  return selected.slice(0, 4).map((tool) => ({
    ...tool,
    tags: buildTags(tool, profile),
  }))
}

const isSafeInternalPath = (value: string | null): value is string => {
  if (!value) return false
  if (!value.startsWith('/')) return false
  if (value.startsWith('//')) return false
  if (value.includes('://')) return false
  if (value.includes('\\')) return false
  return true
}

export default function StripeSuccessPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'checking' | 'success' | 'timeout'>('checking')
  const [attempts, setAttempts] = useState(0)
  const [profile, setProfile] = useState<OnboardingProfile | null>(null)
  const [profileLoaded, setProfileLoaded] = useState(false)
  const maxAttempts = 15 // 15 attempts * 2 seconds = 30 seconds max

  const recommendations = useMemo(
    () => buildRecommendations(profile),
    [profile]
  )

  const getPostCheckoutRedirect = () => {
    if (typeof window === 'undefined') return null
    const params = new URLSearchParams(window.location.search)
    const next = params.get('next')
    const step = params.get('step')

    if (isSafeInternalPath(next) && next !== '/onboarding') {
      return next
    }

    if (next === '/onboarding' && step) {
      return `/onboarding?step=${encodeURIComponent(step)}`
    }

    return null
  }

  const summaryItems = useMemo(() => {
    return [
      {
        label: 'Sports focus',
        value: formatList(profile?.favorite_sports, SPORT_LABELS, 'Any'),
      },
      {
        label: 'Markets',
        value: formatList(profile?.preferred_markets, MARKET_LABELS, 'Any'),
      },
      {
        label: 'Risk tolerance',
        value: profile?.risk_tolerance
          ? RISK_LABELS[profile.risk_tolerance] ?? profile.risk_tolerance
          : 'Not set',
      },
      {
        label: 'Style',
        value: formatList(profile?.signup_reasons, GOAL_LABELS, 'Any'),
      },
    ]
  }, [profile])

  const hasProfile = useMemo(() => {
    if (!profile) return false
    return (
      normalizeList(profile.favorite_sports).length > 0 ||
      normalizeList(profile.preferred_markets).length > 0 ||
      normalizeList(profile.signup_reasons).length > 0 ||
      Boolean(profile.risk_tolerance) ||
      Boolean(profile.experience_level)
    )
  }, [profile])

  useEffect(() => {
    const checkSubscription = async () => {
      const supabase = createClient()

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Not logged in, redirect to login
        router.push('/auth/login')
        return
      }

      // Check membership status from user metadata
      const membership = getMembershipStatusFromMetadata(user.user_metadata)

      if (membership.isActive) {
        setStatus('success')
        const postCheckoutRedirect = getPostCheckoutRedirect()
        if (postCheckoutRedirect) {
          router.replace(postCheckoutRedirect)
          return
        }
        if (!profileLoaded) {
          const metadataProfile = user.user_metadata?.onboarding_profile
          if (metadataProfile && typeof metadataProfile === 'object') {
            setProfile(metadataProfile)
            setProfileLoaded(true)
          } else {
            const { data } = await supabase
              .from('users')
              .select('favorite_sports, preferred_markets, experience_level, risk_tolerance, signup_reasons')
              .eq('id', user.id)
              .single()
            setProfile(data ?? null)
            setProfileLoaded(true)
          }
        }
        return
      }

      // If not active yet, increment attempts
      setAttempts(prev => prev + 1)
    }

    // Initial check
    if (status === 'checking') {
      checkSubscription()
    }

    // Set up polling
    if (status === 'checking' && attempts < maxAttempts) {
      const timer = setTimeout(async () => {
        const supabase = createClient()

        // Refresh the session to get updated user metadata
        await supabase.auth.refreshSession()

        const { data: { user } } = await supabase.auth.getUser()

        if (user) {
          const membership = getMembershipStatusFromMetadata(user.user_metadata)

          if (membership.isActive) {
            setStatus('success')
            const postCheckoutRedirect = getPostCheckoutRedirect()
            if (postCheckoutRedirect) {
              router.replace(postCheckoutRedirect)
              return
            }
            if (!profileLoaded) {
              const metadataProfile = user.user_metadata?.onboarding_profile
              if (metadataProfile && typeof metadataProfile === 'object') {
                setProfile(metadataProfile)
                setProfileLoaded(true)
              } else {
                const { data } = await supabase
                  .from('users')
                  .select('favorite_sports, preferred_markets, experience_level, risk_tolerance, signup_reasons')
                  .eq('id', user.id)
                  .single()
                setProfile(data ?? null)
                setProfileLoaded(true)
              }
            }
            return
          }
        }

        setAttempts(prev => prev + 1)
      }, 2000)

      return () => clearTimeout(timer)
    }

    // Timeout after max attempts
    if (attempts >= maxAttempts && status === 'checking') {
      setStatus('timeout')
    }
  }, [attempts, status, router, maxAttempts, profileLoaded])

  return (
    <div
      className={`min-h-screen bg-black flex justify-center px-4 ${
        status === 'success' ? 'items-start py-10' : 'items-center'
      }`}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`text-center ${status === 'success' ? 'max-w-4xl w-full' : 'max-w-md'}`}
      >
        {status === 'checking' && (
          <>
            <Loader2 className="w-16 h-16 text-emerald-500 animate-spin mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Setting up your account...
            </h1>
            <p className="text-white/60">
              This usually takes just a few seconds.
            </p>
            <div className="mt-4 text-sm text-white/40">
              {attempts > 5 && "Still working on it..."}
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto mb-6" />
            </motion.div>
            <h1 className="text-2xl font-bold text-white mb-2">
              You&apos;re all set!
            </h1>
            <p className="text-white/60">
              We matched the best tools for your style and risk profile.
            </p>

            <div className="mt-8 text-left space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Your profile
                  </p>
                  <span className="text-[11px] text-white/40">
                    {profileLoaded && hasProfile ? 'Personalized' : 'Default'}
                  </span>
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {summaryItems.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-xl border border-white/10 bg-black/40 px-4 py-3"
                    >
                      <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                        {item.label}
                      </div>
                      <div className="mt-1 text-sm text-white/80">
                        {item.value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                    Recommended tools
                  </p>
                  <span className="text-[11px] text-white/40">
                    {hasProfile ? 'Based on your onboarding' : 'Default picks'}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {recommendations.map((tool) => (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:border-emerald-400/50 hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-semibold text-white">
                            {tool.title}
                          </div>
                          <p className="text-xs text-white/60 mt-1">
                            {tool.description}
                          </p>
                        </div>
                        <span className="text-xs text-emerald-400">Open</span>
                      </div>
                      {tool.tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {tool.tags.map((tag) => (
                            <span
                              key={`${tool.id}-${tag}`}
                              className="text-[11px] text-emerald-200/90 border border-emerald-400/20 bg-emerald-500/10 rounded-full px-2 py-1"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/chat"
                  className="flex-1 text-center py-3 px-4 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
                >
                  Go to Chat
                </Link>
                <Link
                  href="/live-scores"
                  className="flex-1 text-center py-3 px-4 rounded-lg bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
                >
                  Open Live Scores
                </Link>
              </div>
            </div>
          </>
        )}

        {status === 'timeout' && (
          <>
            <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-white mb-2">
              Taking longer than expected
            </h1>
            <p className="text-white/60 mb-6">
              Your payment was successful, but we&apos;re still setting up your account.
              This can sometimes take a minute.
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  setAttempts(0)
                  setStatus('checking')
                }}
                className="w-full py-3 px-4 rounded-lg bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors"
              >
                Check Again
              </button>
              <button
                onClick={() => router.push('/chat')}
                className="w-full py-3 px-4 rounded-lg bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors"
              >
                Go to Chat Anyway
              </button>
            </div>
            <p className="text-white/40 text-sm mt-4">
              If you continue to have issues, please contact support.
            </p>
          </>
        )}
      </motion.div>
    </div>
  )
}
