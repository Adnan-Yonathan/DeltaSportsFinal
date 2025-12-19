/**
 * Test if BPM data is being parsed for Anthony Edwards
 */

import { getPlayerStats } from './lib/services/matchup-analyzer'

async function test() {
  console.log('Testing BPM data for Anthony Edwards...\n')

  const edwards = getPlayerStats('Anthony Edwards', 'points')

  if (!edwards) {
    console.log('❌ Anthony Edwards not found')
    return
  }

  console.log('✅ Found Anthony Edwards')
  console.log(`PPG: ${edwards.seasonAverage}`)
  console.log(`Usage: ${edwards.usage}%`)
  console.log(`MPG: ${edwards.minutesPerGame}`)
  console.log(`\nAdvanced stats:`)
  console.log(`BPM: ${edwards.bpm}`)
  console.log(`OBPM: ${edwards.obpm}`)
  console.log(`DBPM: ${edwards.dbpm}`)
  console.log(`VORP: ${edwards.vorp}`)
  console.log(`PER: ${edwards.per}`)
  console.log(`WS/48: ${edwards.ws48}`)

  // Test a few more players
  console.log('\n' + '='.repeat(40))
  console.log('Testing Ja Morant...\n')

  const morant = getPlayerStats('Ja Morant', 'points')

  if (morant) {
    console.log('✅ Found Ja Morant')
    console.log(`PPG: ${morant.seasonAverage}`)
    console.log(`BPM: ${morant.bpm}`)
    console.log(`OBPM: ${morant.obpm}`)
    console.log(`DBPM: ${morant.dbpm}`)
    console.log(`VORP: ${morant.vorp}`)
  }
}

test()
