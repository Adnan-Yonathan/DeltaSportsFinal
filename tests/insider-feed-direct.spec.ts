import assert from 'node:assert/strict'

import {
  resolveInsiderSportKeyFromEvent,
  resolveInsiderTradeSportKey,
} from '../lib/services/insider-sport-detection'

assert.equal(
  resolveInsiderTradeSportKey({
    slug: 'fifwc-ecu-kor-2026-06-20-player-props',
  }),
  'fifwc'
)

assert.equal(
  resolveInsiderSportKeyFromEvent({
    title: 'Ecuador vs South Korea - Player Props',
    seriesSlug: 'soccer-fifwc',
  } as any),
  'fifwc'
)

assert.equal(
  resolveInsiderSportKeyFromEvent({
    title: 'Ecuador vs South Korea - Player Props',
    series: [{ slug: 'soccer-fifwc', title: 'FIFA World Cup' }],
  } as any),
  'fifwc'
)

console.log('insider feed direct sport detection tests passed')
