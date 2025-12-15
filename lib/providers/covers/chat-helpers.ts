/**
 * Chat-friendly helpers for Covers.com data
 * These wrap database queries in formats the LLM can easily consume
 */

import { createClient } from '@/lib/supabase/server'

/**
 * Get ATS data for a team
 */
export async function getTeamATSData(
  teamName: string,
  sport: string = 'basketball_nba'
) {
  const supabase = createClient()

  const { data: records, error } = await supabase
    .from('team_ats_records')
    .select('*')
    .eq('sport_key', sport)
    .or(`team_name.ilike.%${teamName}%,covers_slug.ilike.%${teamName}%`)
    .order('captured_at', { ascending: false })
    .limit(1)

  if (error || !records || records.length === 0) {
    return {
      success: false,
      error: `No ATS data found for ${teamName}`
    }
  }

  const r = records[0]

  return {
    success: true,
    data: {
      team: r.team_name,
      season: r.season,
      overallATS: r.record,
      homeATS: r.home_ats_record,
      awayATS: r.away_ats_record,
      favoriteATS: r.favorite_ats_record,
      underdogATS: r.underdog_ats_record,
      overUnder: r.over_under_record,
      last10: r.last_10_ats,
      streak: r.ats_streak,
      lastUpdated: r.captured_at,
    }
  }
}

/**
 * Get today's betting splits
 */
export async function getCurrentBettingSplits(
  sport: string = 'basketball_nba'
) {
  const supabase = createClient()

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Query for splits captured today (don't filter by game_time since it can be NULL)
  const { data: splits, error } = await supabase
    .from('latest_betting_splits')
    .select('*')
    .eq('sport_key', sport)
    .gte('captured_at', today.toISOString())
    .order('game_time', { ascending: true, nullsFirst: false })

  if (error || !splits || splits.length === 0) {
    return {
      success: false,
      error: 'No betting splits found for today'
    }
  }

  // Group by game
  const gameMap = new Map()

  for (const split of splits) {
    if (!gameMap.has(split.game_id)) {
      gameMap.set(split.game_id, {
        gameId: split.game_id,
        matchup: `${split.away_team} @ ${split.home_team}`,
        gameTime: split.game_time,
        markets: {},
        sharpAction: []
      })
    }

    const game = gameMap.get(split.game_id)
    game.markets[split.market_type] = {
      homeBets: split.home_bets_pct,
      awayBets: split.away_bets_pct,
      homeMoney: split.home_money_pct,
      awayMoney: split.away_money_pct,
      sharp: split.sharp_indicator,
    }

    if (split.sharp_indicator?.startsWith('sharp_')) {
      game.sharpAction.push({
        market: split.market_type,
        side: split.sharp_indicator.replace('sharp_', ''),
      })
    }
  }

  return {
    success: true,
    data: Array.from(gameMap.values())
  }
}

/**
 * Analyze splits for specific game
 */
export async function analyzeGameSplits(gameId: string) {
  const supabase = createClient()

  const { data: splits, error } = await supabase
    .from('latest_betting_splits')
    .select('*')
    .eq('game_id', gameId)

  if (error || !splits || splits.length === 0) {
    return {
      success: false,
      error: `No splits found for game ${gameId}`
    }
  }

  const game = splits[0]
  const analysis = {
    matchup: `${game.away_team} @ ${game.home_team}`,
    gameTime: game.game_time,
    markets: splits.map(s => ({
      market: s.market_type,
      homeBets: s.home_bets_pct,
      awayBets: s.away_bets_pct,
      homeMoney: s.home_money_pct,
      awayMoney: s.away_money_pct,
      sharp: s.sharp_indicator,
      divergence: s.home_money_pct && s.home_bets_pct
        ? Math.abs(s.home_money_pct - s.home_bets_pct)
        : null
    }))
  }

  return {
    success: true,
    data: analysis
  }
}
