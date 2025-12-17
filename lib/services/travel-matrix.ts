import { nbaTravelMeta } from '../../data/nba_travel_meta'

type TeamIndexMap = Record<string, number>

const teamIndex: TeamIndexMap = nbaTravelMeta.teams.reduce((acc, abbr, idx) => {
  acc[abbr.toUpperCase()] = idx
  return acc
}, {} as TeamIndexMap)

export type TravelMetrics = {
  from: string
  to: string
  distanceMiles: number | null
  timezoneDeltaHours: number | null
  altitudeDeltaFt: number | null
}

const getIndex = (abbr: string): number | null => {
  const idx = teamIndex[abbr.toUpperCase()]
  return typeof idx === 'number' ? idx : null
}

/**
 * Lookup travel burden from away -> home team using precomputed matrices.
 */
export function getTravelMetrics(awayAbbr: string, homeAbbr: string): TravelMetrics {
  const from = awayAbbr.toUpperCase()
  const to = homeAbbr.toUpperCase()
  const i = getIndex(from)
  const j = getIndex(to)

  if (i == null || j == null) {
    return {
      from,
      to,
      distanceMiles: null,
      timezoneDeltaHours: null,
      altitudeDeltaFt: null,
    }
  }

  return {
    from,
    to,
    distanceMiles: nbaTravelMeta.distance_matrix_miles[i]?.[j] ?? null,
    timezoneDeltaHours: nbaTravelMeta.timezone_delta_matrix_hours[i]?.[j] ?? null,
    altitudeDeltaFt: nbaTravelMeta.altitude_delta_matrix_ft[i]?.[j] ?? null,
  }
}

/**
 * Fetch arena metadata by team abbrev (useful for downstream labeling).
 */
export function getArenaMeta(teamAbbr: string) {
  const abbr = teamAbbr.toUpperCase()
  return nbaTravelMeta.arenas.find((a) => a.abbrev.toUpperCase() === abbr) || null
}
