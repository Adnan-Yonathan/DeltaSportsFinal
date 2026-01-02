/**
 * Build script to fetch all teams from ESPN APIs and generate the static teams registry.
 * Run with: npx ts-node --project tsconfig.test.json scripts/build-teams-registry.ts
 */
import 'dotenv/config'
import * as fs from 'fs'
import * as path from 'path'

import { fetchTeamList as fetchNbaTeams } from '@/lib/providers/espn-nba'
import { fetchTeamList as fetchNflTeams } from '@/lib/providers/espn-nfl'
import { fetchTeamList as fetchMlbTeams } from '@/lib/providers/espn-mlb'
import { fetchTeamList as fetchNhlTeams } from '@/lib/providers/espn-nhl'
import { fetchNcaabTeamList } from '@/lib/providers/espn-ncaab'
import { fetchTeamList as fetchNcaafTeams } from '@/lib/providers/espn-ncaaf'
import type { CanonicalSportKey } from '@/lib/identity/sport'
import type { TeamRecord } from '@/lib/types/teams'

// Team aliases from query-preprocessor.ts - merge these with ESPN data
const NBA_ALIASES: Record<string, string[]> = {
  'Atlanta Hawks': ['hawks', 'atl', 'atlanta'],
  'Boston Celtics': ['celtics', 'bos', 'boston', 'cs'],
  'Brooklyn Nets': ['nets', 'bkn', 'brooklyn', 'brk'],
  'Charlotte Hornets': ['hornets', 'cha', 'charlotte', 'cho'],
  'Chicago Bulls': ['bulls', 'chi', 'chicago'],
  'Cleveland Cavaliers': ['cavaliers', 'cavs', 'cle', 'cleveland'],
  'Dallas Mavericks': ['mavericks', 'mavs', 'dal', 'dallas'],
  'Denver Nuggets': ['nuggets', 'den', 'denver'],
  'Detroit Pistons': ['pistons', 'det', 'detroit'],
  'Golden State Warriors': ['warriors', 'gsw', 'dubs', 'golden state', 'gs'],
  'Houston Rockets': ['rockets', 'hou', 'houston'],
  'Indiana Pacers': ['pacers', 'ind', 'indiana'],
  'Los Angeles Clippers': ['clippers', 'lac', 'la clippers'],
  'Los Angeles Lakers': ['lakers', 'lal', 'la lakers', 'lake show', 'purple and gold'],
  'Memphis Grizzlies': ['grizzlies', 'grizz', 'mem', 'memphis'],
  'Miami Heat': ['heat', 'mia', 'miami'],
  'Milwaukee Bucks': ['bucks', 'mil', 'milwaukee'],
  'Minnesota Timberwolves': ['timberwolves', 'wolves', 'min', 'minnesota', 'twolves'],
  'New Orleans Pelicans': ['pelicans', 'pels', 'nop', 'new orleans'],
  'New York Knicks': ['knicks', 'nyk', 'new york', 'ny'],
  'Oklahoma City Thunder': ['thunder', 'okc', 'oklahoma city', 'oklahoma'],
  'Orlando Magic': ['magic', 'orl', 'orlando'],
  'Philadelphia 76ers': ['76ers', 'sixers', 'phi', 'philly', 'philadelphia'],
  'Phoenix Suns': ['suns', 'phx', 'pho', 'phoenix'],
  'Portland Trail Blazers': ['trail blazers', 'blazers', 'por', 'portland'],
  'Sacramento Kings': ['kings', 'sac', 'sacramento'],
  'San Antonio Spurs': ['spurs', 'sas', 'san antonio'],
  'Toronto Raptors': ['raptors', 'raps', 'tor', 'toronto'],
  'Utah Jazz': ['jazz', 'uta', 'utah'],
  'Washington Wizards': ['wizards', 'wiz', 'was', 'washington'],
}

// NFL team aliases
const NFL_ALIASES: Record<string, string[]> = {
  'Arizona Cardinals': ['cardinals', 'ari', 'arizona'],
  'Atlanta Falcons': ['falcons', 'atl', 'atlanta'],
  'Baltimore Ravens': ['ravens', 'bal', 'baltimore'],
  'Buffalo Bills': ['bills', 'buf', 'buffalo'],
  'Carolina Panthers': ['panthers', 'car', 'carolina'],
  'Chicago Bears': ['bears', 'chi', 'chicago'],
  'Cincinnati Bengals': ['bengals', 'cin', 'cincinnati', 'cincy'],
  'Cleveland Browns': ['browns', 'cle', 'cleveland'],
  'Dallas Cowboys': ['cowboys', 'dal', 'dallas'],
  'Denver Broncos': ['broncos', 'den', 'denver'],
  'Detroit Lions': ['lions', 'det', 'detroit'],
  'Green Bay Packers': ['packers', 'gb', 'green bay', 'pack'],
  'Houston Texans': ['texans', 'hou', 'houston'],
  'Indianapolis Colts': ['colts', 'ind', 'indianapolis', 'indy'],
  'Jacksonville Jaguars': ['jaguars', 'jags', 'jax', 'jacksonville'],
  'Kansas City Chiefs': ['chiefs', 'kc', 'kansas city'],
  'Las Vegas Raiders': ['raiders', 'lv', 'las vegas', 'vegas'],
  'Los Angeles Chargers': ['chargers', 'lac', 'la chargers'],
  'Los Angeles Rams': ['rams', 'lar', 'la rams'],
  'Miami Dolphins': ['dolphins', 'mia', 'miami', 'fins'],
  'Minnesota Vikings': ['vikings', 'min', 'minnesota', 'vikes'],
  'New England Patriots': ['patriots', 'pats', 'ne', 'new england'],
  'New Orleans Saints': ['saints', 'no', 'new orleans', 'nola'],
  'New York Giants': ['giants', 'nyg', 'ny giants'],
  'New York Jets': ['jets', 'nyj', 'ny jets'],
  'Philadelphia Eagles': ['eagles', 'phi', 'philadelphia', 'philly'],
  'Pittsburgh Steelers': ['steelers', 'pit', 'pittsburgh'],
  'San Francisco 49ers': ['49ers', 'niners', 'sf', 'san francisco'],
  'Seattle Seahawks': ['seahawks', 'sea', 'seattle', 'hawks'],
  'Tampa Bay Buccaneers': ['buccaneers', 'bucs', 'tb', 'tampa', 'tampa bay'],
  'Tennessee Titans': ['titans', 'ten', 'tennessee'],
  'Washington Commanders': ['commanders', 'was', 'washington', 'commies'],
}

// MLB team aliases
const MLB_ALIASES: Record<string, string[]> = {
  'Arizona Diamondbacks': ['diamondbacks', 'dbacks', 'ari', 'arizona'],
  'Atlanta Braves': ['braves', 'atl', 'atlanta'],
  'Baltimore Orioles': ['orioles', 'os', 'bal', 'baltimore'],
  'Boston Red Sox': ['red sox', 'sox', 'bos', 'boston'],
  'Chicago Cubs': ['cubs', 'chc', 'chicago cubs'],
  'Chicago White Sox': ['white sox', 'chw', 'chi', 'chicago white sox'],
  'Cincinnati Reds': ['reds', 'cin', 'cincinnati'],
  'Cleveland Guardians': ['guardians', 'cle', 'cleveland'],
  'Colorado Rockies': ['rockies', 'col', 'colorado'],
  'Detroit Tigers': ['tigers', 'det', 'detroit'],
  'Houston Astros': ['astros', 'hou', 'houston', 'stros'],
  'Kansas City Royals': ['royals', 'kc', 'kansas city'],
  'Los Angeles Angels': ['angels', 'laa', 'la angels', 'halos'],
  'Los Angeles Dodgers': ['dodgers', 'lad', 'la dodgers'],
  'Miami Marlins': ['marlins', 'mia', 'miami'],
  'Milwaukee Brewers': ['brewers', 'mil', 'milwaukee', 'brew crew'],
  'Minnesota Twins': ['twins', 'min', 'minnesota'],
  'New York Mets': ['mets', 'nym', 'ny mets'],
  'New York Yankees': ['yankees', 'yanks', 'nyy', 'ny yankees'],
  'Oakland Athletics': ['athletics', 'as', 'oak', 'oakland'],
  'Philadelphia Phillies': ['phillies', 'phi', 'philadelphia', 'phils'],
  'Pittsburgh Pirates': ['pirates', 'pit', 'pittsburgh', 'bucs'],
  'San Diego Padres': ['padres', 'sd', 'san diego'],
  'San Francisco Giants': ['giants', 'sf', 'san francisco'],
  'Seattle Mariners': ['mariners', 'sea', 'seattle', 'ms'],
  'St. Louis Cardinals': ['cardinals', 'cards', 'stl', 'st louis'],
  'Tampa Bay Rays': ['rays', 'tb', 'tampa', 'tampa bay'],
  'Texas Rangers': ['rangers', 'tex', 'texas'],
  'Toronto Blue Jays': ['blue jays', 'jays', 'tor', 'toronto'],
  'Washington Nationals': ['nationals', 'nats', 'was', 'washington'],
}

// NHL team aliases
const NHL_ALIASES: Record<string, string[]> = {
  'Anaheim Ducks': ['ducks', 'ana', 'anaheim'],
  'Arizona Coyotes': ['coyotes', 'yotes', 'ari', 'arizona'],
  'Boston Bruins': ['bruins', 'bos', 'boston', 'bs'],
  'Buffalo Sabres': ['sabres', 'buf', 'buffalo'],
  'Calgary Flames': ['flames', 'cgy', 'calgary'],
  'Carolina Hurricanes': ['hurricanes', 'canes', 'car', 'carolina'],
  'Chicago Blackhawks': ['blackhawks', 'hawks', 'chi', 'chicago'],
  'Colorado Avalanche': ['avalanche', 'avs', 'col', 'colorado'],
  'Columbus Blue Jackets': ['blue jackets', 'cbj', 'columbus'],
  'Dallas Stars': ['stars', 'dal', 'dallas'],
  'Detroit Red Wings': ['red wings', 'wings', 'det', 'detroit'],
  'Edmonton Oilers': ['oilers', 'edm', 'edmonton'],
  'Florida Panthers': ['panthers', 'fla', 'florida'],
  'Los Angeles Kings': ['kings', 'lak', 'la kings', 'la'],
  'Minnesota Wild': ['wild', 'min', 'minnesota'],
  'Montreal Canadiens': ['canadiens', 'habs', 'mtl', 'montreal'],
  'Nashville Predators': ['predators', 'preds', 'nsh', 'nashville'],
  'New Jersey Devils': ['devils', 'njd', 'new jersey', 'nj'],
  'New York Islanders': ['islanders', 'isles', 'nyi', 'ny islanders'],
  'New York Rangers': ['rangers', 'nyr', 'ny rangers'],
  'Ottawa Senators': ['senators', 'sens', 'ott', 'ottawa'],
  'Philadelphia Flyers': ['flyers', 'phi', 'philadelphia', 'philly'],
  'Pittsburgh Penguins': ['penguins', 'pens', 'pit', 'pittsburgh'],
  'San Jose Sharks': ['sharks', 'sjs', 'san jose'],
  'Seattle Kraken': ['kraken', 'sea', 'seattle'],
  'St. Louis Blues': ['blues', 'stl', 'st louis'],
  'Tampa Bay Lightning': ['lightning', 'bolts', 'tb', 'tampa', 'tampa bay'],
  'Toronto Maple Leafs': ['maple leafs', 'leafs', 'tor', 'toronto'],
  'Utah Hockey Club': ['utah hc', 'uta', 'utah'],
  'Vancouver Canucks': ['canucks', 'van', 'vancouver', 'nucks'],
  'Vegas Golden Knights': ['golden knights', 'knights', 'vgk', 'vegas'],
  'Washington Capitals': ['capitals', 'caps', 'was', 'washington'],
  'Winnipeg Jets': ['jets', 'wpg', 'winnipeg'],
}

function getAliasesForTeam(displayName: string, aliasMap: Record<string, string[]>): string[] {
  // Try exact match first
  if (aliasMap[displayName]) {
    return aliasMap[displayName]
  }
  // Try partial match (handle slight name variations)
  for (const [key, aliases] of Object.entries(aliasMap)) {
    if (
      displayName.toLowerCase().includes(key.toLowerCase()) ||
      key.toLowerCase().includes(displayName.toLowerCase())
    ) {
      return aliases
    }
  }
  return []
}

function generateLogoUrl(sport: string, abbreviation: string): string {
  const sportPath: Record<string, string> = {
    nba: 'nba',
    nfl: 'nfl',
    mlb: 'mlb',
    nhl: 'nhl',
    ncaab: 'ncaa',
    ncaaf: 'ncaa',
  }
  const path = sportPath[sport] || sport
  return `https://a.espncdn.com/i/teamlogos/${path}/500/${abbreviation.toLowerCase()}.png`
}

interface EspnTeamMeta {
  id: string
  name: string
  displayName: string
  shortDisplayName: string
  abbreviation: string
}

function transformTeam(
  espnTeam: EspnTeamMeta,
  sport: CanonicalSportKey,
  sportKey: string,
  aliasMap: Record<string, string[]>
): TeamRecord {
  const aliases = getAliasesForTeam(espnTeam.displayName, aliasMap)

  return {
    id: espnTeam.id,
    name: espnTeam.displayName,
    shortName: espnTeam.shortDisplayName || espnTeam.name,
    abbreviation: espnTeam.abbreviation,
    sport,
    aliases,
    logoUrl: generateLogoUrl(sportKey, espnTeam.abbreviation),
  }
}

async function fetchAllTeams(): Promise<TeamRecord[]> {
  const allTeams: TeamRecord[] = []

  console.log('[BUILD] Fetching NBA teams...')
  try {
    const nbaTeams = await fetchNbaTeams()
    for (const team of nbaTeams) {
      allTeams.push(transformTeam(team, 'basketball_nba', 'nba', NBA_ALIASES))
    }
    console.log(`[BUILD] Fetched ${nbaTeams.length} NBA teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch NBA teams:', error)
  }

  console.log('[BUILD] Fetching NFL teams...')
  try {
    const nflTeams = await fetchNflTeams()
    for (const team of nflTeams) {
      allTeams.push(transformTeam(team, 'americanfootball_nfl', 'nfl', NFL_ALIASES))
    }
    console.log(`[BUILD] Fetched ${nflTeams.length} NFL teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch NFL teams:', error)
  }

  console.log('[BUILD] Fetching MLB teams...')
  try {
    const mlbTeams = await fetchMlbTeams()
    for (const team of mlbTeams) {
      allTeams.push(transformTeam(team, 'baseball_mlb', 'mlb', MLB_ALIASES))
    }
    console.log(`[BUILD] Fetched ${mlbTeams.length} MLB teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch MLB teams:', error)
  }

  console.log('[BUILD] Fetching NHL teams...')
  try {
    const nhlTeams = await fetchNhlTeams()
    for (const team of nhlTeams) {
      allTeams.push(transformTeam(team, 'icehockey_nhl', 'nhl', NHL_ALIASES))
    }
    console.log(`[BUILD] Fetched ${nhlTeams.length} NHL teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch NHL teams:', error)
  }

  console.log('[BUILD] Fetching NCAAB teams...')
  try {
    const ncaabTeams = await fetchNcaabTeamList()
    for (const team of ncaabTeams) {
      // College teams use empty alias map (too many to manually curate)
      allTeams.push(transformTeam(team, 'basketball_ncaab', 'ncaab', {}))
    }
    console.log(`[BUILD] Fetched ${ncaabTeams.length} NCAAB teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch NCAAB teams:', error)
  }

  console.log('[BUILD] Fetching NCAAF teams...')
  try {
    const ncaafTeams = await fetchNcaafTeams()
    for (const team of ncaafTeams) {
      allTeams.push(transformTeam(team, 'americanfootball_ncaaf', 'ncaaf', {}))
    }
    console.log(`[BUILD] Fetched ${ncaafTeams.length} NCAAF teams`)
  } catch (error) {
    console.error('[BUILD] Failed to fetch NCAAF teams:', error)
  }

  return allTeams
}

function generateRegistryFile(teams: TeamRecord[]): string {
  const header = `/**
 * Auto-generated teams registry.
 * Generated on: ${new Date().toISOString()}
 * Total teams: ${teams.length}
 *
 * DO NOT EDIT MANUALLY - run \`npx ts-node --project tsconfig.test.json scripts/build-teams-registry.ts\` to regenerate.
 */
import type { TeamRecord } from '@/lib/types/teams'
import type { CanonicalSportKey } from '@/lib/identity/sport'

`

  const teamsArray = `export const TEAMS_REGISTRY: TeamRecord[] = ${JSON.stringify(teams, null, 2)}

`

  const helpers = `// Helper functions for accessing the registry
export function getTeamById(id: string, sport?: CanonicalSportKey): TeamRecord | undefined {
  return TEAMS_REGISTRY.find((t) => t.id === id && (!sport || t.sport === sport))
}

export function getTeamsBySport(sport: CanonicalSportKey): TeamRecord[] {
  return TEAMS_REGISTRY.filter((t) => t.sport === sport)
}

export function getAllTeams(): TeamRecord[] {
  return TEAMS_REGISTRY
}

// Pre-computed counts by sport
export const TEAM_COUNTS: Record<CanonicalSportKey, number> = {
  basketball_nba: TEAMS_REGISTRY.filter((t) => t.sport === 'basketball_nba').length,
  basketball_ncaab: TEAMS_REGISTRY.filter((t) => t.sport === 'basketball_ncaab').length,
  americanfootball_nfl: TEAMS_REGISTRY.filter((t) => t.sport === 'americanfootball_nfl').length,
  americanfootball_ncaaf: TEAMS_REGISTRY.filter((t) => t.sport === 'americanfootball_ncaaf').length,
  baseball_mlb: TEAMS_REGISTRY.filter((t) => t.sport === 'baseball_mlb').length,
  icehockey_nhl: TEAMS_REGISTRY.filter((t) => t.sport === 'icehockey_nhl').length,
}
`

  return header + teamsArray + helpers
}

async function main() {
  console.log('[BUILD] Starting teams registry build...')

  const teams = await fetchAllTeams()

  console.log(`[BUILD] Total teams fetched: ${teams.length}`)

  // Count by sport
  const counts: Record<string, number> = {}
  for (const team of teams) {
    counts[team.sport] = (counts[team.sport] || 0) + 1
  }
  console.log('[BUILD] Teams by sport:', counts)

  // Generate the file
  const content = generateRegistryFile(teams)

  // Write to lib/data/teams-registry.ts
  const outputPath = path.join(__dirname, '..', 'lib', 'data', 'teams-registry.ts')

  // Ensure directory exists
  const dir = path.dirname(outputPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  fs.writeFileSync(outputPath, content, 'utf-8')
  console.log(`[BUILD] Written registry to ${outputPath}`)

  console.log('[BUILD] Done!')
}

main().catch((error) => {
  console.error('[BUILD] Build failed:', error)
  process.exit(1)
})
