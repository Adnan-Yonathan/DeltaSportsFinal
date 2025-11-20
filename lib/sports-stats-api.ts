import Papa from 'papaparse'

// Comprehensive Sports Statistics API Integration
// Supports NBA, NFL, MLB, NHL - Player stats, team stats, advanced analytics, injuries

export interface PlayerStats {
  name: string
  team: string
  position?: string
  stats: Record<string, number | string>
  season?: string
}

export interface RosterPlayer {
  id: string
  name: string
  fullName: string
  team: string
  teamAbbr: string
  position: string
  jersey?: string
  height?: string
  weight?: string
  age?: number
  experience?: number
  status?: string // Active, Injured, Out
  headshot?: string
  stats?: Record<string, number | string> // Player statistics
}

export interface TeamStats {
  team: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string>
  rank?: number
}

export interface AdvancedTeamStats {
  team: string
  teamAbbr?: string
  pace?: number
  oRating?: number
  dRating?: number
  netRating?: number
  reboundPct?: number
  turnoverPct?: number
  tsPct?: number
  epaPerPlay?: number
  successRate?: number
  passRate?: number
  rushRate?: number
}

const NBA_API_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36',
  Referer: 'https://www.nba.com/',
  Origin: 'https://www.nba.com',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'x-nba-stats-origin': 'stats',
  'x-nba-stats-token': 'true',
}

const NFL_PLAYER_STATS_BASE =
  'https://github.com/nflverse/nflverse-data/releases/download/player_stats'

const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const getCurrentNBASeasonLabel = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const startYear = month >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  const nextYear = String(startYear + 1)
  return `${startYear}-${nextYear.slice(-2)}`
}

const getCurrentNFLSeasonYear = () => {
  const now = new Date()
  const month = now.getUTCMonth() // 0-11
  const year = now.getUTCFullYear()
  // Season starts in August/September; early months belong to previous year
  return month >= 6 ? year : year - 1
}

const fetchNBAJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { headers: NBA_API_HEADERS, cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`NBA stats request failed (${response.status})`)
  }
  return (await response.json()) as T
}

interface NBAPlayerDirectoryEntry {
  id: string
  name: string
  teamId: string | null
  teamName: string
  teamAbbr: string | null
}

const NBA_PLAYER_DIRECTORY_TTL = 1000 * 60 * 30
let nbaPlayerDirectoryCache:
  | {
      season: string
      timestamp: number
      entries: NBAPlayerDirectoryEntry[]
    }
  | null = null

const loadNBAPlayerDirectory = async (): Promise<NBAPlayerDirectoryEntry[]> => {
  const season = getCurrentNBASeasonLabel()
  const now = Date.now()
  if (nbaPlayerDirectoryCache && now - nbaPlayerDirectoryCache.timestamp < NBA_PLAYER_DIRECTORY_TTL) {
    if (nbaPlayerDirectoryCache.season === season) {
      return nbaPlayerDirectoryCache.entries
    }
  }

  try {
    const url = `https://stats.nba.com/stats/commonallplayers?IsOnlyCurrentSeason=1&LeagueID=00&Season=${encodeURIComponent(
      season
    )}`
    const data = await fetchNBAJson<any>(url)
    const set = data?.resultSets?.[0]
    const headers: string[] = set?.headers ?? []
    const rows: any[][] = set?.rowSet ?? []
    const idx = (field: string) => headers.indexOf(field)
    const idxPersonId = idx('PERSON_ID')
    const idxName = idx('DISPLAY_FIRST_LAST')
    const idxTeamId = idx('TEAM_ID')
    const idxTeamName = idx('TEAM_NAME')
    const idxTeamAbbr = idx('TEAM_ABBREVIATION')

    if (idxPersonId === -1 || idxName === -1) {
      throw new Error('NBA player directory missing expected columns')
    }

    const entries: NBAPlayerDirectoryEntry[] = rows.map((row) => ({
      id: String(row[idxPersonId]),
      name: String(row[idxName] ?? ''),
      teamId: idxTeamId !== -1 && row[idxTeamId] != null ? String(row[idxTeamId]) : null,
      teamName: idxTeamName !== -1 ? String(row[idxTeamName] ?? '') : '',
      teamAbbr: idxTeamAbbr !== -1 && row[idxTeamAbbr] ? String(row[idxTeamAbbr]) : null,
    }))

    nbaPlayerDirectoryCache = { season, timestamp: now, entries }
    return entries
  } catch (error) {
    console.error('Failed to load NBA player directory:', error)
    return nbaPlayerDirectoryCache?.entries ?? []
  }
}

const findNBAPlayerId = async (playerName: string, seasonLabel: string): Promise<string | null> => {
  const tryFetch = async (currentOnly: boolean) => {
    const url =
      `https://stats.nba.com/stats/commonallplayers?` +
      `IsOnlyCurrentSeason=${currentOnly ? 1 : 0}&LeagueID=00&Season=${encodeURIComponent(seasonLabel)}`
    const data = await fetchNBAJson<any>(url)
    const set = data.resultSets?.[0]
    if (!set) return null
    const headers: string[] = set.headers ?? []
    const rows: any[][] = set.rowSet ?? []
    const idxName = headers.indexOf('DISPLAY_FIRST_LAST')
    const idxPersonId = headers.indexOf('PERSON_ID')
    if (idxName === -1 || idxPersonId === -1) return null
    const target = normalizeName(playerName)
    for (const row of rows) {
      const name = typeof row[idxName] === 'string' ? normalizeName(row[idxName]) : ''
      if (name === target) {
        return String(row[idxPersonId])
      }
    }
    return null
  }

  const current = await tryFetch(true)
  if (current) return current
  return tryFetch(false)
}

const fetchNBAPlayerBaseStats = async (playerId: string, seasonLabel: string) => {
  const params = new URLSearchParams({
    LeagueID: '00',
    PerMode: 'PerGame',
    PlayerID: playerId,
    Season: seasonLabel,
    SeasonType: 'Regular Season',
  })
  const url = `https://stats.nba.com/stats/playerprofilev2?${params.toString()}`
  const data = await fetchNBAJson<any>(url)
  const totals = data.resultSets?.find((set: any) => set.name === 'SeasonTotalsRegularSeason')
  if (!totals) {
    return null
  }
  const headers: string[] = totals.headers ?? []
  const rows: any[][] = totals.rowSet ?? []
  const idxSeason = headers.indexOf('SEASON_ID')
  const idx = (field: string) => headers.indexOf(field)
  const row = rows.find((entry) => idxSeason !== -1 && entry[idxSeason] === seasonLabel)
  if (!row) {
    return null
  }
  const getNumber = (field: string) => {
    const column = idx(field)
    if (column === -1) return null
    const value = row[column]
    return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null
  }
  return {
    ppg: getNumber('PTS'),
    rpg: getNumber('REB'),
    apg: getNumber('AST'),
    fgPct: getNumber('FG_PCT'),
    threePct: getNumber('FG3_PCT'),
    ftPct: getNumber('FT_PCT'),
  }
}

const fetchNBAPlayerAdvancedStats = async (playerId: string, seasonLabel: string) => {
  const params = new URLSearchParams({
    DateFrom: '',
    DateTo: '',
    GameSegment: '',
    LastNGames: '0',
    LeagueID: '00',
    Location: '',
    MeasureType: 'Advanced',
    Month: '0',
    OpponentTeamID: '0',
    Outcome: '',
    PORound: '0',
    PaceAdjust: 'N',
    PerMode: 'PerGame',
    Period: '0',
    PlayerID: playerId,
    PlusMinus: 'N',
    Rank: 'N',
    Season: seasonLabel,
    SeasonSegment: '',
    SeasonType: 'Regular Season',
    ShotClockRange: '',
    Split: 'y',
    StartPeriod: '1',
    StarterBench: '',
    TeamID: '0',
    VsConference: '',
    VsDivision: '',
  })
  const url = `https://stats.nba.com/stats/playerdashboardbygeneralsplits?${params.toString()}`
  const data = await fetchNBAJson<any>(url)
  const totals = data.resultSets?.find((set: any) => set.name === 'OverallPlayerDashboard')
  if (!totals) return null
  const headers: string[] = totals.headers ?? []
  const row: any[] | undefined = totals.rowSet?.[0]
  if (!row) return null
  const idx = (field: string) => headers.indexOf(field)
  const pick = (field: string) => {
    const column = idx(field)
    if (column === -1) return null
    const value = row[column]
    return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : null
  }
  return {
    tsPct: pick('TS_PCT'),
    usgPct: pick('USG_PCT'),
    ortg: pick('OFF_RATING'),
    drtg: pick('DEF_RATING'),
    pie: pick('PIE'),
  }
}

export async function getNBAPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const seasonLabel = getCurrentNBASeasonLabel()
  const rosterEntry = await searchNBAPlayer(playerName)
  const nbaId = await findNBAPlayerId(rosterEntry?.fullName ?? playerName, seasonLabel)
  if (!nbaId) {
    return null
  }
  const [baseStats, advancedStats] = await Promise.all([
    fetchNBAPlayerBaseStats(nbaId, seasonLabel),
    fetchNBAPlayerAdvancedStats(nbaId, seasonLabel),
  ])
  if (!baseStats) {
    return null
  }

  const stats: Record<string, number | string> = {
    PPG: Number(baseStats.ppg?.toFixed(1) ?? 0),
    RPG: Number(baseStats.rpg?.toFixed(1) ?? 0),
    APG: Number(baseStats.apg?.toFixed(1) ?? 0),
    FG_PERCENT: Number(((baseStats.fgPct ?? 0) * 100).toFixed(1)),
    THREE_PERCENT: Number(((baseStats.threePct ?? 0) * 100).toFixed(1)),
    FT_PERCENT: Number(((baseStats.ftPct ?? 0) * 100).toFixed(1)),
  }

  if (advancedStats) {
    stats.TS_PERCENT = Number(((advancedStats.tsPct ?? 0) * 100).toFixed(1))
    stats.USG_PERCENT = Number(((advancedStats.usgPct ?? 0) * 100).toFixed(1))
    stats.OFF_RATING = Number((advancedStats.ortg ?? 0).toFixed(1))
    stats.DEF_RATING = Number((advancedStats.drtg ?? 0).toFixed(1))
    if (advancedStats.pie != null) {
      stats.PER = Number((advancedStats.pie * 30).toFixed(1))
    }
  }

  return {
    name: rosterEntry?.fullName ?? playerName,
    team: rosterEntry?.team ?? '',
    position: rosterEntry?.position,
    season: seasonLabel,
    stats,
  }
}

export async function getNFLPlayerSeasonStats(playerName: string): Promise<PlayerStats | null> {
  const rosterEntry = await searchNFLPlayer(playerName)
  if (!rosterEntry) {
    return null
  }
  const seasonYear = getCurrentNFLSeasonYear()
  const [baseStats, csvData] = await Promise.all([
    fetchNFLPlayerBaseStats(rosterEntry.id, seasonYear),
    loadNFLPlayerSeasonRows(rosterEntry.fullName, seasonYear),
  ])

  if (!baseStats && !csvData) {
    return null
  }

  const stats: Record<string, number | string> = {}
  if (baseStats) {
    stats.PASSING_YARDS = baseStats.passingYards ?? 0
    stats.PASSING_TDS = baseStats.passingTouchdowns ?? 0
    stats.INTERCEPTIONS = baseStats.passingInterceptions ?? 0
    stats.COMPLETIONS = baseStats.completions ?? 0
    stats.ATTEMPTS = baseStats.passingAttempts ?? 0
    stats.RUSHING_YARDS = baseStats.rushingYards ?? 0
    stats.RUSHING_TDS = baseStats.rushingTouchdowns ?? 0
    stats.RUSHING_ATTEMPTS = baseStats.rushingAttempts ?? 0
    if ((baseStats.receptions ?? 0) > 0) {
      stats.RECEPTIONS = baseStats.receptions ?? 0
      stats.RECEIVING_YARDS = baseStats.receivingYards ?? 0
      stats.RECEIVING_TDS = baseStats.receivingTouchdowns ?? 0
      stats.TARGETS = baseStats.targets ?? 0
    }
  }

  if (csvData && csvData.rows.length) {
    let passingEPA = 0
    let rushingEPA = 0
    let receivingEPA = 0
    let passAttempts = 0
    let rushAttempts = 0
    let targets = 0

    for (const row of csvData.rows) {
      passingEPA += Number(row.passing_epa ?? 0)
      rushingEPA += Number(row.rushing_epa ?? 0)
      receivingEPA += Number(row.receiving_epa ?? 0)
      passAttempts += Number(row.attempts ?? 0)
      rushAttempts += Number(row.carries ?? 0)
      targets += Number(row.targets ?? 0)
    }

    const totalPlays = passAttempts + rushAttempts + targets
    const totalEPA = passingEPA + rushingEPA + receivingEPA
    stats.EPA_TOTAL = Number(totalEPA.toFixed(2))
    if (totalPlays > 0) {
      stats.EPA_PER_PLAY = Number((totalEPA / totalPlays).toFixed(3))
    }
  }

  return {
    name: rosterEntry.fullName,
    team: rosterEntry.team,
    position: rosterEntry.position,
    season: String(baseStats?.season ?? csvData?.season ?? seasonYear),
    stats,
  }
}

const fetchNFLPlayerBaseStats = async (playerId: string, seasonYear: number) => {
  const trySeason = async (year: number) => {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/types/2/athletes/${playerId}/statistics?lang=en&region=us`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const data = await response.json()
    const stats = data.splits?.categories?.flatMap((cat: any) => cat.stats) ?? []
    const pick = (name: string) => {
      const entry = stats.find((stat: any) => stat.name === name)
      return entry?.value ?? null
    }
    return {
      season: year,
      passingYards: pick('passingYards'),
      passingTouchdowns: pick('passingTouchdowns'),
      passingInterceptions: pick('interceptions'),
      passingAttempts: pick('passingAttempts'),
      completions: pick('completions'),
      rushingYards: pick('rushingYards'),
      rushingTouchdowns: pick('rushingTouchdowns'),
      rushingAttempts: pick('rushingAttempts'),
      receptions: pick('receptions'),
      receivingYards: pick('receivingYards'),
      receivingTouchdowns: pick('receivingTouchdowns'),
      targets: pick('receivingTargets'),
    }
  }

  const primary = await trySeason(seasonYear)
  if (primary) return primary
  return trySeason(seasonYear - 1)
}

const loadNFLPlayerSeasonRows = async (playerName: string, seasonYear: number) => {
  const tryLoad = async (year: number) => {
    const url = `${NFL_PLAYER_STATS_BASE}/player_stats_${year}.csv`
    const response = await fetch(url, { cache: 'no-store' })
    if (!response.ok) {
      return null
    }
    const text = await response.text()
    const parsed = Papa.parse<Record<string, string | number>>(text, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
    })
    const rows = (parsed.data || []).filter(
      (row) =>
        Number(row.season) === year &&
        String(row.season_type).toUpperCase() === 'REG' &&
        normalizeName(String(row.player_display_name ?? row.player_name ?? '')) === normalizeName(playerName)
    )
    return { rows, season: year }
  }

  const primary = await tryLoad(seasonYear)
  if (primary && primary.rows.length) return primary
  return tryLoad(seasonYear - 1)
}

export interface InjuryReport {
  player: string
  team: string
  status: string // Out, Questionable, Doubtful, Day-to-Day
  injury?: string
  date?: string
}

export interface GameStats {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeStats?: TeamStats
  awayStats?: TeamStats
  topPlayers?: PlayerStats[]
}

// ==================== NBA STATS (via ESPN) ====================

export async function getNBATeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    // Use standings API which has current, accurate records
    const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    // Parse both Eastern and Western conferences
    if (data.children) {
      for (const conference of data.children) {
        const entries = conference.standings?.entries || []

        for (const entry of entries) {
          const team = entry.team
          if (teamAbbr && team.abbreviation !== teamAbbr) continue

          // Extract stats from the stats array
          const statsArray = entry.stats || []
          const wins = statsArray.find((s: any) => s.name === 'wins')?.value || 0
          const losses = statsArray.find((s: any) => s.name === 'losses')?.value || 0
          const winPct = statsArray.find((s: any) => s.name === 'winPercent')?.value || 0
          const streak = statsArray.find((s: any) => s.name === 'streak')?.displayValue || ''
          const gamesPlayed = wins + losses

          teams.push({
            team: team.displayName,
            wins,
            losses,
            winPct,
            stats: {
              gamesPlayed,
              streak,
            },
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NBA team stats:', error)
    return []
  }
}

export async function getNBAPlayerStats(playerName?: string): Promise<PlayerStats[]> {
  try {
    // ESPN doesn't have a clean player stats endpoint without player ID
    // For now, we'll return empty and enhance this later with search
    return []
  } catch (error) {
    console.error('Error fetching NBA player stats:', error)
    return []
  }
}

// Advanced NBA team stats via stats.nba.com (unofficial; requires headers)
export async function getNBAAdvancedTeamStats(): Promise<AdvancedTeamStats[]> {
  try {
    const season = (() => {
      const now = new Date()
      const year = now.getFullYear()
      // NBA season spans years; before August, use prior season start
      const seasonStart = now.getMonth() >= 8 ? year : year - 1
      return `${seasonStart}-${(seasonStart + 1).toString().slice(-2)}`
    })()

    const url =
      `https://stats.nba.com/stats/leaguedashteamstats` +
      `?MeasureType=Advanced&PerMode=PerGame&PlusMinus=N&PaceAdjust=N&Rank=N&` +
      `Season=${encodeURIComponent(season)}&SeasonType=Regular%20Season`

    const response = await fetch(url, {
      // stats.nba.com expects a browser-like client
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0 Safari/537.36',
        Referer: 'https://www.nba.com/',
        Origin: 'https://www.nba.com',
        Accept: '*/*',
      },
      // prune cache to avoid stale; endpoints are near-real-time
      next: { revalidate: 900 },
    })

    if (!response.ok) {
      console.warn('NBA advanced stats fetch failed:', response.statusText)
      return []
    }

    const data = await response.json()
    const headersArr: string[] = data?.resultSets?.[0]?.headers || []
    const rows: any[] = data?.resultSets?.[0]?.rowSet || []

    const idx = (key: string) => headersArr.indexOf(key)

    return rows.map((r) => ({
      team: r[idx('TEAM_NAME')],
      teamAbbr: r[idx('TEAM_ABBREVIATION')],
      pace: r[idx('PACE')],
      oRating: r[idx('OFF_RATING')],
      dRating: r[idx('DEF_RATING')],
      netRating: r[idx('NET_RATING')],
      reboundPct: r[idx('REB_PCT')],
      turnoverPct: r[idx('TM_TOV_PCT')],
      tsPct: r[idx('TS_PCT')],
    }))
  } catch (error) {
    console.error('Error fetching NBA advanced team stats:', error)
    return []
  }
}

// ==================== NFL ADVANCED STATS (via nflfastR CSV) ====================

/**
 * Fetch team-level advanced metrics (EPA/Play, success rate, pass/run rate) from nflfastR public CSV.
 * Uses season summary file to avoid pulling full play-by-play.
 */
export async function getNFLAdvancedTeamStats(): Promise<AdvancedTeamStats[]> {
  try {
    const season = new Date().getFullYear()
    const csvUrl = `https://raw.githubusercontent.com/guga31bb/nflfastR-data/master/data/seasons/` +
      `team_stats_${season}.csv`

    const response = await fetch(csvUrl, { cache: 'no-store' })
    if (!response.ok) {
      console.warn('NFL advanced stats fetch failed:', response.statusText)
      return []
    }

    const csvText = await response.text()
    const lines = csvText.split('\n').filter(Boolean)
    const header = lines.shift()
    if (!header) return []

    const cols = header.split(',')
    const colIdx = (key: string) => cols.indexOf(key)

    const requiredCols = ['posteam', 'epa_play', 'success_rate', 'pass_rate', 'rush_rate']
    if (!requiredCols.every((c) => colIdx(c) !== -1)) {
      console.warn('NFL advanced stats missing required columns')
      return []
    }

    const results: AdvancedTeamStats[] = lines.map((line) => {
      const parts = line.split(',')
      return {
        team: parts[colIdx('posteam')],
        teamAbbr: parts[colIdx('posteam')],
        epaPerPlay: parseFloat(parts[colIdx('epa_play')]),
        successRate: parseFloat(parts[colIdx('success_rate')]),
        passRate: parseFloat(parts[colIdx('pass_rate')]),
        rushRate: parseFloat(parts[colIdx('rush_rate')]),
      }
    })

    return results
  } catch (error) {
    console.error('Error fetching NFL advanced team stats:', error)
    return []
  }
}

export async function getNBAInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
    const response = await fetch(url, { next: { revalidate: 1800 } })

    if (!response.ok) return []

    const data = await response.json()
    const injuries: InjuryReport[] = []

    if (data.teams) {
      for (const teamData of data.teams) {
        const team = teamData.team?.displayName || 'Unknown'

        if (teamData.injuries) {
          for (const injury of teamData.injuries) {
            injuries.push({
              player: injury.athlete?.displayName || 'Unknown',
              team,
              status: injury.status || 'Unknown',
              injury: injury.details?.type || injury.longComment,
              date: injury.date,
            })
          }
        }
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NBA injuries:', error)
    return []
  }
}

export async function getNBARoster(teamAbbr?: string): Promise<RosterPlayer[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const roster: RosterPlayer[] = []

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamObj of data.sports[0].leagues[0].teams) {
        const team = teamObj.team
        if (teamAbbr && team.abbreviation !== teamAbbr) continue

        // Fetch detailed roster for this team
        try {
          const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
          const rosterResponse = await fetch(rosterUrl, { next: { revalidate: 3600 } })

          if (rosterResponse.ok) {
            const rosterData = await rosterResponse.json()

            // ESPN roster structure: athletes is a direct array
            if (rosterData.athletes && Array.isArray(rosterData.athletes)) {
              for (const athlete of rosterData.athletes) {
                roster.push({
                  id: athlete.id,
                  name: athlete.displayName || athlete.fullName,
                  fullName: athlete.fullName || athlete.displayName,
                  team: team.displayName,
                  teamAbbr: team.abbreviation,
                  position: athlete.position?.abbreviation || athlete.position?.displayName || 'N/A',
                  jersey: athlete.jersey,
                  height: athlete.displayHeight,
                  weight: athlete.displayWeight,
                  age: athlete.age,
                  experience: athlete.experience?.years,
                  status: athlete.injuries && athlete.injuries.length > 0 ? 'Injured' : (athlete.status?.type || 'Active'),
                  headshot: athlete.headshot?.href
                })
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching roster for ${team.displayName}:`, err)
        }
      }
    }

    return roster
  } catch (error) {
    console.error('Error fetching NBA rosters:', error)
    return []
  }
}

export async function searchNBAPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const directory = await loadNBAPlayerDirectory()
    const normalized = normalizeName(playerName)

    const dirMatch =
      directory.find((entry) => normalizeName(entry.name) === normalized) ||
      directory.find((entry) => normalizeName(entry.name).includes(normalized))

    if (dirMatch && dirMatch.teamAbbr) {
      const teamPlayers = await getNBARoster(dirMatch.teamAbbr)
      const exactMatch =
        teamPlayers.find((player) => normalizeName(player.fullName) === normalized) ||
        teamPlayers.find((player) => normalizeName(player.name).includes(normalized))
      if (exactMatch) {
        return exactMatch
      }
    }

    const allPlayers = await getNBARoster()
    return (
      allPlayers.find(
        (p) => normalizeName(p.fullName) === normalized || normalizeName(p.name) === normalized
      ) ||
      allPlayers.find(
        (p) => normalizeName(p.fullName).includes(normalized) || normalizeName(p.name).includes(normalized)
      ) ||
      null
    )
  } catch (error) {
    console.error('Error searching for NBA player:', error)
    return null
  }
}

export async function getNFLRoster(teamAbbr?: string): Promise<RosterPlayer[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })
    if (!response.ok) return []
    const data = await response.json()
    const roster: RosterPlayer[] = []
    const teams = data.sports?.[0]?.leagues?.[0]?.teams ?? []
    for (const entry of teams) {
      const team = entry.team
      if (!team) continue
      if (teamAbbr && team.abbreviation !== teamAbbr) continue
      try {
        const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${team.id}/roster`
        const rosterResponse = await fetch(rosterUrl, { next: { revalidate: 3600 } })
        if (!rosterResponse.ok) continue
        const rosterData = await rosterResponse.json()
        const groups = rosterData.athletes ?? []
        for (const group of groups) {
          const athletes = group.items ?? []
          for (const athlete of athletes) {
            roster.push({
              id: athlete.id,
              name: athlete.displayName || athlete.fullName,
              fullName: athlete.fullName || athlete.displayName,
              team: team.displayName,
              teamAbbr: team.abbreviation,
              position: athlete.position?.abbreviation || athlete.position?.name || 'N/A',
              jersey: athlete.jersey,
              height: athlete.displayHeight,
              weight: athlete.displayWeight,
              age: athlete.age,
              experience: athlete.experience?.years,
              status: athlete.status?.type ?? 'Active',
              headshot: athlete.headshot?.href,
            })
          }
        }
      } catch (error) {
        console.error(`Error fetching roster for ${team.displayName}:`, error)
      }
    }
    return roster
  } catch (error) {
    console.error('Error fetching NFL rosters:', error)
    return []
  }
}

export async function searchNFLPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const roster = await getNFLRoster()
    const target = normalizeName(playerName)
    let found =
      roster.find((player) => normalizeName(player.fullName) === target) ??
      roster.find((player) => normalizeName(player.name).includes(target))
    return found || null
  } catch (error) {
    console.error('Error searching for NFL player:', error)
    return null
  }
}

// ==================== NFL STATS (via ESPN) ====================

export async function getNFLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamObj of data.sports[0].leagues[0].teams) {
        const team = teamObj.team
        if (teamAbbr && team.abbreviation !== teamAbbr) continue

        teams.push({
          team: team.displayName,
          wins: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || 0,
          losses: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || 0,
          winPct: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'winPercent')?.value || 0,
          stats: {
            gamesPlayed: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'gamesPlayed')?.value || 0,
            pointsFor: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsFor')?.value || 0,
            pointsAgainst: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsAgainst')?.value || 0,
            streak: team.record?.items?.[0]?.summary || '',
          },
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NFL team stats:', error)
    return []
  }
}

export async function getNFLInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'
    // Disable Next.js caching - response is 8.4MB, exceeds 2MB cache limit
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) return []

    const data = await response.json()
    const injuries: InjuryReport[] = []

    if (data.teams) {
      for (const teamData of data.teams) {
        const team = teamData.team?.displayName || 'Unknown'

        if (teamData.injuries) {
          for (const injury of teamData.injuries) {
            injuries.push({
              player: injury.athlete?.displayName || 'Unknown',
              team,
              status: injury.status || 'Unknown',
              injury: injury.details?.type || injury.longComment,
              date: injury.date,
            })
          }
        }
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NFL injuries:', error)
    return []
  }
}

// ==================== MLB STATS (Official API) ====================

export async function getMLBTeamStats(teamId?: number): Promise<TeamStats[]> {
  try {
    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.records) {
      for (const division of data.records) {
        for (const team of division.teamRecords) {
          if (teamId && team.team.id !== teamId) continue

          teams.push({
            team: team.team.name,
            wins: team.wins,
            losses: team.losses,
            winPct: parseFloat(team.leagueRecord?.pct || '0'),
            stats: {
              gamesPlayed: team.gamesPlayed,
              streak: team.streak?.streakCode || '',
              runsScored: team.runsScored || 0,
              runsAllowed: team.runsAllowed || 0,
              divisionRank: team.divisionRank,
            },
            rank: team.divisionRank,
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching MLB team stats:', error)
    return []
  }
}

export async function getMLBPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
    if (!playerId) return []

    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${season}&group=hitting,pitching`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.stats) {
      for (const statGroup of data.stats) {
        const splits = statGroup.splits?.[0]
        if (splits) {
          players.push({
            name: data.people?.[0]?.fullName || 'Unknown',
            team: splits.team?.name || 'Unknown',
            position: data.people?.[0]?.primaryPosition?.abbreviation,
            stats: splits.stat || {},
            season: splits.season,
          })
        }
      }
    }

    return players
  } catch (error) {
    console.error('Error fetching MLB player stats:', error)
    return []
  }
}

// ==================== NHL STATS (Official API) ====================

export async function getNHLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://api-web.nhle.com/v1/standings/now'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.standings) {
      for (const team of data.standings) {
        if (teamAbbr && team.teamAbbrev?.default !== teamAbbr) continue

        teams.push({
          team: team.teamName?.default || team.teamAbbrev?.default,
          wins: team.wins || 0,
          losses: team.losses || 0,
          winPct: team.pointPctg || 0,
          stats: {
            gamesPlayed: team.gamesPlayed || 0,
            points: team.points || 0,
            goalsFor: team.goalFor || 0,
            goalsAgainst: team.goalAgainst || 0,
            goalDifferential: team.goalDifferential || 0,
            overtimeLosses: team.otLosses || 0,
            streak: team.streakCode || '',
          },
          rank: team.leagueSequence,
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NHL team stats:', error)
    return []
  }
}

export async function getNHLPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
    if (!playerId) return []

    const season = `${new Date().getFullYear() - 1}${new Date().getFullYear()}`
    const url = `https://api-web.nhle.com/v1/player/${playerId}/landing`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.featuredStats?.regularSeason?.subSeason) {
      players.push({
        name: `${data.firstName?.default} ${data.lastName?.default}`,
        team: data.currentTeamAbbrev || 'Unknown',
        position: data.position,
        stats: data.featuredStats.regularSeason.subSeason,
        season,
      })
    }

    return players
  } catch (error) {
    console.error('Error fetching NHL player stats:', error)
    return []
  }
}

// ==================== UNIFIED FUNCTIONS ====================

export async function getTeamStats(sport: string, teamIdentifier?: string): Promise<TeamStats[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      {
        const [basic, advanced] = await Promise.all([
          getNBATeamStats(teamIdentifier),
          getNBAAdvancedTeamStats(),
        ])
        return basic.map((teamEntry) => {
          const adv = advanced.find(
            (candidate) => normalizeName(candidate.team) === normalizeName(teamEntry.team)
          )
          if (adv) {
            const extras: Record<string, number> = {}
            if (adv.pace != null) extras.pace = adv.pace
            if (adv.oRating != null) extras.offensiveRating = adv.oRating
            if (adv.dRating != null) extras.defensiveRating = adv.dRating
            if (adv.netRating != null) extras.netRating = adv.netRating
            if (adv.tsPct != null) extras.trueShootingPct = adv.tsPct
            if (adv.turnoverPct != null) extras.turnoverPct = adv.turnoverPct
            teamEntry.stats = {
              ...teamEntry.stats,
              ...extras,
            }
          }
          return teamEntry
        })
      }
    case 'nfl':
    case 'americanfootball_nfl':
      {
        const [basic, advanced] = await Promise.all([
          getNFLTeamStats(teamIdentifier),
          getNFLAdvancedTeamStats(),
        ])
        return basic.map((teamEntry) => {
          const adv = advanced.find(
            (candidate) => normalizeName(candidate.team) === normalizeName(teamEntry.team)
          )
          if (adv) {
            const extras: Record<string, number> = {}
            if (adv.epaPerPlay != null) extras.epaPerPlay = adv.epaPerPlay
            if (adv.successRate != null) extras.successRate = adv.successRate
            if (adv.passRate != null) extras.passRate = adv.passRate
            if (adv.rushRate != null) extras.rushRate = adv.rushRate
            teamEntry.stats = {
              ...teamEntry.stats,
              ...extras,
            }
          }
          return teamEntry
        })
      }
    case 'mlb':
    case 'baseball_mlb':
      return getMLBTeamStats(teamIdentifier ? parseInt(teamIdentifier) : undefined)
    case 'nhl':
    case 'icehockey_nhl':
      return getNHLTeamStats(teamIdentifier)
    default:
      return []
  }
}

export async function getInjuryReports(sport: string): Promise<InjuryReport[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBAInjuries()
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLInjuries()
    default:
      return []
  }
}

export async function getAllInjuries(): Promise<{ sport: string; injuries: InjuryReport[] }[]> {
  const [nbaInjuries, nflInjuries] = await Promise.all([
    getNBAInjuries(),
    getNFLInjuries(),
  ])

  return [
    { sport: 'NBA', injuries: nbaInjuries },
    { sport: 'NFL', injuries: nflInjuries },
  ]
}

export async function searchPlayer(playerName: string, sport?: string): Promise<RosterPlayer | null> {
  try {
    // If sport specified, search only that sport
    if (sport) {
      switch (sport.toLowerCase()) {
        case 'nba':
        case 'basketball_nba':
          return await searchNBAPlayer(playerName)
        case 'nfl':
        case 'americanfootball_nfl':
          return await searchNFLPlayer(playerName)
        default:
          return null
      }
    }

    // Otherwise search NBA (can expand to other sports later)
    return await searchNBAPlayer(playerName)
  } catch (error) {
    console.error('Error searching for player:', error)
    return null
  }
}

export async function getRoster(sport: string, teamAbbr?: string): Promise<RosterPlayer[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBARoster(teamAbbr)
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLRoster(teamAbbr)
    default:
      return []
  }
}

// Helper to format stats for AI consumption
export function formatStatsForAI(stats: TeamStats[] | PlayerStats[] | InjuryReport[]): string {
  if (stats.length === 0) return 'No stats available'

  if ('injury' in stats[0]) {
    // Injury reports
    const injuries = stats as InjuryReport[]
    return injuries.map(i =>
      `${i.player} (${i.team}) - ${i.status}${i.injury ? ': ' + i.injury : ''}`
    ).join('\n')
  } else if ('position' in stats[0]) {
    // Player stats
    const players = stats as PlayerStats[]
    return players.map(p =>
      `${p.name} (${p.team}${p.position ? ', ' + p.position : ''}):\n${JSON.stringify(p.stats, null, 2)}`
    ).join('\n\n')
  } else {
    // Team stats
    const teams = stats as TeamStats[]
    return teams.map(t =>
      `${t.team}: ${t.wins}-${t.losses} (${(t.winPct * 100).toFixed(1)}%)\n${JSON.stringify(t.stats, null, 2)}`
    ).join('\n\n')
  }
}
