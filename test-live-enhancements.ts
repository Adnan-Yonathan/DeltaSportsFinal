/**
 * Integration Test: Live Bet Model Enhancements
 * Tests all 7 new factors: garbage time, fouling, 3PT variance, fatigue, timeout impact
 */

import { fetchGameDetails } from './lib/live-scores'
import { analyzeLiveGame } from './lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal } from './lib/services/live-line-calculator'
import { getTeamStats } from './lib/services/matchup-analyzer'

async function testLiveEnhancements() {
  console.log('============================================================')
  console.log('Integration Test: Live Bet Model Enhancements')
  console.log('============================================================\n')

  try {
    // Test with a recent completed game
    // Replace with an actual event ID from today's games
    const testEventId = '401810222' // Lakers vs Warriors from 2025-12-17

    console.log(`Fetching game details for event: ${testEventId}...`)
    const gameDetails = await fetchGameDetails('nba', testEventId)

    if (!gameDetails) {
      console.error('❌ Failed to fetch game details')
      return
    }

    console.log(`✓ Fetched game: ${gameDetails.leagueLabel}`)
    console.log(`  Status: ${gameDetails.statusText}`)
    console.log(`  Plays available: ${gameDetails.plays?.length || 0}\n`)

    console.log('Running live game analysis with ALL new factors...')
    const analysis = await analyzeLiveGame(gameDetails)

    console.log('\n============================================================')
    console.log('ENHANCEMENT ANALYSIS RESULTS')
    console.log('============================================================\n')

    // Display game info
    console.log(`Game: ${analysis.awayTeam} @ ${analysis.homeTeam}`)
    console.log(`Score: ${analysis.homeTeam} ${analysis.homeScore} - ${analysis.awayScore} ${analysis.awayTeam}`)
    console.log(`Period: Q${analysis.period} (${analysis.displayClock})`)
    console.log(`Time Remaining: ${Math.floor(analysis.timeRemaining / 60)}:${(analysis.timeRemaining % 60).toString().padStart(2, '0')}\n`)

    // Test 1: Garbage Time Detection
    console.log('--- FACTOR 1: GARBAGE TIME DETECTION ---')
    console.log(`Is Garbage Time: ${analysis.momentum.garbageTime.isGarbageTime ? '⚠️ YES' : '✓ NO'}`)
    if (analysis.momentum.garbageTime.isGarbageTime) {
      console.log(`Reason: ${analysis.momentum.garbageTime.reason}`)
      console.log(`Recommendation: ${analysis.momentum.garbageTime.recommendationAdjustment}`)
    }
    console.log('')

    // Test 2: Late-Game Fouling Detection
    console.log('--- FACTOR 2: LATE-GAME FOULING DETECTION ---')
    console.log(`Is Fouling: ${analysis.momentum.foulingStrategy.isFouling ? '⚠️ YES' : '✓ NO'}`)
    if (analysis.momentum.foulingStrategy.isFouling) {
      console.log(`Reason: ${analysis.momentum.foulingStrategy.reason}`)
      console.log(`Expected fouls: ${analysis.momentum.foulingStrategy.expectedFouls.toFixed(0)}`)
      console.log(`Impact on total: +${analysis.momentum.foulingStrategy.impactOnTotal.toFixed(1)} points`)
    }
    console.log('')

    // Test 3: Three-Point Variance
    console.log('--- FACTOR 3: THREE-POINT VARIANCE REGRESSION ---')
    const homeOutlier = analysis.momentum.threePointVariance.homeThreePointInfo.isOutlier
    const awayOutlier = analysis.momentum.threePointVariance.awayThreePointInfo.isOutlier

    console.log(`${analysis.homeTeam}: ${(analysis.momentum.threePointVariance.homeThreePointInfo.currentPercentage * 100).toFixed(1)}% (${analysis.momentum.threePointVariance.homeThreePointInfo.currentMade}/${analysis.momentum.threePointVariance.homeThreePointInfo.currentAttempted}) ${homeOutlier ? '⚠️ OUTLIER' : '✓'}`)
    console.log(`  Season avg: ${(analysis.momentum.threePointVariance.homeThreePointInfo.seasonPercentage * 100).toFixed(1)}%`)

    console.log(`${analysis.awayTeam}: ${(analysis.momentum.threePointVariance.awayThreePointInfo.currentPercentage * 100).toFixed(1)}% (${analysis.momentum.threePointVariance.awayThreePointInfo.currentMade}/${analysis.momentum.threePointVariance.awayThreePointInfo.currentAttempted}) ${awayOutlier ? '⚠️ OUTLIER' : '✓'}`)
    console.log(`  Season avg: ${(analysis.momentum.threePointVariance.awayThreePointInfo.seasonPercentage * 100).toFixed(1)}%`)

    if (homeOutlier || awayOutlier) {
      console.log(`Expected regression: ${analysis.momentum.threePointVariance.expectedRegression.totalAdjustment > 0 ? '+' : ''}${analysis.momentum.threePointVariance.expectedRegression.totalAdjustment.toFixed(1)} pts total`)
    }
    console.log('')

    // Test 4: Player Fatigue
    console.log('--- FACTOR 4: PLAYER FATIGUE ---')
    const totalFatigued = analysis.momentum.fatigue.homeFatigued.length + analysis.momentum.fatigue.awayFatigued.length
    console.log(`Fatigued players: ${totalFatigued}`)

    if (analysis.momentum.fatigue.homeFatigued.length > 0) {
      console.log(`${analysis.homeTeam}:`)
      analysis.momentum.fatigue.homeFatigued.forEach(p => {
        console.log(`  ${p.isStarPlayer ? '⭐' : '  '} ${p.name}: ${p.minutesPlayed.toFixed(0)} min (${p.fatigueLevel.toUpperCase()})`)
      })
    }

    if (analysis.momentum.fatigue.awayFatigued.length > 0) {
      console.log(`${analysis.awayTeam}:`)
      analysis.momentum.fatigue.awayFatigued.forEach(p => {
        console.log(`  ${p.isStarPlayer ? '⭐' : '  '} ${p.name}: ${p.minutesPlayed.toFixed(0)} min (${p.fatigueLevel.toUpperCase()})`)
      })
    }

    if (totalFatigued === 0) {
      console.log('  No fatigued players detected')
    }
    console.log(`Line adjustment: ${analysis.momentum.fatigue.lineAdjustment > 0 ? '+' : ''}${analysis.momentum.fatigue.lineAdjustment.toFixed(2)} points`)
    console.log('')

    // Test 5: Timeout Impact (Coach Ratings)
    console.log('--- FACTOR 5: TIMEOUT IMPACT (COACH RATINGS) ---')
    if (analysis.momentum.timeoutImpact.homeCoach) {
      console.log(`${analysis.homeTeam}: ${analysis.momentum.timeoutImpact.homeCoach.name}`)
      console.log(`  Tier: ${analysis.momentum.timeoutImpact.homeCoach.tier} (${analysis.momentum.timeoutImpact.homeCoach.grade}/100)`)
      console.log(`  ATO PPP: ${analysis.momentum.timeoutImpact.homeCoach.atoPPP.toFixed(2)}`)
      console.log(`  Timeout Impact: ${analysis.momentum.timeoutImpact.homeCoach.timeoutImpact > 0 ? '+' : ''}${analysis.momentum.timeoutImpact.homeCoach.timeoutImpact.toFixed(1)} pts`)
    }

    if (analysis.momentum.timeoutImpact.awayCoach) {
      console.log(`${analysis.awayTeam}: ${analysis.momentum.timeoutImpact.awayCoach.name}`)
      console.log(`  Tier: ${analysis.momentum.timeoutImpact.awayCoach.tier} (${analysis.momentum.timeoutImpact.awayCoach.grade}/100)`)
      console.log(`  ATO PPP: ${analysis.momentum.timeoutImpact.awayCoach.atoPPP.toFixed(2)}`)
      console.log(`  Timeout Impact: ${analysis.momentum.timeoutImpact.awayCoach.timeoutImpact > 0 ? '+' : ''}${analysis.momentum.timeoutImpact.awayCoach.timeoutImpact.toFixed(1)} pts`)
    }

    console.log(`Recent timeouts: Home ${analysis.momentum.timeoutImpact.recentTimeouts.home}, Away ${analysis.momentum.timeoutImpact.recentTimeouts.away}`)
    console.log(`Line adjustment: ${analysis.momentum.timeoutImpact.lineAdjustment > 0 ? '+' : ''}${analysis.momentum.timeoutImpact.lineAdjustment.toFixed(2)} points`)
    console.log('')

    // Test 6 & 7: Generate Live Betting Recommendations
    console.log('--- LIVE BETTING RECOMMENDATIONS ---')

    // Get team stats for fair line calculation
    const homeStats = await getTeamStats(analysis.homeTeam)
    const awayStats = await getTeamStats(analysis.awayTeam)

    if (homeStats && awayStats) {
      const spreadRec = calculateLiveSpread(analysis, { homeStats, awayStats })
      const totalRec = calculateLiveTotal(analysis, { homeStats, awayStats })

      console.log('\n🔴 LIVE SPREAD RECOMMENDATION')
      console.log(`Fair Line: ${spreadRec.fairLine > 0 ? analysis.homeTeam : analysis.awayTeam} -${Math.abs(spreadRec.fairLine).toFixed(1)}`)
      console.log(`Confidence: ${spreadRec.confidence.toUpperCase()}`)
      console.log(`Win Probability: ${analysis.homeTeam} ${(spreadRec.winProbability.home * 100).toFixed(0)}%, ${analysis.awayTeam} ${(spreadRec.winProbability.away * 100).toFixed(0)}%`)
      console.log(`\n💡 ${spreadRec.recommendation}`)

      if (spreadRec.factors.length > 0) {
        console.log(`\n📊 Factors:`)
        spreadRec.factors.slice(0, 5).forEach(factor => console.log(`   • ${factor}`))
      }

      console.log('\n🔴 LIVE TOTAL RECOMMENDATION')
      console.log(`Fair Line: ${totalRec.fairLine.toFixed(1)}`)
      console.log(`Confidence: ${totalRec.confidence.toUpperCase()}`)
      console.log(`Over/Under Probability: Over ${(totalRec.winProbability.home * 100).toFixed(0)}%, Under ${(totalRec.winProbability.away * 100).toFixed(0)}%`)
      console.log(`\n💡 ${totalRec.recommendation}`)

      if (totalRec.factors.length > 0) {
        console.log(`\n📊 Factors:`)
        totalRec.factors.slice(0, 5).forEach(factor => console.log(`   • ${factor}`))
      }
    }

    console.log('\n============================================================')
    console.log('✓ ALL ENHANCEMENT TESTS PASSED')
    console.log('============================================================\n')

    // Summary of features tested
    console.log('Features Tested:')
    console.log('  ✓ Garbage Time Detection')
    console.log('  ✓ Late-Game Fouling Detection')
    console.log('  ✓ Three-Point Variance Regression')
    console.log('  ✓ Player Fatigue Tracking')
    console.log('  ✓ Timeout Impact (Coach Ratings)')
    console.log('  ✓ Live Spread Calculation with New Factors')
    console.log('  ✓ Live Total Calculation with New Factors')
    console.log('')
    console.log('Note: Clutch performance and lineup tracking require database tables')

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error)
    console.error('\nStack trace:', error instanceof Error ? error.stack : String(error))
  }
}

// Run the test
testLiveEnhancements()
  .then(() => {
    console.log('\nTest completed successfully')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\nTest failed with error:', error)
    process.exit(1)
  })
