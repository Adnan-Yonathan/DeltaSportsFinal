'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Twitter } from 'lucide-react'
import { CardStack, type CardStackItem } from '@/components/ui/card-stack'
import { GuestHero } from '@/components/ui/guest-hero'
import StatsSection from '@/components/ui/call-to-action'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { Announcement, AnnouncementTag, AnnouncementTitle } from '@/components/ui/announcement'
import { FeaturesSix } from '@/components/ui/features-6'
import SectionWithMockup from '@/components/ui/section-with-mockup'
import { ArrowUpRight } from 'lucide-react'
import ModeToggle, { type DeltaMode } from '@/components/ModeToggle'

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
  const [cardSize, setCardSize] = useState({ width: 520, height: 320 })
  const projectionItems: CardStackItem[] = [
    {
      id: 'projection',
      title: projectionPreview?.label ?? 'Sharp Projection',
      description: projectionPreview?.detail ?? 'Latest model edge loading...',
      imageSrc:
        'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1400&q=80',
      href: '/market-projections',
      tag: 'Projection',
    },
    {
      id: 'ev-prop',
      title: propPreview?.label ?? 'EV Prop',
      description: propPreview?.detail ?? 'Scanning prop value...',
      imageSrc:
        'https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=1400&q=80',
      href: '/player-projections',
      tag: 'Prop',
    },
    {
      id: 'line-shopper',
      title: 'Betting Line Shopper',
      description: 'Compare spreads, totals, and moneylines across books.',
      imageSrc:
        'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1400&q=80',
      href: '/line-shopping',
      tag: 'Line Shopping',
    },
    {
      id: 'parlay',
      title: parlayPreview?.label ?? 'High-EV Parlay',
      description: parlayPreview?.detail ?? 'Finding high-EV parlays...',
      imageSrc:
        'https://images.unsplash.com/photo-1450101215322-bf5cd27642fc?auto=format&fit=crop&w=1400&q=80',
      href: '/parlay-predictor',
      tag: 'Parlay',
    },
    {
      id: 'sharp-wallets',
      title: 'Sharp Wallets',
      description: 'Track profitable traders and their open positions.',
      imageSrc:
        'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80',
      href: '/sharp-traders',
      tag: 'Sharp Traders',
    },
  ]
  const researchItems: CardStackItem[] = [
    {
      id: 'sharp-action',
      title: 'Sharp Action',
      description: 'Narrative explanations for why sharps target specific games.',
      href: '/research/sharp-action',
      tag: 'Research',
    },
    {
      id: 'betting-trends',
      title: 'Betting Trends',
      description: "ATS records and historical trends for today's slate.",
      href: '/research/betting-trends',
      tag: 'Research',
    },
    {
      id: 'backtesting',
      title: 'Backtesting',
      description: 'Simulate strategies with historical odds data.',
      href: '/research/backtesting',
      tag: 'Research',
    },
  ]
  const cardItems = mode === 'research' ? researchItems : projectionItems

  useEffect(() => {
    const updateCardSize = () => {
      const width = window.innerWidth
      if (width < 420) {
        setCardSize({ width: 300, height: 220 })
      } else if (width < 640) {
        setCardSize({ width: 360, height: 240 })
      } else if (width < 900) {
        setCardSize({ width: 440, height: 280 })
      } else {
        setCardSize({ width: 520, height: 320 })
      }
    }

    updateCardSize()
    window.addEventListener('resize', updateCardSize)

    return () => window.removeEventListener('resize', updateCardSize)
  }, [])

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
        <div className="max-w-3xl w-full space-y-8">
          {/* Guest Hero */}
          <GuestHero onSignUpClick={onSignUpClick || (() => {})} />

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full mt-16 lg:mt-20"
          >
            <StatsSection />
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
                  Sharp Traders
                  <br />
                  reveals the wallets moving markets.
                </>
              }
              description={
                <>
                  Follow the most profitable Polymarket wallets and see the open sports trades
                  they still hold. Track conviction in real time and spot the positions sharps
                  are leaning into before the public catches up.
                </>
              }
              primaryImageSrc="/Screenshot 2026-01-31 094051.png"
              secondaryImageSrc="/sharp-traders-blur.png"
              reverseLayout
            />
            <FeaturesSix
              title="Learn the infrastructure behind sharp money"
              description="Research mode breaks down where sharp money moves, who moves it, and how lines react in real time."
              imageSrc="/Screenshot 2026-01-27 134108.png"
              imageAlt="Research mode sharp money overview"
            />
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
  const isResearch = mode === 'research'

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-3 sm:px-4 py-6 sm:py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-4xl w-full mb-4 sm:mb-6"
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
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-5xl -mt-8"
      >
        <CardStack
          items={cardItems}
          initialIndex={0}
          autoAdvance
          intervalMs={2400}
          pauseOnHover
          showDots
          cardWidth={cardSize.width}
          cardHeight={cardSize.height}
          renderCard={(item) => (
            <div className="relative h-full w-full bg-black">
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-t ${
                  isResearch ? 'from-amber-900/35 via-black/10' : 'from-emerald-900/30 via-black/10'
                } to-transparent`}
              />
              <div className="relative z-10 flex h-full flex-col justify-end p-6 text-left">
                {item.tag && (
                  <span
                    className={`mb-2 inline-flex w-fit rounded-full border bg-black/50 px-3 py-1 text-[10px] uppercase tracking-[0.3em] ${
                      isResearch
                        ? 'border-amber-400/50 text-amber-200'
                        : 'border-emerald-400/40 text-emerald-200'
                    }`}
                  >
                    {item.tag}
                  </span>
                )}
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                {item.description && (
                  <p className="mt-2 text-sm text-white/70">{item.description}</p>
                )}
                {item.href && (
                  <Link
                    href={item.href}
                    className={`mt-4 inline-flex w-fit rounded-full border px-4 py-2 text-[11px] uppercase tracking-[0.3em] transition ${
                      isResearch
                        ? 'border-amber-400/50 text-amber-200 hover:border-amber-300/70 hover:text-amber-100'
                        : 'border-emerald-400/40 text-emerald-200 hover:border-emerald-300/70 hover:text-emerald-100'
                    }`}
                  >
                    Open
                  </Link>
                )}
              </div>
            </div>
          )}
        />
      </motion.div>
    </div>
  )
}
