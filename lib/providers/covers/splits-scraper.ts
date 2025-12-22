/**
 * SportsBettingDime Public Betting Splits Fetcher
 *
 * Replaces Covers.com scraping with SBD odds + bettingSplits payloads.
 * Source: https://www.sportsbettingdime.com/nba/public-betting-trends/
 */

import { fetchSbdOdds, getDefaultBookIds, resolveSbdLeague, resolveSportKey, buildTeamLabel } from '@/lib/api/sbd'
import type { CoversBettingSplits, CoversMatchup, CoversSplitsScraperResult } from './types'
import type { CoversFetchOptions } from './client'

const SBD_PUBLIC_TRENDS_URL = 'https://www.sportsbettingdime.com/nba/public-betting-trends/'

const resolveLeague = (sport: string, league: string): string | null => {
  const sportKey = `${sport}_${league}`.toLowerCase()
  return resolveSbdLeague(sportKey) || resolveSbdLeague(league) || null
}

const asNumber = (value: any): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

const mapSbdGameToSplits = (league: string, game: any): CoversBettingSplits => {
  const sportKey = resolveSportKey(league) || `${league}`
  const homeTeam = buildTeamLabel(game?.competitors?.home)
  const awayTeam = buildTeamLabel(game?.competitors?.away)
  const bettingSplits = game?.bettingSplits || {}

  return {
    gameId: String(game?.id ?? ''),
    homeTeam,
    awayTeam,
    gameTime: game?.scheduled ? new Date(game.scheduled) : undefined,
    sportKey,
    spreadHomeBetsPct: asNumber(bettingSplits?.spread?.home?.betsPercentage),
    spreadAwayBetsPct: asNumber(bettingSplits?.spread?.away?.betsPercentage),
    spreadHomeMoneyPct: asNumber(bettingSplits?.spread?.home?.stakePercentage),
    spreadAwayMoneyPct: asNumber(bettingSplits?.spread?.away?.stakePercentage),
    mlHomeBetsPct: asNumber(bettingSplits?.moneyline?.home?.betsPercentage),
    mlAwayBetsPct: asNumber(bettingSplits?.moneyline?.away?.betsPercentage),
    mlHomeMoneyPct: asNumber(bettingSplits?.moneyline?.home?.stakePercentage),
    mlAwayMoneyPct: asNumber(bettingSplits?.moneyline?.away?.stakePercentage),
    totalOverBetsPct: asNumber(bettingSplits?.total?.over?.betsPercentage),
    totalUnderBetsPct: asNumber(bettingSplits?.total?.under?.betsPercentage),
    totalOverMoneyPct: asNumber(bettingSplits?.total?.over?.stakePercentage),
    totalUnderMoneyPct: asNumber(bettingSplits?.total?.under?.stakePercentage),
    capturedAt: new Date(),
  }
}

export async function getDailyMatchups(
  sport: string = 'basketball',
  league: string = 'nba',
  _options?: CoversFetchOptions
): Promise<CoversMatchup[]> {
  const resolved = resolveLeague(sport, league)
  if (!resolved) return []

  try {
    const payload = await fetchSbdOdds(resolved as any, { books: getDefaultBookIds() })
    const games = Array.isArray(payload?.data) ? payload.data : []
    return games.map((game: any) => ({
      gameId: String(game?.id ?? ''),
      homeTeam: buildTeamLabel(game?.competitors?.home),
      awayTeam: buildTeamLabel(game?.competitors?.away),
      gameTime: game?.scheduled,
      matchupUrl: SBD_PUBLIC_TRENDS_URL,
    }))
  } catch (error) {
    console.error('[SBD Splits] Failed to fetch daily matchups:', error)
    return []
  }
}

export async function scrapeGameSplits(
  gameId: string,
  sport: string = 'basketball',
  league: string = 'nba',
  options?: CoversFetchOptions
): Promise<CoversSplitsScraperResult> {
  const scrapedAt = new Date()
  const result = await scrapeDailySplits(sport, league, options)

  if (!result.success || !result.data) {
    return {
      success: false,
      error: result.error || 'No betting splits found',
      url: result.url || SBD_PUBLIC_TRENDS_URL,
      scrapedAt,
    }
  }

  const game = result.data.find((entry) => entry.gameId === gameId)
  if (!game) {
    return {
      success: false,
      error: `Game ${gameId} not found in splits data`,
      url: result.url || SBD_PUBLIC_TRENDS_URL,
      scrapedAt,
    }
  }

  return {
    success: true,
    data: [game],
    url: result.url || SBD_PUBLIC_TRENDS_URL,
    scrapedAt,
  }
}

export async function scrapeDailySplits(
  sport: string = 'basketball',
  league: string = 'nba',
  _options?: CoversFetchOptions
): Promise<CoversSplitsScraperResult> {
  const scrapedAt = new Date()
  const resolved = resolveLeague(sport, league)
  if (!resolved) {
    return {
      success: false,
      error: `Unsupported sport/league: ${sport}_${league}`,
      url: SBD_PUBLIC_TRENDS_URL,
      scrapedAt,
    }
  }

  try {
    const payload = await fetchSbdOdds(resolved as any, { books: getDefaultBookIds() })
    const games = Array.isArray(payload?.data) ? payload.data : []
    const splits = games
      .filter((game: any) => Boolean(game?.bettingSplits))
      .map((game: any) => mapSbdGameToSplits(resolved, game))

    return {
      success: true,
      data: splits,
      url: SBD_PUBLIC_TRENDS_URL,
      scrapedAt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url: SBD_PUBLIC_TRENDS_URL,
      scrapedAt,
    }
  }
}

export async function scrapePublicMoneySplits(
  sport: string = 'basketball',
  league: string = 'nba',
  _options?: CoversFetchOptions
): Promise<CoversSplitsScraperResult> {
  const scrapedAt = new Date()
  return {
    success: false,
    error: 'SBD splits include handle percentages in the primary feed',
    url: SBD_PUBLIC_TRENDS_URL,
    scrapedAt,
  }
}

export async function testScrapeSplits(): Promise<void> {
  console.log('[Test] Fetching SBD betting splits...')
  const result = await scrapeDailySplits()

  if (result.success && result.data) {
    console.log(`[Test] Found ${result.data.length} games`)
    for (const split of result.data.slice(0, 3)) {
      console.log(`\n${split.awayTeam} @ ${split.homeTeam}:`)
      console.log(
        `  Spread: Away ${split.spreadAwayBetsPct}%/${split.spreadAwayMoneyPct}% | Home ${split.spreadHomeBetsPct}%/${split.spreadHomeMoneyPct}%`
      )
      if (split.totalOverBetsPct !== undefined) {
        console.log(
          `  Total: Over ${split.totalOverBetsPct}%/${split.totalOverMoneyPct}% | Under ${split.totalUnderBetsPct}%/${split.totalUnderMoneyPct}%`
        )
      }
    }
  } else {
    console.log('[Test] Failed:', result.error)
  }
}
