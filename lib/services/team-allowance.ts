import { getNbaOpponentStats } from '@/lib/services/espn-opponent-stats'

type AllowanceRow = {
  abbrev: string
  team: string
  opp_fg: number
  opp_fga: number
  opp_3p: number
  opp_3pa: number
  opp_ft: number
  opp_fta: number
  opp_trb: number
  opp_ast: number
  opp_stl: number
  opp_blk: number
  opp_tov: number
  opp_pts: number
}

type StatKey =
  | 'opp_fg'
  | 'opp_fga'
  | 'opp_3p'
  | 'opp_3pa'
  | 'opp_ft'
  | 'opp_fta'
  | 'opp_trb'
  | 'opp_ast'
  | 'opp_stl'
  | 'opp_blk'
  | 'opp_tov'
  | 'opp_pts'

const CACHE_TTL = 1000 * 60 * 60 * 6
let cached: { ts: number; rows: AllowanceRow[] } | null = null

const loadAllowanceRows = async (): Promise<AllowanceRow[]> => {
  const now = Date.now()
  if (cached && now - cached.ts < CACHE_TTL) return cached.rows

  const entries = await getNbaOpponentStats()
  const rows = entries
    .filter((entry) => entry.teamAbbr)
    .map((entry) => ({
      abbrev: entry.teamAbbr.toUpperCase(),
      team: entry.teamName,
      opp_fg: entry.stats.opponentFieldGoalsMadePerGame ?? 0,
      opp_fga: entry.stats.opponentFieldGoalsAttemptedPerGame ?? 0,
      opp_3p: entry.stats.opponentThreePointMadePerGame ?? entry.stats.opponentThreeMadePerGame ?? 0,
      opp_3pa: entry.stats.opponentThreePointAttemptsPerGame ?? entry.stats.opponentThreeAttemptedPerGame ?? 0,
      opp_ft: entry.stats.opponentFreeThrowsMadePerGame ?? 0,
      opp_fta: entry.stats.opponentFreeThrowsAttemptedPerGame ?? 0,
      opp_trb: entry.stats.opponentReboundsPerGame ?? 0,
      opp_ast: entry.stats.opponentAssistsPerGame ?? 0,
      opp_stl: entry.stats.opponentStealsPerGame ?? 0,
      opp_blk: entry.stats.opponentBlocksPerGame ?? 0,
      opp_tov: entry.stats.opponentTurnoversPerGame ?? 0,
      opp_pts: entry.stats.opponentPointsPerGame ?? entry.stats.pointsAgainstPerGame ?? 0,
    }))

  cached = { ts: now, rows }
  return rows
}

export const getTeamAllowanceStats = async (sport: string, teamAbbr: string) => {
  if (sport !== 'nba') return null
  const rows = await loadAllowanceRows()
  return rows.find((row) => row.abbrev === teamAbbr.toUpperCase()) || null
}

export const getTeamAllowanceTrends = async (sport: string, teamAbbr: string) => {
  if (sport !== 'nba') return { error: 'Allowance trends only available for NBA' }
  const rows = await loadAllowanceRows()
  const row = rows.find((entry) => entry.abbrev === teamAbbr.toUpperCase())
  if (!row) return { error: `Team ${teamAbbr} not found in allowance data` }

  const stats: Record<string, number> = {
    opp_fg: row.opp_fg,
    opp_fga: row.opp_fga,
    opp_3p: row.opp_3p,
    opp_3pa: row.opp_3pa,
    opp_ft: row.opp_ft,
    opp_fta: row.opp_fta,
    opp_trb: row.opp_trb,
    opp_ast: row.opp_ast,
    opp_stl: row.opp_stl,
    opp_blk: row.opp_blk,
    opp_tov: row.opp_tov,
    opp_pts: row.opp_pts,
  }

  const ranks: Record<string, number> = {}
  const statsArr = Object.keys(stats) as StatKey[]
  for (const key of statsArr) {
    const sorted = rows.slice().sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0))
    const idx = sorted.findIndex((r) => r.abbrev === row.abbrev)
    ranks[key] = idx + 1
  }

  return { team: teamAbbr.toUpperCase(), stats, ranks }
}
