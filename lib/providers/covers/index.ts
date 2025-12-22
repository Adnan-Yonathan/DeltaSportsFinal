/**
 * SportsBettingDime Provider (Covers replacement)
 *
 * Exports SBD-backed utilities for ATS records and public betting splits.
 */

// Client
export {
  fetchCoversHtml,
  buildATSTrendsUrl,
  buildMatchupsUrl,
  buildMatchupDetailUrl,
  getTeamSlug,
  getTeamName,
  getAllTeamSlugs,
  NBA_TEAM_SLUGS,
  NBA_SLUG_TO_TEAM,
  CoversClientError,
  type CoversFetchOptions,
} from './client'

// Types
export type {
  CoversATSRecord,
  CoversTeamMapping,
  CoversBettingSplits,
  CoversMatchup,
  SharpIndicator,
  SharpAnalysis,
  CoversScraperResult,
  CoversATSScraperResult,
  CoversSplitsScraperResult,
} from './types'

// Mappers
export {
  detectSharpAction,
  mapATSRecordToRow,
  mapSplitsToRows,
  parseATSRecord,
  formatATSRecord,
  parsePercentage,
  getCurrentNBASeason,
  type TeamATSRecordRow,
  type PublicBettingSplitsRow,
  type MarketType,
} from './mapper'

// Scrapers
export {
  scrapeTeamATSTrends,
  scrapeAllNBAATSTrends,
  testScrapeATSTrends,
} from './ats-scraper'

export {
  getDailyMatchups,
  scrapeGameSplits,
  scrapeDailySplits,
  scrapePublicMoneySplits,
  testScrapeSplits,
} from './splits-scraper'

// Chat helpers
export {
  getTeamATSData,
  getCurrentBettingSplits,
  analyzeGameSplits,
  summarizeCoversSplitsForChat,
  summarizeCoversGameSplitsForChat,
} from './chat-helpers'

