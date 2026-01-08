'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { UserPlus } from 'lucide-react'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { AnimatedHero } from '@/components/ui/animated-hero'
import { GuestHero } from '@/components/ui/guest-hero'
import { SocialProof } from '@/components/ui/social-proof'
import { SportsbookTicker } from '@/components/ui/sportsbook-ticker'
import { ComparisonSection } from '@/components/ui/comparison-section'
import { Typewriter } from '@/components/ui/typewriter-text'
import { Announcement, AnnouncementTag, AnnouncementTitle } from '@/components/ui/announcement'
import { ArrowUpRight } from 'lucide-react'
import { ParticleButton } from '@/components/ui/particle-button'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
  isGuest?: boolean
  onSignUpClick?: () => void
  prefillMessage?: string
}

export default function ChatIntro({
  conversationId,
  userId,
  onMessageSent,
  isGuest = false,
  onSignUpClick,
  prefillMessage,
}: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)

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

      // Read the response stream first
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Wait a bit for the database to update, then trigger the callback
      await new Promise(resolve => setTimeout(resolve, 300))

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

  // Capability examples for guest view (display only, no interaction)
  const guestCapabilities = [
    {
      title: "Player Profiles",
      description: "Access player stats, advanced metrics, and projections vs specific teams",
    },
    {
      title: "Team Profiles",
      description: "Get comprehensive team stats, trends, and performance metrics",
    },
    {
      title: "Line Shopping/Arbitrage Scanner",
      description: "Compare odds and find arbitrage opportunities on the Live Odds page",
    },
    {
      title: "Cross Market EV",
      description: "Find +EV plays where sportsbooks disagree on odds",
    },
    {
      title: "Live Betting",
      description: "AI-projected live spreads based on game flow, momentum, and in-game factors",
    },
    {
      title: "Betting Trends",
      description: "Recent records vs spreads, prop covers, and public/sharp money splits",
    },
    {
      title: "Combo Analysis",
      description: "Calculate parlay probability with correlation adjustments",
    },
    {
      title: "Matchup Analysis",
      description: "Team vs team analysis with spread, total, and moneyline edge detection",
    },
    {
      title: "Player Analysis",
      description: "Analyze player props with season stats, recent form, and opponent context",
    },
  ]

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
      question: 'How does the free trial work?',
      answer:
        'You get 7 days free on any paid plan. Cancel anytime from your billing settings.',
    },
  ]

  // Guest layout
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-black px-3 sm:px-4 py-6 sm:py-8">
        <div className="hidden lg:flex fixed right-4 top-1/2 -translate-y-1/2 z-30">
          <div className="relative w-[220px] sm:w-[260px] rounded-3xl border border-emerald-400/40 bg-black/70 p-4 shadow-2xl shadow-emerald-500/20 backdrop-blur">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.3em] text-emerald-300/80">
              <span>Whale Detector</span>
              <span className="rounded-full border border-emerald-400/40 px-2 py-0.5 text-[9px] font-semibold text-emerald-200/80">
                Members Only
              </span>
            </div>
            <p className="mt-3 text-xs text-white/60">
              Flag $2k+ trades and see the market price in cents plus American odds.
            </p>
            <ParticleButton
              disabled
              className="mt-4 w-full gap-2 rounded-full bg-emerald-400/20 text-emerald-200 hover:bg-emerald-400/30 disabled:opacity-60 disabled:cursor-not-allowed"
              title="Membership required to access Whale Detector"
            >
              Whale Detector
            </ParticleButton>
          </div>
        </div>
        <div className="max-w-3xl w-full space-y-8">
          {/* Guest Hero */}
          <GuestHero onSignUpClick={onSignUpClick || (() => {})} />

          {/* Social Proof */}
          <SocialProof animated={true} />

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
              className="w-full rounded-[22px] sm:rounded-[28px] p-4 sm:p-5 shadow-sm bg-white/5 backdrop-blur-xl border border-white/10 hover:border-emerald-500/30 hover:bg-white/10 transition-all group text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <UserPlus className="w-6 h-6 text-emerald-400" />
                  <Typewriter
                    text="Try 7 days free"
                    speed={80}
                    cursor=""
                    startDelay={1200}
                    className="text-lg font-semibold text-white/70 group-hover:text-white transition-colors"
                  />
                </div>
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 group-hover:bg-emerald-500/30 transition-colors">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-emerald-400">
                    <path d="M12 5.25L12 18.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M18.75 12L12 5.25L5.25 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              </div>
            </button>
          </motion.div>

          {/* Sportsbook Ticker */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.5 }}
          >
            <SportsbookTicker />
          </motion.div>

          {/* Example Prompts / Capabilities */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full"
          >
            <p className="text-center text-sm text-white/60 mb-3">What you can ask Delta</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 auto-rows-fr">
              {guestCapabilities.map((capability) => (
                <button
                  key={capability.title}
                  type="button"
                  onClick={onSignUpClick}
                  className="group text-left p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all h-full min-h-[78px]"
                >
                  <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                    {capability.title}
                  </h3>
                  <p className="text-[11px] text-white/60 leading-relaxed">
                    {capability.description}
                  </p>
                </button>
              ))}
            </div>
          </motion.div>

          {/* Comparison Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <ComparisonSection />
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
        <Link href="/patch-notes" className="mb-6 inline-block relative z-10 pointer-events-auto">
          <Announcement className="border-[#34d399]/30 bg-black/70 hover:border-[#34d399]/50 hover:bg-black/90 cursor-pointer">
            <AnnouncementTag className="bg-[#34d399]/20 text-[#34d399]">
              Patch 0.2
            </AnnouncementTag>
            <AnnouncementTitle className="text-white/80 text-sm">
              View patch notes
              <ArrowUpRight size={14} className="shrink-0 text-[#34d399]" />
            </AnnouncementTitle>
          </Announcement>
        </Link>
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
        <form onSubmit={handleSubmit} className="w-full relative">
          <PromptBox
            name="message"
            disabled={sending}
            defaultValue={prefillMessage}
          />
        </form>

      </motion.div>

      <div className="mt-8 w-full">
        <LatestNewsStrip />
      </div>
    </div>
  )
}
