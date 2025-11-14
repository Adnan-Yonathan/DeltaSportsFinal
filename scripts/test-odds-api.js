// Test script to diagnose odds provider (Odds-API.io) issues
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
const ODDS_IO_BASE = 'https://api.odds-api.io/v3'

async function testOddsAPI() {
  console.log('\n=== ODDS PROVIDER (Odds-API.io) DIAGNOSTIC TEST ===\n')
  console.log(`API Key: ${API_KEY ? API_KEY.substring(0, 8) + '...' : 'NOT FOUND'}`)

  // Test 1: Get available sports
  console.log('\n--- Test 1: Fetching Available Sports (no auth) ---')
  try {
    const sportsUrl = `${ODDS_IO_BASE}/sports`
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
    console.log(`Total sports returned: ${sports.length}`)

    console.log('\nActive Sports:')
    activeSports.forEach(sport => {
      console.log(`  - ${sport.key}: ${sport.title} (Group: ${sport.group})`)
    })

    // Test 2: Get odds for NBA
    console.log('\n--- Test 2: Fetching NBA Events + Odds ---')
    // Fetch events (pending)
    const eventsUrl = `${ODDS_IO_BASE}/events?apiKey=${API_KEY}&sport=basketball&league=nba&status=pending`
    const evRes = await fetch(eventsUrl)
    console.log(`Events status: ${evRes.status} ${evRes.statusText}`)
    const events = evRes.ok ? await evRes.json() : []
    console.log(`NBA pending events: ${Array.isArray(events) ? events.length : 0}`)

    // Pick up to 3 event IDs and fetch odds individually
    const ids = Array.isArray(events) ? events.map(e => String(e.id)).slice(0, 3) : []
    if (ids.length) {
      for (const id of ids) {
        const oddsUrl = new URL(`${ODDS_IO_BASE}/odds`)
        oddsUrl.searchParams.set('apiKey', API_KEY)
        oddsUrl.searchParams.set('eventId', id)
        oddsUrl.searchParams.set('bookmakers', envVars.ODDS_BOOKMAKERS || 'Bet365,Unibet,Pinnacle')
        const nbaResponse = await fetch(oddsUrl.toString())

        console.log(`Odds status (${id}): ${nbaResponse.status} ${nbaResponse.statusText}`)

        if (nbaResponse.ok) {
          const nbaOdds = await nbaResponse.json()
          const bookmakerCount = nbaOdds?.bookmakers ? Object.keys(nbaOdds.bookmakers).length : 0
          console.log(`Bookmakers returned: ${bookmakerCount}`)
        } else {
          const errorText = await nbaResponse.text()
          console.error(`NBA Error for event ${id}:`, errorText)
        }
      }
    } else {
      console.log('No NBA events found to test odds endpoint.')
    }

    // Test 3: Get odds for NFL
    console.log('\n--- Test 3: Fetching NFL Events (pending) ---')
    const nflEvUrl = `${ODDS_IO_BASE}/events?apiKey=${API_KEY}&sport=football&league=nfl&status=pending`
    const nflResponse = await fetch(nflEvUrl)

    console.log(`Status: ${nflResponse.status} ${nflResponse.statusText}`)

    if (nflResponse.ok) {
      const nflEvents = await nflResponse.json()
      console.log(`NFL pending events: ${Array.isArray(nflEvents) ? nflEvents.length : 0}`)
    } else {
      const errorText = await nflResponse.text()
      console.error('NFL Error:', errorText)
    }

    // Test 4: Get odds for NHL
    console.log('\n--- Test 4: Fetching NHL Events (pending) ---')
    const nhlEvUrl = `${ODDS_IO_BASE}/events?apiKey=${API_KEY}&sport=hockey&league=nhl&status=pending`
    const nhlResponse = await fetch(nhlEvUrl)

    console.log(`Status: ${nhlResponse.status} ${nhlResponse.statusText}`)

    if (nhlResponse.ok) {
      const nhlEvents = await nhlResponse.json()
      console.log(`NHL pending events: ${Array.isArray(nhlEvents) ? nhlEvents.length : 0}`)
    } else {
      const errorText = await nhlResponse.text()
      console.error('NHL Error:', errorText)
    }

    // Test 5: Check API usage
    console.log('\n--- Test 5: Checking Rate Limit Headers ---')
    // Hit sports again to read provider rate-limit headers
    const usageResponse = await fetch(`${ODDS_IO_BASE}/sports`)
    const limit = usageResponse.headers.get('x-ratelimit-limit')
    const remaining = usageResponse.headers.get('x-ratelimit-remaining')
    const reset = usageResponse.headers.get('x-ratelimit-reset')

    console.log(`Rate limit: ${remaining || 'N/A'} / ${limit || 'N/A'}`)
    console.log(`Resets at: ${reset || 'N/A'}`)

  } catch (error) {
    console.error('Error during testing:', error)
  }

  console.log('\n=== TEST COMPLETE ===\n')
}

testOddsAPI()
