// Test script to diagnose Odds API issues
const fs = require('fs')
const path = require('path')

// Load environment variables
const envPath = path.join(__dirname, '..', '.env.local')
const envContent = fs.readFileSync(envPath, 'utf-8')
const envVars = {}

envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/)
  if (match) {
    const key = match[1].trim()
    const value = match[2].trim()
    envVars[key] = value
  }
})

const API_KEY = envVars.ODDS_API_KEY
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

async function testOddsAPI() {
  console.log('\n=== ODDS API DIAGNOSTIC TEST ===\n')
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT FOUND'}`)

  // Test 1: Get available sports
  console.log('\n--- Test 1: Fetching Available Sports ---')
  try {
    const sportsUrl = `${ODDS_API_BASE}/sports/?apiKey=${API_KEY}`
    const response = await fetch(sportsUrl)

    console.log(`Status: ${response.status} ${response.statusText}`)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Error:', errorText)
      return
    }

    const sports = await response.json()
    console.log(`Total sports available: ${sports.length}`)

    // Filter for active sports
    const activeSports = sports.filter(s => s.active)
    console.log(`Active sports: ${activeSports.length}`)

    console.log('\nActive Sports:')
    activeSports.forEach(sport => {
      console.log(`  - ${sport.key}: ${sport.title} (Group: ${sport.group})`)
    })

    // Test 2: Get odds for NBA
    console.log('\n--- Test 2: Fetching NBA Odds ---')
    const nbaUrl = `${ODDS_API_BASE}/sports/basketball_nba/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
    const nbaResponse = await fetch(nbaUrl)

    console.log(`Status: ${nbaResponse.status} ${nbaResponse.statusText}`)

    if (nbaResponse.ok) {
      const nbaGames = await nbaResponse.json()
      console.log(`NBA games available: ${nbaGames.length}`)

      if (nbaGames.length > 0) {
        console.log('\nFirst NBA game:')
        const game = nbaGames[0]
        console.log(`  ${game.away_team} @ ${game.home_team}`)
        console.log(`  Commence time: ${game.commence_time}`)
        console.log(`  Bookmakers: ${game.bookmakers.length}`)
      }
    } else {
      const errorText = await nbaResponse.text()
      console.error('NBA Error:', errorText)
    }

    // Test 3: Get odds for NFL
    console.log('\n--- Test 3: Fetching NFL Odds ---')
    const nflUrl = `${ODDS_API_BASE}/sports/americanfootball_nfl/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
    const nflResponse = await fetch(nflUrl)

    console.log(`Status: ${nflResponse.status} ${nflResponse.statusText}`)

    if (nflResponse.ok) {
      const nflGames = await nflResponse.json()
      console.log(`NFL games available: ${nflGames.length}`)

      if (nflGames.length > 0) {
        console.log('\nFirst NFL game:')
        const game = nflGames[0]
        console.log(`  ${game.away_team} @ ${game.home_team}`)
        console.log(`  Commence time: ${game.commence_time}`)
        console.log(`  Bookmakers: ${game.bookmakers.length}`)
      }
    } else {
      const errorText = await nflResponse.text()
      console.error('NFL Error:', errorText)
    }

    // Test 4: Get odds for NHL
    console.log('\n--- Test 4: Fetching NHL Odds ---')
    const nhlUrl = `${ODDS_API_BASE}/sports/icehockey_nhl/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
    const nhlResponse = await fetch(nhlUrl)

    console.log(`Status: ${nhlResponse.status} ${nhlResponse.statusText}`)

    if (nhlResponse.ok) {
      const nhlGames = await nhlResponse.json()
      console.log(`NHL games available: ${nhlGames.length}`)

      if (nhlGames.length > 0) {
        console.log('\nFirst NHL game:')
        const game = nhlGames[0]
        console.log(`  ${game.away_team} @ ${game.home_team}`)
        console.log(`  Commence time: ${game.commence_time}`)
        console.log(`  Bookmakers: ${game.bookmakers.length}`)
      }
    } else {
      const errorText = await nhlResponse.text()
      console.error('NHL Error:', errorText)
    }

    // Test 5: Check API usage
    console.log('\n--- Test 5: Checking API Usage ---')
    const usageUrl = `${ODDS_API_BASE}/sports/?apiKey=${API_KEY}`
    const usageResponse = await fetch(usageUrl)

    const remainingRequests = usageResponse.headers.get('x-requests-remaining')
    const usedRequests = usageResponse.headers.get('x-requests-used')

    console.log(`Requests used: ${usedRequests || 'N/A'}`)
    console.log(`Requests remaining: ${remainingRequests || 'N/A'}`)

  } catch (error) {
    console.error('Error during testing:', error)
  }

  console.log('\n=== TEST COMPLETE ===\n')
}

testOddsAPI()
