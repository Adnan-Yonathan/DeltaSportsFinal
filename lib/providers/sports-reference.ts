export type ReferencePlayerStats = {
  name: string
  team?: string
  position?: string
  season?: string
  stats: Record<string, number | string>
  sport?: string
}

export type ReferenceTeamStats = {
  team: string
  wins?: number
  losses?: number
  winPct?: number
  stats: Record<string, number | string | null>
  sport?: string
  season?: string
}

export type ReferenceGameLog = {
  date: string
  opponentAbbr?: string
  isHome?: boolean
  stats: Record<string, number>
}

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const NBA_TEAM_STATS_CACHE_TTL = 1000 * 60 * 60 * 6
const NBA_TEAM_STATS_FAILURE_COOLDOWN = 1000 * 60 * 5
let nbaTeamStatsCache:
  | { ts: number; season: number; data: ReferenceTeamStats[] }
  | null = null
let nbaTeamStatsFailureTs: number | null = null

const stripComments = (html: string) => html.replace(/<!--/g, '').replace(/-->/g, '')

const NFL_TEAM_STATS_CACHE_TTL = 1000 * 60 * 30 // 30 minutes
let nflTeamStatsCache: {
  ts: number
  season: number
  data: ReferenceTeamStats[]
} | null = null

type SearchConfig = {
  url: (query: string) => string
  base: string
  linkPattern: RegExp
  indexUrl?: (letter: string) => string
  indexLinkPattern?: RegExp
}

const SEARCH_ENDPOINTS: Record<string, SearchConfig> = {
  basketball_nba: {
    url: (q) => `https://www.basketball-reference.com/players/?search=${encodeURIComponent(q)}`,
    base: 'https://www.basketball-reference.com',
    linkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.html)"[^>]*>(.*?)<\/a>/gi,
    indexUrl: (letter) => `https://www.basketball-reference.com/players/${letter}/`,
    indexLinkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.html)"[^>]*>(.*?)<\/a>/gi,
  },
  basketball_ncaab: {
    url: (q) => `https://www.sports-reference.com/cbb/players/?search=${encodeURIComponent(q)}`,
    base: 'https://www.sports-reference.com',
    linkPattern: /href="(\/cbb\/players\/[a-z0-9-]+\.html)"[^>]*>(.*?)<\/a>/gi,
  },
  americanfootball_nfl: {
    url: (q) => `https://www.pro-football-reference.com/search/search.fcgi?search=${encodeURIComponent(q)}`,
    base: 'https://www.pro-football-reference.com',
    linkPattern: /href="(\/players\/[A-Za-z]\/[A-Za-z0-9]+\.htm)"[^>]*>(.*?)<\/a>/gi,
  },
  americanfootball_ncaaf: {
    url: (q) => `https://www.sports-reference.com/cfb/search/search.fcgi?search=${encodeURIComponent(q)}`,
    base: 'https://www.sports-reference.com',
    linkPattern: /href="(\/cfb\/players\/[a-z0-9-]+\.html)"[^>]*>(.*?)<\/a>/gi,
  },
  baseball_mlb: {
    url: (q) => `https://www.baseball-reference.com/search/search.fcgi?search=${encodeURIComponent(q)}`,
    base: 'https://www.baseball-reference.com',
    linkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"[^>]*>(.*?)<\/a>/gi,
    indexUrl: (letter) => `https://www.baseball-reference.com/players/${letter}/`,
    indexLinkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.shtml)"[^>]*>(.*?)<\/a>/gi,
  },
  icehockey_nhl: {
    url: (q) => `https://www.hockey-reference.com/search/search.fcgi?search=${encodeURIComponent(q)}`,
    base: 'https://www.hockey-reference.com',
    linkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.html)"[^>]*>(.*?)<\/a>/gi,
    indexUrl: (letter) => `https://www.hockey-reference.com/players/${letter}/`,
    indexLinkPattern: /href="(\/players\/[a-z]\/[a-z0-9]+\.html)"[^>]*>(.*?)<\/a>/gi,
  },
}

const fetchHtml = async (url: string): Promise<string | null> => {
  const base = new URL(url).origin
  const headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    Accept:
      'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    Referer: `${base}/`,
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
  }

  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
  const backoffSchedule = [2000, 5000, 10000]

  for (let attempt = 0; attempt < backoffSchedule.length; attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)
    let res: Response

    try {
      res = await fetch(url, {
        cache: 'no-store',
        headers,
        redirect: 'follow',
        signal: controller.signal,
      })
    } catch {
      clearTimeout(timeout)
      await sleep(backoffSchedule[attempt])
      continue
    }
    clearTimeout(timeout)

    if (res.status === 429 || res.status === 503) {
      const retryAfter = Number(res.headers.get('retry-after'))
      const backoffMs = Number.isFinite(retryAfter)
        ? Math.min(retryAfter * 1000, 15000)
        : backoffSchedule[attempt]
      await sleep(backoffMs)
      continue
    }

    if (!res.ok) return null
    const html = await res.text()
    return stripComments(html)
  }

  return null
}

const resolvePlayerUrl = async (sportKey: string, query: string): Promise<string | null> => {
  const cfg = SEARCH_ENDPOINTS[sportKey]
  if (!cfg) return null
  const target = normalizeName(query)

  // Prefer deterministic letter index when available
  if (cfg.indexUrl && cfg.indexLinkPattern) {
    const parts = query.trim().split(/\s+/)
    const last = parts[parts.length - 1] || query
    const letter = normalizeName(last)[0] || 'a'
    const indexHtml = await fetchHtml(cfg.indexUrl(letter))
    if (indexHtml) {
      for (const m of indexHtml.matchAll(cfg.indexLinkPattern)) {
        const href = m[1]
        const text = (m[2] || '').replace(/<[^>]+>/g, '').trim()
        const norm = normalizeName(text)
        if (norm === target || norm.includes(target) || target.includes(norm)) {
          return cfg.base + href
        }
      }
    }
  }

  const html = await fetchHtml(cfg.url(query))
  if (!html) return null
  let best: string | null = null
  for (const m of html.matchAll(cfg.linkPattern)) {
    const href = m[1]
    const text = (m[2] || '').replace(/<[^>]+>/g, '').trim()
    const norm = normalizeName(text)
    const slugNorm = normalizeName(href.split('/').pop() || '')
    if (slugNorm.includes(target) || target.includes(slugNorm)) return cfg.base + href
    if (norm === target) {
      return cfg.base + href
    }
    if (!best && norm.includes(target)) best = cfg.base + href
    if (!best && target.includes(norm)) best = cfg.base + href
    if (!best) best = cfg.base + href
  }
  return best
}

const extractRows = (tableHtml: string, idPrefix: string) => {
  const rows: Array<{ year: number; row: string }> = []
  const regex = new RegExp(`<tr[^>]+id="${idPrefix}[\\w.-]*?(\\d{4})"[^>]*>([\\s\\S]*?)<\\/tr>`, 'g')
  for (const m of tableHtml.matchAll(regex)) {
    rows.push({ year: Number(m[1]), row: m[0] })
  }
  return rows
}

const extractTable = (html: string, id: string) => {
  const re = new RegExp(`<table[^>]+id="${id}"[\\s\\S]*?<\\/table>`, 'i')
  const match = html.match(re)
  return match ? match[0] : null
}

const extractTableBySection = (html: string, sectionId: string) => {
  const marker = `div_${sectionId}`
  const start = html.indexOf(marker)
  if (start === -1) return null
  const tableStart = html.indexOf('<table', start)
  if (tableStart === -1) return null
  const tableEnd = html.indexOf('</table>', tableStart)
  if (tableEnd === -1) return null
  return html.slice(tableStart, tableEnd + 8)
}

const extractTeamRows = (tableHtml: string) =>
  Array.from(
    tableHtml.matchAll(
      /<tr[^>]*>[\s\S]*?<t[hd][^>]*data-stat="team"[^>]*>[\s\S]*?<\/tr>/gi      
    )
  ).map((m) => m[0])

const extractGameRows = (tableHtml: string) =>
  Array.from(
    tableHtml.matchAll(/<tr[^>]*>[\s\S]*?<t[hd][^>]*data-stat="date_game"[^>]*>/gi)
  ).map((m) => m[0])

const pickStat = (rowHtml: string, key: string) => {
  const re = new RegExp(`data-stat="${key}"[^>]*>([\\s\\S]*?)(?:<\\/t[dh]>)`, 'i')
  const m = rowHtml.match(re)
  if (!m) return null
  const raw = m[1].replace(/<[^>]+>/g, '').trim().replace(/,/g, '')
  if (raw === '') return null
  const num = Number(raw)
  return Number.isFinite(num) ? num : raw
}

const parseBasketballPlayer = (html: string, sport: string, name: string): ReferencePlayerStats | null => {
  const perGameTable = extractTable(html, 'per_game_stats') || extractTable(html, 'per_game')
  if (!perGameTable) return null
  const rows = extractRows(perGameTable, 'per_game')
  if (!rows.length) return null
  rows.sort((a, b) => a.year - b.year)
  const latest = rows[rows.length - 1]
  const season = pickStat(latest.row, 'year_id') as string | null
  const team = pickStat(latest.row, 'team_id') || pickStat(latest.row, 'team_name_abbr')
  const stats: Record<string, number | string> = {}
  const mapKeys: Record<string, string> = {
    pts_per_g: 'PTS',
    trb_per_g: 'REB',
    ast_per_g: 'AST',
    stl_per_g: 'STL',
    blk_per_g: 'BLK',
    fg_pct: 'FG_PCT',
    fg3_per_g: 'FG3M',
    fg3a_per_g: 'FG3A',
    fg3_pct: 'FG3_PCT',
    fta_per_g: 'FTA',
    ft_pct: 'FT_PCT',
  }
  for (const [src, dest] of Object.entries(mapKeys)) {
    const val = pickStat(latest.row, src)
    if (val != null) stats[dest] = val
  }

  const advancedTable = extractTable(html, 'advanced') || extractTable(html, 'advanced_stats')
  if (advancedTable) {
    const advancedRows = extractRows(advancedTable, 'advanced')
    if (advancedRows.length) {
      advancedRows.sort((a, b) => a.year - b.year)
      const adv = advancedRows[advancedRows.length - 1]
      const ts = pickStat(adv.row, 'ts_pct')
      if (ts != null) stats.TS_PCT = ts
      const usg = pickStat(adv.row, 'usg_pct')
      if (usg != null) stats.USG_PCT = usg
      const ortg = pickStat(adv.row, 'off_rtg')
      const drtg = pickStat(adv.row, 'def_rtg')
      if (ortg != null) stats.OFF_RTG = ortg
      if (drtg != null) stats.DEF_RTG = drtg
    }
  }

  return {
    name,
    team: typeof team === 'string' ? team : undefined,
    season: typeof season === 'string' ? season : String(latest.year),
    stats,
    sport,
  }
}

const parseBasketballReferenceGameLogs = (html: string): ReferenceGameLog[] => {
  const table = extractTable(html, 'pgl_basic')
  if (!table) return []
  const rows = extractGameRows(table)
  const logs: ReferenceGameLog[] = []
  for (const row of rows) {
    const date = pickStat(row, 'date_game')
    if (!date || typeof date !== 'string') continue
    const reason = pickStat(row, 'reason')
    if (reason && typeof reason === 'string' && reason.trim().length) continue
    const opponent = pickStat(row, 'opp_id')
    const location = pickStat(row, 'game_location')
    const stats: Record<string, number> = {}
    const map: Record<string, string> = {
      pts: 'PTS',
      trb: 'REB',
      ast: 'AST',
      stl: 'STL',
      blk: 'BLK',
      tov: 'TOV',
      fg: 'FGM',
      fga: 'FGA',
      fg3: '3PM',
      fg3a: '3PA',
      ft: 'FTM',
      fta: 'FTA',
      mp: 'MIN',
    }
    for (const [src, dest] of Object.entries(map)) {
      const value = pickStat(row, src)
      const num = typeof value === 'number' ? value : Number(value)
      if (Number.isFinite(num)) stats[dest] = num
    }
    logs.push({
      date,
      opponentAbbr: typeof opponent === 'string' ? opponent : undefined,
      isHome: location === '@' ? false : true,
      stats,
    })
  }
  return logs
}

export const fetchBasketballReferenceGameLogs = async (
  playerName: string,
  seasonYear: number
): Promise<ReferenceGameLog[]> => {
  const playerUrl = await resolvePlayerUrl('basketball_nba', playerName)
  if (!playerUrl) return []
  const slug = playerUrl.split('/players/')[1]
  if (!slug) return []
  const cleaned = slug.replace(/\.html.*$/, '')
  const gamelogUrl = `https://www.basketball-reference.com/players/${cleaned}/gamelog/${seasonYear}`
  const html = await fetchHtml(gamelogUrl)
  if (!html) return []
  return parseBasketballReferenceGameLogs(html)
}

const parseFootballPlayer = (html: string, sport: string, name: string): ReferencePlayerStats | null => {
  const passingTable = extractTable(html, 'passing')
  const rushingTable = extractTable(html, 'rushing_and_receiving') || extractTable(html, 'receiving_and_rushing')
  const passRows = passingTable ? extractRows(passingTable, 'passing') : []
  const rushRows = rushingTable ? extractRows(rushingTable, 'rushing_and_receiving') : []
  const byYear: Record<number, { pass?: string; rush?: string }> = {}
  for (const row of passRows) {
    byYear[row.year] = { ...(byYear[row.year] || {}), pass: row.row }
  }
  for (const row of rushRows) {
    byYear[row.year] = { ...(byYear[row.year] || {}), rush: row.row }
  }
  const years = Object.keys(byYear)
    .map(Number)
    .filter((y) => Number.isFinite(y))
  if (!years.length) return null
  years.sort((a, b) => a - b)
  const latestYear = years[years.length - 1]
  const rowBundle = byYear[latestYear]
  const season = pickStat(rowBundle.pass || rowBundle.rush || '', 'year_id') as string | null
  const team = pickStat(rowBundle.pass || rowBundle.rush || '', 'team_name_abbr')
  const stats: Record<string, number | string> = {}
  if (rowBundle.pass) {
    const keys: Record<string, string> = {
      pass_cmp: 'PASS_CMP',
      pass_att: 'PASS_ATT',
      pass_yds: 'PASS_YDS',
      pass_td: 'PASS_TD',
      pass_int: 'PASS_INT',
      pass_rating: 'PASS_RATING',
      pass_adj_net_yds_per_att: 'ANYA',
    }
    for (const [src, dest] of Object.entries(keys)) {
      const val = pickStat(rowBundle.pass, src)
      if (val != null) stats[dest] = val
    }
  }
  if (rowBundle.rush) {
    const rushMap: Record<string, string> = {
      rush_att: 'RUSH_ATT',
      rush_yds: 'RUSH_YDS',
      rush_td: 'RUSH_TD',
      rec: 'REC',
      rec_yds: 'REC_YDS',
      rec_td: 'REC_TD',
    }
    for (const [src, dest] of Object.entries(rushMap)) {
      const val = pickStat(rowBundle.rush, src)
      if (val != null) stats[dest] = val
    }
  }

  return {
    name,
    team: typeof team === 'string' ? team : undefined,
    season: typeof season === 'string' ? season : String(latestYear),
    stats,
    sport,
  }
}

const parseBaseballPlayer = (html: string, sport: string, name: string): ReferencePlayerStats | null => {
  const battingTable =
    extractTable(html, 'players_standard_batting') ||
    extractTable(html, 'batting_standard') ||
    extractTable(html, 'batting')
  if (!battingTable) return null
  const rows =
    extractRows(battingTable, 'players_standard_batting') ||
    extractRows(battingTable, 'batting_standard') ||
    extractRows(battingTable, 'batting')
  if (!rows.length) return null
  rows.sort((a, b) => a.year - b.year)
  const latest = rows[rows.length - 1]
  const season = (pickStat(latest.row, 'year_ID') as string | null) ?? (pickStat(latest.row, 'year_id') as string | null)
  const team = pickStat(latest.row, 'team_ID') || pickStat(latest.row, 'team_id')
  const stats: Record<string, number | string> = {}
  const map: Record<string, string> = {
    g: 'G',
    ab: 'AB',
    h: 'H',
    hr: 'HR',
    rbi: 'RBI',
    sb: 'SB',
    bb: 'BB',
    so: 'SO',
    ba: 'AVG',
    obp: 'OBP',
    slg: 'SLG',
    ops: 'OPS',
  }
  for (const [src, dest] of Object.entries(map)) {
    const val = pickStat(latest.row, src)
    if (val != null) stats[dest] = val
  }
  return {
    name,
    team: typeof team === 'string' ? team : undefined,
    season: typeof season === 'string' ? season : String(latest.year),
    stats,
    sport,
  }
}

const parseHockeyPlayer = (html: string, sport: string, name: string): ReferencePlayerStats | null => {
  const table =
    extractTable(html, 'player_stats') ||
    extractTable(html, 'stats_basic_plus_nhl') ||
    extractTable(html, 'stats_basic_nhl') ||
    extractTable(html, 'stats_basic')
  if (!table) return null
  const rows =
    extractRows(table, 'player_stats') ||
    extractRows(table, 'stats_basic_plus_nhl') ||
    extractRows(table, 'stats_basic_nhl') ||
    extractRows(table, 'stats_basic')
  if (!rows.length) return null
  rows.sort((a, b) => a.year - b.year)
  const latest = rows[rows.length - 1]
  const season = pickStat(latest.row, 'season') as string | null
  const team = pickStat(latest.row, 'team_id')
  const stats: Record<string, number | string> = {}
  const map: Record<string, string> = {
    goals: 'GOALS',
    assists: 'ASSISTS',
    points: 'POINTS',
    plus_minus: 'PLUS_MINUS',
    pim: 'PIM',
    toi: 'TOI',
    shots: 'SHOTS',
  }
  for (const [src, dest] of Object.entries(map)) {
    const val = pickStat(latest.row, src)
    if (val != null) stats[dest] = val
  }
  return {
    name,
    team: typeof team === 'string' ? team : undefined,
    season: typeof season === 'string' ? season : String(latest.year),
    stats,
    sport,
  }
}

export const getSportsReferencePlayerSeasonStats = async (
  playerName: string,
  sportKey: string
): Promise<ReferencePlayerStats | null> => {
  const url = await resolvePlayerUrl(sportKey, playerName)
  if (!url) return null
  const html = await fetchHtml(url)
  if (!html) return null

  const displayName = playerName
  if (sportKey === 'basketball_nba' || sportKey === 'basketball_ncaab') {
    return parseBasketballPlayer(html, sportKey, displayName)
  }
  if (sportKey === 'americanfootball_nfl' || sportKey === 'americanfootball_ncaaf') {
    return parseFootballPlayer(html, sportKey, displayName)
  }
  if (sportKey === 'baseball_mlb') {
    return parseBaseballPlayer(html, sportKey, displayName)
  }
  if (sportKey === 'icehockey_nhl') {
    return parseHockeyPlayer(html, sportKey, displayName)
  }
  return null
}

const toFloat = (v: any): number | null => {
  const n = Number(String(v).replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

const nbaSeasonYear = () => {
  const now = new Date()
  const startYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return startYear + 1
}
const nhlSeasonYear = () => {
  const now = new Date()
  const startYear = now.getUTCMonth() >= 8 ? now.getUTCFullYear() : now.getUTCFullYear() - 1
  return startYear + 1
}

const nflSeasonYear = () => {
  const now = new Date()
  const month = now.getUTCMonth()
  const year = now.getUTCFullYear()
  return month >= 6 ? year : year - 1
}

const buildTeamRowMap = (tableHtml: string) => {
  const map = new Map<string, string>()
  for (const row of extractTeamRows(tableHtml)) {
    const teamName = pickStat(row, 'team')
    if (!teamName || typeof teamName !== 'string') continue
    map.set(normalizeName(teamName), row)
  }
  return map
}

const parseNflStandings = (html: string) => {
  const standings: Record<string, {
    wins?: number
    losses?: number
    winPct?: number
    pointsFor?: number
    pointsAgainst?: number
  }> = {}

  const tables = [extractTable(html, 'AFC'), extractTable(html, 'NFC')].filter(Boolean) as string[]
  for (const table of tables) {
    for (const row of extractTeamRows(table)) {
      const teamName = pickStat(row, 'team')
      if (!teamName || typeof teamName !== 'string') continue
      const lower = teamName.toLowerCase()
      if (lower === 'tm' || lower === 'team') continue
      if (lower.includes('division') || lower.includes('afc') || lower.includes('nfc')) continue
      const wins = toFloat(pickStat(row, 'wins'))
      const losses = toFloat(pickStat(row, 'losses'))
      const winPct = toFloat(pickStat(row, 'win_loss_perc'))
      const pointsFor = toFloat(pickStat(row, 'points'))
      const pointsAgainst = toFloat(pickStat(row, 'points_opp'))
      standings[normalizeName(teamName)] = {
        wins: wins ?? undefined,
        losses: losses ?? undefined,
        winPct: winPct ?? undefined,
        pointsFor: pointsFor ?? undefined,
        pointsAgainst: pointsAgainst ?? undefined,
      }
    }
  }

  return standings
}

export const getSportsReferenceTeamStats = async (sportKey: string): Promise<ReferenceTeamStats[] | null> => {
  if (sportKey === 'americanfootball_nfl') {
    const season = nflSeasonYear()
    const now = Date.now()
    if (
      nflTeamStatsCache &&
      nflTeamStatsCache.season === season &&
      now - nflTeamStatsCache.ts < NFL_TEAM_STATS_CACHE_TTL
    ) {
      return nflTeamStatsCache.data
    }
    const trySeasons = [season, season - 1]
    let html: string | null = null
    let oppHtml: string | null = null
    let seasonUsed: number | null = null
    for (const yr of trySeasons) {
      html = await fetchHtml(`https://www.pro-football-reference.com/years/${yr}/`)
      oppHtml = await fetchHtml(`https://www.pro-football-reference.com/years/${yr}/opp.htm`)
      if (html && oppHtml) {
        seasonUsed = yr
        break
      }
    }
    if (!html || !oppHtml || !seasonUsed) {
      return nflTeamStatsCache?.data?.length ? nflTeamStatsCache.data : null
    }

    const offenseTable = extractTableBySection(html, 'team_stats')
    const defenseTable = extractTableBySection(oppHtml, 'team_stats')
    if (!offenseTable || !defenseTable) {
      return nflTeamStatsCache?.data?.length ? nflTeamStatsCache.data : null
    }

    const drivesTable = extractTableBySection(html, 'drives')
    const standings = parseNflStandings(html)
    const defenseMap = buildTeamRowMap(defenseTable)
    const drivesMap = drivesTable ? buildTeamRowMap(drivesTable) : new Map<string, string>()

    const rows = extractTeamRows(offenseTable)
    const teams: ReferenceTeamStats[] = []

    for (const row of rows) {
      const teamName = pickStat(row, 'team')
      if (!teamName || typeof teamName !== 'string') continue
      if (/division|afc|nfc/i.test(teamName)) continue
      const lower = teamName.toLowerCase()
      if (lower === 'tm' || lower === 'team' || lower.includes('league')) continue
      const cleanedTeamName = teamName.replace(/[*+]/g, '').trim()
      const key = normalizeName(cleanedTeamName)
      const games = toFloat(pickStat(row, 'g'))
      const pointsFor = toFloat(pickStat(row, 'points')) ?? standings[key]?.pointsFor ?? null
      const pointsForPerGame =
        pointsFor != null && games ? pointsFor / games : null
      const totalYards = toFloat(pickStat(row, 'total_yards'))
      const plays = toFloat(pickStat(row, 'plays_offense'))
      const playsPerGame = plays != null && games ? plays / games : null
      const yardsPerPlay = toFloat(pickStat(row, 'yds_per_play_offense'))

      const defenseRow = defenseMap.get(key)
      const pointsAgainst = defenseRow
        ? toFloat(pickStat(defenseRow, 'points'))
        : standings[key]?.pointsAgainst ?? null
      const pointsAgainstPerGame =
        pointsAgainst != null && games ? pointsAgainst / games : null
      const yardsAllowedPerPlay = defenseRow
        ? toFloat(pickStat(defenseRow, 'yds_per_play_offense'))
        : null

      const driveRow = drivesMap.get(key)
      const totalDrives = driveRow ? toFloat(pickStat(driveRow, 'drives')) : null
      const drivesPerGame = totalDrives != null && games ? totalDrives / games : null
      const pointsPerDrive = driveRow ? toFloat(pickStat(driveRow, 'points_avg')) : null

      const stats: Record<string, number | string | null> = {
        pointsFor,
        pointsAgainst,
        pointsForPerGame,
        pointsAgainstPerGame,
        totalYards,
        totalOffensivePlays: plays,
        playsPerGame,
        yardsPerPlay,
        yardsAllowedPerPlay,
        totalDrives,
        drivesPerGame,
        pointsPerDrive,
      }

      const standing = standings[key]
      teams.push({
        team: cleanedTeamName,
        wins: standing?.wins,
        losses: standing?.losses,
        winPct: standing?.winPct,
        stats,
        sport: sportKey,
        season: String(seasonUsed),
      })
    }

    if (teams.length) {
      nflTeamStatsCache = { ts: now, season: seasonUsed, data: teams }
    }
    return teams
  }
  // NBA/NCAAB: team tables per season
  if (sportKey === 'basketball_nba') {
      const season = nbaSeasonYear()
      const now = Date.now()
      if (
        nbaTeamStatsFailureTs &&
        now - nbaTeamStatsFailureTs < NBA_TEAM_STATS_FAILURE_COOLDOWN
      ) {
        return nbaTeamStatsCache?.data?.length ? nbaTeamStatsCache.data : null
      }
      if (
        nbaTeamStatsCache &&
        nbaTeamStatsCache.season === season &&
        now - nbaTeamStatsCache.ts < NBA_TEAM_STATS_CACHE_TTL
      ) {
        return nbaTeamStatsCache.data
      }
      const trySeasons = [season, season - 1]
      let html: string | null = null
      let seasonUsed: number | null = null
    for (const yr of trySeasons) {
      const url = `https://www.basketball-reference.com/leagues/NBA_${yr}.html`
      html = await fetchHtml(url)
      if (html) {
        seasonUsed = yr
        break
      }
    }
      if (!html || !seasonUsed) {
        nbaTeamStatsFailureTs = now
        return nbaTeamStatsCache?.data?.length ? nbaTeamStatsCache.data : null
      }
      const perGame = extractTable(html, 'per_game-team')
      const advanced = extractTable(html, 'advanced-team')
    const standingsTables = Array.from(html.matchAll(/<table[^>]+id="[^"]*standings[^"]*"[\s\S]*?<\/table>/gi)).map(
      (m) => m[0]
    )
    const standings: Record<string, { w?: number; l?: number; pct?: number }> = {}
    for (const table of standingsTables) {
      const sRows = Array.from(
        table.matchAll(/<tr[^>]*>\s*<th[^>]+data-stat="team_name"[^>]*>[\s\S]*?<\/tr>/g)
      )
      for (const m of sRows) {
        const row = m[0]
        const teamName = pickStat(row, 'team_name') || pickStat(row, 'team')
        if (!teamName || typeof teamName !== 'string') continue
        const w = toFloat(pickStat(row, 'wins'))
        const l = toFloat(pickStat(row, 'losses'))
        const pct = toFloat(pickStat(row, 'win_loss_pct')) ?? toFloat(pickStat(row, 'win_pct'))
        standings[normalizeName(teamName)] = { w: w ?? undefined, l: l ?? undefined, pct: pct ?? undefined }
      }
    }
      if (!perGame) {
        nbaTeamStatsFailureTs = now
        return nbaTeamStatsCache?.data?.length ? nbaTeamStatsCache.data : null
      }
    const rows = Array.from(
      perGame.matchAll(/<tr[^>]*>\s*<th[^>]+data-stat="ranker"[^>]*>\s*\d+[\s\S]*?<\/tr>/g)
    )
    const teams: ReferenceTeamStats[] = []
    for (const m of rows) {
      const row = m[0]
      const teamName = pickStat(row, 'team') || pickStat(row, 'team_name')
      if (!teamName || typeof teamName !== 'string') continue
      if (/Division/.test(teamName)) continue
      const wins = pickStat(row, 'wins') || pickStat(row, 'w')
      const losses = pickStat(row, 'losses') || pickStat(row, 'l')
      const winPct = pickStat(row, 'win_loss_pct') || pickStat(row, 'win_pct')
      const stats: Record<string, number | string | null> = {
        PTS_PER_G: toFloat(pickStat(row, 'pts_per_g') ?? pickStat(row, 'pts')),
        OPP_PTS_PER_G: toFloat(pickStat(row, 'opp_pts_per_g') ?? pickStat(row, 'opp_pts')),
        FG_PCT: toFloat(pickStat(row, 'fg_pct')),
        FG3_PCT: toFloat(pickStat(row, 'fg3_pct')),
        FT_PCT: toFloat(pickStat(row, 'ft_pct')),
        TRB_PER_G: toFloat(pickStat(row, 'trb_per_g') ?? pickStat(row, 'trb')),
        AST_PER_G: toFloat(pickStat(row, 'ast_per_g') ?? pickStat(row, 'ast')),
      }
      teams.push({
        team: teamName,
        wins: toFloat(wins) ?? undefined,
        losses: toFloat(losses) ?? undefined,
        winPct: toFloat(winPct) ?? undefined,
        stats,
        sport: sportKey,
        season: String(seasonUsed),
      })
    }
    if (advanced) {
      const advRows = Array.from(
        advanced.matchAll(/<tr[^>]*>\s*<th[^>]+data-stat="ranker"[^>]*>\s*\d+[\s\S]*?<\/tr>/g)
      )
      for (const m of advRows) {
        const row = m[0]
        const teamName = pickStat(row, 'team') || pickStat(row, 'team_name')
        if (!teamName || typeof teamName !== 'string') continue
        const target = teams.find((t) => normalizeName(t.team) === normalizeName(teamName))
        if (!target) continue
        const addMap: Record<string, string> = {
          pace: 'PACE',
          off_rtg: 'OFF_RTG',
          def_rtg: 'DEF_RTG',
          net_rtg: 'NET_RTG',
          ts_pct: 'TS_PCT',
        }
        for (const [src, dest] of Object.entries(addMap)) {
          const val = toFloat(pickStat(row, src))
          if (val != null) target.stats[dest] = val
        }
      }
    }
      // Merge standings wins/losses if available
      for (const t of teams) {
        const s = standings[normalizeName(t.team)]
        if (s) {
        if (s.w != null) t.wins = s.w
        if (s.l != null) t.losses = s.l
        if (s.pct != null) t.winPct = s.pct
      }
    }
      if (teams.length) {
        nbaTeamStatsCache = { ts: now, season: seasonUsed, data: teams }
        nbaTeamStatsFailureTs = null
      }
      return teams
  }
  if (sportKey === 'icehockey_nhl') {
    const season = nhlSeasonYear()
    const trySeasons = [season, season - 1]
    let html: string | null = null
    let seasonUsed: number | null = null
    for (const yr of trySeasons) {
      const url = `https://www.hockey-reference.com/leagues/NHL_${yr}.html`
      html = await fetchHtml(url)
      if (html) {
        seasonUsed = yr
        break
      }
    }
    if (!html || !seasonUsed) return null
    const statsTable = extractTable(html, 'stats')
    if (!statsTable) return null
    const rows = Array.from(
      statsTable.matchAll(
        /<tr[^>]*>\s*<th[^>]+data-stat="team_name"[^>]*>[\s\S]*?<\/tr>/g
      )
    ).map((m) => m[0])
    const teams: ReferenceTeamStats[] = []
    for (const row of rows) {
      const teamName = pickStat(row, 'team_name') || pickStat(row, 'team')
      if (!teamName || typeof teamName !== 'string') continue
      if (/division|conference|league/i.test(teamName)) continue
      const cleanedTeamName = teamName.replace(/[*+]/g, '').trim()
      const wins = toFloat(pickStat(row, 'wins'))
      const losses = toFloat(pickStat(row, 'losses'))
      const winPct = toFloat(pickStat(row, 'points_pct'))
      const stats: Record<string, number | string | null> = {
        gamesPlayed: pickStat(row, 'games'),
        goalsFor: pickStat(row, 'goals'),
        goalsAgainst: pickStat(row, 'goals_against'),
        goalsForPerGame: pickStat(row, 'goals_for_per_game'),
        goalsAgainstPerGame: pickStat(row, 'goals_against_per_game'),
        shotsForPerGame: pickStat(row, 'shots'),
        shotsAgainstPerGame: pickStat(row, 'shots_against'),
        powerPlayPct: pickStat(row, 'power_play_pct'),
        penaltyKillPct: pickStat(row, 'pen_kill_pct'),
        pointsPct: pickStat(row, 'points_pct'),
      }
      teams.push({
        team: cleanedTeamName,
        wins: wins ?? undefined,
        losses: losses ?? undefined,
        winPct: winPct ?? undefined,
        stats,
        sport: sportKey,
        season: String(seasonUsed),
      })
    }
    return teams
  }

  // NFL/NCAAF/MLB/NHL: not yet implemented fully; return null so caller can fall back
  return null
}
