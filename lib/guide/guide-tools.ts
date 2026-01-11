/**
 * Minimal tool set for the Guide chat mode.
 * Only 5 tools - focuses on routing users to pages rather than heavy data pulls.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const guideTools: ChatCompletionTool[] = [
  // 1. getLiveScores - current game scores
  {
    type: 'function',
    function: {
      name: 'getLiveScores',
      description: `Get current live scores and game information.
Use for:
- "What's the score of the Lakers game?"
- "Who's winning the Celtics game?"
- "Are there any games on right now?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name to filter (optional)' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'Sport league' },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional, defaults to today)' },
        },
        required: ['sport'],
      },
    },
  },

  // 2. getInjuries - injury reports
  {
    type: 'function',
    function: {
      name: 'getInjuries',
      description: `Get current injury report for a team or league.
Use for:
- "Who's injured on the Lakers?"
- "What's the injury report for tonight's games?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name (optional - if omitted, returns league-wide)' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        },
        required: ['sport'],
      },
    },
  },

  // 3. get_betting_splits - public betting %s for all games
  {
    type: 'function',
    function: {
      name: 'get_betting_splits',
      description: `Get public betting percentages and splits for ALL of today's NBA games. Shows what % of bets and money are on each side for every game, and detects sharp money (when money % diverges from bet % by 15%+). Use when users ask about:
- Public betting trends for today's games
- Where the money is going across all games
- Sharp action or smart money in general
- Today's betting splits without specifying teams
Returns game details including teams, time, and game_id for each matchup.`,
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },

  // 4. analyze_game_splits - deep dive single game
  {
    type: 'function',
    function: {
      name: 'analyze_game_splits',
      description: `Deep analysis of betting splits for ONE SPECIFIC NBA game between two teams. Shows detailed bet %, money %, spread, total, and divergence analysis to identify sharp vs public action. Use when users ask about betting splits for a PARTICULAR MATCHUP like "Warriors vs Trail Blazers game", "Lakers Celtics betting", or "splits in the Bucks game". Provide team names and the system will find the matching game from today's schedule.`,
      parameters: {
        type: 'object',
        properties: {
          game_id: {
            type: 'string',
            description: 'The game ID from SportsBettingDime (only if you already have it from a previous get_betting_splits call)'
          },
          teams: {
            type: 'string',
            description: 'Team names from the game, like "Warriors Trail Blazers", "Lakers vs Celtics", or "Bucks". The system will match these to today\'s games.'
          }
        },
        required: []
      }
    }
  },

  // 5. getTeamAtsAnalysis - team ATS records
  {
    type: 'function',
    function: {
      name: 'getTeamAtsAnalysis',
      description: `Get team Against The Spread (ATS) record with situational splits.
Use for:
- "What's the Thunder's ATS record?"
- "How do the Lakers do against the spread as favorites?"
- "Which teams cover best on the road?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name' },
          situation: {
            type: 'string',
            enum: ['overall', 'home', 'away', 'favorite', 'underdog', 'home_favorite', 'away_underdog'],
            description: 'Specific situation to analyze',
          },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
]

// Export tool names for easy reference
export const GUIDE_TOOL_NAMES = {
  LIVE_SCORES: 'getLiveScores',
  INJURIES: 'getInjuries',
  BETTING_SPLITS: 'get_betting_splits',
  ANALYZE_SPLITS: 'analyze_game_splits',
  TEAM_ATS: 'getTeamAtsAnalysis',
} as const

export type GuideToolName = typeof GUIDE_TOOL_NAMES[keyof typeof GUIDE_TOOL_NAMES]
