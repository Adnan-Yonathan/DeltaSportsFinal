/**
 * ESPN Period Scores Provider
 *
 * Extracts quarter-by-quarter scoring from ESPN event summaries
 * and provides the same interface as Sportradar period scores.
 */

// Re-export PeriodScoreRecord type from Sportradar for compatibility
export interface PeriodScoreRecord {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeTeamAbbr?: string
  awayTeamAbbr?: string
  gameDate: Date
  periodNumber: number
  periodType: 'quarter' | 'overtime' | 'half'
  homePoints: number
  awayPoints: number
}

const ESPN_SITE_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports'

/**
 * Fetch event summary from ESPN
 */
async function getEventSummary(eventId: string, sport: 'basketball' = 'basketball', league: 'nba' = 'nba'): Promise<any | null> {
  const url = `${ESPN_SITE_API_BASE}/${sport}/${league}/summary?event=${eventId}`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error(`Failed to fetch event summary for ${eventId}:`, error)
    return null
  }
}

/**
 * Extract period scores from ESPN event summary
 * ESPN format: competitors[].linescores[] contains displayValue for each period
 */
export function extractEspnPeriodScores(
  eventSummary: any,
  gameDate: Date
): PeriodScoreRecord[] {
  const records: PeriodScoreRecord[] = []

  if (!eventSummary?.header?.competitions?.[0]) {
    return records
  }

  const competition = eventSummary.header.competitions[0]
  const gameId = eventSummary.header?.id || competition?.id
  const competitors = competition.competitors || []

  if (competitors.length !== 2) {
    return records
  }

  // Identify home and away teams
  const homeComp = competitors.find((c: any) => c.homeAway === 'home')
  const awayComp = competitors.find((c: any) => c.homeAway === 'away')

  if (!homeComp || !awayComp) {
    return records
  }

  const homeTeam = homeComp.team?.displayName || homeComp.team?.name || ''
  const awayTeam = awayComp.team?.displayName || awayComp.team?.name || ''
  const homeTeamAbbr = homeComp.team?.abbreviation || homeComp.team?.shortDisplayName
  const awayTeamAbbr = awayComp.team?.abbreviation || awayComp.team?.shortDisplayName

  // Extract linescores (period-by-period scores)
  const homeLinescores = homeComp.linescores || []
  const awayLinescores = awayComp.linescores || []

  if (homeLinescores.length === 0 || awayLinescores.length === 0) {
    return records
  }

  // Create period records
  for (let i = 0; i < homeLinescores.length; i++) {
    const homeLine = homeLinescores[i]
    const awayLine = awayLinescores[i]

    // Parse scores (displayValue might be string like "28")
    const homePoints = parseInt(homeLine?.displayValue || homeLine?.value || '0', 10)
    const awayPoints = parseInt(awayLine?.displayValue || awayLine?.value || '0', 10)

    // Skip if both are 0 or NaN
    if (isNaN(homePoints) || isNaN(awayPoints)) {
      continue
    }

    // Period number (1-based index)
    const periodNumber = i + 1

    // Determine period type
    // For NBA: 1-4 = quarters, 5+ = overtime
    let periodType: 'quarter' | 'overtime' | 'half' = 'quarter'
    if (periodNumber <= 4) {
      periodType = 'quarter'
    } else {
      periodType = 'overtime'
    }

    records.push({
      gameId: String(gameId),
      homeTeam,
      awayTeam,
      homeTeamAbbr,
      awayTeamAbbr,
      gameDate,
      periodNumber,
      periodType,
      homePoints,
      awayPoints,
    })
  }

  return records
}

/**
 * Fetch scoreboard for a specific date
 */
async function getScoreboard(dateStr: string): Promise<any | null> {
  const url = `${ESPN_SITE_API_BASE}/basketball/nba/scoreboard?dates=${dateStr.replace(/-/g, '')}&limit=500`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    return await res.json()
  } catch (error) {
    console.error(`Failed to fetch scoreboard for ${dateStr}:`, error)
    return null
  }
}

/**
 * Fetch period scores for all completed games on a specific date
 */
export async function fetchEspnDailyPeriodScores(
  date: Date
): Promise<PeriodScoreRecord[]> {
  const allRecords: PeriodScoreRecord[] = []

  try {
    const dateStr = date.toISOString().split('T')[0]
    console.log(`Fetching NBA games for ${dateStr}...`)

    // Get scoreboard for the date
    const scoreboard = await getScoreboard(dateStr)

    if (!scoreboard || !scoreboard.events || scoreboard.events.length === 0) {
      console.log(`No games found for ${dateStr}`)
      return []
    }

    const events = scoreboard.events

    // Filter to completed games only
    const completedEvents = events.filter((e: any) => {
      const status = e?.status?.type?.state
      return status === 'post' || status === 'final'
    })

    console.log(`Found ${completedEvents.length} completed games out of ${events.length} total for ${dateStr}`)

    // Fetch summary for each completed game
    for (const event of completedEvents) {
      const eventId = event.id
      if (!eventId) continue

      try {
        console.log(`Fetching summary for event ${eventId}...`)
        const summary = await getEventSummary(eventId)

        if (summary) {
          const periodScores = extractEspnPeriodScores(summary, date)
          allRecords.push(...periodScores)
          console.log(`  → Extracted ${periodScores.length} period scores`)
        }

        // Rate limiting: wait 500ms between requests
        await new Promise(resolve => setTimeout(resolve, 500))
      } catch (error) {
        console.error(`Error fetching summary for event ${eventId}:`, error)
      }
    }
  } catch (error) {
    console.error(`Error fetching daily schedule:`, error)
  }

  return allRecords
}

/**
 * Fetch period scores for multiple recent days (backfill)
 */
export async function fetchEspnRecentPeriodScores(
  daysBack: number = 7
): Promise<PeriodScoreRecord[]> {
  const allRecords: PeriodScoreRecord[] = []
  const today = new Date()

  for (let i = 1; i <= daysBack; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)

    console.log(`Fetching period scores for ${date.toISOString().split('T')[0]}...`)
    const records = await fetchEspnDailyPeriodScores(date)
    allRecords.push(...records)

    console.log(`  → Total so far: ${allRecords.length} period records`)

    // Rate limiting between days
    await new Promise(resolve => setTimeout(resolve, 1000))
  }

  console.log(`Total period scores fetched: ${allRecords.length}`)
  return allRecords
}
