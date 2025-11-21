import assert from 'node:assert/strict'
import { hasRelevantTeamMentions } from '../lib/live-score-articles'

const lakersVsCeltics = [
  ['Los Angeles Lakers', 'Lakers', 'LA Lakers', 'LAL'],
  ['Boston Celtics', 'Celtics', 'BOS'],
]

assert.ok(
  hasRelevantTeamMentions('Lakers stun Celtics in overtime thriller', lakersVsCeltics),
  'Should accept articles mentioning both teams'
)

assert.ok(
  !hasRelevantTeamMentions('Celtics cruise to a win over rivals', lakersVsCeltics),
  'Should reject when only one team is referenced'
)

assert.ok(
  !hasRelevantTeamMentions('LA edges out Boston on the road', [
    ['LA'], // two-letter token should be ignored
    ['Boston'],
  ]),
  'Should ignore sub-3 character tokens and avoid false positives'
)

console.log('live-scores article relevance tests passed')
