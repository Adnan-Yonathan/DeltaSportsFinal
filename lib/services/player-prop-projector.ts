/**
 * Player Prop Projection Engine
 * Sport-specific projection models for NBA, NFL, and NHL player props
 *
 * Each model uses PLAYER-CENTRIC data:
 * - Individual player stats and efficiency metrics
 * - Recent form and usage trends
 * - Matchup adjustments based on opponent defense
 * - Volume predictions (minutes, snaps, ice time proxies)
 */

import {
  getPlayerSeasonStats,
  getTeamStats,
  type PlayerStats,
  type TeamStats,
} from '@/lib/sports-stats-api'
import {
  calculateOverProbability,
  calculateOverProbabilityNormal,
} from '@/lib/utils/prop-probability'

// ============================================================================
// TYPES
// ============================================================================

export interface PropProjection {
  player: string
  team: string
  opponent?: string
  market: string
  projection: number
  confidence: 'low' | 'medium' | 'high'
  factors: ProjectionFactor[]
  variance: number // Standard deviation for probability calculations
  sampleSize: number
}

export interface ProjectionFactor {
  name: string
  value: number
  impact: number // Multiplier applied (e.g., 1.05 = +5%)
  description: string
}

export interface MatchupContext {
  opponent: string
  isHome?: boolean
  restDays?: number
  isBackToBack?: boolean
  gameScript?: 'favorite' | 'underdog' | 'even'
  impliedTotal?: number
  spread?: number
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value))

const average = (values: number[]): number | null => {
  if (!values.length) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

const stdDev = (values: number[], mean: number): number => {
  if (values.length < 2) return mean * 0.35 // Default to 35% of mean
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2))
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / values.length)
}

const pickStat = (stats: Record<string, any>, keys: string[]): number | null => {
  for (const key of keys) {
    const value = stats[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const num = Number(value)
      if (Number.isFinite(num)) return num
    }
  }
  return null
}

const getRecentStatValues = (
  recent: PlayerStats['recent'],
  statKeys: string[]
): number[] => {
  if (!recent?.length) return []
  return recent
    .map(game => pickStat(game.stats, statKeys))
    .filter((v): v is number => v !== null)
}

// ============================================================================
// NBA PROJECTION MODEL
// ============================================================================

interface NBAPlayerContext {
  // Season averages
  ppg: number
  rpg: number
  apg: number
  threesMade: number
  mpg: number
  usage: number
  fgPct: number
  threePct: number
  tsPct: number
  // Recent performance (last 5 games)
  recentPPG?: number
  recentRPG?: number
  recentAPG?: number
  recentThrees?: number
  recentMPG?: number
  recentValues: Record<string, number[]>
}

const NBA_LEAGUE_AVG = {
  pace: 100,
  pointsAllowed: 114,
  reboundsAllowed: 43,
  assistsAllowed: 26,
  threesAllowed: 13,
}

const buildNBAPlayerContext = (stats: PlayerStats): NBAPlayerContext => {
  const s = stats.stats as Record<string, any>
  const recent = stats.recent || []

  // Season averages
  const ppg = pickStat(s, ['PTS', 'PPG', 'points', 'pointsPerGame']) ?? 0
  const rpg = pickStat(s, ['REB', 'RPG', 'TRB', 'rebounds']) ?? 0
  const apg = pickStat(s, ['AST', 'APG', 'assists']) ?? 0
  const threesMade = pickStat(s, ['3PM', 'THREE_PM', 'threePointersMade']) ?? 0
  const mpg = pickStat(s, ['MPG', 'minutesPerGame', 'minutes']) ?? 32
  const usage = pickStat(s, ['USG_PERCENT', 'usageRate', 'USG%']) ?? 20
  const fgPct = pickStat(s, ['FG_PERCENT', 'fieldGoalPct', 'FG%']) ?? 45
  const threePct = pickStat(s, ['THREE_PERCENT', 'threePointPct', '3P%']) ?? 35
  const tsPct = pickStat(s, ['TS_PERCENT', 'trueShootingPct', 'TS%']) ?? 55

  // Recent values for each stat type
  const recentValues: Record<string, number[]> = {
    points: getRecentStatValues(recent, ['PTS', 'POINTS', 'points']),
    rebounds: getRecentStatValues(recent, ['REB', 'REBOUNDS', 'TRB', 'rebounds']),
    assists: getRecentStatValues(recent, ['AST', 'ASSISTS', 'assists']),
    threes: getRecentStatValues(recent, ['3PM', 'THREE_PM', 'threePointersMade', '3P']),
    minutes: getRecentStatValues(recent, ['MIN', 'MINUTES', 'minutes']),
  }

  return {
    ppg,
    rpg,
    apg,
    threesMade,
    mpg,
    usage,
    fgPct,
    threePct,
    tsPct,
    recentPPG: average(recentValues.points) ?? undefined,
    recentRPG: average(recentValues.rebounds) ?? undefined,
    recentAPG: average(recentValues.assists) ?? undefined,
    recentThrees: average(recentValues.threes) ?? undefined,
    recentMPG: average(recentValues.minutes) ?? undefined,
    recentValues,
  }
}

const getNBAOpponentDefense = (
  opponentStats: TeamStats | null,
  market: string
): { allowed: number; leagueAvg: number } | null => {
  if (!opponentStats?.stats) return null

  const s = opponentStats.stats as Record<string, any>

  switch (market) {
    case 'points':
      return {
        allowed: pickStat(s, ['pointsAgainstPerGame', 'oppPpg', 'opponentPoints']) ?? NBA_LEAGUE_AVG.pointsAllowed,
        leagueAvg: NBA_LEAGUE_AVG.pointsAllowed,
      }
    case 'rebounds':
      return {
        allowed: pickStat(s, ['opponentReboundsPerGame', 'oppRebounds']) ?? NBA_LEAGUE_AVG.reboundsAllowed,
        leagueAvg: NBA_LEAGUE_AVG.reboundsAllowed,
      }
    case 'assists':
      return {
        allowed: pickStat(s, ['opponentAssistsPerGame', 'oppAssists']) ?? NBA_LEAGUE_AVG.assistsAllowed,
        leagueAvg: NBA_LEAGUE_AVG.assistsAllowed,
      }
    case 'threes':
      return {
        allowed: pickStat(s, ['opponentThreeMadePerGame', 'opp3PM']) ?? NBA_LEAGUE_AVG.threesAllowed,
        leagueAvg: NBA_LEAGUE_AVG.threesAllowed,
      }
    case 'pra':
      const ptsAllowed = pickStat(s, ['pointsAgainstPerGame']) ?? NBA_LEAGUE_AVG.pointsAllowed
      const rebAllowed = pickStat(s, ['opponentReboundsPerGame']) ?? NBA_LEAGUE_AVG.reboundsAllowed
      const astAllowed = pickStat(s, ['opponentAssistsPerGame']) ?? NBA_LEAGUE_AVG.assistsAllowed
      return {
        allowed: ptsAllowed + rebAllowed + astAllowed,
        leagueAvg: NBA_LEAGUE_AVG.pointsAllowed + NBA_LEAGUE_AVG.reboundsAllowed + NBA_LEAGUE_AVG.assistsAllowed,
      }
    default:
      return null
  }
}

export async function projectNBAProp(
  playerName: string,
  market: string,
  matchup?: MatchupContext
): Promise<PropProjection | null> {
  const playerStats = await getPlayerSeasonStats(playerName, 'basketball_nba')
  if (!playerStats) return null

  const ctx = buildNBAPlayerContext(playerStats)
  const factors: ProjectionFactor[] = []

  // 1. Get baseline stat for this market
  let baseAvg: number
  let recentAvg: number | undefined
  let recentValues: number[]

  switch (market) {
    case 'points':
      baseAvg = ctx.ppg
      recentAvg = ctx.recentPPG
      recentValues = ctx.recentValues.points
      break
    case 'rebounds':
      baseAvg = ctx.rpg
      recentAvg = ctx.recentRPG
      recentValues = ctx.recentValues.rebounds
      break
    case 'assists':
      baseAvg = ctx.apg
      recentAvg = ctx.recentAPG
      recentValues = ctx.recentValues.assists
      break
    case 'threes':
      baseAvg = ctx.threesMade
      recentAvg = ctx.recentThrees
      recentValues = ctx.recentValues.threes
      break
    case 'pra':
      baseAvg = ctx.ppg + ctx.rpg + ctx.apg
      recentAvg = (ctx.recentPPG ?? ctx.ppg) + (ctx.recentRPG ?? ctx.rpg) + (ctx.recentAPG ?? ctx.apg)
      recentValues = ctx.recentValues.points.map((p, i) =>
        p + (ctx.recentValues.rebounds[i] ?? 0) + (ctx.recentValues.assists[i] ?? 0)
      )
      break
    default:
      return null
  }

  if (baseAvg === 0) return null

  factors.push({
    name: 'Season Average',
    value: baseAvg,
    impact: 1.0,
    description: `Season avg: ${baseAvg.toFixed(1)} ${market}`,
  })

  let projection = baseAvg
  let totalMultiplier = 1.0

  // 2. VOLUME FACTOR: Minutes expectation
  const recentMPG = ctx.recentMPG ?? ctx.mpg
  const volumeMultiplier = recentMPG > 0 && ctx.mpg > 0
    ? clamp(recentMPG / ctx.mpg, 0.85, 1.15)
    : 1.0

  if (volumeMultiplier !== 1.0) {
    factors.push({
      name: 'Volume (Minutes)',
      value: recentMPG,
      impact: volumeMultiplier,
      description: `Recent MPG ${recentMPG.toFixed(1)} vs season ${ctx.mpg.toFixed(1)}`,
    })
    totalMultiplier *= volumeMultiplier
  }

  // 3. RECENT FORM FACTOR
  if (recentAvg !== undefined && recentAvg > 0) {
    const formMultiplier = clamp(recentAvg / baseAvg, 0.85, 1.15)
    if (Math.abs(formMultiplier - 1) > 0.02) {
      factors.push({
        name: 'Recent Form',
        value: recentAvg,
        impact: formMultiplier,
        description: `L5 avg: ${recentAvg.toFixed(1)} vs season ${baseAvg.toFixed(1)}`,
      })
      totalMultiplier *= (1 + (formMultiplier - 1) * 0.4) // 40% weight to recent form
    }
  }

  // 4. MATCHUP FACTOR: Opponent defense
  if (matchup?.opponent) {
    const oppTeams = await getTeamStats('basketball_nba', matchup.opponent)
    const oppStats = oppTeams?.[0] ?? null
    const defense = getNBAOpponentDefense(oppStats, market)

    if (defense) {
      const defenseMultiplier = clamp(defense.allowed / defense.leagueAvg, 0.85, 1.15)
      if (Math.abs(defenseMultiplier - 1) > 0.02) {
        factors.push({
          name: 'Opponent Defense',
          value: defense.allowed,
          impact: defenseMultiplier,
          description: `${matchup.opponent} allows ${defense.allowed.toFixed(1)} vs league ${defense.leagueAvg.toFixed(1)}`,
        })
        totalMultiplier *= (1 + (defenseMultiplier - 1) * 0.5) // 50% weight to matchup
      }

      // Pace adjustment
      const oppPace = pickStat(oppStats?.stats as Record<string, any> ?? {}, ['pace']) ?? NBA_LEAGUE_AVG.pace
      const paceMultiplier = clamp(oppPace / NBA_LEAGUE_AVG.pace, 0.92, 1.08)
      if (Math.abs(paceMultiplier - 1) > 0.02) {
        factors.push({
          name: 'Pace',
          value: oppPace,
          impact: paceMultiplier,
          description: `Opponent pace ${oppPace.toFixed(1)} vs league ${NBA_LEAGUE_AVG.pace}`,
        })
        totalMultiplier *= (1 + (paceMultiplier - 1) * 0.3) // 30% weight to pace
      }
    }
  }

  // 5. HOME/AWAY FACTOR
  if (matchup?.isHome !== undefined) {
    const homeMultiplier = matchup.isHome ? 1.02 : 0.98
    factors.push({
      name: 'Home/Away',
      value: matchup.isHome ? 1 : 0,
      impact: homeMultiplier,
      description: matchup.isHome ? 'Home game (+2%)' : 'Away game (-2%)',
    })
    totalMultiplier *= homeMultiplier
  }

  // 6. REST FACTOR
  if (matchup?.isBackToBack) {
    const restMultiplier = 0.92 // -8% for back-to-back
    factors.push({
      name: 'Back-to-Back',
      value: 0,
      impact: restMultiplier,
      description: 'Back-to-back game (-8%)',
    })
    totalMultiplier *= restMultiplier
  } else if (matchup?.restDays !== undefined && matchup.restDays >= 3) {
    const restMultiplier = 1.03 // +3% for well-rested
    factors.push({
      name: 'Well Rested',
      value: matchup.restDays,
      impact: restMultiplier,
      description: `${matchup.restDays} days rest (+3%)`,
    })
    totalMultiplier *= restMultiplier
  }

  // Apply total multiplier
  projection = baseAvg * totalMultiplier

  // Calculate variance from recent games
  const variance = recentValues.length >= 3
    ? stdDev(recentValues, recentAvg ?? baseAvg)
    : baseAvg * 0.35

  // Determine confidence
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (recentValues.length >= 5 && factors.length >= 3) {
    confidence = 'high'
  } else if (recentValues.length >= 3 || factors.length >= 2) {
    confidence = 'medium'
  }

  return {
    player: playerStats.name,
    team: playerStats.team,
    opponent: matchup?.opponent,
    market,
    projection: Number(projection.toFixed(1)),
    confidence,
    factors,
    variance: Number(variance.toFixed(2)),
    sampleSize: recentValues.length,
  }
}

// ============================================================================
// NFL PROJECTION MODEL
// ============================================================================

type NFLPosition = 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF' | 'UNKNOWN'

interface NFLPlayerContext {
  position: NFLPosition
  // Passing
  passingYards: number
  passingTDs: number
  passingAttempts: number
  completions: number
  interceptions: number
  yardsPerAttempt: number
  completionPct: number
  // Rushing
  rushingYards: number
  rushingTDs: number
  rushingAttempts: number
  yardsPerCarry: number
  // Receiving
  receptions: number
  receivingYards: number
  receivingTDs: number
  targets: number
  yardsPerReception: number
  yardsPerTarget: number
  catchRate: number
  // Recent
  recentValues: Record<string, number[]>
}

const NFL_LEAGUE_AVG = {
  passYardsAllowed: 220,
  rushYardsAllowed: 115,
  passTDsAllowed: 1.5,
  receptionsAllowed: 22,
  playsPerGame: 63,
}

const inferNFLPosition = (stats: Record<string, any>): NFLPosition => {
  const passAttempts = pickStat(stats, ['ATTEMPTS', 'PASSING_ATTEMPTS', 'passingAttempts']) ?? 0
  const rushAttempts = pickStat(stats, ['RUSHING_ATTEMPTS', 'rushingAttempts']) ?? 0
  const targets = pickStat(stats, ['TARGETS', 'receivingTargets']) ?? 0

  if (passAttempts > 100) return 'QB'
  if (rushAttempts > 50 && rushAttempts > targets) return 'RB'
  if (targets > 20) return 'WR' // Could be TE too, but we'll treat them similarly
  return 'UNKNOWN'
}

const buildNFLPlayerContext = (stats: PlayerStats): NFLPlayerContext => {
  const s = stats.stats as Record<string, any>
  const recent = stats.recent || []
  const position = inferNFLPosition(s)

  // Passing stats
  const passingYards = pickStat(s, ['PASSING_YARDS', 'passingYards']) ?? 0
  const passingTDs = pickStat(s, ['PASSING_TDS', 'passingTouchdowns']) ?? 0
  const passingAttempts = pickStat(s, ['ATTEMPTS', 'PASSING_ATTEMPTS', 'passingAttempts']) ?? 0
  const completions = pickStat(s, ['COMPLETIONS', 'completions']) ?? 0
  const interceptions = pickStat(s, ['INTERCEPTIONS', 'interceptions']) ?? 0
  const yardsPerAttempt = passingAttempts > 0 ? passingYards / passingAttempts : 0
  const completionPct = passingAttempts > 0 ? (completions / passingAttempts) * 100 : 0

  // Rushing stats
  const rushingYards = pickStat(s, ['RUSHING_YARDS', 'rushingYards']) ?? 0
  const rushingTDs = pickStat(s, ['RUSHING_TDS', 'rushingTouchdowns']) ?? 0
  const rushingAttempts = pickStat(s, ['RUSHING_ATTEMPTS', 'rushingAttempts']) ?? 0
  const yardsPerCarry = rushingAttempts > 0 ? rushingYards / rushingAttempts : 0

  // Receiving stats
  const receptions = pickStat(s, ['RECEPTIONS', 'receptions']) ?? 0
  const receivingYards = pickStat(s, ['RECEIVING_YARDS', 'receivingYards']) ?? 0
  const receivingTDs = pickStat(s, ['RECEIVING_TDS', 'receivingTouchdowns']) ?? 0
  const targets = pickStat(s, ['TARGETS', 'receivingTargets']) ?? 0
  const yardsPerReception = receptions > 0 ? receivingYards / receptions : 0
  const yardsPerTarget = targets > 0 ? receivingYards / targets : 0
  const catchRate = targets > 0 ? (receptions / targets) * 100 : 0

  // Recent values
  const recentValues: Record<string, number[]> = {
    passingYards: getRecentStatValues(recent, ['PASSING_YARDS', 'passingYards']),
    passingTDs: getRecentStatValues(recent, ['PASSING_TDS', 'passingTouchdowns']),
    rushingYards: getRecentStatValues(recent, ['RUSHING_YARDS', 'rushingYards']),
    receivingYards: getRecentStatValues(recent, ['RECEIVING_YARDS', 'receivingYards']),
    receptions: getRecentStatValues(recent, ['RECEPTIONS', 'receptions']),
    targets: getRecentStatValues(recent, ['TARGETS', 'receivingTargets']),
    attempts: getRecentStatValues(recent, ['ATTEMPTS', 'PASSING_ATTEMPTS']),
    rushAttempts: getRecentStatValues(recent, ['RUSHING_ATTEMPTS', 'rushingAttempts']),
  }

  return {
    position,
    passingYards,
    passingTDs,
    passingAttempts,
    completions,
    interceptions,
    yardsPerAttempt,
    completionPct,
    rushingYards,
    rushingTDs,
    rushingAttempts,
    yardsPerCarry,
    receptions,
    receivingYards,
    receivingTDs,
    targets,
    yardsPerReception,
    yardsPerTarget,
    catchRate,
    recentValues,
  }
}

export async function projectNFLProp(
  playerName: string,
  market: string,
  matchup?: MatchupContext
): Promise<PropProjection | null> {
  const playerStats = await getPlayerSeasonStats(playerName, 'americanfootball_nfl')
  if (!playerStats) return null

  const ctx = buildNFLPlayerContext(playerStats)
  const factors: ProjectionFactor[] = []

  let baseAvg: number
  let recentValues: number[]
  let recentAvg: number | null

  // Determine baseline based on market
  switch (market) {
    case 'passing_yards':
      baseAvg = ctx.passingYards
      recentValues = ctx.recentValues.passingYards
      recentAvg = average(recentValues)
      break
    case 'passing_touchdowns':
      baseAvg = ctx.passingTDs
      recentValues = ctx.recentValues.passingTDs
      recentAvg = average(recentValues)
      break
    case 'rushing_yards':
      baseAvg = ctx.rushingYards
      recentValues = ctx.recentValues.rushingYards
      recentAvg = average(recentValues)
      break
    case 'receiving_yards':
      baseAvg = ctx.receivingYards
      recentValues = ctx.recentValues.receivingYards
      recentAvg = average(recentValues)
      break
    case 'receptions':
      baseAvg = ctx.receptions
      recentValues = ctx.recentValues.receptions
      recentAvg = average(recentValues)
      break
    case 'rushing_receiving_yards':
      baseAvg = ctx.rushingYards + ctx.receivingYards
      recentValues = ctx.recentValues.rushingYards.map((r, i) =>
        r + (ctx.recentValues.receivingYards[i] ?? 0)
      )
      recentAvg = average(recentValues)
      break
    default:
      return null
  }

  if (baseAvg === 0) return null

  factors.push({
    name: 'Season Average',
    value: baseAvg,
    impact: 1.0,
    description: `Season avg: ${baseAvg.toFixed(1)} ${market.replace(/_/g, ' ')}`,
  })

  let projection = baseAvg
  let totalMultiplier = 1.0

  // 1. OPPORTUNITY FACTOR: Volume trends
  const recentOpportunity = market.includes('passing')
    ? average(ctx.recentValues.attempts)
    : market.includes('rushing')
      ? average(ctx.recentValues.rushAttempts)
      : average(ctx.recentValues.targets)

  const seasonOpportunity = market.includes('passing')
    ? ctx.passingAttempts
    : market.includes('rushing')
      ? ctx.rushingAttempts
      : ctx.targets

  if (recentOpportunity && seasonOpportunity > 0) {
    const opportunityMultiplier = clamp(recentOpportunity / seasonOpportunity, 0.85, 1.15)
    if (Math.abs(opportunityMultiplier - 1) > 0.03) {
      factors.push({
        name: 'Opportunity Trend',
        value: recentOpportunity,
        impact: opportunityMultiplier,
        description: `Recent opportunities: ${recentOpportunity.toFixed(1)} vs season ${seasonOpportunity.toFixed(1)}`,
      })
      totalMultiplier *= (1 + (opportunityMultiplier - 1) * 0.5)
    }
  }

  // 2. EFFICIENCY FACTOR
  if (recentAvg !== null && recentAvg > 0) {
    const efficiencyMultiplier = clamp(recentAvg / baseAvg, 0.8, 1.2)
    if (Math.abs(efficiencyMultiplier - 1) > 0.03) {
      factors.push({
        name: 'Recent Efficiency',
        value: recentAvg,
        impact: efficiencyMultiplier,
        description: `L5 avg: ${recentAvg.toFixed(1)} vs season ${baseAvg.toFixed(1)}`,
      })
      totalMultiplier *= (1 + (efficiencyMultiplier - 1) * 0.35)
    }
  }

  // 3. GAME SCRIPT FACTOR (for passing vs rushing)
  if (matchup?.gameScript) {
    let scriptMultiplier = 1.0
    if (market.includes('passing')) {
      scriptMultiplier = matchup.gameScript === 'underdog' ? 1.08 :
                         matchup.gameScript === 'favorite' ? 0.95 : 1.0
    } else if (market.includes('rushing')) {
      scriptMultiplier = matchup.gameScript === 'favorite' ? 1.06 :
                         matchup.gameScript === 'underdog' ? 0.92 : 1.0
    }
    if (scriptMultiplier !== 1.0) {
      factors.push({
        name: 'Game Script',
        value: matchup.spread ?? 0,
        impact: scriptMultiplier,
        description: `${matchup.gameScript === 'underdog' ? 'Underdog' : 'Favorite'} game script`,
      })
      totalMultiplier *= scriptMultiplier
    }
  }

  // 4. MATCHUP FACTOR
  if (matchup?.opponent) {
    const oppTeams = await getTeamStats('americanfootball_nfl', matchup.opponent)
    const oppStats = oppTeams?.[0]?.stats as Record<string, any> ?? {}

    let defenseAllowed: number | null = null
    let leagueAvg: number | null = null

    if (market.includes('passing')) {
      defenseAllowed = pickStat(oppStats, ['passingYardsAllowedPerGame', 'opponentPassingYards'])
      leagueAvg = NFL_LEAGUE_AVG.passYardsAllowed
    } else if (market.includes('rushing')) {
      defenseAllowed = pickStat(oppStats, ['rushingYardsAllowedPerGame', 'opponentRushingYards'])
      leagueAvg = NFL_LEAGUE_AVG.rushYardsAllowed
    } else if (market === 'receptions') {
      defenseAllowed = pickStat(oppStats, ['receptionsAllowedPerGame', 'opponentReceptions'])
      leagueAvg = NFL_LEAGUE_AVG.receptionsAllowed
    }

    if (defenseAllowed !== null && leagueAvg !== null) {
      const matchupMultiplier = clamp(defenseAllowed / leagueAvg, 0.85, 1.15)
      if (Math.abs(matchupMultiplier - 1) > 0.03) {
        factors.push({
          name: 'Opponent Defense',
          value: defenseAllowed,
          impact: matchupMultiplier,
          description: `${matchup.opponent} allows ${defenseAllowed.toFixed(1)} vs league ${leagueAvg.toFixed(1)}`,
        })
        totalMultiplier *= (1 + (matchupMultiplier - 1) * 0.4)
      }
    }
  }

  // 5. HOME/AWAY FACTOR (smaller impact in NFL)
  if (matchup?.isHome !== undefined) {
    const homeMultiplier = matchup.isHome ? 1.015 : 0.985
    factors.push({
      name: 'Home/Away',
      value: matchup.isHome ? 1 : 0,
      impact: homeMultiplier,
      description: matchup.isHome ? 'Home game (+1.5%)' : 'Away game (-1.5%)',
    })
    totalMultiplier *= homeMultiplier
  }

  // Apply multiplier
  projection = baseAvg * totalMultiplier

  // Calculate variance
  const variance = recentValues.length >= 3
    ? stdDev(recentValues, recentAvg ?? baseAvg)
    : baseAvg * 0.30 // NFL has higher variance

  // Confidence
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (recentValues.length >= 4 && factors.length >= 3) {
    confidence = 'high'
  } else if (recentValues.length >= 2 || factors.length >= 2) {
    confidence = 'medium'
  }

  return {
    player: playerStats.name,
    team: playerStats.team,
    opponent: matchup?.opponent,
    market,
    projection: Number(projection.toFixed(1)),
    confidence,
    factors,
    variance: Number(variance.toFixed(2)),
    sampleSize: recentValues.length,
  }
}

// ============================================================================
// NHL PROJECTION MODEL
// ============================================================================

interface NHLPlayerContext {
  gamesPlayed: number
  goals: number
  assists: number
  points: number
  shots: number
  plusMinus: number
  goalsPerGame: number
  assistsPerGame: number
  pointsPerGame: number
  shotsPerGame: number
  shootingPct: number
  // Recent
  recentValues: Record<string, number[]>
}

const NHL_LEAGUE_AVG = {
  goalsAgainst: 3.0,
  shotsAgainst: 30,
  savePercentage: 0.905,
}

const buildNHLPlayerContext = (stats: PlayerStats): NHLPlayerContext => {
  const s = stats.stats as Record<string, any>
  const recent = stats.recent || []

  const gamesPlayed = pickStat(s, ['GP', 'gamesPlayed', 'games']) ?? 1
  const goals = pickStat(s, ['GOALS', 'goals']) ?? 0
  const assists = pickStat(s, ['ASSISTS', 'assists']) ?? 0
  const points = pickStat(s, ['POINTS', 'points']) ?? goals + assists
  const shots = pickStat(s, ['SHOTS', 'shots']) ?? 0
  const plusMinus = pickStat(s, ['PLUS_MINUS', 'plusMinus']) ?? 0

  const goalsPerGame = gamesPlayed > 0 ? goals / gamesPlayed : 0
  const assistsPerGame = gamesPlayed > 0 ? assists / gamesPlayed : 0
  const pointsPerGame = gamesPlayed > 0 ? points / gamesPlayed : 0
  const shotsPerGame = gamesPlayed > 0 ? shots / gamesPlayed : 0
  const shootingPct = shots > 0 ? (goals / shots) * 100 : 0

  const recentValues: Record<string, number[]> = {
    goals: getRecentStatValues(recent, ['GOALS', 'goals']),
    assists: getRecentStatValues(recent, ['ASSISTS', 'assists']),
    points: getRecentStatValues(recent, ['POINTS', 'points']),
    shots: getRecentStatValues(recent, ['SHOTS', 'shots']),
  }

  return {
    gamesPlayed,
    goals,
    assists,
    points,
    shots,
    plusMinus,
    goalsPerGame,
    assistsPerGame,
    pointsPerGame,
    shotsPerGame,
    shootingPct,
    recentValues,
  }
}

export async function projectNHLProp(
  playerName: string,
  market: string,
  matchup?: MatchupContext
): Promise<PropProjection | null> {
  const playerStats = await getPlayerSeasonStats(playerName, 'icehockey_nhl')
  if (!playerStats) return null

  const ctx = buildNHLPlayerContext(playerStats)
  const factors: ProjectionFactor[] = []

  let baseAvg: number
  let recentValues: number[]
  let recentAvg: number | null

  switch (market) {
    case 'goals':
      baseAvg = ctx.goalsPerGame
      recentValues = ctx.recentValues.goals
      recentAvg = average(recentValues)
      break
    case 'assists':
      baseAvg = ctx.assistsPerGame
      recentValues = ctx.recentValues.assists
      recentAvg = average(recentValues)
      break
    case 'points':
      baseAvg = ctx.pointsPerGame
      recentValues = ctx.recentValues.points
      recentAvg = average(recentValues)
      break
    case 'shots':
      baseAvg = ctx.shotsPerGame
      recentValues = ctx.recentValues.shots
      recentAvg = average(recentValues)
      break
    default:
      return null
  }

  if (baseAvg === 0 && ctx.gamesPlayed < 3) return null

  factors.push({
    name: 'Season Average',
    value: baseAvg,
    impact: 1.0,
    description: `Season avg: ${baseAvg.toFixed(2)} ${market} per game`,
  })

  let projection = baseAvg
  let totalMultiplier = 1.0

  // 1. RECENT FORM FACTOR (heavily weighted in NHL)
  if (recentAvg !== null && baseAvg > 0) {
    const formMultiplier = clamp(recentAvg / baseAvg, 0.7, 1.3)
    if (Math.abs(formMultiplier - 1) > 0.05) {
      factors.push({
        name: 'Recent Form',
        value: recentAvg,
        impact: formMultiplier,
        description: `L5 avg: ${recentAvg.toFixed(2)} vs season ${baseAvg.toFixed(2)}`,
      })
      totalMultiplier *= (1 + (formMultiplier - 1) * 0.45) // NHL is streaky
    }
  }

  // 2. SHOOTING REGRESSION (for goals)
  if (market === 'goals' && ctx.shootingPct > 0) {
    const leagueAvgShootingPct = 10.5 // ~10.5% league average
    const shootingRegression = ctx.shootingPct > leagueAvgShootingPct + 5
      ? 0.95 // Regress hot shooters down
      : ctx.shootingPct < leagueAvgShootingPct - 3
        ? 1.05 // Regress cold shooters up
        : 1.0

    if (shootingRegression !== 1.0) {
      factors.push({
        name: 'Shooting % Regression',
        value: ctx.shootingPct,
        impact: shootingRegression,
        description: `Shooting ${ctx.shootingPct.toFixed(1)}% vs league ${leagueAvgShootingPct}%`,
      })
      totalMultiplier *= shootingRegression
    }
  }

  // 3. SHOT VOLUME TREND (for goals, shots props)
  if ((market === 'goals' || market === 'shots') && ctx.recentValues.shots.length > 0) {
    const recentShots = average(ctx.recentValues.shots)
    if (recentShots !== null && ctx.shotsPerGame > 0) {
      const volumeMultiplier = clamp(recentShots / ctx.shotsPerGame, 0.85, 1.15)
      if (Math.abs(volumeMultiplier - 1) > 0.03) {
        factors.push({
          name: 'Shot Volume',
          value: recentShots,
          impact: volumeMultiplier,
          description: `Recent shots: ${recentShots.toFixed(1)} vs season ${ctx.shotsPerGame.toFixed(1)}`,
        })
        totalMultiplier *= (1 + (volumeMultiplier - 1) * 0.3)
      }
    }
  }

  // 4. OPPONENT MATCHUP
  if (matchup?.opponent) {
    const oppTeams = await getTeamStats('icehockey_nhl', matchup.opponent)
    const oppStats = oppTeams?.[0]?.stats as Record<string, any> ?? {}

    const goalsAgainst = pickStat(oppStats, ['goalsAgainstPerGame', 'goalsAgainst'])
    if (goalsAgainst !== null) {
      const goalsAgainstPerGame = goalsAgainst > 50 ? goalsAgainst / (ctx.gamesPlayed || 40) : goalsAgainst
      const matchupMultiplier = clamp(goalsAgainstPerGame / NHL_LEAGUE_AVG.goalsAgainst, 0.85, 1.15)
      if (Math.abs(matchupMultiplier - 1) > 0.03) {
        factors.push({
          name: 'Opponent Defense',
          value: goalsAgainstPerGame,
          impact: matchupMultiplier,
          description: `${matchup.opponent} allows ${goalsAgainstPerGame.toFixed(2)} G/G vs league ${NHL_LEAGUE_AVG.goalsAgainst}`,
        })
        totalMultiplier *= (1 + (matchupMultiplier - 1) * 0.35)
      }
    }
  }

  // 5. HOME/AWAY
  if (matchup?.isHome !== undefined) {
    const homeMultiplier = matchup.isHome ? 1.03 : 0.97 // Larger home ice advantage in NHL
    factors.push({
      name: 'Home/Away',
      value: matchup.isHome ? 1 : 0,
      impact: homeMultiplier,
      description: matchup.isHome ? 'Home ice (+3%)' : 'Away game (-3%)',
    })
    totalMultiplier *= homeMultiplier
  }

  // Apply multiplier
  projection = baseAvg * totalMultiplier

  // Variance (NHL is high variance)
  const variance = recentValues.length >= 3
    ? stdDev(recentValues, recentAvg ?? baseAvg)
    : baseAvg * 0.5 // NHL props have high variance

  // Confidence
  let confidence: 'low' | 'medium' | 'high' = 'low'
  if (recentValues.length >= 5 && factors.length >= 3) {
    confidence = 'high'
  } else if (recentValues.length >= 3 || factors.length >= 2) {
    confidence = 'medium'
  }

  return {
    player: playerStats.name,
    team: playerStats.team,
    opponent: matchup?.opponent,
    market,
    projection: Number(projection.toFixed(2)),
    confidence,
    factors,
    variance: Number(variance.toFixed(3)),
    sampleSize: recentValues.length,
  }
}

// ============================================================================
// UNIFIED PROJECTION INTERFACE
// ============================================================================

export type SportKey =
  | 'basketball_nba'
  | 'americanfootball_nfl'
  | 'icehockey_nhl'
  | 'basketball_ncaab'
  | 'americanfootball_ncaaf'

export async function projectPlayerProp(
  playerName: string,
  market: string,
  sport: SportKey,
  matchup?: MatchupContext
): Promise<PropProjection | null> {
  switch (sport) {
    case 'basketball_nba':
    case 'basketball_ncaab':
      return projectNBAProp(playerName, market, matchup)
    case 'americanfootball_nfl':
    case 'americanfootball_ncaaf':
      return projectNFLProp(playerName, market, matchup)
    case 'icehockey_nhl':
      return projectNHLProp(playerName, market, matchup)
    default:
      return null
  }
}

/**
 * Calculate probability of hitting a prop line
 */
export function calculatePropProbability(
  projection: PropProjection,
  line: number,
  direction: 'over' | 'under'
): { probability: number; edge?: number; impliedOdds?: number } {
  const { projection: proj, variance, market } = projection

  // Use normal distribution for most props, Poisson for counting stats
  const countingStats = new Set(['threes', 'goals', 'assists', 'touchdowns', 'receptions'])
  const usePoisson = countingStats.has(market) && line < 10

  let probability: number
  if (usePoisson) {
    const threshold = Math.floor(line) + 1
    probability = direction === 'over'
      ? calculateOverProbability(proj, threshold)
      : 1 - calculateOverProbability(proj, threshold)
  } else {
    probability = direction === 'over'
      ? calculateOverProbabilityNormal(proj, line)
      : 1 - calculateOverProbabilityNormal(proj, line)
  }

  return { probability: Number(probability.toFixed(4)) }
}

/**
 * Format projection for display
 */
export function formatProjection(projection: PropProjection): string {
  const lines: string[] = []
  lines.push(`**${projection.player}** (${projection.team})`)
  lines.push(`- **${projection.market.replace(/_/g, ' ')}**: Projection ${projection.projection}`)
  lines.push(`- **Confidence**: ${projection.confidence.toUpperCase()}`)
  lines.push(`- **Sample Size**: ${projection.sampleSize} recent games`)

  if (projection.factors.length > 0) {
    lines.push('')
    lines.push('**Factors:**')
    for (const factor of projection.factors) {
      const impactStr = factor.impact !== 1.0
        ? ` (${factor.impact > 1 ? '+' : ''}${((factor.impact - 1) * 100).toFixed(1)}%)`
        : ''
      lines.push(`- ${factor.name}: ${factor.description}${impactStr}`)
    }
  }

  return lines.join('\n')
}
