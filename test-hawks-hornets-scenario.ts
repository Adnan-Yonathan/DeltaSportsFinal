/**
 * Hawks @ Hornets Live Scenario Analysis
 * Scenario: Hornets up 40-36 with 7:30 left in Q2
 */

import { fetchAllLiveScores } from './lib/live-scores'
import { analyzeLiveGame } from './lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal } from './lib/services/live-line-calculator'
import { getTeamStats } from './lib/services/matchup-analyzer'
import type { LiveScoreGameDetails } from './lib/live-scores'
import type { TeamStats } from './lib/services/pregame-value-calculator'

async function analyzeHawksHornets() {
  console.log('============================================================')
  console.log('Hawks @ Hornets Live Scenario Analysis')
  console.log('Date: 2025-12-18')
  console.log('============================================================\n')

  try {
    // Fetch today's NBA games
    console.log('Fetching NBA scoreboard...')
    const scoreboard = await fetchAllLiveScores({})

    if (!scoreboard.games || scoreboard.games.length === 0) {
      console.log('❌ No NBA games found for today')
      return
    }

    console.log(`Found ${scoreboard.games.length} NBA games today\n`)

    // Find Hawks @ Hornets game
    const game = scoreboard.games.find(g => {
      if (!g.competitors || !Array.isArray(g.competitors)) return false

      const homeTeam = g.competitors.find(t => t.homeAway === 'home')
      const awayTeam = g.competitors.find(t => t.homeAway === 'away')

      return (
        (homeTeam?.name?.toLowerCase().includes('hornets') || homeTeam?.name?.toLowerCase().includes('charlotte')) &&
        (awayTeam?.name?.toLowerCase().includes('hawks') || awayTeam?.name?.toLowerCase().includes('atlanta'))
      )
    })

    if (!game) {
      console.log('❌ Hawks @ Hornets game not found on today\'s schedule')
      console.log('\nAll available games today:')
      scoreboard.games.filter(g => g.competitors && Array.isArray(g.competitors)).forEach(g => {
        const home = g.competitors.find(t => t.homeAway === 'home')
        const away = g.competitors.find(t => t.homeAway === 'away')
        console.log(`  ${away?.name || 'Unknown'} @ ${home?.name || 'Unknown'}`)
      })
      return
    }

    const homeTeam = game.competitors.find(t => t.homeAway === 'home')
    const awayTeam = game.competitors.find(t => t.homeAway === 'away')

    console.log(`✓ Found game: ${awayTeam?.name} @ ${homeTeam?.name}`)
    console.log(`Event ID: ${game.eventId}`)
    console.log(`Status: ${game.status?.shortDetail || game.status?.detail || 'Unknown'}\n`)

    // Display pregame info
    console.log('--- PREGAME ANALYSIS ---')
    console.log(`Spread: Hawks -5.0`)

    // Check injuries (injury data not available in LiveScoreCompetitor)
    console.log('\n--- INJURY REPORT ---')
    console.log('Injury data would need to be fetched separately')
    // if (awayTeam?.injuries && awayTeam.injuries.length > 0) {
    //   console.log(`${awayTeam.name} (Hawks):`)
    //   awayTeam.injuries.forEach(inj => {
    //     console.log(`  ${inj.status === 'out' ? '🔴' : '🟡'} ${inj.name} - ${inj.status} (${inj.description})`)
    //   })
    // } else {
    //   console.log(`${awayTeam?.name}: No injuries reported`)
    // }

    // if (homeTeam?.injuries && homeTeam.injuries.length > 0) {
    //   console.log(`${homeTeam.name} (Hornets):`)
    //   homeTeam.injuries.forEach(inj => {
    //     console.log(`  ${inj.status === 'out' ? '🔴' : '🟡'} ${inj.name} - ${inj.status} (${inj.description})`)
    //   })
    // } else {
    //   console.log(`${homeTeam?.name}: No injuries reported`)
    // }

    // Display lineups (lineup data not available in LiveScoreCompetitor)
    console.log('\n--- STARTING LINEUPS ---')
    console.log('Lineup data would need to be fetched from game details')
    // if (awayTeam?.starters && awayTeam.starters.length > 0) {
    //   console.log(`${awayTeam.name} (Hawks):`)
    //   awayTeam.starters.forEach(player => {
    //     console.log(`  ${player.name} - ${player.position || 'N/A'}`)
    //   })
    // } else {
    //   console.log(`${awayTeam?.name}: Starters not yet available`)
    // }

    // if (homeTeam?.starters && homeTeam.starters.length > 0) {
    //   console.log(`${homeTeam.name} (Hornets):`)
    //   homeTeam.starters.forEach(player => {
    //     console.log(`  ${player.name} - ${player.position || 'N/A'}`)
    //   })
    // } else {
    //   console.log(`${homeTeam?.name}: Starters not yet available`)
    // }

    // Create simulated live game state
    console.log('\n============================================================')
    console.log('SIMULATED LIVE SCENARIO')
    console.log('============================================================\n')
    console.log('Scenario: Hornets up 40-36 with 7:30 left in Q2')
    console.log('')

    // Create a simulated live game state
    const simulatedGame: LiveScoreGameDetails = {
      ...game,
      updatedAt: new Date().toISOString(),
      statusText: '7:30 - 2nd Quarter',
      teams: [
        {
          ...homeTeam!,
          score: 40,
          linescore: [{ label: 'Q1', value: '20' }, { label: 'Q2', value: '20' }], // 20 in Q1, 20 so far in Q2
          statistics: [],
          starters: [],
          bench: []
        },
        {
          ...awayTeam!,
          score: 36,
          linescore: [{ label: 'Q1', value: '18' }, { label: 'Q2', value: '18' }], // 18 in Q1, 18 so far in Q2
          statistics: [],
          starters: [],
          bench: []
        }
      ]
    }

    // Analyze the simulated live game
    const analysis = await analyzeLiveGame(simulatedGame)

    console.log('--- LIVE GAME STATE ---')
    console.log(`Score: ${analysis.awayTeam} ${analysis.awayScore} - ${analysis.homeScore} ${analysis.homeTeam}`)
    console.log(`Current Margin: ${analysis.homeTeam} +${analysis.homeScore - analysis.awayScore}`)
    console.log(`Period: Q${analysis.period}`)
    console.log(`Time Remaining in Game: ${(analysis.timeRemaining / 60).toFixed(1)} minutes`)
    console.log(`Time Elapsed: ${(analysis.timeElapsed / 60).toFixed(1)} minutes\n`)

    // Display momentum factors
    console.log('--- MOMENTUM ANALYSIS ---')

    // Scoring run
    console.log('Last 5 Minutes:')
    console.log(`  ${analysis.homeTeam}: ${analysis.momentum.scoringRun.last5Minutes.homePoints} pts`)
    console.log(`  ${analysis.awayTeam}: ${analysis.momentum.scoringRun.last5Minutes.awayPoints} pts`)
    console.log(`  Net: ${analysis.momentum.scoringRun.last5Minutes.netMargin > 0 ? '+' : ''}${analysis.momentum.scoringRun.last5Minutes.netMargin}\n`)

    // Pace
    console.log('Pace Analysis:')
    console.log(`  Current: ${analysis.momentum.paceChange.currentPace.toFixed(1)} poss/48`)
    console.log(`  Season Avg: ${analysis.momentum.paceChange.seasonPace.toFixed(1)} poss/48`)
    console.log(`  Deviation: ${analysis.momentum.paceChange.deviation > 0 ? '+' : ''}${analysis.momentum.paceChange.deviation.toFixed(1)}\n`)

    // Fatigue
    if (analysis.momentum.fatigue.homeFatigued.length > 0 || analysis.momentum.fatigue.awayFatigued.length > 0) {
      console.log('Player Fatigue:')
      analysis.momentum.fatigue.factors.forEach(f => console.log(`  ${f}`))
      console.log('')
    }

    // Garbage time check
    if (analysis.momentum.garbageTime.isGarbageTime) {
      console.log(`⚠️ GARBAGE TIME: ${analysis.momentum.garbageTime.reason}\n`)
    }

    // Get team stats for calculations
    const hawksStats = (await getTeamStats('Hawks')) as TeamStats | null
    const hornetsStats = (await getTeamStats('Hornets')) as TeamStats | null

    if (!hawksStats || !hornetsStats) {
      console.log('❌ Could not load team stats')
      return
    }

    // Calculate live spread
    const liveSpread = calculateLiveSpread(analysis, {
      homeStats: hornetsStats,
      awayStats: hawksStats
    })

    console.log('============================================================')
    console.log('LIVE SPREAD PROJECTION')
    console.log('============================================================\n')

    console.log(`🔴 LIVE SPREAD`)
    console.log(`Pregame: Hawks -5.0`)
    console.log(`Live Fair Line: ${liveSpread.fairLine > 0 ? analysis.homeTeam : analysis.awayTeam} -${Math.abs(liveSpread.fairLine).toFixed(1)}`)
    console.log(`Confidence Interval: -${liveSpread.confidenceInterval.lower.toFixed(1)} to -${liveSpread.confidenceInterval.upper.toFixed(1)}`)
    console.log(`Confidence: ${liveSpread.confidence.toUpperCase()}\n`)

    console.log(`Win Probability:`)
    console.log(`  ${analysis.homeTeam}: ${(liveSpread.winProbability.home * 100).toFixed(1)}%`)
    console.log(`  ${analysis.awayTeam}: ${(liveSpread.winProbability.away * 100).toFixed(1)}%\n`)

    if (liveSpread.factors.length > 0) {
      console.log(`📊 Key Factors:`)
      liveSpread.factors.forEach(factor => {
        console.log(`   • ${factor}`)
      })
      console.log('')
    }

    console.log(`💡 RECOMMENDATION:`)
    console.log(`   ${liveSpread.recommendation}\n`)

    // Calculate live total
    const liveTotal = calculateLiveTotal(analysis, {
      homeStats: hornetsStats,
      awayStats: hawksStats
    })

    console.log('--- LIVE TOTAL ---')
    console.log(`Fair Line: ${liveTotal.fairLine.toFixed(1)}`)
    console.log(`Current Total: ${analysis.homeScore + analysis.awayScore}`)
    console.log(`Projected Final: ${liveTotal.fairLine.toFixed(1)}`)
    console.log(`Over/Under: Over ${(liveTotal.winProbability.home * 100).toFixed(0)}% / Under ${(liveTotal.winProbability.away * 100).toFixed(0)}%\n`)

    // Timeout impact
    if (analysis.momentum.timeoutImpact.homeCoach && analysis.momentum.timeoutImpact.awayCoach) {
      console.log('--- COACHING MATCHUP ---')
      console.log(`${analysis.homeTeam}: ${analysis.momentum.timeoutImpact.homeCoach.name} (${analysis.momentum.timeoutImpact.homeCoach.tier}-tier, ${analysis.momentum.timeoutImpact.homeCoach.grade}/100)`)
      console.log(`${analysis.awayTeam}: ${analysis.momentum.timeoutImpact.awayCoach.name} (${analysis.momentum.timeoutImpact.awayCoach.tier}-tier, ${analysis.momentum.timeoutImpact.awayCoach.grade}/100)`)
      console.log('')
    }

    console.log('============================================================')

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error instanceof Error ? error.stack : String(error))
  }
}

analyzeHawksHornets()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
