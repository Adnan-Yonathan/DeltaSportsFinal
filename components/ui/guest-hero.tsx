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
        Bet Like a{' '}
        <span className="bg-gradient-to-r from-[#34d399] via-[#34d399] to-[#16a34a] bg-clip-text text-transparent">
          Pro
        </span>
        <br />
        All in One{' '}
        <span className="bg-gradient-to-r from-[#34d399] via-[#34d399] to-[#16a34a] bg-clip-text text-transparent">
          Platform
        </span>
      </h1>
      <p className="text-base md:text-lg leading-relaxed tracking-tight text-white/80 max-w-2xl mx-auto">
        See exactly what the pros see. Uncover the hidden signals and smart money moves that dictate outcomes.
      </p>
    </motion.div>
  )
}
