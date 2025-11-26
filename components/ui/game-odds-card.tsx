'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { ParsedGameOdds, ParsedMarket, BookmakerOdds } from '@/lib/utils/stats-parser'

interface GameOddsCardProps extends Omit<ParsedGameOdds, 'type' | 'originalText'> {}

export const GameOddsCard: React.FC<GameOddsCardProps> = ({
  awayTeam,
  homeTeam,
  awayLogo,
  homeLogo,
  sport,
  gameTime,
  markets,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set(['moneyline']))
  const [showAllBookmakers, setShowAllBookmakers] = useState(false)

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

  const toggleMarket = (marketKey: string) => {
    const newSet = new Set(expandedMarkets)
    if (expandedMarkets.has(marketKey)) {
      newSet.delete(marketKey)
    } else {
      newSet.add(marketKey)
    }
    setExpandedMarkets(newSet)
  }

  // Format sport label
  const formatSport = (sportKey: string) => {
    const map: Record<string, string> = {
      basketball_nba: 'NBA',
      americanfootball_nfl: 'NFL',
      baseball_mlb: 'MLB',
      icehockey_nhl: 'NHL',
      basketball_ncaab: 'NCAAB',
      americanfootball_ncaaf: 'NCAAF',
    }
    return map[sportKey] || sportKey.toUpperCase()
  }

  // Get team abbreviation or initials
  const getTeamAbbr = (teamName: string) => {
    // Try common abbreviations first
    const abbrs: Record<string, string> = {
      'Los Angeles Lakers': 'LAL',
      'Boston Celtics': 'BOS',
      'Golden State Warriors': 'GSW',
      // Add more as needed
    }

    if (abbrs[teamName]) return abbrs[teamName]

    // Fallback: take first letter of each word
    return teamName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
  }

  return (
    <motion.div
      ref={cardRef}
      className="relative rounded-2xl sm:rounded-3xl overflow-hidden w-full max-w-4xl mx-auto touch-manipulation"
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
        <div className="flex items-start justify-between mb-4 sm:mb-6">
          <div className="flex-1 min-w-0">
            {/* Team Matchup */}
            <motion.div
              className="flex items-center gap-2 sm:gap-3 mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              {/* Away Team */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {awayLogo ? (
                  <img src={awayLogo} alt={awayTeam} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 flex-shrink-0">
                    <span className="text-white text-xs font-bold">{getTeamAbbr(awayTeam)}</span>
                  </div>
                )}
                <span className="text-base sm:text-lg font-bold text-white truncate">{awayTeam}</span>
              </div>

              <span className="text-white/40 text-sm sm:text-base px-2 flex-shrink-0">@</span>

              {/* Home Team */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base sm:text-lg font-bold text-white truncate">{homeTeam}</span>
                {homeLogo ? (
                  <img src={homeLogo} alt={homeTeam} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-purple-600 to-indigo-600 flex-shrink-0">
                    <span className="text-white text-xs font-bold">{getTeamAbbr(homeTeam)}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Game Time */}
            {gameTime && (
              <motion.div
                className="text-xs sm:text-sm text-purple-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {gameTime}
              </motion.div>
            )}
          </div>

          {/* Sport Badge */}
          <motion.div
            className="px-2.5 sm:px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-semibold flex-shrink-0 ml-3"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            {formatSport(sport)}
          </motion.div>
        </div>

        {/* Markets Accordion */}
        <div className="space-y-3">
          {markets.moneyline && (
            <MarketSection
              marketKey="moneyline"
              marketLabel="Moneyline"
              market={markets.moneyline}
              isExpanded={expandedMarkets.has('moneyline')}
              onToggle={() => toggleMarket('moneyline')}
              showAllBookmakers={showAllBookmakers}
              onToggleBookmakers={() => setShowAllBookmakers(!showAllBookmakers)}
            />
          )}
          {markets.spreads && (
            <MarketSection
              marketKey="spreads"
              marketLabel="Spread"
              market={markets.spreads}
              isExpanded={expandedMarkets.has('spreads')}
              onToggle={() => toggleMarket('spreads')}
              showAllBookmakers={showAllBookmakers}
              onToggleBookmakers={() => setShowAllBookmakers(!showAllBookmakers)}
            />
          )}
          {markets.totals && (
            <MarketSection
              marketKey="totals"
              marketLabel="Total"
              market={markets.totals}
              isExpanded={expandedMarkets.has('totals')}
              onToggle={() => toggleMarket('totals')}
              showAllBookmakers={showAllBookmakers}
              onToggleBookmakers={() => setShowAllBookmakers(!showAllBookmakers)}
            />
          )}
        </div>

        {/* Footer */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-xs text-purple-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <Trophy className="w-4 h-4" />
          <span>Game Odds</span>
        </motion.div>
      </div>
    </motion.div>
  )
}

// Market Section Component
interface MarketSectionProps {
  marketKey: string
  marketLabel: string
  market: ParsedMarket
  isExpanded: boolean
  onToggle: () => void
  showAllBookmakers: boolean
  onToggleBookmakers: () => void
}

const MarketSection: React.FC<MarketSectionProps> = ({
  marketKey,
  marketLabel,
  market,
  isExpanded,
  onToggle,
  showAllBookmakers,
  onToggleBookmakers,
}) => {
  // Extract all bookmakers
  const allBookmakers = extractAllBookmakers(market)
  const visibleBookmakers = showAllBookmakers ? allBookmakers : allBookmakers.slice(0, 3)
  const hiddenCount = allBookmakers.length - 3

  // Calculate best odds
  const bestOddsMap = calculateBestOdds(market, marketKey)

  return (
    <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
      {/* Market Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="text-sm sm:text-base font-semibold text-white">{marketLabel}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
        ) : (
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
        )}
      </button>

      {/* Collapsible Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {market.outcomes.map((outcome, index) => (
                <div key={index} className="space-y-2">
                  <div className="text-xs sm:text-sm font-medium text-white/70">{outcome.label}</div>

                  {/* Bookmaker Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {visibleBookmakers.map((bookmakerName) => {
                      const odds = outcome.bookmakers[bookmakerName]
                      if (!odds) return null

                      const isBest = isBestOdds(bookmakerName, outcome.label, bestOddsMap)

                      return (
                        <BookmakerCard
                          key={bookmakerName}
                          name={bookmakerName}
                          odds={odds}
                          marketType={marketKey}
                          isBest={isBest}
                        />
                      )
                    })}
                  </div>
                </div>
              ))}

              {/* Show More Button */}
              {hiddenCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    onToggleBookmakers()
                  }}
                  className="w-full mt-3 py-2 px-4 rounded-lg bg-purple-600/10 border border-purple-500/30 hover:bg-purple-600/20 hover:border-purple-500/50 transition-all text-xs sm:text-sm font-semibold text-purple-300"
                >
                  {showAllBookmakers ? `Show Less` : `Show ${hiddenCount} More Bookmaker${hiddenCount > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Bookmaker Card Component
interface BookmakerCardProps {
  name: string
  odds: BookmakerOdds
  marketType: string
  isBest: boolean
}

const BookmakerCard: React.FC<BookmakerCardProps> = ({ name, odds, marketType, isBest }) => {
  const displayText = formatOddsDisplay(odds, marketType)

  const bookmakerNameElement = odds.url ? (
    <a
      href={odds.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-white/60 hover:text-purple-400 hover:underline transition-colors truncate block"
      onClick={(e) => e.stopPropagation()} // Prevent accordion toggle
    >
      {name}
    </a>
  ) : (
    <div className="text-xs text-white/60 truncate">{name}</div>
  )

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all
        ${
          isBest
            ? 'border-green-500 bg-green-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20'
        }
      `}
    >
      <div className="mb-1">{bookmakerNameElement}</div>
      <div className={`text-sm sm:text-base font-bold ${isBest ? 'text-green-400' : 'text-white'}`}>
        {displayText}
      </div>
    </div>
  )
}

// Utility Functions

function extractAllBookmakers(market: ParsedMarket): string[] {
  const bookmakerSet = new Set<string>()

  for (const outcome of market.outcomes) {
    Object.keys(outcome.bookmakers).forEach(book => bookmakerSet.add(book))
  }

  // Prioritize common bookmakers
  const priority = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle']
  const bookmakers = Array.from(bookmakerSet)

  return bookmakers.sort((a, b) => {
    const aIndex = priority.indexOf(a)
    const bIndex = priority.indexOf(b)

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.localeCompare(b)
  })
}

function calculateBestOdds(market: ParsedMarket, marketType: string): Map<string, string> {
  const bestMap = new Map<string, string>() // outcome label -> best bookmaker

  for (const outcome of market.outcomes) {
    let bestBookmaker: string | null = null
    let bestValue: number | null = null

    for (const [bookmakerName, odds] of Object.entries(outcome.bookmakers)) {
      if (marketType === 'moneyline') {
        // For moneyline, higher odds is better (less risk, more payout)
        if (bestValue === null || odds.price > bestValue) {
          bestValue = odds.price
          bestBookmaker = bookmakerName
        }
      } else if (marketType === 'spreads') {
        // For spreads, compare based on the point value
        // More positive spread is better for underdogs, less negative is better for favorites
        if (odds.point !== undefined) {
          if (bestValue === null || odds.point > bestValue) {
            bestValue = odds.point
            bestBookmaker = bookmakerName
          } else if (odds.point === bestValue) {
            // If points are equal, prefer better odds
            const currentBestOdds = outcome.bookmakers[bestBookmaker!]
            if (currentBestOdds && odds.price > currentBestOdds.price) {
              bestBookmaker = bookmakerName
            }
          }
        }
      } else if (marketType === 'totals') {
        // For totals, at same line, better odds is better
        if (bestValue === null || odds.price > bestValue) {
          bestValue = odds.price
          bestBookmaker = bookmakerName
        }
      }
    }

    if (bestBookmaker) {
      bestMap.set(outcome.label, bestBookmaker)
    }
  }

  return bestMap
}

function isBestOdds(bookmakerName: string, outcomeLabel: string, bestOddsMap: Map<string, string>): boolean {
  return bestOddsMap.get(outcomeLabel) === bookmakerName
}

function formatOddsDisplay(odds: BookmakerOdds, marketType: string): string {
  const formatAmericanOdds = (price: number) => (price > 0 ? `+${price}` : `${price}`)
  const formatPoint = (point: number) => (point > 0 ? `+${point}` : `${point}`)

  if (marketType === 'moneyline') {
    return formatAmericanOdds(odds.price)
  }

  if (marketType === 'spreads' && odds.point !== undefined) {
    return `${formatPoint(odds.point)} (${formatAmericanOdds(odds.price)})`
  }

  if (marketType === 'totals' && odds.point !== undefined) {
    return `${odds.point} (${formatAmericanOdds(odds.price)})`
  }

  return formatAmericanOdds(odds.price)
}
