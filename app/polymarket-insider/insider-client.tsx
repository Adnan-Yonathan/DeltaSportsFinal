'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowUpRight, CheckCircle2, Database, RefreshCw, TrendingUp, Zap } from 'lucide-react'
import type { InsiderBet } from '@/lib/services/polymarket-insider'
import ShareInsiderBetButton from '@/components/ShareInsiderBetButton'
import { extractTeamLogos } from '@/lib/utils/team-logos'

// ── Sport filter tabs ─────────────────────────────────────────────────────────

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

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'h-16 w-16' : size === 'sm' ? 'h-9 w-9' : 'h-12 w-12'
  const numCls = size === 'lg' ? 'text-base' : size === 'sm' ? 'text-[11px]' : 'text-xs'
  const lblCls = size === 'lg' ? 'text-[9px]' : 'text-[8px]'

  if (score >= 90) {
    return (
      <div className={`flex ${dim} shrink-0 flex-col items-center justify-center rounded-xl border border-white/40 bg-white/10 shadow-[0_0_12px_rgba(255,255,255,0.18)]`}>
        <span className={`${numCls} font-bold leading-none text-white`}>{score}</span>
        <span className={`mt-0.5 ${lblCls} font-semibold uppercase tracking-[0.18em] text-white/60`}>Elite</span>
      </div>
    )
  }
  if (score >= 80) {
    return (
      <div className={`flex ${dim} shrink-0 flex-col items-center justify-center rounded-xl border border-emerald-400/50 bg-emerald-500/15`}>
        <span className={`${numCls} font-bold leading-none text-emerald-200`}>{score}</span>
        <span className={`mt-0.5 ${lblCls} font-semibold uppercase tracking-[0.18em] text-emerald-300/60`}>Sharp</span>
      </div>
    )
  }
  return (
    <div className={`flex ${dim} shrink-0 flex-col items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10`}>
      <span className={`${numCls} font-bold leading-none text-amber-200`}>{score}</span>
      <span className={`mt-0.5 ${lblCls} font-semibold uppercase tracking-[0.18em] text-amber-300/60`}>Notable</span>
    </div>
  )
}

// ── Left panel list card ──────────────────────────────────────────────────────

function ListCard({ bet, selected, onClick }: { bet: InsiderBet; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border px-3 py-3 text-left transition-colors ${
        selected
          ? 'border-emerald-400/60 bg-emerald-500/10'
          : 'border-white/10 bg-black/40 hover:border-white/25 hover:bg-white/5'
      }`}
    >
      <div className="flex items-start gap-3">
        <ScoreBadge score={bet.insider_score} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 mb-1">
            {bet.sport_label && (
              <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-white/45">
                {bet.sport_label}
              </span>
            )}
            {bet.size_ratio >= 2 && (
              <span className="flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-amber-400/8 px-1.5 py-0.5 text-[9px] font-semibold text-amber-300/80">
                <Zap className="h-2 w-2" />
                {bet.size_ratio}×
              </span>
            )}
            {bet.consensus_count > 1 && (
              <span className="rounded-full border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-violet-300/80">
                {bet.consensus_count}× agree
              </span>
            )}
          </div>
          <p className="line-clamp-2 text-xs font-semibold leading-snug text-white">{bet.title}</p>
          <div className="mt-1.5 flex items-center gap-2 text-[11px]">
            <span className="font-semibold text-emerald-300">{bet.outcome}</span>
            <span className="text-white/35">·</span>
            <span className="text-white/55">{formatOdds(bet.avg_entry_american_odds, bet.avg_entry_price)}</span>
            <span className="ml-auto text-white/35">{formatUsd(bet.stake_usd)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}

// ── Right panel detail view ───────────────────────────────────────────────────

function DetailPanel({ bet }: { bet: InsiderBet | null }) {
  if (!bet) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="rounded-2xl border border-white/10 bg-black/30 px-6 py-8 text-center">
          <TrendingUp className="mx-auto h-7 w-7 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Select a bet to see details</p>
        </div>
      </div>
    )
  }

  const walletShort = `${bet.wallet.slice(0, 6)}…${bet.wallet.slice(-4)}`
  const displayName = bet.pseudonym ?? walletShort
  const polymarketUrl = `https://polymarket.com/event/${bet.slug}`

  return (
    <div className="p-4">
      {/* Score + title */}
      <div className="flex items-start gap-4">
        <ScoreBadge score={bet.insider_score} size="lg" />
        <div className="min-w-0 flex-1">
          {bet.sport_label && (
            <span className="mb-1.5 inline-block rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-white/50">
              {bet.sport_label}
            </span>
          )}
          <h2 className="text-lg font-bold leading-snug text-white">{bet.title}</h2>
        </div>
      </div>

      {/* Outcome + odds */}
      {(() => {
        const logos = extractTeamLogos(bet.title, bet.sport_label)
        return (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/45 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/35 mb-2">The Position</p>
            <div className="flex items-center gap-3">
              {logos.length > 0 && (
                <div className="flex items-center -space-x-2">
                  {logos.map((logo) => (
                    <img
                      key={logo.abbreviation}
                      src={logo.logoUrl}
                      alt={logo.name}
                      className="h-8 w-8 rounded-full border border-white/15 bg-black/60 object-contain"
                    />
                  ))}
                </div>
              )}
              <span className="text-xl font-bold text-emerald-300">{bet.outcome}</span>
              <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-sm font-semibold text-emerald-200">
                {formatOdds(bet.avg_entry_american_odds, bet.avg_entry_price)}
              </span>
              <span className="text-sm text-white/40">{(bet.avg_entry_price * 100).toFixed(0)}¢ avg entry</span>
              {bet.consensus_count > 1 && (
                <span className="ml-auto flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2 py-1 text-[11px] font-semibold text-amber-300">
                  {bet.consensus_count} insiders agree
                </span>
              )}
            </div>
          </div>
        )
      })()}

      {/* Stake stats */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Stake</p>
          <p className="mt-1 text-lg font-bold text-white">{formatUsd(bet.stake_usd)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">To Win</p>
          <p className="mt-1 text-lg font-bold text-emerald-300">{formatUsd(bet.potential_payout_usd)}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/45 px-3 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Size Ratio</p>
          <div className="mt-1 flex items-center gap-1">
            <p className="text-lg font-bold text-white">{bet.size_ratio}×</p>
            {bet.size_ratio >= 2 && <Zap className="h-3.5 w-3.5 text-amber-400" />}
          </div>
        </div>
      </div>

      {/* Wallet */}
      <div className="mt-3 rounded-xl border border-white/10 bg-black/45 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-white/35 mb-3">Wallet</p>
        <div className="flex items-center gap-3 mb-3">
          {bet.profile_image_url ? (
            <img src={bet.profile_image_url} alt={displayName} className="h-8 w-8 rounded-full object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-[10px] font-bold text-white/60">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-white">{displayName}</p>
            {bet.last_trade_time && (
              <p className="text-[11px] text-white/35">Last traded {timeAgo(bet.last_trade_time)}</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-white/8 pt-3">
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">ROI</p>
            <p className={`text-sm font-bold ${bet.wallet_roi_pct >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
              {formatPct(bet.wallet_roi_pct)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">Entry Odds</p>
            <p className="text-sm font-bold text-white">{formatOdds(bet.avg_entry_american_odds, bet.avg_entry_price)}</p>
          </div>
          <div>
            <p className="text-[10px] text-white/35 mb-0.5">Current Odds</p>
            <p className="text-sm font-bold text-emerald-300">
              {bet.current_price != null
                ? formatOdds(bet.current_american_odds, bet.current_price)
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <a
          href={polymarketUrl}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/70 transition hover:border-white/30 hover:text-white"
        >
          View on Polymarket
          <ArrowUpRight className="h-4 w-4" />
        </a>
        <ShareInsiderBetButton
          bet={{
            id: `${bet.wallet.slice(0, 8)}-${bet.slug.slice(0, 20)}`,
            title: bet.title,
            outcome: bet.outcome,
            sportLabel: bet.sport_label,
            avgEntryPrice: bet.avg_entry_price,
            americanOdds: bet.avg_entry_american_odds,
            stakeUsd: bet.stake_usd,
            potentialPayoutUsd: bet.potential_payout_usd,
            insiderScore: bet.insider_score,
            sizeRatio: bet.size_ratio,
            walletRoiPct: bet.wallet_roi_pct,
            walletTradeCount: bet.wallet_trade_count,
            displayName: displayName,
            profileImageUrl: bet.profile_image_url,
            lastTradeTime: bet.last_trade_time,
          }}
        />
      </div>
    </div>
  )
}

// ── Empty left panel ──────────────────────────────────────────────────────────

function EmptyState({ sport }: { sport: string }) {
  return (
    <div className="p-4 text-center">
      <p className="text-sm font-medium text-white/40">No bets found</p>
      <p className="mt-1 text-xs text-white/25">
        {sport !== 'ALL' ? `Try All sports.` : 'Check back later.'}
      </p>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function InsiderClient() {
  const [bets, setBets]           = useState<InsiderBet[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sport, setSport]         = useState('ALL')
  const [loading, setLoading]     = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Backfill state: null = idle, 'ingest' | 'rollups' = running, 'done' = finished
  type BackfillPhase = 'ingest' | 'rollups' | 'done' | null
  const [backfillPhase, setBackfillPhase] = useState<BackfillPhase>(null)
  const [backfillResult, setBackfillResult] = useState<{ walletsProcessed?: number } | null>(null)

  const fetchBets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    try {
      const params = new URLSearchParams({ limit: '100', daysBack: '0' })
      if (sport !== 'ALL') params.set('sport', sport)

      const res  = await fetch(`/api/polymarket/insider?${params}`)
      const json = await res.json()

      if (res.ok) {
        const incoming: InsiderBet[] = json.bets ?? []
        setBets(incoming)
        setLastUpdated(new Date())
        // Auto-select first bet on initial load
        if (!isRefresh && incoming.length > 0) {
          setSelectedId(`${incoming[0].wallet}-${incoming[0].slug}`)
        }
      }
    } catch (err) {
      console.error('[InsiderClient] fetch failed', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [sport])

  useEffect(() => { fetchBets() }, [fetchBets])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => fetchBets(true), 5 * 60 * 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchBets])

  const runBackfill = useCallback(async () => {
    if (backfillPhase) return
    setBackfillResult(null)

    // Step 1: Sync Trades
    setBackfillPhase('ingest')
    try {
      await fetch('/api/polymarket/insider/backfill?step=ingest', { method: 'POST' })
    } catch {
      // continue to rollups even if ingest fails
    }

    // Step 2: Recompute Stats
    setBackfillPhase('rollups')
    try {
      const res = await fetch('/api/polymarket/insider/backfill?step=rollups', { method: 'POST' })
      const json = await res.json()
      setBackfillResult({ walletsProcessed: json.rollups?.walletsProcessed ?? 0 })
    } catch {
      setBackfillResult({})
    }

    setBackfillPhase('done')
    // Auto-refresh the feed after backfill
    setTimeout(() => {
      fetchBets(true)
      setBackfillPhase(null)
    }, 2000)
  }, [backfillPhase, fetchBets])

  const selectedBet = bets.find(b => `${b.wallet}-${b.slug}` === selectedId) ?? null

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="px-2 pb-[96px] pt-4 sm:px-4 sm:pb-0 sm:pt-5">
        <div className="mx-auto w-full max-w-none">

          {/* ── Top bar: sport filters + refresh ── */}
          <div className="mb-3 flex items-center gap-3">
            <div className="flex flex-1 gap-2 overflow-x-auto pb-1 scrollbar-none">
              {SPORT_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setSport(tab.value)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    sport === tab.value
                      ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/15 text-white/55 hover:border-white/25 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lastUpdated && (
                <span className="hidden text-[11px] text-white/25 sm:block">
                  {timeAgo(lastUpdated.toISOString())}
                </span>
              )}

              {/* Backfill button */}
              <button
                type="button"
                onClick={runBackfill}
                disabled={!!backfillPhase || refreshing || loading}
                title="Sync trades from Polymarket API then recompute wallet stats"
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-emerald-400/40 hover:text-emerald-200 disabled:opacity-40"
              >
                {backfillPhase === 'done' ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                    {backfillResult?.walletsProcessed != null
                      ? `${backfillResult.walletsProcessed} wallets`
                      : 'Done'}
                  </>
                ) : backfillPhase === 'ingest' ? (
                  <>
                    <Database className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                    Syncing trades…
                  </>
                ) : backfillPhase === 'rollups' ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-emerald-400" />
                    Recomputing…
                  </>
                ) : (
                  <>
                    <Database className="h-3.5 w-3.5" />
                    Backfill
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => fetchBets(true)}
                disabled={refreshing || loading || !!backfillPhase}
                className="flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {/* ── Two-panel grid ── */}
          <div className="grid min-h-[620px] grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)]">

            {/* Left: scrollable list */}
            <div className="max-h-[72vh] overflow-y-auto border-b border-white/10 bg-black/30 lg:border-b-0 lg:border-r lg:border-white/10">
              <div className="space-y-2 p-3">
                {loading ? (
                  [...Array(8)].map((_, i) => (
                    <div key={i} className="h-20 animate-pulse rounded-2xl border border-white/10 bg-white/5" />
                  ))
                ) : bets.length === 0 ? (
                  <EmptyState sport={sport} />
                ) : (
                  bets.map((bet, idx) => {
                    const id = `${bet.wallet}-${bet.slug}`
                    return (
                      <ListCard
                        key={`${id}-${idx}`}
                        bet={bet}
                        selected={selectedId === id}
                        onClick={() => setSelectedId(id)}
                      />
                    )
                  })
                )}
              </div>
            </div>

            {/* Right: detail panel */}
            <div className="overflow-y-auto bg-black/20 lg:max-h-[72vh]">
              <DetailPanel bet={selectedBet} />
            </div>

          </div>

        </div>
      </div>
    </div>
  )
}
