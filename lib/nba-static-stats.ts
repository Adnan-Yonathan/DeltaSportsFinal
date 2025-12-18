import { nbaPlayerPerGame2025_2026Csv } from '@/data/nba_player_per_game_2025_2026'

export type NbaStaticPlayer = {
  name: string
  team: string
  season: string
  position?: string
  slug?: string
  stats: Record<string, number>
}

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const toNumber = (raw: string | undefined): number | null => {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const parsePlayers = (): NbaStaticPlayer[] => {
  const lines = nbaPlayerPerGame2025_2026Csv
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && /^\d+[,]/.test(line))

  const players: NbaStaticPlayer[] = []
  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 30) continue

    const [
      _rk,
      name,
      _ws,
      season,
      _age,
      team,
      games,
      _gs,
      _as,
      mp,
      fg,
      fga,
      twoP,
      twoPA,
      threeP,
      threePA,
      ft,
      fta,
      orb,
      drb,
      trb,
      ast,
      stl,
      blk,
      tov,
      pf,
      pts,
      fgPct,
      twoPct,
      threePct,
      ftPct,
      tsPct,
      efgPct,
      position,
      slug,
    ] = cells

    const pct = (raw: string | undefined) => {
      const n = toNumber(raw)
      return n == null ? null : Number((n * 100).toFixed(1))
    }

    const stats: Record<string, number> = {}
    const num = (raw: string | undefined) => toNumber(raw) ?? 0

    const ptsVal = num(pts)
    stats.PTS = ptsVal
    stats.PPG = ptsVal
    stats.MPG = Number(num(mp).toFixed(1))
    stats.FGM = Number(num(fg).toFixed(1))
    stats.FGA = Number(num(fga).toFixed(1))
    stats.TWOPM = Number(num(twoP).toFixed(1))
    stats.TWOPA = Number(num(twoPA).toFixed(1))
    stats.THREE_PM = Number(num(threeP).toFixed(1))
    stats.THREE_PA = Number(num(threePA).toFixed(1))
    stats.FTM = Number(num(ft).toFixed(1))
    stats.FTA = Number(num(fta).toFixed(1))
    stats.ORB = Number(num(orb).toFixed(1))
    stats.DRB = Number(num(drb).toFixed(1))
    stats.TRB = Number(num(trb).toFixed(1))
    stats.REB = stats.TRB
    stats.AST = Number(num(ast).toFixed(1))
    stats.RPG = stats.REB
    stats.APG = stats.AST
    stats.STL = Number(num(stl).toFixed(1))
    stats.BLK = Number(num(blk).toFixed(1))
    stats.TOV = Number(num(tov).toFixed(1))
    stats.PF = Number(num(pf).toFixed(1))
    stats.GP = Number(num(games).toFixed(0))

    const fgPctVal = pct(fgPct)
    const twoPctVal = pct(twoPct)
    const threePctVal = pct(threePct)
    const ftPctVal = pct(ftPct)
    const tsPctVal = pct(tsPct)
    const efgPctVal = pct(efgPct)

    if (fgPctVal != null) stats.FG_PERCENT = fgPctVal
    if (twoPctVal != null) stats.TWOP_PERCENT = twoPctVal
    if (threePctVal != null) stats.THREE_PERCENT = threePctVal
    if (ftPctVal != null) stats.FT_PERCENT = ftPctVal
    if (tsPctVal != null) stats.TS_PERCENT = tsPctVal
    if (efgPctVal != null) stats.EFG_PERCENT = efgPctVal

    players.push({
      name,
      team,
      season,
      position,
      slug,
      stats,
    })
  }

  return players
}

const NBA_STATIC_PLAYERS = parsePlayers()

export const findNbaStaticPlayer = (query: string): NbaStaticPlayer | null => {
  const target = normalize(query)
  if (!target) return null
  const direct = NBA_STATIC_PLAYERS.find((p) => normalize(p.name) === target || normalize(p.slug || '') === target)
  if (direct) return direct
  return (
    NBA_STATIC_PLAYERS.find((p) => {
      const norm = normalize(p.name)
      return norm.includes(target) || target.includes(norm)
    }) || null
  )
}
