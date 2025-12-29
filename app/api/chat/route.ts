import { NextRequest, NextResponse } from 'next/server'
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions'
import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
import type { OddsGame } from '@/lib/types/odds'
import {
  getTeamStats,
  getInjuryReports,
  getNBAAdvancedTeamStats,
  getNFLAdvancedTeamStats,
  formatStatsForAI,
  getPlayerSeasonStats,
  searchPlayer,
} from '@/lib/sports-stats-api'
import type { TeamStats as ProviderTeamStats } from '@/lib/sports-stats-api'
import { fetchAllLiveScores, fetchGameDetails, type LeagueId, type LiveScoreGameDetails } from '@/lib/live-scores'
import { fetchESPNScores, fetchESPNScoresForDate } from '@/lib/espn-api'
import { fetchEventsIO } from '@/lib/api/odds-api'
import { listCustomModels, saveCustomModel, touchCustomModelUsage, CustomModelRow } from '@/lib/models/custom-models'
import { CustomModelStatInput } from '@/lib/models/custom-model-types'
import { runCustomModel, runCustomModelAcrossSlate } from '@/lib/models/model-runner'
import type { UserDataOverride } from '@/lib/models/model-runner'
import { buildGameContext } from '@/lib/context/game-context'
import { normalizePropMarketKey, normalizePropSelection, extractPropLine } from '@/lib/utils/props'
import { calculateKellyStake } from '@/lib/utils/kelly'
import {
  summarizeCoversGameSplitsForChat,
  summarizeCoversSplitsForChat,
  getTeamATSData,
} from '@/lib/providers/covers'
import { getGameRecommendations } from '@/lib/services/recommendation-engine'
import { getTeamQuarterAverages, getTeamQuarterThreshold } from '@/lib/services/quarter-analytics'
import {
  buildPickGuidanceResponse,
  buildAnalysisResponse,
  evaluateLineEdge,
  evaluatePropEdge,
  formatPercent,
  inferMarketType,
  inferQuarter,
  type EdgeAssessment,
  type MarketType,
} from '@/lib/analysis/bet-tools'
import { format } from 'date-fns'
import { openai, AI_MODELS, runWebSearchResponse } from '@/lib/ai-gateway-client'
import { espnTools } from '@/lib/llm/tools/espn-tools'
import { toolResolvers as espnToolResolvers } from '@/lib/llm/tools/resolvers'
import { resolveEspnTeamId } from '@/lib/utils/espn-team-lookup'
import { searchAthlete, getEventSnapshot, getPlayerGameLogs, getRoster } from '@/lib/services/espn-orchestrator'
import { getStaticNbaTeams, findStaticNbaTeam, getFullTeamName } from '@/lib/nba-static-team-stats'
import { findEVOpportunities, formatEVResults } from '@/lib/services/cross-market-ev'
import { nbaTeamPerGame2025_2026Csv } from '@/data/nba_team_per_game_2025_2026'
import { nbaPlayerPerGame2025_2026Csv } from '@/data/nba_player_per_game_2025_2026'
import { getPlayerStats as getStaticPlayerStats } from '@/lib/services/matchup-analyzer'
import {
  resolvePlayerThresholdQuery,
  resolveLeaderboardThresholdQuery,
  resolveAtsLeaderboard,
  resolvePlayerOpponentAggregate,
  resolvePlayerRestSplit,
  resolveTeamAfterLossSplit,
  resolveTeamHomeAwayDefense,
  computeTeamLineSplits,
  formatTeamLineSplits,
} from '@/lib/services/espn-aggregations'
import { processQuery as processUnifiedQuery } from '@/lib/statmuse/intent-classifier'
import { unifiedTools } from '@/lib/statmuse/tools'
import { getMembershipStatus } from '@/lib/utils/membership'
import { countUserMessagesToday, PRO_DAILY_MESSAGE_LIMIT } from '@/lib/utils/message-count'
export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes (max for Pro plan)

const formatLeagueLabel = (sportKey: string): string => {
  const map: Record<string, string> = {
    basketball_nba: 'NBA',
    basketball_ncaab: 'NCAAB',
    americanfootball_nfl: 'NFL',
    americanfootball_ncaaf: 'NCAAF',
    baseball_mlb: 'MLB',
    icehockey_nhl: 'NHL',
  }
  return map[sportKey] || sportKey.toUpperCase()
}

const buildDataSourceLine = (sources: string[]) => `Data sources: ${sources.join(', ')}`

const mapSportToPropKey = (sport?: string): string => {
  const value = (sport || '').toLowerCase()
  if (value.includes('nfl') || value === 'football') return 'americanfootball_nfl'
  if (value.includes('mlb') || value.includes('baseball')) return 'baseball_mlb'
  if (value.includes('nhl') || value.includes('hockey')) return 'icehockey_nhl'
  return 'basketball_nba'
}

const normalizeToken = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const formatAtsRecord = (resp: any) => {
  if (!resp?.items?.length) return 'No ATS data available.'
  const labelMap: Record<string, string> = {
    atsOverall: 'Overall',
    atsFavorite: 'As Favorite',
    atsUnderdog: 'As Underdog',
    atsHome: 'Home',
    atsRoad: 'Road',
    atsLast10: 'Last 10',
    atsAfterWin: 'After Win',
    atsAfterLoss: 'After Loss',
  }
  return resp.items
    .map((item: any) => {
      const label = labelMap[item?.type?.name] || item?.type?.description || 'ATS'
      const wins = item?.wins ?? 0
      const losses = item?.losses ?? 0
      const pushes = item?.pushes ?? 0
      const rec = pushes ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`
      return `${label}: ${rec}`
    })
    .join('\n')
}

const detectIntent = (msgLower: string) => {
  const hasNumber = /\d/.test(msgLower)
  return {
    ats: /\bats\b|against the spread|cover\b/.test(msgLower),
    overUnder:
      ((/\bover\b/.test(msgLower) || /\bunder\b/.test(msgLower)) && hasNumber) ||
      /\bo\/u\s*\d+(\.\d+)?\b/.test(msgLower) ||
      /\bover\/under\s+\d+(\.\d+)?\b/.test(msgLower),
    oddsRecord: /\b(odds record|as favorite|as underdog|fav(?:orite)? record|dog record)\b/.test(msgLower),
    pastPerformances: /\bpast performances?\b|\bvs\.?\s+spread history\b/.test(msgLower),
    predictor: /\bpredictor|power index|fpi|bpi|win probability\b/.test(msgLower),
    futures: /\bfutures?\b|outright|to win (it|title|championship|division|conference)\b/.test(msgLower),
    injuries: /\binjury|injuries|questionable|doubtful|out\b/.test(msgLower),
    playerGameLine:
      /\b(stat line|box score|game stats?|how many|line vs|vs\b.*?\d{1,2}|@|against)\b/.test(msgLower) &&
      /\b(points|rebounds|assists|steals|blocks|yards|tds|passes|catches|receptions|shots|goals|pim|saves)?\b/.test(msgLower),
    playerSeasonVsOpponent: /\b(this season|season)\b.*\b(vs|against)\b/.test(msgLower),
  }
}

const inferFuturesMarketHint = (msgLower: string): string | undefined => {
  if (/\bmvp\b|most valuable player/.test(msgLower)) return 'most valuable player'
  if (/rookie of the year|\broty\b|\brookie\b/.test(msgLower)) return 'rookie of the year'
  if (/coach of the year|\bcoty\b|coach/.test(msgLower)) return 'coach of the year'
  if (/defensive player of the year|defensive player|dpoy/.test(msgLower)) return 'defensive player'
  if (/sixth man|6th man/.test(msgLower)) return 'sixth man'
  if (/most improved/.test(msgLower)) return 'most improved'
  if (/finals mvp|finals most valuable/.test(msgLower)) return 'finals mvp'
  if (/play-?in/.test(msgLower)) return 'play-in'
  if (/make (the )?playoffs|to make the playoffs|make playoffs/.test(msgLower)) return 'make the playoffs'
  if (/seed/.test(msgLower)) return 'seed'
  if (/division/.test(msgLower)) return 'division'
  if (/conference/.test(msgLower)) return 'conference'
  if (/championship|title|win (it|the league)|outright/.test(msgLower)) return 'championship'
  return undefined
}

// ESPN uses the STARTING year of the season (e.g., 2025 for 2025-26 season)
const getSeasonYearForSport = (sport: string) => {
  const now = new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth() // 0-based
  if (sport === 'nba') {
    // NBA season starts in October, so Oct-Dec uses current year, Jan-Sep uses previous year
    return month >= 9 ? year : year - 1
  }
  if (sport === 'nhl') {
    // NHL like NBA, starts in October
    return month >= 9 ? year : year - 1
  }
  if (sport === 'nfl') {
    // NFL season starts in September
    return month >= 8 ? year : year - 1
  }
  return year // mlb and default
}

const getSeasonYearForDate = (sport: string, isoDate: string | undefined) => {  
  if (!isoDate) return getSeasonYearForSport(sport)
  const dt = new Date(`${isoDate}T00:00:00Z`)
  const year = dt.getUTCFullYear()
  const month = dt.getUTCMonth()
  // ESPN uses STARTING year of season
  if (sport === 'nba') return month >= 9 ? year : year - 1
  if (sport === 'nhl') return month >= 9 ? year : year - 1
  if (sport === 'nfl') return month >= 8 ? year : year - 1
  return year
}

// ESPN gamelogs use the ENDING season year for NBA/NHL (e.g., 2026 for 2025-26)
const getEspnSeasonYearForLogs = (sport: string, isoDate?: string) => {
  const key = sport.toLowerCase()
  const dt = isoDate ? new Date(`${isoDate}T00:00:00Z`) : new Date()
  const year = dt.getUTCFullYear()
  const month = dt.getUTCMonth()
  if (key.includes('nba') || key.includes('nhl')) {
    const startYear = month >= 8 ? year : year - 1
    return startYear + 1
  }
  if (key.includes('nfl')) {
    return month >= 6 ? year : year - 1
  }
  return year
}

const seasonTypeFromText = (msgLower: string) => {
  if (/\bplayoffs?\b|\bpostseason\b/.test(msgLower)) return 3
  if (/\bpreseason\b|\bpre-season\b/.test(msgLower)) return 1
  return 2
}

const formatGameLogEntry = (entry: any) => {
  const date = entry?.date || entry?.gameDate || entry?.game_date || ''
  const opponent =
    entry?.opponent?.displayName ||
    entry?.opponent?.name ||
    entry?.opponent ||
    entry?.opponentName ||
    entry?.gameOpponent ||
    ''
  const result = entry?.result || entry?.gameResult || entry?.outcome || ''
  const statBlocks: any[] = Array.isArray(entry?.stats) ? entry.stats : Array.isArray(entry?.statistics) ? entry.statistics : []
  const stats: Record<string, number | string> = {}
  for (const block of statBlocks) {
    const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
    for (const s of entries) {
      const label = s?.label || s?.displayName || s?.name
      const value = typeof s?.value === 'number' ? s.value : Number(s?.value)
      if (!label) continue
      const key = label.toString().toUpperCase().replace(/\s+/g, '_')
      stats[key] = Number.isFinite(value) ? value : s?.value ?? s?.displayValue ?? s?.display_value ?? s
    }
  }
  const statLines = Object.entries(stats).map(([k, v]) => `  +óGé¼-ó ${k}: ${v}`)
  const header = `${date}${opponent ? ` vs ${opponent}` : ''}${result ? ` (${result})` : ''}`
  return statLines.length ? `${header}\n${statLines.join('\n')}` : header
}

const filterGameLogs = (logs: any[], opts: { date?: string; opponent?: string; lastN?: number }) => {
  let filtered = logs || []
  if (opts.date) {
    const target = opts.date.slice(0, 10)
    filtered = filtered.filter((g) => {
      const d = String(g?.date || g?.gameDate || g?.game_date || '').slice(0, 10)
      return d === target
    })
  }
  if (opts.opponent) {
    const opp = normalizeToken(opts.opponent.replace(/\bon\b$/i, '').trim())
    filtered = filtered.filter((g) => {
      const oppName =
        g?.opponent?.displayName ||
        g?.opponent?.name ||
        g?.opponent ||
        g?.opponentName ||
        g?.gameOpponent ||
        ''
      const tokens = [normalizeToken(oppName)]
      return tokens.some((t) => t && (t.includes(opp) || opp.includes(t)))
    })
  }
  if (opts.lastN && opts.lastN > 0) {
    filtered = filtered.slice(0, opts.lastN)
  }
  return filtered
}

const normalizeNameLoose = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const findPlayerInGameDetails = (details: any, playerName: string) => {
  const players = details?.teams
    ? details.teams.flatMap((t: any) => [...(t.starters || []), ...(t.bench || []), ...(t as any).players || []])
    : []
  const normTarget = normalizeNameLoose(playerName)
  return players.find((p: any) => {
    const name = normalizeNameLoose(p?.name || '')
    return name && (name === normTarget || name.includes(normTarget) || normTarget.includes(name))
  })
}

const buildStatMapFromEspnEntry = (entry: any): Record<string, number> => {
  const statBlocks: any[] = Array.isArray(entry?.stats)
    ? entry.stats
    : Array.isArray(entry?.statistics)
    ? entry.statistics
    : []
  const statMap: Record<string, number> = {}
  for (const block of statBlocks) {
    const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
    for (const s of entries) {
      const label = s?.label || s?.displayName || s?.name
      const rawVal = s?.value ?? s?.displayValue ?? s?.display_value
      let val =
        typeof rawVal === 'number'
          ? rawVal
          : typeof rawVal === 'string'
          ? Number(rawVal)
          : Number(rawVal)
      if (typeof rawVal === 'string' && Number.isNaN(val) && rawVal.includes('-')) {
        val = Number(rawVal.split('-')[0])
      }
      if (label && Number.isFinite(val)) {
        statMap[label.toString().toUpperCase().replace(/\s+/g, '_')] = val
      }
    }
  }
  return statMap
}

const extractStatMapFromSnapshot = (
  snapshot: any,
  playerId: string,
  playerName: string
): Record<string, number> | null => {
  const targetToken = normalizeToken(playerName)
  const players = snapshot?.boxscore?.players || []
  for (const team of players) {
    for (const group of team?.statistics || []) {
      const labels = Array.isArray(group?.labels)
        ? group.labels
        : Array.isArray(group?.displayLabels)
        ? group.displayLabels
        : Array.isArray(group?.names)
        ? group.names
        : null
      for (const athlete of group?.athletes || []) {
        const athleteId = String(athlete?.id || athlete?.athlete?.id || '')
        const athleteName =
          athlete?.athlete?.displayName ||
          athlete?.athlete?.fullName ||
          athlete?.displayName ||
          athlete?.name ||
          ''
        const nameToken = normalizeToken(athleteName)
        if (
          (playerId && athleteId === String(playerId)) ||
          (nameToken && (nameToken.includes(targetToken) || targetToken.includes(nameToken)))
        ) {
          const statMap: Record<string, number> = {}
          if (labels && Array.isArray(athlete?.stats)) {
            for (let i = 0; i < labels.length; i++) {
              const rawVal = athlete.stats[i]
              let val =
                typeof rawVal === 'number'
                  ? rawVal
                  : typeof rawVal === 'string'
                  ? Number(rawVal)
                  : Number(rawVal)
              if (typeof rawVal === 'string' && Number.isNaN(val) && rawVal.includes('-')) {
                val = Number(rawVal.split('-')[0])
              }
              const label = labels[i]
              if (label && Number.isFinite(val)) {
                statMap[label.toString().toUpperCase().replace(/\s+/g, '_')] = val
              }
            }
          } else if (Array.isArray(athlete?.stats)) {
            for (const stat of athlete.stats) {
              const label = stat?.label || stat?.displayName || stat?.name
              const rawVal = stat?.value ?? stat?.displayValue ?? stat?.display_value
              let val =
                typeof rawVal === 'number'
                  ? rawVal
                  : typeof rawVal === 'string'
                  ? Number(rawVal)
                  : Number(rawVal)
              if (typeof rawVal === 'string' && Number.isNaN(val) && rawVal.includes('-')) {
                val = Number(rawVal.split('-')[0])
              }
              if (label && Number.isFinite(val)) {
                statMap[label.toString().toUpperCase().replace(/\s+/g, '_')] = val
              }
            }
          }
          return Object.keys(statMap).length ? statMap : null
        }
      }
    }
  }
  return null
}

const getPropStatFromMap = (statMap: Record<string, number>, propType: string): number | null => {
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const val = statMap[key]
      if (typeof val === 'number' && Number.isFinite(val)) return val
    }
    return null
  }
  // ESPN uses various labels across game logs and season stats
  const pts = pick(['PTS', 'POINTS', 'PPG'])
  const reb = pick(['REB', 'REBOUNDS', 'TRB', 'RPG', 'TOTAL_REBOUNDS'])
  const ast = pick(['AST', 'ASSISTS', 'APG'])
  const threes = pick(['3PM', '3PT', '3P', '3PTM', 'THREE_PM', 'THREE_POINTERS_MADE', 'FG3M', '3FGM'])
  const blk = pick(['BLK', 'BLOCKS', 'BPG'])
  const stl = pick(['STL', 'STEALS', 'SPG'])

  switch (propType) {
    case 'points':
    default:
      return pts
    case 'rebounds':
      return reb
    case 'assists':
      return ast
    case 'threes':
      return threes
    case 'blocks':
      return blk
    case 'steals':
      return stl
    case 'points_rebounds':
      return pts != null && reb != null ? pts + reb : null
    case 'points_assists':
      return pts != null && ast != null ? pts + ast : null
    case 'rebounds_assists':
      return reb != null && ast != null ? reb + ast : null
    case 'pra':
      return pts != null && reb != null && ast != null ? pts + reb + ast : null
    case 'blocks_steals':
      return blk != null && stl != null ? blk + stl : null
  }
}

const computeSimpleAdvanced = (stats: Record<string, any>) => {
  const num = (v: any) => {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  const pts = num(stats.PTS ?? stats.pointsPerGame ?? stats.points)
  const fga = num(stats.FGA ?? stats.fieldGoalAttemptsPerGame ?? stats.fieldGoalAttempts)
  const fgm = num(stats.FGM ?? stats.fieldGoalsPerGame ?? stats.fieldGoalsMade)
  const fta = num(stats.FTA ?? stats.freeThrowAttemptsPerGame ?? stats.freeThrowAttempts)
  const tpm = num(stats['3PM'] ?? stats.threePointFieldGoalsPerGame ?? stats.threes ?? stats['3PT'])
  const tov = num(stats.TOV ?? stats.turnoversPerGame ?? stats.turnovers)

  const tsPct =
    pts != null && fga != null && fta != null && fga + 0.44 * fta > 0 ? pts / (2 * (fga + 0.44 * fta)) : null
  const efgPct = fgm != null && fga != null && fga > 0 ? (fgm + 0.5 * (tpm ?? 0)) / fga : null
  const tovPct =
    fga != null && fta != null && tov != null && fga + 0.44 * fta + tov > 0 ? tov / (fga + 0.44 * fta + tov) : null

  return { tsPct, efgPct, tovPct }
}

const parseDateFromMessage = (input: string): string => {
  const lower = input.toLowerCase()
  const today = new Date()
  const toYmd = (d: Date) => d.toISOString().slice(0, 10)

  if (/\blast\s+night\b/.test(lower)) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
    return toYmd(d)
  }
  if (/\blast\b/.test(lower) && /\b(game|match)\b/.test(lower)) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 1))
    return toYmd(d)
  }
  const m = input.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/)
  if (m) {
    const month = Number(m[1])
    const day = Number(m[2])
    const yearRaw = m[3] ? Number(m[3]) : today.getFullYear()
    const year = yearRaw < 100 ? 2000 + yearRaw : yearRaw
    const date = new Date(Date.UTC(year, month - 1, day))
    if (!Number.isNaN(date.getTime())) {
      const todayMid = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
      if (date.getTime() - todayMid.getTime() > 24 * 60 * 60 * 1000) {
        const prior = new Date(Date.UTC(year - 1, month - 1, day))
        return toYmd(prior)
      }
      return toYmd(date)
    }
  }
  return toYmd(today)
}

const formatPlayerGameLine = (player: any): string => {
  if (!player?.statMap) return player?.summaryLine || ''
  const stats = player.statMap as Record<string, string>
  const lines: string[] = []
  const pick = (keys: string[]) => {
    for (const key of keys) {
      const val = stats[key] ?? stats[key.toUpperCase()] ?? stats[key.toLowerCase()]
      if (val != null && val !== '') return val
    }
    return undefined
  }

  const entries: Array<[string, string[]]> = [
    ['PTS', ['PTS']],
    ['REB', ['REB', 'REBS']],
    ['AST', ['AST', 'ASSISTS']],
    ['STL', ['STL']],
    ['BLK', ['BLK']],
    ['FG', ['FGM/FGA', 'FG']],
    ['3PT', ['3PM/3PA', '3PT']],
    ['MIN', ['MIN']],
  ]

  for (const [label, keys] of entries) {
    const val = pick(keys)
    if (val != null) lines.push(`  +óGé¼-ó ${label}: ${val}`)
  }

  if (!lines.length && player.summaryLine) return player.summaryLine
  if (!lines.length) return ''
  return `\n${lines.join('\n')}`
}

const findPlayerGameStats = async (opts: {
  player: string
  opponent?: string
  opponentCandidates?: string[]
  date?: string
}): Promise<{ title: string; line?: string; reason?: string } | null> => {
  const parsedDate =
    opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : parseDateFromMessage(opts.date || '')
  const playerEntry = await searchPlayer(opts.player, 'basketball_nba')
  if (!playerEntry) return { title: `${opts.player} on ${parsedDate}`, line: undefined, reason: 'player_not_found_global' }
  const playerTeam = normalizeToken(playerEntry?.team) || normalizeToken(opts.player.split(' ').slice(-1)[0]) // allow last name fallback
  const inferredOpponent =
    opts.opponent ||
    (opts.opponentCandidates || []).find((team) => {
      const norm = normalizeToken(team)
      return norm && !playerTeam.includes(norm) && !norm.includes(playerTeam)
    })
  const opponentToken = normalizeToken(inferredOpponent)

  const loadScores = async (d: string) => {
    const scores = await fetchAllLiveScores({ date: d, includeCompletedForDate: true })
    return (scores?.games || []).filter((g) => g.league === 'nba')
  }

  const seenDates = new Set<string>()
  const shiftDateStr = (ymd: string, delta: number) => {
    const dt = new Date(`${ymd}T00:00:00Z`)
    const shifted = new Date(dt.getTime() + delta * 24 * 60 * 60 * 1000)
    return shifted.toISOString().slice(0, 10)
  }
  const dateCandidates = [
    parsedDate,
    shiftDateStr(parsedDate, -1),
    shiftDateStr(parsedDate, 1),
    shiftDateStr(parsedDate, -2),
    shiftDateStr(parsedDate, 2),
  ]
  const parsedDt = new Date(`${parsedDate}T00:00:00Z`)
  const priorYear = new Date(Date.UTC(parsedDt.getUTCFullYear() - 1, parsedDt.getUTCMonth(), parsedDt.getUTCDate()))
  dateCandidates.push(priorYear.toISOString().slice(0, 10))

  let games: any[] = []
  let usedDate = parsedDate
  let triedPriorYear = false

  let targetGame: any | undefined

  for (const dateCandidate of dateCandidates) {
    if (seenDates.has(dateCandidate)) continue
    seenDates.add(dateCandidate)
    const slate = await loadScores(dateCandidate)
    games = slate
    if (priorYear.toISOString().slice(0, 10) === dateCandidate) triedPriorYear = true

    const matchGame =
      games.find((g) => {
        const teams = (g.competitors || []).map((c: any) => normalizeToken(c?.name) || normalizeToken(c?.shortName) || normalizeToken(c?.abbreviation))
        const hasPlayerTeam = playerTeam ? teams.some((t: string) => t.includes(playerTeam) || playerTeam.includes(t)) : false
        const hasOpponent = opponentToken ? teams.some((t: string) => t.includes(opponentToken) || opponentToken.includes(t)) : true
        return hasPlayerTeam && hasOpponent
      }) ||
      games.find((g) => {
        const teams = (g.competitors || []).map((c: any) => normalizeToken(c?.name) || normalizeToken(c?.shortName) || normalizeToken(c?.abbreviation))
        return playerTeam ? teams.some((t: string) => t.includes(playerTeam) || playerTeam.includes(t)) : false
      })

    if (!matchGame && games.length) {
      for (const g of games.slice(0, 8)) {
        try {
          const details = await fetchGameDetails('nba', g.eventId)
          const players = details.teams.flatMap((t) => [...(t.starters || []), ...(t.bench || []), ...(t as any).players || []])
          const found = players.find((p) => normalizeToken(p.name).includes(normalizeToken(opts.player)))
          if (found) {
            targetGame = g
            usedDate = dateCandidate
            break
          }
        } catch {
          continue
        }
      }
    }

    if (matchGame) {
      targetGame = matchGame
      usedDate = dateCandidate
      break
    }
    if (targetGame) break
  }

  // Fallback: scan a few games on that date for the player name in box score
  if (!targetGame && games.length) {
    for (const g of games.slice(0, 6)) {
      try {
        const details = await fetchGameDetails('nba', g.eventId)
        const players = details.teams.flatMap((t) => [...(t.starters || []), ...(t.bench || [])])
        const found = players.find((p) => normalizeToken(p.name).includes(normalizeToken(opts.player)))
        if (found) {
          targetGame = g
          break
        }
      } catch {
        // ignore and continue
      }
    }
  }

  if (!targetGame) {
    return {
      title: `${opts.player} on ${parsedDate}`,
      line: undefined,
      reason: triedPriorYear ? 'no_game_prior' : 'no_game',
    }
  }

  let details
  try {
    details = await fetchGameDetails('nba', targetGame.eventId)
  } catch (err) {
    return { title: `${opts.player} on ${parsedDate}`, line: undefined, reason: 'no_boxscore' }
  }
  const players = details.teams.flatMap((t) => [...(t.starters || []), ...(t.bench || []), ...(t as any).players || []])
  const normalizedPlayer = normalizeToken(opts.player)
  const lastName = normalizeToken(opts.player.split(' ').slice(-1)[0] || '')
  const target =
    players.find((p) => normalizeToken(p.name).includes(normalizedPlayer)) ||
    (lastName ? players.find((p) => normalizeToken(p.name).includes(lastName)) : undefined)

  const title = `${opts.player} vs ${inferredOpponent || 'opponent'} on ${usedDate}`
  if (!target) {
    return { title, line: undefined, reason: 'player_not_found' }
  }

  return {
    title,
    line: formatPlayerGameLine(target),
  }
}

// Log model configuration on startup
console.log(`[CHAT] Using OpenAI API`)
console.log(`[CHAT] Chat Model: ${AI_MODELS.chat}`)
console.log(`[CHAT] Title Model: ${AI_MODELS.titleGen}`)

function resolveBaseUrl(req: NextRequest) {
  const origin = req?.nextUrl?.origin
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined)

  if (origin) return origin
  if (envUrl) return envUrl

  const fallback = 'http://localhost:3000'
  console.warn('[CHAT] Falling back to default base URL; set NEXT_PUBLIC_APP_URL for accuracy')
  return fallback
}

// Helper function to create daily snapshot
async function createDailySnapshot(supabase: any, userId: string, balance: number) {
  const today = format(new Date(), 'yyyy-MM-dd')
  await supabase
    .from('bankroll_snapshots')
    .upsert(
      {
        user_id: userId,
        balance: balance,
        snapshot_date: today,
      },
      {
        onConflict: 'user_id,snapshot_date',
      }
    )
}

// Helper function to auto-generate conversation title
async function generateConversationTitle(firstUserMessage: string): Promise<string> {
  const cleaned = (firstUserMessage || '').replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New Chat'
  const maxLen = 50
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen).trimEnd()}+óGé¼-ª` : cleaned
}

// Helper function to log a bet
async function logBet(supabase: any, userId: string, data: any, conversationId: string) {
  const {
    sport,
    league,
    game_description,
    bet_type,
    bet_side,
    odds,
    stake,
    book,
    notes,
    player_name,
    prop_market,
    prop_line,
    prop_selection,
    prop_team,
  } = data

  const normalizedPropMarket = normalizePropMarketKey(prop_market)
  const normalizedPropSelection = normalizePropSelection(prop_selection || bet_side)
  const normalizedPropLine =
    prop_line != null && prop_line !== ''
      ? parseFloat(prop_line)
      : extractPropLine(bet_side)

  // Calculate potential win based on American odds
  let potentialWin = 0
  if (odds > 0) {
    potentialWin = (stake * odds) / 100
  } else {
    potentialWin = (stake * 100) / Math.abs(odds)
  }

  // Insert bet
  const { data: bet, error } = await supabase
    .from('bets')
    .insert({
      user_id: userId,
      conversation_id: conversationId,
      sport,
      league,
      game_description,
      bet_type,
      bet_side,
      odds: parseInt(odds),
      stake: parseFloat(stake),
      potential_win: potentialWin,
      book,
      notes: notes || null,
      status: 'pending',
      is_prop: Boolean(normalizedPropMarket && player_name),
      player_name: player_name || null,
      prop_market: normalizedPropMarket,
      prop_line: normalizedPropLine != null ? normalizedPropLine : null,
      prop_selection: normalizedPropSelection,
      prop_team: prop_team || null,
    })
    .select()
    .single()

  if (error) {
    return { success: false, error: 'Failed to log bet', details: error.message }
  }

  return {
    success: true,
    bet,
    message: `Bet logged: $${stake} on ${game_description}`,
  }
}

// Helper function to log multiple bets at once
async function logMultipleBets(supabase: any, userId: string, bets: any[], conversationId: string) {
  const results = []
  let totalStake = 0

  // Calculate total stake
  for (const betData of bets) {
    totalStake += parseFloat(betData.stake)
  }

  // Process each bet
  for (const betData of bets) {
    const {
      sport,
      league,
      game_description,
      bet_type,
      bet_side,
      odds,
      stake,
      book,
      notes,
      player_name,
      prop_market,
      prop_line,
      prop_selection,
      prop_team,
    } = betData

    const normalizedPropMarket = normalizePropMarketKey(prop_market)
    const normalizedPropSelection = normalizePropSelection(prop_selection || bet_side)
    const normalizedPropLine =
      prop_line != null && prop_line !== ''
        ? parseFloat(prop_line)
        : extractPropLine(bet_side)

    // Calculate potential win based on American odds
    let potentialWin = 0
    if (odds > 0) {
      potentialWin = (stake * odds) / 100
    } else {
      potentialWin = (stake * 100) / Math.abs(odds)
    }

    // Insert bet
    const { data: bet, error } = await supabase
      .from('bets')
      .insert({
        user_id: userId,
        conversation_id: conversationId,
        sport,
        league,
        game_description,
        bet_type,
        bet_side,
        odds: parseInt(odds),
        stake: parseFloat(stake),
        potential_win: potentialWin,
        book,
        notes: notes || null,
        status: 'pending',
        is_prop: Boolean(normalizedPropMarket && player_name),
        player_name: player_name || null,
        prop_market: normalizedPropMarket,
        prop_line: normalizedPropLine != null ? normalizedPropLine : null,
        prop_selection: normalizedPropSelection,
        prop_team: prop_team || null,
      })
      .select()
      .single()

    if (error) {
      return {
        success: false,
        error: `Failed to log bet for ${game_description}`,
        details: error.message,
      }
    }

    results.push({
      bet,
      description: `$${stake} on ${game_description}`,
    })
  }

  return {
    success: true,
    bets: results,
    totalStake,
    count: results.length,
    message: `Successfully logged ${results.length} bet(s) totaling $${totalStake.toFixed(2)}`,
  }
}

// Helper function to settle a bet
async function settleBet(supabase: any, userId: string, betId: string, result: string) {
  // Get the bet
  const { data: bet } = await supabase
    .from('bets')
    .select('*')
    .eq('id', betId)
    .eq('user_id', userId)
    .single()

  if (!bet) {
    return { success: false, error: 'Bet not found' }
  }

  if (bet.status !== 'pending') {
    return { success: false, error: 'Bet already settled' }
  }

  let actualResult = 0

  if (result === 'won') {
    // Store NET profit (potential_win only, not stake + potential_win)
    actualResult = parseFloat(bet.potential_win)
  } else if (result === 'push') {
    // Push = no profit or loss
    actualResult = 0
  } else if (result === 'lost') {
    // Store loss as negative value
    actualResult = -parseFloat(bet.stake)
  }

  // Update bet
  await supabase
    .from('bets')
    .update({
      status: result,
      actual_result: actualResult,
      settled_at: new Date().toISOString(),
    })
    .eq('id', betId)

  return {
    success: true,
    result: actualResult,
    message: `Bet settled as ${result}: ${actualResult >= 0 ? '+' : ''}$${actualResult.toFixed(2)}`,
  }
}

// Helper function to adjust bankroll
async function adjustBankroll(supabase: any, userId: string, amount: number, type: string) {
  const { data: userData } = await supabase
    .from('users')
    .select('current_bankroll')
    .eq('id', userId)
    .single()

  let newBankroll = parseFloat(userData.current_bankroll)

  if (type === 'deposit') {
    newBankroll += parseFloat(amount.toString())
  } else if (type === 'withdrawal') {
    newBankroll -= parseFloat(amount.toString())
  }

  await supabase
    .from('users')
    .update({ current_bankroll: newBankroll })
    .eq('id', userId)

  // Create daily snapshot
  await createDailySnapshot(supabase, userId, newBankroll)

  return {
    success: true,
    newBankroll,
    message: `${type === 'deposit' ? 'Deposited' : 'Withdrew'} $${amount}`,
  }
}

function normalizeStatArg(stat: any): CustomModelStatInput {
  if (!stat) {
    throw new Error('Invalid stat configuration provided')
  }

  const statKey = stat.stat_key || stat.statKey
  const label = stat.label
  const scope = stat.scope || 'team'
  const importance = stat.importance ?? stat.weight ?? 3
  const direction = stat.direction || 'higher_better'

  if (!statKey || !label) {
    throw new Error('Each stat requires stat_key and label fields')
  }

  return {
    statKey,
    label,
    scope,
    importance,
    direction,
    normalization: stat.normalization || 'zscore',
    sampleSource: stat.sample_source || stat.sampleSource,
    varianceOverride: stat.variance_override ?? stat.varianceOverride,
    minValue: stat.min_value ?? stat.minValue,
    maxValue: stat.max_value ?? stat.maxValue,
    notes: stat.notes,
  }
}

function buildStatInputs(rawStats: any): CustomModelStatInput[] {
  if (!Array.isArray(rawStats) || rawStats.length === 0) {
    throw new Error('At least one stat definition is required to create a model')
  }

  return rawStats.map(normalizeStatArg)
}

const extractText = (val: any): string => {
  if (!val) return ''
  if (val.output_text) return String(val.output_text)
  if (typeof val === 'string') return val
  if (Array.isArray(val)) {
    return val
      .map((entry) => {
        if (typeof entry === 'string') return entry
        if (entry?.text) return entry.text
        if (entry?.content) return entry.content
        return ''
      })
      .join('')
  }
  if (typeof val === 'object' && val.text) return String(val.text)
  return ''
}

// Odds formatting context for GPT-5 fallbacks
let formattedOddsGlobal: any[] = []
let standardizedOddsTablesGlobal: string | null = null
let ncaabSlateCache:
  | {
      date: string
      teams: Set<string>
      timestamp: number
    }
  | null = null

const normalizeTeamKey = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')

const SPORT_TO_LEAGUE: Record<string, LeagueId | undefined> = {
  basketball_nba: 'nba',
  basketball_ncaab: 'ncaab',
  americanfootball_nfl: 'nfl',
  americanfootball_ncaaf: 'cfb',
  icehockey_nhl: 'nhl',
}

const buildTeamInsightsFromDetails = (details: LiveScoreGameDetails, sportKey?: string) => {
  if (!details?.teams?.length) return null
  const rows: string[] = []

  // Determine sport from sportKey or league
  let sport = sportKey || 'basketball_nba'
  if (!sportKey && details.league) {
    const leagueToSport: Record<string, string> = {
      'nba': 'basketball_nba',
      'ncaab': 'basketball_ncaab',
      'nfl': 'americanfootball_nfl',
      'cfb': 'americanfootball_ncaaf',
      'nhl': 'icehockey_nhl',
    }
    sport = leagueToSport[details.league] || 'basketball_nba'
  }

  const isBasketball = sport === 'basketball_nba' || sport === 'basketball_ncaab'
  const isFootball = sport === 'americanfootball_nfl' || sport === 'americanfootball_ncaaf'
  const isHockey = sport === 'icehockey_nhl'

  let headers: string[]
  if (isBasketball) {
    headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'FG%', '3P%', 'REB', 'AST', 'BLK', 'STL']
  } else if (isFootball) {
    headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'Off Yds', 'Def Yds', 'Pass Yds', 'Rush Yds', 'TO', 'Sacks']
  } else if (isHockey) {
    headers = ['Team', 'Streak', 'Last 10', 'GPG', 'GAPG', 'Shots', 'SA', 'PP%', 'PK%', 'FOW%', 'Hits']
  } else {
    headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'FG%', '3P%', 'REB', 'AST', 'BLK', 'STL']
  }
  const pickVariant = (statMap: Record<string, string>, keys: string[]) => {
    for (const key of keys) {
      const direct = statMap[key.toLowerCase()]
      if (direct) return direct
    }
    // fuzzy contains
    const lowerKeys = Object.keys(statMap)
    for (const target of keys) {
      const normalized = target.toLowerCase()
      const matchKey = lowerKeys.find((k) => k.includes(normalized))
      if (matchKey && statMap[matchKey]) return statMap[matchKey]
    }
    return 'n/a'
  }
  details.teams.forEach((team) => {
    const statMap: Record<string, string> = {}
    ;(team.statistics || []).forEach((entry) => {
      if (!entry?.label || entry?.value == null) return
      statMap[entry.label.toLowerCase()] = String(entry.value)
    })
    const pick = (key: string) => statMap[key.toLowerCase()] || 'n/a'
    const last10 = pickVariant(statMap, ['last 10 games', 'last 10', 'last ten', 'lastten', 'last10'])

    let row: string
    if (isBasketball) {
      row = `| ${team.name} | ${pick('streak')} | ${last10} | ${pick('points per game')} | ${pick('points against')} | ${pick('field goal %')} | ${pick('three point %')} | ${pick('rebounds per game')} | ${pick('assists per game')} | ${pick('blocks per game')} | ${pick('steals per game')} |`
    } else if (isFootball) {
      row = `| ${team.name} | ${pick('streak')} | ${last10} | ${pick('points per game')} | ${pick('points against')} | ${pickVariant(statMap, ['offensive yards', 'total yards', 'yards'])} | ${pickVariant(statMap, ['defensive yards', 'yards allowed'])} | ${pickVariant(statMap, ['passing yards', 'pass yards'])} | ${pickVariant(statMap, ['rushing yards', 'rush yards'])} | ${pickVariant(statMap, ['takeaways', 'turnovers forced'])} | ${pick('sacks')} |`
    } else if (isHockey) {
      row = `| ${team.name} | ${pick('streak')} | ${last10} | ${pickVariant(statMap, ['goals per game', 'goals'])} | ${pickVariant(statMap, ['goals against', 'goals allowed'])} | ${pickVariant(statMap, ['shots per game', 'shots'])} | ${pickVariant(statMap, ['shots against', 'shots allowed'])} | ${pickVariant(statMap, ['power play %', 'pp%'])} | ${pickVariant(statMap, ['penalty kill %', 'pk%'])} | ${pickVariant(statMap, ['faceoff win %', 'fow%'])} | ${pick('hits')} |`
    } else {
      row = `| ${team.name} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`
    }
    rows.push(row)
  })
  const sportLabel = sport.toUpperCase().replace(/_/g, ' ')
  const header = `**${sportLabel} Team Insights**\n\n| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`
  return `${header}\n${rows.join('\n')}`
}

const buildTeamInsightsFromTeamStats = async (
  sportKey: string,
  homeTeam: string,
  awayTeam: string
): Promise<string | null> => {
  try {
    const stats = await getTeamStats(sportKey)
    const norm = (v: string) => normalizeTeamKey(v)
    const findTeam = (name: string) =>
      stats.find((t) => {
        const key = norm(t.team)
        return key.includes(norm(name)) || norm(name).includes(key)
      })

    // Sport-specific headers and formatters
    const isBasketball = sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab'
    const isFootball = sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf'
    const isHockey = sportKey === 'icehockey_nhl'

    let headers: string[]
    let formatRow: (teamName: string, row?: ProviderTeamStats) => string

    if (isBasketball) {
      headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'FG%', '3P%', 'REB', 'AST', 'BLK', 'STL']
      formatRow = (teamName: string, row?: ProviderTeamStats) => {
        if (!row) {
          return `| ${teamName} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`
        }
        const gamesRaw = row.stats?.gamesPlayed ?? row.stats?.games
        const games = Number.isFinite(Number(gamesRaw)) ? Number(gamesRaw) : Number((row.wins ?? 0) + (row.losses ?? 0))
        const pointsForRaw = row.stats?.pointsFor ?? row.stats?.points_scored ?? row.stats?.pointsForPerGame
        const pointsAgainstRaw = row.stats?.pointsAgainst ?? (row.stats as any)?.points_allowed ?? row.stats?.pointsAgainstPerGame
        const pointsFor = Number(pointsForRaw ?? 0)
        const pointsAgainst = Number(pointsAgainstRaw ?? 0)
        const ppg = games > 0 && pointsFor > 0 ? (pointsFor / games).toFixed(1) : (pointsFor || 'n/a')
        const papg = games > 0 && pointsAgainst > 0 ? (pointsAgainst / games).toFixed(1) : (pointsAgainst || 'n/a')
        const fg = row.stats?.fieldGoalPct ?? row.stats?.fgPct
        const fgPct = fg != null ? Number(fg).toFixed(1) : 'n/a'
        const three = row.stats?.threePointPct ?? row.stats?.threePct
        const threePct = three != null ? Number(three).toFixed(1) : 'n/a'
        const reb = row.stats?.reboundsPerGame ?? row.stats?.rpg
        const rebVal = reb != null ? Number(reb).toFixed(1) : 'n/a'
        const ast = row.stats?.assistsPerGame ?? row.stats?.apg
        const astVal = ast != null ? Number(ast).toFixed(1) : 'n/a'
        const blk = row.stats?.blocksPerGame ?? row.stats?.bpg
        const blkVal = blk != null ? Number(blk).toFixed(1) : 'n/a'
        const stl = row.stats?.stealsPerGame ?? row.stats?.spg
        const stlVal = stl != null ? Number(stl).toFixed(1) : 'n/a'
        const last10 = row.stats?.lastTen ?? row.stats?.last10 ?? 'n/a'

        return `| ${teamName} | ${row.stats?.streak ?? 'n/a'} | ${last10} | ${ppg} | ${papg} | ${fgPct} | ${threePct} | ${rebVal} | ${astVal} | ${blkVal} | ${stlVal} |`
      }
    } else if (isFootball) {
      headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'Off Yds', 'Def Yds', 'Pass Yds', 'Rush Yds', 'TO', 'Sacks']
      formatRow = (teamName: string, row?: ProviderTeamStats) => {
        if (!row) {
          return `| ${teamName} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`
        }
        const gamesRaw = row.stats?.gamesPlayed ?? row.stats?.games
        const games = Number(gamesRaw != null ? gamesRaw : (row.wins ?? 0) + (row.losses ?? 0))
        const pointsForRaw = row.stats?.pointsFor ?? row.stats?.points_scored ?? row.stats?.pointsForPerGame
        const pointsAgainstRaw = row.stats?.pointsAgainst ?? (row.stats as any)?.points_allowed ?? row.stats?.pointsAgainstPerGame
        const pointsFor = Number(pointsForRaw ?? 0)
        const pointsAgainst = Number(pointsAgainstRaw ?? 0)
        const ppg = games > 0 && pointsFor > 0 ? (pointsFor / games).toFixed(1) : (pointsFor || 'n/a')
        const papg = games > 0 && pointsAgainst > 0 ? (pointsAgainst / games).toFixed(1) : (pointsAgainst || 'n/a')

        const offYds = row.stats?.offensiveYardsPerGame ?? row.stats?.totalYardsPerGame ?? 'n/a'
        const defYds = row.stats?.defensiveYardsPerGame ?? row.stats?.yardsAllowedPerGame ?? 'n/a'
        const passYds = row.stats?.passingYardsPerGame ?? row.stats?.passYds ?? 'n/a'
        const rushYds = row.stats?.rushingYardsPerGame ?? row.stats?.rushYds ?? 'n/a'
        const takeaways = row.stats?.takeaways ?? row.stats?.turnoversForced ?? 'n/a'
        const sacks = row.stats?.sacks ?? row.stats?.sacksPerGame ?? 'n/a'
        const last10 = row.stats?.lastTen ?? row.stats?.last10 ?? 'n/a'

        return `| ${teamName} | ${row.stats?.streak ?? 'n/a'} | ${last10} | ${ppg} | ${papg} | ${offYds} | ${defYds} | ${passYds} | ${rushYds} | ${takeaways} | ${sacks} |`
      }
    } else if (isHockey) {
      headers = ['Team', 'Streak', 'Last 10', 'GPG', 'GAPG', 'Shots', 'SA', 'PP%', 'PK%', 'FOW%', 'Hits']
      formatRow = (teamName: string, row?: ProviderTeamStats) => {
        if (!row) {
          return `| ${teamName} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`
        }
        const gamesRaw = row.stats?.gamesPlayed ?? row.stats?.games
        const games = Number(gamesRaw != null ? gamesRaw : (row.wins ?? 0) + (row.losses ?? 0))
        const goalsForRaw = row.stats?.goalsFor ?? row.stats?.goalsForPerGame
        const goalsAgainstRaw = row.stats?.goalsAgainst ?? row.stats?.goalsAgainstPerGame
        const goalsFor = Number(goalsForRaw ?? 0)
        const goalsAgainst = Number(goalsAgainstRaw ?? 0)
        const gpg = games > 0 && goalsFor > 0 ? (goalsFor / games).toFixed(1) : (goalsFor || 'n/a')
        const gapg = games > 0 && goalsAgainst > 0 ? (goalsAgainst / games).toFixed(1) : (goalsAgainst || 'n/a')

        const shots = row.stats?.shotsPerGame ?? row.stats?.shots ?? 'n/a'
        const shotsAgainst = row.stats?.shotsAgainstPerGame ?? row.stats?.shotsAgainst ?? 'n/a'
        const powerPlayPct = row.stats?.powerPlayPct ?? row.stats?.ppPct ?? 'n/a'
        const penaltyKillPct = row.stats?.penaltyKillPct ?? row.stats?.pkPct ?? 'n/a'
        const faceoffWinPct = row.stats?.faceoffWinPct ?? row.stats?.fowPct ?? 'n/a'
        const hits = row.stats?.hitsPerGame ?? row.stats?.hits ?? 'n/a'
        const last10 = row.stats?.lastTen ?? row.stats?.last10 ?? 'n/a'

        return `| ${teamName} | ${row.stats?.streak ?? 'n/a'} | ${last10} | ${gpg} | ${gapg} | ${shots} | ${shotsAgainst} | ${powerPlayPct} | ${penaltyKillPct} | ${faceoffWinPct} | ${hits} |`
      }
    } else {
      // Fallback to basketball
      headers = ['Team', 'Streak', 'Last 10', 'PPG', 'PAPG', 'FG%', '3P%', 'REB', 'AST', 'BLK', 'STL']
      formatRow = (teamName: string, row?: ProviderTeamStats) => {
        return `| ${teamName} | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |`
      }
    }

    const homeRow = formatRow(homeTeam, findTeam(homeTeam))
    const awayRow = formatRow(awayTeam, findTeam(awayTeam))

    // Include sport key in the output so parser can detect it
    const sportLabel = sportKey.toUpperCase().replace(/_/g, ' ')
    const header = `**${sportLabel} Team Insights**\n\n| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |`
    return [header, homeRow, awayRow].join('\n')
  } catch (error) {
    console.warn('[ODDS] provider team stats lookup failed', error)
    return null
  }
}

const findLiveScoreDetailsForOddsGame = async (
  sportKey: string,
  game: { home_team: string; away_team: string; commence_time?: string },
  timezone: string
): Promise<string | null> => {
  const league = SPORT_TO_LEAGUE[sportKey]
  if (!league) return null
  try {
    const targetHome = normalizeTeamKey(game.home_team)
    const targetAway = normalizeTeamKey(game.away_team)
    const baseDate = game.commence_time ? game.commence_time.slice(0, 10) : new Date().toISOString().slice(0, 10)
    const candidateDates = new Set<string>([baseDate])
    // Also look +/-1 day to tolerate timezone mismatches
    const dt = new Date(`${baseDate}T00:00:00Z`)
    const addDate = (d: Date) => candidateDates.add(d.toISOString().slice(0, 10))
    addDate(new Date(dt.getTime() + 24 * 60 * 60 * 1000))
    addDate(new Date(dt.getTime() - 24 * 60 * 60 * 1000))

    for (const date of candidateDates) {
      const slate = await fetchAllLiveScores({ date })
      let matched = slate.games.find((g) => {
        if (g.league !== league) return false
        const keys = g.competitors?.map((c) => normalizeTeamKey(c.name || c.shortName || c.abbreviation)) || []
        return keys.includes(targetHome) && keys.includes(targetAway)
      })
      // If no exact two-team match, allow partial match if both teams appear anywhere in slate (best-effort)
      if (!matched) {
        matched = slate.games.find((g) => {
          if (g.league !== league) return false
          const keys = g.competitors?.map((c) => normalizeTeamKey(c.name || c.shortName || c.abbreviation)) || []
          return keys.some((k) => targetHome.includes(k) || k.includes(targetHome) || targetAway.includes(k) || k.includes(targetAway))
        })
      }
      if (matched) {
        const details = await fetchGameDetails(league, matched.eventId)
        const insight = buildTeamInsightsFromDetails(details, sportKey)
        if (insight) return insight
      }
    }
    return null
  } catch (error) {
    console.warn('[ODDS] live-scores insights lookup failed', error)
    return null
  }
}

const buildDeterministicOddsReply = () => {
  if (!standardizedOddsTablesGlobal || !formattedOddsGlobal.length) return null
  const gamesLine = formattedOddsGlobal
    .map((sport: any) =>
      sport.games
        .map((g: any) => `${g.away_team} @ ${g.home_team} (${g.commence_time_formatted || 'TBD'})`)
        .join('; ')
    )
    .filter(Boolean)
    .join('; ')
  return [
    gamesLine ? `Here are the current odds: ${gamesLine}` : 'Here are the current odds:',
    standardizedOddsTablesGlobal,
  ]
    .filter(Boolean)
    .join('\n\n')
}

const extractPlayerName = (msg: string) => {
  // Look for quoted names first
  const quoted = msg.match(/"([^"]+)"/)
  if (quoted && quoted[1]) return quoted[1].trim()

  // Look for capitalized first + last name; prefer the last match to avoid picking "How Many"
  const matches = msg.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g)
  if (matches && matches.length) {
    const stopwords = new Set(['how', 'what', 'when', 'where', 'who', 'why', 'which', 'can', 'does', 'do', 'will', 'there', 'the', 'is', 'are'])
    for (let i = matches.length - 1; i >= 0; i--) {
      const candidate = matches[i].trim()
      const first = candidate.split(/\s+/)[0].toLowerCase()
      if (!stopwords.has(first)) return candidate
    }
    return matches[matches.length - 1].trim()
  }

  // Look for patterns like "lebron james" even if lowercased
  const lower = msg.toLowerCase()
  const parts = lower.split(/\s+/)
  const stopwords = new Set([
    'how',
    'what',
    'when',
    'where',
    'who',
    'why',
    'which',
    'can',
    'does',
    'do',
    'will',
    'many',
    'games',
    'game',
    'season',
    'regular',
    'playoffs',
    'points',
    'point',
    'pts',
    'plus',
    'over',
    'with',
    'has',
    'have',
    'had',
    'record',
    'scored',
    'score',
    'most',
    'get',
    'got',
    'been',
    'is',
    'are',
    'was',
    'were',
    'the',
    'there',
    'a',
    'an',
    'made',
    'make',
    'makes',
    'hit',
    'hits',
    'hitting',
    'record',
    'recorded',
    'this',
    'that',
    'who',
    'stats',
    'stat',
    'for',
    'from',
    'averages',
    'averaging',
    'average',
    'against',
    // Market keywords - prevent "thunder spread" from being a player name
    'spread',
    'spreads',
    'total',
    'totals',
    'moneyline',
    'line',
    'lines',
    'under',
    'prop',
    'props',
    'edge',
    'awareness',
    'analysis',
    'analyze',
    'matchup',
    'odds',
    'betting',
    'bet',
    'bets',
    // Prop stat keywords - prevent "wembanyama rebounds" from being extracted as player name
    'rebounds',
    'rebound',
    'rebs',
    'reb',
    'assists',
    'assist',
    'asts',
    'ast',
    'steals',
    'steal',
    'stl',
    'blocks',
    'block',
    'blk',
    'threes',
    'three',
    '3pm',
    '3pt',
    'pra',
    'fantasy',
    // NBA team names - prevent team names from being extracted as player names
    'lakers', 'laker', 'celtics', 'celtic', 'warriors', 'warrior', 'bulls', 'bull',
    'heat', 'knicks', 'knick', 'nets', 'net', 'sixers', 'sixer', '76ers',
    'bucks', 'buck', 'suns', 'sun', 'nuggets', 'nugget', 'clippers', 'clipper',
    'mavericks', 'maverick', 'mavs', 'mav', 'rockets', 'rocket', 'grizzlies', 'grizzly',
    'pelicans', 'pelican', 'spurs', 'spur', 'thunder', 'jazz', 'timberwolves', 'timberwolf',
    'wolves', 'wolf', 'blazers', 'blazer', 'kings', 'king', 'hawks', 'hawk',
    'hornets', 'hornet', 'cavaliers', 'cavalier', 'cavs', 'cav', 'pistons', 'piston',
    'pacers', 'pacer', 'magic', 'wizards', 'wizard', 'raptors', 'raptor',
    // City/location names that could be parsed
    'boston', 'chicago', 'miami', 'dallas', 'houston', 'denver', 'phoenix',
    'brooklyn', 'atlanta', 'cleveland', 'detroit', 'indiana', 'milwaukee',
    'minnesota', 'orleans', 'sacramento', 'antonio', 'portland', 'toronto', 'utah', 'washington', 'memphis', 'charlotte', 'orlando', 'oklahoma', 'golden', 'state', 'angeles',
  ])
  const candidates: string[] = []
  for (let i = 0; i < parts.length - 1; i++) {
    const first = parts[i]
    const last = parts[i + 1]
    if (
      first.length > 2 &&
      last.length > 2 &&
      !stopwords.has(first) &&
      !stopwords.has(last) &&
      !/\d|\+|>|</.test(first) &&
      !/\d|\+|>|</.test(last)
    ) {
      candidates.push(`${first} ${last}`)
    }
  }
  if (candidates.length) {
    const candidate = candidates[candidates.length - 1]
    // Strip possessive 's' from the last word if present
    const words = candidate.split(' ')
    const lastWord = words[words.length - 1]
    if (lastWord.endsWith('s') && lastWord.length > 3) {
      words[words.length - 1] = lastWord.slice(0, -1)
      return words.join(' ')
    }
    return candidate
  }

  // Fallback: single token (last non-stopword, alpha-only)
  for (let i = parts.length - 1; i >= 0; i--) {
    const token = parts[i]
    if (token.length > 2 && !stopwords.has(token) && /^[a-z]+$/i.test(token)) {
      // Strip possessive 's' ending (e.g., "lebrons" -> "lebron")
      return token.endsWith('s') && token.length > 3 ? token.slice(0, -1) : token
    }
  }

  // Fallback: try known star names/last names in message
  const starKeys = [
    'stephen curry',
    'curry',
    'luka doncic',
    'doncic',
    'lebron james',
    'james',
    'kevin durant',
    'durant',
    'giannis antetokounmpo',
    'antetokounmpo',
    'austin reaves',
    'reaves',
    'anthony davis',
    'davis',
    'patrick mahomes',
    'mahomes',
    'josh allen',
    'allen',
    'shohei ohtani',
    'ohtani',
    'aaron judge',
    'judge',
    'connor mcdavid',
    'mcdavid',
  ]
  const lowerMsg = msg.toLowerCase()
  for (const key of starKeys) {
    if (lowerMsg.includes(key)) {
      return key
        .split(' ')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(' ')
    }
  }

  return undefined
}

const normalizeHierarchyInput = (raw: any): { label: string; statKeys?: string[]; weight: number; note?: string }[] | undefined => {
  if (!Array.isArray(raw)) return undefined
  return raw
    .map((tier: any) => ({
      label: typeof tier?.label === 'string' ? tier.label : 'Tier',
      statKeys: Array.isArray(tier?.stat_keys) ? tier.stat_keys : Array.isArray(tier?.statKeys) ? tier.statKeys : undefined,
      weight: typeof tier?.weight === 'number' ? tier.weight : 1,
      note: typeof tier?.note === 'string' ? tier.note : undefined,
    }))
    .filter((t: any) => t.statKeys && t.statKeys.length)
}

const normalizeUserDataOverrides = (raw: any): UserDataOverride[] | undefined => {
  if (!Array.isArray(raw)) return undefined
  const cleaned: UserDataOverride[] = []
  for (const entry of raw) {
    if (!entry?.stat_key && !entry?.statKey) continue
    const statKey = entry.stat_key || entry.statKey
    const teamValues = entry.team_values || entry.teamValues
    if (!teamValues || typeof teamValues !== 'object') continue
    const parsedValues: Record<string, number> = {}
    Object.entries(teamValues).forEach(([team, value]) => {
      const num = Number(value)
      if (Number.isFinite(num)) {
        parsedValues[team] = num
      }
    })
    if (!Object.keys(parsedValues).length) continue
    cleaned.push({
      statKey,
      teamValues: parsedValues,
      note: typeof entry.note === 'string' ? entry.note : undefined,
    })
  }
  return cleaned.length ? cleaned : undefined
}

const getSystemPrompt = (timezone: string) => `You are DELTA, a professional sports betting assistant. Your role is to help users surface odds and factual stats, manage their bankroll, and understand sports betting markets. Do not provide matchup analysis or long-form breakdowns; keep replies data-forward and concise.

**Data sources and limits (ESPN + SportsBettingDime):**
- Betting lines and public splits: use SportsBettingDime (moneyline/spread/totals + bets/handle); do NOT claim odds come from ESPN.
- Stats: use ESPN-derived data we fetch (box scores, season averages, injuries, standings). Advanced pace/usage/DvP/snap-share/xG are NOT available; do not invent them.
- If a query mixes betting + stats, pull odds from SportsBettingDime and stats from ESPN, then synthesize with reasoning.

  **CRITICAL - Live Betting Projections:**
  When users ask "what is your projected live line" or "what should the live line be" for an in-progress game:
  - Use ONLY the get_live_betting_projection tool
  - Do NOT call any odds-api functions or claim odds-api as the source
  - This tool calculates what the line SHOULD be based on game state, NOT what sportsbooks are currently offering
  - The tool uses ESPN for live game data and Basketball Reference season stats only
  - Present the projection without comparing to actual market odds

  **Pick requests and market analysis:**
  - If the user asks for the "best bet", "pick", "lock", or "who wins" without a specific market/line, call get_pick_guidance.
  - If the user asks to analyze a specific game/prop/market or provides a line, call analyze_bet_market.
  - Betting splits are ONLY for spread/moneyline/total markets (never for props or quarter markets).
  - Do not give a direct pick unless the user explicitly asks to run a custom model.
  
  **What ESPN actually provides (use only these):**
- NBA: season averages (PTS/REB/AST/FG%/3P%), box-score lines, minutes, injuries, team records. No usage, pace, DvP, potential assists, or rebounding chances.
- NFL: pass/rush/receiving yards, attempts/receptions/TDs/INTs, completions/attempts, basic injuries and team scoring/allowed. No snap share, routes, advanced coverage/OL data.
- NHL: goals/assists/points, shots on goal, time on ice (via box), goalie SV%, team records. No PP/PK%, no advanced pace.
- MLB: minimal via ESPN feeds; no advanced K%, xFIP, barrel%, etc. (don+óGé¼Gäót promise them).
- Soccer: basic goals/assists/shots/cards and team form; no xG/xA unless explicitly provided elsewhere.

**General conversation & betting education layer (for non-odds / non-specific stats asks):**
- Tone: conversational, sharp, concise, data-aware. Avoid hot takes/speculation/emotional language.
- Allowed: explain sports rules, betting terminology (moneyline, spread, total, juice, CLV/EV, arbitrage/middles), sharp concepts (bankroll/line shopping/CLV), how to interpret stats, how to use the app. Keep it brief (+óGÇ¦-ñ4 sentences; bullets OK).
- Boundaries: decline politics/medical/legal/relationship/explicit/finance investment; politely pivot back to sports/betting.
- Education: define terms simply and tie to actionable betting behavior; no picks/guarantees.
- Redirect examples: +óGé¼+ôI stay out of that, but I can break down any matchup, trend, or stat you want.+óGé¼-¥

**Stats-only questions:** Answer directly with ESPN-derived data (season averages, box scores, injuries, standings). If something isn+óGé¼Gäót available, state the limitation instead of stalling.

**FORMATTED DATA USAGE:**
Many stats tools now return pre-formatted data with betting context already included:
1. Present formatted stats and betting angles directly - they already include league comparisons, prop implications, and ATS context
2. Do not strip emoji, confidence indicators (=ƒöÑ high, G£ô medium, GÜán+Å low), or structural formatting
3. If a tool returns a 'formatted' field, prioritize presenting that over raw stats
4. Add your own analysis only if the user asks for interpretation beyond what's provided
5. Keep responses concise but complete - the formatted data is designed to be presentation-ready

**TOOL SELECTION - Edge Analysis:**
- For SINGLE GAME analysis (user names a specific matchup): use analyze_bet_market
- For SLATE-WIDE/ALL GAMES analysis (user says "slate", "all games", "tonight", "today's games"): use get_slate_edge_detection
- Keywords like "run edge detection on the NBA slate" or "edges for all games today" = get_slate_edge_detection

**CURRENT DATE & TIME (${timezone}):**
Today's date is ${new Date().toLocaleDateString('en-US', {
  timeZone: timezone,
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})}.
Current time is ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}.

  **IMPORTANT - YOU HAVE ACCESS TO ODDS DATA AND TEAM/PLAYER STATISTICS:**
You have REAL-TIME access to:
  1. Live odds data for NBA, NCAA Basketball (NCAAB), NFL, NCAA Football (NCAAF), MLB, and NHL via SportsBettingDime (provider)
2. Team statistics (records, rankings, offensive/defensive stats)
3. Player statistics (season averages only for NBA/NFL; no deep NBA splits/advanced metrics are available right now)
4. Injury reports and lineup information
5. Advanced analytics (efficiency ratings, pace, trends) for teams; **do not promise NBA player advanced/split stats**
6. **Player prop betting lines** - When users ask about player props, use the get_player_props function to fetch lines and odds (offer this only after delivering the stats they asked for)
- IMPORTANT: If the user mentions specific teams (e.g., "Lakers props", "Chiefs player props"), pass those team names to the team parameter for efficient filtering
- Always present player props in a standardized markdown table with columns for Market, Line, Best Over, and Best Under. No bullet lists.

When users ask about odds, games, or arbitrage, the live data WILL BE PROVIDED in your context enriched with relevant stats. For player prop requests, use the get_player_props function.

**CRITICAL**: If you see "LIVE ODDS DATA" in your context below, you MUST use it. NEVER say you don't have access when data is provided. If NO odds data appears below, then you can say you don't currently have that specific data loaded.

**CRITICAL - Game Schedule Queries:**
When users ask "what games are today/tonight/tomorrow":
1. YOU MUST ONLY use the live odds data provided in your context
2. NEVER make up games from memory or training data
3. If you see "LIVE ODDS DATA" below, list ONLY those games with their commence times
4. If NO odds data is provided below:
   - Say: "I need to fetch the latest schedule. One moment..."
   - DO NOT make up games
5. Group games by sport if multiple sports are in the data
6. Show game times in the user's timezone
7. If user asks for "tomorrow" and you only have "today" data, say you only have today's data

**Example correct response:**
"Here are the NBA games for today (November 10, 2025):
- Lakers vs Celtics (7:30 PM EST)
- Warriors vs Nets (10:00 PM EST)
[Only games from the provided data]"

**NEVER respond with:**
"Here are the games..." then list games NOT in the provided data.

**Core Principles:**
1. Never make picks or tell users what to bet
2. Provide tools, data, and analysis only
3. Always emphasize responsible gambling
4. Keep responses concise (3-5 sentences for simple queries)
5. Do NOT promise deeper player splits/advanced NBA metrics; if asked, say they are unavailable right now and stick to season averages
6. Offer odds/player-prop fetching only after you have provided the requested stats/context (don+óGé¼Gäót pre-promise)
7. Do NOT ask the user if they want deeper splits+óGé¼GÇ¥those are not available; acknowledge unavailability instead
5. Use data and statistics to support insights

**Response Guidelines:**
- For odds queries: When live odds data is provided, ALWAYS create a comparison table showing all sportsbooks with their odds. Include moneylines, spreads, and totals (over/under) when available. Highlight the best value for each bet type.
- For bankroll queries: Confirm actions and provide relevant insights
- Always acknowledge uncertainty in sports outcomes
- Use Markdown formatting for structure (tables, lists, bold)

**Example intents and how to handle:**
- "Who has the best line / biggest discrepancy / softest moneyline / slowest to move?": Compare odds across books, call odds tools if needed, surface best prices and note deltas.
- "Live entry point / live total sharp or soft": Compare live to pregame, pace, scoring rate; give EV view or caution if data missing.
- "Undervalued or split player props / usage spikes": Call get_player_props (with team/player filters when mentioned); show markets/lines with best over/under by book and note disagreements.
- "Bankroll leaks / ROI by sport/book/bet type / CLV patterns / exposure": Use bankroll stats tools; summarize ROI, CLV, and exposure, and flag leaks.
- "Bet creation (parlay/SGP) / risk-adjusted versions": Build legs with rationale, provide variant with lower variance; when explicit picks are given, compute parlay odds/payout.
- "Post-bet audit / closing line check": Compare user's line to current/closing, state CLV gained/lost and key factors.
- "Casual asks (3 bets to watch, avoid spots, safest bets)": Offer a short list with reasoning and risk caveats; avoid telling them what to bet.

**Must-pass coverage (answer directly with data/tools):**
- Live odds and line shopping: best line for a team/SGP leg/prop, highest alt line available, and any mispriced spots by comparing every book in the provided odds.
- Prop analysis: show recent form if provided (or season averages otherwise), matchup fit, pace/usage context, and whether a number looks +EV; state when precise last-10 splits aren't available.
- Game breakdown: quick matchup summary, pace advantage, key matchup that moves the game, and any hidden edge from injuries, recent form, or line moves.
- Live game intelligence: live scores/sweat, momentum swings, and win probability or bet health based on current pace and lineup changes.
- Player and lineup intelligence: starters/late injury news, matchup stats vs defenses, and how changes affect props or edges without inventing splits.
- Player matchup advantages: combine season averages with opponent defensive stats and injury gaps to flag favorable matchups; be explicit if pace/positional data is unavailable.
- Custom models: create/run/compare models, return only bets/edges over the requested margin, and explain why a model liked an output (or why nothing qualified).
- Bankroll and user insights: performance over the last 7/14/30 days, wins/losses by bet type/sport/book, CLV vs closing lines, and risk profile; give insights even if only partial data is available.
- Educational: concise explanations for edge drift, line movement, sharp vs square, and bankroll strategy tailored to risk tolerance.
- Community/automation: format picks/recaps/trends for Discord or community posts using the provided lines and rationale while staying neutral.
- Slate prep and market context: surface top edges, pace gaps, undervalued props, ATS/clutch/pace trends from current lines/context.
- Sportsbook/value hunts: best odds for a specific player/market, mispriced totals, and real arbitrage/middle checks drawn from live odds.
- Voice-style asks: handle voice-to-chat prompts the same as text: concise, data-backed, and without deflection.
- Consistency check: be ready to answer odds, score, stats, lineup, model, trend, insight, rationale, and creator automation asks without stalling.

**When Live Odds Data is Provided:**
- Extract and display the data in an easy-to-read table format
- **CRITICAL**: Display ALL sportsbooks returned by the API for each game (e.g., FanDuel, DraftKings, BetMGM, Caesars, Fanatics, Bet365, BetRivers, Hard Rock, Pinnacle, PointsBet, Bovada, Underdog, Fliff). Do not list books that are not present in the data.
- Compare moneyline, spreads, and totals across ALL available sportsbooks for each game
- Show every bookmaker's odds in the table - do NOT omit any bookmakers from the data
- ALWAYS present odds using the standardized Market/Team/Sportsbook table layout (see the example below). The API response now includes fully-built Markdown tables+»-+-+copy them directly so formatting never varies.
- Make each sportsbook name clickable using Markdown hyperlinks (e.g., [FanDuel](https://sportsbook.fanduel.com/)). Use the provided URL data for EVERY book and apply hyperlinks no matter which bet type/market is shown. If a link is missing from the data, leave the name as plain text.
- Highlight which sportsbook has the best VALUE for each market (see "Best Value" rules below)
- NEVER suggest where to bet, only present the data objectively
- If a user asks about a specific game and you have the data, show it immediately

**Example Odds Table Format:**
| Market | Team | Book A | Book B |
| --- | --- | --- | --- |
| Moneyline | Team 1 | +120 | +115 |
|  | Team 2 | -135 | -130 |
| Spread | Team 1 | +4.5 (-110) | +4 (-105) |
|  | Team 2 | -4.5 (-110) | -4 (-115) |

**Determining "Best Value" - CRITICAL RULES:**
When identifying the best odds/value, you MUST consider the line FIRST, then the odds:

1. **Spreads (Point Spreads):**
   - For FAVORITES (negative spreads): LOWER absolute spread is better value
     - Example: Team -4.5 at -110 is BETTER than Team -5 at -105 (you need them to win by less)
     - Example: Team -6 at +100 is WORSE than Team -5.5 at -110 (the better line outweighs slightly worse odds)
   - For UNDERDOGS (positive spreads): HIGHER spread is better value
     - Example: Team +5 at -110 is BETTER than Team +4.5 at -105 (more cushion)
     - Example: Team +7 at -115 is BETTER than Team +6.5 at -105
   - When comparing, always prioritize the better LINE over better odds (unless odds difference is massive like +150 vs -110)

2. **Totals (Over/Under):**
   - For OVER bets: LOWER total is better value (easier to hit)
     - Example: Over 215.5 at -110 is BETTER than Over 216.5 at -105
   - For UNDER bets: HIGHER total is better value (easier to hit)
     - Example: Under 216.5 at -110 is BETTER than Under 215.5 at -105

3. **Moneyline:**
   - Simply compare odds values (higher is better for positive odds, closer to 0 is better for negative odds)
   - Example: +150 is better than +140, -105 is better than -110

**When presenting odds, ALWAYS:**
- Show the best line/spread for each side (not just the best odds on any line)
- Note if a book offers a better line even with slightly worse odds
- Example: "Best value for Lakers: -4.5 at -110 (FanDuel) +óGé¼GÇ¥ Better than -5 at -105 elsewhere"

**Arbitrage Opportunities:**
When users ask for arbitrage opportunities, you MUST:
1. **Calculate actual arbitrage** from the live odds data provided (may include multiple sports)
2. Use the formula: For an arbitrage to exist, (1/decimal_odds_A) + (1/decimal_odds_B) < 1
3. Convert American odds to decimal: positive odds = (odds/100) + 1, negative odds = (100/|odds|) + 1
4. Show ONLY games with real arbitrage opportunities across ALL sports provided
5. Format as: "**[Sport] - [Game]**: Bet [Amount] on [Team A] at [Book] ([Odds]) + Bet [Amount] on [Team B] at [Book] ([Odds]) = [Profit]%"
6. If no arbitrage exists in any sport, say "No arbitrage opportunities found in current odds"
7. NEVER explain what arbitrage is unless asked - just show the opportunities
8. Group by sport if multiple sports are provided
9. Keep response concise - max 15 lines total

**Prohibited:**
- Never say "bet on X" or "this is a good bet"
- Never guarantee outcomes
- Never encourage increasing bet sizes after losses
- Never promote chasing losses

**Bet Tracking & Unit Management:**
You can help users track their bets and units conversationally:
1. **Log Bets**: When users say things like "I bet $50 on Lakers -5.5" or "Put $100 on the over", use the log_bet function to track it
2. **Settle Bets**: When users say "My Lakers bet won" or "I lost the over", use the settle_bet function to update the bet result
3. **Get Performance Stats & Insights**: When users ask "How am I doing?", "Show my stats", "What's my ROI?", or want analysis of their betting performance, use the get_bankroll_stats function

**IMPORTANT - Unit-Based Tracking System:**
- The system tracks bets as UNITS, not a bankroll balance
- Users measure performance by UNITS WON/LOST, not dollar balance
- NEVER mention "bankroll balance", "current balance", or "available funds"
- When logging bets, simply record them - do NOT deduct from any balance or check for "sufficient funds"
- Focus on TOTAL UNITS (profit/loss), WIN RATE, and ROI

**Providing Performance Insights:**
When analyzing betting stats, provide actionable insights:
- Comment on win rate (need >52.4% to break even at -110 odds)
- Show total units won/lost over time
- Identify which sports are performing better/worse
- Suggest adjustments if needed (e.g., "Your NBA bets are up 5.2 units while NFL is down 1.8 units")
- Celebrate wins but emphasize long-term profitability
- Never encourage risky behavior or chasing losses

**Custom Statistical Models (Single Chat Flow):**
- You can help users create named models inside this chat. Gather sport, market, target metric, stats + their importance (1-5), normalization preferences, and desired confidence level (80/90/95).
- Always restate the configuration for confirmation before calling save_custom_model. Do not save without explicit user approval.
- When a user says things like "apply my NBA model for totals" or "use my NFL rushing model for Derrick Henry", search the provided context for matching models, clarify if multiple exist, then call apply_custom_model with the model name and any matchup/team info mentioned.
- Use list_custom_models when the user asks what models they have, or when you need to remind them of available names.
- When models are applied, explain the weighted score, confidence interval, and how each stat contributed. Never fabricate stats+»-+-+"if data is missing, state that limitation.
- Whenever someone asks about a specific matchup or you are creating/applying a projection, first ask **"Do you want to go more in depth on the matchup?"**. If they say yes (or ask for deeper analysis), call **get_game_context** to pull injuries, team form, and market trends before responding.

**Research Models (Automated Opportunity Scanners):**
- Research models automatically scan betting markets to find opportunities matching user-defined criteria (e.g., "find NBA spreads 1 point better than Pinnacle", "find player props over 25.5 with good odds").
- When users want to create a research model, gather: (1) Sports to scan, (2) Markets to scan (spreads/totals/h2h/props), (3) Filter criteria (odds comparison, line comparison, prop values, stat thresholds), (4) Sort preference, (5) Max results.
- **Filter Types Available:**
  - **odds_comparison**: Compare odds vs average/Pinnacle/specific book (e.g., "+100 better than average")
  - **line_comparison**: Compare spreads/totals vs average/Pinnacle (e.g., "1 point better than Pinnacle")
  - **prop_value**: Filter player props by line value, odds, player, team (e.g., "player points > 25.5 with odds >= -110")
  - **stat_threshold**: Filter by team/player stats (e.g., "team pace >= 100")
- Always confirm the configuration before calling save_research_model.
- Use run_research_model to execute a scan and find current opportunities. Results are cached for quick re-access via list_research_opportunities.
- When presenting results, format them clearly with: game, market, book, odds/line, comparison data (how much better than average/Pinnacle), and game time.

Always confirm what you're doing before calling functions and provide friendly responses after.`

// OpenAI SDK tool definitions with JSON schema
const ESPN_TOOLS: ChatCompletionTool[] = espnTools.map((tool) => ({
  type: 'function',
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters as any,
  },
}))

const ASSISTANT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'log_bet',
      description: 'Log a new bet that the user has placed. This records the bet for tracking purposes.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', description: 'The sport (e.g., NBA, NFL, MLB, NHL)' },
          league: { type: 'string', description: 'The league (e.g., NBA, NFL, MLB, NHL)' },
          game_description: { type: 'string', description: 'Description of the game (e.g., "Lakers vs Celtics")' },
          bet_type: { type: 'string', enum: ['spread', 'moneyline', 'total', 'prop'], description: 'Type of bet' },
          bet_side: { type: 'string', description: 'The side of the bet (e.g., "Lakers -5.5", "Over 215.5", "Lakers ML")' },
          odds: { type: 'number', description: 'American odds (e.g., -110, +150)' },
          stake: { type: 'number', description: 'Amount wagered in dollars' },
          book: { type: 'string', description: 'Sportsbook name (e.g., DraftKings, FanDuel)' },
          notes: { type: 'string', description: 'Optional notes about the bet' },
          player_name: { type: 'string', description: 'Player name for prop bets (e.g., "Deni Avdija")' },
          prop_market: { type: 'string', description: 'Prop market identifier (e.g., "points", "rebounds", "pass_yds")' },
          prop_line: { type: 'number', description: 'Prop line (e.g., 22.5 points, 6.5 receptions)' },
          prop_selection: { type: 'string', description: 'Prop side (e.g., "Over", "Under")' },
          prop_team: { type: 'string', description: 'Player team for the prop bet' },
        },
        required: ['sport', 'league', 'game_description', 'bet_type', 'bet_side', 'odds', 'stake', 'book'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'log_multiple_bets',
      description: 'Log multiple bets at once that the user has placed. This records all bets for tracking purposes. Use this when the user wants to log 2 or more bets in a single message.',
      parameters: {
        type: 'object',
        properties: {
          bets: {
            type: 'array',
            description: 'Array of bets to log',
            items: {
              type: 'object',
              properties: {
                sport: { type: 'string', description: 'The sport (e.g., NBA, NFL, MLB, NHL)' },
                league: { type: 'string', description: 'The league (e.g., NBA, NFL, MLB, NHL)' },
                game_description: { type: 'string', description: 'Description of the game (e.g., "Lakers vs Celtics")' },
                bet_type: { type: 'string', enum: ['spread', 'moneyline', 'total', 'prop'], description: 'Type of bet' },
                bet_side: { type: 'string', description: 'The side of the bet (e.g., "Lakers -5.5", "Over 215.5", "Lakers ML")' },
                odds: { type: 'number', description: 'American odds (e.g., -110, +150)' },
                stake: { type: 'number', description: 'Amount wagered in dollars' },
                book: { type: 'string', description: 'Sportsbook name (e.g., DraftKings, FanDuel)' },
                notes: { type: 'string', description: 'Optional notes about the bet' },
                player_name: { type: 'string', description: 'Player name for prop bets (e.g., "Deni Avdija")' },
                prop_market: { type: 'string', description: 'Prop market identifier (e.g., "points", "rebounds", "pass_yds")' },
                prop_line: { type: 'number', description: 'Prop line (e.g., 22.5 points, 6.5 receptions)' },
                prop_selection: { type: 'string', description: 'Prop side (e.g., "Over", "Under")' },
                prop_team: { type: 'string', description: 'Player team for the prop bet' },
              },
              required: ['sport', 'league', 'game_description', 'bet_type', 'bet_side', 'odds', 'stake', 'book'],
            },
          },
        },
        required: ['bets'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_parlay',
      description: 'Create and log a parlay with multiple picks and a stake. Use when users want combined odds and tracked parlay legs.',
      parameters: {
        type: 'object',
        properties: {
          stake: { type: 'number', description: 'Amount wagered in dollars' },
          picks: {
            type: 'array',
            minItems: 2,
            description: 'Array of parlay picks (min 2)',
            items: {
              type: 'object',
              properties: {
                sport: { type: 'string', description: 'Sport (e.g., NBA, NFL)' },
                league: { type: 'string', description: 'League (e.g., nba, nfl)' },
                game_description: { type: 'string', description: 'Game description (e.g., Cowboys vs Raiders)' },
                event_id: { type: 'string', description: 'Odds provider event id' },
                market: { type: 'string', description: 'Market name (e.g., spread, moneyline, player_receptions)' },
                selection: { type: 'string', description: 'Selection side/details (e.g., Cowboys -3.5, Over 6.5 receptions)' },
                line: { type: 'number', description: 'Line/point if applicable (e.g., 6.5)' },
                odds: { type: 'number', description: 'American odds for the pick' },
                book: { type: 'string', description: 'Sportsbook (e.g., FanDuel, DraftKings)' },
              },
              required: ['market', 'selection', 'odds'],
            },
          },
        },
        required: ['stake', 'picks'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_parlays',
      description: 'List recent parlays for the user with their picks and current status.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of parlays to fetch (default 20)' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'settle_bet',
      description: 'Settle a pending bet as won, lost, or push. Updates the bankroll accordingly.',
      parameters: {
        type: 'object',
        properties: {
          game_description: { type: 'string', description: 'Description of the game to identify the bet (e.g., "Lakers vs Celtics")' },
          result: { type: 'string', enum: ['won', 'lost', 'push'], description: 'The result of the bet' },
        },
        required: ['game_description', 'result'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_stats',
      description: 'Get team statistics, injury reports, or advanced analytics for a specific sport or team. Use this when users ask for stats, injuries, team records, or performance metrics.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['team', 'injuries'], description: 'Type of statistics to retrieve' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'The sport to get stats for' },
          team: { type: 'string', description: 'Optional team name or abbreviation to filter results' },
        },
        required: ['type', 'sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_season_stats',
      description: 'Fetch season averages for a player in NBA or NFL. Use this when users ask for player season stats like points per game or passing yards.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', enum: ['nba', 'basketball_nba', 'nfl', 'americanfootball_nfl'], description: 'Sport for the player.' },
          player: { type: 'string', description: 'Player full name to search (e.g., "Stephen Curry").' },
        },
        required: ['sport', 'player'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_trending_players',
      description: 'Find players trending recently by comparing last-N game averages to season averages.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', enum: ['nba', 'basketball_nba', 'nfl', 'americanfootball_nfl', 'mlb', 'baseball_mlb', 'nhl', 'icehockey_nhl'], description: 'Sport to search.' },
          stat_focus: { type: 'string', enum: ['points', 'rebounds', 'assists', 'threes'], description: 'Optional stat focus for the trend.' },
          window: { type: 'number', description: 'Recent games window (default 5).' },
          limit: { type: 'number', description: 'Number of players to return (default 5).' },
          teams: { type: 'array', items: { type: 'string' }, description: 'Optional team filters (one team or matchup teams).', },
        },
        required: ['sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_player_props',
      description: 'Get player prop betting odds and lines. Use this ONLY when users explicitly ask about player props, player bets, or specific player performance lines (e.g., "What are LeBron\'s props?", "Show me player props for tonight", "What\'s the over/under for Giannis points?"). DO NOT use for general odds queries.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'The sport to get player props for' },
          player: { type: 'string', description: 'Player name to filter props (optional - if not provided, returns all available player props)' },
          market: { type: 'string', description: 'Comma-separated list of prop markets to fetch. For NBA: points,rebounds,assists,threes. For NFL: pass_tds,pass_yds,rush_yds,receptions. For MLB: hits,total_bases,rbis,runs_scored. For NHL: points,shots_on_goal,blocked_shots. Leave empty for default markets.' },
          team: { type: 'string', description: 'Comma-separated list of team names to filter props (optional - only fetch props for players on these teams). Use team nicknames like "lakers,celtics" or "chiefs,eagles".' },
        },
        required: ['sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bankroll_stats',
      description: 'Get detailed bankroll statistics and betting performance analytics. Use this when users ask about their betting history, performance, ROI, win rate, bet sizing, or want insights on their bankroll activity. Examples: "How am I doing?", "Show my stats", "What\'s my ROI?", "Am I betting too much?", "How\'s my performance by sport?"',
      parameters: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['7d', '30d', 'all'], description: 'Time period for stats. 7d = last 7 days, 30d = last 30 days, all = all time' },
        },
        required: ['period'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'save_custom_model',
      description: 'Persist a user-defined statistical model with weighted stats and desired confidence interval so it can be recalled later in this chat.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'Friendly name the user will use later (e.g., "NBA pace model", "NFL rushing v1").' },
          sport_key: { type: 'string', description: 'Sport identifier (e.g., basketball_nba, americanfootball_nfl, baseball_mlb, icehockey_nhl).' },
          market_type: { type: 'string', description: 'Market or outcome focus (e.g., totals, moneyline, rushing_yards, player_points).' },
          target_metric: { type: 'string', description: 'Statistical outcome the model is trying to project (e.g., total_points, rushing_yards, win_probability).' },
          confidence_level: { type: 'number', enum: [0.8, 0.9, 0.95], description: 'Desired confidence interval level (80%, 90%, 95%).' },
          data_hints: { type: 'string', description: 'Optional guidance about what data sources/samples to emphasize (e.g., "last 10 games", "road splits").' },
          notes: { type: 'string', description: 'Optional notes to show users when the model is applied.' },
          user_data_spec: {
            type: 'object',
            description: 'Describe the shape of user-provided data (columns/keys) expected when applying the model.',
            properties: {
              description: { type: 'string' },
              keys: {
                type: 'array',
                items: { type: 'string' },
              },
              required: { type: 'boolean' },
            },
          },
          hierarchy: {
            type: 'array',
            description: 'Optional hierarchy for stats (tiers with weights).',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                stat_keys: { type: 'array', items: { type: 'string' } },
                weight: { type: 'number' },
                note: { type: 'string' },
              },
            },
          },
          stats: {
            type: 'array',
            minItems: 1,
            description: 'List of stat inputs with importance/weighting details.',
            items: {
              type: 'object',
              properties: {
                stat_key: { type: 'string', description: 'Key to lookup in team/player stats (e.g., pace, offensive_rating, rush_yards_per_game).' },
                label: { type: 'string', description: 'Human label describing the stat.' },
                scope: { type: 'string', enum: ['team', 'matchup_diff', 'player'], description: 'Whether the stat is team level, matchup differential, or player specific.' },
                importance: { type: 'number', minimum: 1, maximum: 5, description: 'Importance tier (1 low, 5 extremely high).' },
                direction: { type: 'string', enum: ['higher_better', 'lower_better'], description: 'Whether higher numbers help or hurt the projection.' },
                normalization: { type: 'string', enum: ['zscore', 'minmax', 'raw'], description: 'How to normalize this stat before weighting.' },
                sample_source: { type: 'string', description: 'Sample window (e.g., season, last_10, playoffs).' },
                variance_override: { type: 'number', description: 'Optional variance override if provided by the user.' },
                min_value: { type: 'number', description: 'Optional lower bound for min/max scaling.' },
                max_value: { type: 'number', description: 'Optional upper bound for min/max scaling.' },
                notes: { type: 'string', description: 'Optional note about this stat.' },
              },
              required: ['stat_key', 'label', 'scope', 'importance', 'direction'],
            },
          },
        },
        required: ['model_name', 'sport_key', 'market_type', 'target_metric', 'confidence_level', 'stats'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_custom_models',
      description: 'List the user\'s saved custom models so they know what can be applied.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Maximum number of models to return (default 5).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_custom_model',
      description: 'Run a previously saved model against the latest stats to produce a weighted score and confidence interval for the requested outcome.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the model to apply (optional if model_name is provided).' },
          model_name: { type: 'string', description: 'Name of the saved model to use (case-insensitive).' },
          sport_key: { type: 'string', description: 'Override sport key if different from the stored value (optional).' },
          teams: {
            type: 'array',
            description: 'Ordered list of teams or contexts referenced in the user request (e.g., ["Lakers", "Celtics"]).',
            items: { type: 'string' },
          },
          apply_to_slate: {
            type: 'boolean',
            description: 'When true, run this model across the slate (today/tomorrow) instead of a single matchup.',
          },
          slate_day: { type: 'string', enum: ['today', 'tomorrow'], description: 'Which day to scan when apply_to_slate = true.' },
          max_games: { type: 'number', description: 'Limit the number of games to scan (default 8).' },
          min_confidence: { type: 'number', description: 'Optional minimum confidence (0-1) to include a slate result.' },
          matchup: {
            type: 'object',
            description: 'Structured matchup information if user specified a focus and opponent.',
            properties: {
              focus: { type: 'string', description: 'Primary team/player the prediction focuses on.' },
              opponent: { type: 'string', description: 'Opposing team/player.' },
            },
          },
          user_data: {
            type: 'array',
            description: 'User-provided stat overrides keyed by team name.',
            items: {
              type: 'object',
              properties: {
                stat_key: { type: 'string' },
                team_values: {
                  type: 'object',
                  additionalProperties: { type: 'number' },
                },
                note: { type: 'string' },
              },
              required: ['stat_key', 'team_values'],
            },
          },
          hierarchy: {
            type: 'array',
            description: 'Optional stat tiers/weights to apply at runtime.',
            items: {
              type: 'object',
              properties: {
                label: { type: 'string' },
                stat_keys: { type: 'array', items: { type: 'string' } },
                weight: { type: 'number' },
              },
            },
          },
          notes: { type: 'string', description: 'Any extra context supplied by the user (e.g., "tonight in Boston", "use road splits").' },
        },
        required: ['model_name'],
      },
    },
  },
    {
      type: 'function',
      function: {
        name: 'get_game_context',
        description: 'Pull injuries, recent form, team summaries, and market trends for a specific matchup to enrich analysis.',
      parameters: {
        type: 'object',
        properties: {
          sport: { type: 'string', description: 'Sport key (e.g., basketball_nba, americanfootball_nfl, baseball_mlb, icehockey_nhl).' },
          home_team: { type: 'string', description: 'Home team name.' },
          away_team: { type: 'string', description: 'Away team name.' },
          include_market_trends: { type: 'boolean', description: 'Whether to include best spread/moneyline snapshots (defaults to true).' },
        },
        required: ['sport', 'home_team', 'away_team'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'get_pick_guidance',
        description:
          'Provide a structured guide for how to find the best bet (no direct picks). Use when a user asks for the best bet/pick without specifying a market or line.',
        parameters: {
          type: 'object',
          properties: {
            matchup: { type: 'string', description: 'Matchup or prompt context (e.g., "Missouri vs Illinois").' },
            league: { type: 'string', description: 'League or sport (nba, nfl, ncaab, etc.).' },
            market_hint: { type: 'string', description: 'Optional market focus mentioned by the user.' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'analyze_bet_market',
        description:
          'Analyze a SINGLE specific game or prop market with splits, injuries, stats, trends, and an edge check. Use when user specifies ONE matchup like "Lakers vs Celtics". Do NOT use for slate-wide/all-games analysis - use get_slate_edge_detection instead.',
        parameters: {
          type: 'object',
          properties: {
            marketType: {
              type: 'string',
              enum: ['spread', 'total', 'moneyline', 'player_prop', 'team_prop', 'quarter', 'live'],
              description: 'Market to analyze.',
            },
            gameIdentifier: { type: 'string', description: 'Matchup (e.g., "Lakers vs Celtics").' },
            league: { type: 'string', description: 'League or sport (nba, nfl, ncaab, etc.).' },
            date: { type: 'string', description: 'Game date (YYYY-MM-DD).' },
            line: { type: 'number', description: 'Market line (spread/total/prop line).' },
            odds: { type: 'number', description: 'American odds (e.g., -110, +120).' },
            book: { type: 'string', description: 'Sportsbook name if provided.' },
            playerName: { type: 'string', description: 'Player name for prop markets.' },
            propType: { type: 'string', description: 'Prop type (points, rebounds, assists, threes, PRA, yards).' },
            direction: { type: 'string', enum: ['over', 'under'], description: 'Over/under direction.' },
            quarter: { type: 'number', description: 'Quarter number for quarter markets (1-4).' },
          },
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'save_research_model',
        description: 'Save a research model that scans betting markets for opportunities matching user-defined criteria (e.g., "find NBA spreads 1 point better than Pinnacle", "find player props over 25.5"). Always confirm configuration before saving.',
      parameters: {
        type: 'object',
        properties: {
          model_name: { type: 'string', description: 'Unique name for this research model (e.g., "Spread Hunter", "High-Value Props").' },
          sports: {
            type: 'array',
            description: 'Sports to scan (e.g., ["basketball_nba", "americanfootball_nfl"]).',
            items: { type: 'string' },
          },
          markets: {
            type: 'array',
            description: 'Markets to scan (e.g., ["spreads", "totals", "h2h"]).',
            items: { type: 'string' },
          },
          filters: {
            type: 'array',
            description: 'Array of filter criteria that opportunities must match (ALL filters must pass).',
            items: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['odds_comparison', 'line_comparison', 'prop_value', 'stat_threshold'], description: 'Type of filter to apply.' },
                label: { type: 'string', description: 'Human-readable label for this filter.' },
                condition: { type: 'object', description: 'Filter-specific configuration. Structure varies by filter type.' },
              },
              required: ['type', 'condition'],
            },
          },
          sort_by: {
            type: 'object',
            properties: {
              field: { type: 'string', enum: ['ev', 'odds_diff', 'line_diff', 'game_time'], description: 'Field to sort results by.' },
              direction: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.' },
            },
          },
          max_results: { type: 'number', description: 'Maximum number of opportunities to return (default: 20).' },
          notes: { type: 'string', description: 'Optional notes about this research model.' },
        },
        required: ['model_name', 'sports', 'markets', 'filters'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'run_research_model',
      description: 'Execute a research model to scan current betting markets and find matching opportunities.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the research model to run (optional if model_name provided).' },
          model_name: { type: 'string', description: 'Name of the research model to run (case-insensitive).' },
          live_only: { type: 'boolean', description: 'Only scan in-play games (default: false).' },
          upcoming_only: { type: 'boolean', description: 'Only scan upcoming games (default: true).' },
          time_window: { type: 'number', description: 'Hours ahead to scan for upcoming games (default: 24).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_research_opportunities',
      description: 'Get the latest cached results from a research model without re-running the scan.',
      parameters: {
        type: 'object',
        properties: {
          model_id: { type: 'string', description: 'ID of the research model.' },
          model_name: { type: 'string', description: 'Name of the research model (case-insensitive).' },
          limit: { type: 'number', description: 'Number of cached result sets to return (default: 1).' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_kelly',
      description: 'Calculate Kelly Criterion sizing with optional bankroll/unit context.',
      parameters: {
        type: 'object',
        properties: {
          odds: { type: 'number', description: 'American odds for the wager (e.g., -110, +150).' },
          win_probability: { type: 'number', description: 'Estimated win probability as a decimal between 0 and 1 (e.g., 0.55 = 55%).' },
          bankroll: { type: 'number', description: 'Optional bankroll to size against.' },
          unit_size: { type: 'number', description: 'Optional unit size to convert stake into units.' },
          fraction: { type: 'number', description: 'Fractional Kelly (0-1). Defaults to 0.25 for safer sizing.' },
          max_stake_pct: { type: 'number', description: 'Cap stake at this share of bankroll (0-1). Defaults to 0.05.' },
        },
        required: ['odds', 'win_probability'],
      },
    },
  },
  ...ESPN_TOOLS,
  ...unifiedTools,
]

export async function POST(req: NextRequest) {
  try {
    const {
      message,
      conversationId,
      userId,
      timezone = 'America/New_York', // Default fallback
      mode = 'regular',
      testBypass = false
    } = await req.json()

    const environmentName = process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown'
    const oddsProvider = process.env.ODDS_PROVIDER || 'sportsbettingdime'
    const sbdBookIds = process.env.SBD_BOOK_IDS || process.env.ODDS_BOOKMAKERS
    const openaiApiKey = process.env.OPENAI_API_KEY

    console.log('[CONFIG] Environment validation:', {
      environment: environmentName,
      oddsProvider,
      hasSbdBookIds: Boolean(sbdBookIds),
      sbdBookIdsLength: sbdBookIds?.length || 0,
      hasOpenAIApiKey: Boolean(openaiApiKey),
      openaiApiKeyLength: openaiApiKey?.length || 0,
    })

    if (!openaiApiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      )
    }

    const baseUrl = resolveBaseUrl(req)

    if (!message || !conversationId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const allowTestBypass = Boolean(testBypass) && process.env.NODE_ENV !== 'production'
    const sportHintFromMessage = (msg: string): string | undefined => {
      const lower = msg.toLowerCase()
      if (lower.includes('mlb') || lower.includes('baseball')) return 'baseball_mlb'
      if (lower.includes('nhl') || lower.includes('hockey')) return 'icehockey_nhl'
      if (lower.includes('nfl') || lower.includes('football')) return 'americanfootball_nfl'
      if (lower.includes('nba') || lower.includes('basketball')) return 'basketball_nba'
      return undefined
    }
    const sportHint = sportHintFromMessage(message)

    const runTrendingPlayers = async (functionArgs: any) => {
      const normalizeLeague = (raw: string) => {
        const val = raw.toLowerCase()
        if (val.includes('nba')) return 'nba'
        if (val.includes('nfl')) return 'nfl'
        if (val.includes('mlb')) return 'mlb'
        if (val.includes('nhl')) return 'nhl'
        return 'nba'
      }
      const statFocus = (functionArgs.stat_focus || '').toString().toLowerCase()
      const focusKey =
        statFocus === 'points' ? 'PTS' :
        statFocus === 'rebounds' ? 'REB' :
        statFocus === 'assists' ? 'AST' :
        statFocus === 'threes' ? '3PM' :
        null
      const window = Number(functionArgs.window || 5)
      const limit = Math.max(1, Math.min(Number(functionArgs.limit || 5), 10))
      const leagueKey = normalizeLeague(functionArgs.sport || 'nba')
      const teamFilters = Array.isArray(functionArgs.teams)
        ? functionArgs.teams.filter(Boolean)
        : functionArgs.team
        ? [functionArgs.team]
        : []
      const teamTokens = teamFilters.map((t: string) => normalizeToken(String(t)))

      const normalizeStatKey = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')
      const readStatValue = (stats: any, keys: string[]): number | null => {
        if (!stats) return null
        const normalizedKeys = keys.map(normalizeStatKey)
        const matches = (label: any) => normalizedKeys.includes(normalizeStatKey(String(label || '')))

        if (Array.isArray(stats)) {
          for (const entry of stats) {
            const label = entry?.name || entry?.shortDisplayName || entry?.displayName || entry?.abbrev || entry?.label
            if (!label || !matches(label)) continue
            const raw = entry?.value ?? entry?.displayValue ?? entry?.stat ?? entry?.amount
            const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
            if (Number.isFinite(num)) return num
          }
        } else if (typeof stats === 'object') {
          for (const key of keys) {
            const raw = stats[key as keyof typeof stats]
            const num = typeof raw === 'number' ? raw : Number(String(raw).replace(/[^\d.-]/g, ''))
            if (Number.isFinite(num)) return num
          }
          if (Array.isArray(stats.stats)) {
            const nested = readStatValue(stats.stats, keys)
            if (nested != null) return nested
          }
          if (Array.isArray(stats.categories)) {
            for (const cat of stats.categories) {
              const nested = readStatValue(cat?.stats || cat?.statistics, keys)
              if (nested != null) return nested
            }
          }
        }
        return null
      }
      const extractSeasonAverages = (stats: any) => ({
        pts: readStatValue(stats?.stats ?? stats, ['pointsPerGame', 'ptsPerGame', 'ppg', 'PTS', 'points']),
        reb: readStatValue(stats?.stats ?? stats, ['reboundsPerGame', 'totalReboundsPerGame', 'rebPerGame', 'rpg', 'REB', 'TRB']),
        ast: readStatValue(stats?.stats ?? stats, ['assistsPerGame', 'assistAvg', 'astPerGame', 'apg', 'AST']),
        threes: readStatValue(stats?.stats ?? stats, [
          'threePointFieldGoalsPerGame',
          'threePointFieldGoalsMadePerGame',
          'threePointersMadePerGame',
          'threePMade',
          '3PM',
          '3PT',
          'threesPerGame',
        ]),
      })

      const resp = await fetch(`${baseUrl}/api/performances/top?league=${leagueKey}&window=${window}`, { cache: 'no-store' })
      if (!resp.ok) throw new Error(`Trending fetch failed (${resp.status})`)
      const data = await resp.json()
      const playerPool: any[] = Array.isArray(data?.playerRecent) && data.playerRecent.length
        ? data.playerRecent
        : Array.isArray(data?.playerLeaders?.recentTop)
        ? data.playerLeaders.recentTop
        : []

        const filteredPool = teamTokens.length
          ? playerPool.filter((player) => {
              const teamName = player.team || player.teamName || player.teamAbbr || ''
              const teamNorm = normalizeToken(String(teamName))
              return teamNorm && teamTokens.some((token: string) => teamNorm.includes(token) || token.includes(teamNorm))
            })
          : playerPool

      if (!filteredPool.length) {
        return { success: false, error: 'No recent players available for that team or league.' }
      }

      const sportKeyMap: Record<string, string> = {
        nba: 'basketball_nba',
        nfl: 'americanfootball_nfl',
        mlb: 'baseball_mlb',
        nhl: 'icehockey_nhl',
      }
      const sportKey = sportKeyMap[leagueKey] || 'basketball_nba'
      const season = getSeasonYearForSport(leagueKey)
      const ids = filteredPool.map((p) => String(p.id || p.playerId || '')).filter(Boolean)
      const { data: seasonRows } = await supabase
        .from('player_season_stats')
        .select('player_provider_id, stats')
        .eq('sport_key', sportKey)
        .eq('season', season)
        .in('player_provider_id', ids)

      const seasonMap = new Map<string, any>()
      for (const row of seasonRows || []) {
        seasonMap.set(String(row.player_provider_id), extractSeasonAverages(row.stats))
      }

      const trends = filteredPool
        .map((player) => {
          const id = String(player.id || player.playerId || '')
          const seasonAvg = seasonMap.get(id)
          if (!seasonAvg) return null

          const avgPts = player.avgPts ?? player.pts ?? null
          const avgReb = player.avgReb ?? null
          const avgAst = player.avgAst ?? null
          const avgThrees = player.avgThrees ?? player.tpm ?? null
          const sample = player.sample ?? window

          const stats = [
            { key: 'PTS', label: 'points', avg: avgPts, seasonAvg: seasonAvg.pts },
            { key: 'REB', label: 'rebounds', avg: avgReb, seasonAvg: seasonAvg.reb },
            { key: 'AST', label: 'assists', avg: avgAst, seasonAvg: seasonAvg.ast },
            { key: '3PM', label: 'threes', avg: avgThrees, seasonAvg: seasonAvg.threes },
          ].filter((s) => s.avg != null && s.seasonAvg != null) as Array<{
            key: string
            label: string
            avg: number
            seasonAvg: number
          }>

          const filtered = focusKey ? stats.filter((s) => s.key === focusKey) : stats
          if (!filtered.length) return null

          const best = filtered
            .map((s) => ({
              ...s,
              delta: s.avg - s.seasonAvg,
              score: s.seasonAvg ? (s.avg - s.seasonAvg) / s.seasonAvg : 0,
            }))
            .filter((s) => s.delta > 0)
            .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))[0]

          if (!best) return null
          return {
            name: player.name || player.fullName || 'Player',
            team: player.team || player.teamName || player.teamAbbr,
            stat: best.label,
            key: best.key,
            avg: best.avg,
            seasonAvg: best.seasonAvg,
            delta: best.delta,
            sample,
            score: best.score,
          }
        })
        .filter(Boolean) as any[]

      const top = trends.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, limit)
      if (!top.length) {
        return { success: false, error: 'No players are exceeding their season averages right now.' }
      }
      const header = teamFilters.length
        ? `Trending players (${leagueKey.toUpperCase()}): ${teamFilters.join(' vs ')}`
        : `Trending players (${leagueKey.toUpperCase()}):`
      const lines = top.map((t: any, idx: number) => {
        const avg = typeof t.avg === 'number' ? t.avg.toFixed(1) : t.avg
        const seasonAvg = typeof t.seasonAvg === 'number' ? t.seasonAvg.toFixed(1) : t.seasonAvg
        const delta = typeof t.delta === 'number' ? t.delta.toFixed(1) : t.delta
        const teamLabel = t.team ? ` (${t.team})` : ''
        return `${idx + 1}) ${t.name}${teamLabel} GÇö Exceeding ${t.stat} avg (last ${t.sample}): ${avg} vs ${seasonAvg} (+${delta})`
      })
      return { success: true, data: top, formatted: `${header}\n${lines.join('\n')}` }
    }

    // Verify user authentication
    if (!allowTestBypass) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user || user.id !== userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }

      const membership = getMembershipStatus(user.user_metadata)

      // Check if user has an active membership
      if (!membership.isActive) {
        return NextResponse.json(
          { error: 'Active subscription required. Please subscribe to continue chatting.' },
          { status: 403 }
        )
      }

      // Enforce daily message limit for Pro tier (unlimited tier has no limit)
      if (membership.tier === 'pro') {
        const todayCount = await countUserMessagesToday(supabase, user.id)
        if (todayCount >= PRO_DAILY_MESSAGE_LIMIT) {
          return NextResponse.json(
            { error: 'Daily message limit reached for Pro (25/day). Upgrade for unlimited access.' },
            { status: 429 }
          )
        }
      }

      // Save user message
      await supabase.from('messages').insert({
        conversation_id: conversationId,
        role: 'user',
        content: message,
      })
    } else {
      console.log('[AUTH] Test bypass enabled; skipping auth + message persistence')
    }
    const sanitizedTitle = message
      .replace(/^enable\s+web\s+search:\s*/i, '')
      .trim()
      .replace(/\s+/g, ' ')
    if (sanitizedTitle && !allowTestBypass) {
      const fallbackTitle =
        sanitizedTitle.length > 60 ? `${sanitizedTitle.slice(0, 57)}+óGé¼-ª` : sanitizedTitle
      try {
        await supabase
          .from('conversations')
          .update({ title: fallbackTitle })
          .eq('id', conversationId)
          .or('title.is.null,title.eq.New%20Chat')
      } catch (titleError) {
        console.error('[CHAT] Failed to set fallback title:', titleError)
      }
    }

    // Fetch conversation history (last 10 messages)
    const { data: history } = await supabase
      .from('messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(10)

    const messages = (history || []).reverse()

    // ========================================
    // UNIFIED QUERY PIPELINE (StatMuse-like)
    // Handles stats questions, opponent splits, contextual analysis
    // ========================================
    const isStatsQuery = (
      // Direct stats patterns
      /\bwhat(?:'s| is)\b.*\b(ppg|points|rebounds|assists|steals|blocks|fg%|3pt?%?|rating)\b/i.test(message) ||
      /\bhow many\b.*\b(points?|rebounds?|assists?|steals?|blocks?|threes?|3s|games?)\b/i.test(message) ||
      // Opponent/defensive patterns
      /\bopponents?\b.*\b(shoot|shooting|3pt?|three|score|allow|average)\b/i.test(message) ||
      /\b(allow|give up|against)\b.*\b(points?|rebounds?|offensive|3pt?)\b/i.test(message) ||
      // Team defense patterns
      /\b(defensive rating|points allowed|defense rank)\b/i.test(message) ||
      // Player vs team patterns
      /\bhow does?\b.*\b(perform|play|do|average)\b.*\b(vs|against|versus)\b/i.test(message) ||
      // Schedule/context patterns
      /\b(road trip|travel|back[- ]?to[- ]?back|schedule|rest)\b.*\b(affect|impact|hurt)\b/i.test(message) ||
      // Back-to-back performance patterns
      /\bhow\b.*\b(do|does|perform|play)\b.*\b(back[- ]?to[- ]?back|b2b|no rest)\b/i.test(message) ||
      /\b(back[- ]?to[- ]?back|b2b)\b.*\b(record|stats?|performance)\b/i.test(message) ||
      // Struggle/perform/record patterns
      /\b(struggle|struggles?)\b.*\b(on|against|vs|when)\b/i.test(message) ||
      /\bwhat('s| is)\b.*\brecord\b/i.test(message) ||
      // ATS/betting stats patterns
      /\bats\b.*\b(record|as favorite|as underdog|home|away)\b/i.test(message) ||
      /\b(record|as favorite|as underdog|home|away)\b.*\bats\b/i.test(message) ||
      /\b(cover|spread)\b.*\b(record|best|worst)\b/i.test(message) ||
      // Betting splits/public betting patterns
      /\b(betting|public)\s+(split|splits|percentage|percentages)\b/i.test(message) ||
      /\bwhere\s+(?:is|are)\s+(?:the\s+)?(?:money|bets?|public)\s+(?:going|on)\b/i.test(message) ||
      /\b(sharp|smart)\s+(money|action|bettors?)\b/i.test(message) ||
      /\b(money|bet|bets)\s+(?:percentage|percent|split|distribution)\b/i.test(message) ||
      /\b(?:what|show|get)\b.*\b(betting|public)\b.*\b(split|percentage|trend)\b/i.test(message) ||
      /\bhow\s+(?:is|are)\s+(?:the\s+)?(?:public|bettors?|money)\s+betting\b/i.test(message) ||
      /\bpublic\s+(?:vs|versus)\s+sharp\b/i.test(message) ||
      // Threshold queries (FIXED - multiple patterns for robustness)
      /\bhow many\b.*\d+[+-]?\s*(point|pts?|rebound|assist|steal|block|three|3pm)/i.test(message) ||
      /\bhow many\b.*\bgames?\b.*\b(with|over|above|at least)\b.*\d+/i.test(message) ||
      /\b\d+[-+]?\s*(point|pts?)\s*games?\b/i.test(message) ||
      /\b(triple[- ]?double|double[- ]?double)\b/i.test(message) ||
      /\bhas\b.*\b(scored|had|gotten)\b.*\d+[+-]?/i.test(message) ||
      // Quarter analytics patterns
      /\bhow many times\b.*\bscored?\b.*\d+/i.test(message) ||
      /\b(first|1st|second|2nd|third|3rd|fourth|4th)\s*(quarter|q)\b/i.test(message) ||
      /\b(q1|q2|q3|q4)\b/i.test(message) ||
      /\b(quarter|quarters)\b.*\b(score|scored|average|avg|win|won)\b/i.test(message) ||
      /\b(score|scored)\b.*\b(quarter|q1|q2|q3|q4)\b/i.test(message) ||
      /\b(first|score first|first to score|first basket)\b/i.test(message) ||
      /\bwho (scores?|wins?)\b.*\bquarter\b/i.test(message)
    )

    const bettingSplitsIntent =
      /\b(public money|sharp money|betting\s+splits?|betting\s+split|% of bets|% of money|handle%|tickets%|handle share|ticket share|public side)\b/i.test(
        message
      ) ||
      /\bwhere (is|are) the (public|money)\b/i.test(message) ||
      /\b(all|today|tonight|games?)\b.*\bsplits\b/i.test(message)

    const crossMarketEVIntent =
      /\bcross.?market\s*(ev|value)\b/i.test(message) ||
      /\b(ev|expected\s+value)\s*opportunit/i.test(message) ||
      /\bbooks?\s+(disagree|different|vary)/i.test(message) ||
      /\b(find|show|get)\s*(me\s*)?\+?ev\s*(plays?|bets?|opportunit)?\b/i.test(message) ||
      /\bvalue\s+plays?\s+(across|between)\s+books?\b/i.test(message)

    // Skip unified pipeline for:
    // - Explicit odds/betting line requests (need real-time odds)
    // - Player prop requests (need prop data)
    // - Model-related requests
    // - Bank roll/bet tracking
    // BUT: Skip betting splits (handled with deterministic SBD formatting)
    let analysisIntent = false
    let pickGuidanceIntent = false

    // Check for explicit analysis intent early (before analysisIntent is fully computed)
    // Team validation happens later in the handler
    const hasExplicitAnalysisKeyword = /\b(analy(?:ze|sis)|breakdown)\b/i.test(message) &&
      /\b(vs\.?|versus|@)\b/i.test(message)

    // Early edge awareness pattern check (full intent detection happens later)
    const earlyEdgeAwarenessCheck = /\bedge\s*awareness\b/i.test(message) ||
      /\b(run|do|check|show)\s+edge\s*awareness\b/i.test(message)

    // Early slate edge detection check - handles "edge detection for slate/all games"
    const slateEdgeDetectionIntent =
      (/\bedge\s*detection\b/i.test(message) && /\b(slate|all\s*games?|tonight|today)\b/i.test(message)) ||
      /\b(run|do|check|scan)\s+edge\s*detection\b.*\b(nba|nfl|mlb|nhl|ncaa)\b/i.test(message) ||
      /\b(nba|nfl|mlb|nhl|ncaa)\b.*\bedge\s*detection\b/i.test(message) ||
      /\bslate.*edge/i.test(message) ||
      /\bedges?\s+(for|on|across)\s+(the\s+)?(all\s+)?games?\b/i.test(message)

    if (slateEdgeDetectionIntent) {
      console.log('[SLATE EDGE] Detected slate edge detection intent, bypassing LLM')
      const { analyzeSlateEdges, formatSlateEdgesForChat } = await import('@/lib/services/slate-edge-detector')

      // Detect sport from message
      let sport = 'basketball_nba'
      if (/\bnfl\b/i.test(message)) sport = 'americanfootball_nfl'
      else if (/\bmlb\b/i.test(message)) sport = 'baseball_mlb'
      else if (/\bnhl\b/i.test(message)) sport = 'icehockey_nhl'
      else if (/\bncaab\b|college\s*basketball\b/i.test(message)) sport = 'basketball_ncaab'
      else if (/\bncaaf\b|college\s*football\b/i.test(message)) sport = 'americanfootball_ncaaf'

      // Detect minEdge filter
      let minEdge: 'soft' | 'strong' | undefined = undefined
      if (/\bstrong\b/i.test(message)) minEdge = 'strong'
      else if (/\bsoft\b/i.test(message)) minEdge = 'soft'

      const result = await analyzeSlateEdges(sport, { minEdge })
      const formatted = formatSlateEdgesForChat(result)

      // streamTextResponse handles saving to database
      return streamTextResponse(formatted)
    }

    const skipUnifiedPipeline = (
      (/\b(odds|moneyline|spread line|total line|prop|parlay|bet slip|bankroll|my bets|place bet)\b/i.test(message) &&
       !/\b(betting|public)\s+(split|splits|percentage)\b/i.test(message) &&
       !/\b(sharp|smart)\s+(money|action)\b/i.test(message)) ||
      /\b(create model|run model|save model|research model)\b/i.test(message) ||
      /\b(tonight|today|tomorrow).*\b(odds|lines|games)\b/i.test(message) ||
        /\b(projected?|projection)(\s+live)?(\s+betting)?(\s+(line|spread|total|moneyline))/i.test(message) ||
        /\blive\s+(betting\s+)?(projected?|projection)/i.test(message) ||
        bettingSplitsIntent ||
        crossMarketEVIntent ||
        hasExplicitAnalysisKeyword ||
        analysisIntent ||
        pickGuidanceIntent ||
        earlyEdgeAwarenessCheck
      )

    // Debug logging for pattern matching
    console.log('[UNIFIED] isStatsQuery:', isStatsQuery, 'skipUnifiedPipeline:', skipUnifiedPipeline, 'query:', message.substring(0, 100))

    if (isStatsQuery && !skipUnifiedPipeline) {
      try {
        console.log('[UNIFIED] Processing query via unified pipeline')
        const conversationHistory = messages
          .filter((m: any) => m.role === 'user' || m.role === 'assistant')
          .map((m: any) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

        const unifiedResult = await processUnifiedQuery(message, { conversationHistory })

        if (unifiedResult.reply && !unifiedResult.fallback) {
          // Save the assistant response
          await supabase.from('messages').insert({
            conversation_id: conversationId,
            role: 'assistant',
            content: unifiedResult.reply,
          })

          console.log('[UNIFIED] Successfully processed, tools used:', unifiedResult.toolsUsed)

          // Return streaming response with status events for tools that were used
          const encoder = new TextEncoder()
          const stream = new ReadableStream({
            start(controller) {
              // Emit status events for each tool that was used
              if (unifiedResult.toolsUsed && Array.isArray(unifiedResult.toolsUsed)) {
                for (const toolName of unifiedResult.toolsUsed) {
                  console.log('[UNIFIED] Emitting status event for tool:', toolName)
                  const statusEvent = `data: ${JSON.stringify({
                    type: 'status',
                    operation: toolName,
                    timestamp: Date.now()
                  })}\n\n`
                  controller.enqueue(encoder.encode(statusEvent))
                }
              }

              // Emit the final content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: unifiedResult.reply })}\n\n`))
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            },
          })

          return new Response(stream, {
            headers: {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              Connection: 'keep-alive',
            },
          })
        }
        // If fallback, continue to existing logic
        console.log('[UNIFIED] Falling back to existing pipeline')
      } catch (unifiedError) {
        console.error('[UNIFIED] Error, falling back:', unifiedError)
        // Continue to existing logic on error
      }
    }
    // ========================================
    // END UNIFIED QUERY PIPELINE
    // ========================================

    // Fetch user context
    const { data: userData } = await supabase
      .from('users')
      .select('current_bankroll, starting_bankroll')
      .eq('id', userId)
      .single()

    // Fetch active bets
    const { data: activeBets } = await supabase
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'pending')
      .order('placed_at', { ascending: false })
      .limit(5)

    // Fetch recent settled bets for memory/analysis
    const { data: recentBets } = await supabase
      .from('bets')
      .select('game_description,bet_side,stake,status,actual_result,placed_at,odds,book')
      .eq('user_id', userId)
      .neq('status', 'pending')
      .order('placed_at', { ascending: false })
      .limit(10)

    let recentModels: CustomModelRow[] = []
    try {
      recentModels = await listCustomModels(supabase, userId, 5)
    } catch (error) {
      console.error('[MODELS] Failed to load custom models:', error)
    }

    // Build context
    const modeDirectives: Record<string, string> = {
      regular: '- Mode: Regular +óGé¼GÇ¥ focus on education and betting know-how. Do NOT call live odds or player prop tools unless the user explicitly asks for data.',
      live: '- Mode: Live +óGé¼GÇ¥ prioritize fresh odds/props; if data is missing, say so briefly. Keep replies concise.',
      research: '- Mode: Research +óGé¼GÇ¥ confirm scope (sports, markets, filters, data to use) before running research tools. If a model_id is provided, prefer calling run_research_model with that ID.',
    }

    let contextMessage = `\n\n**Current User Context:**\n`
    contextMessage += `${modeDirectives[mode] || `- Mode: ${mode}`}\n`
    // Research model can be selected later in chat; no preset model_id here.
    if (userData) {
      const currentBankroll = Number(userData.current_bankroll ?? 0)
      const startingBankroll = Number(userData.starting_bankroll ?? 0)

      contextMessage += `- Bankroll: $${currentBankroll.toFixed(2)}\n`
      contextMessage += `- Starting: $${startingBankroll.toFixed(2)}\n`
    }
    if (activeBets && activeBets.length > 0) {
      contextMessage += `- Active bets: ${activeBets.length}\n`
    }
    if (recentBets && recentBets.length > 0) {
      const recentSummary = recentBets.slice(0, 5).map((b) => {
        const result = b.status === 'won' ? `+${Number(b.actual_result || 0).toFixed(2)}` : Number(b.actual_result || 0).toFixed(2)
        return `${b.game_description || b.bet_side || 'bet'} (${b.status}${b.book ? ` @ ${b.book}` : ''}, ${result})`
      }).join('; ')
      contextMessage += `- Recent bets: ${recentSummary}\n`
    }
    if (recentModels.length > 0) {
      contextMessage += `- Custom models ready: ${recentModels
        .map((model) => `${model.model_name} (${model.sport_key.toUpperCase()} ${model.market_type})`)
        .join(', ')}\n`
      contextMessage += `\n**Saved Models Overview:**\n`
      recentModels.forEach((model) => {
        contextMessage += `- ${model.model_name}: target ${model.target_metric}, confidence ${(Number(model.confidence_level) * 100).toFixed(0)}%, last used ${model.last_used_at ? format(new Date(model.last_used_at), 'MMM d @ h:mm a') : 'n/a'}\n`
      })
    } else {
      contextMessage += '- Custom models ready: none yet (offer to help user build one)\n'
    }

    const msgLower = message.toLowerCase()
    const oddsKeywordMatch = msgLower.match(
      /(odds|lines|spread|moneyline|total|over|under|bet|game|match|tonight|today|tomorrow|arbitrage|arb)/i
    )
    const scheduleIntent = /(games?|schedule|who plays|playing|matchups?|match|game time|tipoff|puck drop|first pitch|score|scores?|final|quarter|period|inning|today|tonight|tomorrow)\b/i.test(msgLower)
    const wantsLiveOdds = /(live|in-play|inplay|scores?|score|current|now|ongoing)/i.test(msgLower)

    // Analysis mode disabled: skip deep-dive enrichment
    const wantsDeepDive = false

    const teamVariations: { [key: string]: string[] } = {
      // NBA Teams (base name as key)
      'lakers': ['lakers', 'la lakers', 'los angeles lakers', 'l.a. lakers'],
      'warriors': ['warriors', 'golden state', 'gsw'],
      'celtics': ['celtics', 'boston'],
      'heat': ['heat', 'miami heat'],
      'bucks': ['bucks', 'milwaukee'],
      'suns': ['suns', 'phoenix'],
      'nets': ['nets', 'brooklyn'],
      'nuggets': ['nuggets', 'denver'],
      'clippers': ['clippers', 'la clippers', 'los angeles clippers'],
      'mavericks': ['mavericks', 'mavs', 'dallas'],
      'grizzlies': ['grizzlies', 'memphis'],
      'timberwolves': ['timberwolves', 'wolves', 'minnesota', 't-wolves'],
      'pelicans': ['pelicans', 'pels', 'new orleans'],
      'kings': ['kings', 'sacramento'],
      'sixers': ['76ers', 'sixers', 'philadelphia', 'philly'],
      'knicks': ['knicks', 'new york knicks', 'ny knicks'],
      'hawks': ['hawks', 'atlanta'],
      'bulls': ['bulls', 'chicago bulls'],
      'cavaliers': ['cavaliers', 'cavs', 'cleveland'],
      'raptors': ['raptors', 'toronto'],
      'pacers': ['pacers', 'indiana'],
      'magic': ['magic', 'orlando'],
      'hornets': ['hornets', 'charlotte'],
      'pistons': ['pistons', 'detroit'],
      'wizards': ['wizards', 'washington'],
      'thunder': ['thunder', 'okc', 'oklahoma city'],
      'jazz': ['jazz', 'utah'],
      'rockets': ['rockets', 'houston rockets'],
      'spurs': ['spurs', 'san antonio'],
      'blazers': ['blazers', 'trail blazers', 'portland'],
      // NFL Teams
      'chiefs': ['chiefs', 'kansas city', 'kc'],
      'bills': ['bills', 'buffalo'],
      'bengals': ['bengals', 'cincinnati'],
      'ravens': ['ravens', 'baltimore'],
      '49ers': ['49ers', 'niners', 'san francisco', 'sf'],
      'eagles': ['eagles', 'philadelphia eagles'],
      'cowboys': ['cowboys', 'dallas cowboys'],
      'packers': ['packers', 'green bay'],
      'rams': ['rams', 'la rams', 'los angeles rams'],
      'buccaneers': ['buccaneers', 'bucs', 'tampa bay', 'tampa'],
      'chargers': ['chargers', 'la chargers', 'los angeles chargers'],
      'dolphins': ['dolphins', 'miami dolphins'],
      'jets': ['jets', 'new york jets', 'ny jets'],
      'patriots': ['patriots', 'pats', 'new england'],
      'raiders': ['raiders', 'las vegas', 'lv raiders'],
      'broncos': ['broncos', 'denver broncos'],
      'colts': ['colts', 'indianapolis'],
      'jaguars': ['jaguars', 'jags', 'jacksonville'],
      'titans': ['titans', 'tennessee'],
      'texans': ['texans', 'houston texans'],
      'steelers': ['steelers', 'pittsburgh'],
      'browns': ['browns', 'cleveland browns'],
      'saints': ['saints', 'new orleans saints'],
      'seahawks': ['seahawks', 'seattle'],
      'panthers': ['panthers', 'carolina'],
      'falcons': ['falcons', 'atlanta falcons'],
      'cardinals': ['cardinals', 'arizona cardinals'],
      'vikings': ['vikings', 'minnesota vikings'],
      'lions': ['lions', 'detroit lions'],
      'bears': ['bears', 'chicago bears'],
      'commanders': ['commanders', 'washington commanders'],
      'giants': ['giants', 'new york giants', 'ny giants'],
    }

    const extractTeamNames = (msg: string): string[] => {
      const foundTeams: string[] = []
      const lowerMsg = msg.toLowerCase()

      for (const [baseTeam, variations] of Object.entries(teamVariations) as [string, string[]][]) {
        if (variations.some((variation) => lowerMsg.includes(variation))) {
          foundTeams.push(baseTeam)
        }
      }

      return foundTeams
    }

    const normalizeTeamList = (names: string[]): string[] => {
      const banned =
        /\b(odds?|lines?|spread|total|moneyline|betting|bets?|public|sharp|money|handle|tickets?|split|splits|percent(?:age)?s?|ncaab|ncaa|college|basketball|prop|props|make|sense|analysis|analyze|edge|value|project|projection|proj)\b/gi
      const cleaned = names
        .map((name) =>
          name
            .toLowerCase()
            .replace(/[^\w\s.'&-]/g, ' ')
            .replace(/\bst[.]?\s+/g, 'st ')
            .replace(banned, ' ')
            .replace(/\s+/g, ' ')
            .trim()
        )
        .filter(Boolean)
      return Array.from(new Set(cleaned))
    }

    const mentionedTeams = extractTeamNames(msgLower)
    console.log('[DEBUG] Mentioned teams detected:', mentionedTeams)
    const parsedMatchupTeams = (() => {
      // Find "vs" pattern and extract team names immediately around it (max 3 words each)
      const vsIndex = message.search(/\s+(?:vs\.?|v\.?|@)\s+/i)
      if (vsIndex < 0) return []

      const beforeVs = message.substring(0, vsIndex)
      const afterVs = message.substring(vsIndex)

      console.log('[DEBUG] VS parsing:', { vsIndex, beforeVs: beforeVs.slice(-30), afterVs: afterVs.slice(0, 30) })

      // Extract up to 3 words before "vs" (from the end), filtering out common non-team words
      const team1Raw = beforeVs.match(/([a-z]+(?:\s+[a-z.'&-]+){0,2})$/i)?.[1] || ''
      // Simplified team2 pattern - just capture words after "vs" without restrictive lookahead
      const team2Raw = afterVs.match(/^\s*(?:vs\.?|v\.?|@)\s+([a-z]+(?:\s+[a-z.'&-]+){0,2})/i)?.[1] || ''

      console.log('[DEBUG] Raw team matches:', { team1Raw, team2Raw })

      if (!team1Raw || !team2Raw) return []

      // Remove common leading/trailing words that aren't part of team names (iteratively)
      const cleanTeamName = (name: string): string => {
        let cleaned = name.trim()
        let prevCleaned = ''
        // Keep removing stop words until no more changes
        while (cleaned !== prevCleaned) {
          prevCleaned = cleaned
          cleaned = cleaned
            .replace(/^(the|in|at|on|for|with|against|versus|vs|analyze|analysis|show|get|find|compare|breakdown)\s+/i, '')
            .replace(
              /\s+(game|match|matchup|matchups?|tonight|today|tomorrow|in|at|on|betting|splits?|public|sharp|money|bets?|handle|tickets?|percent(?:age)?s?|odds?|lines?|spread|total|moneyline|prop|props|make|sense|analysis|analyze|edge|value|project|projection|proj|points|pts|rebounds|rebs|reb|assists|asts|ast|steals|stl|blocks|blk|threes|3pm|3pt|pra)$/i,
              ''
            )
            .trim()
        }
        return cleaned
      }

      const team1Clean = cleanTeamName(team1Raw)
      const team2Clean = cleanTeamName(team2Raw)

      console.log('[DEBUG] Cleaned teams:', { team1Clean, team2Clean })

      if (!team1Clean || !team2Clean) return []
      return normalizeTeamList([team1Clean, team2Clean])
    })()
    if (parsedMatchupTeams.length) {
      console.log('[DEBUG] Parsed matchup teams:', parsedMatchupTeams)
    }

    function formatTeamProfile(team: any, stats: Record<string, any>) {
      const fmt = (val: any, decimals = 1) => {
        if (val == null || val === '') return 'N/A'
        const num = Number(val)
        if (!Number.isNaN(num)) return num.toFixed(decimals).replace(/\.0+$/, '')
        return String(val)
      }

      // Basic stats table
      const basicHeaders = ['PPG', 'PAPG', 'FG%', '3P%', 'REB', 'AST', 'STL', 'BLK', 'TOV']
      const basicRow = [
        fmt(stats.pointsForPerGame),
        fmt(stats.pointsAgainstPerGame),
        fmt(stats.fieldGoalPct),
        fmt(stats.threePointPct),
        fmt(stats.reboundsPerGame),
        fmt(stats.assistsPerGame),
        fmt(stats.stealsPerGame),
        fmt(stats.blocksPerGame),
        fmt(stats.turnoversPerGame),
      ]

      // Advanced stats table
      const advHeaders = ['Pace', 'ORtg', 'DRtg', 'Net', 'eFG%', 'TS%', 'TOV%', 'ORB%']
      const netRating = stats.offensiveRating != null && stats.defensiveRating != null
        ? (Number(stats.offensiveRating) - Number(stats.defensiveRating)).toFixed(1)
        : 'N/A'
      const advRow = [
        fmt(stats.pace),
        fmt(stats.offensiveRating),
        fmt(stats.defensiveRating),
        netRating,
        fmt(stats.effectiveFgPct ?? stats.eFG_PCT),
        fmt(stats.trueShootingPct ?? stats.TS_PCT),
        fmt(stats.turnoverPct ?? stats.TOV_PCT),
        fmt(stats.offensiveReboundPct ?? stats.ORB_PCT),
      ]

      const formatTable = (headers: string[], row: string[]) => {
        const header = `| ${headers.join(' | ')} |`
        const divider = `| ${headers.map(() => '---').join(' | ')} |`
        const rowLine = `| ${row.join(' | ')} |`
        return `${header}\n${divider}\n${rowLine}`
      }

      return {
        basic: formatTable(basicHeaders, basicRow),
        advanced: formatTable(advHeaders, advRow),
      }
    }

    function resolveTeamStats(teamNames: string[]) {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'americanfootball_nfl' :
        msgLower.match(/mlb|baseball/) ? 'baseball_mlb' :
        msgLower.match(/nhl|hockey/) ? 'icehockey_nhl' :
        msgLower.match(/ncaab|college basketball|cbb/) ? 'basketball_ncaab' :
        'basketball_nba'

      const target = teamNames[0]
      return getTeamStats(sportGuess, target).then(async (stats) => {
        if (!stats.length) {
          return streamTextResponse(`I couldn't find team stats for ${target || 'that team'}. Please check the name or sport.`)
        }

        const team = stats[0]
        const form = team.stats || {}
        const fmt = (val: any, digits = 1) => {
          if (val == null) return 'N/A'
          const num = Number(val)
          if (Number.isNaN(num)) return String(val)
          return num.toFixed(digits).replace(/\.0+$/, '')
        }

        // Use friendly team name for display (convert abbreviation like "BRK" to "Brooklyn Nets")
        const displayName = sportGuess === 'basketball_nba' ? getFullTeamName(team.team) : team.team
        const tables = formatTeamProfile({ ...team, team: displayName }, form)

        const lines = [
          `**${displayName}** (${team.wins}-${team.losses}, ${fmt(team.winPct * 100)}%)`,
          '',
          '**Per Game Stats**',
          tables.basic,
          '',
          '**Advanced Stats**',
          tables.advanced,
        ]
        return streamTextResponse(lines.join('\n'))
      })
    }
    const pickOpponentThrees = (stats: Record<string, any>): number | null => {
      const candidates = [
        stats?.opponentThreeMadePerGame,
        stats?.opponentThreesMadePerGame,
        stats?.threePointersAllowedPerGame,
        stats?.threesAllowedPerGame,
        stats?.OPP_3P,
      ]
      for (const c of candidates) {
        const n = Number(c)
        if (Number.isFinite(n)) return n
      }
      return null
    }
    const pickMadeThrees = (stats: Record<string, any>): number | null => {
      const candidates = [
        stats?.threesMadePerGame,
        stats?.threePointersMadePerGame,
        stats?.THREES_PER_G,
        stats?.THREE_PM,
        stats?.threeP,
        stats?.threePointMade,
      ]
      for (const c of candidates) {
        const n = Number(c)
        if (Number.isFinite(n)) return n
      }
      return null
    }
    const pickStatValue = (stats: Record<string, any>, key: string): number | null => {
      const num = (...vals: any[]) => {
        for (const v of vals) {
          const n = Number(v)
          if (Number.isFinite(n)) return n
        }
        return null
      }
      switch (key) {
        case '3pm':
          return pickMadeThrees(stats)
        case '3pa':
          return num(stats?.threesAttemptedPerGame, stats?.threePointersAttemptedPerGame)
        case 'opp3pm':
          return pickOpponentThrees(stats)
        case 'opp3pa':
          return num(
            stats?.opponentThreeAttemptedPerGame,
            stats?.opponentThreesAttemptedPerGame,
            stats?.threePointersAllowedAttemptedPerGame,
            stats?.threesAllowedAttemptedPerGame
          )
        case 'ppg':
          return num(stats?.pointsForPerGame, stats?.pointsFor)
        case 'papg':
          return num(stats?.pointsAgainstPerGame, stats?.pointsAgainst)
        case 'ortg':
          return num(stats?.offensiveRating, stats?.OFF_RTG, stats?.ortg)
        case 'drtg':
          return num(stats?.defensiveRating, stats?.DEF_RTG, stats?.drtg)
        case 'net':
          return num(
            stats?.netRating,
            stats?.NET_RTG,
            stats?.offensiveRating != null && stats?.defensiveRating != null
              ? Number(stats.offensiveRating) - Number(stats.defensiveRating)
              : null
          )
        case 'pace':
          return num(stats?.pace, stats?.PACE)
        case 'fgpct':
          return num(stats?.fieldGoalPct)
        case 'threepct':
          return num(stats?.threePointPct)
        case 'ftpct':
          return num(stats?.freeThrowPct)
        case 'tspct':
          return num(stats?.trueShootingPct, stats?.TS_PCT)
        case 'efgpct':
          return num(stats?.effectiveFgPct, stats?.EFG_PCT)
        case 'reb':
          return num(stats?.reboundsPerGame, stats?.TRB, stats?.REB)
        case 'oreb':
          return num(stats?.offensiveReboundsPerGame, stats?.ORB)
        case 'dreb':
          return num(stats?.defensiveReboundsPerGame, stats?.DRB)
        case 'ast':
          return num(stats?.assistsPerGame, stats?.AST)
        case 'stl':
          return num(stats?.stealsPerGame, stats?.STL)
        case 'blk':
          return num(stats?.blocksPerGame, stats?.BLK)
        case 'tov':
          return num(stats?.turnoversPerGame, stats?.TOV)
        case 'pf':
          return num(stats?.personalFoulsPerGame, stats?.PF)
        default:
          return null
      }
    }

    let cachedOpponent3pm: Array<{ team: string; val: number }> | null = null
    const getOpponent3pmFromCsv = () => {
      if (cachedOpponent3pm) return cachedOpponent3pm
      const rows = nbaTeamPerGame2025_2026Csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && /^\d+,/.test(l))
        .map((line) => line.split(','))
        .filter((cells) => cells.length >= 43)
        .map((cells) => ({ team: cells[2], val: Number(cells[30]) }))
        .filter((r) => Number.isFinite(r.val))
      cachedOpponent3pm = rows as Array<{ team: string; val: number }>
      return cachedOpponent3pm
    }

    let cachedMade3pm: Array<{ team: string; val: number }> | null = null
    const getMade3pmFromCsv = () => {
      if (cachedMade3pm) return cachedMade3pm
      const rows = nbaTeamPerGame2025_2026Csv
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l && /^\d+,/.test(l))
        .map((line) => line.split(','))
        .filter((cells) => cells.length >= 15)
        .map((cells) => ({ team: cells[2], val: Number(cells[13]) }))
        .filter((r) => Number.isFinite(r.val))
      cachedMade3pm = rows as Array<{ team: string; val: number }>
      return cachedMade3pm
    }
    type SportKey = 'nba' | 'nfl' | 'mlb' | 'nhl'
    const playerNameInMessage = bettingSplitsIntent ? undefined : extractPlayerName(message)
    const isProjectionQuery = /\b(projected?|projection)\s+(live\s+)?(line|spread|total|moneyline)|live\s+(betting\s+)?(projected?|projection)/i.test(msgLower)
    const extractTwoPlayers = (): string[] => {
      const vsSplit = message.split(/\bvs\.?\b|\bversus\b/i)
      if (vsSplit.length === 2) {
        const left = vsSplit[0].replace(/compare|stats?|versus|vs\.?/gi, '').trim()
        const right = vsSplit[1].replace(/compare|stats?|versus|vs\.?/gi, '').trim()
        return [left, right].filter(Boolean)
      }
      const andSplit: string[] = message.split(/\band\b/i)
      if (andSplit.length === 2) {
        return andSplit
          .map((p: string) => p.replace(/compare|stats?/gi, '').trim())
          .filter(Boolean)
      }
      return []
    }
    const playerCompareCandidates = extractTwoPlayers()
    const hasPropLanguage = /\bprop\b/.test(msgLower)
    const hasMakeSense = /\bmake\s+sense\b/.test(msgLower)
    const playerCompareIntent =
      playerCompareCandidates.length === 2 &&
      /\bcompare\b|\bvs\b|\bversus\b/i.test(msgLower) &&
      !isProjectionQuery &&
      !bettingSplitsIntent &&
      !hasPropLanguage &&
      !hasMakeSense
    const hasNumber = /\d/.test(msgLower)
      const propIntent =
        Boolean(playerNameInMessage) &&
        (/\bplayer props?\b/.test(msgLower) ||
          /\b(points|rebounds|assists|threes|blocks|steals|yards|tds|receptions|pra|fantasy)\s+(prop|line)\b/.test(
            msgLower
          ) ||
          /\bprop\b.*\b(points|rebounds|assists|threes|blocks|steals|yards|tds|receptions|pra|fantasy)\b/.test(
            msgLower
          ) ||
          // Standalone prop stat keywords with player name (for edge awareness, analysis, etc.)
          /\b(points|pts|rebounds|rebs|reb|assists|asts|ast|threes|3pm|3pt|blocks|blk|steals|stl|pra)\b/.test(msgLower))
      const marketTypeHint = inferMarketType(message)
      const hasSpecificMatchup = parsedMatchupTeams.length >= 2 || mentionedTeams.length >= 2
    const hasSpecificProp = Boolean(playerNameInMessage) && marketTypeHint === 'player_prop'
    const marketKeywordIntent =
      /\b(spread|moneyline|total|over|under|prop|line|o\/u|quarter|q1|q2|q3|q4|first half|1h|second half|2h)\b/i.test(
        msgLower
      )
    // NEW: Matchup Analysis intent (team vs team markets - spread, ML, totals)
    const matchupAnalysisIntent =
      /\b(matchup analysis|analyze matchup|matchup breakdown)\b/i.test(msgLower) ||
      /\b(analyze|breakdown|analysis)\s+(the\s+)?(spread|total|over|under|moneyline|ml)\b/i.test(msgLower) ||
      // Edge/value on team markets (no player name)
      (/\b(edge|value|mispriced)\b/i.test(msgLower) && mentionedTeams.length >= 2 && !playerNameInMessage) ||
      (/\b(spread|total|over.?under|moneyline)\b/i.test(msgLower) && /\b(edge|analysis|value)\b/i.test(msgLower) && !playerNameInMessage) ||
      // "is there an edge" + matchup (no player)
      (/\bis\s+there\s+an?\s+edge\b/i.test(msgLower) && mentionedTeams.length >= 2 && !playerNameInMessage) ||
      // "edge in" + matchup (no player)
      (/\bedge\s+in\b/i.test(msgLower) && mentionedTeams.length >= 2 && !playerNameInMessage) ||
      // "edge" + "vs/versus" pattern (no player)
      (/\bedge\b/i.test(msgLower) && /\b(vs\.?|versus)\b/i.test(msgLower) && !playerNameInMessage) ||
      // "edge" + matchup/game + teams (no player)
      (/\bedge\b/i.test(msgLower) && /\b(matchup|game)\b/i.test(msgLower) && mentionedTeams.length >= 1 && !playerNameInMessage) ||
      // "edge on" + team (no player)
      (/\bedge\s+on\b/i.test(msgLower) && mentionedTeams.length >= 1 && !playerNameInMessage) ||
      // "find edge" + matchup (no player)
      (/\b(find|spot|get|check)\s+(an?\s+)?edge\b/i.test(msgLower) && mentionedTeams.length >= 2 && !playerNameInMessage) ||
      // "line looks off/wrong" for team markets
      (/\bline\s+looks?\s+(off|wrong|mispriced|soft)\b/i.test(msgLower) && !playerNameInMessage) ||
      // "soft/sharp/bad line" for team markets
      (/\b(soft|sharp|bad)\s+line\b/i.test(msgLower) && !playerNameInMessage)

    // NEW: Player Analysis intent (player props only)
    const playerAnalysisIntent =
      /\b(player analysis|analyze player|player breakdown)\b/i.test(msgLower) ||
      // Player + prop stat + analysis/edge/value keywords
      (playerNameInMessage && propIntent && /\b(analy(?:ze|sis)|edge|value|mispriced|make\s+sense|worth|overvalued|undervalued)\b/i.test(msgLower)) ||
      // Player + projection
      (playerNameInMessage && propIntent && /\bproject(?:ion|ed)?\b|\bproject\b/i.test(msgLower)) ||
      (playerNameInMessage && /\bproject(?:ion|ed)?\b|\bproject\b/i.test(msgLower) && /\b(points|rebounds|assists|threes|blocks|steals|pra)\b/i.test(msgLower)) ||
      // "is there edge on [player] [stat]"
      (/\bis\s+there\s+an?\s+edge\b/i.test(msgLower) && playerNameInMessage) ||
      // "edge on [player]"
      (/\bedge\s+on\b/i.test(msgLower) && playerNameInMessage) ||
      // "[stat] prop make sense" (with player context)
      (/\b(points|rebounds|assists|threes|blocks|steals|pra)\s+prop\s+make\s+sense\b/i.test(msgLower)) ||
      // "prop doesn't make sense" (player prop)
      (/\bprop(s)?\s+(doesn'?t|does\s+not|dont)\s+make\s+sense\b/i.test(msgLower)) ||
      // "mispriced prop"
      (/\bmispriced\s+prop\b/i.test(msgLower)) ||
      // "value check" with player
      (/\b(value check|check value|is there value)\b/i.test(msgLower) && playerNameInMessage) ||
      // "check edge on [player]"
      (/\b(check|find|spot)\s+(the\s+)?edge\b/i.test(msgLower) && playerNameInMessage)

    if (matchupAnalysisIntent) {
      console.log('[DEBUG] matchupAnalysisIntent triggered:', { mentionedTeams, playerNameInMessage })
    }
    if (playerAnalysisIntent) {
      console.log('[DEBUG] playerAnalysisIntent triggered:', { playerNameInMessage, propIntent, mentionedTeams })
    }

    // Legacy alias for backward compatibility (will be removed after full migration)
    const edgeAwarenessIntent = matchupAnalysisIntent || playerAnalysisIntent

    const explicitAnalysisIntent = /\b(analy(?:ze|sis)|breakdown|edge|value|mispriced|line makes sense)\b/i.test(msgLower)
    analysisIntent =
      !edgeAwarenessIntent &&
      (explicitAnalysisIntent ||
        (marketKeywordIntent && (hasSpecificMatchup || hasSpecificProp)))
    pickGuidanceIntent =
      /\b(best bet|best pick|pick\b|lock\b|who wins|winner|what should i bet|what's the play|should i bet)\b/i.test(
        msgLower
      ) && !analysisIntent && !edgeAwarenessIntent
      const betIntent = /(log|track|record)\s+(my\s+)?bet\b|i\s+bet\s+\$?\d+/i.test(msgLower) || /settle\s+my\s+bet/i.test(msgLower)
    const webSearchToggle = /enable_web_search|enable\s+web\s+search/i.test(msgLower)
    const wantsEdgesOrValue = /(edge|ev|expected\s+value|value\s+bet|mispriced|best\s+bet)/i.test(msgLower)
    const mentionsModel = /model/i.test(msgLower)
    const intent = detectIntent(msgLower)
    const twoTeamOddsQuery =
      /\b(vs|vs\.|versus)\b/.test(msgLower) && /\b(odds|line|over\/under|o\/u|total|spread)\b/.test(msgLower)
    const conceptualStatsOnly =
      !twoTeamOddsQuery &&
      !propIntent &&
      !hasNumber &&
      /\badvanced stats?\b/.test(msgLower || '') &&
      /why|best|which|what/.test(msgLower || '')

    const pointTotalConceptualAsk =
      /point total|points\s+(prop|line)?|scoring total/.test(msgLower || '') &&
      (/\badvanced\b/.test(msgLower || '') || /\bstats?\b/.test(msgLower || '') || /\bmetrics?\b/.test(msgLower || '')) &&
      /what|which|best|why|how\b/.test(msgLower || '') &&
      !twoTeamOddsQuery &&
      !propIntent
    const leaderboardIntent = /\bwho has the most\b|\bmost\s+\d+[\s-]*point games\b/i.test(msgLower)
    const leaderboardThresholdMatch = message.match(/most\s+(\d+)[\s-]*point games/i)
    const noRestIntent = /\b(no rest|back to back|back-to-back|b2b)\b/i.test(msgLower)
    const vsOpponentIntent = /\bvs\s+([a-zA-Z][a-zA-Z\s]+)\b/i.exec(message)
    const atsLeadersIntent = /\bcover (the )?spread\b|\bats (leaders|records|best)\b|\bbest ats\b/i.test(msgLower)
    const afterLossIntent = /\bafter a loss\b|\bfollowing a loss\b/i.test(msgLower)
    const homeAwayDefenseIntent =
      /\b(home vs away defense|home and away defense|defensive stats at home|defensive stats away|home away defense)\b/i.test(msgLower)

    const playerGameIntent = (() => {
      const isoMatch = message.match(/\b(\d{4})-(\d{2})-(\d{2})\b/)
      const dateMatch =
        isoMatch ||
        message.match(/(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?/) ||
        message.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2}/i)
      const wantsLastNight = /\blast\s+night\b|yesterday|last game\b/i.test(msgLower)
      const lastNMatch = message.match(/\blast\s+(\d+)\s+games?/i)
      const lastN = lastNMatch ? Number(lastNMatch[1]) : undefined

      const playerToken = normalizeToken(playerNameInMessage || '')
      const matchupOpp = parsedMatchupTeams.find((t) => !normalizeToken(t).includes(playerToken))
      const mentionedOpp = mentionedTeams.find((t) => !normalizeToken(t).includes(playerToken))
      const opponentHint = matchupOpp || mentionedOpp

      return {
        wantsGameLine: intent.playerGameLine || Boolean(dateMatch) || wantsLastNight || Boolean(opponentHint),
        dateHint: wantsLastNight
          ? parseDateFromMessage('last night')
          : isoMatch
          ? isoMatch[0]
          : dateMatch
          ? parseDateFromMessage(dateMatch[0])
          : undefined,
        opponentHint,
        lastN,
      }
    })()

    const getRecentLogStats = async (opts: {
      sport: string
      playerId: string
      playerName: string
      propType: string
      seasonYear: number
      maxGames?: number
      minSamples?: number
    }) => {
      const labelMap: Record<string, string> = {
        points: 'PTS',
        rebounds: 'REB',
        assists: 'AST',
        threes: '3PM',
        blocks: 'BLK',
        steals: 'STL',
        points_rebounds: 'PTS+REB',
        points_assists: 'PTS+AST',
        rebounds_assists: 'REB+AST',
        pra: 'PRA',
        blocks_steals: 'BLK+STL',
      }
      const maxGames = opts.maxGames ?? 5
      const minSamples = opts.minSamples ?? 3
      const statLabel = labelMap[opts.propType] || 'PTS'
      const logsRaw = await getPlayerGameLogs(
        opts.sport as any,
        String(opts.playerId),
        opts.seasonYear,
        2
      ).catch(() => [])
      const logs = Array.isArray(logsRaw) ? logsRaw : Object.values(logsRaw || {})
      logs.sort((a: any, b: any) => {
        const tA = new Date(String(a?.date || a?.gameDate || a?.game_date || '')).getTime()
        const tB = new Date(String(b?.date || b?.gameDate || b?.game_date || '')).getTime()
        return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0)
      })
      const recent = logs.slice(0, maxGames)
      const lines: string[] = []
      const values: number[] = []
      for (const entry of recent) {
        const date = String(entry?.date || entry?.gameDate || entry?.game_date || '').slice(0, 10)
        const opp =
          entry?.opponent?.displayName ||
          entry?.opponent?.name ||
          entry?.opponent ||
          entry?.opponentName ||
          entry?.gameOpponent ||
          ''
        let statMap = buildStatMapFromEspnEntry(entry)
        let value = getPropStatFromMap(statMap, opts.propType)
        if (value == null) {
          const eventId = String(entry?.id || entry?.eventId || '')
          if (eventId) {
            const snapshot = await getEventSnapshot('nba', eventId)
            const snapshotMap = extractStatMapFromSnapshot(snapshot, opts.playerId, opts.playerName)
            if (snapshotMap) {
              value = getPropStatFromMap(snapshotMap, opts.propType)
            }
          }
        }
        if (value != null) {
          values.push(value)
        }
        lines.push(`- ${date}${opp ? ` vs ${opp}` : ''}: ${value ?? 'n/a'} ${statLabel}`)
      }
      const average =
        values.length >= minSamples
          ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1))
          : null
      return { average, lines }
    }

    const lastNGamesMatch = message.match(/\blast\s+(\d+)\s+games?\b/i)
    if (lastNGamesMatch && !propIntent && !isProjectionQuery) {
      try {
        let playerName = extractPlayerName(message)
        if (!playerName) {
          return streamTextResponse('Tell me which player you want last-game logs for (e.g., "KD last 5 games").')
        }
        const cleanedTokens = playerName
          .toLowerCase()
          .split(/\s+/)
          .filter((token) => !['avg', 'average', 'last', 'games', 'game', 'points', 'pts', 'scored'].includes(token))
        if (cleanedTokens.length) playerName = cleanedTokens.join(' ')
        const normalizedName = playerName.toLowerCase()
        if (normalizedName === 'kd' || normalizedName === 'kds') playerName = 'kevin durant'

        const seasonYear = getEspnSeasonYearForLogs('nba')
        const searchHit = await searchPlayer(playerName, 'basketball_nba')
        const playerId = searchHit?.id
        if (!playerId) {
          return streamTextResponse(`I couldn't resolve ${playerName} for recent games.`)
        }
        const lastN = Number(lastNGamesMatch[1]) || 5
        const recent = await getRecentLogStats({
          sport: 'nba',
          playerId: String(playerId),
          playerName,
          propType: 'points',
          seasonYear,
          maxGames: lastN,
          minSamples: 1,
        })
        if (!recent.lines.length) {
          return streamTextResponse(`No recent game logs found for ${playerName}.`)
        }
        const avg = recent.average ?? 0
        const header = `${playerName} last ${lastN} games average: ${avg.toFixed(1)} PPG`
        return streamTextResponse([header, ...recent.lines, buildDataSourceLine(['ESPN'])].join('\n'))
      } catch (err) {
        console.error('[LAST_N_GAMES] Failed:', err)
        return streamTextResponse('Recent game logs are temporarily unavailable. Please try again.')
      }
    }

    // Conceptual advanced-stats questions (e.g., best metrics for point totals) should bypass odds/props
    if (pointTotalConceptualAsk || (conceptualStatsOnly && /\b(advanced stats?|metrics?)\b/.test(msgLower) && /point total|points\b/.test(msgLower))) {
      const lines = [
        'Key advanced stats for evaluating a player points total:',
        '- Usage rate + minutes: volume and opportunity ceiling.',
        '- Shooting efficiency: TS% / eFG%, 3PA rate, FT rate (FTA per FGA), rim vs midrange mix.',
        '- Volume drivers: FGA per 36, 3PA per 36, drives per game, touch time/on-ball rate.',
        '- Pace/context: team pace and offensive rating; opponent defensive rating/pace; projected possessions.',
        '- Matchup levers: opponent foul rate (helps FT), rim/paint defense, perimeter 3PA allowed, primary defender quality.',
        '- Role stability: starting vs bench, blowout risk, back-to-back fatigue, recent minutes consistency.',
      ]
      return streamTextResponse(lines.join('\n'))
    }

    // ESPN-only aggregation for player threshold/count queries (e.g., "how many games with 40+ points")
    const maybeHandlePlayerThreshold = async () => {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'

      const response = await resolvePlayerThresholdQuery({
        message,
        playerNameHint: playerNameInMessage,
        sportHint: sportGuess as SportKey,
        opponentHint: playerGameIntent.opponentHint,
      })
      return response ? streamTextResponse(response) : null
    }

    // ESPN-first shortcuts for ATS / odds records / past performances / predictor / futures / injuries
    const maybeHandleEspnTeamBetting = async () => {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        msgLower.match(/nba|basketball/) ? 'nba' :
        'nba'

      const targetTeam = mentionedTeams[0] || parsedMatchupTeams[0]
      if (!targetTeam) return null

      const trySports: SportKey[] = [sportGuess as any, 'nfl', 'nba', 'mlb', 'nhl']
      let resolved: { id: string; name: string; abbr?: string } | null = null
      let resolvedSport: SportKey = sportGuess as any
      for (const s of trySports) {
        const res = await resolveEspnTeamId(s, targetTeam)
        if (res) {
          resolved = res
          resolvedSport = s
          break
        }
      }

      if (!resolved) {
        return streamTextResponse(`I couldn't find that team on ESPN (tried NFL/NBA/MLB/NHL). Try a more exact team name.`)
      }

      const season = getSeasonYearForSport(resolvedSport)
      const seasonType = seasonTypeFromText(msgLower)

      if (!conceptualStatsOnly && (intent.ats || intent.overUnder) && twoTeamOddsQuery) {
        const splits = await computeTeamLineSplits({
          sport: resolvedSport,
          teamId: resolved.id,
          season,
          seasonType,
          providerPriority: ['1304', '878', '879', '1695', '1385'],
        })
        const formatted = formatTeamLineSplits(resolved.name, season, seasonType, splits)
        return streamTextResponse(formatted)
      }

      if (intent.oddsRecord) {
        const data = await espnToolResolvers.espnTeamOddsRecord({
          sport: resolvedSport,
          teamId: resolved.id,
          season,
        })
        return streamTextResponse(
          `Odds record for ${resolved.name} (${season}):\n${JSON.stringify(data, null, 2)}`
        )
      }

      if (intent.pastPerformances) {
        const data = await espnToolResolvers.espnTeamPastPerformances({
          sport: resolvedSport,
          teamId: resolved.id,
          providerId: '1003',
          limit: 140,
        })
        return streamTextResponse(
          `Past performances vs lines for ${resolved.name}:\n${JSON.stringify(data, null, 2)}`
        )
      }

      if (intent.futures) {
        const marketHint = inferFuturesMarketHint(msgLower)
        const data = await espnToolResolvers.espnTeamFutures({
          sport: resolvedSport,
          season,
          market: marketHint,
        })
        return streamTextResponse(
          `Futures for ${sportGuess.toUpperCase()} ${season}:\n${JSON.stringify(data, null, 2)}`
        )
      }

      return null
    }

    const playerGameStatsIntent =
      Boolean(playerNameInMessage) &&
      /\b(stat line|box score|game stats?|how many|line vs|stats?\s+vs)\b/i.test(msgLower) &&
      (/\bvs\b|against|@/i.test(msgLower) || /\b\d{1,2}\/\d{1,2}\b/.test(msgLower) || /\blast\s+(night|game)\b/i.test(msgLower)) &&
      !isProjectionQuery
    const netRatingIntent = /\bnet rating|net rtg\b/i.test(msgLower) || (/\b(o|d)rtg\b/i.test(msgLower) && mentionedTeams.length >= 2)
    const compareTeamsIntent =
      (/\bcompare\b/i.test(msgLower) || /\bvs\b|\bversus\b/i.test(msgLower)) &&
      mentionedTeams.length >= 2 &&
      !isProjectionQuery &&
      !bettingSplitsIntent
    const teamStatsIntent =
      /\b(team stats?|team statistics|team form|team record|team profile|recent form|last\s*10|last ten)\b/i.test(msgLower) ||
      (mentionedTeams.length > 0 &&
        /\b(stats?|record|standings?|profile)\b/i.test(msgLower) &&
        !playerNameInMessage)
    const trendingStatFocus =
      /\b(rebounds?|reb)\b/i.test(msgLower) ? 'rebounds' :
      /\b(assists?|ast)\b/i.test(msgLower) ? 'assists' :
      /\b(3pm|threes?|three\s?points?)\b/i.test(msgLower) ? 'threes' :
      /\b(points?|pts)\b/i.test(msgLower) ? 'points' :
      undefined
    const trendingPlayersIntent =
      !playerNameInMessage &&
      !propIntent &&
      (
        /\b(players?\s+(to\s+watch|to\s+look\s+for|to\s+know|to\s+target))\b/i.test(msgLower) ||
        /\b(trending\s+players?|hot\s+players?|recent\s+standouts?|recent\s+performers?|best\s+recent\s+players?)\b/i.test(msgLower) ||
        /\b(who('?s| is)\s+hot|who('?s| has)\s+been\s+hot)\b/i.test(msgLower) ||
        (/\b(players?|guys|names)\b/i.test(msgLower) && /\b(trending|hot|on\s+a\s+tear|performing\s+well|recently|lately)\b/i.test(msgLower))
      )
    const trendingTeams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
    const trendingHasTeamContext = trendingTeams.length > 0
    const normalizedThreeText = msgLower.replace(/[\u2010-\u2015]/g, '-').replace(/\s+/g, '')
    const threesToken =
      /\b(3p|3pt|3s|three[-\s]?pointers?|threes?)\b/i.test(msgLower) ||
      /(3pointers|3point|threepointers|threepoint|3ptshots|threept)/i.test(normalizedThreeText)
    const threesAllowedIntent =
      threesToken &&
      /\b(allow|allowed|against|give up|given up|opp|opponent|concede|conceded|surrender)\b/i.test(msgLower)
    const threesMadeIntent =
      threesToken &&
      /\b(score|scores|scoring|make|makes|made|hit|hits|per game|ppg)\b/i.test(msgLower) &&
      !threesAllowedIntent
    const threesAllowedLeaderboardIntent =
      threesAllowedIntent &&
      /\b(most|highest|worst|leaders|top)\b.*\b(3s|3s? made|3 pointers|three pointers|threes)\b.*\b(allowed|against|give up|given up|surrender|conceded|per game)\b/i.test(
        msgLower
      )
    const threesAllowedSingleTeamIntent =
      threesAllowedIntent && mentionedTeams.length > 0
    const threesMadeLeaderboardIntent =
      threesMadeIntent &&
      /\b(most|highest|leaders|top)\b.*\b(3s|3s? made|3 pointers|three pointers|threes)\b/i.test(msgLower)
    const threesMadeSingleTeamIntent = threesMadeIntent && mentionedTeams.length > 0
    const statRankingIntent =
      /\b(most|highest|lowest|fewest|least|leaders|top|rank|ranking|leaderboard)\b/i.test(msgLower) &&
      (threesMadeIntent || threesAllowedIntent || /pace|ortg|drtg|net rating|ppg|points per game|papg|rebounds|reb\b|assists|blocks|steals|turnovers|fg%|3p%|ft%|ts%|efg%|offensive rating|defensive rating|ftr\b/i.test(msgLower))
    const statCompareIntent =
      mentionedTeams.length >= 2 &&
      /\b(compare|vs|versus)\b/i.test(msgLower) &&
      !bettingSplitsIntent &&
      (threesMadeIntent || threesAllowedIntent || /pace|ortg|drtg|net rating|ppg|points per game|papg|rebounds|reb\b|assists|blocks|steals|turnovers|fg%|3p%|ft%|ts%|efg%|offensive rating|defensive rating|ftr\b/i.test(msgLower))

    const detectStatKey = (msg: string): { key: string; label: string } | null => {
      const entries: Array<{ key: string; label: string; regex: RegExp }> = [
        { key: '3pm', label: '3PM per game', regex: /\b(3pm|3s made|3 pointers made|threes made|made threes|three-pointers made)\b/i },
        { key: '3pa', label: '3PA per game', regex: /\b(3pa|3s attempted|3 pointers attempted|threes attempted|three-pointers attempted)\b/i },
        { key: 'opp3pm', label: 'opponent 3PM per game', regex: /\b(opp|opponent|allowed|against)\b.*\b(3pm|3s made|3 pointers made|threes made|three-pointers made)\b/i },
        { key: 'opp3pm', label: 'opponent 3PM per game', regex: /\b(3pm|3s made|3 pointers made|threes made|three-pointers made)\b.*\b(allowed|against|opp|opponent)\b/i },
        { key: 'opp3pa', label: 'opponent 3PA per game', regex: /\b(opp|opponent|allowed|against)\b.*\b(3pa|3s attempted|3 pointers attempted|threes attempted|three-pointers attempted)\b/i },
        { key: 'ppg', label: 'points per game', regex: /\b(ppg|points per game|points scored)\b/i },
        { key: 'papg', label: 'points allowed per game', regex: /\b(papg|points allowed|points against|opp points)\b/i },
        { key: 'ortg', label: 'Offensive Rating', regex: /\b(offensive rating|ortg|o-?rtg)\b/i },
        { key: 'drtg', label: 'Defensive Rating', regex: /\b(defensive rating|drtg|d-?rtg)\b/i },
        { key: 'net', label: 'Net Rating', regex: /\b(net rating|net rtg|net)\b/i },
        { key: 'pace', label: 'Pace', regex: /\bpace\b/i },
        { key: 'fgpct', label: 'FG%', regex: /\bfg%|field goal percentage\b/i },
        { key: 'threepct', label: '3P%', regex: /\b3p%|three ?point percentage|3-point percentage\b/i },
        { key: 'ftpct', label: 'FT%', regex: /\bft%|free throw percentage\b/i },
        { key: 'tspct', label: 'TS%', regex: /\bts%|true shooting\b/i },
        { key: 'efgpct', label: 'eFG%', regex: /\befg%|effective fg\b/i },
        { key: 'reb', label: 'Rebounds per game', regex: /\breb(ounds)? per game\b|\breb\b|\brebounds\b/i },
        { key: 'oreb', label: 'Offensive rebounds per game', regex: /\boffensive rebounds|\borb\b/i },
        { key: 'dreb', label: 'Defensive rebounds per game', regex: /\bdefensive rebounds|\bdrb\b/i },
        { key: 'ast', label: 'Assists per game', regex: /\bast( per game)?\b|\bassists?\b/i },
        { key: 'stl', label: 'Steals per game', regex: /\bstl( per game)?\b|\bsteals?\b/i },
        { key: 'blk', label: 'Blocks per game', regex: /\bblk( per game)?\b|\bblocks?\b/i },
        { key: 'tov', label: 'Turnovers per game', regex: /\btov( per game)?\b|\bturnovers?\b/i },
        { key: 'pf', label: 'Personal fouls per game', regex: /\bpf\b|\bpersonal fouls\b/i },
      ]
      for (const entry of entries) {
        if (entry.regex.test(msg)) return { key: entry.key, label: entry.label }
      }
      // fallback: if threesMadeIntent
      if (threesMadeIntent) return { key: '3pm', label: '3PM per game' }
      if (threesAllowedIntent) return { key: 'opp3pm', label: 'opponent 3PM per game' }
      return null
    }
    const statQuery = detectStatKey(message)

    if (trendingPlayersIntent) {
      const trendSportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const result = await runTrendingPlayers({
        sport: trendSportGuess,
        stat_focus: trendingStatFocus,
        window: 5,
        limit: 5,
        teams: trendingHasTeamContext ? trendingTeams : undefined,
      })
      if (result?.success && result.formatted) {
        return streamTextResponse(result.formatted)
      }
      return streamTextResponse(result?.error || 'Trending players are unavailable right now.')
    }

    // Early return for opponent 3PM allowed queries using static CSV (faster, avoids ESPN/tool calls)
    if (threesAllowedIntent) {
      const fmtVal = (v: number | null | undefined) => (v == null ? null : Number(v).toFixed(1))

      // Specific team path
      if (mentionedTeams.length) {
        const target = mentionedTeams[0]
        const candidates = findStaticNbaTeam(target)
        if (candidates.length) {
          const statVal = pickOpponentThrees(candidates[0].stats || {})
          if (statVal != null) {
            return streamTextResponse(`${candidates[0].team}: ${fmtVal(statVal)} opponent 3PM per game`)
          }
        }
        // CSV fallback for a single team
        const csvMatch = getOpponent3pmFromCsv().find((r) => {
          const rNorm = normalizeToken(r.team)
          const tNorm = normalizeToken(target)
          return rNorm === tNorm || rNorm.includes(tNorm) || tNorm.includes(rNorm)
        })
        if (csvMatch) {
          return streamTextResponse(`${csvMatch.team}: ${fmtVal(csvMatch.val)} opponent 3PM per game`)
        }
      }

      // Leaderboard fallback (top 10) using static teams, then CSV
      try {
        let teams = getStaticNbaTeams()
          .map((t) => ({ team: t.team, val: pickOpponentThrees(t.stats || {}) }))
          .filter((t) => t.val != null && Number.isFinite(t.val))
          .sort((a, b) => b.val! - a.val!)
          .slice(0, 10)

        if (!teams.length) {
          teams = getOpponent3pmFromCsv()
            .slice()
            .sort((a, b) => b.val - a.val)
            .slice(0, 10)
        }

        if (teams.length) {
        const lines = teams.map((t, idx) => `${idx + 1}) ${t.team}: ${fmtVal(t.val)} 3PM allowed per game`)
        return streamTextResponse(lines.join('\n'))
      }
      } catch (err) {
        console.error('[3PA_ALLOWED_EARLY] Failed', err)
      }

      return streamTextResponse('Opponent 3PM allowed data is unavailable in the static set right now.')
    }

    // Early return for team 3PM scored (offense) using static data
    if (threesMadeIntent) {
      const fmtVal = (v: number | null | undefined) => (v == null ? null : Number(v).toFixed(1))

      if (threesMadeSingleTeamIntent) {
        const target = mentionedTeams[0]
        const candidates = findStaticNbaTeam(target)
        if (candidates.length) {
          const statVal = pickMadeThrees(candidates[0].stats || {})
          if (statVal != null) {
            return streamTextResponse(`${candidates[0].team}: ${fmtVal(statVal)} 3PM per game`)
          }
        }
        const csvMatch = getMade3pmFromCsv().find((r) => {
          const rNorm = normalizeToken(r.team)
          const tNorm = normalizeToken(target)
          return rNorm === tNorm || rNorm.includes(tNorm) || tNorm.includes(rNorm)
        })
        if (csvMatch) {
          return streamTextResponse(`${csvMatch.team}: ${fmtVal(csvMatch.val)} 3PM per game`)
        }
      }

      if (threesMadeLeaderboardIntent || !mentionedTeams.length) {
        let teams = getStaticNbaTeams()
          .map((t) => ({ team: t.team, val: pickMadeThrees(t.stats || {}) }))
          .filter((t) => t.val != null && Number.isFinite(t.val))
          .sort((a, b) => b.val! - a.val!)
          .slice(0, 10)
        if (!teams.length) {
          teams = getMade3pmFromCsv()
            .slice()
            .sort((a, b) => b.val - a.val)
            .slice(0, 10)
        }
        if (teams.length) {
          const lines = teams.map((t, idx) => `${idx + 1}) ${t.team}: ${fmtVal(t.val)} 3PM per game`)
          return streamTextResponse(lines.join('\n'))
        }
        return streamTextResponse('Team 3PM per game is unavailable in the static set right now.')
      }
    }

    // Generic stat rankings/comparisons from static data (NBA)
    // Skip if edge awareness intent is detected (user wants player prop analysis, not team stats)
    const statKey = statQuery?.key
    if (statKey && !edgeAwarenessIntent && (statRankingIntent || statCompareIntent || mentionedTeams.length === 1)) {
      const fmtVal = (v: number | null | undefined) => (v == null ? 'n/a' : Number(v).toFixed(1).replace(/\.0+$/, ''))
      const label = statQuery?.label || 'stat'

      // Single-team fetch
      if (mentionedTeams.length === 1 && !statRankingIntent && !statCompareIntent) {
        const team = findStaticNbaTeam(mentionedTeams[0])[0]
        if (team) {
          const val = pickStatValue(team.stats || {}, statKey)
          if (val != null) return streamTextResponse(`${team.team}: ${fmtVal(val)} (${label})`)
        }
      }

      // Comparison between two teams
      if (statCompareIntent && mentionedTeams.length >= 2) {
        const targets = mentionedTeams.slice(0, 2)
        const teams = targets
          .map((t) => {
            const found = findStaticNbaTeam(t)[0]
            if (!found) return null
            const val = pickStatValue(found.stats || {}, statKey)
            return val == null ? null : { team: found.team, val }
          })
          .filter(Boolean) as Array<{ team: string; val: number }>
        if (teams.length) {
          const lines = teams.map((t) => `- ${t.team}: ${fmtVal(t.val)} (${label})`)
          return streamTextResponse(lines.join('\n'))
        }
      }

      // Rankings (top/bottom)
      if (statRankingIntent || !mentionedTeams.length) {
        const wantLowest = /\b(lowest|fewest|least)\b/i.test(message)
        const teams = getStaticNbaTeams()
          .map((t) => ({ team: t.team, val: pickStatValue(t.stats || {}, statKey) }))
          .filter((t) => t.val != null && Number.isFinite(t.val))
          .sort((a, b) => (wantLowest ? (a.val! - b.val!) : (b.val! - a.val!)))
          .slice(0, 10)
        if (teams.length) {
          const lines = teams.map((t, idx) => `${idx + 1}) ${t.team}: ${fmtVal(t.val)} (${label})`)
          return streamTextResponse(lines.join('\n'))
        }
      }
    }

    if (netRatingIntent && mentionedTeams.length >= 2) {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'americanfootball_nfl' :
        msgLower.match(/mlb|baseball/) ? 'baseball_mlb' :
        msgLower.match(/nhl|hockey/) ? 'icehockey_nhl' :
        msgLower.match(/ncaab|college basketball|cbb/) ? 'basketball_ncaab' :
        'basketball_nba'
      const targets = mentionedTeams.slice(0, 3)
      const fmt = (v: any) => (v == null ? 'n/a' : Number(v).toFixed(1).replace(/\.0+$/, ''))
      try {
        const teams = await Promise.all(
          targets.map(async (t) => {
            const stats = await getTeamStats(sportGuess, t)
            return stats[0]
          })
        )
        const lines = teams
          .filter(Boolean)
          .map((t) => {
            const s = t!.stats as any
            const off = s?.offensiveRating ?? s?.OFF_RTG ?? s?.ortg
            const def = s?.defensiveRating ?? s?.DEF_RTG ?? s?.drtg
            const pace = s?.pace ?? s?.PACE
            const net =
              s?.netRating ??
              s?.NET_RTG ??
              (off != null && def != null ? Number((off - def).toFixed(1)) : null)
            return `- ${t!.team}: Net ${fmt(net)}, ORtg ${fmt(off)}, DRtg ${fmt(def)}, Pace ${fmt(pace)}`
          })
        if (lines.length) return streamTextResponse(lines.join('\n'))
      } catch (err) {
        console.error('[NET_RATING_SHORTCUT] Failed', err)
      }
    }

    if (threesAllowedLeaderboardIntent) {
      try {
        const teams = getStaticNbaTeams()
          .map((t) => ({ team: t.team, val: pickOpponentThrees(t.stats || {}) }))
          .filter((t) => t.val != null)
          .sort((a, b) => (b.val! - a.val!))
          .slice(0, 10)
        if (teams.length) {
          const lines = teams.map((t, idx) => `${idx + 1}) ${t.team}: ${t.val!.toFixed(1)} 3PM allowed per game`)
          return streamTextResponse(lines.join('\n'))
        }
      } catch (err) {
        console.error('[3PA_ALLOWED_LEADERBOARD] Failed', err)
      }
    }

    if (threesAllowedSingleTeamIntent) {
      const target = mentionedTeams[0]
      const candidates = findStaticNbaTeam(target)
      if (candidates.length) {
        const statVal = pickOpponentThrees(candidates[0].stats || {})
        if (statVal != null) {
          return streamTextResponse(
            `${candidates[0].team}: ${statVal.toFixed(1)} opponent 3PM per game`
          )
        }
      }
    }
    if (threesAllowedIntent && !mentionedTeams.length) {
      try {
        const teams = getStaticNbaTeams()
          .map((t) => ({ team: t.team, val: pickOpponentThrees(t.stats || {}) }))
          .filter((t) => t.val != null)
          .sort((a, b) => (b.val! - a.val!))
          .slice(0, 10)
        if (teams.length) {
          const lines = teams.map((t, idx) => `${idx + 1}) ${t.team}: ${t.val!.toFixed(1)} 3PM allowed per game`)
          return streamTextResponse(lines.join('\n'))
        }
      } catch (err) {
        console.error('[3PA_ALLOWED_FALLBACK] Failed', err)
      }
    }

    if (compareTeamsIntent && !analysisIntent && !edgeAwarenessIntent) {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'americanfootball_nfl' :
        msgLower.match(/mlb|baseball/) ? 'baseball_mlb' :
        msgLower.match(/nhl|hockey/) ? 'icehockey_nhl' :
        msgLower.match(/ncaab|college basketball|cbb/) ? 'basketball_ncaab' :
        'basketball_nba'
      const targets = mentionedTeams.slice(0, 2)
      const fmt = (v: any, digits = 1) => {
        if (v == null) return 'n/a'
        const n = Number(v)
        return Number.isNaN(n) ? String(v) : n.toFixed(digits).replace(/\.0+$/, '')
      }
      try {
        const teams = await Promise.all(
          targets.map(async (t) => {
            const stats = await getTeamStats(sportGuess, t)
            return stats[0]
          })
        )
        const lines = teams
          .filter(Boolean)
          .map((t) => {
            const s = t!.stats as any
            const off = s?.offensiveRating ?? s?.OFF_RTG ?? s?.ortg
            const def = s?.defensiveRating ?? s?.DEF_RTG ?? s?.drtg
            const pace = s?.pace ?? s?.PACE
            const ts = s?.trueShootingPct ?? s?.TS_PCT ?? s?.tsPct
            const reb = s?.reboundsPerGame ?? s?.TRB_PER_G ?? s?.TRB ?? s?.REB
            const net =
              s?.netRating ??
              s?.NET_RTG ??
              (off != null && def != null ? Number((off - def).toFixed(1)) : null)
            return `- ${t!.team}: Net ${fmt(net)}, ORtg ${fmt(off)}, DRtg ${fmt(def)}, Pace ${fmt(pace)}, TS% ${fmt(ts)}, REB ${fmt(reb)}`
          })
        if (lines.length) return streamTextResponse(lines.join('\n'))
      } catch (err) {
        console.error('[TEAM_COMPARE_SHORTCUT] Failed', err)
      }
    }

    if (playerCompareIntent && !analysisIntent && !edgeAwarenessIntent) {
      const fmt = (v: any, digits = 1) => {
        if (v == null) return 'n/a'
        const n = Number(v)
        return Number.isNaN(n) ? String(v) : n.toFixed(digits).replace(/\.0+$/, '')
      }
      try {
        const stats = await Promise.all(
          playerCompareCandidates.map(async (p) => {
            const res = await getPlayerSeasonStats(p, 'basketball_nba')
            return res
          })
        )
        const lines = stats
          .filter(Boolean)
          .map((p) => {
            const s = p!.stats as any
            const ts = s.TS_PCT ?? s.tsPct ?? s.trueShootingPct
            const usg = s.USG_PCT ?? s.usgPct ?? s.usagePct
            return `${p!.name}: PPG ${fmt(s.PPG || s.PTS)}, RPG ${fmt(s.RPG || s.REB)}, APG ${fmt(s.APG || s.AST)}, TS% ${fmt(ts, 1)}, 3P% ${fmt(s.THREE_PERCENT)}, USG% ${fmt(usg, 1)}`
          })
        if (lines.length) return streamTextResponse(lines.join('\n'))
      } catch (err) {
        console.error('[PLAYER_COMPARE_SHORTCUT] Failed', err)
      }
    }

    // Early short-circuit for team stats to avoid odds fetches
    // Skip if user explicitly asks for analysis/breakdown or edge awareness
    if ((teamStatsIntent || (mentionedTeams.length && !oddsKeywordMatch && !wantsLiveOdds && !propIntent && !playerNameInMessage)) && !analysisIntent && !edgeAwarenessIntent) {
      try {
        return await resolveTeamStats(mentionedTeams.length ? mentionedTeams : parsedMatchupTeams)
      } catch (err: any) {
        console.error('[TEAM_STATS_SHORTCUT] Failed (early)', err)
        return streamTextResponse('Team stats are temporarily unavailable. Please try again.')
      }
    }

    // Leaderboard intent for thresholds (e.g., "who has the most 30 point games")
    if (leaderboardIntent && leaderboardThresholdMatch) {
      const points = Number(leaderboardThresholdMatch[1])
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const season = getSeasonYearForSport(sportGuess as any)
      const seasonType = 2
      const resp = await resolveLeaderboardThresholdQuery({
        message,
        sport: sportGuess as any,
        season,
        seasonType,
        thresholdStat: 'PTS',
        thresholdValue: points,
        limit: 10,
      })
      return streamTextResponse(resp)
    }

    // ATS leaderboard intent
    if (atsLeadersIntent) {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const season = getSeasonYearForSport(sportGuess as any)
      const resp = await resolveAtsLeaderboard({
        sport: sportGuess as any,
        season,
        seasonType: 2,
        limit: 10,
      })
      return streamTextResponse(resp)
    }

    // Team after-loss split
    if (afterLossIntent && (mentionedTeams.length || parsedMatchupTeams.length)) {
      const targetTeam = mentionedTeams[0] || parsedMatchupTeams[0]
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const resolved = await resolveEspnTeamId(sportGuess as any, targetTeam)
      if (!resolved) {
        return streamTextResponse(`I couldn't find that team on ESPN. Try a more exact name.`)
      }
      const season = getSeasonYearForSport(sportGuess as any)
      const resp = await resolveTeamAfterLossSplit({
        sport: sportGuess as any,
        teamId: resolved.id,
        season,
        seasonType: 2,
        teamName: resolved.name,
      })
      return streamTextResponse(resp)
    }

    // Team home/away defensive split
    if (homeAwayDefenseIntent && (mentionedTeams.length || parsedMatchupTeams.length)) {
      const targetTeam = mentionedTeams[0] || parsedMatchupTeams[0]
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const resolved = await resolveEspnTeamId(sportGuess as any, targetTeam)
      if (!resolved) {
        return streamTextResponse(`I couldn't find that team on ESPN. Try a more exact name.`)
      }
      const season = getSeasonYearForSport(sportGuess as any)
      const resp = await resolveTeamHomeAwayDefense({
        sport: sportGuess as any,
        teamId: resolved.id,
        season,
        seasonType: 2,
        teamName: resolved.name,
      })
      return streamTextResponse(resp)
    }

    // Player vs opponent aggregate (season)
    if (playerNameInMessage && vsOpponentIntent && !isProjectionQuery && !analysisIntent && !edgeAwarenessIntent) {
      const opponentName = vsOpponentIntent[1]
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const season = getSeasonYearForSport(sportGuess as any)
      const resp = await resolvePlayerOpponentAggregate({
        playerName: playerNameInMessage,
        sport: sportGuess as any,
        season,
        seasonType: 2,
        opponent: opponentName,
      })
      return streamTextResponse(resp)
    }

    // Player no-rest/back-to-back split
    if (playerNameInMessage && noRestIntent) {
      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      const season = getSeasonYearForSport(sportGuess as any)
      const seasonType = seasonTypeFromText(msgLower)
      const resp = await resolvePlayerRestSplit({
        playerName: playerNameInMessage,
        sport: sportGuess as any,
        season,
        seasonType,
      })
      return streamTextResponse(resp)
    }

    // Player threshold/count intents (ESPN-only; e.g., "how many 40-point games")
    if (!leaderboardIntent) {
      const thresholdHandled = await maybeHandlePlayerThreshold()
      if (thresholdHandled) return thresholdHandled
    }

    const modelApplicationIntent =
      /apply\s+.+?(model|confidence)|confidence\s+interval|run\s+my\s+model|use\s+my\s+model|custom\s+model/i.test(msgLower)
    const researchIntent =
      /research\s+(mode|tab)|recent\s+news|search\s+the\s+web|latest\s+updates|run\s+my\s+model|apply\s+my\s+model|statistical\s+projection/i.test(
        msgLower
      ) || webSearchToggle
    const bettingEducationIntent =
      /\b(how\s+do\s+i|how\s+to|tips?|advice|strategy|strategies|guide|become|profitable|make\s+money|beat\s+the\s+(book|books|market))\b/i.test(
        msgLower
      ) &&
      /\b(bet|bets|betting|bettor|sportsbook)\b/i.test(msgLower)

    // ===== NEW: Player Analysis function (player props only) =====
    const runPlayerAnalysis = async () => {
      const matchupTeams = (parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams).filter(
        (team) => normalizeToken(team).length > 0
      )
      let playerName = extractPlayerName(message)
      if (playerName && /\b(player|prop|props)\b/i.test(playerName)) {
        const cleanedMessage = message
          .replace(/\bplayer props?\b/gi, '')
          .replace(/\bprops?\b/gi, '')
          .trim()
        const altName = extractPlayerName(cleanedMessage)
        playerName = altName && !/\b(player|prop|props)\b/i.test(altName) ? altName : undefined
      }

      // Clear playerName if it matches a detected team name
      if (playerName) {
        const playerToken = normalizeToken(playerName)
        const isTeamName = mentionedTeams.some(team => {
          const teamToken = normalizeToken(team)
          if (teamToken === playerToken) return true
          if (teamToken === playerToken + 's') return true
          if (playerToken === teamToken + 's') return true
          if (teamToken.startsWith(playerToken) && teamToken.length - playerToken.length <= 1) return true
          if (playerToken.startsWith(teamToken) && playerToken.length - teamToken.length <= 1) return true
          return false
        })
        if (isTeamName) {
          playerName = undefined
        }
      }

      if (!playerName) {
        return {
          success: false,
          formatted: 'Please specify a player for analysis (e.g., "LeBron James points prop" or "analyze Curry rebounds").',
        }
      }

      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      if (sportGuess !== 'nba') {
        return {
          success: false,
          formatted: 'Player analysis is currently optimized for NBA players. Please try an NBA player.',
        }
      }

      const inferPropType = (text: string) => {
        const t = text.toLowerCase()
        if (/\bpoints\s*\+\s*rebounds\b/.test(t)) return 'points_rebounds'
        if (/\bpoints\s*\+\s*assists\b/.test(t)) return 'points_assists'
        if (/\bpoints\s*\+\s*rebounds\s*\+\s*assists\b|\bpra\b/.test(t)) return 'pra'
        if (/\brebounds\s*\+\s*assists\b/.test(t)) return 'rebounds_assists'
        if (/\bblocks\s*\+\s*steals\b/.test(t)) return 'blocks_steals'
        if (/\bpoints\b|\bpts\b/.test(t)) return 'points'
        if (/\brebounds\b|\brebs\b|\breb\b/.test(t)) return 'rebounds'
        if (/\bassists\b|\basts\b|\bast\b/.test(t)) return 'assists'
        if (/\b(threes|3s|3pm|three pointers?)\b/.test(t)) return 'threes'
        if (/\bblocks\b|\bblk\b/.test(t)) return 'blocks'
        if (/\bsteals\b|\bstl\b/.test(t)) return 'steals'
        return 'points'
      }
      const hasExplicitPropType = (text: string) => {
        const t = text.toLowerCase()
        return (
          /\bpoints\s*\+\s*rebounds\b/.test(t) ||
          /\bpoints\s*\+\s*assists\b/.test(t) ||
          /\bpoints\s*\+\s*rebounds\s*\+\s*assists\b|\bpra\b/.test(t) ||
          /\brebounds\s*\+\s*assists\b/.test(t) ||
          /\bblocks\s*\+\s*steals\b/.test(t) ||
          /\bpoints\b|\bpts\b/.test(t) ||
          /\brebounds\b|\brebs\b|\breb\b/.test(t) ||
          /\bassists\b|\basts\b|\bast\b/.test(t) ||
          /\b(threes|3s|3pm|three pointers?)\b/.test(t) ||
          /\bblocks\b|\bblk\b/.test(t) ||
          /\bsteals\b|\bstl\b/.test(t)
        )
      }

      const seasonStatValue = (stats: Record<string, any> | undefined, propType: string) => {
        if (!stats) return null
        const num = (v: any) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : null
        }
        const pts = num(stats.PPG ?? stats.PTS ?? stats.POINTS)
        const reb = num(stats.RPG ?? stats.REB ?? stats.TRB ?? stats.REBOUNDS)
        const ast = num(stats.APG ?? stats.AST ?? stats.ASSISTS)
        const threes = num(stats['3PM'] ?? stats.THREE_PM ?? stats.THREE_P ?? stats.THREEPM)
        const blk = num(stats.BLK ?? stats.BPG ?? stats.BLOCKS)
        const stl = num(stats.STL ?? stats.SPG ?? stats.STEALS)
        switch (propType) {
          case 'points': default: return pts
          case 'rebounds': return reb
          case 'assists': return ast
          case 'threes': return threes
          case 'blocks': return blk
          case 'steals': return stl
          case 'points_rebounds': return pts != null && reb != null ? pts + reb : null
          case 'points_assists': return pts != null && ast != null ? pts + ast : null
          case 'rebounds_assists': return reb != null && ast != null ? reb + ast : null
          case 'pra': return pts != null && reb != null && ast != null ? pts + reb + ast : null
          case 'blocks_steals': return blk != null && stl != null ? blk + stl : null
        }
      }

      const recentFromArray = (recent: any[] | undefined, propType: string) => {
        if (!recent?.length) return { average: null, lines: [] as string[] }
        const values: number[] = []
        const lines: string[] = []
        const labelMap: Record<string, string> = {
          points: 'PTS', rebounds: 'REB', assists: 'AST', threes: '3PM',
          blocks: 'BLK', steals: 'STL', points_rebounds: 'PTS+REB',
          points_assists: 'PTS+AST', rebounds_assists: 'REB+AST',
          pra: 'PRA', blocks_steals: 'BLK+STL',
        }
        const statLabel = labelMap[propType] || 'PTS'
        for (const game of recent.slice(0, 5)) {
          const date = String(game?.date || '').slice(0, 10)
          const opp = game?.opponent || ''
          const rawStats = game?.stats || {}
          const statMap: Record<string, number> = {}
          for (const [key, value] of Object.entries(rawStats)) {
            const num = typeof value === 'number' ? value : Number(value)
            if (Number.isFinite(num)) {
              statMap[key.toString().toUpperCase().replace(/\s+/g, '_')] = num
            }
          }
          const value = getPropStatFromMap(statMap, propType)
          if (value != null) values.push(value)
          lines.push(`- ${date}${opp ? ` vs ${opp}` : ''}: ${value ?? 'n/a'} ${statLabel}`)
        }
        const average = values.length >= 3
          ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1))
          : null
        return { average, lines }
      }

      const opponentAllowedValue = (stats: Record<string, any> | undefined, propType: string) => {
        if (!stats) return null
        const num = (v: any) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : null
        }
        switch (propType) {
          case 'points': case 'points_rebounds': case 'points_assists': case 'pra': default:
            return num(stats.pointsAgainstPerGame)
          case 'rebounds': case 'rebounds_assists':
            return num(stats.opponentReboundsPerGame)
          case 'assists': return num(stats.opponentAssistsPerGame)
          case 'threes': return num(stats.opponentThreeMadePerGame)
          case 'blocks': case 'blocks_steals': return num(stats.opponentBlocksPerGame)
          case 'steals': return num(stats.opponentStealsPerGame)
        }
      }

      const explicitProp = hasExplicitPropType(message)
      const propType = inferPropType(message)
      const seasonStats = await getPlayerSeasonStats(playerName, 'basketball_nba')
      const playerLabel = seasonStats?.name || playerName
      const playerTeam = seasonStats?.team || ''

      const opponent = (() => {
        const validTeams = mentionedTeams.filter(team => {
          const teamToken = normalizeToken(team)
          const playerToken = normalizeToken(playerLabel)
          return !teamToken.includes(playerToken) && !playerToken.includes(teamToken)
        })
        if (validTeams.length >= 1) {
          if (playerTeam) {
            const teamToken = normalizeToken(playerTeam)
            const nonPlayerTeam = validTeams.find(t => !normalizeToken(t).includes(teamToken))
            if (nonPlayerTeam) return nonPlayerTeam
          }
          return validTeams[0]
        }
        if (matchupTeams.length >= 2) {
          if (playerTeam) {
            const teamToken = normalizeToken(playerTeam)
            const first = matchupTeams[0]
            const second = matchupTeams[1]
            if (teamToken && normalizeToken(first).includes(teamToken)) return second
            if (teamToken && normalizeToken(second).includes(teamToken)) return first
          }
          return matchupTeams[1]
        }
        if (matchupTeams.length === 1) return matchupTeams[0]
        return ''
      })()
      const leagueAverageAllowed = (propType: string) => {
        const leagueVals = getStaticNbaTeams()
          .map((team) => opponentAllowedValue(team.stats, propType))
          .filter((val): val is number => typeof val === 'number' && Number.isFinite(val))
        if (!leagueVals.length) return null
        return leagueVals.reduce((sum, v) => sum + v, 0) / leagueVals.length
      }
      const projectPropLine = (propType: string) => {
        if (!seasonStats?.stats && !seasonStats?.recent?.length) return null
        const seasonAvg = seasonStatValue(seasonStats?.stats as Record<string, any> | undefined, propType)
        const recent = recentFromArray(seasonStats?.recent, propType)
        const last5Avg = recent.average
        if (seasonAvg == null && last5Avg == null) return null
        let sum = 0
        let weight = 0
        if (seasonAvg != null) {
          sum += seasonAvg * 0.65
          weight += 0.65
        }
        if (last5Avg != null) {
          sum += last5Avg * 0.25
          weight += 0.25
        }
        let projection = weight > 0 ? sum / weight : null
        if (projection == null) return null
        if (opponent) {
          const oppTeam = findStaticNbaTeam(opponent)[0]
          const opponentAllowed = opponentAllowedValue(oppTeam?.stats, propType)
          const leagueAvg = leagueAverageAllowed(propType)
          if (opponentAllowed != null && leagueAvg != null) {
            projection += (opponentAllowed - leagueAvg) * 0.35
          }
        }
        return Number(projection.toFixed(1))
      }

      if (!explicitProp) {
        let propsBlock = 'No player props available for the specified criteria.'
        try {
          const propsRes = await fetch(
            `${baseUrl}/api/player-props?sport=basketball_nba&player=${encodeURIComponent(playerLabel)}`,
            { cache: 'no-store' }
          )
          const propsData = await propsRes.json()
          if (propsRes.ok && propsData?.data?.length) {
            const playerProp = propsData.data[0]
            const headerParts = [`**${playerProp.player}**`]
            if (playerProp.team) {
              headerParts.push(
                `(${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
              )
            }
            let formatted = `${headerParts.join(' ')}\n`
            if (playerProp.game) {
              formatted += `Game: ${playerProp.game}\n`
            }
            formatted += `| Market | Line | Best Over | Best Under |\n`
            formatted += `| --- | --- | --- | --- |\n`
            for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
              const modelLine = projectPropLine(marketType)
              const modelLabel = modelLine != null ? modelLine.toFixed(1) : 'n/a'
              const lineLabel =
                marketData.line !== undefined && marketData.line !== null
                  ? `${marketData.line} (Model ${modelLabel})`
                  : `? (Model ${modelLabel})`
              const bestOver =
                marketData.over.bestBook
                  ? `${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})`
                  : '?'
              const bestUnder =
                marketData.under.bestBook
                  ? `${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})`
                  : '?'
              formatted += `| ${marketType.toUpperCase()} | ${lineLabel} | ${bestOver} | ${bestUnder} |\n`
            }
            propsBlock = `${formatted}\nModel lines blend season average, last 5, and opponent strength.\n${buildDataSourceLine(['SBD'])}`
          }
        } catch (err) {
          propsBlock = 'SBD props lookup failed for this player.'
        }

        const lines = [
          `**Player Analysis: ${playerLabel}${opponent ? ` vs ${opponent}` : ''}**`,
          '',
          '**Props on Board**',
          propsBlock,
          '',
          'Ask for a specific prop if you want a stat-based edge breakdown.',
        ]
        return { success: true, formatted: lines.join('\n') }
      }

      const seasonAvg = seasonStatValue(seasonStats?.stats as Record<string, any> | undefined, propType)
      let last5Avg: number | null = null
      let last5Lines: string[] = []
      const fromRecent = recentFromArray(seasonStats?.recent, propType)
      last5Avg = fromRecent.average
      last5Lines = fromRecent.lines

      if (last5Avg == null || !last5Lines.length) {
        const seasonYear = getEspnSeasonYearForLogs('nba')
        const searchHit = await searchPlayer(playerLabel, 'basketball_nba')
        const fallback = searchHit?.id ? null : await searchAthlete('nba', playerLabel, 5)
        const playerId = searchHit?.id || fallback?.id
        if (playerId) {
          const recent = await getRecentLogStats({
            sport: 'nba',
            playerId: String(playerId),
            playerName: playerLabel,
            propType,
            seasonYear,
            maxGames: 5,
            minSamples: 3,
          })
          last5Avg = recent.average
          last5Lines = recent.lines
        }
      }

      let opponentAllowed: number | null = null
      let leagueAvg: number | null = null
      if (opponent) {
        const oppTeam = findStaticNbaTeam(opponent)[0]
        opponentAllowed = opponentAllowedValue(oppTeam?.stats, propType)
        const leagueVals = getStaticNbaTeams()
          .map((team) => opponentAllowedValue(team.stats, propType))
          .filter((val): val is number => typeof val === 'number' && Number.isFinite(val))
        if (leagueVals.length) {
          leagueAvg = Number((leagueVals.reduce((sum, v) => sum + v, 0) / leagueVals.length).toFixed(1))
        }
      }

      let sbdLine = 'No SBD prop line found for this player on the current slate.'
      try {
        const propsRes = await fetch(
          `${baseUrl}/api/player-props?sport=basketball_nba&player=${encodeURIComponent(playerLabel)}&market=${encodeURIComponent(propType)}`,
          { cache: 'no-store' }
        )
        const propsData = await propsRes.json()
        const market = propsData?.data?.[0]?.markets?.[propType]
        if (propsRes.ok && market) {
          const line = market.line ?? '?'
          const over = market.over?.best != null ? market.over.best : '?'
          const overBook = market.over?.bestBook || '?'
          const under = market.under?.best != null ? market.under.best : '?'
          const underBook = market.under?.bestBook || '?'
          sbdLine = `SBD line: ${line} | Over ${over} (${overBook}) | Under ${under} (${underBook})`
        }
      } catch (err) {
        sbdLine = 'SBD props lookup failed for this player.'
      }

      const focusLabel = {
        points: 'Points', rebounds: 'Rebounds', assists: 'Assists', threes: '3PT Made',
        points_rebounds: 'Points + Rebounds', points_assists: 'Points + Assists',
        pra: 'Points + Rebounds + Assists', rebounds_assists: 'Rebounds + Assists',
        blocks: 'Blocks', steals: 'Steals', blocks_steals: 'Blocks + Steals',
      }[propType] || 'Points'

      const lines = [
        `**Player Analysis: ${playerLabel}${opponent ? ` vs ${opponent}` : ''}**`,
        '',
        '**Inputs**',
        `- Player: ${playerLabel}`,
        `- Matchup: ${playerTeam ? `${playerTeam} vs ${opponent || 'TBD'}` : opponent || 'TBD'}`,
        `- Focus: ${focusLabel}`,
        '- Window: last 5 games vs season average',
        '',
        '**Results**',
      ]
      if (seasonAvg != null) {
        lines.push(`- Season avg: ${seasonAvg.toFixed(1)}`)
      } else {
        lines.push('- Season avg: unavailable')
      }
      if (last5Avg != null) {
        const delta = seasonAvg != null ? Number((last5Avg - seasonAvg).toFixed(1)) : null
        const deltaLabel = delta != null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''
        lines.push(`- Last 5 avg: ${last5Avg.toFixed(1)}${deltaLabel}`)
      } else {
        lines.push('- Last 5 avg: unavailable')
      }
      if (last5Lines.length) {
        lines.push('')
        lines.push('**Last 5 Games**')
        lines.push(...last5Lines)
      }
      lines.push('')
      if (opponentAllowed != null) {
        const label =
          propType === 'points' ? 'Opponent PPG allowed' :
          propType === 'threes' ? 'Opponent 3PM allowed' :
          propType === 'rebounds' ? 'Opponent rebounds allowed' :
          propType === 'assists' ? 'Opponent assists allowed' :
          propType === 'blocks' ? 'Opponent blocks allowed' :
          propType === 'steals' ? 'Opponent steals allowed' : 'Opponent allowed'
        const leagueLabel = leagueAvg != null ? ` (league avg ${leagueAvg.toFixed(1)})` : ''
        lines.push(`**Opponent Context**`)
        lines.push(`- ${label}: ${opponentAllowed.toFixed(1)}${leagueLabel}`)
        lines.push('')
      }
      lines.push('**Prop Line**')
      lines.push(`- ${sbdLine}`)
      lines.push('')
      lines.push('**Edge Assessment**')
      if (seasonAvg != null && last5Avg != null) {
        const diff = last5Avg - seasonAvg
        const judgement =
          Math.abs(diff) >= 1
            ? `Recent form is ${diff > 0 ? 'above' : 'below'} season by ${Math.abs(diff).toFixed(1)}`
            : 'Recent form is close to season average'
        lines.push(`- ${judgement}`)
        lines.push('- Compare this to the SBD line to assess value.')
      } else {
        lines.push('- Not enough recent data to weigh the line; use the SBD line as the anchor.')
      }
      lines.push('')
      lines.push(buildDataSourceLine(['ESPN', 'Basketball Reference', 'SBD']))
      return { success: true, formatted: lines.join('\n') }
    }

    // ===== NEW: Matchup Analysis function (team vs team markets) =====
    const runMatchupAnalysis = async () => {
      const matchupTeams = (parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams).filter(
        (team) => normalizeToken(team).length > 0
      )

      if (matchupTeams.length < 2) {
        return {
          success: false,
          formatted: 'Please provide a specific matchup (e.g., "Lakers vs Knicks") for matchup analysis.',
        }
      }

      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      if (sportGuess !== 'nba') {
        return {
          success: false,
          formatted: 'Matchup analysis is currently optimized for NBA games. Please try an NBA matchup.',
        }
      }

      const [teamAName, teamBName] = matchupTeams.slice(0, 2)

      const lines: string[] = []
      lines.push(`**Matchup Analysis: ${teamAName} vs ${teamBName}**`)
      lines.push('')

      // Fetch current odds
      let oddsData: any = null
      try {
        const oddsGames = await fetchOdds('basketball_nba', ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })
        oddsData = oddsGames.find((g: any) => {
          const home = (g.home_team || '').toLowerCase()
          const away = (g.away_team || '').toLowerCase()
          const t1 = teamAName.toLowerCase()
          const t2 = teamBName.toLowerCase()
          return (home.includes(t1) || home.includes(t2) || away.includes(t1) || away.includes(t2))
        })
      } catch (err) {
        console.error('[MATCHUP_ANALYSIS] Odds fetch failed:', err)
      }

      if (oddsData && oddsData.bookmakers?.length) {
        lines.push('**Current Lines**')
        const book = oddsData.bookmakers[0]
        const spreads = book.markets?.find((m: any) => m.key === 'spreads')
        const totals = book.markets?.find((m: any) => m.key === 'totals')
        const h2h = book.markets?.find((m: any) => m.key === 'h2h')

        if (spreads?.outcomes?.length) {
          for (const o of spreads.outcomes) {
            lines.push(`- Spread: ${o.name} ${o.point > 0 ? '+' : ''}${o.point} (${o.price > 0 ? '+' : ''}${o.price})`)
          }
        }
        if (totals?.outcomes?.length) {
          for (const o of totals.outcomes) {
            lines.push(`- Total: ${o.name} ${o.point} (${o.price > 0 ? '+' : ''}${o.price})`)
          }
        }
        if (h2h?.outcomes?.length) {
          for (const o of h2h.outcomes) {
            lines.push(`- Moneyline: ${o.name} ${o.price > 0 ? '+' : ''}${o.price}`)
          }
        }
        lines.push(`- Book: ${book.title}`)
        lines.push('')
      } else {
        lines.push('_No current odds found for this matchup_')
        lines.push('')
      }

      // Fetch team stats
      lines.push('**Team Stats**')
      const teamStats = await Promise.all([teamAName, teamBName].map(async (team) => {
        const stats = await getTeamStats('basketball_nba', team)
        const primary = stats?.[0]
        const staticTeam = findStaticNbaTeam(team)?.[0]
        return { team, primary, staticTeam }
      }))

      for (const entry of teamStats) {
        const s = entry.primary?.stats || {}
        const st = entry.staticTeam?.stats || {}
        const record = s.record || (s.wins != null && s.losses != null ? `${s.wins}-${s.losses}` : 'N/A')
        const ppg = s.pointsForPerGame ?? st.pointsPerGame ?? 'N/A'
        const papg = s.pointsAgainstPerGame ?? st.pointsAgainstPerGame ?? 'N/A'
        const ortg = st.offensiveRating ?? s.offensiveRating ?? 'N/A'
        const drtg = st.defensiveRating ?? s.defensiveRating ?? 'N/A'
        const net = st.netRating ?? (typeof ortg === 'number' && typeof drtg === 'number' ? (ortg - drtg).toFixed(1) : 'N/A')
        const pace = st.pace ?? s.pace ?? 'N/A'

        lines.push(`**${entry.team}**: ${record}`)
        lines.push(`- PPG: ${typeof ppg === 'number' ? ppg.toFixed(1) : ppg} | PAPG: ${typeof papg === 'number' ? papg.toFixed(1) : papg}`)
        lines.push(`- ORtg: ${typeof ortg === 'number' ? ortg.toFixed(1) : ortg} | DRtg: ${typeof drtg === 'number' ? drtg.toFixed(1) : drtg} | Net: ${typeof net === 'number' ? (net > 0 ? '+' : '') + net.toFixed(1) : net}`)
        lines.push(`- Pace: ${typeof pace === 'number' ? pace.toFixed(1) : pace}`)
      }
      lines.push('')

      // Fetch ATS trends
      lines.push('**Betting Trends**')
      for (const entry of teamStats) {
        const ats = await getTeamATSData(entry.team, 'basketball_nba')
        if (ats?.success && ats.data) {
          const parts: string[] = []
          if (ats.data.overallATS) parts.push(`ATS: ${ats.data.overallATS}`)
          if (ats.data.homeATS) parts.push(`Home: ${ats.data.homeATS}`)
          if (ats.data.awayATS) parts.push(`Away: ${ats.data.awayATS}`)
          if (ats.data.last10) parts.push(`L10: ${ats.data.last10}`)
          if (parts.length) {
            lines.push(`- ${entry.team}: ${parts.join(' | ')}`)
          }
        }
      }
      lines.push('')

      // Edge analysis based on stats
      lines.push('**Edge Analysis**')
      const team1Stats = teamStats[0]?.staticTeam?.stats || teamStats[0]?.primary?.stats || {} as any
      const team2Stats = teamStats[1]?.staticTeam?.stats || teamStats[1]?.primary?.stats || {} as any

      const t1Ortg = typeof team1Stats.offensiveRating === 'number' ? team1Stats.offensiveRating : null
      const t1Drtg = typeof team1Stats.defensiveRating === 'number' ? team1Stats.defensiveRating : null
      const t2Ortg = typeof team2Stats.offensiveRating === 'number' ? team2Stats.offensiveRating : null
      const t2Drtg = typeof team2Stats.defensiveRating === 'number' ? team2Stats.defensiveRating : null

      const t1Net = typeof team1Stats.netRating === 'number' ? team1Stats.netRating : (t1Ortg != null && t1Drtg != null ? t1Ortg - t1Drtg : null)
      const t2Net = typeof team2Stats.netRating === 'number' ? team2Stats.netRating : (t2Ortg != null && t2Drtg != null ? t2Ortg - t2Drtg : null)

      if (typeof t1Net === 'number' && typeof t2Net === 'number') {
        const netDiff = t1Net - t2Net
        const projectedSpread = -(netDiff / 2.5).toFixed(1) // Rough conversion: ~2.5 net rating per point
        lines.push(`- Net rating differential: ${netDiff > 0 ? '+' : ''}${netDiff.toFixed(1)} (${teamAName} vs ${teamBName})`)
        lines.push(`- Implied spread projection: ${teamAName} ${Number(projectedSpread) > 0 ? '+' : ''}${projectedSpread}`)

        // Compare to market if we have odds
        if (oddsData?.bookmakers?.[0]) {
          const spreads = oddsData.bookmakers[0].markets?.find((m: any) => m.key === 'spreads')
          if (spreads?.outcomes?.length) {
            const t1Spread = spreads.outcomes.find((o: any) =>
              o.name.toLowerCase().includes(teamAName.toLowerCase())
            )
            if (t1Spread) {
              const marketSpread = t1Spread.point
              const projNum = Number(projectedSpread)
              const diff = projNum - marketSpread
              if (Math.abs(diff) >= 1.5) {
                lines.push(`- **Edge detected**: Model projects ${teamAName} at ${projectedSpread}, market has ${marketSpread > 0 ? '+' : ''}${marketSpread}`)
                lines.push(`- Lean: ${diff > 0 ? teamBName : teamAName} (${Math.abs(diff).toFixed(1)} pts of value)`)
              } else {
                lines.push(`- No significant edge: projection aligns with market (within 1.5 pts)`)
              }
            }
          }
        }
      } else {
        lines.push('- Insufficient stats data to project edge')
      }

      lines.push('')
      lines.push(buildDataSourceLine(['The Odds API', 'ESPN', 'Basketball Reference']))

      return { success: true, formatted: lines.join('\n') }
    }

    // ===== LEGACY: Edge Awareness function (will be deprecated) =====
    const runEdgeAwareness = async () => {
      const matchupTeams = (parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams).filter(
        (team) => normalizeToken(team).length > 0
      )
      let playerName = extractPlayerName(message)
      if (playerName && /\b(player|prop|props)\b/i.test(playerName)) {
        const cleanedMessage = message
          .replace(/\bplayer props?\b/gi, '')
          .replace(/\bprops?\b/gi, '')
          .trim()
        const altName = extractPlayerName(cleanedMessage)
        playerName = altName && !/\b(player|prop|props)\b/i.test(altName) ? altName : undefined
      }

      // Clear playerName if it matches a detected team name (e.g., "laker" extracted from "lakers vs rockets")
      // Only use mentionedTeams (properly detected) not parsedMatchupTeams (may have parsing artifacts)
      if (playerName) {
        const playerToken = normalizeToken(playerName)
        // Check for exact match or singular/plural variations
        const isTeamName = mentionedTeams.some(team => {
          const teamToken = normalizeToken(team)
          // Exact match
          if (teamToken === playerToken) return true
          // Singular/plural match (e.g., "laker" vs "lakers", "rocket" vs "rockets")
          if (teamToken === playerToken + 's') return true
          if (playerToken === teamToken + 's') return true
          // Partial match for common team name patterns (e.g., "laker" contained in "lakers")
          if (teamToken.startsWith(playerToken) && teamToken.length - playerToken.length <= 1) return true
          if (playerToken.startsWith(teamToken) && playerToken.length - teamToken.length <= 1) return true
          return false
        })
        if (isTeamName) {
          playerName = undefined
        }
      }

      const sportGuess =
        msgLower.match(/nfl|football/) ? 'nfl' :
        msgLower.match(/mlb|baseball/) ? 'mlb' :
        msgLower.match(/nhl|hockey/) ? 'nhl' :
        'nba'
      if (sportGuess !== 'nba') {
        return {
          success: false,
          formatted: 'Edge awareness is currently optimized for NBA matchups. Please try an NBA matchup.',
        }
      }

      const inferPropType = (text: string) => {
        const t = text.toLowerCase()
        if (/\bpoints\s*\+\s*rebounds\b/.test(t)) return 'points_rebounds'
        if (/\bpoints\s*\+\s*assists\b/.test(t)) return 'points_assists'
        if (/\bpoints\s*\+\s*rebounds\s*\+\s*assists\b|\bpra\b/.test(t)) return 'pra'
        if (/\brebounds\s*\+\s*assists\b/.test(t)) return 'rebounds_assists'
        if (/\bblocks\s*\+\s*steals\b/.test(t)) return 'blocks_steals'
        if (/\bpoints\b|\bpts\b/.test(t)) return 'points'
        if (/\brebounds\b|\brebs\b|\breb\b/.test(t)) return 'rebounds'
        if (/\bassists\b|\basts\b|\bast\b/.test(t)) return 'assists'
        if (/\b(threes|3s|3pm|three pointers?)\b/.test(t)) return 'threes'
        if (/\bblocks\b|\bblk\b/.test(t)) return 'blocks'
        if (/\bsteals\b|\bstl\b/.test(t)) return 'steals'
        return 'points'
      }
      const hasExplicitPropType = (text: string) => {
        const t = text.toLowerCase()
        return (
          /\bpoints\s*\+\s*rebounds\b/.test(t) ||
          /\bpoints\s*\+\s*assists\b/.test(t) ||
          /\bpoints\s*\+\s*rebounds\s*\+\s*assists\b|\bpra\b/.test(t) ||
          /\brebounds\s*\+\s*assists\b/.test(t) ||
          /\bblocks\s*\+\s*steals\b/.test(t) ||
          /\bpoints\b|\bpts\b/.test(t) ||
          /\brebounds\b|\brebs\b|\breb\b/.test(t) ||
          /\bassists\b|\basts\b|\bast\b/.test(t) ||
          /\b(threes|3s|3pm|three pointers?)\b/.test(t) ||
          /\bblocks\b|\bblk\b/.test(t) ||
          /\bsteals\b|\bstl\b/.test(t)
        )
      }

      const seasonStatValue = (stats: Record<string, any> | undefined, propType: string) => {
        if (!stats) return null
        const num = (v: any) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : null
        }
        const pts = num(stats.PPG ?? stats.PTS ?? stats.POINTS)
        const reb = num(stats.RPG ?? stats.REB ?? stats.TRB ?? stats.REBOUNDS)
        const ast = num(stats.APG ?? stats.AST ?? stats.ASSISTS)
        const threes = num(stats['3PM'] ?? stats.THREE_PM ?? stats.THREE_P ?? stats.THREEPM)
        const blk = num(stats.BLK ?? stats.BPG ?? stats.BLOCKS)
        const stl = num(stats.STL ?? stats.SPG ?? stats.STEALS)
        switch (propType) {
          case 'points':
          default:
            return pts
          case 'rebounds':
            return reb
          case 'assists':
            return ast
          case 'threes':
            return threes
          case 'blocks':
            return blk
          case 'steals':
            return stl
          case 'points_rebounds':
            return pts != null && reb != null ? pts + reb : null
          case 'points_assists':
            return pts != null && ast != null ? pts + ast : null
          case 'rebounds_assists':
            return reb != null && ast != null ? reb + ast : null
          case 'pra':
            return pts != null && reb != null && ast != null ? pts + reb + ast : null
          case 'blocks_steals':
            return blk != null && stl != null ? blk + stl : null
        }
      }

      const recentFromArray = (recent: any[] | undefined, propType: string) => {
        if (!recent?.length) return { average: null, lines: [] as string[] }
        const values: number[] = []
        const lines: string[] = []
        const labelMap: Record<string, string> = {
          points: 'PTS',
          rebounds: 'REB',
          assists: 'AST',
          threes: '3PM',
          blocks: 'BLK',
          steals: 'STL',
          points_rebounds: 'PTS+REB',
          points_assists: 'PTS+AST',
          rebounds_assists: 'REB+AST',
          pra: 'PRA',
          blocks_steals: 'BLK+STL',
        }
        const statLabel = labelMap[propType] || 'PTS'
        for (const game of recent.slice(0, 5)) {
          const date = String(game?.date || '').slice(0, 10)
          const opp = game?.opponent || ''
          const rawStats = game?.stats || {}
          const statMap: Record<string, number> = {}
          for (const [key, value] of Object.entries(rawStats)) {
            const num = typeof value === 'number' ? value : Number(value)
            if (Number.isFinite(num)) {
              statMap[key.toString().toUpperCase().replace(/\s+/g, '_')] = num
            }
          }
          const value = getPropStatFromMap(statMap, propType)
          if (value != null) values.push(value)
          lines.push(`- ${date}${opp ? ` vs ${opp}` : ''}: ${value ?? 'n/a'} ${statLabel}`)
        }
        const average =
          values.length >= 3
            ? Number((values.reduce((sum, v) => sum + v, 0) / values.length).toFixed(1))
            : null
        return { average, lines }
      }

      const opponentAllowedValue = (stats: Record<string, any> | undefined, propType: string) => {
        if (!stats) return null
        const num = (v: any) => {
          const n = typeof v === 'number' ? v : Number(v)
          return Number.isFinite(n) ? n : null
        }
        switch (propType) {
          case 'points':
          case 'points_rebounds':
          case 'points_assists':
          case 'pra':
          default:
            return num(stats.pointsAgainstPerGame)
          case 'rebounds':
          case 'rebounds_assists':
            return num(stats.opponentReboundsPerGame)
          case 'assists':
            return num(stats.opponentAssistsPerGame)
          case 'threes':
            return num(stats.opponentThreeMadePerGame)
          case 'blocks':
          case 'blocks_steals':
            return num(stats.opponentBlocksPerGame)
          case 'steals':
            return num(stats.opponentStealsPerGame)
        }
      }

      if (playerName) {
        const explicitProp = hasExplicitPropType(message)
        const propType = inferPropType(message)
        const seasonStats = await getPlayerSeasonStats(playerName, 'basketball_nba')
        const playerLabel = seasonStats?.name || playerName
        const playerTeam = seasonStats?.team || ''
        const opponent = (() => {
          // Prefer mentionedTeams (properly detected) over parsedMatchupTeams (may have player name artifacts)
          // Filter out any "team" that looks like it contains the player name
          const validTeams = mentionedTeams.filter(team => {
            const teamToken = normalizeToken(team)
            const playerToken = normalizeToken(playerLabel)
            return !teamToken.includes(playerToken) && !playerToken.includes(teamToken)
          })

          if (validTeams.length >= 1) {
            // If player's team is known, pick the opponent
            if (playerTeam) {
              const teamToken = normalizeToken(playerTeam)
              const nonPlayerTeam = validTeams.find(t => !normalizeToken(t).includes(teamToken))
              if (nonPlayerTeam) return nonPlayerTeam
            }
            return validTeams[0]
          }

          // Fallback to matchupTeams if mentionedTeams is empty
          if (matchupTeams.length >= 2) {
            if (playerTeam) {
              const teamToken = normalizeToken(playerTeam)
              const first = matchupTeams[0]
              const second = matchupTeams[1]
              if (teamToken && normalizeToken(first).includes(teamToken)) return second
              if (teamToken && normalizeToken(second).includes(teamToken)) return first
            }
            return matchupTeams[1]
          }
          if (matchupTeams.length === 1) return matchupTeams[0]
          return ''
        })()
        if (!opponent) {
          return {
            success: false,
            formatted: 'Edge awareness for player props needs a matchup (e.g., "Kevin Durant points prop vs Clippers").',
          }
        }

        const leagueAverageAllowed = (propType: string) => {
          const leagueVals = getStaticNbaTeams()
            .map((team) => opponentAllowedValue(team.stats, propType))
            .filter((val): val is number => typeof val === 'number' && Number.isFinite(val))
          if (!leagueVals.length) return null
          return leagueVals.reduce((sum, v) => sum + v, 0) / leagueVals.length
        }
        const projectPropLine = (propType: string) => {
          if (!seasonStats?.stats && !seasonStats?.recent?.length) return null
          const seasonAvg = seasonStatValue(seasonStats?.stats as Record<string, any> | undefined, propType)
          const recent = recentFromArray(seasonStats?.recent, propType)
          const last5Avg = recent.average
          if (seasonAvg == null && last5Avg == null) return null
          let sum = 0
          let weight = 0
          if (seasonAvg != null) {
            sum += seasonAvg * 0.65
            weight += 0.65
          }
          if (last5Avg != null) {
            sum += last5Avg * 0.25
            weight += 0.25
          }
          let projection = weight > 0 ? sum / weight : null
          if (projection == null) return null
          const oppTeam = findStaticNbaTeam(opponent)[0]
          const opponentAllowed = opponentAllowedValue(oppTeam?.stats, propType)
          const leagueAvg = leagueAverageAllowed(propType)
          if (opponentAllowed != null && leagueAvg != null) {
            projection += (opponentAllowed - leagueAvg) * 0.35
          }
          return Number(projection.toFixed(1))
        }

        if (!explicitProp) {
          let propsBlock = 'No player props available for the specified criteria.'
          try {
            const propsRes = await fetch(
              `${baseUrl}/api/player-props?sport=basketball_nba&player=${encodeURIComponent(playerLabel)}`,
              { cache: 'no-store' }
            )
            const propsData = await propsRes.json()
            if (propsRes.ok && propsData?.data?.length) {
              const playerProp = propsData.data[0]
              const headerParts = [`**${playerProp.player}**`]
              if (playerProp.team) {
                headerParts.push(
                  `(${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
                )
              }
              let formatted = `${headerParts.join(' ')}\n`
              if (playerProp.game) {
                formatted += `Game: ${playerProp.game}\n`
              }
              formatted += `| Market | Line | Best Over | Best Under |\n`
              formatted += `| --- | --- | --- | --- |\n`
              for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
                const modelLine = projectPropLine(marketType)
                const modelLabel = modelLine != null ? modelLine.toFixed(1) : 'n/a'
                const lineLabel =
                  marketData.line !== undefined && marketData.line !== null
                    ? `${marketData.line} (Model ${modelLabel})`
                    : `? (Model ${modelLabel})`
                const bestOver =
                  marketData.over.bestBook
                    ? `${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})`
                    : '?'
                const bestUnder =
                  marketData.under.bestBook
                    ? `${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})`
                    : '?'
                formatted += `| ${marketType.toUpperCase()} | ${lineLabel} | ${bestOver} | ${bestUnder} |\n`
              }
              propsBlock = `${formatted}\nModel lines blend season average, last 5, and opponent strength.\n${buildDataSourceLine(['SBD'])}`
            }
          } catch (err) {
            propsBlock = 'SBD props lookup failed for this player.'
          }

          const lines = [
            `Edge awareness: ${playerLabel} vs ${opponent}`,
            'Inputs',
            `- Player: ${playerLabel}`,
            `- Matchup: ${playerTeam ? `${playerTeam} vs ${opponent}` : opponent}`,
            'Results',
            'Props on board',
            propsBlock,
            'Ask for a specific prop if you want a stat-based edge breakdown.',
          ]
          return { success: true, formatted: lines.join('\n') }
        }

        const seasonAvg = seasonStatValue(seasonStats?.stats as Record<string, any> | undefined, propType)
        let last5Avg: number | null = null
        let last5Lines: string[] = []
        const fromRecent = recentFromArray(seasonStats?.recent, propType)
        last5Avg = fromRecent.average
        last5Lines = fromRecent.lines

        if (last5Avg == null || !last5Lines.length) {
          const seasonYear = getEspnSeasonYearForLogs('nba')
          const searchHit = await searchPlayer(playerLabel, 'basketball_nba')
          const fallback = searchHit?.id ? null : await searchAthlete('nba', playerLabel, 5)
          const playerId = searchHit?.id || fallback?.id
          if (playerId) {
            const recent = await getRecentLogStats({
              sport: 'nba',
              playerId: String(playerId),
              playerName: playerLabel,
              propType,
              seasonYear,
              maxGames: 5,
              minSamples: 3,
            })
            last5Avg = recent.average
            last5Lines = recent.lines
          }
        }

        let opponentAllowed: number | null = null
        let leagueAvg: number | null = null
        if (opponent) {
          const oppTeam = findStaticNbaTeam(opponent)[0]
          opponentAllowed = opponentAllowedValue(oppTeam?.stats, propType)
          const leagueVals = getStaticNbaTeams()
            .map((team) => opponentAllowedValue(team.stats, propType))
            .filter((val): val is number => typeof val === 'number' && Number.isFinite(val))
          if (leagueVals.length) {
            leagueAvg = Number((leagueVals.reduce((sum, v) => sum + v, 0) / leagueVals.length).toFixed(1))
          }
        }

        let sbdLine = 'No SBD prop line found for this player on the current slate.'
        try {
          const propsRes = await fetch(
            `${baseUrl}/api/player-props?sport=basketball_nba&player=${encodeURIComponent(playerLabel)}&market=${encodeURIComponent(propType)}`,
            { cache: 'no-store' }
          )
          const propsData = await propsRes.json()
          const market = propsData?.data?.[0]?.markets?.[propType]
          if (propsRes.ok && market) {
            const line = market.line ?? '?'
            const over = market.over?.best != null ? market.over.best : '?'
            const overBook = market.over?.bestBook || '?'
            const under = market.under?.best != null ? market.under.best : '?'
            const underBook = market.under?.bestBook || '?'
            sbdLine = `SBD line: ${line} | Over ${over} (${overBook}) | Under ${under} (${underBook})`
          }
        } catch (err) {
          sbdLine = 'SBD props lookup failed for this player.'
        }

        const focusLabel =
          {
            points: 'Points',
            rebounds: 'Rebounds',
            assists: 'Assists',
            threes: '3PT Made',
            points_rebounds: 'Points + Rebounds',
            points_assists: 'Points + Assists',
            pra: 'Points + Rebounds + Assists',
            rebounds_assists: 'Rebounds + Assists',
            blocks: 'Blocks',
            steals: 'Steals',
            blocks_steals: 'Blocks + Steals',
          }[propType] || 'Points'

        const lines = [
          `Edge awareness: ${playerLabel} vs ${opponent}`,
          'Inputs',
          `- Player: ${playerLabel}`,
          `- Matchup: ${playerTeam ? `${playerTeam} vs ${opponent}` : opponent}`,
          `- Focus: ${focusLabel}`,
          '- Window: last 5 games vs season average',
          'Results',
        ]
        if (seasonAvg != null) {
          lines.push(`- Season avg: ${seasonAvg.toFixed(1)}`)
        } else {
          lines.push('- Season avg: unavailable')
        }
        if (last5Avg != null) {
          const delta = seasonAvg != null ? Number((last5Avg - seasonAvg).toFixed(1)) : null
          const deltaLabel = delta != null ? ` (${delta >= 0 ? '+' : ''}${delta})` : ''
          lines.push(`- Last 5 avg: ${last5Avg.toFixed(1)}${deltaLabel}`)
        } else {
          lines.push('- Last 5 avg: unavailable')
        }
        if (last5Lines.length) {
          lines.push('Last 5 games')
          lines.push(...last5Lines)
        }
        if (opponentAllowed != null) {
          const label =
            propType === 'points'
              ? 'Opponent PPG allowed'
              : propType === 'threes'
              ? 'Opponent 3PM allowed'
              : propType === 'rebounds'
              ? 'Opponent rebounds allowed'
              : propType === 'assists'
              ? 'Opponent assists allowed'
              : propType === 'blocks'
              ? 'Opponent blocks allowed'
              : propType === 'steals'
              ? 'Opponent steals allowed'
              : 'Opponent allowed'
          const leagueLabel = leagueAvg != null ? ` (league avg ${leagueAvg.toFixed(1)})` : ''
          lines.push(`- ${label}: ${opponentAllowed.toFixed(1)}${leagueLabel}`)
        }
        lines.push(`- ${sbdLine}`)
        if (seasonAvg != null && last5Avg != null) {
          const diff = last5Avg - seasonAvg
          const judgement =
            Math.abs(diff) >= 1
              ? `recent form is ${diff > 0 ? 'above' : 'below'} season by ${Math.abs(diff).toFixed(1)}`
              : 'recent form is close to season average'
          lines.push(`Judgement: ${judgement}; compare this to the SBD line.`)
        } else {
          lines.push('Judgement: not enough recent data to weigh the line; use the SBD line as the anchor.')
        }
        lines.push(buildDataSourceLine(['ESPN', 'Basketball Reference', 'SBD']))
        return { success: true, formatted: lines.join('\n') }
      }

      if (matchupTeams.length < 2) {
        return {
          success: false,
          formatted: 'Please provide a specific matchup (e.g., "Lakers vs Knicks") for edge awareness.',
        }
      }

      const [teamAName, teamBName] = matchupTeams.slice(0, 2)

      // Detect market type from message
      const wantsSpread = /\bspread\b/i.test(message)
      const wantsTotal = /\b(total|over|under|o\/u)\b/i.test(message)
      const wantsMoneyline = /\b(moneyline|ml)\b/i.test(message)
      const isMarketEdge = wantsSpread || wantsTotal || wantsMoneyline

      // If user asks about spread/total/moneyline, do matchup-level edge analysis
      if (isMarketEdge) {
        const lines: string[] = []
        const marketLabel = wantsSpread ? 'Spread' : wantsTotal ? 'Total' : 'Moneyline'
        lines.push(`**Edge Awareness: ${teamAName} vs ${teamBName} (${marketLabel})**`)
        lines.push('')

        // Fetch current odds
        let oddsData: any = null
        try {
          const oddsGames = await fetchOdds('basketball_nba', ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })
          oddsData = oddsGames.find((g: any) => {
            const home = (g.home_team || '').toLowerCase()
            const away = (g.away_team || '').toLowerCase()
            const t1 = teamAName.toLowerCase()
            const t2 = teamBName.toLowerCase()
            return (home.includes(t1) || home.includes(t2) || away.includes(t1) || away.includes(t2))
          })
        } catch (err) {
          console.error('[EDGE_AWARENESS] Odds fetch failed:', err)
        }

        if (oddsData && oddsData.bookmakers?.length) {
          lines.push('**Current Lines**')
          const book = oddsData.bookmakers[0]
          const spreads = book.markets?.find((m: any) => m.key === 'spreads')
          const totals = book.markets?.find((m: any) => m.key === 'totals')
          const h2h = book.markets?.find((m: any) => m.key === 'h2h')

          if (wantsSpread && spreads?.outcomes?.length) {
            for (const o of spreads.outcomes) {
              lines.push(`- ${o.name}: ${o.point > 0 ? '+' : ''}${o.point} (${o.price > 0 ? '+' : ''}${o.price})`)
            }
          } else if (wantsTotal && totals?.outcomes?.length) {
            for (const o of totals.outcomes) {
              lines.push(`- ${o.name} ${o.point}: ${o.price > 0 ? '+' : ''}${o.price}`)
            }
          } else if (wantsMoneyline && h2h?.outcomes?.length) {
            for (const o of h2h.outcomes) {
              lines.push(`- ${o.name}: ${o.price > 0 ? '+' : ''}${o.price}`)
            }
          }
          lines.push(`- Book: ${book.title}`)
          lines.push('')
        } else {
          lines.push('_No current odds found for this matchup_')
          lines.push('')
        }

        // Fetch team stats
        lines.push('**Team Stats**')
        const teamStats = await Promise.all([teamAName, teamBName].map(async (team) => {
          const stats = await getTeamStats('basketball_nba', team)
          const primary = stats?.[0]
          const staticTeam = findStaticNbaTeam(team)?.[0]
          return { team, primary, staticTeam }
        }))

        for (const entry of teamStats) {
          const s = entry.primary?.stats || {}
          const st = entry.staticTeam?.stats || {}
          const record = s.record || (s.wins != null && s.losses != null ? `${s.wins}-${s.losses}` : 'N/A')
          const ppg = s.pointsForPerGame ?? st.pointsPerGame ?? 'N/A'
          const papg = s.pointsAgainstPerGame ?? st.pointsAgainstPerGame ?? 'N/A'
          const ortg = st.offensiveRating ?? s.offensiveRating ?? 'N/A'
          const drtg = st.defensiveRating ?? s.defensiveRating ?? 'N/A'
          const net = st.netRating ?? (typeof ortg === 'number' && typeof drtg === 'number' ? (ortg - drtg).toFixed(1) : 'N/A')
          const pace = st.pace ?? s.pace ?? 'N/A'

          lines.push(`**${entry.team}**: ${record}`)
          lines.push(`- PPG: ${typeof ppg === 'number' ? ppg.toFixed(1) : ppg} | PAPG: ${typeof papg === 'number' ? papg.toFixed(1) : papg}`)
          lines.push(`- ORtg: ${typeof ortg === 'number' ? ortg.toFixed(1) : ortg} | DRtg: ${typeof drtg === 'number' ? drtg.toFixed(1) : drtg} | Net: ${typeof net === 'number' ? (net > 0 ? '+' : '') + net.toFixed(1) : net}`)
          lines.push(`- Pace: ${typeof pace === 'number' ? pace.toFixed(1) : pace}`)
        }
        lines.push('')

        // Fetch ATS trends
        lines.push('**Betting Trends**')
        for (const entry of teamStats) {
          const ats = await getTeamATSData(entry.team, 'basketball_nba')
          if (ats?.success && ats.data) {
            const parts: string[] = []
            if (ats.data.overallATS) parts.push(`ATS: ${ats.data.overallATS}`)
            if (ats.data.homeATS) parts.push(`Home: ${ats.data.homeATS}`)
            if (ats.data.awayATS) parts.push(`Away: ${ats.data.awayATS}`)
            if (ats.data.last10) parts.push(`L10: ${ats.data.last10}`)
            if (parts.length) {
              lines.push(`- ${entry.team}: ${parts.join(' | ')}`)
            }
          }
        }
        lines.push('')

        // Edge analysis based on stats
        lines.push('**Edge Analysis**')
        const team1Stats = teamStats[0]?.staticTeam?.stats || teamStats[0]?.primary?.stats || {} as any
        const team2Stats = teamStats[1]?.staticTeam?.stats || teamStats[1]?.primary?.stats || {} as any

        const t1Ortg = typeof team1Stats.offensiveRating === 'number' ? team1Stats.offensiveRating : null
        const t1Drtg = typeof team1Stats.defensiveRating === 'number' ? team1Stats.defensiveRating : null
        const t2Ortg = typeof team2Stats.offensiveRating === 'number' ? team2Stats.offensiveRating : null
        const t2Drtg = typeof team2Stats.defensiveRating === 'number' ? team2Stats.defensiveRating : null

        const t1Net = typeof team1Stats.netRating === 'number' ? team1Stats.netRating : (t1Ortg != null && t1Drtg != null ? t1Ortg - t1Drtg : null)
        const t2Net = typeof team2Stats.netRating === 'number' ? team2Stats.netRating : (t2Ortg != null && t2Drtg != null ? t2Ortg - t2Drtg : null)

        if (typeof t1Net === 'number' && typeof t2Net === 'number') {
          const netDiff = t1Net - t2Net
          const projectedSpread = -(netDiff / 2.5).toFixed(1) // Rough conversion: ~2.5 net rating per point
          lines.push(`- Net rating differential: ${netDiff > 0 ? '+' : ''}${netDiff.toFixed(1)} (${teamAName} vs ${teamBName})`)
          lines.push(`- Implied spread projection: ${teamAName} ${Number(projectedSpread) > 0 ? '+' : ''}${projectedSpread}`)

          // Compare to market if we have odds
          if (oddsData?.bookmakers?.[0]) {
            const spreads = oddsData.bookmakers[0].markets?.find((m: any) => m.key === 'spreads')
            if (spreads?.outcomes?.length) {
              const t1Spread = spreads.outcomes.find((o: any) =>
                o.name.toLowerCase().includes(teamAName.toLowerCase())
              )
              if (t1Spread) {
                const marketSpread = t1Spread.point
                const projNum = Number(projectedSpread)
                const diff = projNum - marketSpread
                if (Math.abs(diff) >= 1.5) {
                  lines.push(`- **Edge detected**: Model projects ${teamAName} at ${projectedSpread}, market has ${marketSpread > 0 ? '+' : ''}${marketSpread}`)
                  lines.push(`- Lean: ${diff > 0 ? teamBName : teamAName} (${Math.abs(diff).toFixed(1)} pts of value)`)
                } else {
                  lines.push(`- No significant edge: projection aligns with market (within 1.5 pts)`)
                }
              }
            }
          }
        } else {
          lines.push('- Insufficient stats data to project edge')
        }

        lines.push('')
        lines.push(buildDataSourceLine(['The Odds API', 'ESPN', 'Basketball Reference']))

        return { success: true, formatted: lines.join('\n') }
      }

      const resolvedTeams = await Promise.all([teamAName, teamBName].map((team) => resolveEspnTeamId('nba', team)))
      if (resolvedTeams.some((team) => !team)) {
        return {
          success: false,
          formatted: 'I could not resolve both teams on ESPN. Try a clearer matchup like "Lakers vs Knicks".',
        }
      }
      const [teamA, teamB] = resolvedTeams as Array<{ id: string; name: string; abbr?: string }>
      const rosters = await Promise.all([
        getRoster('nba', teamA.abbr || teamA.id).catch(() => []),
        getRoster('nba', teamB.abbr || teamB.id).catch(() => []),
      ])
      const toCandidatePlayers = (roster: any[], teamName: string) => {
        const players = roster
          .map((player: any) => {
            const name =
              String(
                player?.fullName ||
                  player?.displayName ||
                  player?.shortName ||
                  player?.name ||
                  ''
              ).trim()
            if (!name) return null
            const metrics = getStaticPlayerStats(name, 'points')
            const mpg = Number(metrics?.minutesPerGame ?? 0)
            return {
              id: player?.id ? String(player.id) : '',
              name,
              team: teamName,
              mpg: Number.isFinite(mpg) ? mpg : 0,
            }
          })
          .filter(Boolean) as Array<{ id: string; name: string; team: string; mpg: number }>
        players.sort((a, b) => (b.mpg || 0) - (a.mpg || 0))
        const core = players.filter((p) => p.mpg >= 18)
        return (core.length ? core : players).slice(0, 6)
      }
      const candidates = [
        ...toCandidatePlayers(rosters[0] || [], teamA.name || teamAName),
        ...toCandidatePlayers(rosters[1] || [], teamB.name || teamBName),
      ]
      const seen = new Set<string>()
      const uniqueCandidates = candidates.filter((player) => {
        const token = normalizeToken(player.name)
        if (!token || seen.has(token)) return false
        seen.add(token)
        return true
      })

      if (!uniqueCandidates.length) {
        return { success: false, formatted: 'I could not identify player candidates for that matchup.' }
      }

      const seasonYear = getEspnSeasonYearForLogs('nba')
      const candidateSignals: Array<{
        name: string
        team: string
        statLabel: string
        seasonAvg: number
        recentAvg: number
        delta: number
        usage?: number
        bpm?: number
        per?: number
      }> = []

      const getRecentAverages = async (playerId: string, name: string) => {
        if (!playerId) return { points: null, assists: null, rebounds: null }
        const logsRaw = await getPlayerGameLogs('nba', playerId, seasonYear, 2).catch(() => [])
        const logs = Array.isArray(logsRaw) ? logsRaw : Object.values(logsRaw || {})
        logs.sort((a: any, b: any) => {
          const tA = new Date(String(a?.date || a?.gameDate || a?.game_date || '')).getTime()
          const tB = new Date(String(b?.date || b?.gameDate || b?.game_date || '')).getTime()
          return (Number.isFinite(tB) ? tB : 0) - (Number.isFinite(tA) ? tA : 0)
        })
        const recent = logs.slice(0, 5)
        const ptsVals: number[] = []
        const astVals: number[] = []
        const rebVals: number[] = []
        for (const entry of recent) {
          let statMap = buildStatMapFromEspnEntry(entry)
          if (!Object.keys(statMap).length) {
            const eventId = String(entry?.id || entry?.eventId || '')
            if (eventId) {
              const snapshot = await getEventSnapshot('nba', eventId)
              const snapshotMap = extractStatMapFromSnapshot(snapshot, playerId, name)
              if (snapshotMap) statMap = snapshotMap
            }
          }
          const pts = getPropStatFromMap(statMap, 'points')
          const ast = getPropStatFromMap(statMap, 'assists')
          const reb = getPropStatFromMap(statMap, 'rebounds')
          if (pts != null) ptsVals.push(pts)
          if (ast != null) astVals.push(ast)
          if (reb != null) rebVals.push(reb)
        }
        const avg = (vals: number[]) =>
          vals.length >= 3 ? Number((vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(1)) : null
        return { points: avg(ptsVals), assists: avg(astVals), rebounds: avg(rebVals) }
      }

      await Promise.all(
        uniqueCandidates.map(async (player) => {
          const seasonData = await getPlayerSeasonStats(player.name, 'basketball_nba')
          if (!seasonData?.stats) return
          const seasonPts = seasonStatValue(seasonData.stats as Record<string, any>, 'points')
          const seasonAst = seasonStatValue(seasonData.stats as Record<string, any>, 'assists')
          const seasonReb = seasonStatValue(seasonData.stats as Record<string, any>, 'rebounds')
          const recent = await getRecentAverages(player.id, player.name)
          const candidates = [
            { stat: 'points', label: 'Points', season: seasonPts, recent: recent.points, minDelta: 2.5 },
            { stat: 'assists', label: 'Assists', season: seasonAst, recent: recent.assists, minDelta: 1.2 },
            { stat: 'rebounds', label: 'Rebounds', season: seasonReb, recent: recent.rebounds, minDelta: 1.2 },
          ]
            .map((entry) => {
              if (entry.season == null || entry.recent == null) return null
              const delta = Number((entry.recent - entry.season).toFixed(1))
              return delta < entry.minDelta ? null : { ...entry, delta }
            })
            .filter(Boolean)
            .sort((a: any, b: any) => (b?.delta || 0) - (a?.delta || 0))[0] as
            | { stat: string; label: string; season: number; recent: number; delta: number }
            | undefined
          if (!candidates) return
          const metrics = getStaticPlayerStats(player.name, candidates.stat)
          candidateSignals.push({
            name: player.name,
            team: player.team,
            statLabel: candidates.label,
            seasonAvg: candidates.season,
            recentAvg: candidates.recent,
            delta: candidates.delta,
            usage: metrics?.usage,
            bpm: metrics?.bpm,
            per: metrics?.per,
          })
        })
      )

      if (!candidateSignals.length) {
        return {
          success: false,
          formatted: `No strong recent-over-season signals found for ${teamA.name} vs ${teamB.name}. Try another matchup or specify a player.`,
        }
      }

      const signals = candidateSignals
        .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
        .slice(0, 5)
      const lines = [
        `Edge awareness: ${teamA.name} vs ${teamB.name}`,
        'Inputs',
        `- Matchup: ${teamA.name} vs ${teamB.name}`,
        '- Window: last 5 games vs season average',
        'Results',
        'Players trending above season averages (last 5 games):',
      ]
      for (const signal of signals) {
        const extras: string[] = []
        if (typeof signal.usage === 'number') extras.push(`Usage ${signal.usage.toFixed(1)}%`)
        if (typeof signal.bpm === 'number') extras.push(`BPM ${signal.bpm.toFixed(1)}`)
        if (typeof signal.per === 'number') extras.push(`PER ${signal.per.toFixed(1)}`)
        const extraText = extras.length ? ` | ${extras.join(', ')}` : ''
        lines.push(
          `- ${signal.name} (${signal.team}): ${signal.statLabel} last 5 = ${signal.recentAvg.toFixed(1)} vs season ${signal.seasonAvg.toFixed(1)} (+${signal.delta.toFixed(1)})${extraText}`
        )
      }
      lines.push(buildDataSourceLine(['ESPN', 'Basketball Reference']))
      lines.push('If you want prop lines or books, ask for player props and I will compare to SBD lines.')
      return { success: true, formatted: lines.join('\n') }
    }

    if (
      bettingEducationIntent &&
      !analysisIntent &&
      !pickGuidanceIntent &&
      !edgeAwarenessIntent &&
      !propIntent &&
      !betIntent &&
      !twoTeamOddsQuery
    ) {
      const reply = [
        'Short answer: long-run profit requires edge plus discipline, and most bettors lose over time.',
        '',
        'Practical approach:',
        '- Line shop across books and avoid high-vig parlays.',
        '- Bet only when you have value (your win probability exceeds implied odds).',
        '- Manage bankroll: flat stakes or fractional Kelly; cap per bet.',
        '- Track results and CLV; never chase losses.',
        '- Focus on a few leagues/markets you can model well.',
        '',
        'If you want, tell me your sport, bankroll, and risk tolerance and I can help with EV, Kelly sizing, or line comparisons.',
      ].join('\n')
      return streamTextResponse(reply)
    }

    // Route to Player Analysis (player props)
    if (playerAnalysisIntent && !modelApplicationIntent && !researchIntent) {
      const result = await runPlayerAnalysis()
      if (result?.formatted) return streamTextResponse(result.formatted)
    }

    // Route to Matchup Analysis (team vs team markets)
    if (matchupAnalysisIntent && !modelApplicationIntent && !researchIntent) {
      const result = await runMatchupAnalysis()
      if (result?.formatted) return streamTextResponse(result.formatted)
    }

    // Player game line shortcut (ESPN gamelog)
    if (playerNameInMessage && playerGameIntent.wantsGameLine && !propIntent && !oddsKeywordMatch) {
      try {
        const sportGuess =
          msgLower.match(/nfl|football/) ? 'nfl' :
          msgLower.match(/mlb|baseball/) ? 'mlb' :
          msgLower.match(/nhl|hockey/) ? 'nhl' :
          'nba'
        const season = getEspnSeasonYearForLogs(sportGuess, playerGameIntent.dateHint)
        const athleteSearch = await searchAthlete(sportGuess as any, playerNameInMessage)
        const athleteId = athleteSearch?.id
        const playerEntry = athleteId ? { id: athleteId } : await searchPlayer(playerNameInMessage, sportGuess)
        if (!playerEntry?.id) {
          return streamTextResponse(`I couldn't find ${playerNameInMessage}. Try a more exact name or specify the sport.`)
        }
        let logs = await espnToolResolvers.espnPlayerGameLogs({
          sport: sportGuess,
          playerId: playerEntry.id,
          season,
          seasonType: 2,
        })
        let filtered = filterGameLogs(logs as any[], {
          date: playerGameIntent.dateHint,
          opponent: playerGameIntent.opponentHint,
          lastN: playerGameIntent.lastN,
        })

        if (!filtered?.length && playerGameIntent.opponentHint) {
          filtered = filterGameLogs(logs as any[], {
            date: playerGameIntent.dateHint,
            lastN: playerGameIntent.lastN,
          })
        }

        if (!filtered?.length) {
          const prevSeason = season - 1
          if (prevSeason > 2000) {
            logs = await espnToolResolvers.espnPlayerGameLogs({
              sport: sportGuess,
              playerId: playerEntry.id,
              season: prevSeason,
              seasonType: 2,
            })
            filtered = filterGameLogs(logs as any[], {
              date: playerGameIntent.dateHint,
              opponent: playerGameIntent.opponentHint,
              lastN: playerGameIntent.lastN,
            })
          }
        }

        // Fallback: use scoreboard + event summary for exact date/opponent
        if (!filtered?.length && playerGameIntent.dateHint) {
          try {
            const scoreboard = await fetchAllLiveScores({ date: playerGameIntent.dateHint, includeCompletedForDate: true })
            const targetOpp = normalizeToken((playerGameIntent.opponentHint || '').replace(/\bon\b$/i, '').trim())
            let game = (scoreboard.games || []).find((g: any) => {
              const teams = (g.competitors || []).map((c: any) => normalizeToken(c?.name || c?.shortName || c?.abbreviation || ''))
              return teams.some((t: string) => (targetOpp ? t.includes(targetOpp) || targetOpp.includes(t) : true))
            })
            if (!game && (scoreboard.games || []).length) {
              game = (scoreboard.games || [])[0]
            }
            if (game?.eventId) {
              let playerFound: any = null
              try {
                const details = await fetchGameDetails(sportGuess as LeagueId, game.eventId)
                playerFound = findPlayerInGameDetails(details, playerNameInMessage)
              } catch (errSummary) {
                console.warn('[PLAYER_GAME_LINE_SHORTCUT][EVENT_FALLBACK][LIVESCORES] Failed', errSummary)
                try {
                  const snapshot = await getEventSnapshot(sportGuess as any, String(game.eventId))
                  const boxPlayers = snapshot?.boxscore?.players || []
                  const flattenPlayers = boxPlayers.flatMap((p: any) => (p?.statistics || []).flatMap((s: any) => s?.athletes || []))
                  playerFound = findPlayerInGameDetails({ teams: [{ starters: flattenPlayers }] }, playerNameInMessage)
                } catch (errSnap) {
                  console.warn('[PLAYER_GAME_LINE_SHORTCUT][EVENT_FALLBACK][SNAPSHOT] Failed', errSnap)
                }
              }
              if (playerFound) {
                const line = formatPlayerGameLine(playerFound)
                return streamTextResponse(`${playerNameInMessage} vs ${playerGameIntent.opponentHint || 'opponent'} on ${playerGameIntent.dateHint}\n${line}`)
              }
            }
          } catch (e) {
            console.warn('[PLAYER_GAME_LINE_SHORTCUT][EVENT_FALLBACK] Failed', e)
          }
        }
        if (filtered.length === 1) {
          return streamTextResponse(formatGameLogEntry(filtered[0]))
        }
        const lines = filtered.slice(0, 5).map((g: any) => formatGameLogEntry(g))
        return streamTextResponse(lines.join('\n\n'))
      } catch (err) {
        console.error('[PLAYER_GAME_LINE_SHORTCUT] Failed:', err)
        // fall through to normal flow
      }
    }

      const explicitMatchup =
        twoTeamOddsQuery &&
        ((parsedMatchupTeams.length >= 2) || (mentionedTeams.length >= 2))

      if (analysisIntent && !modelApplicationIntent && !researchIntent) {
        const analysisResult = await runBetMarketAnalysis({})
        return streamTextResponse(analysisResult.formatted)
      }

      if (pickGuidanceIntent && !modelApplicationIntent && !researchIntent) {
        const guidanceResult = await runPickGuidance({})
        return streamTextResponse(guidanceResult.formatted)
      }

      const shouldFetchOdds =
        !conceptualStatsOnly &&
        !betIntent &&
        !researchIntent &&
      !webSearchToggle &&
      !modelApplicationIntent &&
      !playerGameStatsIntent &&
      !teamStatsIntent &&
      !intent.ats &&
      !intent.oddsRecord &&
      !intent.pastPerformances &&
      !isProjectionQuery &&
      explicitMatchup

    if ((intent.ats || intent.oddsRecord || intent.pastPerformances || intent.futures) && (mentionedTeams.length || parsedMatchupTeams.length)) {
      const handled = await maybeHandleEspnTeamBetting()
      if (handled) return handled
    }

    const loadNcaabSlateTeams = async () => {
      const today = new Date().toISOString().slice(0, 10)
      if (ncaabSlateCache && ncaabSlateCache.date === today && Date.now() - ncaabSlateCache.timestamp < 5 * 60 * 1000) {
        return ncaabSlateCache.teams
      }
      try {
        const slate = await fetchAllLiveScores({ date: today })
        const teams = new Set<string>()
        slate.games
          .filter((g) => g.league === 'ncaab')
          .forEach((game) => {
            game.competitors?.forEach((team) => {
              if (team.name) teams.add(team.name.toLowerCase())
              if (team.shortName) teams.add(team.shortName.toLowerCase())
              if (team.abbreviation) teams.add(team.abbreviation.toLowerCase())
            })
          })
        ncaabSlateCache = { date: today, teams, timestamp: Date.now() }
        return teams
      } catch (e) {
        console.warn('[ODDS] Failed to load NCAAB slate for detection', e)
        return new Set<string>()
      }
    }
    let ncaabSlateTeams: Set<string> | null = null
    if (shouldFetchOdds || /(ncaab|college basketball|cbb|college hoops)/i.test(message)) {
      ncaabSlateTeams = await loadNcaabSlateTeams()
    }
    const ncaabInlineTeams: string[] =
      ncaabSlateTeams && ncaabSlateTeams.size
        ? Array.from(ncaabSlateTeams).filter((team) => {
            // Require whole-word or clear match; avoid noise like "bills" matching "ill"
            const pattern = new RegExp(`\\b${team.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i')
            return pattern.test(message)
          })
        : []
    if (ncaabInlineTeams.length) {
      console.log('[DEBUG] NCAAB teams detected from live slate:', ncaabInlineTeams)
    }
    let scoresContext = ''
    let pendingOddsReply: string | null = null
    if (scheduleIntent) {
      console.log('[SCHEDULE] Request detected, fetching provider events...')
      const ml = msgLower
      const sportsList: string[] = []
      const push = (k: string) => { if (!sportsList.includes(k)) sportsList.push(k) }
      if (/nba|basketball/.test(ml)) push('basketball_nba')
      if (/nfl|football/.test(ml)) push('americanfootball_nfl')
      if (/nhl|hockey/.test(ml)) push('icehockey_nhl')
      if (/mlb|baseball/.test(ml)) push('baseball_mlb')
      if (/ncaaf|college\s+football|cfb/.test(ml)) push('americanfootball_ncaaf')
      if (/ncaab|college\s+basketball/.test(ml)) push('basketball_ncaab')
      if (sportsList.length === 0) push('basketball_nba')
      const day = /(tomorrow|tmrw|next day)/i.test(ml) ? 'tomorrow' : 'today'
      const all: { sport: string; events: any[] }[] = []
      for (const sk of sportsList) {
        try {
          const evs = await fetchEventsIO(sk, { status: 'pending', tz: timezone, day })
          if (evs.length) all.push({ sport: sk, events: evs })
        } catch (err) {
          console.error('[SCHEDULE] Provider events error for', sk, err)
        }
      }
      if (all.length > 0) {
        const fmtTime = (iso?: string) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: timezone, weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true, timeZoneName:'short' }) : ''
        const lines: string[] = []
        for (const bucket of all) {
          lines.push(`\n**${formatLeagueLabel(bucket.sport)}**`)
          for (const e of bucket.events) {
            const when = fmtTime(e.date)
            const st = (e.status || 'pending').toUpperCase()
            lines.push(`- ${e.away} @ ${e.home} (${when}) [${st}]`)
          }
        }
        scoresContext = `\n\n**PROVIDER SCHEDULE LOADED**\nUse this data for schedule questions. Do not claim lack of access.\n${lines.join('\n')}\n`
        console.log('[SCHEDULE] Context built successfully (provider), sports:', all.length)
      } else {
        scoresContext = '\n\n(No schedule available for the requested criteria)\n'
        console.log('[SCHEDULE] No provider events found for', sportsList.join(','))
      }
    }

    if (bettingSplitsIntent) {
      try {
        const wantsAllGames = /\b(all games|every game|full slate|all splits)\b/i.test(msgLower)
        const teams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
        const splitsResponse =
          !wantsAllGames && teams.length > 0
            ? await summarizeCoversGameSplitsForChat({
                message,
                teams,
                timezone,
              })
            : await summarizeCoversSplitsForChat({
                message,
                teams,
                timezone,
              })

        return streamTextResponse(splitsResponse)
      } catch (err: any) {
        console.error('[SPLITS] Failed to fetch SBD splits', err)
        return streamTextResponse('Betting splits are unavailable right now. Try again in a bit or specify the league.')
      }
    }

    if (crossMarketEVIntent) {
      try {
        console.log('[CROSS-MARKET-EV] Intent detected, scanning for +EV opportunities...')
        const opportunities = await findEVOpportunities({
          minEV: 3, // 3% for team markets
          minPropEV: 3, // 3% for player props
          minBooks: 2,
          limit: 50,
          includeProps: true,
        })
        const evResponse = formatEVResults(opportunities)
        return streamTextResponse(evResponse)
      } catch (err: any) {
        console.error('[CROSS-MARKET-EV] Failed to find EV opportunities', err)
        return streamTextResponse('Unable to scan for EV opportunities right now. Please try again in a moment.')
      }
    }

    // If user wants to log/settle bet, avoid fetching odds
    if (betIntent) {
      console.log('[BET] Bet intent detected; skipping odds fetch')
    }

    let oddsContext = ''
    let totalGamesAvailable = 0
    if (shouldFetchOdds) {
      console.log('[ODDS] Odds request detected, fetching data...')
      try {
        // Try to extract sport from message
        const messageLower = msgLower

        // Detect if user is asking about tomorrow
        const isTomorrowQuery = messageLower.match(/(tomorrow(?:'s)?|tmrw|next day)/i)
        const isTodayQuery = messageLower.match(/(today(?:'s)?|tonight|this evening)/i)

        // Decide whether to fetch LIVE vs PENDING odds
        // Fetch LIVE when the user explicitly asks for live context or mentions specific teams (implies current interest)
        const fetchLive = !isTomorrowQuery && Boolean(wantsLiveOdds)
        const requestedLive = fetchLive
        let usedLive = false
        let usedFallback = false

        const requestedOddsMarkets = (() => {
          const markets = new Set(['h2h', 'spreads', 'totals'])
          const wantsAnyHalf =
            /\b(half|halftime|1h|2h|1st half|2nd half|first half|second half)\b/i.test(messageLower)
          const wantsAnyQuarter =
            /\b(q1|q2|q3|q4|quarter|1st quarter|2nd quarter|3rd quarter|4th quarter)\b/i.test(
              messageLower
            )

          if (wantsAnyHalf) {
            const wantsFirstHalf = /\b(1st|first)\s*half\b|\b1h\b/i.test(messageLower)
            const wantsSecondHalf = /\b(2nd|second)\s*half\b|\b2h\b/i.test(messageLower)
            if (wantsFirstHalf) markets.add('totals_1h')
            if (wantsSecondHalf) markets.add('totals_2h')
            if (!wantsFirstHalf && !wantsSecondHalf) {
              markets.add('totals_1h')
              markets.add('totals_2h')
            }
          }

          if (wantsAnyQuarter) {
            const wantsQ1 = /\bq1\b|\b1st quarter\b|\bfirst quarter\b/i.test(messageLower)
            const wantsQ2 = /\bq2\b|\b2nd quarter\b|\bsecond quarter\b/i.test(messageLower)
            const wantsQ3 = /\bq3\b|\b3rd quarter\b|\bthird quarter\b/i.test(messageLower)
            const wantsQ4 = /\bq4\b|\b4th quarter\b|\bfourth quarter\b/i.test(messageLower)
            if (wantsQ1) markets.add('totals_q1')
            if (wantsQ2) markets.add('totals_q2')
            if (wantsQ3) markets.add('totals_q3')
            if (wantsQ4) markets.add('totals_q4')
            if (!wantsQ1 && !wantsQ2 && !wantsQ3 && !wantsQ4) {
              markets.add('totals_q1')
              markets.add('totals_q2')
              markets.add('totals_q3')
              markets.add('totals_q4')
            }
          }

          return Array.from(markets)
        })()

        // Simple team lists for league detection
        const nbaTeams = ['lakers', 'celtics', 'warriors', 'bulls', 'heat', 'knicks', 'nets',
                         'sixers', 'bucks', 'raptors', 'mavericks', 'rockets', 'spurs',
                         'suns', 'clippers', 'nuggets', 'jazz', 'blazers', 'kings', 'thunder',
                         'timberwolves', 'pelicans', 'grizzlies', 'hornets', 'magic',
                         'wizards', 'pistons', 'pacers', 'cavaliers', 'hawks']

        const nflTeams = ['chiefs', 'bills', 'bengals', 'ravens', 'cowboys', 'eagles',
                         'packers', '49ers', 'rams', 'seahawks', 'buccaneers', 'saints',
                         'patriots', 'dolphins', 'jets', 'steelers', 'browns', 'raiders',
                         'chargers', 'broncos', 'colts', 'jaguars', 'titans', 'texans',
                         'panthers', 'falcons', 'cardinals', 'vikings', 'lions', 'bears',
                         'commanders', 'giants']

        const ncaafTeams = ['alabama', 'georgia', 'ohio state', 'michigan', 'oregon', 'texas',
                           'penn state', 'notre dame', 'usc', 'clemson', 'florida state', 'miami',
                           'lsu', 'oklahoma', 'tennessee', 'auburn', 'florida', 'texas a&m',
                           'ole miss', 'arkansas', 'kentucky', 'south carolina', 'missouri',
                           'wisconsin', 'iowa', 'nebraska', 'minnesota', 'northwestern',
                           'stanford', 'washington', 'ucla', 'utah', 'colorado', 'arizona state']

        let sports: string[] = []

        // Check for explicit sport mentions (prioritize specific leagues)
        // Basketball
        if (messageLower.match(/(ncaa|college basketball|ncaab|march madness|college hoops)/i)) {
          sports = ['basketball_ncaab']
        } else if (messageLower.match(/(nba|pro basketball)/i)) {
          sports = ['basketball_nba']
        } else if (messageLower.match(/basketball/i) && !messageLower.match(/(nba|ncaa|college)/i)) {
          sports = ['basketball_nba']
        }
        // Football
        else if (messageLower.match(/(ncaaf|college football|cfb)/i)) {
          sports = ['americanfootball_ncaaf']
        } else if (messageLower.match(/(nfl|pro football)/i)) {
          sports = ['americanfootball_nfl']
        } else if (messageLower.match(/football/i) && !messageLower.match(/(nfl|ncaa|college)/i)) {
          sports = ['americanfootball_nfl']
        }
        // Other sports
        else if (messageLower.match(/(mlb|baseball)/i)) {
          sports = ['baseball_mlb']
        } else if (messageLower.match(/(nhl|hockey)/i)) {
          sports = ['icehockey_nhl']
        }
        // Parsed matchup with college hoops hints
        else if (
          parsedMatchupTeams.length > 0 &&
          /(ncaab|college basketball|college hoops|cbb|ncaa)/i.test(messageLower)
        ) {
          sports = ['basketball_ncaab']
        }
        // Live-slate teams ONLY when message has explicit college hoops cues
        else if (ncaabInlineTeams.length > 0 && /(ncaab|college basketball|college hoops|cbb|ncaa)/i.test(messageLower)) {
          sports = ['basketball_ncaab']
        }
        // Check for team names if no explicit sport
        else if (nbaTeams.some(team => messageLower.includes(team))) {
          sports = ['basketball_nba']
        } else if (nflTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_nfl']
        } else if (ncaafTeams.some(team => messageLower.includes(team))) {
          sports = ['americanfootball_ncaaf']
        }
        // If asking for arbitrage without specifying sport, fetch all major sports
        else if (messageLower.match(/(arbitrage|arb)/i)) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'icehockey_nhl']
        }
        // If no specific sport detected but user is asking about odds/games, fetch all major sports
        else if (shouldFetchOdds && sports.length === 0) {
          sports = ['basketball_nba', 'americanfootball_nfl', 'americanfootball_ncaaf', 'icehockey_nhl']
        }

        if (sports.length > 0) {
          const allOddsData: any[] = []
          const oddsPerf: Array<{ sport: string; ms: number; liveUsed: boolean; games: number }> = []
          let oddsFailureMessage: string | null = null
          let lastTeamFilter: string[] | undefined
          const withHardTimeout = async <T>(promise: Promise<T>, ms: number, label: string) => {
            let timer: NodeJS.Timeout | undefined
            try {
              return await Promise.race<T>([
                promise,
                new Promise<T>((_, reject) => {
                  timer = setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms)
                }) as Promise<T>,
              ])
            } finally {
              if (timer) clearTimeout(timer)
            }
          }
          const MAX_ODDS_FETCH_MS = 6000

          // Top 25 College Football Teams (updated weekly during season)
          const top25CFBTeams = [
            'oregon', 'georgia', 'ohio state', 'texas', 'penn state',
            'tennessee', 'indiana', 'notre dame', 'miami', 'byu',
            'ole miss', 'alabama', 'boise state', 'smu', 'army',
            'clemson', 'colorado', 'washington state', 'kansas state', 'lsu',
            'louisville', 'south carolina', 'missouri', 'tulane', 'iowa state'
          ]

          // Helper function to check if a team is Top 25
          const isTop25Team = (teamName: string): boolean => {
            const lowerTeamName = teamName.toLowerCase()
            return top25CFBTeams.some(ranked => lowerTeamName.includes(ranked))
          }

          // Fetch odds for each sport
          for (const sport of sports) {
            const sportStart = Date.now()
            try {
              // Expand team names to include all variations for better matching across all sports
              const teamFilterList =
                mentionedTeams.length > 0
                  ? mentionedTeams.flatMap(team => teamVariations[team] || [team])
                  : parsedMatchupTeams.length > 0
                    ? parsedMatchupTeams
                    : ncaabInlineTeams.length > 0 && sport === 'basketball_ncaab'
                      ? ncaabInlineTeams
                      : undefined
              lastTeamFilter = teamFilterList
              const now = Date.now()
              const sportTimeoutMs = sport === 'basketball_ncaab' ? 10000 : MAX_ODDS_FETCH_MS

              console.log(`[DEBUG] Fetching odds for ${sport}, live=${fetchLive}, teams=${teamFilterList ? teamFilterList : 'all'}`)
              let pendingData: OddsGame[] = []
              try {
                pendingData = await withHardTimeout(
                  fetchOdds(sport, requestedOddsMarkets, {
                    live: false,
                    teamFilter: teamFilterList
                  }),
                  sportTimeoutMs,
                  `${sport}-pending`
                )
              } catch (firstErr) {
                console.log(`[DEBUG] Pending fetch timed out for ${sport}, retrying once without team filter`)
                pendingData = await withHardTimeout(
                  fetchOdds(sport, requestedOddsMarkets, {
                    live: false,
                    teamFilter: undefined
                  }),
                  sportTimeoutMs,
                  `${sport}-pending-retry`
                )
              }
              console.log(`[DEBUG] Pending data for ${sport}:`, pendingData.length, 'games')
              let oddsData = pendingData
              let liveData: OddsGame[] = []

              if (fetchLive) {
                try {
                  liveData = await withHardTimeout(
                    fetchOdds(sport, requestedOddsMarkets, {
                      live: true,
                      teamFilter: teamFilterList
                    }),
                    sportTimeoutMs,
                    `${sport}-live`
                  )
                  console.log(`[DEBUG] Live data for ${sport}:`, liveData.length, 'games')
                  if (liveData.length > 0) {
                    usedLive = true
                  }
                } catch (liveError: any) {
                  console.log(`[DEBUG] Live odds fetch failed for ${sport}, using pending data only:`, liveError?.message || liveError)
                  // Don't throw - just continue with pending data
                }

                const combined = new Map<string, OddsGame & { status?: string }>()
                const pushGames = (games: OddsGame[], statusLabel: 'live' | 'pre-match') => {
                  for (const game of games) {
                    const annotated: OddsGame & { status?: string } = {
                      ...game,
                      status: statusLabel === 'live' ? 'LIVE' : (game as any).status || 'PREMATCH',
                    }
                    combined.set(game.id, annotated)
                  }
                }

                if (pendingData.length > 0) pushGames(pendingData, 'pre-match')
                if (liveData.length > 0) pushGames(liveData, 'live')
                oddsData = Array.from(combined.values())
              }

              // Drop games that are too far out (more than ~3 days) to keep responses focused
              if (oddsData.length > 0) {
                const horizonMs = now + 3 * 24 * 60 * 60 * 1000
                oddsData = oddsData.filter((game: any) => {
                  const t = new Date(game.commence_time).getTime()
                  return !Number.isNaN(t) && t <= horizonMs
                })
              }

              // For NCAAB, drop games whose teams are not in today's NCAAB live-scores slate (when available)
              if (sport === 'basketball_ncaab' && ncaabSlateTeams && ncaabSlateTeams.size && oddsData.length > 0) {
                oddsData = oddsData.filter((game: any) => {
                  const home = (game.home_team || '').toLowerCase()
                  const away = (game.away_team || '').toLowerCase()
                  const matches = (team: string) =>
                    Array.from(ncaabSlateTeams as Set<string>).some((name) => name && team.includes(name))
                  return matches(home) && matches(away)
                })
              }

              usedFallback = fetchLive && !usedLive

              // Filter games to user's "today" or "tomorrow" in their timezone if explicitly requested
              const applyDayFilter = Boolean(isTomorrowQuery || isTodayQuery)
              if (applyDayFilter && oddsData.length > 0) {
                const now = new Date()
                const dateInUserTZ = new Date(now.toLocaleString('en-US', { timeZone: timezone }))

                let startOfDay: Date
                let endOfDay: Date

                if (isTomorrowQuery) {
                  // Filter for tomorrow's games
                  const tomorrow = new Date(dateInUserTZ)
                  tomorrow.setDate(tomorrow.getDate() + 1)
                  startOfDay = new Date(tomorrow)
                  startOfDay.setHours(0, 0, 0, 0)
                  endOfDay = new Date(tomorrow)
                  endOfDay.setHours(23, 59, 59, 999)
                } else {
                  // Filter for today's games (default)
                  startOfDay = new Date(dateInUserTZ)
                  startOfDay.setHours(0, 0, 0, 0)
                  endOfDay = new Date(dateInUserTZ)
                  endOfDay.setHours(23, 59, 59, 999)
                }

                oddsData = oddsData.filter(game => {
                  const gameTime = new Date(game.commence_time)
                  const gameInUserTZ = new Date(gameTime.toLocaleString('en-US', { timeZone: timezone }))
                  return gameInUserTZ >= startOfDay && gameInUserTZ <= endOfDay
                })
              }

              // Filter NCAAF to only Top 25 matchups
              if (sport === 'americanfootball_ncaaf' && oddsData.length > 0) {
                oddsData = oddsData.filter(game =>
                  isTop25Team(game.home_team) || isTop25Team(game.away_team)
                )
              }

              // Team filtering now happens at API level for efficiency
              console.log(`[DEBUG] Final oddsData for ${sport}:`, oddsData.length, 'games')
              if (oddsData.length > 0) {
                allOddsData.push({
                  sport,
                  games: oddsData,
                })
              }

              oddsPerf.push({ sport, ms: Date.now() - sportStart, liveUsed: usedLive, games: oddsData.length })
            } catch (err: any) {
              const statusCode = err?.statusCode ?? err?.status ?? err?.response?.status
              const errorName = err?.name || 'UnknownError'
              const errorMessage = err?.message || String(err)

              console.error(`[ODDS] Error fetching ${sport}:`, {
                name: errorName,
                message: errorMessage,
                statusCode,
                code: err?.code,
                isRateLimited: err?.isRateLimited,
                stack: err?.stack,
              })

              // Check if this is a rate limit error
              if (err?.isRateLimited || statusCode === 429) {
                throw new Error('RATE_LIMIT_EXCEEDED: The odds API is currently experiencing high traffic. Please wait a few minutes and try again. (Tip: Try asking about specific sports or teams to reduce API usage)')
              }

              oddsFailureMessage =
                oddsFailureMessage ||
                `Odds unavailable right now (${sport.replace('americanfootball_', '').toUpperCase()}): ${errorMessage}`
              // Continue to next sport or bail out quickly if this was the only sport
              if (sports.length === 1) {
                break
              } else {
                continue
              }
            }
          }

          if (allOddsData.length > 0) {
            console.log(`[ODDS] Successfully fetched odds for ${allOddsData.length} sport(s)`)
            if (oddsPerf.length) {
              console.log('[PERF][ODDS]', oddsPerf)
            }

            // Helper to format game time in user's timezone
            const formatGameTime = (commence_time: string) => {
              return new Date(commence_time).toLocaleString('en-US', {
                timeZone: timezone,
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
                timeZoneName: 'short'
              })
            }

            const MARKET_LABELS: Record<string, string> = {
              h2h: 'Moneyline',
              spreads: 'Spread',
              totals: 'Total',
              totals_1h: '1H Total',
              totals_2h: '2H Total',
              totals_q1: 'Q1 Total',
              totals_q2: 'Q2 Total',
              totals_q3: 'Q3 Total',
              totals_q4: 'Q4 Total',
            }

            const PRIORITY_MARKETS = [
              'h2h',
              'spreads',
              'totals',
              'totals_1h',
              'totals_2h',
              'totals_q1',
              'totals_q2',
              'totals_q3',
              'totals_q4',
            ]

            const formatNumber = (value: number) => {
              return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0+$/, '')
            }

            const formatAmericanOdds = (value?: number) => {
              if (value == null || !isFinite(value)) return '+»-+-+'
              return value > 0 ? `+${value}` : String(value)
            }

            const formatSpreadPoint = (value?: number) => {
              if (value == null || !isFinite(value)) return ''
              const prefix = value > 0 ? '+' : ''
              return `${prefix}${formatNumber(value)}`
            }

            const formatTotalPoint = (value?: number) => {
              if (value == null || !isFinite(value)) return ''
              return formatNumber(value)
            }

            const formatOutcomeValue = (marketKey: string, outcome: any) => {
              const priceText = formatAmericanOdds(outcome?.price)
              if (marketKey === 'spreads') {
                const pointText = formatSpreadPoint(outcome?.point)
                return pointText ? `${pointText} (${priceText})` : priceText
              }
              if (marketKey.startsWith('totals')) {
                const lineText = formatTotalPoint(outcome?.point)
                return lineText ? `${lineText} (${priceText})` : priceText
              }
              return priceText
            }

            const escapeTableCell = (value: string) => value.replace(/\|/g, '\\|')

            const SPREAD_PRICE_MIN = -120
            const SPREAD_PRICE_MAX = 105

            const spreadPriceWithinRange = (price: number) =>
              price >= SPREAD_PRICE_MIN && price <= SPREAD_PRICE_MAX

            const spreadWindowPenalty = (price: number) => {
              if (price < SPREAD_PRICE_MIN) return SPREAD_PRICE_MIN - price
              if (price > SPREAD_PRICE_MAX) return price - SPREAD_PRICE_MAX
              return 0
            }

            const spreadTargetPenalty = (price: number) => {
              const target = price < 0 ? -110 : 100
              return Math.abs(price - target)
            }

            const evaluateSpreadMarket = (market: { outcomes: any[] }) => {
              const prices = (market.outcomes || [])
                .map((outcome: any) => (typeof outcome?.price === 'number' ? outcome.price : undefined))
                .filter((price): price is number => price != null && isFinite(price))

              if (!prices.length) {
                return {
                  withinRange: false,
                  targetPenalty: Number.POSITIVE_INFINITY,
                  windowPenalty: Number.POSITIVE_INFINITY,
                }
              }

              const withinRange = prices.every(spreadPriceWithinRange)
              const targetPenalty =
                prices.reduce((sum, price) => sum + spreadTargetPenalty(price), 0) / prices.length
              const windowPenalty =
                prices.reduce((sum, price) => sum + spreadWindowPenalty(price), 0) / prices.length

              return { withinRange, targetPenalty, windowPenalty }
            }

            const choosePreferredSpreadMarket = (
              current: { key: string; outcomes: any[] } | undefined,
              candidate: { key: string; outcomes: any[] }
            ) => {
              if (!current) return candidate
              const currentEval = evaluateSpreadMarket(current)
              const candidateEval = evaluateSpreadMarket(candidate)

              if (candidateEval.withinRange && !currentEval.withinRange) return candidate
              if (!candidateEval.withinRange && currentEval.withinRange) return current
              if (candidateEval.withinRange && currentEval.withinRange) {
                return candidateEval.targetPenalty <= currentEval.targetPenalty ? candidate : current
              }
              return candidateEval.windowPenalty <= currentEval.windowPenalty ? candidate : current
            }

            const orderOutcomeLabels = (
              marketKey: string,
              labels: string[],
              awayTeam: string,
              homeTeam: string
            ) => {
              const lowerLabels = labels.map((label) => label.toLowerCase())
              const desired: string[] = []
              const pushIfPresent = (target?: string) => {
                if (!target) return
                const idx = lowerLabels.findIndex((label) => label === target.toLowerCase())
                if (idx >= 0) desired.push(labels[idx])
              }
              if (marketKey === 'h2h' || marketKey === 'spreads') {
                pushIfPresent(awayTeam)
                pushIfPresent(homeTeam)
                pushIfPresent('Draw')
              } else if (marketKey.startsWith('totals')) {
                pushIfPresent('Over')
                pushIfPresent('Under')
              }
              const remaining = labels.filter((label) => !desired.includes(label)).sort()
              return [...desired, ...remaining]
            }

            const buildOddsTableMarkdown = (
              awayTeam: string,
              homeTeam: string,
              bookmakers: Array<{ name: string; link?: string; markets: any[] }>
            ) => {
              if (!bookmakers.length) return ''
              const bookColumns = bookmakers.map((book) => ({
                key: book.name,
                header: book.link ? `[${book.name}](${book.link})` : book.name,
              }))

              const marketsAggregate = new Map<
                string,
                { label: string; rows: Record<string, Record<string, string>> }
              >()

              for (const book of bookmakers) {
                for (const market of book.markets || []) {
                  const marketKey = market?.key || 'other'
                  console.log(`[buildOddsTableMarkdown] Book: ${book.name}, Market: ${marketKey}, Outcomes:`, market.outcomes?.map((o: any) => o.name))

                  if (!marketsAggregate.has(marketKey)) {
                    marketsAggregate.set(marketKey, {
                      label: MARKET_LABELS[marketKey] || marketKey,
                      rows: {},
                    })
                  }
                  const entry = marketsAggregate.get(marketKey)!
                  for (const outcome of market.outcomes || []) {
                    const label = outcome?.name ? String(outcome.name) : 'Other'
                    if (!entry.rows[label]) {
                      entry.rows[label] = {}
                    }
                    entry.rows[label][book.name] = formatOutcomeValue(marketKey, outcome)
                  }
                }
              }

              const orderedMarketKeys = [
                ...PRIORITY_MARKETS.filter((key) => marketsAggregate.has(key)),
                ...Array.from(marketsAggregate.keys()).filter(
                  (key) => !PRIORITY_MARKETS.includes(key)
                ),
              ]

              const tableRows: Array<{
                marketLabel: string
                teamLabel: string
                values: Record<string, string>
              }> = []

              for (const marketKey of orderedMarketKeys) {
                const entry = marketsAggregate.get(marketKey)
                if (!entry) continue
                const labels = Object.keys(entry.rows)
                if (!labels.length) continue

                // Debug logging
                console.log(`[buildOddsTableMarkdown] Market: ${marketKey}, Labels found:`, labels)
                console.log(`[buildOddsTableMarkdown] entry.rows:`, entry.rows)

                const orderedLabels = orderOutcomeLabels(marketKey, labels, awayTeam, homeTeam)
                console.log(`[buildOddsTableMarkdown] Ordered labels:`, orderedLabels)

                orderedLabels.forEach((label, idx) => {
                  tableRows.push({
                    marketLabel: idx === 0 ? entry.label : '',
                    teamLabel: label,
                    values: entry.rows[label] || {},
                  })
                })
              }

              if (!tableRows.length) return ''

              const header = `| Market | Team | ${bookColumns
                .map((col) => escapeTableCell(col.header))
                .join(' | ')} |`
              const divider = `| --- | --- | ${bookColumns.map(() => '---').join(' | ')} |`
              const body = tableRows
                .map((row) => {
                  const cells = bookColumns.map((col) =>
                    escapeTableCell(row.values[col.key] ?? '+»-+-+')
                  )
                  const marketLabel = row.marketLabel ? escapeTableCell(row.marketLabel) : '&nbsp;'
                  return `| ${marketLabel} | ${escapeTableCell(row.teamLabel)} | ${cells.join(' | ')} |`
                })
                .join('\n')

              return `${header}\n${divider}\n${body}`
            }

            const hasTotalsMarket = (book: { markets: Array<{ key: string }> }) =>
              book.markets.some((m) => m.key.startsWith('totals'))

            const ensureTotalsInSelection = (
              books: Array<{ name: string; link?: string; markets: any[] }>,
              limit: number
            ) => {
              if (!books.length || limit <= 0) return []
              const limited = books.slice(0, limit)
              if (limited.some(hasTotalsMarket)) return limited
              const withTotals = books.slice(limit).find(hasTotalsMarket)
              if (withTotals) {
                // Replace last slot to surface at least one totals market
                limited[Math.max(0, limited.length - 1)] = withTotals
              }
              return limited
            }

            const MAX_GAMES_PER_SPORT = 3
            const MAX_GAMES_TARGETED = 1
            const MAX_BOOKS_PER_GAME = 6

            // Format odds data FIRST (don't let enrichment failures break everything)
            const formattedOdds = allOddsData
              .map((sportData) => ({
                sport: sportData.sport,
                games: sportData.games
                  .slice(0, mentionedTeams.length > 0 ? MAX_GAMES_TARGETED : MAX_GAMES_PER_SPORT)
                  .map((game: any) => ({
                    game: `${game.away_team} @ ${game.home_team}`,
                    commence_time: game.commence_time,
                    commence_time_formatted: formatGameTime(game.commence_time),
                    status: (game as any).status || undefined,
                    home_team: game.home_team,
                    away_team: game.away_team,
                    bookmakers: ensureTotalsInSelection(
                      (game.bookmakers || [])
                        .map((book: any) => {
                          const marketMap = new Map<string, { key: string; outcomes: any[] }>()

                          for (const market of book.markets || []) {
                            // Debug: Log raw market outcomes from API
                            console.log(`[RAW API] Book: ${book.title}, Market: ${market.key}, Outcomes count: ${market.outcomes?.length}`)
                            if (market.outcomes) {
                              console.log(`[RAW API] Outcome names:`, market.outcomes.map((o: any) => o.name))
                            }

                            const normalized = {
                              key: market.key,
                              outcomes: Array.isArray(market.outcomes) ? market.outcomes : [],
                            }
                            if (!normalized.outcomes.length) continue

                            if (normalized.key === 'spreads') {
                              const preferred = choosePreferredSpreadMarket(
                                marketMap.get('spreads'),
                                normalized
                              )
                              marketMap.set('spreads', preferred)
                            } else {
                              marketMap.set(normalized.key, normalized)
                            }
                          }

                          const markets = Array.from(marketMap.values())

                          return {
                            name: book.title,
                            link: book.url,
                            markets,
                          }
                        })
                        .filter((book: any) => book.markets.length > 0),
                      MAX_BOOKS_PER_GAME
                    ),
                  }))
                  .map((game: any) => {
                    const table_markdown = buildOddsTableMarkdown(
                      game.away_team,
                      game.home_team,
                      game.bookmakers
                    )
                    return { ...game, table_markdown }
                  })
                  .filter((game: any) => game.bookmakers.length > 0 && game.table_markdown),
              }))
              .filter((sport) => sport.games.length > 0)

            formattedOddsGlobal = formattedOdds

            const totalGames = formattedOdds.reduce((sum, sport) => sum + sport.games.length, 0)
            totalGamesAvailable = totalGames
            console.log(`[DEBUG] Formatted odds: ${formattedOdds.length} sports, ${totalGames} total games`)
            console.log(`[DEBUG] Games per sport:`, formattedOdds.map(s => `${s.sport}: ${s.games.length}`))
            const standardizedOddsTables = formattedOdds
              .map((sport) =>
                sport.games
                  .map(
                    (game: any) =>
                      `### ${formatLeagueLabel(sport.sport)} - ${game.game}\n**Game Time:** ${game.commence_time_formatted}\n${game.table_markdown}`
                  )
                  .join('\n\n')
              )
              .filter(Boolean)
              .join('\n\n')
            console.log(`[ODDS] Total games formatted: ${totalGames}`)
            standardizedOddsTablesGlobal = standardizedOddsTables

            // Compute automatic best-book highlights across all books per market/outcome
            const bestValueLines: string[] = []
            const marketsOfInterest = [
              'h2h',
              'spreads',
              'totals',
              'totals_1h',
              'totals_2h',
              'totals_q1',
              'totals_q2',
              'totals_q3',
              'totals_q4',
            ]
            for (const sport of formattedOdds) {
              for (const game of sport.games) {
                const bestByMarket: Record<string, Record<string, { book: string; price: number; point?: number }>> = {}
                for (const book of game.bookmakers || []) {
                  for (const market of book.markets || []) {
                    if (!marketsOfInterest.includes(market.key)) continue
                    for (const outcome of market.outcomes || []) {
                      if (typeof outcome?.price !== 'number') continue
                      const label = outcome?.name ? String(outcome.name) : 'Other'
                      if (!bestByMarket[market.key]) bestByMarket[market.key] = {}
                      const current = bestByMarket[market.key][label]
                      const candidate = { book: book.name, price: outcome.price as number, point: outcome.point }
                      if (!current || candidate.price > current.price) {
                        bestByMarket[market.key][label] = candidate
                      }
                    }
                  }
                }

                const lines: string[] = []
                for (const [marketKey, outcomes] of Object.entries(bestByMarket)) {
                  for (const [label, best] of Object.entries(outcomes)) {
                    const pointPart =
                      best.point != null ? ` @ ${best.point > 0 ? '+' : ''}${best.point}` : ''
                    lines.push(`${marketKey.toUpperCase()} ${label}: ${best.book} (${best.price}${pointPart})`)
                  }
                }
                if (lines.length) {
                  bestValueLines.push(`- ${game.game}: ${lines.join(' | ')}`)
                }
              }
            }
            const bestValuesSection =
              bestValueLines.length > 0
                ? `\n**BEST BOOKS (auto-highlight across ALL books):**\n${bestValueLines.join('\n')}\n`
                : ''

            let teamInsights = ''
            if (allOddsData.length === 1 && formattedOdds.length === 1 && formattedOdds[0].games.length === 1) {
              const baseGame = allOddsData[0].games[0]
              const sportKey = allOddsData[0].sport
              const liveInsights = await findLiveScoreDetailsForOddsGame(sportKey, baseGame, timezone)
              if (liveInsights) {
                teamInsights = `\n**TEAM INSIGHTS:**\n${liveInsights}\n\nUse these stats as the advanced info for this matchup.`
              }
              if (!teamInsights) {
                const fallbackInsights = await buildTeamInsightsFromTeamStats(
                  sportKey,
                  baseGame.home_team,
                  baseGame.away_team
                )
                if (fallbackInsights) {
                  teamInsights = `\n**TEAM INSIGHTS (Season snapshot):**\n${fallbackInsights}\n\nUse these stats as the advanced info for this matchup.`
                }
              }
            }

            // Analysis/deep-dive enrichment disabled
            const statsEnrichment = ''

            const timeLabel = isTomorrowQuery ? 'tomorrow' : 'today/upcoming'
            const dateContext = isTomorrowQuery ? 'TOMORROW' : 'TODAY'

            // Build mode-aware header text for odds context
            const modeLabel = usedLive ? 'LIVE' : 'PRE-MATCH'
            const headerLine = `**dY"' ${modeLabel} ODDS DATA LOADED dY"'**`
            const accessLine = usedLive
              ? "You have live, in-play odds. Use them. Do not say you don't have access."
              : "You have pre-match odds. Do not call these live. Use them. Do not say you don't have access."
            const fallbackNote = requestedLive && !usedLive && usedFallback
              ? '\n(Note: Live was requested, but unavailable; showing pre-match odds.)'
              : ''

            oddsContext = `\n\n${headerLine}
**(Marker: LIVE ODDS DATA LOADED)**\n${accessLine}${fallbackNote}

**CRITICAL INSTRUCTIONS:**
- Below are the ONLY ${totalGames} game(s) you should mention
- DO NOT make up or invent games not in this data
- DO NOT use games from your training data/memory
- If user asks for games not in this data, say data is not available yet
- These games are for ${dateContext}

**Data Available:**
- ${formattedOdds.length} sport(s): ${formattedOdds.map(s => s.sport.replace('basketball_', '').replace('americanfootball_', '').replace('icehockey_', '').toUpperCase()).join(', ')}
- ${totalGames} game(s) ${timeLabel}
- Multiple bookmakers per game
- Current as of ${new Date().toLocaleString('en-US', {
  timeZone: timezone,
  dateStyle: 'short',
  timeStyle: 'short'
})} ${timezone}

**YOUR TASK:**
For each game below:
1. Write a short intro line (e.g., "Here are the current betting odds for [Team] vs [Team].")
2. Include the commence time in the user's timezone.
3. Paste the provided Markdown table from **STANDARDIZED ODDS TABLES** exactly as-is. Do NOT reformat it into lists or different layouts.
4. Call out the best values per market beneath the table (per the rules below).
5. ONLY mention games contained in this data.
6. Keep things concise (table + a few tight sentences).

**LIVE ODDS DATA:**
${JSON.stringify(formattedOdds)}

**STANDARDIZED ODDS TABLES (USE THESE EXACTLY IN YOUR RESPONSE):**
${standardizedOddsTables || '_No odds tables available_'}
${bestValuesSection}
${teamInsights}

${statsEnrichment}
`

            console.log(`[ODDS] Context built successfully, length: ${oddsContext.length} characters`)
            const deterministicOdds = buildDeterministicOddsReply()
            if (!wantsDeepDive) {
              let reply = deterministicOdds || ''
              if (teamInsights) {
                reply = reply ? `${reply}\n\n${teamInsights}` : teamInsights
              }
              pendingOddsReply = reply || 'Odds available. (Formatting failed to build deterministic table.)'
            }
          } else {
            console.log('[ODDS] No games found after filtering - formattedOdds is empty')
            console.log('[DEBUG] allOddsData length:', allOddsData.length)
            const fallbackMsg =
              oddsFailureMessage ||
              (isTomorrowQuery
                ? '**NO GAMES TOMORROW**: There are no games scheduled for tomorrow based on current data.'
                : '**NO ODDS AVAILABLE**: No games matched this request right now. Try a different team, sport, or timeframe.')
            let ncaabScheduleFallback: string | null = null
            if (sports.includes('basketball_ncaab')) {
              try {
                const slate = await fetchAllLiveScores({ date: new Date().toISOString().slice(0, 10) })
                const matchers = new Set(
                  (lastTeamFilter && lastTeamFilter.length ? lastTeamFilter : parsedMatchupTeams).map((t: string) =>
                    String(t).toLowerCase()
                  )
                )
                const ncaabGames = slate.games
                  .filter((g) => g.league === 'ncaab')
                  .filter((g) =>
                    matchers.size === 0
                      ? true
                      : g.competitors?.some((c) => {
                          const name = (c.name || c.shortName || c.abbreviation || '').toLowerCase()
                          return Array.from(matchers).some((m) => name.includes(m))
                        })
                  )
                  .slice(0, 5)

                if (ncaabGames.length) {
                  const toLocal = (iso: string) =>
                    new Date(iso).toLocaleString('en-US', {
                      timeZone: timezone,
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true,
                    })
                  ncaabScheduleFallback =
                    '**NCAAB schedule (fallback, odds provider error):**\n' +
                    ncaabGames
                      .map((g) => {
                        const [a, b] = g.competitors || []
                        const matchup = a && b ? `${a.name} @ ${b.name}` : g.shortName || 'Game'
                        return `- ${matchup} +óGé¼GÇ¥ ${toLocal(g.startTime)}`
                      })
                      .join('\n')
                }
              } catch (e) {
                console.warn('[ODDS] NCAAB schedule fallback failed', e)
              }
            }

            const fallbackPayload = [fallbackMsg, ncaabScheduleFallback].filter(Boolean).join('\n\n')
            pendingOddsReply = `Odds unavailable right now. ${fallbackPayload} Try again shortly.`
          }
        } else {
          console.log('[ODDS] No sports detected for odds fetching')
          console.log('[DEBUG] shouldFetchOdds:', shouldFetchOdds, 'sports:', sports)
        }
      } catch (error) {
        const oddsError: any = error
        const statusCode = oddsError?.statusCode ?? oddsError?.status ?? oddsError?.response?.status
        const message = oddsError?.message || String(oddsError)
        const bookIdsLength = sbdBookIds?.length || 0
        const hasBookIds = Boolean(sbdBookIds)

        console.error('[ODDS] Critical error fetching odds:', {
          name: oddsError?.name || 'UnknownError',
          message,
          statusCode,
          code: oddsError?.code,
          isRateLimited: oddsError?.isRateLimited,
          stack: oddsError?.stack,
          environment: environmentName,
          oddsProvider,
          sbdBookIdsPresent: hasBookIds,
          sbdBookIdsLength: bookIdsLength,
          openaiApiKeyPresent: Boolean(openaiApiKey),
        })

        oddsContext = `\n\n(Odds data unavailable due to API error: ${message}. status=${statusCode ?? 'unknown'}, provider=${oddsProvider}, env=${environmentName}, bookIds=${hasBookIds ? 'present' : 'MISSING'} len=${bookIdsLength})\n`
      }
    }

    // Create OpenAI messages
    const openaiMessages: ChatCompletionMessageParam[] = [
      {
        role: 'system',
        content: getSystemPrompt(timezone) + contextMessage + scoresContext + oddsContext,
      },
      ...messages
        .filter((msg) => {
          // Ensure content exists and is a non-empty string
          return msg.content != null &&
                 typeof msg.content === 'string' &&
                 msg.content.trim().length > 0
        })
        .map((msg) => ({
          role: msg.role as 'user' | 'assistant',
          content: String(msg.content), // Ensure content is always a string
        })),
    ]

    // First call to check for function calls (non-streaming)
    const chatModel = AI_MODELS.chat
    console.log(`[CHAT] Using model: ${chatModel}`)

    const allowedTools = ASSISTANT_TOOLS.filter((tool) => {
      const name = (tool as any)?.function?.name
      if (!name) return true
      if (mode === 'regular') {
        return !['get_player_props', 'run_research_model', 'save_research_model', 'list_research_opportunities'].includes(name)
      }
      if (mode === 'live') {
        return name !== 'run_research_model' && name !== 'save_research_model'
      }
      // research or default: all tools
      return true
    })

    const allowedToolNames = new Set(
      allowedTools
        .map((t: any) => t?.function?.name)
        .filter(Boolean)
    )

    if (pendingOddsReply) {
      return streamTextResponse(pendingOddsReply)
    }

  const buildParams = () => {
    const params: any = {
      model: chatModel,
      messages: openaiMessages,
      tools: allowedTools,
      max_completion_tokens: 1500,
      }
      if (!chatModel.includes('gpt-5')) {
        params.temperature = 0.7
      }
      return params
  }

  const llmInitialStart = Date.now()

  const wantsTeamInsightsOnly = /team insight|team insights|advanced stats|more info|deeper (stats|info)/i.test(message)

  if (
    wantsTeamInsightsOnly &&
    formattedOddsGlobal.length === 1 &&
    formattedOddsGlobal[0].games?.length === 1
  ) {
    const game = formattedOddsGlobal[0].games[0]
    const sportKey = formattedOddsGlobal[0].sport
    const insights =
      (await findLiveScoreDetailsForOddsGame(sportKey, game, timezone)) ??
      (await buildTeamInsightsFromTeamStats(sportKey, game.home_team, game.away_team))
    const titleLine = `Team insights for ${game.away_team} @ ${game.home_team}`
    const body = insights || 'No team insights available yet.'
    return streamTextResponse(`${titleLine}\n\n${body}`)
  }

  // Shortcut: player season stats (avoid empty GPT replies)
  const lowerMessage = message.toLowerCase()
  const wantsPlayerSeasonStats = /\bseason (stats?|averages?)\b|per[- ]game stats?/i.test(lowerMessage)
  const seasonPlayerName = extractPlayerName(message)
  if (wantsPlayerSeasonStats && seasonPlayerName) {
    try {
      const data = await getPlayerSeasonStats(seasonPlayerName, sportHint)

      if (data) {
        const formatted = formatStatsForAI([data])
        const leagueLabel = formatLeagueLabel(data.sport || sportHint || 'basketball_nba')
        return streamTextResponse(formatted)
      }
      return streamTextResponse(`I couldn't find season stats for ${seasonPlayerName}. Please check the spelling or tell me the sport.`)
    } catch (err: any) {
      console.error('[PLAYER_SEASON_STATS_SHORTCUT] Failed:', err)
      return streamTextResponse('Player season stats are temporarily unavailable. Please try again.')
    }
  }

  // Team stats handled earlier

  // Broader player stats shortcut (NBA/NFL season averages)
  const genericPlayerStatsIntent =
    !propIntent &&
    !oddsKeywordMatch &&
    playerNameInMessage &&
    /\b(stats?|averages?|ppg|rpg|apg|points per game|rebounds|assists|batting average|home runs|rbi|era|ops|goals|points|pim)\b/i.test(lowerMessage)

  if (genericPlayerStatsIntent) {
    try {
      const data = await getPlayerSeasonStats(playerNameInMessage, sportHint)

      if (data) {
        const leagueLabel = formatLeagueLabel(data.sport || sportHint || 'basketball_nba')
        const formatted = formatStatsForAI([data])
        return streamTextResponse(formatted)
      }
      const leagueLabel = sportHint ? formatLeagueLabel(sportHint) : 'their sport'
      return streamTextResponse(`I couldn't find season stats for ${playerNameInMessage} (${leagueLabel}). Please check the spelling or tell me the sport.`)
    } catch (err: any) {
      console.error('[PLAYER_STATS_SHORTCUT] Failed:', err)
      return streamTextResponse('Player stats are temporarily unavailable. Please try again.')
    }
  }

  // Handle team stats before odds to avoid unnecessary odds fetches
  // Skip if user explicitly asks for analysis/breakdown or edge awareness
  if ((teamStatsIntent || (mentionedTeams.length && !oddsKeywordMatch && !wantsLiveOdds && !propIntent && !playerNameInMessage)) && !analysisIntent && !edgeAwarenessIntent) {
    try {
      return await resolveTeamStats(mentionedTeams.length ? mentionedTeams : parsedMatchupTeams)
    } catch (err: any) {
      console.error('[TEAM_STATS_SHORTCUT] Failed:', err)
      return streamTextResponse('Team stats are temporarily unavailable. Please try again.')
    }
  }

  // Player single-game stat intent: fetch box score line
  if (playerGameStatsIntent && playerNameInMessage) {
    try {
      const dateHint = parseDateFromMessage(message)
      const opponentName =
        parsedMatchupTeams[1] ||
        parsedMatchupTeams[0] ||
        (mentionedTeams.length ? mentionedTeams[0] : undefined)
      const result = await findPlayerGameStats({
        player: playerNameInMessage,
        opponent: opponentName,
        opponentCandidates: mentionedTeams,
        date: dateHint,
      })
      const opponentLabel = opponentName ? opponentName : 'opponent'
      if (result?.line) {
        return streamTextResponse(
          `${playerNameInMessage} vs ${opponentLabel} (${dateHint})\n${result.line}`
        )
      }
      if (result?.reason === 'no_game') {
        return streamTextResponse(
          `No game found for ${playerNameInMessage} vs ${opponentLabel} on ${dateHint}. Try another date.`
        )
      }
      if (result?.reason === 'player_not_found') {
        return streamTextResponse(
          `Game found on ${dateHint}, but ${playerNameInMessage} wasn't in the box score. Check the name or date.`
        )
      }
      return streamTextResponse(
        `I couldn't find a box score line for ${playerNameInMessage} on ${dateHint}. Try another date or opponent.`
      )
    } catch (err: any) {
      console.error('[PLAYER_BOX_SCORE_SHORTCUT] Failed:', err)
      return streamTextResponse('Box score lookup is temporarily unavailable. Please try again.')
    }
  }

  let initialResponse = await openai.chat.completions.create(buildParams())
  console.log('[PERF][LLM][INITIAL_MS]', Date.now() - llmInitialStart)
    let toolCalls = initialResponse.choices[0].message.tool_calls || []
    console.log('[CHAT] Initial LLM response - tool_calls:', toolCalls?.length || 0, 'tools')
    if (toolCalls && toolCalls.length > 0) {
      console.log('[CHAT] Tool names:', toolCalls.map((tc: any) => tc.function?.name).join(', '))
    }

      const withTimeout = <T>(p: Promise<T>, ms = 8000) =>
        Promise.race<T>([
          p,
          new Promise<T>((_, reject) => setTimeout(() => reject(new Error('tool timeout')), ms)) as Promise<T>,
        ])

      async function runPickGuidance(functionArgs: any) {
        const matchupFromArgs = functionArgs?.matchup ? String(functionArgs.matchup) : ''
        const fallbackTeams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
        const matchup =
          matchupFromArgs ||
          (fallbackTeams.length >= 2
            ? `${fallbackTeams[0]} vs ${fallbackTeams[1]}`
            : fallbackTeams[0] || undefined)
        const marketHintRaw =
          functionArgs?.market_hint ||
          (marketTypeHint !== 'unknown' ? marketTypeHint : null)
        const marketHint =
          marketHintRaw ? String(marketHintRaw).replace(/_/g, ' ') : null
        const formatted = buildPickGuidanceResponse({
          subject: matchup,
          marketHint,
        })
        return { success: true, formatted }
      }

      async function runBetMarketAnalysis(functionArgs: any) {
        const toNumber = (value: any): number | null => {
          const n = Number(value)
          return Number.isFinite(n) ? n : null
        }

        const formatOdds = (value?: number | null): string | null => {
          if (value == null || !Number.isFinite(value)) return null
          return value > 0 ? `+${value}` : `${value}`
        }

        const parseTeamsFromIdentifier = (identifier: string): string[] => {
          return identifier
            .split(/\bvs\b|\bversus\b|\bat\b|@/i)
            .map((part) => part.trim())
            .filter(Boolean)
        }

        const inferPropTypeFromMessage = (input: string): string | null => {
          const lower = input.toLowerCase()
          if (/\bpra\b|points\s*\+\s*rebounds\s*\+\s*assists/.test(lower)) return 'pra'
          if (/\bpoints\b|\bpts\b/.test(lower)) return 'points'
          if (/\brebounds\b|\brebs\b|\breb\b/.test(lower)) return 'rebounds'
          if (/\bassists\b|\basts\b|\bast\b/.test(lower)) return 'assists'
          if (/\b(threes|3s|3pm|three pointers?)\b/.test(lower)) return 'threes'
          if (/\bpassing yards\b|\bpass yds\b/.test(lower)) return 'passing_yards'
          if (/\brushing yards\b|\brush yds\b/.test(lower)) return 'rushing_yards'
          if (/\breceiving yards\b|\brec yds\b/.test(lower)) return 'receiving_yards'
          if (/\breceptions?\b|\bcatches?\b/.test(lower)) return 'receptions'
          if (/\btouchdowns?\b|\btds?\b/.test(lower)) return 'touchdowns'
          return null
        }

        const extractLineFromMessage = (input: string, type: MarketType): number | null => {
          if (type === 'total') {
            const match = input.match(/\b(?:over|under|total|o\/u)\s*([0-9]+(?:\.[0-9]+)?)/i)
            if (match) return parseFloat(match[1])
          }
          if (type === 'quarter') {
            const signedMatch = input.match(/([+-]\d+(?:\.\d+)?)/)
            if (signedMatch) return parseFloat(signedMatch[1])
            const ouMatch = input.match(/\b(?:over|under|total|o\/u)\s*([0-9]+(?:\.[0-9]+)?)/i)
            if (ouMatch) return parseFloat(ouMatch[1])
            return null
          }
          if (type === 'spread') {
            const match = input.match(/([+-]\d+(?:\.\d+)?)/)
            if (match) return parseFloat(match[1])
          }
          return extractPropLine(input)
        }

        const extractLineTeam = (input: string): { team?: string; line?: number | null } => {
          const match = input.match(/\b([A-Za-z][A-Za-z .&'-]{2,})\s+([+-]\d+(?:\.\d+)?)/)
          if (!match) return { team: undefined, line: null }
          const team = match[1]?.trim()
          if (!team || /\b(over|under|total|o\/u)\b/i.test(team)) return { team: undefined, line: null }
          const line = parseFloat(match[2])
          return { team, line: Number.isFinite(line) ? line : null }
        }

        const summarizeInjuries = async (teams: string[], sportKey: string) => {
          if (!teams.length) return 'No team specified.'
          const injuries = await getInjuryReports(sportKey)
          if (!injuries || injuries.length === 0) return 'No major injuries reported.'
          const teamTokens = teams.map((t) => normalizeToken(t))
          const filtered = injuries.filter((injury) =>
            teamTokens.some((token) => normalizeToken(injury.team).includes(token))
          )
          if (!filtered.length) return 'No major injuries reported.'
          return filtered
            .slice(0, 4)
            .map((injury) => `${injury.team}: ${injury.player} (${injury.status})`)
            .join('; ')
        }

        const parseAtsRecord = (record?: string | { formatted?: string; wins?: number; losses?: number; pushes?: number } | null) => {
          if (!record) return null
          if (typeof record === 'object') {
            const winsRaw = (record as any).wins
            const lossesRaw = (record as any).losses
            const pushesRaw = (record as any).pushes
            const wins = Number(winsRaw)
            const losses = Number(lossesRaw)
            const pushes = Number.isFinite(Number(pushesRaw)) ? Number(pushesRaw) : 0
            if (Number.isFinite(wins) && Number.isFinite(losses)) {
              const total = wins + losses
              const winPct = total > 0 ? wins / total : null
              return { wins, losses, pushes, winPct }
            }
            const formatted = (record as any).formatted
            if (typeof formatted === 'string') {
              const match = formatted.match(/(\d+)-(\d+)(?:-(\d+))?/)
              if (match) {
                const fWins = Number(match[1])
                const fLosses = Number(match[2])
                const fPushes = match[3] ? Number(match[3]) : 0
                const total = fWins + fLosses
                const winPct = total > 0 ? fWins / total : null
                return { wins: fWins, losses: fLosses, pushes: fPushes, winPct }
              }
            }
            return null
          }
          const match = record.match(/(\d+)-(\d+)(?:-(\d+))?/)
          if (!match) return null
          const wins = Number(match[1])
          const losses = Number(match[2])
          const pushes = match[3] ? Number(match[3]) : 0
          const total = wins + losses
          const winPct = total > 0 ? wins / total : null
          return { wins, losses, pushes, winPct }
        }

        const marketType: MarketType =
          (functionArgs?.marketType as MarketType) ||
          marketTypeHint ||
          inferMarketType(message)

        const quarter =
          Number.isFinite(functionArgs?.quarter) ? Number(functionArgs.quarter) : inferQuarter(message)
        const direction =
          (functionArgs?.direction as 'over' | 'under') ||
          normalizePropSelection(message) ||
          null
        const playerName =
          (functionArgs?.playerName ? String(functionArgs.playerName) : playerNameInMessage) || ''
        const propType =
          (functionArgs?.propType ? String(functionArgs.propType) : inferPropTypeFromMessage(message)) || null

        const lineFromMessage = extractLineFromMessage(message, marketType)
        const line = extractPropLine(functionArgs?.line ?? lineFromMessage)
        const odds = extractPropLine(functionArgs?.odds)
        const book = functionArgs?.book ? String(functionArgs.book) : null

        const teamsFromArgs = functionArgs?.gameIdentifier
          ? parseTeamsFromIdentifier(String(functionArgs.gameIdentifier))
          : []
        const fallbackTeams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
        const matchupTeams = teamsFromArgs.length ? teamsFromArgs : fallbackTeams

        const matchupLabel =
          matchupTeams.length >= 2
            ? `${matchupTeams[0]} vs ${matchupTeams[1]}`
            : matchupTeams[0] || functionArgs?.gameIdentifier || 'Requested market'

        const sportKey =
          (functionArgs?.league ? String(functionArgs.league) : sportHintFromMessage(message)) ||
          'basketball_nba'

        const snapshotLines: string[] = []
        const nextActions: string[] = []
        const missingInfo: string[] = []

        const oddsLabel = formatOdds(odds)
        const lineLabel =
          line != null
            ? `${direction ? `${direction} ` : ''}${line.toFixed(1)}${oddsLabel ? ` @ ${oddsLabel}` : ''}${book ? ` (${book})` : ''}`
            : 'not provided'
        snapshotLines.push(`Line/price: ${lineLabel}`)

        // Determine if this is a general matchup analysis (no specific market type)
        const isGeneralMatchupAnalysis = matchupTeams.length >= 2 &&
          (marketType === 'unknown' || !marketType || (marketType !== 'player_prop' && marketType !== 'quarter' && line == null && odds == null))

        if (marketType === 'player_prop') {
          if (!playerName) missingInfo.push('Player name')
          if (!propType) missingInfo.push('Prop type')
          if (line == null) missingInfo.push('Prop line')
        } else if (marketType === 'quarter') {
          if (!quarter) missingInfo.push('Quarter (Q1-Q4)')
          if (!matchupTeams[0]) missingInfo.push('Team for the quarter bet')
          if (line == null) missingInfo.push('Quarter line')
        } else if (!isGeneralMatchupAnalysis && (marketType === 'spread' || marketType === 'total')) {
          if (matchupTeams.length < 2) missingInfo.push('Matchup teams')
          if (line == null) missingInfo.push('Market line')
        } else if (!isGeneralMatchupAnalysis && marketType === 'moneyline') {
          if (matchupTeams.length < 2) missingInfo.push('Matchup teams')
          if (odds == null) missingInfo.push('Moneyline price')
        }

        let supportingSignals = 0
        if (marketType === 'spread' || marketType === 'total' || marketType === 'moneyline') {
          let splitsText = ''
          try {
            splitsText = await summarizeCoversGameSplitsForChat({
              message,
              teams: matchupTeams,
              timezone,
            })
          } catch (error) {
            splitsText = 'splits unavailable'
          }
          const splitLines = splitsText.split('\n').map((lineItem) => lineItem.trim()).filter(Boolean)
          const targetLabel =
            marketType === 'spread'
              ? 'spread'
              : marketType === 'total'
              ? 'total'
              : 'moneyline'
          const marketLine = splitLines.find((lineItem) =>
            lineItem.toLowerCase().startsWith(`- ${targetLabel}`)
          )
          const splitSummary = marketLine
            ? marketLine.replace(/^- /, '')
            : splitLines.find((lineItem) => lineItem.startsWith('- '))?.replace(/^- /, '') ||
              splitLines[0] ||
              'splits unavailable'
          snapshotLines.push(`Public vs sharp: ${splitSummary}`)
          if (/sharp|divergence|handle/i.test(splitSummary)) supportingSignals += 1
        }

        const injuryLine = await summarizeInjuries(matchupTeams, sportKey)
        snapshotLines.push(`Injuries/availability: ${injuryLine}`)

        if (marketType === 'spread' || marketType === 'total' || marketType === 'moneyline') {
          const [teamA, teamB] = matchupTeams
          const teamStats = await Promise.all(
            matchupTeams.slice(0, 2).map(async (teamName) => {
              const stats = await getTeamStats(sportKey, teamName)
              const primary = stats?.[0]
              const staticStats =
                sportKey === 'basketball_nba' ? findStaticNbaTeam(teamName)?.[0] : undefined
              return { teamName, primary, staticStats }
            })
          )

          const contextParts: string[] = []
          const trendParts: string[] = []
          for (const entry of teamStats) {
            if (!entry.teamName) continue
            const statBlock = entry.primary?.stats || {}
            const ppg = toNumber(statBlock.pointsForPerGame)
            const papg = toNumber(statBlock.pointsAgainstPerGame)
            const mov =
              toNumber(entry.staticStats?.stats?.marginOfVictory) ??
              (ppg != null && papg != null ? Number((ppg - papg).toFixed(1)) : null)
            const netRating = toNumber(entry.staticStats?.stats?.netRating)
            const pace = toNumber(entry.staticStats?.stats?.pace)
            const lastTen = statBlock.lastTen ? String(statBlock.lastTen) : null
            const streak = statBlock.streak ? String(statBlock.streak) : null

            const pieces: string[] = []
            if (ppg != null && papg != null) {
              pieces.push(`PPG ${ppg.toFixed(1)}, PAPG ${papg.toFixed(1)}`)
            }
            if (mov != null) pieces.push(`MOV ${mov.toFixed(1)}`)
            if (netRating != null) pieces.push(`NetRtg ${netRating.toFixed(1)}`)
            if (pace != null) pieces.push(`Pace ${pace.toFixed(1)}`)
            if (lastTen) pieces.push(`Last10 ${lastTen}`)
            if (streak) pieces.push(`Streak ${streak}`)
            if (pieces.length) {
              contextParts.push(`${entry.teamName}: ${pieces.join('; ')}`)
            }

            const ats = await getTeamATSData(entry.teamName, sportKey)
            if (ats?.success && ats.data) {
              const atsPieces: string[] = []
              if (ats.data.overallATS) atsPieces.push(`ATS ${ats.data.overallATS}`)
              if (ats.data.last10) atsPieces.push(`Last10 ${ats.data.last10}`)
              if (ats.data.streak) atsPieces.push(`Streak ${ats.data.streak}`)
              if (atsPieces.length) {
                trendParts.push(`${entry.teamName}: ${atsPieces.join(', ')}`)
              }
              const atsParsed = parseAtsRecord(ats.data.overallATS)
              if (atsParsed?.winPct != null && (atsParsed.winPct >= 0.6 || atsParsed.winPct <= 0.4)) {
                supportingSignals += 1
              }
            }
          }

          if (contextParts.length) snapshotLines.push(`Context stats: ${contextParts.join(' | ')}`)
          if (trendParts.length) snapshotLines.push(`Trends: ${trendParts.join(' | ')}`)

          console.log('[ANALYZE_BET_MARKET] Calling getGameRecommendations for:', matchupLabel)
          const recommendations = await getGameRecommendations(matchupLabel, marketType === 'total' ? 'total' : 'spread')
          console.log('[ANALYZE_BET_MARKET] Got recommendations:', recommendations.length)
          const targetRec =
            marketType === 'total'
              ? recommendations.find((rec) => rec.type === 'total')
              : recommendations.find((rec) => rec.type === 'spread')

          let targetLine: number | null = targetRec?.targetLine ?? null
          let normalizedLine = line

          if (marketType === 'spread' && line != null) {
            const lineTeamMatch = extractLineTeam(message)
            const lineTeam = lineTeamMatch.team
            const lineValue = lineTeamMatch.line ?? line
            const homeTeam = targetRec?.homeTeam || teamA
            const awayTeam = targetRec?.awayTeam || teamB
            if (lineTeam && homeTeam && awayTeam) {
              const lineToken = normalizeToken(lineTeam)
              const homeToken = normalizeToken(homeTeam)
              const awayToken = normalizeToken(awayTeam)
              if (lineToken && homeToken && (lineToken.includes(homeToken) || homeToken.includes(lineToken))) {
                normalizedLine = lineValue < 0 ? Math.abs(lineValue) : -Math.abs(lineValue)
              } else if (lineToken && awayToken && (lineToken.includes(awayToken) || awayToken.includes(lineToken))) {
                normalizedLine = lineValue < 0 ? -Math.abs(lineValue) : Math.abs(lineValue)
              }
            }
          }

          const edge: EdgeAssessment =
            marketType === 'moneyline'
              ? {
                  verdict: 'none',
                  confidence: 'low',
                  reason: odds == null
                    ? 'Need a moneyline price to evaluate edge.'
                    : 'Moneyline edge needs implied probability vs model.',
                }
              : evaluateLineEdge({
                  marketType,
                  line: normalizedLine,
                  targetLine,
                  supportingSignals,
                })

          nextActions.push('Compare best price across books')
          nextActions.push('Re-check injuries and starting lineups')
          if (marketType !== 'moneyline') {
            nextActions.push('Compare model target line vs market')
          }
          if (marketType === 'spread' || marketType === 'total') {
            nextActions.push('Review public vs sharp splits for this market')
          }

          const marketLabel =
            marketType === 'spread'
              ? `spread ${line != null ? line.toFixed(1) : ''}`.trim()
              : marketType === 'total'
              ? `total ${line != null ? line.toFixed(1) : ''}`.trim()
              : 'moneyline'

          return {
            success: true,
            formatted: buildAnalysisResponse({
              title: matchupLabel,
              marketLabel,
              snapshotLines,
              edge,
              nextActions,
              missingInfo,
            }),
          }
        }

        if (marketType === 'quarter') {
          const primaryTeam = matchupTeams[0]
          let quarterAvg: number | null = null
          let quarterHitRate: number | null = null
          if (primaryTeam && quarter) {
            try {
              const averages = await getTeamQuarterAverages({
                team: primaryTeam,
                sport: sportKey,
              })
              const avg = averages?.averages?.[`Q${quarter}` as keyof typeof averages.averages]
              if (avg != null) {
                quarterAvg = avg
                snapshotLines.push(`Quarter average: ${primaryTeam} Q${quarter} ${avg.toFixed(1)} PPG`)
              }

              if (line != null) {
                const threshold = await getTeamQuarterThreshold({
                  team: primaryTeam,
                  quarter,
                  threshold: line,
                  operator: '>=',
                  sport: sportKey,
                })
                if (threshold && threshold.totalGames > 0) {
                  quarterHitRate = threshold.percentage / 100
                  snapshotLines.push(
                    `Trend: Q${quarter} >= ${line.toFixed(1)} in ${threshold.gamesOver}/${threshold.totalGames} (${Math.round(
                      threshold.percentage
                    )}%)`
                  )
                }
              }
            } catch (error) {
              snapshotLines.push('Quarter data unavailable right now.')
            }
          }

          const opponent = matchupTeams[1]
          if (opponent) {
            const opponentStats = await getTeamStats(sportKey, opponent)
            const oppPrimary = opponentStats?.[0]
            const papg = toNumber(oppPrimary?.stats?.pointsAgainstPerGame)
            if (papg != null) {
              snapshotLines.push(`Opponent defense proxy: ${opponent} allows ${papg.toFixed(1)} PPG`)
            }
          }

          const edge = evaluatePropEdge({
            line,
            direction,
            seasonHitRate: quarterHitRate,
            lastTenHitRate: undefined,
            seasonAvg: quarterAvg,
            lineDeltaThreshold: 2,
          })

          nextActions.push('Pull quarter averages for both teams')
          nextActions.push('Check any pace or lineup news before tip')

          const quarterLabel = quarter ? `Q${quarter}` : 'Quarter'

          return {
            success: true,
            formatted: buildAnalysisResponse({
              title: quarter ? `${matchupLabel} ${quarterLabel}` : matchupLabel,
              marketLabel: quarter ? `quarter ${quarter}` : 'quarter',
              snapshotLines,
              edge,
              nextActions,
              missingInfo,
            }),
          }
        }

        if (marketType === 'player_prop') {
          const propKey = propType || 'prop'
          const propLabel = propKey.replace(/_/g, ' ')
          let seasonAvg: number | null = null
          let lastTenAvg: number | null = null
          let seasonHitRate: number | null = null
          let lastTenHitRate: number | null = null
          let seasonHits: number | null = null
          let seasonGames: number | null = null
          let lastTenHits: number | null = null
          let lastTenGames: number | null = null

          const sportGuess =
            msgLower.match(/nfl|football/) ? 'nfl' :
            msgLower.match(/mlb|baseball/) ? 'mlb' :
            msgLower.match(/nhl|hockey/) ? 'nhl' :
            'nba'
          const season = getEspnSeasonYearForLogs(sportGuess)

          if (playerName) {
            const athleteSearch = await searchAthlete(sportGuess as any, playerName)
            const athleteId = athleteSearch?.id
            const playerEntry = athleteId ? { id: athleteId } : await searchPlayer(playerName, sportGuess)
            if (playerEntry?.id) {
              const logs = await espnToolResolvers.espnPlayerGameLogs({
                sport: sportGuess,
                playerId: playerEntry.id,
                season,
                seasonType: 2,
              })

              const collectStats = (entry: any) => {
                const statBlocks: any[] = Array.isArray(entry?.stats)
                  ? entry.stats
                  : Array.isArray(entry?.statistics)
                  ? entry.statistics
                  : []
                const stats: Record<string, number> = {}
                const pushStat = (label: string, raw: any) => {
                  const key = label.toUpperCase().replace(/\s+/g, '_')
                  const num = typeof raw === 'number' ? raw : Number(raw)
                  if (Number.isFinite(num)) stats[key] = num
                }
                for (const block of statBlocks) {
                  const entries: any[] = Array.isArray(block?.stats) ? block.stats : Array.isArray(block) ? block : []
                  for (const s of entries) {
                    const label = s?.label || s?.displayName || s?.name
                    const value = s?.value ?? s?.displayValue ?? s?.display_value
                    if (!label) continue
                    pushStat(label, value)
                  }
                }
                const directMap: Record<string, string> = {
                  points: 'PTS',
                  pts: 'PTS',
                  rebounds: 'REB',
                  assists: 'AST',
                  blocks: 'BLK',
                  steals: 'STL',
                  '3p': '3PM',
                  threePointersMade: '3PM',
                  passingYards: 'PASSYDS',
                  rushingYards: 'RUSHYDS',
                  receivingYards: 'RECYDS',
                  receptions: 'REC',
                  touchdowns: 'TD',
                }
                Object.entries(directMap).forEach(([field, key]) => {
                  const v = (entry as any)[field]
                  const num = typeof v === 'number' ? v : Number(v)
                  if (Number.isFinite(num) && stats[key] == null) stats[key] = num
                })
                return stats
              }

              const getPropStatValue = (stats: Record<string, number>) => {
                const key = propKey.toLowerCase()
                const pick = (keys: string[]) => {
                  for (const k of keys) {
                    if (Number.isFinite(stats[k])) return stats[k]
                  }
                  return null
                }

                if (key === 'points') return pick(['PTS'])
                if (key === 'rebounds') return pick(['REB'])
                if (key === 'assists') return pick(['AST'])
                if (key === 'threes') return pick(['3PM', '3PT'])
                if (key === 'pra') {
                  const pts = pick(['PTS']) ?? 0
                  const reb = pick(['REB']) ?? 0
                  const ast = pick(['AST']) ?? 0
                  return pts + reb + ast
                }
                if (key === 'passing_yards') return pick(['PASSYDS'])
                if (key === 'rushing_yards') return pick(['RUSHYDS'])
                if (key === 'receiving_yards') return pick(['RECYDS'])
                if (key === 'receptions') return pick(['REC', 'RECEPTIONS'])
                if (key === 'touchdowns') return pick(['TD'])
                return null
              }

              const rawLogs = Array.isArray(logs) ? logs : []
              const values = rawLogs
                .map((entry) => {
                  const stats = collectStats(entry)
                  return getPropStatValue(stats)
                })
                .filter((value) => Number.isFinite(value)) as number[]

              seasonGames = values.length
              if (values.length) {
                const sum = values.reduce((acc, v) => acc + v, 0)
                seasonAvg = sum / values.length
              }
              const lastTenValues = values.slice(0, 10)
              lastTenGames = lastTenValues.length
              if (lastTenValues.length) {
                const sum = lastTenValues.reduce((acc, v) => acc + v, 0)
                lastTenAvg = sum / lastTenValues.length
              }

              if (line != null && values.length) {
                const isOver = direction !== 'under'
                const seasonHit = values.filter((v) => (isOver ? v >= line : v <= line)).length
                seasonHits = seasonHit
                seasonHitRate = seasonHit / values.length
                if (lastTenValues.length) {
                  const lastTenHit = lastTenValues.filter((v) => (isOver ? v >= line : v <= line)).length
                  lastTenHits = lastTenHit
                  lastTenHitRate = lastTenHit / lastTenValues.length
                }
              }
            }
          }

          if (seasonAvg != null) {
            snapshotLines.push(`Context stats: season avg ${seasonAvg.toFixed(1)}`)
          }
          if (lastTenAvg != null) {
            snapshotLines.push(`Recent form: last 10 avg ${lastTenAvg.toFixed(1)}`)
          }
          if (line != null && seasonHitRate != null && seasonGames != null) {
            const seasonLine = `${seasonHits ?? 0}/${seasonGames} (${formatPercent(seasonHitRate)})`
            const lastTenLine =
              lastTenHitRate != null && lastTenGames != null
                ? `; last 10 ${lastTenHits ?? 0}/${lastTenGames} (${formatPercent(lastTenHitRate)})`
                : ''
            snapshotLines.push(
              `Trend: ${direction || 'over'} ${line.toFixed(1)} hit ${seasonLine}${lastTenLine}`
            )
          }

          const lineDeltaThreshold =
            propKey === 'threes' ? 0.5 : propKey === 'pra' ? 3 : propKey.includes('yards') ? 10 : propKey === 'touchdowns' ? 0.5 : 2

          const edge = evaluatePropEdge({
            line,
            direction,
            seasonHitRate,
            lastTenHitRate,
            seasonAvg,
            lineDeltaThreshold,
          })

          nextActions.push('Pull best over/under prices across books')
          nextActions.push('Compare alt lines for better EV')
          nextActions.push('Check injury report and projected minutes')

          const marketLabel = `${propLabel} ${direction ? `${direction} ` : ''}${line != null ? line.toFixed(1) : ''}`.trim()

          return {
            success: true,
            formatted: buildAnalysisResponse({
              title: `${playerName || 'Player'} ${propLabel}`.trim(),
              marketLabel,
              snapshotLines,
              edge,
              nextActions,
              missingInfo,
            }),
          }
        }

        // General matchup analysis - fetch comprehensive data when no specific market is requested
        if (isGeneralMatchupAnalysis && matchupTeams.length >= 2) {
          const analysisLines: string[] = []
          const [teamA, teamB] = matchupTeams

          // Fetch current odds for this matchup
          try {
            const oddsGames = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], { revalidateSeconds: 60 })
            const matchingGame = oddsGames.find((g: any) => {
              const home = g.home_team?.toLowerCase() || ''
              const away = g.away_team?.toLowerCase() || ''
              const teamALower = teamA.toLowerCase()
              const teamBLower = teamB.toLowerCase()
              return (home.includes(teamALower) || home.includes(teamBLower) ||
                      away.includes(teamALower) || away.includes(teamBLower)) &&
                     (home.includes(teamALower) || home.includes(teamBLower) ||
                      away.includes(teamALower) || away.includes(teamBLower))
            })

            if (matchingGame && matchingGame.bookmakers?.length > 0) {
              const book = matchingGame.bookmakers[0]
              const h2h = book.markets?.find((m: any) => m.key === 'h2h')
              const spreads = book.markets?.find((m: any) => m.key === 'spreads')
              const totals = book.markets?.find((m: any) => m.key === 'totals')

              const oddsLines: string[] = []
              if (h2h?.outcomes?.length) {
                const mlLine = h2h.outcomes.map((o: any) => `${o.name} ${o.price > 0 ? '+' : ''}${o.price}`).join(' / ')
                oddsLines.push(`ML: ${mlLine}`)
              }
              if (spreads?.outcomes?.length) {
                const spreadLine = spreads.outcomes.map((o: any) => `${o.name} ${o.point > 0 ? '+' : ''}${o.point} (${o.price > 0 ? '+' : ''}${o.price})`).join(' / ')
                oddsLines.push(`Spread: ${spreadLine}`)
              }
              if (totals?.outcomes?.length) {
                const totalLine = totals.outcomes.map((o: any) => `${o.name} ${o.point} (${o.price > 0 ? '+' : ''}${o.price})`).join(' / ')
                oddsLines.push(`Total: ${totalLine}`)
              }
              if (oddsLines.length) {
                analysisLines.push(`**Current Lines (${book.title})**`)
                oddsLines.forEach(l => analysisLines.push(l))
              }
            }
          } catch (err) {
            console.error('[MATCHUP_ANALYSIS] Odds fetch failed:', err)
          }

          // Fetch injuries
          const injuryLine = await summarizeInjuries(matchupTeams, sportKey)
          analysisLines.push('')
          analysisLines.push(`**Injuries**: ${injuryLine}`)

          // Fetch team stats and context for both teams
          const teamStatsData = await Promise.all(
            matchupTeams.slice(0, 2).map(async (teamName) => {
              const stats = await getTeamStats(sportKey, teamName)
              const primary = stats?.[0]
              const staticStats = sportKey === 'basketball_nba' ? findStaticNbaTeam(teamName)?.[0] : undefined
              return { teamName, primary, staticStats }
            })
          )

          analysisLines.push('')
          analysisLines.push('**Team Stats**')
          for (const entry of teamStatsData) {
            if (!entry.teamName) continue
            const statBlock = entry.primary?.stats || {}
            const record = statBlock.record || (statBlock.wins != null && statBlock.losses != null ? `${statBlock.wins}-${statBlock.losses}` : null)
            const ppg = toNumber(statBlock.pointsForPerGame)
            const papg = toNumber(statBlock.pointsAgainstPerGame)
            const netRating = toNumber(entry.staticStats?.stats?.netRating)
            const pace = toNumber(entry.staticStats?.stats?.pace)
            const ortg = toNumber(entry.staticStats?.stats?.offensiveRating)
            const drtg = toNumber(entry.staticStats?.stats?.defensiveRating)

            const pieces: string[] = []
            if (record) pieces.push(`Record: ${record}`)
            if (ppg != null) pieces.push(`PPG: ${ppg.toFixed(1)}`)
            if (papg != null) pieces.push(`PAPG: ${papg.toFixed(1)}`)
            if (ortg != null) pieces.push(`ORtg: ${ortg.toFixed(1)}`)
            if (drtg != null) pieces.push(`DRtg: ${drtg.toFixed(1)}`)
            if (netRating != null) pieces.push(`Net: ${netRating > 0 ? '+' : ''}${netRating.toFixed(1)}`)
            if (pace != null) pieces.push(`Pace: ${pace.toFixed(1)}`)

            if (pieces.length) {
              analysisLines.push(`${entry.teamName}: ${pieces.join(' | ')}`)
            }
          }

          // Fetch ATS trends
          analysisLines.push('')
          analysisLines.push('**Betting Trends**')
          for (const entry of teamStatsData) {
            if (!entry.teamName) continue
            const ats = await getTeamATSData(entry.teamName, sportKey)
            if (ats?.success && ats.data) {
              const atsPieces: string[] = []
              if (ats.data.overallATS) atsPieces.push(`ATS: ${ats.data.overallATS}`)
              if (ats.data.homeATS) atsPieces.push(`Home ATS: ${ats.data.homeATS}`)
              if (ats.data.awayATS) atsPieces.push(`Away ATS: ${ats.data.awayATS}`)
              if (ats.data.last10) atsPieces.push(`Last 10: ${ats.data.last10}`)
              if (atsPieces.length) {
                analysisLines.push(`${entry.teamName}: ${atsPieces.join(' | ')}`)
              }
            }
          }

          // Add next actions
          const generalNextActions = [
            'Ask about a specific spread or total line for edge analysis',
            'Check player props for this matchup',
            'Get betting splits (public vs sharp money)',
          ]

          return {
            success: true,
            formatted: `**Matchup Analysis: ${matchupLabel}**\n\n${analysisLines.join('\n')}\n\n---\n_For edge analysis, specify a line (e.g., "${teamA} -3.5" or "over 220.5")_`,
          }
        }

        const fallbackEdge: EdgeAssessment = {
          verdict: 'none',
          confidence: 'low',
          reason: 'Need more market detail to analyze edge.',
        }

        return {
          success: true,
          formatted: buildAnalysisResponse({
            title: matchupLabel,
            marketLabel: marketType.replace(/_/g, ' '),
            snapshotLines,
            edge: fallbackEdge,
            nextActions: ['Share the market type and line you want analyzed'],
            missingInfo,
          }),
        }
      }

      const runToolCall = async (toolCall: any) => {
      const functionName = toolCall.function.name
      const functionArgs = JSON.parse(toolCall.function.arguments || '{}')
      let functionResult: any

      if (functionName && !allowedToolNames.has(functionName)) {
        const reason = `Tool ${functionName} is disabled in ${mode} mode.`
        return { success: false, error: reason }
      }

      const DISABLED_TOOLS = new Set([])

      if (espnToolResolvers[functionName]) {
        functionResult = await espnToolResolvers[functionName](functionArgs)
      } else if (functionName === 'settle_bet') {
        if (!supabase) {
          functionResult = { success: false, error: 'Supabase is not configured.' }
        } else {
          const { data: pendingBets } = await supabase
            .from('bets')
            .select('*')
            .eq('user_id', userId)
            .eq('status', 'pending')
            .order('placed_at', { ascending: false })

          // Find the bet matching the game description
          const matchingBet = pendingBets?.find((bet: any) =>
            bet.game_description.toLowerCase().includes(functionArgs.game_description.toLowerCase())
          )

          if (!matchingBet) {
            functionResult = { success: false, error: 'No pending bet found for that game' }
          } else {
            functionResult = await settleBet(supabase, userId, matchingBet.id, functionArgs.result)
          }
        }
      } else if (functionName === 'log_bet') {
        functionResult = await logBet(supabase, userId, functionArgs, conversationId)
      } else if (functionName === 'log_multiple_bets') {
        functionResult = await logMultipleBets(supabase, userId, functionArgs.bets, conversationId)
      } else if (functionName === 'get_stats') {
        // Fetch requested stats with optional advanced data for NBA/NFL
        if (functionArgs.type === 'team') {
          const statsStart = Date.now()
          try {
            const [teamStats, injuries, advanced] = await Promise.all([
              withTimeout(getTeamStats(functionArgs.sport, functionArgs.team)),
              withTimeout(getInjuryReports(functionArgs.sport)),
              withTimeout(
                (functionArgs.sport || '').toLowerCase().includes('basketball')
                  ? getNBAAdvancedTeamStats()
                  : (functionArgs.sport || '').toLowerCase().includes('football')
                  ? getNFLAdvancedTeamStats()
                  : Promise.resolve([])
              ).catch(() => [] as any[]),
            ])

            const formattedBase = formatStatsForAI(teamStats)
            let formatted = formattedBase

            // Attach injuries if present
            if (injuries && injuries.length) {
              formatted += `\n\nInjuries:\n${formatStatsForAI(injuries)}`
            }

            // Attach advanced metrics if present
            const advLines: string[] = []
            if (advanced && advanced.length && teamStats && teamStats.length) {
              const target = (functionArgs.team || '').toString().toLowerCase()
              const advMatch = (advanced as any[]).find(
                (a) =>
                  a.team?.toLowerCase() === target ||
                  a.teamAbbr?.toLowerCase() === target ||
                  target.includes((a.team || '').toLowerCase())
              )
              if (advMatch) {
                if ((functionArgs.sport || '').toLowerCase().includes('basketball')) {
                  advLines.push(
                    `Advanced: NetRtg ${advMatch.netRating?.toFixed(1) ?? 'n/a'}, Pace ${advMatch.pace?.toFixed(1) ?? 'n/a'}, TS% ${advMatch.tsPct ? (advMatch.tsPct * 100).toFixed(1) : 'n/a'}`
                  )
                } else if ((functionArgs.sport || '').toLowerCase().includes('football')) {
                  const effValue = advMatch.epaPerPlay ?? advMatch.yardsPerPlay
                  const effLabel = advMatch.epaPerPlay != null ? 'EPA/play' : 'Yds/play'
                  const effText = effValue != null ? effValue.toFixed(3) : 'n/a'
                  advLines.push(
                    `Advanced: ${effLabel} ${effText}, Conv% ${advMatch.successRate ? (advMatch.successRate * 100).toFixed(1) : 'n/a'}, Pass% ${advMatch.passRate ? (advMatch.passRate * 100).toFixed(1) : 'n/a'}`
                  )
                }
              }
            }

            if (advLines.length) {
              formatted += `\n\n${advLines.join('\n')}`
            }

            functionResult = {
              success: true,
              data: {
                teams: teamStats,
                injuries,
                advanced,
              },
              formatted,
            }
            console.log('[PERF][STATS][TEAM]', {
              sport: functionArgs.sport,
              team: functionArgs.team,
              ms: Date.now() - statsStart,
            })
          } catch (err: any) {
            functionResult = { success: false, error: err?.message || 'Failed to fetch team stats' }
          }
        } else if (functionArgs.type === 'injuries') {
          try {
          const injuries = await withTimeout(getInjuryReports(functionArgs.sport))
          functionResult = {
            success: true,
            data: injuries,
            formatted: formatStatsForAI(injuries),
          }
          } catch (err: any) {
            functionResult = { success: false, error: err?.message || 'Failed to fetch injuries' }
          }
        } else {
          functionResult = {
            success: false,
            error: `Unsupported stats type: ${functionArgs.type || 'unknown'}`,
          }
        }
      } else if (functionName === 'get_player_season_stats') {
        try {
          const statsStart = Date.now()
          const sportKey = (functionArgs.sport || '').toString().toLowerCase()
          const playerName = (functionArgs.player || '').toString().trim()
          if (!playerName) {
            functionResult = { success: false, error: 'Player name is required' }
          } else {
            const data = await getPlayerSeasonStats(playerName, sportKey || undefined)
            if (data) {
              let formatted = formatStatsForAI([data])
              // Compute simple advanced metrics (TS%, eFG%, TOV%) from season stats when possible
              if (sportKey.includes('basketball') && data.stats) {
                let adv = computeSimpleAdvanced(data.stats as Record<string, any>)
                // If missing FGA/FTA, derive from gamelog averages
                if ((adv.tsPct == null || adv.efgPct == null) && playerName) {
                  try {
                    const seasonYear = getEspnSeasonYearForLogs('nba')
                    const searchHit = await searchPlayer(playerName, 'basketball_nba')
                    const playerId = (searchHit as any)?.id || (searchHit as any)?.athleteId
                    if (playerId) {
                      const logsRaw = await getPlayerGameLogs('nba', String(playerId), seasonYear, 2)
                      const logs: any[] = Array.isArray(logsRaw) ? logsRaw : []
                      const take = logs.slice(0, 20)
                      let sumPts = 0, sumFga = 0, sumFgm = 0, sumFta = 0, sumTpm = 0, sumTov = 0
                      let tsSamples = 0
                      let efgSamples = 0
                      let tovSamples = 0
                      for (const g of take) {
                        const blocks: any[] = Array.isArray(g?.stats) ? g.stats : Array.isArray(g?.statistics) ? g.statistics : []
                        const statMap: Record<string, number> = {}
                        for (const blk of blocks) {
                          const entries: any[] = Array.isArray(blk?.stats) ? blk.stats : Array.isArray(blk) ? blk : []
                          for (const s of entries) {
                            const label = s?.label || s?.displayName || s?.name
                            const rawVal = s?.value ?? s?.displayValue ?? s?.display_value
                            let val =
                              typeof rawVal === 'number'
                                ? rawVal
                                : typeof rawVal === 'string'
                                ? Number(rawVal)
                                : Number(rawVal)
                            if (typeof rawVal === 'string' && Number.isNaN(val) && rawVal.includes('-')) {
                              const head = rawVal.split('-')[0]
                              val = Number(head)
                            }
                            if (label && Number.isFinite(val)) {
                              statMap[label.toString().toUpperCase().replace(/\s+/g, '_')] = val
                            }
                          }
                        }
                        const n = (k: string, defaultZero = false) => {
                          const v = statMap[k]
                          if (typeof v === 'number' && Number.isFinite(v)) return v
                          return defaultZero ? 0 : null
                        }
                        const pts = n('PTS')
                        const fga = n('FGA', true) // treat missing as 0 for possession math
                        const fgm = n('FGM')
                        const fta = n('FTA', true)
                        const tpm = n('3PM') ?? n('3PT')
                        const tov = n('TOV')
                        if (pts != null && fga != null && fta != null) {
                          sumPts += pts
                          sumFga += fga
                          sumFta += fta
                          tsSamples++
                        }
                        if (fgm != null && fga != null) {
                          sumFgm += fgm
                          sumFga += fga
                          efgSamples++
                        }
                        if (tpm != null) sumTpm += tpm
                        if (tov != null && fga != null && fta != null) {
                          sumTov += tov
                          tovSamples++
                        }
                      }
                      if (tsSamples > 0 || efgSamples > 0 || tovSamples > 0) {
                        const perGame = {
                          PTS: tsSamples ? sumPts / tsSamples : null,
                          FGA: efgSamples ? sumFga / efgSamples : tsSamples ? sumFga / tsSamples : null,
                          FGM: efgSamples ? sumFgm / efgSamples : null,
                          FTA: tsSamples ? sumFta / tsSamples : null,
                          '3PM': tsSamples || efgSamples ? sumTpm / Math.max(tsSamples, efgSamples, 1) : null,
                          TOV: tovSamples ? sumTov / tovSamples : null,
                        }
                        adv = computeSimpleAdvanced(perGame)
                        // If any value stayed null, try a looser average across all games to avoid "not available" messaging
                        if (adv.tsPct == null || adv.efgPct == null || adv.tovPct == null) {
                          const loosePerGame = {
                            PTS: sumPts / Math.max(tsSamples || efgSamples || 1, 1),
                            FGA: sumFga / Math.max(tsSamples || efgSamples || 1, 1),
                            FGM: sumFgm / Math.max(efgSamples || 1, 1),
                            FTA: sumFta / Math.max(tsSamples || 1, 1),
                            '3PM': sumTpm / Math.max(tsSamples || efgSamples || 1, 1),
                            TOV: sumTov / Math.max(tovSamples || 1, 1),
                          }
                          adv = computeSimpleAdvanced(loosePerGame)
                        }
                      }
                    }
                  } catch (err) {
                    console.warn('[PLAYER_ADVANCED_FALLBACK] failed', err)
                  }
                }
                const parts: string[] = []
                if (adv.tsPct != null) parts.push(`TS% ${(adv.tsPct * 100).toFixed(1)}`)
                if (adv.efgPct != null) parts.push(`eFG% ${(adv.efgPct * 100).toFixed(1)}`)
                if (adv.tovPct != null) parts.push(`TOV% ${(adv.tovPct * 100).toFixed(1)}`)
                if (parts.length) formatted += `\n\nAdvanced (derived): ${parts.join(' | ')}`
              }
              functionResult = { success: true, data, formatted }
            } else {
              functionResult = { success: false, error: 'Player season stats not found' }
            }
          }
          console.log('[PERF][STATS][PLAYER]', {
            sport: sportKey,
            player: playerName,
            ms: Date.now() - statsStart,
          })
        } catch (err: any) {
          functionResult = {
            success: false,
            error: err?.message || 'Failed to fetch player season stats',
          }
        }
      } else if (functionName === 'get_trending_players') {
        functionResult = await runTrendingPlayers(functionArgs)
      } else if (functionName === 'create_parlay') {
        try {
          const response = await fetch(`${baseUrl}/api/parlays`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              stake: functionArgs.stake,
              picks: functionArgs.picks,
              conversationId,
            }),
            cache: 'no-store',
          })
          const data = await response.json()
          functionResult = data
        } catch (error: any) {
          functionResult = { error: error?.message || 'Failed to create parlay' }
        }
      } else if (functionName === 'get_parlays') {
        try {
          const params = new URLSearchParams()
          if (functionArgs.limit) params.set('limit', String(functionArgs.limit))
          const response = await fetch(`${baseUrl}/api/parlays?${params.toString()}`, {
            method: 'GET',
            cache: 'no-store',
          })
          const data = await response.json()
          functionResult = data
        } catch (error: any) {
          functionResult = { error: error?.message || 'Failed to fetch parlays' }
        }
      } else if (functionName === 'get_player_props') {
        // Fetch player props from our API endpoint
        console.log('[TOOL] get_player_props tool called')
        try {
          if (!functionArgs.player && !functionArgs.team) {
            functionResult = {
              success: false,
              error: 'Please specify a player name (and optionally a team) to fetch props faster.'
            }
          } else {
            const params = new URLSearchParams({
              sport: mapSportToPropKey(functionArgs.sport)
            })

            if (functionArgs.player) {
              params.append('player', functionArgs.player)
            }

            if (functionArgs.market) {
              params.append('market', functionArgs.market)
            }

            if (functionArgs.team) {
              params.append('team', functionArgs.team)
              console.log(`[PLAYER_PROPS] Team filter applied: ${functionArgs.team}`)
            }

            const response = await fetch(`${baseUrl}/api/player-props?${params.toString()}`, { cache: 'no-store' })
            const propsData = await response.json()

            if (!response.ok) {
              functionResult = {
                success: false,
                error: propsData.error || 'Failed to fetch player props'
              }
            } else {
              // Format props data for AI
              console.log('[CHAT API] propsData:', !!propsData.data, 'length:', propsData.data?.length)
              let formatted = ''
              if (propsData.data && propsData.data.length > 0) {
                for (const playerProp of propsData.data) {
                  const headerParts = [`**${playerProp.player}**`]
                  if (playerProp.team) {
                    headerParts.push(
                      `(${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
                    )
                  }
                  formatted += `${headerParts.join(' ')}\n`
                  if (playerProp.game) {
                    formatted += `Game: ${playerProp.game}\n`
                  }
                  formatted += `| Market | Line | Best Over | Best Under |\n`
                  formatted += `| --- | --- | --- | --- |\n`

                  for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
                    const lineLabel =
                      marketData.line !== undefined && marketData.line !== null ? marketData.line : '?'
                    const bestOver =
                      marketData.over.bestBook
                        ? `${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})`
                        : '?'
                    const bestUnder =
                      marketData.under.bestBook
                        ? `${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})`
                        : '?'

                    formatted += `| ${marketType.toUpperCase()} | ${lineLabel} | ${bestOver} | ${bestUnder} |\n`
                  }

                  formatted += `\n`
                }
              } else {
                formatted = 'No player props available for the specified criteria.'
              }

              if (propsData.data && propsData.data.length > 0) {
                formatted += `\n${buildDataSourceLine(['SBD'])}`
              }

              functionResult = {
                success: true,
                data: propsData.data,
                count: propsData.count,
                formatted,
                structuredData: propsData.data
              }
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch player props: ${error.message}`
          }
        }
      } else if (functionName === 'get_bankroll_stats') {
        // Fetch bankroll statistics
        try {
          const period = functionArgs.period || 'all'

          const response = await fetch(`${baseUrl}/api/bankroll/stats?period=${period}`)
          const statsData = await response.json()

          if (!response.ok) {
            functionResult = {
              success: false,
              error: statsData.error || 'Failed to fetch bankroll stats'
            }
          } else {
            // Format stats for AI analysis
            const {
              currentBalance,
              startingBalance,
              totalProfit,
              roi,
              totalBets,
              wonBets,
              lostBets,
              pushBets,
              pendingBets,
              winRate,
              avgBetSize,
              biggestWin,
              biggestLoss,
              bySport
            } = statsData

            const periodLabel = period === '7d' ? 'Last 7 Days' : period === '30d' ? 'Last 30 Days' : 'All Time'

            let formatted = `**Bankroll Statistics (${periodLabel})**\n\n`
            formatted += `**Overall Performance:**\n`
            formatted += `- Current Balance: $${currentBalance.toFixed(2)}\n`
            formatted += `- Starting Balance: $${startingBalance.toFixed(2)}\n`
            formatted += `- Total Profit/Loss: ${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}\n`
            formatted += `- ROI: ${roi.toFixed(2)}%\n`
            formatted += `- Win Rate: ${winRate.toFixed(1)}% (${wonBets}W-${lostBets}L-${pushBets}P)\n\n`

            formatted += `**Betting Activity:**\n`
            formatted += `- Total Bets: ${totalBets} (${pendingBets} pending)\n`
            formatted += `- Average Bet Size: $${avgBetSize.toFixed(2)}\n`
            formatted += `- Biggest Win: $${biggestWin.toFixed(2)}\n`
            formatted += `- Biggest Loss: $${Math.abs(biggestLoss).toFixed(2)}\n\n`

            if (Object.keys(bySport).length > 0) {
              formatted += `**Performance by Sport:**\n`
              for (const [sport, data] of Object.entries(bySport) as [string, any][]) {
                formatted += `- ${formatLeagueLabel(sport)}: ${data.won}W-${data.lost}L (${data.winRate.toFixed(1)}% WR, ${data.roi.toFixed(1)}% ROI, $${data.profit.toFixed(2)} profit)\n`
              }
            }

            functionResult = {
              success: true,
              stats: statsData,
              formatted,
              insights: {
                isPositive: totalProfit > 0,
                isBreakingEven: totalProfit >= -50 && totalProfit <= 50,
                hasGoodWinRate: winRate >= 52.4, // Breakeven at -110 odds
                avgBetSizeVsBankroll: (avgBetSize / currentBalance * 100).toFixed(1),
                bestSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => b[1].roi - a[1].roi)[0]?.[0],
                worstSport: (Object.entries(bySport) as [string, any][]).sort((a, b) => a[1].roi - b[1].roi)[0]?.[0]
              }
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: `Failed to fetch bankroll stats: ${error.message}`
          }
        }
      } else if (functionName === 'save_custom_model') {
        try {
          if (!supabase) {
            functionResult = { success: false, error: 'Supabase is not configured.' }
            return
          }
          const statsInput = buildStatInputs(functionArgs.stats)
          const hierarchy = normalizeHierarchyInput(functionArgs.hierarchy)
          const savedModel = await saveCustomModel(supabase, userId, {
            modelName: functionArgs.model_name,
            sportKey: functionArgs.sport_key,
            marketType: functionArgs.market_type,
            targetMetric: functionArgs.target_metric,
            confidenceLevel: functionArgs.confidence_level,
            stats: statsInput,
            dataHints: functionArgs.data_hints,
            notes: functionArgs.notes,
            hierarchy,
            userDataSpec: functionArgs.user_data_spec
              ? {
                  description: functionArgs.user_data_spec.description,
                  keys: functionArgs.user_data_spec.keys,
                  required: functionArgs.user_data_spec.required,
                }
              : undefined,
          })

          functionResult = {
            success: true,
            model: savedModel,
            message: `Model "${savedModel.model_name}" saved successfully`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to save custom model',
          }
        }
      } else if (functionName === 'list_custom_models') {
        try {
          if (!supabase) {
            functionResult = { success: false, error: 'Supabase is not configured.' }
            return
          }
          const limit = functionArgs.limit || 5
          const models = await listCustomModels(supabase, userId, limit)

          functionResult = {
            success: true,
            models,
            count: models.length,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to list custom models',
          }
        }
      } else if (functionName === 'apply_custom_model') {
        try {
          if (!supabase) {
            functionResult = { success: false, error: 'Supabase is not configured.' }
            return
          }
          let modelRecord: CustomModelRow | null = null
          if (functionArgs.model_id) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('*')
              .eq('user_id', userId)
              .eq('id', functionArgs.model_id)
              .single<CustomModelRow>()
            if (error || !data) {
              throw new Error('No model found for that ID')
            }
            modelRecord = data
          } else {
            const { data, error } = await supabase
              .from('custom_models')
              .select('*')
              .eq('user_id', userId)
              .ilike('model_name', functionArgs.model_name)
              .single<CustomModelRow>()
            if (error || !data) {
              throw new Error(`Model "${functionArgs.model_name}" was not found. Ask the user to confirm the name or create it first.`)
            }
            modelRecord = data
          }

          const matchup = functionArgs.matchup
            ? {
                focus: functionArgs.matchup.focus || functionArgs.matchup.focus_team,
                opponent: functionArgs.matchup.opponent || functionArgs.matchup.opponent_team,
              }
            : undefined

          const userDataOverrides = normalizeUserDataOverrides(functionArgs.user_data)
          const hierarchy = normalizeHierarchyInput(functionArgs.hierarchy) as any
          const applyToSlate = Boolean(functionArgs.apply_to_slate)
          const maxGames = functionArgs.max_games != null ? Number(functionArgs.max_games) : undefined
          const minConfidence =
            functionArgs.min_confidence != null ? Number(functionArgs.min_confidence) : undefined

          if (applyToSlate) {
            const slate = await runCustomModelAcrossSlate(
              modelRecord,
              {
                sportKey: functionArgs.sport_key || modelRecord.sport_key,
                day: functionArgs.slate_day || 'today',
                limit: maxGames,
                minConfidence,
                userData: userDataOverrides,
                hierarchy,
              },
              supabase
            )

            await touchCustomModelUsage(supabase, modelRecord.id)

            functionResult = {
              success: true,
              model: modelRecord,
              slate,
              count: slate.length,
              message: `Model applied across ${slate.length} game(s).`,
            }
          } else {
            const result = await runCustomModel(
              modelRecord,
              {
                sportKey: functionArgs.sport_key,
                teams: functionArgs.teams,
                matchup,
                notes: functionArgs.notes,
                userData: userDataOverrides,
                hierarchy,
              },
              supabase
            )

            await touchCustomModelUsage(supabase, modelRecord.id)

            functionResult = {
              success: true,
              model: modelRecord,
              result,
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to apply custom model',
          }
        }
      } else if (functionName === 'get_game_context') {
        try {
          const ctx = await withTimeout(
            buildGameContext({
              sport: functionArgs.sport,
              homeTeam: functionArgs.home_team,
              awayTeam: functionArgs.away_team,
              includeMarketTrends:
                functionArgs.include_market_trends === undefined
                  ? true
                  : Boolean(functionArgs.include_market_trends),
              supabase,
            }),
            12000
          )
          functionResult = {
            success: true,
            data: ctx,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to gather matchup context',
          }
        }
      } else if (functionName === 'get_pick_guidance') {
        functionResult = await runPickGuidance(functionArgs)
      } else if (functionName === 'analyze_bet_market') {
        try {
          functionResult = await runBetMarketAnalysis(functionArgs)
        } catch (error: any) {
          console.error('[CHAT] analyze_bet_market error:', error)
          functionResult = {
            success: false,
            error: error.message || 'Failed to analyze bet market',
          }
        }
      } else if (functionName === 'save_research_model') {
        try {
          const { save_research_model } = await import('@/lib/models/research-crud')

          const savedModel = await save_research_model(supabase, userId, {
            modelName: functionArgs.model_name,
            sports: functionArgs.sports,
            markets: functionArgs.markets,
            filters: functionArgs.filters,
            sortBy: functionArgs.sort_by,
            maxResults: functionArgs.max_results,
            notes: functionArgs.notes,
          })

          functionResult = {
            success: true,
            model: savedModel,
            message: `Research model "${savedModel.model_name}" saved successfully. Use run_research_model to scan for opportunities.`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to save research model',
          }
        }
      } else if (functionName === 'run_research_model') {
        try {
          const { runResearchModel } = await import('@/lib/models/research-runner')

          // Find the model by ID or name
          let modelId: string
          if (functionArgs.model_id) {
            modelId = functionArgs.model_id
          } else if (functionArgs.model_name) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('id')
              .eq('user_id', userId)
              .eq('model_type', 'research')
              .ilike('model_name', functionArgs.model_name)
              .single()

            if (error || !data) {
              throw new Error(`Research model "${functionArgs.model_name}" not found`)
            }
            modelId = data.id
          } else {
            throw new Error('Either model_id or model_name is required')
          }

          // Run the research model
          const result = await runResearchModel(modelId, userId, {
            liveOnly: functionArgs.live_only,
            upcomingOnly: functionArgs.upcoming_only !== false, // Default true
            timeWindow: functionArgs.time_window || 24,
          })

          functionResult = {
            success: true,
            result,
            message: `Found ${result.totalMatches} opportunities matching your criteria.`,
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to run research model',
          }
        }
      } else if (functionName === 'list_research_opportunities') {
        try {
          const { getLatestResearchResults } = await import('@/lib/models/research-runner')

          // Find the model by ID or name
          let modelId: string
          if (functionArgs.model_id) {
            modelId = functionArgs.model_id
          } else if (functionArgs.model_name) {
            const { data, error } = await supabase
              .from('custom_models')
              .select('id')
              .eq('user_id', userId)
              .eq('model_type', 'research')
              .ilike('model_name', functionArgs.model_name)
              .single()

            if (error || !data) {
              throw new Error(`Research model "${functionArgs.model_name}" not found`)
            }
            modelId = data.id
          } else {
            throw new Error('Either model_id or model_name is required')
          }

          // Get cached results
          const results = await getLatestResearchResults(modelId, userId, functionArgs.limit || 1)

          if (results.length === 0) {
            functionResult = {
              success: true,
              results: [],
              message: 'No cached results found. Run the research model first.',
            }
          } else {
            functionResult = {
              success: true,
              results,
              message: `Retrieved ${results.length} cached result set(s).`,
            }
          }
        } catch (error: any) {
          functionResult = {
            success: false,
            error: error.message || 'Failed to list research opportunities',
          }
        }
      } else if (functionName === 'calculate_kelly') {
        const odds = Number(functionArgs.odds)
        const winProb = Math.max(0, Math.min(1, Number(functionArgs.win_probability)))
        const fraction =
          functionArgs.fraction != null ? Math.max(0, Number(functionArgs.fraction)) : undefined
        const maxStakePct =
          functionArgs.max_stake_pct != null ? Math.max(0, Number(functionArgs.max_stake_pct)) : undefined

        const result = calculateKellyStake({
          americanOdds: odds,
          winProbability: winProb,
          bankroll: functionArgs.bankroll != null ? Number(functionArgs.bankroll) : undefined,
          unitSize: functionArgs.unit_size != null ? Number(functionArgs.unit_size) : undefined,
          fraction,
          maxStakePct,
        })

        functionResult = {
          success: true,
          ...result,
        }
      } else if (functionName === 'get_betting_splits') {
        const { summarizeCoversSplitsForChat } = await import('@/lib/providers/covers')
        const teams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
        const formatted = await summarizeCoversSplitsForChat({
          message,
          teams,
          timezone,
        })
        functionResult = { success: true, formatted }
      } else if (functionName === 'analyze_game_splits') {
        const { summarizeCoversGameSplitsForChat } = await import('@/lib/providers/covers')
        const fallbackTeams = parsedMatchupTeams.length ? parsedMatchupTeams : mentionedTeams
        const teams =
          functionArgs.teams != null ? [String(functionArgs.teams)] : fallbackTeams
        const formatted = await summarizeCoversGameSplitsForChat({
          message,
          teams,
          gameId: functionArgs.game_id,
          timezone,
        })
        functionResult = { success: true, formatted }
      } else if (functionName === 'get_slate_edge_detection') {
        const { analyzeSlateEdges, formatSlateEdgesForChat } = await import('@/lib/services/slate-edge-detector')
        const sport = functionArgs.sport || 'basketball_nba'
        const minEdge = functionArgs.minEdge as 'soft' | 'strong' | undefined
        const result = await analyzeSlateEdges(sport, { minEdge })
        const formatted = formatSlateEdgesForChat(result)
        functionResult = { success: true, formatted }
      }

      return functionResult
    };

    async function streamTextResponse(text: string) {
      const encoder = new TextEncoder()
      const handledStream = new ReadableStream({
        async start(controller) {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()

            try {
              if (text.trim().length > 0) {
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: text,
                })
              }

              const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)

              if (messageCount === 2) {
                const title = await generateConversationTitle(message)
                await supabase
                  .from('conversations')
                  .update({ title })
                  .eq('id', conversationId)
              }
            } catch (persistError) {
              console.error('[CHAT] Failed to persist message/title:', persistError)
              // Do not throw; streaming should already be closed
            }
          } catch (error) {
            controller.error(error)
          }
        },
      })

      return new Response(handledStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    if (pendingOddsReply) {
      return streamTextResponse(pendingOddsReply)
    }

    if (shouldFetchOdds && totalGamesAvailable === 0) {
      const fallbackOddsMessage =
        oddsContext?.trim() ||
        'No odds are available for that request right now. Try a different team, sport, or timeframe.'
      return streamTextResponse(fallbackOddsMessage)
    }

    if (modelApplicationIntent) {
      try {
        const modelInstructions =
          'You are an analytics assistant that emulates a custom betting model. Read the user-provided stats, matchup context, and any odds snippet. ' +
          'Return a structured projection that mirrors a model output: remind what metrics were used, estimate spreads/totals/confidence intervals, and make a clear pick (cover/over/etc.) with rationale. ' +
          'Reference the provided numbers (net rating, defense, tempo, etc.) directly. If odds are in the message, compare your projection to them. Keep it concise but actionable.'

        const completion = await openai.chat.completions.create({
          model: AI_MODELS.chat,
          temperature: AI_MODELS.chat.includes('gpt-5') ? undefined : 0.4,
          max_completion_tokens: 400,
          messages: [
            { role: 'system', content: modelInstructions },
            {
              role: 'user',
              content:
                'User request:\n' +
                message +
                '\n\nIf odds or lines are embedded, compare your projection against them. Output format: intro sentence, key drivers bullets, final prediction (spread/cover or total) with confidence label.',
            },
          ],
        })

        const text = completion.choices[0]?.message?.content?.trim()
        return streamTextResponse(text || 'Model-style projection unavailable+óGé¼GÇ¥please provide more structured stats.')
      } catch (err: any) {
        console.error('[MODEL_EMULATION] Failed:', err?.message || err)
        return streamTextResponse('I couldn+óGé¼Gäót run that model-like projection. Please share the matchup stats and target again.')
      }
    }

    // Research intent: prioritize web search or saved model/projection
    if (researchIntent) {
      if (wantsEdgesOrValue && !mentionsModel) {
        return streamTextResponse(
          'To calculate edges/EV or make picks, choose a custom model and run it. Without a model, I can only provide news, injuries, and qualitative trends (no odds, no EV).'
        )
      }

      // If odds context is already available, prefer deterministic odds reply to avoid "done"
      // Only use the odds shortcut when we are not explicitly in web-search mode
      if (!webSearchToggle && buildDeterministicOddsReply()) {
        return streamTextResponse(buildDeterministicOddsReply() as string)
      }

      const webSearchAllowed = process.env.ENABLE_WEB_SEARCH === 'true' || webSearchToggle
      if (webSearchAllowed) {
        try {
          const searchPrompt =
            `You are the web research mode. Search the web for authoritative, recent information only. ` +
            `Task: find the latest news, injury reports, and performance/advanced-stat trends for: ${message}. ` +
            `Do NOT return sportsbook odds. Do NOT give picks or EV unless a custom model is provided. Summarize as concise bullets with source links. Prioritize the last 72 hours.`
          let searchResult = await runWebSearchResponse(searchPrompt, { maxOutputTokens: 400, retry: 1 })
          if (!searchResult || !String(searchResult).trim()) {
            const fallbackPrompt =
              `You are the web research mode. Search the web for authoritative information. ` +
              `Task: find the latest news, injury reports, and performance/advanced-stat trends for: ${message}. ` +
              `Expand to the last 7 days if nothing is found in the last 72 hours. Provide concise bullets with source links. No odds; no picks/EV without a custom model.`
            searchResult = await runWebSearchResponse(fallbackPrompt, { maxOutputTokens: 400, retry: 1 })
          }
          return streamTextResponse(searchResult || 'No recent updates found.')
        } catch (err: any) {
          console.error('[RESEARCH] Web search failed:', err?.message || err)
          // Fall through to model-based handling
        }
      }

      // Fallback: run research model (no web). Use gpt-5 to summarize trends/injuries without odds.
      try {
        const completion = await openai.chat.completions.create({
          model: AI_MODELS.research,
          messages: [
            {
              role: 'system',
              content:
                'Research mode without web search. Use domain knowledge and provided context only. Focus on injuries, recent performance trends, matchup notes. Do NOT provide sportsbook odds or lines. Do NOT give EV, edges, or picks unless a custom model was provided. Keep the reply concise, bullet-first.',
            },
            { role: 'user', content: message },
          ],
          max_completion_tokens: 320,
        })
        const text = completion.choices[0]?.message?.content?.trim()
        return streamTextResponse(text || 'No research output generated.')
      } catch (err: any) {
        console.error('[RESEARCH] Local research model failed:', err?.message || err)
        return streamTextResponse(
          'Research mode is active. Tell me which saved model to apply (or what projection you want), and I will run it. If you want web search, say "enable web search" and repeat your request.'
        )
      }
    }

    // If user clearly wants player props, short-circuit to props endpoint
    if (!conceptualStatsOnly && propIntent && !analysisIntent) {
      console.log('[PLAYER_PROPS_SHORTCUT] Using shortcut path for player props')
      try {
        const inferredSport =
          msgLower.match(/nfl|football/) ? 'nfl' :
          msgLower.match(/mlb|baseball/) ? 'mlb' :
          msgLower.match(/nhl|hockey/) ? 'nhl' :
          'nba'

        const sportKey = mapSportToPropKey(inferredSport)
        const params = new URLSearchParams({ sport: sportKey })
        if (mentionedTeams.length) {
          params.set('team', mentionedTeams.join(','))
        }
        let playerName = extractPlayerName(message)
        if (playerName && /\b(player|prop|props)\b/i.test(playerName)) {
          const cleanedMessage = message
            .replace(/\bplayer props?\b/gi, '')
            .replace(/\bprops?\b/gi, '')
            .trim()
          const altName = extractPlayerName(cleanedMessage)
          playerName = altName && !/\b(player|prop|props)\b/i.test(altName) ? altName : undefined
        }
        if (playerName) {
          params.set('player', playerName)
          console.log(`[PLAYER_PROPS] Player filter applied: ${playerName}`)
        } else if (!mentionedTeams.length) {
          return streamTextResponse('I can pull player props. Tell me the player name (and team if you\'d like) to narrow it down.')
        }
        const propsRes = await fetch(`${baseUrl}/api/player-props?${params.toString()}`, { cache: 'no-store' })
        const propsData = await propsRes.json()
        let formatted = 'No player props available.'
        if (propsRes.ok && propsData?.data?.length) {
          formatted = `Found ${propsData.count} player(s) with prop bets:\n\n`
          for (const playerProp of propsData.data) {
            const headerParts = [`**${playerProp.player}**`]
            if (playerProp.team) {
              headerParts.push(
                `(${playerProp.teamAbbr || playerProp.team}${playerProp.position ? ', ' + playerProp.position : ''})`
              )
            }
            formatted += `${headerParts.join(' ')}\n`
            if (playerProp.game) {
              formatted += `Game: ${playerProp.game}\n`
            }
            formatted += `| Market | Line | Best Over | Best Under |\n`
            formatted += `| --- | --- | --- | --- |\n`
            for (const [marketType, marketData] of Object.entries(playerProp.markets) as [string, any][]) {
              const lineLabel =
                marketData.line !== undefined && marketData.line !== null ? marketData.line : '?'
              const bestOver =
                marketData.over.bestBook
                  ? `${marketData.over.best > 0 ? '+' : ''}${marketData.over.best} (${marketData.over.bestBook})`
                  : '?'
              const bestUnder =
                marketData.under.bestBook
                  ? `${marketData.under.best > 0 ? '+' : ''}${marketData.under.best} (${marketData.under.bestBook})`
                  : '?'
              formatted += `| ${marketType.toUpperCase()} | ${lineLabel} | ${bestOver} | ${bestUnder} |\n`
            }
            formatted += `\n`
          }

          formatted += `\n${buildDataSourceLine(['SBD'])}`
        } else if (!propsRes.ok) {
          formatted = propsData?.error || 'Failed to fetch player props.'
        }

        console.log('[PLAYER_PROPS_SHORTCUT] Returning response, should exit here')
        return streamTextResponse(formatted)
      } catch (err: any) {
        console.error('[PLAYER_PROPS_SHORTCUT] Failed:', err)
        return streamTextResponse('Player props are temporarily unavailable. Please try again.')
      }
    }

    console.log('[CHAT] After propIntent check, continuing to tool calls')
    console.log('[CHAT] toolCalls value:', toolCalls)
    console.log('[CHAT] toolCalls length:', toolCalls?.length)
    let handledToolCalls = false
    let lastText = initialResponse.choices[0].message.content || ''

    let skipModelResponse = false

    // If we have tool calls, handle them with status streaming
    if (toolCalls && toolCalls.length > 0) {
      console.log('[CHAT] ENTERING TOOL EXECUTION STREAM - Tool count:', toolCalls.length)
      const encoder = new TextEncoder()

      const toolStream = new ReadableStream({
        async start(controller) {
          try {
            while (toolCalls && toolCalls.length > 0) {
              handledToolCalls = true

              // OpenAI SDK returns tool_calls with { id, type, function: { name, arguments } }
              openaiMessages.push({
                role: 'assistant',
                content: lastText || undefined,
                tool_calls: toolCalls,
              } as any)

              for (const toolCall of toolCalls) {
                // Emit status event BEFORE executing tool
                const functionName = toolCall.function?.name
                if (functionName) {
                  console.log('[CHAT] Emitting status event for operation:', functionName)
                  const statusEvent = `data: ${JSON.stringify({
                    type: 'status',
                    operation: functionName,
                    timestamp: Date.now()
                  })}\n\n`
                  controller.enqueue(encoder.encode(statusEvent))
                }

                const functionResult = await runToolCall(toolCall)

                // Short-circuit for player props: if we already have a formatted response, return it without another model pass
                const formattedTools = new Set([
                  'get_player_props',
                  'get_betting_splits',
                  'analyze_game_splits',
                  'get_pick_guidance',
                  'analyze_bet_market',
                  'get_slate_edge_detection',
                  'get_live_betting_projection',
                ])

                if (
                  formattedTools.has(toolCall.function?.name) &&
                  functionResult &&
                  typeof functionResult === 'object' &&
                  'formatted' in functionResult &&
                  (functionResult as any).formatted
                ) {
                  lastText = (functionResult as any).formatted as string
                  skipModelResponse = true
                  toolCalls = []
                }

                const serializedResult =
                  typeof functionResult === 'string'
                    ? functionResult
                    : JSON.stringify(
                        functionResult ?? { success: false, error: 'Tool returned no result' }
                      ) || '{"success":false,"error":"Tool returned no result"}'

                openaiMessages.push({
                  role: 'tool',
                  content: serializedResult,
                  tool_call_id: toolCall.id,
                } as any)
              }

              if (skipModelResponse) {
                break
              }

              const followup = await openai.chat.completions.create(buildParams())
              lastText = extractText(followup.choices[0].message.content || followup.choices[0].message)
              toolCalls = followup.choices[0].message.tool_calls || []
            }

            // After all tools complete, send final content
            const finalText = lastText && lastText.trim().length > 0 ? lastText : 'Done.'
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: finalText })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()

            // Persist message to database
            try {
              if (finalText.trim().length > 0) {
                await supabase.from('messages').insert({
                  conversation_id: conversationId,
                  role: 'assistant',
                  content: finalText,
                })
              }

              const { count: messageCount } = await supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .eq('conversation_id', conversationId)

              if (messageCount === 2) {
                const title = await generateConversationTitle(message)
                await supabase
                  .from('conversations')
                  .update({ title })
                  .eq('id', conversationId)
              }
            } catch (persistError) {
              console.error('[CHAT] Failed to persist message/title:', persistError)
            }
          } catch (error) {
            console.error('[CHAT] Tool execution error:', error)
            controller.error(error)
          }
        },
      })

      return new Response(toolStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    // If GPT-5 and we already have odds tables, short-circuit to a deterministic reply to avoid streaming issues
    const hasOddsTables =
      typeof standardizedOddsTablesGlobal === 'string' &&
      standardizedOddsTablesGlobal.trim().length > 0 &&
      Array.isArray(formattedOddsGlobal) &&
      formattedOddsGlobal.length > 0
    if (chatModel.includes('gpt-5') && hasOddsTables) {
      const reply = buildDeterministicOddsReply()
      if (reply) return streamTextResponse(reply)
    }

    // For GPT-5 models, use non-streaming to avoid stream parsing issues
    if (chatModel.includes('gpt-5')) {
      const completion = await openai.chat.completions.create({
        model: chatModel,
        messages: openaiMessages,
        tools: ASSISTANT_TOOLS,
        temperature: undefined,
        max_completion_tokens: 1000,
      })

      const text = extractText(completion.choices[0]?.message?.content || completion.choices[0]?.message || '')
      const finalText = text && text.trim().length > 0 ? text : 'Done.'
      return streamTextResponse(finalText)
    }

    const stream = await openai.chat.completions.create({
      model: chatModel,
      messages: openaiMessages,
      tools: ASSISTANT_TOOLS,
      temperature: !chatModel.includes('gpt-5') ? 0.7 : undefined,
      max_completion_tokens: 1500,
      stream: true,
    })

    const encoder = new TextEncoder()
    let fullResponse = ''
    const startTime = Date.now()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Add keep-alive to prevent timeout
          const keepAliveInterval = setInterval(() => {
            try {
              controller.enqueue(encoder.encode(': keep-alive\n\n'))
            } catch (e) {
              clearInterval(keepAliveInterval)
            }
          }, 15000) // Send keep-alive every 15 seconds

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta
            const content = extractText((delta as any)?.content || (delta as any)?.output_text || delta)
            if (content && content.length) {
              fullResponse += content
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
            }
          }

          clearInterval(keepAliveInterval)

          const latencyMs = Date.now() - startTime
          console.log('[PERF][LLM][STREAM_MS]', latencyMs)
          if (fullResponse && fullResponse.trim().length > 0) {
            await supabase.from('messages').insert({
              conversation_id: conversationId,
              role: 'assistant',
              content: fullResponse,
            })
          }

          const { count: messageCount } = await supabase
            .from('messages')
            .select('*', { count: 'exact', head: true })
            .eq('conversation_id', conversationId)

          if (messageCount === 2) {
            const title = await generateConversationTitle(message)
            await supabase
              .from('conversations')
              .update({ title })
              .eq('id', conversationId)
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Streaming error occurred' })}\n\n`))
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          } catch (e) {
            // Controller already closed
          }
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}









