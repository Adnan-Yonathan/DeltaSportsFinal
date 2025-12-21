/**
 * Tool definitions for the unified sports query system.
 * These tools are used with OpenAI function calling to route queries to the correct data source.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const unifiedTools: ChatCompletionTool[] = [
  // ========================================
  // STATIC DATA TOOLS (fast, no API call)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getStaticTeamStats',
      description: `Get NBA team stats including OPPONENT/DEFENSIVE stats from static data.
Use for questions about:
- Team defense ("What's the Lakers defensive rating?")
- Opponent shooting ("What 3pt% do opponents shoot vs Thunder?")
- Points allowed ("How many points do the Celtics allow?")
- Opponent rebounds ("How many offensive rebounds do the Pelicans allow?")

Available opponent stats: opponentThreeMadePerGame, opponentEffectiveFgPct, opponentTrueShootingPct,
pointsAgainstPerGame, opponentOffensiveReboundsPerGame, opponentReboundsPerGame, defensiveRating, etc.`,
      parameters: {
        type: 'object',
        properties: {
          team: {
            type: 'string',
            description: 'Team name, city, or abbreviation (e.g., "Thunder", "OKC", "Oklahoma City")',
          },
          stats: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Specific stats to retrieve. Common stats: pointsForPerGame, pointsAgainstPerGame, defensiveRating, offensiveRating, pace, opponentThreeMadePerGame, opponentEffectiveFgPct, opponentOffensiveReboundsPerGame',
          },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getStaticPlayerStats',
      description: `Get NBA player season averages from static data.
Use for questions like:
- "What's Curry's PPG?"
- "How many assists does Trae Young average?"
- "What's LeBron's shooting percentage?"`,
      parameters: {
        type: 'object',
        properties: {
          player: {
            type: 'string',
            description: 'Player name - can be first name, last name, or full name. Examples: "LeBron", "Curry", "Stephen Curry", "LeBron James". Extract ONLY the player name from the query, not words like "stats" or "for".',
          },
        },
        required: ['player'],
      },
    },
  },

  // ========================================
  // ESPN LIVE DATA TOOLS
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getEspnTeamStats',
      description: `Get current team season stats from ESPN for any sport.
Use when static data is not available or for non-NBA sports.`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or ID' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], description: 'Sport league' },
        },
        required: ['team', 'sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEspnPlayerStats',
      description: `Get player season stats from ESPN.
Use for non-NBA players or when you need the most up-to-date stats.`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        },
        required: ['player', 'sport'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getEspnPlayerGameLogs',
      description: `Get player game-by-game stats for the season.
Use for:
- Recent performance analysis
- Game-by-game breakdowns
- Trend analysis over multiple games`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
          lastNGames: { type: 'number', description: 'Limit to last N games (optional)' },
        },
        required: ['player', 'sport'],
      },
    },
  },
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
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
          date: { type: 'string', description: 'Date in YYYY-MM-DD format (optional, defaults to today)' },
        },
        required: ['sport'],
      },
    },
  },
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

  // ========================================
  // AGGREGATION TOOLS (complex queries)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getPlayerThresholdGames',
      description: `Count games where a player exceeded a stat threshold.
Use for ANY question about counting games with stat thresholds including:
- "How many 40-point games has Luka had?"
- "How many 40+ point games has Luka had this season"
- "How many games has Curry made 5+ threes?"
- "How many triple-doubles does Jokic have?"
- "Times LeBron scored 30+"
- "Has Tatum had any 50 point games?"
- "Luka games with 40 or more points"`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          stat: {
            type: 'string',
            enum: ['PTS', 'REB', 'AST', '3PM', 'STL', 'BLK', 'FGM', 'FTM'],
            description: 'Stat to check',
          },
          threshold: { type: 'number', description: 'Minimum value' },
          operator: { type: 'string', enum: ['>=', '>', '='], default: '>=' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['player', 'stat', 'threshold'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlayerVsOpponent',
      description: `Get a player's stats against a specific opponent this season.
Use for questions like:
- "How does Giannis perform against the Celtics?"
- "What are Tatum's stats vs the Heat?"`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          opponent: { type: 'string', description: 'Opponent team name' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['player', 'opponent'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getPlayerRestSplit',
      description: `Analyze player performance on back-to-back games vs well-rested games.
Use for:
- "How does Embiid play on back-to-backs?"
- "Does LeBron's scoring drop on no rest?"`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['player'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTeamBackToBackSplit',
      description: `Analyze team performance on back-to-back games (second game of B2B) vs well-rested games.
Use for:
- "How do the Lakers do on back-to-backs?"
- "Thunder's record on no rest"
- "Do the Celtics struggle on B2Bs?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or abbreviation' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTeamQuarterThreshold',
      description: `Count games where a team exceeded a scoring threshold in a specific quarter.
Use for questions like:
- "How many times did the Lakers score 30+ in Q1?"
- "How often do the Celtics score under 25 in the 4th quarter?"
- "Times the Warriors scored over 35 in Q3"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or abbreviation' },
          quarter: { type: 'number', description: 'Quarter number (1-4)', minimum: 1, maximum: 4 },
          threshold: { type: 'number', description: 'Points threshold' },
          operator: { type: 'string', enum: ['>=', '>', '<', '<=', '='], default: '>=' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team', 'quarter', 'threshold'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTeamQuarterAverages',
      description: `Get a team's average points per quarter (Q1, Q2, Q3, Q4).
Use for questions like:
- "What's the Lakers average first quarter score?"
- "How many points do the Celtics average in Q3?"
- "Which quarter do the Warriors score most in?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or abbreviation' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getQuarterWinners',
      description: `Analyze which team won each quarter across games.
Use for questions like:
- "How often do the Celtics win Q1?"
- "Do the Lakers win more 3rd quarters or 4th quarters?"
- "What's the Thunder's quarter-by-quarter win rate?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or abbreviation' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTeamFirstToScore',
      description: `Analyze how often a team scores first in games.
Use for questions like:
- "How often do the Lakers score first?"
- "What's the Warriors first-to-score percentage?"
- "Does Boston usually score first?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name or abbreviation' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getFirstBasketScorer',
      description: `Get how many times a specific player scored the first basket for their team.
Use for questions like:
- "How many times has LeBron scored the first basket?"
- "Does Curry often score first for the Warriors?"
- "First basket scorer frequency for Giannis"`,
      parameters: {
        type: 'object',
        properties: {
          player: { type: 'string', description: 'Player name' },
          team: { type: 'string', description: 'Team name (optional, helps filter games)' },
          sport: { type: 'string', enum: ['nba'], default: 'nba' },
        },
        required: ['player'],
      },
    },
  },

  // ========================================
  // BETTING/ATS TOOLS
  // ========================================
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
  {
    type: 'function',
    function: {
      name: 'getTeamAfterLoss',
      description: `Get team performance after a loss.
Use for:
- "How do the Warriors perform after a loss?"
- "What's the Celtics record following losses?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getTeamHomeAwayDefense',
      description: `Get team defensive splits between home and away games.
Use for:
- "How does the Pacers defense compare at home vs away?"
- "Do the Lakers defend better at home?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name' },
          sport: { type: 'string', enum: ['nba', 'nfl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_team_ats_records',
      description: `Get Against The Spread (ATS) betting records for an NBA team from Covers.com. Returns overall, home/away, favorite/underdog records, streaks, and last 10 games. Use when users ask about team betting performance, covering trends, or ATS records.`,
      parameters: {
        type: 'object',
        properties: {
          team_name: {
            type: 'string',
            description: 'Team name or abbreviation (e.g., "Lakers", "Boston Celtics", "BOS")'
          }
        },
        required: ['team_name']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_betting_splits',
      description: `Get public betting percentages and splits for ALL of today's NBA games from Covers.com. Shows what % of bets and money are on each side for every game, and detects sharp money (when money % diverges from bet % by 15%+). Use when users ask about:
- Public betting trends for today's games (plural)
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
            description: 'The game ID from Covers.com (only if you already have it from a previous get_betting_splits call)'
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
  {
    type: 'function',
    function: {
      name: 'get_game_recommendations',
      description: `Calculate target betting lines for NBA spreads and totals based on statistical analysis. Analyzes team stats (ORtg, DRtg, Pace), rest/travel factors, ATS trends, and betting splits to project what the line SHOULD be. Does NOT reference external odds - purely model-based projections. Use when users ask:
- "What should the Lakers spread be?"
- "What's a fair line for Warriors vs Celtics?"
- "What total makes sense for this game?"
- "Calculate the target spread for the Thunder game"
Returns target lines with confidence level and supporting statistical factors.`,
      parameters: {
        type: 'object',
        properties: {
          gameIdentifier: {
            type: 'string',
            description: 'Team names for the matchup (e.g., "Lakers Celtics", "Warriors vs Heat", "Thunder")'
          },
          marketType: {
            type: 'string',
            enum: ['spread', 'total', 'all'],
            description: 'Type of line to calculate (default: all)'
          }
        },
        required: ['gameIdentifier']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_prop_recommendations',
      description: `Calculate target player prop lines based on statistical analysis. Projects what the prop line SHOULD be using season averages, usage rate, pace, and rest factors. Does NOT reference external odds - purely model-based projections. Use when users ask:
- "What should LeBron's points line be?"
- "Fair target for Curry 3-pointers?"
- "Calculate Jokic rebounds line"
- "What's a reasonable line for Tatum points?"
Supports points, rebounds, assists, threes, and PRA (points+rebounds+assists).`,
      parameters: {
        type: 'object',
        properties: {
          playerName: {
            type: 'string',
            description: 'Player full name (e.g., "LeBron James", "Stephen Curry")'
          },
          propType: {
            type: 'string',
            description: 'Type of prop: points, rebounds, assists, threes, PRA, etc.'
          },
          gameIdentifier: {
            type: 'string',
            description: 'Optional game or opponent info to provide context'
          }
        },
        required: ['playerName', 'propType']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_live_betting_projection',
      description: `Project live betting lines (spread/total) for an IN-PROGRESS NBA game based on current game state, momentum, and team performance. Analyzes live score, game flow, team stats, pace, and execution to calculate what the live spread SHOULD be. Use ONLY when users ask about:
- "What's your projected live line for [team] game?"
- "Live spread projection for [team] vs [team]"
- "What should the live line be for the [team] game?"
- "Live betting projection for [matchup]"
Returns projected live spread with confidence level and supporting factors like current score, momentum, team performance relative to expectations.`,
      parameters: {
        type: 'object',
        properties: {
          gameIdentifier: {
            type: 'string',
            description: 'Team names for the live game (e.g., "Spurs Hawks", "Lakers vs Celtics", "Warriors")'
          }
        },
        required: ['gameIdentifier']
      }
    }
  },

  // ========================================
  // SCHEDULE/CONTEXT TOOLS
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getTeamScheduleContext',
      description: `Analyze team schedule for travel, rest, and back-to-backs.
Use for:
- "How will the Trail Blazers road trip affect them?"
- "Is this a schedule spot for the Lakers?"
- "How much rest do the Celtics have?"`,
      parameters: {
        type: 'object',
        properties: {
          team: { type: 'string', description: 'Team name' },
          lookAhead: { type: 'number', description: 'Days to look ahead (default 7)' },
          lookBack: { type: 'number', description: 'Days to look back (default 7)' },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], default: 'nba' },
        },
        required: ['team'],
      },
    },
  },

  // ========================================
  // LEADERBOARD TOOLS
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getLeaderboard',
      description: `Get league leaders for a specific stat or category.
Use for:
- "Who leads the league in steals?"
- "Who has the most triple-doubles?"
- "Top scorers in the NBA"`,
      parameters: {
        type: 'object',
        properties: {
          stat: {
            type: 'string',
            description: 'Stat category (PTS, REB, AST, STL, BLK, 3PM, etc.)',
          },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], default: 'nba' },
          limit: { type: 'number', description: 'Number of players to return (default 10)' },
        },
        required: ['stat'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAtsLeaderboard',
      description: `Get teams with best ATS records.
Use for:
- "Which teams cover the spread most?"
- "Best ATS teams as underdogs?"`,
      parameters: {
        type: 'object',
        properties: {
          situation: {
            type: 'string',
            enum: ['overall', 'home', 'away', 'favorite', 'underdog'],
          },
          sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'], default: 'nba' },
          limit: { type: 'number', description: 'Number of teams to return (default 10)' },
        },
        required: [],
      },
    },
  },

  // ========================================
  // FALLBACK TOOL
  // ========================================
  {
    type: 'function',
    function: {
      name: 'webSearch',
      description: `Search the web for information not available in other data sources.
Use as a LAST RESORT when:
- Question is about very recent news/events
- Data is not available in static or ESPN sources
- Question is about non-major sports
- Historical data beyond current season`,
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query - be specific and include relevant context',
          },
        },
        required: ['query'],
      },
    },
  },
]

// Export tool names for easy reference
export const TOOL_NAMES = {
  // Static
  STATIC_TEAM_STATS: 'getStaticTeamStats',
  STATIC_PLAYER_STATS: 'getStaticPlayerStats',
  // ESPN
  ESPN_TEAM_STATS: 'getEspnTeamStats',
  ESPN_PLAYER_STATS: 'getEspnPlayerStats',
  ESPN_PLAYER_GAME_LOGS: 'getEspnPlayerGameLogs',
  LIVE_SCORES: 'getLiveScores',
  INJURIES: 'getInjuries',
  // Aggregations
  PLAYER_THRESHOLD: 'getPlayerThresholdGames',
  PLAYER_VS_OPPONENT: 'getPlayerVsOpponent',
  PLAYER_REST_SPLIT: 'getPlayerRestSplit',
  TEAM_B2B_SPLIT: 'getTeamBackToBackSplit',
  // Quarter Analytics
  TEAM_QUARTER_THRESHOLD: 'getTeamQuarterThreshold',
  TEAM_QUARTER_AVERAGES: 'getTeamQuarterAverages',
  QUARTER_WINNERS: 'getQuarterWinners',
  TEAM_FIRST_TO_SCORE: 'getTeamFirstToScore',
  FIRST_BASKET_SCORER: 'getFirstBasketScorer',
  // Betting
  TEAM_ATS: 'getTeamAtsAnalysis',
  TEAM_AFTER_LOSS: 'getTeamAfterLoss',
  TEAM_HOME_AWAY_DEFENSE: 'getTeamHomeAwayDefense',
  COVERS_ATS_RECORDS: 'get_team_ats_records',
  COVERS_BETTING_SPLITS: 'get_betting_splits',
  COVERS_ANALYZE_SPLITS: 'analyze_game_splits',
  GAME_RECOMMENDATIONS: 'get_game_recommendations',
  PROP_RECOMMENDATIONS: 'get_prop_recommendations',
  // Schedule
  SCHEDULE_CONTEXT: 'getTeamScheduleContext',
  // Leaderboards
  LEADERBOARD: 'getLeaderboard',
  ATS_LEADERBOARD: 'getAtsLeaderboard',
  // Fallback
  WEB_SEARCH: 'webSearch',
} as const
