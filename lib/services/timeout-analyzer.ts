/**
 * Timeout Impact Analyzer
 * Analyzes coaching effectiveness after timeouts using tier-based ratings
 */

import type { LiveScoreGameDetails, PlayByPlayEntry } from '@/lib/live-scores'

// ============================================================================
// INTERFACES
// ============================================================================

export interface CoachProfile {
  name: string
  team: string
  tier: 'S' | 'A' | 'B' | 'C' | 'D'
  grade: number // 0-100
  atoPPP: number // After timeout points per possession
  timeoutImpact: number // Point adjustment after timeout
  runStoppingRate: number // % of time stops opponent runs
}

export interface TimeoutImpactAnalysis {
  homeCoach: CoachProfile | null
  awayCoach: CoachProfile | null
  recentTimeouts: {
    home: number // Count of timeouts in last 5 minutes
    away: number
  }
  lineAdjustment: number
  factors: string[]
}

// ============================================================================
// COACH DATABASE
// ============================================================================

const COACH_DATABASE: Record<string, CoachProfile> = {
  // S-TIER: ELITE
  'Erik Spoelstra': {
    name: 'Erik Spoelstra',
    team: 'Miami Heat',
    tier: 'S',
    grade: 98,
    atoPPP: 1.15,
    timeoutImpact: 2.0,
    runStoppingRate: 0.78
  },
  'Steve Kerr': {
    name: 'Steve Kerr',
    team: 'Golden State Warriors',
    tier: 'S',
    grade: 96,
    atoPPP: 1.14,
    timeoutImpact: 1.8,
    runStoppingRate: 0.76
  },
  'Nick Nurse': {
    name: 'Nick Nurse',
    team: 'Philadelphia 76ers',
    tier: 'S',
    grade: 95,
    atoPPP: 1.13,
    timeoutImpact: 1.8,
    runStoppingRate: 0.75
  },

  // A-TIER: GREAT
  'Tyronn Lue': {
    name: 'Tyronn Lue',
    team: 'Los Angeles Clippers',
    tier: 'A',
    grade: 92,
    atoPPP: 1.09,
    timeoutImpact: 1.5,
    runStoppingRate: 0.74
  },
  'Rick Carlisle': {
    name: 'Rick Carlisle',
    team: 'Indiana Pacers',
    tier: 'A',
    grade: 91,
    atoPPP: 1.08,
    timeoutImpact: 1.5,
    runStoppingRate: 0.72
  },
  'Mike Brown': {
    name: 'Mike Brown',
    team: 'Sacramento Kings',
    tier: 'A',
    grade: 88,
    atoPPP: 1.07,
    timeoutImpact: 1.3,
    runStoppingRate: 0.71
  },
  'Mark Daigneault': {
    name: 'Mark Daigneault',
    team: 'Oklahoma City Thunder',
    tier: 'A',
    grade: 87,
    atoPPP: 1.06,
    timeoutImpact: 1.3,
    runStoppingRate: 0.70
  },
  'Chris Finch': {
    name: 'Chris Finch',
    team: 'Minnesota Timberwolves',
    tier: 'A',
    grade: 86,
    atoPPP: 1.06,
    timeoutImpact: 1.2,
    runStoppingRate: 0.69
  },
  'Kenny Atkinson': {
    name: 'Kenny Atkinson',
    team: 'Cleveland Cavaliers',
    tier: 'A',
    grade: 85,
    atoPPP: 1.05,
    timeoutImpact: 1.2,
    runStoppingRate: 0.68
  },
  'Quin Snyder': {
    name: 'Quin Snyder',
    team: 'Atlanta Hawks',
    tier: 'A',
    grade: 84,
    atoPPP: 1.05,
    timeoutImpact: 1.0,
    runStoppingRate: 0.67
  },

  // B-TIER: ABOVE AVERAGE
  'Jason Kidd': {
    name: 'Jason Kidd',
    team: 'Dallas Mavericks',
    tier: 'B',
    grade: 82,
    atoPPP: 1.04,
    timeoutImpact: 0.8,
    runStoppingRate: 0.65
  },
  'Ime Udoka': {
    name: 'Ime Udoka',
    team: 'Houston Rockets',
    tier: 'B',
    grade: 81,
    atoPPP: 1.03,
    timeoutImpact: 0.8,
    runStoppingRate: 0.64
  },
  'Joe Mazzulla': {
    name: 'Joe Mazzulla',
    team: 'Boston Celtics',
    tier: 'B',
    grade: 78,
    atoPPP: 1.02,
    timeoutImpact: 0.5,
    runStoppingRate: 0.62
  },
  'Billy Donovan': {
    name: 'Billy Donovan',
    team: 'Chicago Bulls',
    tier: 'B',
    grade: 77,
    atoPPP: 1.01,
    timeoutImpact: 0.5,
    runStoppingRate: 0.61
  },
  'Will Hardy': {
    name: 'Will Hardy',
    team: 'Utah Jazz',
    tier: 'B',
    grade: 76,
    atoPPP: 1.00,
    timeoutImpact: 0.5,
    runStoppingRate: 0.60
  },
  'Darko Rajaković': {
    name: 'Darko Rajaković',
    team: 'Toronto Raptors',
    tier: 'B',
    grade: 74,
    atoPPP: 1.00,
    timeoutImpact: 0.3,
    runStoppingRate: 0.58
  },
  'Jamahl Mosley': {
    name: 'Jamahl Mosley',
    team: 'Orlando Magic',
    tier: 'B',
    grade: 73,
    atoPPP: 0.99,
    timeoutImpact: 0.3,
    runStoppingRate: 0.57
  },
  'Charles Lee': {
    name: 'Charles Lee',
    team: 'Charlotte Hornets',
    tier: 'B',
    grade: 72,
    atoPPP: 0.98,
    timeoutImpact: 0.2,
    runStoppingRate: 0.55
  },

  // C-TIER: AVERAGE
  'J.B. Bickerstaff': {
    name: 'J.B. Bickerstaff',
    team: 'Detroit Pistons',
    tier: 'C',
    grade: 68,
    atoPPP: 0.97,
    timeoutImpact: 0.0,
    runStoppingRate: 0.52
  },
  'David Adelman': {
    name: 'David Adelman',
    team: 'Denver Nuggets',
    tier: 'C',
    grade: 67,
    atoPPP: 0.96,
    timeoutImpact: 0.0,
    runStoppingRate: 0.51
  },
  'Doug Christie': {
    name: 'Doug Christie',
    team: 'Sacramento Kings',
    tier: 'C',
    grade: 65,
    atoPPP: 0.96,
    timeoutImpact: 0.0,
    runStoppingRate: 0.50
  },
  'Brian Keefe': {
    name: 'Brian Keefe',
    team: 'Washington Wizards',
    tier: 'C',
    grade: 64,
    atoPPP: 0.95,
    timeoutImpact: 0.0,
    runStoppingRate: 0.50
  },
  'Jordi Fernández': {
    name: 'Jordi Fernández',
    team: 'Brooklyn Nets',
    tier: 'C',
    grade: 63,
    atoPPP: 0.95,
    timeoutImpact: 0.0,
    runStoppingRate: 0.49
  },

  // D-TIER: BELOW AVERAGE
  'Doc Rivers': {
    name: 'Doc Rivers',
    team: 'Milwaukee Bucks',
    tier: 'D',
    grade: 58,
    atoPPP: 0.92,
    timeoutImpact: -0.5,
    runStoppingRate: 0.45
  },
  'JJ Redick': {
    name: 'JJ Redick',
    team: 'Los Angeles Lakers',
    tier: 'D',
    grade: 55,
    atoPPP: 0.90,
    timeoutImpact: -0.8,
    runStoppingRate: 0.42
  },
  'James Borrego': {
    name: 'James Borrego',
    team: 'New Orleans Pelicans',
    tier: 'D',
    grade: 55,
    atoPPP: 0.92,
    timeoutImpact: -0.3,
    runStoppingRate: 0.48
  },
  'Tuomas Iisalo': {
    name: 'Tuomas Iisalo',
    team: 'Memphis Grizzlies',
    tier: 'D',
    grade: 52,
    atoPPP: 0.91,
    timeoutImpact: -0.5,
    runStoppingRate: 0.46
  },
  'Jordan Ott': {
    name: 'Jordan Ott',
    team: 'Phoenix Suns',
    tier: 'D',
    grade: 50,
    atoPPP: 0.90,
    timeoutImpact: -0.5,
    runStoppingRate: 0.45
  },
  'Tiago Splitter': {
    name: 'Tiago Splitter',
    team: 'Portland Trail Blazers',
    tier: 'D',
    grade: 50,
    atoPPP: 0.90,
    timeoutImpact: -0.5,
    runStoppingRate: 0.45
  },
  'Mitch Johnson': {
    name: 'Mitch Johnson',
    team: 'San Antonio Spurs',
    tier: 'D',
    grade: 53,
    atoPPP: 0.91,
    timeoutImpact: -0.3,
    runStoppingRate: 0.47
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get coach by team name
 */
function getCoachByTeam(teamName: string): CoachProfile | null {
  for (const coach of Object.values(COACH_DATABASE)) {
    if (coach.team.toLowerCase().includes(teamName.toLowerCase()) ||
        teamName.toLowerCase().includes(coach.team.toLowerCase().split(' ')[0])) {
      return coach
    }
  }
  return null
}

/**
 * Detect recent timeouts from play-by-play
 */
function detectRecentTimeouts(
  plays: PlayByPlayEntry[],
  lastNMinutes: number = 5
): { home: number; away: number } {
  // Look for timeout indicators in recent plays
  const recentPlays = plays.slice(-60) // Approximate last 5 minutes

  let homeTimeouts = 0
  let awayTimeouts = 0

  for (const play of recentPlays) {
    const text = play.text.toLowerCase()
    if (text.includes('timeout')) {
      // Try to determine which team called timeout
      // This is ESPN-specific parsing - may need refinement
      if (text.includes('home')) {
        homeTimeouts++
      } else if (text.includes('away')) {
        awayTimeouts++
      } else {
        // Generic timeout - count for both (conservative)
        homeTimeouts++
        awayTimeouts++
      }
    }
  }

  return { home: homeTimeouts, away: awayTimeouts }
}

// ============================================================================
// TIMEOUT IMPACT ANALYSIS
// ============================================================================

/**
 * Analyze timeout impact based on coaches
 */
export function analyzeTimeoutImpact(
  liveGame: LiveScoreGameDetails,
  homeTeamName: string,
  awayTeamName: string
): TimeoutImpactAnalysis {
  const homeCoach = getCoachByTeam(homeTeamName)
  const awayCoach = getCoachByTeam(awayTeamName)

  const recentTimeouts = detectRecentTimeouts(liveGame.plays || [], 5)

  const factors: string[] = []
  let lineAdjustment = 0

  // Only apply if timeouts were recently called
  if (recentTimeouts.home > 0 || recentTimeouts.away > 0) {

    if (recentTimeouts.home > 0 && homeCoach) {
      const impact = homeCoach.timeoutImpact * recentTimeouts.home
      lineAdjustment += impact

      if (homeCoach.tier === 'S' || homeCoach.tier === 'D') {
        factors.push(
          `${homeCoach.name} (${homeCoach.tier}-tier) called timeout: ${impact > 0 ? '+' : ''}${impact.toFixed(1)} pts expected impact`
        )
      }
    }

    if (recentTimeouts.away > 0 && awayCoach) {
      const impact = awayCoach.timeoutImpact * recentTimeouts.away
      lineAdjustment -= impact // Away coach helps away team

      if (awayCoach.tier === 'S' || awayCoach.tier === 'D') {
        factors.push(
          `${awayCoach.name} (${awayCoach.tier}-tier) called timeout: ${impact > 0 ? '+' : ''}${impact.toFixed(1)} pts expected impact`
        )
      }
    }

    // Cap adjustment at ±2 points
    lineAdjustment = Math.max(-2, Math.min(2, lineAdjustment))
  }

  return {
    homeCoach,
    awayCoach,
    recentTimeouts,
    lineAdjustment,
    factors
  }
}
