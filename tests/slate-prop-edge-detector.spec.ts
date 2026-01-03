import assert from 'node:assert/strict'
import { formatSlatePropEdgesForChat, type SlatePropEdgeResult } from '../lib/services/slate-prop-edge-detector'

const baseEdge = {
  direction: 'over' as const,
  projection: 24.5,
  edgePoints: 3.0,
  edgePercent: 6.8,
  modelProbability: 0.62,
  impliedProbability: 0.55,
  bestBook: 'DraftKings',
  bestOdds: -105,
  verdict: { verdict: 'strong' as const, confidence: 'high' as const, reason: 'sample' },
  factors: ['Base avg: 21.5'],
  sampleSize: 5,
}

const nbaSample: SlatePropEdgeResult = {
  sport: 'basketball_nba',
  sportLabel: 'NBA',
  date: '2025-01-01',
  propsAnalyzed: 3,
  edges: [
    {
      player: 'Test Player',
      team: 'Testers',
      opponent: 'Opps',
      game: 'Opps @ Testers',
      market: 'points',
      line: 21.5,
      ...baseEdge,
    },
  ],
  summary: { strongEdges: 1, softEdges: 0, noEdges: 2 },
}

const ncaabSample: SlatePropEdgeResult = {
  sport: 'basketball_ncaab',
  sportLabel: 'NCAAB',
  date: '2025-01-01',
  propsAnalyzed: 2,
  edges: [
    {
      player: 'College Player',
      team: 'College',
      opponent: 'Rivals',
      game: 'Rivals @ College',
      market: 'rebounds',
      line: 7.5,
      direction: 'under',
      projection: 6.2,
      edgePoints: 1.3,
      edgePercent: 4.1,
      modelProbability: 0.58,
      impliedProbability: 0.5,
      bestBook: 'FanDuel',
      bestOdds: 110,
      verdict: { verdict: 'soft' as const, confidence: 'medium' as const, reason: 'sample' },
      factors: ['Base avg: 7.0'],
      sampleSize: 4,
    },
  ],
  summary: { strongEdges: 0, softEdges: 1, noEdges: 1 },
}

const nbaOutput = formatSlatePropEdgesForChat(nbaSample)
assert.ok(nbaOutput.includes('Player Prop Edges (NBA)'), 'NBA prop edges should include header')
assert.ok(nbaOutput.includes('Test Player'), 'NBA prop edges should include player name')

const ncaabOutput = formatSlatePropEdgesForChat(ncaabSample)
assert.ok(ncaabOutput.includes('Player Prop Edges (NCAAB)'), 'NCAAB prop edges should include header')
assert.ok(ncaabOutput.includes('College Player'), 'NCAAB prop edges should include player name')

console.log('slate-prop-edge-detector tests passed')
