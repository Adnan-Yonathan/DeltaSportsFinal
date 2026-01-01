import { seasonHelpers } from '@/lib/providers/espn-nba'
import { getEventSummary, getEventsByDateRange } from '@/lib/services/espn-orchestrator'

type BoxscoreStat = {
  name?: string
  abbreviation?: string
  displayValue?: string
  value?: string | number
}

type BoxscoreTeam = {
  team?: {
    id?: string | number
    displayName?: string
    name?: string
    abbreviation?: string
  }
  statistics?: BoxscoreStat[]
}

type ParsedTeamStats = {
  teamId: string
  teamAbbr: string
  teamName: string
  fgm: number
  fga: number
  tpm: number
  tpa: number
  ftm: number
  fta: number
  orb: number
  drb: number
  trb: number
  ast: number
  stl: number
  blk: number
  tov: number
  pf: number
  pts: number
}

type TeamOpponentTotals = {
  teamId: string
  teamAbbr: string
  teamName: string
  games: number
  oppFGM: number
  oppFGA: number
  opp3PM: number
  opp3PA: number
  oppFTM: number
  oppFTA: number
  oppORB: number
  oppDRB: number
  oppTRB: number
  oppAST: number
  oppSTL: number
  oppBLK: number
  oppTOV: number
  oppPF: number
  oppPTS: number
  teamORB: number
  teamDRB: number
}

export type NbaOpponentStatsEntry = {
  teamId: string
  teamAbbr: string
  teamName: string
  games: number
  stats: Record<string, number>
}

type CacheEntry = {
  ts: number
  season: number
  data: NbaOpponentStatsEntry[]
}

const CACHE_TTL = 1000 * 60 * 60 * 6
let cache: CacheEntry | null = null

const toNumber = (value: any): number | null => {
  if (value == null) return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

const parsePair = (value?: string | number | null) => {
  if (value == null) return { made: 0, att: 0 }
  const raw = String(value)
  const parts = raw.split('-')
  if (parts.length < 2) return { made: toNumber(raw) ?? 0, att: 0 }
  const made = toNumber(parts[0]) ?? 0
  const att = toNumber(parts[1]) ?? 0
  return { made, att }
}

const formatDate = (date: Date) => date.toISOString().slice(0, 10)

const buildMonthRanges = (seasonYear: number): Array<[string, string]> => {
  const start = new Date(Date.UTC(seasonYear - 1, 9, 1))
  const end = new Date()
  const ranges: Array<[string, string]> = []
  let cursor = new Date(start)
  while (cursor <= end) {
    const rangeStart = new Date(cursor)
    const rangeEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0))
    if (rangeEnd > end) rangeEnd.setTime(end.getTime())
    ranges.push([formatDate(rangeStart), formatDate(rangeEnd)])
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1))
  }
  return ranges
}

const pickStatValue = (stats: BoxscoreStat[], names: string[]) => {
  const lower = names.map((name) => name.toLowerCase())
  for (const stat of stats) {
    const key = String(stat?.name || stat?.abbreviation || '').toLowerCase()
    if (!key) continue
    if (lower.some((name) => key === name)) {
      return stat.displayValue ?? stat.value
    }
  }
  return null
}

const parseTeamStats = (
  team: BoxscoreTeam,
  scoreMap: Map<string, number>
): ParsedTeamStats | null => {
  const teamId = String(team?.team?.id || '')
  if (!teamId) return null
  const stats = team?.statistics ?? []
  const fg = parsePair(pickStatValue(stats, ['fieldgoalsmade-fieldgoalsattempted']))
  const three = parsePair(
    pickStatValue(stats, [
      'threepointfieldgoalsmade-threepointfieldgoalsattempted',
    ])
  )
  const ft = parsePair(pickStatValue(stats, ['freethrowsmade-freethrowsattempted']))
  const trb = toNumber(pickStatValue(stats, ['totalrebounds', 'reb'])) ?? 0
  const orb = toNumber(pickStatValue(stats, ['offensiverebounds', 'or'])) ?? 0
  const drb = toNumber(pickStatValue(stats, ['defensiverebounds', 'dr'])) ?? 0
  const ast = toNumber(pickStatValue(stats, ['assists', 'ast'])) ?? 0
  const stl = toNumber(pickStatValue(stats, ['steals', 'stl'])) ?? 0
  const blk = toNumber(pickStatValue(stats, ['blocks', 'blk'])) ?? 0
  const tov =
    toNumber(pickStatValue(stats, ['totalturnovers', 'turnovers', 'to'])) ?? 0
  const pf = toNumber(pickStatValue(stats, ['fouls', 'pf'])) ?? 0
  const points = scoreMap.get(teamId) ?? 0
  const teamName =
    team?.team?.displayName || team?.team?.name || team?.team?.abbreviation || ''
  const teamAbbr = team?.team?.abbreviation || ''

  return {
    teamId,
    teamAbbr,
    teamName,
    fgm: fg.made,
    fga: fg.att,
    tpm: three.made,
    tpa: three.att,
    ftm: ft.made,
    fta: ft.att,
    orb,
    drb,
    trb: trb || orb + drb,
    ast,
    stl,
    blk,
    tov,
    pf,
    pts: points,
  }
}

const ensureTotals = (
  map: Map<string, TeamOpponentTotals>,
  team: ParsedTeamStats
) => {
  let entry = map.get(team.teamId)
  if (!entry) {
    entry = {
      teamId: team.teamId,
      teamAbbr: team.teamAbbr,
      teamName: team.teamName,
      games: 0,
      oppFGM: 0,
      oppFGA: 0,
      opp3PM: 0,
      opp3PA: 0,
      oppFTM: 0,
      oppFTA: 0,
      oppORB: 0,
      oppDRB: 0,
      oppTRB: 0,
      oppAST: 0,
      oppSTL: 0,
      oppBLK: 0,
      oppTOV: 0,
      oppPF: 0,
      oppPTS: 0,
      teamORB: 0,
      teamDRB: 0,
    }
    map.set(team.teamId, entry)
  }
  return entry
}

const applyGameTotals = (
  totals: TeamOpponentTotals,
  team: ParsedTeamStats,
  opponent: ParsedTeamStats
) => {
  totals.games += 1
  totals.oppFGM += opponent.fgm
  totals.oppFGA += opponent.fga
  totals.opp3PM += opponent.tpm
  totals.opp3PA += opponent.tpa
  totals.oppFTM += opponent.ftm
  totals.oppFTA += opponent.fta
  totals.oppORB += opponent.orb
  totals.oppDRB += opponent.drb
  totals.oppTRB += opponent.trb
  totals.oppAST += opponent.ast
  totals.oppSTL += opponent.stl
  totals.oppBLK += opponent.blk
  totals.oppTOV += opponent.tov
  totals.oppPF += opponent.pf
  totals.oppPTS += opponent.pts
  totals.teamORB += team.orb
  totals.teamDRB += team.drb
}

const buildOpponentStats = (entry: TeamOpponentTotals): NbaOpponentStatsEntry => {
  const games = entry.games || 1
  const perGame = (value: number, decimals = 1) =>
    Number((value / games).toFixed(decimals))

  const oppTwoMade = entry.oppFGM - entry.opp3PM
  const oppTwoAtt = entry.oppFGA - entry.opp3PA
  const oppFgp =
    entry.oppFGA > 0 ? Number(((entry.oppFGM / entry.oppFGA) * 100).toFixed(1)) : 0
  const opp3pp =
    entry.opp3PA > 0 ? Number(((entry.opp3PM / entry.opp3PA) * 100).toFixed(1)) : 0
  const oppFtp =
    entry.oppFTA > 0 ? Number(((entry.oppFTM / entry.oppFTA) * 100).toFixed(1)) : 0
  const oppEfg =
    entry.oppFGA > 0
      ? Number((((entry.oppFGM + 0.5 * entry.opp3PM) / entry.oppFGA) * 100).toFixed(1))
      : 0
  const tsDenom = 2 * (entry.oppFGA + 0.44 * entry.oppFTA)
  const oppTs =
    tsDenom > 0 ? Number(((entry.oppPTS / tsDenom) * 100).toFixed(1)) : 0
  const tovDenom = entry.oppFGA + 0.44 * entry.oppFTA + entry.oppTOV
  const oppTovPct =
    tovDenom > 0 ? Number(((entry.oppTOV / tovDenom) * 100).toFixed(1)) : 0
  const orbDenom = entry.oppORB + entry.teamDRB
  const oppOrbPct =
    orbDenom > 0 ? Number(((entry.oppORB / orbDenom) * 100).toFixed(1)) : 0
  const drbDenom = entry.oppDRB + entry.teamORB
  const oppDrbPct =
    drbDenom > 0 ? Number(((entry.oppDRB / drbDenom) * 100).toFixed(1)) : 0
  const oppFtr = entry.oppFGA > 0 ? Number((entry.oppFTA / entry.oppFGA).toFixed(3)) : 0

  return {
    teamId: entry.teamId,
    teamAbbr: entry.teamAbbr,
    teamName: entry.teamName,
    games: entry.games,
    stats: {
      opponentFieldGoalsMade: entry.oppFGM,
      opponentFieldGoalsAttempted: entry.oppFGA,
      opponentThreePointMade: entry.opp3PM,
      opponentThreePointAttempts: entry.opp3PA,
      opponentFreeThrowsMade: entry.oppFTM,
      opponentFreeThrowsAttempted: entry.oppFTA,
      opponentRebounds: entry.oppTRB,
      opponentOffensiveRebounds: entry.oppORB,
      opponentDefensiveRebounds: entry.oppDRB,
      opponentAssists: entry.oppAST,
      opponentSteals: entry.oppSTL,
      opponentBlocks: entry.oppBLK,
      opponentTurnovers: entry.oppTOV,
      opponentPersonalFouls: entry.oppPF,
      opponentPoints: entry.oppPTS,
      opponentFieldGoalsMadePerGame: perGame(entry.oppFGM),
      opponentFieldGoalsAttemptedPerGame: perGame(entry.oppFGA),
      opponentTwoPointMadePerGame: perGame(oppTwoMade),
      opponentTwoPointAttemptedPerGame: perGame(oppTwoAtt),
      opponentThreePointMadePerGame: perGame(entry.opp3PM),
      opponentThreePointAttemptsPerGame: perGame(entry.opp3PA),
      opponentThreeMadePerGame: perGame(entry.opp3PM),
      opponentThreesMadePerGame: perGame(entry.opp3PM),
      opponentThreeAttemptedPerGame: perGame(entry.opp3PA),
      threePointersAllowedPerGame: perGame(entry.opp3PM),
      threesAllowedPerGame: perGame(entry.opp3PM),
      opponentFreeThrowsMadePerGame: perGame(entry.oppFTM),
      opponentFreeThrowsAttemptedPerGame: perGame(entry.oppFTA),
      opponentReboundsPerGame: perGame(entry.oppTRB),
      opponentOffensiveReboundsPerGame: perGame(entry.oppORB),
      opponentDefensiveReboundsPerGame: perGame(entry.oppDRB),
      opponentAssistsPerGame: perGame(entry.oppAST),
      opponentStealsPerGame: perGame(entry.oppSTL),
      opponentBlocksPerGame: perGame(entry.oppBLK),
      opponentTurnoversPerGame: perGame(entry.oppTOV),
      opponentPersonalFoulsPerGame: perGame(entry.oppPF),
      opponentPointsPerGame: perGame(entry.oppPTS),
      opponentFieldGoalPct: oppFgp,
      opponentThreePointPct: opp3pp,
      opponentFreeThrowPct: oppFtp,
      opponentEffectiveFgPct: oppEfg,
      opponentTrueShootingPct: oppTs,
      opponentTurnoverPct: oppTovPct,
      opponentOffensiveReboundPct: oppOrbPct,
      opponentDefensiveReboundPct: oppDrbPct,
      opponentFreeThrowRate: oppFtr,
    },
  }
}

const collectEventIds = async (seasonYear: number) => {
  const ranges = buildMonthRanges(seasonYear)
  const ids = new Set<string>()
  for (const [from, to] of ranges) {
    const batch = await getEventsByDateRange('nba', from, to)
    for (const id of batch) {
      ids.add(String(id))
    }
  }
  return Array.from(ids)
}

const mapWithConcurrency = async <T>(
  items: T[],
  limit: number,
  handler: (item: T) => Promise<void>
) => {
  for (let i = 0; i < items.length; i += limit) {
    const slice = items.slice(i, i + limit)
    await Promise.all(slice.map((item) => handler(item)))
  }
}

export const getNbaOpponentStats = async (): Promise<NbaOpponentStatsEntry[]> => {
  const season = seasonHelpers.getCurrentSeason()
  const now = Date.now()
  if (cache && cache.season === season && now - cache.ts < CACHE_TTL) {
    return cache.data
  }

  const totals = new Map<string, TeamOpponentTotals>()
  const eventIds = await collectEventIds(season)

  await mapWithConcurrency(eventIds, 6, async (eventId) => {
    const summary = await getEventSummary('nba', eventId)
    const comp = summary?.header?.competitions?.[0]
    const completed = comp?.status?.type?.completed || comp?.status?.type?.state === 'post'
    if (!completed) return
    const teams = summary?.boxscore?.teams
    if (!Array.isArray(teams) || teams.length < 2) return

    const scoreMap = new Map<string, number>()
    const competitors: any[] = comp?.competitors || []
    for (const competitor of competitors) {
      const teamId = String(competitor?.team?.id || competitor?.id || '')
      if (!teamId) continue
      const score = toNumber(competitor?.score) ?? 0
      scoreMap.set(teamId, score)
    }

    const parsed = teams
      .map((team: BoxscoreTeam) => parseTeamStats(team, scoreMap))
      .filter(Boolean) as ParsedTeamStats[]
    if (parsed.length < 2) return

    const [teamA, teamB] = parsed
    const totalsA = ensureTotals(totals, teamA)
    const totalsB = ensureTotals(totals, teamB)
    applyGameTotals(totalsA, teamA, teamB)
    applyGameTotals(totalsB, teamB, teamA)
  })

  const data = Array.from(totals.values()).map(buildOpponentStats)
  cache = { ts: now, season, data }
  return data
}

export const getNbaOpponentStatsMap = async () => {
  const entries = await getNbaOpponentStats()
  const map = new Map<string, NbaOpponentStatsEntry>()
  for (const entry of entries) {
    if (entry.teamAbbr) map.set(entry.teamAbbr.toUpperCase(), entry)
  }
  return map
}
