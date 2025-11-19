import type { LiveScoreGame, LiveScoreGameDetails } from "@/lib/live-scores"

export const formatScoreSummary = (game: LiveScoreGame) => {
  const status =
    game.bucket === "upcoming"
      ? `Tip-off ${new Date(game.startTime).toLocaleTimeString()}`
      : game.status?.shortDetail ?? game.status?.detail ?? "Live"
  const lines = game.competitors
    .map((team) => `${team.abbreviation} ${team.score}`)
    .join(" vs ")
  return `${game.leagueLabel}: ${game.shortName} – ${lines} (${status})`
}

export const formatGameDetailsSummary = (details: LiveScoreGameDetails) => {
  const lines = details.teams
    .map((team) => {
      const starters = team.starters.slice(0, 3).map((starter) => `${starter.name} (${starter.summaryLine ?? "starter"})`)
      return `${team.name}: ${starters.join(", ")}`
    })
    .join(" | ")
  return `${details.leagueLabel} @ ${details.venue ?? "Unknown venue"} – ${lines}`
}
