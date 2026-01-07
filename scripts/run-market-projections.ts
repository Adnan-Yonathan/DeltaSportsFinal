import { analyzeSlateEdges } from '../lib/services/slate-edge-detector'
import { writeFile } from 'fs/promises'
import { join } from 'path'

const run = async (sport: string) => {
  const result = await analyzeSlateEdges(sport, { limit: 200 })
  const path = join(process.cwd(), 'cache', `market-projections-${sport}.json`)
  await writeFile(path, JSON.stringify({ ...result, updatedAt: new Date().toISOString(), sport }, null, 2))
  console.log(`Wrote ${result?.edges?.length ?? 0} edges to ${path}`)
}

run('basketball_ncaab').catch((err) => {
  console.error(err)
  process.exit(1)
})
