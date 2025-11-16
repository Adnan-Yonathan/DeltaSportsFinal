// Comprehensive Sports Statistics API Integration
// Supports NBA, NFL, MLB, NHL - Player stats, team stats, advanced analytics, injuries

export interface PlayerStats {
  name: string
  team: string
  position?: string
  stats: Record<string, number | string>
  season?: string
}

export interface RosterPlayer {
  id: string
  name: string
  fullName: string
  team: string
  teamAbbr: string
  position: string
  jersey?: string
  height?: string
  weight?: string
  age?: number
  experience?: number
  status?: string // Active, Injured, Out
  headshot?: string
  stats?: Record<string, number | string> // Player statistics
}

export interface TeamStats {
  team: string
  wins: number
  losses: number
  winPct: number
  stats: Record<string, number | string>
  rank?: number
}

export interface InjuryReport {
  player: string
  team: string
  status: string // Out, Questionable, Doubtful, Day-to-Day
  injury?: string
  date?: string
}

export interface GameStats {
  gameId: string
  homeTeam: string
  awayTeam: string
  homeStats?: TeamStats
  awayStats?: TeamStats
  topPlayers?: PlayerStats[]
}

// ==================== NBA STATS (via ESPN) ====================

export async function getNBATeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    // Use standings API which has current, accurate records
    const url = 'https://site.api.espn.com/apis/v2/sports/basketball/nba/standings'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    // Parse both Eastern and Western conferences
    if (data.children) {
      for (const conference of data.children) {
        const entries = conference.standings?.entries || []

        for (const entry of entries) {
          const team = entry.team
          if (teamAbbr && team.abbreviation !== teamAbbr) continue

          // Extract stats from the stats array
          const statsArray = entry.stats || []
          const wins = statsArray.find((s: any) => s.name === 'wins')?.value || 0
          const losses = statsArray.find((s: any) => s.name === 'losses')?.value || 0
          const winPct = statsArray.find((s: any) => s.name === 'winPercent')?.value || 0
          const streak = statsArray.find((s: any) => s.name === 'streak')?.displayValue || ''
          const gamesPlayed = wins + losses

          teams.push({
            team: team.displayName,
            wins,
            losses,
            winPct,
            stats: {
              gamesPlayed,
              streak,
            },
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NBA team stats:', error)
    return []
  }
}

export async function getNBAPlayerStats(playerName?: string): Promise<PlayerStats[]> {
  try {
    // ESPN doesn't have a clean player stats endpoint without player ID
    // For now, we'll return empty and enhance this later with search
    return []
  } catch (error) {
    console.error('Error fetching NBA player stats:', error)
    return []
  }
}

export async function getNBAInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries'
    const response = await fetch(url, { next: { revalidate: 1800 } })

    if (!response.ok) return []

    const data = await response.json()
    const injuries: InjuryReport[] = []

    if (data.teams) {
      for (const teamData of data.teams) {
        const team = teamData.team?.displayName || 'Unknown'

        if (teamData.injuries) {
          for (const injury of teamData.injuries) {
            injuries.push({
              player: injury.athlete?.displayName || 'Unknown',
              team,
              status: injury.status || 'Unknown',
              injury: injury.details?.type || injury.longComment,
              date: injury.date,
            })
          }
        }
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NBA injuries:', error)
    return []
  }
}

export async function getNBARoster(teamAbbr?: string): Promise<RosterPlayer[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const roster: RosterPlayer[] = []

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamObj of data.sports[0].leagues[0].teams) {
        const team = teamObj.team
        if (teamAbbr && team.abbreviation !== teamAbbr) continue

        // Fetch detailed roster for this team
        try {
          const rosterUrl = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${team.id}/roster`
          const rosterResponse = await fetch(rosterUrl, { next: { revalidate: 3600 } })

          if (rosterResponse.ok) {
            const rosterData = await rosterResponse.json()

            // ESPN roster structure: athletes is a direct array
            if (rosterData.athletes && Array.isArray(rosterData.athletes)) {
              for (const athlete of rosterData.athletes) {
                roster.push({
                  id: athlete.id,
                  name: athlete.displayName || athlete.fullName,
                  fullName: athlete.fullName || athlete.displayName,
                  team: team.displayName,
                  teamAbbr: team.abbreviation,
                  position: athlete.position?.abbreviation || athlete.position?.displayName || 'N/A',
                  jersey: athlete.jersey,
                  height: athlete.displayHeight,
                  weight: athlete.displayWeight,
                  age: athlete.age,
                  experience: athlete.experience?.years,
                  status: athlete.injuries && athlete.injuries.length > 0 ? 'Injured' : (athlete.status?.type || 'Active'),
                  headshot: athlete.headshot?.href
                })
              }
            }
          }
        } catch (err) {
          console.error(`Error fetching roster for ${team.displayName}:`, err)
        }
      }
    }

    return roster
  } catch (error) {
    console.error('Error fetching NBA rosters:', error)
    return []
  }
}

export async function searchNBAPlayer(playerName: string): Promise<RosterPlayer | null> {
  try {
    const allPlayers = await getNBARoster()
    const searchLower = playerName.toLowerCase()

    // Try exact match first
    let found = allPlayers.find(p =>
      p.fullName.toLowerCase() === searchLower ||
      p.name.toLowerCase() === searchLower
    )

    // Try partial match if no exact match
    if (!found) {
      found = allPlayers.find(p =>
        p.fullName.toLowerCase().includes(searchLower) ||
        p.name.toLowerCase().includes(searchLower)
      )
    }

    return found || null
  } catch (error) {
    console.error('Error searching for NBA player:', error)
    return null
  }
}

// ==================== NFL STATS (via ESPN) ====================

export async function getNFLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.sports?.[0]?.leagues?.[0]?.teams) {
      for (const teamObj of data.sports[0].leagues[0].teams) {
        const team = teamObj.team
        if (teamAbbr && team.abbreviation !== teamAbbr) continue

        teams.push({
          team: team.displayName,
          wins: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || 0,
          losses: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || 0,
          winPct: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'winPercent')?.value || 0,
          stats: {
            gamesPlayed: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'gamesPlayed')?.value || 0,
            pointsFor: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsFor')?.value || 0,
            pointsAgainst: team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'pointsAgainst')?.value || 0,
            streak: team.record?.items?.[0]?.summary || '',
          },
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NFL team stats:', error)
    return []
  }
}

export async function getNFLInjuries(): Promise<InjuryReport[]> {
  try {
    const url = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/injuries'
    // Disable Next.js caching - response is 8.4MB, exceeds 2MB cache limit
    const response = await fetch(url, { cache: 'no-store' })

    if (!response.ok) return []

    const data = await response.json()
    const injuries: InjuryReport[] = []

    if (data.teams) {
      for (const teamData of data.teams) {
        const team = teamData.team?.displayName || 'Unknown'

        if (teamData.injuries) {
          for (const injury of teamData.injuries) {
            injuries.push({
              player: injury.athlete?.displayName || 'Unknown',
              team,
              status: injury.status || 'Unknown',
              injury: injury.details?.type || injury.longComment,
              date: injury.date,
            })
          }
        }
      }
    }

    return injuries
  } catch (error) {
    console.error('Error fetching NFL injuries:', error)
    return []
  }
}

// ==================== MLB STATS (Official API) ====================

export async function getMLBTeamStats(teamId?: number): Promise<TeamStats[]> {
  try {
    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.records) {
      for (const division of data.records) {
        for (const team of division.teamRecords) {
          if (teamId && team.team.id !== teamId) continue

          teams.push({
            team: team.team.name,
            wins: team.wins,
            losses: team.losses,
            winPct: parseFloat(team.leagueRecord?.pct || '0'),
            stats: {
              gamesPlayed: team.gamesPlayed,
              streak: team.streak?.streakCode || '',
              runsScored: team.runsScored || 0,
              runsAllowed: team.runsAllowed || 0,
              divisionRank: team.divisionRank,
            },
            rank: team.divisionRank,
          })
        }
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching MLB team stats:', error)
    return []
  }
}

export async function getMLBPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
    if (!playerId) return []

    const season = new Date().getFullYear()
    const url = `https://statsapi.mlb.com/api/v1/people/${playerId}/stats?stats=season&season=${season}&group=hitting,pitching`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.stats) {
      for (const statGroup of data.stats) {
        const splits = statGroup.splits?.[0]
        if (splits) {
          players.push({
            name: data.people?.[0]?.fullName || 'Unknown',
            team: splits.team?.name || 'Unknown',
            position: data.people?.[0]?.primaryPosition?.abbreviation,
            stats: splits.stat || {},
            season: splits.season,
          })
        }
      }
    }

    return players
  } catch (error) {
    console.error('Error fetching MLB player stats:', error)
    return []
  }
}

// ==================== NHL STATS (Official API) ====================

export async function getNHLTeamStats(teamAbbr?: string): Promise<TeamStats[]> {
  try {
    const url = 'https://api-web.nhle.com/v1/standings/now'
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const teams: TeamStats[] = []

    if (data.standings) {
      for (const team of data.standings) {
        if (teamAbbr && team.teamAbbrev?.default !== teamAbbr) continue

        teams.push({
          team: team.teamName?.default || team.teamAbbrev?.default,
          wins: team.wins || 0,
          losses: team.losses || 0,
          winPct: team.pointPctg || 0,
          stats: {
            gamesPlayed: team.gamesPlayed || 0,
            points: team.points || 0,
            goalsFor: team.goalFor || 0,
            goalsAgainst: team.goalAgainst || 0,
            goalDifferential: team.goalDifferential || 0,
            overtimeLosses: team.otLosses || 0,
            streak: team.streakCode || '',
          },
          rank: team.leagueSequence,
        })
      }
    }

    return teams
  } catch (error) {
    console.error('Error fetching NHL team stats:', error)
    return []
  }
}

export async function getNHLPlayerStats(playerId?: number): Promise<PlayerStats[]> {
  try {
    if (!playerId) return []

    const season = `${new Date().getFullYear() - 1}${new Date().getFullYear()}`
    const url = `https://api-web.nhle.com/v1/player/${playerId}/landing`
    const response = await fetch(url, { next: { revalidate: 3600 } })

    if (!response.ok) return []

    const data = await response.json()
    const players: PlayerStats[] = []

    if (data.featuredStats?.regularSeason?.subSeason) {
      players.push({
        name: `${data.firstName?.default} ${data.lastName?.default}`,
        team: data.currentTeamAbbrev || 'Unknown',
        position: data.position,
        stats: data.featuredStats.regularSeason.subSeason,
        season,
      })
    }

    return players
  } catch (error) {
    console.error('Error fetching NHL player stats:', error)
    return []
  }
}

// ==================== UNIFIED FUNCTIONS ====================

export async function getTeamStats(sport: string, teamIdentifier?: string): Promise<TeamStats[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBATeamStats(teamIdentifier)
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLTeamStats(teamIdentifier)
    case 'mlb':
    case 'baseball_mlb':
      return getMLBTeamStats(teamIdentifier ? parseInt(teamIdentifier) : undefined)
    case 'nhl':
    case 'icehockey_nhl':
      return getNHLTeamStats(teamIdentifier)
    default:
      return []
  }
}

export async function getInjuryReports(sport: string): Promise<InjuryReport[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBAInjuries()
    case 'nfl':
    case 'americanfootball_nfl':
      return getNFLInjuries()
    default:
      return []
  }
}

export async function getAllInjuries(): Promise<{ sport: string; injuries: InjuryReport[] }[]> {
  const [nbaInjuries, nflInjuries] = await Promise.all([
    getNBAInjuries(),
    getNFLInjuries(),
  ])

  return [
    { sport: 'NBA', injuries: nbaInjuries },
    { sport: 'NFL', injuries: nflInjuries },
  ]
}

export async function searchPlayer(playerName: string, sport?: string): Promise<RosterPlayer | null> {
  try {
    // If sport specified, search only that sport
    if (sport) {
      switch (sport.toLowerCase()) {
        case 'nba':
        case 'basketball_nba':
          return await searchNBAPlayer(playerName)
        default:
          return null
      }
    }

    // Otherwise search NBA (can expand to other sports later)
    return await searchNBAPlayer(playerName)
  } catch (error) {
    console.error('Error searching for player:', error)
    return null
  }
}

export async function getRoster(sport: string, teamAbbr?: string): Promise<RosterPlayer[]> {
  switch (sport.toLowerCase()) {
    case 'nba':
    case 'basketball_nba':
      return getNBARoster(teamAbbr)
    default:
      return []
  }
}

// Helper to format stats for AI consumption
export function formatStatsForAI(stats: TeamStats[] | PlayerStats[] | InjuryReport[]): string {
  if (stats.length === 0) return 'No stats available'

  if ('injury' in stats[0]) {
    // Injury reports
    const injuries = stats as InjuryReport[]
    return injuries.map(i =>
      `${i.player} (${i.team}) - ${i.status}${i.injury ? ': ' + i.injury : ''}`
    ).join('\n')
  } else if ('position' in stats[0]) {
    // Player stats
    const players = stats as PlayerStats[]
    return players.map(p =>
      `${p.name} (${p.team}${p.position ? ', ' + p.position : ''}):\n${JSON.stringify(p.stats, null, 2)}`
    ).join('\n\n')
  } else {
    // Team stats
    const teams = stats as TeamStats[]
    return teams.map(t =>
      `${t.team}: ${t.wins}-${t.losses} (${(t.winPct * 100).toFixed(1)}%)\n${JSON.stringify(t.stats, null, 2)}`
    ).join('\n\n')
  }
}
