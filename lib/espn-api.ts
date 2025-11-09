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
export function matchBetToGame(betDescription: string, scores: LiveScore[]): LiveScore | null {
  const normalizedBet = betDescription.toLowerCase()

  for (const score of scores) {
    const homeTeamLower = score.homeTeam.toLowerCase()
    const awayTeamLower = score.awayTeam.toLowerCase()

    // Check if bet description contains both team names or parts of them
    if (normalizedBet.includes(homeTeamLower) || normalizedBet.includes(awayTeamLower)) {
      // Simple match - could be improved with fuzzy matching
      return score
    }

    // Check for team abbreviations or partial names
    const homeWords = homeTeamLower.split(' ')
    const awayWords = awayTeamLower.split(' ')

    for (const word of [...homeWords, ...awayWords]) {
      if (word.length > 3 && normalizedBet.includes(word)) {
        return score
      }
    }
  }

  return null
}
