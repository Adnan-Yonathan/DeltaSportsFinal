import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import { SimpleHeader } from '@/components/ui/simple-header'
import { BlogNavButtons } from '@/components/blog/BlogNavButtons'
import {
  buildSlatePath,
  findEdgeForSlug,
  getSportLabel,
  resolveSportParam,
} from '@/lib/blog/market-projections'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type PageParams = {
  sport: string
  date: string
  slug: string
}

type MarketLineSummary = {
  spread?: { line: number; homeOdds?: number; awayOdds?: number; book?: string }
  total?: { line: number; overOdds?: number; underOdds?: number; book?: string }
  moneyline?: { homeOdds?: number; awayOdds?: number; book?: string }
}

const parseSlugTeams = (slug: string) => {
  const trimmed = slug.replace(/-betting-breakdown$/, '')
  const parts = trimmed.split('-vs-')
  if (parts.length !== 2) return { away: null, home: null }
  const toName = (value: string) =>
    value
      .split('-')
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ')
  return { away: toName(parts[0]), home: toName(parts[1]) }
}

const formatOdds = (value?: number | null) => {
  if (value == null || !Number.isFinite(value)) return '—'
  return value > 0 ? `+${value}` : `${value}`
}

const formatLine = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? '—' : value.toFixed(1)

const formatPct = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(1)}%`

const formatTime = (value?: string | null) => {
  if (!value) return 'TBD'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return 'TBD'
  return parsed.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const formatStatValue = (value: unknown) =>
  isNumber(value) ? value.toFixed(1) : '—'

const buildTeamStatsLine = (stats: GameEdgeAnalysis['homeStats']) => {
  if (!stats) return 'Team stats missing.'
  if ('ortg' in stats || 'drtg' in stats || 'pace' in stats) {
    const ortg = 'ortg' in stats ? formatStatValue((stats as any).ortg) : '—'
    const drtg = 'drtg' in stats ? formatStatValue((stats as any).drtg) : '—'
    const pace = 'pace' in stats ? formatStatValue((stats as any).pace) : '—'
    return `ORtg ${ortg} • DRtg ${drtg} • Pace ${pace}`
  }
  if (
    'pointsForPerGame' in stats ||
    'pointsAgainstPerGame' in stats ||
    'yardsPerPlay' in stats
  ) {
    const ppg = 'pointsForPerGame' in stats ? formatStatValue((stats as any).pointsForPerGame) : '—'
    const papg = 'pointsAgainstPerGame' in stats ? formatStatValue((stats as any).pointsAgainstPerGame) : '—'
    const ypp = 'yardsPerPlay' in stats ? formatStatValue((stats as any).yardsPerPlay) : '—'
    return `Points ${ppg} • Allowed ${papg} • Yards/Play ${ypp}`
  }
  if ('goalsForPerGame' in stats || 'goalsAgainstPerGame' in stats || 'shotsForPerGame' in stats) {
    const gpg = 'goalsForPerGame' in stats ? formatStatValue((stats as any).goalsForPerGame) : '—'
    const gapg = 'goalsAgainstPerGame' in stats ? formatStatValue((stats as any).goalsAgainstPerGame) : '—'
    const shots = 'shotsForPerGame' in stats ? formatStatValue((stats as any).shotsForPerGame) : '—'
    return `Goals ${gpg} • Allowed ${gapg} • Shots ${shots}`
  }
  return 'Team stats missing.'
}

const getMoneylineFavorite = (edge: GameEdgeAnalysis, summary: MarketLineSummary) => {
  if (edge?.moneyline?.prediction?.homeOdds != null || edge?.moneyline?.prediction?.awayOdds != null) {
    const home = edge.moneyline.prediction?.homeOdds
    const away = edge.moneyline.prediction?.awayOdds
    if (isNumber(home) && isNumber(away)) {
      return home <= away ? edge.homeTeam : edge.awayTeam
    }
  }
  const home = summary.moneyline?.homeOdds
  const away = summary.moneyline?.awayOdds
  if (isNumber(home) && isNumber(away)) {
    return home <= away ? edge.homeTeam : edge.awayTeam
  }
  return null
}

const buildBestLines = (edge: GameEdgeAnalysis, lines: any[]): MarketLineSummary => {
  if (edge?.spread?.marketLine != null && edge?.spread?.bestBook) {
    return {
      spread: {
        line: edge.spread.marketLine,
        homeOdds: edge.spread.bestHomeOdds ?? edge.spread.bestOdds,
        awayOdds: edge.spread.bestAwayOdds,
        book: edge.spread.bestBook,
      },
      total: edge.total?.marketLine != null
        ? {
            line: edge.total.marketLine,
            overOdds: edge.total.bestOdds,
            underOdds: edge.total.bestUnderOdds,
            book: edge.total.bestBook,
          }
        : undefined,
      moneyline: edge.moneyline?.sportsbook
        ? {
            homeOdds: edge.moneyline.sportsbook.homeOdds,
            awayOdds: edge.moneyline.sportsbook.awayOdds,
            book: edge.moneyline.sportsbook.homeBook || edge.moneyline.sportsbook.awayBook,
          }
        : undefined,
    }
  }

  const summary: MarketLineSummary = {}
  for (const row of lines) {
    if (row.market_type === 'spread' && isNumber(row.spread_home)) {
      const betterHome =
        !summary.spread ||
        (isNumber(row.spread_home_odds) &&
          (summary.spread.homeOdds == null || row.spread_home_odds > summary.spread.homeOdds))
      const betterAway =
        !summary.spread ||
        (isNumber(row.spread_away_odds) &&
          (summary.spread.awayOdds == null || row.spread_away_odds > summary.spread.awayOdds))
      if (!summary.spread) {
        summary.spread = { line: row.spread_home, book: row.bookmaker }
      }
      if (betterHome) {
        summary.spread.line = row.spread_home
        summary.spread.homeOdds = row.spread_home_odds
        summary.spread.book = row.bookmaker
      }
      if (betterAway) {
        summary.spread.awayOdds = row.spread_away_odds
      }
    }

    if (row.market_type === 'total' && isNumber(row.total_line)) {
      const betterOver =
        !summary.total ||
        (isNumber(row.total_over_odds) &&
          (summary.total.overOdds == null || row.total_over_odds > summary.total.overOdds))
      const betterUnder =
        !summary.total ||
        (isNumber(row.total_under_odds) &&
          (summary.total.underOdds == null || row.total_under_odds > summary.total.underOdds))
      if (!summary.total) {
        summary.total = { line: row.total_line, book: row.bookmaker }
      }
      if (betterOver) {
        summary.total.line = row.total_line
        summary.total.overOdds = row.total_over_odds
        summary.total.book = row.bookmaker
      }
      if (betterUnder) {
        summary.total.underOdds = row.total_under_odds
      }
    }

    if (row.market_type === 'moneyline') {
      const betterHome =
        isNumber(row.moneyline_home) &&
        (!summary.moneyline?.homeOdds || row.moneyline_home > summary.moneyline.homeOdds)
      const betterAway =
        isNumber(row.moneyline_away) &&
        (!summary.moneyline?.awayOdds || row.moneyline_away > summary.moneyline.awayOdds)
      if (!summary.moneyline) {
        summary.moneyline = { book: row.bookmaker }
      }
      if (betterHome) {
        summary.moneyline.homeOdds = row.moneyline_home
        summary.moneyline.book = row.bookmaker
      }
      if (betterAway) {
        summary.moneyline.awayOdds = row.moneyline_away
      }
    }
  }

  return summary
}

const buildLineMovementSummary = (lines: any[]) => {
  const byMarket: Record<string, { first?: any; last?: any }> = {}
  for (const row of lines) {
    const key = row.market_type
    if (!byMarket[key]) {
      byMarket[key] = { first: row, last: row }
      continue
    }
    if (new Date(row.recorded_at) < new Date(byMarket[key].first?.recorded_at)) {
      byMarket[key].first = row
    }
    if (new Date(row.recorded_at) > new Date(byMarket[key].last?.recorded_at)) {
      byMarket[key].last = row
    }
  }

  const summaries: string[] = []
  const spread = byMarket.spread
  if (spread?.first && spread?.last && isNumber(spread.first.spread_home) && isNumber(spread.last.spread_home)) {
    summaries.push(
      `Spread moved from ${formatLine(spread.first.spread_home)} to ${formatLine(spread.last.spread_home)}`
    )
  }
  const total = byMarket.total
  if (total?.first && total?.last && isNumber(total.first.total_line) && isNumber(total.last.total_line)) {
    summaries.push(
      `Total moved from ${formatLine(total.first.total_line)} to ${formatLine(total.last.total_line)}`
    )
  }
  const ml = byMarket.moneyline
  if (ml?.first && ml?.last && isNumber(ml.first.moneyline_home) && isNumber(ml.last.moneyline_home)) {
    summaries.push(
      `Moneyline moved from ${formatOdds(ml.first.moneyline_home)} to ${formatOdds(ml.last.moneyline_home)}`
    )
  }
  return summaries
}

async function loadEdgeData(params: PageParams) {
  const sport = resolveSportParam(params.sport)
  const supabase = createServiceClient()
  const { data, error } = (await supabase
    .from('market_projections_cache' as any)
    .select('edges, updated_at')
    .eq('sport', sport)
    .single()) as unknown as { data: { edges: GameEdgeAnalysis[]; updated_at: string } | null; error: any }

  if (error || !data) return { edge: null, updatedAt: null }
  const edge = findEdgeForSlug(data.edges ?? [], params.slug, params.date)
  return { edge, updatedAt: data.updated_at }
}

export async function generateMetadata(
  { params }: { params: PageParams }
): Promise<Metadata> {
  const { edge } = await loadEdgeData(params)
  const sportLabel = getSportLabel(params.sport)
  const fallback = parseSlugTeams(params.slug)
  const away = edge?.awayTeam || fallback.away || 'Away'
  const home = edge?.homeTeam || fallback.home || 'Home'
  const dateLabel = params.date
  const title = `${away} vs ${home} betting breakdown (sharp money, best lines) – ${dateLabel}`
  const description = `Full betting breakdown for ${away} vs ${home}. Lines, movement, splits, and sharp/public signals for the ${sportLabel} slate on ${dateLabel}.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
    },
    twitter: {
      title,
      description,
    },
  }
}

export default async function BlogGamePage({
  params,
}: {
  params: PageParams
}) {
  const { edge, updatedAt } = await loadEdgeData(params)
  if (!edge) notFound()

  const sportLabel = getSportLabel(params.sport)
  const commenceTime = edge.commenceTime
  const oddsApiId = edge.oddsApiId
  const supabase = createServiceClient()

  const lines = oddsApiId
    ? (await supabase
        .from('lines')
        .select('*')
        .eq('odds_api_id', oddsApiId)
        .eq('line_type', 'current')
        .order('recorded_at', { ascending: false })
        .limit(200)).data || []
    : []

  const splits = oddsApiId
    ? (await supabase
        .from('latest_betting_splits')
        .select('*')
        .eq('game_id', oddsApiId)).data || []
    : []

  const bestLines = buildBestLines(edge, lines)
  const lineMovements = buildLineMovementSummary(lines)
  const splitByMarket = splits.reduce((acc: Record<string, any>, row: any) => {
    acc[row.market_type] = row
    return acc
  }, {})
  const moneylineFavorite = getMoneylineFavorite(edge, bestLines)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `${edge.awayTeam} vs ${edge.homeTeam} betting breakdown`,
    datePublished: updatedAt ?? new Date().toISOString(),
    dateModified: updatedAt ?? new Date().toISOString(),
    author: {
      '@type': 'Organization',
      name: 'Delta Sports',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://deltasports.app/blog/${params.sport}/${params.date}/${params.slug}`,
    },
    about: {
      '@type': 'SportsEvent',
      name: `${edge.awayTeam} vs ${edge.homeTeam}`,
      startDate: commenceTime ?? undefined,
      sport: sportLabel,
    },
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <SimpleHeader widthClass="max-w-6xl" />
      <div className="px-4 sm:px-6 lg:px-10 pt-24 pb-10 max-w-5xl mx-auto space-y-10">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">
            {sportLabel} Betting Breakdown
          </p>
          <h1 className="text-3xl sm:text-4xl font-semibold">
            {edge.awayTeam} vs {edge.homeTeam}
          </h1>
          <p className="text-sm text-white/70">
            Game time: {formatTime(commenceTime)} • Updated {formatTime(updatedAt)}
          </p>
          <div className="flex flex-wrap gap-3 text-xs text-white/70">
            <BlogNavButtons />
            <Link className="text-white/70 hover:text-emerald-200" href="/blog">
              Back to blog
            </Link>
            <Link className="text-white/70 hover:text-emerald-200" href="/">
              Home
            </Link>
            <Link className="text-emerald-400 hover:text-emerald-300" href={buildSlatePath(params.sport, params.date)}>
              View full {sportLabel} slate
            </Link>
          </div>
        </header>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Best lines right now</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-white/50">Spread</p>
              {bestLines.spread ? (
                <>
                  <p className="text-lg font-semibold">
                    {formatLine(bestLines.spread.line)} ({formatOdds(bestLines.spread.homeOdds)})
                  </p>
                  <p className="text-xs text-white/60">
                    Favorite: {edge.spread?.favoredTeam || '—'}
                  </p>
                  <p className="text-xs text-white/60">Best at {bestLines.spread.book || '—'}</p>
                </>
              ) : (
                <p className="text-sm text-white/60">Spread line missing.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-white/50">Total</p>
              {bestLines.total ? (
                <>
                  <p className="text-lg font-semibold">
                    {formatLine(bestLines.total.line)} (O {formatOdds(bestLines.total.overOdds)} / U {formatOdds(bestLines.total.underOdds)})
                  </p>
                  <p className="text-xs text-white/60">Best at {bestLines.total.book || '—'}</p>
                </>
              ) : (
                <p className="text-sm text-white/60">Total line missing.</p>
              )}
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-white/50">Moneyline</p>
              {bestLines.moneyline ? (
                <>
                  <p className="text-lg font-semibold">
                    {formatOdds(bestLines.moneyline.awayOdds)} / {formatOdds(bestLines.moneyline.homeOdds)}
                  </p>
                  <p className="text-xs text-white/60">
                    Favorite: {moneylineFavorite || '—'}
                  </p>
                  <p className="text-xs text-white/60">Best at {bestLines.moneyline.book || '—'}</p>
                </>
              ) : (
                <p className="text-sm text-white/60">Moneyline data missing.</p>
              )}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Betting splits</h2>
          {splits.length ? (
            <div className="grid gap-4 sm:grid-cols-3">
              {(['spread', 'total', 'moneyline'] as const).map((market) => {
                const row = splitByMarket[market]
                if (!row) {
                  return (
                    <div key={market} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase text-white/50">{market}</p>
                      <p className="text-sm text-white/60">Splits missing.</p>
                    </div>
                  )
                }
                return (
                  <div key={market} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1">
                    <p className="text-xs uppercase text-white/50">{market}</p>
                    <p className="text-sm text-white/70">
                      Bets: Away {formatPct(row.away_bets_pct)} / Home {formatPct(row.home_bets_pct)}
                    </p>
                    <p className="text-sm text-white/70">
                      Money: Away {formatPct(row.away_money_pct)} / Home {formatPct(row.home_money_pct)}
                    </p>
                    <p className="text-xs text-white/50">
                      Sharp indicator: {row.sharp_indicator || 'missing'}
                    </p>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-white/60">Betting splits missing for this game.</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Line movement</h2>
          {lineMovements.length ? (
            <ul className="space-y-2 text-sm text-white/70">
              {lineMovements.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-white/60">Line movement history missing.</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Matchup snapshot</h2>
          <p className="text-sm text-white/70">
            This matchup brings together {edge.awayTeam} and {edge.homeTeam} with a market snapshot
            based on current lines, movement, and projection inputs. We’re pulling pace/efficiency
            context, travel/rest factors, and any sharp/public signals to explain why the market is
            priced the way it is. This section is descriptive only and doesn’t suggest a winner.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-white/50">{edge.awayTeam}</p>
              <p className="text-sm text-white/70">{buildTeamStatsLine(edge.awayStats)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs uppercase text-white/50">{edge.homeTeam}</p>
              <p className="text-sm text-white/70">{buildTeamStatsLine(edge.homeStats)}</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Sharp vs public read</h2>
          {edge.sharpSignals?.length ? (
            <p className="text-sm text-white/70">
              {edge.sharpSignals.length} sharp signals detected in the projection feed.
            </p>
          ) : splits.length ? (
            <p className="text-sm text-white/70">
              Sharp signals not confirmed. Use splits divergence above to gauge public vs sharp pressure.
            </p>
          ) : (
            <p className="text-sm text-white/60">Sharp/public signals missing.</p>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">FAQs</h2>
          <div className="space-y-3 text-sm text-white/70">
            <p>
              <span className="font-semibold">What time does this game start?</span>{' '}
              {formatTime(commenceTime)}.
            </p>
            <p>
              <span className="font-semibold">Where are the best lines?</span>{' '}
              {bestLines.spread?.book || bestLines.total?.book || bestLines.moneyline?.book || 'Line data missing.'}
            </p>
            <p>
              <span className="font-semibold">Are betting splits available?</span>{' '}
              {splits.length ? 'Yes, see the betting splits section.' : 'Splits missing for this game.'}
            </p>
          </div>
        </section>
      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  )
}
