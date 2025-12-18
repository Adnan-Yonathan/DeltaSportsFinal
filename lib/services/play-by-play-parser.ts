/**
 * Play-by-Play Parser
 * Utilities for parsing ESPN play-by-play data for momentum analysis
 */

import type { PlayByPlayEntry } from '@/lib/live-scores'

// ============================================================================
// INTERFACES
// ============================================================================

export interface ScoringPlayInfo {
  isScore: boolean
  points: number
  category: 'field_goal' | 'three_pointer' | 'free_throw'
}

export interface ScoreDifferential {
  playIndex: number
  homeChange: number
  awayChange: number
  scoringTeam: 'home' | 'away' | null
}

export interface TimeWindow {
  periodNumber: number
  startClock?: string // "12:00"
  endClock?: string // "7:00"
  lastNSeconds?: number // Alternative: last N seconds
}

export interface ScoringPlay {
  playIndex: number
  period: number
  clock: string
  team: 'home' | 'away'
  points: number
  homeScore: number
  awayScore: number
  text: string
}

// ============================================================================
// CLOCK PARSING
// ============================================================================

/**
 * Parse clock time from "M:SS" format to seconds
 * @param clock - Clock display (e.g., "11:45", "2:30", "0:00")
 * @returns Seconds or null if invalid format
 */
export function parseClockToSeconds(clock: string | undefined): number | null {
  if (!clock) return null

  // Match "M:SS" or "MM:SS" format
  const match = clock.match(/^(\d+):(\d{2})$/)
  if (!match) return null

  const minutes = parseInt(match[1], 10)
  const seconds = parseInt(match[2], 10)

  // Validate seconds range
  if (seconds < 0 || seconds >= 60) return null

  return minutes * 60 + seconds
}

/**
 * Calculate elapsed time in current quarter
 * @param period - Current period/quarter number
 * @param clock - Current clock time ("M:SS")
 * @param league - League identifier (determines quarter length)
 * @returns Elapsed seconds in quarter
 */
export function calculateElapsedInQuarter(
  period: number,
  clock: string,
  league: string = 'nba'
): number {
  const quarterLengthMap: Record<string, number> = {
    nba: 12 * 60, // 720 seconds
    ncaab: 20 * 60, // 1200 seconds (half)
    nfl: 15 * 60, // 900 seconds
    nhl: 20 * 60, // 1200 seconds
  }

  const quarterLength = quarterLengthMap[league] || 720
  const remaining = parseClockToSeconds(clock) || 0

  return quarterLength - remaining
}

/**
 * Check if a play is within last N seconds from current game state
 * @param playPeriod - Period of the play
 * @param playClock - Clock time of the play
 * @param currentPeriod - Current period
 * @param currentClock - Current clock time
 * @param lastNSeconds - Time window in seconds (e.g., 300 for last 5 minutes)
 * @returns True if play is within window
 */
export function isWithinLastNSeconds(
  playPeriod: number,
  playClock: string,
  currentPeriod: number,
  currentClock: string,
  lastNSeconds: number
): boolean {
  // Only check current or previous period
  if (playPeriod < currentPeriod - 1) return false
  if (playPeriod > currentPeriod) return false

  const currentSeconds = parseClockToSeconds(currentClock) || 0
  const playSeconds = parseClockToSeconds(playClock) || 0

  if (playPeriod === currentPeriod) {
    // Same period: check if within time window
    // Current clock is counting down, so play happened at playSeconds > currentSeconds
    const elapsed = playSeconds - currentSeconds
    return elapsed >= 0 && elapsed <= lastNSeconds
  } else if (playPeriod === currentPeriod - 1) {
    // Previous period: check if play was near end
    // Last N seconds of previous quarter
    return playSeconds <= lastNSeconds
  }

  return false
}

// ============================================================================
// SCORING PLAY DETECTION
// ============================================================================

interface ScoringPattern {
  regex: RegExp
  pointValue: number
  category: 'field_goal' | 'three_pointer' | 'free_throw'
}

const SCORING_PATTERNS: ScoringPattern[] = [
  // Three-pointers (check first, more specific)
  { regex: /makes.*3-pt/i, pointValue: 3, category: 'three_pointer' },
  { regex: /makes.*three point/i, pointValue: 3, category: 'three_pointer' },
  { regex: /3PT/i, pointValue: 3, category: 'three_pointer' },

  // Field goals (2 points)
  { regex: /makes.*jumper/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*layup/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*dunk/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*hook shot/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*tip shot/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*floating jump/i, pointValue: 2, category: 'field_goal' },
  { regex: /makes.*driving/i, pointValue: 2, category: 'field_goal' },

  // Free throws
  { regex: /makes free throw/i, pointValue: 1, category: 'free_throw' },
  { regex: /makes technical free throw/i, pointValue: 1, category: 'free_throw' },
  { regex: /makes flagrant free throw/i, pointValue: 1, category: 'free_throw' },
]

/**
 * Detect if play text describes a scoring play
 * @param playText - Play description text
 * @returns Scoring info or null if not a score
 */
export function detectScoringPlay(playText: string): ScoringPlayInfo | null {
  if (!playText) return null

  for (const pattern of SCORING_PATTERNS) {
    if (pattern.regex.test(playText)) {
      return {
        isScore: true,
        points: pattern.pointValue,
        category: pattern.category,
      }
    }
  }

  return null
}

// ============================================================================
// SCORE DIFFERENTIALS
// ============================================================================

/**
 * Calculate score changes between consecutive plays
 * Fallback method when text parsing fails
 * @param plays - Array of plays in chronological order
 * @returns Array of score differentials
 */
export function calculateScoreDifferentials(plays: PlayByPlayEntry[]): ScoreDifferential[] {
  const differentials: ScoreDifferential[] = []

  for (let i = 1; i < plays.length; i++) {
    const current = plays[i]
    const previous = plays[i - 1]

    const homeChange = (current.homeScore || 0) - (previous.homeScore || 0)
    const awayChange = (current.awayScore || 0) - (previous.awayScore || 0)

    let scoringTeam: 'home' | 'away' | null = null
    if (homeChange > 0 && awayChange === 0) {
      scoringTeam = 'home'
    } else if (awayChange > 0 && homeChange === 0) {
      scoringTeam = 'away'
    }

    differentials.push({
      playIndex: i,
      homeChange,
      awayChange,
      scoringTeam,
    })
  }

  return differentials
}

/**
 * Detect score change for a specific play
 * @param currentPlay - The play to check
 * @param previousPlay - The previous play
 * @returns Score differential
 */
export function detectScoreChange(
  currentPlay: PlayByPlayEntry,
  previousPlay: PlayByPlayEntry | null
): ScoreDifferential {
  if (!previousPlay) {
    return { playIndex: 0, homeChange: 0, awayChange: 0, scoringTeam: null }
  }

  const homeChange = (currentPlay.homeScore || 0) - (previousPlay.homeScore || 0)
  const awayChange = (currentPlay.awayScore || 0) - (previousPlay.awayScore || 0)

  let scoringTeam: 'home' | 'away' | null = null
  if (homeChange > 0 && awayChange === 0) {
    scoringTeam = 'home'
  } else if (awayChange > 0 && homeChange === 0) {
    scoringTeam = 'away'
  }

  return {
    playIndex: 0, // Will be set by caller
    homeChange,
    awayChange,
    scoringTeam,
  }
}

// ============================================================================
// TIME WINDOW FILTERING
// ============================================================================

/**
 * Filter plays by time window
 * @param plays - Array of plays
 * @param window - Time window specification
 * @returns Filtered plays
 */
export function filterPlaysByTimeWindow(
  plays: PlayByPlayEntry[],
  window: TimeWindow
): PlayByPlayEntry[] {
  return plays.filter((play) => {
    // Filter by period
    if (play.period !== window.periodNumber) return false

    // If lastNSeconds specified, check time from end of quarter
    if (window.lastNSeconds !== undefined) {
      const clockSeconds = parseClockToSeconds(play.clock || '0:00')
      if (clockSeconds === null) return false
      return clockSeconds <= window.lastNSeconds
    }

    // Otherwise use start/end clock
    const playClock = parseClockToSeconds(play.clock || '0:00')
    if (playClock === null) return false

    if (window.startClock) {
      const startSeconds = parseClockToSeconds(window.startClock)
      if (startSeconds !== null && playClock > startSeconds) return false
    }

    if (window.endClock) {
      const endSeconds = parseClockToSeconds(window.endClock)
      if (endSeconds !== null && playClock < endSeconds) return false
    }

    return true
  })
}

/**
 * Filter plays from a specific quarter/period
 * @param plays - Array of plays
 * @param periodNumber - Quarter/period to filter
 * @returns Plays from that period
 */
export function filterPlaysByPeriod(
  plays: PlayByPlayEntry[],
  periodNumber: number
): PlayByPlayEntry[] {
  return plays.filter((play) => play.period === periodNumber)
}

/**
 * Filter plays within last N minutes of game
 * @param plays - Array of plays (should be sorted chronologically)
 * @param currentPeriod - Current period
 * @param currentClock - Current clock ("M:SS")
 * @param lastNMinutes - Time window in minutes
 * @returns Filtered plays
 */
export function filterPlaysLastNMinutes(
  plays: PlayByPlayEntry[],
  currentPeriod: number,
  currentClock: string,
  lastNMinutes: number
): PlayByPlayEntry[] {
  const lastNSeconds = lastNMinutes * 60

  return plays.filter((play) => {
    return isWithinLastNSeconds(
      play.period || 0,
      play.clock || '0:00',
      currentPeriod,
      currentClock,
      lastNSeconds
    )
  })
}

// ============================================================================
// SCORING PLAY EXTRACTION
// ============================================================================

/**
 * Extract all scoring plays from play-by-play data
 * @param plays - Array of plays
 * @returns Array of scoring plays with metadata
 */
export function extractScoringPlays(plays: PlayByPlayEntry[]): ScoringPlay[] {
  const scoringPlays: ScoringPlay[] = []
  const differentials = calculateScoreDifferentials(plays)

  for (let i = 0; i < plays.length; i++) {
    const play = plays[i]
    const differential = differentials.find((d) => d.playIndex === i)

    // Check text first
    const scoringInfo = detectScoringPlay(play.text)

    // Or use score differential
    const scoringTeam = differential?.scoringTeam

    if (scoringInfo || scoringTeam) {
      scoringPlays.push({
        playIndex: i,
        period: play.period || 0,
        clock: play.clock || '0:00',
        team: scoringTeam || 'home', // Default if not detected
        points: scoringInfo?.points || differential?.homeChange || differential?.awayChange || 0,
        homeScore: play.homeScore || 0,
        awayScore: play.awayScore || 0,
        text: play.text,
      })
    }
  }

  return scoringPlays
}
