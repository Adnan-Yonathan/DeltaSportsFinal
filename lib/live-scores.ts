import { buildTeamTokenBucket, hasRelevantTeamMentions, isPreviewArticle, normalizeTeamTokens } from "./live-score-articles"

const ESPN_BASE_URL = "https://site.api.espn.com/apis/site/v2/sports"

export const ESPN_LEAGUES = [
  { id: "nba", sport: "basketball", league: "nba", label: "NBA" },
  { id: "nfl", sport: "football", league: "nfl", label: "NFL" },
  { id: "nhl", sport: "hockey", league: "nhl", label: "NHL" },
  { id: "cfb", sport: "football", league: "college-football", label: "CFB" },
  { id: "ncaab", sport: "basketball", league: "mens-college-basketball", label: "NCAAB" },
] as const

const CFB_CONFERENCE_MAP: Record<
  string,
  {
    abbr: string
    name: string
  }
> = {
  // Power 5 / New Alignments
  "1": { abbr: "ACC", name: "ACC" },
  "4": { abbr: "B12", name: "Big 12" },
  "5": { abbr: "B1G", name: "Big Ten" },
  "8": { abbr: "SEC", name: "SEC" },
  "9": { abbr: "PAC", name: "Pac-12" },
  // A5+G5
  "151": { abbr: "AAC", name: "American" },
  "17": { abbr: "MW", name: "Mountain West" },
  "37": { abbr: "SBC", name: "Sun Belt" },
  "15": { abbr: "MAC", name: "MAC" },
  "12": { abbr: "CUSA", name: "C-USA" },
  // Other buckets
  "18": { abbr: "IND", name: "Independent" },
  "21": { abbr: "FCS", name: "FCS" },
  "48": { abbr: "CAA", name: "CAA" },
}

const NCAAB_CONFERENCE_MAP: Record<
  string,
  {
    abbr: string
    name: string
  }
> = {
  "2": { abbr: "ACC", name: "ACC" },
  "8": { abbr: "B12", name: "Big 12" },
  "7": { abbr: "B10", name: "Big Ten" },
  "23": { abbr: "SEC", name: "SEC" },
  "21": { abbr: "PAC", name: "Pac-12" },
  "4": { abbr: "BE", name: "Big East" },
  "44": { abbr: "MW", name: "Mountain West" },
  "29": { abbr: "WCC", name: "West Coast" },
  "3": { abbr: "A10", name: "Atlantic 10" },
  "62": { abbr: "AAC", name: "American" },
}

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
  conferenceId?: string
  conferenceAbbr?: string
  conferenceName?: string
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
  articles?: LiveScoreArticle[]
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

export interface LiveScoreArticle {
  type: "pregame" | "postgame"
  title: string
  url: string
  published: string
  image?: string
}

export interface PlayByPlayEntry {
  id: string
  period?: number
  clock?: string
  text: string
  homeScore?: number
  awayScore?: number
  teamId?: string
}

export interface WinProbabilitySnapshot {
  home: number
  away: number
  updatedAt?: string
}

export interface LiveScoreGameDetails {
  eventId: string
  league: LeagueId
  leagueLabel: string
  updatedAt: string
  statusText?: string
  venue?: string
  teams: GameDetailsTeam[]
  articles?: LiveScoreArticle[]
  plays?: PlayByPlayEntry[]
  winProbability?: WinProbabilitySnapshot
}

interface FetchLeagueOptions {
  date: string
  mode: "primary" | "completed"
}

type NextFetchInit = RequestInit & { next?: { revalidate?: number } }

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

const ARTICLE_CACHE_TTL_MS = 10 * 60 * 1000
const MAX_ARTICLE_FETCHES = 50
const ARTICLE_ENRICH_CONCURRENCY = 6
const articlesCache = new Map<
  string,
  {
    timestamp: number
    data: LiveScoreArticle[]
  }
>()

const parsePublished = (entry: any): string | null => {
  const raw = entry?.published || entry?.publishedDate || entry?.date
  if (!raw) return null
  const ts = Date.parse(raw)
  return Number.isNaN(ts) ? null : new Date(ts).toISOString()
}

const pickArticles = (
  items: any[],
  startTime?: string,
  isCompleted?: boolean
): LiveScoreArticle[] => {
  const startMs = startTime ? Date.parse(startTime) : NaN
  const isStarted = Number.isFinite(startMs) ? Date.now() >= startMs : false
  if (isCompleted || isStarted) return []

  const pre: LiveScoreArticle[] = []

  const addIfValid = (entry: any) => {
    const title =
      entry?.headline || entry?.title || entry?.name || entry?.description || "Article"
    const url =
      entry?.links?.web?.href ||
      entry?.link ||
      entry?.links?.api?.self?.href ||
      entry?.links?.mobile?.href ||
      ""
    if (!title || !url) return
    const published = parsePublished(entry) ?? new Date().toISOString()
    const image =
      entry?.images?.[0]?.url ||
      entry?.images?.[0]?.href ||
      entry?.image?.href ||
      entry?.image?.url

    const article: LiveScoreArticle = { type: "pregame", title, url, published, image }
    pre.push(article)
  }

  items.forEach((item) => addIfValid(item))

  const sortDesc = (arr: LiveScoreArticle[]) =>
    arr.sort((a, b) => Date.parse(b.published) - Date.parse(a.published))

  return pre.length ? [sortDesc(pre)[0]] : []
}

async function fetchArticlesForGame(
  eventId: string,
  league: { sport: string; league: string },
  startTime?: string,
  isCompleted?: boolean,
  teamTokenBuckets: string[][] = []
): Promise<LiveScoreArticle[]> {
  if (!eventId) return []
  if (isCompleted) return []
  const cached = articlesCache.get(eventId)
  const now = Date.now()
  if (cached && now - cached.timestamp < ARTICLE_CACHE_TTL_MS) {
    return cached.data
  }

  try {
    const url = `${ESPN_BASE_URL}/${league.sport}/${league.league}/news?events=${eventId}&limit=8`
    const res = await fetch(url, { next: { revalidate: 600 } } as NextFetchInit)
    if (!res.ok) throw new Error(`news ${res.status}`)
    const data = await res.json()
    const items: any[] = Array.isArray(data?.articles)
      ? data.articles
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.news)
          ? data.news
          : []
    const hasEventTag = (item: any) => {
      const eventList = Array.isArray(item?.events) ? item.events : []
      const eventStrings = eventList.map((e: any) => String(e?.id ?? e)).filter(Boolean)
      const link = item?.link || item?.links?.web?.href || ""
      return eventStrings.includes(eventId) || (typeof link === "string" && link.includes(eventId))
    }

    const normalizedTokenBuckets = teamTokenBuckets
      .map((bucket) => normalizeTeamTokens(bucket))
      .filter((bucket) => bucket.length)

    let filtered = items
    if (items.length && normalizedTokenBuckets.length >= 2) {
      filtered = items.filter((item) => {
        if (!isPreviewArticle(item)) return false
        if (hasEventTag(item)) return true
        const text = `${item?.headline || ""} ${item?.title || ""} ${item?.description || ""}`
        return hasRelevantTeamMentions(text, normalizedTokenBuckets)
      })
    } else if (items.length) {
      // If we don't have clean tokens for both teams, only trust ESPN event tagging and preview signal
      filtered = items.filter((item) => isPreviewArticle(item) && hasEventTag(item))
    }

    const picked = pickArticles(filtered.length ? filtered : items, startTime, isCompleted)
    articlesCache.set(eventId, { timestamp: now, data: picked })
    return picked
  } catch (error) {
    console.warn("[live-scores] article fetch failed", error)
    articlesCache.set(eventId, { timestamp: now, data: [] })
    return []
  }
}

async function fetchLeagueScores(config: (typeof ESPN_LEAGUES)[number], options: FetchLeagueOptions): Promise<LiveScoreGame[]> {
  const params = new URLSearchParams({
    dates: toEspnDate(options.date),
  })
  // ESPN defaults to ranked-only for some college scoreboards; force full slate and high limit
  if (config.id === "ncaab") {
    params.set("groups", "50") // Division I
    params.set("limit", "900")
  }

  const url = `${ESPN_BASE_URL}/${config.sport}/${config.league}/scoreboard?${params.toString()}`
  const response = await fetch(url, {
    next: { revalidate: options.mode === "completed" ? 60 : 20 },
  } as NextFetchInit)

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

          const conferenceId = competitor?.team?.conferenceId ? String(competitor.team.conferenceId) : undefined
          const conferenceMeta =
            config.id === "cfb"
              ? conferenceId
                ? CFB_CONFERENCE_MAP[conferenceId]
                : undefined
              : config.id === "ncaab"
                ? conferenceId
                  ? NCAAB_CONFERENCE_MAP[conferenceId]
                  : undefined
                : undefined
          const conferenceRaw =
            competitor?.team?.conference?.abbreviation ??
            competitor?.team?.conference?.shortName ??
            competitor?.team?.conference?.id ??
            conferenceMeta?.abbr ??
            competitor?.team?.conferenceId ??
            competitor?.team?.conference?.name

          const conferenceLabel =
            competitor?.team?.conference?.name ??
            competitor?.team?.conference?.displayName ??
            conferenceMeta?.name ??
            conferenceId

          return {
            id: competitor?.team?.id ?? competitor?.id ?? "",
            name: competitor?.team?.displayName ?? competitor?.team?.name ?? "",
            shortName: competitor?.team?.shortDisplayName ?? competitor?.team?.shortName ?? "",
            abbreviation: competitor?.team?.abbreviation ?? "",
            conferenceId,
            conferenceAbbr: conferenceRaw != null ? String(conferenceRaw) : undefined,
            conferenceName: conferenceLabel != null ? String(conferenceLabel) : undefined,
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
  includeCompletedForDate?: boolean
}

export async function fetchAllLiveScores(options: FetchAllOptions = {}): Promise<LiveScoresResponse> {
  const requestedDate = normalizeDate(options.date)
  const previousDate = shiftDate(requestedDate, -1)
  const todayYmd = normalizeDate(new Date().toISOString().slice(0, 10))
  const includeCompletedForDate =
    options.includeCompletedForDate ??
    new Date(`${requestedDate}T00:00:00Z`).getTime() <
      new Date(`${todayYmd}T00:00:00Z`).getTime()

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
      const completedDate = includeCompletedForDate ? requestedDate : previousDate
      return await fetchLeagueScores(league, { date: completedDate, mode: "completed" })
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

  // Attach up to MAX_ARTICLE_FETCHES articles (1 pregame, 1 postgame) across the set
  const articleCandidates = games
    .map((game, index) => ({ game, index }))
    .filter(({ game }) => game.bucket === "upcoming")
    .slice(0, MAX_ARTICLE_FETCHES)

  for (let i = 0; i < articleCandidates.length; i += ARTICLE_ENRICH_CONCURRENCY) {
    const batch = articleCandidates.slice(i, i + ARTICLE_ENRICH_CONCURRENCY)
    await Promise.all(
      batch.map(async ({ game, index }) => {
        try {
          const leagueConfig = getLeagueConfig(game.league)
          const articles = await fetchArticlesForGame(
            game.eventId,
            leagueConfig,
            game.startTime,
            false,
            (game.competitors || []).map((c) => buildTeamTokenBucket(c))
          )
          if (articles.length) {
            games[index] = { ...game, articles }
          }
        } catch (error) {
          console.warn("[live-scores] article enrichment failed", error)
        }
      })
    )
  }

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
  } as NextFetchInit)

  if (!response.ok) {
    throw new Error(`Unable to fetch summary for event ${eventId}`)
  }

  const data = await response.json()
  const competition = data?.header?.competitions?.[0]

  const playerSections = data?.boxscore?.players ?? []

  const plays: PlayByPlayEntry[] = (() => {
    const raw =
      (Array.isArray((data as any)?.plays) && (data as any)?.plays) ||
      (Array.isArray((data as any)?.pbp?.items) && (data as any)?.pbp?.items) ||
      []
    return raw
      .map((p: any) => ({
        id: String(p?.id ?? p?.sequenceNumber ?? `${Date.now()}-${Math.random()}`),
        period: p?.period?.number ?? p?.period,
        clock: p?.clock?.displayValue ?? p?.clock,
        text: p?.text ?? p?.description ?? "",
        homeScore: p?.homeScore,
        awayScore: p?.awayScore,
        teamId: p?.team?.id,
      }))
      .filter((p: PlayByPlayEntry) => p.text)
  })()

  const winProbability: WinProbabilitySnapshot | undefined = (() => {
    const wpSeries =
      (Array.isArray((data as any)?.winprobability) && (data as any)?.winprobability) ||
      (Array.isArray((data as any)?.predictor?.items) && (data as any)?.predictor?.items) ||
      []
    const latest = wpSeries[wpSeries.length - 1]
    if (!latest) return undefined
    const homeProb =
      typeof latest?.homeWinPercentage === "number"
        ? latest.homeWinPercentage
        : typeof latest?.homeWinProbability === "number"
          ? latest.homeWinProbability
          : typeof latest?.homeTeam?.probability === "number"
            ? latest.homeTeam.probability
            : undefined
    if (homeProb == null) return undefined
    return {
      home: Math.max(0, Math.min(1, homeProb)),
      away: 1 - Math.max(0, Math.min(1, homeProb)),
      updatedAt: latest?.updated ?? latest?.time,
    }
  })()

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
    articles:
      competition?.status?.type?.completed || competition?.status?.type?.state?.toLowerCase() === "in"
        ? []
        : await fetchArticlesForGame(
            eventId,
            config,
            competition?.date,
            competition?.status?.type?.completed,
            (competition?.competitors || []).map((c: any) =>
              buildTeamTokenBucket({
                name: c?.team?.displayName ?? c?.team?.name,
                shortName: c?.team?.shortDisplayName ?? c?.team?.shortName,
                abbreviation: c?.team?.abbreviation,
              })
            )
          ),
    plays,
    winProbability,
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

  const benchRoster = ["nfl", "cfb"].includes(league) ? [] : players.filter((player) => !starters.includes(player))

  return {
    starters,
    bench: benchRoster,
  }
}
