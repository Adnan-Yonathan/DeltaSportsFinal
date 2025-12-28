/**
 * Operation Messages Mapping
 * Maps tool/operation names to user-friendly loading messages
 */

export const OPERATION_MESSAGES: Record<string, string> = {
  // Bet Management (5)
  'log_bet': 'Logging your bet...',
  'log_multiple_bets': 'Logging multiple bets...',
  'create_parlay': 'Creating your parlay...',
  'get_parlays': 'Fetching recent parlays...',
  'settle_bet': 'Settling bet...',

  // Stats Fetching (8)
  'get_stats': 'Fetching team statistics...',
  'get_player_season_stats': 'Getting player season stats...',
  'get_player_props': 'Getting player prop odds...',
  'get_bankroll_stats': 'Analyzing bankroll performance...',

  // Custom Models (3)
  'save_custom_model': 'Saving your custom model...',
  'list_custom_models': 'Loading saved models...',
  'apply_custom_model': 'Running your custom model...',

  // Game Analysis (1)
  'get_game_context': 'Analyzing game matchup...',
  'get_pick_guidance': 'Building a best-bet map...',
  'analyze_bet_market': 'Analyzing the betting market...',

  // Research Models (3)
  'save_research_model': 'Saving research model...',
  'run_research_model': 'Scanning betting markets...',
  'list_research_opportunities': 'Loading research results...',

  // Bet Sizing (1)
  'calculate_kelly': 'Calculating Kelly Criterion...',

  // ESPN Tools (11)
  'espnTeamAtsRecord': 'Fetching ATS records...',
  'espnTeamOddsRecord': 'Getting odds records...',
  'espnTeamPastPerformances': 'Loading past performances...',
  'espnTeamFutures': 'Fetching futures odds...',
  'espnPredictor': 'Getting game predictor data...',
  'espnTeamSeasonStats': 'Fetching team season stats...',
  'espnPlayerSeasonStats': 'Getting player season stats...',
  'espnPlayerGameLogs': 'Loading player game logs...',
  'espnEventsByDateRange': 'Fetching events schedule...',
  'espnEventSnapshot': 'Getting game snapshot...',
  'espnInjuries': 'Checking injury reports...',

  // Unified Query Tools - Static Data (2)
  'getStaticTeamStats': 'Loading team statistics...',
  'getStaticPlayerStats': 'Loading player statistics...',

  // Unified Query Tools - ESPN Live Data (5)
  'getEspnTeamStats': 'Fetching live team stats...',
  'getEspnPlayerStats': 'Fetching live player stats...',
  'getEspnPlayerGameLogs': 'Getting player game logs...',
  'getLiveScores': 'Fetching live scores...',
  'getInjuries': 'Checking injury reports...',

  // Unified Query Tools - Aggregations (4)
  'getPlayerThresholdGames': 'Analyzing performance thresholds...',
  'getPlayerVsOpponent': 'Getting head-to-head stats...',
  'getPlayerRestSplit': 'Analyzing rest splits...',
  'getTeamBackToBackSplit': 'Analyzing back-to-back performance...',

  // Unified Query Tools - Betting/ATS (9)
  'getTeamAtsAnalysis': 'Getting ATS analysis...',
  'getTeamAfterLoss': 'Analyzing post-loss performance...',
  'getTeamHomeAwayDefense': 'Getting defensive splits...',
  'get_betting_splits': 'Getting public betting splits...',
  'analyze_game_splits': 'Analyzing game betting action...',
  'get_game_recommendations': 'Calculating game recommendations...',
  'get_prop_recommendations': 'Calculating prop recommendations...',
  'get_ranked_players_by_prop_threshold': 'Ranking players by prop probability...',
  'combo_analysis': 'Analyzing combined bet probability...',
  'getAtsLeaderboard': 'Getting ATS leaderboard...',

  // Unified Query Tools - Schedule/Context (1)
  'getTeamScheduleContext': 'Analyzing team schedule...',

  // Unified Query Tools - Leaderboard (1)
  'getLeaderboard': 'Getting league leaders...',

  // Fallback (1)
  'webSearch': 'Searching the web...',
}

/**
 * Get user-friendly message for a tool/operation name
 * @param toolName - The name of the tool being executed
 * @returns User-friendly loading message
 */
export function getOperationMessage(toolName: string): string {
  return OPERATION_MESSAGES[toolName] || 'Processing request...'
}
