import {
  getPlayerGameLogs,
  searchAthlete,
  getEventSnapshot,
  getTeams,
  getRoster,
  getTeamAtsRecord,
  getTeamSchedule,
  getEventOdds,
} from '@/lib/services/espn-orchestrator'
import { searchPlayer } from '@/lib/sports-stats-api'

type SportKey = 'nba' | 'nfl' | 'mlb' | 'nhl'

type StatCondition = {
  stat: string
  op: 'gte' | 'gt' | 'lte' | 'lt' | 'eq'
  value: number
}

type CacheEntry = {
  ts: number
  logs: any[]
  playerId: string
  playerName: string
}

const CACHE_TTL_MS = 5 * 60 * 1000
const playerLogCache = new Map<string, CacheEntry>()
const eventStatCache = new Map<string, { ts: number; stats: Record<string, number> }>()
const eventOddsCache = new Map<string, { ts: number; odds: any }>()
const SPORT_PATH: Record<SportKey, string> = {
  nba: 'basketball/nba',
  nfl: 'football/nfl',
  mlb: 'baseball/mlb',
  nhl: 'hockey/nhl',
}
const STAR_IDS: Record<string, string> = {
  // NBA
  'stephen curry': '3975',
  'steph curry': '3975',
  'curry': '3975',
  'luka doncic': '3945274',
  'doncic': '3945274',
  'lebron james': '1966',
  'james': '1966',
  'kevin durant': '3202',
  'durant': '3202',
  'giannis antetokounmpo': '3032977',
  'austin reaves': '4871157',
  'reaves': '4871157',
  'anthony davis': '6583',
  'davis': '6583',
  'deni avdija': '4683021',
  'avdija': '4683021',
  // NFL (examples)
  'patrick mahomes': '3139477',
  'mahomes': '3139477',
  'josh allen': '3918298',
  'allen': '3918298',
  // MLB
  'shohei ohtani': '39832',
  'ohtani': '39832',
  'aaron judge': '33192',
  'judge': '33192',
  // NHL
  'connor mcdavid': '3211',
  'mcdavid': '3211',
}

const STAT_ALIASES: Record<string, string> = {
  points: 'PTS',
  point: 'PTS',
  pts: 'PTS',
  ppg: 'PTS',
  rebounds: 'REB',
  rebound: 'REB',
  boards: 'REB',
  rebs: 'REB',
  assists: 'AST',
  assist: 'AST',
  ast: 'AST',
  asts: 'AST',
  steals: 'STL',
  steal: 'STL',
  stl: 'STL',
  blocks: 'BLK',
  block: 'BLK',
  blk: 'BLK',
  threes: '3PM',
  '3s': '3PM',
  '3pm': '3PM',
  '3-pointers': '3PM',
  'three pointers': '3PM',
  'three pointer': '3PM',
  '3 pointer': '3PM',
  '3 pointers': '3PM',
  '3pt': '3PM',
  '3-pt': '3PM',
  '3point': '3PM',
  '3-point': '3PM',
  'three point': '3PM',
  fg: 'FGM',
  fgm: 'FGM',
  fga: 'FGA',
  fgpercent: 'FG_PCT',
  'fg%': 'FG_PCT',
  'three%': '3P_PCT',
  '3p%': '3P_PCT',
  '3p': '3PM',
  yards: 'YDS',
  rushing: 'RUSHYDS',
  passing: 'PASSYDS',
  receiving: 'RECYDS',
  td: 'TD',
  tds: 'TD',
}

const normalizeToken = (value?: string) => (value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
const normalizeNameLoose = (value?: string) =>
  (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')

const inferSport = (msgLower: string): SportKey => {
  if (/(nfl|football)/i.test(msgLower)) return 'nfl'
  if (/(mlb|baseball)/i.test(msgLower)) return 'mlb'
  if (/(nhl|hockey)/i.test(msgLower)) return 'nhl'
  return 'nba'
}

const seasonForSport = (sport: SportKey, isoDate?: string): number => {
  const now = isoDate ? new Date(`${isoDate}T00:00:00Z`) : new Date()
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  if (sport === 'nba') return month >= 8 ? year + 1 : year
  if (sport === 'nhl') return month >= 7 ? year + 1 : year
  if (sport === 'nfl') return month >= 7 ? year : year - 1
  return year
}

const seasonTypeFromMessage = (msgLower: string): number => {
  if (/\bplayoffs?\b|\bpostseason\b/.test(msgLower)) return 3
  if (/\bpreseason\b|\bpre-season\b/.test(msgLower)) return 1
  return 2
}

const parseIsoDate = (value: string) => {
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

const extractYear = (msg: string): number | undefined => {
  const m = msg.match(/\b(20\d{2})\b/)
  if (m) return Number(m[1])
  return undefined
}

const collectStats = (entry: any) => {
  const statBlocks: any[] = Array.isArray(entry?.stats) ? entry.stats : Array.isArray(entry?.statistics) ? entry.statistics : []
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

  // Fall back to common direct fields if stats blocks are empty
  const directMap: Record<string, string> = {
    points: 'PTS',
    pts: 'PTS',
    rebounds: 'REB',
    assists: 'AST',
    blocks: 'BLK',
    steals: 'STL',
    '3p': '3PM',
    threePointersMade: '3PM',
    threePointers: '3PM',
    passingYards: 'PASSYDS',
    rushingYards: 'RUSHYDS',
    receivingYards: 'RECYDS',
    touchdowns: 'TD',
  }
  Object.entries(directMap).forEach(([field, key]) => {
    const v = (entry as any)[field]
    const num = typeof v === 'number' ? v : Number(v)
    if (Number.isFinite(num) && stats[key] == null) stats[key] = num
  })

  return stats
}

const collectStatsFromPlayerBox = (player: any, labels?: string[]) => {
  // Use label-aligned stats if present
  if (labels && Array.isArray(player?.stats)) {
    const stats: Record<string, number> = {}
    const labelToKey = (label: string) => {
      const k = label.toUpperCase().replace(/\s+/g, '_')
      if (k === 'FG') return 'FGM'
      if (k === 'FT') return 'FTM'
      if (k === '3PT') return '3PM'
      if (k === '3_PT' || k === '3POINTERS') return '3PM'
      return k
    }
    labels.forEach((label, idx) => {
      const key = labelToKey(label)
      const raw = player.stats?.[idx]
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        stats[key] = raw
      } else if (typeof raw === 'string') {
        // Handle made-attempt strings like "6-12" by taking the first number
        const dashMatch = raw.match(/(-?\d+(?:\.\d+)?)/)
        if (dashMatch) {
          const val = Number(dashMatch[1])
          if (Number.isFinite(val)) stats[key] = val
          return
        }
        const num = Number(raw.replace(/[^\d.-]/g, ''))
        if (Number.isFinite(num)) stats[key] = num
      }
    })
    if (Object.keys(stats).length) return stats
  }

  // ESPN boxscore player.statistics[] can sometimes have stat blocks; reuse generic collector
  if (Array.isArray(player?.statistics) && player.statistics.length) {
    return collectStats(player)
  }

  // Fallback: parse prefixed strings like "PTS 32"
  const stats: Record<string, number> = {}
  const rawStats: any[] = player?.stats || []
  for (const s of rawStats) {
    if (typeof s !== 'string') continue
    const m = s.match(/([A-Z%0-9]+)\s+(-?\d+(?:\.\d+)?)/i)
    if (m) {
      const key = m[1].toUpperCase()
      const val = Number(m[2])
      if (Number.isFinite(val)) stats[key] = val
    }
  }
  return stats
}

const normalizeConditions = (msg: string): StatCondition[] => {
  const conds: StatCondition[] = []
  const msgLower = msg.toLowerCase()

  Object.entries(STAT_ALIASES).forEach(([alias, key]) => {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const patterns = [
      new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(\\+|or\\s+more|\\+\\s*${escaped})?\\s*${escaped}`, 'i'),
      new RegExp(`${escaped}[^\\d]*(\\d+(?:\\.\\d+)?)`, 'i'),
    ]
    for (const pat of patterns) {
      const m = msgLower.match(pat)
      if (m) {
        // Avoid misreading "3 pointers" as points; skip if alias is points/point/pts and followed by "pointer"
        if (['points', 'point', 'pts', 'ppg'].includes(alias)) {
          const after = msgLower.slice(m.index || 0, (m.index || 0) + m[0].length + 8)
          if (/pointer/.test(after)) continue
        }

        const raw = m[1]
        const value = Number(raw)
        if (!Number.isFinite(value)) continue
        const op: StatCondition['op'] = m[2] && m[2].includes('+') ? 'gte' : 'gte'
        conds.push({ stat: key, op, value })
        break
      }
    }
  })

  // Deduplicate by stat/op/value
  const seen = new Set<string>()
  return conds.filter((c) => {
    const key = `${c.stat}:${c.op}:${c.value}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// Recognize performance shorthand (triple-double, double-double, etc.)
const performanceConditions = (msg: string): StatCondition[][] => {
  const lower = msg.toLowerCase()
  const combos: StatCondition[][] = []

  if (/five[-\s]?by[-\s]?five|5x5/i.test(lower)) {
    combos.push([
      { stat: 'PTS', op: 'gte', value: 5 },
      { stat: 'REB', op: 'gte', value: 5 },
      { stat: 'AST', op: 'gte', value: 5 },
      { stat: 'STL', op: 'gte', value: 5 },
      { stat: 'BLK', op: 'gte', value: 5 },
    ])
  }

  if (/(quadruple[-\s]?double)/i.test(lower)) {
    combos.push([
      { stat: 'PTS', op: 'gte', value: 10 },
      { stat: 'REB', op: 'gte', value: 10 },
      { stat: 'AST', op: 'gte', value: 10 },
      { stat: 'STL', op: 'gte', value: 10 },
    ])
  }

  if (/(triple[-\s]?double|\btriple\s+double\b|\btriple\s*-\s*double\b|\btd\b)/i.test(lower)) {
    combos.push([
      { stat: 'PTS', op: 'gte', value: 10 },
      { stat: 'REB', op: 'gte', value: 10 },
      { stat: 'AST', op: 'gte', value: 10 },
    ])
  }

  if (/(double[-\s]?double|\bdouble\s+double\b|\bdouble\s*-\s*double\b)/i.test(lower)) {
    combos.push(
      [
        { stat: 'PTS', op: 'gte', value: 10 },
        { stat: 'REB', op: 'gte', value: 10 },
      ],
      [
        { stat: 'PTS', op: 'gte', value: 10 },
        { stat: 'AST', op: 'gte', value: 10 },
      ],
      [
        { stat: 'REB', op: 'gte', value: 10 },
        { stat: 'AST', op: 'gte', value: 10 },
      ]
    )
  }

  return combos
}

const resolveStatValue = (stats: Record<string, number>, stat: string) => {
  const direct = stats[stat]
  if (Number.isFinite(direct)) return direct
  // Fallback aliases for makes
  if (stat === '3PM' && Number.isFinite(stats['3PT'])) return stats['3PT']
  if (stat === 'FGM' && Number.isFinite(stats['FG'])) return stats['FG']
  if (stat === 'FTM' && Number.isFinite(stats['FT'])) return stats['FT']
  return stats[stat]
}

const fetchEventOddsCached = async (sport: SportKey, eventId: string, providerPriority: string[] = ['1304', '878', '879', '1695', '1385']) => {
  const cacheKey = [sport, eventId, providerPriority.join(',')].join('|')
  const cached = eventOddsCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.odds
  const odds = await getEventOdds(sport, eventId, providerPriority)
  if (odds) eventOddsCache.set(cacheKey, { ts: now, odds })
  return odds
}

const meetsConditions = (stats: Record<string, number>, conditions: StatCondition[]) => {
  return conditions.every((c) => {
    const v = resolveStatValue(stats, c.stat)
    if (!Number.isFinite(v)) return false
    if (c.op === 'gte') return v >= c.value
    if (c.op === 'gt') return v > c.value
    if (c.op === 'lte') return v <= c.value
    if (c.op === 'lt') return v < c.value
    return v === c.value
  })
}

const normalizeOpponent = (value?: string) => normalizeToken((value || '').replace(/\bon\b$/i, '').trim())

const matchOpponent = (entry: any, opponentHint?: string) => {
  if (!opponentHint) return true
  const opp = normalizeOpponent(opponentHint)
  if (!opp) return true
  const oppName =
    entry?.opponent?.displayName ||
    entry?.opponent?.name ||
    entry?.opponent ||
    entry?.opponentName ||
    entry?.gameOpponent ||
    ''
  const token = normalizeOpponent(oppName)
  return token && (token.includes(opp) || opp.includes(token))
}

const titleCase = (value: string) => value.split(/\s+/).map((p) => p.slice(0, 1).toUpperCase() + p.slice(1)).join(' ')

const loadPlayerLogs = async (sport: SportKey, playerName: string, season: number, seasonType: number) => {
  const cleanId = (val?: string) => {
    if (!val) return val
    return String(val).split('?')[0].split('#')[0]
  }

  const cacheKey = [sport, playerName.toLowerCase(), season, seasonType].join('|')
  const cached = playerLogCache.get(cacheKey)
  const now = Date.now()
  if (cached && cached.logs && cached.logs.length > 0 && now - cached.ts < CACHE_TTL_MS) {
    return cached
  }

  const targetNorm = normalizeNameLoose(playerName)

  // Prefer a deterministic ID first for stars
  const normName = playerName.toLowerCase().trim()
  const tokens = normName.split(/\s+/)
  const last = tokens[tokens.length - 1] || ''
  let playerId = cleanId(STAR_IDS[normName] || STAR_IDS[last])
  let playerDisplay = playerName

  // Prefer roster-based search for accuracy
  const rosterHit = await searchPlayer(playerName, sport)
  const rosterId = rosterHit?.id ? cleanId(String(rosterHit.id)) : undefined
  if (!playerId && rosterId) {
    playerId = rosterId
    playerDisplay = rosterHit?.fullName || rosterHit?.name || playerDisplay
  }

  if (!playerId) {
    const search = await searchAthlete(sport, playerName)
    const items: any[] = search?.items || []
    if (items.length) {
      const best =
        items.find((i: any) => normalizeNameLoose(i?.fullName || i?.displayName) === targetNorm) ||
        items.find((i: any) => normalizeNameLoose(i?.fullName || i?.displayName).includes(targetNorm)) ||
        items[0]
      playerId = best?.id ? cleanId(String(best.id)) : cleanId(best?.$ref?.split('/').pop())
      playerDisplay = best?.fullName || best?.displayName || playerDisplay
    } else if (search?.id) {
      playerId = cleanId(String(search.id))
    }
  }

  if (!playerId) return null

  const loadLogs = async (id: string) => {
    const rawLogs: any = await getPlayerGameLogs(sport, id, season, seasonType)
    const base =
      Array.isArray(rawLogs)
        ? rawLogs
        : rawLogs?.events ||
          rawLogs?.gameLog ||
          rawLogs?.gamelog ||
          rawLogs?.items ||
          rawLogs?.entries ||
          rawLogs ||
          []
    const logs = Array.isArray(base)
      ? base
      : typeof base === 'object'
      ? Object.values(base)
      : []
    if (!logs || !logs.length) {
      console.warn('[AGG] Empty gamelog', { playerName, playerId: id, season, seasonType })
    }
    return { logs, raw: rawLogs }
  }

  let { logs } = await loadLogs(playerId)
  // If logs came back empty and we have a rosterId that's different, retry with rosterId
  if ((!logs || logs.length === 0) && rosterId && rosterId !== playerId) {
    const retry = await loadLogs(rosterId)
    if (retry.logs && retry.logs.length) {
      logs = retry.logs
      playerId = rosterId
    }
  }

  const entry: CacheEntry = {
    ts: now,
    logs,
    playerId,
    playerName: playerDisplay,
  }
  if (logs && logs.length > 0) {
    playerLogCache.set(cacheKey, entry)
  }
  return entry
}

const fetchPlayerStatsFromEvent = async (sport: SportKey, eventId: string, playerId: string, playerName?: string) => {
  const cacheKey = [sport, eventId, playerId].join('|')
  const cached = eventStatCache.get(cacheKey)
  const now = Date.now()
  if (cached && now - cached.ts < CACHE_TTL_MS) return cached.stats

  const snap = await getEventSnapshot(sport, eventId)
  const boxPlayers = snap?.boxscore?.players || []
  const targetName = normalizeNameLoose(playerName || '')
  let foundStats: Record<string, number> | null = null
  for (const group of boxPlayers) {
    const statBlocks: any[] = Array.isArray(group?.statistics) ? group.statistics : []
    for (const block of statBlocks) {
      const labels: string[] = Array.isArray(block?.labels) ? block.labels : undefined
      const athletes = block?.athletes || []
      for (const a of athletes) {
        const id = String(a?.athlete?.id || a?.id || '')
        const nameMatch = targetName && normalizeNameLoose(a?.athlete?.displayName || a?.athlete?.fullName || a?.name || '') === targetName
        if ((id && id === String(playerId)) || nameMatch) {
          const stats = collectStatsFromPlayerBox(a, labels) || {}
          if (Object.keys(stats).length) {
            foundStats = stats
            break
          }
        }
      }
      if (foundStats) break
    }
    if (foundStats) break
  }

  if (foundStats && Object.keys(foundStats).length) {
    eventStatCache.set(cacheKey, { ts: now, stats: foundStats })
    return foundStats
  }
  // Try core boxscore endpoint as a fallback
  try {
    const path = SPORT_PATH[sport]
    const url = `https://sports.core.api.espn.com/v2/sports/${path}/events/${eventId}/competitions/${eventId}/boxscore`
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      const players = data?.players || []
      for (const p of players) {
        const athletes = p?.athletes || []
        const labels: string[] = Array.isArray(p?.labels) ? p.labels : undefined
        for (const a of athletes) {
          const id = String(a?.athlete?.id || a?.athleteId || a?.id || '')
          const nameMatch = targetName && normalizeNameLoose(a?.athlete?.displayName || a?.athlete?.fullName || a?.name || '') === targetName
          if ((id && id === String(playerId)) || nameMatch) {
            const stats =
              collectStatsFromPlayerBox(a, labels) ||
              collectStats({
                stats: a?.stats || [],
                statistics: a?.statistics || [],
              })
            if (stats && Object.keys(stats).length) {
              eventStatCache.set(cacheKey, { ts: now, stats })
              return stats
            }
          }
        }
      }
    }
  } catch {
    // ignore and retry later
  }
  return {}
}

export const resolvePlayerThresholdQuery = async (opts: {
  message: string
  playerNameHint?: string
  sportHint?: SportKey
  opponentHint?: string
}) => {
  const { message, playerNameHint, sportHint, opponentHint } = opts
  const msgLower = message.toLowerCase()
  const isCountLike = /\bhow many\b|\bmost\b|\bnumber of\b|\bgames\b/.test(msgLower)
  if (!isCountLike) return null

  const playerName = (playerNameHint || '').trim()
  if (!playerName) return null

  const conditions = normalizeConditions(message)
  const perfCombos = performanceConditions(message)
  const baseConditions = conditions
  const useConditions = baseConditions.length ? baseConditions : perfCombos[0] || []

  if (!useConditions.length && !perfCombos.length) return null

  const sport = sportHint || inferSport(msgLower)
  const seasonType = seasonTypeFromMessage(msgLower)
  const seasonYear = extractYear(message) ?? seasonForSport(sport, undefined)

  const data = await loadPlayerLogs(sport, playerName, seasonYear, seasonType)
  if (!data) {
    return `I couldn't find ${playerName} on ESPN for ${sport.toUpperCase()} ${seasonYear}.`
  }

  const normalizedLogs = (data.logs || []).map((g: any) => ({
    eventId: String(g?.id || g?.eventId || ''),
    date: String(g?.date || g?.gameDate || g?.game_date || '').slice(0, 10),
    opponent:
      g?.opponent?.displayName ||
      g?.opponent?.name ||
      g?.opponent ||
      g?.opponentName ||
      g?.gameOpponent ||
      '',
    result: g?.result || g?.gameResult || g?.outcome,
    stats: collectStats(g),
  }))

  for (const g of normalizedLogs) {
    if (g.eventId) {
      const boxStats = await fetchPlayerStatsFromEvent(sport, g.eventId, data.playerId, playerName)
      if (boxStats && Object.keys(boxStats).length) {
        Object.assign(g.stats, boxStats)
      }
    }
  }

  const filtered = normalizedLogs.filter((g) => {
    const meetsBase = baseConditions.length ? meetsConditions(g.stats, baseConditions) : false
    const meetsPerf = perfCombos.length ? perfCombos.some((combo) => meetsConditions(g.stats, combo)) : false
    const oppOk = matchOpponent(g, opponentHint)
    return (meetsBase || meetsPerf) && oppOk
  })
  const count = filtered.length

  const instances = filtered.map((g) => {
    const statSummary = useConditions.map((c) => `${c.stat}: ${g.stats[c.stat] ?? '--'}`).join(', ')
    return `- ${g.date}${g.opponent ? ` vs ${g.opponent}` : ''}${g.result ? ` (${g.result})` : ''} -- ${statSummary}`
  })

  const condSummary = (baseConditions.length ? baseConditions : useConditions)
    .map((c) => `${c.stat} ${c.op === 'gte' ? '>=' : c.op === 'lte' ? '<=' : c.op === 'eq' ? '=' : c.op === 'gt' ? '>' : '<'} ${c.value}`)
    .join(', ') || (perfCombos.length ? 'Performance: double/triple/quadruple double' : '')
  const seasonLabel = `${seasonYear}${seasonType === 3 ? ' Playoffs' : seasonType === 1 ? ' Preseason' : ' Regular'}`

  const header = `${titleCase(playerName)} -- ${seasonLabel}`
  const body = `${count} game${count === 1 ? '' : 's'} with ${condSummary}${opponentHint ? ` vs ${titleCase(opponentHint)}` : ''}.`

  return [header, body, instances.length ? `Instances:\n${instances.join('\n')}` : undefined].filter(Boolean).join('\n')
}

export const resolveTeamAfterLossSplit = async (opts: {
  sport: SportKey
  teamId: string
  season: number
  seasonType: number
  teamName?: string
}) => {
  const { sport, teamId, season, seasonType, teamName } = opts
  const schedule = await getTeamSchedule(sport, teamId, season, seasonType)
  if (!schedule?.length) {
    return `No schedule data available for ${teamName || teamId} (${sport.toUpperCase()}) ${season}.`
  }

  const games = schedule
    .filter((g) => g.result)
    .sort((a, b) => a.date.localeCompare(b.date))

  let afterLossGames = 0
  let wins = 0
  let losses = 0
  let ties = 0
  let ourPts = 0
  let oppPts = 0

  for (let i = 1; i < games.length; i++) {
    const prev = games[i - 1]
    if (prev.result !== 'L') continue
    const cur = games[i]
    afterLossGames += 1
    if (cur.result === 'W') wins += 1
    else if (cur.result === 'L') losses += 1
    else ties += 1
    if (Number.isFinite(cur.ourScore)) ourPts += cur.ourScore as number
    if (Number.isFinite(cur.oppScore)) oppPts += cur.oppScore as number
  }

  if (!afterLossGames) {
    return `No after-loss games found for ${teamName || teamId} in ${season} ${seasonType === 3 ? 'Playoffs' : 'Regular'}.`
  }

  const fmt = (v: number) => (afterLossGames ? (v / afterLossGames).toFixed(1) : 'N/A')
  const record = `${wins}-${losses}${ties ? `-${ties}` : ''}`
  const label = `${seasonType === 3 ? 'Playoffs' : 'Regular'} ${season}`

  return [
    `${teamName || teamId} after a loss (${label}):`,
    `Games: ${afterLossGames}, Record: ${record}`,
    `Avg points scored: ${fmt(ourPts)}, Avg points allowed: ${fmt(oppPts)}`,
  ].join('\n')
}

export const resolveTeamHomeAwayDefense = async (opts: {
  sport: SportKey
  teamId: string
  season: number
  seasonType: number
  teamName?: string
}) => {
  const { sport, teamId, season, seasonType, teamName } = opts
  const schedule = await getTeamSchedule(sport, teamId, season, seasonType)
  if (!schedule?.length) {
    return `No schedule data available for ${teamName || teamId} (${sport.toUpperCase()}) ${season}.`
  }

  const home = schedule.filter((g) => g.isHome && Number.isFinite(g.oppScore))
  const away = schedule.filter((g) => !g.isHome && Number.isFinite(g.oppScore))

  const sum = (arr: any[], field: 'oppScore' | 'ourScore') =>
    arr.reduce((acc, g) => acc + (Number.isFinite(g[field]) ? (g as any)[field] : 0), 0)

  const fmt = (total: number, count: number) => (count ? (total / count).toFixed(1) : 'N/A')
  const label = `${seasonType === 3 ? 'Playoffs' : 'Regular'} ${season}`

  const homeOpp = sum(home, 'oppScore')
  const awayOpp = sum(away, 'oppScore')
  const homeOur = sum(home, 'ourScore')
  const awayOur = sum(away, 'ourScore')

  return [
    `${teamName || teamId} defensive split (home vs away) - ${label}:`,
    `Home: ${home.length} games, Opp PPG ${fmt(homeOpp, home.length)}, Our PPG ${fmt(homeOur, home.length)}`,
    `Away: ${away.length} games, Opp PPG ${fmt(awayOpp, away.length)}, Our PPG ${fmt(awayOur, away.length)}`,
  ].join('\n')
}

type LineSplitBucket = {
  games: number
  cover: number
  fail: number
  push: number
  over: number
  under: number
  ouPush: number
  missingOdds: number
}

const makeBucket = (): LineSplitBucket => ({
  games: 0,
  cover: 0,
  fail: 0,
  push: 0,
  over: 0,
  under: 0,
  ouPush: 0,
  missingOdds: 0,
})

const bumpBucket = (bucket: LineSplitBucket, outcome: { ats?: 'cover' | 'fail' | 'push'; ou?: 'over' | 'under' | 'push'; hadOdds: boolean }) => {
  if (!bucket) return
  if (!outcome.hadOdds) {
    bucket.missingOdds += 1
    return
  }
  bucket.games += 1
  if (outcome.ats === 'cover') bucket.cover += 1
  else if (outcome.ats === 'fail') bucket.fail += 1
  else if (outcome.ats === 'push') bucket.push += 1

  if (outcome.ou === 'over') bucket.over += 1
  else if (outcome.ou === 'under') bucket.under += 1
  else if (outcome.ou === 'push') bucket.ouPush += 1
}

export const computeTeamLineSplits = async (opts: {
  sport: SportKey
  teamId: string
  season: number
  seasonType?: number
  providerPriority?: string[]
}) => {
  const { sport, teamId, season, seasonType = 2, providerPriority = ['1304', '878', '879', '1695', '1385'] } = opts
  const schedule = await getTeamSchedule(sport, teamId, season, seasonType)
  if (!schedule?.length) {
    return { error: `No schedule found for ${teamId} ${season}.` }
  }

  const buckets: Record<string, LineSplitBucket> = {
    overall: makeBucket(),
    home: makeBucket(),
    away: makeBucket(),
    favorite: makeBucket(),
    underdog: makeBucket(),
    homeFavorite: makeBucket(),
    homeUnderdog: makeBucket(),
    awayFavorite: makeBucket(),
    awayUnderdog: makeBucket(),
  }

  for (const game of schedule) {
    const eventId = game.eventId
    const ourScore = Number.isFinite(game.ourScore) ? (game.ourScore as number) : null
    const oppScore = Number.isFinite(game.oppScore) ? (game.oppScore as number) : null
    const odds = eventId ? await fetchEventOddsCached(sport, eventId, providerPriority) : null

    const hasScores = Number.isFinite(ourScore) && Number.isFinite(oppScore)
    const totalPoints = hasScores ? (ourScore as number) + (oppScore as number) : null
    const spread = odds?.spread
    const totalLine = odds?.total
    const isFavorite = odds?.favoriteId && (String(odds.favoriteId) === String(teamId) ? true : String(odds.underdogId) === String(teamId) ? false : null)
    const isHome = Boolean(game.isHome)

    let ats: 'cover' | 'fail' | 'push' | undefined
    let ou: 'over' | 'under' | 'push' | undefined

    if (hasScores && Number.isFinite(spread) && isFavorite !== null && isFavorite !== undefined) {
      const spreadAbs = Math.abs(spread as number)
      const margin = (ourScore as number) - (oppScore as number)
      if (isFavorite) {
        if (margin > spreadAbs) ats = 'cover'
        else if (margin === spreadAbs) ats = 'push'
        else ats = 'fail'
      } else {
        if (margin + spreadAbs > 0) ats = 'cover'
        else if (margin + spreadAbs === 0) ats = 'push'
        else ats = 'fail'
      }
    }

    if (hasScores && Number.isFinite(totalLine)) {
      if ((totalPoints as number) > (totalLine as number)) ou = 'over'
      else if ((totalPoints as number) < (totalLine as number)) ou = 'under'
      else ou = 'push'
    }

    const hadOdds = Boolean(odds && (Number.isFinite(spread) || Number.isFinite(totalLine)))

    const outcome = { ats, ou, hadOdds }
    bumpBucket(buckets.overall, outcome)
    bumpBucket(isHome ? buckets.home : buckets.away, outcome)
    if (isFavorite === true) {
      bumpBucket(buckets.favorite, outcome)
      bumpBucket(isHome ? buckets.homeFavorite : buckets.awayFavorite, outcome)
    } else if (isFavorite === false) {
      bumpBucket(buckets.underdog, outcome)
      bumpBucket(isHome ? buckets.homeUnderdog : buckets.awayUnderdog, outcome)
    }
  }

  return { buckets }
}

export const formatTeamLineSplits = (teamName: string, season: number, seasonType: number, data: { buckets?: Record<string, LineSplitBucket>; error?: string }) => {
  if (data.error) return data.error
  const b = data.buckets || {}
  const label = `${seasonType === 3 ? 'Playoffs' : 'Regular'} ${season}`
  const formatBucket = (key: string, bucket?: LineSplitBucket) => {
    if (!bucket) return null
    const games = bucket.games
    const parts: string[] = []
    parts.push(`ATS: ${bucket.cover}-${bucket.fail}${bucket.push ? `-${bucket.push}` : ''}${games ? ` (games: ${games})` : ''}`)
    parts.push(`OU: ${bucket.over}-${bucket.under}${bucket.ouPush ? `-${bucket.ouPush}` : ''}`)
    if (bucket.missingOdds) parts.push(`Missing odds: ${bucket.missingOdds}`)
    return `${key}: ${parts.join(' | ')}`
  }

  const lines = [
    `${teamName} line splits - ${label}`,
    formatBucket('Overall', b.overall),
    formatBucket('Home', b.home),
    formatBucket('Away', b.away),
    formatBucket('Favorite', b.favorite),
    formatBucket('Underdog', b.underdog),
    formatBucket('Home Favorite', b.homeFavorite),
    formatBucket('Home Underdog', b.homeUnderdog),
    formatBucket('Away Favorite', b.awayFavorite),
    formatBucket('Away Underdog', b.awayUnderdog),
  ]
    .filter(Boolean)
    .join('\n')

  return lines
}

export const resolvePlayerOpponentAggregate = async (opts: {
  playerName: string
  sport: SportKey
  season: number
  seasonType: number
  opponent: string
}) => {
  const { playerName, sport, season, seasonType, opponent } = opts
  const data = await loadPlayerLogs(sport, playerName, season, seasonType)
  if (!data) return `I couldn't find ${playerName} for ${sport.toUpperCase()} ${season}.`

  const oppToken = normalizeToken(opponent)
  const logs = (data.logs || []).map((g: any) => ({
    date: String(g?.date || g?.gameDate || g?.game_date || '').slice(0, 10),
    opponent:
      g?.opponent?.displayName ||
      g?.opponent?.name ||
      g?.opponent ||
      g?.opponentName ||
      g?.gameOpponent ||
      '',
    stats: collectStats(g),
    eventId: String(g?.id || g?.eventId || ''),
  }))

  for (const g of logs) {
    if (g.eventId) {
      const box = await fetchPlayerStatsFromEvent(sport, g.eventId, data.playerId, playerName)
      Object.assign(g.stats, box)
    }
  }

  const filtered = logs.filter((g) => {
    const tok = normalizeToken(g.opponent)
    return tok && (tok.includes(oppToken) || oppToken.includes(tok))
  })
  if (!filtered.length) return `${playerName}: no games vs ${opponent} for ${season} ${seasonType === 3 ? 'Playoffs' : 'Regular'}.`

  const agg = filtered.reduce(
    (acc, g) => {
      acc.games += 1
      const pts = resolveStatValue(g.stats, 'PTS')
      const reb = resolveStatValue(g.stats, 'REB')
      const ast = resolveStatValue(g.stats, 'AST')
      const t3 = resolveStatValue(g.stats, '3PM')
      if (Number.isFinite(pts)) acc.pts += pts
      if (Number.isFinite(reb)) acc.reb += reb
      if (Number.isFinite(ast)) acc.ast += ast
      if (Number.isFinite(t3)) acc.t3 += t3
      return acc
    },
    { games: 0, pts: 0, reb: 0, ast: 0, t3: 0 }
  )

  const fmt = (sum: number) => (agg.games ? (sum / agg.games).toFixed(1) : 'N/A')
  return [
    `${playerName} vs ${opponent} - ${season} ${seasonType === 3 ? 'Playoffs' : 'Regular'}`,
    `Games: ${agg.games}`,
    `PPG: ${fmt(agg.pts)}, RPG: ${fmt(agg.reb)}, APG: ${fmt(agg.ast)}, 3PM/G: ${fmt(agg.t3)}`,
  ].join('\n')
}

export const resolvePlayerRestSplit = async (opts: {
  playerName: string
  sport: SportKey
  season: number
  seasonType: number
}) => {
  const { playerName, sport, season, seasonType } = opts
  const data = await loadPlayerLogs(sport, playerName, season, seasonType)
  if (!data) return `I couldn't find ${playerName} for ${sport.toUpperCase()} ${season}.`

  const logs = (data.logs || []).map((g: any) => ({
    date: String(g?.date || g?.gameDate || g?.game_date || '').slice(0, 10),
    stats: collectStats(g),
    eventId: String(g?.id || g?.eventId || ''),
  }))
  logs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))

  for (const g of logs) {
    if (g.eventId) {
      const box = await fetchPlayerStatsFromEvent(sport, g.eventId, data.playerId, playerName)
      Object.assign(g.stats, box)
    }
  }

  let noRestGames = 0
  const accum = { pts: 0, reb: 0, ast: 0, t3: 0 }
  for (let i = 1; i < logs.length; i++) {
    const prevDate = parseIsoDate(logs[i - 1].date + 'T00:00:00Z')
    const curDate = parseIsoDate(logs[i].date + 'T00:00:00Z')
    if (!prevDate || !curDate) continue
    const diffDays = (curDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays <= 1.1) {
      noRestGames += 1
      const s = logs[i].stats
      const pts = resolveStatValue(s, 'PTS')
      const reb = resolveStatValue(s, 'REB')
      const ast = resolveStatValue(s, 'AST')
      const t3 = resolveStatValue(s, '3PM')
      if (Number.isFinite(pts)) accum.pts += pts
      if (Number.isFinite(reb)) accum.reb += reb
      if (Number.isFinite(ast)) accum.ast += ast
      if (Number.isFinite(t3)) accum.t3 += t3
    }
  }

  if (!noRestGames) return `${playerName}: no games on no rest/back-to-back for ${season} ${seasonType === 3 ? 'Playoffs' : 'Regular'}.`
  const fmt = (sum: number) => (sum / noRestGames).toFixed(1)
  return [
    `${playerName} on no rest/back-to-back - ${season} ${seasonType === 3 ? 'Playoffs' : 'Regular'}`,
    `Games: ${noRestGames}`,
    `Averages: PTS ${fmt(accum.pts)}, REB ${fmt(accum.reb)}, AST ${fmt(accum.ast)}, 3PM ${fmt(accum.t3)}`,
  ].join('\n')
}

export const resolveAtsLeaderboard = async (opts: { sport: SportKey; season: number; seasonType?: number; limit?: number }) => {
  const { sport, season, seasonType = 2, limit = 10 } = opts
  const teams = await getTeams(sport)
  const entries: Array<{ team: string; record: string; winPct: number }> = []
  for (const t of teams || []) {
    const id = String((t as any).id || (t as any).team?.id || (t as any).uid || (t as any).abbreviation || '')
    if (!id) continue
    const ats = await getTeamAtsRecord(sport, id, season, seasonType)
    const overall = ats?.items?.find((it: any) => it?.type?.name === 'atsOverall') || ats?.items?.[0]
    if (!overall) continue
    const w = Number(overall.wins ?? 0)
    const l = Number(overall.losses ?? 0)
    const p = Number(overall.pushes ?? 0)
    const total = w + l + p
    const pct = total ? w / total : 0
    const rec = p ? `${w}-${l}-${p}` : `${w}-${l}`
    entries.push({ team: (t as any).displayName || (t as any).name || id, record: rec, winPct: pct })
  }
  entries.sort((a, b) => b.winPct - a.winPct)
  const top = entries.slice(0, limit)
  if (!top.length) return `No ATS data available for ${sport.toUpperCase()} ${season}.`
  const lines = top.map((e, i) => `${i + 1}. ${e.team}: ${e.record} (${(e.winPct * 100).toFixed(1)}%)`)
  const header = `ATS leaders ${season} (${seasonType === 3 ? 'Playoffs' : 'Regular'})`
  return [header, lines.join('\n')].join('\n')
}

export const resolveLeaderboardThresholdQuery = async (opts: {
  message: string
  sport: SportKey
  season: number
  seasonType: number
  thresholdStat: string
  thresholdValue: number
  limit?: number
}) => {
  const { message, sport, season, seasonType, thresholdStat, thresholdValue, limit = 10 } = opts

  const players: { id: string; name: string; team?: string }[] = []
  try {
    const teamList = await getTeams(sport)
    for (const t of teamList || []) {
      const teamIdStr = String((t as any).id || (t as any).team?.id || (t as any).uid || (t as any).abbreviation || '')
      const roster = await getRoster(sport, teamIdStr)
      for (const p of roster || []) {
        const id = String(p.id || p.athleteId || p.uid || '')
        if (!id) continue
        const name = p.fullName || p.displayName || p.name || ''
        if (!name) continue
        players.push({ id, name, team: (p as any).team || (t as any).displayName || (t as any).name })
      }
    }
  } catch (err) {
    console.warn('[LEADERBOARD] roster fetch failed, will try seeds', err)
  }

  if (!players.length && SEEDED_PLAYERS[sport]?.length) {
    players.push(...SEEDED_PLAYERS[sport])
  }

  const leaderboard: LeaderboardEntry[] = []

  for (const p of players) {
    const logsAny: any = await getPlayerGameLogs(sport, p.id, season, seasonType)
    const base =
      Array.isArray(logsAny)
        ? logsAny
        : logsAny?.events ||
          logsAny?.gameLog ||
          logsAny?.gamelog ||
          logsAny?.items ||
          logsAny?.entries ||
          logsAny ||
          []
    const normalized = (Array.isArray(base) ? base : Object.values(base || {})).map((g: any) => ({
      stats: collectStats(g),
      eventId: String(g?.id || g?.eventId || ''),
    }))

    for (const g of normalized) {
      const v = resolveStatValue(g.stats, thresholdStat)
      if ((v == null || !Number.isFinite(v)) && g.eventId) {
        const box = await fetchPlayerStatsFromEvent(sport, g.eventId, p.id, p.name)
        Object.assign(g.stats, box)
      }
    }

    const count = normalized.reduce((acc, g) => {
      const v = resolveStatValue(g.stats, thresholdStat)
      return Number.isFinite(v) && v >= thresholdValue ? acc + 1 : acc
    }, 0)

    if (count > 0) {
      leaderboard.push({ playerId: p.id, playerName: p.name, team: p.team, count })
    }
  }

  leaderboard.sort((a, b) => b.count - a.count)
  const top = leaderboard.slice(0, limit)

  if (!top.length) {
    return `No leaderboard data available for ${thresholdStat} >= ${thresholdValue} (${seasonType === 3 ? 'Playoffs' : 'Regular'} ${season}). ESPN roster/gamelog data may be missing for this season.`
  }

  const lines = top.map((e, idx) => `${idx + 1}. ${e.playerName}${e.team ? ` (${e.team})` : ''}: ${e.count}`)
  const header = `Top ${top.length} players by games with ${thresholdStat} >= ${thresholdValue} (${seasonType === 3 ? 'Playoffs' : 'Regular'} ${season})`

  return [header, lines.join('\n')].filter(Boolean).join('\n')
}

type LeaderboardEntry = {
  playerId: string
  playerName: string
  team?: string
  count: number
}

type PlayerAggregate = {
  games: number
  avgPts: number | null
  avgReb: number | null
  avgAst: number | null
  avgThrees: number | null
}

type TeamSplit = {
  games: number
  wins: number
  losses: number
  oppPts: number
  ourPts: number
}

const SEEDED_PLAYERS: Record<SportKey, Array<{ id: string; name: string; team?: string }>> = {
  nba: [
    { id: '3975', name: 'Stephen Curry', team: 'Warriors' },
    { id: '2544', name: 'LeBron James', team: 'Lakers' },
    { id: '1966', name: 'LeBron James', team: 'Lakers' },
    { id: '3032977', name: 'Giannis Antetokounmpo', team: 'Bucks' },
    { id: '3945274', name: 'Luka Doncic', team: 'Mavericks' },
    { id: '4683021', name: 'Deni Avdija', team: 'Trail Blazers' },
    { id: '4442030', name: 'Jayson Tatum', team: 'Celtics' },
    { id: '3136193', name: 'Devin Booker', team: 'Suns' },
    { id: '3992', name: 'James Harden', team: 'Clippers' },
    { id: '4259', name: 'Kevin Durant', team: 'Suns' },
  ],
  nfl: [],
  mlb: [],
  nhl: [],
}
