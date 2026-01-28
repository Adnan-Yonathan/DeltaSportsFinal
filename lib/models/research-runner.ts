/**
 * Research Model Runner
 * Core engine for scanning betting opportunities based on user-defined research criteria
 */

import { createClient } from '@/lib/supabase/server'
import { fetchOdds } from '@/lib/api/odds-api'
import { OddsGame, Bookmaker, OddsMarket, OddsOutcome } from '@/lib/types/odds'
import {
  ResearchModelConfig,
  ResearchOpportunity,
  ResearchResult,
  RunResearchModelOptions,
  OddsData,
  OddsDataPoint,
  OpportunityComparison,
  ResearchFilter,
  FilterExecutionContext,
} from './research-model-types'
import { runWebSearchResponse } from '@/lib/ai-gateway-client'

/**
 * Main function to run a research model
 */
export async function runResearchModel(
  modelId: string,
  userId: string,
  options: RunResearchModelOptions = {}
): Promise<ResearchResult> {
  const startTime = Date.now()
  const errors: string[] = []
  const MAX_SPORTS = 3
  const MAX_MARKETS = 3
  const MAX_RESULTS = 50
  const FETCH_TIMEOUT_MS = 12000
  const webSearchEnabled = process.env.ENABLE_WEB_SEARCH === 'true'
  const liveContext: Record<string, string> = {}

  try {
    // 1. Fetch the research model from database
    const supabase = createClient()
    const { data: model, error: modelError } = await supabase
      .from('custom_models')
      .select('*')
      .eq('id', modelId)
      .eq('user_id', userId)
      .eq('model_type', 'research')
      .single()

    if (modelError || !model) {
      throw new Error(`Research model not found: ${modelError?.message || 'Model does not exist'}`)
    }

    const config: ResearchModelConfig = model.research_config as ResearchModelConfig

    if (!config || !config.searchScope || !config.filters) {
      throw new Error('Invalid research model configuration')
    }

    const scopeMarkets = config.searchScope.markets || []
    const scopeSports = config.searchScope.sports || []

    // Cap sports and markets to avoid runaway workloads
    if (scopeSports.length > MAX_SPORTS) {
      throw new Error(`Too many sports requested; max ${MAX_SPORTS}`)
    }
    if (scopeMarkets.length > MAX_MARKETS) {
      throw new Error(`Too many markets requested; max ${MAX_MARKETS}`)
    }

    // 2. Fetch odds data for all specified sports and markets
    const allOpportunities: OddsData[] = []

  for (const sport of scopeSports) {
    try {
      const markets = scopeMarkets.length > 0
        ? scopeMarkets
        : ['h2h', 'spreads', 'totals']

        const oddsPromise = fetchOdds(sport, markets, {
          live: false,
          revalidateSeconds: options.skipCache ? 0 : 600,
          forceProvider: 'the-odds-api',
        })

      const oddsData = await Promise.race([
        oddsPromise,
        new Promise<OddsGame[]>((_, reject) =>
          setTimeout(() => reject(new Error('Fetch timeout')), FETCH_TIMEOUT_MS)
        ),
      ])

      // Optionally enrich with live web context per game (limited)
      if (webSearchEnabled) {
        for (const game of oddsData.slice(0, 6)) {
          const key = `${sport}:${game.away_team}@${game.home_team}`
          if (liveContext[key]) continue
          try {
            const prompt = buildSearchPrompt(sport, game.away_team, game.home_team)
            const text = await runWebSearchResponse(prompt, { maxOutputTokens: 400, retry: 1 })
            liveContext[key] = text
          } catch (err: any) {
            errors.push(`Live context failed for ${key}: ${err?.message || err}`)
          }
        }
      }

      // Transform odds data into filterable opportunities
      const opportunities = transformOddsToOpportunities(
        oddsData,
        sport,
        config.searchScope.books
      )

        allOpportunities.push(...opportunities)
      } catch (error: any) {
        errors.push(`Failed to fetch odds for ${sport}: ${error.message}`)
      }
    }

    // 3. Apply time window filter if specified
    let filteredByTime = allOpportunities
    if (options.upcomingOnly && options.timeWindow) {
      const now = new Date()
      const maxTime = new Date(now.getTime() + options.timeWindow * 60 * 60 * 1000)
      filteredByTime = allOpportunities.filter(opp => {
        const gameTime = new Date(opp.gameTime)
        return gameTime > now && gameTime <= maxTime
      })
    } else if (options.upcomingOnly) {
      const now = new Date()
      filteredByTime = allOpportunities.filter(opp => new Date(opp.gameTime) > now)
    }

    // 4. Apply all research filters
    const matchedOpportunities: ResearchOpportunity[] = []
    const filterContext: FilterExecutionContext = {
      statsCache: new Map(),
    }

    for (const opportunity of filteredByTime) {
      try {
        const { matched, matchedFilters } = await applyAllFilters(
          opportunity,
          config.filters,
          allOpportunities.filter(o => o.eventId === opportunity.eventId),
          filterContext
        )

        if (matched) {
          // Calculate comparison data
          const comparison = calculateComparison(
            opportunity,
            allOpportunities.filter(o => o.eventId === opportunity.eventId && o.market === opportunity.market)
          )

          // Transform to ResearchOpportunity
          matchedOpportunities.push({
            id: `${opportunity.eventId}-${opportunity.book}-${opportunity.market}-${opportunity.selection || ''}`,
            sport: opportunity.sport,
            event: opportunity.event,
            eventId: opportunity.eventId,
            market: opportunity.market,
            book: opportunity.book,
            selection: opportunity.selection,
            line: opportunity.line,
            odds: opportunity.odds,
            comparison,
            matchedFilters,
            gameTime: opportunity.gameTime,
            league: opportunity.sport, // Can be enhanced with actual league info
            isLive: opportunity.isLive || false,
          })
        }
      } catch (error: any) {
        errors.push(`Filter error for ${opportunity.event}: ${error.message}`)
      }
    }

    // 5. Sort results
    const sorted = sortOpportunities(matchedOpportunities, config.sortBy)

    // 6. Limit results
    const maxResults = Math.min(config.maxResults || 20, MAX_RESULTS)
    const limited = sorted.slice(0, maxResults)

    // 7. Update model last_used_at
    await supabase
      .from('custom_models')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', modelId)

    // 8. Cache results (optional)
    try {
      await supabase.from('research_results').insert({
        model_id: modelId,
        user_id: userId,
        results: {
          opportunities: limited,
          scannedAt: new Date().toISOString(),
          totalMatches: limited.length,
          searchCriteria: config,
          executionTimeMs: Date.now() - startTime,
          errors: errors.length > 0 ? errors : undefined,
        },
        match_count: limited.length,
        scanned_at: new Date().toISOString(),
      })
    } catch (cacheError) {
      // Non-critical error, just log
      console.error('[RESEARCH] Failed to cache results:', cacheError)
    }

    return {
      opportunities: limited,
      scannedAt: new Date().toISOString(),
      totalMatches: limited.length,
      searchCriteria: config,
      executionTimeMs: Date.now() - startTime,
      liveContext: webSearchEnabled ? liveContext : undefined,
      errors: errors.length > 0 ? errors : undefined,
    }
  } catch (error: any) {
    throw new Error(`Research model execution failed: ${error.message}`)
  }
}

/**
 * Transform OddsGame[] into filterable OddsData[]
 */
function transformOddsToOpportunities(
  games: OddsGame[],
  sport: string,
  bookFilter?: string[]
): OddsData[] {
  const opportunities: OddsData[] = []
  const bookSet = bookFilter && bookFilter.length > 0 ? new Set(bookFilter.map(b => b.toLowerCase())) : null

  for (const game of games) {
    for (const bookmaker of game.bookmakers) {
      // Skip if book not in filter
      if (bookSet && !bookSet.has(bookmaker.key.toLowerCase()) && !bookSet.has(bookmaker.title.toLowerCase())) {
        continue
      }

      for (const market of bookmaker.markets) {
        for (const outcome of market.outcomes) {
          opportunities.push({
            eventId: game.id,
            sport,
            event: `${game.away_team} @ ${game.home_team}`,
            gameTime: game.commence_time,
            market: market.key,
            team: outcome.name,
            selection: outcome.name,
            odds: outcome.price,
            line: outcome.point,
            book: bookmaker.title,
            isLive: false, // TODO: detect from game status if available

            // Store all odds for this event/market for comparison
            allOdds: collectAllOddsForMarket(game, market.key),
          })
        }
      }
    }
  }

  return opportunities
}

/**
 * Collect all odds for a specific market from all bookmakers
 */
function collectAllOddsForMarket(game: OddsGame, marketKey: string): OddsDataPoint[] {
  const allOdds: OddsDataPoint[] = []

  for (const bookmaker of game.bookmakers) {
    const market = bookmaker.markets.find(m => m.key === marketKey)
    if (!market) continue

    for (const outcome of market.outcomes) {
      allOdds.push({
        book: bookmaker.title,
        odds: outcome.price,
        line: outcome.point,
        timestamp: market.last_update || bookmaker.last_update,
      })
    }
  }

  return allOdds
}

/**
 * Apply all filters to an opportunity
 */
async function applyAllFilters(
  opportunity: OddsData,
  filters: ResearchFilter[],
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<{ matched: boolean; matchedFilters: string[] }> {
  const matchedFilters: string[] = []

  // If no filters, match everything
  if (!filters || filters.length === 0) {
    return { matched: true, matchedFilters: ['no-filters'] }
  }

  for (const filter of filters) {
    // Skip disabled filters
    if (filter.enabled === false) continue

    try {
      const matched = await applyFilter(opportunity, filter, allOddsForEvent, context)
      if (matched) {
        matchedFilters.push(filter.label || filter.type)
      } else {
        // All filters must pass (AND logic)
        return { matched: false, matchedFilters: [] }
      }
    } catch (error: any) {
      console.error(`[RESEARCH] Filter ${filter.type} failed:`, error.message)
      // Filter failures count as not matching
      return { matched: false, matchedFilters: [] }
    }
  }

  return {
    matched: matchedFilters.length === filters.filter(f => f.enabled !== false).length,
    matchedFilters,
  }
}

/**
 * Apply a single filter (delegates to specific filter implementations)
 */
async function applyFilter(
  opportunity: OddsData,
  filter: ResearchFilter,
  allOddsForEvent: OddsData[],
  context: FilterExecutionContext
): Promise<boolean> {
  // Import and apply specific filter implementations
  switch (filter.type) {
    case 'odds_comparison': {
      const { applyOddsComparisonFilter } = await import('./filters/odds-comparison')
      return applyOddsComparisonFilter(opportunity, filter, allOddsForEvent, context)
    }
    case 'line_comparison': {
      const { applyLineComparisonFilter } = await import('./filters/line-comparison')
      return applyLineComparisonFilter(opportunity, filter, allOddsForEvent, context)
    }
    case 'prop_value': {
      const { applyPropValueFilter } = await import('./filters/prop-value')
      return applyPropValueFilter(opportunity, filter, allOddsForEvent, context)
    }
    case 'stat_threshold': {
      const { applyStatThresholdFilter } = await import('./filters/stat-threshold')
      return applyStatThresholdFilter(opportunity, filter, allOddsForEvent, context)
    }
    case 'custom': {
      const { applyCustomFilter } = await import('./filters/custom-gpt')
      return applyCustomFilter(opportunity, filter, allOddsForEvent, context)
    }
    default:
      console.warn(`[RESEARCH] Unknown filter type: ${(filter as any).type}`)
      return false
  }
}

/**
 * Calculate comparison data for an opportunity
 */
function calculateComparison(
  opportunity: OddsData,
  allOddsForMarket: OddsData[]
): OpportunityComparison {
  const comparison: OpportunityComparison = {
    sampleSize: allOddsForMarket.length,
  }

  // Calculate average odds
  const oddsValues = allOddsForMarket.map(o => o.odds).filter(o => typeof o === 'number')
  if (oddsValues.length > 0) {
    comparison.avgOdds = oddsValues.reduce((sum, val) => sum + val, 0) / oddsValues.length
    comparison.oddsAdvantage = opportunity.odds - comparison.avgOdds
  }

  // Calculate average line
  const lineValues = allOddsForMarket.map(o => o.line).filter(l => typeof l === 'number')
  if (lineValues.length > 0) {
    comparison.avgLine = lineValues.reduce((sum, val) => sum + val!, 0) / lineValues.length
    if (opportunity.line !== undefined) {
      comparison.lineAdvantage = opportunity.line - comparison.avgLine
    }
  }

  // Find Pinnacle odds (closing line proxy)
  const pinnacle = allOddsForMarket.find(o => o.book.toLowerCase().includes('pinnacle'))
  if (pinnacle) {
    comparison.pinnacleOdds = pinnacle.odds
    comparison.pinnacleLine = pinnacle.line
  }

  return comparison
}

function buildSearchPrompt(sport: string, away: string, home: string) {
  return [
    `You are gathering live context for sports betting research.`,
    `Game: ${away} @ ${home} (${sport}).`,
    `Find: current injuries/lineup changes (last 48h), recent form/pace/net rating trends (last 10 games), and any breaking news that could move lines.`,
    `Return a concise paragraph with bullet-like sentences and include source URLs inline.`,
    `If nothing recent, say "No recent updates found."`,
  ].join('\n')
}

/**
 * Sort opportunities based on sort configuration
 */
function sortOpportunities(
  opportunities: ResearchOpportunity[],
  sortBy?: { field: string; direction: 'asc' | 'desc' }
): ResearchOpportunity[] {
  if (!sortBy) {
    // Default: sort by game time (earliest first)
    return [...opportunities].sort((a, b) => {
      const timeA = new Date(a.gameTime).getTime()
      const timeB = new Date(b.gameTime).getTime()
      return timeA - timeB
    })
  }

  return [...opportunities].sort((a, b) => {
    let valueA: number
    let valueB: number

    switch (sortBy.field) {
      case 'ev':
        valueA = a.comparison.evEstimate || 0
        valueB = b.comparison.evEstimate || 0
        break
      case 'odds_diff':
        valueA = a.comparison.oddsAdvantage || 0
        valueB = b.comparison.oddsAdvantage || 0
        break
      case 'line_diff':
        valueA = a.comparison.lineAdvantage || 0
        valueB = b.comparison.lineAdvantage || 0
        break
      case 'custom_score':
        valueA = a.score || 0
        valueB = b.score || 0
        break
      case 'game_time':
        valueA = new Date(a.gameTime).getTime()
        valueB = new Date(b.gameTime).getTime()
        break
      default:
        return 0
    }

    const diff = valueA - valueB
    return sortBy.direction === 'asc' ? diff : -diff
  })
}

/**
 * Get latest cached results for a research model
 */
export async function getLatestResearchResults(
  modelId: string,
  userId: string,
  limit: number = 1
): Promise<ResearchResult[]> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('research_results')
    .select('*')
    .eq('model_id', modelId)
    .eq('user_id', userId)
    .order('scanned_at', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(`Failed to fetch research results: ${error.message}`)
  }

  return (data || []).map(row => row.results as ResearchResult)
}
