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
  notes: string[]
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

function formatMarketOutcome(outcome?: { name: string; price: number; point?: number }) {
  if (!outcome) return undefined
  const line = outcome.point != null ? `${outcome.name} ${outcome.point > 0 ? '+' : ''}${outcome.point}` : outcome.name
  return `${line} (${outcome.price > 0 ? '+' : ''}${outcome.price})`
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

  const [injuryFeed, teamStats] = await Promise.all([
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
    try {
      const oddsData = await fetchOdds(sport, ['h2h', 'spreads'])
      const targetGame = oddsData.find((game) => {
        const home = normalizeTeamName(game.home_team || '')
        const away = normalizeTeamName(game.away_team || '')
        return home.includes(normalizedHome) || normalizedHome.includes(home)
          ? away.includes(normalizedAway) || normalizedAway.includes(away)
          : false
      })

      if (targetGame) {
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

        marketTrends = summary
      } else {
        notes.push('No live odds found for this matchup to summarize market trends.')
      }
    } catch (error) {
      console.error('[CONTEXT] Failed to fetch market trends:', error)
      notes.push('Unable to fetch market trends right now.')
    }
  }

  if (injuries.length === 0) {
    notes.push('No injury updates available for these teams.')
  }

  return {
    sport,
    homeTeam,
    awayTeam,
    injuries,
    teamSummaries,
    marketTrends,
    notes,
  }
}
