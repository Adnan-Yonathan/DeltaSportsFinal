/**
 * Test script with integrated injury detection
 * Tests: Grizzlies @ Timberwolves with automatic injury detection
 */

// Load environment variables
import * as dotenv from 'dotenv'
dotenv.config()

import { getTeamStats, analyzeMatchup, getPlayerStats } from './lib/services/matchup-analyzer'
import { calculateFairSpread, calculateFairTotal } from './lib/services/pregame-value-calculator'
import { detectInjuries } from './lib/services/injury-detector'
import { getGameRecommendations, formatRecommendationForChat } from './lib/services/recommendation-engine'

async function test() {
  console.log('='.repeat(60))
  console.log('INTEGRATED INJURY DETECTION TEST')
  console.log('Matchup: Grizzlies @ Timberwolves')
  console.log('='.repeat(60) + '\n')

  // Test 1: Direct injury detection
  console.log('1. Testing injury detector service:')
  const wolvesInjuries = await detectInjuries('Timberwolves')

  if (wolvesInjuries) {
    console.log(`   ✅ Found injuries for Timberwolves`)
    console.log(`   Summary: ${wolvesInjuries.summary}`)
    console.log(`   Total ORtg drop: ${wolvesInjuries.totalImpact.ortgDrop.toFixed(1)}`)
    console.log(`   Total DRtg increase: ${wolvesInjuries.totalImpact.drtgIncrease.toFixed(1)}`)

    for (const injury of wolvesInjuries.injuries) {
      console.log(`\n   Player: ${injury.playerName} (${injury.status})`)
      console.log(`   Stats: ${injury.stats.ppg.toFixed(1)} PPG, ${injury.stats.usage.toFixed(1)}% usage`)
      console.log(`   Impact: -${injury.impact.ortgDrop.toFixed(1)} ORtg, +${injury.impact.drtgIncrease.toFixed(1)} DRtg`)
      console.log(`   Explanation: ${injury.explanation}`)
    }
  } else {
    console.log(`   ℹ️  No significant injuries found for Timberwolves`)
  }

  console.log('\n' + '-'.repeat(60) + '\n')

  // Test 2: Team stats with injury adjustments
  console.log('2. Testing adjusted team stats:')
  const wolvesStats = await getTeamStats('Timberwolves')
  const grizzliesStats = await getTeamStats('Grizzlies')

  if (wolvesStats && grizzliesStats) {
    console.log(`   ✅ Team stats loaded (with injury adjustments)`)
    console.log(`   Wolves ORtg: ${wolvesStats.ortg.toFixed(1)}`)
    console.log(`   Wolves DRtg: ${wolvesStats.drtg.toFixed(1)}`)
    console.log(`   Wolves Pace: ${wolvesStats.pace.toFixed(1)}`)
    console.log(`\n   Grizzlies ORtg: ${grizzliesStats.ortg.toFixed(1)}`)
    console.log(`   Grizzlies DRtg: ${grizzliesStats.drtg.toFixed(1)}`)
    console.log(`   Grizzlies Pace: ${grizzliesStats.pace.toFixed(1)}`)
  } else {
    console.log(`   ❌ Could not load team stats`)
    return
  }

  console.log('\n' + '-'.repeat(60) + '\n')

  // Test 3: Full matchup analysis with injury context
  console.log('3. Testing full matchup analysis:')
  const matchup = await analyzeMatchup('Timberwolves', 'Grizzlies')

  console.log(`   ✅ Matchup analysis complete`)
  console.log(`\n   Context factors (${matchup.context.length} total):`)
  for (const context of matchup.context) {
    console.log(`   - ${context}`)
  }

  if (matchup.homeTeam.injuries) {
    console.log(`\n   ✅ Home team injuries included in analysis`)
  }
  if (matchup.awayTeam.injuries) {
    console.log(`   ✅ Away team injuries included in analysis`)
  }

  console.log('\n' + '-'.repeat(60) + '\n')

  // Test 4: Target line calculation
  console.log('4. Testing target line calculations:')
  const targetSpread = calculateFairSpread(wolvesStats, grizzliesStats)
  const targetTotal = calculateFairTotal(wolvesStats, grizzliesStats)

  console.log(`   Target Spread: Wolves ${targetSpread > 0 ? '+' : ''}${targetSpread.toFixed(1)}`)
  console.log(`   Target Total: ${targetTotal.toFixed(1)} points`)

  console.log('\n' + '-'.repeat(60) + '\n')

  // Test 5: Full recommendation engine
  console.log('5. Testing recommendation engine:')
  const recommendations = await getGameRecommendations('Timberwolves Grizzlies', 'all')

  if (recommendations.length > 0) {
    console.log(`   ✅ Generated ${recommendations.length} recommendations\n`)

    for (const rec of recommendations) {
      console.log('\n' + formatRecommendationForChat(rec))
    }
  } else {
    console.log(`   ❌ No recommendations generated`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('TEST COMPLETE')
  console.log('='.repeat(60))
}

test().catch(err => {
  console.error('Test failed with error:', err)
  process.exit(1)
})
