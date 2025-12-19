/**
 * Test script for core calculation functions
 * Tests: Grizzlies @ Timberwolves
 */

import { getTeamStats, getTeamAbbrev } from './lib/services/matchup-analyzer'
import { calculateFairSpread, calculateFairTotal } from './lib/services/pregame-value-calculator'

async function test() {
  console.log('='.repeat(60))
  console.log('Testing: Grizzlies @ Timberwolves (Wolves at home)')
  console.log('='.repeat(60) + '\n')

  // Test team name resolution
  console.log('1. Testing team name resolution:')
  const wolvesAbbrev = getTeamAbbrev('Timberwolves')
  const grizzliesAbbrev = getTeamAbbrev('Grizzlies')
  console.log(`   Timberwolves -> ${wolvesAbbrev}`)
  console.log(`   Grizzlies -> ${grizzliesAbbrev}\n`)

  // Get team stats
  console.log('2. Loading team stats:')
  const wolvesStats = await getTeamStats('Timberwolves')
  const grizzliesStats = await getTeamStats('Grizzlies')

  if (!wolvesStats) {
    console.log('   ❌ Wolves stats not found')
    console.log('   Trying: MIN, Minnesota')
    const minStats = await getTeamStats('MIN')
    if (minStats) {
      console.log('   ✅ Found with "MIN"')
    }
  } else {
    console.log('   ✅ Wolves stats loaded:')
    console.log(`      ORtg: ${wolvesStats.ortg.toFixed(1)}`)
    console.log(`      DRtg: ${wolvesStats.drtg.toFixed(1)}`)
    console.log(`      Pace: ${wolvesStats.pace.toFixed(1)}`)
  }

  if (!grizzliesStats) {
    console.log('   ❌ Grizzlies stats not found')
    console.log('   Trying: MEM, Memphis')
    const memStats = await getTeamStats('MEM')
    if (memStats) {
      console.log('   ✅ Found with "MEM"')
    }
  } else {
    console.log('   ✅ Grizzlies stats loaded:')
    console.log(`      ORtg: ${grizzliesStats.ortg.toFixed(1)}`)
    console.log(`      DRtg: ${grizzliesStats.drtg.toFixed(1)}`)
    console.log(`      Pace: ${grizzliesStats.pace.toFixed(1)}`)
  }

  console.log('')

  // Calculate target lines (if we have stats)
  if (wolvesStats && grizzliesStats) {
    console.log('3. Calculating target lines:')

    const targetSpread = calculateFairSpread(
      wolvesStats, // home team
      grizzliesStats, // away team
      undefined, // no rest data for now
      undefined,
      undefined, // no travel data for now
      undefined
    )

    const targetTotal = calculateFairTotal(
      wolvesStats,
      grizzliesStats
    )

    console.log(`   Target Spread: Wolves ${targetSpread > 0 ? '+' : ''}${targetSpread.toFixed(1)}`)
    console.log(`   (Wolves favored by ${Math.abs(targetSpread).toFixed(1)} points)`)
    console.log(`   Target Total: ${targetTotal.toFixed(1)} points\n`)

    console.log('4. Breakdown:')
    console.log(`   Wolves ORtg (${wolvesStats.ortg.toFixed(1)}) vs Grizzlies DRtg (${grizzliesStats.drtg.toFixed(1)})`)
    console.log(`   Grizzlies ORtg (${grizzliesStats.ortg.toFixed(1)}) vs Wolves DRtg (${wolvesStats.drtg.toFixed(1)})`)
    console.log(`   Home court advantage: +3.0 points`)
    console.log(`   Combined pace factor: ${((wolvesStats.pace + grizzliesStats.pace) / 2).toFixed(1)}`)
  } else {
    console.log('3. ❌ Cannot calculate - missing team stats')
  }

  console.log('\n' + '='.repeat(60))
}

test()
