'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { UserPlus, Twitter } from 'lucide-react'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { AnimatedHero } from '@/components/ui/animated-hero'
import { GuestHero } from '@/components/ui/guest-hero'
import { CustomersSection } from '@/components/ui/customers-section'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { Typewriter } from '@/components/ui/typewriter-text'
import { Announcement, AnnouncementTag, AnnouncementTitle } from '@/components/ui/announcement'
import { FeaturesSix } from '@/components/ui/features-6'
import SectionWithMockup from '@/components/ui/section-with-mockup'
import { ArrowUpRight } from 'lucide-react'
import ModeToggle, { type DeltaMode } from '@/components/ModeToggle'
import TutorialPopup from '@/components/TutorialPopup'

const CUSTOMER_SCREENSHOTS = [
  {
    src: '/Screenshot 2026-01-14 001251.png',
    alt: 'Delta product screenshot 1',
  },
  {
    src: '/Screenshot 2026-01-14 001328.png',
    alt: 'Delta product screenshot 2',
  },
  {
    src: '/Screenshot 2026-01-14 001403.png',
    alt: 'Delta product screenshot 3',
  },
]

const DISCORD_INVITE_URL = 'https://discord.gg/8jUcaKT9'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
  isGuest?: boolean
  onSignUpClick?: () => void
  prefillMessage?: string
  mode?: DeltaMode
  onModeChange?: (mode: DeltaMode) => void
}

export default function ChatIntro({
  conversationId,
  userId,
  onMessageSent,
  isGuest = false,
  onSignUpClick,
  prefillMessage,
  mode = 'projections',
  onModeChange,
}: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)
  const [projectionPreview, setProjectionPreview] = useState<{
    label: string
    detail: string
  } | null>(null)
  const [propPreview, setPropPreview] = useState<{
    label: string
    detail: string
  } | null>(null)
  const [parlayPreview, setParlayPreview] = useState<{
    label: string
    detail: string
  } | null>(null)
  const [activeGuideId, setActiveGuideId] = useState<string | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)

  useEffect(() => {
    const formatOdds = (value?: number | null) => {
      if (value == null || !Number.isFinite(value)) return 'n/a'
      const rounded = Math.round(value)
      return rounded > 0 ? `+${rounded}` : `${rounded}`
    }

    const formatLine = (value?: number | null) => {
      if (value == null || !Number.isFinite(value)) return 'n/a'
      return value > 0 ? `+${value}` : `${value}`
    }

    const pickRandom = <T,>(items: T[]) =>
      items[Math.floor(Math.random() * items.length)]

    const loadPreviews = async () => {
      try {
        const [marketRes, propRes, parlayRes] = await Promise.all([
          fetch('/api/market-projections?sport=basketball_nba&include=1', {
            cache: 'no-store',
          }),
          fetch('/api/sharp-player-props?sport=basketball_nba&limit=50', {
            cache: 'no-store',
          }),
          fetch('/api/ev-parlays?maxParlayOdds=500', { cache: 'no-store' }),
        ])

        if (marketRes.ok) {
          const payload = await marketRes.json()
          const edges = Array.isArray(payload?.edges)
            ? (payload.edges as Array<Record<string, any>>)
            : []
          if (edges.length) {
            const edge = pickRandom(edges)
            if (edge?.spread) {
              const gap = Math.abs(
                Number(edge.spread.targetLine) - Number(edge.spread.marketLine)
              )
              setProjectionPreview({
                label: `${edge.spread.favoredTeam} ${formatLine(edge.spread.targetLine)}`,
                detail: Number.isFinite(gap)
                  ? `Gap ${gap.toFixed(1)} pts vs market`
                  : 'Model edge vs market',
              })
            } else if (edge?.total) {
              const gap = Math.abs(
                Number(edge.total.targetLine) - Number(edge.total.marketLine)
              )
              setProjectionPreview({
                label: `Total ${edge.total.targetLine}`,
                detail: Number.isFinite(gap)
                  ? `Gap ${gap.toFixed(1)} pts vs market`
                  : 'Model edge vs market',
              })
            } else if (edge?.moneyline) {
              setProjectionPreview({
                label: `${edge.homeTeam} ML`,
                detail: `${edge.awayTeam} matchup`,
              })
            }
          } else {
            setProjectionPreview({
              label: 'No projections yet',
              detail: 'Check back after lines update.',
            })
          }
        }

        if (propRes.ok) {
          const payload = await propRes.json()
          const props = Array.isArray(payload?.props)
            ? (payload.props as Array<Record<string, any>>)
            : []
          if (props.length) {
            const prop = pickRandom(props)
            const side = prop.side ? `${prop.side} ` : ''
            const line = prop.propLine != null ? prop.propLine : ''
            const market = prop.propType ? String(prop.propType).toUpperCase() : 'PROP'
            setPropPreview({
              label: `${prop.playerName} ${side}${line} ${market}`.trim(),
              detail: `Grade ${Math.round(prop.compositeScore)}`,
            })
          } else {
            setPropPreview({
              label: 'No props yet',
              detail: 'Waiting for sharp prop bets.',
            })
          }
        }

        if (parlayRes.ok) {
          const payload = await parlayRes.json()
          const parlays = Array.isArray(payload?.data)
            ? (payload.data as Array<Record<string, any>>)
            : []
          if (parlays.length) {
            const parlay = pickRandom(parlays)
            setParlayPreview({
              label: `${parlay.legCount}-Leg ${formatOdds(parlay.bestBookOdds)}`,
              detail: `EV ${parlay.evPercent.toFixed(1)}%`,
            })
          } else {
            setParlayPreview({
              label: 'No EV parlays',
              detail: 'Waiting for edges.',
            })
          }
        } else if (parlayRes.status === 403) {
          setParlayPreview({
            label: 'Parlay Pro',
            detail: 'Upgrade to unlock.',
          })
        }
      } catch (error) {
        return
      }
    }

    loadPreviews()

  }, [])

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    // If guest, redirect to sign up
    if (isGuest && onSignUpClick) {
      onSignUpClick()
      return
    }

    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if (!message || sending) return

    setSending(true)

    try {
      // All queries go to the unified /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          userId,
          capability: selectedCapability,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Clear the textarea
      if (textarea) {
        textarea.value = ''
      }

      // Wait for the JSON response (messages are saved server-side)
      await response.json()

      // Trigger the callback to indicate message was sent
      onMessageSent()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
      setSelectedCapability(null)
    }
  }

  const guestFaq = [
    {
      question: 'What is Delta?',
      answer:
        'Delta is an AI sports betting assistant that compares markets, surfaces value, and explains edges.',
    },
    {
      question: 'Do I need to connect a sportsbook?',
      answer:
        'No. You can compare odds and run analysis without linking any sportsbook accounts.',
    },
    {
      question: 'Which sports are supported?',
      answer:
        'NBA, NFL, NCAAB, CFB, and NHL are supported today, with more on the way.',
    },
    {
      question: 'How does free membership work?',
      answer:
        'Create an account to access the free tier. Upgrade anytime for full projections and research.',
    },
  ]

  // Guest layout
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-black px-3 sm:px-4 py-6 sm:py-8">
        <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-30">
          <Link href="/sharp-detector" className="relative w-[220px] sm:w-[260px] rounded-3xl border border-emerald-400/40 bg-black/70 p-4 shadow-2xl shadow-emerald-500/20 backdrop-blur hover:border-emerald-400/60 transition-colors">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
              <span>Whale Feed</span>
              <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[9px] font-semibold text-emerald-200/80">
                Syndicate Only
              </span>
            </div>
            <p className="mt-3 text-xs text-white/60">
              Track $2k+ prediction market bets and see if the market respects or fades them.
            </p>
            <div className="mt-4 w-full gap-2 rounded-full bg-emerald-400/20 text-emerald-200 px-4 py-2 text-center text-sm font-medium">
              View Whale Feed
            </div>
          </Link>
        </div>
        <div className="max-w-3xl w-full space-y-8">
          {/* Guest Hero */}
          <GuestHero onSignUpClick={onSignUpClick || (() => {})} />

          {/* Sign Up CTA - styled like PromptBox */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full"
          >
            <button
              type="button"
              onClick={onSignUpClick}
              className="w-full rounded-[22px] sm:rounded-[28px] p-4 sm:p-5 shadow-sm bg-emerald-500/90 backdrop-blur-xl border border-emerald-400/60 hover:border-emerald-300 hover:bg-emerald-400 transition-all group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-white" />
                  <Typewriter
                    text="Start betting like a sharp"
                    speed={80}
                    cursor=""
                    startDelay={1200}
                    className="text-lg font-semibold text-white"
                  />
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-emerald-600">
                    <path d="M12 5.25L12 18.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.75 12L12 5.25L5.25 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Screenshots */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
            className="w-screen max-w-none -mx-[calc(50vw-50%)] mt-14"
          >
            <CustomersSection
              customers={CUSTOMER_SCREENSHOTS}
              className="bg-transparent !py-0 md:!py-0"
              containerClassName="max-w-none px-0"
              gridClassName="mt-0 w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              imageClassName="w-full h-[24px] sm:h-[36px] lg:h-[48px] object-cover rounded-3xl shadow-[0_36px_100px_rgba(0,0,0,0.55)] dark:invert-0"
            />
          </motion.div>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full"
          >
            <FeaturesSix />
              <SectionWithMockup
                title={
                  <>
                    Whale Feed
                    <br />
                    built on real money.
                  </>
                }
                description={
                  <>
                    We track big bets on peer-to-peer exchanges and compare them
                    <br />
                    to sportsbook lines, showing how sharp a bet really is.
                  </>
                }
              primaryImageSrc="/Screenshot 2026-01-11 165623.png"
              secondaryImageSrc="/Screenshot 2026-01-11 161550.png"
            />
          </motion.div>

          {/* ROI Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <ROICalculator />
            <div className="mt-5 w-full max-w-2xl mx-auto flex justify-center">
              <Link
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-4 rounded-full bg-[#5865F2] px-6 py-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-[0_16px_40px_rgba(88,101,242,0.35)] hover:bg-[#6C77F5] transition-colors"
              >
                <span>Free Discord</span>
                <span className="rounded-full border border-white/60 px-3 py-1 text-[10px] font-semibold text-white">
                  Join Now
                </span>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  FAQ
                </p>
                <span className="text-[11px] text-white/40">Basics</span>
              </div>
              <div className="space-y-3">
                {guestFaq.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-2xl border border-white/10 bg-black/40 px-4 py-3 open:border-emerald-400/30 open:bg-black/60"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white">
                      <span>{item.question}</span>
                      <span className="text-xs text-white/50 transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-xs text-white/60">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // Signed-in layout
  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-3 sm:px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full mb-4 sm:mb-6"
      >
        <div className="mb-6 flex flex-wrap items-center justify-center gap-3">
          <Link href="/patch-notes" className="relative z-10 pointer-events-auto">
            <Announcement className="border-[#34d399]/30 bg-black/70 hover:border-[#34d399]/50 hover:bg-black/90 cursor-pointer">
              <AnnouncementTag className="bg-[#34d399]/20 text-[#34d399]">
                Patch 0.5
              </AnnouncementTag>
              <AnnouncementTitle className="text-white/80 text-sm">
                View patch notes
                <ArrowUpRight size={14} className="shrink-0 text-[#34d399]" />
              </AnnouncementTitle>
            </Announcement>
          </Link>
          {onModeChange && (
            <div className="relative z-10 pointer-events-auto">
              <ModeToggle mode={mode} onChange={onModeChange} />
            </div>
          )}
          <Link
            href="https://x.com/DeltaSportsAI"
            target="_blank"
            rel="noreferrer"
            aria-label="Delta Sports on X"
            className="relative z-20 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.25em] text-white/70 transition-colors hover:border-emerald-400/60 hover:text-emerald-200 pointer-events-auto"
          >
            <ArrowUpRight className="h-4 w-4 text-emerald-300" />
            <span>follow our twitter</span>
            <Twitter className="h-4 w-4" />
          </Link>
        </div>
        <AnimatedHero
          staticText="Make money with"
          interval={2500}
        />
      </motion.div>


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full"
      >
        <div className="sm:hidden w-full">
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-black/70 px-2 py-3 text-left">
              <div className="text-[9px] uppercase tracking-[0.25em] text-emerald-200/80">
                Sharp Projection
              </div>
              <div className="mt-2 text-xs font-semibold text-white">
                {projectionPreview?.label ?? 'Loading...'}
              </div>
              <div className="text-[10px] text-white/60">
                {projectionPreview?.detail ?? 'Pulling latest edge...'}
              </div>
              <Link
                href="/market-projections"
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-emerald-200"
              >
                View
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/70 px-2 py-3 text-left">
              <div className="text-[9px] uppercase tracking-[0.25em] text-emerald-200/80">
                Sharp Prop
              </div>
              <div className="mt-2 text-xs font-semibold text-white">
                {propPreview?.label ?? 'Loading...'}
              </div>
              <div className="text-[10px] text-white/60">
                {propPreview?.detail ?? 'Pulling top prop...'}
              </div>
              <Link
                href="/player-projections"
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-emerald-200"
              >
                View
              </Link>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/70 px-2 py-3 text-left">
              <div className="text-[9px] uppercase tracking-[0.25em] text-emerald-200/80">
                Sharp Parlay
              </div>
              <div className="mt-2 text-xs font-semibold text-white">
                {parlayPreview?.label ?? 'Loading...'}
              </div>
              <div className="text-[10px] text-white/60">
                {parlayPreview?.detail ?? 'Scanning EV parlays...'}
              </div>
              <Link
                href="/parlay-predictor"
                className="mt-2 inline-flex items-center gap-1 rounded-full border border-emerald-400/40 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-emerald-200"
              >
                View
              </Link>
            </div>
          </div>
        </div>
        <div className="hidden sm:block w-full">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                id: 'guide-navigation',
                title: 'Navigate Delta',
                accent: 'text-emerald-200/90',
                border: 'border-emerald-400/30',
                glow: 'shadow-[0_20px_60px_rgba(16,185,129,0.12)]',
              },
              {
                id: 'guide-betting-flow',
                title: 'Use Delta to Bet',
                accent: 'text-emerald-200/90',
                border: 'border-emerald-400/30',
                glow: 'shadow-[0_20px_60px_rgba(16,185,129,0.12)]',
              },
              {
                id: 'guide-research-mode',
                title: 'Research Mode',
                accent: 'text-amber-200/90',
                border: 'border-amber-400/30',
                glow: 'shadow-[0_20px_60px_rgba(251,191,36,0.12)]',
              },
            ].map((guide) => (
              <button
                key={guide.id}
                type="button"
                onClick={() => {
                  setActiveGuideId(guide.id)
                  setGuideOpen(true)
                }}
                className={`group relative overflow-hidden rounded-3xl border ${guide.border} bg-gradient-to-br from-white/[0.06] via-black/70 to-black/90 p-5 text-left transition hover:border-white/40 hover:shadow-2xl ${guide.glow}`}
              >
                <h3 className="mt-2 text-lg font-semibold text-white">
                  {guide.title}
                </h3>
                <div className="mt-4 flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-white/50">
                  <span
                    className={`h-1 w-10 rounded-full bg-gradient-to-r ${
                      guide.id === 'guide-research-mode'
                        ? 'from-amber-400/60 to-amber-200/10'
                        : 'from-emerald-400/60 to-emerald-200/10'
                    }`}
                  />
                  <span className={guide.accent}>Open guide</span>
                </div>
                <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-white/5 blur-2xl transition group-hover:bg-white/10" />
              </button>
            ))}
          </div>
          {activeGuideId && (
            <TutorialPopup
              tutorialId={activeGuideId}
              forceShow={false}
              open={guideOpen}
              onOpenChange={setGuideOpen}
            />
          )}
        </div>

      </motion.div>

      {/* News Slideshow */}
      <div className="mt-3 w-full">
        <LatestNewsStrip />
      </div>
    </div>
  )
}
