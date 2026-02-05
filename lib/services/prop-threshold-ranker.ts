/**
 * Prop Threshold Ranker
 * Ranks players by probability of hitting a specific prop threshold
 * Factors in: opponent defense, pace, home/away, rest days, recent form
 * Supports: NBA, NFL, NHL
 */

import { fetchAllLiveScores, type LiveScoreGame } from '@/lib/live-scores'
import {
  getNBARoster,
  getNBAPlayerSeasonStats,
  getNBATeamStats,
  getNFLRoster,
  getNFLPlayerSeasonStats,
  getNFLTeamStats,
  getNHLPlayerSeasonStats,
  getNHLTeamStats,
  type RosterPlayer,
  type PlayerStats,
  type TeamStats,
} from '@/lib/sports-stats-api'
import {
  calculateOverProbability,
  calculateOverProbabilityNormal,
  getConfidenceLevel,
  formatProbability,
  type PropProbabilityResult,
} from '@/lib/utils/prop-probability'
import { TEAMS_REGISTRY } from '@/lib/data/teams-registry'

export type SupportedSport = 'nba' | 'nfl' | 'nhl'

// Team abbreviation mappings for NBA
const NBA_TEAM_ABBREV_MAP: Record<string, string> = {
  hawks: 'ATL', celtics: 'BOS', nets: 'BKN', brooklyn: 'BKN',
  hornets: 'CHA', charlotte: 'CHA', bulls: 'CHI', cavaliers: 'CLE', cavs: 'CLE',
  mavericks: 'DAL', mavs: 'DAL', nuggets: 'DEN', pistons: 'DET',
  warriors: 'GSW', goldenstate: 'GSW', rockets: 'HOU', pacers: 'IND',
  clippers: 'LAC', lakers: 'LAL', grizzlies: 'MEM', heat: 'MIA',
  bucks: 'MIL', timberwolves: 'MIN', wolves: 'MIN', pelicans: 'NOP',
  knicks: 'NYK', thunder: 'OKC', magic: 'ORL', '76ers': 'PHI', sixers: 'PHI',
  suns: 'PHX', phoenix: 'PHX', trailblazers: 'POR', blazers: 'POR', portland: 'POR',
  kings: 'SAC', spurs: 'SAS', sanantonio: 'SAS', raptors: 'TOR',
  jazz: 'UTA', utah: 'UTA', wizards: 'WAS', washington: 'WAS',
  atlanta: 'ATL', boston: 'BOS', chicago: 'CHI', cleveland: 'CLE',
  dallas: 'DAL', denver: 'DEN', detroit: 'DET', houston: 'HOU',
  indiana: 'IND', memphis: 'MEM', miami: 'MIA', milwaukee: 'MIL',
  minnesota: 'MIN', neworleans: 'NOP', newyork: 'NYK', oklahomacity: 'OKC',
  orlando: 'ORL', philadelphia: 'PHI', sacramento: 'SAC', toronto: 'TOR',
}

// NFL team abbreviation mappings
const NFL_TEAM_ABBREV_MAP: Record<string, string> = {
  chiefs: 'KC', eagles: 'PHI', bills: 'BUF', '49ers': 'SF', niners: 'SF',
  cowboys: 'DAL', ravens: 'BAL', bengals: 'CIN', dolphins: 'MIA',
  lions: 'DET', jaguars: 'JAX', jags: 'JAX', chargers: 'LAC', vikings: 'MIN',
  giants: 'NYG', jets: 'NYJ', packers: 'GB', seahawks: 'SEA',
  commanders: 'WAS', bears: 'CHI', browns: 'CLE', broncos: 'DEN',
  colts: 'IND', raiders: 'LV', rams: 'LAR', saints: 'NO',
  steelers: 'PIT', texans: 'HOU', titans: 'TEN', cardinals: 'ARI',
  falcons: 'ATL', panthers: 'CAR', patriots: 'NE', buccaneers: 'TB', bucs: 'TB',
  kansascity: 'KC', philadelphia: 'PHI', buffalo: 'BUF', sanfrancisco: 'SF',
  dallas: 'DAL', baltimore: 'BAL', cincinnati: 'CIN', miami: 'MIA',
  detroit: 'DET', jacksonville: 'JAX', losangeleschargers: 'LAC', minnesota: 'MIN',
  newyorkgiants: 'NYG', newyorkjets: 'NYJ', greenbay: 'GB', seattle: 'SEA',
  washington: 'WAS', chicago: 'CHI', cleveland: 'CLE', denver: 'DEN',
  indianapolis: 'IND', lasvegas: 'LV', losangelesrams: 'LAR', neworleans: 'NO',
  pittsburgh: 'PIT', houston: 'HOU', tennessee: 'TEN', arizona: 'ARI',
  atlanta: 'ATL', carolina: 'CAR', newengland: 'NE', tampabay: 'TB',
}

// NHL team abbreviation mappings
const NHL_TEAM_ABBREV_MAP: Record<string, string> = {
  bruins: 'BOS', sabres: 'BUF', redwings: 'DET', panthers: 'FLA',
  canadiens: 'MTL', habs: 'MTL', senators: 'OTT', sens: 'OTT',
  lightning: 'TBL', bolts: 'TBL', mapleleafs: 'TOR', leafs: 'TOR',
  hurricanes: 'CAR', canes: 'CAR', bluejackets: 'CBJ', devils: 'NJD',
  islanders: 'NYI', isles: 'NYI', rangers: 'NYR', flyers: 'PHI',
  penguins: 'PIT', pens: 'PIT', capitals: 'WSH', caps: 'WSH',
  blackhawks: 'CHI', hawks: 'CHI', avalanche: 'COL', avs: 'COL',
  stars: 'DAL', wild: 'MIN', predators: 'NSH', preds: 'NSH',
  blues: 'STL', jets: 'WPG', ducks: 'ANA', flames: 'CGY',
  oilers: 'EDM', kings: 'LAK', sharks: 'SJS', kraken: 'SEA',
  canucks: 'VAN', goldenknights: 'VGK', knights: 'VGK', coyotes: 'ARI', utahhc: 'UTA',
  boston: 'BOS', buffalo: 'BUF', detroit: 'DET', florida: 'FLA',
  montreal: 'MTL', ottawa: 'OTT', tampabay: 'TBL', toronto: 'TOR',
  carolina: 'CAR', columbus: 'CBJ', newjersey: 'NJD', newyorkislanders: 'NYI',
  newyorkrangers: 'NYR', philadelphia: 'PHI', pittsburgh: 'PIT', washington: 'WSH',
  chicago: 'CHI', colorado: 'COL', dallas: 'DAL', minnesota: 'MIN',
  nashville: 'NSH', stlouis: 'STL', winnipeg: 'WPG', anaheim: 'ANA',
  calgary: 'CGY', edmonton: 'EDM', losangeles: 'LAK', sanjose: 'SJS',
  seattle: 'SEA', vancouver: 'VAN', vegas: 'VGK', arizona: 'ARI', utah: 'UTA',
}

// Reverse maps for abbreviation to team name lookup
const NBA_ABBREV_TO_NAME: Record<string, string> = {
  ATL: 'hawks', BOS: 'celtics', BKN: 'nets', BRK: 'nets', CHA: 'hornets', CHO: 'hornets', CHI: 'bulls',
  CLE: 'cavaliers', DAL: 'mavericks', DEN: 'nuggets', DET: 'pistons',
  GSW: 'warriors', HOU: 'rockets', IND: 'pacers', LAC: 'clippers',
  LAL: 'lakers', MEM: 'grizzlies', MIA: 'heat', MIL: 'bucks',
  MIN: 'timberwolves', NOP: 'pelicans', NYK: 'knicks', OKC: 'thunder',
  ORL: 'magic', PHI: '76ers', PHX: 'suns', PHO: 'suns', POR: 'trailblazers',
  SAC: 'kings', SAS: 'spurs', TOR: 'raptors', UTA: 'jazz', WAS: 'wizards',
}

// Legacy aliases for backwards compatibility
const TEAM_ABBREV_MAP = NBA_TEAM_ABBREV_MAP
const ABBREV_TO_NAME = NBA_ABBREV_TO_NAME

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

interface ParsedPlayer {
  name: string
  team: string
  sport: SupportedSport
  // NBA stats
  mpg?: number
  points?: number
  rebounds?: number
  assists?: number
  threes?: number
  threeAttempts?: number
  fg?: number
  fga?: number
  usage?: number
  bpm?: number
  // NFL stats
  passingYards?: number
  rushingYards?: number
  receivingYards?: number
  receptions?: number
  targets?: number
  passingTDs?: number
  rushingTDs?: number
  rushAttempts?: number
  passAttempts?: number
  completions?: number
  // NHL stats
  goals?: number
  nhlAssists?: number
  nhlPoints?: number
  shots?: number
  gamesPlayed?: number
}

interface TeamDefenseStats {
  sport: SupportedSport
  // NBA defense stats
  opp3PM?: number      // 3-pointers allowed per game
  opp3PA?: number      // 3-point attempts allowed per game
  oppPTS?: number      // Points allowed per game
  oppREB?: number      // Rebounds allowed per game
  oppAST?: number      // Assists allowed per game
  pace?: number        // Team pace
  // NFL defense stats
  passYardsAllowed?: number
  rushYardsAllowed?: number
  pointsAllowed?: number
  receptionsAllowed?: number
  yardsPerPlayAllowed?: number
  passCompletionsAllowed?: number
  // NHL defense stats
  goalsAgainst?: number
  shotsAgainst?: number
  savePct?: number
}

interface MatchupContext {
  sport: SupportedSport
  opponent: string
  opponentAbbrev: string
  isHome: boolean
  defenseStats: TeamDefenseStats | null
  restDays: number | null
  isBackToBack: boolean
}

interface AdjustmentFactors {
  opponentDefense: number   // Multiplier based on opponent defense
  pace: number              // Multiplier based on expected pace
  homeAway: number          // Multiplier for home/away
  rest: number              // Multiplier for rest days
  recentForm: number        // Multiplier for recent performance (placeholder)
  combined: number          // Total adjustment factor
  breakdown: string[]       // Explanation of adjustments
}

// League averages by sport (approximate)
const NBA_LEAGUE_AVG = {
  pace: 100.0,
  opp3PM: 13.0,
  opp3PA: 37.0,
  oppPTS: 114.0,
  oppREB: 43.0,
  oppAST: 26.0,
}

const NFL_LEAGUE_AVG = {
  passYardsAllowed: 220.0,
  rushYardsAllowed: 115.0,
  pointsAllowed: 22.0,
  passAttemptsAllowed: 34.0,
  rushAttemptsAllowed: 26.0,
  receptionsAllowed: 22.0,
  yardsPerPlayAllowed: 5.5,
  passCompletionsAllowed: 21.0,
}

const NHL_LEAGUE_AVG = {
  goalsAgainst: 3.1,
  shotsAgainst: 30.0,
  assistsAgainst: 5.0,
  savePct: 0.905,
}

// Legacy alias for backwards compatibility
const LEAGUE_AVG = NBA_LEAGUE_AVG

const PLAYER_CACHE_TTL = 1000 * 60 * 15
const playerCache = new Map<string, { ts: number; players: Map<string, ParsedPlayer> }>()

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const num = Number(value)
    return Number.isFinite(num) ? num : null
  }
  return null
}

const pickStat = (stats: Record<string, unknown>, keys: string[]) => {
  for (const key of keys) {
    const value = toNumber(stats[key])
    if (value != null) return value
  }
  return null
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

/**
 * Load players and season stats (cached) for a specific sport.
 */
async function getAllPlayers(
  sport: SupportedSport,
  teamFilter?: Set<string>
): Promise<Map<string, ParsedPlayer>> {
  const key = `${sport}:${teamFilter && teamFilter.size ? Array.from(teamFilter).sort().join(',') : 'all'}`
  const cached = playerCache.get(key)
  if (cached && Date.now() - cached.ts < PLAYER_CACHE_TTL) {
    return cached.players
  }

  const players = new Map<string, ParsedPlayer>()

  if (sport === 'nba') {
    const roster = await getNBARoster()
    const targets = teamFilter && teamFilter.size
      ? roster.filter((player) => teamFilter.has(player.teamAbbr))
      : roster

    await mapWithConcurrency(targets, 6, async (player) => {
      const statsData = await getNBAPlayerSeasonStats(player.name)
      const stats = (statsData?.stats || {}) as Record<string, unknown>
      if (!Object.keys(stats).length) return

      const parsed: ParsedPlayer = {
        name: player.name,
        team: player.teamAbbr,
        sport: 'nba',
        mpg: pickStat(stats, ['MPG', 'minutesPerGame', 'minutes']) ?? 0,
        points: pickStat(stats, ['PTS', 'PPG', 'points', 'pointsPerGame']) ?? 0,
        rebounds: pickStat(stats, ['REB', 'RPG', 'TRB', 'rebounds']) ?? 0,
        assists: pickStat(stats, ['AST', 'APG', 'assists']) ?? 0,
        threes: pickStat(stats, ['THREE_PM', '3P', 'threePointersMade', 'threesMadePerGame']) ?? 0,
        threeAttempts: pickStat(stats, ['THREE_PA', '3PA', 'threePointersAttempted', 'threesAttemptedPerGame']) ?? 0,
        fg: pickStat(stats, ['FGM', 'fieldGoalsMade']) ?? 0,
        fga: pickStat(stats, ['FGA', 'fieldGoalsAttempted']) ?? 0,
        usage: pickStat(stats, ['USG_PERCENT', 'usageRate', 'USG%']) ?? 0,
        bpm: pickStat(stats, ['BPM']) ?? 0,
      }
      players.set(normalize(parsed.name), parsed)
    })
  } else if (sport === 'nfl') {
    const roster = await getNFLRoster()
    // Filter to skill positions for props
    const skillPositions = ['QB', 'RB', 'WR', 'TE', 'K']
    const targets = roster
      .filter((p) => skillPositions.includes(p.position))
      .filter((p) => !teamFilter?.size || teamFilter.has(p.teamAbbr))

    await mapWithConcurrency(targets, 6, async (player) => {
      const statsData = await getNFLPlayerSeasonStats(player.name)
      const stats = (statsData?.stats || {}) as Record<string, unknown>
      if (!Object.keys(stats).length) return

      const parsed: ParsedPlayer = {
        name: player.name,
        team: player.teamAbbr,
        sport: 'nfl',
        passingYards: pickStat(stats, ['PASS_YDS', 'passingYards', 'passYards']) ?? 0,
        rushingYards: pickStat(stats, ['RUSH_YDS', 'rushingYards', 'rushYards']) ?? 0,
        receivingYards: pickStat(stats, ['REC_YDS', 'receivingYards', 'recYards']) ?? 0,
        receptions: pickStat(stats, ['REC', 'receptions', 'catches']) ?? 0,
        targets: pickStat(stats, ['TGT', 'targets', 'receivingTargets']) ?? 0,
        passingTDs: pickStat(stats, ['PASS_TD', 'passingTouchdowns', 'passTD']) ?? 0,
        rushingTDs: pickStat(stats, ['RUSH_TD', 'rushingTouchdowns', 'rushTD']) ?? 0,
        rushAttempts: pickStat(stats, ['RUSH_ATT', 'rushingAttempts', 'carries']) ?? 0,
        passAttempts: pickStat(stats, ['PASS_ATT', 'passingAttempts', 'attempts']) ?? 0,
        completions: pickStat(stats, ['COMP', 'completions', 'passCompletions']) ?? 0,
        gamesPlayed: pickStat(stats, ['GP', 'gamesPlayed', 'games']) ?? 0,
      }
      players.set(normalize(parsed.name), parsed)
    })
  } else if (sport === 'nhl') {
    // For NHL, we fetch from team rosters via team stats
    const teams = await getNHLTeamStats()
    // We need a different approach for NHL since there's no full roster function
    // For now, this is a placeholder - NHL props will use the slate-prop-edge-detector which has better NHL support
    console.log('[PROP RANKER] NHL roster fetching limited - use slate-prop-edge-detector for NHL props')
  }

  playerCache.set(key, { ts: Date.now(), players })
  return players
}

/**
 * Get team defensive stats for a specific sport.
 */
async function getTeamDefenseStats(sport: SupportedSport): Promise<Map<string, TeamDefenseStats>> {
  const statsMap = new Map<string, TeamDefenseStats>()

  if (sport === 'nba') {
    const teams = await getNBATeamStats()
    for (const team of teams) {
      const abbrev = (team.teamAbbr || getTeamAbbrev(team.team, 'nba')) ?? ''
      if (!abbrev) continue

      const stats = team.stats as Record<string, number | null>
      statsMap.set(abbrev.toUpperCase(), {
        sport: 'nba',
        opp3PM: stats.opponentThreeMadePerGame ?? stats.threesAllowedPerGame ?? NBA_LEAGUE_AVG.opp3PM,
        opp3PA: stats.opponentThreeAttemptedPerGame ?? NBA_LEAGUE_AVG.opp3PA,
        oppPTS: stats.pointsAgainstPerGame ?? NBA_LEAGUE_AVG.oppPTS,
        oppREB: stats.opponentReboundsPerGame ?? NBA_LEAGUE_AVG.oppREB,
        oppAST: stats.opponentAssistsPerGame ?? NBA_LEAGUE_AVG.oppAST,
        pace: stats.pace ?? NBA_LEAGUE_AVG.pace,
      })
    }
  } else if (sport === 'nfl') {
    const teams = await getNFLTeamStats()
    for (const team of teams) {
      const abbrev = team.teamAbbr || getTeamAbbrev(team.team, 'nfl')
      if (!abbrev) continue

      const stats = team.stats as Record<string, number | null>
      statsMap.set(abbrev.toUpperCase(), {
        sport: 'nfl',
        passYardsAllowed: stats.passingYardsAllowed ?? stats.netPassYardsPerGame ?? NFL_LEAGUE_AVG.passYardsAllowed,
        rushYardsAllowed: stats.rushingYardsAllowed ?? stats.rushYardsPerGame ?? NFL_LEAGUE_AVG.rushYardsAllowed,
        pointsAllowed: stats.pointsAgainstPerGame ?? NFL_LEAGUE_AVG.pointsAllowed,
        receptionsAllowed: NFL_LEAGUE_AVG.receptionsAllowed, // Harder to get from ESPN
        yardsPerPlayAllowed: stats.yardsPerPlayAllowed ?? NFL_LEAGUE_AVG.yardsPerPlayAllowed,
      })
    }
  } else if (sport === 'nhl') {
    const teams = await getNHLTeamStats()
    for (const team of teams) {
      const abbrev = team.teamAbbr || getTeamAbbrev(team.team, 'nhl')
      if (!abbrev) continue

      const stats = team.stats as Record<string, number | null>
      const gp = stats.gamesPlayed || 1
      statsMap.set(abbrev.toUpperCase(), {
        sport: 'nhl',
        goalsAgainst: (stats.goalsAgainst || 0) / gp || NHL_LEAGUE_AVG.goalsAgainst,
        shotsAgainst: NHL_LEAGUE_AVG.shotsAgainst, // Not always available
        savePct: NHL_LEAGUE_AVG.savePct,
      })
    }
  }

  return statsMap
}

function getTeamAbbrev(teamName: string, sport: SupportedSport = 'nba'): string | null {
  const normalized = normalize(teamName)

  // Select the appropriate map based on sport
  const abbrevMap = sport === 'nfl' ? NFL_TEAM_ABBREV_MAP :
                    sport === 'nhl' ? NHL_TEAM_ABBREV_MAP :
                    NBA_TEAM_ABBREV_MAP

  if (abbrevMap[normalized]) return abbrevMap[normalized]

  const upper = teamName.toUpperCase()
  // Check if already an abbreviation
  const abbrevValues = Object.values(abbrevMap)
  if (abbrevValues.includes(upper)) return upper

  for (const [key, abbrev] of Object.entries(abbrevMap)) {
    if (normalized.includes(key) || key.includes(normalized)) return abbrev
  }

  return null
}

/**
 * Get today's games with matchup context for a specific sport
 */
async function getTodaysMatchups(sport: SupportedSport): Promise<Map<string, MatchupContext>> {
  const matchups = new Map<string, MatchupContext>()

  try {
    const scores = await fetchAllLiveScores({ date: new Date().toISOString().slice(0, 10) })
    const games = scores.games.filter((g) => g.league === sport)

    for (const game of games) {
      const homeTeam = game.competitors.find((c) => c.homeAway === 'home')
      const awayTeam = game.competitors.find((c) => c.homeAway === 'away')

      if (!homeTeam || !awayTeam) continue

      const homeAbbrev = homeTeam.abbreviation || getTeamAbbrev(homeTeam.name, sport)
      const awayAbbrev = awayTeam.abbreviation || getTeamAbbrev(awayTeam.name, sport)

      if (homeAbbrev) {
        matchups.set(homeAbbrev, {
          sport,
          opponent: awayTeam.name,
          opponentAbbrev: awayAbbrev || '',
          isHome: true,
          defenseStats: null, // Filled later
          restDays: null,
          isBackToBack: false,
        })
      }

      if (awayAbbrev) {
        matchups.set(awayAbbrev, {
          sport,
          opponent: homeTeam.name,
          opponentAbbrev: homeAbbrev || '',
          isHome: false,
          defenseStats: null,
          restDays: null,
          isBackToBack: false,
        })
      }
    }
  } catch (error) {
    console.error(`[PROP RANKER] Error fetching ${sport} matchups:`, error)
  }

  return matchups
}

/**
 * Get rest factors for teams (simplified - checks yesterday's games)
 * Note: B2B is really only relevant for NBA/NHL. NFL plays weekly.
 */
async function getRestFactorsForTeams(sport: SupportedSport, teamAbbrevs: string[]): Promise<Map<string, { restDays: number; isBackToBack: boolean }>> {
  const restMap = new Map<string, { restDays: number; isBackToBack: boolean }>()

  // NFL doesn't have back-to-backs - they play weekly
  if (sport === 'nfl') {
    for (const abbrev of teamAbbrevs) {
      restMap.set(abbrev, { restDays: 7, isBackToBack: false })
    }
    return restMap
  }

  try {
    // Check yesterday's games
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayScores = await fetchAllLiveScores({ date: yesterday.toISOString().slice(0, 10) })

    const teamsPlayedYesterday = new Set<string>()
    for (const game of yesterdayScores.games) {
      if (game.league !== sport) continue
      for (const c of game.competitors) {
        if (c.abbreviation) teamsPlayedYesterday.add(c.abbreviation)
      }
    }

    // Check 2 days ago
    const twoDaysAgo = new Date()
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)
    const twoDaysAgoScores = await fetchAllLiveScores({ date: twoDaysAgo.toISOString().slice(0, 10) })

    const teamsPlayedTwoDaysAgo = new Set<string>()
    for (const game of twoDaysAgoScores.games) {
      if (game.league !== sport) continue
      for (const c of game.competitors) {
        if (c.abbreviation) teamsPlayedTwoDaysAgo.add(c.abbreviation)
      }
    }

    for (const abbrev of teamAbbrevs) {
      if (teamsPlayedYesterday.has(abbrev)) {
        restMap.set(abbrev, { restDays: 0, isBackToBack: true })
      } else if (teamsPlayedTwoDaysAgo.has(abbrev)) {
        restMap.set(abbrev, { restDays: 1, isBackToBack: false })
      } else {
        restMap.set(abbrev, { restDays: 2, isBackToBack: false }) // 2+ days rest
      }
    }
  } catch (error) {
    console.error(`[PROP RANKER] Error fetching ${sport} rest factors:`, error)
  }

  return restMap
}

/**
 * Calculate adjustment factors for a player's matchup (sport-aware)
 */
function calculateAdjustments(
  sport: SupportedSport,
  propType: string,
  playerTeam: string,
  matchup: MatchupContext | null,
  opponentDefense: TeamDefenseStats | null,
  playerTeamPace: number | null
): AdjustmentFactors {
  const breakdown: string[] = []
  let opponentDefenseAdj = 1.0
  let paceAdj = 1.0
  let homeAwayAdj = 1.0
  let restAdj = 1.0
  let recentFormAdj = 1.0

  const type = propType.toLowerCase()

  // 1. Opponent Defense Adjustment (sport-specific)
  if (opponentDefense) {
    if (sport === 'nba') {
      // NBA defense adjustments
      if (type.includes('three') || type === '3pm' || type === 'threes') {
        const opp3PM = opponentDefense.opp3PM ?? NBA_LEAGUE_AVG.opp3PM
        const defenseRatio = opp3PM / NBA_LEAGUE_AVG.opp3PM
        opponentDefenseAdj = defenseRatio
        if (defenseRatio > 1.05) {
          breakdown.push(`+${((defenseRatio - 1) * 100).toFixed(0)}% vs weak 3P defense`)
        } else if (defenseRatio < 0.95) {
          breakdown.push(`${((defenseRatio - 1) * 100).toFixed(0)}% vs strong 3P defense`)
        }
      } else if (type.includes('point') || type === 'pts') {
        const oppPTS = opponentDefense.oppPTS ?? NBA_LEAGUE_AVG.oppPTS
        const defenseRatio = oppPTS / NBA_LEAGUE_AVG.oppPTS
        opponentDefenseAdj = defenseRatio
        if (Math.abs(defenseRatio - 1) > 0.03) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} defense`)
        }
      } else if (type.includes('rebound') || type === 'reb') {
        const oppREB = opponentDefense.oppREB ?? NBA_LEAGUE_AVG.oppREB
        const defenseRatio = oppREB / NBA_LEAGUE_AVG.oppREB
        opponentDefenseAdj = defenseRatio
        if (Math.abs(defenseRatio - 1) > 0.03) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'poor' : 'good'} rebounding team`)
        }
      } else if (type.includes('assist') || type === 'ast') {
        const oppAST = opponentDefense.oppAST ?? NBA_LEAGUE_AVG.oppAST
        const defenseRatio = oppAST / NBA_LEAGUE_AVG.oppAST
        opponentDefenseAdj = defenseRatio
        if (Math.abs(defenseRatio - 1) > 0.03) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} assist defense`)
        }
      }
    } else if (sport === 'nfl') {
      // NFL defense adjustments
      if (type.includes('pass') && type.includes('yard')) {
        const passYds = opponentDefense.passYardsAllowed ?? NFL_LEAGUE_AVG.passYardsAllowed
        const defenseRatio = passYds / NFL_LEAGUE_AVG.passYardsAllowed
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.4 // 40% weight on matchup
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} pass defense`)
        }
      } else if (type.includes('rush') && type.includes('yard')) {
        const rushYds = opponentDefense.rushYardsAllowed ?? NFL_LEAGUE_AVG.rushYardsAllowed
        const defenseRatio = rushYds / NFL_LEAGUE_AVG.rushYardsAllowed
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.4
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} run defense`)
        }
      } else if (type.includes('receiv') && type.includes('yard')) {
        const passYds = opponentDefense.passYardsAllowed ?? NFL_LEAGUE_AVG.passYardsAllowed
        const defenseRatio = passYds / NFL_LEAGUE_AVG.passYardsAllowed
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.35 // Slightly lower for WR/TE
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} pass defense`)
        }
      } else if (type.includes('reception') || type === 'rec' || type === 'receptions') {
        const recs = opponentDefense.receptionsAllowed ?? NFL_LEAGUE_AVG.receptionsAllowed
        const defenseRatio = recs / NFL_LEAGUE_AVG.receptionsAllowed
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.3
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'leaky' : 'tight'} coverage`)
        }
      }
    } else if (sport === 'nhl') {
      // NHL defense adjustments
      if (type.includes('goal')) {
        const goalsAg = opponentDefense.goalsAgainst ?? NHL_LEAGUE_AVG.goalsAgainst
        const defenseRatio = goalsAg / NHL_LEAGUE_AVG.goalsAgainst
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.35 // NHL is more random
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'leaky' : 'tight'} defense`)
        }
      } else if (type.includes('shot')) {
        const shotsAg = opponentDefense.shotsAgainst ?? NHL_LEAGUE_AVG.shotsAgainst
        const defenseRatio = shotsAg / NHL_LEAGUE_AVG.shotsAgainst
        opponentDefenseAdj = 1 + (defenseRatio - 1) * 0.3
        if (Math.abs(defenseRatio - 1) > 0.05) {
          breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((opponentDefenseAdj - 1) * 100).toFixed(0)}% shot volume factor`)
        }
      }
    }
  }

  // 2. Pace Adjustment (NBA only - NFL/NHL don't have the same pace concept)
  if (sport === 'nba' && opponentDefense && playerTeamPace) {
    const oppPace = opponentDefense.pace ?? NBA_LEAGUE_AVG.pace
    const expectedPace = (playerTeamPace + oppPace) / 2
    const paceRatio = expectedPace / NBA_LEAGUE_AVG.pace
    paceAdj = 1 + (paceRatio - 1) * 0.5
    if (Math.abs(paceRatio - 1) > 0.02) {
      breakdown.push(`${paceRatio > 1 ? '+' : ''}${((paceAdj - 1) * 100).toFixed(0)}% pace factor`)
    }
  }

  // 3. Home/Away Adjustment (sport-specific)
  if (matchup) {
    const homeBoost = sport === 'nhl' ? 0.03 : 0.02 // Home ice is slightly bigger in NHL
    if (matchup.isHome) {
      homeAwayAdj = 1 + homeBoost
      breakdown.push(`+${(homeBoost * 100).toFixed(0)}% ${sport === 'nhl' ? 'home ice' : 'home court'}`)
    } else {
      homeAwayAdj = 1 - homeBoost
      breakdown.push(`-${(homeBoost * 100).toFixed(0)}% road game`)
    }
  }

  // 4. Rest Adjustment (sport-specific)
  if (matchup && sport !== 'nfl') { // NFL plays weekly, rest not relevant
    if (matchup.isBackToBack) {
      const b2bPenalty = sport === 'nhl' ? 0.06 : 0.08 // B2B matters slightly less in NHL
      restAdj = 1 - b2bPenalty
      breakdown.push(`-${(b2bPenalty * 100).toFixed(0)}% back-to-back`)
    } else if (matchup.restDays !== null && matchup.restDays >= 2) {
      restAdj = 1.03
      breakdown.push('+3% well rested')
    }
  }

  // Combined adjustment (multiplicative)
  const combined = opponentDefenseAdj * paceAdj * homeAwayAdj * restAdj * recentFormAdj

  return {
    opponentDefense: opponentDefenseAdj,
    pace: paceAdj,
    homeAway: homeAwayAdj,
    rest: restAdj,
    recentForm: recentFormAdj,
    combined,
    breakdown,
  }
}

function getStatValue(player: ParsedPlayer, propType: string): number {
  const type = propType.toLowerCase()

  // NBA stats
  if (player.sport === 'nba') {
    switch (type) {
      case 'threes':
      case '3pm':
      case 'three_pointers':
      case '3-pointers':
      case '3 pointers':
      case 'threepointers':
        return player.threes ?? 0
      case 'points':
      case 'pts':
        return player.points ?? 0
      case 'rebounds':
      case 'reb':
      case 'trb':
        return player.rebounds ?? 0
      case 'assists':
      case 'ast':
        return player.assists ?? 0
      case 'pra':
      case 'pts_reb_ast':
        return (player.points ?? 0) + (player.rebounds ?? 0) + (player.assists ?? 0)
      default:
        return player.points ?? 0
    }
  }

  // NFL stats
  if (player.sport === 'nfl') {
    if (type.includes('pass') && type.includes('yard')) return player.passingYards ?? 0
    if (type.includes('rush') && type.includes('yard')) return player.rushingYards ?? 0
    if (type.includes('receiv') && type.includes('yard')) return player.receivingYards ?? 0
    if (type.includes('reception') || type === 'rec' || type === 'receptions') return player.receptions ?? 0
    if (type.includes('target')) return player.targets ?? 0
    if (type.includes('pass') && type.includes('td')) return player.passingTDs ?? 0
    if (type.includes('rush') && type.includes('td')) return player.rushingTDs ?? 0
    if (type.includes('completion')) return player.completions ?? 0
    if (type.includes('attempt') && type.includes('rush')) return player.rushAttempts ?? 0
    if (type.includes('attempt') && type.includes('pass')) return player.passAttempts ?? 0
    // Default for NFL
    return player.receivingYards ?? player.rushingYards ?? player.passingYards ?? 0
  }

  // NHL stats
  if (player.sport === 'nhl') {
    if (type.includes('goal')) return player.goals ?? 0
    if (type.includes('assist')) return player.nhlAssists ?? 0
    if (type.includes('point')) return player.nhlPoints ?? 0
    if (type.includes('shot')) return player.shots ?? 0
    // Default for NHL
    return player.nhlPoints ?? 0
  }

  return 0
}

function shouldUsePoissonDistribution(propType: string, sport: SupportedSport): boolean {
  const type = propType.toLowerCase()

  if (sport === 'nba') {
    if (type.includes('three') || type === '3pm' || type === 'threes') return true
    if (type.includes('block') || type.includes('steal')) return true
  }

  if (sport === 'nfl') {
    if (type.includes('td') || type.includes('touchdown')) return true
    if (type.includes('interception')) return true
  }

  if (sport === 'nhl') {
    if (type.includes('goal')) return true
    if (type.includes('assist')) return true
  }

  return false
}

/**
 * Extended result with adjustment details
 */
export interface EnhancedPropResult extends PropProbabilityResult {
  adjustedAverage: number
  adjustmentFactor: number
  adjustmentBreakdown: string[]
  opponent?: string
  isHome?: boolean
  isBackToBack?: boolean
}

/**
 * Rank players by probability of hitting a prop threshold with matchup adjustments
 * Supports NBA, NFL, and NHL
 */
export async function getRankedPlayersByPropThreshold(
  propType: string,
  threshold: number,
  options: {
    sport?: SupportedSport
    todayOnly?: boolean
    minMinutes?: number
    limit?: number
  } = {}
): Promise<EnhancedPropResult[]> {
  const { sport = 'nba', todayOnly = true, minMinutes = 15, limit = 20 } = options

  console.log(`[PROP RANKER] Starting ${sport.toUpperCase()} analysis:`, { propType, threshold, todayOnly })

  const matchups = todayOnly ? await getTodaysMatchups(sport) : new Map()
  const teamFilter = matchups.size > 0 ? new Set(Array.from(matchups.keys())) : undefined
  const allPlayers = await getAllPlayers(sport, teamFilter)
  const teamDefenseStats = await getTeamDefenseStats(sport)

  // Get rest factors for all teams playing today
  const teamAbbrevs = Array.from(matchups.keys())
  const restFactors = await getRestFactorsForTeams(sport, teamAbbrevs)

  // Enrich matchups with defense stats and rest
  for (const [teamAbbrev, matchup] of matchups) {
    if (matchup.opponentAbbrev) {
      matchup.defenseStats = teamDefenseStats.get(matchup.opponentAbbrev) || null
    }
    const rest = restFactors.get(teamAbbrev)
    if (rest) {
      matchup.restDays = rest.restDays
      matchup.isBackToBack = rest.isBackToBack
    }
  }

  const results: EnhancedPropResult[] = []

  for (const [key, player] of allPlayers) {
    // Filter by minutes for NBA only
    if (sport === 'nba' && (player.mpg ?? 0) < minMinutes) continue

    // Filter by teams playing today
    if (todayOnly && matchups.size > 0 && !matchups.has(player.team)) {
      continue
    }

    const seasonAverage = getStatValue(player, propType)
    if (seasonAverage <= 0) continue

    const matchup = matchups.get(player.team) || null
    const opponentDefense = matchup?.defenseStats || null
    const playerTeamDefense = teamDefenseStats.get(player.team)
    const playerTeamPace = playerTeamDefense?.pace ?? null

    // Calculate adjustments (sport-aware)
    const adjustments = calculateAdjustments(
      sport,
      propType,
      player.team,
      matchup,
      opponentDefense,
      playerTeamPace
    )

    // Adjusted average
    const adjustedAverage = seasonAverage * adjustments.combined

    // Calculate probability with adjusted average
    const probability = shouldUsePoissonDistribution(propType, sport)
      ? calculateOverProbability(adjustedAverage, threshold)
      : calculateOverProbabilityNormal(adjustedAverage, threshold)

    let edge: string | undefined
    if (probability >= 0.8) edge = 'Strong Over'
    else if (probability >= 0.65) edge = 'Lean Over'
    else if (probability <= 0.2) edge = 'Strong Under'
    else if (probability <= 0.35) edge = 'Lean Under'

    results.push({
      playerName: player.name,
      team: player.team,
      propType,
      threshold,
      seasonAverage,
      adjustedAverage,
      adjustmentFactor: adjustments.combined,
      adjustmentBreakdown: adjustments.breakdown,
      probability,
      probabilityPercent: formatProbability(probability),
      confidenceLevel: getConfidenceLevel(probability),
      edge,
      opponent: matchup?.opponent,
      isHome: matchup?.isHome,
      isBackToBack: matchup?.isBackToBack,
    })
  }

  results.sort((a, b) => b.probability - a.probability)

  console.log(`[PROP RANKER] ${sport.toUpperCase()} analysis complete:`, { playersAnalyzed: results.length })

  return results.slice(0, limit)
}

/**
 * Format ranked results for chat output
 */
export function formatRankedPlayersForChat(
  results: EnhancedPropResult[],
  propType: string,
  threshold: number,
  sport: SupportedSport = 'nba'
): string {
  if (results.length === 0) {
    const sportLabel = sport.toUpperCase()
    return `No players found for ${propType} ${threshold}+ analysis. This may occur if there are no ${sportLabel} games scheduled today.`
  }

  const propLabel = propType.toLowerCase().includes('three') ? '3-pointers' : propType
  const sportLabel = sport.toUpperCase()

  let output = `**${sportLabel} Players Most Likely to Hit ${threshold}+ ${propLabel}**\n\n`
  output += `| Rank | Player | vs Opponent | Avg | Adj Avg | Prob | Edge |\n`
  output += `|------|--------|-------------|-----|---------|------|------|\n`

  results.slice(0, 15).forEach((result, index) => {
    const rank = index + 1
    const edge = result.edge || '-'
    const opponent = result.opponent
      ? `${result.isHome ? 'vs' : '@'} ${result.opponent.split(' ').pop()}`
      : '-'
    const adjAvgStr = result.adjustmentFactor !== 1.0
      ? result.adjustedAverage.toFixed(1)
      : '-'
    output += `| ${rank} | ${result.playerName} | ${opponent} | ${result.seasonAverage.toFixed(1)} | ${adjAvgStr} | ${result.probabilityPercent} | ${edge} |\n`
  })

  // Show adjustment breakdown for top 3
  output += `\n**Top 3 Adjustment Details:**\n`
  results.slice(0, 3).forEach((result, index) => {
    if (result.adjustmentBreakdown.length > 0) {
      output += `${index + 1}. **${result.playerName}**: ${result.adjustmentBreakdown.join(', ')}\n`
    } else {
      output += `${index + 1}. **${result.playerName}**: No significant adjustments\n`
    }
  })

  output += `\n**Methodology:**\n`
  output += `- Base probability from ${shouldUsePoissonDistribution(propType, sport) ? 'Poisson' : 'normal'} distribution\n`

  if (sport === 'nba') {
    output += `- Adjustments: opponent defense, pace, home/away, rest\n`
    output += `- Filtered to players with 15+ MPG on today's slate\n`
  } else if (sport === 'nfl') {
    output += `- Adjustments: opponent defense, home/away\n`
    output += `- Filtered to skill positions (QB, RB, WR, TE) on today's slate\n`
  } else if (sport === 'nhl') {
    output += `- Adjustments: opponent defense, home ice, rest\n`
    output += `- Players on today's slate\n`
  }

  return output
}

/**
 * Single-player prop probability result
 */
export interface SinglePlayerPropResult {
  playerName: string
  team: string
  sport: SupportedSport
  propType: string
  threshold: number
  seasonAverage: number
  adjustedAverage: number
  probability: number
  probabilityPercent: string
  confidenceLevel: string
  edge?: string
  adjustmentBreakdown: string[]
  opponent?: string
  isHome?: boolean
  gameFound: boolean
}

/**
 * Calculate prop probability for a single player
 * For queries like "what are the chances of LeBron scoring 30+ points"
 */
export async function getSinglePlayerPropProbability(
  playerName: string,
  propType: string,
  threshold: number,
  options: {
    sport?: SupportedSport
  } = {}
): Promise<SinglePlayerPropResult | null> {
  const { sport = 'nba' } = options

  console.log(`[PROP RANKER] Single player probability:`, { playerName, propType, threshold, sport })

  // Get player stats
  let playerStats: Record<string, unknown> | null = null
  let teamAbbr: string = ''

  if (sport === 'nba') {
    const { getNBAPlayerSeasonStats } = await import('@/lib/sports-stats-api')
    const stats = await getNBAPlayerSeasonStats(playerName)
    if (stats) {
      playerStats = stats.stats as Record<string, unknown>
      teamAbbr = stats.team || ''
    }
  } else if (sport === 'nfl') {
    const { getNFLPlayerSeasonStats } = await import('@/lib/sports-stats-api')
    const stats = await getNFLPlayerSeasonStats(playerName)
    if (stats) {
      playerStats = stats.stats as Record<string, unknown>
      teamAbbr = stats.team || ''
    }
  } else if (sport === 'nhl') {
    const { getNHLPlayerSeasonStats } = await import('@/lib/sports-stats-api')
    const stats = await getNHLPlayerSeasonStats(playerName)
    if (stats) {
      playerStats = stats.stats as Record<string, unknown>
      teamAbbr = stats.team || ''
    }
  }

  if (!playerStats) {
    console.log(`[PROP RANKER] Player not found: ${playerName}`)
    return null
  }

  // Build parsed player object
  const player: ParsedPlayer = { name: playerName, team: teamAbbr, sport }

  if (sport === 'nba') {
    player.mpg = pickStat(playerStats, ['MPG', 'minutesPerGame', 'minutes']) ?? 0
    player.points = pickStat(playerStats, ['PTS', 'PPG', 'points', 'pointsPerGame']) ?? 0
    player.rebounds = pickStat(playerStats, ['REB', 'RPG', 'TRB', 'rebounds']) ?? 0
    player.assists = pickStat(playerStats, ['AST', 'APG', 'assists']) ?? 0
    player.threes = pickStat(playerStats, ['THREE_PM', '3P', 'threePointersMade', 'threesMadePerGame']) ?? 0
  } else if (sport === 'nfl') {
    player.passingYards = pickStat(playerStats, ['PASS_YDS', 'passingYards', 'passYards']) ?? 0
    player.rushingYards = pickStat(playerStats, ['RUSH_YDS', 'rushingYards', 'rushYards']) ?? 0
    player.receivingYards = pickStat(playerStats, ['REC_YDS', 'receivingYards', 'recYards']) ?? 0
    player.receptions = pickStat(playerStats, ['REC', 'receptions', 'catches']) ?? 0
    player.passingTDs = pickStat(playerStats, ['PASS_TD', 'passingTouchdowns', 'passTD']) ?? 0
    player.rushingTDs = pickStat(playerStats, ['RUSH_TD', 'rushingTouchdowns', 'rushTD']) ?? 0
  } else if (sport === 'nhl') {
    player.goals = pickStat(playerStats, ['GOALS', 'goals']) ?? 0
    player.nhlAssists = pickStat(playerStats, ['ASSISTS', 'assists']) ?? 0
    player.nhlPoints = pickStat(playerStats, ['POINTS', 'points']) ?? 0
    player.shots = pickStat(playerStats, ['SHOTS', 'shots']) ?? 0
  }

  const seasonAverage = getStatValue(player, propType)
  if (seasonAverage <= 0) {
    console.log(`[PROP RANKER] No stats for ${propType}:`, playerStats)
    return null
  }

  // Get today's matchups and defense stats
  const matchups = await getTodaysMatchups(sport)
  const teamDefenseStats = await getTeamDefenseStats(sport)
  const matchup = matchups.get(teamAbbr) || null
  const opponentDefense = matchup?.defenseStats || null
  const playerTeamDefense = teamDefenseStats.get(teamAbbr)
  const playerTeamPace = playerTeamDefense?.pace ?? null

  // Calculate adjustments
  const adjustments = calculateAdjustments(
    sport,
    propType,
    teamAbbr,
    matchup,
    opponentDefense,
    playerTeamPace
  )

  const adjustedAverage = seasonAverage * adjustments.combined

  // Calculate probability
  const probability = shouldUsePoissonDistribution(propType, sport)
    ? calculateOverProbability(adjustedAverage, threshold)
    : calculateOverProbabilityNormal(adjustedAverage, threshold)

  let edge: string | undefined
  if (probability >= 0.8) edge = 'Strong Over'
  else if (probability >= 0.65) edge = 'Lean Over'
  else if (probability <= 0.2) edge = 'Strong Under'
  else if (probability <= 0.35) edge = 'Lean Under'

  return {
    playerName,
    team: teamAbbr,
    sport,
    propType,
    threshold,
    seasonAverage,
    adjustedAverage,
    probability,
    probabilityPercent: formatProbability(probability),
    confidenceLevel: getConfidenceLevel(probability),
    edge,
    adjustmentBreakdown: adjustments.breakdown,
    opponent: matchup?.opponent,
    isHome: matchup?.isHome,
    gameFound: !!matchup,
  }
}

/**
 * Format single player prop probability for chat output
 */
export function formatSinglePlayerPropForChat(result: SinglePlayerPropResult): string {
  let output = `**${result.playerName} ${result.propType} ${result.threshold}+ Probability**\n\n`

  output += `| Metric | Value |\n`
  output += `|--------|-------|\n`
  output += `| Season Average | ${result.seasonAverage.toFixed(1)} |\n`

  if (result.adjustedAverage !== result.seasonAverage) {
    output += `| Adjusted Average | ${result.adjustedAverage.toFixed(1)} |\n`
  }

  output += `| Probability | **${result.probabilityPercent}** |\n`
  output += `| Confidence | ${result.confidenceLevel} |\n`

  if (result.edge) {
    output += `| Recommendation | ${result.edge} |\n`
  }

  if (result.opponent) {
    const matchupStr = result.isHome ? `vs ${result.opponent}` : `@ ${result.opponent}`
    output += `| Today's Matchup | ${matchupStr} |\n`
  } else {
    output += `| Today's Matchup | No game found |\n`
  }

  if (result.adjustmentBreakdown.length > 0) {
    output += `\n**Adjustments Applied:**\n`
    for (const adj of result.adjustmentBreakdown) {
      output += `- ${adj}\n`
    }
  }

  const method = shouldUsePoissonDistribution(result.propType, result.sport) ? 'Poisson' : 'normal'
  output += `\n*Probability calculated using ${method} distribution based on season average${result.gameFound ? ' with matchup adjustments' : ''}.*`

  return output
}
