export type CanonicalSportKey =
  | 'basketball_nba'
  | 'basketball_ncaab'
  | 'americanfootball_nfl'
  | 'americanfootball_ncaaf'
  | 'baseball_mlb'
  | 'icehockey_nhl'

const SPORT_ALIASES: Record<string, CanonicalSportKey> = {
  basketball_nba: 'basketball_nba',
  nba: 'basketball_nba',
  basketball: 'basketball_nba',
  'basketball nba': 'basketball_nba',
  wnba: 'basketball_nba',

  basketball_ncaab: 'basketball_ncaab',
  ncaab: 'basketball_ncaab',
  cbb: 'basketball_ncaab',
  collegebasketball: 'basketball_ncaab',
  'mens college basketball': 'basketball_ncaab',
  'college basketball': 'basketball_ncaab',
  'college-basketball': 'basketball_ncaab',
  'mens-college-basketball': 'basketball_ncaab',

  americanfootball_nfl: 'americanfootball_nfl',
  nfl: 'americanfootball_nfl',
  football: 'americanfootball_nfl',
  'american football': 'americanfootball_nfl',

  americanfootball_ncaaf: 'americanfootball_ncaaf',
  ncaaf: 'americanfootball_ncaaf',
  cfb: 'americanfootball_ncaaf',
  'college football': 'americanfootball_ncaaf',

  baseball_mlb: 'baseball_mlb',
  mlb: 'baseball_mlb',
  baseball: 'baseball_mlb',

  icehockey_nhl: 'icehockey_nhl',
  nhl: 'icehockey_nhl',
  hockey: 'icehockey_nhl',
  'ice hockey': 'icehockey_nhl',
}

const normalizeSportInput = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[_\s-]+/g, ' ')

export const resolveSportKey = (
  sport?: string | null
): CanonicalSportKey | undefined => {
  if (!sport) return undefined
  const raw = normalizeSportInput(sport)
  if (!raw) return undefined

  if (SPORT_ALIASES[raw]) {
    return SPORT_ALIASES[raw]
  }

  if (raw.includes('ncaab') || raw.includes('cbb')) {
    return 'basketball_ncaab'
  }
  if (raw.includes('ncaaf') || raw.includes('cfb')) {
    return 'americanfootball_ncaaf'
  }

  if (raw.includes('basketball')) {
    return raw.includes('college') ? 'basketball_ncaab' : 'basketball_nba'
  }
  if (raw.includes('football')) {
    return raw.includes('college') ? 'americanfootball_ncaaf' : 'americanfootball_nfl'
  }
  if (raw.includes('baseball')) {
    return 'baseball_mlb'
  }
  if (raw.includes('hockey')) {
    return 'icehockey_nhl'
  }

  return undefined
}

export const resolveSportKeyFromCandidates = (
  ...candidates: Array<string | null | undefined>
) => {
  for (const candidate of candidates) {
    const resolved = resolveSportKey(candidate)
    if (resolved) return resolved
  }
  return undefined
}

export const normalizeName = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim()

const TEAM_KEY_ALIASES: Record<string, string> = {
  oaklandraiders: 'lasvegasraiders',
}

export const normalizeTeamKey = (value: string) => {
  const normalized = value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, '')
  return TEAM_KEY_ALIASES[normalized] ?? normalized
}
