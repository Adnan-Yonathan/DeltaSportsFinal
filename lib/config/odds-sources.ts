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
  { key: 'novig', label: 'NoVig', type: 'exchange', providerKeys: ['novig', 'novigus'] },
  { key: 'prophetx', label: 'ProphetX', type: 'exchange', providerKeys: ['prophetx', 'prophet'] },
  { key: 'polymarket', label: 'Polymarket', type: 'exchange', providerKeys: ['polymarket'] },
  { key: 'kalshi', label: 'Kalshi', type: 'exchange', providerKeys: ['kalshi'] },
  { key: 'prizepicks', label: 'PrizePicks', type: 'dfs', providerKeys: ['prizepicks'] },
  { key: 'underdog', label: 'Underdog', type: 'dfs', providerKeys: ['underdog'] },
  {
    key: 'draftkings_pick6',
    label: 'DraftKings Pick6',
    type: 'dfs',
    providerKeys: ['draftkings_pick6', 'draftkings-pick6'],
  },
  { key: 'sleeper', label: 'Sleeper', type: 'dfs', providerKeys: ['sleeper'] },
]

const SOURCE_KEY_BY_ALIAS = new Map<string, OddsSourceKey>(
  ODDS_SOURCES.flatMap((entry) =>
    entry.providerKeys.map((providerKey) => [providerKey.toLowerCase(), entry.key] as const)
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
  'pinnacle',
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
  return SOURCE_KEY_BY_ALIAS.get(String(value).toLowerCase().trim()) ?? null
}

export const getOddsSource = (key: OddsSourceKey) => SOURCE_BY_KEY.get(key) ?? null
