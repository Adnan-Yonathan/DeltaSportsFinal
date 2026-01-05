'use client'

import { motion } from 'framer-motion'
import { AvatarCircles } from '@/components/ui/avatar-circles'

const heroAvatarUrls = [
  "https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80",
  "https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=120&q=80",
]

interface SocialProofProps {
  animated?: boolean
}

export function SocialProof({ animated = true }: SocialProofProps) {
  if (animated) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-3"
      >
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <AvatarCircles avatarUrls={heroAvatarUrls} numPeople={126} />
          <div className="text-center sm:text-left">
            <p className="text-[0.75rem] uppercase tracking-[0.35em] text-white/70">
              The sharps&rsquo; favorite new tool
            </p>
            <p className="text-sm text-white">
              Trusted by sharps and syndicates around the world.
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <AvatarCircles avatarUrls={heroAvatarUrls} numPeople={126} />
        <div className="text-center sm:text-left">
          <p className="text-[0.75rem] uppercase tracking-[0.35em] text-white/70">
            The sharps&rsquo; favorite new tool
          </p>
          <p className="text-sm text-white">
            Trusted by sharps and syndicates around the world.
          </p>
        </div>
      </div>
    </div>
  )
}
