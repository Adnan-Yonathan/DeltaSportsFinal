/**
 * SportsBettingDime ATS Trends Fetcher
 *
 * Replaces Covers.com scraping with SBD trends API.
 * Source: https://srfeeds.sportsbettingdime.com/v2/trends/{league}
 */

import { fetchSbdTrends, resolveSbdLeague, resolveSportKey } from '@/lib/api/sbd'
import { formatATSRecord, getCurrentNBASeason } from './mapper'
import type { CoversATSRecord, CoversATSScraperResult } from './types'
import type { CoversFetchOptions } from './client'

type TrendEntry = any

const slugifyTeam = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')

const teamDisplayName = (entry: TrendEntry): string => {
  const stage = typeof entry?.stageName === 'string' ? entry.stageName.trim() : ''
  const name = typeof entry?.name === 'string' ? entry.name.trim() : ''
  const nickname = typeof entry?.nickname === 'string' ? entry.nickname.trim() : ''
  if (stage) return stage
  if (name && nickname) return `${name} ${nickname}`.trim()
  return name || nickname || 'Unknown'
}

const recordFromSpread = (entry?: TrendEntry) => {
  if (!entry?.spread) return null
  return formatATSRecord(entry.spread.wins || 0, entry.spread.loses || 0, entry.spread.ties || 0)
}

const recordFromTotals = (entry?: TrendEntry) => {
  if (!entry?.totals) return null
  return formatATSRecord(entry.totals.overs || 0, entry.totals.unders || 0, entry.totals.ties || 0)
}

const resolveSeason = (sportKey: string): number => {
  if (sportKey.includes('basketball_nba') || sportKey.includes('icehockey_nhl')) {
    return getCurrentNBASeason()
  }
  return new Date().getFullYear()
}

const fetchTrendSafe = async (
  league: string,
  filters: { location?: 'home' | 'away'; expectation?: 'favorite' | 'underdog' }
): Promise<Record<string, TrendEntry> | null> => {
  try {
    return await fetchSbdTrends(league as any, filters)
  } catch (error) {
    console.warn('[SBD ATS] Trend fetch failed:', filters, error)
    return null
  }
}

const buildRecord = (
  entry: TrendEntry,
  sportKey: string,
  season: number,
  splits: {
    home?: TrendEntry
    away?: TrendEntry
    favorite?: TrendEntry
    underdog?: TrendEntry
    homeFavorite?: TrendEntry
    homeUnderdog?: TrendEntry
    awayFavorite?: TrendEntry
    awayUnderdog?: TrendEntry
  }
): CoversATSRecord => {
  const teamName = teamDisplayName(entry)
  const teamSlug = slugifyTeam(teamName)
  const atsRecord = recordFromSpread(entry) || '0-0'
  const totalsRecord = recordFromTotals(entry)

  const extraSplits: Record<string, string> = {}
  const pushSplit = (key: string, value: string | null) => {
    if (value) extraSplits[key] = value
  }

  pushSplit('homeFavorite', recordFromSpread(splits.homeFavorite))
  pushSplit('homeUnderdog', recordFromSpread(splits.homeUnderdog))
  pushSplit('awayFavorite', recordFromSpread(splits.awayFavorite))
  pushSplit('awayUnderdog', recordFromSpread(splits.awayUnderdog))
  pushSplit('homeTotals', recordFromTotals(splits.home))
  pushSplit('awayTotals', recordFromTotals(splits.away))
  pushSplit('favoriteTotals', recordFromTotals(splits.favorite))
  pushSplit('underdogTotals', recordFromTotals(splits.underdog))
  pushSplit('homeFavoriteTotals', recordFromTotals(splits.homeFavorite))
  pushSplit('homeUnderdogTotals', recordFromTotals(splits.homeUnderdog))
  pushSplit('awayFavoriteTotals', recordFromTotals(splits.awayFavorite))
  pushSplit('awayUnderdogTotals', recordFromTotals(splits.awayUnderdog))

  return {
    teamName,
    teamSlug,
    sportKey,
    season,
    atsWins: entry.spread?.wins || 0,
    atsLosses: entry.spread?.loses || 0,
    atsPushes: entry.spread?.ties || 0,
    atsRecord,
    homeAtsRecord: recordFromSpread(splits.home) || undefined,
    awayAtsRecord: recordFromSpread(splits.away) || undefined,
    favoriteAtsRecord: recordFromSpread(splits.favorite) || undefined,
    underdogAtsRecord: recordFromSpread(splits.underdog) || undefined,
    overUnderRecord: totalsRecord || undefined,
    last10Ats: undefined,
    atsStreak: undefined,
    capturedAt: new Date(),
    extraSplits,
  }
}

export async function scrapeTeamATSTrends(
  teamSlug: string,
  sportKey: string = 'basketball_nba',
  _options?: CoversFetchOptions
): Promise<CoversATSScraperResult> {
  const results = await scrapeAllNBAATSTrends(sportKey)
  const record = results.get(teamSlug)
  if (record) return record
  return {
    success: false,
    error: `Team ${teamSlug} not found in SBD trends`,
    url: '',
    scrapedAt: new Date(),
  }
}

export async function scrapeAllNBAATSTrends(
  sportKey: string = 'basketball_nba',
  _options?: CoversFetchOptions
): Promise<Map<string, CoversATSScraperResult>> {
  const results = new Map<string, CoversATSScraperResult>()
  const league = resolveSbdLeague(sportKey)
  const scrapedAt = new Date()

  if (!league) {
    return results
  }

  const season = resolveSeason(sportKey)
  const base = await fetchTrendSafe(league, {})
  if (!base) {
    return results
  }

  const [
    home,
    away,
    favorite,
    underdog,
    homeFavorite,
    homeUnderdog,
    awayFavorite,
    awayUnderdog,
  ] = await Promise.all([
    fetchTrendSafe(league, { location: 'home' }),
    fetchTrendSafe(league, { location: 'away' }),
    fetchTrendSafe(league, { expectation: 'favorite' }),
    fetchTrendSafe(league, { expectation: 'underdog' }),
    fetchTrendSafe(league, { location: 'home', expectation: 'favorite' }),
    fetchTrendSafe(league, { location: 'home', expectation: 'underdog' }),
    fetchTrendSafe(league, { location: 'away', expectation: 'favorite' }),
    fetchTrendSafe(league, { location: 'away', expectation: 'underdog' }),
  ])

  const sbdSportKey = resolveSportKey(league) || sportKey

  for (const [key, entry] of Object.entries(base)) {
    const record = buildRecord(entry, sbdSportKey, season, {
      home: home?.[key],
      away: away?.[key],
      favorite: favorite?.[key],
      underdog: underdog?.[key],
      homeFavorite: homeFavorite?.[key],
      homeUnderdog: homeUnderdog?.[key],
      awayFavorite: awayFavorite?.[key],
      awayUnderdog: awayUnderdog?.[key],
    })

    results.set(record.teamSlug, {
      success: true,
      data: record,
      url: `https://srfeeds.sportsbettingdime.com/v2/trends/${league}`,
      scrapedAt,
    })
  }

  return results
}

export async function testScrapeATSTrends(): Promise<void> {
  console.log('[Test] Fetching SBD ATS trends...')
  const results = await scrapeAllNBAATSTrends()
  const sample = Array.from(results.values()).slice(0, 3)
  for (const entry of sample) {
    if (!entry.success || !entry.data) continue
    console.log(`${entry.data.teamName}: ${entry.data.atsRecord} (Home: ${entry.data.homeAtsRecord})`)
  }
}
