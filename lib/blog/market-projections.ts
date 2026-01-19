import { normalizeTeamKey, resolveSportKey } from '@/lib/identity/sport'
import type { GameEdgeAnalysis } from '@/lib/services/slate-edge-detector'

const SPORT_LABELS: Record<string, string> = {
  basketball_nba: 'NBA',
  basketball_ncaab: 'NCAAB',
  americanfootball_nfl: 'NFL',
  americanfootball_ncaaf: 'NCAAF',
  baseball_mlb: 'MLB',
  icehockey_nhl: 'NHL',
}

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')

export const buildGameSlug = (awayTeam: string, homeTeam: string) =>
  `${slugify(awayTeam)}-vs-${slugify(homeTeam)}-betting-breakdown`

export const buildBlogPath = (
  sport: string,
  date: string,
  awayTeam: string,
  homeTeam: string
) => `/blog/${sport}/${date}/${buildGameSlug(awayTeam, homeTeam)}`

export const buildSlatePath = (sport: string, date: string) =>
  `/slate/${sport}/${date}`

export const getSportLabel = (sport: string) =>
  SPORT_LABELS[sport] ?? sport.toUpperCase()

export const formatEdgeDate = (edge: GameEdgeAnalysis) => {
  if (!edge?.commenceTime) return null
  const parsed = new Date(edge.commenceTime)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed.toISOString().slice(0, 10)
}

export const normalizeMatchupKey = (awayTeam?: string, homeTeam?: string) => {
  if (!awayTeam || !homeTeam) return ''
  return `${normalizeTeamKey(awayTeam)}@${normalizeTeamKey(homeTeam)}`
}

export const resolveSportParam = (sport: string) =>
  resolveSportKey(sport) ?? sport

export const findEdgeForSlug = (
  edges: GameEdgeAnalysis[],
  slug: string,
  date: string
) => {
  for (const edge of edges) {
    if (!edge?.awayTeam || !edge?.homeTeam) continue
    const edgeSlug = buildGameSlug(edge.awayTeam, edge.homeTeam)
    if (edgeSlug !== slug) continue
    const edgeDate = formatEdgeDate(edge)
    if (edgeDate === date) return edge
  }
  return null
}
