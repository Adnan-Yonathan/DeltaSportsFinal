'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import type { InsiderBet } from '@/lib/services/polymarket-insider'

// ── Sport filter tabs — all sports Polymarket tracks ─────────────────────────

const SPORT_TABS = [
  { label: 'All',      value: 'ALL' },
  { label: 'NBA',      value: 'NBA' },
  { label: 'NFL',      value: 'NFL' },
  { label: 'NHL',      value: 'NHL' },
  { label: 'MLB',      value: 'MLB' },
  { label: 'NCAAB',    value: 'NCAAB' },
  { label: 'NCAAF',    value: 'NCAAF' },
  { label: 'Soccer',   value: 'SOCCER' },
  { label: 'MLS',      value: 'MLS' },
  { label: 'UFC',      value: 'UFC' },
  { label: 'MMA',      value: 'MMA' },
  { label: 'Boxing',   value: 'BOXING' },
  { label: 'Tennis',   value: 'TENNIS' },
  { label: 'Golf',     value: 'GOLF' },
  { label: 'Esports',  value: 'ESPORTS' },
  { label: 'Racing',   value: 'RACING' },
  { label: 'Cricket',  value: 'CRICKET' },
  { label: 'WNBA',     value: 'WNBA' },
  { label: 'Olympics', value: 'OLYMPICS' },
]

// ── Date window tabs ──────────────────────────────────────────────────────────

const DATE_TABS = [
  { label: 'Today',      daysBack: 0 },
  { label: 'Last 3 Days', daysBack: 3 },
  { label: 'All Time',   daysBack: -1 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatOdds(american: number | null, price: number): string {
  if (american !== null && Number.isFinite(american)) {
    return american > 0 ? `+${american}` : `${american}`
  }
  if (price >= 0.5) return `-${Math.round((price / (1 - price)) * 100)}`
  return `+${Math.round(((1 - price) / price) * 100)}`
}

function formatUsd(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
  return `$${Math.round(value)}`
}

function formatPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  if (h < 1) return `${Math.floor(diff / 60_000)}m ago`
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ── Score badge ───────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  if (score >= 90) {
    return (
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.18)]">
        <span className="text-xs font-bold leading-none text-white">{score}</span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/60">Elite</span>
      </div>
    )
  }
  if (score >= 80) {
    return (
      <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/15">
        <span className="text-xs font-bold leading-none text-emerald-200">{score}</span>
        <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-emerald-300/60">Sharp</span>
      </div>
    )
  }
  return (
    <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10">
      <span className="text-xs font-bold leading-none text-amber-200">{score}</span>
      <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-amber-300/60">Notable</span>
    </div>
  )
}

// ── Bet card ──────────────────────────────────────────────────────────────────

function InsiderBetCard({ bet }: { bet: InsiderBet }) {
  const polymarketUrl = `https://polymarket.com/event/${bet.slug}`
  const walletShort   = `${bet.wallet.slice(0, 6)}…${bet.wallet.slice(-4)}`
  const displayName   = bet.pseudonym ?? walletShort

  return (
    <div className="rounded-2xl border border-white/10 bg-black/55 p-5 transition-colors hover:border-white/20">
      <div className="flex items-start gap-4">
        <ScoreBadge score={bet.insider_score} />

        <div className="min-w-0 flex-1">
          {/* Tags */}
          <div className="mb-2 flex flex-wrap items-center gap-1.5">
            {bet.sport_label && (
              <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/55">
                {bet.sport_label}
              </span>
            )}
            {bet.size_ratio >= 2 && (
              <span className="flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                <Zap className="h-2.5 w-2.5" />
                {bet.size_ratio}× normal size
              </span>
            )}
          </div>

          {/* Title */}
          <a
            href={polymarketUrl}
            target="_blank"
            rel="noreferrer"
            className="block text-sm font-semibold leading-snug text-white hover:text-emerald-200 transition-colors line-clamp-2"
          >
            {bet.title}
          </a>

          {/* Outcome + odds */}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            <span className="font-semibold text-emerald-300">{bet.outcome}</span>
            <span className="text-white/50">·</span>
            <span className="text-white/70">{formatOdds(bet.avg_entry_american_odds, bet.avg_entry_price)}</span>
            <span className="text-white/50">·</span>
            <span className="text-white/55">{(bet.avg_entry_price * 100).toFixed(0)}¢ entry</span>
          </div>

          {/* Stake */}
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-white/40">Stake </span>
              <span className="font-semibold text-white">{formatUsd(bet.stake_usd)}</span>
            </div>
            <div>
              <span className="text-white/40">To win </span>
              <span className="font-semibold text-emerald-300">{formatUsd(bet.potential_payout_usd)}</span>
            </div>
            {bet.last_trade_time && (
              <span className="text-white/30">{timeAgo(bet.last_trade_time)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Wallet row */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
        <div className="flex items-center gap-2">
          {bet.profile_image_url ? (
            <img
              src={bet.profile_image_url}
              alt={displayName}
              className="h-6 w-6 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-white/10 text-[9px] font-bold text-white/60">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-medium text-white/70">{displayName}</span>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-white/35">ROI </span>
            <span className={`font-semibold ${bet.wallet_roi_pct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatPct(bet.wallet_roi_pct)}
            </span>
          </div>
          <div>
            <span className="text-white/35">Trades </span>
            <span className="font-semibold text-white/70">{bet.wallet_trade_count.toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ sport, daysBack }: { sport: string; daysBack: number }) {
  const dateLabel = daysBack === 0 ? 'today' : daysBack < 0 ? 'all time' : `the last ${daysBack} days`
  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 px-8 py-16 text-center">
      <Eye className="mx-auto h-8 w-8 text-white/20" />
      <p className="mt-4 text-sm font-medium text-white/50">No insider bets found</p>
      <p className="mt-1.5 text-xs text-white/30">
        {sport !== 'ALL'
          ? `No qualifying ${sport} positions for ${dateLabel}. Try a wider date range or All sports.`
          : `No qualifying positions for ${dateLabel}. Try "Last 3 Days" or "All Time".`}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsiderClient() {
  const [bets, setBets]       = useState<InsiderBet[]>([])
  const [sport, setSport]     = useState('ALL')
  const [daysBack, setDaysBack] = useState(3)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchBets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '100', daysBack: String(daysBack) })
      if (sport !== 'ALL') params.set('sport', sport)

      const res  = await fetch(`/api/polymarket/insider?${params}`)
      const json = await res.json()

      if (res.ok) {
        setBets(json.bets ?? [])
        setLastUpdated(new Date())
      }
    } catch (err) {
      console.error('[InsiderClient] fetch failed', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sport, daysBack])

  useEffect(() => { fetchBets() }, [fetchBets])

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => fetchBets(true), 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchBets])

  const elite = bets.filter(b => b.insider_score >= 90).length
  const sharp = bets.filter(b => b.insider_score >= 80 && b.insider_score < 90).length

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="mx-auto max-w-4xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2">
                <Eye className="h-5 w-5 text-emerald-400" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.35em] text-emerald-300/80">
                  Prediction Market Insider
                </span>
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sharpest open bets on Polymarket
              </h1>
              <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
                Only wallets with 500+ trades and a positive ROI. Ranked by long-term
                profitability and how large this bet is relative to their normal size.
              </p>
            </div>

            <button
              type="button"
              onClick={() => fetchBets(true)}
              disabled={refreshing || loading}
              className="shrink-0 flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Stats row */}
          {!loading && bets.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Shown</p>
                <p className="mt-0.5 text-lg font-bold text-white">{bets.length}</p>
              </div>
              {bets[0] && (
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Top score</p>
                  <p className="mt-0.5 text-lg font-bold text-white">{bets[0].insider_score}</p>
                </div>
              )}
              {elite > 0 && (
                <div className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/40">Elite 90+</p>
                  <p className="mt-0.5 text-lg font-bold text-white">{elite}</p>
                </div>
              )}
              {sharp > 0 && (
                <div className="rounded-xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-emerald-300/60">Sharp 80–89</p>
                  <p className="mt-0.5 text-lg font-bold text-emerald-200">{sharp}</p>
                </div>
              )}
              {lastUpdated && (
                <div className="ml-auto flex items-end pb-0.5">
                  <span className="text-[11px] text-white/25">Updated {timeAgo(lastUpdated.toISOString())}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Date filter ── */}
        <div className="mb-4 flex gap-2">
          {DATE_TABS.map((tab) => (
            <button
              key={tab.daysBack}
              type="button"
              onClick={() => setDaysBack(tab.daysBack)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                daysBack === tab.daysBack
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/15 text-white/55 hover:border-white/25 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Sport filter — horizontally scrollable ── */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {SPORT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setSport(tab.value)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                sport === tab.value
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : 'border-white/15 text-white/55 hover:border-white/25 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Feed ── */}
        {loading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : bets.length === 0 ? (
          <EmptyState sport={sport} daysBack={daysBack} />
        ) : (
          <div className="space-y-3">
            {bets.map((bet, idx) => (
              <InsiderBetCard key={`${bet.wallet}-${bet.slug}-${idx}`} bet={bet} />
            ))}
          </div>
        )}

        {/* ── Scoring explanation ── */}
        {!loading && bets.length > 0 && (
          <div className="mt-10 rounded-2xl border border-white/8 bg-white/3 p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-white/30" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-white/30">
                How scores are calculated
              </p>
            </div>
            <div className="grid gap-3 text-xs text-white/45 sm:grid-cols-2">
              <div>
                <p className="font-semibold text-white/60 mb-1">Wallet Authority (60%)</p>
                <p>Trade count, lifetime ROI, profit factor, and win rate — weighted toward wallets with the deepest track record.</p>
              </div>
              <div>
                <p className="font-semibold text-white/60 mb-1">Bet Conviction (40%)</p>
                <p>How large this specific bet is relative to that wallet's average. A 3× bet from a long-term winner is a different signal than a routine position.</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] text-white/25">
              Min 1 000 buy trades · Positive ROI · Profit factor ≥ 1.1 · Entry price 4¢–92¢
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
