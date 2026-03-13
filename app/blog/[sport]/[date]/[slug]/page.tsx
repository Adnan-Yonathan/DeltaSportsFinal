import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createServiceClient } from '@/lib/supabase/service'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'
import { SimpleHeader } from '@/components/ui/simple-header'
import { BlogNavButtons } from '@/components/blog/BlogNavButtons'
import { OddsMatrixSurface } from '@/components/ui/odds-matrix-surface'
import {
  buildSlatePath,
  findEdgeForSlug,
  getSportLabel,
  resolveSportParam,
} from '@/lib/blog/market-projections'
import { generateSeoBlogPost, type GeneratedSeoBlogPost } from '@/lib/blog/seo-generator'
import { DEFAULT_GAME_PRIMARY_KEYWORD } from '@/lib/blog/seo-topics'

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
  if (value == null || !Number.isFinite(value)) return '--'
  return value > 0 ? `+${value}` : `${value}`
}

const formatLine = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? '--' : value.toFixed(1)

const formatPct = (value?: number | null) =>
  value == null || !Number.isFinite(value) ? '--' : `${value.toFixed(1)}%`

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
  isNumber(value) ? value.toFixed(1) : '--'

const buildTeamStatsLine = (stats: GameEdgeAnalysis['homeStats']) => {
  if (!stats) return 'Team stats missing.'
  if ('ortg' in stats || 'drtg' in stats || 'pace' in stats) {
    const ortg = 'ortg' in stats ? formatStatValue((stats as any).ortg) : '--'
    const drtg = 'drtg' in stats ? formatStatValue((stats as any).drtg) : '--'
    const pace = 'pace' in stats ? formatStatValue((stats as any).pace) : '--'
    return `ORtg ${ortg}  -  DRtg ${drtg}  -  Pace ${pace}`
  }
  if (
    'pointsForPerGame' in stats ||
    'pointsAgainstPerGame' in stats ||
    'yardsPerPlay' in stats
  ) {
    const ppg = 'pointsForPerGame' in stats ? formatStatValue((stats as any).pointsForPerGame) : '--'
    const papg = 'pointsAgainstPerGame' in stats ? formatStatValue((stats as any).pointsAgainstPerGame) : '--'
    const ypp = 'yardsPerPlay' in stats ? formatStatValue((stats as any).yardsPerPlay) : '--'
    return `Points ${ppg}  -  Allowed ${papg}  -  Yards/Play ${ypp}`
  }
  if ('goalsForPerGame' in stats || 'goalsAgainstPerGame' in stats || 'shotsForPerGame' in stats) {
    const gpg = 'goalsForPerGame' in stats ? formatStatValue((stats as any).goalsForPerGame) : '--'
    const gapg = 'goalsAgainstPerGame' in stats ? formatStatValue((stats as any).goalsAgainstPerGame) : '--'
    const shots = 'shotsForPerGame' in stats ? formatStatValue((stats as any).shotsForPerGame) : '--'
    return `Goals ${gpg}  -  Allowed ${gapg}  -  Shots ${shots}`
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

const buildGamePostContext = (
  sportLabel: string,
  date: string,
  edge: GameEdgeAnalysis,
  bestLines: MarketLineSummary,
  lineMovements: string[],
  splits: any[]
) => {
  const spread = bestLines.spread
    ? `Spread ${formatLine(bestLines.spread.line)} (${formatOdds(bestLines.spread.homeOdds)} / ${formatOdds(bestLines.spread.awayOdds)})`
    : 'Spread missing'
  const total = bestLines.total
    ? `Total ${formatLine(bestLines.total.line)} (Over ${formatOdds(bestLines.total.overOdds)} / Under ${formatOdds(bestLines.total.underOdds)})`
    : 'Total missing'
  const moneyline = bestLines.moneyline
    ? `Moneyline away/home ${formatOdds(bestLines.moneyline.awayOdds)} / ${formatOdds(bestLines.moneyline.homeOdds)}`
    : 'Moneyline missing'
  const splitSummary = splits.length
    ? splits
        .slice(0, 3)
        .map((row) => {
          const market = row?.market_type || 'market'
          return `${market}: bets away/home ${formatPct(row?.away_bets_pct)} / ${formatPct(
            row?.home_bets_pct
          )}, money away/home ${formatPct(row?.away_money_pct)} / ${formatPct(row?.home_money_pct)}`
        })
        .join('\n')
    : 'Betting splits missing for this game.'

  return `
Sport: ${sportLabel}
Date: ${date}
Matchup: ${edge.awayTeam} at ${edge.homeTeam}
Game time (ET): ${formatTime(edge.commenceTime)}
Best lines snapshot:
- ${spread}
- ${total}
- ${moneyline}
Line movement notes:
${lineMovements.length ? lineMovements.map((line) => `- ${line}`).join('\n') : '- Line movement missing'}
Sharp signals: ${edge.sharpSignals?.length ? edge.sharpSignals.join(', ') : 'No confirmed sharp signals'}
Betting splits:
${splitSummary}
`
}

type SavedGamePost = {
  away_team: string
  home_team: string
  generated_post: GeneratedSeoBlogPost
  edge_snapshot: GameEdgeAnalysis | null
  best_lines: MarketLineSummary | null
  line_movements: string[]
  splits: any[]
  created_at: string
}

async function loadSavedPost(params: PageParams): Promise<SavedGamePost | null> {
  const sport = resolveSportParam(params.sport)
  const supabase = createServiceClient()
  const { data } = await (supabase as any)
    .from('blog_game_posts')
    .select('away_team, home_team, generated_post, edge_snapshot, best_lines, line_movements, splits, created_at')
    .eq('sport', sport)
    .eq('date', params.date)
    .eq('slug', params.slug)
    .single()
  return data ?? null
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

async function saveGamePost(
  params: PageParams,
  sport: string,
  awayTeam: string,
  homeTeam: string,
  generatedPost: GeneratedSeoBlogPost,
  edge: GameEdgeAnalysis,
  bestLines: MarketLineSummary,
  lineMovements: string[],
  splits: any[],
) {
  try {
    const supabase = createServiceClient()
    await (supabase as any).from('blog_game_posts').upsert({
      sport,
      date: params.date,
      slug: params.slug,
      away_team: awayTeam,
      home_team: homeTeam,
      generated_post: generatedPost,
      edge_snapshot: edge,
      best_lines: bestLines,
      line_movements: lineMovements,
      splits,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'sport,date,slug' })
  } catch {
    // Non-fatal — page still renders even if save fails
  }
}

export async function generateMetadata(
  { params }: { params: PageParams }
): Promise<Metadata> {
  const sportLabel = getSportLabel(params.sport)
  const fallback = parseSlugTeams(params.slug)

  // Try saved post first — fast, no cache needed
  const saved = await loadSavedPost(params)
  const away = saved?.away_team || fallback.away || 'Away'
  const home = saved?.home_team || fallback.home || 'Home'

  // If not saved, try the live cache
  if (!saved) {
    const { edge } = await loadEdgeData(params)
    const liveAway = edge?.awayTeam || fallback.away || 'Away'
    const liveHome = edge?.homeTeam || fallback.home || 'Home'
    const title = `${liveAway} vs ${liveHome} betting breakdown (sharp money, best lines) - ${params.date}`
    const description = `Full betting breakdown for ${liveAway} vs ${liveHome}. Lines, movement, splits, and sharp/public signals for the ${sportLabel} slate on ${params.date}.`
    return {
      title,
      description,
      alternates: { canonical: `https://deltasports.app/blog/${params.sport}/${params.date}/${params.slug}` },
      openGraph: { title, description, type: 'article' },
      twitter: { title, description },
    }
  }

  const title = `${away} vs ${home} betting breakdown (sharp money, best lines) - ${params.date}`
  const description = `Full betting breakdown for ${away} vs ${home}. Lines, movement, splits, and sharp/public signals for the ${sportLabel} slate on ${params.date}.`
  return {
    title,
    description,
    alternates: { canonical: `https://deltasports.app/blog/${params.sport}/${params.date}/${params.slug}` },
    openGraph: { title, description, type: 'article' },
    twitter: { title, description },
  }
}

export default async function BlogGamePage({
  params,
}: {
  params: PageParams
}) {
  const sportLabel = getSportLabel(params.sport)
  const sport = resolveSportParam(params.sport)

  // --- Try saved post first (no LLM, no cache needed) ---
  const saved = await loadSavedPost(params)

  let edge: GameEdgeAnalysis
  let commenceTime: string | undefined
  let bestLines: MarketLineSummary
  let lineMovements: string[]
  let splits: any[]
  let generatedPost: GeneratedSeoBlogPost
  let updatedAt: string | null = null

  if (saved) {
    edge = saved.edge_snapshot ?? { awayTeam: saved.away_team, homeTeam: saved.home_team } as GameEdgeAnalysis
    commenceTime = (saved.edge_snapshot as any)?.commenceTime
    bestLines = saved.best_lines ?? {}
    lineMovements = saved.line_movements ?? []
    splits = saved.splits ?? []
    generatedPost = saved.generated_post
    updatedAt = saved.created_at
  } else {
    // --- Fall back to live cache + generate ---
    const liveData = await loadEdgeData(params)
    if (!liveData.edge) notFound()

    edge = liveData.edge
    updatedAt = liveData.updatedAt
    commenceTime = edge.commenceTime
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

    splits = oddsApiId
      ? (await supabase
          .from('latest_betting_splits')
          .select('*')
          .eq('game_id', oddsApiId)).data || []
      : []

    bestLines = buildBestLines(edge, lines)
    lineMovements = buildLineMovementSummary(lines)

    generatedPost = await generateSeoBlogPost({
      cacheKey: `game:${params.sport}:${params.date}:${params.slug}`,
      mode: 'game-specific',
      primaryKeyword: DEFAULT_GAME_PRIMARY_KEYWORD,
      topic: `Break down ${edge.awayTeam} vs ${edge.homeTeam} using sharp signals, reverse line movement betting context, and sharp money tracker workflow.`,
      titleHint: `${edge.awayTeam} vs ${edge.homeTeam}: sharp money sports betting breakdown`,
      context: buildGamePostContext(sportLabel, params.date, edge, bestLines, lineMovements, splits),
    })

    // Persist so the URL never dies
    await saveGamePost(params, sport, edge.awayTeam, edge.homeTeam, generatedPost, edge, bestLines, lineMovements, splits)
  }

  const splitByMarket = (splits as any[]).reduce((acc: Record<string, any>, row: any) => {
    acc[row.market_type] = row
    return acc
  }, {})
  const moneylineFavorite = getMoneylineFavorite(edge, bestLines)

  const articleJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: generatedPost.h1,
    description: generatedPost.metaDescription,
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
  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: generatedPost.faq.map((entry) => ({
      '@type': 'Question',
      name: entry.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: entry.answer,
      },
    })),
  }

  const hasSharpSignals = (edge.sharpSignals?.length ?? 0) > 0
  const spreadRow = splitByMarket['spread']
  const totalRow = splitByMarket['total']
  const moneylineRow = splitByMarket['moneyline']

  // Detect line movement direction from summary strings
  const parseMoveDirection = (text: string): 'up' | 'down' | 'flat' => {
    const m = text.match(/from ([\-\d.+]+) to ([\-\d.+]+)/)
    if (!m) return 'flat'
    const from = parseFloat(m[1])
    const to = parseFloat(m[2])
    if (to > from) return 'up'
    if (to < from) return 'down'
    return 'flat'
  }

  return (
    <div className="relative min-h-screen bg-black text-white">
      <OddsMatrixSurface intensity={0.30} className="opacity-90" />
      <SimpleHeader widthClass="max-w-6xl" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 pb-16 pt-20 sm:px-6 sm:pt-24 lg:px-10">

        {/* ── HERO ── */}
        <header className="rounded-3xl border border-white/10 bg-black/60 p-6 backdrop-blur sm:p-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-emerald-300">
              {sportLabel}
            </span>
            {hasSharpSignals && (
              <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-amber-300">
                ⚡ {edge.sharpSignals!.length} Sharp Signal{edge.sharpSignals!.length > 1 ? 's' : ''} Detected
              </span>
            )}
            <span className="text-[11px] text-white/40">{formatTime(commenceTime)} ET</span>
          </div>

          <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {edge.awayTeam} vs {edge.homeTeam}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-white/70 sm:text-base">
            {generatedPost.introHook}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-400/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Follow this live on Delta — free
            </Link>
            <Link
              href={buildSlatePath(params.sport, params.date)}
              className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/60 transition hover:border-white/30 hover:text-white"
            >
              Full {sportLabel} slate →
            </Link>
          </div>

          <div className="mt-5 flex flex-wrap gap-4 text-xs text-white/40">
            <BlogNavButtons />
            <Link className="hover:text-white/60" href="/blog">Blog</Link>
          </div>
        </header>

        {/* ── SHARP SIGNAL SUMMARY ── */}
        {hasSharpSignals && (
          <section className="mt-6 rounded-3xl border border-amber-400/25 bg-amber-400/5 p-6">
            <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-amber-300/80">
              Delta Sharp Signals
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              {edge.sharpSignals!.length} sharp signal{edge.sharpSignals!.length > 1 ? 's' : ''} flagged for this game
            </h2>
            <ul className="mt-4 space-y-2">
              {edge.sharpSignals!.map((signal, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-white/80">
                  <span className="mt-0.5 shrink-0 text-amber-400">⚡</span>
                  <span>{signal.description ?? `${signal.type} ${signal.market} ${signal.side} (${signal.strength}/5)`}</span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-white/45">
              Sharp signals are sourced from Delta&apos;s market projection feed — exchange orderbook pressure, line movement, and bet split divergence.
            </p>
          </section>
        )}

        {/* ── BEST LINES ── */}
        <section className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-white">Best available lines</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {/* Spread */}
            <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45">Spread</p>
              {bestLines.spread ? (
                <div className="mt-2">
                  <p className="text-2xl font-bold text-white">
                    {formatLine(bestLines.spread.line)}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    {formatOdds(bestLines.spread.homeOdds)} / {formatOdds(bestLines.spread.awayOdds)}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {edge.spread?.favoredTeam && (
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                        Fav: {edge.spread.favoredTeam}
                      </span>
                    )}
                    {bestLines.spread.book && (
                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300/70">
                        Best: {bestLines.spread.book}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/40">Line unavailable</p>
              )}
            </div>

            {/* Total */}
            <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45">Total (O/U)</p>
              {bestLines.total ? (
                <div className="mt-2">
                  <p className="text-2xl font-bold text-white">
                    {formatLine(bestLines.total.line)}
                  </p>
                  <p className="mt-1 text-sm text-white/60">
                    O {formatOdds(bestLines.total.overOdds)} / U {formatOdds(bestLines.total.underOdds)}
                  </p>
                  {bestLines.total.book && (
                    <div className="mt-3">
                      <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] text-emerald-300/70">
                        Best: {bestLines.total.book}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/40">Line unavailable</p>
              )}
            </div>

            {/* Moneyline */}
            <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45">Moneyline</p>
              {bestLines.moneyline ? (
                <div className="mt-2">
                  <div className="flex items-baseline gap-2">
                    <p className="text-xl font-bold text-white">{formatOdds(bestLines.moneyline.awayOdds)}</p>
                    <span className="text-xs text-white/35">away</span>
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <p className="text-xl font-bold text-white">{formatOdds(bestLines.moneyline.homeOdds)}</p>
                    <span className="text-xs text-white/35">home</span>
                  </div>
                  {moneylineFavorite && (
                    <div className="mt-3">
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/50">
                        Fav: {moneylineFavorite}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-sm text-white/40">Line unavailable</p>
              )}
            </div>
          </div>
        </section>

        {/* ── LINE MOVEMENT ── */}
        {lineMovements.length > 0 && (
          <section className="mt-6 rounded-2xl border border-white/10 bg-black/55 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-[0.25em] text-white/50">Line Movement</h2>
            <ul className="mt-3 space-y-2">
              {lineMovements.map((move, i) => {
                const dir = parseMoveDirection(move)
                return (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <span className={
                      dir === 'up' ? 'text-rose-400' :
                      dir === 'down' ? 'text-emerald-400' :
                      'text-white/30'
                    }>
                      {dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'}
                    </span>
                    <span className="text-white/75">{move}</span>
                  </li>
                )
              })}
            </ul>
            <p className="mt-3 text-xs text-white/35">
              Sharp-driven movement typically shows reverse line action — line moves opposite to public ticket %
            </p>
          </section>
        )}

        {/* ── BETTING SPLITS ── */}
        {(splits as any[]).length > 0 && (
          <section className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Betting splits</h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(['spread', 'total', 'moneyline'] as const).map((market) => {
                const row = splitByMarket[market]
                if (!row) return null
                const awayBets = parseFloat(row.away_bets_pct) || 0
                const homeBets = parseFloat(row.home_bets_pct) || 0
                const awayMoney = parseFloat(row.away_money_pct) || 0
                const homeMoney = parseFloat(row.home_money_pct) || 0
                const isSharp = row.sharp_indicator && row.sharp_indicator !== 'missing' && row.sharp_indicator !== 'none'
                return (
                  <div key={market} className={`rounded-2xl border p-5 ${isSharp ? 'border-amber-400/25 bg-amber-400/5' : 'border-white/10 bg-black/55'}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/45 capitalize">{market}</p>
                      {isSharp && (
                        <span className="text-[10px] font-semibold text-amber-300">⚡ Sharp</span>
                      )}
                    </div>

                    {/* Bet tickets */}
                    <div className="mt-4">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>{edge.awayTeam}</span>
                        <span>Tickets</span>
                        <span>{edge.homeTeam}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-l-full bg-sky-500/70 transition-all"
                          style={{ width: `${awayBets}%` }}
                        />
                        <div
                          className="h-full rounded-r-full bg-rose-500/70 transition-all"
                          style={{ width: `${homeBets}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-white/60">
                        <span>{formatPct(row.away_bets_pct)}</span>
                        <span>{formatPct(row.home_bets_pct)}</span>
                      </div>
                    </div>

                    {/* Money */}
                    <div className="mt-3">
                      <div className="flex justify-between text-[10px] text-white/40 mb-1">
                        <span>{edge.awayTeam}</span>
                        <span>Money</span>
                        <span>{edge.homeTeam}</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-l-full bg-emerald-500/80 transition-all"
                          style={{ width: `${awayMoney}%` }}
                        />
                        <div
                          className="h-full rounded-r-full bg-white/25 transition-all"
                          style={{ width: `${homeMoney}%` }}
                        />
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-white/60">
                        <span>{formatPct(row.away_money_pct)}</span>
                        <span>{formatPct(row.home_money_pct)}</span>
                      </div>
                    </div>

                    {isSharp && (
                      <p className="mt-3 text-[10px] leading-4 text-amber-300/70">
                        {row.sharp_indicator}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── TEAM STATS ── */}
        {(edge.homeStats || edge.awayStats) && (
          <section className="mt-6 space-y-3">
            <h2 className="text-lg font-semibold text-white">Team efficiency</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">{edge.awayTeam} · Away</p>
                <p className="mt-2 text-sm text-white/70 leading-6">{buildTeamStatsLine(edge.awayStats)}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/55 p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-white/45">{edge.homeTeam} · Home</p>
                <p className="mt-2 text-sm text-white/70 leading-6">{buildTeamStatsLine(edge.homeStats)}</p>
              </div>
            </div>
          </section>
        )}

        {/* ── KEY TAKEAWAYS ── */}
        <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/70">
            Delta&apos;s Read
          </p>
          <h2 className="mt-2 text-lg font-semibold text-white">Key takeaways</h2>
          <ul className="mt-4 space-y-3">
            {generatedPost.keyTakeaways.map((takeaway, index) => (
              <li key={`${takeaway}-${index}`} className="flex items-start gap-3 text-sm text-white/80">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* ── ANALYSIS SECTIONS ── */}
        <article className="mt-6 space-y-5">
          {generatedPost.sections.map((section, sectionIndex) => (
            <section
              key={`${section.h2}-${sectionIndex}`}
              className="rounded-3xl border border-white/10 bg-black/55 p-6"
            >
              <h2 className="text-xl font-semibold text-white">{section.h2}</h2>
              <div className="mt-3 space-y-4 text-sm leading-7 text-white/75">
                {section.paragraphs.map((paragraph, paragraphIndex) => (
                  <p key={`${section.h2}-p-${paragraphIndex}`}>{paragraph}</p>
                ))}
              </div>
              {section.h3Blocks?.length ? (
                <div className="mt-6 space-y-5">
                  {section.h3Blocks.map((block, blockIndex) => (
                    <div key={`${block.h3}-${blockIndex}`}>
                      <h3 className="text-base font-semibold text-white">{block.h3}</h3>
                      <div className="mt-2 space-y-3 text-sm leading-7 text-white/75">
                        {block.paragraphs.map((paragraph, blockParagraphIndex) => (
                          <p key={`${block.h3}-p-${blockParagraphIndex}`}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
        </article>

        {/* ── MID-PAGE CTA ── */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-black/60 p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: 'radial-gradient(ellipse at 60% 0%, rgba(16,185,129,0.08), transparent 70%)' }}
          />
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/60">
            You&apos;re seeing the snapshot
          </p>
          <h2 className="mt-2 text-xl font-bold text-white sm:text-2xl">
            Delta shows you this market live.
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-white/65">
            This breakdown is a point-in-time read. Inside Delta, you get the live feed — exchange orderbook depth on Kalshi and Polymarket, whale bets as they hit the tape, and real-time sharp pressure before books have a chance to adjust.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              { label: 'Exchange orderbook depth', desc: 'See where sharp money is resting on Kalshi, Novig, ProphetX' },
              { label: 'Whale bet feed', desc: 'Large individual bets tracked in real time across exchanges' },
              { label: 'Live line alerts', desc: 'Get notified when lines move on games you\'re watching' },
              { label: 'Sharp props scanner', desc: 'Player prop orderbook depth — find edges before books adjust' },
            ].map((item) => (
              <div key={item.label} className="flex gap-3 rounded-xl border border-white/8 bg-white/3 p-4">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-0.5 text-xs text-white/50">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-400/60 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Start free 7-day trial
            </Link>
            <Link
              href="/pricing"
              className="inline-flex rounded-full border border-white/15 px-5 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-white/30 hover:text-white"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-3 text-xs text-white/30">Plans from $24.99/week · No credit card to start</p>
        </section>

        {/* ── FAQ ── */}
        <section className="mt-6 rounded-3xl border border-white/10 bg-black/55 p-6">
          <h2 className="text-xl font-semibold text-white">Frequently asked</h2>
          <div className="mt-5 space-y-5">
            {generatedPost.faq.map((entry, index) => (
              <div key={`${entry.question}-${index}`} className="border-t border-white/8 pt-5 first:border-0 first:pt-0">
                <h3 className="text-sm font-semibold text-white">{entry.question}</h3>
                <p className="mt-2 text-sm leading-6 text-white/65">{entry.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── BOTTOM CTA ── */}
        <section className="mt-6 rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-8 text-center sm:p-10">
          <p className="text-[10px] font-semibold uppercase tracking-[0.4em] text-emerald-200/60">
            Follow sharp money for every game
          </p>
          <h2 className="mt-3 text-2xl font-bold text-white sm:text-3xl">
            Try Delta free for 7 days.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-white/60">
            Exchange orderbooks, whale bet detection, sharp props, and AI market projections across NBA, NFL, NHL, and MLB. No credit card required.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/auth/signup"
              className="inline-flex rounded-full bg-emerald-500/20 border border-emerald-400/60 px-7 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-200 transition hover:border-emerald-300 hover:text-white"
            >
              Start free trial
            </Link>
            <Link
              href="/sharp-betting-tools"
              className="inline-flex rounded-full border border-white/15 px-7 py-3 text-xs font-semibold uppercase tracking-[0.22em] text-white/55 transition hover:border-white/30 hover:text-white"
            >
              See all tools
            </Link>
          </div>
          <div className="mx-auto mt-6 flex flex-wrap justify-center gap-x-6 gap-y-1 text-[11px] text-white/30">
            <span>$24.99/week · $79/month · $299/year</span>
            <span>7-day free trial</span>
            <span>No credit card to start</span>
          </div>
        </section>

      </div>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
    </div>
  )
}
