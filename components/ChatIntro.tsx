'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { PromptBox } from '@/components/ui/chatgpt-prompt-input'
import { LatestNewsStrip } from '@/components/ui/latest-news-strip'
import { TopPerformancesStrip } from '@/components/ui/top-performances'
import { AnimatedHero } from '@/components/ui/animated-hero'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
}

export default function ChatIntro({ conversationId, userId, onMessageSent }: ChatIntroProps) {
  const [sending, setSending] = useState(false)
  const [selectedCapability, setSelectedCapability] = useState<string | null>(null)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const textarea = event.currentTarget.querySelector('textarea')
    const message = textarea?.value?.trim()

    if (!message || sending) return

    setSending(true)

    try {
      // All queries go to the unified /api/chat endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          conversationId,
          userId,
          capability: selectedCapability,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      // Clear the textarea
      if (textarea) {
        textarea.value = ''
      }

      // Read the response stream first
      const reader = response.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Wait a bit for the database to update, then trigger the callback
      await new Promise(resolve => setTimeout(resolve, 300))

      // Trigger the callback to indicate message was sent
      onMessageSent()
    } catch (error) {
      console.error('Error sending message:', error)
      alert('Failed to send message. Please try again.')
    } finally {
      setSending(false)
      setSelectedCapability(null)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-full bg-black px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full mb-6"
      >
        <AnimatedHero
          staticText="Make money with"
          interval={2500}
        />
      </motion.div>

      <div className="w-full max-w-5xl mx-auto mb-6">
        <TopPerformancesStrip />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl w-full"
      >
        <form onSubmit={handleSubmit} className="w-full relative">
          <PromptBox name="message" disabled={sending} />
        </form>

        {/* Capabilities */}
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1 auto-rows-fr">
          {[
            {
              id: "player_profiles",
              title: "Player Profiles",
              description: "Access player stats, advanced metrics, and projections vs specific teams",
              detail: `PLAYER PROFILES - Get detailed player stats, advanced metrics, and matchup context.

What it does: Returns season averages, advanced stats (TS%, usage, etc.), recent form (last 5-10 games), and performance vs specific opponents.

Example queries:
• "LeBron James stats"
• "Jayson Tatum profile vs Celtics"
• "Wemby season averages and recent form"
• "Anthony Edwards advanced stats"`
            },
            {
              id: "team_profiles",
              title: "Team Profiles",
              description: "Get comprehensive team stats, trends, and performance metrics",
              detail: `TEAM PROFILES - Get comprehensive team stats, ratings, and betting trends.

What it does: Returns basic stats (PPG, rebounds, assists), advanced metrics (pace, offensive/defensive ratings, net rating), recent form, and ATS/O-U trends.

Example queries:
• "Lakers team stats"
• "Thunder offensive rating and pace"
• "Celtics defensive stats"
• "Heat team profile with ATS record"`
            },
            {
              id: "line_shopping",
              title: "Line Shopping",
              description: "Compare lines from every major US sportsbook for any sporting event",
              detail: `LINE SHOPPING - Compare odds across all major US sportsbooks.

What it does: Fetches spread, moneyline, total, and player prop lines from DraftKings, FanDuel, BetMGM, Caesars, and more. Shows best available price and book-by-book comparison.

Example queries:
• "Lakers vs Celtics odds"
• "Best line for Heat spread"
• "Shop Curry points prop"
• "Compare Thunder moneyline across books"`
            },
            {
              id: "cross_market_ev",
              title: "Cross Market EV",
              description: "Find +EV plays where sportsbooks disagree on odds",
              detail: `CROSS MARKET EV - Find positive expected value opportunities.

What it does: Scans betting markets to find plays where one sportsbook offers significantly better odds than the market consensus. Calculates EV% based on implied probability differences.

Example queries:
• "Cross market EV opportunities"
• "Show me +EV plays"
• "Where do sportsbooks disagree on odds"
• "Find value bets tonight"`
            },
            {
              id: "live_betting",
              title: "Live Betting",
              description: "AI-projected live spreads based on game flow, momentum, and in-game factors",
              detail: `LIVE BETTING - Get AI-projected lines for games in progress.

What it does: Calculates fair live spreads and totals using current score, time remaining, pace, and momentum factors. Compares projections to live odds to find edges.

Example queries:
• "Live projections"
• "In-game betting lines"
• "Live betting Lakers game"
• "Current fair spread for the Celtics game"`
            },
            {
              id: "betting_trends",
              title: "Betting Trends",
              description: "Recent records vs spreads, prop covers, and public/sharp money splits",
              detail: `BETTING TRENDS - Track ATS records, O/U trends, and money splits.

What it does: Shows team records against the spread, over/under trends (last 5/10 games, home/away, favorite/underdog), and public vs sharp betting percentages when available.

Example queries:
• "Lakers ATS record"
• "Public vs sharp money on Heat vs Celtics"
• "Betting splits for Thunder game"
• "Which teams cover as underdogs"`
            },
            {
              id: "pick_guidance",
              title: "Pick Guidance",
              description: "Walk through the best bets, tools, and edge signals for a matchup",
              detail: `PICK GUIDANCE - Get help deciding on a bet with data-driven analysis.

What it does: Walks through the key factors for a matchup - model projections vs market lines, relevant stats, injury impacts, and what would change the recommendation.

Example queries:
• "Best bet for Lakers vs Celtics"
• "Should I bet the over tonight"
• "Who wins Heat vs Thunder"
• "What's the play on the Knicks game"`
            },
            {
              id: "market_analysis",
              title: "Market Analysis",
              description: "Break down matchups with splits, injuries, stats, and edge alerts",
              detail: `MARKET ANALYSIS - Full matchup breakdown with all relevant data.

What it does: Comprehensive analysis including current odds, injury report, team stats comparison, recent form, betting splits, pace/style matchup factors, and model vs market edge summary.

Example queries:
• "Analyze Lakers vs Celtics"
• "Full breakdown of the Heat game"
• "Matchup analysis Thunder vs Spurs"
• "Break down tonight's Knicks game"`
            },
            {
              id: "edge_awareness",
              title: "Edge Awareness",
              description: "Flag when a line or prop does not line up with the data",
              detail: `EDGE AWARENESS - Check if a line or prop looks mispriced.

What it does: Compares betting lines to season averages, recent form, and matchup context. For player props, checks season avg vs last 5 games vs opponent allowed stats. For spreads/totals, compares net ratings to the line.

Example queries:
• "Edge awareness for Wemby rebounds vs Thunder"
• "Is there edge on the Lakers spread"
• "Check value on Curry points prop"
• "Edge awareness Celtics vs Heat total"`
            }
          ].map((capability) => (
            <button
              key={capability.title}
              type="button"
              onClick={() => {
                const textarea = document.querySelector('textarea') as HTMLTextAreaElement | null
                if (textarea) {
                  // Use native setter to update the value and trigger React's onChange
                  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    'value'
                  )?.set
                  if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(textarea, capability.detail)
                  }
                  // Dispatch input event so React picks up the change
                  const inputEvent = new Event('input', { bubbles: true })
                  textarea.dispatchEvent(inputEvent)
                  textarea.focus()
                }
                setSelectedCapability(capability.id)
              }}
            className="group text-left p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/30 transition-all h-full min-h-[78px]"
            >
              <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-emerald-400 transition-colors">
                {capability.title}
              </h3>
              <p className="text-[11px] text-white/60 leading-relaxed">
                {capability.description}
              </p>
            </button>
          ))}
        </div>

      </motion.div>

      <div className="mt-8 w-full">
        <LatestNewsStrip />
      </div>
    </div>
  )
}
