import assert from 'node:assert/strict'
import {
  buildAnalysisResponse,
  buildPickGuidanceResponse,
  evaluateLineEdge,
  evaluatePropEdge,
  inferMarketType,
} from '../lib/analysis/bet-tools'

const propEdgeStrong = evaluatePropEdge({
  line: 18.5,
  direction: 'over',
  seasonHitRate: 0.72,
  lastTenHitRate: 0.8,
  seasonAvg: 25,
  lineDeltaThreshold: 2,
})

assert.equal(propEdgeStrong.verdict, 'strong', 'Prop edge should be strong for high hit rates and avg gap')

const spreadEdgeStrong = evaluateLineEdge({
  marketType: 'spread',
  line: 3.0,
  targetLine: 6.5,
  supportingSignals: 2,
})

assert.equal(spreadEdgeStrong.verdict, 'strong', 'Spread edge should be strong when model gap is large')
assert.ok(spreadEdgeStrong.flag, 'Spread edge should flag a mispriced line with multiple signals')

const totalEdgeSoft = evaluateLineEdge({
  marketType: 'total',
  line: 214,
  targetLine: 218,
  supportingSignals: 0,
})

assert.equal(totalEdgeSoft.verdict, 'soft', 'Total edge should be soft for moderate gap')

const pickGuidance = buildPickGuidanceResponse({
  subject: 'Missouri vs Illinois',
})

assert.ok(pickGuidance.includes('How to find the best bet'), 'Pick guidance should include the checklist section')
assert.ok(pickGuidance.includes('What Delta can provide right now'), 'Pick guidance should list Delta capabilities')

const analysis = buildAnalysisResponse({
  title: 'Thunder vs Spurs',
  marketLabel: 'spread -4.5',
  snapshotLines: ['Line/price: -4.5 @ -110', 'Injuries/availability: none noted'],
  edge: spreadEdgeStrong,
  nextActions: ['Compare best price across books'],
})

assert.ok(analysis.includes('Market snapshot'), 'Analysis response should include snapshot section')
assert.ok(analysis.includes('Edge check'), 'Analysis response should include edge section')

assert.equal(inferMarketType('LeBron points prop'), 'player_prop', 'Should detect player prop market')
assert.equal(inferMarketType('Q1 total'), 'quarter', 'Should detect quarter markets')

console.log('bet-tools tests passed')
