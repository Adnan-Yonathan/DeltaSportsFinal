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

const normalizeName = (value: string) =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const stripComments = (html: string) => html.replace(/<!--/g, '').replace(/-->/g, '')

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
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DeltaSportsBot/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
  })
  if (!res.ok) return null
  const html = await res.text()
  return stripComments(html)
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

export const getSportsReferenceTeamStats = async (sportKey: string): Promise<ReferenceTeamStats[] | null> => {
  // NBA/NCAAB: team tables per season
  if (sportKey === 'basketball_nba') {
    const season = nbaSeasonYear()
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
    if (!html || !seasonUsed) return null
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
    if (!perGame) return null
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
        PTS_PER_G: pickStat(row, 'pts_per_g') ?? pickStat(row, 'pts'),
        OPP_PTS_PER_G: pickStat(row, 'opp_pts_per_g') ?? pickStat(row, 'opp_pts'),
        FG_PCT: pickStat(row, 'fg_pct'),
        FG3_PCT: pickStat(row, 'fg3_pct'),
        FT_PCT: pickStat(row, 'ft_pct'),
        TRB_PER_G: pickStat(row, 'trb_per_g') ?? pickStat(row, 'trb'),
        AST_PER_G: pickStat(row, 'ast_per_g') ?? pickStat(row, 'ast'),
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
          const val = pickStat(row, src)
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
    return teams
  }

  // NFL/NCAAF/MLB/NHL: not yet implemented fully; return null so caller can fall back
  return null
}
