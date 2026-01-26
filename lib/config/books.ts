export type BookSource = 'odds' | 'prediction'

export const AVAILABLE_BOOKS = [
  // Prediction markets
  { key: 'kalshi', label: 'Kalshi', apiKey: null, source: 'prediction' },
  { key: 'polymarket', label: 'Polymarket', apiKey: null, source: 'prediction' },

  // US Primary
  { key: 'fanduel', label: 'FanDuel', apiKey: 'fanduel', source: 'odds' },
  { key: 'draftkings', label: 'DraftKings', apiKey: 'draftkings', source: 'odds' },
  { key: 'betmgm', label: 'BetMGM', apiKey: 'betmgm', source: 'odds' },
  { key: 'caesars', label: 'Caesars', apiKey: 'caesars', source: 'odds' },
  { key: 'pointsbetus', label: 'PointsBet', apiKey: 'pointsbetus', source: 'odds' },
  { key: 'betrivers', label: 'BetRivers', apiKey: 'betrivers', source: 'odds' },
  { key: 'unibet_us', label: 'Unibet', apiKey: 'unibet_us', source: 'odds' },
  { key: 'wynnbet', label: 'WynnBET', apiKey: 'wynnbet', source: 'odds' },
  { key: 'superbook', label: 'SuperBook', apiKey: 'superbook', source: 'odds' },
  { key: 'espnbet', label: 'ESPN BET', apiKey: 'espnbet', source: 'odds' },
  { key: 'hardrockbet', label: 'Hard Rock Bet', apiKey: 'hardrockbet', source: 'odds' },
  { key: 'betparx', label: 'BetParx', apiKey: 'betparx', source: 'odds' },
  { key: 'fliff', label: 'Fliff', apiKey: 'fliff', source: 'odds' },
  { key: 'livescorebet_us', label: 'LiveScore Bet', apiKey: 'livescorebet_us', source: 'odds' },
  { key: 'ballybet', label: 'Bally Bet', apiKey: 'ballybet', source: 'odds' },
  { key: 'circa', label: 'Circa Sports', apiKey: 'circa', source: 'odds' },
  { key: 'station', label: 'Station Casinos', apiKey: 'station', source: 'odds' },
  { key: 'sisportsbook', label: 'SI Sportsbook', apiKey: 'sisportsbook', source: 'odds' },
  { key: 'tipico_us', label: 'Tipico', apiKey: 'tipico_us', source: 'odds' },
  { key: 'williamhill_us', label: 'William Hill (US)', apiKey: 'williamhill_us', source: 'odds' },

  // Offshore / Sharp
  { key: 'pinnacle', label: 'Pinnacle', apiKey: 'pinnacle', source: 'odds' },
  { key: 'bovada', label: 'Bovada', apiKey: 'bovada', source: 'odds' },
  { key: 'betonlineag', label: 'BetOnline.ag', apiKey: 'betonlineag', source: 'odds' },
  { key: 'mybookieag', label: 'MyBookie.ag', apiKey: 'mybookieag', source: 'odds' },
  { key: 'betus', label: 'BetUS', apiKey: 'betus', source: 'odds' },
  { key: 'lowvig', label: 'LowVig.ag', apiKey: 'lowvig', source: 'odds' },
  { key: 'gtbets', label: 'GTbets', apiKey: 'gtbets', source: 'odds' },
  { key: 'betfair_ex_us', label: 'Betfair Exchange', apiKey: 'betfair_ex_us', source: 'odds' },
  { key: 'matchbook', label: 'Matchbook', apiKey: 'matchbook', source: 'odds' },

  // EU / UK Books
  { key: 'bet365', label: 'Bet365', apiKey: 'bet365', source: 'odds' },
  { key: 'williamhill', label: 'William Hill (UK)', apiKey: 'williamhill', source: 'odds' },
  { key: 'betway', label: 'Betway', apiKey: 'betway', source: 'odds' },
  { key: 'sport888', label: '888sport', apiKey: 'sport888', source: 'odds' },
  { key: 'unibet', label: 'Unibet (EU)', apiKey: 'unibet', source: 'odds' },
  { key: 'ladbrokes_uk', label: 'Ladbrokes', apiKey: 'ladbrokes_uk', source: 'odds' },
  { key: 'coral', label: 'Coral', apiKey: 'coral', source: 'odds' },
  { key: 'skybet', label: 'Sky Bet', apiKey: 'skybet', source: 'odds' },
  { key: 'paddypower', label: 'Paddy Power', apiKey: 'paddypower', source: 'odds' },
  { key: 'betvictor', label: 'BetVictor', apiKey: 'betvictor', source: 'odds' },
  { key: 'betfred', label: 'Betfred', apiKey: 'betfred', source: 'odds' },
  { key: 'betfair_sb_uk', label: 'Betfair Sportsbook', apiKey: 'betfair_sb_uk', source: 'odds' },
  { key: 'leovegas', label: 'LeoVegas', apiKey: 'leovegas', source: 'odds' },
  { key: 'nordicbet', label: 'NordicBet', apiKey: 'nordicbet', source: 'odds' },
  { key: 'marathon_bet', label: 'Marathon Bet', apiKey: 'marathon_bet', source: 'odds' },

  // Australia
  { key: 'sportsbet', label: 'Sportsbet', apiKey: 'sportsbet', source: 'odds' },
  { key: 'tab', label: 'TAB', apiKey: 'tab', source: 'odds' },
  { key: 'neds', label: 'Neds', apiKey: 'neds', source: 'odds' },
  { key: 'pointsbetau', label: 'PointsBet (AU)', apiKey: 'pointsbetau', source: 'odds' },
  { key: 'betfair_ex_au', label: 'Betfair Exchange (AU)', apiKey: 'betfair_ex_au', source: 'odds' },
] as const

export type BookKey = typeof AVAILABLE_BOOKS[number]['key']

export const DEFAULT_SELECTED_BOOKS: BookKey[] = [
  'fanduel',
  'betmgm',
  'bet365',
  'draftkings',
]

export function getBookApiKeys(selectedBooks: BookKey[]): string[] {
  const bookMap = new Map(AVAILABLE_BOOKS.map((book) => [book.key, book]))
  return selectedBooks
    .map((key) => bookMap.get(key))
    .filter((book) => book?.source === 'odds' && book?.apiKey)
    .map((book) => book?.apiKey as string)
}
