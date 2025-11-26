'use client'

import React, { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { ParsedTeamInsights } from '@/lib/utils/stats-parser'

interface TeamInsightsCardProps extends Omit<ParsedTeamInsights, 'type' | 'originalText'> {}

export const TeamInsightsCard: React.FC<TeamInsightsCardProps> = ({
  sport,
  awayTeam,
  homeTeam,
  awayStats,
  homeStats,
}) => {
  const cardRef = useRef<HTMLDivElement>(null)
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

  // Helper: Parse Last 10 record "7-3" -> { wins: 7, losses: 3 }
  const parseLast10 = (record: string) => {
    const match = record.match(/(\d+)-(\d+)/)
    return match ? { wins: parseInt(match[1]), losses: parseInt(match[2]) } : null
  }

  // Helper: Safe parse float (handles "n/a")
  const safeParseFloat = (value: string): number | null => {
    if (value === 'n/a' || value === 'N/A') return null
    const num = parseFloat(value)
    return isNaN(num) ? null : num
  }

  // Comparison logic for highlighting
  const compareStats = (awayStat: string, homeStat: string, lowerIsBetter = false) => {
    const awayNum = safeParseFloat(awayStat)
    const homeNum = safeParseFloat(homeStat)
    if (awayNum === null || homeNum === null) return { awayBetter: false, homeBetter: false }

    if (lowerIsBetter) {
      return { awayBetter: awayNum < homeNum, homeBetter: homeNum < awayNum }
    } else {
      return { awayBetter: awayNum > homeNum, homeBetter: homeNum > awayNum }
    }
  }

  const compareLast10 = () => {
    const away = parseLast10(awayStats.last10)
    const home = parseLast10(homeStats.last10)
    if (!away || !home) return { awayBetter: false, homeBetter: false }
    return { awayBetter: away.wins > home.wins, homeBetter: home.wins > away.wins }
  }

  // Format sport label
  const formatSport = (sportKey: string) => {
    const map: Record<string, string> = {
      basketball_nba: 'NBA',
      basketball_ncaab: 'NCAAB',
    }
    return map[sportKey] || sportKey.toUpperCase()
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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex-1 text-center">
            <h3 className="text-base sm:text-lg font-bold text-white">{awayTeam}</h3>
          </div>
          <div className="px-4 text-white/40 font-bold">VS</div>
          <div className="flex-1 text-center">
            <h3 className="text-base sm:text-lg font-bold text-white">{homeTeam}</h3>
          </div>
          <div className="ml-4 px-3 py-1 rounded-full bg-purple-600/20 border border-purple-500/30 text-purple-300 text-xs font-semibold">
            {formatSport(sport)}
          </div>
        </div>

        {/* Always Visible Stats: Last 10, PPG, PAPG */}
        <div className="space-y-3 mb-4">
          {/* Last 10 */}
          <StatRow
            label="Last 10"
            awayValue={awayStats.last10}
            homeValue={homeStats.last10}
            comparison={compareLast10()}
          />
          {/* PPG */}
          <StatRow
            label="PPG"
            awayValue={awayStats.ppg}
            homeValue={homeStats.ppg}
            comparison={compareStats(awayStats.ppg, homeStats.ppg)}
          />
          {/* PAPG */}
          <StatRow
            label="PAPG"
            awayValue={awayStats.papg}
            homeValue={homeStats.papg}
            comparison={compareStats(awayStats.papg, homeStats.papg, true)}
          />
        </div>

        {/* Expandable Stats Toggle */}
        <button
          onClick={() => setShowAllStats(!showAllStats)}
          className="w-full py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 transition-all flex items-center justify-center gap-2 text-sm text-white/70 hover:text-purple-400"
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
                <StatRow label="Streak" awayValue={awayStats.streak} homeValue={homeStats.streak} comparison={{ awayBetter: false, homeBetter: false }} />
                <StatRow label="FG%" awayValue={awayStats.fgPct} homeValue={homeStats.fgPct} comparison={compareStats(awayStats.fgPct, homeStats.fgPct)} />
                <StatRow label="3P%" awayValue={awayStats.threePct} homeValue={homeStats.threePct} comparison={compareStats(awayStats.threePct, homeStats.threePct)} />
                <StatRow label="REB" awayValue={awayStats.reb} homeValue={homeStats.reb} comparison={compareStats(awayStats.reb, homeStats.reb)} />
                <StatRow label="AST" awayValue={awayStats.ast} homeValue={homeStats.ast} comparison={compareStats(awayStats.ast, homeStats.ast)} />
                <StatRow label="BLK" awayValue={awayStats.blk} homeValue={homeStats.blk} comparison={compareStats(awayStats.blk, homeStats.blk)} />
                <StatRow label="STL" awayValue={awayStats.stl} homeValue={homeStats.stl} comparison={compareStats(awayStats.stl, homeStats.stl)} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Team Insights Indicator */}
        <motion.div
          className="mt-6 flex items-center gap-2 text-xs text-purple-400"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <TrendingUp className="w-4 h-4" />
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
