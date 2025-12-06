const fs = require('fs')
const path = 'lib/services/espn-aggregations.ts'
let txt = fs.readFileSync(path, 'utf8')
const pattern = /const filtered[\s\S]*?return \[header, body, examples.length \? `Examples:\\n\$\{examples.join\('\\n'\)\}` : undefined\].*?\n}\s*$/m
const repl = [
  'const filtered = normalizedLogs.filter((g) => meetsConditions(g.stats, conditions) && matchOpponent(g, opponentHint))',
  '  const count = filtered.length',
  '',
  '  const instances = filtered.map((g) => {',
  "    const statSummary = conditions.map((c) => `${c.stat}: ${g.stats[c.stat] ?? '--'}`).join(', ')",
  "    return `- ${g.date}${g.opponent ? ` vs ${g.opponent}` : ''}${g.result ? ` (${g.result})` : ''} -- ${statSummary}`",
  '  })',
  '',
  '  const condSummary = conditions',
  "    .map((c) => `${c.stat} ${c.op === 'gte' ? '>=' : c.op === 'lte' ? '<=' : c.op === 'eq' ? '=' : c.op === 'gt' ? '>' : '<'} ${c.value}`)",
  "    .join(', ')",
  "  const seasonLabel = `${seasonYear}${seasonType === 3 ? ' Playoffs' : seasonType === 1 ? ' Preseason' : ' Regular'}`",
  '',
  "  const header = `${titleCase(playerName)} -- ${seasonLabel}`",
  "  const body = `${count} game${count === 1 ? '' : 's'} with ${condSummary}${opponentHint ? ` vs ${titleCase(opponentHint)}` : ''}.`",
  '',
  "  return [header, body, instances.length ? `Instances:\n${instances.join('\n')}` : undefined].filter(Boolean).join('\n')",
  '}',
  ''
].join('\n')
if (!pattern.test(txt)) {
  console.error('pattern not found')
  process.exit(1)
}
txt = txt.replace(pattern, repl)
fs.writeFileSync(path, txt)
