import type { LiveScore } from '@/lib/espn-api'

const SPORT_ALIASES: Record<string, string> = {
  nba: 'basketball_nba',
  basketball: 'basketball_nba',
  'basketball-nba': 'basketball_nba',
  ncaab: 'basketball_ncaab',
  'college basketball': 'basketball_ncaab',
  'college-basketball': 'basketball_ncaab',
  wnba: 'basketball_nba',
  nfl: 'americanfootball_nfl',
  football: 'americanfootball_nfl',
  'american football': 'americanfootball_nfl',
  ncaaf: 'americanfootball_ncaaf',
  cfb: 'americanfootball_ncaaf',
  'college football': 'americanfootball_ncaaf',
  mlb: 'baseball_mlb',
  baseball: 'baseball_mlb',
  nhl: 'icehockey_nhl',
  hockey: 'icehockey_nhl',
  'ice hockey': 'icehockey_nhl',
}

const SPORT_TIMING: Record<
  string,
  {
    regulationPeriods: number
    periodMinutes: number
    overtimeMinutes?: number
  }
> = {
  basketball_nba: { regulationPeriods: 4, periodMinutes: 12, overtimeMinutes: 5 },
  basketball_ncaab: { regulationPeriods: 2, periodMinutes: 20, overtimeMinutes: 5 },
  americanfootball_nfl: { regulationPeriods: 4, periodMinutes: 15, overtimeMinutes: 10 },
  americanfootball_ncaaf: { regulationPeriods: 4, periodMinutes: 15, overtimeMinutes: 10 },
  icehockey_nhl: { regulationPeriods: 3, periodMinutes: 20, overtimeMinutes: 5 },
}

export interface GameClockState {
  totalSeconds: number
  elapsedSeconds: number
  remainingSeconds: number
  periodIndex: number
}

const normalize = (value?: string | null) => value?.trim().toLowerCase()

export function resolveSportKey(
  betSport?: string | null,
  liveSport?: string | null
): string | undefined {
  const candidates = [betSport, liveSport]

  for (const candidate of candidates) {
    if (!candidate) continue
    const raw = normalize(candidate)
    if (!raw) continue

    if (SPORT_TIMING[raw]) {
      return raw
    }

    const aliasKey = raw.replace(/[_\s]+/g, ' ')
    if (SPORT_ALIASES[aliasKey]) {
      return SPORT_ALIASES[aliasKey]
    }

    if (raw.includes('basketball')) {
      return raw.includes('college') ? 'basketball_ncaab' : 'basketball_nba'
    }
    if (raw.includes('football')) {
      return raw.includes('college') ? 'americanfootball_ncaaf' : 'americanfootball_nfl'
    }
    if (raw.includes('hockey')) {
      return 'icehockey_nhl'
    }
  }

  return undefined
}

export function deriveGameClockState(
  game: LiveScore,
  sportKey: string
): GameClockState | null {
  const meta = SPORT_TIMING[sportKey]
  if (!meta) return null

  const periodLengthSeconds = meta.periodMinutes * 60
  const overtimeLengthSeconds = (meta.overtimeMinutes ?? meta.periodMinutes) * 60
  const totalSeconds = meta.regulationPeriods * periodLengthSeconds

  if (game.status === 'pre') {
    return {
      totalSeconds,
      elapsedSeconds: 0,
      remainingSeconds: totalSeconds,
      periodIndex: 1,
    }
  }

  if (game.status === 'post') {
    return {
      totalSeconds,
      elapsedSeconds: totalSeconds,
      remainingSeconds: 0,
      periodIndex: meta.regulationPeriods,
    }
  }

  const clockSeconds = parseClockSeconds(game.timeRemaining || game.period)
  const rawPeriod = normalize(game.period) || ''

  if (rawPeriod.includes('halftime')) {
    const elapsed = totalSeconds / 2
    return {
      totalSeconds,
      elapsedSeconds: elapsed,
      remainingSeconds: totalSeconds - elapsed,
      periodIndex: Math.ceil(meta.regulationPeriods / 2),
    }
  }

  const periodIndex = parsePeriodIndex(rawPeriod, sportKey)
  const isOvertime = periodIndex > meta.regulationPeriods

  let elapsedSeconds = 0
  if (isOvertime) {
    const overtimeIndex = periodIndex - meta.regulationPeriods - 1
    const overtimeElapsed =
      overtimeIndex * overtimeLengthSeconds +
      (overtimeLengthSeconds - (clockSeconds ?? overtimeLengthSeconds / 2))
    elapsedSeconds = totalSeconds + Math.max(0, overtimeElapsed)
  } else {
    elapsedSeconds =
      (periodIndex - 1) * periodLengthSeconds +
      (periodLengthSeconds - (clockSeconds ?? periodLengthSeconds / 2))
  }

  const remainingSeconds = Math.max(totalSeconds - elapsedSeconds, 0)

  return {
    totalSeconds,
    elapsedSeconds: Math.max(0, elapsedSeconds),
    remainingSeconds,
    periodIndex,
  }
}

function parseClockSeconds(clockRaw?: string): number | undefined {
  if (!clockRaw) return undefined
  const trimmed = clockRaw.trim()
  if (!trimmed) return undefined

  if (/^\d+:\d{2}$/.test(trimmed)) {
    const [minutes, seconds] = trimmed.split(':').map((part) => parseInt(part, 10))
    return minutes * 60 + seconds
  }

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    return Math.round(parseFloat(trimmed))
  }

  if (trimmed.toLowerCase().includes('end')) {
    return 0
  }

  return undefined
}

function parsePeriodIndex(label: string, sportKey: string): number {
  if (!label) return 1

  const quarterMatch = label.match(/q(\d+)/i)
  if (quarterMatch) {
    return parseInt(quarterMatch[1], 10)
  }

  const periodWordMatch = label.match(/period\s*(\d+)/i)
  if (periodWordMatch) {
    return parseInt(periodWordMatch[1], 10)
  }

  const ordinalMatch = label.match(/(\d+)(?:st|nd|rd|th)/i)
  if (ordinalMatch) {
    return parseInt(ordinalMatch[1], 10)
  }

  if (label.includes('first half')) {
    return 1
  }
  if (label.includes('second half')) {
    const halfway = SPORT_TIMING[sportKey]?.regulationPeriods || 2
    return halfway / 2 + 1
  }

  if (label.includes('ot') || label.includes('overtime')) {
    const otMatch = label.match(/ot\s*(\d+)?/i)
    const otNumber = otMatch && otMatch[1] ? parseInt(otMatch[1], 10) : 1
    return (SPORT_TIMING[sportKey]?.regulationPeriods || 4) + otNumber
  }

  return 1
}
