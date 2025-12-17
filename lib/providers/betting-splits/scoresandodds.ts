/**
 * ScoresAndOdds.com Betting Splits Scraper
 *
 * Scrapes public betting percentages from ScoresAndOdds consensus page.
 * URL: https://www.scoresandodds.com/nba/consensus-picks
 *
 * This page typically shows 5-8 featured NBA games with:
 * - Bet percentages (% of tickets)
 * - Money percentages (% of handle)
 * - Spread, Total, and Moneyline consensus
 */

import type { BettingSplit, ScrapeOptions } from './types'

const BASE_URL = 'https://www.scoresandodds.com/nba/consensus-picks'
const DEFAULT_TIMEOUT = 10000

/**
 * Scrape ScoresAndOdds for NBA betting splits
 */
export async function scrapeScoresAndOddsSplits(
  options?: ScrapeOptions
): Promise<BettingSplit[]> {
  try {
    console.log('[ScoresAndOdds] Fetching consensus data...')

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), options?.timeout || DEFAULT_TIMEOUT)

    const response = await fetch(BASE_URL, {
      signal: controller.signal,
      headers: {
        'User-Agent': options?.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`[ScoresAndOdds] HTTP ${response.status}`)
      return []
    }

    const html = await response.text()
    const splits = parseScoresAndOddsHtml(html)

    console.log(`[ScoresAndOdds] Found ${splits.length} games`)
    return splits

  } catch (error) {
    console.error('[ScoresAndOdds] Scrape failed:', error)
    return []
  }
}

/**
 * Parse HTML to extract betting splits
 */
function parseScoresAndOddsHtml(html: string): BettingSplit[] {
  const splits: BettingSplit[] = []

  try {
    // Find game sections - they typically have team info and percentages together
    // Pattern: Look for team names followed by percentage data

    // Extract team matchups
    // Pattern: Team @ Team or Team vs Team
    const matchupPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:@|vs\.?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/gi
    const matchups = [...html.matchAll(matchupPattern)]

    if (matchups.length === 0) {
      console.warn('[ScoresAndOdds] No matchups found in HTML')
      return []
    }

    // For each matchup, find associated betting percentages
    for (const matchup of matchups) {
      const awayTeam = matchup[1].trim()
      const homeTeam = matchup[2].trim()

      // Find the section of HTML around this matchup (next 2000 chars)
      const matchupIndex = matchup.index || 0
      const section = html.slice(matchupIndex, matchupIndex + 2000)

      // Extract percentages from this section
      // Look for patterns like "65% of Bets" or "72% of Money"
      const betsPctPattern = /(\d+)%\s+of\s+Bets/gi
      const moneyPctPattern = /(\d+)%\s+of\s+Money/gi

      const betsPcts = [...section.matchAll(betsPctPattern)].map(m => parseInt(m[1]))
      const moneyPcts = [...section.matchAll(moneyPctPattern)].map(m => parseInt(m[1]))

      // ScoresAndOdds shows data in pairs (away, home)
      // For spread: first % is away, second is home
      if (betsPcts.length >= 2) {
        const split: BettingSplit = {
          source: 'scoresandodds',
          awayTeam,
          homeTeam,
          spreadAwayBetsPct: betsPcts[0],
          spreadHomeBetsPct: betsPcts[1],
          capturedAt: new Date(),
        }

        // Add money percentages if available
        if (moneyPcts.length >= 2) {
          split.spreadAwayMoneyPct = moneyPcts[0]
          split.spreadHomeMoneyPct = moneyPcts[1]
        }

        // Calculate sharp indicator if we have both bets% and money%
        if (split.spreadAwayMoneyPct && split.spreadHomeBetsPct) {
          const awayDivergence = Math.abs((split.spreadAwayMoneyPct || 0) - (split.spreadAwayBetsPct || 0))
          const homeDivergence = Math.abs((split.spreadHomeMoneyPct || 0) - (split.spreadHomeBetsPct || 0))

          if (awayDivergence >= 15) {
            split.sharpIndicator = (split.spreadAwayMoneyPct || 0) > (split.spreadAwayBetsPct || 0)
              ? 'sharp_away'
              : 'public_away'
          } else if (homeDivergence >= 15) {
            split.sharpIndicator = (split.spreadHomeMoneyPct || 0) > (split.spreadHomeBetsPct || 0)
              ? 'sharp_home'
              : 'public_home'
          } else {
            split.sharpIndicator = 'neutral'
          }
        }

        splits.push(split)
      }
    }

  } catch (error) {
    console.error('[ScoresAndOdds] Parse error:', error)
  }

  return splits
}

/**
 * Normalize team name for matching across sources
 */
export function normalizeTeamName(team: string): string {
  return team
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z]/g, '')
}

/**
 * Test scraper (for debugging)
 */
export async function testScoresAndOddsScraper(): Promise<void> {
  console.log('[Test] ScoresAndOdds Scraper')
  console.log('='.repeat(60))

  const splits = await scrapeScoresAndOddsSplits()

  if (splits.length === 0) {
    console.log('❌ No data found')
    return
  }

  console.log(`✓ Found ${splits.length} games\n`)

  for (const split of splits) {
    console.log(`${split.awayTeam} @ ${split.homeTeam}`)
    console.log(`  Bets:  Away ${split.spreadAwayBetsPct}% | Home ${split.spreadHomeBetsPct}%`)
    if (split.spreadAwayMoneyPct) {
      console.log(`  Money: Away ${split.spreadAwayMoneyPct}% | Home ${split.spreadHomeMoneyPct}%`)
    }
    if (split.sharpIndicator && split.sharpIndicator !== 'neutral') {
      console.log(`  ⚠️  Sharp: ${split.sharpIndicator}`)
    }
    console.log()
  }
}
