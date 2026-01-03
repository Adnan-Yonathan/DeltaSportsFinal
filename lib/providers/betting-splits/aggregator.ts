/**
 * Multi-Source Betting Splits Aggregator
 *
 * Combines betting splits from multiple sources to maximize coverage.
 * Priority: SportsBettingDime > ScoresAndOdds > Others
 *
 * Strategy:
 * 1. Scrape from all available sources
 * 2. Deduplicate games (match by team names)
 * 3. Merge data (fill gaps, prefer higher-quality sources)
 * 4. Return consolidated results
 */

import { scrapeDailySplits as scrapeSbd } from '../covers/splits-scraper'
import { scrapeScoresAndOddsSplits } from './scoresandodds'
import type {
  BettingSplit,
  AggregatedSplitsResult,
  SourceResult,
  ScrapeOptions,
} from './types'

/**
 * Normalize team name for matching across sources
 * Handles different spellings, abbreviations, etc.
 */
function normalizeTeamName(team: string): string {
  return team
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim()
}

/**
 * Generate unique game ID from team names
 */
function generateGameId(awayTeam: string, homeTeam: string): string {
  const away = normalizeTeamName(awayTeam)
  const home = normalizeTeamName(homeTeam)
  return `${away}@${home}`
}

/**
 * Merge two splits for the same game
 * Prioritizes data from the first split, fills gaps from second
 */
function mergeSplits(primary: BettingSplit, secondary: BettingSplit): BettingSplit {
  return {
    ...secondary,
    ...primary,
    // Fill in missing money percentages
    spreadAwayMoneyPct: primary.spreadAwayMoneyPct ?? secondary.spreadAwayMoneyPct,
    spreadHomeMoneyPct: primary.spreadHomeMoneyPct ?? secondary.spreadHomeMoneyPct,
    totalOverMoneyPct: primary.totalOverMoneyPct ?? secondary.totalOverMoneyPct,
    totalUnderMoneyPct: primary.totalUnderMoneyPct ?? secondary.totalUnderMoneyPct,
    mlAwayMoneyPct: primary.mlAwayMoneyPct ?? secondary.mlAwayMoneyPct,
    mlHomeMoneyPct: primary.mlHomeMoneyPct ?? secondary.mlHomeMoneyPct,
    // Prefer primary sharp indicator if it exists
    sharpIndicator: primary.sharpIndicator ?? secondary.sharpIndicator,
    // Keep primary source attribution
    source: primary.source,
  }
}

/**
 * Calculate sharp indicator if not already set
 */
function calculateSharpIndicator(split: BettingSplit): BettingSplit {
  if (split.sharpIndicator) return split // Already calculated

  // Need both bets% and money% to detect sharp action
  const hasSpreadData =
    split.spreadAwayBetsPct != null &&
    split.spreadHomeBetsPct != null &&
    split.spreadAwayMoneyPct != null &&
    split.spreadHomeMoneyPct != null

  if (!hasSpreadData) return split

  // Calculate divergence (15%+ indicates sharp action)
  const awayDivergence = Math.abs(
    (split.spreadAwayMoneyPct || 0) - (split.spreadAwayBetsPct || 0)
  )
  const homeDivergence = Math.abs(
    (split.spreadHomeMoneyPct || 0) - (split.spreadHomeBetsPct || 0)
  )

  // Sharp money is when money% significantly exceeds bets%
  if (awayDivergence >= 15) {
    split.sharpIndicator =
      (split.spreadAwayMoneyPct || 0) > (split.spreadAwayBetsPct || 0)
        ? 'sharp_away'
        : 'public_away'
  } else if (homeDivergence >= 15) {
    split.sharpIndicator =
      (split.spreadHomeMoneyPct || 0) > (split.spreadHomeBetsPct || 0)
        ? 'sharp_home'
        : 'public_home'
  } else {
    split.sharpIndicator = 'neutral'
  }

  return split
}

/**
 * Aggregate betting splits from all available sources
 */
export async function aggregateBettingSplits(
  sport: string = 'basketball',
  league: string = 'nba',
  options?: ScrapeOptions
): Promise<AggregatedSplitsResult> {
  const startTime = Date.now()
  console.log('[Aggregator] Starting multi-source betting splits collection...')

  const sourceResults: SourceResult[] = []
  const splitsMap = new Map<string, BettingSplit>() // gameId -> BettingSplit

  // ============================================================================
  // SOURCE 1: SportsBettingDime (Highest Priority)
  // ============================================================================
  try {
    console.log('[Aggregator] Source 1: SportsBettingDime')
    const coversResult = await scrapeSbd(sport, league)

    if (coversResult.success && coversResult.data) {
      let addedCount = 0

      for (const split of coversResult.data) {
        const gameId = generateGameId(split.awayTeam, split.homeTeam)
        splitsMap.set(gameId, {
          ...split,
          source: 'sportsbettingdime' as const,
        })
        addedCount++
      }

      sourceResults.push({
        source: 'sportsbettingdime',
        games: addedCount,
        success: true,
      })

      console.log(`[Aggregator] ✓ SportsBettingDime: ${addedCount} games`)
    } else {
      sourceResults.push({
        source: 'sportsbettingdime',
        games: 0,
        success: false,
        error: coversResult.error,
      })
      console.log(`[Aggregator] ✗ SportsBettingDime failed: ${coversResult.error}`)
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    sourceResults.push({
      source: 'sportsbettingdime',
      games: 0,
      success: false,
      error: errorMsg,
    })
    console.error('[Aggregator] ✗ SportsBettingDime exception:', errorMsg)
  }

  // ============================================================================
  // SOURCE 2: ScoresAndOdds.com (Secondary)
  // ============================================================================
  try {
    console.log('[Aggregator] Source 2: ScoresAndOdds.com')
    const scoresOddsSplits = await scrapeScoresAndOddsSplits(options)

    let addedCount = 0
    let mergedCount = 0

    for (const split of scoresOddsSplits) {
      const gameId = generateGameId(split.awayTeam, split.homeTeam)

      if (!splitsMap.has(gameId)) {
        // New game not in SBD - add it
        splitsMap.set(gameId, split)
        addedCount++
      } else {
        // Game already exists - merge data (SBD has priority)
        const existing = splitsMap.get(gameId)!
        const merged = mergeSplits(existing, split)
        splitsMap.set(gameId, merged)
        mergedCount++
      }
    }

    sourceResults.push({
      source: 'scoresandodds',
      games: addedCount,
      success: true,
    })

    console.log(
      `[Aggregator] ✓ ScoresAndOdds: ${addedCount} new games, ${mergedCount} merged`
    )
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error'
    sourceResults.push({
      source: 'scoresandodds',
      games: 0,
      success: false,
      error: errorMsg,
    })
    console.error('[Aggregator] ✗ ScoresAndOdds exception:', errorMsg)
  }

  // ============================================================================
  // POST-PROCESSING
  // ============================================================================

  // Calculate sharp indicators for all splits
  const finalSplits = Array.from(splitsMap.values()).map(calculateSharpIndicator)

  const elapsed = Date.now() - startTime

  const result: AggregatedSplitsResult = {
    totalSources: sourceResults.length,
    sourceResults,
    totalGames: finalSplits.length,
    uniqueGames: finalSplits.length,
    coverage: finalSplits.length, // Could calculate % if we know total schedule
    splits: finalSplits,
    timestamp: new Date(),
  }

  console.log('[Aggregator] Complete!')
  console.log(`  Total games: ${result.totalGames}`)
  console.log(`  Sources used: ${result.totalSources}`)
  console.log(`  Time elapsed: ${elapsed}ms`)

  return result
}

/**
 * Get betting splits with automatic source fallback
 * Simplified wrapper around aggregateBettingSplits
 */
export async function getBettingSplits(
  sport: string = 'basketball',
  league: string = 'nba'
): Promise<BettingSplit[]> {
  const result = await aggregateBettingSplits(sport, league)
  return result.splits
}

/**
 * Test the aggregator
 */
export async function testAggregator(): Promise<void> {
  console.log('='.repeat(60))
  console.log('Multi-Source Betting Splits Aggregator Test')
  console.log('='.repeat(60))
  console.log()

  const result = await aggregateBettingSplits()

  console.log()
  console.log('Results:')
  console.log(`  Total games: ${result.totalGames}`)
  console.log(`  Unique games: ${result.uniqueGames}`)
  console.log()
  console.log('Source Breakdown:')
  for (const source of result.sourceResults) {
    const status = source.success ? '✓' : '✗'
    console.log(`  ${status} ${source.source}: ${source.games} games`)
    if (source.error) {
      console.log(`    Error: ${source.error}`)
    }
  }

  console.log()
  console.log('Sample Games:')
  for (const split of result.splits.slice(0, 3)) {
    console.log(`\n${split.awayTeam} @ ${split.homeTeam} (${split.source})`)
    console.log(
      `  Bets:  Away ${split.spreadAwayBetsPct}% | Home ${split.spreadHomeBetsPct}%`
    )
    if (split.spreadAwayMoneyPct) {
      console.log(
        `  Money: Away ${split.spreadAwayMoneyPct}% | Home ${split.spreadHomeMoneyPct}%`
      )
    }
    if (split.sharpIndicator && split.sharpIndicator !== 'neutral') {
      console.log(`  ⚠️  ${split.sharpIndicator}`)
    }
  }

  console.log()
  console.log('='.repeat(60))
}
