import { SportKey } from '@/lib/services/espn-orchestrator'

type Num = number | null

const toNumber = (value: any): Num => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

export const parseMinutes = (value?: string | number | null): Num => {
  if (value == null) return null
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const str = String(value).trim()
  if (!str) return null
  if (/^\d+(\.\d+)?$/.test(str)) return Number(str)
  const m = str.match(/^(\d+):(\d{1,2})$/)
  if (!m) return null
  const minutes = Number(m[1])
  const seconds = Number(m[2])
  if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null
  return minutes + seconds / 60
}

const possessionEstimate = (team: Record<string, any>, opp?: Record<string, any>): Num => {
  const fga = toNumber(team.FGA ?? team.fga)
  const fta = toNumber(team.FTA ?? team.fta)
  const orb = toNumber(team.ORB ?? team.orb)
  const tov = toNumber(team.TOV ?? team.tov)

  const oppFga = toNumber(opp?.FGA ?? opp?.fga)
  const oppFta = toNumber(opp?.FTA ?? opp?.fta)
  const oppOrb = toNumber(opp?.ORB ?? opp?.orb)
  const oppTov = toNumber(opp?.TOV ?? opp?.tov)

  const teamPoss =
    fga != null && fta != null && orb != null && tov != null
      ? fga + 0.4 * fta - 1.07 * (orb ?? 0) + 1.07 * tov
      : null
  const oppPoss =
    oppFga != null && oppFta != null && oppOrb != null && oppTov != null
      ? oppFga + 0.4 * oppFta - 1.07 * (oppOrb ?? 0) + 1.07 * oppTov
      : null

  if (teamPoss == null && oppPoss == null) return null
  if (teamPoss != null && oppPoss != null) return 0.5 * (teamPoss + oppPoss)
  return teamPoss ?? oppPoss
}

export type AdvancedShooting = {
  tsPct: Num
  efgPct: Num
}

const deriveShooting = (stats: Record<string, any>): AdvancedShooting => {
  const pts = toNumber(stats.PTS ?? stats.pts)
  const fga = toNumber(stats.FGA ?? stats.fga)
  const fgm = toNumber(stats.FGM ?? stats.fgm ?? stats.FG ?? stats.fg)
  const fta = toNumber(stats.FTA ?? stats.fta)
  const tpm = toNumber(stats['3PM'] ?? stats.threes ?? stats.tpm ?? stats['3PT'])

  const tsPct =
    pts != null && fga != null && fta != null && fga + 0.44 * fta > 0 ? pts / (2 * (fga + 0.44 * fta)) : null
  const efgPct = fgm != null && fga != null && fga > 0 ? (fgm + 0.5 * (tpm ?? 0)) / fga : null

  return { tsPct, efgPct }
}

export type AdvancedRates = {
  tsPct: Num
  efgPct: Num
  tovPct: Num
  orbPct: Num
  drbPct: Num
  trbPct: Num
  astPct: Num
  stlPct: Num
  blkPct: Num
  usgPct: Num
  pace: Num
  ortg: Num
  drtg: Num
  netRtg: Num
  possessions: Num
}

type DeriveOpts = {
  playerStats?: Record<string, any>
  teamStats: Record<string, any>
  opponentStats?: Record<string, any>
  playerMinutes?: Num
  teamMinutes?: Num
  sport?: SportKey
}

export const deriveAdvancedRates = ({
  playerStats,
  teamStats,
  opponentStats,
  playerMinutes,
  teamMinutes,
  sport = 'nba',
}: DeriveOpts): AdvancedRates => {
  const poss = possessionEstimate(teamStats, opponentStats)
  const { tsPct, efgPct } = deriveShooting(playerStats ?? teamStats)

  const fga = toNumber((playerStats ?? teamStats).FGA ?? (playerStats ?? teamStats).fga)
  const fgmVal = toNumber((playerStats ?? teamStats).FGM ?? (playerStats ?? teamStats).fgm ?? (playerStats ?? teamStats).FG)
  const fta = toNumber((playerStats ?? teamStats).FTA ?? (playerStats ?? teamStats).fta)
  const tov = toNumber((playerStats ?? teamStats).TOV ?? (playerStats ?? teamStats).tov)
  const orb = toNumber((playerStats ?? teamStats).ORB ?? (playerStats ?? teamStats).orb)
  const drb = toNumber((playerStats ?? teamStats).DRB ?? (playerStats ?? teamStats).drb)
  const trb =
    toNumber((playerStats ?? teamStats).TRB ?? (playerStats ?? teamStats).trb) ??
    (orb != null && drb != null ? orb + drb : null)
  const ast = toNumber((playerStats ?? teamStats).AST ?? (playerStats ?? teamStats).ast)
  const stl = toNumber((playerStats ?? teamStats).STL ?? (playerStats ?? teamStats).stl)
  const blk = toNumber((playerStats ?? teamStats).BLK ?? (playerStats ?? teamStats).blk)

  const teamFga = toNumber(teamStats.FGA ?? teamStats.fga)
  const teamFta = toNumber(teamStats.FTA ?? teamStats.fta)
  const teamTov = toNumber(teamStats.TOV ?? teamStats.tov)

  const oppFga = toNumber(opponentStats?.FGA ?? opponentStats?.fga)
  const oppFta = toNumber(opponentStats?.FTA ?? opponentStats?.fta)
  const oppFgm = toNumber(opponentStats?.FGM ?? opponentStats?.fgm)
  const oppPts = toNumber(opponentStats?.PTS ?? opponentStats?.pts)
  const oppOrb = toNumber(opponentStats?.ORB ?? opponentStats?.orb)
  const oppTrb = toNumber(opponentStats?.TRB ?? opponentStats?.trb)
  const oppTov = toNumber(opponentStats?.TOV ?? opponentStats?.tov)

  const pace =
    poss != null && teamMinutes
      ? (() => {
          // Basketball default minutes: 48 per regulation, adjust by sport
          const regulationMinutes = sport === 'nba' || sport === 'nhl' ? 48 : sport === 'nfl' ? 60 : 48
          const denominator = (teamMinutes / 5) * 2
          if (!denominator) return null
          return (regulationMinutes * poss) / denominator
        })()
      : null

  const tovPct =
    fga != null && fta != null && tov != null && fga + 0.44 * fta + tov > 0 ? tov / (fga + 0.44 * fta + tov) : null

  const orbPct =
    orb != null && oppTrb != null && orb + (oppTrb - (oppOrb ?? 0)) > 0
      ? orb / (orb + (oppTrb - (oppOrb ?? 0)))
      : null

  const drbPct =
    drb != null && oppOrb != null && drb + oppOrb > 0
      ? drb / (drb + oppOrb)
      : null

  const trbPct =
    trb != null && oppTrb != null && trb + oppTrb > 0
      ? trb / (trb + oppTrb)
      : null

  const astPct =
    ast != null && playerMinutes && teamMinutes && teamFga && fgmVal != null && teamFga > 0 && fgmVal > 0
      ? (ast * (teamMinutes / 5)) / (playerMinutes * fgmVal)
      : null

  const stlPct =
    stl != null && poss != null && playerMinutes && poss > 0 && playerMinutes > 0
      ? (stl * ((teamMinutes ?? 0) || 240)) / (poss * playerMinutes)
      : null

  const blkPct =
    blk != null && oppFga != null && playerMinutes && oppFga > 0 && playerMinutes > 0
      ? (blk * ((teamMinutes ?? 0) || 240)) / (playerMinutes * oppFga)
      : null

  const usgPct =
    fga != null &&
    fta != null &&
    tov != null &&
    teamFga != null &&
    teamFta != null &&
    teamTov != null &&
    playerMinutes &&
    teamMinutes &&
    playerMinutes > 0
      ? ((fga + 0.44 * fta + tov) * (teamMinutes / 5)) / (playerMinutes * (teamFga + 0.44 * teamFta + teamTov))
      : null

  const ortg = poss != null && toNumber(teamStats.PTS ?? teamStats.pts) != null && poss > 0
    ? (toNumber(teamStats.PTS ?? teamStats.pts)! / poss) * 100
    : null
  const drtg = poss != null && oppPts != null && poss > 0 ? (oppPts / poss) * 100 : null
  const netRtg = ortg != null && drtg != null ? ortg - drtg : null

  return { tsPct, efgPct, tovPct, orbPct, drbPct, trbPct, astPct, stlPct, blkPct, usgPct, pace, ortg, drtg, netRtg, possessions: poss }
}

export const scaleStat = (value: any, minutes: any, targetMinutes: number): Num => {
  const val = toNumber(value)
  const mins = parseMinutes(minutes)
  if (val == null || mins == null || mins === 0) return null
  return (val / mins) * targetMinutes
}

export const perGame = (total: any, games: any): Num => {
  const t = toNumber(total)
  const g = toNumber(games)
  if (t == null || g == null || g === 0) return null
  return t / g
}
