import { nbaTeamPerGame2025_26Csv } from '../../data/nba_team_per_game_2025_26'

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

const parseNumber = (val: string): number => {
  const n = Number(val)
  return Number.isFinite(n) ? n : 0
}

const parseCsv = (csv: string): AllowanceRow[] => {
  const lines = csv.trim().split('\n')
  const header = lines.shift()
  if (!header) return []
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const cols = line.split(',')
      return {
        abbrev: cols[2],
        team: cols[2],
        opp_fg: parseNumber(cols[24]),
        opp_fga: parseNumber(cols[25]),
        opp_3p: parseNumber(cols[28]),
        opp_3pa: parseNumber(cols[29]),
        opp_ft: parseNumber(cols[30]),
        opp_fta: parseNumber(cols[31]),
        opp_trb: parseNumber(cols[34]),
        opp_ast: parseNumber(cols[35]),
        opp_stl: parseNumber(cols[36]),
        opp_blk: parseNumber(cols[37]),
        opp_tov: parseNumber(cols[38]),
        opp_pts: parseNumber(cols[40]),
      }
    })
}

const nbaAllowance = parseCsv(nbaTeamPerGame2025_26Csv)
const indexByAbbr = new Map<string, AllowanceRow>(
  nbaAllowance.map((r) => [r.abbrev.toUpperCase(), r])
)

export const getTeamAllowanceStats = (sport: string, teamAbbr: string) => {
  if (sport !== 'nba') return null
  return indexByAbbr.get(teamAbbr.toUpperCase()) || null
}

export const getTeamAllowanceTrends = (sport: string, teamAbbr: string) => {
  if (sport !== 'nba') return { error: 'Allowance trends only available for NBA' }
  const row = indexByAbbr.get(teamAbbr.toUpperCase())
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
    const sorted = nbaAllowance.slice().sort((a, b) => (a[key] ?? 0) - (b[key] ?? 0))
    const idx = sorted.findIndex((r) => r.abbrev === row.abbrev)
    ranks[key] = idx + 1
  }

  return { team: teamAbbr.toUpperCase(), stats, ranks }
}
