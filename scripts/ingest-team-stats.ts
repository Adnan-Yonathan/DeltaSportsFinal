import 'dotenv/config'
import { ingestTeamStats } from '@/lib/services/team-stats-ingestor'

async function main() {
  const result = await ingestTeamStats()

  for (const summary of result.summaries) {
    console.log(
      `[TEAM-STATS] ${summary.league} -> ${summary.teamsProcessed} teams, ` +
      `${summary.statsInserted} rows in team_stats, ${summary.trendsInserted} rows in team_trends`
    )
  }

  console.log(
    `[TEAM-STATS] Completed at ${result.capturedAt}. ` +
    `Inserted ${result.totalStatsInserted} team_stats rows and ${result.totalTrendsInserted} team_trends rows.`
  )
}

main().catch((error) => {
  console.error('[TEAM-STATS] Ingestion failed:', error)
  process.exit(1)
})
