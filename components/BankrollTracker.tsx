'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatPercent } from '@/lib/utils/odds'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import BetModal from './BetModal'

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
  bet_type?: string
  odds: number
  stake: number
  potential_win: number
  actual_result: number | null
  status: string
  placed_at: string
  book: string
}

export default function BankrollTracker({ userId }: BankrollTrackerProps) {
  const [stats, setStats] = useState<BankrollStats | null>(null)
  const [activeBets, setActiveBets] = useState<Bet[]>([])
  const [todayBets, setTodayBets] = useState<Bet[]>([])
  const [loading, setLoading] = useState(true)
  const [showBetModal, setShowBetModal] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadData()

    // Subscribe to bet changes
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
      supabase.removeChannel(channel)
    }
  }, [userId])

  const loadData = async () => {
    // Load stats
    const statsRes = await fetch(`/api/bankroll/stats?period=7d`)
    if (statsRes.ok) {
      const data = await statsRes.json()
      setStats(data)
    }

    // Load active bets
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

    // Load today's completed bets
    const today = new Date().toISOString().split('T')[0]
    const { data: todayData } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['won', 'lost', 'push'])
      .gte('settled_at', today)
      .order('settled_at', { ascending: false })

    if (todayData) {
      setTodayBets(todayData)
    }

    setLoading(false)
  }

  const settleBet = async (betId: string, status: 'won' | 'lost' | 'push') => {
    const bet = activeBets.find((b) => b.id === betId)
    if (!bet) return

    let actualResult = 0
    if (status === 'won') {
      // Won: Return stake + profit
      actualResult = bet.stake + bet.potential_win
    } else if (status === 'lost') {
      // Lost: Stake was already deducted when bet was placed, so no change
      actualResult = 0
    } else if (status === 'push') {
      // Push: Return stake only
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

  if (loading) {
    return (
      <div className="h-full bg-bg-primary p-4 flex items-center justify-center">
        <div className="animate-pulse text-accent-green">Loading...</div>
      </div>
    )
  }

  const profitChange = stats ? stats.totalProfit : 0
  const profitPercent = stats
    ? ((stats.currentBalance - stats.startingBalance) / stats.startingBalance) * 100
    : 0

  return (
    <div className="h-full bg-bg-primary overflow-y-auto">
      {/* Current Bankroll */}
      <div className="p-6 border-b border-[#2f343c]">
        <div className="card-header">Current Bankroll</div>
        <div className="text-4xl font-bold text-text-primary mt-2">
          {formatCurrency(stats?.currentBalance || 0)}
        </div>
        <div
          className={`text-lg font-semibold mt-1 ${
            profitChange >= 0 ? 'text-success-green' : 'text-warning-red'
          }`}
        >
          {profitChange >= 0 ? '+' : ''}
          {formatCurrency(profitChange)} ({formatPercent(profitPercent)})
        </div>
        <div className="text-xs text-text-secondary mt-1">Last 7 days</div>
      </div>

      {/* Quick Stats */}
      <div className="p-6 border-b border-[#2f343c] grid grid-cols-3 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold text-success-green">
            {stats?.wonBets || 0}
          </div>
          <div className="text-xs text-text-secondary">Won</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-warning-red">
            {stats?.lostBets || 0}
          </div>
          <div className="text-xs text-text-secondary">Lost</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-accent-green">
            {stats?.pendingBets || 0}
          </div>
          <div className="text-xs text-text-secondary">Pending</div>
        </div>
      </div>

      {/* Active Bets */}
      <div className="p-6 border-b border-[#2f343c]">
        <div className="card-header mb-3">Active Bets</div>
        {activeBets.length === 0 ? (
          <div className="text-text-secondary text-sm text-center py-4">
            No active bets
          </div>
        ) : (
          <div className="space-y-3">
            {activeBets.map((bet) => (
              <div key={bet.id} className="bg-bg-secondary p-3 rounded-lg">
                <div className="text-sm font-semibold text-text-primary mb-1">
                  {bet.bet_side}
                </div>
                <div className="text-xs text-text-secondary mb-2">
                  {bet.game_description} | {bet.book}
                </div>
                <div className="text-sm text-accent-green mb-2">
                  ${bet.stake} to win ${bet.potential_win.toFixed(2)}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => settleBet(bet.id, 'won')}
                    className="flex-1 bg-success-green/20 text-success-green text-xs py-1 px-2 rounded hover:bg-success-green/30"
                  >
                    Won
                  </button>
                  <button
                    onClick={() => settleBet(bet.id, 'lost')}
                    className="flex-1 bg-warning-red/20 text-warning-red text-xs py-1 px-2 rounded hover:bg-warning-red/30"
                  >
                    Lost
                  </button>
                  <button
                    onClick={() => settleBet(bet.id, 'push')}
                    className="flex-1 bg-text-secondary/20 text-text-secondary text-xs py-1 px-2 rounded hover:bg-text-secondary/30"
                  >
                    Push
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today&rsquo;s Bets */}
      <div className="p-6 border-b border-[#2f343c]">
        <div className="card-header mb-3">Today&rsquo;s Results</div>
        {todayBets.length === 0 ? (
          <div className="text-text-secondary text-sm text-center py-4">
            No settled bets today
          </div>
        ) : (
          <div className="space-y-2">
            {todayBets.map((bet) => (
              <div
                key={bet.id}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-lg ${
                      bet.status === 'won'
                        ? 'text-success-green'
                        : bet.status === 'lost'
                        ? 'text-warning-red'
                        : 'text-text-secondary'
                    }`}
                  >
                    {bet.status === 'won' ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œ' : bet.status === 'lost' ? 'ÃƒÆ’Ã‚Â¢Ãƒâ€¦Ã¢â‚¬Å“ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â' : 'ÃƒÆ’Ã‚Â¢Ãƒâ€¹Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢'}
                  </span>
                  <span className="text-text-secondary truncate">
                    {bet.bet_side}
                  </span>
                </div>
                <span
                  className={`font-semibold ${
                    bet.status === 'won'
                      ? 'text-success-green'
                      : bet.status === 'lost'
                      ? 'text-warning-red'
                      : 'text-text-secondary'
                  }`}
                >
                  {bet.actual_result && bet.actual_result >= 0 ? '+' : ''}
                  {formatCurrency(bet.actual_result || 0)}
                </span>
              </div>
            ))}
            <div className="pt-2 border-t border-[#2f343c] flex justify-between font-semibold">
              <span className="text-text-secondary">Net:</span>
              <span
                className={
                  todayBets.reduce((sum, b) => sum + (b.actual_result || 0), 0) >= 0
                    ? 'text-success-green'
                    : 'text-warning-red'
                }
              >
                {todayBets.reduce((sum, b) => sum + (b.actual_result || 0), 0) >= 0
                  ? '+'
                  : ''}
                {formatCurrency(
                  todayBets.reduce((sum, b) => sum + (b.actual_result || 0), 0)
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Performance Chart */}
      <div className="p-6 border-b border-[#2f343c]">
        <div className="card-header mb-3">7-Day Performance</div>
        {stats && stats.dailyBalances.length > 0 ? (
          <ResponsiveContainer width="100%" height={150}>
            <LineChart data={stats.dailyBalances}>
              <XAxis
                dataKey="date"
                tickFormatter={(date) => format(new Date(date), 'MM/dd')}
                stroke="#b3bac6"
                style={{ fontSize: '10px' }}
              />
              <YAxis hide />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#262b31',
                  border: '1px solid #2f343c',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => formatCurrency(value)}
                labelFormatter={(date) => format(new Date(date), 'MMM dd')}
              />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#34d399"
                strokeWidth={2}
                dot={{ fill: '#34d399', r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-text-secondary text-sm text-center py-4">
            No data yet
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="p-6">
        <button
          onClick={() => setShowBetModal(true)}
          className="w-full btn-primary"
        >
          Log Bet
        </button>
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
    </div>
  )
}
