'use client'

import { useAnimatedText } from '@/components/ui/animated-text'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { parseStatsFromText, removeStatsFromText, ParsedStats } from '@/lib/utils/stats-parser'
import { PlayerStatsCard } from '@/components/ui/player-stats-card'
import { TeamStatsCard } from '@/components/ui/team-stats-card'
import { PlayerPropsCard } from '@/components/ui/player-props-card'
import { GameOddsCard } from '@/components/ui/game-odds-card'
import { TeamInsightsCard } from '@/components/ui/team-insights-card'
import { ArrowUpRight, TrendingUp, Users, Calculator, Zap, Radio } from 'lucide-react'

interface AnimatedMessageProps {
  content: string
  isAnimating?: boolean
}

interface PageCardData {
  key: string
  label: string
  description: string
  href: string
  icon: React.ReactNode
  recommended?: boolean
}

const PAGE_METADATA: Record<string, Omit<PageCardData, 'key' | 'recommended'>> = {
  'live-scores': {
    label: 'Live Scores',
    description: 'Live game scores, odds comparison, and arbitrage opportunities',
    href: '/live-scores',
    icon: <Radio className="w-4 h-4" />,
  },
  'ev-bets': {
    label: 'EV Bets',
    description: 'Find +EV opportunities where sportsbooks disagree on odds',
    href: '/ev-bets',
    icon: <Zap className="w-4 h-4" />,
  },
  'parlay-predictor': {
    label: 'Parlay Pro',
    description: 'Calculate true parlay odds with correlation adjustments',
    href: '/parlay-predictor',
    icon: <Calculator className="w-4 h-4" />,
  },
  'player-projections': {
    label: 'Sharp Props',
    description: 'Player prop projections based on recent form and matchup context',
    href: '/player-projections',
    icon: <Users className="w-4 h-4" />,
  },
  'market-projections': {
    label: 'Sharp Projections',
    description: 'AI-powered spread, total, and moneyline projections with edge detection',
    href: '/market-projections',
    icon: <TrendingUp className="w-4 h-4" />,
  },
  'stats': {
    label: 'Stats Center',
    description: 'Team and player statistics across all major sports',
    href: '/stats',
    icon: <TrendingUp className="w-4 h-4" />,
  },
}

function parsePageCards(text: string): { cards: PageCardData[]; cleanedText: string } {
  const cards: PageCardData[] = []
  const cardRegex = /\[PAGE_CARD:([a-z-]+)(?::recommended)?\]/gi
  let cleanedText = text

  let match
  while ((match = cardRegex.exec(text)) !== null) {
    const pageKey = match[1]
    const isRecommended = match[0].includes(':recommended')
    const metadata = PAGE_METADATA[pageKey]

    if (metadata) {
      cards.push({
        key: pageKey,
        ...metadata,
        recommended: isRecommended,
      })
    }

    cleanedText = cleanedText.replace(match[0], '')
  }

  // Clean up extra whitespace from removed markers
  cleanedText = cleanedText.replace(/\n{3,}/g, '\n\n').trim()

  return { cards, cleanedText }
}

function PageCard({ card }: { card: PageCardData }) {
  return (
    <Link
      href={card.href}
      className={`group flex items-center gap-3 rounded-xl border px-4 py-3 transition-all hover:bg-white/10 ${
        card.recommended
          ? 'border-emerald-400/40 bg-emerald-500/10 hover:border-emerald-400/60'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      }`}
    >
      <div
        className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
          card.recommended
            ? 'bg-emerald-500/30 text-emerald-300 group-hover:bg-emerald-500/40'
            : 'bg-white/10 text-white/70 group-hover:bg-white/15'
        }`}
      >
        {card.icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-semibold ${
              card.recommended ? 'text-emerald-200' : 'text-white'
            }`}
          >
            {card.label}
          </span>
          {card.recommended && (
            <span className="px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-emerald-500/30 text-emerald-300 rounded">
              Recommended
            </span>
          )}
        </div>
        <p className="text-xs text-white/50 truncate">{card.description}</p>
      </div>
      <ArrowUpRight
        className={`w-4 h-4 transition-colors ${
          card.recommended
            ? 'text-emerald-400/60 group-hover:text-emerald-300'
            : 'text-white/30 group-hover:text-white/50'
        }`}
      />
    </Link>
  )
}

export default function AnimatedMessage({ content, isAnimating = true }: AnimatedMessageProps) {
  // Parse page cards from content
  const { cards, cleanedText } = useMemo(() => parsePageCards(content), [content])

  // Use word-by-word animation for smoother reading experience
  const animatedContent = useAnimatedText(isAnimating ? cleanedText : cleanedText, ' ')

  return (
    <div className="space-y-4">
      {/* Render text content */}
      {cleanedText.trim() && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              table: ({ node, ...props }) => (
                <div className="overflow-x-auto my-4 rounded-lg border border-white/10">
                  <table className="w-full" {...props} />
                </div>
              ),
              thead: ({ node, ...props }) => <thead className="bg-white/5" {...props} />,
              th: ({ node, ...props }) => (
                <th
                  className="text-left px-4 py-3 text-emerald-300 font-semibold text-xs uppercase tracking-wider"
                  {...props}
                />
              ),
              td: ({ node, ...props }) => (
                <td className="px-4 py-3 border-t border-white/5 text-sm" {...props} />
              ),
              code: ({ node, inline, ...props }: any) =>
                inline ? (
                  <code
                    className="bg-white/10 px-1.5 py-0.5 rounded text-emerald-300 text-xs font-mono"
                    {...props}
                  />
                ) : (
                  <code
                    className="block bg-white/5 p-4 rounded-lg my-2 text-xs font-mono border border-white/10"
                    {...props}
                  />
                ),
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0 leading-relaxed" {...props} />,
              ul: ({ node, ...props }) => <ul className="space-y-1 my-2" {...props} />,
              ol: ({ node, ...props }) => <ol className="space-y-1 my-2" {...props} />,
              li: ({ node, ...props }) => <li className="ml-4" {...props} />,
              h1: ({ node, ...props }) => (
                <h1 className="text-xl font-bold mt-4 mb-2 text-white" {...props} />
              ),
              h2: ({ node, ...props }) => (
                <h2 className="text-lg font-bold mt-3 mb-2 text-white" {...props} />
              ),
              h3: ({ node, ...props }) => (
                <h3 className="text-base font-semibold mt-2 mb-1 text-white" {...props} />
              ),
              a: ({ node, ...props }) => (
                <a
                  className="text-emerald-300 underline hover:text-emerald-200"
                  target="_blank"
                  rel="noopener noreferrer"
                  {...props}
                />
              ),
            }}
          >
            {animatedContent}
          </ReactMarkdown>
        </div>
      )}

      {/* Render page navigation cards */}
      {cards.length > 0 && (
        <div className="space-y-2 mt-3">
          {cards.map((card) => (
            <PageCard key={card.key} card={card} />
          ))}
        </div>
      )}
    </div>
  )
}
