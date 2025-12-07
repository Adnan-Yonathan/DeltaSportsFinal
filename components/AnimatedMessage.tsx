'use client'

import { useAnimatedText } from '@/components/ui/animated-text'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useState, useEffect } from 'react'
import { parseStatsFromText, removeStatsFromText, ParsedStats } from '@/lib/utils/stats-parser'
import { PlayerStatsCard } from '@/components/ui/player-stats-card'
import { TeamStatsCard } from '@/components/ui/team-stats-card'
import { PlayerPropsCard } from '@/components/ui/player-props-card'
import { GameOddsCard } from '@/components/ui/game-odds-card'
import { TeamInsightsCard } from '@/components/ui/team-insights-card'

interface AnimatedMessageProps {
  content: string
  isAnimating?: boolean
}

export default function AnimatedMessage({ content, isAnimating = true }: AnimatedMessageProps) {
  const [parsedStats, setParsedStats] = useState<ParsedStats[]>([])
  const [cleanedContent, setCleanedContent] = useState(content)

  // Parse stats from the content (async) - debounced to wait for streaming to complete
  useEffect(() => {
    // For player props, wait until structured data is present (streaming complete)
    const hasPropsData = content.includes('STRUCTURED_PROPS_DATA:')
    const hasPropsTable = /\|\s*Market\s*\|.*\|\s*Best Over\s*\|/i.test(content)

    // If props table exists but no structured data yet, skip parsing (wait for complete stream)
    if (hasPropsTable && !hasPropsData) {
      console.log('[AnimatedMessage] Props detected but structured data not yet received, waiting...')
      return
    }

    // Debounce: wait for content to stop changing before parsing
    const timeoutId = setTimeout(async () => {
      console.log('[AnimatedMessage] Parsing content, length:', content.length)
      const stats = await parseStatsFromText(content)
      console.log('[AnimatedMessage] Parsed', stats.length, 'stat blocks')
      setParsedStats(stats)
      if (stats.length > 0) {
        setCleanedContent(removeStatsFromText(content, stats))
      } else {
        setCleanedContent(content)
      }
    }, 300) // Wait 300ms after content stops changing

    return () => clearTimeout(timeoutId)
  }, [content])

  // Use word-by-word animation for smoother reading experience
  const animatedContent = useAnimatedText(isAnimating ? cleanedContent : cleanedContent, ' ')

  return (
    <div className="space-y-4">
      {/* Render stats cards */}
      {parsedStats.map((stat, index) => (
        <div key={index} className="my-4">
          {stat.type === 'player' ? (
            <PlayerStatsCard
              name={stat.name}
              team={stat.team}
              position={stat.position}
              sport={stat.sport}
              season={stat.season}
              headshot={stat.headshot}
              stats={stat.stats}
            />
          ) : stat.type === 'props' ? (
            <PlayerPropsCard
              player={stat.player}
              team={stat.team}
              teamAbbr={stat.teamAbbr}
              position={stat.position}
              sport={stat.sport}
              game={stat.game}
              headshot={stat.headshot}
              markets={stat.markets}
            />
          ) : stat.type === 'game_odds' ? (
            <GameOddsCard
              awayTeam={stat.awayTeam}
              homeTeam={stat.homeTeam}
              awayLogo={stat.awayLogo}
              homeLogo={stat.homeLogo}
              sport={stat.sport}
              gameTime={stat.gameTime}
              markets={stat.markets}
            />
          ) : stat.type === 'team_insights' ? (
            <TeamInsightsCard
              sport={stat.sport}
              awayTeam={stat.awayTeam}
              homeTeam={stat.homeTeam}
              awayStats={stat.awayStats}
              homeStats={stat.homeStats}
            />
          ) : (
            <TeamStatsCard
              team={stat.team}
              sport={stat.sport}
              wins={stat.wins}
              losses={stat.losses}
              winPct={stat.winPct}
              stats={stat.stats}
            />
          )}
        </div>
      ))}

      {/* Render remaining text content */}
      {cleanedContent.trim() && (
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
    </div>
  )
}
