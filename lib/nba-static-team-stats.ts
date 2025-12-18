import { nbaTeam2025_2026Csv } from '@/data/nba_team_2025_2026'
import { nbaTeamAdvStats2025_2026Csv } from '@/data/nba_team_adv_stats_2025_2026'
import { nbaTeamPerGame2025_2026Csv } from '@/data/nba_team_per_game_2025_2026'
import type { TeamStats } from './sports-stats-api'

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const TEAM_ALIAS_MAP: Record<string, string> = {
  atlantahawks: 'atl',
  bostonceltics: 'bos',
  brooklynnets: 'brk',
  charlottehornets: 'cho',
  chicagobulls: 'chi',
  clevelandcavaliers: 'cle',
  dallasmavericks: 'dal',
  denvernuggets: 'den',
  detroitpistons: 'det',
  goldenstatewarriors: 'gsw',
  houstonrockets: 'hou',
  indianapacers: 'ind',
  losangelesclippers: 'lac',
  losangeleslakers: 'lal',
  memphisgrizzlies: 'mem',
  miamiheat: 'mia',
  milwaukeebucks: 'mil',
  minnesotatimberwolves: 'min',
  neworleanspelicans: 'nop',
  newyorkknicks: 'nyk',
  oklahomacitythunder: 'okc',
  orlandomagic: 'orl',
  philadelphia76ers: 'phi',
  phoenixsuns: 'pho',
  portlandtrailblazers: 'por',
  sacramentokings: 'sac',
  sanantoniospurs: 'sas',
  torontoraptors: 'tor',
  utahjazz: 'uta',
  washingtonwizards: 'was',
}

const toNumber = (raw: string | undefined) => {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

const pctTo100 = (raw: string | undefined) => {
  const n = toNumber(raw)
  return n == null ? null : Number((n * 100).toFixed(1))
}

type PerGameRow = {
  Season: string
  Team: string
  games: number | null
  MP: number | null
  FG: number | null
  FGA: number | null
  twoP: number | null
  twoPA: number | null
  threeP: number | null
  threePA: number | null
  FT: number | null
  FTA: number | null
  ORB: number | null
  DRB: number | null
  TRB: number | null
  AST: number | null
  STL: number | null
  BLK: number | null
  TOV: number | null
  PF: number | null
  PTS: number | null
  OPP_FG: number | null
  OPP_FGA: number | null
  OPP_2P: number | null
  OPP_2PA: number | null
  OPP_3P: number | null
  OPP_3PA: number | null
  OPP_FT: number | null
  OPP_FTA: number | null
  OPP_ORB: number | null
  OPP_DRB: number | null
  OPP_TRB: number | null
  OPP_AST: number | null
  OPP_STL: number | null
  OPP_BLK: number | null
  OPP_TOV: number | null
  OPP_PF: number | null
  OPP_PTS: number | null
}

type AdvRow = {
  Season: string
  Team: string
  ORtg: number | null
  DRtg: number | null
  Pace: number | null
  MOV: number | null
  SOS: number | null
  SRS: number | null
  eFG_PCT: number | null
  TS_PCT: number | null
  TOV_PCT: number | null
  ORB_PCT: number | null
  DRB_PCT: number | null
  FTr: number | null
  OPP_eFG_PCT: number | null
  OPP_TS_PCT: number | null
  OPP_TOV_PCT: number | null
  OPP_ORB_PCT: number | null
  OPP_DRB_PCT: number | null
  OPP_FTr: number | null
}

const parsePerGame = (): Map<string, PerGameRow> => {
  const map = new Map<string, PerGameRow>()
  const lines = nbaTeamPerGame2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 43) continue
    const [
      , // Rk
      Season,
      Team,
      , // W1
      G,
      , // W2
      , // L
      , // WIN_PCT
      MP,
      FG,
      FGA,
      twoP,
      twoPA,
      threeP,
      threePA,
      FT,
      FTA,
      ORB,
      DRB,
      TRB,
      AST,
      STL,
      BLK,
      TOV,
      PF,
      PTS,
      OPP_FG,
      OPP_FGA,
      OPP_2P,
      OPP_2PA,
      OPP_3P,
      OPP_3PA,
      OPP_FT,
      OPP_FTA,
      OPP_ORB,
      OPP_DRB,
      OPP_TRB,
      OPP_AST,
      OPP_STL,
      OPP_BLK,
      OPP_TOV,
      OPP_PF,
      OPP_PTS,
    ] = cells

    const key = `${normalize(Team)}:${Season}`
    map.set(key, {
      Season,
      Team,
      games: toNumber(G),
      MP: toNumber(MP),
      FG: toNumber(FG),
      FGA: toNumber(FGA),
      twoP: toNumber(twoP),
      twoPA: toNumber(twoPA),
      threeP: toNumber(threeP),
      threePA: toNumber(threePA),
      FT: toNumber(FT),
      FTA: toNumber(FTA),
      ORB: toNumber(ORB),
      DRB: toNumber(DRB),
      TRB: toNumber(TRB),
      AST: toNumber(AST),
      STL: toNumber(STL),
      BLK: toNumber(BLK),
      TOV: toNumber(TOV),
      PF: toNumber(PF),
      PTS: toNumber(PTS),
      OPP_FG: toNumber(OPP_FG),
      OPP_FGA: toNumber(OPP_FGA),
      OPP_2P: toNumber(OPP_2P),
      OPP_2PA: toNumber(OPP_2PA),
      OPP_3P: toNumber(OPP_3P),
      OPP_3PA: toNumber(OPP_3PA),
      OPP_FT: toNumber(OPP_FT),
      OPP_FTA: toNumber(OPP_FTA),
      OPP_ORB: toNumber(OPP_ORB),
      OPP_DRB: toNumber(OPP_DRB),
      OPP_TRB: toNumber(OPP_TRB),
      OPP_AST: toNumber(OPP_AST),
      OPP_STL: toNumber(OPP_STL),
      OPP_BLK: toNumber(OPP_BLK),
      OPP_TOV: toNumber(OPP_TOV),
      OPP_PF: toNumber(OPP_PF),
      OPP_PTS: toNumber(OPP_PTS),
    })
  }

  return map
}

const parseAdvanced = (): Map<string, AdvRow> => {
  const map = new Map<string, AdvRow>()
  const lines = nbaTeamAdvStats2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 26) continue
    const [
      , // Rk
      Season,
      Team,
      , // W1
      , // G
      , // W2
      , // L
      , // WIN_PCT
      MOV,
      SOS,
      SRS,
      Pace,
      ORtg,
      DRtg,
      eFG_PCT,
      TS_PCT,
      TOV_PCT,
      ORB_PCT,
      DRB_PCT,
      FTr,
      OPP_eFG_PCT,
      OPP_TS_PCT,
      OPP_TOV_PCT,
      OPP_ORB_PCT,
      OPP_DRB_PCT,
      OPP_FTr,
    ] = cells
    const key = `${normalize(Team)}:${Season}`
    map.set(key, {
      Season,
      Team,
      ORtg: toNumber(ORtg),
      DRtg: toNumber(DRtg),
      Pace: toNumber(Pace),
      MOV: toNumber(MOV),
      SOS: toNumber(SOS),
      SRS: toNumber(SRS),
      eFG_PCT: toNumber(eFG_PCT),
      TS_PCT: toNumber(TS_PCT),
      TOV_PCT: toNumber(TOV_PCT),
      ORB_PCT: toNumber(ORB_PCT),
      DRB_PCT: toNumber(DRB_PCT),
      FTr: toNumber(FTr),
      OPP_eFG_PCT: toNumber(OPP_eFG_PCT),
      OPP_TS_PCT: toNumber(OPP_TS_PCT),
      OPP_TOV_PCT: toNumber(OPP_TOV_PCT),
      OPP_ORB_PCT: toNumber(OPP_ORB_PCT),
      OPP_DRB_PCT: toNumber(OPP_DRB_PCT),
      OPP_FTr: toNumber(OPP_FTr),
    })
  }
  return map
}

const parseTeams = (): TeamStats[] => {
  const advancedRows = parseAdvanced()
  const perGameRows = parsePerGame()
  const lines = nbaTeam2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  const teams: TeamStats[] = []
  for (const line of lines) {
    const cells = line.split(',')
    if (cells.length < 33) continue

    const [
      _rk,
      season,
      team,
      w1,
      games,
      w2,
      l,
      winPct,
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
    ] = cells

    const wins = toNumber(w1) ?? toNumber(w2) ?? 0
    const losses = toNumber(l) ?? Math.max((toNumber(games) ?? 0) - wins, 0)
    const g = toNumber(games) ?? (wins ?? 0) + (losses ?? 0)
    const ptsVal = toNumber(pts) ?? 0

    const perGame = (val: number | null) => (val == null || g === 0 ? null : Number((val / g).toFixed(1)))

    const stats: Record<string, number | string | null> = {
      pointsForPerGame: perGame(ptsVal),
      fieldGoalPct: pctTo100(fgPct),
      twoPointPct: pctTo100(twoPct),
      threePointPct: pctTo100(threePct),
      freeThrowPct: pctTo100(ftPct),
      trueShootingPct: pctTo100(tsPct),
      effectiveFgPct: pctTo100(efgPct),
      reboundsPerGame: perGame(toNumber(trb)),
      offensiveReboundsPerGame: perGame(toNumber(orb)),
      defensiveReboundsPerGame: perGame(toNumber(drb)),
      assistsPerGame: perGame(toNumber(ast)),
      stealsPerGame: perGame(toNumber(stl)),
      blocksPerGame: perGame(toNumber(blk)),
      turnoversPerGame: perGame(toNumber(tov)),
      personalFoulsPerGame: perGame(toNumber(pf)),
      threesMadePerGame: perGame(toNumber(threeP)),
      threesAttemptedPerGame: perGame(toNumber(threePA)),
    }

    const advancedKey = `${normalize(team)}:${season}`
    const perGameRow = perGameRows.get(advancedKey)
    if (perGameRow) {
      const assign = (key: string, val: number | null) => {
        if (val != null) stats[key] = val
      }
      assign('gamesPlayed', perGameRow.games)
      assign('minutesPerGame', perGameRow.MP)
      assign('fieldGoalsMadePerGame', perGameRow.FG)
      assign('fieldGoalsAttemptedPerGame', perGameRow.FGA)
      assign('twosMadePerGame', perGameRow.twoP)
      assign('twosAttemptedPerGame', perGameRow.twoPA)
      assign('threesMadePerGame', perGameRow.threeP)
      assign('threesAttemptedPerGame', perGameRow.threePA)
      assign('freeThrowsMadePerGame', perGameRow.FT)
      assign('freeThrowsAttemptedPerGame', perGameRow.FTA)
      assign('offensiveReboundsPerGame', perGameRow.ORB)
      assign('defensiveReboundsPerGame', perGameRow.DRB)
      assign('reboundsPerGame', perGameRow.TRB)
      assign('assistsPerGame', perGameRow.AST)
      assign('stealsPerGame', perGameRow.STL)
      assign('blocksPerGame', perGameRow.BLK)
      assign('turnoversPerGame', perGameRow.TOV)
      assign('personalFoulsPerGame', perGameRow.PF)
      assign('pointsForPerGame', perGameRow.PTS)
      assign('pointsAgainstPerGame', perGameRow.OPP_PTS)
      assign('opponentFieldGoalsMadePerGame', perGameRow.OPP_FG)
      assign('opponentFieldGoalsAttemptedPerGame', perGameRow.OPP_FGA)
      assign('opponentTwoPointMadePerGame', perGameRow.OPP_2P)
      assign('opponentTwoPointAttemptedPerGame', perGameRow.OPP_2PA)
      assign('opponentThreeMadePerGame', perGameRow.OPP_3P)
      assign('opponentThreesMadePerGame', perGameRow.OPP_3P)
      assign('threePointersAllowedPerGame', perGameRow.OPP_3P)
      assign('threesAllowedPerGame', perGameRow.OPP_3P)
      assign('opponentThreeAttemptedPerGame', perGameRow.OPP_3PA)
      assign('opponentFreeThrowsMadePerGame', perGameRow.OPP_FT)
      assign('opponentFreeThrowsAttemptedPerGame', perGameRow.OPP_FTA)
      assign('opponentOffensiveReboundsPerGame', perGameRow.OPP_ORB)
      assign('opponentDefensiveReboundsPerGame', perGameRow.OPP_DRB)
      assign('opponentReboundsPerGame', perGameRow.OPP_TRB)
      assign('opponentAssistsPerGame', perGameRow.OPP_AST)
      assign('opponentStealsPerGame', perGameRow.OPP_STL)
      assign('opponentBlocksPerGame', perGameRow.OPP_BLK)
      assign('opponentTurnoversPerGame', perGameRow.OPP_TOV)
      assign('opponentPersonalFoulsPerGame', perGameRow.OPP_PF)
    }

    const adv = advancedRows.get(advancedKey)

    if (adv) {
      const netRating = adv.ORtg != null && adv.DRtg != null ? Number((adv.ORtg - adv.DRtg).toFixed(1)) : null
      stats.offensiveRating = adv.ORtg ?? null
      stats.defensiveRating = adv.DRtg ?? null
      stats.netRating = netRating
      stats.pace = adv.Pace ?? null
      stats.marginOfVictory = adv.MOV ?? null
      stats.strengthOfSchedule = adv.SOS ?? null
      stats.simpleRatingSystem = adv.SRS ?? null
      stats.effectiveFgPct = adv.eFG_PCT != null ? Number((adv.eFG_PCT * 100).toFixed(1)) : null
      stats.trueShootingPct = adv.TS_PCT != null ? Number((adv.TS_PCT * 100).toFixed(1)) : null
      stats.turnoverPct = adv.TOV_PCT ?? null
      stats.offensiveReboundPct = adv.ORB_PCT ?? null
      stats.defensiveReboundPct = adv.DRB_PCT ?? null
      stats.freeThrowRate = adv.FTr ?? null
      stats.opponentEffectiveFgPct = adv.OPP_eFG_PCT != null ? Number((adv.OPP_eFG_PCT * 100).toFixed(1)) : null
      stats.opponentTrueShootingPct = adv.OPP_TS_PCT != null ? Number((adv.OPP_TS_PCT * 100).toFixed(1)) : null
      stats.opponentTurnoverPct = adv.OPP_TOV_PCT ?? null
      stats.opponentOffensiveReboundPct = adv.OPP_ORB_PCT ?? null
      stats.opponentDefensiveReboundPct = adv.OPP_DRB_PCT ?? null
      stats.opponentFreeThrowRate = adv.OPP_FTr ?? null
    }

    teams.push({
      team,
      wins: wins ?? 0,
      losses: losses ?? 0,
      winPct: toNumber(winPct) ?? (g ? wins / g : 0),
      stats,
      season,
      sport: 'basketball_nba',
    })
  }

  return teams
}

const TEAMS = parseTeams()

export const getStaticNbaTeams = () => TEAMS

export const findStaticNbaTeam = (identifier?: string): TeamStats[] => {
  if (!identifier) return TEAMS
  const targetRaw = normalize(identifier)
  const target = TEAM_ALIAS_MAP[targetRaw] || targetRaw
  return TEAMS.filter((t) => {
    const n = normalize(t.team)
    return n === target || n.includes(target) || target.includes(n)
  })
}
