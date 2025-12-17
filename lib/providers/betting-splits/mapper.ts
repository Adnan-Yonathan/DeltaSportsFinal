/**
 * Mapper for BettingSplit to database rows
 * Converts aggregated betting splits into rows for public_betting_splits table
 */

import type { BettingSplit } from './types'

export interface PublicBettingSplitsRow {
  sport_key: string
  game_id: string
  home_team: string
  away_team: string
  game_time: Date | null
  market_type: 'spread' | 'moneyline' | 'total'
  home_bets_pct: number | null
  away_bets_pct: number | null
  home_money_pct: number | null
  away_money_pct: number | null
  sharp_indicator: string | null
  source: string
  covers_game_id: string | null
  captured_at: Date
}

/**
 * Map BettingSplit to database rows (one per market type)
 */
export function mapBettingSplitToRows(
  split: BettingSplit,
  internalGameId?: string
): PublicBettingSplitsRow[] {
  const rows: PublicBettingSplitsRow[] = []
  const capturedAt = split.capturedAt

  // Convert gameTime to Date if it's a string
  let gameTime: Date | null = null
  if (split.gameTime) {
    gameTime = typeof split.gameTime === 'string' ? new Date(split.gameTime) : split.gameTime
  }

  const baseRow = {
    sport_key: split.sportKey || 'basketball_nba',
    game_id: internalGameId || split.gameId || `${split.awayTeam}@${split.homeTeam}`,
    home_team: split.homeTeam,
    away_team: split.awayTeam,
    game_time: gameTime,
    source: split.source,
    covers_game_id: split.coversGameId || null,
    captured_at: capturedAt,
  }

  // Spread market
  if (
    split.spreadHomeBetsPct != null ||
    split.spreadAwayBetsPct != null ||
    split.spreadHomeMoneyPct != null ||
    split.spreadAwayMoneyPct != null
  ) {
    rows.push({
      ...baseRow,
      market_type: 'spread',
      home_bets_pct: split.spreadHomeBetsPct ?? null,
      away_bets_pct: split.spreadAwayBetsPct ?? null,
      home_money_pct: split.spreadHomeMoneyPct ?? null,
      away_money_pct: split.spreadAwayMoneyPct ?? null,
      sharp_indicator: split.sharpIndicator || null,
    })
  }

  // Total market
  if (
    split.totalOverBetsPct != null ||
    split.totalUnderBetsPct != null ||
    split.totalOverMoneyPct != null ||
    split.totalUnderMoneyPct != null
  ) {
    // Calculate sharp indicator for totals if we have money data
    let totalSharpIndicator: string | null = null
    if (
      split.totalOverBetsPct != null &&
      split.totalUnderBetsPct != null &&
      split.totalOverMoneyPct != null &&
      split.totalUnderMoneyPct != null
    ) {
      const overDivergence = Math.abs(split.totalOverMoneyPct - split.totalOverBetsPct)
      const underDivergence = Math.abs(split.totalUnderMoneyPct - split.totalUnderBetsPct)

      if (overDivergence >= 15) {
        totalSharpIndicator =
          split.totalOverMoneyPct > split.totalOverBetsPct ? 'sharp_home' : 'public_home'
      } else if (underDivergence >= 15) {
        totalSharpIndicator =
          split.totalUnderMoneyPct > split.totalUnderBetsPct ? 'sharp_away' : 'public_away'
      } else {
        totalSharpIndicator = 'neutral'
      }
    }

    rows.push({
      ...baseRow,
      market_type: 'total',
      home_bets_pct: split.totalOverBetsPct ?? null,
      away_bets_pct: split.totalUnderBetsPct ?? null,
      home_money_pct: split.totalOverMoneyPct ?? null,
      away_money_pct: split.totalUnderMoneyPct ?? null,
      sharp_indicator: totalSharpIndicator,
    })
  }

  // Moneyline market
  if (
    split.mlHomeBetsPct != null ||
    split.mlAwayBetsPct != null ||
    split.mlHomeMoneyPct != null ||
    split.mlAwayMoneyPct != null
  ) {
    // Calculate sharp indicator for ML
    let mlSharpIndicator: string | null = null
    if (
      split.mlHomeBetsPct != null &&
      split.mlAwayBetsPct != null &&
      split.mlHomeMoneyPct != null &&
      split.mlAwayMoneyPct != null
    ) {
      const homeDivergence = Math.abs(split.mlHomeMoneyPct - split.mlHomeBetsPct)
      const awayDivergence = Math.abs(split.mlAwayMoneyPct - split.mlAwayBetsPct)

      if (homeDivergence >= 15) {
        mlSharpIndicator =
          split.mlHomeMoneyPct > split.mlHomeBetsPct ? 'sharp_home' : 'public_home'
      } else if (awayDivergence >= 15) {
        mlSharpIndicator =
          split.mlAwayMoneyPct > split.mlAwayBetsPct ? 'sharp_away' : 'public_away'
      } else {
        mlSharpIndicator = 'neutral'
      }
    }

    rows.push({
      ...baseRow,
      market_type: 'moneyline',
      home_bets_pct: split.mlHomeBetsPct ?? null,
      away_bets_pct: split.mlAwayBetsPct ?? null,
      home_money_pct: split.mlHomeMoneyPct ?? null,
      away_money_pct: split.mlAwayMoneyPct ?? null,
      sharp_indicator: mlSharpIndicator,
    })
  }

  return rows
}

/**
 * Map array of BettingSplits to database rows
 */
export function mapBettingSplitsToRows(
  splits: BettingSplit[],
  gameIdMap?: Map<string, string>
): PublicBettingSplitsRow[] {
  const allRows: PublicBettingSplitsRow[] = []

  for (const split of splits) {
    const gameKey = `${split.awayTeam}@${split.homeTeam}`
    const internalGameId = gameIdMap?.get(gameKey)
    const rows = mapBettingSplitToRows(split, internalGameId)
    allRows.push(...rows)
  }

  return allRows
}
