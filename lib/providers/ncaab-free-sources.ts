import { normalizeTeamKey } from '@/lib/identity/sport'

export { normalizeTeamKey }

const NCAA_NET_URL =
  'https://www.ncaa.com/rankings/basketball-men/d1/ncaa-mens-basketball-net-rankings'
const NCAA_SCORING_OFFENSE_URL =
  'https://www.ncaa.com/stats/basketball-men/d1/current/team/145'
const NCAA_SCORING_DEFENSE_URL =
  'https://www.ncaa.com/stats/basketball-men/d1/current/team/146'
const TORVIK_JSON_URL = 'https://barttorvik.com/trank.php?json=1'
const TORVIK_HTML_URL = 'https://barttorvik.com/trank.php'
const HASLA_RATINGS_URL = 'https://haslametrics.com/ratings.php'
const HASLA_XML_URL = 'https://haslametrics.com/ratings.xml'

const CACHE_TTL = 1000 * 60 * 30 // 30 minutes

type CacheEntry<T> = { ts: number; data: T }
const cache = new Map<string, CacheEntry<any>>()

export type NcaaNetRanking = {
  team: string
  rank: number
  record?: string
  conference?: string
}

export type NcaaScoringEntry = {
  team: string
  rank?: number
  games?: number
  ppg?: number
  oppPpg?: number
  oppPpgRank?: number
}

export type NcaaTeamStatProfile = {
  team: string
  games?: number
  stats: Record<string, number>
}

export type CbbAdvancedRatingEntry = {
  team: string
  adjO?: number
  adjD?: number
  adjEM?: number
  tempo?: number
  luck?: number
  sos?: number
  ncsos?: number
  source: 'torvik' | 'hasla'
}

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&ldquo;/gi, '"')
    .replace(/&rdquo;/gi, '"')

const stripTags = (value: string) =>
  decodeEntities(value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim())

const fetchHtml = async (
  url: string,
  cacheTtl = CACHE_TTL
): Promise<string | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as string
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DeltaSportsBot/1.0)',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })
  if (!res.ok) return null
  const html = await res.text()
  cache.set(url, { ts: Date.now(), data: html })
  return html
}

const fetchJson = async <T>(url: string, cacheTtl = CACHE_TTL): Promise<T | null> => {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < cacheTtl) return cached.data as T
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; DeltaSportsBot/1.0)',
      Accept: 'application/json,text/plain,*/*',
    },
  })
  if (!res.ok) return null
  // Check content-type or peek at response to avoid parsing HTML as JSON
  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()
  // If response looks like HTML, return null
  if (text.trimStart().startsWith('<!') || text.trimStart().startsWith('<html')) {
    console.warn('[fetchJson] Received HTML instead of JSON from', url)
    return null
  }
  // If content-type says JSON or text looks like JSON, parse it
  if (!contentType.includes('json') && !text.trimStart().startsWith('{') && !text.trimStart().startsWith('[')) {
    console.warn('[fetchJson] Response is not JSON from', url)
    return null
  }
  try {
    const data = JSON.parse(text) as T
    cache.set(url, { ts: Date.now(), data })
    return data
  } catch {
    console.warn('[fetchJson] Failed to parse JSON from', url)
    return null
  }
}

const parseNumber = (value: string | undefined): number | null => {
  if (!value) return null
  const num = Number(value.replace(/,/g, '').replace(/%/g, '').trim())
  return Number.isFinite(num) ? num : null
}

const parseXmlAttribute = (attrs: string, key: string): string | null => {
  const match = attrs.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`, 'i'))
  if (!match) return null
  return decodeEntities(match[1])
}

const parseHaslametricsXml = (xml: string): CbbAdvancedRatingEntry[] => {
  const entries: CbbAdvancedRatingEntry[] = []
  for (const match of xml.matchAll(/<mr\s+([^>]+?)\/?>/gi)) {
    const attrs = match[1]
    const team = parseXmlAttribute(attrs, 't')
    if (!team) continue
    const adjO = parseNumber(parseXmlAttribute(attrs, 'oe') ?? undefined)
    const adjD = parseNumber(parseXmlAttribute(attrs, 'de') ?? undefined)
    const paceOff = parseNumber(parseXmlAttribute(attrs, 'ou') ?? undefined)
    const paceDef = parseNumber(parseXmlAttribute(attrs, 'du') ?? undefined)
    const tempo =
      paceOff != null && paceDef != null
        ? Number(((paceOff + paceDef) / 2).toFixed(2))
        : paceOff ?? paceDef ?? null
    const sos = parseNumber(parseXmlAttribute(attrs, 'sos') ?? undefined)
    const adjEM =
      adjO != null && adjD != null ? Number((adjO - adjD).toFixed(2)) : null

    entries.push({
      team,
      adjO: adjO ?? undefined,
      adjD: adjD ?? undefined,
      adjEM: adjEM ?? undefined,
      tempo: tempo ?? undefined,
      sos: sos ?? undefined,
      source: 'hasla',
    })
  }
  return entries
}

const parseTable = (html: string) => {
  const tableMatch = html.match(/<table[\s\S]*?<\/table>/i)
  if (!tableMatch) return null
  const table = tableMatch[0]
  const headers = Array.from(
    table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)
  ).map((m) => stripTags(m[1]))
  const rows: string[][] = []
  for (const match of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const rowHtml = match[1]
    if (!rowHtml.includes('<td')) continue
    const cells = Array.from(
      rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
    ).map((m) => stripTags(m[1]))
    if (cells.length) rows.push(cells)
  }
  return { headers, rows }
}

const parseTables = (html: string) => {
  const tables: Array<{ headers: string[]; rows: string[][] }> = []
  for (const match of html.matchAll(/<table[\s\S]*?<\/table>/gi)) {
    const table = match[0]
    const headers = Array.from(
      table.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)
    ).map((m) => stripTags(m[1]))
    const rows: string[][] = []
    for (const rowMatch of table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const rowHtml = rowMatch[1]
      if (!rowHtml.includes('<td')) continue
      const cells = Array.from(
        rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)
      ).map((m) => stripTags(m[1]))
      if (cells.length) rows.push(cells)
    }
    if (headers.length && rows.length) {
      tables.push({ headers, rows })
    }
  }
  return tables
}

const extractPageUrls = (html: string, baseUrl: string) => {
  const urls = new Set<string>([baseUrl])
  const matches = html.matchAll(/href="([^"]*\/p\d+)"/gi)
  for (const match of matches) {
    const href = match[1]
    if (!href.includes('/stats/basketball-men/d1/current/team/')) continue
    try {
      urls.add(new URL(href, baseUrl).toString())
    } catch {
      continue
    }
  }
  return Array.from(urls)
}

const fetchPaginatedTable = async (baseUrl: string) => {
  const firstHtml = await fetchHtml(baseUrl)
  if (!firstHtml) return null
  const pageUrls = extractPageUrls(firstHtml, baseUrl)
  const pageHtmls = await Promise.all(
    pageUrls.map((url) => (url === baseUrl ? firstHtml : fetchHtml(url)))
  )
  let headers: string[] | null = null
  const rows: string[][] = []
  for (const html of pageHtmls) {
    if (!html) continue
    const table = parseTable(html)
    if (!table) continue
    if (!headers) headers = table.headers
    rows.push(...table.rows)
  }
  return headers ? { headers, rows } : null
}

const normalizeHeaderKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/%/g, 'pct')
    .replace(/[^a-z0-9]+/g, '')
    .trim()

const pickTableByHeader = (
  tables: Array<{ headers: string[]; rows: string[][] }>,
  headerHints: string[]
) => {
  const normalizedHints = headerHints.map(normalizeHeaderKey)
  return tables.find((table) => {
    const normalized = table.headers.map(normalizeHeaderKey)
    return normalizedHints.every((hint) =>
      normalized.some((header) => header.includes(hint))
    )
  })
}

const applyStat = (stats: Record<string, number>, key: string, value: number | null) => {
  if (value == null) return
  stats[key] = value
}

export const fetchNcaaNetRankings = async (): Promise<NcaaNetRanking[]> => {
  const html = await fetchHtml(NCAA_NET_URL)
  if (!html) return []
  const table = parseTable(html)
  if (!table) return []
  const headerIndex = (label: string) =>
    table.headers.findIndex((header) => header.toLowerCase() === label)
  const rankIdx = headerIndex('rank')
  const schoolIdx = headerIndex('school')
  const recordIdx = headerIndex('record')
  const confIdx = headerIndex('conference')
  const rankings: NcaaNetRanking[] = []
  for (const row of table.rows) {
    const rank = parseNumber(row[rankIdx]) ?? null
    const team = row[schoolIdx]
    if (!team || rank == null) continue
    rankings.push({
      team,
      rank,
      record: recordIdx >= 0 ? row[recordIdx] : undefined,
      conference: confIdx >= 0 ? row[confIdx] : undefined,
    })
  }
  return rankings
}

const parseScoringTable = (
  table: { headers: string[]; rows: string[][] },
  opts: { ppgLabel: string }
) => {
  const lowerHeaders = table.headers.map((header) => header.toLowerCase())
  const rankIdx = lowerHeaders.indexOf('rank')
  const teamIdx = lowerHeaders.indexOf('team')
  const gamesIdx = lowerHeaders.indexOf('gm')
  const ppgIdx = lowerHeaders.indexOf(opts.ppgLabel.toLowerCase())
  const rows: Array<{
    team: string
    rank?: number
    games?: number
    ppg?: number
  }> = []
  for (const row of table.rows) {
    const team = row[teamIdx]
    if (!team) continue
    rows.push({
      team,
      rank: parseNumber(row[rankIdx]) ?? undefined,
      games: parseNumber(row[gamesIdx]) ?? undefined,
      ppg: parseNumber(row[ppgIdx]) ?? undefined,
    })
  }
  return rows
}

export const fetchNcaaScoringStats = async (): Promise<NcaaScoringEntry[]> => {
  const [offenseTable, defenseTable] = await Promise.all([
    fetchPaginatedTable(NCAA_SCORING_OFFENSE_URL),
    fetchPaginatedTable(NCAA_SCORING_DEFENSE_URL),
  ])
  const offenseRows = offenseTable
    ? parseScoringTable(offenseTable, { ppgLabel: 'ppg' })
    : []
  const defenseRows = defenseTable
    ? parseScoringTable(defenseTable, { ppgLabel: 'opp ppg' })
    : []

  const merged = new Map<string, NcaaScoringEntry>()
  for (const row of offenseRows) {
    const key = normalizeTeamKey(row.team)
    merged.set(key, {
      team: row.team,
      rank: row.rank,
      games: row.games,
      ppg: row.ppg,
    })
  }
  for (const row of defenseRows) {
    const key = normalizeTeamKey(row.team)
    const existing = merged.get(key)
    const entry = existing ?? { team: row.team }
    entry.oppPpgRank = row.rank
    entry.oppPpg = row.ppg
    if (entry.games == null) entry.games = row.games
    merged.set(key, entry)
  }
  return Array.from(merged.values())
}

type NcaaCategoryConfig = {
  id: number
  apply: (row: Record<string, string>, entry: NcaaTeamStatProfile) => void
}

const CATEGORY_CONFIGS: NcaaCategoryConfig[] = [
  {
    id: 147,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      applyStat(entry.stats, 'pointsFor', parseNumber(row.pts))
      applyStat(entry.stats, 'pointsForPerGame', parseNumber(row.ppg))
      applyStat(entry.stats, 'pointsAgainst', parseNumber(row.opppts))
      applyStat(entry.stats, 'pointsAgainstPerGame', parseNumber(row.oppppg))
      applyStat(entry.stats, 'scoringMargin', parseNumber(row.scrmar))
    },
  },
  {
    id: 148,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      const fgm = parseNumber(row.fgm)
      const fga = parseNumber(row.fga)
      const fgPct = parseNumber(row.fgpct)
      applyStat(entry.stats, 'fieldGoalsMade', fgm)
      applyStat(entry.stats, 'fieldGoalsAttempted', fga)
      applyStat(entry.stats, 'fieldGoalPct', fgPct)
      if (games && fga != null) {
        applyStat(entry.stats, 'fieldGoalsAttemptedPerGame', fga / games)
      }
    },
  },
  {
    id: 149,
    apply: (row, entry) => {
      applyStat(entry.stats, 'opponentFieldGoalsMade', parseNumber(row.oppfg))
      applyStat(entry.stats, 'opponentFieldGoalsAttempted', parseNumber(row.oppfga))
      applyStat(entry.stats, 'opponentFieldGoalPct', parseNumber(row.oppfgpct))
    },
  },
  {
    id: 150,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      const ftm = parseNumber(row.ft)
      const fta = parseNumber(row.fta)
      const ftPct = parseNumber(row.ftpct)
      applyStat(entry.stats, 'freeThrowsMade', ftm)
      applyStat(entry.stats, 'freeThrowAttempts', fta)
      applyStat(entry.stats, 'freeThrowPct', ftPct)
      if (games && fta != null) {
        applyStat(entry.stats, 'freeThrowAttemptsPerGame', fta / games)
      }
    },
  },
  {
    id: 152,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      const threeMade = parseNumber(row['3fg'])
      const threeAtt = parseNumber(row['3fga'])
      const threePct = parseNumber(row['3fgpct'])
      applyStat(entry.stats, 'threePointMade', threeMade)
      applyStat(entry.stats, 'threePointAttempts', threeAtt)
      applyStat(entry.stats, 'threePointPct', threePct)
      if (games && threeAtt != null) {
        applyStat(entry.stats, 'threePointAttemptsPerGame', threeAtt / games)
      }
    },
  },
  {
    id: 153,
    apply: (row, entry) => {
      applyStat(entry.stats, 'threePointMade', parseNumber(row['3fg']))
      applyStat(entry.stats, 'threePointMadePerGame', parseNumber(row['3pg']))
    },
  },
  {
    id: 518,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      const oppMade = parseNumber(row.opp3fg)
      const oppAtt = parseNumber(row.opp3fga)
      applyStat(entry.stats, 'opponentThreePointMade', oppMade)
      applyStat(entry.stats, 'opponentThreePointAttempts', oppAtt)
      applyStat(entry.stats, 'opponentThreePointPct', parseNumber(row.pct))
      if (games && oppMade != null) {
        applyStat(entry.stats, 'opponentThreePointMadePerGame', oppMade / games)
      }
      if (games && oppAtt != null) {
        applyStat(
          entry.stats,
          'opponentThreePointAttemptsPerGame',
          oppAtt / games
        )
      }
    },
  },
  {
    id: 216,
    apply: (row, entry) => {
      applyStat(entry.stats, 'assists', parseNumber(row.ast))
      applyStat(entry.stats, 'assistsPerGame', parseNumber(row.apg))
    },
  },
  {
    id: 214,
    apply: (row, entry) => {
      applyStat(entry.stats, 'blocks', parseNumber(row.blks))
      applyStat(entry.stats, 'blocksPerGame', parseNumber(row.bkpg))
    },
  },
  {
    id: 215,
    apply: (row, entry) => {
      applyStat(entry.stats, 'steals', parseNumber(row.st))
      applyStat(entry.stats, 'stealsPerGame', parseNumber(row.stpg))
    },
  },
  {
    id: 217,
    apply: (row, entry) => {
      applyStat(entry.stats, 'turnovers', parseNumber(row.to))
      applyStat(entry.stats, 'turnoversPerGame', parseNumber(row.topg))
    },
  },
  {
    id: 932,
    apply: (row, entry) => {
      applyStat(entry.stats, 'offensiveRebounds', parseNumber(row.orebs))
      applyStat(entry.stats, 'defensiveRebounds', parseNumber(row.drebs))
      applyStat(entry.stats, 'rebounds', parseNumber(row.reb))
      applyStat(entry.stats, 'reboundsPerGame', parseNumber(row.rpg))
    },
  },
  {
    id: 857,
    apply: (row, entry) => {
      applyStat(entry.stats, 'offensiveRebounds', parseNumber(row.orebs))
      applyStat(entry.stats, 'offensiveReboundsPerGame', parseNumber(row.rpg))
    },
  },
  {
    id: 859,
    apply: (row, entry) => {
      applyStat(entry.stats, 'defensiveRebounds', parseNumber(row.drebs))
      applyStat(entry.stats, 'defensiveReboundsPerGame', parseNumber(row.rpg))
    },
  },
  {
    id: 151,
    apply: (row, entry) => {
      applyStat(entry.stats, 'rebounds', parseNumber(row.reb))
      applyStat(entry.stats, 'reboundsPerGame', parseNumber(row.rpg))
      applyStat(entry.stats, 'opponentRebounds', parseNumber(row.oppreb))
      applyStat(entry.stats, 'opponentReboundsPerGame', parseNumber(row.opprpg))
      applyStat(entry.stats, 'reboundMargin', parseNumber(row.rebmar))
    },
  },
  {
    id: 625,
    apply: (row, entry) => {
      applyStat(entry.stats, 'threePointMade', parseNumber(row['3fg']))
      applyStat(entry.stats, 'threePointAttempts', parseNumber(row['3fga']))
      applyStat(entry.stats, 'threePointAttemptsPerGame', parseNumber(row.avg))
    },
  },
  {
    id: 633,
    apply: (row, entry) => {
      applyStat(entry.stats, 'freeThrowsMade', parseNumber(row.ft))
      applyStat(entry.stats, 'freeThrowsMadePerGame', parseNumber(row.avg))
    },
  },
  {
    id: 638,
    apply: (row, entry) => {
      applyStat(entry.stats, 'freeThrowAttempts', parseNumber(row.fta))
      applyStat(entry.stats, 'freeThrowAttemptsPerGame', parseNumber(row.avg))
    },
  },
  {
    id: 1288,
    apply: (row, entry) => {
      applyStat(entry.stats, 'effectiveFieldGoalPct', parseNumber(row.pct))
      applyStat(entry.stats, 'effectiveFgPct', parseNumber(row.pct))
    },
  },
  {
    id: 474,
    apply: (row, entry) => {
      applyStat(entry.stats, 'assistTurnoverRatio', parseNumber(row.ratio))
    },
  },
  {
    id: 519,
    apply: (row, entry) => {
      applyStat(entry.stats, 'opponentTurnovers', parseNumber(row.oppto))
      applyStat(entry.stats, 'turnoverMargin', parseNumber(row.ratio))
    },
  },
  {
    id: 931,
    apply: (row, entry) => {
      const games = parseNumber(row.gm) ?? parseNumber(row.g)
      if (games != null) entry.games = entry.games ?? games
      const oppTo = parseNumber(row.oppto)
      if (entry.stats.opponentTurnovers == null) {
        applyStat(entry.stats, 'opponentTurnovers', oppTo)
      }
      applyStat(entry.stats, 'opponentTurnoversPerGame', parseNumber(row.avg))
    },
  },
]

const buildRowRecord = (headers: string[], row: string[]) => {
  const record: Record<string, string> = {}
  headers.forEach((header, idx) => {
    record[header] = row[idx]
  })
  return record
}

export const fetchNcaaTeamStatProfiles = async (): Promise<NcaaTeamStatProfile[]> => {
  const merged = new Map<string, NcaaTeamStatProfile>()

  for (const config of CATEGORY_CONFIGS) {
    const table = await fetchPaginatedTable(
      `https://www.ncaa.com/stats/basketball-men/d1/current/team/${config.id}`
    )
    if (!table) continue
    const headers = table.headers.map(normalizeHeaderKey)
    for (const row of table.rows) {
      const record = buildRowRecord(headers, row)
      const team = record.team
      if (!team) continue
      const key = normalizeTeamKey(team)
      const entry =
        merged.get(key) ?? {
          team,
          stats: {},
        }
      config.apply(record, entry)
      merged.set(key, entry)
    }
  }

  return Array.from(merged.values())
}

const parseAdvancedTableRows = (
  table: { headers: string[]; rows: string[][] },
  source: CbbAdvancedRatingEntry['source']
): CbbAdvancedRatingEntry[] => {
  const headers = table.headers.map(normalizeHeaderKey)
  const teamIdx = headers.findIndex((header) =>
    header.includes('team') || header.includes('school')
  )
  const idx = (keys: string[]) =>
    headers.findIndex((header) => keys.some((key) => header.includes(key)))

  const adjoIdx = idx(['adjo', 'adjoe', 'adjoff'])
  const adjdIdx = idx(['adjd', 'adjde', 'adjdef'])
  const adjemIdx = idx(['adjem', 'adjeff', 'adje'])
  const tempoIdx = idx(['tempo', 'pace'])
  const luckIdx = idx(['luck'])
  const sosIdx = idx(['sos'])
  const ncsosIdx = idx(['ncsos'])

  const entries: CbbAdvancedRatingEntry[] = []

  for (const row of table.rows) {
    const team = row[teamIdx]
    if (!team) continue
    const adjO = parseNumber(row[adjoIdx]) ?? undefined
    const adjD = parseNumber(row[adjdIdx]) ?? undefined
    const adjEM = parseNumber(row[adjemIdx]) ??
      (adjO != null && adjD != null ? Number((adjO - adjD).toFixed(2)) : undefined)
    entries.push({
      team,
      adjO,
      adjD,
      adjEM,
      tempo: parseNumber(row[tempoIdx]) ?? undefined,
      luck: parseNumber(row[luckIdx]) ?? undefined,
      sos: parseNumber(row[sosIdx]) ?? undefined,
      ncsos: parseNumber(row[ncsosIdx]) ?? undefined,
      source,
    })
  }

  return entries
}

export const fetchTorvikAdvancedRatings = async (): Promise<CbbAdvancedRatingEntry[]> => {
  try {
    const data = await fetchJson<any>(TORVIK_JSON_URL)
    const rows = Array.isArray(data)
      ? data
      : Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data?.teams)
          ? data.teams
          : Array.isArray(data?.rankings)
            ? data.rankings
            : []

    if (rows.length) {
      return rows
        .map((row: any) => {
          const team = String(row?.team || row?.Team || row?.school || row?.School || '').trim()
          if (!team) return null
          const adjO = parseNumber(row?.adjo ?? row?.adjO ?? row?.adj_off)
          const adjD = parseNumber(row?.adjd ?? row?.adjD ?? row?.adj_def)
          const adjEM = parseNumber(row?.adjem ?? row?.adjEM ?? row?.adj_em) ??
            (adjO != null && adjD != null ? Number((adjO - adjD).toFixed(2)) : null)
          return {
            team,
            adjO: adjO ?? undefined,
            adjD: adjD ?? undefined,
            adjEM: adjEM ?? undefined,
            tempo: parseNumber(row?.tempo ?? row?.pace) ?? undefined,
            luck: parseNumber(row?.luck) ?? undefined,
            sos: parseNumber(row?.sos) ?? undefined,
            ncsos: parseNumber(row?.ncsos ?? row?.nc_sos) ?? undefined,
            source: 'torvik' as const,
          }
        })
        .filter(Boolean) as CbbAdvancedRatingEntry[]
    }
  } catch (error) {
    console.warn('[CBB] Torvik JSON fetch failed', error)
  }

  const html = await fetchHtml(TORVIK_HTML_URL)
  if (!html) return []
  const tables = parseTables(html)
  const table = pickTableByHeader(tables, ['adjo', 'adjd'])
  if (!table) return []
  return parseAdvancedTableRows(table, 'torvik')
}

export const fetchHaslametricsRatings = async (): Promise<CbbAdvancedRatingEntry[]> => {
  const xml = await fetchHtml(HASLA_XML_URL)
  if (xml) {
    const parsed = parseHaslametricsXml(xml)
    if (parsed.length) return parsed
  }

  const html = await fetchHtml(HASLA_RATINGS_URL)
  if (!html) return []
  const tables = parseTables(html)
  const table = pickTableByHeader(tables, ['adjo', 'adjd'])
  if (!table) return []
  return parseAdvancedTableRows(table, 'hasla')
}
