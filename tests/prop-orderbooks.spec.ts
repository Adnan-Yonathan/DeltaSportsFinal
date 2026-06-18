import assert from 'node:assert/strict'

import {
  normalizePolymarketPropType,
  resolvePolymarketEventDate,
  resolvePolymarketSportsMarketTypes,
} from '../lib/services/polymarket-prop-mapping'
import { resolveOverUnderSide } from '../lib/utils/props'

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

assert.equal(resolveOverUnderSide(normalizeText('LeBron over 28.5 points')), 'Over')
assert.equal(resolveOverUnderSide(normalizeText('LeBron under 28.5 points')), 'Under')

{
  const raw = 'LeBron James records 30+ points'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), 'Over')
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'no'), 'Under')
}

{
  const raw = 'Santi Aldama: Assists Over 2.5'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), 'Over')
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'no'), 'Under')
}

{
  const raw = 'Jamal Murray: Points O/U 29.5'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), 'Over')
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'no'), 'Under')
}

{
  const raw = 'Will Player score less than 25.5 points?'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), 'Under')
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'no'), 'Over')
}

{
  const raw = 'Will Player score 25.5 points?'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), null)
}

{
  const expectedMappings = new Map([
    ['baseball_player_strikeouts', 'strikeouts'],
    ['baseball_player_home_runs', 'home_runs'],
    ['soccer_player_goals', 'goals'],
    ['soccer_player_assists', 'assists'],
    ['soccer_player_shots', 'shots'],
    ['soccer_player_shots_on_target', 'shots_on_target'],
    ['soccer_player_goals_plus_assists', 'goals_plus_assists'],
    ['soccer_player_goalkeeper_saves', 'goalkeeper_saves'],
  ])

  for (const [marketType, propType] of expectedMappings) {
    assert.equal(normalizePolymarketPropType(marketType), propType)
  }
  assert.equal(normalizePolymarketPropType('soccer_player_cards'), null)
}

{
  const mlbTypes = resolvePolymarketSportsMarketTypes('baseball_mlb')
  assert.deepEqual(mlbTypes, ['baseball_player_strikeouts', 'baseball_player_home_runs'])

  const fifwcTypes = resolvePolymarketSportsMarketTypes('soccer_fifwc')
  assert.deepEqual(fifwcTypes, [
    'soccer_player_goals',
    'soccer_player_assists',
    'soccer_player_shots',
    'soccer_player_shots_on_target',
    'soccer_player_goals_plus_assists',
    'soccer_player_goalkeeper_saves',
  ])
}

{
  const raw = 'Alan Minda: 1+ goals + assists'
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'yes'), 'Over')
  assert.equal(resolveOverUnderSide(normalizeText(raw), raw, 'no'), 'Under')
}

{
  const market = {
    events: [
      {
        eventDate: null,
        startTime: '2026-06-20T22:00:00Z',
      },
    ],
  }
  assert.equal(resolvePolymarketEventDate(market as any), '2026-06-20')
}

console.log('prop orderbooks mapping tests passed')
