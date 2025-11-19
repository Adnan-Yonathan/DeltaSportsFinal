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

export const formatTeamSnapshot = (teamData: any) => {
  const team = teamData?.team ?? teamData
  const record = teamData?.record?.items?.[0]?.summary ?? teamData?.record?.summary
  const coach = teamData?.coaches?.[0]?.displayName
  const injuries = (teamData?.injuries ?? []).slice(0, 3).map((entry: any) => `${entry.athlete?.displayName} (${entry.type})`)
  const lines = [
    `Team: ${team?.displayName ?? "Unknown"}`,
    record ? `Record: ${record}` : null,
    coach ? `Coach: ${coach}` : null,
    injuries.length ? `Injuries: ${injuries.join(", ")}` : null,
  ].filter(Boolean)
  return lines.join("\n")
}

export const formatPlayerStats = (playerData: any) => {
  const athlete = playerData?.athlete ?? playerData
  const stats =
    playerData?.athlete?.statistics?.splits?.categories ??
    playerData?.statistics?.splits?.categories ??
    playerData?.stats ??
    []
  const rows: string[] = []
  stats.forEach((category: any) => {
    const label = category?.displayName ?? category?.name
    const values =
      category?.stats?.map((stat: any) => `${stat.displayName ?? stat.name}: ${stat.displayValue ?? stat.value}`) ?? []
    if (label && values.length) {
      rows.push(`${label} – ${values.join(", ")}`)
    }
  })

  return [
    `Player: ${athlete?.displayName ?? athlete?.fullName ?? "Unknown player"}`,
    athlete?.position ? `Position: ${athlete.position.displayName ?? athlete.position.abbreviation}` : null,
    rows.length ? rows.join("\n") : "No season stats available.",
  ]
    .filter(Boolean)
    .join("\n")
}
