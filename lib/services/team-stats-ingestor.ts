import { getTeamStats, TeamStats as ProviderTeamStats } from '@/lib/sports-stats-api'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'

type TeamStatsRow = Database['public']['Tables']['team_stats']['Insert']
type TeamTrendRow = Database['public']['Tables']['team_trends']['Insert']

const SPORT_CONFIG = [
  { sportKey: 'basketball_nba', league: 'NBA' },
  { sportKey: 'americanfootball_nfl', league: 'NFL' },
  { sportKey: 'baseball_mlb', league: 'MLB' },
  { sportKey: 'icehockey_nhl', league: 'NHL' },
] as const

const MULTI_YEAR_SPORTS = new Set(['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl'])
const CHUNK_SIZE = 500

interface IngestOptions {
  sports?: string[]
}

export interface TeamStatsIngestSummary {
  sportKey: string
  league: string
  teamsProcessed: number
  statsInserted: number
  trendsInserted: number
}

export interface TeamStatsIngestResult {
  capturedAt: string
  summaries: TeamStatsIngestSummary[]
  totalTeams: number
  totalStatsInserted: number
  totalTrendsInserted: number
}

export async function ingestTeamStats(options: IngestOptions = {}): Promise<TeamStatsIngestResult> {
  const supabase = createServiceClient()
  const capturedAt = new Date().toISOString()
  const targetSports = (options.sports && options.sports.length > 0)
    ? SPORT_CONFIG.filter((config) => options.sports!.includes(config.sportKey))
    : SPORT_CONFIG

  const summaries: TeamStatsIngestSummary[] = []
  let totalStatsInserted = 0
  let totalTrendsInserted = 0
  let totalTeams = 0

  for (const config of targetSports) {
    console.log(`[TEAM-STATS] Fetching ${config.sportKey}`)
    const teams = await getTeamStats(config.sportKey)

    if (!teams.length) {
      console.warn(`[TEAM-STATS] No data returned for ${config.sportKey}`)
      summaries.push({
        sportKey: config.sportKey,
        league: config.league,
        teamsProcessed: 0,
        statsInserted: 0,
        trendsInserted: 0,
      })
      continue
    }

    const teamStatsRows: TeamStatsRow[] = []
    const teamTrendRows: TeamTrendRow[] = []

    for (const team of teams) {
      const statsRow = buildTeamStatsRow(team, config.sportKey, config.league, capturedAt)
      teamStatsRows.push(statsRow)
      teamTrendRows.push(...buildTrendRows(team, config.sportKey, config.league, capturedAt))
    }

    await insertRows(supabase, 'team_stats', teamStatsRows)
    await insertRows(supabase, 'team_trends', teamTrendRows)

    summaries.push({
      sportKey: config.sportKey,
      league: config.league,
      teamsProcessed: teams.length,
      statsInserted: teamStatsRows.length,
      trendsInserted: teamTrendRows.length,
    })

    totalTeams += teams.length
    totalStatsInserted += teamStatsRows.length
    totalTrendsInserted += teamTrendRows.length
  }

  return {
    capturedAt,
    summaries,
    totalTeams,
    totalStatsInserted,
    totalTrendsInserted,
  }
}

function buildTeamStatsRow(
  team: ProviderTeamStats,
  sportKey: string,
  league: string,
  capturedAt: string
): TeamStatsRow {
  const gamesPlayed = toNumber(team.stats?.gamesPlayed)
  const scoringTotal = firstNumber([
    team.stats?.pointsFor,
    team.stats?.runsScored,
    team.stats?.goalsFor,
  ])
  const allowedTotal = firstNumber([
    team.stats?.pointsAgainst,
    team.stats?.runsAllowed,
    team.stats?.goalsAgainst,
  ])

  const pointsPerGame = computePerGame(scoringTotal, gamesPlayed)
  const pointsAllowedPerGame = computePerGame(allowedTotal, gamesPlayed)
  const pace = (pointsPerGame != null && pointsAllowedPerGame != null)
    ? pointsPerGame + pointsAllowedPerGame
    : null
  const netRating = (pointsPerGame != null && pointsAllowedPerGame != null)
    ? pointsPerGame - pointsAllowedPerGame
    : null
  const offensiveRating = pointsPerGame
  const defensiveRating = pointsAllowedPerGame
  const streak = typeof team.stats?.streak === 'string' ? team.stats?.streak : null
  const trendTags = deriveTrendTags(toNumber(team.winPct), streak)

  return {
    sport_key: sportKey,
    league,
    team_name: team.team,
    season: getSeasonLabel(sportKey, capturedAt),
    wins: toNumber(team.wins),
    losses: toNumber(team.losses),
    home_record: null,
    away_record: null,
    ats_record: null,
    over_under_record: null,
    points_per_game: pointsPerGame,
    points_allowed_per_game: pointsAllowedPerGame,
    pace,
    offensive_rating: offensiveRating,
    defensive_rating: defensiveRating,
    net_rating: netRating,
    recent_streak: streak,
    trend_tags: trendTags.length ? trendTags : null,
    provider_team_id: null,
    captured_at: capturedAt,
  }
}

function buildTrendRows(
  team: ProviderTeamStats,
  sportKey: string,
  league: string,
  capturedAt: string
): TeamTrendRow[] {
  const gamesPlayed = toNumber(team.stats?.gamesPlayed)
  const winPct = toNumber(team.winPct)
  const streak = typeof team.stats?.streak === 'string' ? team.stats?.streak : null
  const scoringTotal = firstNumber([
    team.stats?.pointsFor,
    team.stats?.runsScored,
    team.stats?.goalsFor,
  ])
  const allowedTotal = firstNumber([
    team.stats?.pointsAgainst,
    team.stats?.runsAllowed,
    team.stats?.goalsAgainst,
  ])
  const pointsPerGame = computePerGame(scoringTotal, gamesPlayed)
  const pointsAllowedPerGame = computePerGame(allowedTotal, gamesPlayed)
  const netRating = (pointsPerGame != null && pointsAllowedPerGame != null)
    ? pointsPerGame - pointsAllowedPerGame
    : null

  const seasonSummary = [
    `${team.wins ?? 0}-${team.losses ?? 0}`,
    winPct != null ? `${(winPct * 100).toFixed(1)}%` : null,
    streak ? `Streak ${streak}` : null,
  ].filter(Boolean).join(' | ')

  const trendRows: TeamTrendRow[] = [
    {
      sport_key: sportKey,
      league,
      team_name: team.team,
      trend_type: 'season',
      trend_window: 'season',
      trend_summary: `${team.team}: ${seasonSummary}`,
      metrics: {
        wins: toNumber(team.wins),
        losses: toNumber(team.losses),
        winPct,
        gamesPlayed,
        streak,
        rank: toNumber(team.rank),
      },
      provider_team_id: null,
      captured_at: capturedAt,
    },
  ]

  if (pointsPerGame != null || pointsAllowedPerGame != null) {
    trendRows.push({
      sport_key: sportKey,
      league,
      team_name: team.team,
      trend_type: 'scoring',
      trend_window: 'season',
      trend_summary: `${team.team}: ${formatNumber(pointsPerGame)} PF / ${formatNumber(pointsAllowedPerGame)} PA`,
      metrics: {
        pointsPerGame,
        pointsAllowedPerGame,
        netRating,
      },
      provider_team_id: null,
      captured_at: capturedAt,
    })
  }

  return trendRows
}

async function insertRows(
  supabase: ReturnType<typeof createServiceClient>,
  table: 'team_stats' | 'team_trends',
  rows: TeamStatsRow[] | TeamTrendRow[]
) {
  if (!rows.length) {
    return
  }

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE)
    const { error } = await supabase.from(table).insert(chunk as any)
    if (error) {
      console.error(`[TEAM-STATS] Failed inserting chunk for ${table}:`, error.message)
      throw error
    }
  }
}

function getSeasonLabel(sportKey: string, capturedAt: string): string {
  const reference = new Date(capturedAt)
  const year = reference.getUTCFullYear()
  const month = reference.getUTCMonth() + 1

  if (MULTI_YEAR_SPORTS.has(sportKey)) {
    const seasonStartYear = month < 7 ? year - 1 : year
    const nextYear = String(seasonStartYear + 1)
    return `${seasonStartYear}-${nextYear.slice(-2)}`
  }

  return `${year}`
}

function deriveTrendTags(winPct: number | null, streak: string | null): string[] {
  const tags: string[] = []

  if (winPct != null) {
    if (winPct >= 0.6) tags.push('hot')
    if (winPct <= 0.4) tags.push('cold')
  }

  if (streak) {
    if (/^W\d+/i.test(streak)) tags.push('streaking_up')
    if (/^L\d+/i.test(streak)) tags.push('streaking_down')
  }

  return Array.from(new Set(tags))
}

function computePerGame(total: number | null, games: number | null): number | null {
  if (total == null || games == null || games <= 0) {
    return null
  }
  const value = total / games
  return Number.isFinite(value) ? Number(value.toFixed(3)) : null
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function firstNumber(values: Array<unknown>): number | null {
  for (const value of values) {
    const parsed = toNumber(value)
    if (parsed != null) {
      return parsed
    }
  }
  return null
}

function formatNumber(value: number | null): string {
  if (value == null) return '--'
  return value.toFixed(1)
}
