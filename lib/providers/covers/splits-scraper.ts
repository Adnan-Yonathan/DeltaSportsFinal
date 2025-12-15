/**
 * Covers.com Public Betting Splits Scraper
 * 
 * Scrapes public betting percentages from Covers consensus page.
 * URL: https://contests.covers.com/consensus/topconsensus/{league}/overall
 * 
 * This page shows:
 * - Matchup (away @ home)
 * - Date/time
 * - Consensus % (away vs home on spread)
 * - Spread lines
 * - Pick counts
 */

import {
  fetchCoversHtml,
  type CoversFetchOptions,
} from './client'
import type {
  CoversBettingSplits,
  CoversMatchup,
  CoversSplitsScraperResult,
} from './types'

// =============================================================================
// URL Builders
// =============================================================================

const CONSENSUS_BASE_URL = 'https://contests.covers.com/consensus'

function buildConsensusUrl(league: string = 'nba', type: string = 'overall'): string {
  return `${CONSENSUS_BASE_URL}/topconsensus/${league.toLowerCase()}/${type}`
}

function buildTotalsConsensusUrl(league: string = 'nba'): string {
  return `${CONSENSUS_BASE_URL}/topoverunderconsensus/${league.toLowerCase()}/overall`
}

// =============================================================================
// HTML Parsing
// =============================================================================

interface ConsensusGame {
  awayTeam: string
  homeTeam: string
  awayTeamAbbr: string
  homeTeamAbbr: string
  gameTime?: string
  awayPct: number
  homePct: number
  awaySpread?: string
  homeSpread?: string
  awayPicks: number
  homePicks: number
  detailsUrl?: string
}

/**
 * Parse the consensus page HTML to extract betting splits
 */
function parseConsensusPage(html: string): ConsensusGame[] {
  const games: ConsensusGame[] = []
  
  // Find all table rows with game data
  // Pattern: <tr> containing matchup data
  const rowPattern = /<tr>[\s\S]*?<\/tr>/gi
  const rows = html.match(rowPattern) || []
  
  for (const row of rows) {
    // Skip header rows
    if (row.includes('<th>')) continue
    
    // Extract team names
    // Pattern: <a href="..." title="Team Name">Abbr</a>
    const teamPattern = /title="([^"]+)"[^>]*>\s*([A-Za-z]+)\s*<\/a>/gi
    const teams: { name: string; abbr: string }[] = []
    let teamMatch
    while ((teamMatch = teamPattern.exec(row)) !== null) {
      teams.push({
        name: teamMatch[1],
        abbr: teamMatch[2].toUpperCase(),
      })
    }
    
    if (teams.length < 2) continue
    
    // Extract consensus percentages
    // Pattern: <span class="covers-CoversConsensus-consensusTable--low"><span>31%</span></span>
    // and: <span class="covers-CoversConsensus-consensusTable--high"><span>69%</span></span>
    const lowPctMatch = row.match(/consensusTable--low[^>]*><span>(\d+)%<\/span>/i)
    const highPctMatch = row.match(/consensusTable--high[^>]*><span>(\d+)%<\/span>/i)
    
    if (!lowPctMatch || !highPctMatch) continue
    
    const awayPct = parseInt(lowPctMatch[1], 10)
    const homePct = parseInt(highPctMatch[1], 10)
    
    // Extract spreads
    // Pattern in <td>: +10.5<br />-10.5
    const spreadMatch = row.match(/<td>\s*([+-]?\d+\.?\d*)\s*<br\s*\/?>\s*([+-]?\d+\.?\d*)\s*<\/td>/i)
    const awaySpread = spreadMatch?.[1]
    const homeSpread = spreadMatch?.[2]
    
    // Extract pick counts
    // Pattern in <td>: 61<br />135
    const picksMatch = row.match(/<td>\s*(\d+)\s*<br\s*\/?>\s*(\d+)\s*<\/td>/i)
    const awayPicks = picksMatch ? parseInt(picksMatch[1], 10) : 0
    const homePicks = picksMatch ? parseInt(picksMatch[2], 10) : 0
    
    // Extract date/time
    // Pattern: Fri. Dec 12<br />7:00 pm ET
    const dateMatch = row.match(/([A-Za-z]+\.?\s+[A-Za-z]+\s+\d+)\s*<br\s*\/?>\s*(\d+:\d+\s*[ap]m\s*ET)/i)
    const gameTime = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : undefined
    
    // Extract details URL
    const detailsMatch = row.match(/href="([^"]*matchupconsensusdetails[^"]*)"/i)
    const detailsUrl = detailsMatch ? `${CONSENSUS_BASE_URL}${detailsMatch[1].replace('/consensus', '')}` : undefined
    
    games.push({
      awayTeam: teams[0].name,
      homeTeam: teams[1].name,
      awayTeamAbbr: teams[0].abbr,
      homeTeamAbbr: teams[1].abbr,
      gameTime,
      awayPct,
      homePct,
      awaySpread,
      homeSpread,
      awayPicks,
      homePicks,
      detailsUrl,
    })
  }
  
  return games
}

/**
 * Convert ConsensusGame to CoversBettingSplits
 */
function mapConsensusToSplits(
  game: ConsensusGame,
  sportKey: string,
  marketType: 'spread' | 'total' = 'spread'
): CoversBettingSplits {
  return {
    gameId: `${game.awayTeamAbbr}@${game.homeTeamAbbr}`,
    homeTeam: game.homeTeam,
    awayTeam: game.awayTeam,
    gameTime: game.gameTime ? new Date(game.gameTime) : undefined,
    sportKey,
    
    // For spread market
    spreadHomeBetsPct: marketType === 'spread' ? game.homePct : undefined,
    spreadAwayBetsPct: marketType === 'spread' ? game.awayPct : undefined,
    
    // For total market
    totalOverBetsPct: marketType === 'total' ? game.homePct : undefined,
    totalUnderBetsPct: marketType === 'total' ? game.awayPct : undefined,
    
    // Covers consensus doesn't separate bets% from money%
    // The percentages shown are based on picks, not money
    
    capturedAt: new Date(),
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Get list of today's matchups from the consensus page
 */
export async function getDailyMatchups(
  sport: string = 'basketball',
  league: string = 'nba',
  options?: CoversFetchOptions
): Promise<CoversMatchup[]> {
  const url = buildConsensusUrl(league)
  
  try {
    const html = await fetchCoversHtml(url, options)
    const games = parseConsensusPage(html)
    
    console.log(`[Covers Splits] Found ${games.length} games with consensus data`)
    
    return games.map(g => ({
      gameId: `${g.awayTeamAbbr}@${g.homeTeamAbbr}`,
      homeTeam: g.homeTeam,
      awayTeam: g.awayTeam,
      gameTime: g.gameTime,
      matchupUrl: g.detailsUrl || url,
    }))
  } catch (error) {
    console.error('[Covers Splits] Failed to fetch consensus page:', error)
    return []
  }
}

/**
 * Scrape betting splits for a single game (from details page if needed)
 */
export async function scrapeGameSplits(
  gameId: string,
  sport: string = 'basketball',
  league: string = 'nba',
  options?: CoversFetchOptions
): Promise<CoversSplitsScraperResult> {
  // For now, we get splits from the main consensus page
  // Individual game details pages require additional parsing
  const url = buildConsensusUrl(league)
  const scrapedAt = new Date()
  
  try {
    const html = await fetchCoversHtml(url, options)
    const games = parseConsensusPage(html)
    
    // Find the matching game
    const game = games.find(g => 
      `${g.awayTeamAbbr}@${g.homeTeamAbbr}` === gameId ||
      g.awayTeamAbbr === gameId.split('@')[0] ||
      g.homeTeamAbbr === gameId.split('@')[1]
    )
    
    if (!game) {
      return {
        success: false,
        error: `Game ${gameId} not found in consensus data`,
        url,
        scrapedAt,
      }
    }
    
    const splits = mapConsensusToSplits(game, `${sport}_${league}`)
    
    return {
      success: true,
      data: [splits],
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
 * Scrape betting splits for all games today
 */
export async function scrapeDailySplits(
  sport: string = 'basketball',
  league: string = 'nba',
  options?: CoversFetchOptions
): Promise<CoversSplitsScraperResult> {
  const scrapedAt = new Date()
  const sportKey = `${sport}_${league}`
  
  try {
    // Fetch spread consensus
    const spreadUrl = buildConsensusUrl(league)
    console.log(`[Covers Splits] Fetching spread consensus from ${spreadUrl}`)
    const spreadHtml = await fetchCoversHtml(spreadUrl, options)
    const spreadGames = parseConsensusPage(spreadHtml)
    
    console.log(`[Covers Splits] Found ${spreadGames.length} games with spread consensus`)
    
    // Fetch totals consensus
    const totalsUrl = buildTotalsConsensusUrl(league)
    console.log(`[Covers Splits] Fetching totals consensus from ${totalsUrl}`)
    let totalsGames: ConsensusGame[] = []
    try {
      const totalsHtml = await fetchCoversHtml(totalsUrl, options)
      totalsGames = parseConsensusPage(totalsHtml)
      console.log(`[Covers Splits] Found ${totalsGames.length} games with totals consensus`)
    } catch (error) {
      console.warn('[Covers Splits] Could not fetch totals consensus:', error)
    }
    
    // Combine into splits
    const allSplits: CoversBettingSplits[] = []
    
    for (const game of spreadGames) {
      const splits = mapConsensusToSplits(game, sportKey, 'spread')
      
      // Find matching totals game
      const totalsGame = totalsGames.find(t => 
        t.awayTeamAbbr === game.awayTeamAbbr && 
        t.homeTeamAbbr === game.homeTeamAbbr
      )
      
      if (totalsGame) {
        splits.totalOverBetsPct = totalsGame.homePct
        splits.totalUnderBetsPct = totalsGame.awayPct
      }
      
      allSplits.push(splits)
    }
    
    console.log(`[Covers Splits] Complete: ${allSplits.length} games with splits data`)
    
    return {
      success: true,
      data: allSplits,
      url: spreadUrl,
      scrapedAt,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      url: buildConsensusUrl(league),
      scrapedAt,
    }
  }
}

/**
 * Quick test scrape for debugging
 */
export async function testScrapeSplits(): Promise<void> {
  console.log('[Test] Fetching consensus data...')
  const result = await scrapeDailySplits()
  
  if (result.success && result.data) {
    console.log(`[Test] Found ${result.data.length} games`)
    
    for (const split of result.data.slice(0, 3)) {
      console.log(`\n${split.awayTeam} @ ${split.homeTeam}:`)
      console.log(`  Spread: Away ${split.spreadAwayBetsPct}% vs Home ${split.spreadHomeBetsPct}%`)
      if (split.totalOverBetsPct !== undefined) {
        console.log(`  Total: Over ${split.totalOverBetsPct}% vs Under ${split.totalUnderBetsPct}%`)
      }
    }
  } else {
    console.log('[Test] Failed:', result.error)
  }
}
