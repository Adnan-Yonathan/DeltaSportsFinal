import Papa from 'papaparse'
const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

type StatRow = Record<string, any>

export interface RecentPerformance {
  date: string
  opponent: string
  result?: string
  stats: Record<string, number>
}

// For NFL, reuse the player_stats CSV and extract last 5 games from a game's CSV is heavy;
// This helper expects a pre-filtered list of stat rows for the player.
export function buildRecentPerformances(rows: StatRow[], maxGames = 5): RecentPerformance[] {
  const sorted = [...rows].sort((a, b) => {
    const aDate = new Date(String(a.game_date || a.week_date || '')).getTime()
    const bDate = new Date(String(b.game_date || b.week_date || '')).getTime()
    return bDate - aDate
  })

  const take = sorted.slice(0, maxGames)
  return take.map((row) => {
    const opponent = row.opponent ?? row.opp ?? ''
    const result = row.result ?? row.game_result ?? undefined
    const stats: Record<string, number> = {}

    const statKeys = [
      ['passing_yards', 'PASS YDS'],
      ['passing_touchdowns', 'PASS TD'],
      ['passing_interceptions', 'INT'],
      ['rushing_yards', 'RUSH YDS'],
      ['rushing_touchdowns', 'RUSH TD'],
      ['receiving_yards', 'REC YDS'],
      ['receiving_touchdowns', 'REC TD'],
      ['receptions', 'REC'],
      ['targets', 'TGT'],
      ['carries', 'CAR'],
      ['attempts', 'ATT'],
      ['completions', 'CMP'],
      ['passing_epa', 'PASS EPA'],
      ['rushing_epa', 'RUSH EPA'],
      ['receiving_epa', 'REC EPA'],
    ]

    for (const [key, label] of statKeys) {
      const val = row[key]
      if (typeof val === 'number' && Number.isFinite(val)) {
        stats[label] = val
      }
    }

    return {
      date: String(row.game_date || row.week_date || row.date || ''),
      opponent: String(opponent),
      result: result ? String(result) : undefined,
      stats,
    }
  })
}

// Utility for loading CSV blobs (used by NFL stats) when needed
export async function parseCsv(url: string): Promise<StatRow[]> {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return []
  const text = await res.text()
  const parsed = Papa.parse<StatRow>(text, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
  })
  return parsed.data || []
}

export function matchPlayerRows(rows: StatRow[], playerName: string) {
  const target = normalizeName(playerName)
  return rows.filter((row) => normalizeName(String(row.player_display_name ?? row.player_name ?? '')) === target)
}
