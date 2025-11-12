import { SupabaseClient } from '@supabase/supabase-js'
import { fetchOdds } from '@/lib/api/odds-api'
import { getInjuryReports, getTeamStats } from '@/lib/sports-stats-api'
import { Database } from '@/lib/supabase/types'

export interface TeamContextSummary {
  team: string
  record?: string
  rank?: number
  streak?: string
  recentFormNote?: string
  homeAwayNote?: string
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
    home: any[]
    away: any[]
  }
  paceEfficiency?: {
    home: PaceSummary | null
    away: PaceSummary | null
  }
  homeAwaySplits?: {
    home: any[]
    away: any[]
  }
  headToHead?: any[]
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
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function summarizeTeamStats(raw: any, teamName: string): TeamContextSummary {
  if (!raw) {
    return {
      team: teamName,
      recentFormNote: 'No team stats available',
    }
  }

  const streak = raw.stats?.streak || (raw.stats?.recentRecord as string | undefined)
  const record = raw.wins != null && raw.losses != null ? `${raw.wins}-${raw.losses}` : undefined

  return {
    team: raw.team || teamName,
    record,
    rank: raw.rank,
    streak,
    recentFormNote: streak ? `Current streak: ${streak}` : undefined,
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
          `team_name.ilike.${homeTeam.replace(/ /g, '%')}%,team_name.ilike.${awayTeam.replace(/ /g, '%')}%`
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

  const live = await getInjuryReports(sport)
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
  const line = outcome.point != null ? `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}` : outcome.name
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
    const { data } = await supabase
      .from('market_snapshots')
      .select('*')
      .eq('sport_key', sport)
      .ilike('game_description', `%${awayTeam}%${homeTeam}%`)
      .order('captured_at', { ascending: false })
      .limit(1)

    const snapshot = data?.[0]
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
    const oddsData = await fetchOdds(sport, ['h2h', 'spreads'])
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
  const normalizedHome = normalizeTeamName(homeTeam)
  const normalizedAway = normalizeTeamName(awayTeam)

  const recentFormPromise = supabase
    ? supabase
        .from('team_recent_form')
        .select('*')
        .eq('sport_key', sport)
        .in('team_name', [homeTeam, awayTeam])
        .order('game_date', { ascending: false })
        .limit(10)
        .then(({ data }) => data || [])
        .catch((error) => {
          console.error('[CONTEXT] Failed to fetch recent form:', error)
          return []
        })
    : Promise.resolve([])

  const splitsPromise = supabase
    ? supabase
        .from('team_splits')
        .select('*')
        .eq('sport_key', sport)
        .in('team_name', [homeTeam, awayTeam])
        .order('captured_at', { ascending: false })
        .limit(4)
        .then(({ data }) => data || [])
        .catch((error) => {
          console.error('[CONTEXT] Failed to fetch splits:', error)
          return []
        })
    : Promise.resolve([])

  const headToHeadPromise = supabase
    ? supabase
        .from('head_to_head_results')
        .select('*')
        .eq('sport_key', sport)
        .or(
          `(team_one.ilike.${homeTeam},team_two.ilike.${awayTeam}),(team_one.ilike.${awayTeam},team_two.ilike.${homeTeam})`
        )
        .order('matchup_date', { ascending: false })
        .limit(5)
        .then(({ data }) => data || [])
        .catch((error) => {
          console.error('[CONTEXT] Failed to fetch head-to-head:', error)
          return []
        })
    : Promise.resolve([])

  const [injuryFeed, teamStats, recentFormRows, splitsRows, headToHeadRows] = await Promise.all([
    loadInjuries({ sport, homeTeam, awayTeam, supabase }).catch((error) => {
      console.error('[CONTEXT] Failed to fetch injury reports:', error)
      notes.push('Injury feed unavailable.')
      return []
    }),
    getTeamStats(sport).catch((error) => {
      console.error('[CONTEXT] Failed to fetch team stats:', error)
      notes.push('Team stats unavailable.')
      return []
    }),
    recentFormPromise,
    splitsPromise,
    headToHeadPromise,
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
