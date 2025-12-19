/**
 * Live Game Test: Trail Blazers @ Kings
 * Real-time analysis of the current game
 */

import { fetchAllLiveScores, fetchGameDetails } from './lib/live-scores'
import { analyzeLiveGame } from './lib/services/live-game-analyzer'
import { calculateLiveSpread, calculateLiveTotal } from './lib/services/live-line-calculator'
import { getTeamStats } from './lib/services/matchup-analyzer'

async function testBlazersKingsLive() {
  console.log('============================================================')
  console.log('Kings vs Trail Blazers Live Game Analysis')
  console.log('Date: 2025-12-18')
  console.log('============================================================\n')

  try {
    // Fetch today's NBA scoreboard
    console.log('Fetching NBA scoreboard...')
    const scoreboard = await fetchAllLiveScores({})

    if (!scoreboard.games || scoreboard.games.length === 0) {
      console.log('❌ No NBA games found for today')
      return
    }

    console.log(`Found ${scoreboard.games.length} NBA games today\n`)

    // Find Kings vs Blazers game (either team can be home)
    const game = scoreboard.games.find(g => {
      if (!g.competitors || !Array.isArray(g.competitors)) return false

      const homeTeam = g.competitors.find(t => t.homeAway === 'home')
      const awayTeam = g.competitors.find(t => t.homeAway === 'away')

      const hasKings = homeTeam?.name?.toLowerCase().includes('kings') || homeTeam?.name?.toLowerCase().includes('sacramento') ||
                       awayTeam?.name?.toLowerCase().includes('kings') || awayTeam?.name?.toLowerCase().includes('sacramento')

      const hasBlazers = homeTeam?.name?.toLowerCase().includes('blazers') || homeTeam?.name?.toLowerCase().includes('trail') || homeTeam?.name?.toLowerCase().includes('portland') ||
                         awayTeam?.name?.toLowerCase().includes('blazers') || awayTeam?.name?.toLowerCase().includes('trail') || awayTeam?.name?.toLowerCase().includes('portland')

      return hasKings && hasBlazers
    })

    if (!game) {
      console.log('❌ Trail Blazers @ Kings game not found on today\'s schedule')
      console.log('\nAll available games today:')
      scoreboard.games.filter(g => g.competitors && Array.isArray(g.competitors)).forEach(g => {
        const home = g.competitors.find(t => t.homeAway === 'home')
        const away = g.competitors.find(t => t.homeAway === 'away')
        const homeScore = home?.score || 0
        const awayScore = away?.score || 0
        console.log(`  ${away?.name || 'Unknown'} ${awayScore} @ ${home?.name || 'Unknown'} ${homeScore} - ${g.status?.shortDetail || g.status?.detail || 'Unknown'}`)
      })
      return
    }

    const homeTeam = game.competitors.find(t => t.homeAway === 'home')
    const awayTeam = game.competitors.find(t => t.homeAway === 'away')

    console.log(`✓ Found game: ${awayTeam?.name} @ ${homeTeam?.name}`)
    console.log(`Event ID: ${game.eventId}`)
    console.log(`Status: ${game.status?.shortDetail || game.status?.detail || 'Unknown'}`)
    console.log(`Score: ${awayTeam?.name} ${awayTeam?.score || 0} - ${homeTeam?.score || 0} ${homeTeam?.name}\n`)

    // Fetch detailed game data
    console.log('Fetching detailed game data from ESPN API...')
    const gameDetails = await fetchGameDetails('nba', game.eventId)

    if (!gameDetails) {
      console.log('❌ Failed to fetch game details')
      return
    }

    console.log('✓ Game details fetched\n')

    // Display real-time game info
    const home = gameDetails.teams.find(t => t.homeAway === 'home')
    const away = gameDetails.teams.find(t => t.homeAway === 'away')

    console.log('============================================================')
    console.log('LIVE GAME STATE')
    console.log('============================================================\n')

    console.log(`Score: ${away?.name} ${away?.score} - ${home?.score} ${home?.name}`)
    console.log(`Time: ${gameDetails.statusText || 'Unknown'}`)

    // Show real box score stats
    if (home?.statistics && home.statistics.length > 0) {
      console.log(`\n${home.name} Stats:`)
      const statsToPrint = ['Field Goals', 'Field Goal %', '3PT Field Goals', '3PT %', 'Free Throws', 'Rebounds', 'Assists', 'Turnovers']
      home.statistics.filter(s => statsToPrint.includes(s.label)).forEach(stat => {
        console.log(`  ${stat.label}: ${stat.value}`)
      })
    }

    if (away?.statistics && away.statistics.length > 0) {
      console.log(`\n${away.name} Stats:`)
      const statsToPrint = ['Field Goals', 'Field Goal %', '3PT Field Goals', '3PT %', 'Free Throws', 'Rebounds', 'Assists', 'Turnovers']
      away.statistics.filter(s => statsToPrint.includes(s.label)).forEach(stat => {
        console.log(`  ${stat.label}: ${stat.value}`)
      })
    }

    // Show starters
    if (home?.starters && home.starters.length > 0) {
      console.log(`\n${home.name} Starters:`)
      home.starters.slice(0, 5).forEach(player => {
        const pts = player.statMap?.PTS || '0'
        const reb = player.statMap?.REB || '0'
        const ast = player.statMap?.AST || '0'
        console.log(`  ${player.name}: ${pts} pts, ${reb} reb, ${ast} ast`)
      })
    }

    if (away?.starters && away.starters.length > 0) {
      console.log(`\n${away.name} Starters:`)
      away.starters.slice(0, 5).forEach(player => {
        const pts = player.statMap?.PTS || '0'
        const reb = player.statMap?.REB || '0'
        const ast = player.statMap?.AST || '0'
        console.log(`  ${player.name}: ${pts} pts, ${reb} reb, ${ast} ast`)
      })
    }

    console.log('\n============================================================')
    console.log('MOMENTUM ANALYSIS')
    console.log('============================================================\n')

    // Run live game analysis
    const analysis = await analyzeLiveGame(gameDetails)

    // 1. Garbage Time
    console.log('1. Garbage Time Detection:')
    if (analysis.momentum.garbageTime.isGarbageTime) {
      console.log(`   ⚠️ YES - ${analysis.momentum.garbageTime.reason}`)
    } else {
      console.log(`   ✓ NO - Game is still competitive`)
    }

    // 2. Late-Game Fouling
    console.log('\n2. Late-Game Fouling:')
    if (analysis.momentum.foulingStrategy.isFouling) {
      console.log(`   ⚠️ YES`)
      console.log(`   Reason: ${analysis.momentum.foulingStrategy.reason}`)
      console.log(`   Impact on Pace: +${analysis.momentum.foulingStrategy.impactOnPace.toFixed(1)} possessions`)
    } else {
      console.log(`   ✓ NO`)
    }

    // 3. Three-Point Variance
    console.log('\n3. Three-Point Shooting Variance:')
    const home3P = analysis.momentum.threePointVariance.homeThreePointInfo
    const away3P = analysis.momentum.threePointVariance.awayThreePointInfo
    console.log(`   ${analysis.homeTeam}: ${(home3P.currentPercentage * 100).toFixed(1)}% (${home3P.currentMade}/${home3P.currentAttempted}) vs ${(home3P.seasonPercentage * 100).toFixed(1)}% season ${home3P.isOutlier ? '⚠️ OUTLIER' : '✓'}`)
    console.log(`   ${analysis.awayTeam}: ${(away3P.currentPercentage * 100).toFixed(1)}% (${away3P.currentMade}/${away3P.currentAttempted}) vs ${(away3P.seasonPercentage * 100).toFixed(1)}% season ${away3P.isOutlier ? '⚠️ OUTLIER' : '✓'}`)

    // 4. Scoring Run
    console.log('\n4. Scoring Run Analysis:')
    console.log(`   Last 5 Minutes: ${analysis.homeTeam} ${analysis.momentum.scoringRun.last5Minutes.homePoints} - ${analysis.momentum.scoringRun.last5Minutes.awayPoints} ${analysis.awayTeam}`)
    if (analysis.momentum.scoringRun.currentRun) {
      const run = analysis.momentum.scoringRun.currentRun
      const runTeam = run.team === 'home' ? analysis.homeTeam : analysis.awayTeam
      console.log(`   🔥 CURRENT RUN: ${run.points}-0 ${runTeam}`)
    }

    // 5. Pace Analysis
    console.log('\n5. Pace Analysis:')
    console.log(`   Current Pace: ${analysis.momentum.paceChange.currentPace.toFixed(1)} poss/48`)
    console.log(`   Season Average: ${analysis.momentum.paceChange.seasonPace.toFixed(1)} poss/48`)
    console.log(`   Deviation: ${analysis.momentum.paceChange.deviation > 0 ? '+' : ''}${analysis.momentum.paceChange.deviation.toFixed(1)}`)

    // 6. Player Fatigue
    console.log('\n6. Player Fatigue:')
    const totalFatigued = analysis.momentum.fatigue.homeFatigued.length + analysis.momentum.fatigue.awayFatigued.length
    if (totalFatigued > 0) {
      console.log(`   ⚠️ ${totalFatigued} fatigued players detected`)
      analysis.momentum.fatigue.factors.forEach(f => console.log(`   • ${f}`))
    } else {
      console.log(`   ✓ No significant fatigue detected`)
    }

    // 7. Coaching Impact
    console.log('\n7. Coaching Matchup:')
    if (analysis.momentum.timeoutImpact.homeCoach && analysis.momentum.timeoutImpact.awayCoach) {
      console.log(`   ${analysis.homeTeam}: ${analysis.momentum.timeoutImpact.homeCoach.name} (${analysis.momentum.timeoutImpact.homeCoach.tier}-tier, ${analysis.momentum.timeoutImpact.homeCoach.grade}/100)`)
      console.log(`   ${analysis.awayTeam}: ${analysis.momentum.timeoutImpact.awayCoach.name} (${analysis.momentum.timeoutImpact.awayCoach.tier}-tier, ${analysis.momentum.timeoutImpact.awayCoach.grade}/100)`)
    }

    console.log('\n============================================================')
    console.log('LIVE BETTING PROJECTIONS')
    console.log('============================================================\n')

    // Get team stats
    const blazersStats = await getTeamStats('Trail Blazers')
    const kingsStats = await getTeamStats('Kings')

    if (!blazersStats || !kingsStats) {
      console.log('❌ Could not load team stats')
      return
    }

    // Calculate live spread
    const liveSpread = calculateLiveSpread(analysis, {
      homeStats: kingsStats,
      awayStats: blazersStats
    })

    console.log(`🔴 LIVE SPREAD\n`)
    const favoredTeam = liveSpread.fairLine > 0 ? analysis.homeTeam : analysis.awayTeam
    const spreadValue = Math.abs(liveSpread.fairLine)

    console.log(`Live Fair Spread: ${favoredTeam} -${spreadValue.toFixed(1)}`)
    console.log(`Confidence Interval: -${liveSpread.confidenceInterval.lower.toFixed(1)} to -${liveSpread.confidenceInterval.upper.toFixed(1)}`)
    console.log(`Confidence Level: ${liveSpread.confidence.toUpperCase()}\n`)

    console.log(`Win Probability:`)
    console.log(`  ${analysis.homeTeam}: ${(liveSpread.winProbability.home * 100).toFixed(1)}%`)
    console.log(`  ${analysis.awayTeam}: ${(liveSpread.winProbability.away * 100).toFixed(1)}%\n`)

    if (liveSpread.factors.length > 0) {
      console.log(`Key Factors:`)
      liveSpread.factors.forEach(factor => {
        console.log(`  • ${factor}`)
      })
      console.log('')
    }

    console.log(`💡 RECOMMENDATION:`)
    console.log(`   ${liveSpread.recommendation}\n`)

    // Calculate live total
    const liveTotal = calculateLiveTotal(analysis, {
      homeStats: kingsStats,
      awayStats: blazersStats
    })

    console.log('🔵 LIVE TOTAL\n')
    console.log(`Current Total: ${analysis.homeScore + analysis.awayScore}`)
    console.log(`Projected Final Total: ${liveTotal.fairLine.toFixed(1)}`)
    console.log(`Over/Under Probability: Over ${(liveTotal.winProbability.home * 100).toFixed(0)}% / Under ${(liveTotal.winProbability.away * 100).toFixed(0)}%\n`)

    console.log('============================================================')
    console.log('✅ LIVE GAME ANALYSIS COMPLETE')
    console.log('============================================================\n')

  } catch (error) {
    console.error('❌ Error:', error)
    console.error(error instanceof Error ? error.stack : String(error))
  }
}

testBlazersKingsLive()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
