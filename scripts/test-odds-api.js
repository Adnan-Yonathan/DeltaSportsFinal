// Test script to diagnose odds provider (SportsBettingDime) issues
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

const BOOK_IDS = envVars.SBD_BOOK_IDS || envVars.ODDS_BOOKMAKERS
const SBD_BASE = 'https://www.sportsbettingdime.com/wp-json/adpt/v1'

async function testSbdOdds() {
  console.log('\n=== ODDS PROVIDER (SportsBettingDime) DIAGNOSTIC TEST ===\n')
  console.log(`Book IDs: ${BOOK_IDS ? BOOK_IDS.split(',').length : 'DEFAULTS'}`)

  // Test 1: Get available sports
  console.log('\n--- Test 1: Fetching League Odds ---')
  try {
    const leagues = ['nba', 'nfl', 'mlb', 'nhl']
    for (const league of leagues) {
      const url = `${SBD_BASE}/${league}-odds?books=${BOOK_IDS || 'sr:book:18149,sr:book:18186'}&format=us`
      const response = await fetch(url)
      console.log(`${league.toUpperCase()} status: ${response.status} ${response.statusText}`)
      if (!response.ok) {
        const errorText = await response.text()
        console.error(`${league.toUpperCase()} error:`, errorText)
        continue
      }
      const payload = await response.json()
      const count = Array.isArray(payload?.data) ? payload.data.length : 0
      console.log(`${league.toUpperCase()} games returned: ${count}`)
    }

    console.log('\n--- Test 2: Fetching NBA Futures Markets ---')
    const marketsRes = await fetch(`${SBD_BASE}/futures/nba/markets`)
    console.log(`Markets status: ${marketsRes.status} ${marketsRes.statusText}`)
    if (marketsRes.ok) {
      const markets = await marketsRes.json()
      const count = Array.isArray(markets?.data) ? markets.data.length : 0
      console.log(`NBA futures markets: ${count}`)
    } else {
      const errorText = await marketsRes.text()
      console.error('Markets error:', errorText)
    }

  } catch (error) {
    console.error('Error during testing:', error)
  }

  console.log('\n=== TEST COMPLETE ===\n')
}

testSbdOdds()
