/**
 * Ingest recent team performance logs for major sports (NBA, NCAAB, NFL, NCAAF, MLB, NHL) into Supabase.
 *
 * Run with:
 *   npx ts-node scripts/ingest-recent-form.ts
 */

import 'dotenv/config'
import { createServiceClient } from '@/lib/supabase/service'
import type { Database } from '@/lib/supabase/types'

const SPORT_CONFIGS = [
  { sportKey: 'basketball_nba', path: 'basketball/nba' },
  { sportKey: 'basketball_ncaab', path: 'basketball/mens-college-basketball' },
  { sportKey: 'americanfootball_nfl', path: 'americanfootball/nfl' },
  { sportKey: 'americanfootball_ncaaf', path: 'americanfootball/college-football' },
  { sportKey: 'baseball_mlb', path: 'baseball/mlb' },
  { sportKey: 'icehockey_nhl', path: 'hockey/nhl' },
]

type RecentFormRow = Database['public']['Tables']['team_recent_form']['Insert']
type TeamSplitRow = Database['public']['Tables']['team_splits']['Insert']
type HeadToHeadRow = Database['public']['Tables']['head_to_head_results']['Insert']

interface RecentGame {
  sportKey: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  date: string
}

async function fetchRecentGames(config: { sportKey: string; path: string }, days = 7): Promise<RecentGame[]> {
  const games: RecentGame[] = []
  const today = new Date()
  const baseUrl = `https://site.api.espn.com/apis/site/v2/sports/${config.path}/scoreboard`

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateParam = date.toISOString().slice(0, 10).replace(/-/g, '')
    const url = `${baseUrl}?dates=${dateParam}`

    try {
      const response = await fetch(url)
      if (!response.ok) {
        console.warn(`[INGEST][${config.sportKey}] Failed to load scoreboard for ${dateParam}`)
        continue
      }

      const data = await response.json()
      for (const event of data.events || []) {
        const competition = event.competitions?.[0]
        const competitors = competition?.competitors
        if (!competition || !competitors) continue

        const home = competitors.find((c: any) => c.homeAway === 'home')
        const away = competitors.find((c: any) => c.homeAway === 'away')
        if (!home || !away) continue

        games.push({
          sportKey: config.sportKey,
          homeTeam: home.team?.displayName,
          awayTeam: away.team?.displayName,
          homeScore: Number(home.score),
          awayScore: Number(away.score),
          date: competition.date || event.date,
        })
      }
    } catch (error) {
      console.error(`[INGEST][${config.sportKey}] Error fetching games for ${dateParam}:`, error)
    }
  }

  return games
}

function computeEntry(game: RecentGame, team: 'home' | 'away'): RecentFormRow {
  const isHome = team === 'home'
  const teamName = isHome ? game.homeTeam : game.awayTeam
  const opponent = isHome ? game.awayTeam : game.homeTeam
  const pointsFor = isHome ? game.homeScore : game.awayScore
  const pointsAgainst = isHome ? game.awayScore : game.homeScore
  const result = pointsFor > pointsAgainst ? 'W' : pointsFor < pointsAgainst ? 'L' : 'T'
  const pace = pointsFor + pointsAgainst
  const offensiveRating = pointsFor
  const defensiveRating = pointsAgainst
  const netRating = offensiveRating - defensiveRating

  return {
    sport_key: game.sportKey,
    team_name: teamName,
    game_date: game.date ? new Date(game.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    opponent,
    is_home: isHome,
    result,
    points_for: pointsFor,
    points_against: pointsAgainst,
    pace,
    offensive_rating: offensiveRating,
    defensive_rating: defensiveRating,
    net_rating: netRating,
    captured_at: new Date().toISOString(),
  }
}

async function ingestRecentForm() {
  const supabase = createServiceClient()
  for (const config of SPORT_CONFIGS) {
    const games = await fetchRecentGames(config, 7)
    if (!games.length) {
      console.warn(`[INGEST][FORM] No games fetched for ${config.sportKey}`)
      continue
    }

  const rows = games.flatMap<RecentFormRow>((game) => [computeEntry(game, 'home'), computeEntry(game, 'away')])

    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize) as Database['public']['Tables']['team_recent_form']['Insert'][]
    // @ts-expect-error - TypeScript struggles with upsert type inference in Node module resolution
    const { error } = await supabase.from('team_recent_form').upsert(chunk, {
      onConflict: 'sport_key,team_name,game_date,opponent',
      })
      if (error) {
        console.error(`[INGEST][FORM] Failed to upsert chunk for ${config.sportKey}:`, error.message)
        throw error
      }
    }

    console.log(`[INGEST][FORM] Stored ${rows.length} rows of ${config.sportKey} recent form data`)

    await updateSplits(supabase, rows)
    await recordHeadToHead(supabase, games)
  }
}

async function updateSplits(
  supabase: ReturnType<typeof createServiceClient>,
  rows: RecentFormRow[]
) {
  const grouped: Record<string, RecentFormRow[]> = {}
  for (const row of rows) {
    const key = `${row.sport_key}::${row.team_name}::${row.is_home ? 'home' : 'away'}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }

  const payload: TeamSplitRow[] = Object.entries(grouped).map(([key, entries]) => {
    const [sportKey, team, context] = key.split('::')
    const gamesPlayed = entries.length
    const wins = entries.filter((e) => e.result === 'W').length
    const winPct = gamesPlayed ? wins / gamesPlayed : null
    const avgFor =
      gamesPlayed ? entries.reduce((sum, e) => sum + (e.points_for || 0), 0) / gamesPlayed : null
    const avgAgainst =
      gamesPlayed
        ? entries.reduce((sum, e) => sum + (e.points_against || 0), 0) / gamesPlayed
        : null
    const avgOff =
      gamesPlayed ? entries.reduce((sum, e) => sum + (e.offensive_rating || 0), 0) / gamesPlayed : null
    const avgDef =
      gamesPlayed ? entries.reduce((sum, e) => sum + (e.defensive_rating || 0), 0) / gamesPlayed : null
    const avgNet =
      gamesPlayed ? entries.reduce((sum, e) => sum + (e.net_rating || 0), 0) / gamesPlayed : null

    return {
      sport_key: sportKey,
      team_name: team,
      context,
      games_played: gamesPlayed,
      win_pct: winPct,
      points_for: avgFor,
      points_against: avgAgainst,
      offensive_rating: avgOff,
      defensive_rating: avgDef,
      net_rating: avgNet,
      captured_at: new Date().toISOString(),
    }
  })

  if (payload.length) {
    // @ts-expect-error - TypeScript struggles with upsert type inference in Node module resolution
    const { error } = await supabase.from('team_splits').upsert(payload as Database['public']['Tables']['team_splits']['Insert'][], {
      onConflict: 'sport_key,team_name,context',
    })
    if (error) {
      console.error('[INGEST][SPLITS] Failed to upsert splits:', error.message)
      throw error
    }
    console.log(`[INGEST][SPLITS] Updated ${payload.length} team splits entries`)
  }
}

async function recordHeadToHead(
  supabase: ReturnType<typeof createServiceClient>,
  games: RecentGame[]
) {
  if (!games.length) return

  const payload: HeadToHeadRow[] = games.map((game) => ({
    sport_key: game.sportKey,
    team_one: game.homeTeam,
    team_two: game.awayTeam,
    matchup_date: game.date ? new Date(game.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    winner: game.homeScore > game.awayScore ? game.homeTeam : game.awayScore > game.homeScore ? game.awayTeam : null,
    pace: null,
    notes: `${game.homeScore}-${game.awayScore}`,
    captured_at: new Date().toISOString(),
  }))

  const chunkSize = 500
  for (let i = 0; i < payload.length; i += chunkSize) {
    const chunk = payload.slice(i, i + chunkSize) as Database['public']['Tables']['head_to_head_results']['Insert'][]
    // @ts-expect-error - TypeScript struggles with upsert type inference in Node module resolution
    const { error } = await supabase.from('head_to_head_results').upsert(chunk, {
      onConflict: 'sport_key,team_one,team_two,matchup_date',
    })
    if (error) {
      console.error('[INGEST][H2H] Failed to upsert chunk:', error.message)
      throw error
    }
  }

  console.log(`[INGEST][H2H] Logged ${payload.length} head-to-head rows`)
}

ingestRecentForm()
  .then(() => {
    console.log('[INGEST][FORM] Completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[INGEST][FORM] Failed:', error)
    process.exit(1)
  })
