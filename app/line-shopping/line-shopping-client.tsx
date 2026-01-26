'use client'

import { useCallback, useEffect, useState, useRef } from 'react'
import { Check, ChevronDown, RefreshCw, Trophy, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const SPORTS = [
  { key: 'nba', label: 'NBA' },
  { key: 'ncaab', label: 'NCAAB' },
  { key: 'nfl', label: 'NFL' },
  { key: 'ncaaf', label: 'NCAAF' },
  { key: 'nhl', label: 'NHL' },
  { key: 'mlb', label: 'MLB' },
]

// All available bookmakers from The Odds API
const ALL_BOOKS = [
  // US Primary (most popular)
  { key: 'fanduel', label: 'FanDuel', region: 'us' },
  { key: 'draftkings', label: 'DraftKings', region: 'us' },
  { key: 'betmgm', label: 'BetMGM', region: 'us' },
  { key: 'caesars', label: 'Caesars', region: 'us' },
  { key: 'pointsbetus', label: 'PointsBet', region: 'us' },
  { key: 'betrivers', label: 'BetRivers', region: 'us' },
  { key: 'unibet_us', label: 'Unibet', region: 'us' },
  { key: 'wynnbet', label: 'WynnBET', region: 'us' },
  { key: 'superbook', label: 'SuperBook', region: 'us' },
  { key: 'espnbet', label: 'ESPN BET', region: 'us' },
  { key: 'hardrockbet', label: 'Hard Rock Bet', region: 'us' },
  { key: 'betparx', label: 'BetParx', region: 'us' },
  { key: 'fliff', label: 'Fliff', region: 'us' },
  { key: 'livescorebet_us', label: 'LiveScore Bet', region: 'us' },
  { key: 'ballybet', label: 'Bally Bet', region: 'us' },
  { key: 'circa', label: 'Circa Sports', region: 'us' },
  { key: 'station', label: 'Station Casinos', region: 'us' },
  { key: 'sisportsbook', label: 'SI Sportsbook', region: 'us' },
  { key: 'tipico_us', label: 'Tipico', region: 'us' },
  { key: 'williamhill_us', label: 'William Hill', region: 'us' },

  // Offshore / International Sharp
  { key: 'pinnacle', label: 'Pinnacle', region: 'sharp' },
  { key: 'bovada', label: 'Bovada', region: 'offshore' },
  { key: 'betonlineag', label: 'BetOnline.ag', region: 'offshore' },
  { key: 'mybookieag', label: 'MyBookie.ag', region: 'offshore' },
  { key: 'betus', label: 'BetUS', region: 'offshore' },
  { key: 'lowvig', label: 'LowVig.ag', region: 'offshore' },
  { key: 'gtbets', label: 'GTbets', region: 'offshore' },
  { key: 'betfair_ex_us', label: 'Betfair Exchange', region: 'sharp' },
  { key: 'matchbook', label: 'Matchbook', region: 'sharp' },

  // EU / UK Books
  { key: 'bet365', label: 'Bet365', region: 'eu' },
  { key: 'williamhill', label: 'William Hill (UK)', region: 'eu' },
  { key: 'betway', label: 'Betway', region: 'eu' },
  { key: 'sport888', label: '888sport', region: 'eu' },
  { key: 'unibet', label: 'Unibet (EU)', region: 'eu' },
  { key: 'ladbrokes_uk', label: 'Ladbrokes', region: 'eu' },
  { key: 'coral', label: 'Coral', region: 'eu' },
  { key: 'skybet', label: 'Sky Bet', region: 'eu' },
  { key: 'paddypower', label: 'Paddy Power', region: 'eu' },
  { key: 'betvictor', label: 'BetVictor', region: 'eu' },
  { key: 'betfred', label: 'Betfred', region: 'eu' },
  { key: 'betfair_sb_uk', label: 'Betfair Sportsbook', region: 'eu' },
  { key: 'leovegas', label: 'LeoVegas', region: 'eu' },
  { key: 'nordicbet', label: 'NordicBet', region: 'eu' },
  { key: 'marathon_bet', label: 'Marathon Bet', region: 'eu' },

  // Australia
  { key: 'sportsbet', label: 'Sportsbet', region: 'au' },
  { key: 'tab', label: 'TAB', region: 'au' },
  { key: 'neds', label: 'Neds', region: 'au' },
  { key: 'pointsbetau', label: 'PointsBet (AU)', region: 'au' },
  { key: 'betfair_ex_au', label: 'Betfair Exchange (AU)', region: 'au' },
]

// Default selection (US books)
const DEFAULT_BOOKS = ALL_BOOKS.filter(b => b.region === 'us').map(b => b.key)

type BookOutcome = {
  bookmaker: string
  bookTitle: string
  price: number
  point?: number
}

type GameOdds = {
  id: string
  homeTeam: string
  awayTeam: string
  commenceTime: string
  spreads: {
    home: BookOutcome[]
    away: BookOutcome[]
  }
  totals: {
    over: BookOutcome[]
    under: BookOutcome[]
  }
  h2h: {
    home: BookOutcome[]
    away: BookOutcome[]
  }
}

const formatOdds = (price: number) => {
  if (price >= 100) return `+${price}`
  if (price <= -100) return `${price}`
  return price > 0 ? `+${price}` : `${price}`
}

const formatTime = (time: string) => {
  try {
    const date = new Date(time)
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

const getBestOdds = (outcomes: BookOutcome[], selectedBooks: string[]): BookOutcome | null => {
  const filtered = outcomes.filter(o => selectedBooks.includes(o.bookmaker.toLowerCase()))
  if (filtered.length === 0) return null
  return filtered.reduce((best, curr) => curr.price > best.price ? curr : best)
}

const REGION_LABELS: Record<string, string> = {
  us: 'US Sportsbooks',
  offshore: 'Offshore',
  sharp: 'Sharp Books',
  eu: 'Europe / UK',
  au: 'Australia',
}

export default function LineShoppingClient({
  previewMode = false,
}: {
  previewMode?: boolean
}) {
  const [sport, setSport] = useState('nba')
  const [games, setGames] = useState<GameOdds[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedBooks, setSelectedBooks] = useState<string[]>(DEFAULT_BOOKS)
  const [bookSelectorOpen, setBookSelectorOpen] = useState(false)
  const [bookSearch, setBookSearch] = useState('')
  const [marketFilter, setMarketFilter] = useState<'all' | 'spreads' | 'totals' | 'moneyline'>('all')
  const [availableBooks, setAvailableBooks] = useState<string[]>([])
  const bookSelectorRef = useRef<HTMLDivElement>(null)

  // Close book selector on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (bookSelectorRef.current && !bookSelectorRef.current.contains(event.target as Node)) {
        setBookSelectorOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleBook = (bookKey: string) => {
    setSelectedBooks(prev => {
      if (prev.includes(bookKey)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter(b => b !== bookKey)
      }
      return [...prev, bookKey]
    })
  }

  const selectAllBooks = () => {
    setSelectedBooks(ALL_BOOKS.map(b => b.key))
  }

  const selectRegion = (region: string) => {
    const regionBooks = ALL_BOOKS.filter(b => b.region === region).map(b => b.key)
    setSelectedBooks(regionBooks)
  }

  const clearSelection = () => {
    setSelectedBooks(DEFAULT_BOOKS)
  }

  const fetchGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      // Use the new line-shopping API endpoint
      const res = await fetch(`/api/line-shopping?sport=${sport}`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        throw new Error(errData.error || 'Failed to fetch odds')
      }

      const data = await res.json()
      const rawGames = data.games || []

      // Track which books have odds
      if (data.booksFound) {
        setAvailableBooks(data.booksFound)
      }

      // Transform API response to our format
      const transformed: GameOdds[] = rawGames.map((game: any) => {
        const spreads: GameOdds['spreads'] = { home: [], away: [] }
        const totals: GameOdds['totals'] = { over: [], under: [] }
        const h2h: GameOdds['h2h'] = { home: [], away: [] }

        game.bookmakers?.forEach((bookmaker: any) => {
          const bookKey = bookmaker.key?.toLowerCase()
          const bookTitle = bookmaker.title || bookmaker.key

          bookmaker.markets?.forEach((market: any) => {
            if (market.key === 'spreads') {
              market.outcomes?.forEach((outcome: any) => {
                const entry = {
                  bookmaker: bookKey,
                  bookTitle,
                  price: outcome.price,
                  point: outcome.point,
                }
                if (outcome.name === game.home_team) {
                  spreads.home.push(entry)
                } else {
                  spreads.away.push(entry)
                }
              })
            } else if (market.key === 'totals') {
              market.outcomes?.forEach((outcome: any) => {
                const entry = {
                  bookmaker: bookKey,
                  bookTitle,
                  price: outcome.price,
                  point: outcome.point,
                }
                if (outcome.name === 'Over') {
                  totals.over.push(entry)
                } else {
                  totals.under.push(entry)
                }
              })
            } else if (market.key === 'h2h') {
              market.outcomes?.forEach((outcome: any) => {
                const entry = {
                  bookmaker: bookKey,
                  bookTitle,
                  price: outcome.price,
                }
                if (outcome.name === game.home_team) {
                  h2h.home.push(entry)
                } else {
                  h2h.away.push(entry)
                }
              })
            }
          })
        })

        return {
          id: game.id,
          homeTeam: game.home_team,
          awayTeam: game.away_team,
          commenceTime: game.commence_time,
          spreads,
          totals,
          h2h,
        }
      })

      setGames(transformed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load odds')
    } finally {
      setLoading(false)
    }
  }, [sport])

  useEffect(() => {
    fetchGames()
  }, [fetchGames])

  // Filter books based on search
  const filteredBooks = bookSearch
    ? ALL_BOOKS.filter(b =>
        b.label.toLowerCase().includes(bookSearch.toLowerCase()) ||
        b.key.toLowerCase().includes(bookSearch.toLowerCase())
      )
    : ALL_BOOKS

  // Group books by region for display
  const groupedBooks = filteredBooks.reduce((acc, book) => {
    if (!acc[book.region]) acc[book.region] = []
    acc[book.region].push(book)
    return acc
  }, {} as Record<string, typeof ALL_BOOKS>)

  // Only show books that are selected AND have odds
  const visibleBooks = ALL_BOOKS.filter(b =>
    selectedBooks.includes(b.key) && availableBooks.includes(b.key)
  )

  const renderMarketRow = (
    label: string,
    outcomes: BookOutcome[],
    selectedBooks: string[]
  ) => {
    const best = getBestOdds(outcomes, selectedBooks)
    const point = outcomes[0]?.point

    return (
      <div className="flex items-center gap-2 py-2 overflow-x-auto">
        <div className="w-28 shrink-0 text-sm text-white/70">
          {label} {point !== undefined && <span className="text-white/50">({point > 0 ? '+' : ''}{point})</span>}
        </div>
        <div className="flex gap-2">
          {visibleBooks.map(book => {
            const outcome = outcomes.find(o => o.bookmaker === book.key)
            const isBest = outcome && best && outcome.price === best.price && outcome.bookmaker === best.bookmaker

            return (
              <div
                key={book.key}
                className={cn(
                  'rounded-lg border px-3 py-1.5 text-center min-w-[80px] shrink-0',
                  isBest
                    ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
                    : outcome
                      ? 'border-white/10 bg-white/5 text-white/70'
                      : 'border-white/5 bg-white/[0.02] text-white/30'
                )}
              >
                <div className="text-[10px] text-white/40 mb-0.5 truncate" title={book.label}>
                  {book.label.length > 10 ? book.label.slice(0, 8) + '..' : book.label}
                </div>
                <div className="text-sm font-semibold flex items-center justify-center gap-1">
                  {outcome ? formatOdds(outcome.price) : '—'}
                  {isBest && <Trophy className="h-3 w-3 text-emerald-400" />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const visibleGames = previewMode ? games.slice(0, 1) : games

  const renderGameCard = (game: GameOdds) => (
    <div
      key={game.id}
      className="rounded-2xl border border-white/10 bg-white/5 p-5"
    >
      {/* Game Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {game.awayTeam} @ {game.homeTeam}
          </h3>
          <span className="text-xs text-white/50">{formatTime(game.commenceTime)}</span>
        </div>
      </div>

      {/* Spreads */}
      {(marketFilter === 'all' || marketFilter === 'spreads') && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Spread</div>
          {renderMarketRow(game.awayTeam, game.spreads.away, selectedBooks)}
          {renderMarketRow(game.homeTeam, game.spreads.home, selectedBooks)}
        </div>
      )}

      {/* Totals */}
      {(marketFilter === 'all' || marketFilter === 'totals') && (
        <div className="mb-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Total</div>
          {renderMarketRow('Over', game.totals.over, selectedBooks)}
          {renderMarketRow('Under', game.totals.under, selectedBooks)}
        </div>
      )}

      {/* Moneyline */}
      {(marketFilter === 'all' || marketFilter === 'moneyline') && (
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 mb-2">Moneyline</div>
          {renderMarketRow(game.awayTeam, game.h2h.away, selectedBooks)}
          {renderMarketRow(game.homeTeam, game.h2h.home, selectedBooks)}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sport Selector */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {SPORTS.map(s => (
            <button
              key={s.key}
              type="button"
              onClick={() => setSport(s.key)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition',
                sport === s.key
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Book Selector */}
        <div className="relative" ref={bookSelectorRef}>
          <button
            type="button"
            onClick={() => setBookSelectorOpen(!bookSelectorOpen)}
            className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:border-white/20"
          >
            <span>
              {selectedBooks.length === ALL_BOOKS.length
                ? 'All Books'
                : `${selectedBooks.length} of ${ALL_BOOKS.length} Books`}
            </span>
            <ChevronDown className={cn('h-4 w-4 transition', bookSelectorOpen && 'rotate-180')} />
          </button>

          {bookSelectorOpen && (
            <div className="absolute top-full mt-2 z-50 w-80 max-h-[70vh] overflow-hidden rounded-xl border border-white/10 bg-black/95 shadow-xl backdrop-blur flex flex-col">
              {/* Search */}
              <div className="p-2 border-b border-white/10">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <input
                    type="text"
                    value={bookSearch}
                    onChange={e => setBookSearch(e.target.value)}
                    placeholder="Search books..."
                    className="w-full rounded-lg bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-white/20"
                  />
                  {bookSearch && (
                    <button
                      type="button"
                      onClick={() => setBookSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="p-2 border-b border-white/10 flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={selectAllBooks}
                  className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => selectRegion('us')}
                  className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  US Only
                </button>
                <button
                  type="button"
                  onClick={() => selectRegion('sharp')}
                  className="rounded-lg px-2 py-1 text-xs text-emerald-300/70 hover:bg-emerald-500/10"
                >
                  Sharp Books
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="rounded-lg px-2 py-1 text-xs text-white/70 hover:bg-white/10"
                >
                  Reset
                </button>
              </div>

              {/* Book List */}
              <div className="overflow-y-auto p-2 space-y-3">
                {Object.entries(groupedBooks).map(([region, books]) => (
                  <div key={region}>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/40 px-2 mb-1">
                      {REGION_LABELS[region] || region}
                    </div>
                    <div className="space-y-0.5">
                      {books.map(book => {
                        const hasOdds = availableBooks.includes(book.key)
                        return (
                          <button
                            key={book.key}
                            type="button"
                            onClick={() => toggleBook(book.key)}
                            className={cn(
                              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition',
                              hasOdds
                                ? 'text-white/70 hover:bg-white/5'
                                : 'text-white/30 hover:bg-white/[0.02]'
                            )}
                          >
                            <span className="flex items-center gap-2">
                              {book.label}
                              {!hasOdds && (
                                <span className="text-[10px] text-white/30">(no odds)</span>
                              )}
                            </span>
                            {selectedBooks.includes(book.key) && (
                              <Check className="h-4 w-4 text-emerald-400" />
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer */}
              <div className="p-2 border-t border-white/10 text-[10px] text-white/40 text-center">
                {availableBooks.length} books with odds • {selectedBooks.length} selected
              </div>
            </div>
          )}
        </div>

        {/* Market Filter */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 p-1">
          {(['all', 'spreads', 'totals', 'moneyline'] as const).map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMarketFilter(m)}
              className={cn(
                'rounded-full px-3 py-1.5 text-[10px] uppercase tracking-[0.15em] transition',
                marketFilter === m
                  ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                  : 'text-white/50 hover:text-white hover:bg-white/5'
              )}
            >
              {m === 'all' ? 'All' : m === 'moneyline' ? 'ML' : m}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          type="button"
          onClick={fetchGames}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:border-white/20 disabled:opacity-50"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Available Books Banner */}
      {!loading && availableBooks.length > 0 && (
        <div className="flex items-center gap-2 text-[11px] text-white/50">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-emerald-300">
            <span className="font-semibold">{availableBooks.length}</span> books with odds
          </span>
          <span>•</span>
          <span>Showing {visibleBooks.length} selected books</span>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-white/60">
            <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/70" />
            Loading odds from The Odds API...
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Games */}
      {!loading && !error && games.length === 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-8 text-center">
          <p className="text-sm text-white/60">No games found for this sport.</p>
        </div>
      )}

      <div className="space-y-4">
        {visibleGames.map((game) => renderGameCard(game))}
      </div>
      {previewMode && (
        <div className="relative mt-4 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
          <div className="pointer-events-none blur-sm space-y-4 px-4 py-6">
            {[1, 2].map((row) => (
              <div
                key={row}
                className="rounded-xl border border-white/10 bg-white/5 p-5"
              >
                <div className="h-4 w-48 rounded bg-white/10 mb-3" />
                <div className="h-20 w-full rounded bg-white/5" />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <div className="rounded-2xl border border-white/20 bg-black/80 px-6 py-5 text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-white/50">
                Upgrade required
              </p>
              <h2 className="mt-3 text-xl font-semibold text-white">
                Upgrade to get full access.
              </h2>
              <p className="mt-2 text-sm text-white/60">
                Compare every line across all books.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-[11px] text-white/50">
        <strong className="text-white/70">Line Shopping</strong> compares odds across{' '}
        <span className="text-emerald-300">{ALL_BOOKS.length}+ sportsbooks</span> via The Odds API
        so you can always get the best price. The best odds for each market are highlighted
        with a trophy icon. Sharp books like Pinnacle are great for finding true market value.
      </div>
    </div>
  )
}
