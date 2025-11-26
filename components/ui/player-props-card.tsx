'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ArrowUp, ArrowDown, Plus, Minus } from 'lucide-react'
import { ShareButton } from '@/components/ui/share-button'

interface PropOdds {
  best: number
  bestBook: string
  allBooks?: Array<{
    book: string
    odds: number
  }>
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
  const proxiedHeadshot = headshot
    ? `/api/image-proxy?url=${encodeURIComponent(headshot)}`
    : undefined
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isExpanded, setIsExpanded] = useState(false)
  const [selectedBook, setSelectedBook] = useState<string>('best')

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

  // Define main stats for each sport/position
  const getMainStats = (sport: string, position?: string): string[] => {
    const pos = position?.toUpperCase() || ''

    switch (sport) {
      case 'basketball_nba':
      case 'nba':
        return ['points', 'rebounds', 'assists', 'pts+reb+ast', 'threes']

      case 'americanfootball_nfl':
      case 'nfl':
        // QB
        if (pos.includes('QB')) {
          return ['pass_yds', 'passing_yds', 'pass_tds', 'passing_tds', 'pass_attempts', 'pass_completions']
        }
        // RB
        if (pos.includes('RB')) {
          return ['rush_yds', 'rushing_yds', 'rush_attempts', 'rush_tds', 'rushing_tds']
        }
        // WR/TE
        if (pos.includes('WR') || pos.includes('TE')) {
          return ['receptions', 'receiving_yds', 'rec_yds', 'receiving_tds', 'rec_tds']
        }
        // Default for unknown positions
        return ['pass_yds', 'passing_yds', 'rush_yds', 'rushing_yds', 'receptions', 'receiving_yds']

      case 'baseball_mlb':
      case 'mlb':
        // Pitchers
        if (pos.includes('P') || pos.includes('SP') || pos.includes('RP')) {
          return ['strikeouts', 'pitcher_outs', 'earned_runs', 'hits_allowed', 'walks']
        }
        // Hitters
        return ['hits', 'total_bases', 'home_runs', 'rbis', 'runs']

      case 'icehockey_nhl':
      case 'nhl':
        return ['goals', 'assists', 'points', 'shots_on_goal', 'blocked_shots']

      default:
        return []
    }
  }

  // Filter and prioritize markets based on sport/position
  const filterAndPrioritizeMarkets = (allMarkets: Record<string, PropMarket>): [string, PropMarket][] => {
    const mainStats = getMainStats(sport, position)
    const entries = Object.entries(allMarkets)

    if (mainStats.length === 0) {
      // No filtering, return all markets
      return entries
    }

    // Separate markets into main stats and others
    const mainMarkets: [string, PropMarket][] = []
    const otherMarkets: [string, PropMarket][] = []

    for (const entry of entries) {
      const marketKey = entry[0].toLowerCase()
      const isMainStat = mainStats.some(stat => marketKey.includes(stat) || stat.includes(marketKey))

      if (isMainStat) {
        mainMarkets.push(entry)
      } else {
        otherMarkets.push(entry)
      }
    }

    // Sort main markets by priority (order in mainStats array)
    mainMarkets.sort((a, b) => {
      const aKey = a[0].toLowerCase()
      const bKey = b[0].toLowerCase()

      const aIndex = mainStats.findIndex(stat => aKey.includes(stat) || stat.includes(aKey))
      const bIndex = mainStats.findIndex(stat => bKey.includes(stat) || stat.includes(bKey))

      return aIndex - bIndex
    })

    // Return main stats first, then other markets
    return [...mainMarkets, ...otherMarkets]
  }

  const marketEntries = filterAndPrioritizeMarkets(markets)
  const INITIAL_VISIBLE_COUNT = 3
  const hasMoreMarkets = marketEntries.length > INITIAL_VISIBLE_COUNT
  const visibleMarkets = isExpanded ? marketEntries : marketEntries.slice(0, INITIAL_VISIBLE_COUNT)
  const hiddenMarkets = marketEntries.slice(INITIAL_VISIBLE_COUNT)

  // Collect all bookmakers that appear across markets for dropdown options
  const allBooksSet = new Set<string>()
  for (const [, market] of marketEntries) {
    if (market.over.bestBook) allBooksSet.add(market.over.bestBook)
    if (market.under.bestBook) allBooksSet.add(market.under.bestBook)
    market.over.allBooks?.forEach(entry => allBooksSet.add(entry.book))
    market.under.allBooks?.forEach(entry => allBooksSet.add(entry.book))
  }
  const bookOptions = ['best', ...Array.from(allBooksSet).sort((a, b) => a.localeCompare(b))]

  const resolveOdds = (side: 'over' | 'under', market: PropMarket) => {
    const target = market[side]
    if (selectedBook === 'best' || !target.allBooks || target.allBooks.length === 0) {
      return { odds: target.best, book: target.bestBook }
    }
    const selectedLower = selectedBook.toLowerCase()
    const match = target.allBooks.find(entry => entry.book.toLowerCase() === selectedLower)
    if (match) return { odds: match.odds, book: match.book }
    // If the user picked the same book as bestBook but it wasn't in allBooks, fallback to best
    if (target.bestBook && target.bestBook.toLowerCase() === selectedLower) {
      return { odds: target.best, book: target.bestBook }
    }
    return { odds: Number.NaN, book: selectedBook }
  }

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
          {proxiedHeadshot ? (
            <motion.div
              className="w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-purple-500/30 flex-shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
            >
              <img
                src={proxiedHeadshot}
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

          {/* Right rail controls */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <motion.div
              className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-semibold"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {formatSport(sport)}
            </motion.div>
            {bookOptions.length > 1 && (
              <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                <span className="text-[11px] uppercase tracking-wide text-white/50">Odds</span>
                <select
                  value={selectedBook}
                  onChange={(e) => setSelectedBook(e.target.value)}
                  className="bg-transparent text-xs text-white font-semibold outline-none"
                >
                  <option value="best">Best available</option>
                  {bookOptions
                    .filter((opt) => opt !== 'best')
                    .map((book) => (
                      <option key={book} value={book}>
                        {book}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <ShareButton
              targetRef={cardRef}
              filename={`${player.replace(/\s+/g, '_')}_props.png`}
            />
          </div>
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
                  {(() => {
                    const { odds, book } = resolveOdds('over', market)
                    const isAvailable = Number.isFinite(odds)
                    return (
                      <>
                        <div className={`text-base sm:text-lg font-bold ${isAvailable ? 'text-white' : 'text-white/40'} mb-0.5`}>
                          {isAvailable ? formatOdds(odds) : 'N/A'}
                        </div>
                        <div className="text-xs text-white/40 truncate">
                          {isAvailable ? book : `${book} unavailable`}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Under */}
                <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                    <span className="text-xs text-white/50 uppercase tracking-wide">Under</span>
                  </div>
                  {(() => {
                    const { odds, book } = resolveOdds('under', market)
                    const isAvailable = Number.isFinite(odds)
                    return (
                      <>
                        <div className={`text-base sm:text-lg font-bold ${isAvailable ? 'text-white' : 'text-white/40'} mb-0.5`}>
                          {isAvailable ? formatOdds(odds) : 'N/A'}
                        </div>
                        <div className="text-xs text-white/40 truncate">
                          {isAvailable ? book : `${book} unavailable`}
                        </div>
                      </>
                    )
                  })()}
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
                  {(() => {
                    const { odds, book } = resolveOdds('over', market)
                    const isAvailable = Number.isFinite(odds)
                    return (
                      <>
                        <div className={`text-base sm:text-lg font-bold ${isAvailable ? 'text-white' : 'text-white/40'} mb-0.5`}>
                          {isAvailable ? formatOdds(odds) : 'N/A'}
                        </div>
                        <div className="text-xs text-white/40 truncate">
                          {isAvailable ? book : `${book} unavailable`}
                        </div>
                      </>
                    )
                  })()}
                </div>

                {/* Under */}
                <div className="p-3 sm:p-4 hover:bg-white/5 transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <ArrowDown className="w-3 h-3 sm:w-4 sm:h-4 text-red-400" />
                    <span className="text-xs text-white/50 uppercase tracking-wide">Under</span>
                  </div>
                  {(() => {
                    const { odds, book } = resolveOdds('under', market)
                    const isAvailable = Number.isFinite(odds)
                    return (
                      <>
                        <div className={`text-base sm:text-lg font-bold ${isAvailable ? 'text-white' : 'text-white/40'} mb-0.5`}>
                          {isAvailable ? formatOdds(odds) : 'N/A'}
                        </div>
                        <div className="text-xs text-white/40 truncate">
                          {isAvailable ? book : `${book} unavailable`}
                        </div>
                      </>
                    )
                  })()}
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
