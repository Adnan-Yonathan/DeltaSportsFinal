import { SupabaseClient } from '@supabase/supabase-js'
import { fetchOdds } from '@/lib/api/odds-api'
import { normalizeTeamKey } from '@/lib/identity/sport'
import { getSportProvider } from '@/lib/providers/sport-registry'
import { Database } from '@/lib/supabase/types'

type MarketSnapshotRow = Database['public']['Tables']['market_snapshots']['Row']
type TeamRecentFormRow = Database['public']['Tables']['team_recent_form']['Row']
type TeamSplitRow = Database['public']['Tables']['team_splits']['Row']
type HeadToHeadRow = Database['public']['Tables']['head_to_head_results']['Row']

export interface TeamContextSummary {
  team: string
  record?: string
  rank?: number
  streak?: string
  recentFormNote?: string
  homeAwayNote?: string
  statLine?: string
}

export interface InjurySummary {
  player: string
  team: string
  status: string
  injury?: string
  date?: string
}

export interface MarketTrendSummary {
  gameDescription: string
  bestSpreadHome?: string
  bestSpreadAway?: string
  bestMoneylineHome?: string
  bestMoneylineAway?: string
  bestTotalOver?: string
  bestTotalUnder?: string
  notes?: string
}

export interface GameContextPayload {
  sport: string
  homeTeam: string
  awayTeam: string
  injuries: InjurySummary[]
  teamSummaries: TeamContextSummary[]
  marketTrends?: MarketTrendSummary
  recentForm?: {
    home: TeamRecentFormRow[]
    away: TeamRecentFormRow[]
  }
  paceEfficiency?: {
    home: PaceSummary | null
    away: PaceSummary | null
  }
  homeAwaySplits?: {
    home: TeamSplitRow[]
    away: TeamSplitRow[]
  }
  headToHead?: HeadToHeadRow[]
  notes: string[]
}

interface PaceSummary {
  games: number
  pace: number | null
  offensive_rating: number | null
  defensive_rating: number | null
  net_rating: number | null
}

interface BuildContextParams {
  sport: string
  homeTeam: string
  awayTeam: string
  includeMarketTrends?: boolean
  supabase?: SupabaseClient<Database>
}

function normalizeTeamName(name: string) {
  return normalizeTeamKey(name)
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function summarizeTeamStats(raw: any, teamName: string): TeamContextSummary {
  if (!raw) {
    return {
      team: teamName,
      recentFormNote: 'No team stats available',
    }
  }

  const stats = raw.stats || {}
  const streak = stats?.streak || (stats?.recentRecord as string | undefined)
  const record = raw.wins != null && raw.losses != null ? `${raw.wins}-${raw.losses}` : undefined
  const ortg = toNumber(stats.offensiveRating ?? stats.ortg)
  const drtg = toNumber(stats.defensiveRating ?? stats.drtg)
  const pace = toNumber(stats.pace)
  const gpg = toNumber(stats.goalsForPerGame)
  const gaa = toNumber(stats.goalsAgainstPerGame)
  const ppg = toNumber(stats.pointsForPerGame ?? stats.pointsPerGame ?? stats.ppg)
  const papg = toNumber(stats.pointsAgainstPerGame ?? stats.pointsAllowedPerGame ?? stats.papg)
  const ypp = toNumber(stats.yardsPerPlay)
  const ppd = toNumber(stats.pointsPerDrive)

  const statPieces: string[] = []
  if (ortg != null && drtg != null) {
    statPieces.push(`ORtg ${ortg.toFixed(1)}`)
    statPieces.push(`DRtg ${drtg.toFixed(1)}`)
    if (pace != null) statPieces.push(`Pace ${pace.toFixed(1)}`)
  } else if (gpg != null || gaa != null) {
    if (gpg != null) statPieces.push(`GPG ${gpg.toFixed(2)}`)
    if (gaa != null) statPieces.push(`GAA ${gaa.toFixed(2)}`)
  } else {
    if (ppg != null) statPieces.push(`PPG ${ppg.toFixed(1)}`)
    if (papg != null) statPieces.push(`PAPG ${papg.toFixed(1)}`)
    if (ypp != null) statPieces.push(`YPP ${ypp.toFixed(2)}`)
    if (ppd != null) statPieces.push(`PPD ${ppd.toFixed(2)}`)
  }
  const statLine = statPieces.length ? statPieces.join(' | ') : undefined

  return {
    team: raw.team || teamName,
    record,
    rank: raw.rank,
    streak,
    recentFormNote: streak ? `Current streak: ${streak}` : undefined,
    statLine,
  }
}

async function loadInjuries({
  sport,
  homeTeam,
  awayTeam,
  supabase,
}: {
  sport: string
  homeTeam: string
  awayTeam: string
  supabase?: SupabaseClient<Database>
}): Promise<InjurySummary[]> {
  const normalizedHome = normalizeTeamName(homeTeam)
  const normalizedAway = normalizeTeamName(awayTeam)

  const mapRow = (entry: any): InjurySummary => ({
    player: entry.player_name || entry.player,
    team: entry.team_name || entry.team,
    status: entry.status,
    injury: entry.description || entry.injury || undefined,
    date: entry.source_updated_at || entry.date || entry.captured_at,
  })

  if (supabase) {
    try {
      const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 12).toISOString()
      const { data } = await supabase
        .from('injury_reports')
        .select('*')
        .eq('sport_key', sport)
        .or(
          `team_name.ilike.%${homeTeam}%,team_name.ilike.%${awayTeam}%`
        )
        .gte('captured_at', cutoff)
        .order('captured_at', { ascending: false })
        .limit(200)

      if (data && data.length > 0) {
        return data.map(mapRow)
      }
    } catch (error) {
      console.error('[CONTEXT] Failed to load cached injuries:', error)
    }
  }

  const provider = getSportProvider(sport)
  const live = await provider.getInjuryReports()
  return live.map(mapRow)
}

function summarizeInjuries(injuries: InjurySummary[], teamName: string, limit = 3) {
  return injuries
    .filter((injury) => normalizeTeamName(injury.team).includes(normalizeTeamName(teamName)))
    .slice(0, limit)
}

function summarizePace(entries: any[]): PaceSummary | null {
  if (!entries?.length) return null
  const games = entries.length
  const pace =
    entries.reduce((sum, entry) => sum + (entry.pace ?? 0), 0) / (games || 1)
  const off =
    entries.reduce((sum, entry) => sum + (entry.offensive_rating ?? 0), 0) / (games || 1)
  const def =
    entries.reduce((sum, entry) => sum + (entry.defensive_rating ?? 0), 0) / (games || 1)
  const net =
    entries.reduce((sum, entry) => sum + (entry.net_rating ?? 0), 0) / (games || 1)

  return {
    games,
    pace,
    offensive_rating: off,
    defensive_rating: def,
    net_rating: net,
  }
}

function formatMarketOutcome(outcome?: { name: string; price: number; point?: number }) {
  if (!outcome) return undefined
  const normalized = outcome.name?.toLowerCase() || ''
  const shouldShowSign = normalized !== 'over' && normalized !== 'under'
  const line =
    outcome.point != null
      ? `${outcome.name} ${shouldShowSign && outcome.point > 0 ? '+' : ''}${outcome.point}`
      : outcome.name
  return `${line} (${outcome.price > 0 ? '+' : ''}${outcome.price})`
}

async function tryLoadMarketSnapshot(
  supabase: SupabaseClient<Database> | undefined,
  sport: string,
  homeTeam: string,
  awayTeam: string
): Promise<MarketTrendSummary | undefined> {
  if (!supabase) return undefined
  try {
    const { data } = (await supabase
      .from('market_snapshots')
      .select('*')
      .eq('sport_key', sport)
      .ilike('game_description', `%${awayTeam}%${homeTeam}%`)
      .order('captured_at', { ascending: false })
      .limit(1)) as { data: MarketSnapshotRow[] | null }

    const snapshot = data && data.length > 0 ? data[0] : undefined
    if (!snapshot) return undefined

    return {
      gameDescription: snapshot.game_description,
      bestSpreadHome: snapshot.spread_home_line
        ? `${snapshot.spread_home_line > 0 ? '+' : ''}${snapshot.spread_home_line} (${snapshot.spread_home_odds})`
        : undefined,
      bestSpreadAway: snapshot.spread_away_line
        ? `${snapshot.spread_away_line > 0 ? '+' : ''}${snapshot.spread_away_line} (${snapshot.spread_away_odds})`
        : undefined,
      bestMoneylineHome: snapshot.moneyline_home
        ? `${snapshot.moneyline_home > 0 ? '+' : ''}${snapshot.moneyline_home}`
        : undefined,
      bestMoneylineAway: snapshot.moneyline_away
        ? `${snapshot.moneyline_away > 0 ? '+' : ''}${snapshot.moneyline_away}`
        : undefined,
      bestTotalOver:
        snapshot.total_line != null && snapshot.total_over_odds != null
          ? `Over ${snapshot.total_line} (${snapshot.total_over_odds > 0 ? '+' : ''}${snapshot.total_over_odds})`
          : undefined,
      bestTotalUnder:
        snapshot.total_line != null && snapshot.total_under_odds != null
          ? `Under ${snapshot.total_line} (${snapshot.total_under_odds > 0 ? '+' : ''}${snapshot.total_under_odds})`
          : undefined,
      notes: `Last captured ${new Date(snapshot.captured_at).toLocaleString()}`,
    }
  } catch (error) {
    console.error('[CONTEXT] Failed to load market snapshot:', error)
    return undefined
  }
}

async function tryLoadLiveMarket(
  sport: string,
  normalizedHome: string,
  normalizedAway: string,
  notes: string[]
) {
  try {
    const oddsData = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], {
      revalidateSeconds: 600,
      forceProvider: 'the-odds-api',
    })
    const targetGame = oddsData.find((game) => {
      const home = normalizeTeamName(game.home_team || '')
      const away = normalizeTeamName(game.away_team || '')
      return home.includes(normalizedHome) || normalizedHome.includes(home)
        ? away.includes(normalizedAway) || normalizedAway.includes(away)
        : false
    })

    if (!targetGame) {
      notes.push('No live odds found for this matchup to summarize market trends.')
      return undefined
    }

    const summary: MarketTrendSummary = {
      gameDescription: `${targetGame.away_team} @ ${targetGame.home_team}`,
      notes: `Captured ${new Date().toLocaleString()}`,
    }

    const spreads = targetGame.bookmakers
      .map((book) => ({
        book: book.title,
        market: book.markets.find((m) => m.key === 'spreads'),
      }))
      .filter((entry) => entry.market)

    if (spreads.length > 0) {
      const bestHome = spreads
        .map((entry) => entry.market!.outcomes.find((o) => normalizeTeamName(o.name) === normalizedHome))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      const bestAway = spreads
        .map((entry) => entry.market!.outcomes.find((o) => normalizeTeamName(o.name) === normalizedAway))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      summary.bestSpreadHome = formatMarketOutcome(bestHome)
      summary.bestSpreadAway = formatMarketOutcome(bestAway)
    }

    const moneyline = targetGame.bookmakers
      .map((book) => ({
        book: book.title,
        market: book.markets.find((m) => m.key === 'h2h'),
      }))
      .filter((entry) => entry.market)

    if (moneyline.length > 0) {
      const mlHome = moneyline
        .map((entry) => entry.market!.outcomes.find((o) => normalizeTeamName(o.name) === normalizedHome))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      const mlAway = moneyline
        .map((entry) => entry.market!.outcomes.find((o) => normalizeTeamName(o.name) === normalizedAway))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      summary.bestMoneylineHome = formatMarketOutcome(mlHome)
      summary.bestMoneylineAway = formatMarketOutcome(mlAway)
    }

    const totals = targetGame.bookmakers
      .map((book) => ({
        book: book.title,
        market: book.markets.find((m) => m.key === 'totals'),
      }))
      .filter((entry) => entry.market)

    if (totals.length > 0) {
      const overOutcome = totals
        .map((entry) => entry.market!.outcomes.find((o) => o.name?.toLowerCase() === 'over'))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      const underOutcome = totals
        .map((entry) => entry.market!.outcomes.find((o) => o.name?.toLowerCase() === 'under'))
        .filter(Boolean)
        .sort((a, b) => (b!.price || 0) - (a!.price || 0))[0]

      summary.bestTotalOver = formatMarketOutcome(overOutcome)
      summary.bestTotalUnder = formatMarketOutcome(underOutcome)
    }

    return summary
  } catch (error) {
    console.error('[CONTEXT] Failed to fetch market trends:', error)
    notes.push('Unable to fetch market trends right now.')
    return undefined
  }
}

export async function buildGameContext({
  sport,
  homeTeam,
  awayTeam,
  includeMarketTrends = true,
  supabase,
}: BuildContextParams): Promise<GameContextPayload> {
  const notes: string[] = []
  const provider = getSportProvider(sport)
  const normalizedHome = normalizeTeamName(homeTeam)
  const normalizedAway = normalizeTeamName(awayTeam)

  let recentFormRows: TeamRecentFormRow[] = []
  let splitsRows: TeamSplitRow[] = []
  let headToHeadRows: HeadToHeadRow[] = []

  if (supabase) {
    try {
      const { data } = await supabase
        .from('team_recent_form')
        .select('*')
        .eq('sport_key', sport)
        .or(`team_name.ilike.%${homeTeam}%,team_name.ilike.%${awayTeam}%`)
        .order('game_date', { ascending: false })
        .limit(10)
      recentFormRows = data || []
    } catch (error) {
      console.error(`[CONTEXT] Failed to fetch recent form for sport=${sport}, teams=[${homeTeam}, ${awayTeam}]:`, error)
    }

    try {
      const { data } = await supabase
        .from('team_splits')
        .select('*')
        .eq('sport_key', sport)
        .or(`team_name.ilike.%${homeTeam}%,team_name.ilike.%${awayTeam}%`)
        .order('captured_at', { ascending: false })
        .limit(4)
      splitsRows = data || []
    } catch (error) {
      console.error(`[CONTEXT] Failed to fetch splits for sport=${sport}, teams=[${homeTeam}, ${awayTeam}]:`, error)
    }

    try {
      const { data } = await supabase
        .from('head_to_head_results')
        .select('*')
        .eq('sport_key', sport)
        .or(
          `(team_one.ilike.%${homeTeam}%,team_two.ilike.%${awayTeam}%),(team_one.ilike.%${awayTeam}%,team_two.ilike.%${homeTeam}%)`
        )
        .order('matchup_date', { ascending: false })
        .limit(5)
      headToHeadRows = data || []
    } catch (error) {
      console.error(`[CONTEXT] Failed to fetch head-to-head for sport=${sport}, teams=[${homeTeam}, ${awayTeam}]:`, error)
    }
  }

  const [injuryFeed, teamStats] = await Promise.all([
    loadInjuries({ sport, homeTeam, awayTeam, supabase }).catch((error) => {
      console.error('[CONTEXT] Failed to fetch injury reports:', error)
      notes.push('Injury feed unavailable.')
      return []
    }),
    provider.getTeamStats().catch((error) => {
      console.error('[CONTEXT] Failed to fetch team stats:', error)
      notes.push('Team stats unavailable.')
      return []
    }),
  ])

  const injuriesHome = summarizeInjuries(injuryFeed, homeTeam)
  const injuriesAway = summarizeInjuries(injuryFeed, awayTeam)
  const injuries = [...injuriesHome, ...injuriesAway]

  const teamSummaries: TeamContextSummary[] = []
  const homeStats = teamStats.find((team) => normalizeTeamName(team.team).includes(normalizedHome))
  const awayStats = teamStats.find((team) => normalizeTeamName(team.team).includes(normalizedAway))
  teamSummaries.push(summarizeTeamStats(homeStats, homeTeam))
  teamSummaries.push(summarizeTeamStats(awayStats, awayTeam))

  let marketTrends: MarketTrendSummary | undefined
  if (includeMarketTrends) {
    marketTrends =
      (await tryLoadMarketSnapshot(supabase, sport, homeTeam, awayTeam)) ||
      (await tryLoadLiveMarket(sport, normalizedHome, normalizedAway, notes))
  }

  if (injuries.length === 0) {
    notes.push('No injury updates available for these teams.')
  }

  const recentHome = recentFormRows.filter(
    (row) => normalizeTeamName(row.team_name) === normalizedHome
  )
  const recentAway = recentFormRows.filter(
    (row) => normalizeTeamName(row.team_name) === normalizedAway
  )

  const splitsHome = splitsRows.filter(
    (row) => normalizeTeamName(row.team_name) === normalizedHome
  )
  const splitsAway = splitsRows.filter(
    (row) => normalizeTeamName(row.team_name) === normalizedAway
  )

  return {
    sport,
    homeTeam,
    awayTeam,
    injuries,
    teamSummaries,
    marketTrends,
    recentForm: {
      home: recentHome,
      away: recentAway,
    },
    paceEfficiency: {
      home: summarizePace(recentHome),
      away: summarizePace(recentAway),
    },
    homeAwaySplits: {
      home: splitsHome,
      away: splitsAway,
    },
    headToHead: headToHeadRows,
    notes,
  }
}

