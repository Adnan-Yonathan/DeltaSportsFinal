// ESPN API Integration
// Unofficial ESPN API endpoints for live scores

export interface LiveScore {
  gameId: string
  sport: string
  homeTeam: string
  awayTeam: string
  homeScore: number
  awayScore: number
  status: string // 'pre' | 'in' | 'post'
  period: string // Quarter, Inning, Period, etc.
  timeRemaining: string
  startTime: string
}

const ESPN_API_BASE = 'https://site.web.api.espn.com/apis/site/v2/sports'

const SPORT_ENDPOINTS = {
  nba: `${ESPN_API_BASE}/basketball/nba/scoreboard`,
  nfl: `${ESPN_API_BASE}/football/nfl/scoreboard`,
  mlb: `${ESPN_API_BASE}/baseball/mlb/scoreboard`,
  nhl: `${ESPN_API_BASE}/hockey/nhl/scoreboard`,
  ncaaf: `${ESPN_API_BASE}/football/college-football/scoreboard`,
  ncaab: `${ESPN_API_BASE}/basketball/mens-college-basketball/scoreboard`,
  soccer: `${ESPN_API_BASE}/soccer/eng.1/scoreboard`, // Premier League
}

export async function fetchESPNScores(sport: keyof typeof SPORT_ENDPOINTS): Promise<LiveScore[]> {
  try {
    const endpoint = SPORT_ENDPOINTS[sport]
    const response = await fetch(endpoint, {
      next: { revalidate: 30 } // Cache for 30 seconds
    })

    if (!response.ok) {
      throw new Error(`ESPN API error: ${response.status}`)
    }

    const data = await response.json()
    return parseESPNResponse(data, sport)
  } catch (error) {
    console.error(`Error fetching ${sport} scores:`, error)
    return []
  }
}

function parseESPNResponse(data: any, sport: string): LiveScore[] {
  const scores: LiveScore[] = []

  if (!data.events) return scores

  for (const event of data.events) {
    const competition = event.competitions?.[0]
    if (!competition) continue

    const homeTeam = competition.competitors?.find((c: any) => c.homeAway === 'home')
    const awayTeam = competition.competitors?.find((c: any) => c.homeAway === 'away')

    if (!homeTeam || !awayTeam) continue

    scores.push({
      gameId: event.id,
      sport: sport.toUpperCase(),
      homeTeam: homeTeam.team?.displayName || homeTeam.team?.name || '',
      awayTeam: awayTeam.team?.displayName || awayTeam.team?.name || '',
      homeScore: parseInt(homeTeam.score) || 0,
      awayScore: parseInt(awayTeam.score) || 0,
      status: competition.status?.type?.state || 'pre',
      period: competition.status?.type?.shortDetail || '',
      timeRemaining: competition.status?.displayClock || '',
      startTime: event.date || '',
    })
  }

  return scores
}

export async function getAllLiveScores(): Promise<LiveScore[]> {
  const sports: (keyof typeof SPORT_ENDPOINTS)[] = ['nba', 'nfl', 'mlb', 'nhl', 'ncaaf', 'ncaab']

  const results = await Promise.allSettled(
    sports.map(sport => fetchESPNScores(sport))
  )

  const allScores: LiveScore[] = []

  results.forEach((result) => {
    if (result.status === 'fulfilled') {
      allScores.push(...result.value)
    }
  })

  return allScores
}

// Helper function to match bet description to live game
const STOP_WORDS = new Set([
  'the',
  'vs',
  'at',
  'and',
  'fc',
  'sc',
  'club',
  'team',
  'los',
  'las',
])

const tokenize = (value: string): string[] => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token))
}

const countMatches = (tokens: Set<string>, candidates: string[]): number => {
  return candidates.reduce((count, token) => count + (tokens.has(token) ? 1 : 0), 0)
}

export function matchBetToGame(betDescription: string, scores: LiveScore[]): LiveScore | null {
  const betTokens = new Set(tokenize(betDescription))
  if (betTokens.size === 0) {
    return null
  }

  let bestMatch: LiveScore | null = null
  let bestScore = 0
  let fallbackMatch: LiveScore | null = null
  let fallbackScore = 0

  for (const score of scores) {
    const homeTokens = tokenize(score.homeTeam)
    const awayTokens = tokenize(score.awayTeam)

    const homeMatches = countMatches(betTokens, homeTokens)
    const awayMatches = countMatches(betTokens, awayTokens)
    const totalMatches = homeMatches + awayMatches

    if (homeMatches > 0 && awayMatches > 0) {
      const statusBoost = score.status === 'in' ? 2 : score.status === 'post' ? 1 : 0
      const scoreValue = totalMatches * 2 + statusBoost

      if (scoreValue > bestScore) {
        bestScore = scoreValue
        bestMatch = score
      }
    } else if (totalMatches > 0 && totalMatches > fallbackScore) {
      fallbackScore = totalMatches
      fallbackMatch = score
    }
  }

  return bestMatch || fallbackMatch
}
