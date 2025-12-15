/**
 * Covers.com ATS Trends Scraper
 * 
 * Scrapes team ATS (Against The Spread) records from Covers team pages.
 * URL pattern: https://www.covers.com/sport/basketball/nba/teams/main/{team-slug}/ats-trends
 */

import {
  fetchCoversHtml,
  buildATSTrendsUrl,
  getTeamName,
  getAllTeamSlugs,
  type CoversFetchOptions,
} from './client'
import type { CoversATSRecord, CoversATSScraperResult } from './types'
import { getCurrentNBASeason, parseATSRecord } from './mapper'

// =============================================================================
// HTML Parsing Helpers
// =============================================================================

/**
 * Extract text content between two markers in HTML
 */
function extractBetween(html: string, startMarker: string, endMarker: string): string | null {
  const startIdx = html.indexOf(startMarker)
  if (startIdx === -1) return null
  
  const searchStart = startIdx + startMarker.length
  const endIdx = html.indexOf(endMarker, searchStart)
  if (endIdx === -1) return null
  
  return html.substring(searchStart, endIdx).trim()
}

/**
 * Extract all matches of a pattern
 */
function extractAllMatches(html: string, pattern: RegExp): string[] {
  const matches: string[] = []
  let match
  while ((match = pattern.exec(html)) !== null) {
    matches.push(match[1])
  }
  return matches
}

/**
 * Clean HTML tags from string
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// ATS Record Extraction
// =============================================================================

/**
 * Extract ATS record from a table row or section
 * Looks for patterns like "18-12-2" or "18-12"
 */
function extractATSRecordFromText(text: string): string | null {
  // Match record patterns: "18-12-2" or "18-12"
  const match = text.match(/\b(\d{1,2})-(\d{1,2})(?:-(\d{1,2}))?\b/)
  if (!match) return null
  
  const wins = parseInt(match[1], 10)
  const losses = parseInt(match[2], 10)
  const pushes = match[3] ? parseInt(match[3], 10) : 0
  
  // Sanity check: wins + losses + pushes should be reasonable (< 100 games)
  if (wins + losses + pushes > 100) return null
  
  return pushes > 0 ? `${wins}-${losses}-${pushes}` : `${wins}-${losses}`
}

/**
 * Extract streak from text (e.g., "W3", "L2", "P1")
 */
function extractStreak(text: string): string | null {
  const match = text.match(/\b([WLP])(\d{1,2})\b/i)
  if (!match) return null
  return `${match[1].toUpperCase()}${match[2]}`
}

/**
 * Parse the ATS trends page HTML to extract all records
 * 
 * Covers.com structure (as of 2024):
 * - Main records in "record-block" divs with "record-label" and "record-value"
 * - Game-by-game results in table with ATS column showing "W -9.5" or "L -3.5"
 */
function parseATSTrendsPage(html: string, teamSlug: string, sportKey: string): CoversATSRecord | null {
  const teamName = getTeamName(teamSlug, sportKey) || teamSlug
  const season = getCurrentNBASeason()
  
  // Initialize record with defaults
  const record: CoversATSRecord = {
    teamName,
    teamSlug,
    sportKey,
    season,
    atsWins: 0,
    atsLosses: 0,
    atsPushes: 0,
    atsRecord: '0-0',
    capturedAt: new Date(),
  }
  
  // ==========================================================================
  // Strategy 1: Look for record-block structure (main summary)
  // <div class="record-label">Against the Spread</div>
  // <div class="record-value">14-11-0</div>
  // ==========================================================================
  
  // ATS Record
  const atsBlockPattern = /record-label[^>]*>Against the Spread<\/div>\s*<div[^>]*class="record-value"[^>]*>(\d+-\d+(?:-\d+)?)</i
  const atsMatch = html.match(atsBlockPattern)
  if (atsMatch) {
    record.atsRecord = atsMatch[1]
    const parsed = parseATSRecord(atsMatch[1])
    if (parsed) {
      record.atsWins = parsed.wins
      record.atsLosses = parsed.losses
      record.atsPushes = parsed.pushes
    }
  }
  
  // Over/Under (Totals) Record
  const ouBlockPattern = /record-label[^>]*>Totals<\/div>\s*<div[^>]*class="record-value"[^>]*>(\d+-\d+(?:-\d+)?)</i
  const ouMatch = html.match(ouBlockPattern)
  if (ouMatch) {
    record.overUnderRecord = ouMatch[1]
  }
  
  // ==========================================================================
  // Strategy 2: Calculate home/away from game-by-game table
  // Table rows contain: @ TOR (away) or LAL (home) + ATS result (W/L/P)
  // ==========================================================================
  
  // Extract game results from table
  // Pattern: <td>...<span class="covers-CoversMatchups-boldTextHelper">W</span> -9.5</td>
  const gameResultPattern = /<tr>[\s\S]*?(?:@ ([A-Z]{2,3})|([A-Z]{2,3}))[\s\S]*?<td><span[^>]*>([WLP])<\/span>/gi
  
  let homeWins = 0, homeLosses = 0, homePushes = 0
  let awayWins = 0, awayLosses = 0, awayPushes = 0
  let last10Results: string[] = []
  
  let match
  while ((match = gameResultPattern.exec(html)) !== null) {
    const isAway = !!match[1] // Has @ prefix
    const result = match[3]?.toUpperCase()
    
    if (result === 'W') {
      if (isAway) awayWins++
      else homeWins++
    } else if (result === 'L') {
      if (isAway) awayLosses++
      else homeLosses++
    } else if (result === 'P') {
      if (isAway) awayPushes++
      else homePushes++
    }
    
    // Track last 10
    if (last10Results.length < 10 && result) {
      last10Results.push(result)
    }
  }
  
  // Set home/away records if we found game data
  if (homeWins + homeLosses + homePushes > 0) {
    record.homeAtsRecord = formatRecord(homeWins, homeLosses, homePushes)
  }
  if (awayWins + awayLosses + awayPushes > 0) {
    record.awayAtsRecord = formatRecord(awayWins, awayLosses, awayPushes)
  }
  
  // Calculate last 10 ATS
  if (last10Results.length > 0) {
    const l10Wins = last10Results.filter(r => r === 'W').length
    const l10Losses = last10Results.filter(r => r === 'L').length
    const l10Pushes = last10Results.filter(r => r === 'P').length
    record.last10Ats = formatRecord(l10Wins, l10Losses, l10Pushes)
    
    // Calculate streak from most recent games
    let streak = 0
    let streakType = last10Results[0]
    for (const r of last10Results) {
      if (r === streakType) streak++
      else break
    }
    if (streak > 0 && streakType) {
      record.atsStreak = `${streakType}${streak}`
    }
  }
  
  // ==========================================================================
  // Fallback: If we still don't have main ATS record, calculate from games
  // ==========================================================================
  
  if (record.atsRecord === '0-0') {
    const totalWins = homeWins + awayWins
    const totalLosses = homeLosses + awayLosses
    const totalPushes = homePushes + awayPushes
    
    if (totalWins + totalLosses + totalPushes > 0) {
      record.atsWins = totalWins
      record.atsLosses = totalLosses
      record.atsPushes = totalPushes
      record.atsRecord = formatRecord(totalWins, totalLosses, totalPushes)
    }
  }
  
  // Validate we got at least some data
  if (record.atsRecord === '0-0' && !record.homeAtsRecord && !record.awayAtsRecord) {
    console.warn(`[Covers ATS] No ATS data found for ${teamSlug}`)
    return null
  }
  
  return record
}

/**
 * Format wins/losses/pushes into record string
 */
function formatRecord(wins: number, losses: number, pushes: number = 0): string {
  if (pushes > 0) {
    return `${wins}-${losses}-${pushes}`
  }
  return `${wins}-${losses}`
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Scrape ATS trends for a single team
 */
export async function scrapeTeamATSTrends(
  teamSlug: string,
  sport: string = 'basketball',
  league: string = 'nba',
  options?: CoversFetchOptions
): Promise<CoversATSScraperResult> {
  const url = buildATSTrendsUrl(sport, league, teamSlug)
  const scrapedAt = new Date()
  
  try {
    const html = await fetchCoversHtml(url, options)
    const record = parseATSTrendsPage(html, teamSlug, `${sport}_${league}`)
    
    if (!record) {
      return {
        success: false,
        error: 'Could not parse ATS data from page',
        url,
        scrapedAt,
      }
    }
    
    return {
      success: true,
      data: record,
      url,
      scrapedAt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url,
      scrapedAt,
    }
  }
}

/**
 * Scrape ATS trends for all NBA teams
 */
export async function scrapeAllNBAATSTrends(
  options?: CoversFetchOptions
): Promise<Map<string, CoversATSScraperResult>> {
  const results = new Map<string, CoversATSScraperResult>()
  const slugs = getAllTeamSlugs('basketball_nba')
  
  console.log(`[Covers ATS] Scraping ${slugs.length} NBA teams...`)
  
  for (const slug of slugs) {
    console.log(`[Covers ATS] Scraping ${slug}...`)
    const result = await scrapeTeamATSTrends(slug, 'basketball', 'nba', options)
    results.set(slug, result)
    
    if (result.success) {
      console.log(`[Covers ATS] ${slug}: ${result.data?.atsRecord}`)
    } else {
      console.warn(`[Covers ATS] ${slug}: Failed - ${result.error}`)
    }
  }
  
  const successCount = Array.from(results.values()).filter(r => r.success).length
  console.log(`[Covers ATS] Complete: ${successCount}/${slugs.length} teams scraped successfully`)
  
  return results
}

/**
 * Quick test scrape for a single team (for debugging)
 */
export async function testScrapeATSTrends(teamSlug: string = 'los-angeles-lakers'): Promise<void> {
  console.log(`[Test] Scraping ATS trends for ${teamSlug}...`)
  const result = await scrapeTeamATSTrends(teamSlug)
  
  if (result.success && result.data) {
    console.log('[Test] Success!')
    console.log('  Team:', result.data.teamName)
    console.log('  Overall ATS:', result.data.atsRecord)
    console.log('  Home ATS:', result.data.homeAtsRecord || 'N/A')
    console.log('  Away ATS:', result.data.awayAtsRecord || 'N/A')
    console.log('  As Favorite:', result.data.favoriteAtsRecord || 'N/A')
    console.log('  As Underdog:', result.data.underdogAtsRecord || 'N/A')
    console.log('  O/U Record:', result.data.overUnderRecord || 'N/A')
    console.log('  Last 10:', result.data.last10Ats || 'N/A')
    console.log('  Streak:', result.data.atsStreak || 'N/A')
  } else {
    console.log('[Test] Failed:', result.error)
  }
}

