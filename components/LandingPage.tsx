"use client"

import React from "react"
import { motion } from "framer-motion"
import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { AnimatedHero } from "@/components/ui/animated-hero"
import { FeaturesChat } from "@/components/ui/features-chat"
import { ComparisonSection } from "@/components/ui/comparison-section"
import { HowWeHelpSection } from "@/components/ui/how-we-help-section"
import { FAQSection } from "@/components/ui/faq-section"
import Image from "next/image"
import { SimpleHeader } from "@/components/ui/simple-header"
import { AvatarCircles } from "@/components/ui/avatar-circles"
import { DottedSurface } from "@/components/ui/dotted-surface"

/** Delta AI Landing Page - Revolut-inspired design */

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

const SoftButton = ({ children, className = "", href, ...props }: any) => {
  const baseClasses =
    "rounded-full px-5 py-2.5 text-sm font-medium shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 " +
    "bg-gray-800 text-white hover:bg-gray-700 focus:ring-gray-600 " +
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
    { name: "FanDuel", logo: "https://logos-world.net/wp-content/uploads/2024/10/FanDuel-Logo-500x281.png" },
    { name: "DraftKings", logo: "https://companieslogo.com/img/orig/DKNG_BIG-9bcdf411.png?t=1720244491" },
    { name: "BetMGM", logo: "https://www.pngall.com/wp-content/uploads/17/BETMGM-Logo-Distinct-Design-PNG-thumb.png" },
    { name: "Pinnacle", logo: "https://th.bing.com/th/id/R.38eec8450d7dc257896f7893d0a0fa68?rik=A1vhXbQI8R%2fzwA&riu=http%3a%2f%2fgruenzeug-graz.at%2fwp-content%2fuploads%2fpinnacle-sports-logo.png&ehk=Y%2bxlVb%2b6i9Seu4nSU2dXaouFXVbtFSztDndLfOB00zA%3d&risl=&pid=ImgRaw&r=0" },
    { name: "Bovada", logo: "https://atlantapokerclub.com/wp-content/uploads/2018/12/reviews-bovada-logo.png" },
    { name: "Fliff", logo: "https://hellorookie.com/wp-content/uploads/2023/08/Fliff-Logo-Light.png" },
  ]

  // Duplicate the array for seamless loop
  const duplicatedBooks = [...sportsbooks, ...sportsbooks]

  return (
    <div className="relative overflow-hidden bg-transparent py-8">
      <div className="absolute inset-0 bg-gradient-to-r from-black via-transparent to-black z-10 pointer-events-none" />
      <motion.div
        className="flex gap-12 items-center"
        animate={{
          x: [0, -50 * sportsbooks.length],
        }}
        transition={{
          x: {
            repeat: Infinity,
            repeatType: "loop",
            duration: 18,
            ease: "linear",
          },
        }}
      >
        {duplicatedBooks.map((book, index) => (
          <div key={index} className="flex-shrink-0 flex items-center gap-2 text-white/80 font-semibold text-lg whitespace-nowrap">
            {book.logo ? (
              <div className="h-12 w-32 relative flex items-center justify-center">
                <Image
                  src={book.logo}
                  alt={`${book.name} logo`}
                  fill
                  className="object-contain"
                  sizes="128px"
                />
              </div>
            ) : (
              book.name
            )}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

export default function LandingPage() {
  const heroAvatarUrls = [
    "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=120&q=80",
    "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80",
    "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
    "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
  ]

  return (
    <div className="relative min-h-screen w-full bg-black text-white">
      {/* Dotted Surface Background */}
      <DottedSurface />

      {/* Fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        :root { --font-sans: 'Plus Jakarta Sans', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
        .font-jakarta { font-family: var(--font-sans); }
      `}</style>
      <SimpleHeader />

      {/* Hero area */}
      <FadeInSection className="w-full" delay={0.1}>
        <div className="container mx-auto">
          <div className="flex gap-6 py-10 lg:py-16 items-center justify-center flex-col px-4">
            <div className="flex gap-4 flex-col">
              <AnimatedHero
                staticText="AI-powered betting"
                rotatingTerms={["analytics", "action", "edges", "value", "lines", "models", "sharps"]}
                interval={2000}
              />
              <p className="text-lg md:text-xl leading-relaxed tracking-tight text-gray-400 max-w-2xl text-center">
                Make smarter bets with{" "}
                <span className="font-medium text-white">real-time odds</span>, AI insights, and advanced bankroll
                management.
              </p>
            </div>

            <div className="flex flex-row gap-3">
              <SoftButton href="/auth/signup">
                Talk To Delta <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </SoftButton>
              <SoftButton href="/live-scores">
                Live Scores <ArrowUpRight className="ml-1 inline h-4 w-4" />
              </SoftButton>
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <AvatarCircles avatarUrls={heroAvatarUrls} numPeople={126} />
                <div className="text-center sm:text-left">
                  <p className="text-[0.75rem] uppercase tracking-[0.35em] text-white/60">
                    The sharps&rsquo; favorite new tool
                  </p>
                  <p className="text-sm text-white/80">
                    Trusted by sharps and syndicates around the world.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </FadeInSection>

      {/* Video Showcase */}
      <FadeInSection className="w-full px-4 pb-16" delay={0.2}>
        <div className="max-w-5xl mx-auto">
          <div className="relative w-full overflow-hidden rounded-[30px] border-4 border-[#6C6C6C] bg-[#222222] p-2 md:p-6 shadow-2xl">
            <div className="relative w-full overflow-hidden rounded-2xl bg-black aspect-video">
              <video
                className="h-full w-full object-cover"
                autoPlay
                loop
                muted
                playsInline
                controls
                preload="auto"
                poster="/delta-experience.png"
              >
                <source src="/landingpagevideo-web.mp4" type="video/mp4" />
                <source src="/landingpagevideo.mp4" type='video/mp4; codecs="hvc1"' />
                <track kind="captions" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>
        </div>
      </FadeInSection>

      {/* Sportsbook Ticker */}
      <FadeInSection className="w-full mb-20" delay={0.1}>
        <div className="text-center mb-4">
          <p className="text-sm text-white uppercase tracking-wider font-semibold">Compatible with All Sportsbooks</p>
        </div>
        <SportsbookTicker />
      </FadeInSection>

      {/* Powerful Features */}
      <FadeInSection className="w-full" delay={0.1}>
        <div id="features">
          <FeaturesChat />
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
          <div className="rounded-2xl bg-gradient-to-r from-gray-900 to-gray-800 p-8 md:p-12 text-center text-white shadow-xl border border-gray-700">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">Ready to Elevate Your Betting Game?</h3>
            <p className="text-base md:text-lg text-gray-300 mb-8">
              Join thousands of smart bettors using Delta AI. Get instant access to AI-powered insights, live odds from 10+ sportsbooks, and advanced bankroll management.
            </p>
            <div className="flex justify-center">
              <SoftButton href="/auth/login" className="bg-gray-700 text-white hover:bg-gray-600">
                Sign In
              </SoftButton>
            </div>
          </div>
        </div>
      </FadeInSection>

      <footer className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-16 text-center text-xs text-gray-500 md:px-0">
        <div className="mb-4 text-sm text-gray-400">
          <strong>Disclaimer:</strong> This application is for educational and analytical purposes only. Delta AI does
          not process real bets or transactions. Gambling involves risk. Please bet responsibly.
        </div>
        <div>(c) {new Date().getFullYear()} Delta AI, Inc. All rights reserved.</div>
      </footer>
    </div>
  )
}

