/**
 * Ingest recent team performance logs (example: NBA) into Supabase.
 *
 * Run with:
 *   npx ts-node scripts/ingest-recent-form.ts
 */

import 'dotenv/config'
import { createServiceClient } from '@/lib/supabase/service'

const NBA_SCOREBOARD_URL =
  'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard'

interface NBAGame {
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  date: string
}

async function fetchRecentNBAGames(days = 7): Promise<NBAGame[]> {
  const games: NBAGame[] = []
  const today = new Date()

  for (let i = 0; i < days; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateParam = date.toISOString().slice(0, 10).replace(/-/g, '')
    const url = `${NBA_SCOREBOARD_URL}?dates=${dateParam}`

    try {
      const response = await fetch(url, { next: { revalidate: 600 } })
      if (!response.ok) {
        console.warn(`[INGEST][NBA] Failed to load scoreboard for ${dateParam}`)
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
          homeTeam: home.team?.displayName,
          awayTeam: away.team?.displayName,
          homeScore: Number(home.score),
          awayScore: Number(away.score),
          date: competition.date || event.date,
        })
      }
    } catch (error) {
      console.error(`[INGEST][NBA] Error fetching games for ${dateParam}:`, error)
    }
  }

  return games
}

function computeEntry(game: NBAGame, team: 'home' | 'away') {
  const isHome = team === 'home'
  const teamName = isHome ? game.homeTeam : game.awayTeam
  const opponent = isHome ? game.awayTeam : game.homeTeam
  const pointsFor = isHome ? game.homeScore : game.awayScore
  const pointsAgainst = isHome ? game.awayScore : game.homeScore
  const result = pointsFor > pointsAgainst ? 'W' : pointsFor < pointsAgainst ? 'L' : 'T'

  return {
    sport_key: 'basketball_nba',
    team_name: teamName,
    game_date: game.date ? new Date(game.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    opponent,
    is_home: isHome,
    result,
    points_for: pointsFor,
    points_against: pointsAgainst,
    pace: null,
    offensive_rating: null,
    defensive_rating: null,
    net_rating: null,
    captured_at: new Date().toISOString(),
  }
}

async function ingestRecentForm() {
  const supabase = createServiceClient()
  const games = await fetchRecentNBAGames(7)

  if (!games.length) {
    console.warn('[INGEST][FORM] No games fetched')
    return
  }

  const rows = games.flatMap((game) => [computeEntry(game, 'home'), computeEntry(game, 'away')])

  const chunkSize = 500
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize)
    const { error } = await supabase.from('team_recent_form').upsert(chunk, {
      onConflict: 'team_name,game_date,opponent',
    })
    if (error) {
      console.error('[INGEST][FORM] Failed to upsert chunk:', error.message)
      throw error
    }
  }

  console.log(`[INGEST][FORM] Stored ${rows.length} rows of NBA recent form data`)

  await updateSplits(supabase, rows)
  await recordHeadToHead(supabase, games)
}

async function updateSplits(supabase: ReturnType<typeof createServiceClient>, rows: ReturnType<typeof computeEntry>[]) {
  const grouped: Record<string, ReturnType<typeof computeEntry>[]> = {}
  for (const row of rows) {
    const key = `${row.team_name}::${row.is_home ? 'home' : 'away'}`
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(row)
  }

  const payload = Object.entries(grouped).map(([key, entries]) => {
    const [team, context] = key.split('::')
    const gamesPlayed = entries.length
    const wins = entries.filter((e) => e.result === 'W').length
    const winPct = gamesPlayed ? wins / gamesPlayed : null
    const avgFor =
      gamesPlayed ? entries.reduce((sum, e) => sum + (e.points_for || 0), 0) / gamesPlayed : null
    const avgAgainst =
      gamesPlayed
        ? entries.reduce((sum, e) => sum + (e.points_against || 0), 0) / gamesPlayed
        : null

    return {
      sport_key: 'basketball_nba',
      team_name: team,
      context,
      games_played: gamesPlayed,
      win_pct: winPct,
      points_for: avgFor,
      points_against: avgAgainst,
      offensive_rating: null,
      defensive_rating: null,
      net_rating: null,
      captured_at: new Date().toISOString(),
    }
  })

  if (payload.length) {
    const { error } = await supabase.from('team_splits').upsert(payload, {
      onConflict: 'team_name,context',
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
  games: NBAGame[]
) {
  if (!games.length) return

  const payload = games.map((game) => ({
    sport_key: 'basketball_nba',
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
    const chunk = payload.slice(i, i + chunkSize)
    const { error } = await supabase.from('head_to_head_results').upsert(chunk, {
      onConflict: 'team_one,team_two,matchup_date',
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
