import { fetchOdds } from '@/lib/api/odds-api'
import {
  getOddsSource,
  INSIDER_ODDS_SOURCE_ORDER,
  resolveOddsSourceKey,
  type OddsSourceKey,
} from '@/lib/config/odds-sources'
import { normalizeTeamKey } from '@/lib/identity/sport'
import type { OddsGame, OddsMarket, OddsOutcome } from '@/lib/types/odds'

type ParsedTeams = {
  away: string
  home: string
}

type InsiderMarketType = 'h2h' | 'spreads' | 'totals'
type TotalsSide = 'over' | 'under'

type ParsedSelection = {
  marketType: InsiderMarketType
  team?: string
  totalSide?: TotalsSide
  line?: number
}

export type InsiderOddsQuote = {
  sourceKey: OddsSourceKey
  sourceLabel: string
  oddsAmerican: number | null
  marketType: InsiderMarketType
  line: number | null
  updatedAt: string | null
}

export type InsiderOddsSnapshot = {
  quotes: InsiderOddsQuote[]
  bestOddsAmerican: number | null
  bestOddsBook: string | null
  sourceCount: number
  snapshotAt: string
}

export type InsiderOddsPositionInput = {
  slug: string
  title: string
  outcome: string
  sportLabel: string | null
  currentAmericanOdds?: number | null
}

const SPORT_LABEL_TO_ODDS_KEY: Record<string, string> = {
  NBA: 'basketball_nba',
  NFL: 'americanfootball_nfl',
  MLB: 'baseball_mlb',
  NHL: 'icehockey_nhl',
  NCAAB: 'basketball_ncaab',
  NCAAF: 'americanfootball_ncaaf',
}

const LINE_TOLERANCE = 0.15
const SPLIT_PATTERN = /\s+(?:vs\.?|v\.?|@|at)\s+/i

const parseSignedLine = (value?: string | null) => {
  if (!value) return null
  const match = String(value).match(/([+-]?\d+(?:\.\d+)?)/)
  if (!match) return null
  const parsed = Number(match[1])
  return Number.isFinite(parsed) ? parsed : null
}

const normalizeName = (value?: string | null) =>
  normalizeTeamKey(String(value ?? '').trim())

const cleanTeamLabel = (value: string) => value.split(':')[0]?.trim() ?? ''

const parseTeamsFromTitle = (title?: string | null): ParsedTeams | null => {
  if (!title) return null
  const parts = String(title).split(SPLIT_PATTERN)
  if (parts.length !== 2) return null
  const away = cleanTeamLabel(parts[0] ?? '')
  const home = cleanTeamLabel(parts[1] ?? '')
  if (!away || !home) return null
  return { away, home }
}

const resolveMarketType = (title: string, outcome: string): InsiderMarketType => {
  const combined = `${title} ${outcome}`.toLowerCase()
  if (combined.includes('over') || combined.includes('under') || combined.includes('total')) {
    return 'totals'
  }
  if (combined.includes('spread') || /[+-]\d/.test(combined)) {
    return 'spreads'
  }
  return 'h2h'
}

const resolveTotalsSide = (title: string, outcome: string): TotalsSide | undefined => {
  const combined = `${title} ${outcome}`.toLowerCase()
  if (combined.includes('over')) return 'over'
  if (combined.includes('under')) return 'under'
  return undefined
}

const resolveSelection = (title: string, outcome: string, teams: ParsedTeams | null): ParsedSelection => {
  const marketType = resolveMarketType(title, outcome)
  const line = parseSignedLine(outcome) ?? parseSignedLine(title) ?? undefined

  if (marketType === 'totals') {
    return { marketType, totalSide: resolveTotalsSide(title, outcome), line }
  }

  if (marketType === 'spreads' || marketType === 'h2h') {
    if (!teams) return { marketType, line }
    const outcomeKey = normalizeName(outcome)
    const awayKey = normalizeName(teams.away)
    const homeKey = normalizeName(teams.home)
    const team =
      outcomeKey && awayKey && (outcomeKey.includes(awayKey) || awayKey.includes(outcomeKey))
        ? teams.away
        : outcomeKey && homeKey && (outcomeKey.includes(homeKey) || homeKey.includes(outcomeKey))
          ? teams.home
          : undefined
    return { marketType, team, line }
  }

  return { marketType, line }
}

const findMatchingGame = (games: OddsGame[], teams: ParsedTeams | null) => {
  if (!teams) return null
  const awayKey = normalizeName(teams.away)
  const homeKey = normalizeName(teams.home)
  if (!awayKey || !homeKey) return null
  return (
    games.find((game) => {
      const gameAway = normalizeName(game.away_team)
      const gameHome = normalizeName(game.home_team)
      return (
        (gameAway.includes(awayKey) && gameHome.includes(homeKey)) ||
        (gameAway.includes(homeKey) && gameHome.includes(awayKey))
      )
    }) ?? null
  )
}

const findOutcomeForSelection = (
  market: OddsMarket,
  selection: ParsedSelection,
  teams: ParsedTeams | null
): OddsOutcome | null => {
  const outcomes = market.outcomes ?? []

  if (selection.marketType === 'h2h') {
    if (!selection.team) return null
    const teamKey = normalizeName(selection.team)
    if (!teamKey) return null
    return (
      outcomes.find((outcome) => {
        const nameKey = normalizeName(outcome.name)
        return nameKey.includes(teamKey) || teamKey.includes(nameKey)
      }) ?? null
    )
  }

  if (selection.marketType === 'totals') {
    if (!selection.totalSide) return null
    const isOver = selection.totalSide === 'over'
    const candidates = outcomes.filter((outcome) => {
      const name = String(outcome.name ?? '').toLowerCase()
      return isOver ? name.includes('over') : name.includes('under')
    })
    if (!candidates.length) return null
    if (selection.line == null) return candidates[0] ?? null
    const exact = candidates.find((outcome) => {
      const point = Number(outcome.point)
      return Number.isFinite(point) && Math.abs(point - selection.line!) <= LINE_TOLERANCE
    })
    return exact ?? candidates[0] ?? null
  }

  if (selection.marketType === 'spreads') {
    if (!selection.team) return null
    const teamKey = normalizeName(selection.team)
    const candidates = outcomes.filter((outcome) => {
      const nameKey = normalizeName(outcome.name)
      return nameKey.includes(teamKey) || teamKey.includes(nameKey)
    })
    if (!candidates.length) return null
    if (selection.line == null) return candidates[0] ?? null
    const exact = candidates.find((outcome) => {
      const point = Number(outcome.point)
      return Number.isFinite(point) && Math.abs(point - selection.line!) <= LINE_TOLERANCE
    })
    if (exact) return exact

    if (!teams) return candidates[0] ?? null
    const teamIsAway = normalizeName(selection.team) === normalizeName(teams.away)
    const fallbackLine = teamIsAway ? selection.line : -selection.line
    const alt = candidates.find((outcome) => {
      const point = Number(outcome.point)
      return Number.isFinite(point) && Math.abs(point - fallbackLine) <= LINE_TOLERANCE
    })
    return alt ?? candidates[0] ?? null
  }

  return null
}

const resolveOddsMarket = (gameBookMarket: OddsMarket[], marketType: InsiderMarketType) => {
  if (marketType === 'h2h') {
    return gameBookMarket.find((market) => market.key === 'h2h') ?? null
  }
  if (marketType === 'spreads') {
    return gameBookMarket.find((market) => market.key === 'spreads') ?? null
  }
  return gameBookMarket.find((market) => market.key === 'totals') ?? null
}

const resolveSnapshotKey = (position: InsiderOddsPositionInput) =>
  `${position.slug}::${position.outcome}`

const buildEmptyQuotes = (marketType: InsiderMarketType): InsiderOddsQuote[] =>
  INSIDER_ODDS_SOURCE_ORDER.map((sourceKey) => ({
    sourceKey,
    sourceLabel: getOddsSource(sourceKey)?.label ?? sourceKey,
    oddsAmerican: null,
    marketType,
    line: null,
    updatedAt: null,
  }))

const resolveBestOdds = (quotes: InsiderOddsQuote[]) => {
  let best: InsiderOddsQuote | null = null
  for (const quote of quotes) {
    if (quote.oddsAmerican == null || !Number.isFinite(quote.oddsAmerican)) continue
    if (!best || quote.oddsAmerican > best.oddsAmerican!) {
      best = quote
    }
  }
  return {
    bestOddsAmerican: best?.oddsAmerican ?? null,
    bestOddsBook: best?.sourceLabel ?? null,
    sourceCount: quotes.filter((quote) => quote.oddsAmerican != null).length,
  }
}

const buildSportGamesMap = async (positions: InsiderOddsPositionInput[]) => {
  const sportLabels = Array.from(
    new Set(
      positions
        .map((position) => String(position.sportLabel ?? '').trim().toUpperCase())
        .filter(Boolean)
    )
  )
  const gamesMap = new Map<string, OddsGame[]>()
  await Promise.all(
    sportLabels.map(async (sportLabel) => {
      const sportKey = SPORT_LABEL_TO_ODDS_KEY[sportLabel]
      if (!sportKey) {
        gamesMap.set(sportLabel, [])
        return
      }
      try {
        const games = await fetchOdds(sportKey, ['h2h', 'spreads', 'totals'], {
          live: false,
          revalidateSeconds: 600,
          includePredictionMarkets: true,
          forceProvider: 'the-odds-api',
        })
        gamesMap.set(sportLabel, games)
      } catch (error) {
        console.warn('[insider-odds] sportsbook snapshot fetch failed:', sportLabel, error)
        gamesMap.set(sportLabel, [])
      }
    })
  )
  return gamesMap
}

export const buildInsiderOddsSnapshots = async (
  positions: InsiderOddsPositionInput[]
): Promise<Map<string, InsiderOddsSnapshot>> => {
  const result = new Map<string, InsiderOddsSnapshot>()
  if (!positions.length) return result

  const snapshotAt = new Date().toISOString()
  const gamesBySport = await buildSportGamesMap(positions)

  for (const position of positions) {
    const teams = parseTeamsFromTitle(position.title)
    const selection = resolveSelection(position.title, position.outcome, teams)
    const sportLabel = String(position.sportLabel ?? '').trim().toUpperCase()
    const games = gamesBySport.get(sportLabel) ?? []
    const game = findMatchingGame(games, teams)

    const quoteBySource = new Map<OddsSourceKey, InsiderOddsQuote>()
    for (const quote of buildEmptyQuotes(selection.marketType)) {
      quoteBySource.set(quote.sourceKey, quote)
    }

    if (game) {
      for (const book of game.bookmakers ?? []) {
        const sourceKey =
          resolveOddsSourceKey(book.key) ??
          resolveOddsSourceKey(book.title) ??
          null
        if (!sourceKey || !quoteBySource.has(sourceKey)) continue
        const market = resolveOddsMarket(book.markets ?? [], selection.marketType)
        if (!market) continue
        const outcome = findOutcomeForSelection(market, selection, teams)
        if (!outcome) continue
        const oddsAmerican = Number(outcome.price)
        if (!Number.isFinite(oddsAmerican)) continue
        const existing = quoteBySource.get(sourceKey)
        if (!existing) continue
        if (existing.oddsAmerican != null && existing.oddsAmerican >= oddsAmerican) continue
        quoteBySource.set(sourceKey, {
          ...existing,
          sourceLabel: book.title ?? sourceKey,
          oddsAmerican,
          line: Number.isFinite(Number(outcome.point)) ? Number(outcome.point) : null,
          updatedAt: market.last_update ?? book.last_update ?? null,
        })
      }
    }

    if (position.currentAmericanOdds != null && Number.isFinite(position.currentAmericanOdds)) {
      const existing = quoteBySource.get('polymarket')
      if (existing && existing.oddsAmerican == null) {
        quoteBySource.set('polymarket', {
          ...existing,
          sourceLabel: 'Polymarket',
          oddsAmerican: Math.round(position.currentAmericanOdds),
          line: selection.line ?? null,
          updatedAt: snapshotAt,
        })
      }
    }

    const orderedQuotes = INSIDER_ODDS_SOURCE_ORDER.map((sourceKey) => {
      const quote = quoteBySource.get(sourceKey)
      if (quote) return quote
      return {
        sourceKey,
        sourceLabel: getOddsSource(sourceKey)?.label ?? sourceKey,
        oddsAmerican: null,
        marketType: selection.marketType,
        line: selection.line ?? null,
        updatedAt: null,
      } satisfies InsiderOddsQuote
    })

    const { bestOddsAmerican, bestOddsBook, sourceCount } = resolveBestOdds(orderedQuotes)

    result.set(resolveSnapshotKey(position), {
      quotes: orderedQuotes,
      bestOddsAmerican,
      bestOddsBook,
      sourceCount,
      snapshotAt,
    })
  }

  return result
}
