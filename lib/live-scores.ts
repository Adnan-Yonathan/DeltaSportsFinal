const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

export const ESPN_LEAGUES = [
  { id: "nba", sport: "basketball", league: "nba", label: "NBA" },
  { id: "nfl", sport: "football", league: "nfl", label: "NFL" },
  { id: "nhl", sport: "hockey", league: "nhl", label: "NHL" },
  { id: "cfb", sport: "football", league: "college-football", label: "CFB" },
  { id: "ncaab", sport: "basketball", league: "mens-college-basketball", label: "NCAAB" },
] as const

export type LeagueId = (typeof ESPN_LEAGUES)[number]["id"]
export type ScoreBucket = "upcoming" | "live" | "completed"

export interface LiveScoreLeader {
  name: string
  value: string
  stat: string
}

export interface LiveScoreCompetitor {
  id: string
  name: string
  shortName: string
  abbreviation: string
  logo?: string
  homeAway: "home" | "away"
  score: number
  record?: string
  leaders?: LiveScoreLeader[]
}

export interface LiveScoreGame {
  id: string
  eventId: string
  league: LeagueId
  leagueLabel: string
  shortName: string
  startTime: string
  gameDate: string
  bucket: ScoreBucket
  venue?: string
  status: {
    state?: string
    detail?: string
    shortDetail?: string
    completed?: boolean
    displayClock?: string
    period?: number
  }
  situation?: {
    description?: string | null
    possessionText?: string | null
    downDistanceText?: string | null
  } | null
  broadcast?: string | null
  odds?: string | null
  competitors: LiveScoreCompetitor[]
}

export interface LiveScoresResponse {
  updatedAt: string
  requestedDate: string
  previousDate: string
  games: LiveScoreGame[]
}

export interface GameLineScoreEntry {
  label: string
  value: string
}

export interface GameTeamStatistic {
  label: string
  value: string
}

export interface GamePlayerSummary {
  id: string
  name: string
  position?: string
  jersey?: string
  headshot?: string
  summaryLine?: string
  statMap?: Record<string, string>
}

export interface GameDetailsTeam {
  id: string
  name: string
  abbreviation?: string
  homeAway?: string
  logo?: string
  score?: number
  linescore: GameLineScoreEntry[]
  statistics: GameTeamStatistic[]
  starters: GamePlayerSummary[]
  bench: GamePlayerSummary[]
}

export interface LiveScoreGameDetails {
  eventId: string
  league: LeagueId
  leagueLabel: string
  updatedAt: string
  statusText?: string
  venue?: string
  teams: GameDetailsTeam[]
}

interface FetchLeagueOptions {
  date: string
  mode: "primary" | "completed"
}

const DAY_MS = 24 * 60 * 60 * 1000

const getLeagueConfig = (id: LeagueId) => {
  const config = ESPN_LEAGUES.find((league) => league.id === id)
  if (!config) {
    throw new Error(`Unsupported league: ${id}`)
  }
  return config
}

const toYMD = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  const day = String(date.getUTCDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const normalizeDate = (date?: string): string => {
  if (!date) return toYMD(new Date())
  const parsed = new Date(`${date}T00:00:00Z`)
  if (Number.isNaN(parsed.getTime())) {
    return toYMD(new Date())
  }
  return toYMD(parsed)
}

const shiftDate = (date: string, deltaDays: number): string => {
  const parsed = new Date(`${date}T00:00:00Z`)
  const shifted = new Date(parsed.getTime() + deltaDays * DAY_MS)
  return toYMD(shifted)
}

const toEspnDate = (date: string) => date.replace(/-/g, "")

const determineBucket = (state?: string): ScoreBucket => {
  if (!state) return "upcoming"
  const normalized = state.toLowerCase()
  if (normalized === "in" || normalized === "mid" || normalized === "halftime") return "live"
  if (normalized === "post" || normalized === "final") return "completed"
  return "upcoming"
}

async function fetchLeagueScores(config: (typeof ESPN_LEAGUES)[number], options: FetchLeagueOptions): Promise<LiveScoreGame[]> {
  const url = `${ESPN_BASE_URL}/${config.sport}/${config.league}/scoreboard?dates=${toEspnDate(options.date)}`
  const response = await fetch(url, {
    next: { revalidate: options.mode === "completed" ? 60 : 20 },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${config.label} scores`)
  }

  const data = await response.json()
  const events = Array.isArray(data?.events) ? data.events : []

  return events
    .map((event: any) => {
      const competition = event?.competitions?.[0]
      if (!competition) return null

      const status = competition.status ?? event.status ?? {}
      const bucket = options.mode === "completed" ? "completed" : determineBucket(status?.type?.state ?? status?.type?.name)
      if (options.mode === "primary" && bucket === "completed") return null
      if (options.mode === "completed" && bucket !== "completed") return null

      const odds = competition.odds?.[0]
      const broadcast = competition.broadcasts?.[0]?.names?.[0] ?? null
      const situation = competition.situation
        ? {
            description: competition.situation?.shortDownDistanceText ?? competition.situation?.lastPlay?.text ?? null,
            possessionText: competition.situation?.possessionText ?? null,
            downDistanceText: competition.situation?.downDistanceText ?? null,
          }
        : null

      const competitors: LiveScoreCompetitor[] = (competition.competitors ?? [])
        .map((competitor: any) => {
          const topLeaders = Array.isArray(competitor?.leaders)
            ? competitor.leaders
                .map((leader: any) => {
                  const entry = leader?.leaders?.[0]
                  if (!entry) return null
                  return {
                    name: entry.athlete?.displayName ?? entry.athlete?.shortName ?? "",
                    value: entry.displayValue ?? `${entry.value ?? ""}`,
                    stat: leader.displayName ?? leader.name ?? "",
                  }
                })
                .filter(Boolean)
            : []

          return {
            id: competitor?.team?.id ?? competitor?.id ?? "",
            name: competitor?.team?.displayName ?? competitor?.team?.name ?? "",
            shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.shortName ?? "",
            abbreviation: competitor?.team?.abbreviation ?? "",
            logo: competitor?.team?.logos?.[0]?.href ?? competitor?.team?.logo,
            homeAway: competitor?.homeAway === "home" ? "home" : "away",
            score: Number(competitor?.score ?? 0),
            record: competitor?.records?.[0]?.summary ?? undefined,
            leaders: topLeaders as LiveScoreLeader[],
          }
        })
        .filter((team: LiveScoreCompetitor) => Boolean(team.id && team.name))

      const eventId = event?.id ?? competition?.id ?? `${config.id}-${event?.uid ?? event?.date ?? Date.now()}`

      return {
        id: `${config.id}-${eventId}`,
        eventId,
        league: config.id,
        leagueLabel: config.label,
        shortName: event?.shortName ?? "",
        startTime: event?.date ?? competition?.date ?? new Date().toISOString(),
        gameDate: options.date,
        bucket,
        venue: competition?.venue?.fullName,
        status: {
          state: status?.type?.state ?? status?.type?.name,
          detail: status?.type?.detail ?? status?.type?.description,
          shortDetail: status?.type?.shortDetail,
          completed: status?.type?.completed,
          displayClock: status?.displayClock,
          period: status?.period,
        },
        situation,
        broadcast,
        odds: odds?.details ?? null,
        competitors,
      } satisfies LiveScoreGame
    })
    .filter(Boolean) as LiveScoreGame[]
}

interface FetchAllOptions {
  date?: string
}

export async function fetchAllLiveScores(options: FetchAllOptions = {}): Promise<LiveScoresResponse> {
  const requestedDate = normalizeDate(options.date)
  const previousDate = shiftDate(requestedDate, -1)

  const primaryPromises = ESPN_LEAGUES.map(async (league) => {
    try {
      return await fetchLeagueScores(league, { date: requestedDate, mode: "primary" })
    } catch (error) {
      console.error(`[live-scores] ${league.label} primary fetch failed`, error)
      return []
    }
  })

  const completedPromises = ESPN_LEAGUES.map(async (league) => {
    try {
      return await fetchLeagueScores(league, { date: previousDate, mode: "completed" })
    } catch (error) {
      console.error(`[live-scores] ${league.label} completed fetch failed`, error)
      return []
    }
  })

  const [primaryResults, completedResults] = await Promise.all([
    Promise.all(primaryPromises),
    Promise.all(completedPromises),
  ])

  const games = [...primaryResults.flat(), ...completedResults.flat()].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  )

  return {
    updatedAt: new Date().toISOString(),
    requestedDate,
    previousDate,
    games,
  }
}

const getPeriodLabel = (league: LeagueId, index: number) => {
  if (league === "nhl") {
    const base = ["1st", "2nd", "3rd"]
    if (index < base.length) return base[index]
    return `OT${index - base.length + 1}`
  }
  const base = ["Q1", "Q2", "Q3", "Q4"]
  if (index < base.length) return base[index]
  return `OT${index - base.length + 1}`
}

export async function fetchGameDetails(league: LeagueId, eventId: string): Promise<LiveScoreGameDetails> {
  const config = getLeagueConfig(league)
  const url = `${ESPN_BASE_URL}/${config.sport}/${config.league}/summary?event=${eventId}`
  const response = await fetch(url, {
    next: { revalidate: 15 },
  })

  if (!response.ok) {
    throw new Error(`Unable to fetch summary for event ${eventId}`)
  }

  const data = await response.json()
  const competition = data?.header?.competitions?.[0]

  const playerSections = data?.boxscore?.players ?? []

  const teams: GameDetailsTeam[] =
    competition?.competitors?.map((comp: any) => {
      const teamId = comp?.team?.id ?? comp?.id ?? ""
      const lines: GameLineScoreEntry[] = (comp?.linescores ?? []).map((line: any, index: number) => ({
        label: getPeriodLabel(league, index),
        value: line?.displayValue ?? "",
      }))

      const boxTeam = data?.boxscore?.teams?.find((team: any) => team?.team?.id === teamId)
      const stats: GameTeamStatistic[] = (boxTeam?.statistics ?? [])
        .map((stat: any) => ({
          label: stat?.label ?? stat?.abbreviation ?? stat?.name ?? "",
          value: stat?.displayValue ?? "",
        }))
        .filter((entry: GameTeamStatistic) => entry.label && entry.value)

      const { starters, bench } = buildTeamLineups(playerSections, teamId, league)

      return {
        id: teamId,
        name: comp?.team?.displayName ?? comp?.team?.name ?? "",
        abbreviation: comp?.team?.abbreviation ?? "",
        homeAway: comp?.homeAway,
        logo: comp?.team?.logos?.[0]?.href ?? comp?.team?.logo,
        score: Number(comp?.score ?? 0),
        linescore: lines,
        statistics: stats,
        starters,
        bench,
      } satisfies GameDetailsTeam
    }) ?? []

  return {
    eventId,
    league,
    leagueLabel: config.label,
    updatedAt: new Date().toISOString(),
    statusText: competition?.status?.type?.shortDetail ?? competition?.status?.type?.detail,
    venue: data?.gameInfo?.venue?.fullName ?? competition?.venue?.fullName,
    teams,
  }
}

const DEFAULT_LINEUPS: Record<LeagueId, number> = {
  nba: 5,
  ncaab: 5,
  nhl: 6,
  nfl: 11,
  cfb: 11,
}

const HIGHLIGHT_PRIORITIES: Record<string, string[][]> = {
  nba: [["PTS"], ["REB"], ["AST"]],
  ncaab: [["PTS"], ["REB"], ["AST"]],
  nhl: [["G"], ["A"], ["SOG", "S"], ["TOI"]],
  nfl: [
    ["CMP/ATT", "C/ATT"],
    ["YDS", "PASS YDS"],
    ["TD"],
    ["INT"],
    ["CAR", "RUSH"],
    ["REC", "RECEIVING"],
  ],
  cfb: [
    ["CMP/ATT", "C/ATT"],
    ["YDS", "PASS YDS"],
    ["TD"],
    ["INT"],
    ["CAR", "RUSH"],
    ["REC", "RECEIVING"],
  ],
  default: [["PTS"], ["REB"], ["AST"]],
}

const getHighlightSegments = (league: LeagueId, statMap: Record<string, string> = {}) => {
  const priorities = HIGHLIGHT_PRIORITIES[league] ?? HIGHLIGHT_PRIORITIES.default
  const segments: string[] = []

  priorities.forEach((group) => {
    const key = group.find((candidate) => statMap[candidate])
    if (key) {
      segments.push(`${key.replace("/", " ")} ${statMap[key]}`)
    }
  })

  return segments
}

const buildTeamLineups = (playerSections: any[], teamId: string, league: LeagueId) => {
  const section = playerSections.find((team: any) => team?.team?.id === teamId)
  if (!section) {
    return { starters: [] as GamePlayerSummary[], bench: [] as GamePlayerSummary[] }
  }

  const statsets = section.statistics ?? []
  const map = new Map<
    string,
    GamePlayerSummary & {
      order: number
      isStarter?: boolean
    }
  >()
  let orderCounter = 0

  statsets.forEach((statset: any) => {
    const labels: string[] = statset?.labels ?? statset?.keys ?? []
    const athletes = statset?.athletes ?? []

    athletes.forEach((entry: any, idx: number) => {
      const athlete = entry?.athlete ?? entry
      const id = athlete?.id ?? `${teamId}-${orderCounter}-${idx}`
      let player = map.get(id)
      if (!player) {
        player = {
          id,
          name: athlete?.displayName ?? athlete?.shortName ?? "Player",
          position: athlete?.position?.abbreviation,
          jersey: athlete?.jersey,
          headshot: athlete?.headshot?.href,
          statMap: {},
          summaryLine: undefined,
          order: orderCounter++,
        }
        map.set(id, player)
      }

      ;(entry?.stats ?? []).forEach((value: string, labelIndex: number) => {
        const label = labels[labelIndex]
        if (!label || value === undefined || value === null || value === "") return
        const key = label.toUpperCase()
        player!.statMap![key] = value
      })

      if (entry?.starter) {
        player.isStarter = true
      }
    })
  })

  const players = Array.from(map.values()).sort((a, b) => a.order - b.order)
  players.forEach((player) => {
    const segments = getHighlightSegments(league, player.statMap ?? {})
    player.summaryLine = segments.length ? segments.join(" • ") : undefined
  })

  let starters = players.filter((player) => player.isStarter)
  if (!starters.length && players.length) {
    const defaultCount = DEFAULT_LINEUPS[league] ?? DEFAULT_LINEUPS.nba
    starters = players.slice(0, Math.min(defaultCount, players.length))
  }

  const bench = players.filter((player) => !starters.includes(player))

  return {
    starters,
    bench,
  }
}
