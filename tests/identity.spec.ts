import assert from 'node:assert/strict'
import { normalizeTeamKey, resolveSportKey } from '../lib/identity/sport'

assert.equal(resolveSportKey('ncaab'), 'basketball_ncaab')
assert.equal(resolveSportKey('college basketball'), 'basketball_ncaab')
assert.equal(resolveSportKey('NBA'), 'basketball_nba')
assert.equal(normalizeTeamKey("St. John's (NY)"), 'stjohnsny')
