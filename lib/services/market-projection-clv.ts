import { createServiceClient } from '@/lib/supabase/service'
import { oddsToImpliedProbability } from '@/lib/utils/statistics'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'

type PickSide = 'home' | 'away'

type ClosingSnapshot = {
  line: number | null
  odds: number | null
  book: string | null
}

type LineRow = {
  bookmaker?: string | null
  recorded_at?: string | null
  spread_home?: number | null
  spread_away?: number | null
  spread_home_odds?: number | null
  spread_away_odds?: number | null
  moneyline_home?: number | null
  moneyline_away?: number | null
}

type MarketType = 'spread' | 'moneyline'

const isHockeySport = (sport: string) => sport === 'icehockey_nhl'

const TRACKED_SPORTS = new Set(['basketball_nba', 'basketball_ncaab', 'icehockey_nhl'])

// Minimum edge percentage required for CLV tracking (NBA and NCAAB)
const MIN_EDGE_PERCENT_BASKETBALL = 3.0

export type MarketProjectionClvSummary = {
  total: number
  beat: number
  push: number
  miss: number
  avgClvPoints: number | null
  avgClvImpliedProb: number | null
}

export type MarketProjectionClvGame = {
  id: string
  oddsApiId: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  pickSide: PickSide
  pickLine: number | null
  pickOdds: number | null
  pickBook: string | null
  closingLine: number | null
  closingOdds: number | null
  closingBook: string | null
  clvPoints: number | null
  clvImpliedProb: number | null
}

export type MarketProjectionClvHistory = {
  date: string
  total: number
  beat: number
  push: number
  miss: number
  avgClvPoints: number | null
  avgClvImpliedProb: number | null
}

const coerceNumber = (value?: number | string | null) => {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const resolvePickSide = (edge: GameEdgeAnalysis): PickSide | null => {
  const projectionSide = edge.sharpProjections?.spread?.side
  if (projectionSide === edge.homeTeam) return 'home'
  if (projectionSide === edge.awayTeam) return 'away'
  const marketLine = coerceNumber(edge.spread?.marketLine)
  const targetLine = coerceNumber(edge.spread?.targetLine)
  if (marketLine == null || targetLine == null) return null
  if (targetLine === marketLine) return null
  return targetLine < marketLine ? 'home' : 'away'
}

const resolvePickLine = (edge: GameEdgeAnalysis, pickSide: PickSide) => {
  const marketLine = coerceNumber(edge.spread?.marketLine)
  if (marketLine == null) return null
  return pickSide === 'home' ? marketLine : -marketLine
}

const resolvePickOdds = (edge: GameEdgeAnalysis, pickSide: PickSide) => {
  const spread = edge.spread
  if (!spread) return null
  const odds =
    pickSide === 'home'
      ? spread.bestHomeOdds ?? spread.bestOdds
      : spread.bestAwayOdds ?? spread.bestOdds
  return coerceNumber(odds)
}

const resolvePickBook = (edge: GameEdgeAnalysis, pickSide: PickSide) => {
  const spread = edge.spread
  if (!spread) return null
  return pickSide === 'home'
    ? spread.bestHomeBook ?? spread.bestBook ?? null
    : spread.bestAwayBook ?? spread.bestBook ?? null
}

// Hockey moneyline-specific functions
const resolveMoneylinePickSide = (edge: GameEdgeAnalysis): PickSide | null => {
  const projectionSide = edge.sharpProjections?.moneyline?.side
  if (projectionSide === edge.homeTeam) return 'home'
  if (projectionSide === edge.awayTeam) return 'away'
  // Fallback: use model probability if available
  const modelProb = edge.moneyline?.model?.homeProbability
  const sportsbookHomeOdds = edge.moneyline?.sportsbook?.homeOdds
  if (modelProb != null && sportsbookHomeOdds != null) {
    const impliedProb = oddsToImpliedProbability(sportsbookHomeOdds)
    // Pick the side where our model sees value
    return modelProb > impliedProb ? 'home' : 'away'
  }
  return null
}

const resolveMoneylinePickOdds = (edge: GameEdgeAnalysis, pickSide: PickSide) => {
  const ml = edge.moneyline
  if (!ml?.sportsbook) return null
  const odds = pickSide === 'home' ? ml.sportsbook.homeOdds : ml.sportsbook.awayOdds
  return coerceNumber(odds)
}

const resolveMoneylinePickBook = (edge: GameEdgeAnalysis, pickSide: PickSide) => {
  const ml = edge.moneyline
  if (!ml?.sportsbook) return null
  return pickSide === 'home'
    ? ml.sportsbook.homeBook ?? null
    : ml.sportsbook.awayBook ?? null
}

const resolveClvPoints = (pickLine: number, closingLine: number) => {
  return pickLine - closingLine
}

const resolveClvImpliedProb = (
  pickOdds: number | null,
  closingOdds: number | null
) => {
  if (pickOdds == null || closingOdds == null) return null
  return (
    oddsToImpliedProbability(closingOdds) -
    oddsToImpliedProbability(pickOdds)
  )
}

const fetchClosingSnapshot = async ({
  supabase,
  oddsApiId,
  pickSide,
  pickBook,
  commenceTime,
  marketType = 'spread',
}: {
  supabase: ReturnType<typeof createServiceClient>
  oddsApiId: string
  pickSide: PickSide
  pickBook: string | null
  commenceTime: string
  marketType?: MarketType
}): Promise<ClosingSnapshot | null> => {
  const selectFields = marketType === 'moneyline'
    ? 'bookmaker,recorded_at,moneyline_home,moneyline_away'
    : 'bookmaker,recorded_at,spread_home,spread_away,spread_home_odds,spread_away_odds'

  const fetchLatest = async ({
    lineType,
    book,
    before,
  }: {
    lineType: 'closing' | 'current'
    book?: string | null
    before?: string
  }) => {
    let query = supabase
      .from('lines')
      .select(selectFields)
      .eq('odds_api_id', oddsApiId)
      .eq('market_type', marketType === 'moneyline' ? 'h2h' : 'spread')
      .eq('line_type', lineType)
    if (book) query = query.eq('bookmaker', book)
    if (before) query = query.lte('recorded_at', before)
    const { data } = (await query
      .order('recorded_at', { ascending: false })
      .limit(1)) as { data: LineRow[] | null }
    return data?.[0] ?? null
  }

  let line = await fetchLatest({ lineType: 'closing', book: pickBook })
  if (!line && pickBook) {
    line = await fetchLatest({ lineType: 'closing' })
  }
  if (!line) {
    line = await fetchLatest({
      lineType: 'current',
      book: pickBook,
      before: commenceTime,
    })
  }
  if (!line && pickBook) {
    line = await fetchLatest({
      lineType: 'current',
      before: commenceTime,
    })
  }
  if (!line) return null

  if (marketType === 'moneyline') {
    // For moneyline, we return the odds directly (no "line" concept)
    const closingOdds =
      pickSide === 'home'
        ? coerceNumber(line.moneyline_home)
        : coerceNumber(line.moneyline_away)
    return {
      line: null, // MLs don't have a line
      odds: closingOdds,
      book: line.bookmaker ?? null,
    }
  }

  const closingLine =
    pickSide === 'home'
      ? coerceNumber(line.spread_home)
      : coerceNumber(line.spread_away)
  const closingOdds =
    pickSide === 'home'
      ? coerceNumber(line.spread_home_odds)
      : coerceNumber(line.spread_away_odds)

  return {
    line: closingLine,
    odds: closingOdds,
    book: line.bookmaker ?? null,
  }
}

export const recordMarketProjectionPicks = async ({
  sport,
  edges,
  pickedAt,
}: {
  sport: string
  edges: GameEdgeAnalysis[]
  pickedAt?: string
}) => {
  if (!TRACKED_SPORTS.has(sport)) return { inserted: 0 }
  const supabase = createServiceClient()
  const timestamp = pickedAt ?? new Date().toISOString()
  const useMoneyline = isHockeySport(sport)

  const records = edges
    .map((edge) => {
      const oddsApiId = edge.oddsApiId
      if (!oddsApiId) return null

      if (useMoneyline) {
        // Hockey: track moneylines
        if (!edge.moneyline?.sportsbook) return null
        const pickSide = resolveMoneylinePickSide(edge)
        if (!pickSide) return null
        const pickOdds = resolveMoneylinePickOdds(edge, pickSide)
        if (pickOdds == null) return null
        const pickBook = resolveMoneylinePickBook(edge, pickSide)
        return {
          sport,
          odds_api_id: oddsApiId,
          market_type: 'moneyline',
          home_team: edge.homeTeam,
          away_team: edge.awayTeam,
          commence_time: edge.commenceTime,
          pick_side: pickSide,
          pick_line: null, // MLs don't have a line
          pick_odds: pickOdds,
          pick_implied_prob: oddsToImpliedProbability(pickOdds),
          pick_book: pickBook,
          picked_at: timestamp,
        }
      }

      // Basketball: track spreads (only if edge >= 3%)
      if (!edge.spread) return null
      const edgePercent = edge.sharpProjections?.spread?.edgePercent
      if (edgePercent == null || edgePercent < MIN_EDGE_PERCENT_BASKETBALL) return null
      const pickSide = resolvePickSide(edge)
      if (!pickSide) return null
      const pickLine = resolvePickLine(edge, pickSide)
      if (pickLine == null) return null
      const pickOdds = resolvePickOdds(edge, pickSide)
      const pickBook = resolvePickBook(edge, pickSide)
      return {
        sport,
        odds_api_id: oddsApiId,
        market_type: 'spread',
        home_team: edge.homeTeam,
        away_team: edge.awayTeam,
        commence_time: edge.commenceTime,
        pick_side: pickSide,
        pick_line: pickLine,
        pick_odds: pickOdds,
        pick_implied_prob:
          pickOdds != null ? oddsToImpliedProbability(pickOdds) : null,
        pick_book: pickBook,
        picked_at: timestamp,
      }
    })
    .filter(Boolean) as Array<Record<string, unknown>>

  if (records.length === 0) return { inserted: 0 }

  const { error } = (await (supabase as any)
    .from('market_projection_clv')
    .upsert(records, {
      onConflict: 'sport,odds_api_id,market_type',
      ignoreDuplicates: true,
    })) as { error: any }
  if (error) {
    console.warn('[market-projection-clv] pick insert failed', error)
    return { inserted: 0 }
  }
  return { inserted: records.length }
}

export const getRollingMarketProjectionClvRecap = async ({
  sport,
  windowHours = 24,
  limit = 8,
}: {
  sport: string
  windowHours?: number
  limit?: number
}) => {
  const supabase = createServiceClient()
  const now = new Date()
  const since = new Date(now.getTime() - windowHours * 60 * 60 * 1000)
  const historySince = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const useMoneyline = isHockeySport(sport)
  const marketType = useMoneyline ? 'moneyline' : 'spread'

  const { data, error } = (await (supabase as any)
    .from('market_projection_clv')
    .select('*')
    .eq('sport', sport)
    .eq('market_type', marketType)
    .gte('commence_time', since.toISOString())
    .lte('commence_time', now.toISOString())
    .order('commence_time', { ascending: false })) as {
    data: any[] | null
    error: any
  }

  if (error || !data) {
    return {
      summary: {
        total: 0,
        beat: 0,
        push: 0,
        miss: 0,
        avgClvPoints: null,
        avgClvImpliedProb: null,
      },
      games: [],
      history: [],
      updatedAt: now.toISOString(),
    }
  }

  for (const row of data) {
    // For moneylines, we use clv_implied_prob as the primary metric
    // For spreads, we use clv_points
    const alreadyCalculated = useMoneyline
      ? row.clv_implied_prob != null
      : row.clv_points != null
    if (!row || alreadyCalculated || !row.odds_api_id) continue
    const pickSide = row.pick_side as PickSide | null
    if (!pickSide) continue
    const closing = await fetchClosingSnapshot({
      supabase,
      oddsApiId: row.odds_api_id,
      pickSide,
      pickBook: row.pick_book ?? null,
      commenceTime: row.commence_time,
      marketType,
    })

    if (useMoneyline) {
      // Moneyline: CLV is based on implied probability difference
      if (!closing || closing.odds == null) continue
      const clvImpliedProb = resolveClvImpliedProb(
        coerceNumber(row.pick_odds),
        closing.odds
      )
      if (clvImpliedProb == null) continue

      await (supabase as any)
        .from('market_projection_clv')
        .update({
          closing_line: null,
          closing_odds: closing.odds,
          closing_implied_prob: oddsToImpliedProbability(closing.odds),
          closing_book: closing.book,
          closing_captured_at: new Date().toISOString(),
          clv_points: clvImpliedProb, // Store implied prob as "points" for consistency in beat/miss logic
          clv_implied_prob: clvImpliedProb,
        })
        .eq('id', row.id)

      row.clv_points = clvImpliedProb
      row.clv_implied_prob = clvImpliedProb
      row.closing_odds = closing.odds
      row.closing_book = closing.book
    } else {
      // Spread: CLV is based on line difference
      if (!closing || closing.line == null) continue
      const pickLine = coerceNumber(row.pick_line)
      if (pickLine == null) continue
      const clvPoints = resolveClvPoints(pickLine, closing.line)
      const clvImpliedProb = resolveClvImpliedProb(
        coerceNumber(row.pick_odds),
        closing.odds
      )

      await (supabase as any)
        .from('market_projection_clv')
        .update({
          closing_line: closing.line,
          closing_odds: closing.odds,
          closing_implied_prob:
            closing.odds != null ? oddsToImpliedProbability(closing.odds) : null,
          closing_book: closing.book,
          closing_captured_at: new Date().toISOString(),
          clv_points: clvPoints,
          clv_implied_prob: clvImpliedProb,
        })
        .eq('id', row.id)

      row.clv_points = clvPoints
      row.clv_implied_prob = clvImpliedProb
      row.closing_line = closing.line
      row.closing_odds = closing.odds
      row.closing_book = closing.book
    }
  }

  const resolved = data.filter((row) => coerceNumber(row.clv_points) != null)
  const total = resolved.length
  let beat = 0
  let push = 0
  let miss = 0
  let clvPointsSum = 0
  let clvImpliedSum = 0
  let clvImpliedCount = 0

  for (const row of resolved) {
    const clvPoints = coerceNumber(row.clv_points) ?? 0
    if (clvPoints > 0) beat += 1
    else if (clvPoints < 0) miss += 1
    else push += 1
    clvPointsSum += clvPoints
    const clvImplied = coerceNumber(row.clv_implied_prob)
    if (clvImplied != null) {
      clvImpliedSum += clvImplied
      clvImpliedCount += 1
    }
  }

  const games = resolved.slice(0, limit).map((row) => ({
    id: row.id,
    oddsApiId: row.odds_api_id,
    homeTeam: row.home_team,
    awayTeam: row.away_team,
    commenceTime: row.commence_time,
    pickSide: row.pick_side as PickSide,
    pickLine: coerceNumber(row.pick_line),
    pickOdds: coerceNumber(row.pick_odds),
    pickBook: row.pick_book ?? null,
    closingLine: coerceNumber(row.closing_line),
    closingOdds: coerceNumber(row.closing_odds),
    closingBook: row.closing_book ?? null,
    clvPoints: coerceNumber(row.clv_points),
    clvImpliedProb: coerceNumber(row.clv_implied_prob),
  }))

  return {
    summary: {
      total,
      beat,
      push,
      miss,
      avgClvPoints: total ? clvPointsSum / total : null,
      avgClvImpliedProb: clvImpliedCount
        ? clvImpliedSum / clvImpliedCount
        : null,
    },
    games,
    history: await (async () => {
      const { data: historyRows } = (await (supabase as any)
        .from('market_projection_clv')
        .select('commence_time,clv_points,clv_implied_prob')
        .eq('sport', sport)
        .eq('market_type', marketType)
        .gte('commence_time', historySince.toISOString())
        .lte('commence_time', now.toISOString())) as {
        data: any[] | null
      }

      if (!historyRows) return []
      const byDate = new Map<
        string,
        {
          total: number
          beat: number
          push: number
          miss: number
          clvSum: number
          clvImpliedSum: number
          clvImpliedCount: number
        }
      >()

      for (const row of historyRows) {
        const clvPoints = coerceNumber(row.clv_points)
        if (clvPoints == null) continue
        const date = String(row.commence_time).split('T')[0]
        const entry =
          byDate.get(date) ?? {
            total: 0,
            beat: 0,
            push: 0,
            miss: 0,
            clvSum: 0,
            clvImpliedSum: 0,
            clvImpliedCount: 0,
          }
        entry.total += 1
        if (clvPoints > 0) entry.beat += 1
        else if (clvPoints < 0) entry.miss += 1
        else entry.push += 1
        entry.clvSum += clvPoints
        const clvImplied = coerceNumber(row.clv_implied_prob)
        if (clvImplied != null) {
          entry.clvImpliedSum += clvImplied
          entry.clvImpliedCount += 1
        }
        byDate.set(date, entry)
      }

      return Array.from(byDate.entries())
        .map(([date, entry]) => ({
          date,
          total: entry.total,
          beat: entry.beat,
          push: entry.push,
          miss: entry.miss,
          avgClvPoints: entry.total ? entry.clvSum / entry.total : null,
          avgClvImpliedProb: entry.clvImpliedCount
            ? entry.clvImpliedSum / entry.clvImpliedCount
            : null,
        }))
        .sort((a, b) => (a.date < b.date ? 1 : -1))
    })(),
    updatedAt: now.toISOString(),
  }
}
