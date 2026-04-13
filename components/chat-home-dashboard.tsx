'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowUpRight,
  BookOpen,
  Calculator,
  Newspaper,
  Share2,
  TrendingUp,
  Wallet,
  Waves,
} from 'lucide-react'

type HomeDashboardProps = {
  welcomeName?: string | null
}

type WalletSnapshot = {
  wallet: string
  total_realized_pnl: number
  pnl_30d: number
}

type HotGameSnapshot = {
  game: string
  sport: string
  moveCount: number
  marketCount: number
}

type EvSnapshot = {
  game: string
  selection: string
  bestBook: string
  bestOdds: number
  ev: number
}

type WhaleSnapshot = {
  id: string
  sport: string
  outcome: string
  notional: number
  americanOdds: number | null
}

const toFirstName = (value?: string | null) => {
  const raw = String(value ?? '').trim()
  if (!raw) return 'there'
  if (raw.includes('@')) return raw.split('@')[0]
  const first = raw.split(/\s+/)[0]
  return first || 'there'
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0)

const formatOdds = (value: number | null) => {
  if (value == null || !Number.isFinite(value)) return 'n/a'
  const rounded = Math.round(value)
  return rounded > 0 ? `+${rounded}` : `${rounded}`
}

const shortWallet = (wallet: string) => {
  if (!wallet) return 'wallet'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

export default function ChatHomeDashboard({ welcomeName }: HomeDashboardProps) {
  const [wallets, setWallets] = useState<WalletSnapshot[]>([])
  const [hotGames, setHotGames] = useState<HotGameSnapshot[]>([])
  const [evRows, setEvRows] = useState<EvSnapshot[]>([])
  const [whales, setWhales] = useState<WhaleSnapshot[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const load = async () => {
      try {
        const [walletRes, sharpRes, evRes, whaleRes] = await Promise.all([
          fetch('/api/polymarket/wallets/profitable?days=30&minTrades=20&minProfit=1000&maxWallets=8', {
            cache: 'no-store',
          }),
          fetch('/api/lines/sharp-moves?limit=120', {
            cache: 'no-store',
          }),
          fetch(
            '/api/ev-opportunities?minEV=2.5&limit=8&sports=basketball_nba,americanfootball_nfl,baseball_mlb,icehockey_nhl&betTypes=h2h,spreads,totals',
            { cache: 'no-store' }
          ),
          fetch('/api/whale-trades-daily?limit=20&minNotional=2000', {
            cache: 'no-store',
          }),
        ])

        const [
          walletPayload,
          sharpPayload,
          evPayload,
          whalePayload,
        ] = await Promise.all([
          walletRes.ok ? walletRes.json() : Promise.resolve({}),
          sharpRes.ok ? sharpRes.json() : Promise.resolve({}),
          evRes.ok ? evRes.json() : Promise.resolve({}),
          whaleRes.ok ? whaleRes.json() : Promise.resolve({}),
        ])

        const walletRows = Array.isArray(walletPayload?.wallets)
          ? (walletPayload.wallets as Array<Record<string, unknown>>)
          : []

        const nextWallets = walletRows
          .map((wallet) => ({
            wallet: String(wallet.wallet ?? ''),
            total_realized_pnl: Number(wallet.total_realized_pnl ?? 0),
            pnl_30d: Number(wallet.pnl_30d ?? 0),
          }))
          .filter((wallet) => wallet.wallet)
          .sort((a, b) => b.total_realized_pnl - a.total_realized_pnl)
          .slice(0, 5)

        const groupedMoves = Array.isArray(sharpPayload?.grouped)
          ? (sharpPayload.grouped as Array<Record<string, unknown>>)
          : []

        const hotMap = new Map<
          string,
          { game: string; sport: string; moveCount: number; markets: Set<string> }
        >()

        groupedMoves.forEach((row) => {
          const game = String(row.game ?? '').trim()
          if (!game) return

          const sport = String(row.sport ?? 'Sports')
          const market = String(row.marketType ?? 'market')
          const bookRows = Array.isArray(row.bookmakers)
            ? (row.bookmakers as Array<Record<string, unknown>>)
            : []
          const moveCount = Math.max(1, bookRows.length)

          const existing = hotMap.get(game)
          if (existing) {
            existing.moveCount += moveCount
            existing.markets.add(market)
            return
          }

          hotMap.set(game, {
            game,
            sport,
            moveCount,
            markets: new Set([market]),
          })
        })

        const nextHotGames = Array.from(hotMap.values())
          .map((entry) => ({
            game: entry.game,
            sport: entry.sport,
            moveCount: entry.moveCount,
            marketCount: entry.markets.size,
          }))
          .sort((a, b) => b.moveCount - a.moveCount)
          .slice(0, 5)

        const evOpportunities = Array.isArray(evPayload?.data)
          ? (evPayload.data as Array<Record<string, unknown>>)
          : []

        const nextEvRows = evOpportunities
          .map((row) => ({
            game: String(row.game ?? 'Game'),
            selection: String(row.selection ?? 'Selection'),
            bestBook: String(row.bestBook ?? 'book'),
            bestOdds: Number(row.bestOdds ?? 0),
            ev: Number(row.ev ?? 0),
          }))
          .filter((row) => Number.isFinite(row.ev))
          .sort((a, b) => b.ev - a.ev)
          .slice(0, 5)

        const whaleTrades = Array.isArray(whalePayload?.trades)
          ? (whalePayload.trades as Array<Record<string, unknown>>)
          : []

        const nextWhales = whaleTrades
          .map((trade) => ({
            id: String(trade.id ?? `${trade.timestamp ?? ''}-${trade.marketTitle ?? ''}`),
            sport: String(trade.sport ?? 'Sports'),
            outcome: String(trade.outcome ?? trade.marketTitle ?? 'Market'),
            notional: Number(trade.notional ?? 0),
            americanOdds:
              trade.americanOdds == null ? null : Number(trade.americanOdds),
            timestamp: String(trade.timestamp ?? ''),
          }))
          .filter((trade) => trade.id)
          .sort((a, b) => {
            const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0
            const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0
            return bTime - aTime
          })
          .slice(0, 5)
          .map(({ id, sport, outcome, notional, americanOdds }) => ({
            id,
            sport,
            outcome,
            notional,
            americanOdds,
          }))

        if (!active) return
        setWallets(nextWallets)
        setHotGames(nextHotGames)
        setEvRows(nextEvRows)
        setWhales(nextWhales)
      } catch (error) {
        console.warn('Chat home dashboard load failed:', error)
      } finally {
        if (active) setLoading(false)
      }
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const firstName = useMemo(() => toFirstName(welcomeName), [welcomeName])

  return (
    <div className="h-full overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4 pb-8">
        <section className="rounded-3xl border border-cyan-300/30 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.24),_transparent_45%),radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.2),_transparent_48%),linear-gradient(135deg,_rgba(2,6,23,0.95),_rgba(0,0,0,0.98))] p-5 sm:p-7">
          <p className="text-[11px] uppercase tracking-[0.28em] text-cyan-200/85">
            Delta Home
          </p>
          <h1 className="mt-3 text-4xl font-black leading-none text-white sm:text-5xl lg:text-6xl">
            Welcome {firstName}
          </h1>
          <p className="mt-3 max-w-3xl text-sm text-white/70 sm:text-base">
            Sharp boards are live. Track profitable wallets, grouped hot games, edge
            opportunities, and sharp money tape from one screen.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Wallets</p>
              <p className="mt-1 text-lg font-semibold text-white">{wallets.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Hot Games</p>
              <p className="mt-1 text-lg font-semibold text-white">{hotGames.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">EV Spots</p>
              <p className="mt-1 text-lg font-semibold text-white">{evRows.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">Sharp Hits</p>
              <p className="mt-1 text-lg font-semibold text-white">{whales.length || 0}</p>
            </div>
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-12">
          <section className="xl:col-span-5 rounded-2xl border border-emerald-300/25 bg-[#04131a] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Sharp Wallet P/L
                </h2>
              </div>
              <Link href="/sharp-detector" className="text-emerald-200/80 hover:text-emerald-100">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : wallets).map((wallet) => (
                <div key={wallet.wallet} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-white">{shortWallet(wallet.wallet)}</p>
                    <p className="text-sm font-semibold text-emerald-300">
                      {formatCurrency(wallet.total_realized_pnl)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.18em] text-white/55">
                    30D {formatCurrency(wallet.pnl_30d)}
                  </p>
                </div>
              ))}
              {!loading && wallets.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/65">
                  Wallet rollups are still warming up.
                </p>
              )}
            </div>
          </section>

          <section className="xl:col-span-7 rounded-2xl border border-cyan-300/20 bg-[#030f1a] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-cyan-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-100">
                  Hot Games (Grouped)
                </h2>
              </div>
              <Link href="/market-projections" className="text-cyan-200/80 hover:text-cyan-100">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : hotGames).map((game) => (
                <div key={game.game} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{game.game}</p>
                    <p className="rounded-full border border-cyan-300/40 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-cyan-200">
                      {game.moveCount} moves
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-white/60">
                    {game.sport} - {game.marketCount} markets moving together
                  </p>
                </div>
              ))}
              {!loading && hotGames.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/65">
                  No grouped sharp moves yet for this window.
                </p>
              )}
            </div>
          </section>

          <section className="xl:col-span-7 rounded-2xl border border-emerald-300/20 bg-[#07140e] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-100">
                  Best EV Right Now
                </h2>
              </div>
              <Link href="/market-projections" className="text-emerald-200/80 hover:text-emerald-100">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : evRows).map((row) => (
                <div key={`${row.game}-${row.selection}-${row.bestBook}`} className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{row.selection}</p>
                    <p className="text-sm font-semibold text-emerald-300">+{row.ev.toFixed(1)}%</p>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-white/60">
                    {row.game} - {row.bestBook} {formatOdds(row.bestOdds)}
                  </p>
                </div>
              ))}
              {!loading && evRows.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/65">
                  EV board is syncing. Check back in a minute.
                </p>
              )}
            </div>
          </section>

          <section className="xl:col-span-5 rounded-2xl border border-sky-300/20 bg-[#041118] p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Waves className="h-4 w-4 text-sky-300" />
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-100">
                  Whale Tape
                </h2>
              </div>
              <Link href="/sharp-detector" className="text-sky-200/80 hover:text-sky-100">
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {(loading ? [] : whales).map((trade) => (
                <div key={trade.id} className="rounded-xl border border-white/10 bg-black/35 px-3 py-2.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold text-white">{trade.outcome}</p>
                    <p className="text-sm font-semibold text-sky-200">
                      {formatCurrency(trade.notional)}
                    </p>
                  </div>
                  <p className="mt-1 text-[11px] text-white/60">
                    {trade.sport} - {formatOdds(trade.americanOdds)}
                  </p>
                </div>
              ))}
              {!loading && whales.length === 0 && (
                <p className="rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-xs text-white/65">
                  No sharp money prints in the current feed.
                </p>
              )}
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-white/10 bg-black/35 p-4">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/55">
            Quick Access
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Link href="/calculators" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:border-cyan-300/35 hover:text-white">
              <Calculator className="h-4 w-4 text-cyan-300" />
              Calculators
            </Link>
            <Link href="/docs" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:border-cyan-300/35 hover:text-white">
              <BookOpen className="h-4 w-4 text-cyan-300" />
              Guides
            </Link>
            <Link href="/socials" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:border-cyan-300/35 hover:text-white">
              <Share2 className="h-4 w-4 text-cyan-300" />
              Socials
            </Link>
            <Link href="/blog" className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/85 transition hover:border-cyan-300/35 hover:text-white">
              <Newspaper className="h-4 w-4 text-cyan-300" />
              Blog
            </Link>
          </div>
        </section>
      </div>
    </div>
  )
}
