'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ArrowUp, ArrowDown, Plus, Minus } from 'lucide-react'

interface PropOdds {
  best: number
  bestBook: string
}

interface PropMarket {
  line: number | string
  over: PropOdds
  under: PropOdds
}

interface PlayerPropsCardProps {
  player: string
  team?: string
  teamAbbr?: string
  position?: string
  sport: string
  game?: string
  headshot?: string
  markets: Record<string, PropMarket>
}

export const PlayerPropsCard: React.FC<PlayerPropsCardProps> = ({
  player,
  team,
  teamAbbr,
  position,
  sport,
  game,
  headshot,
  markets,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isExpanded, setIsExpanded] = useState(false)

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

  // Format sport label
  const formatSport = (sportKey: string) => {
    const map: Record<string, string> = {
      basketball_nba: 'NBA',
      americanfootball_nfl: 'NFL',
      baseball_mlb: 'MLB',
      icehockey_nhl: 'NHL',
    }
    return map[sportKey] || sportKey.toUpperCase()
  }

  // Format market name for display
  const formatMarketName = (key: string) => {
    return key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase())
  }

  // Format odds (American odds format)
  const formatOdds = (odds: number) => {
    return odds > 0 ? `+${odds}` : `${odds}`
  }

  const marketEntries = Object.entries(markets)
  const INITIAL_VISIBLE_COUNT = 3
  const hasMoreMarkets = marketEntries.length > INITIAL_VISIBLE_COUNT
  const visibleMarkets = isExpanded ? marketEntries : marketEntries.slice(0, INITIAL_VISIBLE_COUNT)
  const hiddenMarkets = marketEntries.slice(INITIAL_VISIBLE_COUNT)

  return (
    <motion.div
      ref={cardRef}
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden w-full max-w-2xl mx-auto touch-manipulation"
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
          {/* Player Headshot */}
          {headshot ? (
            <motion.div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-purple-500/30 flex-shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <img
                src={headshot}
                alt={player}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />
            </motion.div>
          ) : (
            <motion.div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 flex-shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <TrendingUp className="w-7 h-7 sm:w-8 sm:h-8 text-white" />
            </motion.div>
          )}

          {/* Player Info */}
          <div className="flex-1 min-w-0">
            <motion.h3
              className="text-lg sm:text-xl font-bold text-white mb-1 truncate"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              {player}
            </motion.h3>
            <motion.div
              className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-white/60"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {team && (
                <>
                  <span className="font-medium truncate">{teamAbbr || team}</span>
                  {position && (
                    <>
                      <span className="text-white/30">•</span>
                      <span className="truncate">{position}</span>
                    </>
                  )}
                </>
              )}
            </motion.div>
            {game && (
              <motion.div
                className="text-xs text-purple-400 mt-1 truncate"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                {game}
              </motion.div>
            )}
          </div>

          {/* Sport Badge */}
          <motion.div
            className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex-shrink-0"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {formatSport(sport)}
          </motion.div>
        </div>

        {/* Props Markets */}
        <div className="space-y-3 sm:space-y-4">
          {visibleMarkets.slice(0, INITIAL_VISIBLE_COUNT).map(([marketKey, market], index) => (
            <motion.div
              key={marketKey}
              className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 overflow-hidden"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * index + 0.4 }}
            >
              {/* Market Header */}
              <div className="px-3 sm:px-4 py-2 bg-white/5 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm font-semibold text-white/90">
                    {formatMarketName(marketKey)}
                  </span>
                  <span className="text-sm sm:text-base font-bold text-purple-300">
                    {market.line}
                  </span>
                </div>
              </div>

              {/* Over/Under Grid */}
              <div className="grid grid-cols-2 divide-x divide-white/5">
                {/* Over */}
                <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                    <span className="text-xs text-white/50 uppercase tracking-wide">Over</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white mb-0.5">
                    {formatOdds(market.over.best)}
                  </div>
                  <div className="text-xs text-white/40 truncate">{market.over.bestBook}</div>
                </div>

                {/* Under */}
                <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                    <span className="text-xs text-white/50 uppercase tracking-wide">Under</span>
                  </div>
                  <div className="text-base sm:text-lg font-bold text-white mb-0.5">
                    {formatOdds(market.under.best)}
                  </div>
                  <div className="text-xs text-white/40 truncate">{market.under.bestBook}</div>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Expanded Markets */}
          <AnimatePresence>
            {isExpanded &&
              hiddenMarkets.map(([marketKey, market], index) => (
                <motion.div
                  key={marketKey}
                  className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/5 overflow-hidden"
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  {/* Market Header */}
                  <div className="px-3 sm:px-4 py-2 bg-white/5 border-b border-white/5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs sm:text-sm font-semibold text-white/90">
                        {formatMarketName(marketKey)}
                      </span>
                      <span className="text-sm sm:text-base font-bold text-purple-300">
                        {market.line}
                      </span>
                    </div>
                  </div>

                  {/* Over/Under Grid */}
                  <div className="grid grid-cols-2 divide-x divide-white/5">
                    {/* Over */}
                    <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowUp className="w-3 h-3 sm:w-4 sm:h-4 text-green-400" />
                        <span className="text-xs text-white/50 uppercase tracking-wide">Over</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-white mb-0.5">
                        {formatOdds(market.over.best)}
                      </div>
                      <div className="text-xs text-white/40 truncate">{market.over.bestBook}</div>
                    </div>

                    {/* Under */}
                    <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                      <div className="flex items-center gap-2 mb-1">
                        <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                        <span className="text-xs text-white/50 uppercase tracking-wide">Under</span>
                      </div>
                      <div className="text-base sm:text-lg font-bold text-white mb-0.5">
                        {formatOdds(market.under.best)}
                      </div>
                      <div className="text-xs text-white/40 truncate">{market.under.bestBook}</div>
                    </div>
                  </div>
                </motion.div>
              ))}
          </AnimatePresence>

          {/* Expand/Collapse Button */}
          {hasMoreMarkets && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full mt-3 py-3 px-4 rounded-lg bg-purple-600/10 border border-purple-500/30 hover:bg-purple-600/20 hover:border-purple-500/50 transition-all flex items-center justify-center gap-2 text-sm font-semibold text-purple-300"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isExpanded ? (
                <>
                  <Minus className="w-4 h-4" />
                  <span>Show Less</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Show {hiddenMarkets.length} More</span>
                </>
              )}
            </motion.button>
          )}
        </div>

        {/* Footer */}
        <motion.div
          className="mt-4 sm:mt-6 flex items-center gap-2 text-xs text-purple-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Player Props</span>
        </motion.div>
      </div>
    </motion.div>
  )
}
