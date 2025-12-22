import { LlmToolDefinition } from './live-tools'

export const espnTools: LlmToolDefinition[] = [
  {
    name: 'espnTeamAtsRecord',
    description: 'Fetch a team ATS record for a given sport/season/seasonType directly from ESPN.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        teamId: { type: 'string' },
        season: { type: 'number' },
        seasonType: { type: 'number', description: '1=pre, 2=regular, 3=post' },
      },
      required: ['sport', 'teamId', 'season'],
    },
  },
  {
    name: 'espnTeamOddsRecord',
    description: 'Fetch a team odds record (favorite/underdog, open/close) for a season.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        teamId: { type: 'string' },
        season: { type: 'number' },
      },
      required: ['sport', 'teamId', 'season'],
    },
  },
  {
    name: 'espnTeamPastPerformances',
    description: 'Fetch team past performances against a betting provider (default 1003).',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        teamId: { type: 'string' },
        providerId: { type: 'string', description: 'Book/provider id, default 1003' },
        limit: { type: 'number', description: 'Number of records to fetch' },
      },
      required: ['sport', 'teamId'],
    },
  },
  {
    name: 'espnTeamFutures',
    description: 'Fetch futures markets and odds for a sport and season (SportsBettingDime).',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        season: { type: 'number' },
        market: {
          type: 'string',
          description: 'Optional market name or SBD market id (e.g., championship, MVP, division).',
        },
        books: {
          type: ['string', 'array'],
          description: 'Optional book ids or slugs (comma-separated or array).',
          items: { type: 'string' },
        },
      },
      required: ['sport', 'season'],
    },
  },
  {
    name: 'espnPredictor',
    description: 'Fetch predictor/power index payload for an event.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        eventId: { type: 'string' },
      },
      required: ['sport', 'eventId'],
    },
  },
  {
    name: 'espnTeamSeasonStats',
    description: 'Fetch team season stats (ESPN splits/categories).',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        teamId: { type: 'string' },
        season: { type: 'number' },
        seasonType: { type: 'number', description: '1=pre, 2=regular, 3=post' },
      },
      required: ['sport', 'teamId', 'season'],
    },
  },
  {
    name: 'espnPlayerSeasonStats',
    description: 'Fetch player season stats (ESPN splits/categories).',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        playerId: { type: 'string' },
        season: { type: 'number' },
        seasonType: { type: 'number', description: '1=pre, 2=regular, 3=post' },
      },
      required: ['sport', 'playerId', 'season'],
    },
  },
  {
    name: 'espnPlayerGameLogs',
    description: 'Fetch player game logs for a season and season type.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        playerId: { type: 'string' },
        season: { type: 'number' },
        seasonType: { type: 'number', description: '1=pre, 2=regular, 3=post' },
      },
      required: ['sport', 'playerId', 'season'],
    },
  },
  {
    name: 'espnEventsByDateRange',
    description: 'Fetch event IDs for a sport over a date range (YYYY-MM-DD to YYYY-MM-DD).',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        from: { type: 'string', description: 'Start date YYYY-MM-DD' },
        to: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      },
      required: ['sport', 'from'],
    },
  },
  {
    name: 'espnEventSnapshot',
    description: 'Fetch summary/boxscore/predictor for a specific event.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
        eventId: { type: 'string' },
      },
      required: ['sport', 'eventId'],
    },
  },
  {
    name: 'espnInjuries',
    description: 'Fetch league-wide injury list for a sport.',
    parameters: {
      type: 'object',
      properties: {
        sport: { type: 'string', enum: ['nba', 'nfl', 'mlb', 'nhl'] },
      },
      required: ['sport'],
    },
  },
]
