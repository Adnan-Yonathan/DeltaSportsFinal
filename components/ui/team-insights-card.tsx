'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { ParsedTeamInsights } from '@/lib/utils/stats-parser'

interface TeamInsightsCardProps extends Omit<ParsedTeamInsights, 'type' | 'originalText'> {}

export const TeamInsightsCard: React.FC<TeamInsightsCardProps> = ({
  sport,
  awayTeam,
  homeTeam,
  awayLogo,
  homeLogo,
  awayStats,
  homeStats,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const proxiedAwayLogo = awayLogo ? `/api/image-proxy?url=${encodeURIComponent(awayLogo)}` : undefined
  const proxiedHomeLogo = homeLogo ? `/api/image-proxy?url=${encodeURIComponent(homeLogo)}` : undefined
  const [isHovered, setIsHovered] = useState(false)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [showAllStats, setShowAllStats] = useState(false)

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

  const normalizeValue = (val: any) => {
    if (val == null) return 'N/A'
    if (typeof val === 'number') return val
    const num = parseFloat(String(val))
    return isNaN(num) ? String(val) : num
  }

  const formatLabel = (key: string) =>
    key
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())

  const formatSport = (sportKey: string) => {
    const map: Record<string, string> = {
      basketball_nba: 'NBA',
      basketball_ncaab: 'NCAAB',
      americanfootball_nfl: 'NFL',
      americanfootball_ncaaf: 'NCAAF',
      baseball_mlb: 'MLB',
      icehockey_nhl: 'NHL',
    }
    return map[sportKey] || sportKey.toUpperCase()
  }

  const getTeamAbbr = (teamName: string) => {
    // Fallback: take first letter of each word
    return teamName
      .split(' ')
      .map(word => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 3)
  }

  const getSportIcon = (sportKey: string) => {
    // Map sport keys to emoji icons
    if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
      return 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬'
    } else if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
      return 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒâ€¹Ã¢â‚¬Â '
    } else if (sportKey === 'icehockey_nhl') {
      return 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢'
    } else if (sportKey === 'baseball_mlb') {
      return 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã‚Â¡Ãƒâ€šÃ‚Â¾'
    }
    return 'ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸Ãƒâ€šÃ‚ÂÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ' // default for unknown sports
  }

  const priorityKeysBySport: Record<string, string[]> = {
    basketball_nba: ['streak', 'last10', 'ppg', 'papg', 'fgPct', 'threePct', 'reb', 'ast', 'blk', 'stl'],
    basketball_ncaab: ['streak', 'last10', 'ppg', 'papg', 'fgPct', 'threePct', 'reb', 'ast', 'blk', 'stl'],
    americanfootball_nfl: ['streak', 'last10', 'ppg', 'papg', 'offYds', 'defYds', 'passYds', 'rushYds', 'takeaways', 'sacks'],
    americanfootball_ncaaf: ['streak', 'last10', 'ppg', 'papg', 'offYds', 'defYds', 'passYds', 'rushYds', 'takeaways', 'sacks'],
    baseball_mlb: ['streak', 'last10', 'runs', 'runsAllowed', 'era', 'ops'],
    icehockey_nhl: ['streak', 'last10', 'gpg', 'gapg', 'shots', 'shotsAllowed', 'powerPlayPct', 'penaltyKillPct', 'faceoffWinPct', 'hits'],
  }

  const lowerIsBetterKeys = new Set(['papg', 'gapg', 'defyds', 'runsallowed', 'era', 'shotsallowed'])

  const buildRows = () => {
    const keys = new Set<string>([...Object.keys(awayStats), ...Object.keys(homeStats)])
    const ordered: string[] = []
    const priority = priorityKeysBySport[sport] || []
    priority.forEach((k) => {
      if (keys.has(k)) {
        ordered.push(k)
        keys.delete(k)
      }
    })
    ordered.push(...Array.from(keys))
    return ordered
      .filter((k) => awayStats[k as keyof typeof awayStats] != null || homeStats[k as keyof typeof homeStats] != null)
      .map((key) => {
        const awayValRaw = normalizeValue(awayStats[key as keyof typeof awayStats])
        const homeValRaw = normalizeValue(homeStats[key as keyof typeof homeStats])
        const awayVal = typeof awayValRaw === 'number' ? awayValRaw.toFixed(awayValRaw % 1 === 0 ? 0 : 1) : awayValRaw
        const homeVal = typeof homeValRaw === 'number' ? homeValRaw.toFixed(homeValRaw % 1 === 0 ? 0 : 1) : homeValRaw
        const aNum = typeof awayValRaw === 'number' ? awayValRaw : null
        const hNum = typeof homeValRaw === 'number' ? homeValRaw : null
        const lowerIsBetter = lowerIsBetterKeys.has(key.toLowerCase())
        return {
          key,
          label: formatLabel(key),
          awayVal: awayVal ?? 'N/A',
          homeVal: homeVal ?? 'N/A',
          awayBetter: aNum != null && hNum != null ? (lowerIsBetter ? aNum < hNum : aNum > hNum) : false,
          homeBetter: aNum != null && hNum != null ? (lowerIsBetter ? hNum < aNum : hNum > aNum) : false,
        }
      })
      .slice(0, 10)
  }

  const rows = buildRows()

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
              className="flex items-center gap-2 sm:gap-3"
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
          </div>
        </div>

        {/* Always Visible Stats: show first 3 rows */}
        <div className="space-y-3 mb-4">
          {rows.slice(0, 3).map((row) => (
            <StatRow
              key={row.key}
              label={row.label}
              awayValue={row.awayVal as string}
              homeValue={row.homeVal as string}
              comparison={{ awayBetter: row.awayBetter, homeBetter: row.homeBetter }}
            />
          ))}
        </div>

        {/* Expandable Stats Toggle */}
        <button
          onClick={() => setShowAllStats(!showAllStats)}
          className="w-full py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 transition-all flex items-center justify-center gap-2 text-sm text-white/70 hover:text-emerald-400"
        >
          {showAllStats ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show More Stats
            </>
          )}
        </button>

        {/* Additional Stats (Expandable) */}
        <AnimatePresence>
          {showAllStats && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 mt-4 pt-4 border-t border-white/10">
                {rows.slice(3).map((row) => (
                  <StatRow
                    key={row.key}
                    label={row.label}
                    awayValue={row.awayVal as string}
                    homeValue={row.homeVal as string}
                    comparison={{ awayBetter: row.awayBetter, homeBetter: row.homeBetter }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team Insights Indicator */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-xs text-emerald-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <span className="text-base">{getSportIcon(sport)}</span>
          <span>Team Insights</span>
        </motion.div>
      </div>
    </motion.div>
  )
}

// StatRow sub-component for displaying comparison rows
interface StatRowProps {
  label: string
  awayValue: string
  homeValue: string
  comparison: { awayBetter: boolean; homeBetter: boolean }
}

const StatRow: React.FC<StatRowProps> = ({ label, awayValue, homeValue, comparison }) => (
  <div className="flex items-center gap-3">
    <div className={`flex-1 text-right px-3 py-2 rounded-lg ${
      comparison.awayBetter ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-white/5 border border-white/10 text-white'
    } font-bold text-sm`}>
      {awayValue}
    </div>
    <div className="text-xs text-white/60 font-semibold uppercase min-w-[60px] text-center">
      {label}
    </div>
    <div className={`flex-1 text-left px-3 py-2 rounded-lg ${
      comparison.homeBetter ? 'bg-green-500/10 border border-green-500/30 text-green-400' : 'bg-white/5 border border-white/10 text-white'
    } font-bold text-sm`}>
      {homeValue}
    </div>
  </div>
)
