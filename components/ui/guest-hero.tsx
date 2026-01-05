'use client'

import { motion } from 'framer-motion'

interface GuestHeroProps {
  onSignUpClick: () => void
}

export function GuestHero({ onSignUpClick }: GuestHeroProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="text-center"
    >
      <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-4">
        The AI Sports Betting{' '}
        <span className="relative inline-block px-1 pb-1">
          <motion.span
            className="absolute -inset-1 bg-[#34d399]/25 blur-xl rounded-lg -z-10"
            animate={{
              opacity: [0.5, 0.8, 0.5],
              scale: [1, 1.05, 1],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
          <span className="bg-gradient-to-r from-[#34d399] via-[#34d399] to-[#16a34a] bg-clip-text text-transparent relative z-10">
            Assistant
          </span>
        </span>
      </h1>
      <p className="text-base md:text-lg leading-relaxed tracking-tight text-white/80 max-w-2xl mx-auto">
        Make smarter bets with real-time odds, projections, and AI analysis across all major sports.
      </p>
    </motion.div>
  )
}
