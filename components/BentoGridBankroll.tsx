'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils/odds'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts'
import { format } from 'date-fns'
import { motion } from 'framer-motion'
import { Wallet, TrendingUp, Trophy, Target, Activity, Plus, Check, X } from 'lucide-react'
import BetModal from './BetModal'
import { LiveScore, matchBetToGame } from '@/lib/espn-api'

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
  dailyBalances: { date: string; balance: number }[]
}

interface Bet {
  id: string
  sport: string
  game_description: string
  bet_side: string
  odds: number
  stake: number
  potential_win: number
  actual_result: number | null
  status: string
  placed_at: string
  book: string
}

export default function BentoGridBankroll({ userId }: BankrollTrackerProps) {
  const [stats, setStats] = useState<BankrollStats | null>(null)
  const [activeBets, setActiveBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [showBetModal, setShowBetModal] = useState(false)
  const [liveScores, setLiveScores] = useState<LiveScore[]>([])
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

  const loadData = async () => {
    const statsRes = await fetch(`/api/bankroll/stats?period=7d`)
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

  const profitChange = stats.totalProfit
  const profitPercent = ((stats.currentBalance - stats.startingBalance) / stats.startingBalance) * 100
  const winRate = stats.wonBets + stats.lostBets > 0
    ? (stats.wonBets / (stats.wonBets + stats.lostBets)) * 100
    : 0

  return (
    <>
      <div className="h-full bg-black/40 backdrop-blur-xl border-l border-white/5 overflow-y-auto custom-scrollbar">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wallet className="w-5 h-5 text-indigo-400" />
                Bankroll
              </h2>
              <p className="text-xs text-white/40 mt-1">Track your performance</p>
            </div>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowBetModal(true)}
              className="p-2 rounded-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
            >
              <Plus className="w-4 h-4" />
            </motion.button>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-2 gap-3">
            {/* Balance Card - spans 2 columns */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="col-span-2 p-5 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-3">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-white/60 uppercase tracking-wider font-semibold">Current Balance</span>
              </div>
              <div className="text-3xl font-bold text-white mb-1">
                {formatCurrency(stats.currentBalance)}
              </div>
              <div className={`text-sm flex items-center gap-1 ${profitChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                <TrendingUp className="w-3.5 h-3.5" />
                {profitChange >= 0 ? '+' : ''}{formatCurrency(profitChange)} ({profitPercent.toFixed(2)}%)
              </div>
            </motion.div>

            {/* Win Rate */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span className="text-xs text-white/60">Win Rate</span>
              </div>
              <div className="text-2xl font-bold text-white">
                {winRate.toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">
                {stats.wonBets}W - {stats.lostBets}L
              </div>
            </motion.div>

            {/* ROI */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 text-emerald-400" />
                <span className="text-xs text-white/60">ROI</span>
              </div>
              <div className={`text-2xl font-bold ${stats.roi >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {stats.roi.toFixed(1)}%
              </div>
              <div className="text-xs text-white/40 mt-1">
                {stats.pendingBets} pending
              </div>
            </motion.div>

            {/* Chart - spans 2 columns */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="col-span-2 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
            >
              <div className="text-xs text-white/60 uppercase tracking-wider font-semibold mb-3">
                7-Day Trend
              </div>
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={stats.dailyBalances}>
                  <defs>
                    <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
                    tickFormatter={(value) => `$${value}`}
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
                    formatter={(value: any) => [`$${value.toFixed(2)}`, 'Balance']}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Active Bets */}
          {activeBets.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-white/80 mb-3 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Active Bets
              </h3>
              <div className="space-y-2">
                {activeBets.map((bet, index) => {
                  const liveGame = matchBetToGame(bet.game_description, liveScores)
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

        <style jsx>{`
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
        `}</style>
      </div>

      {showBetModal && (
        <BetModal
          userId={userId}
          onClose={() => setShowBetModal(false)}
          onSuccess={() => {
            setShowBetModal(false)
            loadData()
          }}
        />
      )}
    </>
  )
}
