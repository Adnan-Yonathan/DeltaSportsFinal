/**
 * Hawks @ Hornets Live Scenario Simulation
 * Manual simulation: Hornets up 40-36 with 7:30 left in Q2
 * Pregame spread: Hawks -5.0
 */

import { analyzeLiveGame } from './lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal } from './lib/services/live-line-calculator'
import { getTeamStats } from './lib/services/matchup-analyzer'
import type { LiveScoreGameDetails } from './lib/live-scores'

async function simulateHawksHornets() {
  console.log('============================================================')
  console.log('Hawks @ Hornets Live Scenario Simulation')
  console.log('Pregame Spread: Hawks -5.0')
  console.log('============================================================\n')

  try {
    // Create simulated game state
    // Q2, 7:30 remaining = 450 seconds left in Q2
    // Q1 is 12 minutes = 720 seconds
    // Time elapsed = 720 (Q1) + (720 - 450) = 720 + 270 = 990 seconds (16.5 minutes)
    // Time remaining = 48*60 - 990 = 2880 - 990 = 1890 seconds (31.5 minutes)

    const simulatedGame: LiveScoreGameDetails = {
      eventId: 'simulated',
      leagueLabel: 'NBA',
      league: 'nba',
      statusText: '7:30 - 2nd Quarter',
      teams: [
        {
          id: 'hornets',
          name: 'Charlotte Hornets',
          displayName: 'Charlotte Hornets',
          abbreviation: 'CHA',
          homeAway: 'home',
          score: 40,
          linescore: [20, 20], // 20 in Q1, 20 in Q2 so far
          starters: [
            { id: '1', name: 'LaMelo Ball', position: 'PG', statMap: { MIN: '10' } },
            { id: '2', name: 'Brandon Miller', position: 'SG', statMap: { MIN: '10' } },
            { id: '3', name: 'Miles Bridges', position: 'SF', statMap: { MIN: '10' } },
            { id: '4', name: 'Taj Gibson', position: 'PF', statMap: { MIN: '10' } },
            { id: '5', name: 'Mark Williams', position: 'C', statMap: { MIN: '10' } }
          ],
          bench: [],
          statistics: [
            { label: 'fieldGoalsAttempted', value: '32' },
            { label: 'threePointFieldGoalsMade', value: '4' },
            { label: 'threePointFieldGoalsAttempted', value: '14' },
            { label: 'freeThrowsAttempted', value: '6' },
            { label: 'turnovers', value: '5' },
            { label: 'offensiveRebounds', value: '3' }
          ],
          injuries: []
        },
        {
          id: 'hawks',
          name: 'Atlanta Hawks',
          displayName: 'Atlanta Hawks',
          abbreviation: 'ATL',
          homeAway: 'away',
          score: 36,
          linescore: [18, 18], // 18 in Q1, 18 in Q2 so far
          starters: [
            { id: '1', name: 'Trae Young', position: 'PG', statMap: { MIN: '10' } },
            { id: '2', name: 'Dyson Daniels', position: 'SG', statMap: { MIN: '10' } },
            { id: '3', name: 'Zaccharie Risacher', position: 'SF', statMap: { MIN: '10' } },
            { id: '4', name: 'Jalen Johnson', position: 'PF', statMap: { MIN: '10' } },
            { id: '5', name: 'Clint Capela', position: 'C', statMap: { MIN: '10' } }
          ],
          bench: [],
          statistics: [
            { label: 'fieldGoalsAttempted', value: '30' },
            { label: 'threePointFieldGoalsMade', value: '3' },
            { label: 'threePointFieldGoalsAttempted', value: '12' },
            { label: 'freeThrowsAttempted', value: '8' },
            { label: 'turnovers', value: '6' },
            { label: 'offensiveRebounds', value: '2' }
          ],
          injuries: []
        }
      ],
      plays: []
    }

    console.log('--- SCENARIO DETAILS ---')
    console.log(`Score: ${simulatedGame.teams[1].name} ${simulatedGame.teams[1].score} - ${simulatedGame.teams[0].name} ${simulatedGame.teams[0].score}`)
    console.log(`Current Leader: ${simulatedGame.teams[0].name} +4`)
    console.log(`Time: Q2, 7:30 remaining`)
    console.log(`Time Elapsed: 16.5 minutes`)
    console.log(`Time Remaining: 31.5 minutes\n`)

    // Analyze the simulated live game
    console.log('Running live game analysis...\n')
    const analysis = await analyzeLiveGame(simulatedGame)

    console.log('--- MOMENTUM FACTORS ---\n')

    // 1. Garbage Time
    console.log('1. Garbage Time Detection:')
    console.log(`   ${analysis.momentum.garbageTime.isGarbageTime ? '⚠️ YES' : '✓ NO'}\n`)

    // 2. Late-Game Fouling
    console.log('2. Late-Game Fouling:')
    console.log(`   ${analysis.momentum.foulingStrategy.isFouling ? '⚠️ YES' : '✓ NO'}\n`)

    // 3. Three-Point Variance
    console.log('3. Three-Point Shooting Variance:')
    const hornets3P = analysis.momentum.threePointVariance.homeThreePointInfo
    const hawks3P = analysis.momentum.threePointVariance.awayThreePointInfo
    console.log(`   Hornets: ${(hornets3P.currentPercentage * 100).toFixed(1)}% (${hornets3P.currentMade}/${hornets3P.currentAttempted}) vs ${(hornets3P.seasonPercentage * 100).toFixed(1)}% season ${hornets3P.isOutlier ? '⚠️ OUTLIER' : '✓'}`)
    console.log(`   Hawks: ${(hawks3P.currentPercentage * 100).toFixed(1)}% (${hawks3P.currentMade}/${hawks3P.currentAttempted}) vs ${(hawks3P.seasonPercentage * 100).toFixed(1)}% season ${hawks3P.isOutlier ? '⚠️ OUTLIER' : '✓'}\n`)

    // 4. Player Fatigue
    console.log('4. Player Fatigue:')
    const totalFatigued = analysis.momentum.fatigue.homeFatigued.length + analysis.momentum.fatigue.awayFatigued.length
    console.log(`   Fatigued players: ${totalFatigued} (early in game, no fatigue expected)\n`)

    // 5. Timeout Impact (Coaching)
    console.log('5. Coaching Matchup:')
    if (analysis.momentum.timeoutImpact.homeCoach) {
      console.log(`   Hornets: ${analysis.momentum.timeoutImpact.homeCoach.name}`)
      console.log(`     Tier: ${analysis.momentum.timeoutImpact.homeCoach.tier} (${analysis.momentum.timeoutImpact.homeCoach.grade}/100)`)
      console.log(`     ATO Impact: ${analysis.momentum.timeoutImpact.homeCoach.timeoutImpact > 0 ? '+' : ''}${analysis.momentum.timeoutImpact.homeCoach.timeoutImpact.toFixed(1)} pts`)
    }
    if (analysis.momentum.timeoutImpact.awayCoach) {
      console.log(`   Hawks: ${analysis.momentum.timeoutImpact.awayCoach.name}`)
      console.log(`     Tier: ${analysis.momentum.timeoutImpact.awayCoach.tier} (${analysis.momentum.timeoutImpact.awayCoach.grade}/100)`)
      console.log(`     ATO Impact: ${analysis.momentum.timeoutImpact.awayCoach.timeoutImpact > 0 ? '+' : ''}${analysis.momentum.timeoutImpact.awayCoach.timeoutImpact.toFixed(1)} pts`)
    }
    console.log('')

    // 6. Pace Analysis
    console.log('6. Pace Analysis:')
    console.log(`   Current Pace: ${analysis.momentum.paceChange.currentPace.toFixed(1)} poss/48`)
    console.log(`   Season Average: ${analysis.momentum.paceChange.seasonPace.toFixed(1)} poss/48`)
    console.log(`   Deviation: ${analysis.momentum.paceChange.deviation > 0 ? '+' : ''}${analysis.momentum.paceChange.deviation.toFixed(1)}\n`)

    // Get team stats
    const hawksStats = await getTeamStats('Hawks')
    const hornetsStats = await getTeamStats('Hornets')

    if (!hawksStats || !hornetsStats) {
      console.log('❌ Could not load team stats')
      return
    }

    console.log('============================================================')
    console.log('LIVE SPREAD PROJECTION')
    console.log('============================================================\n')

    // Calculate live spread
    const liveSpread = calculateLiveSpread(analysis, {
      homeStats: hornetsStats,
      awayStats: hawksStats
    })

    console.log(`🔴 LIVE SPREAD RECOMMENDATION\n`)
    console.log(`📊 Pregame: Hawks -5.0`)
    console.log(`📊 Current Score: Hornets 40, Hawks 36 (Hornets +4)`)
    console.log(`📊 Time: Q2, 7:30 remaining (16.5 min elapsed, 31.5 min left)\n`)

    const favoredTeam = liveSpread.fairLine > 0 ? analysis.homeTeam : analysis.awayTeam
    const spreadValue = Math.abs(liveSpread.fairLine)

    console.log(`⚡ LIVE FAIR SPREAD: ${favoredTeam} -${spreadValue.toFixed(1)}`)
    console.log(`   Confidence Interval: -${liveSpread.confidenceInterval.lower.toFixed(1)} to -${liveSpread.confidenceInterval.upper.toFixed(1)}`)
    console.log(`   Confidence Level: ${liveSpread.confidence.toUpperCase()}\n`)

    console.log(`📈 Win Probability:`)
    console.log(`   Hornets: ${(liveSpread.winProbability.home * 100).toFixed(1)}%`)
    console.log(`   Hawks: ${(liveSpread.winProbability.away * 100).toFixed(1)}%\n`)

    console.log(`💡 RECOMMENDATION:`)
    console.log(`   ${liveSpread.recommendation}\n`)

    if (liveSpread.factors.length > 0) {
      console.log(`🔥 KEY FACTORS:`)
      liveSpread.factors.forEach(factor => {
        console.log(`   • ${factor}`)
      })
      console.log('')
    }

    // Analysis
    console.log('============================================================')
    console.log('BETTING ANALYSIS')
    console.log('============================================================\n')

    console.log('What This Means:')
    if (liveSpread.fairLine > 0) {
      // Hornets favored
      const hornetsLiveLine = Math.abs(liveSpread.fairLine)
      console.log(`✓ Hornets have shifted from +5.0 underdogs to -${hornetsLiveLine.toFixed(1)} favorites`)
      console.log(`✓ That's a ${(5 + hornetsLiveLine).toFixed(1)}-point swing from pregame`)
      console.log(`✓ Currently up 4 points with 31.5 minutes left`)
    } else {
      // Hawks still favored
      const hawksLiveLine = Math.abs(liveSpread.fairLine)
      console.log(`✓ Hawks went from -5.0 favorites to -${hawksLiveLine.toFixed(1)}`)
      console.log(`✓ That's a ${(5 - hawksLiveLine).toFixed(1)}-point improvement despite being down 4`)
      console.log(`✓ Model expects Hawks to come back`)
    }

    console.log(`✓ Lots of time remaining (31.5 min) = lower confidence`)
    console.log(`✓ Early game momentum can shift quickly\n`)

    // Calculate live total
    const liveTotal = calculateLiveTotal(analysis, {
      homeStats: hornetsStats,
      awayStats: hawksStats
    })

    console.log('--- LIVE TOTAL PROJECTION ---')
    console.log(`Current Total: ${analysis.homeScore + analysis.awayScore}`)
    console.log(`Projected Final Total: ${liveTotal.fairLine.toFixed(1)}`)
    console.log(`Over/Under Probability: Over ${(liveTotal.winProbability.home * 100).toFixed(0)}% / Under ${(liveTotal.winProbability.away * 100).toFixed(0)}%\n`)

    console.log('============================================================')

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error instanceof Error ? error.stack : String(error))
  }
}

simulateHawksHornets()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
