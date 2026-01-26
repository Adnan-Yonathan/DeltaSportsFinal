'use client'

import { useState } from 'react'
import { Play, TrendingUp, TrendingDown, DollarSign, Percent, Calendar, Target } from 'lucide-react'

type Strategy = 'fade_public' | 'follow_rlm' | 'closing_line_value' | 'custom'

type BacktestResult = {
  totalBets: number
  wins: number
  losses: number
  pushes: number
  winRate: number
  netUnits: number
  roi: number
  maxDrawdown: number
  avgOdds: number
  profitByMonth: { month: string; profit: number }[]
}

const STRATEGIES: { key: Strategy; label: string; description: string }[] = [
  {
    key: 'fade_public',
    label: 'Fade the Public',
    description: 'Bet against teams receiving >65% of public bets',
  },
  {
    key: 'follow_rlm',
    label: 'Follow RLM',
    description: 'Bet on the side with reverse line movement',
  },
  {
    key: 'closing_line_value',
    label: 'Closing Line Value',
    description: 'Simulate betting at opening lines that beat the close',
  },
  {
    key: 'custom',
    label: 'Custom Strategy',
    description: 'Define your own rules (coming soon)',
  },
]

const SPORTS = [
  { key: 'nba', label: 'NBA' },
  { key: 'nfl', label: 'NFL' },
  { key: 'ncaamb', label: 'NCAAB' },
  { key: 'mlb', label: 'MLB' },
]

const TIMEFRAMES = [
  { key: '1m', label: 'Last Month' },
  { key: '3m', label: 'Last 3 Months' },
  { key: '6m', label: 'Last 6 Months' },
  { key: '1y', label: 'Last Year' },
]

export default function BacktestingClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy>('fade_public')
  const [selectedSport, setSelectedSport] = useState('nba')
  const [selectedTimeframe, setSelectedTimeframe] = useState('3m')
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<BacktestResult | null>(null)

  const runBacktest = async () => {
    setIsRunning(true)
    setResult(null)

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Generate mock results
    const mockResult = generateMockResult(selectedStrategy, selectedSport, selectedTimeframe)
    setResult(mockResult)
    setIsRunning(false)
  }

  return (
    <div className="space-y-6">
      {/* Strategy Selection */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="text-sm font-semibold text-white mb-4">Select Strategy</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {STRATEGIES.slice(0, previewMode ? 1 : undefined).map((strategy) => (
            <button
              key={strategy.key}
              type="button"
              onClick={() => setSelectedStrategy(strategy.key)}
              disabled={strategy.key === 'custom'}
              className={`rounded-xl border p-4 text-left transition ${
                selectedStrategy === strategy.key
                  ? 'border-amber-400/60 bg-amber-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              <div className={`text-sm font-medium ${selectedStrategy === strategy.key ? 'text-amber-200' : 'text-white'}`}>
                {strategy.label}
              </div>
              <div className="mt-1 text-xs text-white/50">{strategy.description}</div>
            </button>
          ))}
        </div>
      </div>
      {previewMode && (
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm space-y-4 px-4 py-6">
            <div className="h-16 rounded-xl border border-white/10 bg-white/5" />
            <div className="h-28 rounded-xl border border-white/10 bg-white/5" />
            <div className="h-40 rounded-xl border border-white/10 bg-white/5" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Upgrade required
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Upgrade to get full access.
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Unlock strategy backtests and performance analytics.
              </p>
            </div>
          </div>
        </div>
      )}

      {!previewMode && (
        <>
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            {/* Sport */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/40">Sport</label>
              <div className="flex items-center gap-1">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.key}
                    type="button"
                    onClick={() => setSelectedSport(sport.key)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition ${
                      selectedSport === sport.key
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    {sport.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="h-8 w-px bg-white/10" />

            {/* Timeframe */}
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-[0.2em] text-white/40">Timeframe</label>
              <div className="flex items-center gap-1">
                {TIMEFRAMES.map((tf) => (
                  <button
                    key={tf.key}
                    type="button"
                    onClick={() => setSelectedTimeframe(tf.key)}
                    className={`rounded-lg px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition ${
                      selectedTimeframe === tf.key
                        ? 'bg-amber-500/20 text-amber-200'
                        : 'text-white/50 hover:text-white/80 hover:bg-white/5'
                    }`}
                  >
                    {tf.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1" />

            {/* Run Button */}
            <button
              type="button"
              onClick={runBacktest}
              disabled={isRunning}
              className="flex items-center gap-2 rounded-xl border border-amber-400/60 bg-amber-500/10 px-6 py-2.5 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRunning ? (
                <>
                  <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-amber-200/20 border-t-amber-200" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Backtest
                </>
              )}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <ResultCard
                  icon={Target}
                  label="Win Rate"
                  value={`${result.winRate.toFixed(1)}%`}
                  subtext={`${result.wins}W - ${result.losses}L - ${result.pushes}P`}
                  positive={result.winRate > 52.4}
                />
                <ResultCard
                  icon={DollarSign}
                  label="Net Units"
                  value={`${result.netUnits > 0 ? '+' : ''}${result.netUnits.toFixed(2)}u`}
                  subtext={`${result.totalBets} total bets`}
                  positive={result.netUnits > 0}
                />
                <ResultCard
                  icon={Percent}
                  label="ROI"
                  value={`${result.roi > 0 ? '+' : ''}${result.roi.toFixed(1)}%`}
                  subtext="Return on investment"
                  positive={result.roi > 0}
                />
                <ResultCard
                  icon={TrendingDown}
                  label="Max Drawdown"
                  value={`${result.maxDrawdown.toFixed(2)}u`}
                  subtext="Peak-to-trough loss"
                  positive={false}
                />
              </div>

              {/* Monthly Breakdown */}
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <h3 className="text-sm font-semibold text-white mb-4">Monthly Performance</h3>
                <div className="space-y-2">
                  {result.profitByMonth.map((month) => (
                    <div
                      key={month.month}
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 px-4 py-2"
                    >
                      <span className="text-sm text-white/70">{month.month}</span>
                      <span
                        className={`text-sm font-semibold ${
                          month.profit > 0 ? 'text-emerald-400' : month.profit < 0 ? 'text-red-400' : 'text-white/50'
                        }`}
                      >
                        {month.profit > 0 ? '+' : ''}{month.profit.toFixed(2)}u
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Disclaimer */}
              <div className="rounded-xl border border-amber-400/20 bg-amber-500/5 px-4 py-3 text-[11px] text-amber-200/70">
                <strong className="text-amber-200">Note:</strong> Historical performance does not
                guarantee future results. Backtest results are simulated and may not account for
                line movement, liquidity, or execution factors.
              </div>
            </div>
          )}
        </>
      )}

      {/* Info Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">Backtesting</strong> uses historical odds data
        from The Odds API to simulate how betting strategies would have performed.
        Select a strategy, sport, and timeframe to run a simulation.
      </div>
    </div>
  )
}

function ResultCard({
  icon: Icon,
  label,
  value,
  subtext,
  positive,
}: {
  icon: any
  label: string
  value: string
  subtext: string
  positive: boolean
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-white/40" />
        <span className="text-[10px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      </div>
      <div className={`text-2xl font-bold ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
        {value}
      </div>
      <div className="mt-1 text-xs text-white/50">{subtext}</div>
    </div>
  )
}

function generateMockResult(strategy: Strategy, sport: string, timeframe: string): BacktestResult {
  // Generate realistic mock data based on strategy
  const baseWinRate = strategy === 'fade_public' ? 54 : strategy === 'follow_rlm' ? 53.5 : 52
  const totalBets = timeframe === '1m' ? 50 : timeframe === '3m' ? 150 : timeframe === '6m' ? 300 : 600

  const winRate = baseWinRate + (Math.random() - 0.5) * 4
  const wins = Math.round(totalBets * (winRate / 100))
  const pushes = Math.floor(totalBets * 0.03)
  const losses = totalBets - wins - pushes

  // Calculate units won/lost at -110 odds
  const netUnits = wins * (100 / 110) - losses

  const roi = (netUnits / totalBets) * 100
  const maxDrawdown = Math.abs(Math.random() * 10 + 5)

  // Generate monthly breakdown
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const numMonths = timeframe === '1m' ? 1 : timeframe === '3m' ? 3 : timeframe === '6m' ? 6 : 12
  const currentMonth = new Date().getMonth()

  const profitByMonth = Array.from({ length: numMonths }, (_, i) => {
    const monthIndex = (currentMonth - numMonths + i + 1 + 12) % 12
    const monthProfit = (Math.random() - 0.4) * 8
    return {
      month: months[monthIndex],
      profit: Number(monthProfit.toFixed(2)),
    }
  })

  return {
    totalBets,
    wins,
    losses,
    pushes,
    winRate,
    netUnits,
    roi,
    maxDrawdown,
    avgOdds: -110,
    profitByMonth,
  }
}
