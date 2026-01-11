"use client"

import React from "react"
import { motion } from "framer-motion"
import { ArrowUpRight, Mic, Send } from "lucide-react"
import Link from "next/link"
import { FeaturesSix } from "@/components/ui/features-6"
import SectionWithMockup from "@/components/ui/section-with-mockup"
import { ComparisonSection } from "@/components/ui/comparison-section"
import { HowWeHelpSection } from "@/components/ui/how-we-help-section"
import { FAQSection } from "@/components/ui/faq-section"
import { SimpleHeader } from "@/components/ui/simple-header"
import { DottedSurface } from "@/components/ui/dotted-surface"
import { TextEffect } from "@/components/ui/text-effect"
import { SportsbookTicker } from "@/components/ui/sportsbook-ticker"
import { SocialProof } from "@/components/ui/social-proof"

/** Delta Sports Landing Page - Revolut-inspired design */

// Reusable fade-in animation wrapper
const FadeInSection = ({
  children,
  className = "",
  delay = 0.1
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.6, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

const pageGray = '#000000'

const SoftButton = ({ children, className = "", href, ...props }: any) => {
  const baseClasses =
    "rounded-full px-5 py-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "bg-[#34d399] text-[#0f1f15] hover:bg-[#16a34a] focus:ring-[#34d399] focus:ring-offset-0 " +
    className

  if (href) {
    return (
      <Link href={href} className={baseClasses} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button className={baseClasses} {...props}>
      {children}
    </button>
  )
}

function AnimatedOddsCard() {
  const [activeOdds, setActiveOdds] = React.useState(0)
  const odds = ["-5.5", "-6.0", "-5.0"]

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveOdds((prev) => (prev + 1) % odds.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mt-6 rounded-xl bg-black p-6 shadow-sm ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-xs text-white/70 uppercase tracking-wider">Live Odds</div>
          <div className="text-lg font-semibold text-white">Lakers vs Warriors</div>
        </div>
        <motion.div
          key={activeOdds}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg bg-white/15 px-4 py-2 border border-white/25"
        >
          <div className="text-2xl font-bold text-white">{odds[activeOdds]}</div>
        </motion.div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-black/30">
          <motion.div
            className="h-2 rounded-full bg-white"
            animate={{ width: ["40%", "65%", "50%"] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div className="text-xs text-white/80">Live</div>
      </div>
    </div>
  )
}

function MiniChart() {
  return (
    <div className="mt-6 flex h-36 items-end gap-4 rounded-xl bg-black p-4 border border-white/10">
      {[48, 72, 56, 88, 64, 96, 78].map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0.6 }}
          animate={{ height: h }}
          transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
          className="flex-1 rounded-lg bg-white/60 shadow-sm"
        />
      ))}
    </div>
  )
}

function AIBrain() {
  return (
    <motion.div
      className="relative flex h-full items-center justify-center"
      animate={{
        scale: [1, 1.05, 1],
      }}
      transition={{
        duration: 3,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <svg width="180" height="180" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="brainGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#d9d9d9" />
          </linearGradient>
        </defs>
        <circle cx="90" cy="90" r="48" fill="url(#brainGrad)" opacity="0.9" />
        <circle cx="78" cy="82" r="8" fill="white" opacity="0.4" />
        <circle cx="108" cy="102" r="6" fill="white" opacity="0.3" />
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <motion.circle
            key={i}
            cx={90 + Math.cos((angle * Math.PI) / 180) * 70}
            cy={90 + Math.sin((angle * Math.PI) / 180) * 70}
            r="3"
            fill="white"
            animate={{
              opacity: [0.2, 1, 0.2],
              scale: [0.8, 1.2, 0.8],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: i * 0.3,
            }}
          />
        ))}
      </svg>
    </motion.div>
  )
}


function PromoMockSection() {
  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/15 bg-black p-6 shadow-[0_0_60px_rgba(52,211,153,0.25)]">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-[#34d399] to-transparent" />
        {/* Top bar mock */}
        <div className="flex items-center justify-between text-xs text-white/80 mb-6">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 rounded bg-white/30" />
            <div>
              <div className="font-semibold text-white">DELTA SPORTS</div>
              <div className="text-[11px] text-white/70">AI Sports Betting Assistant</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-white">
            <div className="rounded-full border border-white/20 px-3 py-1 text-[11px]">Live Scores</div>
            <div className="h-8 w-8 rounded-full bg-white/15" />
          </div>
        </div>

        {/* Hero mock */}
        <div className="text-center py-4 mb-6">
          <h2 className="text-3xl font-bold text-white mb-3">How can I help you today?</h2>
          <p className="text-white/80 max-w-2xl mx-auto">
            Get real-time stats, compare odds, analyze betting lines, track line movement,
            and discover value plays across all major sports.
          </p>
          <div className="mt-6 mx-auto max-w-2xl">
            <div className="rounded-2xl border border-white/15 bg-white/10 p-4 text-left text-white/80">
              <div className="mb-2 text-sm text-white/70">Message...</div>
              <div className="flex items-center justify-between text-sm text-white">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-white/25" />
                  <span className="text-xs bg-white/15 px-2 py-1 rounded">Regular</span>
                </div>
                <div className="flex items-center gap-3 text-white/70">
                  <Mic className="h-4 w-4" />
                  <span className="rounded-full border border-white/20 px-3 py-1">
                    <Send className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top performances mock */}
        <div>
          <div className="text-[11px] uppercase text-white/80 tracking-[0.14em]">Top performances</div>
          <div className="text-sm font-semibold text-white">Recent standout stat lines</div>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {["NBA", "NFL", "MLB", "NHL"].map((l) => (
              <span key={l} className="px-2 py-1 rounded-full bg-[#34d399] text-[#0f1f15]">
                {l}
              </span>
            ))}
            <span className="ml-2 rounded border border-white/20 px-2 py-1 text-white">Team trends</span>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3 text-sm text-white">
            {[
              { team: "Oklahoma City Thunder", rec: "Last 5: 5-0 | PPG 121.0 / OPP 109.2" },
              { team: "Boston Celtics", rec: "Last 5: 4-1 | PPG 125.4 / OPP 111.4" },
              { team: "Houston Rockets", rec: "Last 5: 4-1 | PPG 118.6 / OPP 104.2" },
            ].map((t) => (
              <div key={t.team} className="rounded-lg border border-white/15 bg-white/10 p-3">
                <div className="text-[11px] uppercase text-white/70">NBA Team (last 5)</div>
                <div className="font-semibold text-white">{t.team}</div>
                <div className="text-xs text-white/70">{t.rec}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LandingPage() {
  return (
    <div
      className="relative min-h-screen w-full text-white"
      style={{ backgroundColor: pageGray }}
    >
      {/* Dotted Surface Background */}
      <DottedSurface />

      <SimpleHeader />

      {/* Hero area */}
      <FadeInSection className="w-full" delay={0.1}>
        <div className="container mx-auto">
          <div className="flex gap-4 pt-16 pb-6 lg:pt-24 lg:pb-10 items-center justify-center flex-col px-4">
            <div className="flex gap-4 flex-col items-center">
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white text-center overflow-visible">
                <TextEffect per="word" preset="blur" delay={0.2}>
                  Bet Like a
                </TextEffect>{' '}
                <span className="bg-gradient-to-r from-[#34d399] via-[#34d399] to-[#16a34a] bg-clip-text text-transparent">
                  Pro
                </span>
                <br />
                <TextEffect per="word" preset="blur" delay={0.2}>
                  All in One
                </TextEffect>{' '}
                <span className="bg-gradient-to-r from-[#34d399] via-[#34d399] to-[#16a34a] bg-clip-text text-transparent">
                  Place
                </span>
              </h1>
              <TextEffect
                per="word"
                preset="fade"
                delay={1.0}
                as="p"
                className="text-base md:text-lg leading-relaxed tracking-tight text-white/80 max-w-2xl text-center mx-auto"
              >
                Betting made simple. Chat with Delta Sports AI to get odds, stats, and insights in seconds.
              </TextEffect>
            </div>

            <div className="w-full max-w-xs h-px bg-gradient-to-r from-transparent via-white/50 to-transparent" />

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4, duration: 0.5 }}
              className="flex flex-row gap-3"
            >
              <SoftButton href="/chat" className="min-w-[160px]">
                <span className="flex items-center justify-center gap-1">
                  <TextEffect per="char" preset="fade" delay={1.6}>
                    Talk To Delta
                  </TextEffect>
                  <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                </span>
              </SoftButton>
              <SoftButton href="/live-scores" className="min-w-[140px]">
                <span className="flex items-center justify-center gap-1">
                  <TextEffect per="char" preset="fade" delay={1.8}>
                    Live Scores
                  </TextEffect>
                  <ArrowUpRight className="h-4 w-4 flex-shrink-0" />
                </span>
              </SoftButton>
            </motion.div>

            <SocialProof animated={true} />
          </div>
        </div>
      </FadeInSection>

      {/* Sportsbook Ticker */}
      <FadeInSection className="w-full mb-12" delay={0.1}>
        <SportsbookTicker />
      </FadeInSection>

      {/* Promo Mock Showcase */}
      <FadeInSection className="w-full px-4 pb-10" delay={0.2}>
        <PromoMockSection />
      </FadeInSection>

      {/* Powerful Features */}
      <FadeInSection className="w-full" delay={0.1}>
        <div id="features">
          <FeaturesSix />
          <SectionWithMockup
            title={
              <>
                Market-driven projections
                <br />
                for every angle.
              </>
            }
            description={
              <>
                Delta uses market movement and sharp money to build projections
                <br />
                for games, players, and parlays so your numbers stay locked to
                <br />
                where the true price is heading.
              </>
            }
            primaryImageSrc="/Screenshot 2026-01-11 165623.png"
            secondaryImageSrc="/Screenshot 2026-01-11 161528.png"
          />
        </div>
      </FadeInSection>

      {/* How We Help Section */}
      <HowWeHelpSection />

      {/* Comparison Section */}
      <FadeInSection className="w-full" delay={0.1}>
        <div id="comparison">
          <ComparisonSection />
        </div>
      </FadeInSection>

      {/* FAQ */}
      <FadeInSection className="w-full" delay={0.1}>
        <FAQSection />
      </FadeInSection>

      {/* CTA Section */}
      <FadeInSection className="w-full py-20" delay={0.1}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="rounded-2xl bg-black p-8 md:p-12 text-center text-white shadow-xl border border-white/20">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Ready to Elevate Your Betting Game?</h3>
            <p className="text-base md:text-lg text-white/80 mb-8">
              Join thousands of smart bettors using Delta Sports AI. Get instant access to AI-powered insights, live odds from 10+ sportsbooks, and matchup analytics.
            </p>
            <div className="flex justify-center">
              <SoftButton href="/auth/login">
                Sign In
              </SoftButton>
            </div>
          </div>
        </div>
      </FadeInSection>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-16 text-center text-xs text-white/70 md:px-0">
        <div className="mb-4 text-sm text-white/70">
          <strong>Disclaimer:</strong> This application is for educational and analytical purposes only. Delta Sports AI does
          not process real bets or transactions. Gambling involves risk. Please bet responsibly.
        </div>
        <div>(c) {new Date().getFullYear()} Delta Sports, Inc. All rights reserved.</div>
      </footer>
    </div>
  )
}




