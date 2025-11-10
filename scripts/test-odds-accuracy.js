// Comprehensive Odds API Accuracy Test
// Tests data integrity, consistency, and accuracy of The Odds API

const fs = require('fs')
const path = require('path')

// Try to load environment variables from .env.local
let API_KEY = process.env.ODDS_API_KEY
const envPath = path.join(__dirname, '..', '.env.local')

if (!API_KEY && fs.existsSync(envPath)) {
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

  API_KEY = envVars.ODDS_API_KEY
}

const ODDS_API_BASE = 'https://api.the-odds-api.com/v4'

// Validation helper functions
function validateOddsFormat(odds) {
  // American odds should be either positive or negative numbers
  const num = Number(odds)
  if (isNaN(num)) {
    return { valid: false, reason: 'Not a number' }
  }
  if (num === 0) {
    return { valid: false, reason: 'Odds cannot be zero' }
  }
  if (num > -100 && num < 100 && num !== 0) {
    return { valid: false, reason: 'American odds must be >= 100 or <= -100' }
  }
  return { valid: true }
}

function validateProbabilitySum(outcomes) {
  // Calculate implied probability sum (should be > 100% due to vig)
  let totalProb = 0

  outcomes.forEach(outcome => {
    const odds = outcome.price
    let prob

    if (odds > 0) {
      prob = 100 / (odds + 100)
    } else {
      prob = Math.abs(odds) / (Math.abs(odds) + 100)
    }

    totalProb += prob
  })

  const vigPercent = (totalProb - 1) * 100

  return {
    totalProb: totalProb * 100,
    vigPercent,
    valid: totalProb >= 1 && totalProb <= 1.3, // Typical vig is 0-30%
    reason: totalProb < 1
      ? 'Probabilities sum to less than 100% (arbitrage?)'
      : totalProb > 1.3
      ? 'Excessive vig (>30%)'
      : 'Normal'
  }
}

function validateSpreadLogic(spreadOutcomes) {
  // For spreads, the points should be opposite signs
  if (spreadOutcomes.length !== 2) {
    return { valid: false, reason: 'Should have exactly 2 outcomes' }
  }

  const [outcome1, outcome2] = spreadOutcomes

  if (!outcome1.point || !outcome2.point) {
    return { valid: false, reason: 'Missing point values' }
  }

  // Points should be negatives of each other (within rounding)
  const sum = outcome1.point + outcome2.point
  if (Math.abs(sum) > 0.1) {
    return {
      valid: false,
      reason: `Spread points don't balance: ${outcome1.point} and ${outcome2.point}`
    }
  }

  return { valid: true }
}

function validateTotalLogic(totalOutcomes) {
  // For totals, Over and Under should have the same line
  if (totalOutcomes.length !== 2) {
    return { valid: false, reason: 'Should have exactly 2 outcomes' }
  }

  const over = totalOutcomes.find(o => o.name === 'Over')
  const under = totalOutcomes.find(o => o.name === 'Under')

  if (!over || !under) {
    return { valid: false, reason: 'Missing Over/Under outcomes' }
  }

  if (over.point !== under.point) {
    return {
      valid: false,
      reason: `Over/Under lines don't match: ${over.point} vs ${under.point}`
    }
  }

  if (over.point <= 0) {
    return { valid: false, reason: `Invalid total line: ${over.point}` }
  }

  return { valid: true, line: over.point }
}

function validateTeamNames(game) {
  // Check that home and away teams are different
  if (game.home_team === game.away_team) {
    return { valid: false, reason: 'Home and away teams are the same' }
  }

  // Check for empty team names
  if (!game.home_team || !game.away_team) {
    return { valid: false, reason: 'Missing team names' }
  }

  return { valid: true }
}

function validateGameTime(game) {
  // Check that game time is a valid date
  const commenceTime = new Date(game.commence_time)
  const now = new Date()

  if (isNaN(commenceTime.getTime())) {
    return { valid: false, reason: 'Invalid date format' }
  }

  // Check if game is too far in the past (more than 1 day)
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  if (commenceTime < oneDayAgo) {
    return {
      valid: false,
      reason: `Game time is in the past: ${game.commence_time}`
    }
  }

  return { valid: true, commenceTime }
}

// Main test function
async function testOddsAccuracy() {
  console.log('\n' + '='.repeat(60))
  console.log('ODDS API ACCURACY TEST')
  console.log('='.repeat(60) + '\n')

  // Check API key
  if (!API_KEY) {
    console.error('❌ ERROR: ODDS_API_KEY not found!')
    console.log('\nPlease set up your API key:')
    console.log('1. Create a .env.local file in the project root')
    console.log('2. Add: ODDS_API_KEY=your_api_key_here')
    console.log('3. Get an API key from: https://the-odds-api.com/\n')
    return
  }

  console.log(`✓ API Key found: ${API_KEY.substring(0, 8)}...\n`)

  const testResults = {
    totalGames: 0,
    totalBookmakers: 0,
    totalMarkets: 0,
    validationErrors: [],
    warnings: [],
    sports: {}
  }

  try {
    // Test 1: Fetch available sports
    console.log('TEST 1: Fetching Available Sports')
    console.log('-'.repeat(60))

    const sportsUrl = `${ODDS_API_BASE}/sports/?apiKey=${API_KEY}`
    const sportsResponse = await fetch(sportsUrl)

    if (!sportsResponse.ok) {
      const errorText = await sportsResponse.text()
      console.error(`❌ Failed to fetch sports: ${sportsResponse.status} ${errorText}`)
      return
    }

    const allSports = await sportsResponse.json()
    const activeSports = allSports.filter(s => s.active)

    console.log(`✓ Total sports: ${allSports.length}`)
    console.log(`✓ Active sports: ${activeSports.length}\n`)

    // Test major sports (NBA, NFL, NHL, MLB)
    const sportsToTest = [
      { key: 'basketball_nba', name: 'NBA' },
      { key: 'americanfootball_nfl', name: 'NFL' },
      { key: 'icehockey_nhl', name: 'NHL' },
      { key: 'baseball_mlb', name: 'MLB' }
    ]

    for (const sport of sportsToTest) {
      console.log(`\nTEST: ${sport.name} (${sport.key})`)
      console.log('-'.repeat(60))

      const oddsUrl = `${ODDS_API_BASE}/sports/${sport.key}/odds/?apiKey=${API_KEY}&regions=us&markets=h2h,spreads,totals&oddsFormat=american`
      const oddsResponse = await fetch(oddsUrl)

      if (!oddsResponse.ok) {
        console.log(`⚠ No data available for ${sport.name} (${oddsResponse.status})`)
        testResults.sports[sport.key] = { available: false }
        continue
      }

      const games = await oddsResponse.json()
      console.log(`✓ Found ${games.length} games`)

      if (games.length === 0) {
        console.log(`⚠ No games currently available for ${sport.name}`)
        testResults.sports[sport.key] = { available: true, games: 0 }
        continue
      }

      testResults.totalGames += games.length

      const sportResults = {
        available: true,
        games: games.length,
        bookmakers: new Set(),
        validationErrors: 0,
        warnings: 0
      }

      // Analyze first game in detail
      const game = games[0]
      console.log(`\n📊 Analyzing: ${game.away_team} @ ${game.home_team}`)
      console.log(`   Game ID: ${game.id}`)
      console.log(`   Commence: ${game.commence_time}`)
      console.log(`   Bookmakers: ${game.bookmakers.length}`)

      testResults.totalBookmakers += game.bookmakers.length

      // Validate team names
      const teamValidation = validateTeamNames(game)
      if (!teamValidation.valid) {
        const error = `${sport.name}: ${teamValidation.reason}`
        testResults.validationErrors.push(error)
        sportResults.validationErrors++
        console.log(`   ❌ ${teamValidation.reason}`)
      }

      // Validate game time
      const timeValidation = validateGameTime(game)
      if (!timeValidation.valid) {
        const error = `${sport.name}: ${timeValidation.reason}`
        testResults.validationErrors.push(error)
        sportResults.validationErrors++
        console.log(`   ❌ ${timeValidation.reason}`)
      }

      // Analyze each bookmaker
      game.bookmakers.forEach(bookmaker => {
        sportResults.bookmakers.add(bookmaker.key)
        testResults.totalMarkets += bookmaker.markets.length

        bookmaker.markets.forEach(market => {
          // Validate odds format
          market.outcomes.forEach(outcome => {
            const oddsValidation = validateOddsFormat(outcome.price)
            if (!oddsValidation.valid) {
              const error = `${sport.name} - ${bookmaker.title} - ${market.key}: Invalid odds for ${outcome.name}: ${oddsValidation.reason} (${outcome.price})`
              testResults.validationErrors.push(error)
              sportResults.validationErrors++
            }
          })

          // Validate probability sum (vig check)
          const probValidation = validateProbabilitySum(market.outcomes)
          if (!probValidation.valid) {
            const warning = `${sport.name} - ${bookmaker.title} - ${market.key}: ${probValidation.reason} (${probValidation.totalProb.toFixed(2)}%)`
            testResults.warnings.push(warning)
            sportResults.warnings++
          }

          // Market-specific validation
          if (market.key === 'spreads') {
            const spreadValidation = validateSpreadLogic(market.outcomes)
            if (!spreadValidation.valid) {
              const error = `${sport.name} - ${bookmaker.title}: Spread validation failed: ${spreadValidation.reason}`
              testResults.validationErrors.push(error)
              sportResults.validationErrors++
            }
          }

          if (market.key === 'totals') {
            const totalValidation = validateTotalLogic(market.outcomes)
            if (!totalValidation.valid) {
              const error = `${sport.name} - ${bookmaker.title}: Total validation failed: ${totalValidation.reason}`
              testResults.validationErrors.push(error)
              sportResults.validationErrors++
            }
          }
        })
      })

      sportResults.bookmakers = Array.from(sportResults.bookmakers)
      testResults.sports[sport.key] = sportResults

      console.log(`\n   Results for ${sport.name}:`)
      console.log(`   - Unique bookmakers: ${sportResults.bookmakers.length}`)
      console.log(`   - Validation errors: ${sportResults.validationErrors}`)
      console.log(`   - Warnings: ${sportResults.warnings}`)

      if (sportResults.bookmakers.length > 0) {
        console.log(`   - Bookmakers: ${sportResults.bookmakers.join(', ')}`)
      }
    }

    // Final Summary
    console.log('\n' + '='.repeat(60))
    console.log('TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`\n📈 Overall Statistics:`)
    console.log(`   - Total games analyzed: ${testResults.totalGames}`)
    console.log(`   - Total bookmakers: ${testResults.totalBookmakers}`)
    console.log(`   - Total markets: ${testResults.totalMarkets}`)
    console.log(`   - Validation errors: ${testResults.validationErrors.length}`)
    console.log(`   - Warnings: ${testResults.warnings.length}`)

    // Check API usage
    const usageResponse = await fetch(sportsUrl)
    const remainingRequests = usageResponse.headers.get('x-requests-remaining')
    const usedRequests = usageResponse.headers.get('x-requests-used')

    console.log(`\n📊 API Usage:`)
    console.log(`   - Requests used: ${usedRequests || 'N/A'}`)
    console.log(`   - Requests remaining: ${remainingRequests || 'N/A'}`)

    // Display errors if any
    if (testResults.validationErrors.length > 0) {
      console.log(`\n❌ VALIDATION ERRORS (${testResults.validationErrors.length}):`)
      testResults.validationErrors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`)
      })
    } else {
      console.log(`\n✅ All validation checks passed!`)
    }

    // Display warnings if any
    if (testResults.warnings.length > 0 && testResults.warnings.length <= 10) {
      console.log(`\n⚠ WARNINGS (${testResults.warnings.length}):`)
      testResults.warnings.slice(0, 10).forEach((warning, i) => {
        console.log(`   ${i + 1}. ${warning}`)
      })
      if (testResults.warnings.length > 10) {
        console.log(`   ... and ${testResults.warnings.length - 10} more warnings`)
      }
    }

    // Overall assessment
    console.log(`\n${'='.repeat(60)}`)
    if (testResults.validationErrors.length === 0 && testResults.totalGames > 0) {
      console.log('✅ RESULT: Odds API data is ACCURATE and VALID')
    } else if (testResults.validationErrors.length > 0) {
      console.log('❌ RESULT: Odds API data has VALIDATION ERRORS')
    } else {
      console.log('⚠ RESULT: Unable to fully test (no games available)')
    }
    console.log('='.repeat(60) + '\n')

  } catch (error) {
    console.error('\n❌ ERROR during testing:', error.message)
    console.error(error)
  }
}

// Run the test
testOddsAccuracy()
