import { detectEdges, formatEdgeResults, SHARP_THRESHOLDS } from '../lib/services/edge-detection'

async function main() {
  console.log('=== Edge Detection Test ===\n')
  console.log('Sharp Thresholds by Sport:')
  for (const [sport, thresholds] of Object.entries(SHARP_THRESHOLDS)) {
    console.log(`  ${sport.toUpperCase()}: spread ${thresholds.spread.min}-${thresholds.spread.significant}pts, total ${thresholds.total.min}-${thresholds.total.significant}pts, ML ${thresholds.moneyline.min}-${thresholds.moneyline.significant}¢`)
  }
  console.log('')

  const results = await detectEdges(['nba', 'nfl', 'nhl'])

  console.log('\n' + '='.repeat(80))
  console.log(`RESULTS: ${results.length} games analyzed`)
  console.log('='.repeat(80) + '\n')

  const edgeGames = results.filter(r => r.hasEdge)
  console.log(`Games with edges: ${edgeGames.length}\n`)

  for (const game of edgeGames.slice(0, 15)) {
    console.log(`${game.awayTeam} @ ${game.homeTeam} (${game.sport.toUpperCase()})`)
    console.log(`  Edge: ${game.edgeSide} ${game.edgeMarket} | Strength: ${'🔥'.repeat(game.edgeStrength)}`)
    console.log(`  Summary: ${game.summary}`)

    if (game.lineMovements.length > 0) {
      console.log('  Line Movement:')
      for (const m of game.lineMovements) {
        if (m.movement !== 0) {
          console.log(`    ${m.market}: ${m.openingLine} → ${m.currentLine} (${m.movement > 0 ? '+' : ''}${m.movement.toFixed(1)}) ${m.isSharp ? '⚡SHARP' : ''} ${m.isSignificant ? '🔥SIGNIFICANT' : ''}`)
        }
      }
    }

    if (game.splits.spreadHomeBetPct != null) {
      console.log(`  Splits: Spread ${game.splits.spreadHomeBetPct}%/${game.splits.spreadAwayBetPct}% bets, ${game.splits.spreadHomeMoneyPct}%/${game.splits.spreadAwayMoneyPct}% money`)
    }

    console.log(`  Signals: ${game.sharpSignals.map(s => `${s.type}(${s.side})`).join(', ')}`)
    console.log('')
  }
}

main()
