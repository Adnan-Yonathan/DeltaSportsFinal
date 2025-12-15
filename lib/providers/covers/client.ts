/**
 * Covers.com HTTP Client
 * 
 * Rate-limited scraper with user-agent rotation to avoid blocking.
 * Uses native fetch with exponential backoff on failures.
 */

// =============================================================================
// User Agent Pool
// =============================================================================

const USER_AGENTS = [
  // Chrome on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  // Chrome on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  // Firefox on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Firefox on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0',
  // Safari on Mac
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  // Edge on Windows
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
]

// =============================================================================
// Rate Limiter
// =============================================================================

interface RateLimiterState {
  lastRequestTime: number
  requestCount: number
  windowStart: number
}

const rateLimiterState: RateLimiterState = {
  lastRequestTime: 0,
  requestCount: 0,
  windowStart: Date.now(),
}

// Configuration
const MIN_DELAY_MS = 2000 // Minimum 2 seconds between requests
const MAX_REQUESTS_PER_MINUTE = 20
const WINDOW_MS = 60000 // 1 minute window

/**
 * Get a random user agent from the pool
 */
function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Apply rate limiting before making a request
 */
async function applyRateLimit(): Promise<void> {
  const now = Date.now()
  
  // Reset window if needed
  if (now - rateLimiterState.windowStart > WINDOW_MS) {
    rateLimiterState.windowStart = now
    rateLimiterState.requestCount = 0
  }
  
  // Check if we've exceeded requests per minute
  if (rateLimiterState.requestCount >= MAX_REQUESTS_PER_MINUTE) {
    const waitTime = WINDOW_MS - (now - rateLimiterState.windowStart)
    if (waitTime > 0) {
      console.log(`[Covers] Rate limit: waiting ${waitTime}ms before next request`)
      await sleep(waitTime)
      rateLimiterState.windowStart = Date.now()
      rateLimiterState.requestCount = 0
    }
  }
  
  // Enforce minimum delay between requests
  const timeSinceLastRequest = now - rateLimiterState.lastRequestTime
  if (timeSinceLastRequest < MIN_DELAY_MS) {
    const waitTime = MIN_DELAY_MS - timeSinceLastRequest
    await sleep(waitTime)
  }
  
  rateLimiterState.lastRequestTime = Date.now()
  rateLimiterState.requestCount++
}

// =============================================================================
// Client Error
// =============================================================================

export class CoversClientError extends Error {
  status?: number
  isRateLimited: boolean
  isBlocked: boolean
  
  constructor(message: string, status?: number) {
    super(message)
    this.name = 'CoversClientError'
    this.status = status
    this.isRateLimited = status === 429
    this.isBlocked = status === 403 || status === 503
  }
}

// =============================================================================
// Fetch with Retry
// =============================================================================

export interface CoversFetchOptions {
  maxRetries?: number
  initialDelayMs?: number
  maxDelayMs?: number
}

const DEFAULT_OPTIONS: Required<CoversFetchOptions> = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
}

/**
 * Fetch HTML from Covers.com with rate limiting, UA rotation, and retries
 */
export async function fetchCoversHtml(
  url: string,
  options: CoversFetchOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  
  let lastError: Error | null = null
  let delay = opts.initialDelayMs
  
  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      // Apply rate limiting
      await applyRateLimit()
      
      const userAgent = getRandomUserAgent()
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Cache-Control': 'max-age=0',
        },
      })
      
      if (!response.ok) {
        throw new CoversClientError(
          `Covers returned ${response.status}: ${response.statusText}`,
          response.status
        )
      }
      
      const html = await response.text()
      
      // Check for soft blocks (captcha pages, etc.)
      if (html.includes('captcha') || html.includes('Please verify')) {
        throw new CoversClientError('Covers returned captcha/verification page', 403)
      }
      
      return html
      
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      // Don't retry on definitive blocks
      if (error instanceof CoversClientError && error.isBlocked) {
        console.error(`[Covers] Blocked on attempt ${attempt + 1}: ${error.message}`)
        if (attempt === opts.maxRetries) throw error
      }
      
      // Exponential backoff
      if (attempt < opts.maxRetries) {
        const jitter = Math.random() * 500
        const waitTime = Math.min(delay + jitter, opts.maxDelayMs)
        console.log(`[Covers] Retry ${attempt + 1}/${opts.maxRetries} after ${waitTime}ms`)
        await sleep(waitTime)
        delay *= 2
      }
    }
  }
  
  throw lastError || new CoversClientError('Failed to fetch from Covers after retries')
}

// =============================================================================
// URL Builders
// =============================================================================

const COVERS_BASE_URL = 'https://www.covers.com'

export function buildATSTrendsUrl(sport: string, league: string, teamSlug: string): string {
  // ATS data is on the main team page (not a separate /ats-trends URL)
  // e.g., /sport/basketball/nba/teams/main/los-angeles-lakers
  return `${COVERS_BASE_URL}/sport/${sport}/${league.toLowerCase()}/teams/main/${teamSlug}`
}

export function buildMatchupsUrl(sport: string, league: string): string {
  // e.g., /sports/nba/matchups
  return `${COVERS_BASE_URL}/sports/${league.toLowerCase()}/matchups`
}

export function buildMatchupDetailUrl(sport: string, league: string, gameId: string): string {
  // e.g., /sport/basketball/nba/matchup/123456
  return `${COVERS_BASE_URL}/sport/${sport}/${league.toLowerCase()}/matchup/${gameId}`
}

// =============================================================================
// Team Slug Mappings
// =============================================================================

export const NBA_TEAM_SLUGS: Record<string, string> = {
  // Atlantic
  'Boston Celtics': 'boston-celtics',
  'Brooklyn Nets': 'brooklyn-nets',
  'New York Knicks': 'new-york-knicks',
  'Philadelphia 76ers': 'philadelphia-76ers',
  'Toronto Raptors': 'toronto-raptors',
  // Central
  'Chicago Bulls': 'chicago-bulls',
  'Cleveland Cavaliers': 'cleveland-cavaliers',
  'Detroit Pistons': 'detroit-pistons',
  'Indiana Pacers': 'indiana-pacers',
  'Milwaukee Bucks': 'milwaukee-bucks',
  // Southeast
  'Atlanta Hawks': 'atlanta-hawks',
  'Charlotte Hornets': 'charlotte-hornets',
  'Miami Heat': 'miami-heat',
  'Orlando Magic': 'orlando-magic',
  'Washington Wizards': 'washington-wizards',
  // Northwest
  'Denver Nuggets': 'denver-nuggets',
  'Minnesota Timberwolves': 'minnesota-timberwolves',
  'Oklahoma City Thunder': 'oklahoma-city-thunder',
  'Portland Trail Blazers': 'portland-trail-blazers',
  'Utah Jazz': 'utah-jazz',
  // Pacific
  'Golden State Warriors': 'golden-state-warriors',
  'Los Angeles Clippers': 'los-angeles-clippers',
  'Los Angeles Lakers': 'los-angeles-lakers',
  'Phoenix Suns': 'phoenix-suns',
  'Sacramento Kings': 'sacramento-kings',
  // Southwest
  'Dallas Mavericks': 'dallas-mavericks',
  'Houston Rockets': 'houston-rockets',
  'Memphis Grizzlies': 'memphis-grizzlies',
  'New Orleans Pelicans': 'new-orleans-pelicans',
  'San Antonio Spurs': 'san-antonio-spurs',
}

// Reverse mapping for lookups
export const NBA_SLUG_TO_TEAM: Record<string, string> = Object.fromEntries(
  Object.entries(NBA_TEAM_SLUGS).map(([team, slug]) => [slug, team])
)

/**
 * Get Covers slug for a team name
 */
export function getTeamSlug(teamName: string, sport: string = 'basketball_nba'): string | null {
  if (sport === 'basketball_nba') {
    // Try direct match
    if (NBA_TEAM_SLUGS[teamName]) {
      return NBA_TEAM_SLUGS[teamName]
    }
    // Try case-insensitive match
    const normalized = teamName.toLowerCase()
    for (const [name, slug] of Object.entries(NBA_TEAM_SLUGS)) {
      if (name.toLowerCase() === normalized) {
        return slug
      }
      // Try partial match (e.g., "Lakers" -> "los-angeles-lakers")
      if (name.toLowerCase().includes(normalized) || normalized.includes(name.toLowerCase().split(' ').pop() || '')) {
        return slug
      }
    }
  }
  return null
}

/**
 * Get team name from Covers slug
 */
export function getTeamName(slug: string, sport: string = 'basketball_nba'): string | null {
  if (sport === 'basketball_nba') {
    return NBA_SLUG_TO_TEAM[slug] || null
  }
  return null
}

/**
 * Get all team slugs for a sport
 */
export function getAllTeamSlugs(sport: string = 'basketball_nba'): string[] {
  if (sport === 'basketball_nba') {
    return Object.values(NBA_TEAM_SLUGS)
  }
  return []
}

