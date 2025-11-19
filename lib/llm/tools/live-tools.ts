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
]
