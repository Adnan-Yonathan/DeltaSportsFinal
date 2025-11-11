import assert from 'node:assert/strict'
import { normalizeStatWeights } from '../lib/models/model-utils'

const sampleStats = [
  {
    statKey: 'pace',
    label: 'Pace (season)',
    scope: 'team',
    importance: 5,
    direction: 'higher_better',
    normalization: 'zscore',
  },
  {
    statKey: 'defensive_rating',
    label: 'Defensive Rating',
    scope: 'team',
    importance: 3,
    direction: 'lower_better',
    normalization: 'zscore',
  },
  {
    statKey: 'recent_form',
    label: 'Last 5 games margin',
    scope: 'matchup_diff',
    importance: 2,
    direction: 'higher_better',
    normalization: 'raw',
  },
] as any[]

const normalized = normalizeStatWeights(sampleStats)

assert.equal(normalized.length, sampleStats.length, 'Should return same number of stats')

const weightSum = normalized.reduce((sum, stat) => sum + stat.weight, 0)
assert.ok(Math.abs(weightSum - 1) < 0.0001, 'Weights should sum to 1')

normalized.forEach((stat, idx) => {
  assert.equal(stat.statKey, sampleStats[idx].statKey)
  assert.equal(stat.importance, sampleStats[idx].importance)
  assert.ok(stat.weight > 0, 'Each normalized weight should be positive')
})

let errorCaught = false
try {
  normalizeStatWeights([])
} catch (error) {
  errorCaught = true
}

assert.ok(errorCaught, 'Normalizing no stats should throw')

console.log('custom-models normalization tests passed')
