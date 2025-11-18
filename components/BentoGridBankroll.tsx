'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils/odds'
import { calculateKellyStake } from '@/lib/utils/kelly'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Wallet, Trophy, Target, Activity, Check, X, Sparkles, Loader2, Edit2, Save } from 'lucide-react'
import { LiveScore, matchBetToGame } from '@/lib/espn-api'
import { calculateBetProbability } from '@/lib/services/probability-engine'
import { deriveGameClockState, resolveSportKey } from '@/lib/utils/live-game'

interface BankrollTrackerProps {
  userId: string
}

interface BankrollStats {
  currentBalance: number
  startingBalance: number
  totalProfit: number
  roi: number
  wonBets: number
  lostBets: number
  pendingBets: number
  totalBets?: number
  dailyBalances: { date: string; balance: number }[]
  // Unit-based metrics
  currentUnits: number
  startingUnits: number
  unitsWon: number
  unitsLost: number
  unitSize: number
  dailyUnits: { date: string; units: number }[]
  clv?: {
    totalConsidered: number
    beat: number
    tie: number
    noBeat: number
    market: {
      moneyline: { total: number; beat: number; avgProbDelta: number }
      spread: { total: number; beat: number; avgPts: number }
      total: { total: number; beat: number; avgPts: number }
    }
  } | null
}

interface Bet {
  id: string
  sport: string
  game_description: string
  bet_side: string
  bet_type: string
  odds: number
  stake: number
  potential_win: number
  actual_result: number | null
  status: string
  placed_at: string
  book: string
}

type ChartRange = '7d' | '30d' | '365d' | 'all'

interface ChartDataPoint {
  date: string
  balance: number
  parsedDate?: Date
}

const TEAM_STOP_WORDS = new Set(['the', 'vs', 'at', 'los', 'las', 'club', 'team', 'fc', 'sc'])

const formatBalanceTooltip = (value: number) => `$${value.toFixed(2)}`

const normalizeText = (value: string) => value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')

const tokenizeTeam = (team: string): string[] =>
  normalizeText(team)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !TEAM_STOP_WORDS.has(token))

const scoreTeamMatch = (team: string, context: string): number => {
  const tokens = tokenizeTeam(team)
  return tokens.reduce((score, token) => (context.includes(token) ? score + 1 : score), 0)
}

const determineBetTeamSide = (bet: Bet, game: LiveScore): 'home' | 'away' | undefined => {
  const context = normalizeText(`${bet.bet_side} ${bet.game_description}`)
  const homeScore = scoreTeamMatch(game.homeTeam, context)
  const awayScore = scoreTeamMatch(game.awayTeam, context)

  if (homeScore > awayScore && homeScore > 0) return 'home'
  if (awayScore > homeScore && awayScore > 0) return 'away'

  // Fallback: look at first keyword in bet_side
  const firstToken = normalizeText(bet.bet_side).split(/\s+/).find((token) => token.length > 2)
  if (firstToken) {
    if (tokenizeTeam(game.homeTeam).includes(firstToken)) return 'home'
    if (tokenizeTeam(game.awayTeam).includes(firstToken)) return 'away'
  }

  return undefined
}

export default function BentoGridBankroll({ userId }: BankrollTrackerProps) {
  const [stats, setStats] = useState<BankrollStats | null>(null)
  const [activeBets, setActiveBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [liveScores, setLiveScores] = useState<LiveScore[]>([])
  const [showInsights, setShowInsights] = useState(false)
  const [insightsLoading, setInsightsLoading] = useState(false)
  const [insights, setInsights] = useState<string>('')
  const [totalBetCount, setTotalBetCount] = useState(0)
  const [chartRange, setChartRange] = useState<ChartRange>('7d')
  const [isChartExpanded, setChartExpanded] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editBankroll, setEditBankroll] = useState<string>('')
  const [editUnitSize, setEditUnitSize] = useState<string>('')
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsError, setSettingsError] = useState<string>('')
  const [kellyOdds, setKellyOdds] = useState<string>('')
  const [kellyProb, setKellyProb] = useState<string>('55')
  const [kellyFraction, setKellyFraction] = useState<string>('0.25')
  const [kellyCap, setKellyCap] = useState<string>('0.05')
  const supabase = createClient()

  useEffect(() => {
    loadData()
    loadLiveScores()

    // Poll for live scores every 30 seconds
    const scoresInterval = setInterval(() => {
      loadLiveScores()
    }, 30000)

    const channel = supabase
      .channel(`bets:${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bets',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadData()
        }
      )
      .subscribe()

    return () => {
      clearInterval(scoresInterval)
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Reload stats when chart range changes
  useEffect(() => {
    loadData(chartRange)
  }, [chartRange])

  const loadData = async (period: ChartRange = chartRange) => {
    const statsRes = await fetch(`/api/bankroll/stats?period=${period}`)
    if (statsRes.ok) {
      const data = await statsRes.json()
      setStats(data)
    }

    const { data: active } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('placed_at', { ascending: false })
      .limit(5)

    if (active) {
      setActiveBets(active)
    }

    // Fetch total tracked bets (all time) for guardrails
    const { count: totalCount, error: totalCountError } = await supabase
      .from('bets')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)

    if (!totalCountError && typeof totalCount === 'number') {
      setTotalBetCount(totalCount)
    }

    setLoading(false)
  }

  const loadLiveScores = async () => {
    try {
      const response = await fetch('/api/live-scores')
      if (response.ok) {
        const data = await response.json()
        setLiveScores(data.scores || [])
      }
    } catch (error) {
      console.error('Error loading live scores:', error)
    }
  }

  const betProbabilities = useMemo(() => {
    const probabilities: Record<string, number> = {}

    if (activeBets.length === 0 || liveScores.length === 0) {
      return probabilities
    }

    activeBets.forEach(bet => {
      const liveGame = matchBetToGame(bet.game_description, liveScores, bet.sport)

      if (liveGame && liveGame.status === 'in') {
        try {
          const sportKey = resolveSportKey(bet.sport, liveGame.sport)
          if (!sportKey) {
            return
          }

          const clockState = deriveGameClockState(liveGame, sportKey)
          if (!clockState) {
            return
          }

          const teamSide = determineBetTeamSide(bet, liveGame)

          // Parse bet type from bet_side
          let betType: 'spread' | 'total' | 'moneyline' = 'moneyline'
          const betTypeFromDb = bet.bet_type?.toLowerCase()
          if (betTypeFromDb === 'spread' || betTypeFromDb === 'total' || betTypeFromDb === 'moneyline') {
            betType = betTypeFromDb
          }
          let spread: number | undefined
          let totalLine: number | undefined
          let direction: 'over' | 'under' | undefined

          const betSideLower = bet.bet_side.toLowerCase()

          if (betSideLower.includes('over')) {
            betType = 'total'
            direction = 'over'
            const match = bet.bet_side.match(/over\s+([\d.]+)/i)
            if (match) totalLine = parseFloat(match[1])
          } else if (betSideLower.includes('under')) {
            betType = 'total'
            direction = 'under'
            const match = bet.bet_side.match(/under\s+([\d.]+)/i)
            if (match) totalLine = parseFloat(match[1])
          } else if (!betTypeFromDb) {
            if (betSideLower.includes('+') || betSideLower.includes('-')) {
              betType = 'spread'
              const match = bet.bet_side.match(/([+-][\d.]+)/)
              if (match) spread = parseFloat(match[1])
            } else if (betSideLower.includes('moneyline') || betSideLower.includes('ml')) {
              betType = 'moneyline'
            }
          }

          if (betType === 'spread' && spread === undefined) {
            const match = bet.bet_side.match(/([+-][\d.]+)/)
            if (match) spread = parseFloat(match[1])
          }

          const timeRemaining = clockState.remainingSeconds
          const timeElapsed = clockState.elapsedSeconds
          if (timeRemaining <= 0 && timeElapsed <= 0) {
            return
          }

          const result = calculateBetProbability({
            betType,
            sport: sportKey,
            currentScore: {
              away: liveGame.awayScore,
              home: liveGame.homeScore
            },
            timeRemaining,
            timeElapsed,
            spread,
            totalLine,
            direction,
            odds: bet.odds,
            teamSide
          })

          probabilities[bet.id] = result.probability
        } catch (error) {
          console.error('Error calculating probability for bet:', bet.id, error)
        }
      }
    })

    return probabilities
  }, [activeBets, liveScores])

  const settleBet = async (betId: string, status: 'won' | 'lost' | 'push') => {
    const bet = activeBets.find((b) => b.id === betId)
    if (!bet) return

    let actualResult = 0
    if (status === 'won') {
      actualResult = bet.stake + bet.potential_win
    } else if (status === 'push') {
      actualResult = bet.stake
    }

    const response = await fetch(`/api/bets/${betId}/settle`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, actualResult }),
    })

    if (response.ok) {
      loadData()
    }
  }

  const getAIInsights = async () => {
    const hasEnoughHistory = totalBetCount >= 10
    if (!hasEnoughHistory) {
      setShowInsights(true)
      setInsights('Track at least 10 bets to unlock AI insights. Log more wagers and try again.')
      setInsightsLoading(false)
      return
    }

    setInsightsLoading(true)
    setShowInsights(true)
    setInsights('')

    try {
      // Create a temporary conversation for insights
      const { data: conversation } = await supabase
        .from('conversations')
        .insert({ user_id: userId, title: 'Bankroll Analysis' })
        .select()
        .single()

      if (!conversation) {
        setInsights('Error creating conversation')
        setInsightsLoading(false)
        return
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Please analyze my bankroll performance for all time. Give me detailed insights on: my overall profitability, win rate analysis, bet sizing recommendations, performance by sport, and specific areas where I can improve. Be thorough and actionable.',
          conversationId: conversation.id,
          userId: userId,
        }),
      })

      if (!response.ok || !response.body) {
        setInsights('Error fetching insights')
        setInsightsLoading(false)
        return
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulatedText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') {
              setInsightsLoading(false)
              // Delete the temporary conversation
              await supabase.from('conversations').delete().eq('id', conversation.id)
              break
            }

            try {
              const parsed = JSON.parse(data)
              if (parsed.content) {
                accumulatedText += parsed.content
                setInsights(accumulatedText)
              }
            } catch (e) {
              // Ignore parse errors for incomplete JSON
            }
          }
        }
      }

      setInsightsLoading(false)
    } catch (error) {
      console.error('Error getting AI insights:', error)
      setInsights('Sorry, there was an error generating insights. Please try again.')
      setInsightsLoading(false)
    }
  }

  const handleEditStart = () => {
    setIsEditing(true)
    setEditBankroll(stats?.currentBalance.toString() || '')
    setEditUnitSize(stats?.unitSize.toString() || '')
    setSettingsError('')
  }

  const handleEditCancel = () => {
    setIsEditing(false)
    setEditBankroll('')
    setEditUnitSize('')
    setSettingsError('')
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    setSettingsError('')

    try {
      const bankrollNum = parseFloat(editBankroll)
      const unitNum = parseFloat(editUnitSize)

      // Validate inputs
      if (isNaN(bankrollNum) || bankrollNum <= 0) {
        setSettingsError('Bankroll must be a positive number')
        setSavingSettings(false)
        return
      }

      if (isNaN(unitNum) || unitNum <= 0) {
        setSettingsError('Unit size must be a positive number')
        setSavingSettings(false)
        return
      }

      if (unitNum > bankrollNum) {
        setSettingsError('Unit size cannot be larger than bankroll')
        setSavingSettings(false)
        return
      }

      // Save to database
      const { error } = await supabase
        .from('users')
        .update({
          current_bankroll: bankrollNum,
          unit_size: unitNum,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (error) {
        console.error('Error updating settings:', error)
        setSettingsError('Failed to save settings')
        setSavingSettings(false)
        return
      }

      // Reload data
      await loadData()
      setIsEditing(false)
      setEditBankroll('')
      setEditUnitSize('')
    } catch (error) {
      console.error('Error saving settings:', error)
      setSettingsError('An error occurred')
    } finally {
      setSavingSettings(false)
    }
  }

  const chartRangeOptions: { value: ChartRange; label: string }[] = [
    { value: '7d', label: '7 Days' },
    { value: '30d', label: '30 Days' },
    { value: '365d', label: '1 Year' },
    { value: 'all', label: 'All Time' },
  ]

  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!stats || !stats.dailyBalances?.length) return []
    const sorted = [...stats.dailyBalances]
      .map((entry) => ({ ...entry, parsedDate: new Date(entry.date) }))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime())
    if (chartRange === 'all') {
      return sorted
    }
    const days = chartRange === '7d' ? 7 : chartRange === '30d' ? 30 : 365
    const threshold = new Date()
    threshold.setDate(threshold.getDate() - days)
    return sorted.filter((entry) => entry.parsedDate >= threshold)
  }, [chartRange, stats])

  const formattedChartData = chartData.map((entry) => ({
    date: entry.parsedDate!.toISOString(),
    balance: entry.balance,
  }))

  const hasChartData = formattedChartData.length > 0

  if (loading || !stats) {
    return (
      <div className="h-full bg-black/40 backdrop-blur-xl border-l border-white/5 p-6 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent"
        />
      </div>
    )
  }

  const profitChange = stats.currentBalance - stats.startingBalance
  const profitPercent =
    stats.startingBalance > 0
      ? (profitChange / stats.startingBalance) * 100
      : 0
  const hasEnoughHistory = totalBetCount >= 10
  const winRate = stats.wonBets + stats.lostBets > 0
    ? (stats.wonBets / (stats.wonBets + stats.lostBets)) * 100
    : 0

  const kellyResult = useMemo(() => {
    const oddsNum = parseFloat(kellyOdds)
    const probNum = parseFloat(kellyProb)
    if (!Number.isFinite(oddsNum) || !Number.isFinite(probNum) || probNum <= 0 || probNum >= 100) {
      return null
    }
    const fractionNum = Math.max(0, parseFloat(kellyFraction) || 0)
    const capNum = Math.max(0, parseFloat(kellyCap) || 0)
    return calculateKellyStake({
      americanOdds: oddsNum,
      winProbability: probNum / 100,
      bankroll: stats.currentBalance,
      unitSize: stats.unitSize,
      fraction: Number.isFinite(fractionNum) ? fractionNum : undefined,
      maxStakePct: Number.isFinite(capNum) ? capNum : undefined,
    })
  }, [kellyCap, kellyFraction, kellyOdds, kellyProb, stats.currentBalance, stats.unitSize])

  const ChartVisualization = ({ height }: { height: number }) => (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={formattedChartData}>
        <defs>
          <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="balance"
          stroke="#8b5cf6"
          strokeWidth={2}
          fill="url(#colorBalance)"
        />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.2)"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          tickFormatter={(value) => format(new Date(value), 'MMM d')}
        />
        <YAxis
          stroke="rgba(255,255,255,0.2)"
          tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 10 }}
          tickFormatter={(value) => formatCurrency(value)}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'rgba(0,0,0,0.8)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            fontSize: '12px'
          }}
          labelStyle={{ color: 'rgba(255,255,255,0.6)' }}
          itemStyle={{ color: '#8b5cf6' }}
          formatter={(value: any) => [formatCurrency(value), 'Balance']}
        />
      </AreaChart>
    </ResponsiveContainer>
  )

  return (
    <>
      <div className="h-full bg-black/40 backdrop-blur-xl border-l border-white/5 overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="mb-4">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Wallet className="w-5 h-5 text-indigo-400" />
              Bankroll
            </h2>
            <p className="text-xs text-white/40 mt-1">Track your performance</p>
          </div>

          {/* Editable Settings Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            {!isEditing ? (
              <div className="flex items-center justify-between">
                <div className="flex gap-6">
                  <div>
                    <div className="text-xs text-white/60 uppercase tracking-wider">Current Bankroll</div>
                    <div className="text-lg font-bold text-white mt-1">{formatCurrency(stats.currentBalance)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-white/60 uppercase tracking-wider">Unit Size</div>
                    <div className="text-lg font-bold text-white mt-1">{formatCurrency(stats.unitSize)}</div>
                  </div>
                </div>
                <button
                  onClick={handleEditStart}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white text-sm"
                >
                  <Edit2 className="w-4 h-4" />
                  Edit
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-white/60 uppercase tracking-wider block mb-2">Current Bankroll</label>
                    <input
                      type="number"
                      value={editBankroll}
                      onChange={(e) => setEditBankroll(e.target.value)}
                      placeholder="1000"
                      min="0"
                      step="0.01"
                      className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/60 uppercase tracking-wider block mb-2">Unit Size</label>
                    <input
                      type="number"
                      value={editUnitSize}
                      onChange={(e) => setEditUnitSize(e.target.value)}
                      placeholder="20"
                      min="0"
                      step="0.01"
                      className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                {settingsError && (
                  <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {settingsError}
                  </div>
                )}
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={handleEditCancel}
                    disabled={savingSettings}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-white text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={savingSettings}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 transition-colors text-white text-sm disabled:opacity-50"
                  >
                    {savingSettings ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Kelly sizing helper */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-white/60 uppercase tracking-wider">Kelly Sizing</div>
                <div className="text-sm text-white/70">Estimate stake using edge + odds</div>
              </div>
              <div className="text-xs text-white/50">
                Bankroll: {formatCurrency(stats.currentBalance)} · Unit: {formatCurrency(stats.unitSize)}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Odds (American)</label>
                <input
                  type="number"
                  value={kellyOdds}
                  onChange={(e) => setKellyOdds(e.target.value)}
                  placeholder="-110"
                  className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Win Probability (%)</label>
                <input
                  type="number"
                  value={kellyProb}
                  onChange={(e) => setKellyProb(e.target.value)}
                  placeholder="55"
                  min="1"
                  max="99"
                  className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Fractional Kelly (0-1)</label>
                <input
                  type="number"
                  value={kellyFraction}
                  onChange={(e) => setKellyFraction(e.target.value)}
                  step="0.05"
                  min="0"
                  max="1"
                  className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-xs text-white/60 uppercase tracking-wider block mb-1">Max Stake Cap (% bankroll)</label>
                <input
                  type="number"
                  value={kellyCap}
                  onChange={(e) => setKellyCap(e.target.value)}
                  step="0.01"
                  min="0"
                  max="1"
                  className="w-full bg-zinc-900/80 text-white placeholder:text-white/40 border border-white/10 rounded-lg py-2 px-3 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {kellyResult ? (
              <div className="mt-4 grid grid-cols-3 gap-3 text-sm text-white">
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <div className="text-xs text-white/60 uppercase tracking-wider">Suggested Stake</div>
                  <div className="text-lg font-semibold text-white mt-1">
                    {kellyResult.suggestedStake != null ? formatCurrency(kellyResult.suggestedStake) : '—'}
                  </div>
                  <div className="text-xs text-white/50">
                    {kellyResult.suggestedUnits != null ? `${kellyResult.suggestedUnits.toFixed(2)}u` : ''}
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <div className="text-xs text-white/60 uppercase tracking-wider">Kelly % (applied)</div>
                  <div className="text-lg font-semibold text-white mt-1">
                    {kellyResult.appliedPercent.toFixed(2)}%
                  </div>
                  <div className="text-xs text-white/50">Raw: {kellyResult.kellyPercent.toFixed(2)}%</div>
                </div>
                <div className="p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                  <div className="text-xs text-white/60 uppercase tracking-wider">Edge</div>
                  <div className="text-lg font-semibold text-white mt-1">
                    {kellyResult.edgePercent.toFixed(2)}%
                  </div>
                  <div className="text-xs text-white/50">
                    Implied {kellyResult.impliedProbability.toFixed(1)}%
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-white/50 mt-3">Enter odds and win probability to size with Kelly.</div>
            )}

            {kellyResult?.warnings?.length ? (
              <div className="mt-3 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 space-y-1">
                {kellyResult.warnings.map((w, idx) => (
                  <div key={idx}>- {w}</div>
                ))}
              </div>
            ) : null}
          </motion.div>

          {/* Unified Unit-Centric Dashboard Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-sm"
          >
            {/* Top Row: Units + Record */}
            <div className="flex items-start justify-between mb-6">
              {/* Current Units */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Trophy className="w-5 h-5 text-indigo-400" />
                  <span className="text-xs text-white/60 uppercase tracking-wider font-semibold">Current Units</span>
                </div>
                <div className="text-5xl font-bold text-white">
                  {stats.currentUnits?.toFixed(1) || '0.0'}u
                </div>
              </div>

              {/* Record */}
              <div className="text-right">
                <div className="text-xs text-white/60 uppercase tracking-wider mb-2">Record</div>
                <div className="text-2xl font-bold text-white">
                  {stats.wonBets}W - {stats.lostBets}L
                </div>
                <div className="text-xs text-white/40 mt-1">
                  {winRate.toFixed(1)}% win rate
                </div>
              </div>
            </div>

            {/* Units Profit/Loss with Percentage */}
            <div className="mb-6 p-4 rounded-lg bg-white/5">
              <div className={`text-3xl font-bold mb-1 ${stats.unitsWon >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.unitsWon >= 0 ? '+' : ''}{stats.unitsWon?.toFixed(2) || '0.00'}u
              </div>
              <div className={`text-lg ${stats.unitsWon >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.unitsWon >= 0 ? '↑' : '↓'} {Math.abs((stats.unitsWon / stats.startingUnits) * 100).toFixed(2)}% on bankroll
              </div>
            </div>

            {/* Balance Trend Chart */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-xs text-white/60 uppercase tracking-wider font-semibold">
                  Balance Trend ({chartRange.toUpperCase()})
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {chartRangeOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setChartRange(option.value)}
                      className={`px-3 py-1 rounded-full text-[10px] uppercase tracking-wider transition ${
                        chartRange === option.value
                          ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                          : 'bg-white/5 text-white/40 border border-white/10'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
              {hasChartData ? (
                <ChartVisualization height={200} />
              ) : (
                <div className="text-xs text-white/40 text-center py-8">Not enough history to chart growth yet.</div>
              )}
            </div>
          </motion.div>

          {/* AI Insights Button */}
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            onClick={getAIInsights}
            disabled={insightsLoading || !hasEnoughHistory}
            className="w-full p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 border border-purple-500/30 backdrop-blur-sm hover:from-purple-500/30 hover:to-indigo-500/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/20 group-hover:bg-purple-500/30 transition-colors">
                  {insightsLoading ? (
                    <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-purple-400" />
                  )}
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-white">
                    {insightsLoading ? 'Analyzing...' : 'Get AI Analysis'}
                  </div>
                  <div className="text-xs text-white/60">
                    Personalized insights on your betting performance
                  </div>
                </div>
              </div>
              {!insightsLoading && (
                <div className="text-purple-400 group-hover:translate-x-1 transition-transform">{'>'}</div>
              )}
            </div>
          </motion.button>
          {!hasEnoughHistory && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 mt-2">
              Track at least 10 bets to unlock AI analysis. You currently have {totalBetCount} logged bet{totalBetCount === 1 ? '' : 's'}.
            </div>
          )}

          {/* Active Bets */}
          {activeBets.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Active Bets
              </h3>
              <div className="space-y-2">
                {activeBets.map((bet, index) => {
                  const liveGame = matchBetToGame(bet.game_description, liveScores, bet.sport)
                  const isLive = liveGame && liveGame.status === 'in'

                  return (
                    <motion.div
                      key={bet.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-lg bg-white/5 border border-white/10 backdrop-blur-sm hover:bg-white/10 transition-all group"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-white truncate">
                            {bet.game_description}
                          </div>
                          <div className="text-xs text-white/60 mt-1">
                            {bet.bet_side} • {bet.odds > 0 ? '+' : ''}{bet.odds} • {bet.book}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-white">
                            {formatCurrency(bet.stake)}
                          </div>
                          <div className="text-xs text-emerald-400">
                            Win: {formatCurrency(bet.potential_win)}
                          </div>
                        </div>
                      </div>

                      {/* Live Score Display */}
                      {liveGame && (
                        <div className={`mb-2 p-2 rounded-md ${
                          isLive ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30' : 'bg-white/5'
                        }`}>
                          <div className="flex justify-between items-center">
                            <div className="flex-1">
                              <div className="text-xs text-white/80">{liveGame.awayTeam}</div>
                              <div className="text-xs text-white/80 mt-0.5">{liveGame.homeTeam}</div>
                            </div>
                            <div className="flex-1 text-center">
                              <div className="text-sm font-bold text-white">{liveGame.awayScore}</div>
                              <div className="text-sm font-bold text-white mt-0.5">{liveGame.homeScore}</div>
                            </div>
                            <div className="flex-1 text-right">
                              {isLive && (
                                <div className="flex items-center justify-end gap-1">
                                  <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></div>
                                  <span className="text-xs font-semibold text-red-400">LIVE</span>
                                </div>
                              )}
                              <div className="text-xs text-white/60 mt-0.5">{liveGame.period}</div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Win Probability */}
                      {isLive && betProbabilities[bet.id] !== undefined && (
                        <div className="mb-2 p-2 rounded-md bg-white/5">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs text-white/60">Win Probability</span>
                            <span className="text-sm font-bold text-white">
                              {(betProbabilities[bet.id] * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${betProbabilities[bet.id] * 100}%` }}
                              transition={{ duration: 0.5, ease: 'easeOut' }}
                              className={`h-full rounded-full ${
                                betProbabilities[bet.id] >= 0.7 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' :
                                betProbabilities[bet.id] >= 0.4 ? 'bg-gradient-to-r from-amber-500 to-amber-400' :
                                'bg-gradient-to-r from-red-500 to-red-400'
                              }`}
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => settleBet(bet.id, 'won')}
                          className="flex-1 px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 text-xs font-medium flex items-center justify-center gap-1 transition-all"
                        >
                          <Check className="w-3 h-3" />
                          Won
                        </button>
                        <button
                          onClick={() => settleBet(bet.id, 'lost')}
                          className="flex-1 px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-xs font-medium flex items-center justify-center gap-1 transition-all"
                        >
                          <X className="w-3 h-3" />
                          Lost
                        </button>
                        <button
                          onClick={() => settleBet(bet.id, 'push')}
                          className="flex-1 px-2 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-400 text-xs font-medium transition-all"
                        >
                          Push
                        </button>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.1);
            border-radius: 3px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.2);
          }
        `
      }} />

      {/* AI Insights Modal */}
      {showInsights && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setShowInsights(false)}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[80vh] bg-gradient-to-br from-gray-900 to-black border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-indigo-500/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <Sparkles className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Bankroll Analysis</h2>
                    <p className="text-sm text-white/60">Personalized insights for your betting performance</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowInsights(false)}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto custom-scrollbar max-h-[calc(80vh-120px)]">
              {insightsLoading && !insights ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="w-12 h-12 text-purple-400 animate-spin mb-4" />
                  <p className="text-white/60">Analyzing your betting performance...</p>
                </div>
              ) : (
                <div className="prose prose-invert max-w-none">
                  <div className="text-white/90 whitespace-pre-wrap leading-relaxed">
                    {insights || 'No insights available'}
                  </div>
                  {insightsLoading && (
                    <div className="mt-4 flex items-center gap-2 text-purple-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Generating insights...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/10 bg-white/5">
              <div className="flex items-center justify-between">
                <p className="text-xs text-white/40">
                  Analysis generated by DELTA AI based on your all-time performance
                </p>
                <button
                  onClick={() => setShowInsights(false)}
                  className="px-4 py-2 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-400 text-sm font-medium transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  )
}






