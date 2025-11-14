/**
 * Capture market snapshots for key sports.
 *
 * Run with:
 *   npx ts-node scripts/ingest-market-trends.ts
 */

import 'dotenv/config'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchOdds } from '@/lib/api/odds-api'

const SPORTS = ['basketball_nba', 'americanfootball_nfl', 'baseball_mlb', 'icehockey_nhl']

async function captureSnapshots() {
  const supabase = createServiceClient()
  const now = new Date().toISOString()

  for (const sport of SPORTS) {
    console.log(`[MARKETS] Fetching odds for ${sport}`)
    const games = await fetchOdds(sport, ['h2h', 'spreads', 'totals'], { live: true })

    const rows = games.map((game) => {
      const spreads = game.bookmakers
        .map((book) => ({
          book: book.title,
          market: book.markets.find((m) => m.key === 'spreads'),
        }))
        .filter((entry) => entry.market)

      const moneylines = game.bookmakers
        .map((book) => ({
          book: book.title,
          market: book.markets.find((m) => m.key === 'h2h'),
        }))
        .filter((entry) => entry.market)

      const totals = game.bookmakers
        .map((book) => ({
          book: book.title,
          market: book.markets.find((m) => m.key === 'totals'),
        }))
        .filter((entry) => entry.market)

      const bestHomeSpread = spreads
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name === game.home_team),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const bestAwaySpread = spreads
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name === game.away_team),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const bestHomeML = moneylines
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name === game.home_team),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const bestAwayML = moneylines
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name === game.away_team),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const bestOver = totals
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name?.toLowerCase() === 'over'),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const bestUnder = totals
        .map((entry) => ({
          ...entry,
          outcome: entry.market!.outcomes.find((o) => o.name?.toLowerCase() === 'under'),
        }))
        .filter((entry) => entry.outcome)
        .sort((a, b) => (b.outcome!.price || 0) - (a.outcome!.price || 0))[0]

      const totalLine =
        bestOver?.outcome?.point ??
        bestUnder?.outcome?.point ??
        (totals[0]?.market?.outcomes?.[0]?.point ?? null)

      return {
        sport_key: sport,
        game_id: game.id,
        game_description: `${game.away_team} @ ${game.home_team}`,
        captured_at: now,
        spread_home_line: bestHomeSpread?.outcome?.point ?? null,
        spread_home_odds: bestHomeSpread?.outcome?.price ?? null,
        spread_home_book: bestHomeSpread?.book ?? null,
        spread_away_line: bestAwaySpread?.outcome?.point ?? null,
        spread_away_odds: bestAwaySpread?.outcome?.price ?? null,
        spread_away_book: bestAwaySpread?.book ?? null,
        moneyline_home: bestHomeML?.outcome?.price ?? null,
        moneyline_home_book: bestHomeML?.book ?? null,
        moneyline_away: bestAwayML?.outcome?.price ?? null,
        moneyline_away_book: bestAwayML?.book ?? null,
        total_line: totalLine,
        total_over_odds: bestOver?.outcome?.price ?? null,
        total_over_book: bestOver?.book ?? null,
        total_under_odds: bestUnder?.outcome?.price ?? null,
        total_under_book: bestUnder?.book ?? null,
      }
    })

    if (rows.length) {
      const chunkSize = 500
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize)
        const { error } = await supabase.from('market_snapshots').insert(chunk)
        if (error) {
          console.error(`[MARKETS] Failed to store snapshot chunk for ${sport}:`, error.message)
          throw error
        }
      }
    }

    console.log(`[MARKETS] Stored ${rows.length} snapshots for ${sport}`)
  }
}

captureSnapshots()
  .then(() => {
    console.log('[MARKETS] Completed market snapshot ingestion')
    process.exit(0)
  })
  .catch((error) => {
    console.error('[MARKETS] Failed to ingest market snapshots:', error)
    process.exit(1)
  })
