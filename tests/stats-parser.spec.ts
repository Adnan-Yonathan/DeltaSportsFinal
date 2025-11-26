import assert from 'node:assert/strict'
import { detectGameOdds } from '../lib/utils/stats-parser'

const sampleTable = `
### NBA - Boston Celtics @ Miami Heat
**Game Time:** Wed 7:00 PM ET
| Market | Team | FanDuel | DraftKings |
| --- | --- | --- | --- |
| Moneyline | Miami Heat | -110 | -115 |
| &nbsp; | Boston Celtics | +100 | +105 |
| Spread | Miami Heat | -3.5 (-110) | -3 (-115) |
| &nbsp; | Boston Celtics | +3.5 (-110) | +3 (-105) |
| Total | Over | 220.5 (-110) | 221 (-115) |
| &nbsp; | Under | 220.5 (-110) | 221 (-105) |
`

;(async () => {
  const parsed = await detectGameOdds(sampleTable)
  assert.ok(parsed, 'Should parse game odds block')

  const moneyline = parsed!.markets.moneyline
  assert.ok(moneyline, 'Moneyline market should exist')
  assert.equal(moneyline?.outcomes.length, 2, 'Moneyline should include both teams')
  assert.equal(moneyline?.outcomes.some((o) => o.label === 'Miami Heat'), true)
  assert.equal(moneyline?.outcomes.some((o) => o.label === 'Boston Celtics'), true)

  const spreads = parsed!.markets.spreads
  assert.ok(spreads, 'Spread market should exist')
  assert.equal(spreads?.outcomes.length, 2, 'Spread should include both teams')
  const awaySpread = spreads?.outcomes.find((o) => o.label === 'Miami Heat')
  const homeSpread = spreads?.outcomes.find((o) => o.label === 'Boston Celtics')
  assert.equal(awaySpread?.bookmakers['FanDuel']?.point, -3.5)
  assert.equal(homeSpread?.bookmakers['DraftKings']?.point, 3)

  const totals = parsed!.markets.totals
  assert.ok(totals, 'Totals market should exist')
  assert.equal(totals?.outcomes.length, 2, 'Totals should include both over and under')
  const over = totals?.outcomes.find((o) => o.label === 'Over')
  const under = totals?.outcomes.find((o) => o.label === 'Under')
  assert.equal(Boolean(over), true)
  assert.equal(Boolean(under), true)

  console.log('stats-parser detectGameOdds parsing tests passed')
})()
