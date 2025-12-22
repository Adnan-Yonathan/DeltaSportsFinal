export interface SportResponse {
  name: string
  slug: string
}

export interface LeagueResponse {
  name: string
  slug: string
  eventsCount: number
}

export interface ScoreDto {
  home: number
  away: number
}

export interface LeagueDto {
  name: string
  slug: string
}

export interface SportDto {
  name: string
  slug: string
}

export interface SimpleEventDto {
  id: string | number
  date: string
  home: string
  away: string
  status: string
  league: LeagueDto
  sport: SportDto
  scores?: ScoreDto
}

export interface OddsDto {
  label?: string
  hdp?: number
  home?: string
  draw?: string
  away?: string
  over?: string
  under?: string
  yes?: string
  no?: string
  layHome?: string
  layAway?: string
  layDraw?: string
  layOver?: string
  layUnder?: string
  layYes?: string
  layNo?: string
  homeLink?: string
  awayLink?: string
  drawLink?: string
  depthHome?: string
  depthAway?: string
  depthDraw?: string
  depthOver?: string
  depthUnder?: string
  depthLayHome?: string
  depthLayAway?: string
  depthLayDraw?: string
  depthLayOver?: string
  depthLayUnder?: string
  depthLayYes?: string
  depthLayNo?: string
  max?: number
}

export interface MultiMarketDto {
  name: string
  updatedAt?: string
  odds?: OddsDto[]
}

export interface EventResponse extends SimpleEventDto {
  bookmakers: Record<string, MultiMarketDto[]>
  urls?: Record<string, string>
}

export interface HandicapMovement {
  away: number
  home: number
  draw?: number
  hdp?: string
  max?: number
  timestamp: number
}

export interface HandicapMovementsResponse {
  bookmaker: string
  eventid: string
  market: string
  marketLine?: string
  latest: HandicapMovement
  opening: HandicapMovement
  movements: HandicapMovement[]
}

export interface ArbitrageLegDto {
  bookmaker: string
  label: string
  side: string
  odds: string
  href?: string
  directLink?: string
}

export interface OptimalStakeDto {
  bookmaker: string
  side: string
  stake: number
  potentialReturn: number
}

export interface ArbitrageOpportunityDto {
  id: string
  eventId: string | number
  event?: {
    home: string
    away: string
    date: string
    league: string
    sport: string
  }
  impliedProbability: number
  profitMargin: number
  totalStake: number
  updatedAt: string
  market: {
    name: string
    hdp?: number
  }
  legs: ArbitrageLegDto[]
  optimalStakes?: OptimalStakeDto[]
}
