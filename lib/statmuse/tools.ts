/**
 * Tool definitions for the unified sports query system.
 * These tools are used with OpenAI function calling to route queries to the correct data source.
 */

import type { ChatCompletionTool } from 'openai/resources/chat/completions'

export const unifiedTools: ChatCompletionTool[] = [
  // ========================================
  // NBA TEAM/PLAYER STATS (ESPN-sourced)
  // ========================================
  {
    type: 'function',
    function: {
      name: 'getStaticTeamStats',
      description: `Get NBA team stats including OPPONENT/DEFENSIVE stats from ESPN data.
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
      description: `Get NBA player season averages from ESPN data.
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
      description: `Get current team season stats for any sport. For NFL, this uses record-derived PPG/PAPG data to avoid ESPN defensive stat gaps.
Use for non-NBA sports or when you need up-to-date team stats directly.`,
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
      name: 'get_betting_splits',
      description: `Get public betting percentages and splits for ALL of today's NBA games from SportsBettingDime. Shows what % of bets and money are on each side for every game, and detects sharp money (when money % diverges from bet % by 15%+). Use when users ask about:
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
  {
    type: 'function',
    function: {
      name: 'get_game_recommendations',
      description: `Calculate target betting lines for NBA spreads and totals based on statistical analysis. Analyzes team stats (ORtg, DRtg, Pace), rest/travel factors, ATS trends, and betting splits, then applies sharp signal weighting (splits/line movement) when available to project what the line SHOULD be. Use when users ask:
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
      name: 'get_slate_edge_detection',
      description: `SLATE-WIDE edge detection - analyzes ALL games for a sport to find betting edges across the ENTIRE slate. This is for MULTI-GAME analysis, NOT single matchups.

TRIGGER PHRASES (use this tool when user says):
- "edge detection" + "slate" or "all games" or "tonight" or "today"
- "run edge detection on nba/nfl/etc"
- "find edges for all games"
- "which games have value today"
- "scan the slate for edges"

Compares model projections to market lines for spreads and totals across all upcoming games.
For NBA, NCAAB, NFL, NCAAF, and NHL, this can include player prop edges; for props-only scanning, use get_slate_prop_edge_detection.
Returns summary of games analyzed with strong/soft/no edges and line gaps.`,
      parameters: {
        type: 'object',
        properties: {
          sport: {
            type: 'string',
            enum: ['basketball_nba', 'basketball_ncaab', 'americanfootball_nfl', 'americanfootball_ncaaf', 'baseball_mlb', 'icehockey_nhl'],
            description: 'Sport to analyze (default: basketball_nba)'
          },
          minEdge: {
            type: 'string',
            enum: ['soft', 'strong'],
            description: 'Only return games with at least this edge level (optional - returns all by default)'
          },
          date: {
            type: 'string',
            description: 'Target date in YYYY-MM-DD (America/New_York). Defaults to today.'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_slate_prop_edge_detection',
      description: `SLATE-WIDE prop edge detection - analyzes ALL player props for a sport's slate to find the best prop edges across the ENTIRE slate. This is for MULTI-GAME prop scanning, NOT single player requests.

SUPPORTED SPORTS: NBA, NCAAB, NFL, NCAAF, NHL

TRIGGER PHRASES (use this tool when user says):
- "best props tonight/today" (for any sport)
- "best NFL props today" / "best NBA props tonight" / "best NHL props"
- "prop edges for the slate"
- "what are the best player props for NFL/NBA/NHL"
- "find prop edges in football/basketball/hockey"
- "run prop edge detection"
- "scan the slate for props"
- "best props for tonight's games"
- "which props should I bet on today"
- "best props in Lakers vs Celtics" / "props for Chiefs vs Bills" (matchup-specific - use teams filter)
- "player props for the Nuggets game"

Returns model projections vs market lines with edge ratings (strong/soft).`,
      parameters: {
        type: 'object',
        properties: {
          sport: {
            type: 'string',
            enum: [
              'basketball_nba',
              'basketball_ncaab',
              'americanfootball_nfl',
              'americanfootball_ncaaf',
              'icehockey_nhl',
            ],
            description: 'Sport to analyze (default: basketball_nba)',
          },
          minEdge: {
            type: 'string',
            enum: ['soft', 'strong'],
            description: 'Only return props with at least this edge level (optional)',
          },
          limit: {
            type: 'number',
            description: 'Max number of prop edges to return (optional)',
          },
          markets: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Optional filter for prop markets (e.g., points, rebounds, assists, threes, pra, passing_yards, rushing_yards, receiving_yards, goals, shots)',
          },
          teams: {
            type: 'array',
            items: { type: 'string' },
            description:
              'Filter to specific matchup by team names (e.g., ["Lakers", "Celtics"] for Lakers vs Celtics game). Supports partial team name matching.',
          },
          date: {
            type: 'string',
            description: 'Target date in YYYY-MM-DD (America/New_York). Defaults to today.',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_prop_recommendations',
      description: `Calculate a target line for a SPECIFIC player prop based on statistical analysis. Projects what the prop line SHOULD be using season averages, usage rate, pace, and rest factors. Does NOT reference external odds - purely model-based projections. Use when users ask:
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
      name: 'get_live_boxscore_stats',
      description: `Fetch the latest live boxscore stats (team + player) for a specific ESPN event. Returns team stats, player stat maps, and live status for use in projections and in-game analysis.`,
      parameters: {
        type: 'object',
        properties: {
          league: {
            type: 'string',
            description: 'League key (nba, ncaab, nfl, nhl, cfb).',
            enum: ['nba', 'ncaab', 'nfl', 'nhl', 'cfb']
          },
          eventId: {
            type: 'string',
            description: 'ESPN event id for the live game.'
          }
        },
        required: ['league', 'eventId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_live_betting_projection',
      description: `Project live betting lines (spread/total) for an IN-PROGRESS NBA or NCAAB game based on current game state, momentum, and team performance. Analyzes live score, game flow, team stats, pace, and execution to calculate what the live spread SHOULD be. Use ONLY when users ask about:
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
          },
          sport: {
            type: 'string',
            description: 'Optional sport override (nba or ncaab). Defaults to auto-detect.',
            enum: ['nba', 'ncaab']
          }
        },
        required: ['gameIdentifier']
      }
    }
  },

  // ========================================
  // PROP PROBABILITY TOOLS
  // ========================================
  {
    type: 'function',
    function: {
      name: 'get_ranked_players_by_prop_threshold',
      description: `Rank players by probability of hitting a specific prop threshold. Uses statistical probability models with matchup adjustments (opponent defense, pace, home/away, rest) to find who is most likely to hit over a given number.

SUPPORTED SPORTS: NBA, NFL, NHL

Use for:
- "Which player is most likely to hit 2+ threes?" (NBA)
- "Who has the best chance of scoring 25+ points?" (NBA)
- "Top 10 players most likely to grab 10+ rebounds" (NBA)
- "Rank players by likelihood of hitting 3 assists" (NBA)
- "Best three-point shooters to go over 2.5 threes" (NBA)
- "Which RB is most likely to rush for 100+ yards?" (NFL)
- "Who has the best chance of 5+ receptions?" (NFL)
- "Top players likely to score 1+ goals" (NHL)

Returns ranked list with probability percentages and matchup adjustments. Only includes players from teams playing today by default.`,
      parameters: {
        type: 'object',
        properties: {
          propType: {
            type: 'string',
            description: 'Type of prop. NBA: threes, points, rebounds, assists, PRA. NFL: passing_yards, rushing_yards, receiving_yards, receptions, passing_td, rushing_td. NHL: goals, assists, points, shots.'
          },
          threshold: {
            type: 'number',
            description: 'The threshold number to hit or exceed (e.g., 2 for "2+ threes", 25 for "25+ points")'
          },
          sport: {
            type: 'string',
            enum: ['nba', 'nfl', 'nhl'],
            description: 'Sport to analyze (default: nba). Use nfl for football, nhl for hockey.'
          },
          todayOnly: {
            type: 'boolean',
            description: 'If true (default), only include players from teams playing today'
          },
          limit: {
            type: 'number',
            description: 'Number of players to return (default 20, max 50)'
          }
        },
        required: ['propType', 'threshold']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_single_player_prop_probability',
      description: `Calculate the probability of a SPECIFIC player hitting a prop threshold. Use this for individual player probability queries.

SUPPORTED SPORTS: NBA, NFL, NHL

TRIGGER PHRASES (use this tool when user says):
- "What are the chances of LeBron scoring 30+ points?"
- "Probability of Patrick Mahomes throwing 300+ yards"
- "Will Jokic get 10+ rebounds?"
- "Chances of McDavid scoring 2+ goals"
- "How likely is Kelce to get 100+ receiving yards?"
- "What's the probability of Curry hitting 5+ threes?"

Returns season average, adjusted projection, probability percentage, and recommendation.`,
      parameters: {
        type: 'object',
        properties: {
          playerName: {
            type: 'string',
            description: 'Full name of the player (e.g., "LeBron James", "Patrick Mahomes")'
          },
          propType: {
            type: 'string',
            description: 'Type of prop. NBA: threes, points, rebounds, assists, PRA. NFL: passing_yards, rushing_yards, receiving_yards, receptions, passing_td. NHL: goals, assists, points, shots.'
          },
          threshold: {
            type: 'number',
            description: 'The threshold number to hit or exceed (e.g., 30 for "30+ points")'
          },
          sport: {
            type: 'string',
            enum: ['nba', 'nfl', 'nhl'],
            description: 'Sport (default: nba). Use nfl for football, nhl for hockey.'
          }
        },
        required: ['playerName', 'propType', 'threshold']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'combo_analysis',
      description: `Analyze combined bet probability for parlays and multi-leg bets. Calculates probability considering correlations between related events (same-player props, same-game outcomes).
Use for:
- "What's the chance Curry scores 25+ AND hits 4+ threes?"
- "Probability of Warriors winning AND Lakers losing"
- "Parlay probability: Jokic triple-double + Nuggets cover"
- "Combo analysis: LeBron 30 pts + Lakers cover"
- "What are the odds of hitting both props?"
Returns individual leg probabilities, correlation adjustments, and combined probability with implied fair odds.`,
      parameters: {
        type: 'object',
        properties: {
          legs: {
            type: 'array',
            description: 'Array of bet legs to analyze',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['player_prop', 'game_spread', 'game_total', 'game_moneyline'],
                  description: 'Type of bet'
                },
                player: {
                  type: 'string',
                  description: 'Player name (for player_prop)'
                },
                propType: {
                  type: 'string',
                  description: 'Prop stat type: points, threes, rebounds, assists, PRA (for player_prop)'
                },
                threshold: {
                  type: 'number',
                  description: 'Prop line/threshold (for player_prop)'
                },
                propDirection: {
                  type: 'string',
                  enum: ['over', 'under'],
                  description: 'Over or under (for player_prop)'
                },
                homeTeam: {
                  type: 'string',
                  description: 'Home team name (for game bets)'
                },
                awayTeam: {
                  type: 'string',
                  description: 'Away team name (for game bets)'
                },
                line: {
                  type: 'number',
                  description: 'Spread or total line (for game_spread or game_total)'
                },
                direction: {
                  type: 'string',
                  enum: ['home', 'away', 'over', 'under'],
                  description: 'Bet direction (for game bets)'
                },
                marketOdds: {
                  type: 'number',
                  description: 'American odds from sportsbook (optional, for edge calculation)'
                }
              }
            }
          }
        },
        required: ['legs']
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
  // LINE SHOPPING / ODDS COMPARISON
  // ========================================
  {
    type: 'function',
    function: {
      name: 'get_odds_comparison',
      description: `Compare odds across all sportsbooks for a game. Shows best available lines at each book for spreads, totals, and moneylines.
Use when users ask:
- "Shop lines for Lakers game"
- "Best odds on Chiefs vs Ravens"
- "Compare books for Celtics spread"
- "Which book has the best line on Warriors?"
- "Line shopping for tonight's game"
- "Where can I get the best price on [team]?"
Returns a comparison table with best odds from each sportsbook.`,
      parameters: {
        type: 'object',
        properties: {
          team: {
            type: 'string',
            description: 'Team name or matchup (e.g., "Lakers", "Lakers vs Celtics", "Chiefs Ravens")'
          },
          market: {
            type: 'string',
            enum: ['spread', 'moneyline', 'total', 'all'],
            description: 'Type of market to compare (default: all)'
          },
          sport: {
            type: 'string',
            enum: ['basketball_nba', 'basketball_ncaab', 'americanfootball_nfl', 'americanfootball_ncaaf', 'baseball_mlb', 'icehockey_nhl'],
            description: 'Sport key (default: auto-detect based on team)'
          }
        },
        required: ['team']
      }
    }
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
- Data is not available in ESPN sources
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
  LIVE_BOXSCORE_STATS: 'get_live_boxscore_stats',
  LIVE_BETTING_PROJECTION: 'get_live_betting_projection',
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
  COVERS_BETTING_SPLITS: 'get_betting_splits',
  COVERS_ANALYZE_SPLITS: 'analyze_game_splits',
  GAME_RECOMMENDATIONS: 'get_game_recommendations',
  SLATE_EDGE_DETECTION: 'get_slate_edge_detection',
  SLATE_PROP_EDGE_DETECTION: 'get_slate_prop_edge_detection',
  PROP_RECOMMENDATIONS: 'get_prop_recommendations',
  PROP_THRESHOLD_RANKING: 'get_ranked_players_by_prop_threshold',
  SINGLE_PLAYER_PROP_PROBABILITY: 'get_single_player_prop_probability',
  COMBO_ANALYSIS: 'combo_analysis',
  // Schedule
  SCHEDULE_CONTEXT: 'getTeamScheduleContext',
  // Leaderboards
  LEADERBOARD: 'getLeaderboard',
  ATS_LEADERBOARD: 'getAtsLeaderboard',
  // Line Shopping
  ODDS_COMPARISON: 'get_odds_comparison',
  // Fallback
  WEB_SEARCH: 'webSearch',
} as const
