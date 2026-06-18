import {
  isNflDraftPolymarketMarket,
  resolveNflDraftSportKeyFromPolymarketEvent,
} from './polymarket-draft'

type TradeSportInput = {
  slug?: string | null
  eventSlug?: string | null
  title?: string | null
}

type GammaEventSportInput = {
  title?: string | null
  seriesSlug?: string | null
  series?: Array<{ slug?: string | null; title?: string | null }>
  tags?: Array<{ slug?: string | null; label?: string | null }>
}

const SPORT_PREFIXES = [
  'nba-', 'wnba-', 'nfl-', 'cfb-', 'cbb-', 'ncaab-', 'ncaaf-',
  'nhl-', 'mlb-', 'baseball-', 'mls-',
  'ucl-', 'uel-', 'uecl-', 'epl-', 'laliga-', 'bundesliga-', 'seriea-',
  'ligue1-', 'soccer-fifwc-', 'fifwc-', 'soccer-', 'fifa-', 'coppa-', 'facup-',
  'atp-', 'wta-', 'tennis-',
  'cs2-', 'csgo-', 'lol-', 'dota2-', 'val-', 'rl-', 'cod-', 'esports-',
  'shl-', 'khl-', 'liiga-',
  'euroleague-', 'eurocup-', 'bkcl-',
  'mma-', 'ufc-', 'boxing-', 'pfl-', 'bellator-',
  'golf-', 'pga-', 'cricket-', 'ipl-', 'f1-', 'nascar-', 'racing-',
  'rugby-', 'afl-', 'olympics-',
  'cwbb-', 'mex-', 'per1-',
]

export const INSIDER_SPORT_LABEL_MAP: Record<string, string> = {
  nba: 'NBA', wnba: 'WNBA', nfl: 'NFL', nhl: 'NHL', mlb: 'MLB', baseball: 'MLB', mls: 'MLS',
  cfb: 'NCAAF', cbb: 'NCAAB', ncaab: 'NCAAB', ncaaf: 'NCAAF',
  ucl: 'UCL', uel: 'UEL', uecl: 'UECL', epl: 'EPL', laliga: 'LA LIGA',
  bundesliga: 'BUNDESLIGA', seriea: 'SERIE A', ligue1: 'LIGUE 1',
  soccer: 'SOCCER', 'soccer-fifwc': 'FIFWC', fifwc: 'FIFWC', fifa: 'FIFA',
  coppa: 'COPPA', facup: 'FA CUP',
  atp: 'ATP', wta: 'WTA', tennis: 'TENNIS',
  cs2: 'CS2', csgo: 'CS2', lol: 'LOL', dota2: 'DOTA 2', val: 'VALORANT',
  rl: 'ROCKET LEAGUE', cod: 'COD', esports: 'ESPORTS',
  shl: 'SHL', khl: 'KHL', liiga: 'LIIGA',
  euroleague: 'EUROLEAGUE', eurocup: 'EUROCUP', bkcl: 'BKCL',
  mma: 'MMA', ufc: 'UFC', boxing: 'BOXING', pfl: 'PFL', bellator: 'BELLATOR',
  golf: 'GOLF', pga: 'PGA', cricket: 'CRICKET', ipl: 'IPL',
  f1: 'F1', nascar: 'NASCAR', racing: 'RACING',
  rugby: 'RUGBY', afl: 'AFL', olympics: 'OLYMPICS',
  cwbb: 'CWBB', mex: 'LIGA MX', per1: 'PERU PRIMERA',
}

const normalizeSlug = (value?: string | null): string =>
  String(value ?? '').trim().toLowerCase()

const MLB_TITLE_HINT = /\b(mlb|major league baseball|baseball)\b/i

const sportKeyFromSlug = (slug: string): string | null => {
  const prefix = SPORT_PREFIXES.find((p) => slug.startsWith(p))
  if (!prefix) return null
  return prefix.slice(0, -1)
}

const resolveDraftSportKeyFromText = (...values: Array<string | null | undefined>): string | null => {
  return values.some(isNflDraftPolymarketMarket) ? 'nfl' : null
}

export const resolveInsiderSportKeyFromEvent = (event: GammaEventSportInput): string | null => {
  const directSeriesSlug = normalizeSlug(
    String(event.seriesSlug ?? event.series?.[0]?.slug ?? '')
  )
  if (directSeriesSlug) {
    if (directSeriesSlug === 'soccer-fifwc') return 'fifwc'
    const directKey = sportKeyFromSlug(`${directSeriesSlug}-`)
    if (directKey) return directKey
    if (directSeriesSlug === 'mlb' || directSeriesSlug.includes('baseball')) return 'mlb'
  }

  const eventSeriesTitle = String(event.series?.map((entry) => entry?.title ?? '').join(' ') ?? '')
  const eventTitle = String(event.title ?? '')
  const draftKey = resolveNflDraftSportKeyFromPolymarketEvent(event)
  if (draftKey) return draftKey
  if (MLB_TITLE_HINT.test(`${eventSeriesTitle} ${eventTitle}`)) return 'mlb'
  return null
}

export const resolveInsiderTradeSportKey = (trade: TradeSportInput): string | null => {
  const slugKey = sportKeyFromSlug(normalizeSlug(trade.slug))
  if (slugKey) return slugKey

  const eventSlugKey = sportKeyFromSlug(normalizeSlug(trade.eventSlug))
  if (eventSlugKey) return eventSlugKey

  const draftKey = resolveDraftSportKeyFromText(trade.slug, trade.eventSlug, trade.title)
  if (draftKey) return draftKey

  if (MLB_TITLE_HINT.test(String(trade.title ?? ''))) return 'mlb'
  return null
}
