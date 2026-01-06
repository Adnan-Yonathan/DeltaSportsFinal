import type { LeagueId } from '@/lib/live-scores'
import type { TeamStats as PregameTeamStats } from '@/lib/services/pregame-value-calculator'
import { getTeamStats as getNbaTeamStats } from '@/lib/services/matchup-analyzer'
import { getCbbAdvancedRatingsForTeam } from '@/lib/services/cbb-advanced-ratings'
import { getTeamStats as getSportsTeamStats } from '@/lib/sports-stats-api'

const DEFAULT_PACE_BY_LEAGUE: Record<LeagueId, number> = {
  nba: 100,
  ncaab: 70,
  nfl: 60,
  nhl: 60,
  cfb: 70,
}

const DEFAULT_TEAM_STATS: Record<LeagueId, PregameTeamStats> = {
  nba: { ortg: 115, drtg: 115, pace: DEFAULT_PACE_BY_LEAGUE.nba },
  ncaab: { ortg: 105, drtg: 105, pace: DEFAULT_PACE_BY_LEAGUE.ncaab },
  nfl: { ortg: 22, drtg: 22, pace: DEFAULT_PACE_BY_LEAGUE.nfl },
  nhl: { ortg: 3, drtg: 3, pace: DEFAULT_PACE_BY_LEAGUE.nhl },
  cfb: { ortg: 28, drtg: 28, pace: DEFAULT_PACE_BY_LEAGUE.cfb },
}

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

const toPctDecimal = (value: unknown): number | undefined => {
  const num = toNumber(value)
  if (num == null) return undefined
  return num > 1 ? num / 100 : num
}

export const getDefaultPaceForLeague = (league: LeagueId): number =>
  DEFAULT_PACE_BY_LEAGUE[league] ?? 100

export async function getLiveTeamStats(
  teamName: string,
  league: LeagueId
): Promise<PregameTeamStats | null> {
  if (!teamName) return null

  if (league === 'nba') {
    return (await getNbaTeamStats(teamName, 'basketball_nba')) as PregameTeamStats | null
  }

  if (league === 'ncaab') {
    const [results, advanced] = await Promise.all([
      getSportsTeamStats('basketball_ncaab', teamName),
      getCbbAdvancedRatingsForTeam(teamName),
    ])
    const entry = results?.[0]
    const stats = entry?.stats || {}

    let ortg = advanced?.adjO ?? toNumber(stats.offensiveRating)
    let drtg = advanced?.adjD ?? toNumber(stats.defensiveRating)
    const pace = advanced?.tempo ?? toNumber(stats.pace)
    const netRating =
      advanced?.netRating ??
      advanced?.adjEM ??
      (ortg != null && drtg != null ? Number((ortg - drtg).toFixed(1)) : null)
    if ((ortg == null || drtg == null) && netRating != null) {
      const base = DEFAULT_TEAM_STATS.ncaab.ortg
      const half = Number((netRating / 2).toFixed(1))
      ortg = Number((base + half).toFixed(1))
      drtg = Number((base - half).toFixed(1))
    }

    if (ortg == null || drtg == null || pace == null) {
      return DEFAULT_TEAM_STATS.ncaab
    }

    return {
      ortg,
      drtg,
      pace,
      eFG: toPctDecimal(stats.effectiveFieldGoalPct ?? stats.effectiveFgPct),
      ts: toPctDecimal(stats.trueShootingPct),
    }
  }

  if (league === 'nfl' || league === 'cfb') {
    const sportKey =
      league === 'nfl' ? 'americanfootball_nfl' : 'americanfootball_ncaaf'
    const results = await getSportsTeamStats(sportKey, teamName)
    const entry = results?.[0]
    const stats = entry?.stats || {}
    const gamesPlayed = toNumber(stats.gamesPlayed)
    const pointsForPerGame =
      toNumber(stats.pointsForPerGame) ??
      (toNumber(stats.pointsFor) != null && gamesPlayed
        ? Number(stats.pointsFor) / gamesPlayed
        : null)
    const pointsAgainstPerGame =
      toNumber(stats.pointsAgainstPerGame) ??
      (toNumber(stats.pointsAgainst) != null && gamesPlayed
        ? Number(stats.pointsAgainst) / gamesPlayed
        : null)
    const playsPerGame =
      toNumber(stats.playsPerGame) ??
      (toNumber(stats.totalOffensivePlays) != null && gamesPlayed
        ? Number(stats.totalOffensivePlays) / gamesPlayed
        : null)

    if (pointsForPerGame == null || pointsAgainstPerGame == null) {
      return DEFAULT_TEAM_STATS[league]
    }

    return {
      ortg: Number(pointsForPerGame.toFixed(1)),
      drtg: Number(pointsAgainstPerGame.toFixed(1)),
      pace: playsPerGame ?? DEFAULT_PACE_BY_LEAGUE[league],
    }
  }

  return null
}

export async function getLiveTeamThreePointPct(
  teamName: string,
  league: LeagueId
): Promise<number | null> {
  if (!teamName) return null

  if (league === 'nba') {
    const results = await getSportsTeamStats('basketball_nba', teamName)
    const entry = results?.[0]
    const stats = entry?.stats || {}
    const threePct = toNumber(stats.threePointPct)
    if (threePct == null) return null
    return threePct > 1 ? threePct / 100 : threePct
  }

  if (league === 'ncaab') {
    const results = await getSportsTeamStats('basketball_ncaab', teamName)
    const entry = results?.[0]
    const stats = entry?.stats || {}
    const threePct = toNumber(stats.threePointPct)
    if (threePct == null) return null
    return threePct > 1 ? threePct / 100 : threePct
  }

  return null
}

export async function getLiveTeamFreeThrowPct(
  teamName: string,
  league: LeagueId
): Promise<number | null> {
  if (!teamName) return null

  if (league === 'ncaab') {
    const results = await getSportsTeamStats('basketball_ncaab', teamName)
    const entry = results?.[0]
    const stats = entry?.stats || {}
    const ftPct = toNumber(stats.freeThrowPct ?? stats.freeThrowPercentage)
    if (ftPct == null) return null
    return ftPct > 1 ? ftPct / 100 : ftPct
  }

  return null
}
