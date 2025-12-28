/**
 * Prop Threshold Ranker
 * Ranks players by probability of hitting a specific prop threshold
 * Factors in: opponent defense, pace, home/away, rest days, recent form
 */

import { nbaPlayerPerGame2025_2026Csv } from '@/data/nba_player_per_game_2025_2026'
import { nbaPlayerAdvStats2025_2026Csv } from '@/data/nba_player_advanced_stats_2025_2026'
import { fetchAllLiveScores, type LiveScoreGame } from '@/lib/live-scores'
import { getStaticNbaTeams } from '@/lib/nba-static-team-stats'
import {
  calculateOverProbability,
  calculateOverProbabilityNormal,
  getConfidenceLevel,
  formatProbability,
  type PropProbabilityResult,
} from '@/lib/utils/prop-probability'

// Team abbreviation mappings
const TEAM_ABBREV_MAP: Record<string, string> = {
  hawks: 'ATL', celtics: 'BOS', nets: 'BRK', brooklyn: 'BRK',
  hornets: 'CHO', charlotte: 'CHO', bulls: 'CHI', cavaliers: 'CLE', cavs: 'CLE',
  mavericks: 'DAL', mavs: 'DAL', nuggets: 'DEN', pistons: 'DET',
  warriors: 'GSW', goldenstate: 'GSW', rockets: 'HOU', pacers: 'IND',
  clippers: 'LAC', lakers: 'LAL', grizzlies: 'MEM', heat: 'MIA',
  bucks: 'MIL', timberwolves: 'MIN', wolves: 'MIN', pelicans: 'NOP',
  knicks: 'NYK', thunder: 'OKC', magic: 'ORL', '76ers': 'PHI', sixers: 'PHI',
  suns: 'PHO', phoenix: 'PHO', trailblazers: 'POR', blazers: 'POR', portland: 'POR',
  kings: 'SAC', spurs: 'SAS', sanantonio: 'SAS', raptors: 'TOR',
  jazz: 'UTA', utah: 'UTA', wizards: 'WAS', washington: 'WAS',
  atlanta: 'ATL', boston: 'BOS', chicago: 'CHI', cleveland: 'CLE',
  dallas: 'DAL', denver: 'DEN', detroit: 'DET', houston: 'HOU',
  indiana: 'IND', memphis: 'MEM', miami: 'MIA', milwaukee: 'MIL',
  minnesota: 'MIN', neworleans: 'NOP', newyork: 'NYK', oklahomacity: 'OKC',
  orlando: 'ORL', philadelphia: 'PHI', sacramento: 'SAC', toronto: 'TOR',
}

// Reverse map for abbreviation to full name lookup
const ABBREV_TO_NAME: Record<string, string> = {
  ATL: 'hawks', BOS: 'celtics', BRK: 'nets', CHO: 'hornets', CHI: 'bulls',
  CLE: 'cavaliers', DAL: 'mavericks', DEN: 'nuggets', DET: 'pistons',
  GSW: 'warriors', HOU: 'rockets', IND: 'pacers', LAC: 'clippers',
  LAL: 'lakers', MEM: 'grizzlies', MIA: 'heat', MIL: 'bucks',
  MIN: 'timberwolves', NOP: 'pelicans', NYK: 'knicks', OKC: 'thunder',
  ORL: 'magic', PHI: '76ers', PHO: 'suns', POR: 'trailblazers',
  SAC: 'kings', SAS: 'spurs', TOR: 'raptors', UTA: 'jazz', WAS: 'wizards',
}

const normalize = (value: string) =>
  value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '')

interface ParsedPlayer {
  name: string
  team: string
  mpg: number
  points: number
  rebounds: number
  assists: number
  threes: number
  threeAttempts: number
  fg: number
  fga: number
  usage?: number
  bpm?: number
}

interface TeamDefenseStats {
  opp3PM: number      // 3-pointers allowed per game
  opp3PA: number      // 3-point attempts allowed per game
  oppPTS: number      // Points allowed per game
  oppREB: number      // Rebounds allowed per game
  oppAST: number      // Assists allowed per game
  pace: number        // Team pace
}

interface MatchupContext {
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

// League averages (approximate)
const LEAGUE_AVG = {
  pace: 100.0,
  opp3PM: 13.0,
  opp3PA: 37.0,
  oppPTS: 114.0,
  oppREB: 43.0,
  oppAST: 26.0,
}

/**
 * Parse all players from static CSV data
 */
function getAllPlayers(): Map<string, ParsedPlayer> {
  const map = new Map<string, ParsedPlayer>()

  const perGameLines = nbaPlayerPerGame2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of perGameLines) {
    const cells = line.split(',')
    if (cells.length < 30) continue

    const player = cells[1].trim()
    const key = normalize(player)
    const team = cells[5]?.trim() || ''

    map.set(key, {
      name: player,
      team,
      mpg: parseFloat(cells[2]) || 0,
      points: parseFloat(cells[26]) || 0,
      rebounds: parseFloat(cells[20]) || 0,
      assists: parseFloat(cells[21]) || 0,
      threes: parseFloat(cells[14]) || 0,
      threeAttempts: parseFloat(cells[15]) || 0,
      fg: parseFloat(cells[10]) || 0,
      fga: parseFloat(cells[11]) || 0,
    })
  }

  const advLines = nbaPlayerAdvStats2025_2026Csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && /^\d+,/.test(l))

  for (const line of advLines) {
    const cells = line.split(',')
    if (cells.length < 28) continue

    const player = cells[1].trim()
    const key = normalize(player)

    if (map.has(key)) {
      const existing = map.get(key)!
      existing.usage = parseFloat(cells[27]) || 0
      existing.bpm = parseFloat(cells[17]) || 0
    }
  }

  return map
}

/**
 * Get team defensive stats from static data
 */
function getTeamDefenseStats(): Map<string, TeamDefenseStats> {
  const statsMap = new Map<string, TeamDefenseStats>()
  const teams = getStaticNbaTeams()

  for (const team of teams) {
    const abbrev = getTeamAbbrev(team.team)
    if (!abbrev) continue

    const stats = team.stats as Record<string, number | null>
    statsMap.set(abbrev, {
      opp3PM: stats.opponentThreeMadePerGame ?? stats.threesAllowedPerGame ?? LEAGUE_AVG.opp3PM,
      opp3PA: stats.opponentThreeAttemptedPerGame ?? LEAGUE_AVG.opp3PA,
      oppPTS: stats.pointsAgainstPerGame ?? LEAGUE_AVG.oppPTS,
      oppREB: stats.opponentReboundsPerGame ?? LEAGUE_AVG.oppREB,
      oppAST: stats.opponentAssistsPerGame ?? LEAGUE_AVG.oppAST,
      pace: stats.pace ?? LEAGUE_AVG.pace,
    })
  }

  return statsMap
}

function getTeamAbbrev(teamName: string): string | null {
  const normalized = normalize(teamName)
  if (TEAM_ABBREV_MAP[normalized]) return TEAM_ABBREV_MAP[normalized]
  const upper = teamName.toUpperCase()
  if (ABBREV_TO_NAME[upper]) return upper
  for (const [key, abbrev] of Object.entries(TEAM_ABBREV_MAP)) {
    if (normalized.includes(key) || key.includes(normalized)) return abbrev
  }
  return null
}

/**
 * Get today's games with matchup context
 */
async function getTodaysMatchups(): Promise<Map<string, MatchupContext>> {
  const matchups = new Map<string, MatchupContext>()

  try {
    const scores = await fetchAllLiveScores({ date: new Date().toISOString().slice(0, 10) })
    const nbaGames = scores.games.filter((g) => g.league === 'nba')

    for (const game of nbaGames) {
      const homeTeam = game.competitors.find((c) => c.homeAway === 'home')
      const awayTeam = game.competitors.find((c) => c.homeAway === 'away')

      if (!homeTeam || !awayTeam) continue

      const homeAbbrev = homeTeam.abbreviation || getTeamAbbrev(homeTeam.name)
      const awayAbbrev = awayTeam.abbreviation || getTeamAbbrev(awayTeam.name)

      if (homeAbbrev) {
        matchups.set(homeAbbrev, {
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
    console.error('[PROP RANKER] Error fetching matchups:', error)
  }

  return matchups
}

/**
 * Get rest factors for teams (simplified - checks yesterday's games)
 */
async function getRestFactorsForTeams(teamAbbrevs: string[]): Promise<Map<string, { restDays: number; isBackToBack: boolean }>> {
  const restMap = new Map<string, { restDays: number; isBackToBack: boolean }>()

  try {
    // Check yesterday's games
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayScores = await fetchAllLiveScores({ date: yesterday.toISOString().slice(0, 10) })

    const teamsPlayedYesterday = new Set<string>()
    for (const game of yesterdayScores.games) {
      if (game.league !== 'nba') continue
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
      if (game.league !== 'nba') continue
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
    console.error('[PROP RANKER] Error fetching rest factors:', error)
  }

  return restMap
}

/**
 * Calculate adjustment factors for a player's matchup
 */
function calculateAdjustments(
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

  // 1. Opponent Defense Adjustment
  if (opponentDefense) {
    if (type.includes('three') || type === '3pm' || type === 'threes') {
      // Compare opponent's allowed 3PM to league average
      const defenseRatio = opponentDefense.opp3PM / LEAGUE_AVG.opp3PM
      opponentDefenseAdj = defenseRatio
      if (defenseRatio > 1.05) {
        breakdown.push(`+${((defenseRatio - 1) * 100).toFixed(0)}% vs weak 3P defense (${opponentDefense.opp3PM.toFixed(1)} 3PM allowed)`)
      } else if (defenseRatio < 0.95) {
        breakdown.push(`${((defenseRatio - 1) * 100).toFixed(0)}% vs strong 3P defense (${opponentDefense.opp3PM.toFixed(1)} 3PM allowed)`)
      }
    } else if (type.includes('point') || type === 'pts') {
      const defenseRatio = opponentDefense.oppPTS / LEAGUE_AVG.oppPTS
      opponentDefenseAdj = defenseRatio
      if (Math.abs(defenseRatio - 1) > 0.03) {
        breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} defense`)
      }
    } else if (type.includes('rebound') || type === 'reb') {
      const defenseRatio = opponentDefense.oppREB / LEAGUE_AVG.oppREB
      opponentDefenseAdj = defenseRatio
      if (Math.abs(defenseRatio - 1) > 0.03) {
        breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'poor' : 'good'} rebounding team`)
      }
    } else if (type.includes('assist') || type === 'ast') {
      const defenseRatio = opponentDefense.oppAST / LEAGUE_AVG.oppAST
      opponentDefenseAdj = defenseRatio
      if (Math.abs(defenseRatio - 1) > 0.03) {
        breakdown.push(`${defenseRatio > 1 ? '+' : ''}${((defenseRatio - 1) * 100).toFixed(0)}% vs ${defenseRatio > 1 ? 'weak' : 'strong'} assist defense`)
      }
    }
  }

  // 2. Pace Adjustment
  if (opponentDefense && playerTeamPace) {
    // Expected game pace is average of both teams
    const expectedPace = (playerTeamPace + opponentDefense.pace) / 2
    const paceRatio = expectedPace / LEAGUE_AVG.pace
    // Pace has moderate effect on counting stats (~50% weight)
    paceAdj = 1 + (paceRatio - 1) * 0.5
    if (Math.abs(paceRatio - 1) > 0.02) {
      breakdown.push(`${paceRatio > 1 ? '+' : ''}${((paceAdj - 1) * 100).toFixed(0)}% pace factor (${expectedPace.toFixed(0)} expected)`)
    }
  }

  // 3. Home/Away Adjustment
  if (matchup) {
    if (matchup.isHome) {
      homeAwayAdj = 1.02 // ~2% boost at home
      breakdown.push('+2% home court')
    } else {
      homeAwayAdj = 0.98 // ~2% drop on road
      breakdown.push('-2% road game')
    }
  }

  // 4. Rest Adjustment
  if (matchup) {
    if (matchup.isBackToBack) {
      restAdj = 0.92 // ~8% drop on B2B
      breakdown.push('-8% back-to-back')
    } else if (matchup.restDays !== null && matchup.restDays >= 2) {
      restAdj = 1.03 // ~3% boost well rested
      breakdown.push('+3% well rested')
    }
  }

  // 5. Recent Form (placeholder - would need game logs)
  // For now, we'll leave this at 1.0 but the structure is in place
  // In a full implementation, we'd check last 5 games vs season average

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
  switch (type) {
    case 'threes':
    case '3pm':
    case 'three_pointers':
    case '3-pointers':
    case '3 pointers':
    case 'threepointers':
      return player.threes
    case 'points':
    case 'pts':
      return player.points
    case 'rebounds':
    case 'reb':
    case 'trb':
      return player.rebounds
    case 'assists':
    case 'ast':
      return player.assists
    case 'pra':
    case 'pts_reb_ast':
      return player.points + player.rebounds + player.assists
    default:
      return player.points
  }
}

function usePoissonDistribution(propType: string): boolean {
  const type = propType.toLowerCase()
  if (type.includes('three') || type === '3pm' || type === 'threes') return true
  if (type.includes('block') || type.includes('steal')) return true
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
 */
export async function getRankedPlayersByPropThreshold(
  propType: string,
  threshold: number,
  options: {
    todayOnly?: boolean
    minMinutes?: number
    limit?: number
  } = {}
): Promise<EnhancedPropResult[]> {
  const { todayOnly = true, minMinutes = 15, limit = 20 } = options

  console.log('[PROP RANKER] Starting analysis with adjustments:', { propType, threshold, todayOnly })

  const allPlayers = getAllPlayers()
  const matchups = todayOnly ? await getTodaysMatchups() : new Map()
  const teamDefenseStats = getTeamDefenseStats()

  // Get rest factors for all teams playing today
  const teamAbbrevs = Array.from(matchups.keys())
  const restFactors = await getRestFactorsForTeams(teamAbbrevs)

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
    if (player.mpg < minMinutes) continue

    // Filter by teams playing today
    if (todayOnly && matchups.size > 0 && !matchups.has(player.team)) {
      continue
    }

    const seasonAverage = getStatValue(player, propType)
    if (seasonAverage <= 0) continue

    const matchup = matchups.get(player.team) || null
    const opponentDefense = matchup?.defenseStats || null
    const playerTeamDefense = teamDefenseStats.get(player.team)
    const playerTeamPace = playerTeamDefense?.pace || null

    // Calculate adjustments
    const adjustments = calculateAdjustments(
      propType,
      player.team,
      matchup,
      opponentDefense,
      playerTeamPace
    )

    // Adjusted average
    const adjustedAverage = seasonAverage * adjustments.combined

    // Calculate probability with adjusted average
    const probability = usePoissonDistribution(propType)
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

  console.log('[PROP RANKER] Analysis complete:', { playersAnalyzed: results.length })

  return results.slice(0, limit)
}

/**
 * Format ranked results for chat output
 */
export function formatRankedPlayersForChat(
  results: EnhancedPropResult[],
  propType: string,
  threshold: number
): string {
  if (results.length === 0) {
    return `No players found for ${propType} ${threshold}+ analysis. This may occur if there are no NBA games scheduled today.`
  }

  const propLabel = propType.toLowerCase().includes('three') ? '3-pointers' : propType

  let output = `**Players Most Likely to Hit ${threshold}+ ${propLabel}**\n\n`
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
  output += `- Base probability from ${usePoissonDistribution(propType) ? 'Poisson' : 'normal'} distribution\n`
  output += `- Adjustments: opponent defense, pace, home/away, rest\n`
  output += `- Filtered to players with ${15}+ MPG on today's slate\n`

  return output
}
