/**
 * Capture live player prop lines for supported sports.
 * Run with:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest-player-props.ts
 */

import 'dotenv/config'
import { fetchOdds } from '@/lib/api/odds-api'
import { createServiceClient } from '@/lib/supabase/service'

const SPORT_PROP_MARKETS: Record<string, string[]> = {
  basketball_nba: ['player_points', 'player_rebounds', 'player_assists', 'player_threes'],
  americanfootball_nfl: ['player_pass_tds', 'player_pass_yds', 'player_rush_yds', 'player_receptions'],
  baseball_mlb: ['player_hits', 'player_total_bases', 'player_rbis', 'player_runs_scored'],
  icehockey_nhl: ['player_points', 'player_shots_on_goal', 'player_blocked_shots'],
}

type PropEntry = {
  sport_key: string
  event_id: string
  player_name: string
  team_name?: string | null
  market_key: string
  line: number | null
  over_odds: number | null
  under_odds: number | null
  book: string
  captured_at: string
}

const stripPlayerName = (value?: string | null) => {
  if (!value) return ''
  return value.replace(/\b(over|under)\b.*$/i, '').trim()
}

const detectDirection = (label: string, index: number): 'over' | 'under' => {
  const normalized = label.toLowerCase()
  if (normalized.includes('under') || normalized.includes('less')) return 'under'
  if (normalized.includes('over') || normalized.includes('more')) return 'over'
  return index === 0 ? 'over' : 'under'
}

async function capturePlayerProps() {
  const supabase = createServiceClient()
  const captured_at = new Date().toISOString()

  for (const [sport, markets] of Object.entries(SPORT_PROP_MARKETS)) {
    console.log(`[PROPS] Fetching ${sport} markets: ${markets.join(', ')}`)

    const games = await fetchOdds(sport, markets, { live: true })
    const rows: PropEntry[] = []
    const propMap = new Map<string, PropEntry>()

    for (const game of games) {
      for (const bookmaker of game.bookmakers) {
        for (const market of bookmaker.markets) {
          if (!market.key.startsWith('player_')) continue

          market.outcomes.forEach((outcome, index) => {
            const label = `${outcome.name || ''} ${outcome.description || ''}`.trim()
            const playerName = stripPlayerName(label) || outcome.name || 'Unknown Player'
            const direction = detectDirection(label || '', index)
            const key = [
              sport,
              game.id,
              bookmaker.title,
              market.key,
              playerName,
            ].join('|')

            if (!propMap.has(key)) {
              propMap.set(key, {
                sport_key: sport,
                event_id: String(game.id),
                player_name: playerName,
                team_name: undefined,
                market_key: market.key,
                line: outcome.point ?? null,
                over_odds: null,
                under_odds: null,
                book: bookmaker.title,
                captured_at,
              })
            }

            const entry = propMap.get(key)!
            if (outcome.point != null) {
              entry.line = outcome.point
            }
            if (direction === 'over') {
              entry.over_odds = outcome.price ?? entry.over_odds
            } else {
              entry.under_odds = outcome.price ?? entry.under_odds
            }
          })
        }
      }
    }

    rows.push(...propMap.values())

    if (!rows.length) {
      console.log(`[PROPS] No prop rows captured for ${sport}`)
      continue
    }

    console.log(`[PROPS] Inserting ${rows.length} prop rows for ${sport}`)
    const chunkSize = 500
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const { error } = await supabase.from('player_prop_snapshots').insert(chunk)
      if (error) {
        console.error(`[PROPS] Failed to insert prop chunk for ${sport}:`, error.message)
        throw error
      }
    }
  }

  console.log('[PROPS] Completed player prop ingestion')
}

capturePlayerProps().catch((error) => {
  console.error('[PROPS] Player prop ingestion failed:', error)
  process.exit(1)
})
