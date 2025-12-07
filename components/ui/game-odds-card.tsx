'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, ChevronDown, ChevronUp, Trophy } from 'lucide-react'
import { ParsedGameOdds, ParsedMarket, BookmakerOdds } from '@/lib/utils/stats-parser'
import { ShareButton } from '@/components/ui/share-button'

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
  const proxiedAwayLogo = awayLogo ? `/api/image-proxy?url=${encodeURIComponent(awayLogo)}` : undefined
  const proxiedHomeLogo = homeLogo ? `/api/image-proxy?url=${encodeURIComponent(homeLogo)}` : undefined
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [expandedMarkets, setExpandedMarkets] = useState<Set<string>>(new Set(['moneyline']))

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
        <div className="flex items-start justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
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
                {proxiedAwayLogo ? (
                  <img src={proxiedAwayLogo} alt={awayTeam} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-600 flex-shrink-0">
                    <span className="text-white text-xs font-bold">{getTeamAbbr(awayTeam)}</span>
                  </div>
                )}
                <span className="text-base sm:text-lg font-bold text-white truncate">{awayTeam}</span>
              </div>

              <span className="text-white/40 text-sm sm:text-base px-2 flex-shrink-0">@</span>

              {/* Home Team */}
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="text-base sm:text-lg font-bold text-white truncate">{homeTeam}</span>
                {proxiedHomeLogo ? (
                  <img src={proxiedHomeLogo} alt={homeTeam} className="w-8 h-8 sm:w-10 sm:h-10 object-contain" />
                ) : (
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-600 to-emerald-600 flex-shrink-0">
                    <span className="text-white text-xs font-bold">{getTeamAbbr(homeTeam)}</span>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Game Time */}
            {gameTime && (
              <motion.div
                className="text-xs sm:text-sm text-emerald-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                {gameTime}
              </motion.div>
            )}
          </div>

          {/* Right rail */}
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <motion.div
              className="px-2.5 sm:px-3 py-1 rounded-full bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex-shrink-0"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              {formatSport(sport)}
            </motion.div>
            <ShareButton
              targetRef={cardRef}
              filename={`${awayTeam.replace(/\s+/g, '_')}_at_${homeTeam.replace(/\s+/g, '_')}_odds.png`}
            />
          </div>
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
            />
          )}
          {markets.spreads && (
            <MarketSection
              marketKey="spreads"
              marketLabel="Spread"
              market={markets.spreads}
              isExpanded={expandedMarkets.has('spreads')}
              onToggle={() => toggleMarket('spreads')}
            />
          )}
          {markets.totals && (
            <MarketSection
              marketKey="totals"
              marketLabel="Total"
              market={markets.totals}
              isExpanded={expandedMarkets.has('totals')}
              onToggle={() => toggleMarket('totals')}
            />
          )}
        </div>

        {/* Footer */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-xs text-emerald-400"
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
}

const MarketSection: React.FC<MarketSectionProps> = ({
  marketKey,
  marketLabel,
  market,
  isExpanded,
  onToggle,
}) => {
  const [expandedBookmakers, setExpandedBookmakers] = useState<Record<string, boolean>>({})

  const isOutcomeExpanded = (label: string) => expandedBookmakers[label] === true
  const toggleOutcomeExpansion = (label: string) => {
    setExpandedBookmakers((prev) => ({
      ...prev,
      [label]: !prev[label],
    }))
  }

  // Calculate best odds
  const bestOddsMap = calculateBestOdds(market, marketKey)

  // Get both outcomes (teams or Over/Under)
  const outcome1 = market.outcomes[0]
  const outcome2 = market.outcomes[1]

  // Safety check - need at least one outcome
  if (!outcome1) {
    return (
      <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 p-4">
        <span className="text-sm text-white/50">No odds available for {marketLabel}</span>
      </div>
    )
  }

  // Special handling for totals - use side-by-side display
  const isTotals = marketKey === 'totals'
  const totalsOver = isTotals
    ? market.outcomes.find(o => o.label.toLowerCase() === 'over')
    : undefined
  const totalsUnder = isTotals
    ? market.outcomes.find(o => o.label.toLowerCase() === 'under')
    : undefined

  // Get top bookmakers for each outcome
  const limit1 = isOutcomeExpanded(outcome1.label) ? undefined : 3
  const limit2 = outcome2 && isOutcomeExpanded(outcome2.label) ? undefined : 3

  const bookmakers1 = getTopBookmakersByOdds(outcome1, marketKey, limit1)
  const bookmakers2 = outcome2 ? getTopBookmakersByOdds(outcome2, marketKey, limit2) : []

  // For totals, use common bookmakers (since Over/Under should have same books)
  const totalsBookmakersAll = isTotals ? extractAllBookmakers(market) : []
  const totalsBookmakers = isTotals
    ? (isOutcomeExpanded('__totals__')
        ? totalsBookmakersAll
        : totalsBookmakersAll.slice(0, 3))
    : []

  // Debug logging
  if (typeof window !== 'undefined') {
    console.log(`\n=== [${marketKey}] Market Debug ===`)
    console.log('isTotals:', isTotals)
    console.log('outcome1:', outcome1?.label, 'bookmakers:', Object.keys(outcome1?.bookmakers || {}))
    console.log('outcome2:', outcome2?.label, 'bookmakers:', Object.keys(outcome2?.bookmakers || {}))
    console.log('bookmakers1 (top for outcome1):', bookmakers1)
    console.log('bookmakers2 (top for outcome2):', bookmakers2)
    console.log('totalsBookmakers:', totalsBookmakers)
  }

  // Calculate total unique bookmakers for "Show More" button
  const totalBookmakers1 = Object.keys(outcome1.bookmakers).length
  const hiddenCount1 = Math.max(0, totalBookmakers1 - bookmakers1.length)
  const totalBookmakers2 = outcome2 ? Object.keys(outcome2.bookmakers).length : 0
  const hiddenCount2 = Math.max(0, totalBookmakers2 - bookmakers2.length)
  const totalsHiddenCount = isTotals
    ? Math.max(0, totalsBookmakersAll.length - totalsBookmakers.length)
    : 0

  return (
    <div className="rounded-lg bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden">
      {/* Market Header */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <span className="text-sm sm:text-base font-semibold text-white">{marketLabel}</span>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
        ) : (
          <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400" />
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
            <div className="px-4 pb-4">
              {isTotals && (totalsOver || totalsUnder) ? (
                /* Totals Market - Side-by-side Over/Under display */
                <>
                  {/* Over/Under Headers */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="text-xs sm:text-sm font-semibold text-white/80 text-center py-2 rounded-lg bg-white/5">
                      {totalsOver?.label ?? 'Over'}
                    </div>
                    <div className="text-xs sm:text-sm font-semibold text-white/80 text-center py-2 rounded-lg bg-white/5">
                      {totalsUnder?.label ?? 'Under'}
                    </div>
                  </div>

                  {/* Bookmaker Rows - Side by side for totals */}
                  <div className="space-y-2">
                    {totalsBookmakers.map((bookmakerName) => {
                      const odds1 = (totalsOver || outcome1)?.bookmakers[bookmakerName]
                      const odds2 = (totalsUnder || outcome2 || totalsOver || outcome1)?.bookmakers[bookmakerName]

                      if (!odds1 && !odds2) return null

                      const isBest1 = totalsOver
                        ? isBestOdds(bookmakerName, totalsOver.label, bestOddsMap)
                        : isBestOdds(bookmakerName, outcome1.label, bestOddsMap)
                      const isBest2 = totalsUnder
                        ? isBestOdds(bookmakerName, totalsUnder.label, bestOddsMap)
                        : outcome2
                          ? isBestOdds(bookmakerName, outcome2.label, bestOddsMap)
                          : false

                      return (
                        <div key={bookmakerName} className="flex items-stretch gap-2">
                          {/* Bookmaker Name */}
                          <div className="w-24 sm:w-28 flex-shrink-0 flex items-center justify-center px-2 py-3 rounded-lg bg-white/5 border border-white/10">
                            <span className="text-xs font-medium text-white/70 text-center truncate">
                              {bookmakerName}
                            </span>
                          </div>

                          {/* Both Over/Under Odds */}
                          <div className="flex-1 grid grid-cols-2 gap-2">
                            {/* Over Odds */}
                            {odds1 ? (
                              <OddsDisplay
                                odds={odds1}
                                marketType={marketKey}
                                isBest={isBest1}
                              />
                            ) : (
                              <div className="p-3 rounded-lg border border-white/10 bg-white/5 opacity-50 flex items-center justify-center">
                                <span className="text-sm text-white/30">N/A</span>
                              </div>
                            )}

                            {/* Under Odds */}
                            {odds2 ? (
                              <OddsDisplay
                                odds={odds2}
                                marketType={marketKey}
                                isBest={isBest2}
                              />
                            ) : (
                              <div className="p-3 rounded-lg border border-white/10 bg-white/5 opacity-50 flex items-center justify-center">
                                <span className="text-sm text-white/30">N/A</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              ) : (
                /* Moneyline/Spread Markets - Separate sections per team */
                <>
                  {/* Team 1 Section */}
                  <div className="mb-4">
                    <div className="text-xs sm:text-sm font-semibold text-white/80 mb-2 px-2">
                      {outcome1.label}
                    </div>
                    <div className="space-y-2">
                      {bookmakers1.map((bookmakerName) => {
                        const odds = outcome1.bookmakers[bookmakerName]
                        if (!odds) return null

                        const isBest = isBestOdds(bookmakerName, outcome1.label, bestOddsMap)

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
                    {hiddenCount1 > 0 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleOutcomeExpansion(outcome1.label)
                        }}
                        className="mt-2 w-full p-3 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 transition-all text-[11px] sm:text-xs font-semibold text-emerald-300 flex items-center justify-center"
                      >
                        {isOutcomeExpanded(outcome1.label) ? 'Show less' : `+ ${hiddenCount1} more`}
                      </button>
                    )}
                  </div>

                  {/* Team 2 Section */}
                  {outcome2 && bookmakers2 && (
                    <div className="mb-4">
                      <div className="text-xs sm:text-sm font-semibold text-white/80 mb-2 px-2">
                        {outcome2.label}
                      </div>
                      <div className="space-y-2">
                        {bookmakers2.map((bookmakerName) => {
                          const odds = outcome2.bookmakers[bookmakerName]
                          if (!odds) return null

                          const isBest = isBestOdds(bookmakerName, outcome2.label, bestOddsMap)

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
                      {hiddenCount2 > 0 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleOutcomeExpansion(outcome2.label)
                          }}
                          className="mt-2 w-full p-3 rounded-lg border border-white/10 bg-white/5 hover:border-white/20 transition-all text-[11px] sm:text-xs font-semibold text-emerald-300 flex items-center justify-center"
                        >
                          {isOutcomeExpanded(outcome2.label) ? 'Show less' : `+ ${hiddenCount2} more`}
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Totals toggle */}
              {isTotals && totalsHiddenCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleOutcomeExpansion('__totals__')
                  }}
                  className="w-full mt-3 py-2 px-4 rounded-lg bg-emerald-600/10 border border-emerald-500/30 hover:bg-emerald-600/20 hover:border-emerald-500/50 transition-all text-xs sm:text-sm font-semibold text-emerald-300"
                >
                  {isOutcomeExpanded('__totals__')
                    ? 'Show less'
                    : `+ ${totalsHiddenCount} more bookmaker${totalsHiddenCount > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// Odds Display Component (without bookmaker name)
interface OddsDisplayProps {
  odds: BookmakerOdds
  marketType: string
  isBest: boolean
}

const OddsDisplay: React.FC<OddsDisplayProps> = ({ odds, marketType, isBest }) => {
  const displayText = formatOddsDisplay(odds, marketType)

  return (
    <div
      className={`
        p-3 rounded-lg border transition-all flex items-center justify-center
        ${
          isBest
            ? 'border-green-500 bg-green-500/10'
            : 'border-white/10 bg-white/5 hover:border-white/20'
        }
      `}
    >
      <div className={`text-sm sm:text-base font-bold ${isBest ? 'text-green-400' : 'text-white'}`}>
        {displayText}
      </div>
    </div>
  )
}

// Bookmaker Card Component (legacy - kept for backward compatibility)
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
      className="text-xs text-white/60 hover:text-emerald-400 hover:underline transition-colors truncate block"
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
  if (market.outcomes.length === 0) return []

  // For game odds, we want bookmakers that appear in ANY outcome
  // (we'll show N/A if a bookmaker doesn't have odds for one team)
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

// Extract only bookmakers that have odds for BOTH teams (for cleaner display)
function extractCommonBookmakers(market: ParsedMarket): string[] {
  if (market.outcomes.length < 2) return extractAllBookmakers(market)

  const outcome1Books = new Set(Object.keys(market.outcomes[0].bookmakers))
  const outcome2Books = new Set(Object.keys(market.outcomes[1].bookmakers))

  // Find intersection - bookmakers that exist in both outcomes
  const commonBookmakers: string[] = []
  for (const book of outcome1Books) {
    if (outcome2Books.has(book)) {
      commonBookmakers.push(book)
    }
  }

  // Prioritize common bookmakers
  const priority = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle']

  return commonBookmakers.sort((a, b) => {
    const aIndex = priority.indexOf(a)
    const bIndex = priority.indexOf(b)

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.localeCompare(b)
  })
}

// Get top N bookmakers with best odds for a specific outcome
function getTopBookmakersByOdds(
  outcome: ParsedMarket['outcomes'][0],
  marketType: string,
  limit?: number
): string[] {
  const bookmakers = Object.keys(outcome.bookmakers)

  if (typeof window !== 'undefined') {
    console.log(`[getTopBookmakersByOdds] marketType: ${marketType}, limit: ${limit}, total bookmakers: ${bookmakers.length}`)
  }

  if (bookmakers.length === 0) {
    console.warn('[getTopBookmakersByOdds] No bookmakers found for outcome:', outcome.label)
    return []
  }

  // Sort bookmakers by odds value (best first)
  const sorted = [...bookmakers].sort((a, b) => {
    const oddsA = outcome.bookmakers[a]
    const oddsB = outcome.bookmakers[b]

    if (marketType === 'moneyline') {
      // For moneyline, higher odds = better (more payout)
      return oddsB.price - oddsA.price
    } else if (marketType === 'spreads') {
      // For spreads, compare by point value first
      const pointA = oddsA.point ?? 0
      const pointB = oddsB.point ?? 0

      // More positive spread is better
      if (pointA !== pointB) {
        return pointB - pointA
      }

      // If points equal, compare by price (higher is better)
      return oddsB.price - oddsA.price
    } else if (marketType === 'totals') {
      // For totals, higher price = better (at same line)
      return oddsB.price - oddsA.price
    }

    return 0
  })

  // Apply limit if specified
  const limited = limit ? sorted.slice(0, limit) : sorted

  // Apply priority sorting for equal odds values
  const priority = ['FanDuel', 'DraftKings', 'BetMGM', 'Caesars', 'Bet365', 'Pinnacle']

  const result = limited.sort((a, b) => {
    const aIndex = priority.indexOf(a)
    const bIndex = priority.indexOf(b)

    if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
    if (aIndex !== -1) return -1
    if (bIndex !== -1) return 1
    return a.localeCompare(b)
  })

  if (typeof window !== 'undefined') {
    console.log(`[getTopBookmakersByOdds] Returning:`, result)
  }

  return result
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
