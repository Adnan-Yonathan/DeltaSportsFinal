export type OddsSourceType = 'sportsbook' | 'exchange' | 'dfs'

export type OddsSourceKey =
  | 'fanduel'
  | 'draftkings'
  | 'betmgm'
  | 'caesars'
  | 'betrivers'
  | 'hardrockbet'
  | 'fanatics'
  | 'espnbet'
  | 'fliff'
  | 'circa'
  | 'pinnacle'
  | 'novig'
  | 'prophetx'
  | 'polymarket'
  | 'kalshi'
  | 'prizepicks'
  | 'underdog'
  | 'draftkings_pick6'
  | 'sleeper'

export type OddsSourceDefinition = {
  key: OddsSourceKey
  label: string
  type: OddsSourceType
  providerKeys: string[]
}

export const ODDS_SOURCES: OddsSourceDefinition[] = [
  { key: 'fanduel', label: 'FanDuel', type: 'sportsbook', providerKeys: ['fanduel'] },
  { key: 'draftkings', label: 'DraftKings', type: 'sportsbook', providerKeys: ['draftkings'] },
  { key: 'betmgm', label: 'BetMGM', type: 'sportsbook', providerKeys: ['betmgm'] },
  { key: 'caesars', label: 'Caesars', type: 'sportsbook', providerKeys: ['caesars'] },
  { key: 'betrivers', label: 'BetRivers', type: 'sportsbook', providerKeys: ['betrivers'] },
  { key: 'hardrockbet', label: 'Hard Rock Bet', type: 'sportsbook', providerKeys: ['hardrockbet', 'hardrock'] },
  {
    key: 'fanatics',
    label: 'Fanatics',
    type: 'sportsbook',
    providerKeys: ['fanatics', 'fanaticssportsbook', 'betfanatics'],
  },
  { key: 'espnbet', label: 'ESPN BET', type: 'sportsbook', providerKeys: ['espnbet', 'thescorebet'] },
  { key: 'fliff', label: 'Fliff', type: 'sportsbook', providerKeys: ['fliff'] },
  { key: 'circa', label: 'Circa', type: 'sportsbook', providerKeys: ['circa', 'circasports'] },
  { key: 'pinnacle', label: 'Pinnacle', type: 'sportsbook', providerKeys: ['pinnacle'] },
  {
    key: 'novig',
    label: 'NoVig',
    type: 'exchange',
    providerKeys: ['novig', 'novigus', 'novig_us'],
  },
  {
    key: 'prophetx',
    label: 'ProphetX',
    type: 'exchange',
    providerKeys: ['prophetx', 'prophet', 'prophetx_us', 'prophetxus'],
  },
  { key: 'polymarket', label: 'Polymarket', type: 'exchange', providerKeys: ['polymarket'] },
  { key: 'kalshi', label: 'Kalshi', type: 'exchange', providerKeys: ['kalshi'] },
  { key: 'prizepicks', label: 'PrizePicks', type: 'dfs', providerKeys: ['prizepicks'] },
  { key: 'underdog', label: 'Underdog', type: 'dfs', providerKeys: ['underdog'] },
  {
    key: 'draftkings_pick6',
    label: 'DraftKings Pick6',
    type: 'dfs',
    providerKeys: ['draftkings_pick6', 'draftkings-pick6', 'pick6', 'pick_6'],
  },
  { key: 'sleeper', label: 'Sleeper', type: 'dfs', providerKeys: ['sleeper'] },
]

const SOURCE_KEY_BY_ALIAS = new Map<string, OddsSourceKey>(
  ODDS_SOURCES.flatMap((entry) =>
    entry.providerKeys.map((providerKey) => [providerKey.toLowerCase(), entry.key] as const)
  )
)
const normalizeSourceAlias = (value?: string | null) =>
  String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]/g, '')

const SOURCE_KEY_BY_NORMALIZED_ALIAS = new Map<string, OddsSourceKey>(
  ODDS_SOURCES.flatMap((entry) =>
    entry.providerKeys.map((providerKey) => [normalizeSourceAlias(providerKey), entry.key] as const)
  )
)

const SOURCE_BY_KEY = new Map(ODDS_SOURCES.map((entry) => [entry.key, entry]))

export const INSIDER_ODDS_SOURCE_ORDER = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'betrivers',
  'hardrockbet',
  'fanatics',
  'espnbet',
  'fliff',
  'circa',
  'pinnacle',
  'novig',
  'prophetx',
  'polymarket',
  'kalshi',
] as const satisfies readonly OddsSourceKey[]

export const SHARP_PROPS_SOURCE_ORDER = [
  'polymarket',
  'kalshi',
  'novig',
  'fanduel',
  'circa',
  'prophetx',
  'prizepicks',
  'underdog',
  'draftkings_pick6',
  'sleeper',
] as const satisfies readonly OddsSourceKey[]

export const INSIDER_ODDS_SPORTSBOOK_PROVIDER_KEYS = [
  'fanduel',
  'draftkings',
  'betmgm',
  'caesars',
  'betrivers',
  'hardrockbet',
  'fanatics',
  'espnbet',
  'fliff',
  'circa',
  'pinnacle',
  'novig',
  'prophetx',
]

export const resolveOddsSourceKey = (value?: string | null): OddsSourceKey | null => {
  if (!value) return null
  const raw = String(value).toLowerCase().trim()
  const direct = SOURCE_KEY_BY_ALIAS.get(raw)
  if (direct) return direct
  const normalized = normalizeSourceAlias(value)
  const normalizedMatch = SOURCE_KEY_BY_NORMALIZED_ALIAS.get(normalized)
  if (normalizedMatch) return normalizedMatch
  if (normalized.includes('novig')) return 'novig'
  if (normalized.includes('prophetx') || normalized.includes('prophet')) return 'prophetx'
  return null
}

export const getOddsSource = (key: OddsSourceKey) => SOURCE_BY_KEY.get(key) ?? null
