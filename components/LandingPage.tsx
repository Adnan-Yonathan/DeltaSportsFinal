"use client"

import React from "react"
import { motion } from "framer-motion"
import { ShieldCheck, ArrowUpRight, TrendingUp, BarChart3, Zap, Brain, MessageSquare, Search, Target, DollarSign, Activity, LineChart } from "lucide-react"
import Link from "next/link"
import { AnimatedHero } from "@/components/ui/animated-hero"
import { ContainerScroll } from "@/components/ui/container-scroll-animation"
import { FeaturesSectionWithHoverEffects } from "@/components/ui/feature-section-with-hover-effects"
import RadialOrbitalTimeline from "@/components/ui/radial-orbital-timeline"
import Image from "next/image"

/** Delta AI Landing Page - Revolut-inspired design */

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div className="space-y-1">
    <div className="text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
    <div className="text-sm text-slate-500">{label}</div>
  </div>
)

const SoftButton = ({ children, className = "", href, ...props }: any) => {
  const baseClasses =
    "rounded-full px-5 py-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-700 " +
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
    <div className="mt-6 rounded-xl bg-gradient-to-b from-slate-50 to-white p-6 shadow-sm ring-1 ring-slate-200">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="text-xs text-slate-500 uppercase tracking-wider">Live Odds</div>
          <div className="text-lg font-semibold text-slate-900">Lakers vs Warriors</div>
        </div>
        <motion.div
          key={activeOdds}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="rounded-lg bg-emerald-100 px-4 py-2"
        >
          <div className="text-2xl font-bold text-emerald-700">{odds[activeOdds]}</div>
        </motion.div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-slate-200">
          <motion.div
            className="h-2 rounded-full bg-emerald-500"
            animate={{ width: ["40%", "65%", "50%"] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <div className="text-xs text-emerald-600">Live</div>
      </div>
    </div>
  )
}

function MiniChart() {
  return (
    <div className="mt-6 flex h-36 items-end gap-4 rounded-xl bg-gradient-to-b from-blue-50 to-white p-4">
      {[48, 72, 56, 88, 64, 96, 78].map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0, opacity: 0.6 }}
          animate={{ height: h }}
          transition={{ delay: 0.5 + i * 0.1, type: "spring" }}
          className="flex-1 rounded-lg bg-gradient-to-t from-blue-400 to-blue-600 shadow-sm"
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
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#8b5cf6" />
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

function SportsbookTicker() {
  const sportsbooks = [
    "FanDuel", "DraftKings", "BetMGM", "Caesars", "Bet365",
    "BetRivers", "Pinnacle", "LowVig.ag", "BetOnline.ag", "MyBookie.ag"
  ]

  // Duplicate the array for seamless loop
  const duplicatedBooks = [...sportsbooks, ...sportsbooks]

  return (
    <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 py-8">
      <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-transparent to-slate-900 z-10 pointer-events-none" />
      <motion.div
        className="flex gap-12 items-center"
        animate={{
          x: [0, -50 * sportsbooks.length],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 30,
            ease: "linear",
          },
        }}
      >
        {duplicatedBooks.map((book, index) => (
          <div
            key={index}
            className="flex-shrink-0 text-white/80 font-semibold text-lg whitespace-nowrap"
          >
            {book}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  // Delta AI use cases for the radial orbital timeline
  const deltaUseCases = [
    {
      id: 1,
      title: "Arbitrage Betting",
      date: "Risk-Free",
      content: "Find guaranteed profit opportunities by betting both sides across different sportsbooks. Our scanner identifies arbitrage in real-time with exact stake calculations.",
      category: "Strategy",
      icon: DollarSign,
      relatedIds: [2, 3],
      status: "completed" as const,
      energy: 100,
    },
    {
      id: 2,
      title: "Line Shopping",
      date: "Best Odds",
      content: "Compare odds across 10+ sportsbooks instantly. Even getting -105 instead of -110 significantly impacts your ROI over time.",
      category: "Comparison",
      icon: Search,
      relatedIds: [1, 3],
      status: "completed" as const,
      energy: 95,
    },
    {
      id: 3,
      title: "Bankroll Management",
      date: "Track Growth",
      content: "Monitor every bet and analyze your performance with advanced analytics. See your ROI, win rate, and edge over time.",
      category: "Analytics",
      icon: BarChart3,
      relatedIds: [1, 2, 4],
      status: "in-progress" as const,
      energy: 85,
    },
    {
      id: 4,
      title: "Sharp Money Tracking",
      date: "Follow Pros",
      content: "Track line movements to see where professional bettors are placing their action. Identify reverse line movement and steam moves.",
      category: "Intelligence",
      icon: TrendingUp,
      relatedIds: [3, 5],
      status: "in-progress" as const,
      energy: 75,
    },
    {
      id: 5,
      title: "AI Insights",
      date: "Smart Analysis",
      content: "Chat with AI to analyze games, understand odds movements, and get strategic insights powered by real-time data.",
      category: "AI",
      icon: Brain,
      relatedIds: [4, 6],
      status: "in-progress" as const,
      energy: 90,
    },
    {
      id: 6,
      title: "CLV Tracking",
      date: "Measure Edge",
      content: "Closing Line Value is the #1 indicator of long-term profitability. We automatically track your CLV on every bet.",
      category: "Performance",
      icon: LineChart,
      relatedIds: [5],
      status: "completed" as const,
      energy: 80,
    },
  ];

  return (
    <div className="min-h-screen w-full bg-[#F3F5F7]">
      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>

      {/* Top nav */}
      <nav className="mx-auto flex w-full max-w-[1180px] items-center justify-between px-4 py-6 md:px-0">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-white shadow">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M13 2L3 14h8l-1 8 10-12h-8l1-8z"
                fill="currentColor"
              />
            </svg>
          </div>
          <span className="font-jakarta text-xl font-semibold tracking-tight text-slate-900">Delta AI</span>
        </div>
        <div className="hidden gap-2 md:flex">
          <SoftButton href="/auth/login">
            Login
          </SoftButton>
          <SoftButton href="/auth/signup">Sign Up</SoftButton>
        </div>
        <div className="flex gap-2 md:hidden">
          <SoftButton href="/auth/login" className="text-xs px-3 py-2">
            Login
          </SoftButton>
        </div>
      </nav>

      {/* Hero area */}
      <div className="mx-auto grid w-full max-w-[1180px] grid-cols-1 gap-6 px-4 pb-14 md:grid-cols-2 md:px-0">
        {/* Left: headline */}
        <div className="flex flex-col justify-center space-y-8 pr-2">
          <div>
            <AnimatedHero
              staticText="AI-powered betting"
              rotatingTerms={["arbitrage", "analytics", "action", "CLV", "edges", "value", "lines"]}
              interval={2000}
            />
            <p className="mt-4 max-w-md text-slate-600">
              Make smarter bets with{" "}
              <span className="font-medium text-slate-900">real-time odds</span>, AI insights, and advanced bankroll
              management.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <SoftButton href="/auth/signup">
              Get Started <ArrowUpRight className="ml-1 inline h-4 w-4" />
            </SoftButton>
          </div>

          <div className="grid grid-cols-2 gap-8 pt-2 md:max-w-sm">
            <Stat label="Active Users" value="10K+" />
            <Stat label="Win Rate Improvement" value="23%" />
          </div>
        </div>

        {/* Right: animated feature cards */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* AI Chat card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative col-span-1 overflow-hidden rounded-xl bg-gradient-to-b from-indigo-600 to-purple-700 p-6 text-indigo-50 shadow-lg"
          >
            <div className="absolute inset-0 opacity-20">
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <radialGradient id="rg" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="transparent" />
                  </radialGradient>
                </defs>
                <rect width="400" height="400" fill="url(#rg)" />
              </svg>
            </div>

            <div className="relative flex h-full flex-col justify-between min-h-[240px]">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-indigo-500/60 p-2 ring-1 ring-white/10">
                  <Brain className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-wider text-indigo-200">AI Assistant</span>
              </div>
              <div className="mt-auto">
                <div className="text-xl leading-snug text-indigo-50/95">
                  Chat with AI
                  <br /> for instant insights
                </div>
              </div>
              <div className="mt-4">
                <AIBrain />
              </div>
            </div>
          </motion.div>

          {/* Live Odds card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="col-span-1 rounded-xl bg-white p-6 text-slate-800 shadow-lg ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-emerald-100 p-2">
                <Zap className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Real-Time</span>
            </div>
            <div className="mt-3 text-xl leading-snug">
              Live odds from
              <br /> top sportsbooks
            </div>
            <AnimatedOddsCard />
          </motion.div>

          {/* Bankroll card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="col-span-1 rounded-xl bg-white p-6 text-slate-800 shadow-lg ring-1 ring-slate-200"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-blue-100 p-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs uppercase tracking-wider text-slate-500">Analytics</span>
            </div>
            <div className="mt-2 text-3xl font-semibold tracking-tight">
              $12,450 <span className="text-sm font-medium text-slate-400 align-middle">USD</span>
            </div>
            <div className="mt-1 text-xs text-emerald-600">↑ 18.5% this month</div>
            <MiniChart />
          </motion.div>

          {/* Arbitrage card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="relative col-span-1 overflow-hidden rounded-xl bg-gradient-to-b from-slate-900 to-slate-800 p-6 text-slate-50 shadow-lg"
          >
            <div className="absolute inset-0">
              <svg className="absolute inset-0 h-full w-full opacity-20" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
                {[...Array(10)].map((_, i) => (
                  <circle
                    key={i}
                    cx="200"
                    cy="200"
                    r={20 + i * 16}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.12"
                  />
                ))}
              </svg>
            </div>

            <div className="relative flex h-full flex-col justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-slate-700/60 p-2 ring-1 ring-white/10">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="text-xs uppercase tracking-wider text-slate-200">Arbitrage</span>
              </div>
              <div className="mt-6 text-xl leading-snug text-slate-50/95">
                Guaranteed profit
                <br /> opportunities
              </div>
              <motion.div
                className="mt-4 rounded-lg bg-emerald-500/20 px-3 py-2 text-center ring-1 ring-emerald-500/30"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <div className="text-sm text-emerald-200">3 opportunities found</div>
                <div className="text-lg font-semibold text-emerald-100">ROI: 2.4%</div>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Sportsbook Ticker */}
      <div className="w-full mb-20">
        <div className="text-center mb-8">
          <p className="text-sm text-slate-500 uppercase tracking-wider font-semibold">Supported Sportsbooks</p>
        </div>
        <SportsbookTicker />
      </div>

      {/* Container Scroll Animation - App Showcase */}
      <div className="w-full bg-[#F3F5F7]">
        <ContainerScroll
          titleComponent={
            <div className="space-y-4">
              <h2 className="text-4xl md:text-6xl font-bold text-slate-900">
                Experience Delta AI in Action
              </h2>
              <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto">
                Chat with AI, compare odds, and track your bankroll all in one powerful interface
              </p>
            </div>
          }
        >
          {/* Mock Dashboard Interface */}
          <div className="w-full h-full bg-black rounded-lg overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3 h-full">
              {/* Sidebar */}
              <div className="bg-black/40 backdrop-blur-xl border-r border-white/5 p-4 hidden md:block">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600" />
                    <span className="font-bold text-white">DELTA</span>
                  </div>
                  {['New Chat', 'NBA Analysis', 'Arbitrage Picks', 'Bankroll Review'].map((chat, i) => (
                    <div key={i} className="p-3 rounded-lg bg-white/5 text-white/80 text-sm hover:bg-white/10 transition-colors">
                      {chat}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chat Area */}
              <div className="md:col-span-2 flex flex-col h-full">
                <div className="flex-1 p-6 space-y-4 overflow-auto">
                  {/* User Message */}
                  <div className="flex justify-end">
                    <div className="max-w-md p-4 rounded-2xl bg-indigo-500 text-white">
                      <p className="text-sm">Show me the best odds for Lakers vs Warriors tonight</p>
                    </div>
                  </div>

                  {/* AI Response */}
                  <div className="flex justify-start">
                    <div className="max-w-2xl p-4 rounded-2xl bg-white/10 text-white">
                      <p className="text-sm mb-3">I found the latest odds for Lakers vs Warriors:</p>
                      <div className="space-y-2">
                        <div className="p-3 rounded-lg bg-black/20 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60">FanDuel</span>
                            <span className="font-bold text-emerald-400">LAL -5.5 (-110)</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60">DraftKings</span>
                            <span className="font-bold text-emerald-400">LAL -5.0 (-108)</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-lg bg-black/20 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-white/60">BetMGM</span>
                            <span className="font-bold text-emerald-400">LAL -6.0 (-112)</span>
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-white/60 mt-3">Best value: DraftKings at -5.0 (-108)</p>
                    </div>
                  </div>

                  {/* Typing Indicator */}
                  <div className="flex justify-start">
                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-white/5">
                      <div className="flex gap-1">
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse delay-75" />
                        <div className="w-2 h-2 rounded-full bg-white/40 animate-pulse delay-150" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-white/5">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10">
                    <MessageSquare className="w-5 h-5 text-white/40" />
                    <div className="flex-1 text-sm text-white/40">Ask about odds, games, or your bankroll...</div>
                    <div className="w-8 h-8 rounded-lg bg-indigo-500 flex items-center justify-center">
                      <ArrowUpRight className="w-4 h-4 text-white" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </ContainerScroll>
      </div>

      {/* Powerful Features - Hover Effects */}
      <div className="w-full bg-white py-20">
        <div className="text-center mb-12 px-4">
          <h2 className="text-4xl md:text-6xl font-bold text-slate-900 mb-4">
            Powerful Features
          </h2>
          <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto">
            Everything you need to gain an edge in sports betting
          </p>
        </div>
        <FeaturesSectionWithHoverEffects />
      </div>

      {/* Use Cases - Radial Orbital Timeline */}
      <div className="w-full bg-black py-0">
        <RadialOrbitalTimeline timelineData={deltaUseCases} />
      </div>

      {/* CTA Section */}
      <div className="w-full bg-[#F3F5F7] py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 p-8 md:p-12 text-center text-white shadow-xl">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Ready to Elevate Your Betting Game?</h3>
            <p className="text-base md:text-lg text-slate-300 mb-8">
              Join thousands of smart bettors using Delta AI. Get instant access to AI-powered insights, live odds from 10+ sportsbooks, and advanced bankroll management.
            </p>
            <div className="flex justify-center">
              <SoftButton href="/auth/login" className="bg-black text-white hover:bg-slate-900">
                Sign In
              </SoftButton>
            </div>
          </div>
        </div>
      </div>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-16 text-center text-xs text-slate-400 md:px-0">
        <div className="mb-4 text-sm text-slate-500">
          <strong>Disclaimer:</strong> This application is for educational and analytical purposes only. Delta AI does
          not process real bets or transactions. Gambling involves risk. Please bet responsibly.
        </div>
        <div>© {new Date().getFullYear()} Delta AI, Inc. All rights reserved.</div>
      </footer>
    </div>
  )
}
