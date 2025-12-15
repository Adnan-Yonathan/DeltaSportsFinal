import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkScrapedGames() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { data, error } = await supabase
    .from('public_betting_splits')
    .select('game_id, home_team, away_team, game_time, market_type, captured_at')
    .gte('captured_at', today.toISOString())
    .order('captured_at', { ascending: false })

  if (error) {
    console.error('Error:', error)
    return
  }

  console.log(`\nFound ${data.length} betting splits entries from today:\n`)

  // Group by game
  const gameMap = new Map<string, any[]>()
  data.forEach(row => {
    if (!gameMap.has(row.game_id)) {
      gameMap.set(row.game_id, [])
    }
    gameMap.get(row.game_id)!.push(row)
  })

  console.log(`Unique games: ${gameMap.size}\n`)

  gameMap.forEach((markets, gameId) => {
    const firstMarket = markets[0]
    console.log(`${firstMarket.away_team} @ ${firstMarket.home_team}`)
    console.log(`  Game ID: ${gameId}`)
    console.log(`  Game Time: ${firstMarket.game_time || 'NULL'}`)
    console.log(`  Markets: ${markets.map(m => m.market_type).join(', ')}`)
    console.log(`  Captured: ${firstMarket.captured_at}`)
    console.log('')
  })
}

checkScrapedGames().catch(console.error)
