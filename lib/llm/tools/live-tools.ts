export interface LlmToolDefinition {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export const liveDataTools: LlmToolDefinition[] = [
  {
    name: "getLiveScores",
    description: "Fetch live and scheduled games for a league/date with current scores and status.",
    parameters: {
      type: "object",
      properties: {
        league: {
          type: "string",
          description: "League identifier (nba, nfl, nhl, cfb, ncaab).",
        },
        date: {
          type: "string",
          description: "UTC date (YYYY-MM-DD). Optional.",
        },
      },
      required: ["league"],
    },
  },
  {
    name: "getGameDetails",
    description: "Pull starters, bench, line scores, and stats for a specific event.",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string" },
        eventId: { type: "string" },
      },
      required: ["league", "eventId"],
    },
  },
  {
    name: "getTeamSnapshot",
    description: "Return current season record, leaders, and injury list for a team.",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string" },
        teamId: { type: "string" },
      },
      required: ["league", "teamId"],
    },
  },
  {
    name: "getPlayerStats",
    description: "Fetch the latest season averages and bio for a player.",
    parameters: {
      type: "object",
      properties: {
        league: { type: "string" },
        playerId: { type: "string" },
      },
      required: ["league", "playerId"],
    },
  },
  {
    name: "getLiveBettingRecommendation",
    description: "Get real-time betting recommendations with statistical confidence intervals for a live game. Analyzes current score, time remaining, momentum factors (scoring runs, pace changes, foul trouble), and generates updated spread/total lines with tight confidence ranges (±1 point max). Use this when user asks about live betting opportunities or wants to know what the fair line is RIGHT NOW for an in-progress game.",
    parameters: {
      type: "object",
      properties: {
        league: {
          type: "string",
          description: "League identifier (nba, nfl, nhl, cfb, ncaab).",
        },
        eventId: {
          type: "string",
          description: "The ESPN event ID for the live game.",
        },
        betType: {
          type: "string",
          enum: ["spread", "total", "both"],
          description: "Which bet type to analyze: spread, total, or both. Defaults to 'both'.",
        },
      },
      required: ["league", "eventId"],
    },
  },
]
