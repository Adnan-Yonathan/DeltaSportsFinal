/**
 * Test script for recommendation engine
 * Tests: Grizzlies @ Timberwolves
 */

import { getGameRecommendations, formatRecommendationForChat } from './lib/services/recommendation-engine'

async function test() {
  console.log('Testing: Grizzlies @ Timberwolves (Wolves at home)\n')

  try {
    const recommendations = await getGameRecommendations('Timberwolves Grizzlies', 'all')

    if (!recommendations || recommendations.length === 0) {
      console.log('❌ No recommendations generated')
      console.log('This could mean:')
      console.log('  - Team stats not found in CSV data')
      console.log('  - Team name parsing failed')
    } else {
      console.log(`✅ Generated ${recommendations.length} recommendation(s):\n`)

      for (const rec of recommendations) {
        console.log(formatRecommendationForChat(rec))
        console.log('\n' + '='.repeat(60) + '\n')

        // Also show raw data
        console.log('Raw data:', JSON.stringify(rec, null, 2))
        console.log('\n' + '='.repeat(60) + '\n')
      }
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

test()
