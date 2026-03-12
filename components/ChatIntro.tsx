'use client'

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { GuestHero } from '@/components/ui/guest-hero'
import StatsSection from '@/components/ui/call-to-action'
import { ROICalculator } from '@/components/ui/roi-calculator'
import { FeaturesSix } from '@/components/ui/features-6'
import SectionWithMockup from '@/components/ui/section-with-mockup'

type DeltaMode = 'projections' | 'research'

interface ChatIntroProps {
  conversationId: string
  userId: string
  onMessageSent: () => void
  isGuest?: boolean
  onSignUpClick?: () => void
  prefillMessage?: string
  mode?: DeltaMode
  onModeChange?: (mode: DeltaMode) => void
}

type ToolCardId =
  | 'sharp-projections'
  | 'sharp-props'
  | 'whale-feed'
  | 'research'

type ToolCard = {
  id: ToolCardId
  title: string
  href: string
  subtitle: string
}

const HOME_FAVORITES_STORAGE_KEY = 'delta_home_tool_favorites_v1'

const TOOL_CARDS: ToolCard[] = [
  {
    id: 'sharp-projections',
    title: 'Sharp Projections',
    href: '/market-projections',
    subtitle: 'Top spread, moneyline, and total edges',
  },
  {
    id: 'sharp-props',
    title: 'Sharp Props',
    href: '/sharp-props',
    subtitle: 'Live orderbook walls and sharp lean direction',
  },
  {
    id: 'whale-feed',
    title: 'Whale Detector',
    href: '/sharp-detector',
    subtitle: 'Large-ticket flow with timing and cluster context',
  },
  {
    id: 'research',
    title: 'Research',
    href: '/research/sharp-action',
    subtitle: 'Game-level sharp signals and movement notes',
  },
]

const FALLBACK_PREVIEWS: Record<ToolCardId, string[]> = {
  'sharp-projections': [
    'Scanning top spread edges...',
    'Scanning top moneyline edges...',
    'Scanning top total edges...',
  ],
  'sharp-props': [
    'Scanning largest prop orderbook walls...',
    'Scanning sharp over/under lean...',
    'Scanning best orderbook prices...',
  ],
  'whale-feed': [
    'Loading latest whale tickets...',
    'Loading largest notional bets...',
    'Loading sharp market movement...',
  ],
  research: [
    'Loading top game narratives...',
    'Loading sharp signal summaries...',
    'Loading line movement context...',
  ],
}

export default function ChatIntro({
  isGuest = false,
  onSignUpClick,
}: ChatIntroProps) {
  const [favoriteOrder, setFavoriteOrder] = useState<ToolCardId[]>([])
  const [toolPreviews, setToolPreviews] =
    useState<Record<ToolCardId, string[]>>(FALLBACK_PREVIEWS)

  const formatSignedNumber = (value?: number | null, digits = 1) => {
    if (value == null || !Number.isFinite(value)) return 'n/a'
    const rounded = Number(value).toFixed(digits)
    return value >= 0 ? `+${rounded}` : rounded
  }

  const formatOdds = (value?: number | null) => {
    if (value == null || !Number.isFinite(value)) return 'n/a'
    const rounded = Math.round(value)
    return rounded > 0 ? `+${rounded}` : `${rounded}`
  }

  const formatMarket = (value?: string | null) => {
    const cleaned = String(value ?? '')
      .replace(/^player_/, '')
      .replace(/_/g, ' ')
      .trim()
    if (!cleaned) return 'Prop'
    return cleaned.replace(/\b\w/g, (char) => char.toUpperCase())
  }

  useEffect(() => {
    if (isGuest || typeof window === 'undefined') return
    try {
      const cached = window.localStorage.getItem(HOME_FAVORITES_STORAGE_KEY)
      if (!cached) return
      const parsed = JSON.parse(cached)
      if (!Array.isArray(parsed)) return
      const filtered = parsed.filter((id): id is ToolCardId =>
        TOOL_CARDS.some((card) => card.id === id)
      )
      setFavoriteOrder(filtered)
    } catch {
      setFavoriteOrder([])
    }
  }, [isGuest])

  useEffect(() => {
    if (isGuest || typeof window === 'undefined') return
    window.localStorage.setItem(
      HOME_FAVORITES_STORAGE_KEY,
      JSON.stringify(favoriteOrder)
    )
  }, [favoriteOrder, isGuest])

  useEffect(() => {
    if (isGuest) return
    let active = true

    const pickTopThree = (lines: string[]) =>
      Array.from(
        new Set(
          lines
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        )
      ).slice(0, 3)

    const loadPreviews = async () => {
      try {
        const [marketRes, propsRes, whalesRes] = await Promise.all([
          fetch('/api/market-projections?sport=basketball_nba&include=1&limit=120', {
            cache: 'no-store',
          }),
          fetch('/api/prop-orderbooks?sport=basketball_nba&limit=40&depth=8&minSharpNotional=100', {
            cache: 'no-store',
          }),
          fetch('/api/whale-trades-daily?limit=12&minNotional=2000', {
            cache: 'no-store',
          }),
        ])

        const nextPreviews: Partial<Record<ToolCardId, string[]>> = {}

        if (marketRes.ok) {
          const payload = await marketRes.json()
          const edges = Array.isArray(payload?.edges)
            ? (payload.edges as Array<Record<string, any>>)
            : []

          const projectionLines = pickTopThree(
            edges.map((edge) => {
              const away = edge?.awayTeam ?? 'Away'
              const home = edge?.homeTeam ?? 'Home'
              const matchup = `${away} @ ${home}`
              if (edge?.spread?.favoredTeam) {
                const edgePct = formatSignedNumber(edge?.spread?.edgePercent, 1)
                return `${matchup} - ${edge.spread.favoredTeam} spread (${edgePct}%)`
              }
              if (edge?.total?.targetLine != null) {
                const edgePct = formatSignedNumber(edge?.total?.edgePercent, 1)
                return `${matchup} - Total ${edge.total.targetLine} (${edgePct}%)`
              }
              if (edge?.moneyline?.projection?.side) {
                const edgePct = formatSignedNumber(
                  edge?.moneyline?.projection?.edgePercent,
                  1
                )
                return `${matchup} - ${edge.moneyline.projection.side} ML (${edgePct}%)`
              }
              return ''
            })
          )

          const researchLines = pickTopThree(
            edges.map((edge) => {
              const away = edge?.awayTeam ?? 'Away'
              const home = edge?.homeTeam ?? 'Home'
              const matchup = `${away} @ ${home}`
              const strongestSignal = Array.isArray(edge?.sharpSignals)
                ? edge.sharpSignals.reduce(
                    (best: any, signal: any) =>
                      !best || (signal?.strength ?? 0) > (best?.strength ?? 0)
                        ? signal
                        : best,
                    null
                  )
                : null
              if (strongestSignal?.type) {
                return `${matchup} - ${String(strongestSignal.type).toUpperCase()} signal (${strongestSignal.strength ?? 0}/5)`
              }
              if (Array.isArray(edge?.lineMovements) && edge.lineMovements[0]) {
                const move = edge.lineMovements[0]
                return `${matchup} - ${move.market ?? 'Line'} moved ${move.openingLine ?? 'n/a'} to ${move.currentLine ?? 'n/a'}`
              }
              return `${matchup} - Research update available`
            })
          )

          if (projectionLines.length) {
            nextPreviews['sharp-projections'] = projectionLines
          }
          if (researchLines.length) {
            nextPreviews.research = researchLines
          }
        }

        if (propsRes.ok) {
          const payload = await propsRes.json()
          const rows = Array.isArray(payload?.items)
            ? (payload.items as Array<Record<string, any>>)
            : []
          const propLines = pickTopThree(
            rows.map((row) => {
              const leanSide = String(row?.sharpLeanSide ?? '').toUpperCase() || 'LEAN'
              const oddsValue =
                row?.pinnacleLeanOdds ??
                row?.sharpLeanBestOdds ??
                row?.sharpLeanAmericanOdds ??
                row?.sharpOrderAmericanOdds
              const leanOdds = formatOdds(oddsValue)
              const player = row?.playerName ?? 'Player'
              const propType = formatMarket(row?.propType)
              const line = row?.propLine != null ? ` ${row.propLine}` : ''
              return `${player} - ${propType}${line} ${leanSide} (${leanOdds})`
            })
          )
          if (propLines.length) {
            nextPreviews['sharp-props'] = propLines
          }
        }

        if (whalesRes.ok) {
          const payload = await whalesRes.json()
          const trades = Array.isArray(payload?.trades)
            ? (payload.trades as Array<Record<string, any>>)
            : []
          const whaleLines = pickTopThree(
            trades.map((trade) => {
              const notional =
                trade?.notional != null && Number.isFinite(Number(trade.notional))
                  ? `$${Math.round(Number(trade.notional)).toLocaleString('en-US')}`
                  : '$--'
              return `${trade?.sport ?? 'Sports'} - ${notional} on ${trade?.outcome ?? 'market'} (${formatOdds(trade?.americanOdds)})`
            })
          )
          if (whaleLines.length) {
            nextPreviews['whale-feed'] = whaleLines
          }
        }

        if (active && Object.keys(nextPreviews).length > 0) {
          setToolPreviews((prev) => ({ ...prev, ...nextPreviews }))
        }
      } catch {
        return
      }
    }

    void loadPreviews()

    return () => {
      active = false
    }
  }, [isGuest])

  const orderedCards = useMemo(() => {
    if (!favoriteOrder.length) return TOOL_CARDS
    const favoritesRank = new Map(
      favoriteOrder.map((id, index) => [id, index])
    )
    return [...TOOL_CARDS].sort((a, b) => {
      const aRank = favoritesRank.get(a.id)
      const bRank = favoritesRank.get(b.id)
      if (aRank != null && bRank != null) return aRank - bRank
      if (aRank != null) return -1
      if (bRank != null) return 1
      return (
        TOOL_CARDS.findIndex((card) => card.id === a.id) -
        TOOL_CARDS.findIndex((card) => card.id === b.id)
      )
    })
  }, [favoriteOrder])

  const toggleFavorite = (id: ToolCardId) => {
    setFavoriteOrder((prev) => {
      if (prev.includes(id)) return prev.filter((entry) => entry !== id)
      return [id, ...prev.filter((entry) => entry !== id)]
    })
  }

  const renderToolCard = (card: ToolCard) => {
    const isFavorite = favoriteOrder.includes(card.id)
    const previewLines = toolPreviews[card.id] ?? FALLBACK_PREVIEWS[card.id]
    return (
      <article key={card.id} className="relative h-full min-h-0">
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            toggleFavorite(card.id)
          }}
          aria-label={isFavorite ? `Unfavorite ${card.title}` : `Favorite ${card.title}`}
          className={`absolute right-3 top-3 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
            isFavorite
              ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-200'
              : 'border-white/15 bg-black/50 text-white/55 hover:border-emerald-400/50 hover:text-emerald-200'
          }`}
        >
          <Star className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
        </button>

        <Link
          href={card.href}
          className="group flex h-full min-h-0 flex-col rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 via-black to-black p-3 sm:p-4 transition-colors hover:border-emerald-400/60"
        >
          <div className="pr-10">
            <h3 className="text-lg font-extrabold leading-tight text-emerald-100 drop-shadow-[0_0_18px_rgba(16,185,129,0.22)] sm:text-xl">
              {card.title}
            </h3>
            <p className="mt-1 text-xs text-white/55 sm:text-sm">{card.subtitle}</p>
          </div>

          <div className="mt-3 space-y-1.5 overflow-hidden">
            {previewLines.slice(0, 3).map((line) => (
              <div
                key={`${card.id}-${line}`}
                className="truncate rounded-lg border border-white/10 bg-black/45 px-3 py-2 text-[11px] text-white/80"
              >
                {line}
              </div>
            ))}
          </div>

          <span className="mt-auto pt-3 text-[10px] uppercase tracking-[0.22em] text-emerald-300/80">
            Open tool
          </span>
        </Link>
      </article>
    )
  }
  const guestFaq = [
    {
      question: 'What is Delta?',
      answer:
        'Delta is an AI sports betting assistant that compares markets, surfaces value, and explains edges.',
    },
    {
      question: 'Do I need to connect a sportsbook?',
      answer:
        'No. You can compare odds and run analysis without linking any sportsbook accounts.',
    },
    {
      question: 'Which sports are supported?',
      answer:
        'NBA, NFL, NCAAB, CFB, and NHL are supported today, with more on the way.',
    },
    {
      question: 'How does free membership work?',
      answer:
        'Create an account to access the free tier. Upgrade anytime for full projections and research.',
    },
  ]

  // Guest layout
  if (isGuest) {
    return (
      <div className="flex flex-col items-center justify-center min-h-full bg-transparent px-3 sm:px-4 py-6 sm:py-8">
        <div className="max-w-3xl w-full space-y-8">
          {/* Guest Hero */}
          <GuestHero onSignUpClick={onSignUpClick || (() => {})} />

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="w-full mt-16 lg:mt-20"
          >
            <StatsSection />
          </motion.div>

          {/* Feature Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.5 }}
            className="w-full"
          >
            <FeaturesSix
              title="Sharp Projections that update in real time"
              description="Stay synced to live market movement while your projections update for games, players, and parlays."
              imageSrc="/Screenshot 2026-01-11 170628.png"
              imageAlt="Sharp projections overview"
            />
            <FeaturesSix
              title="Research mode for sharper decisions"
              description="Understand why lines move, summarize sharp action, and build a stronger read before you bet."
              imageSrc="/Screenshot 2026-01-27 134108.png"
              imageAlt="Research mode sharp money overview"
            />
            <SectionWithMockup
              title={
                <>
                  Whale Detector
                  <br />
                  built on real money.
                </>
              }
              description={
                <>
                  We track big bets on peer-to-peer exchanges and compare them
                  <br />
                  to sportsbook lines, showing how sharp a bet really is.
                </>
              }
              primaryImageSrc="/Screenshot 2026-01-11 165623.png"
              secondaryImageSrc="/Screenshot 2026-01-11 161550.png"
            />
          </motion.div>

          {/* ROI Calculator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <ROICalculator />
            <div className="mt-5 w-full max-w-2xl mx-auto flex justify-center">
              <Link
                href="/checkout"
                className="inline-flex items-center gap-4 rounded-full bg-emerald-400 px-6 py-3 text-xs sm:text-sm font-semibold uppercase tracking-[0.3em] text-black shadow-[0_16px_40px_rgba(16,185,129,0.35)] hover:bg-emerald-300 transition-colors"
              >
                <span>Start your free trial</span>
                <span className="rounded-full border border-black/60 px-3 py-1 text-[10px] font-semibold text-black/80">
                  7-Day Free Trial
                </span>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                  FAQ
                </p>
                <span className="text-[11px] text-white/40">Basics</span>
              </div>
              <div className="space-y-3">
                {guestFaq.map((item) => (
                  <details
                    key={item.question}
                    className="group rounded-2xl border border-white/10 bg-black/40 px-4 py-3 open:border-emerald-400/30 open:bg-black/60"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold text-white">
                      <span>{item.question}</span>
                      <span className="text-xs text-white/50 transition group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-xs text-white/60">{item.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full bg-black">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative h-full w-full p-2 sm:p-3"
      >
        <div className="grid h-full grid-cols-2 gap-3 overflow-y-auto">
          {orderedCards.slice(0, 4).map((card) => renderToolCard(card))}
        </div>
      </motion.div>
    </div>
  )
}

