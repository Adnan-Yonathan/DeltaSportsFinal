'use client'

import React, { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Trophy, TrendingUp, Shield } from 'lucide-react'

interface TeamStatsCardProps {
  team: string
  sport: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string | null>
}

export const TeamStatsCard: React.FC<TeamStatsCardProps> = ({
  team,
  sport,
  wins,
  losses,
  winPct,
  stats,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left - rect.width / 2
      const y = e.clientY - rect.top - rect.height / 2
      const rotateX = -(y / rect.height) * 3
      const rotateY = (x / rect.width) * 3
      setRotation({ x: rotateX, y: rotateY })
    }
  }

  const handleMouseLeave = () => {
    setIsHovered(false)
    setRotation({ x: 0, y: 0 })
  }

  const formatSport = (sportKey: string) => {
    const map: Record<string, string> = {
      basketball_nba: 'NBA',
      americanfootball_nfl: 'NFL',
      baseball_mlb: 'MLB',
      icehockey_nhl: 'NHL',
    }
    return map[sportKey] || sportKey.toUpperCase()
  }

  const formatStatLabel = (key: string) => {
    const lower = key.toLowerCase()
    if (lower.includes('epa') && lower.includes('play')) return 'EPA/play'
    if (lower === 'epa_total') return 'EPA Total'
    return key
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/\b\w/g, (l) => l.toUpperCase())
      .trim()
  }

  const formatStatValue = (value: any) => {
    if (value == null) return 'N/A'
    if (typeof value === 'number') {
      if (value > -1 && value < 1 && Math.abs(value) < 0.5 && Math.abs(value) >= 0) {
        // More precision for per-play efficiency
        return value.toFixed(3)
      }
      return Number.isInteger(value) ? value.toString() : value.toFixed(1)
    }
    return String(value)
  }

  // Filter out some common redundant stats
  const displayStats = Object.entries(stats).filter(
    ([key]) =>
      !['wins', 'losses', 'winPct', 'winPercent', 'gamesPlayed'].includes(key)
  )

  // Prioritize key efficiency stats for NFL (EPA/play)
  const priorityOrder = ['epa_per_play', 'epa/play', 'epa per play']
  const normalizeKey = (key: string) => key.toLowerCase().replace(/[\s/_-]+/g, '')
  displayStats.sort((a, b) => {
    const aIdx = priorityOrder.findIndex(p => normalizeKey(a[0]).includes(p.replace(/[^\w]/g, '')))
    const bIdx = priorityOrder.findIndex(p => normalizeKey(b[0]).includes(p.replace(/[^\w]/g, '')))
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  })

  return (
    <motion.div
      ref={cardRef}
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden w-full max-w-md mx-auto touch-manipulation"
      style={{
        transformStyle: 'preserve-3d',
        backgroundColor: '#0e131f',
        boxShadow: '0 -10px 100px 10px rgba(139, 92, 246, 0.15), 0 0 10px 0 rgba(0, 0, 0, 0.5)',
      }}
      initial={{ y: 0 }}
      animate={{
        y: isHovered ? -5 : 0,
        rotateX: rotation.x,
        rotateY: rotation.y,
      }}
      transition={{
        type: 'spring',
        stiffness: 300,
        damping: 20,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
    >
      {/* Glass reflection overlay */}
      <motion.div
        className="absolute inset-0 z-30 pointer-events-none"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 80%, rgba(255,255,255,0.05) 100%)',
          backdropFilter: 'blur(2px)',
        }}
        animate={{
          opacity: isHovered ? 0.7 : 0.5,
        }}
        transition={{
          duration: 0.4,
          ease: 'easeOut',
        }}
      />

      {/* Dark background */}
      <div
        className="absolute inset-0 z-0"
        style={{
          background: 'linear-gradient(180deg, #000000 0%, #0a0a0a 100%)',
        }}
      />

      {/* Purple gradient glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-2/3 z-20"
        style={{
          background: `
            radial-gradient(ellipse at bottom center, rgba(139, 92, 246, 0.6) -10%, rgba(79, 70, 229, 0) 70%)
          `,
          filter: 'blur(40px)',
        }}
        animate={{
          opacity: isHovered ? 0.8 : 0.6,
          y: isHovered ? rotation.x * 0.5 : 0,
        }}
        transition={{
          duration: 0.4,
          ease: 'easeOut',
        }}
      />

      {/* Bottom border glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] z-25"
        style={{
          background:
            'linear-gradient(90deg, rgba(139, 92, 246, 0.05) 0%, rgba(139, 92, 246, 0.8) 50%, rgba(139, 92, 246, 0.05) 100%)',
        }}
        animate={{
          boxShadow: isHovered
            ? '0 0 20px 4px rgba(139, 92, 246, 0.9), 0 0 30px 6px rgba(124, 58, 237, 0.7)'
            : '0 0 15px 3px rgba(139, 92, 246, 0.7), 0 0 25px 5px rgba(124, 58, 237, 0.5)',
          opacity: isHovered ? 1 : 0.9,
        }}
        transition={{
          duration: 0.4,
          ease: 'easeOut',
        }}
      />

      {/* Card content */}
      <div className="relative z-40 p-4 sm:p-6">
        {/* Header Section */}
        <div className="flex items-start gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Team Icon */}
          <motion.div
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-600 flex-shrink-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Shield className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
          </motion.div>

          {/* Team Info */}
          <div className="flex-1 min-w-0">
            <motion.h3
              className="text-lg sm:text-xl font-bold text-white mb-1 truncate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {team}
            </motion.h3>
            <motion.div
              className="text-xs sm:text-sm text-white/60"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <span className="font-bold text-white text-base sm:text-lg">
                {wins}-{losses}
              </span>
              <span className="text-white/40 mx-1 sm:mx-2">ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€šÃ‚Â¢</span>
              <span className="text-emerald-400 font-semibold">
                {(winPct * 100).toFixed(1)}%
              </span>
            </motion.div>
          </div>

          {/* Sport Badge */}
          <motion.div
            className="px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {formatSport(sport)}
          </motion.div>
        </div>

        {/* Stats Grid */}
        {displayStats.length > 0 && (
          <div className="space-y-2 sm:space-y-3">
            {displayStats.slice(0, 6).map(([key, value], index) => (
              <motion.div
                key={key}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 hover:border-emerald-500/30 transition-colors"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 * index + 0.4 }}
              >
                <span className="text-xs sm:text-sm text-white/70 font-medium truncate mr-2">
                  {formatStatLabel(key)}
                </span>
                <span className="text-base sm:text-lg font-bold text-white flex-shrink-0">
                  {formatStatValue(value)}
                </span>
              </motion.div>
            ))}
          </div>
        )}

        {/* Team Performance Indicator */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-xs text-emerald-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Trophy className="w-4 h-4" />
          <span>Team Statistics</span>
        </motion.div>
      </div>
    </motion.div>
  )
}
