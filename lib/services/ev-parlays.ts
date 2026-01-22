import { findEVOpportunities } from '@/lib/services/cross-market-ev'
import type { BookOdds, EVOpportunity } from '@/lib/utils/ev-calculator'
import { calculateEV, findMarketConsensus } from '@/lib/utils/ev-calculator'
import { americanToDecimal, decimalToAmerican } from '@/lib/utils/odds'
import { SPORTS } from '@/lib/types/odds'

export type EvParlayLeg = {
  game: string
  gameId: string
  market: string
  selection: string
  point?: number
  bookOdds: Record<string, number>
  bestBook: string
  bestOdds: number
  consensusProbability: number
  commenceTime: string
}

export type EvParlay = {
  id: string
  legs: EvParlayLeg[]
  bestBook: string
  bestBookOdds: number
  legCount: number
  trueProbability: number
  minOddsForEv: number
  evPercent: number
}

const MIN_EV_PERCENT = 3
const MIN_LEG_EV_PERCENT = 0
const MIN_LEGS = 2
const MAX_LEGS = 5
const MAX_PARLAYS = 12
const MAX_POOL = 30
const DEFAULT_MAX_LEG_ODDS = 500

type EvParlayOptions = {
  maxLegOdds?: number
  maxParlayOdds?: number
}

const isPredictionMarketBook = (bookName?: string | null) => {
  if (!bookName) return false
  const normalized = bookName.toLowerCase()
  return normalized.includes('polymarket') || normalized.includes('kalshi')
}

const pickBestBook = (books: BookOdds[]): BookOdds | null => {
  if (!books.length) return null
  return books.reduce((best, current) => {
    const bestDecimal = americanToDecimal(best.odds)
    const currentDecimal = americanToDecimal(current.odds)
    return currentDecimal > bestDecimal ? current : best
  })
}

const buildLegPool = (
  opportunities: EVOpportunity[],
  maxLegOdds: number
): EvParlayLeg[] => {
  const eligibleLegs: EvParlayLeg[] = []

  for (const opp of opportunities) {
    const sportsbookBooks = opp.allBooks.filter((book) => {
      if (isPredictionMarketBook(book.bookmaker)) return false
      return true
    })

    if (sportsbookBooks.length < 2) continue

    const consensus = findMarketConsensus(sportsbookBooks)
    if (!Number.isFinite(consensus.impliedProbability) || consensus.impliedProbability <= 0) {
      continue
    }

    const eligibleBooks = sportsbookBooks.filter(
      (book) => !(book.odds > 0 && book.odds > maxLegOdds)
    )
    const bestBook = pickBestBook(eligibleBooks)
    if (!bestBook) continue

    const ev = calculateEV(consensus.impliedProbability, bestBook.odds)
    if (ev < MIN_LEG_EV_PERCENT) continue

    const bookOdds = sportsbookBooks.reduce<Record<string, number>>((acc, book) => {
      acc[book.bookmaker] = book.odds
      return acc
    }, {})

    eligibleLegs.push({
      game: opp.game,
      gameId: opp.gameId,
      market: opp.market,
      selection: opp.selection,
      point: opp.point,
      bookOdds,
      bestBook: bestBook.bookmaker,
      bestOdds: bestBook.odds,
      consensusProbability: consensus.impliedProbability,
      commenceTime: opp.commenceTime,
    })
  }

  return [...eligibleLegs].sort((a, b) => {
    const evA = calculateEV(a.consensusProbability, a.bestOdds)
    const evB = calculateEV(b.consensusProbability, b.bestOdds)
    return evB - evA
  })
}

const buildParlayId = (legs: EvParlayLeg[]): string =>
  legs
    .map((leg) => `${leg.gameId}:${leg.market}:${leg.selection}`)
    .join('|')

const calculateParlayMetrics = (legs: EvParlayLeg[]) => {
  const trueProbability = legs.reduce(
    (acc, leg) => acc * leg.consensusProbability,
    1
  )
  const minDecimal = (1 + MIN_EV_PERCENT / 100) / trueProbability
  const minOddsForEv = decimalToAmerican(minDecimal)

  return { trueProbability, minOddsForEv }
}

export async function buildEvParlays(
  options?: EvParlayOptions
): Promise<EvParlay[]> {
  const opportunities = await findEVOpportunities({
    includeProps: true,
    minEV: MIN_LEG_EV_PERCENT,
    minPropEV: MIN_LEG_EV_PERCENT,
    limit: 200,
    slateMode: 'next',
    sports: Object.values(SPORTS),
  })

  const maxLegOdds = options?.maxLegOdds ?? DEFAULT_MAX_LEG_ODDS
  const legPool = buildLegPool(opportunities, maxLegOdds).slice(0, MAX_POOL)
  const maxParlayOdds =
    options?.maxParlayOdds != null && Number.isFinite(options.maxParlayOdds)
      ? (options.maxParlayOdds as number)
      : null
  const parlays: EvParlay[] = []

  const buildCombos = (startIndex: number, current: EvParlayLeg[]) => {
    if (parlays.length >= MAX_PARLAYS) return

    if (current.length >= MIN_LEGS && current.length <= MAX_LEGS) {
      const metrics = calculateParlayMetrics(current)
      const commonBooks = current.reduce<string[]>((acc, leg) => {
        const books = Object.keys(leg.bookOdds)
        if (acc.length === 0) return books
        return acc.filter((book) => books.includes(book))
      }, [])

      if (!commonBooks.length) {
        return
      }

      let bestBook = ''
      let bestBookOdds = 0
      let bestEv = -Infinity

      for (const book of commonBooks) {
        const parlayDecimal = current.reduce((acc, leg) => {
          const odds = leg.bookOdds[book]
          return acc * americanToDecimal(odds)
        }, 1)
        const parlayOdds = decimalToAmerican(parlayDecimal)
        const evPercent = (metrics.trueProbability * parlayDecimal - 1) * 100
        if (evPercent > bestEv) {
          bestEv = evPercent
          bestBook = book
          bestBookOdds = parlayOdds
        }
      }

      if (bestEv >= MIN_EV_PERCENT && bestBook) {
        if (
          maxParlayOdds != null &&
          Number.isFinite(bestBookOdds) &&
          bestBookOdds > maxParlayOdds
        ) {
          return
        }
        parlays.push({
          id: buildParlayId(current),
          legs: [...current],
          bestBook,
          bestBookOdds,
          legCount: current.length,
          trueProbability: metrics.trueProbability,
          minOddsForEv: metrics.minOddsForEv,
          evPercent: bestEv,
        })
      }
    }

    if (current.length === MAX_LEGS) return

    for (let i = startIndex; i < legPool.length; i += 1) {
      if (parlays.length >= MAX_PARLAYS) return
      const candidate = legPool[i]
      buildCombos(i + 1, [...current, candidate])
    }
  }

  buildCombos(0, [])

  return parlays
}
