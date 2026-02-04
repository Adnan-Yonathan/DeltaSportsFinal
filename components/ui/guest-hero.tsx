'use client'

import { motion } from 'framer-motion'
import { RotatingWordBadge } from '@/components/ui/rotating-word-badge'
import { TextEffect } from '@/components/ui/text-effect'
import { CommitsGrid } from '@/components/ui/commits-grid'

interface GuestHeroProps {
  onSignUpClick?: () => void
  title?: React.ReactNode
  subtitle?: string
  eyebrow?: string
  compact?: boolean
  className?: string
  useCommitsGrid?: boolean
}

export function GuestHero({
  title,
  subtitle = 'See exactly what the pros see. Uncover the hidden signals and smart money moves that dictate outcomes.',
  eyebrow,
  compact = false,
  className = '',
  useCommitsGrid = false,
}: GuestHeroProps) {
  const titleText = typeof title === 'string' ? title : ''
  const commitsScale =
    titleText.length > 28 ? 0.75 : titleText.length > 22 ? 0.85 : 1

  const heading =
    typeof title === 'string' ? (
      useCommitsGrid ? (
        <div className="flex justify-center">
          <div
            className="matrix-scramble w-fit max-w-full overflow-visible"
            style={{ transform: `scale(${commitsScale})`, transformOrigin: 'center' }}
          >
            <CommitsGrid text={title} />
          </div>
        </div>
      ) : (
        <div className="matrix-scramble overflow-visible rounded-3xl bg-black/20 px-4 py-4 text-center text-xl font-bold tracking-tight text-white backdrop-blur-md sm:px-6 sm:py-6 sm:text-3xl lg:text-5xl">
          <TextEffect per="word" preset="blur" delay={0.1}>
            {title}
          </TextEffect>
        </div>
      )
    ) : (
      title ?? (
        <RotatingWordBadge
          prefix="BET LIKE A "
          className="overflow-visible rounded-3xl bg-black/20 px-4 py-4 text-center text-xl font-bold tracking-tight text-white backdrop-blur-md sm:px-6 sm:py-6 sm:text-3xl lg:text-5xl"
        />
      )
    )

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className={`font-hero text-center ${compact ? 'mb-4 lg:mb-6' : 'mb-8 lg:mb-10'} ${className}`}
    >
      {eyebrow && (
        <p className="mb-2 text-xs uppercase tracking-[0.3em] text-white/85">
          {eyebrow}
        </p>
      )}
      <h1 className="w-full overflow-visible">{heading}</h1>
      {subtitle && (
        <p className={`mx-auto mt-4 max-w-2xl px-4 text-xs leading-relaxed tracking-tight text-white sm:text-base md:text-lg`}>
          {subtitle}
        </p>
      )}
    </motion.div>
  )
}
