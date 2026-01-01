import { NextRequest, NextResponse } from "next/server"
import { fetchAllLiveScores, type LeagueId } from "@/lib/live-scores"
import { getCachedGameDetails } from "@/lib/services/live-game-cache"
import { searchNBAPlayer, searchNFLPlayer } from "@/lib/sports-stats-api"

const SPORT_TO_LEAGUE: Record<string, LeagueId> = {
  nba: "nba",
  basketball_nba: "nba",
  nfl: "nfl",
  americanfootball_nfl: "nfl",
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "")

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sportParam = (searchParams.get("sport") ?? "nba").toLowerCase()
  const playerName = searchParams.get("player")

  if (!playerName) {
    return NextResponse.json({ error: "Missing player parameter" }, { status: 400 })
  }

  const league = SPORT_TO_LEAGUE[sportParam]
  if (!league) {
    return NextResponse.json({ error: `Unsupported sport ${sportParam}` }, { status: 400 })
  }

  const rosterEntry =
    league === "nba" ? await searchNBAPlayer(playerName) : await searchNFLPlayer(playerName)

  if (!rosterEntry) {
    return NextResponse.json({ error: "Player not found on current rosters" }, { status: 404 })
  }

  const liveScores = await fetchAllLiveScores()
  const game = liveScores.games.find(
    (entry) =>
      entry.league === league &&
      entry.bucket === "live" &&
      entry.competitors.some(
        (team) =>
          normalize(team.name) === normalize(rosterEntry.team) ||
          normalize(team.abbreviation ?? "") === normalize(rosterEntry.teamAbbr)
      )
  )

  if (!game) {
    return NextResponse.json({ error: "No live game found for this player" }, { status: 404 })
  }

  const details = await getCachedGameDetails(league, game.eventId)
  const team = details.teams.find(
    (entry) =>
      normalize(entry.name) === normalize(rosterEntry.team) ||
      normalize(entry.abbreviation ?? "") === normalize(rosterEntry.teamAbbr)
  )

  if (!team) {
    return NextResponse.json({ error: "Unable to locate team stats for player" }, { status: 404 })
  }

  const roster = [...team.starters, ...team.bench]
  const playerEntry =
    roster.find((athlete) => normalize(athlete.id) === normalize(rosterEntry.id)) ??
    roster.find((athlete) => normalize(athlete.name) === normalize(rosterEntry.fullName))

  if (!playerEntry) {
    return NextResponse.json({ error: "No live stats found for this player" }, { status: 404 })
  }

  return NextResponse.json({
    source: "live",
    game: {
      eventId: game.eventId,
      shortName: game.shortName,
      league: game.leagueLabel,
      status: game.status?.shortDetail ?? game.status?.detail,
    },
    player: {
      id: playerEntry.id,
      name: playerEntry.name,
      position: playerEntry.position,
      team: team.name,
      statMap: playerEntry.statMap ?? {},
      summary: playerEntry.summaryLine ?? null,
    },
  })
}
