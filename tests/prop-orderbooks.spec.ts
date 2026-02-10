import assert from 'node:assert/strict'

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

console.log('prop orderbooks mapping tests passed')
